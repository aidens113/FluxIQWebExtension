import type { RenderContext, ScenarioRouteRequest, ScenarioRouteResponse } from "../../types.js";
import { EMBED_CSP, renderApplicationForm, renderCareersIndex, renderCareersJobPage, renderConfirmation, renderEmbedClosed, suggestPlaces } from "./ats/index.js";
import { adKey, parseSearchQuery, POSTINGS, postingByKey } from "./catalog/index.js";
import { classesFor, isPostingOpen, paneMarkup, renderApplyRedirect, renderMyJobsPage, renderRateLimitPage, renderResultsPage, renderViewJobPage, viewJobHref } from "./board/index.js";
import type { JobBoardState } from "./types.js";

/** Every sixth results page the board serves is refused as too many requests, with a retry-after of five seconds. */
const RATE_LIMIT_EVERY = 6;

/** From the fourth job pane a visitor opens, until they say "Not now", the pane carries the sign-in wall. */
const PANES_BEFORE_WALL = 3;

const CAREERS_JOB = /^careers\/([a-z-]+)\/jobs\/([A-Z]{2}-\d{3,4})$/u;
const CAREERS_INDEX = /^careers\/([a-z-]+)$/u;

/**
 * Rolefinch's pages beyond the home page, and Talentloom's.
 *
 * - `jobs` -- a results page. Serving one is recorded (`results-view`), which
 *   is what makes the fresh posting go live and the rate limiter count.
 * - `pane` -- the fragment a results page loads beside the list (`pane-view`).
 * - `viewjob`, `myjobs` -- a job's own page and the saved list.
 * - `pagead/clk` -- a sponsored card's link, redirected to the job's page.
 * - `rc/clk` -- the apply link's hand-off page, which forwards to the careers site.
 * - `careers/<slug>[/jobs/<requisition>]` -- the employer's careers site.
 * - `embed/job_app`, `embed/places`, `embed/confirmation` -- Talentloom's
 *   embedded form, its location lookup and its thank-you page, served for
 *   framing from the lab's other loopback origin.
 */
export function routeJobBoard(state: JobBoardState, request: ScenarioRouteRequest, context: RenderContext): ScenarioRouteResponse | undefined {
  const { subpath, query } = request;
  if (subpath === "jobs") {
    const search = parseSearchQuery(query);
    const mutation = { operation: "results-view", payload: { page: search.page } };
    if (state.resultsViews % RATE_LIMIT_EVERY === RATE_LIMIT_EVERY - 1) return { status: 429, headers: { "retry-after": "5" }, body: renderRateLimitPage(state, context), mutation };
    return { status: 200, body: renderResultsPage(state, search, context, state.freshLive || search.page >= 2), mutation };
  }
  if (subpath === "pane") {
    const posting = postingByKey(query.get("jk") ?? "");
    if (!posting) return undefined;
    const wall = state.paneViews >= PANES_BEFORE_WALL && !state.wallDismissed;
    return { status: 200, body: paneMarkup(classesFor(context), state, context.seed, posting, wall), mutation: { operation: "pane-view", payload: { key: posting.key } } };
  }
  if (subpath === "viewjob") {
    const posting = postingByKey(query.get("jk") ?? "");
    return posting ? { status: 200, body: renderViewJobPage(state, context, posting) } : undefined;
  }
  if (subpath === "myjobs") return { status: 200, body: renderMyJobsPage(state, context) };
  if (subpath === "pagead/clk") {
    const posting = POSTINGS.find((candidate) => adKey(candidate) === query.get("ad"));
    return posting ? { status: 302, headers: { location: viewJobHref(posting) } } : undefined;
  }
  if (subpath === "rc/clk") {
    const body = renderApplyRedirect(query.get("jk") ?? "");
    return body === undefined ? undefined : { status: 200, body };
  }
  const job = CAREERS_JOB.exec(subpath);
  if (job) return html(renderCareersJobPage(state, context, job[1]!, job[2]!));
  const careers = CAREERS_INDEX.exec(subpath);
  if (careers) return html(renderCareersIndex(state, context, careers[1]!));
  return routeEmbed(state, request, context);
}

function routeEmbed(state: JobBoardState, request: ScenarioRouteRequest, context: RenderContext): ScenarioRouteResponse | undefined {
  const framed = { "content-security-policy": EMBED_CSP };
  if (request.subpath === "embed/job_app") {
    const slug = request.query.get("for") ?? "";
    const requisition = request.query.get("token") ?? "";
    const posting = POSTINGS.find((candidate) => candidate.apply.kind === "company" && candidate.apply.careersSlug === slug && candidate.apply.requisition === requisition);
    if (!posting) return undefined;
    return { status: 200, headers: framed, body: isPostingOpen(state, posting) ? renderApplicationForm(context, posting) : renderEmbedClosed() };
  }
  if (request.subpath === "embed/places") {
    return { status: 200, headers: { ...framed, "content-type": "application/json; charset=utf-8" }, body: JSON.stringify(suggestPlaces(request.query.get("q") ?? "")) };
  }
  if (request.subpath === "embed/confirmation") {
    const body = renderConfirmation(state, request.query.get("app") ?? "");
    return body === undefined ? undefined : { status: 200, headers: framed, body };
  }
  return undefined;
}

function html(body: string | undefined): ScenarioRouteResponse | undefined {
  return body === undefined ? undefined : { status: 200, body };
}
