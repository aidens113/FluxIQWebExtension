// The extension's setup port: sends the readiness message, reads its reply as the card's state, never throws.

import assert from "node:assert/strict";
import test from "node:test";
import { RUNTIME_MESSAGES } from "../../../shared/constants";
import type { PanelResult } from "../../state";
import { extensionSetupPort } from "../extension-setup-port";

const access = (status: string, extra: Record<string, unknown> = {}) => ({ status, message: "Core's sentence.", key: { name: "Work key", provider: "deepseek", model: "deepseek-chat" }, lastCall: null, ...extra });
const answering = (payload: unknown) => async <T>(): Promise<PanelResult<T>> => ({ ok: true, value: { ok: true, payload } as T });

test("the port reads Core's model-access state as the card's state", async () => {
  assert.deepEqual(await extensionSetupPort(answering({ modelAccess: access("ready") })).readModelKey(), { kind: "ready", provider: "DeepSeek", keyName: "Work key" });
  assert.deepEqual(await extensionSetupPort(answering({ modelAccess: { status: "no_key", message: "Add one.", key: null, lastCall: null } })).readModelKey(), { kind: "no-key" });
  assert.equal((await extensionSetupPort(answering({ modelAccess: access("key_unopenable", { unopenableCode: "host_protection_unavailable" }) })).readModelKey() as { kind: string }).kind, "cant-open");
});

test("a reply without the state says to update FluxIQ, as the card does", async () => {
  assert.deepEqual(await extensionSetupPort(answering({ keys: [{ kind: "llm", enabled: true }] })).readModelKey(), { kind: "update-fluxiq" });
});

test("the port sends the readiness message and survives a failed or rejected request", async () => {
  const sent: string[] = [];
  const ok = extensionSetupPort(async <T>(message: { type: string }): Promise<PanelResult<T>> => {
    sent.push(message.type);
    return { ok: true, value: { ok: true, payload: { modelAccess: access("ready") } } as T };
  });
  assert.deepEqual(await ok.readModelKey(), { kind: "ready", provider: "DeepSeek", keyName: "Work key" });
  assert.deepEqual(sent, [RUNTIME_MESSAGES.panelModelReadiness]);
  const refused = extensionSetupPort(async <T>(): Promise<PanelResult<T>> => ({ ok: false, sentence: "Not connected.", detail: "x" }));
  assert.equal(await refused.readModelKey(), "unknown");
  const broken = extensionSetupPort(async () => {
    throw new Error("worker gone");
  });
  assert.equal(await broken.readModelKey(), "unknown");
});
