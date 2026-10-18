// Whether the page's styles set a cursor on the element itself, on hand-built
// stylesheets and elements: an element matches a selector when the selector
// names one of its classes (`.name`), possibly after an ancestor's class. That
// Chromium's own CSSOM gives the same answers is the content harness's
// (`e2e/content/tests/evidence/tests/icon-controls.spec.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import { declaresCursor } from "../declared-cursor";
import { ownPressCursor } from "../press-cursor";

type Rule = { selectorText?: string; style?: { cursor?: string }; cssRules?: Rule[]; media?: { mediaText: string }; styleSheet?: { cssRules: Rule[] } };
type Root = { styleSheets: Array<{ cssRules: Rule[] }> };
type Fake = {
  cursor: string;
  classes: string[];
  parentElement: Fake | null;
  assignedSlot: null;
  style: { cursor: string };
  getRootNode(): Root;
  matches(selectors: string): boolean;
};

function page(rules: Rule[]): Root {
  return { styleSheets: [{ cssRules: rules }] };
}

/** An element whose `matches` reads each selector's last class, and any class before it as an ancestor's. */
function fake(root: Root, cursor: string, classes: string[], parent: Fake | null = null, inline = ""): Fake {
  const element: Fake = {
    cursor,
    classes,
    parentElement: parent,
    assignedSlot: null,
    style: { cursor: inline },
    getRootNode: () => root,
    matches: (selectors) => selectors.split(",").some((selector) => matchesOne(element, selector.trim()))
  };
  return element;
}

function matchesOne(element: Fake, selector: string): boolean {
  const parts = selector.split(/\s+/u).map((part) => part.replace(/^:is\((.*)\)$/u, "$1"));
  const subject = parts.at(-1)!;
  if (!subject.startsWith(".") || !element.classes.includes(subject.slice(1))) return false;
  let ancestor = element.parentElement;
  for (const part of parts.slice(0, -1).reverse()) {
    while (ancestor !== null && !ancestor.classes.includes(part.slice(1))) ancestor = ancestor.parentElement;
    if (ancestor === null) return false;
    ancestor = ancestor.parentElement;
  }
  return true;
}

function withCursors<T>(body: () => T): T {
  const globals = globalThis as unknown as Record<string, unknown>;
  const previous = Object.getOwnPropertyDescriptor(globals, "getComputedStyle");
  globals.getComputedStyle = (element: Fake) => ({ cursor: element.cursor });
  try {
    return body();
  } finally {
    if (previous) Object.defineProperty(globals, "getComputedStyle", previous);
    else delete globals.getComputedStyle;
  }
}

const own = (element: Fake) => withCursors(() => ownPressCursor(element as unknown as Element));
const declares = (element: Fake, cursor: "pointer" | "not-allowed" = "pointer") => declaresCursor(element as unknown as Element, cursor);

test("an icon styled with a pointer inside a card with a pointer sets its own; the card's other insides do not", () => {
  const root = page([
    { selectorText: ".card", style: { cursor: "pointer" } },
    { selectorText: ".fav", style: { cursor: "pointer" } },
    { selectorText: ".fav svg", style: { cursor: "" } }
  ]);
  const body = fake(root, "auto", []);
  const card = fake(root, "pointer", ["card"], body);
  const head = fake(root, "pointer", ["head"], card);
  const icon = fake(root, "pointer", ["fav"], head);
  const glyph = fake(root, "pointer", ["glyph"], icon);
  const company = fake(root, "pointer", ["company"], card);
  assert.equal(own(card), "pointer");
  assert.equal(own(icon), "pointer");
  assert.equal(own(head), undefined);
  assert.equal(own(glyph), undefined);
  assert.equal(own(company), undefined);
});

test("an inline cursor is the element's own, and a fallback list ends in the cursor it sets", () => {
  const root = page([{ selectorText: ".chip", style: { cursor: "url(hand.cur), pointer" } }]);
  const card = fake(root, "pointer", ["card"]);
  assert.equal(declares(fake(root, "pointer", [], card, "pointer")), true);
  assert.equal(declares(fake(root, "pointer", ["chip"], card)), true);
  assert.equal(declares(fake(root, "pointer", ["chip"], card), "not-allowed"), false);
});

test("a rule for every descendant says nothing of one; a nested rule is read under its parent", () => {
  const root = page([
    { selectorText: ".card *", style: { cursor: "pointer" } },
    { selectorText: ".list", style: { cursor: "" }, cssRules: [{ selectorText: ".close", style: { cursor: "pointer" } }] }
  ]);
  const list = fake(root, "pointer", ["list", "card"]);
  assert.equal(declares(fake(root, "pointer", ["any"], list)), false);
  assert.equal(declares(fake(root, "pointer", ["close"], list)), true);
  assert.equal(declares(fake(root, "pointer", ["close"])), false);
});

test("an unreadable stylesheet is passed over, and an imported one is read", () => {
  const root = {
    styleSheets: [
      { get cssRules(): Rule[] { throw new Error("SecurityError"); } },
      { cssRules: [{ styleSheet: { cssRules: [{ selectorText: ".star", style: { cursor: "pointer" } }] } }] }
    ]
  } as unknown as Root;
  assert.equal(declares(fake(root, "pointer", ["star"], fake(root, "pointer", ["card"]))), true);
});

test("a refusing cursor declared on an option inside a pressable picker is its own", () => {
  const root = page([{ selectorText: ".sold", style: { cursor: "not-allowed" } }]);
  const picker = fake(root, "not-allowed", ["picker"], fake(root, "auto", []));
  assert.equal(own(fake(root, "not-allowed", ["sold"], picker)), "not-allowed");
  assert.equal(own(fake(root, "not-allowed", ["plain"], picker)), undefined);
});
