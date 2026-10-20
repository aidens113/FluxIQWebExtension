// Coverage of traced-commands.ts and is-trace-request.ts: only a server
// `execute_action` whose `metadata.trace` is exactly `{ artifacts: true }`
// marks its command traced, the mark (with the request's scope, read by
// read-trace-request.ts) is taken once, and the set stays bounded.

import assert from "node:assert/strict";
import test from "node:test";
import type { ClientGatewayServerMessage } from "../../../shared/protocol";
import { isTraceRequest } from "../is-trace-request";
import { readTraceRequest } from "../read-trace-request";
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
  assert.deepEqual(traced.take("c-1"), {});
  assert.equal(traced.take("c-1"), undefined, "taken once");
  assert.equal(traced.take("c-2"), undefined);
  assert.equal(traced.take("c-3"), undefined);
  assert.equal(traced.take("m-4"), undefined);
});

test("the oldest marks are forgotten past the bound, and a repeat of an id refreshes it", () => {
  const traced = new TracedCommands();
  traced.note(executeAction("first", { trace: { artifacts: true } }));
  traced.note(executeAction("kept", { trace: { artifacts: true } }));
  for (let index = 0; index < 255; index += 1) {
    if (index === 100) traced.note(executeAction("kept", { trace: { artifacts: true } }));
    traced.note(executeAction(`c-${index}`, { trace: { artifacts: true } }));
  }
  assert.equal(traced.take("first"), undefined, "pushed out");
  assert.deepEqual(traced.take("kept"), {}, "refreshed before it could be");
  assert.deepEqual(traced.take("c-254"), {});
});

test("the request's scope is read and handed back when the command is taken; a missing or malformed scope is no scope", () => {
  assert.deepEqual(readTraceRequest({ trace: { artifacts: true, scope: "trace-7" } }), { scope: "trace-7" });
  assert.deepEqual(readTraceRequest({ trace: { artifacts: true } }), {});
  for (const scope of [4, "", null, {}]) assert.deepEqual(readTraceRequest({ trace: { artifacts: true, scope } }), {}, JSON.stringify(scope));
  assert.equal(readTraceRequest({ trace: { artifacts: false, scope: "trace-7" } }), undefined);

  const traced = new TracedCommands();
  traced.note(executeAction("scoped", { trace: { artifacts: true, scope: "trace-7" } }));
  traced.note(executeAction("unscoped", { trace: { artifacts: true } }));
  assert.deepEqual(traced.take("scoped"), { scope: "trace-7" });
  assert.deepEqual(traced.take("unscoped"), {});
  assert.equal(traced.take("scoped"), undefined, "taken once");
});
