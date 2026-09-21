import { escapeHtml } from "../../../html.js";
import { adKey, postedAgeText } from "../catalog/index.js";
import type { JobBoardState, Posting } from "../types.js";
import { rotatingId, type BoardClasses } from "./classes.js";
import { HEART_SVG } from "./shell.js";

export const VIEW_JOB_PATH = "/scenarios/job-board/viewjob";
export const AD_CLICK_PATH = "/scenarios/job-board/pagead/clk";

/** The address of a posting's own page, which is what a card's title links to. */
export function viewJobHref(posting: Posting): string {
  return `${VIEW_JOB_PATH}?jk=${posting.key}`;
}

/**
 * One result card. An organic card carries the job key, as job boards do; a
 * sponsored one carries an ad id instead, links through the ad-click
 * redirect, and says "Sponsored" in small grey type at its foot -- otherwise
 * the two are the same card, down to the salary line and the heart.
 *
 * The heart saves the job. Once the redesign ships (`overflow-save`) the very
 * same heart follows the company instead, and it is filled when the company is
 * followed rather than when the job is saved.
 */
export function cardMarkup(c: BoardClasses, state: JobBoardState, seed: number, posting: Posting, sponsored: boolean): string {
  const filled = state.mode === "overflow-save" ? state.follows.includes(posting.company) : state.saved.includes(posting.key);
  const identity = sponsored ? `data-ad="${adKey(posting)}"` : `data-jk="${posting.key}"`;
  const href = sponsored ? `${AD_CLICK_PATH}?ad=${adKey(posting)}` : viewJobHref(posting);
  const easy = posting.apply.kind === "easy" ? `<span class="${c.tag}">Easily apply</span>` : "";
  const flag = sponsored ? `<span>Sponsored</span>` : "";
  return `<li class="${c.item}"><article class="${c.card}" ${identity} id="${rotatingId(seed, sponsored ? "pj" : "job", posting.key)}">`
    + `<div class="${c.cardHead}"><h2 class="${c.cardTitle}"><a href="${href}" id="${rotatingId(seed, "jobTitle", posting.key)}">${escapeHtml(posting.title)}</a></h2>`
    + `<span class="${c.heart}${filled ? ` ${c.heartOn}` : ""}">${HEART_SVG}</span></div>`
    + `<div class="${c.cardCompany}"><span>${escapeHtml(posting.company)}</span><span>${escapeHtml(posting.location)}</span></div>`
    + `<div class="${c.cardSalary}">${escapeHtml(posting.salary.text)}</div>`
    + `<div class="${c.cardTags}"><span class="${c.tag}">${posting.jobType}</span>${easy}</div>`
    + `<ul class="${c.cardSnippet}"><li>${escapeHtml(posting.snippet)}</li></ul>`
    + `<footer class="${c.cardFoot}"><span>${postedAgeText(posting.postedHours)}</span>${flag}</footer>`
    + `</article></li>`;
}
