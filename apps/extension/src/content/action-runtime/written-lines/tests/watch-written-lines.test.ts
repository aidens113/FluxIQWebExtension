// T1 coverage of the written-lines watch (`../watch-written-lines.ts`): which
// region it observes, and which of the elements a press changed it reads as a
// line. The page is faked at what the watch touches -- an element's parent,
// children, text, rendering and controls -- and the observer is injected, so
// each row states the mutations a press caused and checks the lines read from
// them. That the real page's mutations arrive as these records is the content
// harness's (`e2e/content/tests/press-answers/`), on crossborder's item page.

import assert from "node:assert/strict";
import test from "node:test";
import { watchWrittenLines, type LineObserver } from "../watch-written-lines";

type FakeNode = {
  nodeType: number;
  tagName?: string;
  textContent?: string;
  parentElement: FakeNode | null;
  parentNode: FakeNode | null;
  childNodes: FakeNode[];
  isConnected: boolean;
  shadowRoot: null;
  rendered: boolean;
  control: boolean;
  getAttribute(name: string): string | null;
  matches(selector: string): boolean;
  querySelector(selector: string): FakeNode | null;
  getClientRects(): { length: number };
  contains(other: FakeNode): boolean;
};

function element(tagName: string, parent: FakeNode | null, options: { rendered?: boolean; control?: boolean } = {}): FakeNode {
  const node: FakeNode = {
    nodeType: 1,
    tagName: tagName.toUpperCase(),
    parentElement: parent,
    parentNode: parent,
    childNodes: [],
    isConnected: true,
    shadowRoot: null,
    rendered: options.rendered ?? true,
    control: options.control ?? false,
    getAttribute: () => null,
    matches: () => node.control,
    querySelector: () => node.childNodes.find((child) => child.nodeType === 1 && (child.control || child.querySelector("") !== null)) ?? null,
    getClientRects: () => ({ length: node.rendered ? 1 : 0 }),
    contains: (other) => {
      for (let current: FakeNode | null = other; current; current = current.parentElement) if (current === node) return true;
      return false;
    }
  };
  parent?.childNodes.push(node);
  return node;
}

function text(value: string, parent: FakeNode): FakeNode {
  const node = { nodeType: 3, textContent: value, parentElement: parent, parentNode: parent, childNodes: [] } as unknown as FakeNode;
  parent.childNodes.push(node);
  return node;
}

/** crossborder's item page, as far as the watch reads it: Add to cart in the fixed buy bar, the error line under the options. */
function itemPage() {
  const body = element("body", null);
  const main = element("main", body);
  const info = element("div", main);
  const tip = element("div", info);
  const bar = element("div", main);
  const add = element("div", bar);
  text("Add to cart", add);
  return { body, main, info, tip, bar, add };
}

type ObserverRecord = { observed: unknown[]; disconnected: number; queue: MutationRecord[] };

function fakeObserver(): { make: () => LineObserver; record: ObserverRecord } {
  const record: ObserverRecord = { observed: [], disconnected: 0, queue: [] };
  return {
    record,
    make: () => ({
      observe: (target) => {
        record.observed.push(target);
      },
      takeRecords: () => record.queue.splice(0),
      disconnect: () => {
        record.disconnected += 1;
      }
    })
  };
}

const childList = (target: FakeNode, added: FakeNode[]): MutationRecord => ({ type: "childList", target, addedNodes: added, removedNodes: [] }) as unknown as MutationRecord;

test("the region is the control's ancestors three up, stopping short of the body: crossborder's whole main, where the error line is", () => {
  const page = itemPage();
  const observer = fakeObserver();
  watchWrittenLines(page.add as unknown as Element, 3, observer.make);
  assert.deepEqual(observer.record.observed, [page.main]);
});

test("a line the press wrote is read once, as the page wrote it, and stopping disconnects", () => {
  const page = itemPage();
  const observer = fakeObserver();
  const lines = watchWrittenLines(page.add as unknown as Element, 3, observer.make);
  // `tip.textContent = ''` then `tip.textContent = 'Please select a Color.'`.
  observer.record.queue.push(childList(page.tip, []), childList(page.tip, [text("Please select a Color.", page.tip)]));
  assert.deepEqual(lines.take(), ["Please select a Color."]);
  assert.deepEqual(lines.take(), [], "a line already read is not read again until the page writes it again");
  lines.stop();
  lines.stop();
  assert.equal(observer.record.disconnected, 1);
  observer.record.queue.push(childList(page.tip, []));
  assert.deepEqual(lines.take(), []);
});

test("a panel the press opened is no line: it holds controls of its own", () => {
  const page = itemPage();
  const observer = fakeObserver();
  const lines = watchWrittenLines(page.add as unknown as Element, 3, observer.make);
  const panel = element("div", page.info);
  text("Please select a size", panel);
  text("S", element("button", panel, { control: true }));
  observer.record.queue.push(childList(page.info, [panel]));
  assert.deepEqual(lines.take(), []);
});

test("an unrendered, removed or over-long change is no line, and the pressed control's own label is", () => {
  const page = itemPage();
  const observer = fakeObserver();
  const lines = watchWrittenLines(page.add as unknown as Element, 3, observer.make);
  const hidden = element("div", page.info, { rendered: false });
  text("Please select a Color.", hidden);
  const gone = element("div", page.info);
  text("Please select a Color.", gone);
  gone.isConnected = false;
  const long = element("div", page.info);
  text("Please select a Color. ".repeat(12), long);
  observer.record.queue.push(childList(page.info, [hidden, gone, long]));
  assert.deepEqual(lines.take(), []);

  const button = element("button", page.bar, { control: true });
  const pressedLines = watchWrittenLines(button as unknown as Element, 3, observer.make);
  observer.record.queue.push(childList(button, [text("Select a size first", button)]));
  assert.deepEqual(pressedLines.take(), ["Select a size first"]);
});

test("a page with no observer is watched for nothing", () => {
  const page = itemPage();
  const lines = watchWrittenLines(page.add as unknown as Element, 3, () => undefined);
  assert.deepEqual(lines.take(), []);
  lines.stop();
});
