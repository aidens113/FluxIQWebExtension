// A look that meets a robot check answers as an action that meets one does.
//
// A navigation or a press that lands on a check has the check judged by the
// worker (`../navigation/landing.ts`, `../click-landing.ts`): one that clears by
// itself is waited out in place, and one still standing fails
// USER_INTERVENTION_REQUIRED, which the domain turns into `personNeeded` and
// Core puts to the person, pausing the attempt where it is. A look did none of
// that. The content script captures whatever the page is, so a look taken of a
// check was an ordinary page: in `run-mwaknxf9-7549d126` (t885) a sort's reply
// came back from the old document, the look after it captured bigbox's "Robot
// or human?" page, and the model, shown that page, stopped on a check that
// lifted by itself seconds later.
//
// So a whole-tab look that carries `checkWaitMs` -- the allowance the domain
// gives the looks a build or a Flow takes (`domain/src/actions/check-wait.ts`)
// -- has the page read first, exactly as a landing is read
// (`../landed-challenge.ts`) and waited out across the check's own reload
// (`../landed-check-wait.ts`). A look without the allowance -- a host state
// capture, a re-acquire, the recorder -- still reads a check page as a page,
// because their callers have no person to hand it to.
//
// The judgment is the worker's, not the content script's: a check that clears
// replaces its own document, and only the worker can keep asking across that.

import type { WebAutomationClearedCheckWait } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand, BrowserActionResult } from "../../shared/protocol";
import { navigationChallengeFailure, workerActionResult } from "../action-results";
import { readLandedPage } from "../landed-challenge";
import { checkWaitBudgetMs, clearedCheckWait, settleLandedReading, standingCheckWords, type LandedTabAccess } from "../landed-check-wait";

/**
 * What the page a look is about to take says about a robot check: one still
 * standing, as the look's failed result; one that cleared by itself, as the
 * wait the look's result carries; nothing, when there is none or the page could
 * not be asked, and the look is taken as it always was.
 */
export type LookCheck =
  | { kind: "check_standing"; result: BrowserActionResult }
  | { kind: "check_cleared"; checkWait: WebAutomationClearedCheckWait };

const EXPECTED = "a page to look at";

/** Reads the tab's page for a robot check before a look is taken, and waits out one that clears by itself. */
export async function judgeLookCheck(
  action: BrowserActionCommand,
  tabId: number,
  startedAt: number,
  access: LandedTabAccess
): Promise<LookCheck | undefined> {
  const first = await readLandedPage(tabId, access.send);
  const settled = await settleLandedReading(first, tabId, access, checkWaitBudgetMs(action, startedAt));
  if (settled.reading?.kind === "robot_check") {
    const actual = standingCheckWords("the page looked at", settled.checkWait);
    return {
      kind: "check_standing",
      result: workerActionResult(action, startedAt, {
        status: "failed",
        message: "The page is a robot check, which only a person can answer.",
        validation: { status: "failed", expected: EXPECTED, actual },
        failure: navigationChallengeFailure(EXPECTED, actual)
      })
    };
  }
  const checkWait = clearedCheckWait(settled.checkWait);
  return checkWait === undefined ? undefined : { kind: "check_cleared", checkWait };
}
