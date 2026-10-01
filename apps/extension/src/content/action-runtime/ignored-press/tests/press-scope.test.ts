// T1 coverage of where a press's answer is looked for (`press-scope.ts`): the
// nearest section-like ancestor within four levels, never the body, followed
// out of a shadow root through its host. Elements are faked at what the scope
// reads: `tagName`, `role`, `parentElement`, and `parentNode` for a shadow root.

import assert from "node:assert/strict";
import test from "node:test";
import { pressScope } from "../press-scope";

type FakeElement = {
  name: string;
  tagName: string;
  parentElement: FakeElement | null;
  parentNode: unknown;
  getAttribute(name: string): string | null;
};

/** A chain of elements, outermost first, each the parent of the next; returns them by name. */
function chain(...specs: Array<{ name: string; tag: string; role?: string }>): Record<string, FakeElement> {
  const byName: Record<string, FakeElement> = {};
  let parent: FakeElement | null = null;
  for (const spec of specs) {
    const element: FakeElement = {
      name: spec.name,
      tagName: spec.tag.toUpperCase(),
      parentElement: parent,
      parentNode: parent,
      getAttribute: (attribute) => (attribute === "role" ? (spec.role ?? null) : null)
    };
    byName[spec.name] = element;
    parent = element;
  }
  return byName;
}

const nameOf = (element: Element): string => (element as unknown as FakeElement).name;

test("a control inside a form is scoped to the form", () => {
  const page = chain({ name: "body", tag: "body" }, { name: "form", tag: "form" }, { name: "row", tag: "div" }, { name: "button", tag: "button" });
  assert.equal(nameOf(pressScope(page.button as unknown as Element)), "form");
});

test("a dialog by role bounds the scope as a dialog element does", () => {
  const page = chain({ name: "body", tag: "body" }, { name: "panel", tag: "div", role: "dialog" }, { name: "button", tag: "button" });
  assert.equal(nameOf(pressScope(page.button as unknown as Element)), "panel");
});

test("a section further up than four levels is not reached: the scope stops four ancestors up", () => {
  const page = chain(
    { name: "main", tag: "main" },
    { name: "a", tag: "div" },
    { name: "b", tag: "div" },
    { name: "c", tag: "div" },
    { name: "d", tag: "div" },
    { name: "button", tag: "button" }
  );
  assert.equal(nameOf(pressScope(page.button as unknown as Element)), "a");
});

test("the scope never widens to the body: bigbox's sticky add-to-cart bar is its own scope", () => {
  const page = chain({ name: "html", tag: "html" }, { name: "body", tag: "body" }, { name: "bar", tag: "div" }, { name: "button", tag: "button" });
  assert.equal(nameOf(pressScope(page.button as unknown as Element)), "bar");
});

test("a control directly in the body is scoped to itself", () => {
  const page = chain({ name: "body", tag: "body" }, { name: "button", tag: "button" });
  assert.equal(nameOf(pressScope(page.button as unknown as Element)), "button");
});

test("a control at the top of a shadow root is followed out through its host", () => {
  const page = chain({ name: "body", tag: "body" }, { name: "article", tag: "article" }, { name: "host", tag: "product-tile" });
  const inner = chain({ name: "button", tag: "button" }).button as FakeElement;
  inner.parentNode = { nodeType: 11, host: page.host };
  assert.equal(nameOf(pressScope(inner as unknown as Element)), "article");
});

test("the main landmark is the page, not a section: bigbox's Add to cart is scoped to its own bar", () => {
  const page = chain(
    { name: "body", tag: "body" },
    { name: "page", tag: "div" },
    { name: "main", tag: "main" },
    { name: "atcBar", tag: "div" },
    { name: "button", tag: "button" }
  );
  assert.equal(nameOf(pressScope(page.button as unknown as Element)), "atcBar");
});

test("an element with role main is the page too", () => {
  const page = chain({ name: "body", tag: "body" }, { name: "app", tag: "div", role: "main" }, { name: "bar", tag: "div" }, { name: "button", tag: "button" });
  assert.equal(nameOf(pressScope(page.button as unknown as Element)), "bar");
});

test("a section inside main still bounds the scope", () => {
  const page = chain({ name: "main", tag: "main" }, { name: "slots", tag: "section" }, { name: "row", tag: "div" }, { name: "button", tag: "button" });
  assert.equal(nameOf(pressScope(page.button as unknown as Element)), "slots");
});
