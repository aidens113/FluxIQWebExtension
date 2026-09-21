import { escapeHtml } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { postingByKey, RESULTS_PATH } from "../catalog/index.js";
import type { JobBoardState, Posting } from "../types.js";
import { paneMarkup } from "./pane.js";
import { searchFormMarkup } from "./results-page.js";
import { boardDocument, classesFor } from "./shell.js";

/** The home page: the search form, a few popular searches, and the widgets every page carries. */
export function renderHomePage(state: JobBoardState, context: RenderContext): string {
  const c = classesFor(context);
  const popular = ["Rust engineer", "Product designer", "Data engineer", "Remote"].map((words) => `<a class="${c.pageLink}" href="${RESULTS_PATH}?q=${encodeURIComponent(words)}">${words}</a>`).join(" ");
  const body = `<h1>Find the role, not the noise</h1>${searchFormMarkup(c, context.seed, { q: "", l: "" })}<p>Popular searches: ${popular}</p>
<div class="${c.panel}"><h2>Your job search, in one place</h2><p>Save jobs you like and find them again under My jobs. Rolefinch shows each employer's own careers site when you apply.</p></div>`;
  return boardDocument({ state, context, kind: "home", title: "Rolefinch - Jobs, salaries and company reviews", body });
}

/** A job's own page: the same pane the results page loads, full width, with no sign-in wall. */
export function renderViewJobPage(state: JobBoardState, context: RenderContext, posting: Posting): string {
  const c = classesFor(context);
  const body = `${searchFormMarkup(c, context.seed, { q: "", l: "" })}<div class="${c.pane}" style="position:static;max-height:none;margin-top:16px">${paneMarkup(c, state, context.seed, posting, false)}</div>`;
  return boardDocument({ state, context, kind: "viewjob", title: `${posting.title} - ${posting.company} - Rolefinch`, body, data: { companies: { [posting.key]: posting.company } } });
}

/** The rate limiter's answer, served with status 429 and a retry-after of five seconds. */
export function renderRateLimitPage(state: JobBoardState, context: RenderContext): string {
  const c = classesFor(context);
  const body = `<div class="${c.notice}"><h1>Hang on a moment</h1><p>We've noticed a lot of searches from this browser in a short time. Please wait a few seconds, then try again.</p><button type="button" class="${c.retry}" disabled>Try again in 5</button></div>`;
  return boardDocument({ state, context, kind: "notice", title: "Too many requests - Rolefinch", body, data: { retryAfter: 5 } });
}

/**
 * The hand-off page an apply link opens in its new tab: Rolefinch counts the
 * click, says where it is sending the person, and forwards them to the
 * employer's careers site two seconds later.
 */
export function renderApplyRedirect(key: string): string | undefined {
  const posting = postingByKey(key);
  if (!posting || posting.apply.kind !== "company") return undefined;
  const target = `/scenarios/job-board/careers/${posting.apply.careersSlug}/jobs/${posting.apply.requisition}`;
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><link rel="icon" href="data:,"><meta http-equiv="refresh" content="2;url=${target}"><title>Leaving Rolefinch</title>
<style>body{font:16px/1.5 "Segoe UI",system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f5f6f8}main{text-align:center}</style></head>
<body><main><p>Taking you to ${escapeHtml(posting.company)}'s careers site to apply for ${escapeHtml(posting.title)}…</p><p><a href="${target}">Continue to ${escapeHtml(posting.company)}</a></p></main></body></html>`;
}
