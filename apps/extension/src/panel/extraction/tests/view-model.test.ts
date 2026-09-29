// What the panel's draft promises, independent of any DOM.
//
// The rows that matter are the staleness ones. `stale` is how D12 survives a
// user changing their mind: a column that has ever been excluded can never show
// a previewed value again, because the value was dropped when it was excluded
// and re-reading it needs the extraction to run. A version of this that cleared
// `stale` on un-exclude would look identical in every other test and would put
// an excluded password back on screen.

import assert from "node:assert/strict";
import test from "node:test";
import {
  extractionDraftFromProposal,
  extractionFieldKindOptions,
  removeExtractionField,
  renameExtractionField,
  setExtractionFieldHandling,
  setExtractionFieldKind,
  setExtractionPaginate
} from "../view-model";
import { proposalFixture } from "./proposal-fixture";

function field(draft: ReturnType<typeof extractionDraftFromProposal>, sourceKey: string) {
  const found = draft.fields.find((row) => row.sourceKey === sourceKey);
  assert.ok(found, `expected a field named ${sourceKey}`);
  return found;
}

test("a field the picker marked sensitive opens excluded, and says why", () => {
  const draft = extractionDraftFromProposal(proposalFixture(), "Products");
  const card = field(draft, "card");
  assert.equal(card.handling, "exclude");
  assert.equal(card.sensitive, true);
  assert.equal(card.stale, true);

  const name = field(draft, "name");
  assert.equal(name.handling, "include");
  assert.equal(name.sensitive, false);
  assert.equal(name.stale, false);
});

test("renaming a column changes the name and nothing else", () => {
  const draft = renameExtractionField(extractionDraftFromProposal(proposalFixture(), "Products"), "name", "Product name");
  const renamed = field(draft, "name");
  assert.equal(renamed.label, "Product name");
  assert.equal(renamed.sourceKey, "name");
  assert.equal(renamed.selector, ".name");
  assert.equal(renamed.stale, false);
});

test("excluding a column marks it stale for good, so un-excluding shows no previewed value", () => {
  const opened = extractionDraftFromProposal(proposalFixture(), "Products");
  const excluded = setExtractionFieldHandling(opened, "name", "exclude");
  assert.equal(field(excluded, "name").handling, "exclude");
  assert.equal(field(excluded, "name").stale, true);

  const included = setExtractionFieldHandling(excluded, "name", "include");
  assert.equal(field(included, "name").handling, "include");
  assert.equal(field(included, "name").stale, true);
});

test("changing what a column reads marks it stale; re-choosing the same kind does not", () => {
  const opened = extractionDraftFromProposal(proposalFixture(), "Products");
  assert.equal(field(setExtractionFieldKind(opened, "name", "text"), "name").stale, false);
  assert.equal(field(setExtractionFieldKind(opened, "name", "link"), "name").stale, true);
});

test("removing a column takes it out of the draft entirely", () => {
  const draft = removeExtractionField(extractionDraftFromProposal(proposalFixture(), "Products"), "card");
  assert.deepEqual(draft.fields.map((row) => row.sourceKey), ["name", "detail", "price", "sku"]);
});

test("only the kinds the proposal supplied an attribute or header for are offered", () => {
  const draft = extractionDraftFromProposal(proposalFixture(), "Products");
  assert.deepEqual(extractionFieldKindOptions(field(draft, "name")), ["text", "link", "value"]);
  assert.deepEqual(extractionFieldKindOptions(field(draft, "sku")), ["text", "link", "value", "attribute"]);
  assert.deepEqual(extractionFieldKindOptions(field(draft, "price")), ["text", "link", "value", "column"]);
});

test("reading one page is the default, and the proposed control is what following pages uses", () => {
  const opened = extractionDraftFromProposal(proposalFixture(), "Products");
  assert.equal(opened.paginate, false);
  assert.deepEqual(opened.pagination, { next: "a.next", maxPages: 5 });
  assert.equal(setExtractionPaginate(opened, true).paginate, true);
});
