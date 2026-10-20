import { ClientGatewayTraceRecorder } from "fluxiq/client-gateway";
import type { ClientGatewayTraceEventInput, ClientGatewayTraceManifest, ClientGatewayTraceStoreWriter } from "fluxiq/client-gateway";

/** A secret no fixture event carries in clear; the hello event carries it only in its redacted field. */
export const FIXTURE_TOKEN = "fixture-gateway-token-7f3c9a1d5e";

const correlation = (commandId: string | null) => ({ commandId, recordingId: null, causationEventId: null, owner: null, observationRevision: null, baseRevision: null });
const source = { id: null, sequence: null, timestamp: null };

function event(kind: ClientGatewayTraceEventInput["kind"], messageType: string, value: unknown, commandId: string | null, redactions: ClientGatewayTraceEventInput["redactions"] = []): ClientGatewayTraceEventInput {
  return { stream: "gateway", kind, messageType, source, correlation: correlation(commandId), payloadSchema: null, payload: { encoding: "json", value }, artifactIds: [], redactions };
}

/**
 * Records one traced command the way the gateway tap does: a credential-redacted
 * hello, a traced `server.execute_action`, the page snapshot and a resource
 * uploaded on the artifact stream, and the result carrying `metadata.trace`
 * references in its raw text. `leak` puts the token in a result in clear.
 */
export async function recordFixtureTrace(store: ClientGatewayTraceStoreWriter, input: { traceId: string; episodeId: string; resource: Uint8Array; leak?: boolean; clock?: () => number }): Promise<ClientGatewayTraceManifest> {
  let now = Date.parse("2026-10-20T00:00:00.000Z");
  const clock = input.clock ?? (() => (now += 5));
  const recorder = new ClientGatewayTraceRecorder(
    { traceId: input.traceId, episodeId: input.episodeId, activity: "execution", origin: { kind: "live" }, contractVersions: {}, capabilities: null, context: { schema: { name: "fixture", version: "1" }, value: null }, streams: ["gateway", "artifact"] },
    { store, now: clock, maxBufferedEvents: 100, maxBufferedArtifactBytes: 1_000_000 },
  );
  recorder.record(event("inbound", "client.hello", { type: "client.hello", payload: { token: { redacted: "credential" } } }, null, [{ path: "/payload/token", reason: "credential" }]));
  recorder.record(event("outbound", "server.execute_action", { type: "server.execute_action", payload: { actionType: "capture_snapshot", commandId: "cmd-1", metadata: { trace: { artifacts: true } } } }, "cmd-1"));
  const page = new TextEncoder().encode("<html><body>fixture</body></html>");
  for (const [bytes, mediaType] of [[page, "text/html"], [input.resource, "image/png"]] as const) {
    recorder.recordArtifact({ stream: "artifact", messageType: null, mediaType, bytes, resourceKey: null, source, correlation: correlation("cmd-1") });
  }
  const references = { artifacts: [{ sha256: "a".repeat(64), mediaType: "text/html", byteLength: page.byteLength, role: "primary" }, { sha256: "b".repeat(64), mediaType: "image/png", byteLength: input.resource.byteLength, role: "resource" }], unavailable: 1 };
  const result = { type: "client.action_result", payload: { commandId: "cmd-1", status: "succeeded", ...(input.leak ? { note: FIXTURE_TOKEN } : {}), metadata: { trace: references } } };
  recorder.record({ ...event("inbound", "client.action_result", null, "cmd-1"), payload: { encoding: "text", text: JSON.stringify(result) } });
  return await recorder.close({ terminationReason: "completed", terminationDetail: null });
}
