import { escapeHtml } from "../../../html.js";
import { companyByName, postedDateText, postingById } from "../catalog/index.js";
import type { JobBoardState, Posting } from "../types.js";
import { rotatingId, type BoardClasses } from "./classes.js";
import { viewJobHref } from "./card.js";
import { HEART_SVG } from "./shell.js";

export const APPLY_REDIRECT_PATH = "/scenarios/job-board/rc/clk";

/** The status line a closed posting shows in place of its apply control, on its pane and on the saved list. */
export const CLOSED_STATUS = "No longer accepting applications";

/** Whether `posting` takes applications under the armed rendering. */
export function isPostingOpen(state: JobBoardState, posting: Posting): boolean {
  return !posting.closed && !(state.mode === "posting-closed" && posting.id === "m1");
}

/** The roles a closed Quillmark posting points to: the same title on contract, in the London office, and at a different company. */
const SIMILAR_TO_CLOSED = ["d12", "h1", "d15"] as const;

/**
 * A job's pane: the fragment the results page loads beside the list, and the
 * body of the job's own page. `wall` lays the sign-in prompt over it, which is
 * what the board does from the fourth job a visitor opens until they say "Not
 * now".
 *
 * Its controls are the ones a board ships: the apply link, which opens the
 * employer's careers site in a new tab; Rolefinch's own quick apply; and the
 * heart. After the redesign (`overflow-save`) the heart follows the company
 * and saving the job lives in the unlabelled "More actions" button's menu.
 */
export function paneMarkup(c: BoardClasses, state: JobBoardState, seed: number, posting: Posting, wall: boolean): string {
  const company = companyByName(posting.company);
  const open = isPostingOpen(state, posting);
  const redesigned = state.mode === "overflow-save";
  const filled = redesigned ? state.follows.includes(posting.company) : state.saved.includes(posting.key);
  const salary = posting.salary.text ? `<span>${escapeHtml(posting.salary.text)}</span> · ` : "";
  const apply = !open
    ? `<div class="${c.closed}" data-testid="posting-status">${CLOSED_STATUS}</div>`
    : posting.apply.kind === "company"
      ? `<a class="${c.applyButton}" href="${APPLY_REDIRECT_PATH}?jk=${posting.key}" target="_blank" rel="noopener">Apply on company site<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/></svg></a>`
      : `<button type="button" class="${c.easyButton}">Easily apply</button>`;
  const heart = open ? `<span class="${c.heart}${filled ? ` ${c.heartOn}` : ""}">${HEART_SVG}</span>` : "";
  const saved = state.saved.includes(posting.key);
  const more = redesigned && open
    ? `<div class="${c.moreButton}">···</div><div class="${c.menu}" hidden><div class="${c.menuItem}">${saved ? "Unsave job" : "Save job"}</div><div class="${c.menuItem}">Not interested</div><div class="${c.menuItem}">Report job</div></div>`
    : "";
  const similar = open || posting.id !== "m1" ? "" : `<h3>Similar jobs</h3><div class="${c.similar}">${SIMILAR_TO_CLOSED.map((id) => postingById(id)).map((entry) => `<a href="${viewJobHref(entry)}">${escapeHtml(entry.title)} · ${escapeHtml(entry.company)} · ${escapeHtml(entry.location)}</a>`).join("")}</div>`;
  const reference = posting.apply.kind === "company" ? posting.apply.requisition : posting.key.slice(0, 8).toUpperCase();
  const overlay = wall ? wallMarkup(c) : "";
  return `<div class="${c.paneRoot}" data-jk="${posting.key}" id="${rotatingId(seed, "vj", posting.key)}">`
    + `<div class="${c.paneHead}"><h2 class="${c.paneTitle}">${escapeHtml(posting.title)}</h2>`
    + `<div class="${c.paneCompany}"><a href="#">${escapeHtml(posting.company)}</a> <span>${company.rating} ★</span></div>`
    + `<div class="${c.paneMeta}">${escapeHtml(posting.location)}</div>`
    + `<div class="${c.paneMeta}">${salary}${posting.jobType}</div>`
    + `<div class="${c.paneActions}">${apply}${heart}${more}</div></div>`
    + `<div class="${c.paneBody}"><h3>Job details</h3><p>Pay: ${escapeHtml(posting.salary.text || "Not listed")}<br>Job type: ${posting.jobType}<br>Location: ${escapeHtml(posting.location)}</p>`
    + `<h3>Full job description</h3>${posting.description.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}${similar}</div>`
    + `<div class="${c.paneFoot}">Posted on ${postedDateText(posting.postedHours)} · Job reference ${escapeHtml(reference)}</div>`
    + overlay
    + `</div>`;
}

function wallMarkup(c: BoardClasses): string {
  return `<div class="${c.wall}"><div class="${c.wallCard}"><h3>See more jobs with a free account</h3><p>Sign in to Rolefinch to keep browsing job details, save searches and apply faster.</p>`
    + `<button type="button" class="${c.wallButton}">Continue with email</button><button type="button" class="${c.wallButton}">Sign in</button>`
    + `<a href="#" class="${c.wallLater}">Not now</a></div></div>`;
}
