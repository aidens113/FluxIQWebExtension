import { escapeHtml, fixtureClient, page } from "../../html.js";
import { connectedAccounts } from "./accounts.js";
import { schedulerClientScript } from "./client-script.js";
import { applyChanges, orderedQueue, resultCountText, statsText } from "./queue.js";
import { queuePostsFor } from "./posts.js";
import { buildMarkerText, SCHEDULER_BUILDS, schedulerClasses, schedulerStylesheet, type SchedulerClasses } from "./styles.js";
import { queueTableMarkup, SORT_STATUS_TEXT, toolbarMarkup } from "./table.js";
import type { RenderContext } from "../../types.js";
import { POST_LIMIT, type SchedulerMode, type SchedulerState } from "./types.js";

/** The brand this console publishes for. Fictional, and named the same on every run. */
const WORKSPACE = "Northwind Outdoors";
const SIGNED_IN_AS = { name: "Priya Raman", initials: "PR" };

/**
 * The navigation a publishing tool of this size has: three groups, eleven
 * destinations, one of them current. Queue is the page, so its link is the one
 * marked `aria-current`.
 */
const NAV_GROUPS: ReadonlyArray<{ label: string; items: ReadonlyArray<{ label: string; count?: number; current?: boolean }> }> = [
  { label: "Publishing", items: [{ label: "Queue", current: true }, { label: "Calendar" }, { label: "Drafts", count: 8 }, { label: "Approvals", count: 3 }, { label: "Library" }] },
  { label: "Insights", items: [{ label: "Reports" }, { label: "Engagement" }] },
  { label: "Workspace", items: [{ label: "Accounts" }, { label: "Team" }, { label: "Billing" }, { label: "Settings" }] },
];

const GLYPHS = {
  square: "M3 3h10v10H3z",
  bell: "M8 2a4 4 0 0 0-4 4v3l-1 2h10l-1-2V6a4 4 0 0 0-4-4z",
  sparkle: "M8 2l1.6 4.4L14 8l-4.4 1.6L8 14l-1.6-4.4L2 8l4.4-1.6z",
  chevron: "M4 6l4 4 4-4",
  cross: "M4 4l8 8M12 4l-8 8",
} as const;

/**
 * The whole console for one state.
 *
 * Everything the run changed is rendered back: a reload shows the posts the
 * composer scheduled and the failures a retry put back in the queue, so the
 * page and the server oracle cannot disagree. The armed renderings differ from
 * the baseline in exactly one thing each -- the build hash, the composer's
 * footer, the column order, or how many posts failed -- and in nothing else.
 */
export function renderSchedulerPage(state: SchedulerState, context: RenderContext): string {
  const build = state.mode === "restyled" ? SCHEDULER_BUILDS.restyled : SCHEDULER_BUILDS.baseline;
  const css = schedulerClasses(build);
  const posts = orderedQueue(applyChanges(queuePostsFor(state.mode), state.retried, state.composed));
  const body = `<div class="${css.app}">
${sidebar(css)}
<div class="${css.main}">
${topbar(css)}
<main class="${css.content}">
<div class="${css.pageHead}">
<div><h1 class="${css.pageTitle}">Queue</h1><p class="${css.statLine}" data-testid="queue-stats">${statsText(posts)}</p></div>
<div class="${css.pageActions}"><button class="${css.button}" type="button" data-action="import">Import schedule</button><button class="${css.button} ${css.buttonPrimary}" type="button" data-action="new-post">New post</button></div>
</div>
${composerMarkup(css, state.mode)}
<section class="${css.card}" aria-labelledby="queue-heading">
<h2 class="${css.srOnly}" id="queue-heading">Publishing queue</h2>
${toolbarMarkup(css)}
<div class="${css.tableWrap}">${queueTableMarkup(css, posts, state.mode)}</div>
<div class="${css.tableFoot}"><p class="${css.footNote}" data-testid="result-count">${resultCountText(posts.length, posts.length)}</p><p class="${css.footNote}" data-testid="sort-status">${SORT_STATUS_TEXT}</p></div>
</section>
<footer class="${css.appFoot}"><small data-testid="build-marker">${buildMarkerText(build)}</small></footer>
</main>
</div>
</div>
<div class="${css.toastRegion}" data-testid="toast-region" aria-live="polite"></div>
<style>${schedulerStylesheet(css)}</style>`;
  const script = `${fixtureClient(context.runToken, "social-scheduler")}
${schedulerClientScript(css)}`;
  return page("Queue · Cadence", body, script);
}

/** One design-system glyph. Every icon on the page is one path, drawn in the current colour, hidden from the accessibility tree. */
export function icon(className: string, path: string): string {
  return `<svg class="${className}" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="${path}" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`;
}

/**
 * The composer, which the page ships collapsed: it is in the document but
 * `hidden`, so nothing inside it can be typed into or pressed until New post
 * opens it. That is what makes opening the composer a real step rather than a
 * decoration.
 *
 * `renamed-composer` redesigns the footer and nothing else: the recorded
 * submit control loses its test id and becomes "Add to queue", while the
 * "Save as draft" control beside it -- which schedules nothing -- keeps its
 * own and stays exactly where it was.
 */
