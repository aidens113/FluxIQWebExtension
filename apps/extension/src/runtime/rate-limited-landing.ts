// A landing the site refused for coming too fast, or while it cannot serve:
// what a navigation (`action-runner.ts`) and a click that took its own tab
// (`click-landing.ts`) both report as `web.action.rate_limited` rather than as
// a page refused for good.
//
// job-board and the everything store serve their rate-limit page as a
// document, at the address asked for, with HTTP 429. Read as a refused page,
// the model was told the navigation or the click went wrong for good, and the
// pace that a paginated read tells of the same refusal
// (`content/extraction/pagination.ts`) never heard of it, so the next load on
// the site went as soon as ever and was refused again.

import {
  PAGE_LOAD_PACE_SETTINGS,
  PAGE_REFUSAL_STATUSES,
  originOf,
  type OriginPace
} from "../background/page-pace";
import type { LandedPageReading } from "./landed-challenge";
import type { ServedStatus } from "./served-status";

/** A landing served 429 or 503: the status, and how long until the same load may be made again. */
export type RateLimitedLanding = { status: number; retryAfterMs: number };

/**
 * A landing the site refused for coming too fast, or while it cannot serve
 * (429, 503 -- `PAGE_REFUSAL_STATUSES`), told to the pace of the origin it
 * landed on, and answered with the wait before the same load may be made
 * again; undefined for any other landing.
 *
 * - A robot check is judged first and stays the person's, whatever it was
 *   served with, and is not told to the pace: it is not a refusal to wait out.
 * - The wait is the one the pace now imposes on the origin's next load, which a
 *   refusal sets to at least `refusalWaitMs` from now. Without a pace, or for a
 *   landed address that is not paced, it is that same `refusalWaitMs` -- the
 *   pagination's first retry wait (`FIRST_RETRY_WAIT_MS`, 8.5 s), which
 *   `pace-settings.ts` keeps equal to it.
 */
export function noteRateLimitedLanding(
  landed: string | undefined,
  reading: LandedPageReading | undefined,
  served: ServedStatus | undefined,
  pace: OriginPace | undefined
): RateLimitedLanding | undefined {
  if (reading?.kind === "robot_check" || served === undefined || !("status" in served)) return undefined;
  if (!PAGE_REFUSAL_STATUSES.has(served.status)) return undefined;
  const origin = originOf(landed);
  if (pace === undefined || origin === undefined) return { status: served.status, retryAfterMs: PAGE_LOAD_PACE_SETTINGS.refusalWaitMs };
  pace.noteRefusal(origin, served.status);
  return { status: served.status, retryAfterMs: pace.waitBeforeNextLoad(origin) };
}
