// T1 coverage of a run with its nested same-template items (`../nested-items.ts`,
// t755): a comment thread's open replies follow their comment, in document
// order, and a plain bullet list inside an item is not a thread.

import assert from "node:assert/strict";
import test from "node:test";
import { withNestedItems } from "../nested-items";

/** As much of an element as the rule reads: tag, class, children, and the query for its tag. */
class Node {
  constructor(readonly tagName: string, readonly cls: string, readonly children: Node[] = []) {}
  get firstElementChild(): Node | null {
    return this.children[0] ?? null;
  }
  querySelectorAll(tag: string): Node[] {
    return this.children.flatMap((child) => [...(child.tagName === tag ? [child] : []), ...child.querySelectorAll(tag)]);
  }
}

const signature = (element: Element): string => `${element.tagName}.${(element as unknown as Node).cls}`;
const nested = (run: Node[]): Node[] => withNestedItems(run as unknown as Element[], (element) => signature(element) === "LI.comment", signature) as unknown as Node[];
const comment = (replies: Node[] = []): Node => new Node("LI", "comment", [new Node("DIV", "body"), ...(replies.length ? [new Node("UL", "replies", replies)] : [])]);

test("each comment is followed by its open replies, in the order the page shows them", () => {
  const replyA = comment();
  const replyB = comment();
  const first = comment([replyA, replyB]);
  const second = comment();
  assert.deepEqual(nested([first, second]), [first, replyA, replyB, second]);
});

test("a list inside an item that is not drawn from the item's template is not a thread", () => {
  const bullet = new Node("LI", "comment", [new Node("SPAN", "point")]);
  const plain = new Node("LI", "comment", []);
  const card = new Node("LI", "comment", [new Node("DIV", "body"), new Node("UL", "points", [bullet, plain])]);
  assert.deepEqual(nested([card]), [card]);
});
