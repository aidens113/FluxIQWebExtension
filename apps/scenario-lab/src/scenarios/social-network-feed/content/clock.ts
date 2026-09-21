/**
 * The site's fixed "now": Monday 21 September 2026, 09:00 UTC.
 *
 * Every timestamp on the page is measured from here rather than the wall
 * clock, so a run at any real hour reads the same page, and a post the run
 * itself creates is stamped with this moment, which is what lets an
 * expectation name its date exactly.
 */
export const REFERENCE_NOW_MS = Date.UTC(2026, 8, 21, 9, 0);

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1_440;
const DAYS_SHOWN_AS_COUNT = 7;

/**
 * The moment in full, as the timestamp link's label and hover card give it:
 * "Monday 21 September 2026 at 07:42". Written from UTC parts, never a locale
 * format, so the text does not move with the machine serving the lab.
 */
export function fullDateText(minutesAgo: number): string {
  const at = moment(minutesAgo);
  return `${WEEKDAYS[at.getUTCDay()]} ${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]} ${at.getUTCFullYear()} at ${clock(at)}`;
}

/**
 * The short label a feed shows beside the author: "Just now", "34m", "5h",
 * "3d", then "12 September at 09:12" once the post is a week old. It is what a
 * person reads, and it names no single moment, which is why an export asks for
 * the full date instead.
 */
export function shortDateText(minutesAgo: number): string {
  if (minutesAgo < 1) return "Just now";
  if (minutesAgo < MINUTES_PER_HOUR) return `${minutesAgo}m`;
  if (minutesAgo < MINUTES_PER_DAY) return `${Math.floor(minutesAgo / MINUTES_PER_HOUR)}h`;
  const days = Math.floor(minutesAgo / MINUTES_PER_DAY);
  if (days < DAYS_SHOWN_AS_COUNT) return `${days}d`;
  const at = moment(minutesAgo);
  return `${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]} at ${clock(at)}`;
}

function moment(minutesAgo: number): Date {
  return new Date(REFERENCE_NOW_MS - minutesAgo * 60_000);
}

function clock(at: Date): string {
  return `${String(at.getUTCHours()).padStart(2, "0")}:${String(at.getUTCMinutes()).padStart(2, "0")}`;
}
