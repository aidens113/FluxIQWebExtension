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
    relay: { call: async () => { assert.fail("Opening configuration must not call Core"); } },
    readSettings: async () => ({ coreApiUrl }) as FluxIQSettings,
    openTab: async (url: string) => {
      opened.push(url);
    }
  } as unknown as PanelControlDeps;
  return { deps, opened };
}

const open = (extra: Record<string, unknown>) => ({ type: RUNTIME_MESSAGES.panelOpenFluxIQ, ...extra });

test("the AI keys page sits at the root of the configured address", () => {
  assert.equal(fluxIQKeysAddress("https://flux.example/app/?a=1#b"), "https://flux.example/settings#ai-keys");
  assert.equal(fluxIQKeysAddress(undefined), "http://127.0.0.1:3000/settings#ai-keys");
  assert.equal(fluxIQKeysAddress("ftp://flux.example"), undefined);
  assert.equal(fluxIQKeysAddress("not an address"), undefined);
});

test("purpose model-key opens the keys page and answers its address", async (t) => {
  installChrome(t);
  const h = depsFor("http://127.0.0.1:4711/some/path");
  const result = await handlePanelControl(open({ purpose: "model-key" }), sidepanel, h.deps);
  assert.deepEqual(h.opened, ["http://127.0.0.1:4711/settings#ai-keys"]);
  assert.deepEqual(result, { handled: true, response: { ok: true, url: "http://127.0.0.1:4711/settings#ai-keys" } });
});

test("purpose model-key opens AI keys with only its own fragment, dropping the old query and fragment", async (t) => {
  installChrome(t);
  const h = depsFor("http://127.0.0.1:4711/app?old=1#unlock=obsolete");
  await handlePanelControl(open({ purpose: "model-key" }), sidepanel, h.deps);
  const url = new URL(h.opened[0]!);
  assert.equal(url.pathname, "/settings");
  assert.equal(url.search, "");
  assert.equal(url.hash, "#ai-keys");
});

test("purpose projects opens the projects page and answers its address", async (t) => {
  installChrome(t);
  const h = depsFor("http://127.0.0.1:4711/some/path?old=1");
  const result = await handlePanelControl(open({ purpose: "projects" }), sidepanel, h.deps);
  assert.deepEqual(h.opened, ["http://127.0.0.1:4711/projects"]);
  assert.deepEqual(result, { handled: true, response: { ok: true, url: "http://127.0.0.1:4711/projects" } });
});

test("a purpose is refused when unknown, mixed with an automation, or when the address is not a web address", async (t) => {
  installChrome(t);
  for (const extra of [{ purpose: "elsewhere" }, { purpose: "model-key", flowId: "flow-1" }, { purpose: "model-key", runId: "run-1" }, { purpose: "projects", flowId: "flow-1" }]) {
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

test("each deep link is a page Core's web panel serves, with no query of the configured address", async () => {
  const { fluxIQWebPageAddress } = await import("../../../shared/fluxiq-web-routes");
  const base = "https://flux.example/app/?a=1#b";
  assert.equal(fluxIQWebPageAddress(base, { kind: "home" }), base);
  assert.equal(fluxIQWebPageAddress(base, { kind: "flow", projectId: "p 1", flowId: "f/1" }), "https://flux.example/flows/f%2F1?project=p+1");
  assert.equal(fluxIQWebPageAddress(base, { kind: "projects" }), "https://flux.example/projects");
  assert.equal(fluxIQWebPageAddress(base, { kind: "chat", projectId: "p 1", conversationId: "c/1" }), "https://flux.example/chats/c%2F1?project=p+1");
  assert.equal(fluxIQWebPageAddress(base, { kind: "run", runId: "run-1" }), "https://flux.example/runs/run-1");
  assert.equal(fluxIQWebPageAddress(base, { kind: "data" }), "https://flux.example/data");
  assert.equal(fluxIQWebPageAddress("ftp://flux.example", { kind: "data" }), undefined);
});
