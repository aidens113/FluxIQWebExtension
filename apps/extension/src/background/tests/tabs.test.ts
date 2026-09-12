// T1 coverage of background/tabs.ts: making one frame of a tab ready to answer.
//
// This runs in Node against a stubbed `chrome`, because what has to be right is
// which frame the module pings and which frame it injects into -- both of them
// arguments to a browser API, and neither observable from inside a page. What
// this cannot prove is that Chrome really injects into the frame it is told to;
// `e2e/content/tests/frames.spec.ts` covers the cross-frame path against a real
// page of iframes, and a T3 run with the unpacked extension is what would
// exercise a genuine post-reload recovery.
//
// The states a frame can be in are the three the module distinguishes: ready
// (answers with the version this build requires), stale (answers with an older
// one, which is what an extension update leaves behind), and silent (no
// listener at all, which is what an extension reload leaves behind while the
// frame itself survives).

import assert from "node:assert/strict";
import { test } from "node:test";
import { ensureContentScript, unreachableFrameReason } from "../tabs";

/**
 * What a ping must answer before `tabs.ts` calls a frame ready. Written out
 * rather than imported: it is `REQUIRED_CONTENT_SCRIPT_VERSION` in `tabs.ts`
 * and `CONTENT_SCRIPT_VERSION` in `content/instance.ts`, and that module
 * assigns to `window` as it loads, so a Node test cannot import it.
 */
const CONTENT_SCRIPT_VERSION = 2;

/** Chrome's own words when a message reaches a frame with no listener. */
const CONNECTION_ERROR = "Could not establish connection. Receiving end does not exist.";

/** Chrome's own words when the manifest does not cover the frame's origin. */
const PERMISSION_ERROR = "Cannot access contents of the page.";

const TAB_ID = 41;

type FrameState = "ready" | "stale" | "silent";

/** What injecting into a frame does to it. Anything but the first is a frame that stays unusable. */
type InjectionResult = "makes-it-ready" | "makes-it-stale" | "leaves-it-silent" | "throws";

/** Every browser call the module made: the frame each ping addressed, and the frames of each injection. */
type ChromeCalls = { pinged: number[]; injected: number[][] };

function installChromeStub(frames: Record<number, FrameState>, injection: InjectionResult = "makes-it-ready"): ChromeCalls {
  const state: Record<number, FrameState> = { ...frames };
  const calls: ChromeCalls = { pinged: [], injected: [] };
  // `sendToTab` reads `chrome.runtime.lastError` inside the callback, the way
  // the real API reports a delivery that never happened.
  const runtime: { lastError?: { message: string } } = {};
  const stub = {
    runtime,
    tabs: {
      sendMessage: (_tabId: number, _message: unknown, third?: unknown, fourth?: unknown) => {
        const options = typeof third === "object" && third !== null ? third as { frameId?: number } : undefined;
        const callback = (typeof third === "function" ? third : fourth) as ((response: unknown) => void) | undefined;
        const frameId = options?.frameId ?? 0;
        calls.pinged.push(frameId);
        const found = state[frameId];
        if (found === undefined || found === "silent") {
          runtime.lastError = { message: CONNECTION_ERROR };
          callback?.(undefined);
          delete runtime.lastError;
          return;
        }
        callback?.({ ok: true, active: true, version: found === "ready" ? CONTENT_SCRIPT_VERSION : CONTENT_SCRIPT_VERSION - 1 });
      }
    },
    scripting: {
      executeScript: (details: { target: { tabId: number; frameIds: number[] }; files: string[] }) => {
        calls.injected.push([...details.target.frameIds]);
        if (injection === "throws") return Promise.reject(new Error(PERMISSION_ERROR));
        const next = injection === "makes-it-ready" ? "ready" : injection === "makes-it-stale" ? "stale" : "silent";
        for (const frameId of details.target.frameIds) state[frameId] = next;
        return Promise.resolve([]);
      }
    }
  };
  (globalThis as { chrome?: unknown }).chrome = stub;
  return calls;
}

