// The extension's setup port: sends the readiness message, reads its reply, never throws.

import assert from "node:assert/strict";
import test from "node:test";
import { RUNTIME_MESSAGES } from "../../../shared/constants";
import type { PanelResult } from "../../state";
import { extensionSetupPort } from "../extension-setup-port";

test("the extension port remembers why the key it last read is locked, and forgets once it is not", async () => {
  let keys: unknown[] = [{ enabled: true, unlocked: false, lockedBecause: "signed_out" }];
  const port = extensionSetupPort(async <T>(): Promise<PanelResult<T>> => ({ ok: true, value: { ok: true, payload: { keys } } as T }));
  assert.equal(port.lockWords?.(), undefined);
  assert.equal(await port.readModelKey(), "locked");
  assert.match(port.lockWords?.() ?? "", /because you signed out/u);
  keys = [{ enabled: true, unlocked: true }];
  assert.equal(await port.readModelKey(), "ready");
  assert.equal(port.lockWords?.(), undefined);
});

test("the extension port sends the readiness message and survives a rejected request", async () => {
  const sent: string[] = [];
  const ok = extensionSetupPort(async <T>(message: { type: string }): Promise<PanelResult<T>> => {
    sent.push(message.type);
    return { ok: true, value: { ok: true, payload: { keys: [{ enabled: true }] } } as T };
  });
  assert.equal(await ok.readModelKey(), "ready");
  assert.deepEqual(sent, [RUNTIME_MESSAGES.panelModelReadiness]);
  const broken = extensionSetupPort(async () => {
    throw new Error("worker gone");
  });
  assert.equal(await broken.readModelKey(), "unknown");
});
