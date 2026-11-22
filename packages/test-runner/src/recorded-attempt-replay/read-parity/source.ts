import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { clientGatewayTraceRecordedDeliveries, clientGatewayTraceReevaluationRequest, readClientGatewayTraceOperation, type ClientGatewayTraceRecordedOperation, type ClientGatewayTraceRecordedPayload } from "fluxiq/client-gateway";
import type { JsonObject } from "fluxiq/core";
import { webAutomationActionFromGatewayCommand, webAutomationExtractListDispatch, webOfflineReadGatewayCommand, webOfflineReadRecordedSnapshot } from "@fluxiq-web-extension/domain/node";
import { openOfflineTrialHost } from "../../offline-trial-experiment/run/offline-trial/index.js";
import { assertRealisticScenarios } from "../../realistic-scenarios/index.js";

/** Admits this exact read segment, never the open trace or its whole task. Raw values stay in memory. */
export async function readRecordedReadSource(input: { repositoryRoot: string; scenarioId: string; sourceRootDir: string; projectId: string; traceId: string; commandSequence: number; resultSequence: number; commandId: string; callId: string; primaryArtifactId: string; primarySha256: string; bindingSha256: string; canonicalResultFile: string; canonicalResultSha256: string }) {
  assertRealisticScenarios([input.scenarioId], "Recorded read parity");
  const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
  for (const value of [input.primarySha256, input.bindingSha256, input.canonicalResultSha256]) if (!/^[a-f0-9]{64}$/u.test(value)) throw new Error("recorded_read_digest_required");
  const [allowed, root] = await Promise.all([realpath(path.join(input.repositoryRoot, "test-runs")), realpath(input.sourceRootDir)]);
  const relative = path.relative(allowed, root);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("recorded_read_owned_copy_required");
  if (path.basename(input.canonicalResultFile) !== "result.json" || !/^\d+-tool-core\.run_node$/u.test(path.basename(path.dirname(input.canonicalResultFile)))) throw new Error("recorded_read_canonical_tool_result_required");
  const [canonicalBytes, metadataText] = await Promise.all([readFile(input.canonicalResultFile), readFile(path.join(path.dirname(input.canonicalResultFile), "meta.json"), "utf8")]);
  if (digest(canonicalBytes) !== input.canonicalResultSha256) throw new Error("recorded_read_canonical_result_changed");
  const canonical = JSON.parse(canonicalBytes.toString("utf8"));
  const metadata = JSON.parse(metadataText);
  if (metadata.kind !== "tool" || metadata.toolId !== "core.run_node" || metadata.callId !== input.callId || !Array.isArray(canonical.read?.extracted) || !canonical.read.extracted.length) throw new Error("recorded_read_canonical_identity_unproved");
  const host = openOfflineTrialHost({ rootDir: root });
  try {
    const store = host.traceStore(input.projectId);
    const manifest = await store.readManifest(input.traceId);
    if (!manifest || manifest.origin.kind !== "live") throw new Error("recorded_read_live_source_required");
    const events = await store.readEventRange(input.traceId, 1, Number.MAX_SAFE_INTEGER);
    const operations: ClientGatewayTraceRecordedOperation[] = [];
    for (const event of events) {
      if (event.kind !== "outbound" || event.messageType !== "server.execute_action" || event.payload.encoding !== "json") continue;
      const envelope = event.payload.value as Record<string, unknown>;
      const payload = envelope?.payload as ClientGatewayTraceRecordedPayload | undefined;
      if (!payload || typeof payload.commandId !== "string") continue;
      operations.push({ ...readClientGatewayTraceOperation(payload), sequence: event.sequence, logicalMs: event.time.logicalMs, commandId: payload.commandId, session: event.session ?? undefined, redacted: event.redactions.length > 0 });
    }
    const cursor = operations.findIndex(operation => operation.sequence === input.commandSequence && operation.commandId === input.commandId);
    const recorded = operations[cursor];
    const event = events.find(event => event.sequence === input.commandSequence);
    if (!recorded || !event || event.payload.encoding !== "json" || recorded.redacted || recorded.actionType !== "web.dom.extract_list") throw new Error("recorded_read_original_command_missing");
    const command = (event.payload.value as { payload: ClientGatewayTraceRecordedPayload }).payload;
    const hasCallId = (value: unknown): boolean => value === input.callId || Boolean(value && typeof value === "object" && Object.values(value).some(hasCallId));
    if (!hasCallId(command.metadata)) throw new Error("recorded_read_original_call_id_missing");
    const parameters = command.parameters as Record<string, unknown> | undefined;
    if (!parameters?.extractList || digest(JSON.stringify(parameters.extractList)) !== input.bindingSha256) throw new Error("recorded_read_original_binding_changed");
    const deliveries = clientGatewayTraceRecordedDeliveries(events, operations, recorded.session ?? null);
    const scoped = await clientGatewayTraceReevaluationRequest({ store, traceId: input.traceId, manifest, operations, cursor, segment: deliveries.segments[cursor] ?? [], command, operation: recorded, fields: [] });
    if (!scoped || scoped.replaced.event.sequence !== input.resultSequence) throw new Error("recorded_read_single_result_unproved");
    const snapshot = await webOfflineReadRecordedSnapshot(scoped.request);
    const descriptor = manifest.artifacts.find(artifact => artifact.id === input.primaryArtifactId && artifact.sha256 === input.primarySha256);
    if (!snapshot || !descriptor || snapshot.primary.sha256 !== descriptor.sha256) throw new Error("recorded_read_primary_identity_unproved");
    for (const part of [snapshot.primary, ...snapshot.resources]) if (digest(part.bytes) !== part.sha256) throw new Error("recorded_read_snapshot_integrity_failed");
    const gatewayCommand = webOfflineReadGatewayCommand(command);
    if (!gatewayCommand) throw new Error("recorded_read_command_invalid");
    const action = webAutomationActionFromGatewayCommand(gatewayCommand);
    if ("status" in action || action.actionType !== "web.dom.extract_list") throw new Error("recorded_read_action_not_supported");
    const dispatch = webAutomationExtractListDispatch({ extractList: parameters.extractList as JsonObject });
    const output = dispatch.ok ? dispatch.payload.recordOutput : undefined;
    const currentDerivedSchema = output && typeof output === "object" && !Array.isArray(output) ? output.schema : undefined;
    return { snapshot, action, recordedResult: scoped.request.recordedResult, expectedRows: canonical.read.extracted as unknown, currentDerivedSchema, receipt: { traceId: input.traceId, traceOpen: manifest.closedAt === null, wholeTraceAdmitted: false as const, commandSequence: recorded.sequence, resultSequence: scoped.replaced.event.sequence, commandId: input.commandId, callId: input.callId, primarySha256: descriptor.sha256, bindingSha256: input.bindingSha256, canonicalResultSha256: input.canonicalResultSha256, snapshotUnavailableParts: snapshot.unavailable } };
  } finally { await host.close(); }
}
