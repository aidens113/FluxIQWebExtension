// T1 coverage of which control a label names, the pure half of pagination
// detection. Where the controls are looked for, and that a card's own link is
// never one, needs a document and is proven on real fixtures by
// `e2e/content/tests/extraction/inference.spec.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { PROPOSED_MAX_PAGES, paginationKindForLabel } from "../detect-pagination";

test("a control labelled Next follows the list, however the page cases or decorates it", () => {
  for (const label of ["Next", "next", " Next \n", "Next page", "NEXT PAGE", "Go to next page", "Next →"]) {
    assert.equal(paginationKindForLabel(label, undefined), "next", label);
  }
});

test("rel=next says so even when the label does not", () => {
  assert.equal(paginationKindForLabel("›", "next"), "next");
  assert.equal(paginationKindForLabel("›", "nofollow next"), "next");
  assert.equal(paginationKindForLabel("›", "nextish"), undefined);
});

test("Load more and Show more append to the list rather than replacing it", () => {
  for (const label of ["Load more", "Show more", "Load More Products", "View more results"]) {
    assert.equal(paginationKindForLabel(label, undefined), "loadMore", label);
  }
});

test("a control that says nothing about pagination is not one", () => {
  for (const label of ["", "   ", "Previous", "1", "Add to cart", "More about us"]) {
    assert.equal(paginationKindForLabel(label, undefined), undefined, JSON.stringify(label));
  }
});

// A proposal says how a list continues. How much of it to take is what the
// instruction says, and a detector that answers it too turns "the first page"
// into "every page" without anyone choosing. On 2026-09-24 that cost two of the
// three live runs that completed: each built a single `web.dom.extract_list`
// carrying this proposal, walked all three catalog pages, and returned 23
// records where the expectation held 8 -- with every in-scope record matching
// field for field, so nothing else was wrong. A read that wants more pages now
// has to say so, and one stopped by this bound reports `truncated` rather than
// quietly answering short.
test("a proposal asks for the page in front of it, never for every page the pager shows", () => {
  assert.equal(PROPOSED_MAX_PAGES, 1);
});
