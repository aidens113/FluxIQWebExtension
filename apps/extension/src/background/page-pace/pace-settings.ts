// The numbers the page-load pace keeps (`origin-pace.ts` says what each does).
//
// They are sized on the everything store's limiter, the strictest a Lab site
// has and one a real storefront can plausibly have: more than five results
// pages in eight seconds is refused with a 429, a refused request is not
// counted, and a third refusal in one session flags it for a robot check
// (`apps/scenario-lab/src/scenarios/everything-store/state/throttle.ts`).
//
// - `spacingMs` 2.5 s. A load is refused when five others arrived in the eight
//   seconds before it, which any spacing of 1.6 s or more already prevents.
//   At 2.5 s at most three paced loads precede any load inside a window, so
//   two loads FluxIQ does not pace (a click that submits a search, a page's own
//   redirect) still fit. A person paging through results takes about that long
//   per page, and so does a read: live run `run-muntc23v-7fcc4110` read five
//   results pages in about 11 s, four loads roughly 2.2-2.7 s apart, so an
//   ordinary read waits a few hundred milliseconds at most per page.
// - `refusalWaitMs` 8.5 s. After a 429 or 503 nothing loads on that origin for
//   longer than an 8 s window, measured from when the refusal was seen. It is
//   the same wait the page itself takes before reloading a refused page
//   (`content/extraction/pagination.ts`, `FIRST_RETRY_WAIT_MS`), so the reload
//   that follows it is not held a second time.
// - `cooledSpacingCapMs` 8 s. Each refusal doubles the origin's spacing, 2.5 s
//   to 5 s to 8 s, and it stays there for the rest of the worker's life. At 5 s
//   a single paced load precedes any load inside a window; 8 s is the window
//   itself, past which slower buys nothing and only makes a read time out.

/** The pace's numbers; see the header. */
export type PageLoadPaceSettings = {
  /** The least time between the starts of two loads on one origin that has never refused one. */
  spacingMs: number;
  /** How long after a refusal is seen before the next load on that origin. */
  refusalWaitMs: number;
  /** The most a refusal's doubling may raise an origin's spacing to. */
  cooledSpacingCapMs: number;
};

export const PAGE_LOAD_PACE_SETTINGS: Readonly<PageLoadPaceSettings> = Object.freeze({
  spacingMs: 2_500,
  refusalWaitMs: 8_500,
  cooledSpacingCapMs: 8_000
});
