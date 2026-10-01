// Where a replayed click took its own tab: whether the page it landed on is a
// robot check, and whether the server refused it.
//
// A click that follows a retired link, or presses a button whose destination a
// guard refuses, comes back `succeeded`. The content script cannot know better:
// it judges a link by its navigation beginning and a button by its hit test
// (`content/actions/click.ts`), and the document that could see the landing is
// gone before the landing exists. What does say the landing is wrong, without
// knowing anything about the recording, is the server's own answer: a retired
// URL redirected to a notice served 404 (W10 `broken-link`), a destination a
// guard answers 403 (W27 `blocked-url`).
//
// And the landed page's own top frame, asked what `landed-challenge.ts` asks a
// navigation's: a filter, pager or facet click on a store that has decided the
// session is automated lands on its robot check, served 200 at the address the
// click asked for, and until 2026-09-30 that was a successful click. A check
// that clears by itself is waited out in place (`landed-check-wait.ts`) and the
// click stands; one a person must answer, or one that did not clear, fails
// USER_INTERVENTION_REQUIRED, with the record saying the click itself was
// made, so the step stands once the person has answered the check. A check
// overrides the status, as it does a navigation's address: a check served 403
// is still the person's to answer, not a refused page.
//
// - Only `web.dom.click` is watched, and only its own tab's top frame. A
//   navigation in another tab, or in a child frame, is not the click's landing.
// - Only a click that succeeded is judged; a failed click already says why. A
//   click whose reply is lost because its page unloaded first is judged too: a
//   refused landing is its failure, a check it landed on is judged as above,
//   and a landing nothing speaks against is the click's success -- the click
//   navigated its page before it could answer, which is what bigbox's "Set as
//   my store" (save, then `location.reload()`), a search submit and "Continue
//   without an account" do. Until 2026-09-30 that rethrew, the domain read the
//   step as refused, and a step that had done the act was dropped from the
//   Flow (audit A2, cause 1). A lost reply with no committed navigation still
//   rethrows unchanged for the command router: nothing says the click landed.
//   So does one refused before delivery ("Receiving end does not exist"): the
//   click never reached the page, so a navigation that commits is not its.
// - The listeners go on before the click is sent, because a local page can
//   commit within milliseconds of the click.
// - A click that starts no navigation gets NAVIGATION_START_GRACE_MS to start
//   one and is then returned as it was; that grace is the whole cost such a
//   click pays. A navigation that ends without a commit (a download, a 204, one
//   the page cancels) is returned as it was too.
// - The status is read from the committed document itself, addressed by the
//   `documentId` its commit named, so a document that replaced it cannot answer
//   for it (`served-status.ts`, which a navigation's landing reads too).
//   Anything that stops the read -- Firefox keeps no `responseStatus`, a
//   replaced document refuses the injection -- leaves the click as it was:
//   missing evidence never becomes a failure.
// - The record names the status and the landed path without its query or
//   fragment. It never quotes the page.
// - The landed page is asked about a check only once a navigation committed,
//   so a click that navigates nowhere pays nothing for it. The new document
//   may not be listening yet at its commit, so an unread answer is asked again
//   for up to LANDING_READ_MS; one still unread leaves the click as it was.
//
// A landing served 429 or 503 is not a page refused for good but the site
// saying "not now", as it is for a navigation (`rate-limited-landing.ts`): the
// click fails RATE_LIMITED, retryable and stating its load did not happen, the
// origin's page pace hears of the refusal, and `retryAfterMs` is the wait that
// pace now imposes on the origin's next load. A robot check is judged first and
// stays the person's whatever it was served with. Core repeats a retryable step
// by sending the same command again (`executor/defensive/assess.ts`), and the
// refusal page holds nothing that command can press -- the everything store's
// 429 page is one link to the address it refused -- so the tab is then taken
// back to the document the click was pressed on (`chrome.tabs.goBack`), which
// is also what makes "unacted" true of the tab. The pace is not waited on
// first: a history traversal is normally restored from the back/forward cache
// and asks the site for nothing. The back landing is judged -- its address
// against the one the tab showed before the click, its served status -- and the
// record says whether the tab was returned; a failed or wrong return is said,
// never hidden, and the click is still RATE_LIMITED.
//
// A click that opened its page in a tab of its own -- a `target="_blank"`
// link, crossborder's search result cards -- commits nothing in its own tab.
// When the click's tab did not navigate and a tab was opened from it while the
// click was judged (`opened-tab.ts`), that tab becomes the automation tab, so
// every later step drives the page the click opened, and its landing is judged
// as an own-tab landing is: a robot check is the person's; a page served 429 or
// 503 is RATE_LIMITED, and the opened tab is closed so the clicked tab, still
// on the page the click was pressed on, is driven again and a repeat presses
// the same control; any other status of 400 or above is
// `navigation_unexpected`. A click that stands says, in its `actual`, that its
// page opened in a new tab that the run now drives.
//
// Not caught: a soft 404, served 200 with an error notice, which needs the
// landing the recording saw (Week 2's landing marker). A sign-in page served
// 401 would read `navigation_unexpected` rather than `auth_required`. A new tab
// the browser's popup blocker refused never opens, and the click stands as the
// navigation it began.

