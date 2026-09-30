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
//   refused landing is its failure, and anything else rethrows the refusal
//   unchanged for the command router.
// - The listeners go on before the click is sent, because a local page can
//   commit within milliseconds of the click.
// - A click that starts no navigation gets NAVIGATION_START_GRACE_MS to start
//   one and is then returned as it was; that grace is the whole cost such a
//   click pays. A navigation that ends without a commit (a download, a 204, one
//   the page cancels) is returned as it was too.
// - The status is read from the committed document itself, addressed by the
//   `documentId` its commit named, so a document that replaced it cannot answer
//   for it. Anything that stops the read -- Firefox keeps no `responseStatus`, a
//   replaced document refuses the injection -- leaves the click as it was:
//   missing evidence never becomes a failure.
// - The record names the status and the landed path without its query or
//   fragment. It never quotes the page.
// - The landed page is asked about a check only once a navigation committed,
//   so a click that navigates nowhere pays nothing for it. The new document
//   may not be listening yet at its commit, so an unread answer is asked again
//   for up to LANDING_READ_MS; one still unread leaves the click as it was.
//
// Not caught: a soft 404, served 200 with an error notice, which needs the
// landing the recording saw (Week 2's landing marker). A sign-in page served
// 401 would read `navigation_unexpected` rather than `auth_required`.

import type { BrowserActionCommand, BrowserActionResult } from "../shared/protocol";
import type { WorkerActionOutcome } from "./action-results";
import { boundWorkerValidation, navigationChallengeFailure, navigationUnexpectedFailure, workerActionResult } from "./action-results";
import { readLandedPage, type FrameSender, type LandedPageReading } from "./landed-challenge";
import { checkWaitBudgetMs, settleLandedReading, standingCheckWords, type LandedCheckWait, type LandedTabAccess } from "./landed-check-wait";

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

/** What the landing says about the click: it failed, a self-clearing check on it was waited out, or nothing. */
type LandingVerdict =
  | { kind: "failed"; outcome: WorkerActionOutcome }
  | { kind: "check_cleared"; wait: LandedCheckWait };

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
 * clears by itself has been waited out, and one that took it to a page the
 * server answered with HTTP 400 or above failed as `navigation_unexpected`.
 * Every other action is sent and returned untouched.
 */
export async function sendClickCheckingLanding(
  action: BrowserActionCommand,
  tabId: number,
  send: () => Promise<BrowserActionResult>,
  access: LandedTabAccess
): Promise<BrowserActionResult> {
  if (action.actionType !== "web.dom.click") return await send();
  const watch = watchTopFrameNavigation(tabId);
  try {
    let reply: BrowserActionResult;
    try {
      reply = await send();
    } catch (error) {
      const verdict = await judgeLanding(action, tabId, watch, access);
      if (verdict?.kind !== "failed") throw error;
      return workerActionResult(action, watch.startedAt, verdict.outcome);
    }
    if (reply.status !== "succeeded") return reply;
    const verdict = await judgeLanding(action, tabId, watch, access);
    if (verdict === undefined) return reply;
    return verdict.kind === "failed" ? failedClick(reply, verdict.outcome) : clickAfterClearedCheck(reply, verdict.wait);
  } finally {
    watch.stop();
  }
}

/**
 * The click's landing, judged: a robot check first, then the server's status.
 * Undefined when nothing committed, or when what committed says nothing
 * against the click.
 */
async function judgeLanding(
  action: BrowserActionCommand,
  tabId: number,
  watch: NavigationWatch,
  access: LandedTabAccess
): Promise<LandingVerdict | undefined> {
  const commit = await watch.landing();
  if (commit === undefined) return undefined;
  const first = await readCommittedLanding(tabId, access.send);
  const settled = await settleLandedReading(first, tabId, access, checkWaitBudgetMs(action, watch.startedAt));
  if (settled.reading?.kind === "robot_check") return { kind: "failed", outcome: checkLandingOutcome(landedPath(commit.url), settled.checkWait) };
  const refused = await refusedLanding(tabId, commit);
  if (refused !== undefined) return { kind: "failed", outcome: refusedLandingOutcome(refused) };
  return settled.checkWait?.outcome === "cleared" ? { kind: "check_cleared", wait: settled.checkWait } : undefined;
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

async function refusedLanding(tabId: number, commit: Commit): Promise<RefusedLanding | undefined> {
  const status = await servedStatus(tabId, commit);
  if (status === undefined || status < FIRST_ERROR_STATUS) return undefined;
  return { status, path: landedPath(commit.url) };
}

/** The status the committed document was served with, or undefined when the browser will not say. */
async function servedStatus(tabId: number, commit: Commit): Promise<number | undefined> {
  const target: chrome.scripting.InjectionTarget = commit.documentId !== undefined
    ? { tabId, documentIds: [commit.documentId] }
    : { tabId, frameIds: [TOP_FRAME_ID] };
  try {
    const [injection] = await chrome.scripting.executeScript({ target, func: readServedStatus });
    const status: unknown = injection?.result;
    return typeof status === "number" && Number.isInteger(status) && status > 0 ? status : undefined;
  } catch {
    return undefined;
  }
}

/** Runs inside the landed document, so it must stand alone: the status its response carried. */
function readServedStatus(): number | undefined {
  const [entry] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
  return entry?.responseStatus;
}

function landedPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "(unknown)";
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

/** The frame's reply, standing, with its validation saying the landing's check was waited out untouched. */
function clickAfterClearedCheck(reply: BrowserActionResult, wait: LandedCheckWait): BrowserActionResult {
  const validation = reply.validation;
  if (validation.status !== "passed") return reply;
  const actual = `${validation.actual}; the page it landed on was a robot check that cleared by itself after ${wait.waitedMs} ms, untouched`;
  return { ...reply, validation: boundWorkerValidation({ ...validation, actual }), finishedAt: Date.now() };
}
