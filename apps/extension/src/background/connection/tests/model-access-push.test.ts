// `server.model_access_changed` reaches the panel hook and nothing else, and is never answered.

import assert from "node:assert/strict";
import test from "node:test";
import type { ClientGatewayServerMessage, FluxIQSession, FluxIQSettings } from "../../../shared/protocol";
import type { ActivePage } from "../active-page";
import type { ActiveRecording } from "../active-recording/index";
import type { ContentAttachment } from "../content-attachment";
import { EventSequence } from "../event-sequence";
import type { GatewaySession } from "../gateway-session";
import type { RecordingEvidenceReporter } from "../recording-evidence";
import { RuntimeStatusTracker } from "../runtime-status";
import { ServerCommandChannel, type ServerCommandChannelDeps } from "../server-command-channel";

test("server.model_access_changed goes to the panel hook and is never answered", async () => {
  const sent: string[] = [];
  const heard: unknown[] = [];
  const deps: ServerCommandChannelDeps = {
    send: (async (type: string) => { sent.push(type); }) as ServerCommandChannelDeps["send"],
    gateway: { noteMessageReceived: () => undefined } as unknown as GatewaySession,
    recording: {} as ActiveRecording,
    page: {} as unknown as ActivePage,
    runtimeStatus: new RuntimeStatusTracker(),
    attachment: {} as ContentAttachment,
    evidence: {} as RecordingEvidenceReporter,
    sequence: new EventSequence(),
    session: () => ({ clientId: "client-1" }) as FluxIQSession,
    settings: () => ({ gatewayUrl: "ws://gateway.test" }) as FluxIQSettings,
    persistSession: async () => undefined,
    captureActionBoundary: async () => undefined,
    setLastError: () => undefined,
    onActivity: () => undefined,
    emitStatus: () => undefined,
    recordEvent: async () => undefined,
    acceptActivity: () => undefined,
    stopRecording: async () => undefined,
    disconnect: () => undefined,
    acceptModelAccessChanged: (payload) => heard.push(payload)
  };
  const payload = { modelAccess: { status: "no_key" } };
  await new ServerCommandChannel(deps).handleMessage({ type: "server.model_access_changed", id: "m-1", payload } as unknown as ClientGatewayServerMessage);
  assert.deepEqual(heard, [payload]);
  assert.deepEqual(sent, []);
});
