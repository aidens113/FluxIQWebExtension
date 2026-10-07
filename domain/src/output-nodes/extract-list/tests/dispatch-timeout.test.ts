// A list extraction's timeout is the dispatch's own as well as the page's.
//
// Core waits for a command as long as its dispatch payload's `timeoutMs` says,
// plus its answer margin, and 30 s for one that says nothing. The node's
// timeout used to travel in `parameters` alone, so a long read was abandoned by
// Core while the page was still reading it, and every row it had read was lost.
//
// Since read-list redesign S4 a read reads one page, so the node's default is
// the page's own wait and is never scaled by pages; a read that pages by itself
// is refused before it runs (`one-page-read.test.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS } from "../../../actions/extraction";
import { webAutomationExtractListDispatch } from "../dispatch";

const extractList = { item: "li.product", fields: { name: ".name" } };
const onePage = { ...extractList, paginate: { mode: "next", next: "a.next", maxPages: 1 } };

function payloadOf(parameters: JsonObject): JsonObject {
  const dispatch = webAutomationExtractListDispatch(parameters);
  assert.equal(dispatch.ok, true, JSON.stringify(dispatch));
  return dispatch.ok ? dispatch.payload : {};
}

test("a read left at the default is given, and Core waits, the page's own wait", () => {
  for (const parameters of [{ extractList }, { extractList: onePage }, { extractList: onePage, timeoutMs: WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS }]) {
    const payload = payloadOf(parameters);
    assert.equal((payload.parameters as JsonObject).timeoutMs, WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS);
    assert.equal(payload.timeoutMs, WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS);
  }
});

test("an authored timeout is the dispatch's own too", () => {
  assert.equal(payloadOf({ extractList: onePage, timeoutMs: 12_000 }).timeoutMs, 12_000);
  assert.equal(payloadOf({ extractList, timeoutMs: 50_000 }).timeoutMs, 50_000);
});

test("a timeout that is not a positive number is not sent as the dispatch's, so Core keeps its own wait", () => {
  for (const timeoutMs of [0, -1, "soon"]) {
    const payload = payloadOf({ extractList: onePage, timeoutMs });
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
  const payload = payloadOf({ extractList: onePage, recordOutput });
  assert.equal(payload.timeoutMs, WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS);
  assert.equal((payload.recordOutput as JsonObject).datasetId, "catalog");
});
