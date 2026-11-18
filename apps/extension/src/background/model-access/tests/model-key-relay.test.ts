import assert from "node:assert/strict";
import test from "node:test";

import { AUTOMATION_PANEL_MESSAGES, type PanelRelayResponse } from "../../../shared/protocol";
import { relayModelKey } from "../model-key-relay";

const SECRET = "sk-ant-secret-value-123";
const ready = { status: "ready", message: "Your model key works.", key: { id: "secret:1", name: "Mine", provider: "anthropic", model: "claude-sonnet-4-5" }, lastCall: null };

function harness(answer: PanelRelayResponse = { ok: true, payload: { modelAccess: ready } }) {
  const calls: Array<{ endpoint: string; payload: Record<string, unknown>; programId: string | undefined }> = [];
  const call = async (endpoint: string, payload: Record<string, unknown>, programId?: string) => {
    calls.push({ endpoint, payload, programId });
    return answer;
  };
  return { calls, call };
}

test("save, replace and remove reach Core's secret-keys program with exactly their fields", async () => {
  const h = harness();
  const expected = { ok: true, payload: { modelAccess: { ...ready, key: { name: "Mine", provider: "anthropic", model: "claude-sonnet-4-5" } } } };
  assert.deepEqual(await relayModelKey(AUTOMATION_PANEL_MESSAGES.modelKeySave, { provider: "anthropic", key: ` ${SECRET} `, name: "Mine", projectId: "x" }, h.call), expected);
  assert.deepEqual(await relayModelKey(AUTOMATION_PANEL_MESSAGES.modelKeyReplace, { key: SECRET, provider: "deepseek" }, h.call), expected);
  assert.deepEqual(await relayModelKey(AUTOMATION_PANEL_MESSAGES.modelKeyRemove, { key: SECRET }, h.call), expected);
  assert.deepEqual(h.calls, [
    { endpoint: "save-model-key", payload: { provider: "anthropic", value: SECRET, name: "Mine" }, programId: "secret-keys" },
    { endpoint: "replace-model-key", payload: { value: SECRET }, programId: "secret-keys" },
    { endpoint: "remove-model-key", payload: {}, programId: "secret-keys" }
  ]);
});

test("a save without a name sends none, and the answer never carries the key", async () => {
  const h = harness();
  const reply = await relayModelKey(AUTOMATION_PANEL_MESSAGES.modelKeySave, { provider: "deepseek", key: SECRET }, h.call);
  assert.deepEqual(h.calls[0]?.payload, { provider: "deepseek", value: SECRET });
  assert.doesNotMatch(JSON.stringify(reply), /sk-ant|secret:1/u);
});

test("a malformed model-access answer is dropped, not forwarded", async () => {
  const h = harness({ ok: true, payload: { modelAccess: { status: "nope" }, value: SECRET } });
  assert.deepEqual(await relayModelKey(AUTOMATION_PANEL_MESSAGES.modelKeyRemove, {}, h.call), { ok: true, payload: {} });
});

test("Core's failures pass through, with the key cut out of any message that repeats it", async () => {
  const refused = { ok: false, code: "forbidden", error: "Not allowed." } as const;
  assert.deepEqual(await relayModelKey(AUTOMATION_PANEL_MESSAGES.modelKeyRemove, {}, harness(refused).call), refused);
  const echoing = { ok: false, code: "refused", error: `Provider rejected ${SECRET}.` } as const;
  const reply = await relayModelKey(AUTOMATION_PANEL_MESSAGES.modelKeySave, { provider: "anthropic", key: SECRET }, harness(echoing).call);
  assert.equal(reply.ok, false);
  assert.doesNotMatch(JSON.stringify(reply), /sk-ant/u);
});

test("bad input is refused and nothing reaches Core", async () => {
  const h = harness();
  const bad: Array<[string, Record<string, unknown>]> = [
    [AUTOMATION_PANEL_MESSAGES.modelKeySave, { provider: "openai", key: SECRET }],
    [AUTOMATION_PANEL_MESSAGES.modelKeySave, { key: SECRET }],
    [AUTOMATION_PANEL_MESSAGES.modelKeySave, { provider: "anthropic", key: "  " }],
    [AUTOMATION_PANEL_MESSAGES.modelKeySave, { provider: "anthropic" }],
    [AUTOMATION_PANEL_MESSAGES.modelKeyReplace, { key: "" }],
    [AUTOMATION_PANEL_MESSAGES.modelKeyReplace, { key: 42 }]
  ];
  for (const [type, message] of bad) {
    const reply = await relayModelKey(type, message, h.call);
    assert.equal(reply.ok, false);
    assert.equal((reply as { code: string }).code, "invalid_request");
    assert.doesNotMatch(JSON.stringify(reply), /sk-ant/u);
  }
  assert.equal(h.calls.length, 0);
});
