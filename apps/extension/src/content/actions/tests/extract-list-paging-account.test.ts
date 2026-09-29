// T1 coverage of why a paginated read stopped paging, as the extract-list verb
// reports it: the closed word rides on the summary as `paginationStop`, survives
// the domain's wire copy, and is said in the result's `actual`, which is what
// the model reading one result reads. A read that did not page says nothing new.
//
// Live run `run-mulwm2dc-0bd95f22` stopped on page one of fifty and its account
// said only `pagesRead: 1, truncated: false`. Real pages are
// `e2e/content/tests/extraction/tests/pagination-stop.spec.ts` and
// `job-board-listing.spec.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationActionResultPayload } from "@fluxiq-web-extension/domain/client";
import { extractListAction } from "../extract-list";
import type { ActionResultEvidence } from "../../action-runtime";
import type { ListExtractionOutcome } from "../../extraction";
import type { ContentActionDependencies } from "../types";
import type { BrowserActionCommand, BrowserActionResult, BrowserActionValidation } from "../../types";

const COMMAND: BrowserActionCommand = {
  commandId: "cmd-paging-account",
  actionType: "web.dom.extract_list",
  extractList: { item: ".row", fields: { title: ".title" }, paginate: { next: ".next", maxPages: 50 }, minItems: 0 }
};

type Seen = { validation: BrowserActionValidation; evidence: ActionResultEvidence | undefined };

async function run(outcome: ListExtractionOutcome): Promise<Seen> {
  let seen: Seen | undefined;
  const built = (status: BrowserActionResult["status"]): BrowserActionResult => ({
    commandId: COMMAND.commandId,
    actionType: COMMAND.actionType,
    status,
    validation: { status: "none", reason: "evidence-only" },
    startedAt: 1,
    finishedAt: 2
  });
  const deps = {
    extractList: async () => outcome,
    captureSnapshot: () => ({ url: "https://example.test/", title: "Example", viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 }, interactiveElements: [] }),
    success: (_action: unknown, _startedAt: unknown, _message: unknown, validation: BrowserActionValidation, evidence: ActionResultEvidence | undefined) => {
      seen = { validation, evidence };
      return built("succeeded");
    },
    timedOut: (_action: unknown, _startedAt: unknown, _message: unknown, validation: BrowserActionValidation, evidence: ActionResultEvidence | undefined) => {
      seen = { validation, evidence };
      return built("timed_out");
    },
    failure: () => built("failed")
  } as unknown as ContentActionDependencies;
  await extractListAction(COMMAND, deps, 0);
  if (!seen) throw new Error("the verb built no result");
  return seen;
}

function outcome(extra: Partial<ListExtractionOutcome>): ListExtractionOutcome {
  return {
    records: [{ title: "Senior Rust Engineer" }, { title: "Settlement Systems Engineer" }],
    pagesRead: 1,
    truncated: false,
    timedOut: false,
    missingFields: [],
    filtered: 0,
    ...extra
  };
}

function actual(seen: Seen): string {
  const validation = seen.validation as { actual?: string };
  return validation.actual ?? "";
}

test("the page ignoring its Next is on the summary as list_unchanged, and said in the result", async () => {
  const seen = await run(outcome({ pageFault: true, paginationStop: "list_unchanged" }));
  const summary = (seen.evidence as { extraction?: unknown } | undefined)?.extraction;
  assert.equal((summary as { paginationStop?: string }).paginationStop, "list_unchanged");
  // It survives the domain's field-by-field wire copy, which drops anything undeclared.
  const wire = webAutomationActionResultPayload({
    commandId: COMMAND.commandId,
    actionType: COMMAND.actionType,
    status: "succeeded",
    validation: seen.validation,
    extraction: summary as NonNullable<BrowserActionResult["extraction"]>,
    startedAt: 1,
    finishedAt: 2
  });
  assert.equal((wire.extraction as { paginationStop?: string } | undefined)?.paginationStop, "list_unchanged");
  assert.match(actual(seen), /paging stopped because the page ignored its pagination control/u);
});

test("a control that named nothing on page one is said as a selector to check, not as the list ending", async () => {
  const seen = await run(outcome({ paginationStop: "control_absent" }));
  assert.match(actual(seen), /paging stopped on the first page because the pagination control named nothing there -- check the control's selector/u);
  // Past page one the same word is the list ending as lists end: on the summary, not in the phrase.
  const later = await run(outcome({ pagesRead: 3, paginationStop: "control_absent" }));
  assert.doesNotMatch(actual(later), /paging stopped/u);
  assert.equal((later.evidence as { extraction?: { paginationStop?: string } }).extraction?.paginationStop, "control_absent");
});

test("every stop a Flow can act on has a phrase, the ordinary endings have none, and a read that did not page says nothing new", async () => {
  const said = ["list_vanished", "page_limit", "item_limit", "list_unchanged", "page_repeated", "control_not_clickable", "page_fault"] as const;
  for (const word of said) {
    const seen = await run(outcome({ pagesRead: 2, paginationStop: word }));
    assert.match(actual(seen), /; paging stopped because \S/u, word);
    assert.doesNotMatch(actual(seen), /undefined/u, word);
  }
  for (const word of ["control_absent", "control_disabled", "no_following_page", "scrolled_to_end", "deadline"] as const) {
    const seen = await run(outcome({ pagesRead: 2, paginationStop: word }));
    assert.doesNotMatch(actual(seen), /paging stopped/u, word);
    assert.equal((seen.evidence as { extraction?: { paginationStop?: string } }).extraction?.paginationStop, word);
  }
  const unpaged = await run(outcome({}));
  assert.doesNotMatch(actual(unpaged), /paging stopped/u);
  assert.equal((unpaged.evidence as { extraction?: { paginationStop?: string } }).extraction?.paginationStop, undefined);
});
