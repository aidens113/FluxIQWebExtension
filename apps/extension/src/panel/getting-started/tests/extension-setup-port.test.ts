// The extension's setup port: sends the readiness message, reads its reply, never throws.

import assert from "node:assert/strict";
import test from "node:test";
import { RUNTIME_MESSAGES } from "../../../shared/constants";
import type { PanelResult } from "../../state";
import { extensionSetupPort } from "../extension-setup-port";

test("the extension port reads configuration changes without an unlock operation", async () => {
  let keys: unknown[] = [{ kind: "llm", enabled: true, availability: { state: "unavailable", code: "host_protection_unavailable" } }];
  const port = extensionSetupPort(async <T>(): Promise<PanelResult<T>> => ({ ok: true, value: { ok: true, payload: { keys } } as T }));
  assert.deepEqual(await port.readModelKey(), { state: "unavailable", code: "host_protection_unavailable" });
  keys = [{ kind: "llm", enabled: true, availability: { state: "available" } }];
  assert.equal(await port.readModelKey(), "ready");
  keys = [];
  assert.equal(await port.readModelKey(), "missing");
});

test("the extension port sends the readiness message and survives a rejected request", async () => {
  const sent: string[] = [];
  const ok = extensionSetupPort(async <T>(message: { type: string }): Promise<PanelResult<T>> => {
    sent.push(message.type);
    return { ok: true, value: { ok: true, payload: { keys: [{ kind: "llm", enabled: true }] } } as T };
  });
  assert.equal(await ok.readModelKey(), "ready");
  assert.deepEqual(sent, [RUNTIME_MESSAGES.panelModelReadiness]);
  const broken = extensionSetupPort(async () => {
    throw new Error("worker gone");
  });
  assert.equal(await broken.readModelKey(), "unknown");
});
