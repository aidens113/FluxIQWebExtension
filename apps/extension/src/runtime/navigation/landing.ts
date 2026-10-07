import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand, BrowserActionResult } from "../../shared/protocol";
import type { FrameSender } from "../landed-challenge";
import type { OriginPace } from "../../background/page-pace";
import { navigationChallengeFailure, navigationUnexpectedFailure, workerActionResult } from "../index";
import { readTabTitle, readTabUrl, waitForTabReady, type TabDriveRecord } from "../index";
import { readLandedPage, type LandedPageReading } from "../index";
import { checkWaitBudgetMs, clearedCheckWait, settleLandedReading, standingCheckWords, type LandedCheckWait } from "../index";
import { landedPath } from "../index";
import { compareNavigatedUrl, judgeTabMovement } from "./outcome";
import { noteRateLimitedLanding, type RateLimitedLanding } from "../index";
import { servedStatus, type ServedStatus } from "../index";

/** Shared physical landing evidence for navigate and explicit URL tab open.
 * Transport arrival stays distinct from unknown landing evidence and task outcome. */
export async function verifyNavigationLanding(
  action: BrowserActionCommand, startedAt: number, tabId: number, requested: string,
  drive: TabDriveRecord | undefined, access: { frames(tabId: number): Promise<chrome.webNavigation.GetAllFrameResultDetails[]>; send: FrameSender }, pace?: OriginPace
): Promise<BrowserActionResult> {
  const loadFailed = (await access.frames(tabId)).some((frame) => frame.frameId === 0 && frame.errorOccurred);
  const firstReading = loadFailed ? undefined : await readLandedPage(tabId, access.send);
  const { reading, checkWait } = await settleLandedReading(firstReading, tabId, { send: access.send, settle: waitForTabReady }, checkWaitBudgetMs(action, startedAt));
  const served = loadFailed ? undefined : await servedStatus(tabId, drive?.documentAfter);
  const landed = await readTabUrl(tabId);
  const rateLimited = noteRateLimitedLanding(landed, reading, served, pace);
  const result = navigationResult(action, startedAt, requested, { landed, title: await readTabTitle(tabId), loadFailed, reading, checkWait, served, rateLimited, drive });
  const clearedWait = clearedCheckWait(checkWait);
  if (clearedWait) result.checkWait = clearedWait;
  return result;
}

type NavigationLanding = {
  landed: string | undefined;
  title: string | undefined;
  loadFailed: boolean;
  /**
   * What the landed page's top frame said it is (`landed-challenge.ts`), after
   * any self-clearing check on it was waited out; absent when the page did not
   * load.
   */
  reading: LandedPageReading | undefined;
  /** The wait on a self-clearing check, when the landed page first read as one (`landed-check-wait.ts`). */
  checkWait: LandedCheckWait | undefined;
  /** The HTTP status the landed document was served with (`served-status.ts`); absent when the page did not load. */
  served: ServedStatus | undefined;
  /** The landing's refusal for coming too fast, already told to the pace (`noteRateLimitedLanding`); absent when it is none. */
  rateLimited: RateLimitedLanding | undefined;
  drive: TabDriveRecord | undefined;
};

/** The lowest HTTP status that means the server refused the page. */
const FIRST_ERROR_STATUS = 400;

/**
 * A navigation's post-condition, in two halves, after two questions that
 * override both.
 *
 * A landed page that is a robot check is the person's, wherever it is and
 * whatever the drive did: it fails USER_INTERVENTION_REQUIRED and is never a
 * success. Reported as one, it sent the model on into the check again and
 * again (live runs 15 and 17 on the crossborder marketplace); reported as
 * NAVIGATION_UNEXPECTED, a check a site redirects to would read as a page the
 * model could navigate away from. A check that clears by itself has already
 * been waited out by then, so the check still standing here is one a person
 * must answer, or one that did not clear in time; one that did clear leaves
 * the page behind it to be judged, and the validation says it was waited out.
 *
 * Next, a landing served 429 or 503 is the site saying "not now", wherever it
 * landed: it fails RATE_LIMITED, which is retryable and states the navigation
 * did not happen, with the wait before it may be made again as `retryAfterMs`
 * (`noteRateLimitedLanding` has already told the pace). It is not
 * NAVIGATION_UNEXPECTED, which is never retried: the same request after the
 * wait is the one that works.
 *
 * Then the destination is judged, because landing somewhere else explains
 * everything after it. Then the server's answer: a page served HTTP 400 or
 * above (other than the two above) is a page the server refused, though it
 * loaded at the address asked for -- bigbox answers an item it does not know with 404 and a line of JSON,
 * and lane A run 23 reported that navigation a success. A check served 403 was
 * judged above, and stays the person's. Unread status/challenge evidence keeps
 * transport arrival distinct from unknown verification. Then the movement: a navigation that left the tab on
 * the document it already held did nothing, however right its address reads,
 * and reporting that as success is how a Flow carried on against a page it
 * believed it had replaced. Only positive evidence of a no-op fails --
 * `judgeTabMovement` says when it could not tell -- and what it saw is put on
 * the validation either way, because a navigate result carries no snapshot and
 * no element to reconstruct it from.
 */
