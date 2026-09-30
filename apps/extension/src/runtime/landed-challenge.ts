// Whether the page a navigation landed on is a robot check.
//
// The worker judges a navigation by its address and by whether the tab moved
// (`navigation-outcome.ts`), and neither can see what the page says. The
// crossborder marketplace serves its traffic screen at the very address that
// was asked for, so both halves passed and every navigation onto it reported
// `web.action.succeeded`: live runs 15 and 17 (`run-munoeac4-33c17306`,
// `run-munp80f5-c31ea417`) navigated onto it nine to eleven times and ended
// without a Flow. So the landed page's top frame is asked, and it answers with
// `challenge-evidence.ts`'s page reading.
//
// Only a robot check is judged at arrival. The page reading also recognises a
// code prompt, but on its headings alone, and "Two-factor authentication" heads
// an ordinary account settings page; a code prompt stays the person's when an
// action's target is then missing from it, which `content/action-runtime/results.ts`
// already reports.
//
// A page that could not be read is said to be unread, with why, and is never a
// robot check: a frame with no content script, one that answers something else,
// or one that does not answer before the deadline leaves the navigation's
// result standing, and the navigation's validation says the page went unread.
// `attachTabForRecording` has made the top frame's script ready before this
// runs, so a frame that says nothing is one that genuinely could not be read.

import { PAGE_CHALLENGE_MESSAGE } from "../shared/page-challenge-message";

/** How the worker reaches a frame: the runner's own `sendToTab`, handed in. */
export type FrameSender = <TResponse = unknown>(tabId: number, message: unknown, frameId?: number) => Promise<TResponse>;

/** What the landed page's top frame said about the page, or why it said nothing. */
export type LandedPageReading =
  | { kind: "robot_check" }
  | { kind: "no_robot_check" }
  | { kind: "unread"; why: string };

/** The id the browser always gives a tab's main frame. */
const TOP_FRAME_ID = 0;

/**
 * How long the top frame is given to answer. The read is synchronous and
 * bounded, so a frame that is listening answers in milliseconds; this only
 * stops a frame that is not from holding the navigation's result.
 */
const ANSWER_DEADLINE_MS = 1_000;

/** Asks the tab's top frame whether the page it holds is a robot check. */
export async function readLandedPage(tabId: number, send: FrameSender): Promise<LandedPageReading> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<LandedPageReading>((resolve) => {
    timer = setTimeout(() => resolve({ kind: "unread", why: `the top frame did not answer within ${ANSWER_DEADLINE_MS} ms` }), ANSWER_DEADLINE_MS);
  });
  const asked = send<unknown>(tabId, { type: PAGE_CHALLENGE_MESSAGE }, TOP_FRAME_ID).then(readingOf, unreadBecause);
  try {
    return await Promise.race([asked, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

function readingOf(answer: unknown): LandedPageReading {
  const challenge = typeof answer === "object" && answer !== null ? (answer as { challenge?: unknown }).challenge : undefined;
  if (challenge === "captcha") return { kind: "robot_check" };
  if (challenge === null || challenge === "credential") return { kind: "no_robot_check" };
  return { kind: "unread", why: "the top frame gave no answer to the question" };
}

function unreadBecause(error: unknown): LandedPageReading {
  const detail = error instanceof Error ? error.message.trim() : "";
  return { kind: "unread", why: detail ? `the top frame could not be asked: ${detail}` : "the top frame could not be asked" };
}
