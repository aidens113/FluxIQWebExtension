import { escapeHtml, page } from "../../html.js";
import { accountById, accountBySlug, connectedAccounts } from "./accounts.js";
import { excerptOf, SCHEDULER_ROOT, relativeText, slotText } from "./format.js";
import { applyChanges, orderedQueue, queueCounts } from "./queue.js";
import { queuePostsFor } from "./posts.js";
import { buildMarkerText, SCHEDULER_BUILDS, schedulerClasses, schedulerStylesheet } from "./styles.js";
import { queueRowMarkup } from "./table.js";
import type { ScenarioRouteRequest, ScenarioRouteResponse } from "../../types.js";
import type { ConnectedAccount, QueuedPost, SchedulerState } from "./types.js";

const ROW_SUBPATH = /^rows\/([a-z0-9_]+)$/;
const POST_SUBPATH = /^posts\/([a-z0-9_]+)$/;
const ACCOUNT_SUBPATH = /^accounts\/([a-z0-9-]+)$/;

/**
 * `rows/<id>` serves one queue row, which is how the page shows a post the
 * composer just scheduled without building a row of its own; it records
 * nothing, because rendering a row is not a visit. `posts/<id>` serves the
 * post's own page and records the visit (`view-post`); `accounts/<slug>`
 * serves an account's page. All three follow the armed rendering and the run's
 * own changes, so a post the run scheduled has a row and a page like any
 * other. Anything else is a 404.
 */
export function routeScheduler(state: SchedulerState, request: ScenarioRouteRequest): ScenarioRouteResponse | undefined {
  const posts = applyChanges(queuePostsFor(state.mode), state.retried, state.composed);
  const rowId = ROW_SUBPATH.exec(request.subpath)?.[1];
  if (rowId !== undefined) {
    const post = posts.find((candidate) => candidate.id === rowId);
    if (!post) return undefined;
    const css = schedulerClasses(state.mode === "restyled" ? SCHEDULER_BUILDS.restyled : SCHEDULER_BUILDS.baseline);
    return { status: 200, body: queueRowMarkup(css, post, state.mode) };
  }
  const postId = POST_SUBPATH.exec(request.subpath)?.[1];
  if (postId !== undefined) {
    const post = posts.find((candidate) => candidate.id === postId);
    if (!post) return undefined;
    return { status: 200, body: postPageMarkup(post, state), mutation: { operation: "view-post", payload: { id: post.id } } };
  }
  const slug = ACCOUNT_SUBPATH.exec(request.subpath)?.[1];
  const account = slug === undefined ? undefined : accountBySlug(slug);
  if (!account) return undefined;
  return { status: 200, body: accountPageMarkup(account, posts, state) };
}

/** A post's own page: the whole text the queue could only show the start of, and why it did not go out if it did not. */
function postPageMarkup(post: QueuedPost, state: SchedulerState): string {
  const css = schedulerClasses(state.mode === "restyled" ? SCHEDULER_BUILDS.restyled : SCHEDULER_BUILDS.baseline);
  const account = accountById(post.accountId);
  const failure = post.failureReason === "" ? "" : `<p data-testid="post-failure">${escapeHtml(post.failureReason)}</p>`;
  const link = post.link === "" ? "" : `<p data-testid="post-link">${escapeHtml(post.link)}</p>`;
  const body = `<main class="${css.content}">
<nav aria-label="Breadcrumb"><a href="${SCHEDULER_ROOT}">Back to the queue</a></nav>
<h1 class="${css.pageTitle}" data-testid="post-heading">${escapeHtml(excerptOf(post.body))}</h1>
<p data-testid="post-account">${escapeHtml(`${account.display} · ${account.network} · ${account.handle}`)}</p>
<p data-testid="post-status">${post.status}</p>
<p data-testid="post-slot">${escapeHtml(`${relativeText(post.offsetMinutes)} · ${slotText(post.offsetMinutes)}`)}</p>
<p data-testid="post-body">${escapeHtml(post.body)}</p>
${link}${failure}
<footer class="${css.appFoot}"><small data-testid="build-marker">${buildMarkerText(state.mode === "restyled" ? SCHEDULER_BUILDS.restyled : SCHEDULER_BUILDS.baseline)}</small></footer>
</main>
<style>${schedulerStylesheet(css)}</style>`;
  return page(`${excerptOf(post.body)} · Cadence`, body, "");
}

/** An account's page: who it is, and how much of the queue belongs to it. */
function accountPageMarkup(account: ConnectedAccount, posts: readonly QueuedPost[], state: SchedulerState): string {
  const css = schedulerClasses(state.mode === "restyled" ? SCHEDULER_BUILDS.restyled : SCHEDULER_BUILDS.baseline);
  const mine = orderedQueue(posts.filter((post) => post.accountId === account.id));
  const { postCount, scheduledCount, failedCount } = queueCounts(mine);
  const siblings = connectedAccounts.filter((candidate) => candidate.display === account.display && candidate.id !== account.id);
  const note = siblings.length === 0 ? "" : `<p data-testid="account-note">${escapeHtml(`Another connected account is also called ${account.display}: ${siblings.map((entry) => `${entry.network} · ${entry.handle}`).join(", ")}.`)}</p>`;
  const body = `<main class="${css.content}">
<nav aria-label="Breadcrumb"><a href="${SCHEDULER_ROOT}">Back to the queue</a></nav>
<h1 class="${css.pageTitle}" data-testid="account-heading">${escapeHtml(account.display)}</h1>
<p data-testid="account-handle">${escapeHtml(`${account.network} · ${account.handle}`)}</p>
<p data-testid="account-stats">${postCount} posts · ${scheduledCount} scheduled · ${failedCount} failed</p>
${note}
</main>
<style>${schedulerStylesheet(css)}</style>`;
  return page(`${account.display} · Cadence`, body, "");
}
