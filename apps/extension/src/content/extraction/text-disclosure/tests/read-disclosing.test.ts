// T1 coverage of `discloseText` on a list read (`../read-disclosing.ts`,
// `../press-disclosure.ts`), driven through `extractList`, because
// which rows are pressed -- the rows the read keeps, and a row whose rejection
// judged collapsed text -- is the reader's loop.
//
// Why it exists: a read whose kept rows carried collapsed text was refused
// `incomplete_text`, and the only repair the domain could name was a second
// shape of Flow -- a context read, a press repeated over its rows, then the full
// read -- which a build could get wrong in several ways, and which, with no
// conditions on its context read, pressed every row of a long list one model
// step at a time until the build ran out of time. The one read presses each
// kept row's own disclosure control itself: with `discloseText` since t752, and
// by default since t752's second unit (C2), since such a row was always refused
// and so no read that passed before changes; `discloseText: false` opts out.
//
// The list is a bookshop's reader reviews, two of them long and cut behind
// "Read more": one from this year a date condition keeps, one from years ago it
// drops.

import assert from "node:assert/strict";
import test from "node:test";
import { extractList, type ListExtractionOutcome } from "../../list-reader";
import type { WebAutomationExtractListRequest } from "../../../types";
import { fakeShadowDom } from "../../tests/fake-shadow-dom";

type Review = { row: Element; pressed: () => number };

const FULL = (name: string) => `${name}: the plot turns twice in the last chapter and the ending is quiet and earned.`;
const CUT = (name: string) => `${name}: the plot turns twice in the last chapter… `;

/**
 * One review: its date and its body, the body cut behind a control when `long`.
 * Pressing the control redraws the body whole, unless `stuck`, which presses
 * and changes nothing. `control` builds the control another way (a link).
 */
function review(dom: ReturnType<typeof fakeShadowDom>, name: string, posted: string, options: { long: boolean; stuck?: boolean; control?: (caption: string) => Element }): Review {
  let presses = 0;
  const body = dom.el("p", { class: "body" });
  if (!options.long) body.append(FULL(name));
  else {
    const control = options.control?.("Read more") ?? dom.el("button", {}, "Read more");
    Object.assign(control, {
      click: () => {
        presses += 1;
        if (!options.stuck) (body as unknown as { replaceChildren(...nodes: string[]): void }).replaceChildren(FULL(name));
      }
    });
    body.append(CUT(name), control);
  }
  const row = dom.el("li", {}, dom.el("span", { class: "posted" }, posted), body);
  return { row, pressed: () => presses };
}

async function read(rows: readonly Review[], request: Partial<WebAutomationExtractListRequest>): Promise<ListExtractionOutcome> {
  const savedDocument = globalThis.document;
  globalThis.document = { querySelectorAll: () => rows.map((entry) => entry.row), querySelector: () => null } as unknown as Document;
  try {
    return await extractList({ item: "li", fields: { posted: ".posted", body: ".body" }, ...request }, {
      resume: { records: [], pagesRead: 0, scrolls: 0, missingFields: [], itemsSeen: 0 }
    });
  } finally {
    globalThis.document = savedDocument;
  }
}

function refusedIncomplete(error: unknown): boolean {
  assert.equal((error as { failure: { code: string } }).failure.code, "web.validation.output_not_observed");
  assert.match((error as Error).message, /incomplete_text: field body/u);
  return true;
}

const THIS_YEAR = [{ field: "posted", contains: "2026" }];

