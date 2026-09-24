import assert from "node:assert/strict";
import test from "node:test";
import { evidenceBandKey, webLlmEvidenceComposition, WEB_LLM_EVIDENCE_UNRANKED_BAND } from "../composition";
import { WEB_LLM_EVIDENCE_BOUNDS, WEB_LLM_EVIDENCE_BYTE_BUDGETS } from "../limits";
import { sanitizeWebLlmSnapshot } from "../sanitize";

/**
 * A capture element in the relevance band the page's own ranking would have
 * given it. The band is written by name even when it is `undefined`, which is
 * what a capture that ranked nothing sends and what the reader must treat as
 * unranked; a conditional spread would also hide a rename from the compiler.
 */
const element = (index: number, band: number | undefined) => ({
  tagName: "button",
  selector: `#control-${index}`,
  name: `Control ${index}`,
  snapshotBucket: band,
});

const page = (elements: unknown[]) => ({ url: "https://example.test/catalogue", title: "Catalogue", interactiveElements: elements });

test("a band is read off the capture, and an element the capture did not rank counts as unranked", () => {
  assert.equal(evidenceBandKey(element(1, 1)), "1");
  assert.equal(evidenceBandKey(element(1, 0)), "0");
  assert.equal(evidenceBandKey(element(1, undefined)), WEB_LLM_EVIDENCE_UNRANKED_BAND);
  // Not a number, not a band: a malformed value is unranked rather than coerced
  // into a band the capture never assigned.
  assert.equal(evidenceBandKey({ snapshotBucket: "1" }), WEB_LLM_EVIDENCE_UNRANKED_BAND);
  assert.equal(evidenceBandKey({ snapshotBucket: -1 }), WEB_LLM_EVIDENCE_UNRANKED_BAND);
  assert.equal(evidenceBandKey({ snapshotBucket: 1.5 }), WEB_LLM_EVIDENCE_UNRANKED_BAND);
  assert.equal(evidenceBandKey("not an element"), WEB_LLM_EVIDENCE_UNRANKED_BAND);
});

test("the histogram counts what was kept and what was left behind, band by band", () => {
  const compose = webLlmEvidenceComposition([element(1, 1), element(2, 1), element(3, 2), element(4, 6), element(5, undefined)]);
  assert.deepEqual(compose(["1", "2"]), { included: { "1": 1, "2": 1 }, dropped: { "1": 1, "6": 1, [WEB_LLM_EVIDENCE_UNRANKED_BAND]: 1 } });
  // Nothing kept: every band the capture offered is on the dropped side, and
  // the included side is empty rather than a row of zeroes.
  assert.deepEqual(compose([]), { included: {}, dropped: { "1": 2, "2": 1, "6": 1, [WEB_LLM_EVIDENCE_UNRANKED_BAND]: 1 } });
  // Everything kept: the dropped side is empty, which is how a reader tells an
  // untruncated packet from one that lost its tail.
  assert.deepEqual(compose(["1", "1", "2", "6", WEB_LLM_EVIDENCE_UNRANKED_BAND]), {
    included: { "1": 2, "2": 1, "6": 1, [WEB_LLM_EVIDENCE_UNRANKED_BAND]: 1 },
    dropped: {},
  });
});

test("numbered bands read in their own order, with unranked after all of them", () => {
  const compose = webLlmEvidenceComposition([element(1, 10), element(2, 2), element(3, undefined), element(4, 0)]);
  assert.deepEqual(Object.keys(compose([])["dropped"]), ["0", "2", "10", WEB_LLM_EVIDENCE_UNRANKED_BAND]);
});

test("a packet states the composition of the elements it actually describes", () => {
  const evidence = sanitizeWebLlmSnapshot(page([element(1, 1), element(2, 2), element(3, 2)]));
  assert.deepEqual(evidence.composition, { included: { "1": 1, "2": 2 }, dropped: {} });
});

