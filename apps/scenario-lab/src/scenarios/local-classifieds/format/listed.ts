/** The marketplace's fixed "now": every listing's age is measured from here, never from the wall clock. */
export const REFERENCE_NOW_MS = Date.UTC(2026, 8, 21, 12, 0, 0);

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

/** How long ago a listing went up, in the words the listing page uses. */
export function listedText(hours: number): string {
  if (hours < 1) return "Listed just now";
  if (hours < 24) return `Listed ${hours} hour${hours === 1 ? "" : "s"} ago`;
  if (hours < 48) return "Listed yesterday";
  if (hours < 168) return `Listed ${Math.floor(hours / 24)} days ago`;
  if (hours < 336) return "Listed 1 week ago";
  if (hours < 720) return `Listed ${Math.floor(hours / 168)} weeks ago`;
  return "Listed over a month ago";
}

/** The day a listing went up, spelled out the British way: "Saturday 19 September 2026". */
export function listedOn(hours: number): string {
  const date = new Date(REFERENCE_NOW_MS - hours * 3_600_000);
  return `${DAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
