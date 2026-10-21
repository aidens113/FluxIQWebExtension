// `discloseText` through the list extraction node: an author's malformed value
// is refused by name before the Flow runs, a Flow's dispatch keeps it on the
// one-page request the page runs (it is about the rows this read keeps, not the
// collection, so it never moves to the record output's `process`), and the text
// a model reads names it with an example from a kind of site no realistic
// scenario is.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_EXTRACT_LIST_EXAMPLE, WEB_AUTOMATION_EXTRACT_LIST_GRAMMAR } from "../catalog-text";
import { webAutomationExtractListDispatch } from "../dispatch";
import { webAutomationExtractListIssues } from "../issues";

const READ = { item: "li.review", fields: { posted: ".posted", body: ".body" }, where: [{ field: "posted", contains: "2026" }] };

test("discloseText true or false is no issue; anything else is refused by name", () => {
  assert.deepEqual(webAutomationExtractListIssues({ ...READ, discloseText: true }), []);
  assert.deepEqual(webAutomationExtractListIssues({ ...READ, discloseText: false }), []);
  assert.deepEqual(webAutomationExtractListIssues({ ...READ, discloseText: "yes" }), ["web.extract_list.invalid_disclose_text"]);
});

test("a Flow's dispatch keeps discloseText on the page request, beside where", () => {
  const dispatched = webAutomationExtractListDispatch({ extractList: { ...READ, discloseText: true, minItems: 2 } });
  assert.equal(dispatched.ok, true);
  const page = ((dispatched as { payload: JsonObject }).payload.parameters as JsonObject).extractList as JsonObject;
  assert.equal(page.discloseText, true);
  assert.deepEqual(page.where, READ.where);
  assert.equal(Object.hasOwn(page, "minItems"), false, "the collection's members still leave the page");
});

// t752 C2: the read opens each kept row's own collapsed text by default, so the
// grammar says it does so itself and how to stop it, and never asks for `true`.
test("the grammar says the read opens each kept row's own Read more itself and discloseText: false stops it, and the example declares the default", () => {
  assert.match(WEB_AUTOMATION_EXTRACT_LIST_GRAMMAR, /opens each kept row's own "Read more" \([^)]*\) itself;/iu);
  assert.match(WEB_AUTOMATION_EXTRACT_LIST_GRAMMAR, /discloseText: false stops it/u);
  assert.doesNotMatch(WEB_AUTOMATION_EXTRACT_LIST_GRAMMAR, /discloseText\?: true/u);
  // Core's parameter-description bound is 700.
  assert.equal(WEB_AUTOMATION_EXTRACT_LIST_GRAMMAR.length <= 700, true, `${WEB_AUTOMATION_EXTRACT_LIST_GRAMMAR.length} characters`);
  // Core reads the example's top-level keys as the keys a model may write
  // beside extractList; declared as the default, so copying it changes nothing.
  assert.equal(WEB_AUTOMATION_EXTRACT_LIST_EXAMPLE.discloseText, true);
  // Model guidance never teaches to the test: no social feed's words.
  assert.doesNotMatch(WEB_AUTOMATION_EXTRACT_LIST_GRAMMAR, /\bpost|feed|group|friend|See more/iu);
});
