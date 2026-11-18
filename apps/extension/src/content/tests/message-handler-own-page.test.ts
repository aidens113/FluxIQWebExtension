// The content script's real command routing (`../message-handler.ts`) behind
// its own-page guard (`../own-document/`): routing a command reads nothing of
// the page, so in FluxIQ's own document every command is refused before any
// DOM read, while an ordinary document runs the same command.
//
// The handler's modules expect a page, so `window`, `document` and `location`
// are stubbed before it is loaded; `document` records every member read, which
// is how "before any DOM read" is measured.

import assert from "node:assert/strict";
import { test } from "node:test";
import { isOwnPageRefusalReply } from "../../shared/own-pages";
import { createOwnDocumentCheck, guardedCommandListener } from "../own-document";

const STUBBED = ["window", "document", "location", "MutationObserver"] as const;

test("every command the background sends is refused in FluxIQ's own document before the page is read", async () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  const previous = new Map(STUBBED.map((name) => [name, Object.getOwnPropertyDescriptor(globals, name)]));
  const reads: string[] = [];
  const noop = () => undefined;
  const stubWindow: Record<string, unknown> = { addEventListener: noop, removeEventListener: noop, innerWidth: 800, innerHeight: 600 };
  stubWindow["top"] = stubWindow;
  globals["window"] = stubWindow;
  globals["location"] = { href: "http://127.0.0.1:3000/security/keys", origin: "http://127.0.0.1:3000" };
  globals["MutationObserver"] = class { observe = noop; disconnect = noop; };
  let counting = false;
  globals["document"] = new Proxy({ addEventListener: noop, removeEventListener: noop, readyState: "complete", title: "Keys" }, {
    get(target, property) {
      if (counting) reads.push(String(property));
      return (target as Record<PropertyKey, unknown>)[property];
    }
  });
  try {
    const { routeMessage } = await import("../message-handler");
    const own = guardedCommandListener(routeMessage, createOwnDocumentCheck({ origins: () => ["http://127.0.0.1:3000"], ask: async () => ({ ok: true, addresses: ["http://127.0.0.1:3000"] }) }));
    counting = true;
    for (const message of [
      { type: "executeAction", action: { commandId: "c-1", actionType: "web.dom.click", selector: "#delete-key" }, frameId: 0 },
      { type: "captureSnapshot" },
      { type: "fluxiq.evaluateFacts", frameId: 0, request: { queries: [{ kind: "dialog", expected: true }], documentTimeOrigin: 0 } },
      { type: "fluxiq.pageChallenge" },
      { type: "fluxiq.tracePageCapture", frameId: 0 },
      { type: "recording", recording: true },
      { type: "fluxiq.pageChanges" }
    ]) {
      const reply = await new Promise<unknown>((resolve) => {
        assert.equal(own(message, {}, resolve), true, message.type);
      });
      assert.ok(isOwnPageRefusalReply(reply), `${message.type}: ${JSON.stringify(reply)}`);
    }
    assert.deepEqual(reads, [], "nothing of the document was read");

    // The same routing in an ordinary document answers: here, its page-change mark.
    const ordinary = guardedCommandListener(routeMessage, createOwnDocumentCheck({ origins: () => ["https://shop.example"], ask: async () => ({ ok: true, addresses: ["http://127.0.0.1:3000"] }) }));
    const mark = await new Promise<unknown>((resolve) => void ordinary({ type: "fluxiq.pageChanges" }, {}, resolve));
    assert.equal(isOwnPageRefusalReply(mark), false, JSON.stringify(mark));
  } finally {
    counting = false;
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globals, name, descriptor);
      else delete globals[name];
    }
  }
});
