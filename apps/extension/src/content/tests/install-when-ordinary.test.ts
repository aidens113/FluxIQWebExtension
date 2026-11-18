// The startup rule (`../lifecycle/`): in FluxIQ's own document
// nothing is registered at all, an ordinary one gets every install, and a
// document the background has not yet confirmed is asked again until decided.
// The last test runs the content script's real installs against a window and a
// document that count every listener they are given.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { OwnDocumentVerdict } from "../own-document";

/**
 * The barrel also loads suspend-content, whose imports (the recorder, the
 * instance claim) touch `window` and build a MutationObserver as they load, so
 * it is loaded under a stub page, never as a static import: a static import
 * made this file's load throw outside any test, which node:test reports only as
 * "asynchronous activity after the test ended" with every test passing (t941).
 */
async function loadInstallWhenOrdinary() {
  const globals = globalThis as unknown as Record<string, unknown>;
  const names = ["window", "MutationObserver"] as const;
  const previous = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globals, name)]));
  globals["window"] = {};
  globals["MutationObserver"] = class { observe = () => undefined; disconnect = () => undefined; takeRecords = () => []; };
  try {
    return (await import("../lifecycle")).installWhenOrdinary;
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globals, name, descriptor);
      else delete globals[name];
    }
  }
}

/** Verdicts handed out in order, and the retries that were scheduled instead of waited for. */
function scripted(verdicts: OwnDocumentVerdict[]) {
  const retries: Array<() => void> = [];
  return {
    deps: {
      verdict: async () => verdicts.shift() ?? "ordinary",
      later: (again: () => void) => void retries.push(again),
      askAgainAfterMs: 1
    },
    retries
  };
}
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

test("an own document starts nothing", async () => {
  const installWhenOrdinary = await loadInstallWhenOrdinary();
  let started = 0;
  const { deps, retries } = scripted(["own"]);
  installWhenOrdinary([() => {
    started += 1;
    return () => undefined;
  }], deps);
  await settle();
  assert.equal(started, 0);
  assert.equal(retries.length, 0, "an own document is not asked again");
});

test("an unconfirmed document is asked again, and starts everything once it is ordinary", async () => {
  const installWhenOrdinary = await loadInstallWhenOrdinary();
  const started: string[] = [];
  const { deps, retries } = scripted(["unconfirmed", "ordinary"]);
  const install = (name: string) => () => {
    started.push(name);
    return () => undefined;
  };
  installWhenOrdinary([install("a"), install("b")], deps);
  await settle();
  assert.deepEqual(started, []);
  assert.equal(retries.length, 1);
  retries[0]!();
  await settle();
  assert.deepEqual(started, ["a", "b"]);
});

test("the content script's real installs register no listener in an own document and all of them in an ordinary one", async () => {
  const installWhenOrdinary = await loadInstallWhenOrdinary();
  const globals = globalThis as unknown as Record<string, unknown>;
  const names = ["window", "document", "location", "MutationObserver", "Element"] as const;
  const previous = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globals, name)]));
  const registered: string[] = [];
  const spy = (where: string) => (type: string) => void registered.push(`${where}:${type}`);
  const stubWindow: Record<string, unknown> = { addEventListener: spy("window"), removeEventListener: () => undefined, innerWidth: 800, innerHeight: 600 };
  stubWindow["top"] = stubWindow;
  globals["window"] = stubWindow;
  globals["location"] = { href: "https://shop.example/", origin: "https://shop.example" };
  globals["document"] = { addEventListener: spy("document"), removeEventListener: () => undefined, readyState: "complete", title: "", documentElement: {} };
  globals["Element"] = class {};
  globals["MutationObserver"] = class { constructor() { registered.push("observer:new"); } observe = () => undefined; disconnect = () => undefined; takeRecords = () => []; };
  try {
    const { installFrameGeometryBridge } = await import("../frame-geometry");
    const { installRecordingEventListeners } = await import("../dom-events");
    const { pageChangeCounter } = await import("../page-changes");
    const installs = [() => pageChangeCounter.install(), installFrameGeometryBridge, installRecordingEventListeners];
    const loaded = registered.length;
    const own = scripted(["own"]);
    installWhenOrdinary(installs, own.deps);
    await settle();
    assert.deepEqual(registered.slice(loaded), [], "an own document registered nothing");
    const ordinary = scripted(["ordinary"]);
    installWhenOrdinary(installs, ordinary.deps);
    await settle();
    const added = registered.slice(loaded);
    assert.ok(added.includes("observer:new"), "the page-change counter observes");
    assert.ok(added.includes("window:message"), "the frame-geometry bridge listens");
    assert.ok(added.includes("document:pointerdown"), "the recording listeners register");
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globals, name, descriptor);
      else delete globals[name];
    }
  }
});
