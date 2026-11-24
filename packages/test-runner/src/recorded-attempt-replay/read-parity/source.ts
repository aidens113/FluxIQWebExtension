import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { clientGatewayTraceRecordedDeliveries, clientGatewayTraceReevaluationRequest, type ClientGatewayTraceRecordedPayload } from "fluxiq/client-gateway";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID, webAutomationActionFromGatewayCommand, webAutomationExtractListDispatch, webOfflineReadGatewayCommand, webOfflineReadRecordedSnapshot } from "@fluxiq-web-extension/domain/node";
import { openOfflineTrialHost } from "../../offline-trial-experiment/run/offline-trial/index.js";
import { assertRealisticScenarios } from "../../realistic-scenarios/index.js";
import { loadCreatedFlowRequest } from "../../flow-lane/index.js";
import { ledgerTask } from "../../lab-runs/index.js";
import { resolveLabPaths } from "../../lab-instance/index.js";
import { loadScenarioManifest } from "../../scenarios.js";
import { recordedReadFixtureUrlMatches } from "./fixture-url.js";
import { recordedReadOperations } from "./recorded-operations.js";

type SourceInput = { repositoryRoot: string; scenarioId: string; taskId: string; sourceRootDir: string; projectId: string; traceId: string; commandSequence: number; resultSequence: number; commandId: string; callId: string; primaryArtifactId: string; primarySha256: string; bindingSha256: string; canonicalResultFile: string; canonicalResultSha256: string; runEntrySha256: string; canonicalKind?: "explored" | "replayed" };
const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

/** Admits this exact read segment, never the open trace or its whole task. Raw values stay in memory. */
export async function readRecordedReadSource(input: SourceInput) {
  assertRealisticScenarios([input.scenarioId], "Recorded read parity");
  if (typeof input.taskId !== "string" || !input.taskId.startsWith(`${input.scenarioId}-`) || typeof input.callId !== "string" || !input.callId) throw new Error("recorded_read_identity_required");
  for (const value of [input.primarySha256, input.bindingSha256, input.canonicalResultSha256, input.runEntrySha256]) if (!/^[a-f0-9]{64}$/u.test(value)) throw new Error("recorded_read_digest_required");
  const [allowed, root] = await Promise.all([realpath(path.join(input.repositoryRoot, "test-runs")), realpath(input.sourceRootDir)]);
  const relative = path.relative(allowed, root);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("recorded_read_owned_copy_required");
  const canonical = await canonicalEvidence(input);
  const host = openOfflineTrialHost({ rootDir: root });
  try {
    const store = host.traceStore(input.projectId);
    const manifest = await store.readManifest(input.traceId);
    if (!manifest || manifest.origin.kind !== "live") throw new Error("recorded_read_live_source_required");
    const events = await store.readEventRange(input.traceId, 1, Number.MAX_SAFE_INTEGER);
    const operations = recordedReadOperations(events);
    const cursor = operations.findIndex(operation => operation.sequence === input.commandSequence && operation.commandId === input.commandId);
    const recorded = operations[cursor];
    const event = events.find(event => event.sequence === input.commandSequence);
    if (!recorded || !event || event.payload.encoding !== "json" || recorded.redacted || recorded.actionType !== "web.dom.extract_list") throw new Error("recorded_read_original_command_missing");
    const command = (event.payload.value as { payload: ClientGatewayTraceRecordedPayload }).payload;
    const metadata = command.metadata as Record<string, unknown> | undefined;
    if (!metadata || metadata.callId !== input.callId || metadata.source !== "llm-evidence-runtime" || metadata.projectId !== input.projectId || metadata.domainId !== WEB_AUTOMATION_DOMAIN_ID || typeof metadata.flowId !== "string" || !metadata.flowId) throw new Error("recorded_read_original_call_id_missing");
    const parameters = command.parameters as Record<string, unknown> | undefined;
    if (!parameters?.extractList || digest(JSON.stringify(parameters.extractList)) !== input.bindingSha256) throw new Error("recorded_read_original_binding_changed");
    const deliveries = clientGatewayTraceRecordedDeliveries(events, operations, recorded.session ?? null);
    const scoped = await clientGatewayTraceReevaluationRequest({ store, traceId: input.traceId, manifest, operations, cursor, segment: deliveries.segments[cursor] ?? [], command, operation: recorded, fields: [] });
    if (!scoped || scoped.replaced.event.sequence !== input.resultSequence) throw new Error("recorded_read_single_result_unproved");
    const snapshot = await webOfflineReadRecordedSnapshot(scoped.request);
    const descriptor = scoped.request.artifacts.find(artifact => artifact.id === input.primaryArtifactId && artifact.sha256 === input.primarySha256);
    if (!snapshot || !descriptor || snapshot.primary.sha256 !== descriptor.sha256) throw new Error("recorded_read_primary_identity_unproved");
    for (const part of [snapshot.primary, ...snapshot.resources]) if (digest(part.bytes) !== part.sha256) throw new Error("recorded_read_snapshot_integrity_failed");
    if (!recordedReadFixtureUrlMatches(snapshot.url, canonical.startPath)) throw new Error("recorded_read_fixture_url_unproved");
    const gatewayCommand = webOfflineReadGatewayCommand(command);
    if (!gatewayCommand) throw new Error("recorded_read_command_invalid");
    const action = webAutomationActionFromGatewayCommand(gatewayCommand);
    if ("status" in action || action.actionType !== "web.dom.extract_list") throw new Error("recorded_read_action_not_supported");
    const dispatch = webAutomationExtractListDispatch({ extractList: parameters.extractList as JsonObject });
    const output = dispatch.ok ? dispatch.payload.recordOutput : undefined;
    const currentDerivedSchema = output && typeof output === "object" && !Array.isArray(output) ? output.schema : undefined;
    return { snapshot, action, recordedResult: scoped.request.recordedResult, expectedRows: canonical.rows, canonicalRead: canonical.read, projectionParameters: parameters as JsonObject,currentDerivedSchema, receipt: { ...canonical.receipt, traceId: input.traceId, traceOpen: manifest.closedAt === null, wholeTraceAdmitted: false as const, commandSequence: recorded.sequence, resultSequence: scoped.replaced.event.sequence, commandId: input.commandId, callId: input.callId, primarySha256: descriptor.sha256, bindingSha256: input.bindingSha256, canonicalResultSha256: input.canonicalResultSha256, snapshotUnavailableParts: snapshot.unavailable } };
  } finally { await host.close(); }
}

