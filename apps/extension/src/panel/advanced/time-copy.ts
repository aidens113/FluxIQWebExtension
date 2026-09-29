// How long ago something happened, for the Advanced view's "Last activity" and
// "Started" lines. Computed from `now`, so a caller that re-renders on a timer
// keeps it current (audit defect S3: "Now" and "5s" used to freeze at render).

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** `at` relative to `now`: "just now", "12s ago", "3m ago", "2h ago", or the date for anything older than a day. */
export function relativeTime(at: number, now: number, formatDate: (at: number) => string = defaultDate): string {
  const elapsed = now - at;
  if (elapsed < 5_000) return "just now";
  if (elapsed < MINUTE) return `${Math.floor(elapsed / 1_000)}s ago`;
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;
  return formatDate(at);
}

function defaultDate(at: number): string {
  return new Date(at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
