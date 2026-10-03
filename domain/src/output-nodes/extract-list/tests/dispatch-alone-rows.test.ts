// A Flow's list read asks the page for the rows each condition removed by
// itself, so the judge of the playback can check them against the instruction.
// Live run 15 (`run-muqj2bgb-d048ec37`): the accessory rule removed by itself
// three earbuds sold "with Wireless Charging Case", and the judge was told only
// how many.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_ALONE_ONLY, WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_KEY } from "../../../actions/extraction";
import { webAutomationExtractListAloneRowsAsked, webAutomationExtractListDispatch } from "../dispatch";

const filtered = { item: "li.product", fields: { name: ".name" }, where: [{ field: "name", contains: ["charging case"], not: true }] };

function parametersOf(nodeParameters: JsonObject): JsonObject {
  const dispatch = webAutomationExtractListDispatch(nodeParameters);
  assert.equal(dispatch.ok, true, JSON.stringify(dispatch));
  return dispatch.ok ? dispatch.payload.parameters as JsonObject : {};
}

test("a read with conditions is sent asking for the rows each removed by itself, and only those", () => {
  assert.equal(WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_ALONE_ONLY, "alone");
  const node = { extractList: filtered };
  assert.equal(parametersOf(node)[WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_KEY], "alone");
  // The Flow's own parameters are not changed: the request is the dispatch's.
  assert.equal(Object.hasOwn(node, WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_KEY), false);
});

test("a read with no conditions, or one that does not parse, asks for none", () => {
  for (const extractList of [{ item: "li.product", fields: { name: ".name" } }, { ...filtered, where: [] }, "not a read"]) {
    assert.equal(Object.hasOwn(parametersOf({ extractList } as JsonObject), WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_KEY), false, JSON.stringify(extractList));
  }
});

test("a node whose parameters already say is sent as they say", () => {
  assert.equal(parametersOf({ extractList: filtered, rejectedSamples: true })[WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_KEY], true);
});

// t194 w55: the draft's replay asks the same way, for the judge of the build's test.
test("the replay's ask is the dispatch's: a read with conditions asks for its alone rows, any other parameters are left as they are", () => {
  const node = { extractList: filtered };
  assert.equal(webAutomationExtractListAloneRowsAsked(node)[WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_KEY], "alone");
  assert.equal(Object.hasOwn(node, WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_KEY), false);
  assert.equal(webAutomationExtractListAloneRowsAsked({ extractList: filtered, rejectedSamples: false })[WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_KEY], false);
  const unfiltered = { extractList: { item: "li.product", fields: { name: ".name" } } };
  assert.deepEqual(webAutomationExtractListAloneRowsAsked(unfiltered), unfiltered);
});
