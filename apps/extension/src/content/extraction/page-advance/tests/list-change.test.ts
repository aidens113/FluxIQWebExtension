import assert from "node:assert/strict";
import test from "node:test";
import { FakeElement, nthPagerLink, STORE_ITEM, storePage } from "../../tests/store-pager";
import { afterListChange } from "../list-change";
import type { PaginationProgress } from "../types";

async function changing(body: (card: FakeElement, control: FakeElement) => void) {
  const fixture = storePage(1);
  try {
    const control = document.querySelector(nthPagerLink(4)) as unknown as FakeElement;
    const cards = Array.from(document.querySelectorAll(STORE_ITEM));
    control.onClick = () => body(cards[0] as unknown as FakeElement, control);
    const progress: PaginationProgress = {
      item: STORE_ITEM, shown: cards, pagesRead: 1, scrolls: 0,
      deadline: Date.now() + 150, hasUnreadItem: () => true
    };
    return await afterListChange(undefined, progress, control as unknown as HTMLElement, "Next", "next");
  } finally { fixture.restore(); }
}

test("equal-count records changing inside existing item elements advance", async () => {
  const answer = await changing((card) => card.replaceChildren(new FakeElement("a", { href: "/detail/new" }, "New record")));
  assert.deepEqual(answer, { outcome: "advanced", by: "next" });
});

test("a record address changing with unchanged text is semantic advancement", async () => {
  const answer = await changing((card) => card.replaceChildren(new FakeElement("a", { href: "/detail/new" }, card.textContent)));
  assert.deepEqual(answer, { outcome: "advanced", by: "next" });
});

test("pager replacement alone is not list movement and stays within budget", async () => {
  const started = Date.now();
  const answer = await changing((_card, control) => control.replaceWith(new FakeElement("a", { href: "/page/2" }, "Next")));
  assert.deepEqual(answer, { outcome: "timed_out", stop: "deadline" });
  assert.ok(Date.now() - started < 1000);
});

/** The card drawn again in a new element, saying exactly what it said: what a widget that redraws on every press does. */
function redrawn(card: FakeElement): FakeElement {
  const link = card.children[0];
  return new FakeElement("div", { "data-card": card.getAttribute("data-card") ?? "" }, "", link === undefined ? [] : [new FakeElement("a", { href: link.getAttribute("href") ?? "" }, link.textContent)]);
}

// t885, R5: a booking widget redraws its whole calendar on every press, so a
// Next that only raised a form error detached every item and answered "moved".
test("a list redrawn in new elements with the same records has not moved", async () => {
  const answer = await changing((card) => {
    for (const shown of Array.from(document.querySelectorAll(STORE_ITEM)) as unknown as FakeElement[]) shown.replaceWith(redrawn(shown));
    assert.equal(card.isConnected, false, "every item was detached");
  });
  assert.deepEqual(answer, { outcome: "timed_out", stop: "deadline" });
});

test("a list redrawn in new elements with new records has moved", async () => {
  const answer = await changing(() => {
    for (const shown of Array.from(document.querySelectorAll(STORE_ITEM)) as unknown as FakeElement[]) {
      shown.replaceWith(new FakeElement("div", { "data-card": "2-1" }, "", [new FakeElement("a", { href: "/dp/next" }, "Another record")]));
    }
  });
  assert.deepEqual(answer, { outcome: "advanced", by: "next" });
});

test("a page that appends records has moved", async () => {
  const answer = await changing((card) => {
    card.parentElement?.append(new FakeElement("div", { "data-card": "1-9" }, "", [new FakeElement("a", { href: "/dp/P19" }, "Appended record")]));
  });
  assert.deepEqual(answer, { outcome: "advanced", by: "next" });
});
