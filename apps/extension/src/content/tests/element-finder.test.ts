// What `xpathFor` writes, character for character, because the string is the
// whole contract: nothing here ever reads it back -- `findClosestFingerprint`
// hands it to `document.evaluate` on a later page load, in another process,
// against a document this one never sees.
//
// Two ways it used to be unreadable there, both silent. An id anchor was
// written `/*[@id="x"]`, and a leading single slash makes the step absolute:
// XPath reads it as "the root element, if its id is x", which is the `<html>`
// element and almost never the one recorded. So every xpath for an element
// carrying an id, or sitting under one, resolved to nothing and the fallback
// that exists to rescue a replay never fired -- no error, no miss, just a
// strategy that was never able to answer. The anchored form is `//*[@id="x"]`.
//
// And a value containing a quote was escaped `\"`, which XPath 1.0 has no
// concept of: its string literals cannot escape anything. `"say\"hi"` is not a
// badly quoted string, it is a syntax error, and `document.evaluate` throws on
// it rather than missing. A literal is therefore built by choosing a delimiter
// the value does not contain, and `concat()` when it contains both.
//
// The third subject is what happens to an xpath recorded *before* that fix. It
// is still stored, it still carries the escape, and `document.evaluate` throws
// on it rather than missing -- out of `findClosestFingerprint`, out of
// `resolveTarget`, failing the whole action while the id, test id, name and
// class-set lookups below it never run. So a stored xpath is checked before it
// is evaluated, and one that cannot be read is treated as a strategy with
// nothing to offer.
//
// The runner is Node, so there is no `document.evaluate` here to read these
// back with -- these rows pin the exact text, and
// `e2e/content/tests/selectors/tests/unique-selectors.spec.ts` resolves the same five shapes in
// Chromium against the element each was written for.

import assert from "node:assert/strict";
import test from "node:test";
import { findClosestFingerprint, stableFingerprintMatches, xpathFor } from "../element-finder";
import { agreesWithRecordedRecord, elementDrawing } from "../identity";
import { withSelectorMemo } from "../selector";
import { el, installStubDocument, stubDocument, type StubElement, type StubRoot } from "./stub-dom";
import { element, input } from "./stub-page";

/** The element `tagName` in `attributes`, wrapped in the given ancestors, outermost first. */
function nested(ancestors: readonly { tag: string; attributes?: Record<string, string> }[], leaf: Element): Element {
  let current = leaf;
  for (const ancestor of [...ancestors].reverse()) current = element(ancestor.tag, ancestor.attributes ?? {}, current);
  return leaf;
}

test("an id on the element itself anchors the xpath, and the anchor is a descendant step", () => {
  const button = element("button", { id: "save-settings" });
  nested([{ tag: "div" }, { tag: "form" }], button);
  // `//`, not `/`: the recorded element is anywhere in the document, not the
  // document element. The path stops at the anchor -- an id is unique, so the
  // steps above it would only add ways to stop matching.
  assert.equal(xpathFor(button), `//*[@id="save-settings"]`);
});

test("an id on an ancestor anchors it too, with the steps below the anchor kept", () => {
  const wanted = element("button", {});
  const form = element("form", {}, element("button", {}), wanted, input("text", ""));
  nested([{ tag: "main", attributes: { id: "panel" } }], form);
  // Indexed among same-tag siblings only, so the `<input>` does not shift it.
  assert.equal(xpathFor(wanted), `//*[@id="panel"]/form[1]/button[2]`);
});

test("no id anywhere: an absolute structural path, which is the one case a single slash is right for", () => {
  const span = element("span", {});
  const root = element("div", {}, element("span", {}), span);
  assert.equal(root.tagName, "DIV");
  assert.equal(xpathFor(span), "/div[1]/span[2]");
});

test("an id holding a double quote is delimited with single quotes, never escaped", () => {
  const button = element("button", { id: `say"hi` });
  // The old output was `/*[@id="say\"hi"]`, which is not a valid expression at
  // all: `document.evaluate` throws on it instead of returning no match.
  assert.equal(xpathFor(button), `//*[@id='say"hi']`);
  assert.ok(!xpathFor(button).includes("\\"), "an XPath 1.0 literal cannot carry a backslash escape");
});

test("an id holding a single quote is delimited with double quotes", () => {
  const button = element("button", { id: `it's` });
  assert.equal(xpathFor(button), `//*[@id="it's"]`);
});

