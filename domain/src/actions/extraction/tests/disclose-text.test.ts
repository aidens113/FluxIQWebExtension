// `discloseText` on the extraction contract: the request member that, set
// `false`, stops the page pressing each kept row's own text-disclosure control
// before reading its text, which it does by default (`../request.ts`), the schema that declares it, the reader that carries it
// or drops and names it, and the summary count of rows the read expanded.
//
// It exists because a read whose kept rows carried collapsed text could only be
// repaired by a second shape of Flow -- a context read, a press repeated over
// its rows, then the full read -- which builds got wrong in several ways and
// which, with no conditions on its first read, pressed every row of a long list
// one step at a time.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationExtractListRequestRead, webAutomationExtractListRequestValue, webAutomationExtractListRequestWhole } from "../read-request";
import { webAutomationExtractListSchema } from "../schema";
import { webAutomationExtractionSummaryValue } from "../summary";

const READ = { item: "li.review", fields: { posted: ".posted", body: ".body" }, where: [{ field: "posted", contains: "2026" }] };

test("discloseText: true is carried on the request the page runs", () => {
  assert.equal(webAutomationExtractListRequestValue({ ...READ, discloseText: true })?.discloseText, true);
  assert.equal(webAutomationExtractListRequestWhole({ ...READ, discloseText: true })?.discloseText, true);
});

// t752 C2: pressing is the default, so `false` is the value that must reach the
// page, and a read without the key carries nothing and presses.
test("discloseText: false is carried, so the page presses nothing; none carries nothing, and the page presses by default", () => {
  const off = webAutomationExtractListRequestRead({ ...READ, discloseText: false });
  assert.deepEqual(off.dropped, []);
  assert.equal(off.request?.discloseText, false);
  assert.equal(webAutomationExtractListRequestWhole({ ...READ, discloseText: false })?.discloseText, false);
  const none = webAutomationExtractListRequestRead(READ);
  assert.deepEqual(none.dropped, []);
  assert.equal(Object.hasOwn(none.request ?? {}, "discloseText"), false);
});

test("a discloseText that is not a boolean is dropped and named, and the read goes on with the default", () => {
  for (const discloseText of ["yes", 1, null, {}]) {
    const read = webAutomationExtractListRequestRead({ ...READ, discloseText });
    assert.deepEqual(read.dropped, ["discloseText"], JSON.stringify(discloseText));
    assert.equal(read.request?.discloseText, undefined);
    assert.equal(webAutomationExtractListRequestWhole({ ...READ, discloseText }), undefined, "a producer's copy is all or nothing");
  }
});

test("the schema declares discloseText as a boolean", () => {
  const properties = webAutomationExtractListSchema({}).properties as Record<string, { type?: string }>;
  assert.equal(properties.discloseText?.type, "boolean");
});

const SUMMARY = { recordCount: 2, pagesRead: 1, truncated: false, missingFields: [], fieldNames: ["posted", "body"], itemsSeen: 3 };

test("the summary carries how many rows the read expanded, and absent stays absent", () => {
  assert.deepEqual(webAutomationExtractionSummaryValue({ ...SUMMARY, disclosedRows: 1 }), { ...SUMMARY, disclosedRows: 1 });
  assert.deepEqual(webAutomationExtractionSummaryValue({ ...SUMMARY, disclosedRows: 0 }), { ...SUMMARY, disclosedRows: 0 });
  assert.deepEqual(webAutomationExtractionSummaryValue(SUMMARY), SUMMARY);
});

test("a disclosedRows that is not a count drops the whole summary, as every count here does", () => {
  for (const disclosedRows of [-1, 1.5, "1", null]) {
    assert.equal(webAutomationExtractionSummaryValue({ ...SUMMARY, disclosedRows }), undefined, JSON.stringify(disclosedRows));
  }
});
