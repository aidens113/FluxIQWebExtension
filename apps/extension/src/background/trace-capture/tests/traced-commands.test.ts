// Coverage of traced-commands.ts and is-trace-request.ts: only a server
// `execute_action` whose `metadata.trace` is exactly `{ artifacts: true }`
// marks its command traced, the mark is taken once, and the set stays bounded.

import assert from "node:assert/strict";
import test from "node:test";
import type { ClientGatewayServerMessage } from "../../../shared/protocol";
import { isTraceRequest } from "../is-trace-request";
import { TracedCommands } from "../traced-commands";

function executeAction(commandId: string, metadata?: unknown): ClientGatewayServerMessage {
  return { type: "server.execute_action", id: `m-${commandId}`, payload: { commandId, actionType: "web.dom.click", ...(metadata === undefined ? {} : { metadata }) } } as unknown as ClientGatewayServerMessage;
}

test("only metadata.trace.artifacts === true is a trace request", () => {
  assert.equal(isTraceRequest({ trace: { artifacts: true } }), true);
  assert.equal(isTraceRequest({ trace: { artifacts: true }, other: 1 }), true);
  for (const metadata of [undefined, null, "trace", [], {}, { trace: true }, { trace: null }, { trace: { artifacts: "true" } }, { trace: { artifacts: 1 } }, { trace: { page: true } }]) {
    assert.equal(isTraceRequest(metadata), false, JSON.stringify(metadata));
  }
});

test("a traced execute_action is noted and taken once; an untraced one, or another message, never", () => {
  const traced = new TracedCommands();
  traced.note(executeAction("c-1", { trace: { artifacts: true } }));
  traced.note(executeAction("c-2"));
  traced.note(executeAction("c-3", { trace: { artifacts: false } }));
  traced.note({ type: "server.capture_snapshot", id: "m-4", payload: { metadata: { trace: { artifacts: true } } } } as unknown as ClientGatewayServerMessage);
  assert.equal(traced.take("c-1"), true);
  assert.equal(traced.take("c-1"), false, "taken once");
  assert.equal(traced.take("c-2"), false);
  assert.equal(traced.take("c-3"), false);
  assert.equal(traced.take("m-4"), false);
});

test("the oldest marks are forgotten past the bound, and a repeat of an id refreshes it", () => {
  const traced = new TracedCommands();
  traced.note(executeAction("first", { trace: { artifacts: true } }));
  traced.note(executeAction("kept", { trace: { artifacts: true } }));
  for (let index = 0; index < 255; index += 1) {
    if (index === 100) traced.note(executeAction("kept", { trace: { artifacts: true } }));
    traced.note(executeAction(`c-${index}`, { trace: { artifacts: true } }));
  }
  assert.equal(traced.take("first"), false, "pushed out");
  assert.equal(traced.take("kept"), true, "refreshed before it could be");
  assert.equal(traced.take("c-254"), true);
});
