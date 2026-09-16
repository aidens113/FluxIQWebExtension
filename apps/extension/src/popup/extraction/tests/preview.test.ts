// D12 at its narrowest: what the panel is still holding after the user excludes
// a column.
//
// "Not shown" is not the promise. The promise is that the value is gone from the
// object the panel holds, so the assertions check `Object.hasOwn` and search the
// serialized rows rather than checking what a renderer drew. A filter applied at
// render time would pass a display test and fail every row here.

import assert from "node:assert/strict";
import test from "node:test";
import type { ExtractionPreviewRow } from "../messages";
import { extractionPreviewColumns, retainExtractionPreview } from "../preview";
import { extractionDraftFromProposal, setExtractionFieldHandling, setExtractionFieldKind } from "../view-model";
import { PLANTED_VALUE, proposalFixture } from "./proposal-fixture";

function rowsWithCard(): ExtractionPreviewRow[] {
  return [
    { name: "Anvil", detail: "https://example.test/anvil", price: "9.99", sku: "A-1", card: PLANTED_VALUE },
    { name: "Rope", detail: null, price: "4.50", sku: "R-2", card: PLANTED_VALUE }
  ];
}

test("a column the picker pre-excluded is dropped from the rows, not hidden in them", () => {
  const draft = extractionDraftFromProposal(proposalFixture(), "Products");
  const kept = retainExtractionPreview(rowsWithCard(), draft);
  assert.equal(JSON.stringify(kept).includes(PLANTED_VALUE), false);
  for (const row of kept) assert.equal(Object.hasOwn(row, "card"), false);
  assert.deepEqual(Object.keys(kept[0] ?? {}), ["name", "detail", "price", "sku"]);
});

test("excluding a column deletes its values, and un-excluding does not bring them back", () => {
  const opened = extractionDraftFromProposal(proposalFixture(), "Products");
  const excluded = setExtractionFieldHandling(opened, "sku", "exclude");
  const afterExclude = retainExtractionPreview(retainExtractionPreview(rowsWithCard(), opened), excluded);
  assert.equal(JSON.stringify(afterExclude).includes("A-1"), false);

  const included = setExtractionFieldHandling(excluded, "sku", "include");
  const afterInclude = retainExtractionPreview(afterExclude, included);
  assert.equal(JSON.stringify(afterInclude).includes("A-1"), false);
  for (const row of afterInclude) assert.equal(Object.hasOwn(row, "sku"), false);
});

test("a column read differently since the preview was taken shows nothing until the extraction runs", () => {
  const draft = setExtractionFieldKind(extractionDraftFromProposal(proposalFixture(), "Products"), "detail", "text");
  assert.deepEqual(extractionPreviewColumns(draft).map((column) => column.sourceKey), ["name", "price", "sku"]);
  assert.equal(JSON.stringify(retainExtractionPreview(rowsWithCard(), draft)).includes("example.test"), false);
});

test("a missing value stays a missing value rather than becoming an empty string", () => {
  const draft = extractionDraftFromProposal(proposalFixture(), "Products");
  const kept = retainExtractionPreview(rowsWithCard(), draft);
  assert.equal(kept[1]?.detail, null);
});