import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "@fluxiq-web-extension/domain/client";
import type { OriginPace } from "../background/page-pace";
import type { BrowserActionCommand, BrowserActionResult } from "../shared/protocol";
import type { WorkerActionOutcome } from "./action-results";
import { boundWorkerValidation, navigationChallengeFailure, navigationUnexpectedFailure, workerActionResult } from "./action-results";
import { forgetAutomationTab, readTabTitle, readTabUrl, setAutomationTab, waitForTabReady } from "./automation-tab";
import { watchOpenedTab } from "./opened-tab";
import { readLandedPage, type FrameSender, type LandedPageReading } from "./landed-challenge";
import { landedPath } from "./quoted-path";
import { checkWaitBudgetMs, clearedCheckWait, settleLandedReading, standingCheckWords, type LandedCheckWait, type LandedTabAccess } from "./landed-check-wait";
import { unloadedUnderDeliveredMessage } from "./navigating-page";
import { noteRateLimitedLanding, type RateLimitedLanding } from "./rate-limited-landing";
import { servedStatus, type ServedStatus } from "./served-status";

/** The id the browser always gives a tab's main frame. */
const TOP_FRAME_ID = 0;

/** How long a click that has started no top-frame navigation is given to start one. */
const NAVIGATION_START_GRACE_MS = 300;

/** How long a started navigation is given to commit or end before the click is returned as it was. */
const NAVIGATION_END_TIMEOUT_MS = 10_000;

/** The lowest HTTP status that means the server refused the page. */
const FIRST_ERROR_STATUS = 400;

const EXPECTED = "the page the click leads to loads";

/** A top-frame commit: where the tab landed, and the document that landed there. */
type Commit = { url: string; documentId: string | undefined };

/** A landing the server refused: its status, and its path without query or fragment. */
type RefusedLanding = { status: number; path: string };

/** The page the click was pressed on, read before it was sent, and the pace a refusal for coming too fast is told to. */
type PressedPage = { url: string | undefined; pace: OriginPace | undefined };

/**
 * Where going back took a tab whose click landed on a page refused for coming
 * too fast, judged against the page the click was pressed on: back there; back
 * to a page that cannot be matched, because the address before the click went
 * unread; or not back, with why, and whether the tab still shows the refused
 * page.
 */
type PressedPageReturn =
  | { kind: "returned"; path: string }
  | { kind: "unconfirmed"; path: string }
  | { kind: "not_returned"; why: string; stayed: boolean };

/**
 * What a committed landing says about the click: it failed, a self-clearing
 * check on it was waited out, or nothing against it.
 */
type LandingVerdict =
  | { kind: "failed"; outcome: WorkerActionOutcome; wait?: LandedCheckWait }
  | { kind: "check_cleared"; wait: LandedCheckWait }
  | { kind: "stood" };

type NavigationWatch = {
  startedAt: number;
  /** The top frame's commit, or undefined when none started in the grace or the navigation ended without one. */
  landing(): Promise<Commit | undefined>;
  stop(): void;
};

/** How long a committed landing's top frame is asked, again and again, before an unread answer is let stand. */
const LANDING_READ_MS = 2_500;

/** How long between asking a landing that did not answer. */
const LANDING_READ_RETRY_MS = 150;

/**
 * Sends the action and returns its result, with a click that took its own tab
 * to a robot check failed as USER_INTERVENTION_REQUIRED, once any check that
 * clears by itself has been waited out; one that took it to a page served 429
 * or 503 failed as RATE_LIMITED, told to `pace`, and its tab taken back to the
 * page it was pressed on; and one that took it to a page the server answered
 * with any other HTTP 400 or above failed as `navigation_unexpected`. Every
 * other action is sent and returned untouched.
 */
