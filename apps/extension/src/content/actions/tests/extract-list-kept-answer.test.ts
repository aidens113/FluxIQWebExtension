// T1 coverage of the minimum a read that answers what it kept is held to (S5,
// contract C3).
//
// A Flow's read reads one page. The domain sends `answer: "kept"` on Flow and
// replay reads, and there `minItems` counts the items the page showed -- the
// list is there -- rather than the rows kept, so a page whose items all fail
// the conditions is a clean read of nothing to keep, while a page that showed
// no item still fails. An exploration read names no rule and keeps today's
// minimum on rows. Which rows such a read answers is
// `content/extraction/tests/filtered-answer.test.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { extractListAction } from "../extract-list";
import type { ListExtractionOutcome } from "../../extraction";
import type { ContentActionDependencies } from "../types";
import type { BrowserActionCommand, BrowserActionResult, BrowserActionValidation, WebAutomationExtractListRequest } from "../../types";

const REQUEST: WebAutomationExtractListRequest = { item: ".row", fields: { name: ".name" }, where: [{ field: "name", contains: ["lamp"] }] };
const COMMAND: BrowserActionCommand = { commandId: "cmd-kept-answer", actionType: "web.dom.extract_list", extractList: REQUEST };

/** The validation the verb built for `outcome`, through the success builder only. */
async function validationOf(command: BrowserActionCommand, outcome: ListExtractionOutcome): Promise<BrowserActionValidation> {
  let seen: BrowserActionValidation | undefined;
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
    success: (_action: unknown, _startedAt: unknown, _message: unknown, validation: BrowserActionValidation) => {
      seen = validation;
      return built("succeeded");
    },
    timedOut: () => built("timed_out"),
    failure: () => built("failed")
  } as unknown as ContentActionDependencies;
  await extractListAction(command, deps, 0);
  if (!seen) throw new Error("the verb built no successful result");
  return seen;
}

/** A one-page read whose conditions kept none of the `itemsSeen` items the page showed. */
function keptNone(itemsSeen: number): ListExtractionOutcome {
  return {
    records: [],
    pagesRead: 1,
    truncated: false,
    timedOut: false,
    listPresence: itemsSeen > 0 ? "appeared" : "never_appeared",
    itemsSeen,
    missingFields: [],
    filtered: itemsSeen,
    conditions: { applied: itemsSeen, kept: 0, rejected: [itemsSeen], unfiltered: false }
  };
}

const flowRead = (over: Partial<WebAutomationExtractListRequest> = {}): BrowserActionCommand => ({ ...COMMAND, extractList: { ...REQUEST, answer: "kept", ...over } });

test("a read that answers what it kept succeeds with no rows when the page showed items, and fails when it showed none", async () => {
  const passed = await validationOf(flowRead(), keptNone(3));
  assert.equal(passed.status, "passed");
  assert.match(passed.status === "passed" ? passed.expected : "", /at least 1 item on the page/u);

  const failed = await validationOf(flowRead(), keptNone(0));
  assert.equal(failed.status, "failed");
  assert.match(failed.status === "failed" ? failed.actual : "", /fewer than the 1 item required on the page/u);
});

test("the minimum on a kept read counts items, so it fails below a stated minimum and passes an allowed empty page", async () => {
  assert.equal((await validationOf(flowRead({ minItems: 4 }), keptNone(3))).status, "failed");
  assert.equal((await validationOf(flowRead({ minItems: 3 }), keptNone(3))).status, "passed");
  assert.equal((await validationOf(flowRead({ minItems: 0 }), keptNone(0))).status, "passed");
});

test("an exploration read, which names no answer rule, keeps the minimum on rows", async () => {
  const validation = await validationOf(COMMAND, keptNone(3));
  assert.equal(validation.status, "failed");
  assert.match(validation.status === "failed" ? validation.actual : "", /fewer than the 1 required/u);
});
