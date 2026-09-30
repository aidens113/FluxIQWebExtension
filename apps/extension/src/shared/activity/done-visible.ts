/**
 * How long a finished unit of work ("Flow ready", "Run finished") stays on the
 * page before the overlay fades it. The overlay times its fade by it, and the
 * background stops re-drawing a finished status on a newly loaded page once it
 * has passed, so a status the person already saw fade does not come back on
 * the next navigation. A failure never fades: it stays until new work starts
 * or the person hides the overlay.
 */
export const ACTIVITY_DONE_VISIBLE_MS = 6_000;