test("an id holding both quote kinds is built with concat(), the only form XPath 1.0 leaves", () => {
  const button = element("button", { id: `it's a "quote"` });
  // Each fragment is delimited by the quote it does not contain: the double
  // quotes are contributed as single-quoted literals, everything else as
  // double-quoted ones. The trailing empty string is what a value ending in a
  // double quote produces, and is a valid literal.
  assert.equal(xpathFor(button), `//*[@id=concat("it's a ", '"', "quote", '"', "")]`);
  assert.ok(!xpathFor(button).includes("\\"), "an XPath 1.0 literal cannot carry a backslash escape");
});

/** The class the stub page's elements are, so `instanceof Element` decides the same way it would in a browser. */
const STUB_ELEMENT = Object.getPrototypeOf(element("div")).constructor;

/**
 * `body` with the globals `findClosestFingerprint` reads: a document that
 * answers by id, and an `evaluate` that records every expression handed to it
 * and answers with `byXpath`.
 *
 * It does not judge whether an expression is valid, deliberately -- deciding
 * that here would be the guard's own rule written twice, and a test that agrees
 * with itself. The browser's half of the argument is measured where a real
 * XPath engine exists: `e2e/content/tests/selectors/tests/unique-selectors.spec.ts`
 * evaluates
 * the old escaped form in Chromium and shows it throwing. What these rows
 * establish is the other half -- which expressions reach `evaluate` at all.
 */
function withDocument(page: { byId?: Record<string, Element>; byXpath?: Element }, body: (evaluated: string[]) => void): void {
  const globals = globalThis as unknown as Record<string, unknown>;
  const names = ["document", "Element", "XPathResult"];
  const previous = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globals, name)] as const));
  const evaluated: string[] = [];
  globals.Element = STUB_ELEMENT;
  globals.XPathResult = { FIRST_ORDERED_NODE_TYPE: 9 };
  globals.document = {
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: (id: string) => page.byId?.[id] ?? null,
    evaluate: (expression: string) => {
      evaluated.push(expression);
      return { singleNodeValue: page.byXpath ?? null };
    }
  };
  try {
    body(evaluated);
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globals, name, descriptor);
      else delete globals[name];
    }
  }
}

test("a stored xpath in the form the old writer emitted is never evaluated, and resolution falls through to the id", () => {
  const button = element("button", { id: `say"hi` });
  // Exactly what a recording made before the fix carries for that id.
  const stored = `/*[@id="say\\"hi"]`;
  withDocument({ byId: { [`say"hi`]: button } }, (evaluated) => {
    assert.equal(findClosestFingerprint({ xpath: stored, id: `say"hi` }), button);
    assert.deepEqual(evaluated, [], "the unreadable xpath never reached document.evaluate, so it could not throw out of the resolution");
  });
});

test("an unterminated literal is refused the same way, and the strategies below it still run", () => {
  const button = element("button", { id: "save-settings" });
  withDocument({ byId: { "save-settings": button } }, (evaluated) => {
    assert.equal(findClosestFingerprint({ xpath: `/*[@id="save`, id: "save-settings" }), button);
    assert.deepEqual(evaluated, []);
  });
});

test("a well-formed xpath is still evaluated, and still answers ahead of the id", () => {
  const byXpath = element("button", {});
  const byId = element("button", { id: "save-settings" });
  const wanted = `//*[@id="save-settings"]`;
  withDocument({ byId: { "save-settings": byId }, byXpath }, (evaluated) => {
    assert.equal(findClosestFingerprint({ xpath: wanted, id: "save-settings" }), byXpath);
    assert.deepEqual(evaluated, [wanted]);
  });
});

test("everything the writer now emits is still evaluated, including an id holding a backslash beside a quote", () => {
  const byXpath = element("button", {});
  // `//*[@id='a\"b']` is readable -- a backslash is an ordinary character in an
  // id, and the literal is delimited by the quote it does not contain. A guard
  // that merely looked for `\"` anywhere would refuse this one.
  const written = [`it's a "quote"`, `a\\"b`, `say"hi`, `plain`].map((id) => xpathFor(element("button", { id })));
  assert.deepEqual(written, [
    `//*[@id=concat("it's a ", '"', "quote", '"', "")]`,
    `//*[@id='a\\"b']`,
    `//*[@id='say"hi']`,
    `//*[@id="plain"]`
  ]);
  withDocument({ byXpath }, (evaluated) => {
    for (const xpath of written) assert.equal(findClosestFingerprint({ xpath }), byXpath);
    assert.deepEqual(evaluated, written, "every expression the writer produces is handed over rather than refused");
  });
});

