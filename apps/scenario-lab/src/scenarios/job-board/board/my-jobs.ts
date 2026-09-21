import { escapeHtml } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { POSTINGS } from "../catalog/index.js";
import type { JobBoardState, Posting } from "../types.js";
import { viewJobHref } from "./card.js";
import { CLOSED_STATUS, isPostingOpen } from "./pane.js";
import { boardDocument, classesFor, HEART_SVG } from "./shell.js";

/** The saved list, newest posting first: the order the board sorts it in, whatever order the jobs were saved in. */
export function savedPostings(state: JobBoardState): Posting[] {
  return POSTINGS.filter((posting) => state.saved.includes(posting.key)).sort((a, b) => a.postedHours - b.postedHours);
}

/** The status a saved job shows under the armed rendering. */
export function savedStatus(state: JobBoardState, posting: Posting): string {
  return isPostingOpen(state, posting) ? "Accepting applications" : CLOSED_STATUS;
}

/** The line above the saved list. */
export function savedSummaryText(count: number): string {
  return `${count} saved job${count === 1 ? "" : "s"}`;
}

/** The saved list as its text reads, row by row: title, company, location and status run together, as the markup has them. */
export function savedListText(state: JobBoardState): string {
  return savedPostings(state).map((posting) => `${posting.title}${posting.company}${posting.location}${savedStatus(state, posting)}`).join("");
}

/**
 * My jobs. The saved tab is the one place the board states what is saved, so
 * the summary and the list carry the fixture's oracle ids; the list is sorted
 * by posting date, so its order never depends on the order jobs were saved.
 */
export function renderMyJobsPage(state: JobBoardState, context: RenderContext): string {
  const c = classesFor(context);
  const saved = savedPostings(state);
  const rows = saved.map((posting) => `<li class="${c.savedRow}" data-jk="${posting.key}"><a href="${viewJobHref(posting)}">${escapeHtml(posting.title)}</a><span>${escapeHtml(posting.company)}</span><span>${escapeHtml(posting.location)}</span><span class="${c.status}">${savedStatus(state, posting)}</span><span class="${c.heart} ${c.heartOn}">${HEART_SVG}</span></li>`).join("");
  const body = `<h1>My jobs</h1>
<nav class="${c.tabs}"><a class="${c.tab} ${c.tabOn}" href="#">Saved</a><a class="${c.tab}" href="#">Applied</a><a class="${c.tab}" href="#">Interviews</a><a class="${c.tab}" href="#">Archived</a></nav>
<p class="${c.savedSummary}" data-testid="saved-summary">${savedSummaryText(saved.length)}</p>
<ol class="${c.savedList}" data-testid="saved-list">${rows}</ol>`;
  return boardDocument({ state, context, kind: "myjobs", title: "My jobs - Rolefinch", body, data: { companies: Object.fromEntries(saved.map((posting) => [posting.key, posting.company])) } });
}
