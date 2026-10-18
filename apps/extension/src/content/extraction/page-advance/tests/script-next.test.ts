// Coverage of a next-page step on a pager whose Next is a script's element that
// does nothing and whose numbers are all links, the current one told apart only
// by a class or by linking to the page already showing (`../follow-next.ts`,
// `../../pager-reading/current-page.ts`; run-mvd0pbn9-bad36023), on
// `./script-next-pager.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { movePage, type PageMoveOptions } from "..";
import type { PageMoveMark } from "../../../../shared/extraction-continuation";
import { LAST_PAGE_NEXT, SCRIPT_NEXT, SCRIPT_NEXT_HIT, scriptNextAddress, scriptNextPage, type ScriptNextPage, type ScriptNextStyle } from "./script-next-pager";

async function onPage<T>(page: number, style: ScriptNextStyle, body: (shown: ScriptNextPage, marks: PageMoveMark[]) => Promise<T>): Promise<T> {
  const shown = scriptNextPage(page, style);
  const marks: PageMoveMark[] = [];
  try {
    return await body(shown, marks);
  } finally {
    shown.restore();
  }
}

const marking = (marks: PageMoveMark[]): PageMoveOptions["mark"] => (mark) => {
  marks.push(structuredClone(mark));
  return Promise.resolve();
};

const arrivals: Array<{ named: string; style: ScriptNextStyle }> = [
  { named: "the current number told only by its class, opened at an address no number links to", style: { current: "class", arrival: "/find?q=lamp&ref=banner" } },
  { named: "the current number told by its class and by linking here, opened with an empty parameter", style: { current: "class", arrival: "/find?kind=&q=lamp" } },
  { named: "every number alike, the current one told only by linking here past an empty parameter", style: { current: "plain", arrival: "/find?kind=&q=lamp" } }
];

for (const arrival of arrivals) {
  test(`on page one, a Next that does nothing is swapped for the number two (${arrival.named})`, async () => {
    await onPage(1, arrival.style, async (shown, marks) => {
      const answer = await movePage({ item: SCRIPT_NEXT_HIT, pagination: { next: SCRIPT_NEXT } }, { timeoutMs: 20_000, mark: marking(marks) });
      assert.deepEqual(answer, { outcome: "moved", by: "following", page: 2 });
      assert.deepEqual(shown.followed, [scriptNextAddress(2)]);
      assert.equal(shown.nextPresses(), 0, "the Next that does nothing is never pressed");
      assert.deepEqual(marks, [{ by: "following" }]);
    });
  });
}

test("from page two, told by its class, the step goes on to the number three", async () => {
  await onPage(2, { current: "class" }, async (shown) => {
    const answer = await movePage({ item: SCRIPT_NEXT_HIT, pagination: { next: SCRIPT_NEXT } }, { timeoutMs: 20_000 });
    assert.deepEqual(answer, { outcome: "moved", by: "following", page: 3 });
    assert.deepEqual(shown.followed, [scriptNextAddress(3)]);
    assert.equal(shown.nextPresses(), 0);
  });
});

test("on the last page, whose Next only looks disabled and shows no next number, the step ends no_following_page and presses nothing", async () => {
  await onPage(4, { current: "class", arrival: "/find?q=lamp&page=4&ref=banner" }, async (shown, marks) => {
    const answer = await movePage({ item: SCRIPT_NEXT_HIT, pagination: { next: LAST_PAGE_NEXT } }, { timeoutMs: 20_000, mark: marking(marks) });
    assert.deepEqual(answer, { outcome: "ended", stop: "no_following_page" });
    assert.deepEqual(shown.followed, []);
    assert.equal(shown.nextPresses(), 0);
    assert.deepEqual(marks, [], "nothing was about to be pressed");
  });
});
