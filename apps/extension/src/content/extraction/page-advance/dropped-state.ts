// What a page control's address leaves out of the narrowing the page it is on
// shows applied: a filter or a sort the list keeps in its address that
// following the control would lose.
//
// A store's results page filtered to one seller and to pickup drew its Next
// with an older helper that knew only the search and the page number, so Next
// led to page two of the whole unfiltered search while its page numbers kept
// every filter. A next-page step followed Next, read pages two and three of
// the wrong list and still answered `moved` (A8 wave 5, bigbox-retail towels,
// both runs). So a control is compared with the page before it is followed
// (`./follow-next.ts`).
//
// **Only what the control drops counts.** A parameter the page carries is
// dropped when the address has no value for it, or, for a parameter the page
// carries more than once (a filter with several values ticked), when it leaves
// out one of those values. A parameter the address changes is not dropped: the
// page number changes from page to page, and so does a cursor that pages
// through an opaque token, so a changed value says nothing a comparison of two
// addresses could tell apart from paging. A parameter the address adds -- the
// page number, on a first page that carried none -- is not dropped either.
// Ignored as well: an empty parameter, which narrows nothing, and the
// parameter that holds the number of the page the pager marks current, which
// a control may carry under another name (an offset in place of a page).
//
// **And only what the page shows applied** (t623 follow-up). An address also
// carries what narrows nothing -- a tracking tag the page arrived with, a
// referrer -- and a Next that drops one is a working Next: failing it would
// stop a read on page one of an ordinary site. So a dropped parameter counts
// only when a control the page shows as applied (`./applied-controls.ts`: a
// checked checkbox or radio, a selected option, a pressed toggle) carries its
// name, or a value that is one of the parameter's values or a whole part of
// one -- the store above keeps every ticked filter in one parameter,
// `seller:ValueRidge||fulfillment:Pickup`, and each checkbox's value is one
// part of it. A part is bounded by characters that are not letters or digits,
// and is compared without case; a part shorter than three characters must be
// the whole value, so a radio worth `1` is not read inside `sr_pg_1`.
//
// No parameter is known by name: what is compared is the two addresses' own
// query and the page's own controls, so a site whose controls keep all of it
// is unchanged. Names and values are read only to compare them; the answer is
// a count, and no word of the address or the page is carried anywhere.

import type { AppliedControl } from "./applied-controls";

/** The shortest value of a control matched as a part of a parameter's value rather than the whole of it. */
const MIN_PART_LENGTH = 3;

/**
 * How many query parameters of `here`, the page's own address, that the page
 * shows applied through `applied`, `target` leaves out (see the header).
 * `currentPage` is the number the pager marks current, when it marks one.
 */
export function droppedQueryState(target: URL, here: URL, currentPage: number | undefined, applied: readonly AppliedControl[]): number {
  let dropped = 0;
  for (const name of new Set(here.searchParams.keys())) {
    const carried = here.searchParams.getAll(name).filter((value) => value.trim() !== "");
    if (carried.length === 0) continue;
    if (carried.length === 1 && currentPage !== undefined && carried[0]?.trim() === String(currentPage)) continue;
    const kept = target.searchParams.getAll(name);
    const lost = carried.length === 1 ? kept.length === 0 : carried.some((value) => !kept.includes(value));
    if (lost && shownApplied(name, carried, applied)) dropped += 1;
  }
  return dropped;
}

/** Whether a control the page shows applied carries this parameter's name, or one of its values or a part of one. */
function shownApplied(name: string, values: readonly string[], applied: readonly AppliedControl[]): boolean {
  const wanted = name.toLowerCase();
  return applied.some(({ name: shownName, value: shownValue }) => shownName?.toLowerCase() === wanted
    || (shownValue !== undefined && values.some((value) => holdsPart(value, shownValue))));
}

function holdsPart(value: string, part: string): boolean {
  const whole = value.trim().toLowerCase();
  const sought = part.toLowerCase();
  if (whole === sought) return true;
  if (sought.length < MIN_PART_LENGTH) return false;
  for (let at = whole.indexOf(sought); at !== -1; at = whole.indexOf(sought, at + 1)) {
    if (!isWordCharacter(whole[at - 1]) && !isWordCharacter(whole[at + sought.length])) return true;
  }
  return false;
}

function isWordCharacter(character: string | undefined): boolean {
  return character !== undefined && /[\p{L}\p{N}]/u.test(character);
}