export async function sendClickCheckingLanding(
  action: BrowserActionCommand,
  tabId: number,
  send: () => Promise<BrowserActionResult>,
  access: LandedTabAccess,
  pace?: OriginPace
): Promise<BrowserActionResult> {
  if (action.actionType !== "web.dom.click") return await send();
  const watch = watchTopFrameNavigation(tabId);
  const opened = watchOpenedTab(tabId);
  try {
    // Read before the click, since a click that navigates takes it away: a
    // landing refused for coming too fast sends the tab back to it.
    const pressed: PressedPage = { url: await readTabUrl(tabId), pace };
    let reply: BrowserActionResult;
    try {
      reply = await send();
    } catch (error) {
      const verdict = await judgeLanding(action, tabId, watch, access, pressed);
      if (verdict === undefined) throw error;
      if (verdict.kind === "failed") {
        const failed = workerActionResult(action, watch.startedAt, verdict.outcome);
        return verdict.wait ? clickAfterClearedCheck(failed, verdict.wait) : failed;
      }
      // Only a click delivered to a page that then unloaded under it was made. A
      // send that found no listener never reached the page, and any other
      // refusal is the click's own failure, whatever the tab then did.
      if (!unloadedUnderDeliveredMessage(error)) throw error;
      const navigated = workerActionResult(action, watch.startedAt, navigatedBeforeAnsweringOutcome());
      return verdict.kind === "check_cleared" ? clickAfterClearedCheck(navigated, verdict.wait) : navigated;
    }
    if (reply.status !== "succeeded") return reply;
    // Read together, so a click that opens no tab waits no longer than the
    // grace its own tab's landing is given anyway.
    const [verdict, openedTabId] = await Promise.all([
      judgeLanding(action, tabId, watch, access, pressed),
      opened.settle(NAVIGATION_START_GRACE_MS)
    ]);
    if (verdict === undefined && openedTabId !== undefined) {
      return await driveOpenedTab(action, reply, { sourceTabId: tabId, openedTabId, startedAt: watch.startedAt }, access, pressed);
    }
    if (verdict === undefined || verdict.kind === "stood") return reply;
    if (verdict.kind === "failed") {
      const failed = failedClick(reply, verdict.outcome);
      return verdict.wait ? clickAfterClearedCheck(failed, verdict.wait) : failed;
    }
    return clickAfterClearedCheck(reply, verdict.wait);
  } finally {
    watch.stop();
    opened.stop();
  }
}

/** The tab a click was pressed in, the tab it opened, and when the click began. */
type OpenedTab = { sourceTabId: number; openedTabId: number; startedAt: number };

/**
 * A click whose page opened in a tab of its own (see the file comment): that
 * tab is driven from now on, once it is ready, and its landing is judged as an
 * own-tab landing is. On a page served 429 or 503 the opened tab is closed and
 * the clicked tab, still on the page the click was pressed on, is driven again.
 */
async function driveOpenedTab(
  action: BrowserActionCommand,
  reply: BrowserActionResult,
  tabs: OpenedTab,
  access: LandedTabAccess,
  pressed: PressedPage
): Promise<BrowserActionResult> {
  setAutomationTab(tabs.openedTabId);
  await waitForTabReady(tabs.openedTabId);
  const landed = await readTabUrl(tabs.openedTabId);
  const path = landedPath(landed ?? "");
  const first = await readCommittedLanding(tabs.openedTabId, access.send);
  const settled = await settleLandedReading(first, tabs.openedTabId, access, checkWaitBudgetMs(action, tabs.startedAt));
  if (settled.reading?.kind === "robot_check") return failedClick(reply, checkLandingOutcome(path, settled.checkWait));
  const served = await servedStatus(tabs.openedTabId, undefined);
  const rateLimited = noteRateLimitedLanding(landed, settled.reading, served, pressed.pace);
  if (rateLimited !== undefined) {
    const back = await closeOpenedTab(tabs, pressed.url);
    return failedClick(reply, rateLimitedLandingOutcome(path, rateLimited, back));
  }
  if ("status" in served && served.status >= FIRST_ERROR_STATUS) return failedClick(reply, refusedLandingOutcome({ status: served.status, path }));
  const title = await readTabTitle(tabs.openedTabId);
  const page = { ...(landed !== undefined ? { url: landed } : {}), ...(title ? { title } : {}) };
  const validation = reply.validation;
  const opened = `its page opened in a new tab (${path}), which the run now drives`;
  const stood: BrowserActionResult = {
    ...reply,
    ...page,
    message: `${reply.message ?? "Element clicked."} Its page opened in a new tab, which the run now drives.`,
    ...(validation.status === "passed" ? { validation: boundWorkerValidation({ ...validation, actual: `${validation.actual}; ${opened}` }) } : {}),
    finishedAt: Date.now()
  };
  return settled.checkWait?.outcome === "cleared" ? clickAfterClearedCheck(stood, settled.checkWait) : stood;
}

