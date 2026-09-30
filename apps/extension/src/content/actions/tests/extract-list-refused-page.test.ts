// T1 coverage of how the extract-list verb reports a read that met a page the
// server refused mid-pagination: truncated on the summary the domain and Core
// read, the stop named, and said in the result's `actual`, which is what the
// model and the judge reading one result read. A refusal the read waited out is
// still said, as a recovery.
//
// Live run `run-munnhi5q-4867dabe` stopped on the everything store's 429 page
// and reported `truncated: false`, so a read missing eight of thirteen records
// looked complete. The read itself is `extraction/tests/list-reader-refused-page.test.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationActionResultPayload } from "@fluxiq-web-extension/domain/client";
import { extractListAction } from "../extract-list";
import type { ActionResultEvidence } from "../../action-runtime";
import type { ListExtractionOutcome } from "../../extraction";
import type { ContentActionDependencies } from "../types";
import type { BrowserActionCommand, BrowserActionResult, BrowserActionValidation } from "../../types";

const COMMAND: BrowserActionCommand = {
  commandId: "cmd-refused-page",
  actionType: "web.dom.extract_list",
  extractList: { item: ".row", fields: { title: ".title" }, paginate: { next: ".next", maxPages: 10 } }
};

type Seen = { validation: BrowserActionValidation; summary: NonNullable<BrowserActionResult["extraction"]> };

async function run(outcome: ListExtractionOutcome): Promise<Seen> {
  let seen: Seen | undefined;
  const built = (): BrowserActionResult => ({
    commandId: COMMAND.commandId,
    actionType: COMMAND.actionType,
    status: "succeeded",
    validation: { status: "none", reason: "evidence-only" },
    startedAt: 1,
    finishedAt: 2
  });
  const deps = {
    extractList: async () => outcome,
    captureSnapshot: () => ({ url: "https://example.test/", title: "Example", viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 }, interactiveElements: [] }),
    success: (_action: unknown, _startedAt: unknown, _message: unknown, validation: BrowserActionValidation, evidence: ActionResultEvidence | undefined) => {
      seen = { validation, summary: (evidence as { extraction: Seen["summary"] }).extraction };
      return built();
    },
    timedOut: () => assert.fail("the read did not time out"),
    failure: () => assert.fail("the read did not fail")
  } as unknown as ContentActionDependencies;
  await extractListAction(COMMAND, deps, 0);
  if (!seen) throw new Error("the verb built no result");
  return seen;
}

/** Eight records from four pages, as the store's read had before its fifth advance. */
function outcome(extra: Partial<ListExtractionOutcome>): ListExtractionOutcome {
  return {
    records: Array.from({ length: 8 }, (_, index) => ({ title: `T${index}` })),
    pagesRead: 4,
    truncated: false,
    timedOut: false,
    missingFields: [],
    filtered: 0,
    ...extra
  };
}

const actual = (seen: Seen): string => (seen.validation as { actual?: string }).actual ?? "";

/** The summary as it crosses the wire, through the domain's field-by-field copy. */
function wire(seen: Seen): Record<string, unknown> | undefined {
  const payload = webAutomationActionResultPayload({
    commandId: COMMAND.commandId,
    actionType: COMMAND.actionType,
    status: "succeeded",
    validation: seen.validation,
    extraction: seen.summary,
    startedAt: 1,
    finishedAt: 2
  });
  return payload.extraction as Record<string, unknown> | undefined;
}

test("a read the server kept refusing is truncated on the wire, its stop named, and said as incomplete", async () => {
  const seen = await run(outcome({ truncated: true, paginationStop: "list_vanished", refusedStatus: 429, pageRetries: 1 }));
  assert.equal(seen.summary.truncated, true);
  const crossed = wire(seen);
  assert.equal(crossed?.truncated, true, "the summary arrives whole, so Core's judge sees an incomplete read");
  assert.equal(crossed?.paginationStop, "list_vanished");
  assert.equal(crossed?.recordCount, 8, "the records already read are kept");
  assert.match(actual(seen), /8 records from 4 pages, truncated/u);
  assert.match(actual(seen), /paging stopped because the server refused the next page \(HTTP 429, too many requests\) and went on refusing after the read waited and reloaded it \(1 time\) -- the list goes on past these records, so the read is incomplete/u);
});

test("a 503 is said as the server being unavailable, and a refusal the read could not wait out without the retry clause", async () => {
  const seen = await run(outcome({ truncated: true, paginationStop: "list_vanished", refusedStatus: 503 }));
  assert.match(actual(seen), /refused the next page \(HTTP 503, unavailable\) -- the list goes on/u);
  assert.doesNotMatch(actual(seen), /reloaded/u);
});

test("a refusal the read waited out is said as a recovery, and a lost list without a status is said as incomplete", async () => {
  const recovered = await run(outcome({ records: Array.from({ length: 10 }, (_, index) => ({ title: `T${index}` })), pagesRead: 5, paginationStop: "control_absent", pageRetries: 1 }));
  assert.equal(recovered.summary.truncated, false);
  assert.match(actual(recovered), /the server refused a page and the read waited and reloaded it \(1 time\) and went on/u);
  assert.doesNotMatch(actual(recovered), /paging stopped/u);
  const lost = await run(outcome({ truncated: true, paginationStop: "list_vanished" }));
  assert.match(actual(lost), /paging stopped because the page the control led to showed none of the list .* so the read is incomplete/u);
});
