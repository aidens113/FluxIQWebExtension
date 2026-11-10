// One pace for the page loads FluxIQ causes on each site, held in the worker so
// it outlives every document it paces.
//
// Live run `run-muntc23v-7fcc4110`: the model re-ran its paginating extraction
// about ten times, five results pages each, back to back, and each dry run
// replayed the draft again. Every read began with no memory of the one before
// it, so nothing spaced one read's loads from the next one's; the everything
// store answered a 429 mid-read, then flagged the session and put its robot
// check in front of every page, and every dry-run reset after that failed. The
// page already waits out a refusal within one read (`content/extraction/
// pagination.ts`); what no document can hold is the time since this site last
// loaded, or that it refused one.
//
// So every load is booked here first, by its origin, and paced on evidence:
// - an origin that has never refused a load is not paced at all;
// - a 429 or 503 from the origin holds its next load until `refusalWaitMs`
//   after the refusal was seen, and from then on each load waits until the
//   origin's spacing after the previous one's start, the booking time, whether
//   that load was a page of the same read or not. The first refusal sets the
//   spacing to twice `spacingMs`, where a pace that had held the base spacing
//   all along stood after a refusal, and each later one doubles it up to
//   `cooledSpacingCapMs`, for the rest of the worker's life -- a site that
//   refused once is paced as one that will again.
// Origins never slow each other.
//
// Until 2026-11-10 every origin was paced from its first load, refusal or not
// (t194 w10), so a site that limits nothing paid up to 2.5 s before each
// navigation of a replay (task speed S10,
// `docs/working/task-speed-plan/reports/instant-actions-2.md`). The store this
// was sized on refuses its sixth load in eight seconds and flags the session at
// its third refusal; paced from its first refusal, with the hold and this
// back-off, it refuses at most twice (`tests/store-limiter-reads.test.ts`).
// The standing rule for a rate limit (user, 2026-10-09) is the same shape: wait
// it out, then go on slower.
//
// Pure apart from the injected clock: no browser API. Nothing of a page is
// read here -- a status and an origin are all a booking is given.

import { PAGE_LOAD_PACE_SETTINGS, type PageLoadPaceSettings } from "./pace-settings";
import { PAGE_REFUSAL_STATUSES } from "./refusal-statuses";

/** What the pace holds for one origin. */
type OriginState = {
  /** The earliest the next load on the origin may start. */
  nextAt: number;
  spacingMs: number;
  refusals: number;
};

export class OriginPace {
  private readonly origins = new Map<string, OriginState>();

  constructor(
    private readonly settings: Readonly<PageLoadPaceSettings> = PAGE_LOAD_PACE_SETTINGS,
    private readonly now: () => number = Date.now
  ) {}

  /**
   * Books the next load on `origin` and answers how long to wait before
   * starting it: 0 when it may go now. The booking is the promise that it
   * starts then, so the load after it is spaced from it.
   */
  reserve(origin: string): number {
    const now = this.now();
    const state = this.stateOf(origin);
    const startAt = Math.max(now, state.nextAt);
    state.nextAt = startAt + state.spacingMs;
    return startAt - now;
  }

  /**
   * Notes that `origin` answered a load with `status`. Only 429 and 503 are
   * refusals: they hold the origin's next load until the refusal is waited out
   * and pace it for good, the first at twice `spacingMs` and each later one
   * twice as slow again (see the header). Anything else changes nothing.
   */
  noteRefusal(origin: string, status: number): boolean {
    if (!PAGE_REFUSAL_STATUSES.has(status)) return false;
    const state = this.stateOf(origin);
    state.refusals += 1;
    // Backed off as a pace that had held the base spacing all along would be: twice it at the first refusal.
    state.spacingMs = Math.min(this.settings.cooledSpacingCapMs, Math.max(2 * this.settings.spacingMs, state.spacingMs * 2));
    state.nextAt = Math.max(state.nextAt, this.now() + this.settings.refusalWaitMs);
    return true;
  }

  /**
   * How long the next load on `origin` would wait if it were booked now: 0 for
   * an origin with nothing booked, or whose hold is already over. Reading it
   * books nothing. A navigation the site refused reports it as the wait before
   * the same load may be made again (`runtime/action-runner.ts`).
   */
  waitBeforeNextLoad(origin: string): number {
    const state = this.origins.get(origin);
    return state === undefined ? 0 : Math.max(0, state.nextAt - this.now());
  }

  /** The spacing `origin` is paced at now: none until it has refused a load. */
  spacingOf(origin: string): number {
    return this.origins.get(origin)?.spacingMs ?? 0;
  }

  /** The refusals `origin` has answered with since the pace began. */
  refusalsOf(origin: string): number {
    return this.origins.get(origin)?.refusals ?? 0;
  }

  private stateOf(origin: string): OriginState {
    let state = this.origins.get(origin);
    if (state === undefined) {
      state = { nextAt: Number.NEGATIVE_INFINITY, spacingMs: 0, refusals: 0 };
      this.origins.set(origin, state);
    }
    return state;
  }
}