/**
 * Closes the tab a click opened onto a page refused for coming too fast, and
 * drives the clicked tab again: it never left the page the click was pressed
 * on, so a repeat presses the same control. Said as a return to that page.
 */
async function closeOpenedTab(tabs: OpenedTab, pressedUrl: string | undefined): Promise<PressedPageReturn> {
  forgetAutomationTab(tabs.openedTabId);
  setAutomationTab(tabs.sourceTabId);
  try {
    await chrome.tabs.remove(tabs.openedTabId);
  } catch (error) {
    const detail = error instanceof Error ? error.message.trim() : "";
    return { kind: "not_returned", why: `the new tab it opened could not be closed${detail ? ` (${detail})` : ""}, though the run drives the tab it was pressed in again`, stayed: false };
  }
  return { kind: "returned", path: pressedUrl === undefined ? "its address unread" : landedPath(pressedUrl) };
}

/**
 * The click's landing, judged: a robot check first, then the server's status
 * -- a refusal for coming too fast, which takes the tab back to `pressed`, and
 * then any other refusal. Undefined when nothing committed; `stood` when what
 * committed says nothing against the click.
 */
async function judgeLanding(
  action: BrowserActionCommand,
  tabId: number,
  watch: NavigationWatch,
  access: LandedTabAccess,
  pressed: PressedPage
): Promise<LandingVerdict | undefined> {
  const commit = await watch.landing();
  if (commit === undefined) return undefined;
  const first = await readCommittedLanding(tabId, access.send);
  const settled = await settleLandedReading(first, tabId, access, checkWaitBudgetMs(action, watch.startedAt));
  if (settled.reading?.kind === "robot_check") return { kind: "failed", outcome: checkLandingOutcome(landedPath(commit.url), settled.checkWait) };
  const cleared = settled.checkWait?.outcome === "cleared" ? { wait: settled.checkWait } : {};
  const served = await servedStatus(tabId, commit.documentId);
  const rateLimited = noteRateLimitedLanding(commit.url, settled.reading, served, pressed.pace);
  if (rateLimited !== undefined) {
    const back = await returnToPressedPage(tabId, pressed.url);
    return { kind: "failed", outcome: rateLimitedLandingOutcome(landedPath(commit.url), rateLimited, back), ...cleared };
  }
  const refused = refusedLanding(served, commit);
  if (refused !== undefined) return { kind: "failed", outcome: refusedLandingOutcome(refused), ...cleared };
  return settled.checkWait?.outcome === "cleared" ? { kind: "check_cleared", wait: settled.checkWait } : { kind: "stood" };
}

/**
 * The committed landing's reading, asked again while the new document is not
 * yet listening, for at most LANDING_READ_MS. An answer that stays unread is
 * returned as such, and leaves the click as it was.
 */
async function readCommittedLanding(tabId: number, send: FrameSender): Promise<LandedPageReading> {
  const deadline = Date.now() + LANDING_READ_MS;
  for (;;) {
    const left = deadline - Date.now();
    const reading = await readLandedPage(tabId, send, Math.max(1, Math.min(1_000, left)));
    if (reading.kind !== "unread" || Date.now() + LANDING_READ_RETRY_MS >= deadline) return reading;
    await new Promise<void>((resolve) => setTimeout(resolve, LANDING_READ_RETRY_MS));
  }
}

