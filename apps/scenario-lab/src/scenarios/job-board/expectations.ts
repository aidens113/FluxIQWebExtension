import { savedListText, savedSummaryText, viewJobHref } from "./board/index.js";
import { availablePostings } from "./catalog/index.js";
import { createJobBoardState } from "./state.js";
import type { JobBoardMode, JobBoardState, Posting } from "./types.js";

/**
 * The answer to "every job with Rust in its title that is fully remote and
 * based in the UK, whose advertised yearly salary starts at £70,000 or more",
 * newest first -- decided from the postings themselves, never from what any
 * search or page shows. A range starting at £69,500, a ceiling with no floor,
 * a day rate, no salary, a remote role in Europe or the US, "Trust" in a
 * title, and a Rust manager's title without the word all fall out here.
 */
export function remoteRustRoles(mode: JobBoardMode): Posting[] {
  return availablePostings(mode)
    .filter((posting) => /\bRust\b/u.test(posting.title) && posting.location === "Remote (UK)" && !posting.closed)
    .filter(({ salary }) => salary.period === "year" && salary.currency === "GBP" && salary.min !== null && salary.min >= 70_000)
    .sort((a, b) => a.postedHours - b.postedHours);
}

/** What the extraction task's table holds for `mode`: the posting's title, company, salary line as printed, and its own page's address. */
export function remoteRustRecords(mode: JobBoardMode): Array<Record<string, string>> {
  return remoteRustRoles(mode).map((posting) => ({ title: posting.title, company: posting.company, salary: posting.salary.text, link: viewJobHref(posting) }));
}

/** Every job Halvard Systems -- not Halvard Labs, not a job that merely mentions it -- posted in the last seven days. */
export function halvardWeek(): Posting[] {
  return availablePostings("baseline").filter((posting) => posting.company === "Halvard Systems" && posting.postedHours <= 7 * 24 && !posting.closed);
}

/** The board after the shortlist task is done right: the two jobs already saved, plus every one of the week's Halvard Systems jobs. */
export function stateAfterShortlist(mode: JobBoardMode): JobBoardState {
  const state = createJobBoardState(mode);
  return { ...state, saved: [...new Set([...state.saved, ...halvardWeek().map((posting) => posting.key)])] };
}

/** The saved tab's summary and list once the shortlist is done right, which is the state-changing task's oracle. */
export function shortlistFacts(mode: JobBoardMode) {
  const state = stateAfterShortlist(mode);
  return [
    { id: "saved-summary", subject: "saved-summary", predicate: "text", value: savedSummaryText(state.saved.length) },
    { id: "saved-list", subject: "saved-list", predicate: "text", value: savedListText(state) },
  ];
}
