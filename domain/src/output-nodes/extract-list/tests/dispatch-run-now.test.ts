// A read with conditions is sent with the run's start as its `now`, so the page
// judges a relative date at the instant Core judges it at run end (t800 F1).

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationExtractListRequestValue } from "../../../actions/extraction";
import { webAutomationExtractListDispatch } from "../dispatch";

const RUN_START = Date.UTC(2026, 9, 6, 12);
const dated = { item: "li.event", fields: { when: ".when" }, where: [{ field: "when", within: "7 days" }] };

function sentList(nodeParameters: JsonObject, runStartedAt?: number): JsonObject {
  const dispatch = webAutomationExtractListDispatch(nodeParameters, runStartedAt);
  assert.equal(dispatch.ok, true, JSON.stringify(dispatch));
  return dispatch.ok ? (dispatch.payload.parameters as JsonObject).extractList as JsonObject : {};
}

test("the run's start is sent as now, and the content's reader keeps it", () => {
  const list = sentList({ extractList: dated }, RUN_START);
  assert.equal(list.now, RUN_START);
  assert.equal(webAutomationExtractListRequestValue(list)?.now, RUN_START);
});

test("no run start, a read with no condition, a now of its own, or a start that is no instant sends none of its own", () => {
  assert.equal(Object.hasOwn(sentList({ extractList: dated }), "now"), false);
  assert.equal(Object.hasOwn(sentList({ extractList: { item: "li.event", fields: { when: ".when" } } }, RUN_START), "now"), false);
  assert.equal(sentList({ extractList: { ...dated, now: 5 } }, RUN_START).now, 5);
  for (const bad of [-1, 1.5, Number.NaN, 8.64e15 + 1]) assert.equal(Object.hasOwn(sentList({ extractList: dated }, bad), "now"), false, String(bad));
});

test("sort-only reads receive the execution reference, including the maximum valid epoch", () => {
  const sortOnly = { item: "li.event", fields: { when: ".when" }, sort: [{ field: "when", as: "date", order: "asc" }] };
  assert.equal(sentList({ extractList: sortOnly }, RUN_START).now, RUN_START);
  assert.equal(sentList({ extractList: dated }, 8.64e15).now, 8.64e15);
});

test("a now that is no instant is left out of the read request, which then uses the page's clock", () => {
  assert.equal(webAutomationExtractListRequestValue({ ...dated, now: "yesterday" })?.now, undefined);
});
