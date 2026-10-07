// What the placement probe reads under one point, on a stubbed page: a modal's
// see-through scrim over a cookie banner (D11 of the t342 round 2 UI review,
// run-muylu4pp-f9cb2121, moment 2: every corner read clear under the scrim and
// the pill sat on the banner's text).

import assert from "node:assert/strict";
import test from "node:test";

import { pageProbe } from "../page-probe";

type Rect = { left: number; top: number; width: number; height: number };
type Stub = {
  tagName: string;
  position: string;
  rect: Rect;
  parentElement: Stub | null;
  parentNode: Stub | null;
  childNodes: Array<{ nodeType: number; textContent: string }>;
  shadowRoot: null;
  matches(selector: string): boolean;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  getBoundingClientRect(): Rect;
  getRootNode(): object;
  closest(selector: string): null;
  contains(other: Stub): boolean;
};

const VIEW = { width: 1280, height: 720 };

function element(tagName: string, rect: Rect, options: { position?: string; parent?: Stub | null; text?: string } = {}): Stub {
  const parent = options.parent ?? null;
  const stub: Stub = {
    tagName: tagName.toUpperCase(),
    position: options.position ?? "static",
    rect,
    parentElement: parent,
    parentNode: parent,
    childNodes: options.text === undefined ? [] : [{ nodeType: 3, textContent: options.text }],
    shadowRoot: null,
    matches: (selector) => selector.split(",").some((part) => part.trim() === tagName),
    getAttribute: () => null,
    hasAttribute: () => false,
    getBoundingClientRect: () => rect,
    getRootNode: () => ({}),
    closest: () => null,
    contains(other) {
      for (let current: Stub | null = other; current; current = current.parentElement) if (current === stub) return true;
      return false;
    }
  };
  return stub;
}

/** Runs `body` with a stubbed document whose hit stack at each point is `stackAt`. */
function withPage(stackAt: (x: number, y: number) => Stub[], body: () => void, options: { noStack?: boolean } = {}): void {
  const globals = globalThis as Record<string, unknown>;
  const saved = { document: globals["document"], getComputedStyle: globals["getComputedStyle"] };
  const root = element("html", { left: 0, top: 0, ...VIEW });
  const page = element("body", { left: 0, top: 0, ...VIEW }, { parent: root });
  globals["document"] = {
    documentElement: { ...root, clientWidth: VIEW.width, clientHeight: VIEW.height },
    body: page,
    elementFromPoint: (x: number, y: number) => stackAt(x, y)[0] ?? page,
    ...(options.noStack ? {} : { elementsFromPoint: (x: number, y: number) => [...stackAt(x, y), page] })
  };
  globals["getComputedStyle"] = (stub: Stub) => ({ position: stub.position });
  try {
    body();
  } finally {
    globals["document"] = saved.document;
    globals["getComputedStyle"] = saved.getComputedStyle;
  }
}

const scrim = element("div", { left: 0, top: 0, ...VIEW }, { position: "fixed" });
const banner = element("section", { left: 0, top: 570, width: 1280, height: 150 }, { position: "fixed" });
const bannerText = element("p", { left: 24, top: 620, width: 700, height: 40 }, { parent: banner, text: "We value your privacy" });
const pageText = element("p", { left: 40, top: 300, width: 400, height: 40 }, { text: "Home & Garden" });

test("under a see-through scrim, a fixed cookie banner still counts as fixed (D11)", () => {
  withPage((x, y) => (y >= 570 ? [scrim, bannerText, banner] : [scrim, pageText]), () => {
    const probe = pageProbe();
    assert.equal(probe(100, 640), "fixed", "the banner's text under the scrim");
    assert.equal(probe(100, 310), "content", "the page's own text under the scrim");
  });
});

test("a scrim with nothing beneath reads as nothing, and a browser with no hit stack keeps the old reading", () => {
  withPage(() => [scrim], () => assert.equal(pageProbe()(100, 100), null));
  withPage(() => [scrim, bannerText, banner], () => assert.equal(pageProbe()(100, 640), null), { noStack: true });
});

test("a fixed box that is no backdrop is fixed, whatever is beneath", () => {
  withPage(() => [bannerText, banner], () => assert.equal(pageProbe()(100, 640), "fixed"));
});