function navigationResult(
  action: BrowserActionCommand,
  startedAt: number,
  requested: string,
  landing: NavigationLanding
): BrowserActionResult {
  const { landed, title, loadFailed } = landing;
  const page = { ...(landed !== undefined ? { url: landed } : {}), ...(title ? { title } : {}) };
  if (landing.reading?.kind === "robot_check") {
    const expected = `the page at ${requested}`;
    const seen = standingCheckWords("the page the browser landed on", landing.checkWait);
    return workerActionResult(action, startedAt, {
      status: "failed",
      message: landing.checkWait === undefined
        ? "Navigation landed on a robot check, which only a person can answer."
        : "Navigation landed on a robot check that did not clear by itself, so only a person can answer it.",
      validation: { status: "failed", expected, actual: "a robot check" },
      failure: navigationChallengeFailure(expected, seen),
      ...page
    });
  }
  if (landing.rateLimited !== undefined) {
    const { status, retryAfterMs } = landing.rateLimited;
    const path = landedPath(landed ?? requested);
    const expected = `the page at ${requested}`;
    const actual = `the server answered HTTP ${status} for ${path}: the site refused the load for now and nothing was loaded; the same navigation may be made again after ${retryAfterMs} ms`;
    return workerActionResult(action, startedAt, {
      status: "failed",
      message: `Navigation refused by the site for now: HTTP ${status} for ${path}; it may be made again after ${retryAfterMs} ms.`,
      validation: { status: "failed", expected, actual },
      failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.RATE_LIMITED, { expected, actual, retryAfterMs }),
      ...page
    });
  }
  const comparison = compareNavigatedUrl(requested, landed, loadFailed);
  if (!comparison.matched) {
    return workerActionResult(action, startedAt, {
      status: "failed",
      message: loadFailed ? `The browser could not load ${comparison.expected}.` : `Navigation landed on ${comparison.actual}, not ${comparison.expected}.`,
      validation: { status: "failed", expected: comparison.expected, actual: comparison.actual },
      failure: navigationUnexpectedFailure(comparison.expected, comparison.actual),
      ...page
    });
  }
  if (landing.served !== undefined && "status" in landing.served && landing.served.status >= FIRST_ERROR_STATUS) {
    const path = landedPath(comparison.actual);
    const actual = `the server answered HTTP ${landing.served.status} for ${path}`;
    return workerActionResult(action, startedAt, {
      status: "failed",
      message: `Navigation landed on ${path}, which the server answered with HTTP ${landing.served.status}.`,
      validation: { status: "failed", expected: comparison.expected, actual },
      failure: navigationUnexpectedFailure(comparison.expected, actual),
      ...page
    });
  }
  const movement = judgeTabMovement(landing.drive);
  if (!movement.moved) {
    const expected = `${comparison.expected}, reached by loading it`;
    const actual = `${comparison.actual}: ${movement.detail}`;
    return workerActionResult(action, startedAt, {
      status: "failed",
      message: `Navigation left the tab on the page it was already showing: ${movement.detail}.`,
      validation: { status: "failed", expected, actual },
      failure: navigationUnexpectedFailure(expected, actual),
      ...page
    });
  }
  const unknown: string[] = [];
  if (landing.reading?.kind === "unread") unknown.push(`robot check went unread: ${landing.reading.why}`);
  else if (landing.reading === undefined) unknown.push("whether the page is a robot check could not be read");
  if (landing.served === undefined) unknown.push("HTTP response status could not be read");
  else if ("unread" in landing.served) unknown.push(`HTTP response status went unread: ${landing.served.unread}`);
  if (unknown.length > 0) {
    return workerActionResult(action, startedAt, {
      status: "succeeded",
      message: `Navigation transport arrived; landing verification is unknown: ${unknown.join("; ")}.`,
      validation: { status: "none", reason: "not-yet-validated" },
      ...page
    });
  }
  const waited = landing.checkWait?.outcome === "cleared"
    ? `; a robot check stood on the page and cleared by itself after ${landing.checkWait.waitedMs} ms, untouched`
    : "";
  const completed = workerActionResult(action, startedAt, {
    status: "succeeded",
    message: "Navigation completed.",
    validation: { status: "passed", expected: comparison.expected, actual: `${comparison.actual}: ${movement.detail}${waited}` },
    ...page
  });
  return completed;
}

