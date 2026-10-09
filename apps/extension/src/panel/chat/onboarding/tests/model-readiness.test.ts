// Reading whether a model key is enabled through a fake request: a key that is
// enabled is ready; none, or only disabled ones, is missing; a failed relay or
// an unpromised shape is unknown, so the chat shows no line.

import assert from "node:assert/strict";
import test from "node:test";
import { RUNTIME_MESSAGES } from "../../../../shared/constants";
import type { PanelMessage, PanelResult } from "../../../state";
import { readModelReadiness } from "../model-readiness";

function answering(reply: PanelResult<unknown> | Error) {
  const sent: PanelMessage[] = [];
  const request = async <T>(message: PanelMessage): Promise<PanelResult<T>> => {
    sent.push(message);
    if (reply instanceof Error) throw reply;
    return reply as PanelResult<T>;
  };
  return { sent, request };
}

const keys = (list: unknown) => ({ ok: true as const, value: { ok: true, payload: { keys: list } } });

test("asks the background's model-readiness relay", async () => {
  const fake = answering(keys([]));
  await readModelReadiness(fake.request);
  assert.deepEqual(fake.sent, [{ type: RUNTIME_MESSAGES.panelModelReadiness }]);
});

test("an enabled key is ready", async () => {
  assert.equal(await readModelReadiness(answering(keys([{ kind: "model", provider: "deepseek", enabled: false }, { kind: "model", provider: "openai", enabled: true }])).request), "ready");
});

test("no key, or only a disabled one, is missing", async () => {
  assert.equal(await readModelReadiness(answering(keys([])).request), "missing");
  assert.equal(await readModelReadiness(answering(keys([{ kind: "model", provider: "deepseek", enabled: false }])).request), "missing");
});

test("a relay failure or an unpromised reply is unknown", async () => {
  assert.equal(await readModelReadiness(answering({ ok: false, sentence: "FluxIQ is not connected." }).request), "unknown");
  assert.equal(await readModelReadiness(answering(new Error("port closed")).request), "unknown");
  assert.equal(await readModelReadiness(answering({ ok: true, value: { ok: true, payload: {} } }).request), "unknown");
  assert.equal(await readModelReadiness(answering({ ok: true, value: undefined }).request), "unknown");
});
