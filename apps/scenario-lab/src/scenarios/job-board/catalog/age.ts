/**
 * The board's clock. Every age a card shows and every date a job pane prints
 * is measured from this fixed moment, never the wall clock, so a run at any
 * hour of any day reads the same page.
 */
export const REFERENCE_NOW_MS = Date.UTC(2026, 8, 21, 8, 0, 0);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

/** What a result card says about how old a posting is, in the words job boards use. */
export function postedAgeText(hours: number): string {
  if (hours < 6) return "Just posted";
  if (hours < 24) return "Today";
  const days = Math.floor(hours / 24);
  if (days >= 30) return "Posted 30+ days ago";
  return `Posted ${days} day${days === 1 ? "" : "s"} ago`;
}

/** The date a job pane prints, British style: "18 September 2026". */
export function postedDateText(hours: number): string {
  const date = new Date(REFERENCE_NOW_MS - hours * 3_600_000);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** The date a Talentloom confirmation prints for an application sent at the reference time. */
export const SUBMITTED_DATE_TEXT = postedDateText(0);
