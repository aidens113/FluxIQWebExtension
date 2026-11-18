// What a revocation does (`../revoked/`): the one `fluxiq.revoked` message, routed
// where the ping is, discards what the script holds without sending any of it,
// ends a wait with a page-free error, turns a reply still being built into the
// `interrupted` refusal and refuses everything after it before it starts.
//
// The modules expect a page, so the globals they touch are stubbed before they
// are loaded, as the own-page routing test does. The document's state is module
// state and a revocation is permanent, so this is one ordered scenario: what
// must hold before the revocation first, then the revocation.

import assert from "node:assert/strict";
import { test } from "node:test";
import { CONTENT_REVOKED_MESSAGE } from "../../shared/own-pages";

const STUBBED = ["window", "document", "location", "MutationObserver", "chrome"] as const;

test("a revoked document discards unsent, interrupts what is in flight and refuses what follows", async () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  const previous = new Map(STUBBED.map((name) => [name, Object.getOwnPropertyDescriptor(globals, name)]));
  const noop = () => undefined;
  const sent: unknown[] = [];
  const stubWindow: Record<string, unknown> = { addEventListener: noop, removeEventListener: noop, innerWidth: 800, innerHeight: 600, scrollX: 0, scrollY: 0 };
  stubWindow["top"] = stubWindow;
  globals["window"] = stubWindow;
  globals["location"] = { href: "https://shop.example/catalog", origin: "https://shop.example" };
  globals["document"] = { addEventListener: noop, removeEventListener: noop, readyState: "complete", title: "Catalog", documentElement: {}, querySelectorAll: () => [] };
  globals["MutationObserver"] = class { observe = noop; disconnect = noop; takeRecords = () => []; };
  const sendMessage = (message: unknown) => {
    sent.push(message);
    return Promise.resolve();
  };
  globals["chrome"] = { runtime: { sendMessage, onMessage: { addListener: noop } } };
  try {
    const { routeMessage } = await import("../message-handler");
    const { guardedCommandListener, createOwnDocumentCheck } = await import("../own-document");
    const { emit, flushPendingInput, scheduleInputEvent, setRecordingState } = await import("../recorder");
    const { captureSettings } = await import("../capture-settings");
    const { waitUntil } = await import("../action-runtime");
    const { ContentRevokedError, contentInstalls, revokedFence } = await import("../revoked");
    const { isOwnPageRefusalReply } = await import("../../shared/own-pages");
    const ordinary = guardedCommandListener(routeMessage, createOwnDocumentCheck({ origins: () => ["https://shop.example"], ask: async () => ({ ok: true, addresses: ["http://127.0.0.1:3000"] }) }));
    const deliver = (message: unknown) => new Promise<unknown>((resolve) => void ordinary(message, {}, resolve));

    // Before: recording sends, and a ping says the script is active.
    captureSettings.inputValues = false;
    setRecordingState(true);
    emit("dom.scroll", { scroll: { x: 0, y: 0 } });
    assert.equal(sent.length, 1, "recording sends while the document is not revoked");
    assert.equal((await deliver({ type: "fluxiq.ping" }) as { active: boolean }).active, true);

    // In flight: a wait that never holds, a reply still being built, a typed value pending, an install to take down.
    const wait = waitUntil(() => undefined, 60_000);
    let finish: (response: unknown) => void = noop;
    const slow = revokedFence({ answer: (sendResponse) => { finish = sendResponse; } });
    const slowReply = new Promise<unknown>((resolve) => slow.answer(resolve));
    scheduleInputEvent({} as Element);
    let disposed = 0;
    contentInstalls.own(() => { disposed += 1; });
    const sentBefore = sent.length;

    // The revocation, in a document that is FluxIQ's own and answered with no verdict wait.
    const own = guardedCommandListener(routeMessage, createOwnDocumentCheck({ origins: () => ["http://127.0.0.1:3000"], ask: async () => ({ ok: true, addresses: ["http://127.0.0.1:3000"] }) }));
    const acknowledged = await new Promise<unknown>((resolve) => assert.equal(own({ type: CONTENT_REVOKED_MESSAGE }, {}, resolve), false));
    assert.deepEqual(acknowledged, { ok: true });

    await assert.rejects(wait, ContentRevokedError);
    finish({ ok: true, page: "read after the revocation" });
    assert.deepEqual(await slowReply, { ok: false, errorCode: "content.revoked", phase: "interrupted" });
    assert.equal(disposed, 1, "every install was taken down");
    flushPendingInput();
    emit("dom.scroll", { scroll: { x: 1, y: 1 } });
    assert.equal(sent.length, sentBefore, "nothing pending was flushed and nothing is recorded after");

    // After: commands are refused before they start, not as an own-page refusal; the ping still answers, no longer active.
    const refused = await deliver({ type: "executeAction", action: { commandId: "c-1", actionType: "web.dom.click", selector: "#buy" }, frameId: 0 });
    assert.deepEqual(refused, { ok: false, errorCode: "content.revoked", phase: "before-dispatch" });
    assert.equal(isOwnPageRefusalReply(refused), false);
    await assert.rejects(waitUntil(() => true, 10), ContentRevokedError);
    const ping = await deliver({ type: "fluxiq.ping" }) as { ok: boolean; active: boolean };
    assert.deepEqual([ping.ok, ping.active], [true, false]);
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globals, name, descriptor);
      else delete globals[name];
    }
  }
});