function uninstallChromeStub(): void {
  delete (globalThis as { chrome?: unknown }).chrome;
}

test("a ready top frame is left alone: one ping, no injection", async () => {
  const calls = installChromeStub({ 0: "ready", 3: "ready" });
  try {
    await ensureContentScript(TAB_ID);
    assert.deepEqual(calls.pinged, [0]);
    assert.deepEqual(calls.injected, []);
  } finally {
    uninstallChromeStub();
  }
});

test("a top frame running a superseded script is reinjected, and into frame 0 alone", async () => {
  const calls = installChromeStub({ 0: "stale", 3: "silent" });
  try {
    await ensureContentScript(TAB_ID);
    // A single inaccessible child must not be able to fail the recovery of the
    // top frame, so the default injection names one frame and no others.
    assert.deepEqual(calls.injected, [[0]]);
    assert.deepEqual(calls.pinged, [0, 0]);
  } finally {
    uninstallChromeStub();
  }
});

test("a child frame that lost its script is injected into and then answers, without touching the top frame", async () => {
  const calls = installChromeStub({ 0: "ready", 3: "silent" });
  try {
    await ensureContentScript(TAB_ID, 3);
    // This is what an extension reload leaves behind: frame 3 still exists, so
    // no frame-existence check catches it, and nothing in it is listening.
    assert.deepEqual(calls.injected, [[3]]);
    assert.deepEqual(calls.pinged, [3, 3]);
  } finally {
    uninstallChromeStub();
  }
});

test("a child frame running a superseded script is reinjected, which no connection error would ever report", async () => {
  const calls = installChromeStub({ 0: "ready", 3: "stale" });
  try {
    await ensureContentScript(TAB_ID, 3);
    // An extension *update* leaves the old script alive and answering, so a
    // send to this frame succeeds and returns a result built by last build's
    // code. Only a version check sees it; recovering after a failed send
    // cannot, because there is no failed send.
    assert.deepEqual(calls.injected, [[3]]);
  } finally {
    uninstallChromeStub();
  }
});

test("the top frame's failure message is unchanged, so existing callers read what they always did", async () => {
  installChromeStub({ 0: "stale" }, "makes-it-stale");
  try {
    await assert.rejects(
      ensureContentScript(TAB_ID),
      { message: "FluxIQ content script did not become ready in the top frame." }
    );
  } finally {
    uninstallChromeStub();
  }
});

test("unreachableFrameReason says nothing once the frame answers", async () => {
  const calls = installChromeStub({ 0: "ready", 3: "silent" });
  try {
    assert.equal(await unreachableFrameReason(TAB_ID, 3), undefined);
    assert.deepEqual(calls.injected, [[3]]);
  } finally {
    uninstallChromeStub();
  }
});

test("a frame the extension may not inject into is named rather than thrown", async () => {
  installChromeStub({ 0: "ready", 3: "silent" }, "throws");
  try {
    // The caller turns this into a failure record, so it must arrive as a value
    // carrying the browser's own account of the refusal.
    assert.equal(await unreachableFrameReason(TAB_ID, 3), PERMISSION_ERROR);
  } finally {
    uninstallChromeStub();
  }
});

test("a frame that is injected and still silent is named by the browser's delivery error", async () => {
  installChromeStub({ 0: "ready", 3: "silent" }, "leaves-it-silent");
  try {
    assert.equal(await unreachableFrameReason(TAB_ID, 3), CONNECTION_ERROR);
  } finally {
    uninstallChromeStub();
  }
});

test("a frame that answers with the wrong version after injection is named as not ready", async () => {
  installChromeStub({ 0: "ready", 3: "silent" }, "makes-it-stale");
  try {
    assert.equal(
      await unreachableFrameReason(TAB_ID, 3),
      "FluxIQ content script did not become ready in frame 3."
    );
  } finally {
    uninstallChromeStub();
  }
});
