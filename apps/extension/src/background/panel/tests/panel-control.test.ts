// Coverage of panel-control.ts: who may send the panel's six requests, and
// what saving settings and opening FluxIQ do. The load-bearing test is the
// first: a content script, another extension, or a sender with no page must be
// refused before a setting is read, a tab opened, or Core called, because four
// of these spend the pairing token and one decides where it is sent.

import assert from "node:assert/strict";
import test from "node:test";

import { RUNTIME_MESSAGES } from "../../../shared/constants";
import type { ExtensionStatus, FluxIQSettings, PanelRelayResponse } from "../../../shared/protocol";
import { handlePanelControl, type PanelControlDeps } from "../panel-control";

function installChrome() {
  const runtime = { id: "extension-id", getURL: (path: string) => `chrome-extension://extension-id/${path}` };
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: { runtime } });
}

const sidepanel = { id: "extension-id", url: "chrome-extension://extension-id/sidepanel/index.html" } as chrome.runtime.MessageSender;
const popup = { id: "extension-id", url: "chrome-extension://extension-id/popup/index.html" } as chrome.runtime.MessageSender;

const PANEL_TYPES = [
  RUNTIME_MESSAGES.panelSaveSettings,
  RUNTIME_MESSAGES.panelOpenFluxIQ,
  RUNTIME_MESSAGES.panelConversationRead,
  RUNTIME_MESSAGES.panelConversationSend,
  RUNTIME_MESSAGES.panelConversationAnswer,
  RUNTIME_MESSAGES.panelStopRun
];

const baseSettings: FluxIQSettings = {
  gatewayUrl: "ws://127.0.0.1:4777/client",
  coreApiUrl: "http://127.0.0.1:3000",
  autoReconnect: true,
  captureMutations: true,
  captureInputValues: true,
  captureSnapshots: true
};

function harness(settings: FluxIQSettings = baseSettings) {
  const touched: string[] = [];
  let stored = { ...settings };
  const applied: FluxIQSettings[] = [];
  const opened: string[] = [];
  const calls: Array<{ endpoint: string; payload: Record<string, unknown> }> = [];
  const deps: PanelControlDeps = {
    relay: {
      call: async (endpoint, payload) => {
        touched.push("call");
        calls.push({ endpoint, payload });
        return { ok: true, payload: { from: endpoint } } satisfies PanelRelayResponse;
      },
      projectId: () => {
        touched.push("projectId");
        return "project-1";
      }
    },
    readSettings: async () => {
      touched.push("readSettings");
      return { ...stored };
    },
    writeSettings: async (next) => {
      touched.push("writeSettings");
      stored = { ...next };
    },
    applySettings: (next) => {
      touched.push("applySettings");
      applied.push(next);
    },
    status: async () => {
      touched.push("status");
      return { connectionState: "disconnected", paired: true } as ExtensionStatus;
    },
    openTab: async (url) => {
      touched.push("openTab");
      opened.push(url);
    }
  };
  return { deps, touched, applied, opened, calls, stored: () => stored };
}

test("only the side panel and the popup may send any of the six; every other sender is refused before anything is touched", async () => {
  installChrome();
  const senders = [
    { id: "extension-id", url: "https://shop.test/", tab: { id: 4 } },
    { id: "extension-id" },
    { id: "other-extension", url: "chrome-extension://extension-id/sidepanel/index.html" },
    { id: "extension-id", url: "chrome-extension://extension-id/popup/index.html.evil" },
    { id: "extension-id", url: "chrome-extension://extension-id/options/index.html" }
  ] as chrome.runtime.MessageSender[];
  for (const type of PANEL_TYPES) {
    for (const sender of senders) {
      const h = harness();
      const result = await handlePanelControl({ type, settings: { coreApiUrl: "https://attacker.test" }, text: "hi", runId: "r" }, sender, h.deps);
      assert.deepEqual(result, { handled: true, response: { ok: false, code: "forbidden", error: "Only the FluxIQ panel can do that." } }, `${type} from ${sender.url}`);
      assert.deepEqual(h.touched, [], `${type} touched something for ${sender.url}`);
    }
  }
});

test("a message that is not one of the six is left for the next handler", async () => {
  installChrome();
  const h = harness();
  assert.deepEqual(await handlePanelControl({ type: RUNTIME_MESSAGES.getStatus }, sidepanel, h.deps), { handled: false });
  assert.deepEqual(await handlePanelControl({}, sidepanel, h.deps), { handled: false });
  assert.deepEqual(h.touched, []);
});

test("saving stores the known, well-typed fields, hands them to the connection, and never connects", async () => {
  installChrome();
  const h = harness();
  const result = await handlePanelControl({
    type: RUNTIME_MESSAGES.panelSaveSettings,
    settings: { coreApiUrl: "  http://127.0.0.1:4711  ", gatewayUrl: "", autoReconnect: false, captureSnapshots: "no", token: "injected" }
  }, popup, h.deps);

  const expected = { ...baseSettings, coreApiUrl: "http://127.0.0.1:4711", autoReconnect: false };
  assert.deepEqual(h.stored(), expected);
  assert.deepEqual(h.applied, [expected]);
  assert.deepEqual(result, { handled: true, response: { ok: true, status: { connectionState: "disconnected", paired: true } } });
  assert.ok(!h.touched.includes("call"));
  assert.ok(!("token" in h.stored()));
});

test("Open FluxIQ opens the web panel's address from settings", async () => {
  installChrome();
  const h = harness({ ...baseSettings, coreApiUrl: "http://127.0.0.1:4711" });
  const result = await handlePanelControl({ type: RUNTIME_MESSAGES.panelOpenFluxIQ }, sidepanel, h.deps);

  assert.deepEqual(h.opened, ["http://127.0.0.1:4711/"]);
  assert.deepEqual(result, { handled: true, response: { ok: true, url: "http://127.0.0.1:4711/" } });
});

test("Open FluxIQ never opens an address that is not http or https", async () => {
  installChrome();
  for (const coreApiUrl of ["javascript:alert(1)", "file:///etc/passwd", "not a url"]) {
    const h = harness({ ...baseSettings, coreApiUrl });
    const result = await handlePanelControl({ type: RUNTIME_MESSAGES.panelOpenFluxIQ }, sidepanel, h.deps);
    assert.deepEqual(h.opened, [], coreApiUrl);
    assert.deepEqual(result, { handled: true, response: { ok: false, code: "invalid_request", error: "The FluxIQ address in settings is not a web address." } });
  }
});

test("the conversation and Stop messages reach Core through the relay, and Core's payload comes back unchanged", async () => {
  installChrome();
  const h = harness();
  assert.deepEqual(await handlePanelControl({ type: RUNTIME_MESSAGES.panelConversationRead, kind: "list" }, sidepanel, h.deps), {
    handled: true, response: { ok: true, payload: { from: "list-conversations" } }
  });
  assert.deepEqual(await handlePanelControl({ type: RUNTIME_MESSAGES.panelConversationAnswer, askId: "ask-1", kind: "approve" }, sidepanel, h.deps), {
    handled: true, response: { ok: true, payload: { from: "answer-ask" } }
  });
  assert.deepEqual(await handlePanelControl({ type: RUNTIME_MESSAGES.panelStopRun, runId: "run-1" }, popup, h.deps), {
    handled: true, response: { ok: true, payload: { from: "cancel-runtime-session" } }
  });
  assert.deepEqual(h.calls.map((entry) => entry.endpoint), ["list-conversations", "answer-ask", "cancel-runtime-session"]);
});
