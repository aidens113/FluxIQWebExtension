// T1 coverage of the candidates a run's markup offers, which is the pure half
// of naming a repeating run. Whether a candidate is accepted is the other half
// and needs a document, so it is proven on real fixtures by
// `e2e/content/tests/extraction/inference.spec.ts`: there a candidate is taken
// only when `querySelectorAll` answers with exactly the run.

import assert from "node:assert/strict";
import test from "node:test";
import { itemSelectorCandidates, type ItemSelectorParts, type ItemTestId } from "../item-selector";

const CONTAINER = '[data-testid="product-list"]';

function parts(overrides: Partial<ItemSelectorParts> = {}): ItemSelectorParts {
  return { container: CONTAINER, tagName: "LI", testIds: [], classes: [], ...overrides };
}

function testIds(...values: string[]): ItemTestId[] {
  return values.map((value) => ({ attribute: "data-testid", value }));
}

test("the test id every item shares is the strongest candidate", () => {
  const candidates = itemSelectorCandidates(parts({ testIds: testIds("product-card", "product-card", "product-card") }));
  assert.deepEqual(candidates[0], { selector: '[data-testid="product-card"]', confidence: 1 });
});

test("a numbered run gives a prefix candidate, so row-1, row-2 and row-12 are one selector", () => {
  const candidates = itemSelectorCandidates(parts({ testIds: testIds("row-1", "row-2", "row-12") }));
  assert.deepEqual(candidates[0], { selector: '[data-testid^="row-"]', confidence: 0.9 });
});

test("ids that differ before their first digit have no shape", () => {
  const selectors = itemSelectorCandidates(parts({ testIds: testIds("alpha-1", "beta-2", "gamma-3") })).map((candidate) => candidate.selector);
  assert.ok(!selectors.some((selector) => selector.includes("^=")), selectors.join(" "));
});

test("an item with no test id is named structurally, by its container, tag and classes", () => {
  const candidates = itemSelectorCandidates(parts({ classes: ["card", "b", "a", "zz"] }));
  assert.deepEqual(candidates[0], { selector: `${CONTAINER} > li.a.b.card`, confidence: 0.75 });
});

test("a class that would need escaping is left out rather than written into a selector", () => {
  const candidates = itemSelectorCandidates(parts({ classes: ["w-1/2", "card"] }));
  assert.equal(candidates[0]?.selector, `${CONTAINER} > li.card`);
});

test("a role is the last candidate, after the structural one", () => {
  const candidates = itemSelectorCandidates(parts({ role: " ROW " }));
  assert.deepEqual(candidates.at(-1), { selector: `${CONTAINER} > [role="ROW"]`, confidence: 0.6 });
});

test("a quote in a test id is escaped, so the candidate stays one selector", () => {
  const candidates = itemSelectorCandidates(parts({ testIds: testIds('say "hi"', 'say "hi"', 'say "hi"') }));
  assert.equal(candidates[0]?.selector, '[data-testid="say \\"hi\\""]');
});

test("candidates are offered strongest first", () => {
  const confidences = itemSelectorCandidates(parts({ role: "row", testIds: testIds("row-1", "row-2", "row-3") })).map((candidate) => candidate.confidence);
  assert.deepEqual([...confidences].sort((left, right) => right - left), confidences);
  assert.ok(confidences.every((confidence) => confidence > 0 && confidence <= 1), confidences.join(" "));
});
