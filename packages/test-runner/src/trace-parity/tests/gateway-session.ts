// Test support: one session recorded live by Core's own gateway tap into a
// store the caller gives (the real project store in these tests), the way the
// Lab's Core records a run. The client paired before the trace opened, as the
// extension does before a run's episode begins.

import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import {
  CLIENT_GATEWAY_PROTOCOL_VERSION, CLIENT_GATEWAY_TRACE_TAP_STREAMS, ClientGatewayService, ClientGatewayTraceRecorder,
  type ClientGatewayClientMessage, type ClientGatewayTraceManifest, type ClientGatewayTraceSink, type ClientGatewayTraceStoreWriter,
} from "fluxiq/client-gateway";

/** Text a result carries in its payload; no parity output may contain it. */
export const SESSION_PAYLOAD_MARKER = "parity-payload-marker-4b1e";

function message<TType extends ClientGatewayClientMessage["type"]>(type: TType, payload: Extract<ClientGatewayClientMessage, { type: TType }>["payload"]): Extract<ClientGatewayClientMessage, { type: TType }> {
  return { id: `${type}.${Math.random().toString(36).slice(2)}`, type, protocolVersion: CLIENT_GATEWAY_PROTOCOL_VERSION, timestamp: Date.now(), payload } as Extract<ClientGatewayClientMessage, { type: TType }>;
}

/** A traced action with an uploaded page artifact and its result, a state update, and an action whose answer never came. */
export async function recordGatewaySession(store: ClientGatewayTraceStoreWriter, traceId: string): Promise<ClientGatewayTraceManifest> {
  const frame = new AsyncLocalStorage<ClientGatewayTraceSink>();
  const gateway = new ClientGatewayService({ commandTimeoutMs: 25, trace: { current: () => frame.getStore() }, commandOwner: () => ({ projectId: "project.parity", runId: "run.parity" }) });
  const sent: { type: string; payload: { commandId?: string } }[] = [];
  const session = gateway.connect({ socket: { send: (raw: string) => { sent.push(JSON.parse(raw) as (typeof sent)[number]); } } });
  await gateway.receive(session.sessionId, message("client.hello", { clientId: "client.parity", clientType: "extension", name: "client.parity", metadata: { domainId: "example.domain" } }));
  const pairing = gateway.snapshot().pairings.find(item => item.requestedBySessionId === session.sessionId);
  if (pairing) await gateway.approvePairing(pairing.pairingCode, { approvedByUserId: "user.parity" });
  gateway.clearOutbound(session.sessionId);

  const recorder = new ClientGatewayTraceRecorder({
    traceId, episodeId: `run.${traceId}`, activity: "execution", origin: { kind: "live" }, contractVersions: { protocol: CLIENT_GATEWAY_PROTOCOL_VERSION }, capabilities: null,
    context: { schema: { name: "parity-test", version: "1" }, value: null }, streams: [CLIENT_GATEWAY_TRACE_TAP_STREAMS.gateway, CLIENT_GATEWAY_TRACE_TAP_STREAMS.artifact],
  }, { store, now: () => Date.now(), maxBufferedEvents: 10_000, maxBufferedArtifactBytes: 10_000_000 });

  const press = frame.run(recorder, () => gateway.executeAction(session.sessionId, { actionType: "example.press", parameters: { value: 1 }, timeoutMs: 60_000 }));
  await gateway.receiveRaw(session.sessionId, JSON.stringify(message("client.state_update", { state: { step: "one" } })));
  const bytes = new TextEncoder().encode("<doc>observed</doc>");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  gateway.receiveTraceArtifact(session.sessionId, { sha256, mediaType: "text/html", bytes });
  const trace = { artifacts: [{ sha256, mediaType: "text/html", byteLength: bytes.byteLength, role: "primary" }], unavailable: 0 };
  await gateway.receiveRaw(session.sessionId, JSON.stringify(message("client.action_result", { commandId: press.commandId, status: "succeeded", payload: { note: SESSION_PAYLOAD_MARKER }, metadata: { trace } })));
  await press.result;
  const waited = frame.run(recorder, () => gateway.executeAction(session.sessionId, { actionType: "example.wait" }));
  await waited.result;
  const manifest = await recorder.close({ terminationReason: "completed", terminationDetail: null });
  await gateway.close();
  return manifest;
}