test("inside a capture the xpath is the one written outside it, on a wide list and a nested one (t289)", () => {
  const links = Array.from({ length: 1_500 }, (_, index) => element(index % 3 ? "a" : "span", {}));
  const cells = Array.from({ length: 12 }, (_, index) => element(index % 2 ? "td" : "th", {}));
  const rows = [element("tr", {}, ...cells.slice(0, 6)), element("tr", {}, ...cells.slice(6))];
  const page = element("body", {}, element("nav", {}, ...links), element("table", {}, ...rows), element("nav", {}));
  assert.equal(page.tagName, "BODY");
  const every = [...links, ...cells, ...rows];
  const outside = every.map(xpathFor);
  const inside = withSelectorMemo(() => every.map(xpathFor));
  assert.deepEqual(inside, outside);
  assert.equal(xpathFor(links[4]!), "/body[1]/nav[1]/a[3]");
  assert.equal(xpathFor(links[3]!), "/body[1]/nav[1]/span[2]");
  assert.equal(xpathFor(cells[9]!), "/body[1]/table[1]/tr[2]/td[2]");
});

// Lane 4 (`run-mvcwqwec-0aa4f98b`): a results list whose every row holds a save icon and a share icon, each a
// wordless `<span>` of one hashed class around an unlabelled `<svg>`. A drawing names a set of controls as a class
// set does -- every row draws its save icon alike -- so the finder answers with every element that draws the
// recorded picture, `shared`, and the record gate the resolver applies next (`identity/record.ts`) leaves the one
// in the recorded row. Rows built with `stub-dom.ts`, whose selector engine answers the class-set query.

const SAVE_PATH = "M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z";
const SHARE_PATH = "M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7z";

function rowIcon(className: string, d: string): StubElement {
  return el("span", { class: className, style: "cursor:pointer" }, el("svg", { viewBox: "0 0 24 24" }, el("path", { d })));
}

/** Two rows keyed by the page, each with its title and its two icons; the icons' class is `className`. */
function resultsPage(className: string): { root: StubRoot; save: StubElement[] } {
  const save = [rowIcon(className, SAVE_PATH), rowIcon(className, SAVE_PATH)];
  const root = stubDocument();
  root.append(el("html", {}, el("body", {}, el("ul", {},
    el("li", { "data-job-id": "j-101" }, el("h3", {}, "Line Cook"), el("div", {}, save[0]!, rowIcon(className, SHARE_PATH))),
    el("li", { "data-job-id": "j-102" }, el("h3", {}, "Pastry Chef"), el("div", {}, save[1]!, rowIcon(className, SHARE_PATH)))))));
  return { root, save };
}

test("a recorded icon's drawing finds every icon that draws it, and the record gate leaves the one in its row", (t) => {
  const { root, save } = resultsPage("q8f2");
  installStubDocument(t, root);
  const drawing = elementDrawing(save[1] as unknown as Element);
  assert.ok(drawing);
  // The page renamed the class since the step was saved, and the positional selector now names the share icon's place in another layout.
  const recorded = { tagName: "span", classNames: ["old1"], selector: "ol > li > span", drawing };
  const found = stableFingerprintMatches(recorded, root as unknown as Document);
  assert.equal(found.shared, true);
  assert.deepEqual(found.matches, save, "the two save icons, and neither share icon");
  const inRow = found.matches.filter((match) => agreesWithRecordedRecord({ keyAttribute: "data-job-id", key: "j-102" }, match));
  assert.deepEqual(inRow, [save[1]]);
});

test("beside a class set every icon shares, the icons that draw the recorded picture come first and none is dropped", (t) => {
  const { root, save } = resultsPage("q8f2");
  installStubDocument(t, root);
  const drawing = elementDrawing(save[0] as unknown as Element);
  assert.ok(drawing);
  const found = stableFingerprintMatches({ tagName: "span", classNames: ["q8f2"], drawing }, root as unknown as Document);
  assert.equal(found.shared, true);
  assert.equal(found.matches.length, 4);
  assert.deepEqual(found.matches.slice(0, 2), save);
  // Without a drawing the class set answers as it always has.
  assert.equal(stableFingerprintMatches({ tagName: "span", classNames: ["q8f2"] }, root as unknown as Document).matches.length, 4);
  // And a drawing nothing on the page draws finds nothing by itself.
  assert.deepEqual(stableFingerprintMatches({ tagName: "span", classNames: ["old1"], drawing: "d1.0" }, root as unknown as Document), { matches: [], shared: false });
});
