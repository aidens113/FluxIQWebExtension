/**
 * The site's fixed "now": 21 September 2026, 09:00 UTC. Every age on the site
 * is measured from it rather than from the wall clock, so a run on any day
 * reads the same page.
 */
export const REFERENCE_NOW_MS = Date.UTC(2026, 8, 21, 9, 0, 0);

const DAY_MS = 86_400_000;

/** The instant an invitation `days` old went out, as the page's `datetime` attribute carries it. */
export function sentAtIso(days: number): string {
  return new Date(REFERENCE_NOW_MS - days * DAY_MS - 3_600_000).toISOString();
}

/**
 * The age a relative-time element prints for `datetime`, as the site words
 * it: today, yesterday, days, weeks, then months. Twenty-eight days is "4
 * weeks ago", never a month. The function is self-contained on purpose: the
 * page's client script embeds its source (`timeAgoSource`), so the server and
 * the browser cannot word an age differently.
 */
export function timeAgoLabel(datetime: string, nowMs: number): string {
  const days = Math.floor((nowMs - Date.parse(datetime)) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return days + " days ago";
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? "1 week ago" : weeks + " weeks ago";
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return months === 1 ? "1 month ago" : months + " months ago";
  }
  const years = Math.floor(days / 365);
  return years === 1 ? "1 year ago" : years + " years ago";
}

/** `timeAgoLabel` as client script source, bound to the site's reference time. */
export function timeAgoSource(): string {
  return `const REFERENCE_NOW_MS = ${REFERENCE_NOW_MS};\nconst timeAgoLabel = ${timeAgoLabel.toString()};`;
}
