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
// So every load is booked here first, by its origin:
// - the first load on an origin goes at once;
// - each later one waits until `spacingMs` after the previous one's start, the
//   booking time, whether that load was a page of the same read or not;
// - a 429 or 503 from the origin holds its next load until `refusalWaitMs`
//   after the refusal was seen, and doubles its spacing up to
//   `cooledSpacingCapMs`, for the rest of the worker's life -- a site that
//   refused once is paced as one that will again.
// A site that never refuses only ever pays the base spacing, and only when its
// loads come closer together than that; origins never slow each other.
//
// Pure apart from the injected clock: no browser API. Nothing of a page is
// read here -- a status and an origin are all a booking is given.

import { PAGE_LOAD_PACE_SETTINGS, type PageLoadPaceSettings } from "./pace-settings";

/** What the pace holds for one origin. */
type OriginState = {
  /** The earliest the next load on the origin may start. */
  nextAt: number;
  spacingMs: number;
  refusals: number;
};

/** The statuses that say the site refused a load for coming too fast or while it cannot serve one. */
const REFUSAL_STATUSES: ReadonlySet<number> = new Set([429, 503]);

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
   * and slow it for good (see the header). Anything else changes nothing.
   */
  noteRefusal(origin: string, status: number): boolean {
    if (!REFUSAL_STATUSES.has(status)) return false;
    const state = this.stateOf(origin);
    state.refusals += 1;
    state.spacingMs = Math.min(this.settings.cooledSpacingCapMs, Math.max(state.spacingMs, state.spacingMs * 2));
    state.nextAt = Math.max(state.nextAt, this.now() + this.settings.refusalWaitMs);
    return true;
  }

  /** The spacing `origin` is paced at now. */
  spacingOf(origin: string): number {
    return this.origins.get(origin)?.spacingMs ?? this.settings.spacingMs;
  }

  /** The refusals `origin` has answered with since the pace began. */
  refusalsOf(origin: string): number {
    return this.origins.get(origin)?.refusals ?? 0;
  }

  private stateOf(origin: string): OriginState {
    let state = this.origins.get(origin);
    if (state === undefined) {
      state = { nextAt: Number.NEGATIVE_INFINITY, spacingMs: this.settings.spacingMs, refusals: 0 };
      this.origins.set(origin, state);
    }
    return state;
  }
}
