// The extension's model-keys port: each card state from a readiness reply, with and without Core's model-access
// state; keys are added in the FluxIQ panel, so the port writes nothing.

import assert from "node:assert/strict";
import test from "node:test";
import { modelAccessWords, type ModelAccessState } from "@fluxiq/ui-components";
import { RUNTIME_MESSAGES } from "../../../../../../shared/constants";
import type { PanelResult, PanelStore } from "../../../../../state";
import { createExtensionChatTransport } from "../../../create-extension-chat-transport";
import { sendRecorder } from "../../../tests/send-recorder";
import { modelKeysPort } from "../model-keys-port";

const reply = (payload: unknown) => ({ ok: true as const, value: { ok: true, payload } });
const access = (status: string, extra: Record<string, unknown> = {}) => ({ status, message: "Core's sentence.", key: { name: "Work key", provider: "anthropic", model: "claude-haiku-5-5" }, lastCall: null, ...extra });
const stateOf = async (payload: unknown): Promise<ModelAccessState> => {
  const read = await modelKeysPort(sendRecorder(reply(payload)).request).readState();
  assert.equal(read.ok, true);
  return (read as { state: ModelAccessState }).state;
};

test("the port reads the readiness message and asks no password", async () => {
  const recorder = sendRecorder(reply({ keys: [], modelAccess: access("ready") }));
  const port = modelKeysPort(recorder.request);
  await port.readState();
  assert.deepEqual(recorder.sent, [{ type: RUNTIME_MESSAGES.panelModelReadiness }]);
  assert.equal(port.canWrite, false);
  assert.equal("requiresPassword" in port, false);
});

test("a reply with Core's state shows each card state", async () => {
  assert.deepEqual(await stateOf({ modelAccess: access("ready") }), { kind: "ready", provider: "Anthropic", keyName: "Work key" });
  assert.deepEqual(await stateOf({ modelAccess: { status: "no_key", message: "Add one.", key: null, lastCall: null } }), { kind: "no-key" });
  assert.equal((await stateOf({ modelAccess: access("key_unopenable", { unopenableCode: "ciphertext_invalid" }) })).kind, "cant-open");
  assert.equal((await stateOf({ modelAccess: access("provider_refused", { lastCall: { outcome: "provider_refused", atMs: 1 } }) })).kind, "not-accepted");
  assert.equal((await stateOf({ modelAccess: access("provider_unreachable", { lastCall: { outcome: "provider_unreachable", atMs: 1 } }) })).kind, "unreachable");
});

test("a reply without Core's state, or with one that cannot be read, says to update FluxIQ", async () => {
  assert.deepEqual(await stateOf({ keys: [{ kind: "llm", enabled: true }] }), { kind: "update-fluxiq" });
  assert.deepEqual(await stateOf({}), { kind: "update-fluxiq" });
  assert.deepEqual(await stateOf({ modelAccess: { status: "ready", message: "x", key: null, lastCall: null } }), { kind: "update-fluxiq" });
  assert.match(modelAccessWords({ kind: "update-fluxiq" }).sentence, /too old/u);
});

test("a failed or rejected request is a failure the card words, never a state", async () => {
  const refused = (async (): Promise<PanelResult<never>> => ({ ok: false, sentence: "Not connected.", detail: "ws closed" })) as unknown as PanelStore["request"];
  assert.deepEqual(await modelKeysPort(refused).readState(), { ok: false, message: "Couldn't check your AI key just now." });
  const thrown = (async () => { throw new Error("worker gone"); }) as unknown as PanelStore["request"];
  assert.deepEqual(await modelKeysPort(thrown).readState(), { ok: false, message: "Couldn't check your AI key just now." });
});

test("the port only shows the key: canWrite is false and a write sends nothing, saying where keys are added", async () => {
  const recorder = sendRecorder(reply({ modelAccess: access("ready") }));
  const port = modelKeysPort(recorder.request);
  assert.equal(port.canWrite, false);
  const secret = "sk-ant-api03-PASTED-VALUE-0001";
  const answers = [await port.save({ provider: "anthropic", name: "Work key", value: secret }), await port.replace("key-1", secret), await port.remove("key-1")];
  assert.deepEqual(recorder.sent, [], "no write message is sent");
  for (const answer of answers) assert.deepEqual(answer, { ok: false, message: "Add or change your AI key in the FluxIQ panel." });
  assert.equal(JSON.stringify(answers).includes(secret), false, "the value is in no answer");
});
