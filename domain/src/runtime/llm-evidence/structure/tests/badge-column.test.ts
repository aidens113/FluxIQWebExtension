// An icon badge's column reaches the model as every detected column does, under
// its constant accessible name, and a presence condition on its key is a
// condition the page runs.
//
// The page half -- that detection offers the badge at all, labelled by its name
// only when every item that has it names it the same -- is proven in
// `apps/extension/src/content/extraction/tests/badge-column.test.ts`. This is the
// domain half: the wire reader keeps the column, the packet shows its key, label,
// kind and coverage and not its selector, the handle keeps the attribute read as
// optional, and `where {field: "brightaisle_plus", is: "present"}` survives the
// request reader and holds exactly where the badge's name was read.

import assert from "node:assert/strict";
import test from "node:test";
import {
  webAutomationExtractConditionHolds,
  webAutomationExtractListRequestValue
} from "../../../../actions/extraction";
import { webAutomationStructureDetectionValue } from "../../../../extraction";
import { splitDetectedStructure } from "../packet";

const BADGE_SELECTOR = ":scope > div.body > div.dlv > i.plus";

/** What the content script answers for the everything store's results with the badge detected: 3 of 5 cards carry it. */
const DETECTION = {
  ok: true,
  proposal: {
    container: "div.results",
    item: "div.card",
    itemCount: 5,
    fields: [
      { key: "div_body_h2_ttl_a_tl_span", label: "div.body > h2.ttl > a.tl > span", spec: { kind: "text", selector: ":scope > div.body > h2.ttl > a.tl > span", required: true }, coverage: 1 },
      { key: "brightaisle_plus", label: "Brightaisle Plus", spec: { kind: "attribute", selector: BADGE_SELECTOR, attribute: "aria-label", required: false }, coverage: 0.6 }
    ],
    confidence: 0.8
  }
};

function split() {
  const detection = webAutomationStructureDetectionValue(structuredClone(DETECTION));
  assert.ok(detection?.ok, "the wire reader accepts the detection");
  const result = splitDetectedStructure({ detection, handle: "extraction.1", location: "https://store.test/s", target: undefined, frameId: undefined });
  assert.ok(result, "a readable column is left");
  return result;
}

test("the badge column reaches the model under its name and key, with no selector, and the handle reads it as an optional attribute", () => {
  const { packet, binding } = split();
  assert.deepEqual(packet.fields[1], { key: "brightaisle_plus", label: "Brightaisle Plus", kind: "attribute", coverage: 0.6 });
  assert.equal(JSON.stringify(packet).includes("i.plus"), false, "the packet quotes no selector");
  assert.equal(JSON.stringify(packet).includes("aria-label"), false, "nor the attribute read");
  assert.deepEqual(binding.extractList.fields.brightaisle_plus, { kind: "attribute", selector: BADGE_SELECTOR, attribute: "aria-label", required: false });
});

test("a presence condition on the badge's key survives the request reader and holds only where the badge was read", () => {
  const { binding } = split();
  const request = webAutomationExtractListRequestValue({ ...binding.extractList, where: [{ field: "brightaisle_plus", is: "present" }] });
  assert.ok(request, "the request reader accepts the handle's request with the condition");
  const [condition] = request.where ?? [];
  assert.deepEqual(condition, { field: "brightaisle_plus", is: "present" });
  // A badged card's record carries the name; an unbadged card's carries null,
  // which the page hands the condition as `undefined` (`item-filter.ts`).
  assert.equal(webAutomationExtractConditionHolds(condition!, "Brightaisle Plus"), true);
  assert.equal(webAutomationExtractConditionHolds(condition!, undefined), false);
});
