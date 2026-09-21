/**
 * The marketplace's fixed clock. Every time on the site -- time left, the day
 * an auction ends, how long ago a listing went up -- is measured from this
 * instant, never from the wall clock, so a run on any day reads the same page
 * and the same answer.
 *
 * The reference is Monday 21 September 2026, 14:00 in the UK, which is British
 * Summer Time (UTC+1). The site states absolute dates wherever a person needs
 * one, so nobody has to know what "today" meant to the fixture.
 */
export const REFERENCE_UTC_MS = Date.UTC(2026, 8, 21, 13, 0, 0);

const BST_OFFSET_MINUTES = 60;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** The UK wall-clock parts of the instant `minutes` after the reference. */
function ukParts(minutes: number): { day: string; date: number; month: string; year: number; hours: string; mins: string } {
  const at = new Date(REFERENCE_UTC_MS + (minutes + BST_OFFSET_MINUTES) * 60_000);
  return {
    day: DAYS[at.getUTCDay()]!,
    date: at.getUTCDate(),
    month: MONTHS[at.getUTCMonth()]!,
    year: at.getUTCFullYear(),
    hours: String(at.getUTCHours()).padStart(2, "0"),
    mins: String(at.getUTCMinutes()).padStart(2, "0"),
  };
}

/** How long an auction has left, as a results card says it: `1d 7h left`, `4h 12m left`, `42m left`. */
export function timeLeftText(minutes: number): string {
  if (minutes >= 1440) return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h left`;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m left`;
  return `${minutes}m left`;
}

/** When an auction ends, as a card puts it in brackets after the time left: `(Tue 22 Sep, 21:14)`. */
export function endLabelText(minutes: number): string {
  const parts = ukParts(minutes);
  return `(${parts.day} ${parts.date} ${parts.month}, ${parts.hours}:${parts.mins})`;
}

/** The listing page's full end time: `Tue, 22 Sep 2026, 21:14 BST`. */
export function endStampText(minutes: number): string {
  const parts = ukParts(minutes);
  return `${parts.day}, ${parts.date} ${parts.month} ${parts.year}, ${parts.hours}:${parts.mins} BST`;
}

/** The reference instant itself, as the footer states it. */
export function referenceStampText(): string {
  return endStampText(0);
}