function watchTopFrameNavigation(tabId: number): NavigationWatch {
  const startedAt = Date.now();
  let started = false;
  /** Navigations begun and not yet ended by an error; a page may replace one with another before it commits. */
  let inFlight = 0;
  let commit: Commit | undefined;
  let wake: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const isOurTopFrame = (details: { tabId: number; frameId: number }): boolean =>
    details.tabId === tabId && details.frameId === TOP_FRAME_ID;
  const onBeforeNavigate = (details: chrome.webNavigation.WebNavigationParentedCallbackDetails): void => {
    if (!isOurTopFrame(details)) return;
    started = true;
    inFlight += 1;
    wake?.();
  };
  const onCommitted = (details: chrome.webNavigation.WebNavigationTransitionCallbackDetails): void => {
    if (!isOurTopFrame(details) || commit !== undefined) return;
    started = true;
    commit = { url: details.url, documentId: details.documentId };
    wake?.();
  };
  const onErrorOccurred = (details: chrome.webNavigation.WebNavigationFramedErrorCallbackDetails): void => {
    if (!isOurTopFrame(details)) return;
    inFlight = Math.max(0, inFlight - 1);
    wake?.();
  };
  chrome.webNavigation.onBeforeNavigate.addListener(onBeforeNavigate);
  chrome.webNavigation.onCommitted.addListener(onCommitted);
  chrome.webNavigation.onErrorOccurred.addListener(onErrorOccurred);

  function until(holds: () => boolean, timeoutMs: number): Promise<void> {
    if (holds()) return Promise.resolve();
    return new Promise((resolve) => {
      const finish = (): void => {
        clearTimeout(timer);
        timer = undefined;
        wake = undefined;
        resolve();
      };
      timer = setTimeout(finish, timeoutMs);
      wake = () => {
        if (holds()) finish();
      };
    });
  }

  return {
    startedAt,
    async landing() {
      await until(() => started, NAVIGATION_START_GRACE_MS);
      if (!started) return undefined;
      await until(() => commit !== undefined || inFlight === 0, NAVIGATION_END_TIMEOUT_MS);
      return commit;
    },
    stop() {
      clearTimeout(timer);
      chrome.webNavigation.onBeforeNavigate.removeListener(onBeforeNavigate);
      chrome.webNavigation.onCommitted.removeListener(onCommitted);
      chrome.webNavigation.onErrorOccurred.removeListener(onErrorOccurred);
    }
  };
}

function refusedLanding(served: ServedStatus, commit: Commit): RefusedLanding | undefined {
  if (!("status" in served) || served.status < FIRST_ERROR_STATUS) return undefined;
  return { status: served.status, path: landedPath(commit.url) };
}

/**
 * Takes the tab back one history entry, to the page the click was pressed on,
 * and judges where it went: its address against `pressedUrl` (the fragment
 * aside), and the status it was served with. Nothing is waited on first, and a
 * back landing whose status the browser will not give is not held against the
 * return: missing evidence never becomes a failure.
 */
async function returnToPressedPage(tabId: number, pressedUrl: string | undefined): Promise<PressedPageReturn> {
  const watch = watchTopFrameNavigation(tabId);
  try {
    try {
      await chrome.tabs.goBack(tabId);
    } catch (error) {
      const detail = error instanceof Error ? error.message.trim() : "";
      return { kind: "not_returned", why: detail ? `the browser would not go back (${detail})` : "the browser would not go back", stayed: true };
    }
    const commit = await watch.landing();
    if (commit === undefined) return { kind: "not_returned", why: "going back committed no page", stayed: true };
    const path = landedPath(commit.url);
    if (pressedUrl !== undefined && withoutFragment(commit.url) !== withoutFragment(pressedUrl)) {
      return { kind: "not_returned", why: `going back landed on ${path}, not on ${landedPath(pressedUrl)}`, stayed: false };
    }
    const served = await servedStatus(tabId, commit.documentId);
    if ("status" in served && served.status >= FIRST_ERROR_STATUS) {
      return { kind: "not_returned", why: `the page it went back to (${path}) was served HTTP ${served.status}`, stayed: false };
    }
    return pressedUrl === undefined ? { kind: "unconfirmed", path } : { kind: "returned", path };
  } finally {
    watch.stop();
  }
}

function withoutFragment(url: string): string {
  const hash = url.indexOf("#");
  return hash === -1 ? url : url.slice(0, hash);
}

/**
 * A click whose landing the site refused for coming too fast: RATE_LIMITED,
 * with the pace's wait as `retryAfterMs`, and a record naming the status, the
 * landed path without its query, whether the tab was taken back, and the wait.
 */