test("by default, and with discloseText: true, the kept long review is pressed and read whole, and the long review the date condition drops is never pressed", async () => {
  for (const asked of [{}, { discloseText: true }]) {
    const dom = fakeShadowDom();
    const kept = review(dom, "Kept", "March 2026", { long: true });
    const dropped = review(dom, "Dropped", "March 2019", { long: true });
    const short = review(dom, "Short", "April 2026", { long: false });
    const outcome = await read([kept, dropped, short], { where: THIS_YEAR, ...asked });
    assert.deepEqual(outcome.records, [{ posted: "March 2026", body: FULL("Kept") }, { posted: "April 2026", body: FULL("Short") }], JSON.stringify(asked));
    assert.equal(kept.pressed(), 1);
    assert.equal(dropped.pressed(), 0, "a row rejected on another field is never pressed");
    assert.equal(outcome.disclosedRows, 1, "the read says how many rows it expanded");
  }
});

test("with discloseText: false the same read is refused as incomplete text, and nothing is pressed", async () => {
  const dom = fakeShadowDom();
  const kept = review(dom, "Kept", "March 2026", { long: true });
  const dropped = review(dom, "Dropped", "March 2019", { long: true });
  await assert.rejects(read([kept, dropped], { where: THIS_YEAR, discloseText: false }), refusedIncomplete);
  assert.equal(kept.pressed() + dropped.pressed(), 0);
});

test("a read that pressed no row says nothing about disclosed rows", async () => {
  const dom = fakeShadowDom();
  const dropped = review(dom, "Dropped", "March 2019", { long: true });
  const short = review(dom, "Short", "April 2026", { long: false });
  const outcome = await read([dropped, short], { where: THIS_YEAR });
  assert.deepEqual(outcome.records, [{ posted: "April 2026", body: FULL("Short") }]);
  assert.equal(dropped.pressed(), 0);
  assert.equal(Object.hasOwn(outcome, "disclosedRows"), false);
});

test("a row whose rejection judged its collapsed text is pressed and judged again on the whole text", async () => {
  const dom = fakeShadowDom();
  const quiet = review(dom, "Quiet", "March 2019", { long: true });
  const other = review(dom, "Other", "March 2018", { long: false });
  for (const where of [[{ field: "body", contains: "quiet and earned" }], [{ read: { kind: "text" as const, selector: ".body" }, contains: "quiet and earned" }]]) {
    const outcome = await read([quiet, other], { where });
    assert.deepEqual(outcome.records.map((record) => record.body), [FULL("Quiet"), FULL("Other")]);
  }
  assert.equal(quiet.pressed(), 1, "pressed once; the second read finds it already whole");
});

test("with no conditions every row is kept, so every collapsed row is pressed", async () => {
  const dom = fakeShadowDom();
  const first = review(dom, "First", "March 2026", { long: true });
  const second = review(dom, "Second", "March 2019", { long: true });
  const outcome = await read([first, second], {});
  assert.deepEqual(outcome.records.map((record) => record.body), [FULL("First"), FULL("Second")]);
  assert.equal(outcome.disclosedRows, 2);
});

test("a kept row still collapsed after its press is refused as incomplete text", async () => {
  const dom = fakeShadowDom();
  const stuck = review(dom, "Stuck", "March 2026", { long: true, stuck: true });
  await assert.rejects(read([stuck], { where: THIS_YEAR }), refusedIncomplete);
  assert.equal(stuck.pressed(), 1, "pressed once, never again");
});

test("a 'Read more' that is a link to another page, or a form's submit button, is never pressed", async () => {
  const dom = fakeShadowDom();
  const link = review(dom, "Link", "March 2026", { long: true, control: (caption) => dom.el("a", { href: "/reviews/1", role: "button" }, caption) });
  await assert.rejects(read([link], { where: THIS_YEAR }), refusedIncomplete);
  assert.equal(link.pressed(), 0);
  let submitted = 0;
  const submit = review(dom, "Submit", "March 2026", { long: true, control: (caption) => dom.el("button", { type: "submit" }, caption) });
  dom.el("form", {}, submit.row);
  Object.assign(submit.row.querySelector("button")!, { click: () => { submitted += 1; } });
  await assert.rejects(read([submit], { where: THIS_YEAR }), refusedIncomplete);
  assert.equal(submitted, 0);
});
