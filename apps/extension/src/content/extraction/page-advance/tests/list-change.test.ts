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