function rateLimitedLandingOutcome(path: string, limited: RateLimitedLanding, back: PressedPageReturn): WorkerActionOutcome {
  const { status, retryAfterMs } = limited;
  const actual = `the server answered HTTP ${status} for ${path}: the site refused the load for now and nothing was loaded; ` +
    `${returnWords(back)}; the same click may be made again after ${retryAfterMs} ms`;
  return {
    status: "failed",
    message: `The click was refused by the site for now: HTTP ${status} for ${path}; ${returnMessage(back)} the click may be made again after ${retryAfterMs} ms.`,
    validation: { status: "failed", expected: EXPECTED, actual },
    failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.RATE_LIMITED, { expected: EXPECTED, actual, retryAfterMs })
  };
}

/** The return as the record's `actual` says it. */
function returnWords(back: PressedPageReturn): string {
  switch (back.kind) {
    case "returned":
      return `the tab was taken back to the page the click was pressed on (${back.path})`;
    case "unconfirmed":
      return `the tab was taken back to ${back.path}, but whether that is the page the click was pressed on is unconfirmed, because the address before the click went unread`;
    case "not_returned":
      return `the tab was not taken back to the page the click was pressed on: ${back.why}${back.stayed ? ", so it still shows the refused page" : ""}`;
  }
}

/** The return as the message says it, ending where the wait is joined on. */
function returnMessage(back: PressedPageReturn): string {
  switch (back.kind) {
    case "returned":
      return "the tab was taken back to the page it was pressed on, and";
    case "unconfirmed":
      return "the tab was taken back, though whether to the page it was pressed on is unconfirmed, and";
    case "not_returned":
      return back.stayed
        ? "the tab could not be taken back to the page it was pressed on, so it still shows the refused page;"
        : `the tab could not be taken back to the page it was pressed on: ${back.why};`;
  }
}

function refusedLandingOutcome(landing: RefusedLanding): WorkerActionOutcome {
  const actual = `the server answered HTTP ${landing.status} for ${landing.path}`;
  return {
    status: "failed",
    message: `The click landed on ${landing.path}, which the server answered with HTTP ${landing.status}.`,
    validation: { status: "failed", expected: EXPECTED, actual },
    failure: navigationUnexpectedFailure(EXPECTED, actual)
  };
}

/**
 * A click that landed on a robot check still standing: the click was made --
 * its page is the check -- and only a person can let the run past it. The
 * record says so, so the step can stand once the person has answered, and
 * names the landed path without its query, as a refused landing's does.
 */
function checkLandingOutcome(path: string, checkWait: LandedCheckWait | undefined): WorkerActionOutcome {
  const actual = `the click was made and landed on a robot check at ${path}`;
  return {
    status: "failed",
    message: `The click was made and landed on a robot check at ${path}, which only a person can answer.`,
    validation: { status: "failed", expected: EXPECTED, actual },
    failure: navigationChallengeFailure(EXPECTED, `the click was made, and ${standingCheckWords(`the page it landed on (${path})`, checkWait)}`)
  };
}

/**
 * A click whose page navigated before it could answer, onto a landing nothing
 * speaks against: the click was made -- the navigation is its doing, since the
 * top frame of its own tab committed after it was sent -- so it stands. The
 * landed address is not quoted, as no landing record here quotes a query.
 */
function navigatedBeforeAnsweringOutcome(): WorkerActionOutcome {
  return {
    status: "succeeded",
    message: "The click navigated its page before it could answer.",
    validation: { status: "passed", expected: EXPECTED, actual: "the click navigated its page before it could answer, and the page it landed on loaded" }
  };
}

/** The frame's reply keeps what it says about the click itself; only its verdict is replaced. */
function failedClick(reply: BrowserActionResult, outcome: WorkerActionOutcome): BrowserActionResult {
  return {
    ...reply,
    status: outcome.status,
    message: outcome.message,
    validation: boundWorkerValidation(outcome.validation),
    failure: outcome.failure,
    finishedAt: Date.now()
  };
}

/**
 * The frame's reply, standing, saying the landing's check was waited out
 * untouched: as a fact (`checkWait`), and in its validation when it has one.
 */
function clickAfterClearedCheck(reply: BrowserActionResult, wait: LandedCheckWait): BrowserActionResult {
  const stood = { ...reply, checkWait: clearedCheckWait(wait), finishedAt: Date.now() };
  const validation = reply.validation;
  if (validation.status !== "passed") return stood;
  const actual = `${validation.actual}; the page it landed on was a robot check that cleared by itself after ${wait.waitedMs} ms, untouched`;
  return { ...stood, validation: boundWorkerValidation({ ...validation, actual }) };
}
