// Where a replayed click took its own tab, and whether the server refused the
// page it landed on.
//
// A click that follows a retired link, or presses a button whose destination a
// guard refuses, comes back `succeeded`. The content script cannot know better:
// it judges a link by its navigation beginning and a button by its hit test
// (`content/actions/click.ts`), and the document that could see the landing is
// gone before the landing exists. What does say the landing is wrong, without
// knowing anything about the recording, is the server's own answer: a retired
// URL redirected to a notice served 404 (W10 `broken-link`), a destination a
// guard answers 403 (W27 `blocked-url`). That is what is checked here, and only
// that.
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
//
// Not caught: a soft 404, served 200 with an error notice, which needs the
// landing the recording saw (Week 2's landing marker). A sign-in page served
// 401 would read `navigation_unexpected` rather than `auth_required`.

import type { BrowserActionCommand, BrowserActionResult } from "../shared/protocol";
import type { WorkerActionOutcome } from "./action-results";
import { boundWorkerValidation, navigationUnexpectedFailure, workerActionResult } from "./action-results";

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

type NavigationWatch = {
  startedAt: number;
  /** The top frame's commit, or undefined when none started in the grace or the navigation ended without one. */
  landing(): Promise<Commit | undefined>;
  stop(): void;
};

/**
 * Sends the action and returns its result, with a click that took its own tab
 * to a page the server answered with HTTP 400 or above failed as
 * `navigation_unexpected`. Every other action is sent and returned untouched.
 */
export async function sendClickCheckingLanding(
  action: BrowserActionCommand,
  tabId: number,
  send: () => Promise<BrowserActionResult>
): Promise<BrowserActionResult> {
  if (action.actionType !== "web.dom.click") return await send();
  const watch = watchTopFrameNavigation(tabId);
  try {
    let reply: BrowserActionResult;
    try {
      reply = await send();
    } catch (error) {
      const refused = await refusedLanding(tabId, watch);
      if (refused === undefined) throw error;
      return workerActionResult(action, watch.startedAt, refusedLandingOutcome(refused));
    }
    if (reply.status !== "succeeded") return reply;
    const refused = await refusedLanding(tabId, watch);
    return refused === undefined ? reply : failedClick(reply, refused);
  } finally {
    watch.stop();
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

async function refusedLanding(tabId: number, watch: NavigationWatch): Promise<RefusedLanding | undefined> {
  const commit = await watch.landing();
  if (commit === undefined) return undefined;
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

/** The frame's reply keeps what it says about the click itself; only its verdict is replaced. */
function failedClick(reply: BrowserActionResult, landing: RefusedLanding): BrowserActionResult {
  const outcome = refusedLandingOutcome(landing);
  return {
    ...reply,
    status: outcome.status,
    message: outcome.message,
    validation: boundWorkerValidation(outcome.validation),
    failure: outcome.failure,
    finishedAt: Date.now()
  };
}
