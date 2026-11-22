import { createHash } from "node:crypto";
import type { ClientGatewayTraceManifest, ClientGatewayTraceStore } from "fluxiq/client-gateway";
import type { RecordedAttemptArtifact } from "./types.js";
import { recordedRequestDigest } from "./request-digest.js";

/** Trust the actual capture artifact's bytes and source membership, never a caller's position assertion alone. */
export async function verifyRecordedStartingPosition(input: { artifact: RecordedAttemptArtifact; manifest: ClientGatewayTraceManifest; store: Pick<ClientGatewayTraceStore, "readArtifact">; entry: unknown; projectId: string; flowId: string }) {
  const position = input.artifact.startingStore.position;
  if (!position || position.sourceTraceId !== input.manifest.traceId) throw new Error("recorded_start_position_missing");
  const descriptor = input.manifest.artifacts.find((entry) => entry.id === position.artifactId && entry.sha256 === position.sha256 && entry.mediaType === "application/vnd.fluxiq.recorded-start+json");
  if (!descriptor) throw new Error("recorded_start_position_not_in_source");
  const bytes = await input.store.readArtifact(input.manifest.traceId, position.artifactId);
  if (!bytes || createHash("sha256").update(bytes).digest("hex") !== descriptor.sha256) throw new Error("recorded_start_position_bytes_missing");
  let receipt;
  try { receipt = JSON.parse(new TextDecoder("utf8", { fatal: true }).decode(bytes)); } catch { throw new Error("recorded_start_position_unreadable"); }
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) throw new Error("recorded_start_position_unreadable");
  if (receipt.version !== 1 || receipt.position !== "before_entry" || receipt.snapshotMethod !== "closed-store-copy" || JSON.stringify(receipt.excludedTopLevel) !== '["security"]' || receipt.projectId !== input.projectId || receipt.flowId !== input.flowId || receipt.taskId !== input.artifact.taskId || receipt.oracleDigest !== input.artifact.oracleDigest || receipt.storeDigest !== input.artifact.startingStore.digest || receipt.entryDigest !== recordedRequestDigest(JSON.stringify(input.entry))) throw new Error("recorded_start_position_binding_changed");
  if (!Number.isFinite(Date.parse(receipt.capturedAt)) || Date.parse(receipt.capturedAt) > Date.parse(input.manifest.startedAt)) throw new Error("recorded_start_position_not_before_entry");
  return { point: "before_entry" as const, sourceTraceId: position.sourceTraceId, receiptSha256: descriptor.sha256 };
}
