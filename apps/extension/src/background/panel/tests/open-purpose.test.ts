// "Open FluxIQ" for a purpose: the keys page of the configured web address, validated like any open.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { RUNTIME_MESSAGES } from "../../../shared/constants";
import type { FluxIQSettings } from "../../../shared/protocol";
import { fluxIQKeysAddress } from "../open-fluxiq";
import { handlePanelControl, type PanelControlDeps } from "../panel-control";

const sidepanel = { id: "extension-id", url: "chrome-extension://extension-id/sidepanel/index.html" } as chrome.runtime.MessageSender;

function installChrome(t: TestContext) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: { runtime: { id: "extension-id", getURL: (path: string) => `chrome-extension://extension-id/${path}` } } });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "chrome", previous);
    else Reflect.deleteProperty(globalThis, "chrome");
  });
}

function depsFor(coreApiUrl: string) {
  const opened: string[] = [];
  const deps = {
    readSettings: async () => ({ coreApiUrl }) as FluxIQSettings,
    openTab: async (url: string) => {
      opened.push(url);
    }
  } as unknown as PanelControlDeps;
  return { deps, opened };
}

const open = (extra: Record<string, unknown>) => ({ type: RUNTIME_MESSAGES.panelOpenFluxIQ, ...extra });

test("the keys page sits at the root of the configured address", () => {
  assert.equal(fluxIQKeysAddress("https://flux.example/app/?a=1#b"), "https://flux.example/programs/secret-keys");
  assert.equal(fluxIQKeysAddress(undefined), "http://127.0.0.1:3000/programs/secret-keys");
  assert.equal(fluxIQKeysAddress("ftp://flux.example"), undefined);
  assert.equal(fluxIQKeysAddress("not an address"), undefined);
});

test("purpose model-key opens the keys page and answers its address", async (t) => {
  installChrome(t);
  const h = depsFor("http://127.0.0.1:4711/some/path");
  const result = await handlePanelControl(open({ purpose: "model-key" }), sidepanel, h.deps);
  assert.deepEqual(h.opened, ["http://127.0.0.1:4711/programs/secret-keys"]);
  assert.deepEqual(result, { handled: true, response: { ok: true, url: "http://127.0.0.1:4711/programs/secret-keys" } });
});

test("a purpose is refused when unknown, mixed with an automation, or when the address is not a web address", async (t) => {
  installChrome(t);
  for (const extra of [{ purpose: "elsewhere" }, { purpose: "model-key", flowId: "flow-1" }, { purpose: "model-key", runId: "run-1" }]) {
    const h = depsFor("http://127.0.0.1:3000");
    const result = await handlePanelControl(open(extra), sidepanel, h.deps);
    assert.equal((result as { response: { code: string } }).response.code, "invalid_request");
    assert.deepEqual(h.opened, []);
  }
  const bad = depsFor("javascript:alert(1)");
  const refused = await handlePanelControl(open({ purpose: "model-key" }), sidepanel, bad.deps);
  assert.equal((refused as { response: { code: string } }).response.code, "invalid_request");
  assert.deepEqual(bad.opened, []);
});