async function canonicalEvidence(input: SourceInput) {
  const step = path.dirname(input.canonicalResultFile);
  if (path.basename(input.canonicalResultFile) !== "result.json" || !/^\d+-tool-core\.run_node$/u.test(path.basename(step)) || path.basename(path.dirname(step)) !== "steps") throw new Error("recorded_read_canonical_tool_result_required");
  const run = path.dirname(path.dirname(step));
  const [bytes, metadataBytes, entryBytes] = await Promise.all([readFile(input.canonicalResultFile), readFile(path.join(step, "meta.json")), readFile(path.join(run, "entry.json"))]);
  if (digest(bytes) !== input.canonicalResultSha256) throw new Error("recorded_read_canonical_result_changed");
  if (digest(entryBytes) !== input.runEntrySha256) throw new Error("recorded_read_run_receipt_changed");
  const result = JSON.parse(bytes.toString("utf8"));
  const metadata = JSON.parse(metadataBytes.toString("utf8"));
  const entry = JSON.parse(entryBytes.toString("utf8"));
  // An explored read's step shows the model its rows whole; a saved Flow's pass shows only each kept row's label
  // (`readRows`), so its canonical evidence is those labels, never rows it did not show.
  const replayed = input.canonicalKind === "replayed";
  const shown = replayed ? (metadata.resultCode === "core.replay.replayed" ? result.readRows?.rows : undefined) : result.read?.extracted;
  if (metadata.kind !== "tool" || metadata.toolId !== "core.run_node" || metadata.callId !== input.callId || !Array.isArray(shown) || !shown.length) throw new Error("recorded_read_canonical_identity_unproved");
  if (entry.runId !== path.basename(run) || entry.scenarioId !== input.scenarioId) throw new Error("recorded_read_fixture_receipt_mismatch");
  const paths = resolveLabPaths(input.repositoryRoot);
  const scenario = await loadScenarioManifest(input.repositoryRoot, input.scenarioId, paths.scenarioLabDist);
  const task = await loadCreatedFlowRequest({ repositoryRoot: input.repositoryRoot, scenarioLabDist: paths.scenarioLabDist, scenarioId: input.scenarioId, taskId: input.taskId });
  const selected = ledgerTask({ scenarioId: input.scenarioId, work: task.task.id, workflowId: task.workflowId, variantId: task.variantId });
  if (entry.task !== selected) throw new Error("recorded_read_fixture_task_changed");
  return { rows: shown as unknown, read: (replayed ? undefined : result.read) as unknown, startPath: scenario.startPath, receipt: { runId: entry.runId as string, scenarioId: input.scenarioId, taskId: task.task.id, runEntrySha256: input.runEntrySha256, currentTaskSha256: digest(JSON.stringify(task.task)), canonicalKind: replayed ? "replayed" as const : "explored" as const } };
}
