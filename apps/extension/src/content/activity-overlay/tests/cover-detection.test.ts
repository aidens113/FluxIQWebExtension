// The overlay never changes what an action or the page view sees, wherever it
// sits. It may sit over a control now -- on a busy page the readable pill
// takes the least-busy place rather than shrinking to a dot (placement/) --
// so this pins the three things that make that safe:
//
// - every node of the pill takes no pointer (status-pill.test.ts pins it node
//   by node), so the browser's hit test passes through it and a press lands on
//   the page;
// - should a hit test ever answer with the pill's host all the same, the
//   snapshot's cover check (`evidence/overlays.ts`, the page view's COVERING
//   line) and the interference defence (`action-runtime/interference/
//   overlays.ts`) both skip it, because it carries the extension's marker;
// - the same stub page does report a page layer at the same point, so the
//   silence is the marker's doing, not the stub's.
//
// The hit test is stubbed to answer with the real host a `StatusPill` built,
// the one case the browser itself never produces.

import assert from "node:assert/strict";
import test from "node:test";

import { overlaysOverPage } from "../../action-runtime/interference";
import { overlayEvidence } from "../../evidence";
import { StatusPill } from "../status-pill";
import { withFakeDom, type FakeNode } from "./fake-dom";

const VIEW = { width: 1280, height: 720 };

type Stub = Record<string, unknown>;

/** A style answer for any element: positioned as `position`, nothing clipped. */
function style(position: string): Stub {
  return { position, overflowX: "visible", overflowY: "visible", cursor: "auto", display: "block", visibility: "visible", opacity: "1" };
}

/** A bare page element: a tag, attributes, a box, and an owner document whose view answers `position`. */
function pageElement(tagName: string, rect: { left: number; top: number; width: number; height: number }, position: string, attributes: Record<string, string> = {}): Stub {
  const element: Stub = {
    tagName,
    nodeType: 1,
    parentElement: null,
    parentNode: null,
    shadowRoot: null,
    isConnected: true,
    textContent: "",
    childNodes: [],
    children: [],
    ownerDocument: { defaultView: { getComputedStyle: () => style(position) } },
    getAttribute: (name: string) => attributes[name] ?? null,
    hasAttribute: (name: string) => name in attributes,
    matches: () => false,
    closest: () => null,
    getRootNode: () => globalThis.document,
    getClientRects: () => [rect],
    getBoundingClientRect: () => ({ ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height, x: rect.left, y: rect.top }),
    querySelectorAll: () => []
  };
  return element;
}

/** The DOM classes the detectors ask `instanceof` of; nothing on the stub page is an instance of any. */
const DOM_CLASSES = ["Element", "HTMLElement", "HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement", "HTMLButtonElement", "HTMLLabelElement", "HTMLAnchorElement", "HTMLImageElement", "SVGElement"];

/** Runs `body` on a stub page whose every hit test answers `hit()`, counting the hit tests. */
function onStubPage(hit: () => unknown, body: (hits: () => number) => void): void {
  const globals = globalThis as unknown as Record<string, unknown>;
  const saved = { document: globals["document"], window: globals["window"], getComputedStyle: globals["getComputedStyle"], CSS: globals["CSS"] };
  const savedClasses = new Map(DOM_CLASSES.map((name) => [name, Object.getOwnPropertyDescriptor(globals, name)]));
  for (const name of DOM_CLASSES) if (!savedClasses.get(name)) globals[name] = class {};
  let hits = 0;
  const html = pageElement("HTML", { left: 0, top: 0, ...VIEW }, "static");
  const body_ = pageElement("BODY", { left: 0, top: 0, ...VIEW }, "static");
  globals["document"] = {
    documentElement: html,
    body: body_,
    scrollingElement: { scrollHeight: VIEW.height },
    querySelectorAll: () => [],
    elementFromPoint: () => {
      hits += 1;
      return hit();
    }
  };
  globals["window"] = { innerWidth: VIEW.width, innerHeight: VIEW.height, scrollY: 0 };
  globals["getComputedStyle"] = () => style("static");
  globals["CSS"] = { escape: (text: string) => text, supports: () => false };
  try {
    body(() => hits);
  } finally {
    globals["document"] = saved.document;
    globals["window"] = saved.window;
    globals["getComputedStyle"] = saved.getComputedStyle;
    globals["CSS"] = saved.CSS;
    for (const [name, descriptor] of savedClasses) if (!descriptor) delete globals[name];
  }
}

/** The host a real `StatusPill` puts in the page. */
function pillHost(): FakeNode {
  return withFakeDom(() => {
    const pill = new StatusPill();
    pill.update({ mode: "expanded", mark: "pulse", accent: "#f5b94a", headline: "Building your Flow", detail: "Clicking “Confirm”", step: "", fades: false });
    const host = pill.host() as unknown as FakeNode | undefined;
    assert.ok(host, "the pill is up");
    return host;
  });
}

test("the snapshot's cover check never reports a control as covered by the pill sitting over it", () => {
  const host = pillHost();
  const button = pageElement("BUTTON", { left: 16, top: 327, width: 120, height: 40 }, "static");
  onStubPage(() => host, (hits) => {
    assert.equal(overlayEvidence([button as unknown as Element]), undefined, "no COVERING line, no covered-by");
    assert.ok(hits() > 0, "the control was hit-tested, and the answer was the pill");
  });
});

test("the same check does report a page banner at that point, so the silence is the overlay marker's doing", () => {
  const banner = pageElement("DIV", { left: 0, top: 0, ...VIEW }, "fixed");
  const button = pageElement("BUTTON", { left: 16, top: 327, width: 120, height: 40 }, "static");
  onStubPage(() => banner, () => {
    const evidence = overlayEvidence([button as unknown as Element]);
    assert.equal(evidence?.blockedCount, 1, "the button is covered by the page's own banner");
  });
});

test("the interference defence never takes the pill for a layer to clear, at any probe point", () => {
  const host = pillHost();
  onStubPage(() => host, (hits) => {
    assert.deepEqual(overlaysOverPage({ x: 40, y: 340 }), []);
    assert.ok(hits() >= 11, `every probe point was hit-tested (${hits()})`);
  });
});
