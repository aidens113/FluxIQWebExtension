/**
 * British formatting, written out by hand rather than through `Intl`, so the
 * server, the manifest and a browser's own locale can never disagree about a
 * price or a date. The site is British: money is `£1,787.50`, and a short date
 * is day first, `05/10` for 5 October, which is the reading an American
 * default gets wrong.
 */
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

export function formatPence(pence: number): string {
  const pounds = Math.floor(pence / 100);
  const rest = String(pence % 100).padStart(2, "0");
  return `£${String(pounds).replace(/\B(?=(\d{3})+(?!\d))/gu, ",")}.${rest}`;
}

/** `Monday 5 October 2026`, as a confirmation page spells a date. */
export function longDate(iso: string): string {
  const date = parseIso(iso);
  return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** `Mon 05/10`, as the booking calendar heads a day's column. */
export function shortDay(iso: string): string {
  const date = parseIso(iso);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${WEEKDAYS[date.getUTCDay()]!.slice(0, 3)} ${day}/${month}`;
}

/** 0 for Sunday through 6 for Saturday. */
export function weekday(iso: string): number {
  return parseIso(iso).getUTCDay();
}

/** The ISO date `days` after `iso`. */
export function addDays(iso: string, days: number): string {
  const date = parseIso(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseIso(iso: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(iso)) throw new Error(`Not an ISO date: ${iso}`);
  return new Date(`${iso}T00:00:00Z`);
}
