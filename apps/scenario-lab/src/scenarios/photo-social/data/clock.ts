/**
 * Framelight's clock. Every relative label on the site is measured from this
 * fixed instant rather than the wall clock, so a run on any day reads the same
 * page: "1w" under a comment always means the same week.
 */
export const REFERENCE_NOW_MS = Date.UTC(2026, 9, 4, 9, 0, 0);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
const DAY_MS = 86_400_000;

/** A post goes out at noon UTC on its day. */
export function postInstant(date: string): string {
  return `${date}T12:00:00.000Z`;
}

function parts(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return { year, month, day };
}

function daysAgo(date: string): number {
  const { year, month, day } = parts(date);
  return Math.floor((REFERENCE_NOW_MS - Date.UTC(year, month - 1, day, 12)) / DAY_MS);
}

/** "August 21, 2026": the long form automatic alt text uses. */
export function longDate(date: string): string {
  const { year, month, day } = parts(date);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

/** "Aug 21, 2026": the tooltip a timestamp carries. */
export function tooltipDate(date: string): string {
  const { year, month, day } = parts(date);
  return `${MONTHS[month - 1]!.slice(0, 3)} ${day}, ${year}`;
}

/**
 * The label under a post: "4 days ago" inside a week, "August 21" earlier in
 * the same year, "August 14, 2025" before that.
 */
export function postDateLabel(date: string): string {
  const days = daysAgo(date);
  if (days < 1) return "Today";
  if (days < 7) return days === 1 ? "1 day ago" : `${days} days ago`;
  const { year, month, day } = parts(date);
  return year === 2026 ? `${MONTHS[month - 1]} ${day}` : `${MONTHS[month - 1]} ${day}, ${year}`;
}

/** The compact age a feed header or a comment shows: "6d" inside a week, then whole weeks. */
export function shortAge(date: string): string {
  const days = daysAgo(date);
  if (days < 1) return "1h";
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}
