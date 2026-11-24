import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { clientGatewayTraceRecordedDeliveries, clientGatewayTraceReevaluationRequest, type ClientGatewayTraceRecordedPayload } from "fluxiq/client-gateway";
import { AutomationStudioProjectDatabasePool, AutomationStudioProjectGatewayTraceStore } from "fluxiq/automation";
import type { JsonObject } from "fluxiq/core";
import { webOfflineReadRecordedSnapshot } from "@fluxiq-web-extension/domain/node";
import { recordedReadOperations } from "../read-parity/index.js";

const READ_ACTION = "web.dom.extract_list";
const RUN_NODE_STEP = /^(\d+)-tool-core\.run_node$/u;
const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

/** One recorded read's exact evidence: its canonical step files and its one dispatched command, result and page snapshot in the trace. */
export type RecordedOracleReadIdentity = {
  step: string;
  callId: string;
  /** The node call as the step recorded it: an explored read's own input, or the saved step Core asked the domain to replay. */
  callValue: JsonObject;
  /** `replayed`: a saved Flow's pass, whose step shows the model each kept row's label only. */
  canonicalKind: "explored" | "replayed";
  flowId: string;
  traceId: string;
  commandSequence: number;
  resultSequence: number;
  commandId: string;
  primaryArtifactId: string;
  primarySha256: string;
  bindingSha256: string;
  canonicalResultFile: string;
  canonicalResultSha256: string;
  runEntrySha256: string;
};

/**
 * Finds the evidence one canonical read step names, by identity only: the step folder by its number, its call by the
 * id the step's own metadata states, and the one `web.dom.extract_list` command in the copied trace store whose
 * producer metadata carries that call id. Several or none is a refusal, never a choice. The admission itself is
 * `readRecordedReadSource`'s; this only names what it checks.
 */
export async function discoverRecordedOracleRead(input: { runDir: string; sourceRootDir: string; projectId: string; step: string }): Promise<RecordedOracleReadIdentity> {
  if (!/^\d+$/u.test(input.step)) throw new Error("recorded_oracle_step_number_required");
  const folders = (await readdir(path.join(input.runDir, "steps"))).filter((name) => RUN_NODE_STEP.exec(name)?.[1] === input.step);
  if (folders.length !== 1) throw new Error("recorded_oracle_step_not_found");
  const stepDir = path.join(input.runDir, "steps", folders[0]!);
  const [metaBytes, callBytes, resultBytes, entryBytes] = await Promise.all([readFile(path.join(stepDir, "meta.json")), readFile(path.join(stepDir, "call.json")), readFile(path.join(stepDir, "result.json")), readFile(path.join(input.runDir, "entry.json"))]);
  const meta = JSON.parse(metaBytes.toString("utf8")) as Record<string, unknown>;
  const call = JSON.parse(callBytes.toString("utf8")) as Record<string, unknown>;
  const callId = meta.callId;
  const callValue = call.input;
  if (typeof callId !== "string" || call.callId !== callId || typeof callValue !== "object" || callValue === null || Array.isArray(callValue)) throw new Error("recorded_oracle_step_call_unreadable");
  const canonicalKind = meta.resultCode === "core.replay.replayed" ? "replayed" as const : "explored" as const;
  const pool = new AutomationStudioProjectDatabasePool({ rootDir: path.join(input.sourceRootDir, ".fluxiq", "artifacts", "automation-studio") });
  try {
    const store = await AutomationStudioProjectGatewayTraceStore.open({ pool, projectId: input.projectId });
    try {
      const found: Omit<RecordedOracleReadIdentity, "step" | "callId" | "callValue" | "canonicalKind" | "canonicalResultFile" | "canonicalResultSha256" | "runEntrySha256">[] = [];
      for (const manifest of await store.listManifests({})) {
        const events = await store.readEventRange(manifest.traceId, 1, Number.MAX_SAFE_INTEGER);
        const operations = recordedReadOperations(events);
        for (const [cursor, operation] of operations.entries()) {
          if (operation.actionType !== READ_ACTION) continue;
          const event = events.find((candidate) => candidate.sequence === operation.sequence);
          const command = event?.payload.encoding === "json" ? (event.payload.value as { payload?: ClientGatewayTraceRecordedPayload }).payload : undefined;
          const metadata = command?.metadata as Record<string, unknown> | undefined;
          if (!command || metadata?.callId !== callId) continue;
          const parameters = command.parameters as Record<string, unknown> | undefined;
          const deliveries = clientGatewayTraceRecordedDeliveries(events, operations, operation.session ?? null);
          const scoped = await clientGatewayTraceReevaluationRequest({ store, traceId: manifest.traceId, manifest, operations, cursor, segment: deliveries.segments[cursor] ?? [], command, operation, fields: [] });
          const snapshot = scoped === undefined ? undefined : await webOfflineReadRecordedSnapshot(scoped.request);
          const descriptor = snapshot === undefined ? undefined : scoped!.request.artifacts.find((artifact) => artifact.sha256 === snapshot.primary.sha256);
          if (!scoped || !snapshot || !descriptor || !parameters?.extractList || typeof metadata.flowId !== "string") throw new Error("recorded_oracle_trace_read_incomplete");
          found.push({ flowId: metadata.flowId, traceId: manifest.traceId, commandSequence: operation.sequence, resultSequence: scoped.replaced.event.sequence, commandId: operation.commandId, primaryArtifactId: descriptor.id, primarySha256: descriptor.sha256, bindingSha256: digest(JSON.stringify(parameters.extractList)) });
        }
      }
      if (found.length !== 1) throw new Error(found.length === 0 ? "recorded_oracle_trace_read_missing" : `recorded_oracle_trace_read_ambiguous_${found.length}`);
      return { step: input.step, callId, callValue: callValue as JsonObject, canonicalKind, ...found[0]!, canonicalResultFile: path.join(stepDir, "result.json"), canonicalResultSha256: digest(resultBytes), runEntrySha256: digest(entryBytes) };
    } finally {
      await store.close();
    }
  } finally {
    await pool.closeAll();
  }
}
