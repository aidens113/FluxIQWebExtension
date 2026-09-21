/**
 * The results pages' rate limiter.
 *
 * More than five results pages in eight seconds is faster than anyone reads
 * them, and the sixth is refused with a 429 and a `Retry-After` saying how
 * long until the window has room again. A refused request is not counted, so
 * waiting as asked always works. Three refusals in one session and the store
 * stops asking: it flags the session and puts the robot check in front of
 * everything.
 */
export const STORE_THROTTLE = {
  windowMs: 8_000,
  limit: 5,
  refusalsBeforeFlag: 3,
  /** Whether a results page requested at `now` is served, and if not, how many seconds to wait. */
  decide(loads: readonly number[], now: number): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
    const recent = loads.filter((at) => at > now - STORE_THROTTLE.windowMs && at <= now).sort((left, right) => left - right);
    if (recent.length < STORE_THROTTLE.limit) return { allowed: true };
    const oldest = recent[recent.length - STORE_THROTTLE.limit] ?? now;
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((oldest + STORE_THROTTLE.windowMs - now) / 1000)) };
  },
} as const;
