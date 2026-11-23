import { createHash } from "node:crypto";
import { AutomationStudioGatewayTraceInstallation, AUTOMATION_STUDIO_GATEWAY_TRACE_CONTROL } from "fluxiq/automation";
import { recordedRequestDigest } from "../request-digest.js";

/** Attaches producer bytes only inside the same actual public entry's live exploration. */
export function recordedCaptureAttachment(receipt: Readonly<{ projectId: string; flowId: string; entryDigest: string }>, bytes: Uint8Array) {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  let attached: Readonly<{ sourceTraceId: string; artifactId: string; sha256: string }> | undefined;
  return (actualEntry: unknown) => {
    try {
      if (recordedRequestDigest(JSON.stringify(actualEntry)) !== receipt.entryDigest) throw new Error("changed");
    } catch { throw new Error("recorded_start_capture_entry_changed"); }
    const episode = AutomationStudioGatewayTraceInstallation.current()?.current();
    if (!episode || episode.projectId !== receipt.projectId || episode.flowId !== receipt.flowId || episode.activity !== "exploration") throw new Error("recorded_start_capture_trace_mismatch");
    if (attached) {
      if (attached.sourceTraceId !== episode.traceId) throw new Error("recorded_start_capture_trace_changed");
      return attached;
    }
    const recorded = episode.sink.recordArtifact({ stream: AUTOMATION_STUDIO_GATEWAY_TRACE_CONTROL.stream, messageType: "recorded.start", mediaType: "application/vnd.fluxiq.recorded-start+json", bytes, resourceKey: null, source: { id: null, sequence: null, timestamp: null }, correlation: { commandId: null, recordingId: null, causationEventId: null, owner: null, observationRevision: null, baseRevision: null } });
    if (recorded.status !== "recorded" || recorded.artifactId === null) throw new Error("recorded_start_capture_not_recorded");
    attached = Object.freeze({ sourceTraceId: episode.traceId, artifactId: recorded.artifactId, sha256 });
    return attached;
  };
}
