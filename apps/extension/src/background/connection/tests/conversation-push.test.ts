// Coverage of the server-command channel's conversation push: `server.conversation_changed` reaches the panel
// hook and nothing else, and a session becoming ready asks the panel for exactly one full re-read.

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

function build(extra: Partial<ServerCommandChannelDeps>) {
  const sent: string[] = [];
  const deps: ServerCommandChannelDeps = {
    send: (async (type: string) => { sent.push(type); }) as ServerCommandChannelDeps["send"],
    gateway: { noteMessageReceived: () => undefined, markSessionReady: () => undefined, flushQueue: async () => undefined } as unknown as GatewaySession,
    recording: {} as ActiveRecording,
    page: { url: () => "https://shop.test/", tabId: () => 1, sendBrowserState: async () => undefined } as unknown as ActivePage,
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
    ...extra
  };
  return { channel: new ServerCommandChannel(deps), sent };
}

test("server.conversation_changed goes to the panel hook and is never answered", async () => {
  const heard: unknown[] = [];
  const h = build({ acceptConversationChanged: (payload) => heard.push(payload) });
  const payload = { conversationId: "c1", projectId: null };
  await h.channel.handleMessage({ type: "server.conversation_changed", id: "m-1", payload } as unknown as ClientGatewayServerMessage);
  assert.deepEqual(heard, [payload]);
  assert.deepEqual(h.sent, []);
});

test("a ready session asks the panel for one full re-read", async () => {
  let resyncs = 0;
  const h = build({ onSessionResync: () => { resyncs += 1; } });
  await h.channel.handleSessionReady({ type: "server.session_ready", id: "m-2", payload: { sessionId: "s", token: "t" } } as unknown as Extract<ClientGatewayServerMessage, { type: "server.session_ready" }>);
  assert.equal(resyncs, 1);
});