// The measurement this was built for. `run-muexhp0k-73172f73` failed on a filter
// its instruction named, and the question nobody could answer was whether band 1
// -- the controls that change what the page shows -- had reached the packet at
// all. On a page of this shape the answer is now on the packet.
test("the element bound's cut shows band by band, so a filter rail that never reached the packet is visible", () => {
  const filters = Array.from({ length: 12 }, (_, index) => element(index, 1));
  const rows = Array.from({ length: 200 }, (_, index) => element(100 + index, 6));
  const evidence = sanitizeWebLlmSnapshot(page([...filters, ...rows]), { maxEvidenceBytes: WEB_LLM_EVIDENCE_BYTE_BUDGETS.ceiling });
  assert.equal(evidence.elements.length, WEB_LLM_EVIDENCE_BOUNDS.elements);
  assert.equal(evidence.composition.included["1"], 12, "every filter reached the packet");
  assert.equal(evidence.composition.included["6"], WEB_LLM_EVIDENCE_BOUNDS.elements - 12);
  assert.equal(evidence.composition.dropped["1"], undefined, "no filter was cut");
  assert.equal(evidence.composition.dropped["6"], 200 - (WEB_LLM_EVIDENCE_BOUNDS.elements - 12));
  // The two sides account for the whole capture: 212 elements offered, 40 described.
  const total = (counts: Record<string, number>) => Object.values(counts).reduce((sum, count) => sum + count, 0);
  assert.equal(total(evidence.composition.included) + total(evidence.composition.dropped), 212);
});

test("a capture whose elements rank behind the bound reports the band it lost", () => {
  const rows = Array.from({ length: 60 }, (_, index) => element(index, 6));
  const evidence = sanitizeWebLlmSnapshot(page([...rows, element(99, 1)]), { maxEvidenceBytes: WEB_LLM_EVIDENCE_BYTE_BUDGETS.ceiling });
  // The packet takes the capture's order, so the one filter ranked behind sixty
  // rows never reaches it -- and the packet now says so instead of leaving the
  // reader with a byte count.
  assert.equal(evidence.composition.included["1"], undefined);
  assert.equal(evidence.composition.dropped["1"], 1);
});

test("the budget's trim moves elements to the dropped side, so the count describes the packet as sent", () => {
  const rows = Array.from({ length: 30 }, (_, index) => element(index, 6));
  const trimmed = sanitizeWebLlmSnapshot(page(rows), { maxEvidenceBytes: 400 });
  assert.equal(trimmed.budgetTruncated, true);
  assert.equal(trimmed.composition.included["6"], trimmed.elements.length);
  assert.equal(trimmed.composition.dropped["6"], 30 - trimmed.elements.length);
});

test("a sanitizer refusal counts as dropped: the model was not shown it, whatever the reason", () => {
  const evidence = sanitizeWebLlmSnapshot(page([
    element(1, 1),
    // Refused by `elements.ts`: a control whose signature says it holds a secret
    // is never described, and the histogram must not imply it was.
    { tagName: "input", selector: "#card", name: "Card number", inputType: "text", snapshotBucket: 2, attributes: { autocomplete: "billing cc-number" } },
  ]));
  assert.deepEqual(evidence.composition, { included: { "1": 1 }, dropped: { "2": 1 } });
});

test("the composition carries counts and nothing a page could have written", () => {
  const evidence = sanitizeWebLlmSnapshot(page([
    { tagName: "button", selector: "#brightaisle-plus", name: "Brightaisle Plus", visibleText: "Brightaisle Plus", snapshotBucket: 1 },
    { tagName: "p", selector: "#blurb", text: "Members save more", snapshotBucket: 7 },
  ]));
  const serialized = JSON.stringify(evidence.composition);
  assert.doesNotMatch(serialized, /Brightaisle|Members|button|selector|#/u);
  assert.equal(serialized, '{"included":{"1":1,"7":1},"dropped":{}}');
});
