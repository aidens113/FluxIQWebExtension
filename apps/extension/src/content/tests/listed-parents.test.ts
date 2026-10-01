// Each listed element's `parent` is its nearest listed ancestor in the composed
// tree (t223): through a slot that places it, out of a shadow root to its host,
// and past ancestors the list does not carry. The runner is Node, so the tree
// is a fake holding only the members `listed-parents.ts` reads.

import assert from "node:assert/strict";
import test from "node:test";
import { listedParentIndexes } from "../listed-parents";

class FakeNode {
  parentElement: FakeNode | null = null;
  parentNode: FakeNode | FakeShadowRoot | null = null;
  assignedSlot: FakeNode | null = null;
  readonly nodeType = 1;
  constructor(readonly name: string) {}
  add(...children: FakeNode[]): this {
    for (const child of children) {
      child.parentElement = this;
      child.parentNode = this;
    }
    return this;
  }
  /** Attaches an open shadow root holding `children` at its top level. */
  attachShadow(...children: FakeNode[]): FakeShadowRoot {
    const root = new FakeShadowRoot(this);
    for (const child of children) child.parentNode = root;
    return root;
  }
}

class FakeShadowRoot {
  readonly nodeType = 11;
  constructor(readonly host: FakeNode) {}
}

const node = (name: string): FakeNode => new FakeNode(name);
const parentsOf = (list: FakeNode[]) => listedParentIndexes(list as unknown as Element[]);

test("an element's parent is its nearest listed ancestor; one with none listed has none", () => {
  const link = node("a");
  const wrapper = node("span").add(link);
  const item = node("li").add(wrapper);
  const list = node("ul").add(item);
  node("body").add(list);
  // The span is not listed, so the link's parent is the item above it; the body is never listed.
  assert.deepEqual(parentsOf([list, item, link]), [undefined, 0, 1]);
});

test("a shadow root's top-level element sits in its host, and a slotted light child in its slot", () => {
  const host = node("consent-wall");
  const button = node("button");
  const section = node("section").add(button);
  const slot = node("slot");
  host.attachShadow(section, slot);
  const placed = node("p");
  host.add(placed);
  placed.assignedSlot = slot;
  const list = [host, section, button, slot, placed];
  assert.deepEqual(parentsOf(list), [undefined, 0, 1, 0, 3]);
});

test("a slot the list does not carry passes its child up to the shadow host", () => {
  const host = node("menu-panel");
  const slot = node("slot");
  host.attachShadow(slot);
  const link = node("a");
  host.add(link);
  link.assignedSlot = slot;
  assert.deepEqual(parentsOf([host, link]), [undefined, 0]);
});

test("a nested shadow tree walks out through each host in turn", () => {
  const outer = node("outer-widget");
  const inner = node("inner-widget");
  outer.attachShadow(inner);
  const deep = node("button");
  const wrapper = node("div").add(deep);
  inner.attachShadow(wrapper);
  // The wrapper is not listed: the button's parent is the inner host, whose parent is the outer host.
  assert.deepEqual(parentsOf([outer, inner, deep]), [undefined, 0, 1]);
});
