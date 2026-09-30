// Coverage of panel-control.ts: who may send the panel's requests (the six
// that reach Core and the two activity ones), what saving settings and opening
// FluxIQ do, and which overlay preferences are accepted. The load-bearing test is the
// first: a content script, another extension, or a sender with no page must be
// refused before a setting is read, a tab opened, or Core called, because four
// of these spend the pairing token and one decides where it is sent.

import assert from "node:assert/strict";
import test from "node:test";

import { ACTIVITY_MESSAGES, type ActivityOverlayPreference, type ExtensionActivityState } from "../../../shared/activity/index";
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
  RUNTIME_MESSAGES.panelStopRun,
  ACTIVITY_MESSAGES.read,
  ACTIVITY_MESSAGES.setOverlay
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
  const overlays: ActivityOverlayPreference[] = [];
  const activityState = (overlay: ActivityOverlayPreference): ExtensionActivityState => ({ current: null, recent: [], overlay, live: true });
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
    },
    activity: {
      read: async () => {
        touched.push("activity.read");
        return activityState("expanded");
      },
      setOverlay: async (overlay) => {
        touched.push("activity.setOverlay");
        overlays.push(overlay);
        return activityState(overlay);
      }
    }
  };
  return { deps, touched, applied, opened, calls, overlays, stored: () => stored };
}

test("only the side panel and the popup may send any of the panel requests; every other sender is refused before anything is touched", async () => {
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
      const result = await handlePanelControl({ type, overlay: "hidden", settings: { coreApiUrl: "https://attacker.test" }, text: "hi", runId: "r" }, sender, h.deps);
      assert.deepEqual(result, { handled: true, response: { ok: false, code: "forbidden", error: "Only the FluxIQ panel can do that." } }, `${type} from ${sender.url}`);
      assert.deepEqual(h.touched, [], `${type} touched something for ${sender.url}`);
    }
  }
});

test("a message that is not one of the panel requests is left for the next handler", async () => {
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

test("the panel reads the live activity state and sets the overlay preference", async () => {
  installChrome();
  const h = harness();
  assert.deepEqual(await handlePanelControl({ type: ACTIVITY_MESSAGES.read }, sidepanel, h.deps), {
    handled: true, response: { ok: true, state: { current: null, recent: [], overlay: "expanded", live: true } }
  });
  assert.deepEqual(await handlePanelControl({ type: ACTIVITY_MESSAGES.setOverlay, overlay: "collapsed" }, popup, h.deps), {
    handled: true, response: { ok: true, state: { current: null, recent: [], overlay: "collapsed", live: true } }
  });
  assert.deepEqual(h.overlays, ["collapsed"]);
  assert.ok(!h.touched.includes("call"), "activity never reaches Core over HTTP");
});

test("an overlay preference that is not one of the three is refused without being stored", async () => {
  installChrome();
  for (const overlay of [undefined, "", "shown", 1, { overlay: "hidden" }]) {
    const h = harness();
    const result = await handlePanelControl({ type: ACTIVITY_MESSAGES.setOverlay, overlay }, sidepanel, h.deps);
    assert.deepEqual(result, { handled: true, response: { ok: false, code: "invalid_request", error: "The overlay must be expanded, collapsed or hidden." } }, String(overlay));
    assert.deepEqual(h.overlays, []);
  }
});
