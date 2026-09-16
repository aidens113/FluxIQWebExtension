// What the confirm message carries, and what it must never carry.
//
// The last row is the one worth keeping: it holds preview rows beside the draft,
// builds the payload, and searches the serialized message for a value only those
// rows hold. It fails the moment anybody "helpfully" threads a sample of the
// page into the recorded definition, which is the shape D12 forbids and the
// shape a type check cannot see.

import assert from "node:assert/strict";
import test from "node:test";
import { extractionConfirmPayload } from "../confirm-payload";
import type { ExtractionPreviewRow } from "../messages";
import {
  extractionDraftFromProposal,
  renameExtractionField,
  setExtractionFieldHandling,
  setExtractionFieldKind,
  setExtractionPaginate
} from "../view-model";
import { PLANTED_VALUE, proposalFixture } from "./proposal-fixture";

function payloadField(request: ReturnType<typeof extractionConfirmPayload>, key: string) {
  const found = request.fields.find((field) => field.key === key);
  assert.ok(found, `expected a field keyed ${key}`);
  return found;
}

test("record keys are derived from the labels the user settled on", () => {
  const draft = renameExtractionField(extractionDraftFromProposal(proposalFixture(), "Products"), "name", "Product name");
  const request = extractionConfirmPayload(draft);
  assert.deepEqual(request.fields.map((field) => field.key), ["product_name", "detail", "price", "sku", "card_number"]);
  assert.equal(payloadField(request, "product_name").label, "Product name");
});

test("two columns renamed the same way still get distinct keys", () => {
  let draft = extractionDraftFromProposal(proposalFixture(), "Products");
  draft = renameExtractionField(draft, "name", "Price");
  draft = renameExtractionField(draft, "price", "Price");
  const keys = extractionConfirmPayload(draft).fields.map((field) => field.key);
  assert.deepEqual(keys, ["price", "detail", "price_2", "sku", "card_number"]);
  assert.equal(new Set(keys).size, keys.length);
});

test("an excluded column is sent, marked excluded, so detection does not propose it again", () => {
  const request = extractionConfirmPayload(extractionDraftFromProposal(proposalFixture(), "Products"));
  assert.equal(payloadField(request, "card_number").handling, "exclude");
  assert.equal(payloadField(request, "name").handling, "include");
});

test("attribute and header are written only under the kind that reads them", () => {
  let draft = extractionDraftFromProposal(proposalFixture(), "Products");
  draft = setExtractionFieldKind(draft, "price", "text");
  draft = setExtractionFieldKind(draft, "sku", "text");
  const request = extractionConfirmPayload(draft);
  assert.equal(payloadField(request, "price").header, undefined);
  assert.equal(payloadField(request, "sku").attribute, undefined);

  const untouched = extractionConfirmPayload(extractionDraftFromProposal(proposalFixture(), "Products"));
  assert.equal(payloadField(untouched, "price").header, "Price");
  assert.equal(payloadField(untouched, "sku").attribute, "data-sku");
});

test("following pages is sent only when the user asked for it", () => {
  const opened = extractionDraftFromProposal(proposalFixture(), "Products");
  assert.equal(extractionConfirmPayload(opened).paginate, undefined);
  assert.deepEqual(extractionConfirmPayload(setExtractionPaginate(opened, true)).paginate, { next: "a.next", maxPages: 5 });
});

test("no value read from the page reaches the confirm message", () => {
  const draft = setExtractionFieldHandling(extractionDraftFromProposal(proposalFixture(), "Products"), "card", "include");
  const rows: ExtractionPreviewRow[] = [{ name: "Anvil", card: PLANTED_VALUE }];
  const serialized = JSON.stringify(extractionConfirmPayload(draft));
  assert.equal(serialized.includes(PLANTED_VALUE), false);
  assert.equal(serialized.includes("Anvil"), false);
  assert.equal(rows.length, 1, "the rows exist beside the draft and are simply never given to the payload");
});
