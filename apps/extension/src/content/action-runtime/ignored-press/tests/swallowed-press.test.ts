// T1 coverage of a swallowed press on bigbox's product page (t195-w19b #4),
// through the real watch, listener and scope: the page's own load-time changes
// inside `<main>` -- the reviews arriving 900 ms after load -- are not an
// answer to an Add to cart press the page swallowed, so it is pressed again;
// a change inside the press's own bar is, so it is not. The page is faked at
// what the listener reads: elements with tags and parents, and a
// MutationObserver that reports a mutation to every observer whose target
// holds the mutated node, as a subtree observer does.

import assert from "node:assert/strict";
import test from "node:test";
import { listenForPressAnswer, type PressPage } from "../page-press-listener";
import { watchIgnoredPress } from "../ignored-press-watch";
import { pressAgain, type PressSignal } from "../press-again";

type FakeNode = { name: string; tagName: string; parentElement: FakeNode | null; parentNode: FakeNode | null; getAttribute(name: string): null };

/** Bigbox's product page as the press sees it: `body > div.page > main > {div.atcBar > button, section.reviews}`. */
function productPage() {
  const node = (name: string, tag: string, parent: FakeNode | null): FakeNode => ({ name, tagName: tag.toUpperCase(), parentElement: parent, parentNode: parent, getAttribute: () => null });
  const body = node("body", "body", null);
  const page = node("page", "div", body);
  const main = node("main", "main", page);
  const atcBar = node("atcBar", "div", main);
  const button = node("button", "button", atcBar);
  const reviews = node("reviews", "section", main);

  const observers = new Set<{ target: FakeNode; pending: number; callback: (records: unknown[]) => void }>();
  class SubtreeObserver {
    private readonly entry: { target: FakeNode; pending: number; callback: (records: unknown[]) => void };
    constructor(callback: (records: unknown[]) => void) {
      this.entry = { target: body, pending: 0, callback };
    }
    observe(target: FakeNode) {
      this.entry.target = target;
      observers.add(this.entry);
    }
    takeRecords() {
      const records = Array.from({ length: this.entry.pending }, () => ({}));
      this.entry.pending = 0;
      return records;
    }
    disconnect() {
      observers.delete(this.entry);
    }
  }
  const holds = (ancestor: FakeNode, node: FakeNode | null): boolean => {
    for (let at = node; at; at = at.parentElement) if (at === ancestor) return true;
    return false;
  };
  const environment: PressPage = { MutationObserver: SubtreeObserver as unknown as typeof MutationObserver, PerformanceObserver: undefined, performance: undefined };
  return {
    elements: { body, page, main, atcBar, button, reviews },
    environment,
    observed: () => [...observers].map((entry) => entry.target.name),
    /** The page changed something under `node`: a child added, an attribute, text. */
    mutate(node: FakeNode) {
      for (const entry of observers) {
        if (!holds(entry.target, node)) continue;
        entry.pending += 1;
        queueMicrotask(() => {
          if (entry.pending === 0 || !observers.has(entry)) return;
          entry.pending = 0;
          entry.callback([{}]);
        });
      }
    }
  };
}

/** Watches a press on the Add to cart button while the page changes `changed` 100 ms after it, for a 300 ms window. */
async function pressWhile(changed: "reviews" | "button"): Promise<{ seen: PressSignal[]; observed: string[] }> {
  const page = productPage();
  const watch = watchIgnoredPress(page.elements.button as unknown as Element, (pressed, note) => listenForPressAnswer(pressed, note, page.environment));
  const observed = page.observed();
  setTimeout(() => page.mutate(page.elements[changed]), 100);
  const answer = await watch.settle(300);
  return { seen: answer.seen, observed };
}

test("the reviews arriving inside main after a swallowed Add to cart press are no answer to it: it is pressed again", async () => {
  const { seen, observed } = await pressWhile("reviews");
  assert.deepEqual(observed, ["atcBar"], "only the press's own bar is watched, not main");
  assert.deepEqual(seen, []);
  assert.equal(pressAgain(seen, 0), true);
});

test("a press whose own bar changes was answered, and is not pressed again", async () => {
  const { seen } = await pressWhile("button");
  assert.deepEqual(seen, ["change"]);
  assert.equal(pressAgain(seen, 0), false);
});