function composerMarkup(css: SchedulerClasses, mode: SchedulerMode): string {
  const renamed = mode === "renamed-composer";
  const submit = renamed
    ? `<button class="${css.button} ${css.buttonPrimary}" type="submit" data-testid="composer-queue">Add to queue</button>`
    : `<button class="${css.button} ${css.buttonPrimary}" type="submit" data-testid="composer-submit">Schedule post</button>`;
  const accountOptions = [`<option value="">Choose an account</option>`, ...connectedAccounts.map((account) =>
    `<option value="${account.slug}">${escapeHtml(`${account.display} · ${account.network} · ${account.handle}`)}</option>`)].join("");
  return `<section class="${css.composer}" data-testid="composer" aria-labelledby="composer-heading" hidden>
<div class="${css.composerHead}"><h2 class="${css.pageTitle}" id="composer-heading">New post</h2><button class="${css.iconButton}" type="button" aria-label="Close composer" data-action="close-composer">${icon(css.navIcon, GLYPHS.cross)}</button></div>
<form data-testid="composer-form">
<div class="${css.composerGrid}">
<div style="flex: 1 1 100%">
<label class="${css.fieldLabel}" for="composer-body">Post text</label>
<textarea class="${css.textarea}" id="composer-body" name="body" autocomplete="off" placeholder="What is going out?"></textarea>
<p class="${css.charCount}" data-testid="composer-count">0 of ${POST_LIMIT} characters</p>
</div>
<span class="${css.field}"><label class="${css.fieldLabel}" for="composer-account">Account</label><select class="${css.select}" id="composer-account" name="account">${accountOptions}</select></span>
<span class="${css.field}"><label class="${css.fieldLabel}" for="composer-date">Date</label><input class="${css.input}" id="composer-date" name="date" type="text" inputmode="numeric" autocomplete="off" placeholder="YYYY-MM-DD"></span>
<span class="${css.field}"><label class="${css.fieldLabel}" for="composer-time">Time</label><input class="${css.input}" id="composer-time" name="time" type="text" inputmode="numeric" autocomplete="off" placeholder="HH:MM"></span>
<span class="${css.field}"><label class="${css.fieldLabel}" for="composer-link">Link</label><input class="${css.input}" id="composer-link" name="link" type="text" autocomplete="off" placeholder="Optional"></span>
</div>
<div class="${css.composerFoot}">${submit}<button class="${css.button}" type="button" data-testid="composer-draft" data-action="save-draft">Save as draft</button><p class="${css.charCount}">Times are workspace time (UTC).</p></div>
</form>
</section>`;
}

function sidebar(css: SchedulerClasses): string {
  const groups = NAV_GROUPS.map((group) => `<p class="${css.navLabel}">${escapeHtml(group.label)}</p>
<ul class="${css.navList}">${group.items.map((item) => navItem(css, item)).join("")}</ul>`).join("");
  return `<aside class="${css.sidebar}">
<div class="${css.brand}"><span class="${css.brandMark}" aria-hidden="true">C</span><span>Cadence</span></div>
<button class="${css.userButton}" type="button" aria-haspopup="listbox" aria-expanded="false" data-action="switch-workspace">${escapeHtml(WORKSPACE)}${icon(css.navIcon, GLYPHS.chevron)}</button>
<nav aria-label="Main">${groups}</nav>
<div class="${css.sidebarFoot}"><p>Plan renews in 21 days.</p><button class="${css.button}" type="button" data-action="connect">Connect an account</button></div>
</aside>`;
}

function navItem(css: SchedulerClasses, item: { label: string; count?: number; current?: boolean }): string {
  const classes = item.current ? `${css.navItem} ${css.navCurrent}` : css.navItem;
  const current = item.current ? ` aria-current="page"` : "";
  const count = item.count === undefined ? "" : `<span class="${css.navCount}">${item.count}</span>`;
  return `<li><a class="${classes}" href="#${item.label.toLowerCase().replaceAll(" ", "-")}"${current}>${icon(css.navIcon, GLYPHS.square)}<span>${escapeHtml(item.label)}</span>${count}</a></li>`;
}

/**
 * The top bar. Three icon buttons, labelled the way a real design system's
 * optional `label` prop ends up being passed: one properly, one only through
 * `title`, and one not at all. The search input's label is "Search", which is
 * also the queue filter's label -- two controls, one accessible name.
 */
function topbar(css: SchedulerClasses): string {
  return `<header class="${css.topbar}">
<form class="${css.searchForm}" role="search"><label class="${css.srOnly}" for="global-search">Search</label><input class="${css.searchInput}" id="global-search" type="search" name="q" autocomplete="off" placeholder="Search Northwind Outdoors"></form>
<div class="${css.topActions}">
<button class="${css.iconButton}" type="button" aria-label="Notifications" data-action="notifications">${icon(css.navIcon, GLYPHS.bell)}</button>
<button class="${css.iconButton}" type="button" title="What's new" data-action="changelog">${icon(css.navIcon, GLYPHS.sparkle)}</button>
<button class="${css.iconButton}" type="button" data-action="apps">${icon(css.navIcon, GLYPHS.square)}</button>
<button class="${css.userButton}" type="button" aria-haspopup="menu" aria-expanded="false" data-action="account"><span class="${css.avatar}" aria-hidden="true">${SIGNED_IN_AS.initials}</span><span>${escapeHtml(SIGNED_IN_AS.name)}</span>${icon(css.navIcon, GLYPHS.chevron)}</button>
</div>
</header>`;
}
