// T1 coverage of full disclosure on a list read (`assert-disclosed.ts`,
// `read-record.ts`), driven through `extractList` because where the check runs
// -- after `where`, on the items a read keeps -- is the reader's loop: an
// incomplete field refuses the whole list, a collapsed item the conditions
// reject does not, and a rejection that judged a collapsed field does. Moved
// out of `extraction/tests/list-reader.test.ts` on 2026-10-20 with the code it
// covers.

import assert from "node:assert/strict";
import test from "node:test";
import { extractList } from "../../list-reader";
import type { WebAutomationExtractListRequest } from "../../../types";
import { fakeShadowDom } from "../../tests/fake-shadow-dom";

test("an incomplete field refuses the entire list instead of being swallowed as an item fault or stored partial row", async () => {
  const dom = fakeShadowDom();
  const whole = dom.el("p", {}, "Whole text");
  const partial = dom.el("p", {}, "Partial text… ", dom.el("button", {}, "Read more"));
  const savedDocument = globalThis.document;
  globalThis.document = { querySelectorAll: () => [whole, partial], querySelector: () => null } as unknown as Document;
  try {
    await assert.rejects(extractList({ item: "p", fields: { description: { kind: "text" } } }, {
      resume: { records: [], pagesRead: 0, scrolls: 0, missingFields: [], itemsSeen: 0 }
    }), (error: unknown) => {
      assert.equal((error as { failure: { code: string } }).failure.code, "web.validation.output_not_observed");
      assert.match((error as Error).message, /incomplete_text/u);
      return true;
    });
  } finally {
    globalThis.document = savedDocument;
  }
});

// Full disclosure is checked after `where`, on the rows the read keeps: a
// library's reader comments, an old long one the date condition drops and a
// short new one it keeps (`run-mvgw3ve5-294881b5`).
async function readComments(longIsNew: boolean, where: WebAutomationExtractListRequest["where"]): Promise<unknown> {
  const dom = fakeShadowDom();
  const comment = (posted: string, ...body: Array<Element | string>) => dom.el("li", {}, dom.el("span", { class: "posted" }, posted), dom.el("p", { class: "body" }, ...body));
  const long = comment(longIsNew ? "March 2026" : "March 2019", "A long comment on the reading room… ", dom.el("button", {}, "Read more"));
  const short = comment("April 2026", "Quiet and well lit.");
  const savedDocument = globalThis.document;
  globalThis.document = { querySelectorAll: () => [long, short], querySelector: () => null } as unknown as Document;
  try {
    return await extractList({ item: "li", fields: { posted: ".posted", body: ".body" }, where }, {
      resume: { records: [], pagesRead: 0, scrolls: 0, missingFields: [], itemsSeen: 0 }
    });
  } finally {
    globalThis.document = savedDocument;
  }
}

function refusedIncomplete(error: unknown): boolean {
  assert.equal((error as { failure: { code: string } }).failure.code, "web.validation.output_not_observed");
  assert.match((error as Error).message, /incomplete_text/u);
  return true;
}

test("a collapsed item the conditions reject does not refuse the read: the kept row is the answer", async () => {
  const outcome = await readComments(false, [{ field: "posted", contains: "2026" }]) as { records: unknown[] };
  assert.deepEqual(outcome.records, [{ posted: "April 2026", body: "Quiet and well lit." }]);
});

test("a collapsed item the conditions keep still refuses the read as incomplete text", async () => {
  await assert.rejects(readComments(true, [{ field: "posted", contains: "2026" }]), refusedIncomplete);
});

test("a condition on the collapsed field itself that rejects the item judged partial text, so the read is refused", async () => {
  await assert.rejects(readComments(false, [{ field: "body", contains: "quiet" }]), refusedIncomplete);
  await assert.rejects(readComments(false, [{ read: { kind: "text", selector: ".body" }, contains: "quiet" }]), refusedIncomplete);
});
