// A list extraction's timeout is the dispatch's own as well as the page's.
//
// Core waits for a command as long as its dispatch payload's `timeoutMs` says,
// plus its answer margin, and 30 s for one that says nothing. The node's scaled
// timeout -- ten seconds a page -- used to travel in `parameters` alone, so a
// paced read of more pages than fit in thirty seconds was abandoned by Core
// while the page was still reading it, and every row it had read was lost.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS } from "../../../actions/extraction";
import { webAutomationExtractListDispatch } from "../dispatch";

const extractList = { item: "li.product", fields: { name: ".name" } };
const paged = { ...extractList, paginate: { mode: "next", next: "a.next", maxPages: 5 } };

function payloadOf(parameters: JsonObject): JsonObject {
  const dispatch = webAutomationExtractListDispatch(parameters);
  assert.equal(dispatch.ok, true, JSON.stringify(dispatch));
  return dispatch.ok ? dispatch.payload : {};
}

test("a paginated read left at the default is given, and Core waits, a timeout per page it may read", () => {
  for (const parameters of [{ extractList: paged }, { extractList: paged, timeoutMs: WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS }]) {
    const payload = payloadOf(parameters);
    assert.equal((payload.parameters as JsonObject).timeoutMs, 50_000);
    // Beyond Core's 30 s default, which is what a paced five-page read with each page revealed can reach.
    assert.equal(payload.timeoutMs, 50_000);
  }
});

test("the scaled timeout is bounded as the pages are, at fifty", () => {
  const payload = payloadOf({ extractList: { ...paged, paginate: { mode: "next", next: "a.next", maxPages: 500 } } });
  assert.equal(payload.timeoutMs, 50 * WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS);
});

test("an authored timeout is the dispatch's own too, and a read of one page keeps the per-page default", () => {
  assert.equal(payloadOf({ extractList: paged, timeoutMs: 12_000 }).timeoutMs, 12_000);
  assert.equal(payloadOf({ extractList }).timeoutMs, WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS);
});

test("a timeout that is not a positive number is not sent as the dispatch's, so Core keeps its own wait", () => {
  for (const timeoutMs of [0, -1, "soon"]) {
    const payload = payloadOf({ extractList: paged, timeoutMs });
    assert.equal("timeoutMs" in payload, false, String(timeoutMs));
  }
});

test("a timeout travels with the record output the read is saved into", () => {
  const recordOutput = {
    datasetId: "catalog",
    label: "Catalog",
    writeMode: "replace",
    schema: { schemaVersion: "0.1", fields: [{ id: "name", label: "Name", valueType: "string", required: true }] }
  };
  const payload = payloadOf({ extractList: paged, recordOutput });
  assert.equal(payload.timeoutMs, 50_000);
  assert.equal((payload.recordOutput as JsonObject).datasetId, "catalog");
});
