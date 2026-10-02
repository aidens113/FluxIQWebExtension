// A replayed list read is compared by the read's own account, not by the
// longest array its payload happens to carry.
//
// A live `extract_list` payload always carries other lists -- the column names,
// the per-condition rejections, the snapshot's controls -- so the longest one
// was never 0. t227's run (`run-muq310ht-ab80eed0`) replayed a read on a "No
// results" page and the dry run said `replayed`; run 11's duplicate read
// (`run-muq4oaof-464f5bce`) passed the dry run answering with rows every
// condition had rejected (t194-d227).

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../..";
import { webNodeReplayStatement } from "../replay";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const EXTRACT = "web.output.dom-extract_list";
const START = "https://example.test/start";
const PERMITTED = async () => ({ permitted: true as const });
const READ = { extractList: { item: ".card", fields: { name: { selector: ".name" } }, minItems: 0 } };

test("a list read's replay statement records the read's own counts, not the longest list in its payload", () => {
  const empty = webNodeReplayStatement({ location: START, payload: liveRead({ recordCount: 0, itemsSeen: 0 }), reads: true });
  assert.deepEqual(empty.produced, { records: 0, itemsSeen: 0 });
  const filtered = webNodeReplayStatement({ location: START, payload: liveRead({ recordCount: 10, itemsSeen: 94, unfiltered: false }), reads: true });
  assert.deepEqual(filtered.produced, { records: 10, itemsSeen: 94, unfiltered: false });
  // Any other payload is counted as it always was: the longest list it carries.
  assert.deepEqual(webNodeReplayStatement({ location: START, payload: { extracted: [1, 2, 3], other: [1] }, reads: true }).produced, { records: 3 });
});

test("a read that read rows and now reads none on a live-shaped payload has changed", async () => {
  const replayed = await replay(liveRead({ recordCount: 0, itemsSeen: 0 }), { records: 12, itemsSeen: 94 });
  assert.equal(replayed.resultCode, "core.replay.changed");
});

test("a read whose list was there and now is not has changed, even where its conditions kept no row", async () => {
  const replayed = await replay(liveRead({ recordCount: 0, itemsSeen: 0 }), { records: 0, itemsSeen: 11 });
  assert.equal(replayed.resultCode, "core.replay.changed");
});

test("a read whose conditions kept rows and now answer unfiltered has changed; the same read again has not", async () => {
  const unfiltered = await replay(liveRead({ recordCount: 11, itemsSeen: 11, unfiltered: true }), { records: 10, itemsSeen: 94, unfiltered: false });
  assert.equal(unfiltered.resultCode, "core.replay.changed");

  // Fewer rows, or a read that was unfiltered when the build ran it too, is the page and not the step.
  const fewer = await replay(liveRead({ recordCount: 4, itemsSeen: 40, unfiltered: false }), { records: 10, itemsSeen: 94, unfiltered: false });
  assert.equal(fewer.resultCode, "core.replay.replayed");
  const alreadyUnfiltered = await replay(liveRead({ recordCount: 11, itemsSeen: 11, unfiltered: true }), { records: 11, itemsSeen: 11, unfiltered: true });
  assert.equal(alreadyUnfiltered.resultCode, "core.replay.replayed");
});

// Run 15 (`run-muqj2bgb-d048ec37`): the judge of the build's test was told of
// this read only "the step ran again", was unsure, and then said the pagination
// never resolved. The replay now states the read's own account.
test("a replayed list read says what it read: rows kept, pages and why it stopped, items seen, and each condition's rejections", async () => {
  const where = [
    { field: "ad", is: "absent" },
    { field: "plus", is: "present" },
    { field: "rating", atLeast: 4 },
    { field: "price", lessThan: 50 },
    { field: "name", contains: ["ear tips", "charging case"], not: true }
  ];
  const payload = liveRead({ recordCount: 10, itemsSeen: 94, unfiltered: false });
  const extraction = payload.extraction as JsonObject;
  Object.assign(extraction, { pagesRead: 5, paginationStop: "control_disabled" });
  extraction.conditions = { applied: 94, kept: 12, rejected: [20, 37, 34, 40, 20], unfiltered: false, alone: [4, 6, 12, 3, 5] };
  const replayed = await replay(payload, { records: 10, itemsSeen: 94, unfiltered: false }, { extractList: { ...READ.extractList, where } });
  assert.equal(replayed.resultCode, "core.replay.replayed");
  assert.equal(
    (replayed.evidence as JsonObject).said,
    "the step ran again: kept 10 rows from 5 pages, stopped on control_disabled; 94 items seen; per condition rejected (removed alone): ad 20 (4), plus 37 (6), rating 34 (12), price 40 (3), name 20 (5)"
  );

  // A request that does not line up with the report names its conditions by position.
  const unaligned = await replay(payload, { records: 10, itemsSeen: 94, unfiltered: false });
  assert.match(String((unaligned.evidence as JsonObject).said), /per condition rejected \(removed alone\): condition 1 20 \(4\), condition 2 37 \(6\)/u);
});

test("a replayed step whose payload carries no read account still says only that it ran", async () => {
  const replayed = await replay({ clicked: true }, {});
  assert.equal(replayed.resultCode, "core.replay.replayed");
  assert.equal((replayed.evidence as JsonObject).said, "the step ran again");
});

/** Replay the read once against a page that answers with `payload`, as the build recorded `produced`. */
async function replay(payload: JsonObject, produced: JsonObject, parameters: JsonObject = READ) {
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: page() } };
      return { status: "succeeded", payload };
    }
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  return await runtime.executeTool({
    ...PROJECT, callId: "dryrun.1.19", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: EXTRACT, parameters, consequences: [], produced }
  });
}

/**
 * A list read's payload as the extension sends it: the rows, the read's account
 * with its column names and per-condition rejections, and the page's snapshot,
 * whose controls outnumber the rows of any read here.
 */
function liveRead(account: { recordCount: number; itemsSeen: number; unfiltered?: boolean }): JsonObject {
  const rows = Array.from({ length: account.recordCount }, (_, index) => ({ name: `Row ${index}` }));
  const extraction: JsonObject = {
    recordCount: account.recordCount,
    pagesRead: 1,
    itemsSeen: account.itemsSeen,
    truncated: false,
    fieldNames: ["name", "price", "rating", "url", "plus", "ad"],
    missingFields: []
  };
  if (account.unfiltered !== undefined) {
    extraction.conditions = { applied: account.itemsSeen, kept: account.unfiltered ? 0 : account.recordCount, rejected: [4, 5, 4, 7, 3], unfiltered: account.unfiltered };
  }
  const snapshot = page();
  snapshot.interactiveElements = Array.from({ length: 40 }, (_, index) => ({ tagName: "a", selector: `#link-${index}`, visibleText: `Link ${index}` }));
  return { extracted: rows, extraction, snapshot };
}

function page(): JsonObject {
  return {
    url: START,
    title: "Fixture",
    viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 },
    interactiveElements: [{ tagName: "button", selector: "#go", visibleText: "Go" }]
  };
}
