import { escapeHtml, fixtureClient, page } from "../../html.js";
import { deskClientScript } from "./client-script.js";
import { ESCALATIONS_PATH, SUPPORT_DESK_ROOT } from "./format.js";
import { applyDeskChanges, queueSummaryText, resultCountText, ticketsFor, triageSummaryText, workloadText } from "./queue.js";
import { queueTableMarkup, queueToolbarMarkup } from "./queue-table.js";
import { DESK_GLYPHS, deskBuildMarker, deskClasses, deskIcon, deskStylesheet, type DeskClasses } from "./styles.js";
import type { RenderContext } from "../../types.js";
import type { SupportDeskState } from "./types.js";

/** The company whose desk this is. Fictional, and named the same on every run. */
const WORKSPACE = "Halo Support";
/** The agent the browser is signed in as: the author of a reply the run sends. */
export const SIGNED_IN_AS = { name: "Avery Rowe", initials: "AR" };

/**
 * The navigation an internal tool of this size has. Tickets is the queue and
 * Escalations is a screen of its own, so both are real links; everything else
 * is a destination this fixture does not need to build.
 */
const NAV_GROUPS: ReadonlyArray<{ label: string; items: ReadonlyArray<{ label: string; href?: string; count?: number }> }> = [
  {
    label: "Inbox",
    items: [
      { label: "Tickets", href: SUPPORT_DESK_ROOT },
      { label: "Mentions", count: 3 },
      { label: "Drafts" },
      { label: "Search" },
    ],
  },
  {
    label: "Desk",
    items: [
      { label: "Escalations", href: ESCALATIONS_PATH },
      { label: "Macros" },
      { label: "Teams" },
      { label: "Reports" },
      { label: "Settings" },
    ],
  },
];

/**
 * The whole queue for one state.
 *
 * Everything a run changed is rendered back: a reload shows the agents a
 * triage assigned and the tickets a run resolved, so the page and the server
 * oracle cannot disagree. The armed renderings differ from the baseline in
 * exactly one thing each -- the assignment dialog's submit, or how much of the
 * queue is past its response target -- and in nothing else.
 */
export function renderDeskPage(state: SupportDeskState, context: RenderContext): string {
  const css = deskClasses();
  const tickets = applyDeskChanges(ticketsFor(state.mode), state.assignments, state.resolved);
  const content = `<div class="${css.pageHead}">
<div>
<h1 class="${css.pageTitle}">Tickets</h1>
<p class="${css.statLine}" data-testid="queue-summary">${queueSummaryText(tickets)}</p>
<p class="${css.statLine}" data-testid="triage-summary">${triageSummaryText(tickets)}</p>
<p class="${css.workload}" data-testid="workload">${escapeHtml(workloadText(tickets))}</p>
</div>
<div class="${css.pageActions}">${triageShortcut(css, state.mode)}<button class="${css.button}" type="button" data-action="import">Import</button><button class="${css.button} ${css.buttonPrimary}" type="button" data-action="new-ticket">New ticket</button></div>
</div>
<section class="${css.card}" aria-labelledby="queue-heading">
<h2 class="${css.srOnly}" id="queue-heading">Ticket queue</h2>
${queueToolbarMarkup(css)}
<div class="${css.tableWrap}">${queueTableMarkup(css, tickets)}</div>
<div class="${css.tableFoot}"><p class="${css.footNote}" data-testid="result-count">${resultCountText(tickets.length, tickets.length)}</p><p class="${css.footNote}">Response targets run from first contact.</p></div>
</section>
<footer class="${css.appFoot}"><small data-testid="build-marker">${deskBuildMarker()}</small></footer>`;
  const script = `${fixtureClient(context.runToken, "support-desk")}
${deskClientScript(css)}`;
  return deskDocument("Tickets", css, deskShell(css, "Tickets", content), script);
}

/**
 * The queue header's triage shortcut: the control that puts the desk into the
 * view of everything unassigned that cannot wait.
 *
 * It is the first control in the header's action group, and that is how the
 * page's own script finds it -- the bundle and the markup come out of one
 * build, so the script needs no hook of its own. `relabelled-triage` is the
 * next release of this control and nothing else: same place, same job, and
 * none of the three things a recording writes down. It carries no `data-`
 * attribute in either rendering, because an added hook would be a signal the
 * drift was measured without.
 */
function triageShortcut(css: DeskClasses, mode: SupportDeskState["mode"]): string {
  return mode === "relabelled-triage"
    ? `<button class="${css.buttonNeutral}" type="button">Work the backlog</button>`
    : `<button class="${css.button}" type="button" data-testid="triage-queue">Triage queue</button>`;
}

/** The application shell every desk screen sits in: the sidebar, the top bar, and the page's own content. */
export function deskShell(css: DeskClasses, current: string, content: string): string {
  return `<div class="${css.app}">
${sidebar(css, current)}
<div class="${css.main}">
${topbar(css)}
<main class="${css.content}">${content}</main>
</div>
</div>
<div class="${css.toastRegion}" data-testid="toast-region" aria-live="polite"></div>
<style>${deskStylesheet(css)}</style>`;
}

/** One desk document: the lab's page shell, this desk's title, and whatever script the screen needs. */
export function deskDocument(title: string, css: DeskClasses, body: string, script: string): string {
  return page(`${title} · ${WORKSPACE}`, body, script);
}

function sidebar(css: DeskClasses, current: string): string {
  const groups = NAV_GROUPS.map((group) => `<p class="${css.navLabel}">${escapeHtml(group.label)}</p>
<ul class="${css.navList}">${group.items.map((item) => navItem(css, item, current)).join("")}</ul>`).join("");
  return `<aside class="${css.sidebar}">
<div class="${css.brand}"><span class="${css.brandMark}" aria-hidden="true">H</span><span>${escapeHtml(WORKSPACE)}</span></div>
<button class="${css.userButton}" type="button" aria-haspopup="listbox" aria-expanded="false" data-action="switch-inbox">Front desk inbox${deskIcon(css.navIcon, DESK_GLYPHS.chevron)}</button>
<nav aria-label="Main">${groups}</nav>
<div class="${css.sidebarFoot}"><p>Shift handover at 18:00.</p></div>
</aside>`;
}

function navItem(css: DeskClasses, item: { label: string; href?: string; count?: number }, current: string): string {
  const isCurrent = item.label === current;
  const classes = isCurrent ? `${css.navItem} ${css.navCurrent}` : css.navItem;
  const href = item.href ?? `#${item.label.toLowerCase().replaceAll(" ", "-")}`;
  const count = item.count === undefined ? "" : `<span class="${css.navCount}">${item.count}</span>`;
  return `<li><a class="${classes}" href="${href}"${isCurrent ? ' aria-current="page"' : ""}>${deskIcon(css.navIcon, DESK_GLYPHS.square)}<span>${escapeHtml(item.label)}</span>${count}</a></li>`;
}

/**
 * The top bar. Its search input's accessible name is "Search", which is also
 * the queue filter's: two controls on the page with one name, labelled the way
 * a real design system's optional `label` prop ends up being passed -- one
 * properly, one only through `title`, and one not at all.
 */
function topbar(css: DeskClasses): string {
  return `<header class="${css.topbar}">
<form class="${css.searchForm}" role="search"><label class="${css.srOnly}" for="global-search">Search</label><input class="${css.searchInput}" id="global-search" type="search" name="q" autocomplete="off" placeholder="Search ${escapeHtml(WORKSPACE)}"></form>
<div class="${css.topActions}">
<button class="${css.iconButton}" type="button" aria-label="Notifications" data-action="notifications">${deskIcon(css.navIcon, DESK_GLYPHS.bell)}</button>
<button class="${css.iconButton}" type="button" title="What's new" data-action="changelog">${deskIcon(css.navIcon, DESK_GLYPHS.sparkle)}</button>
<button class="${css.iconButton}" type="button" data-action="apps">${deskIcon(css.navIcon, DESK_GLYPHS.square)}</button>
<button class="${css.userButton}" type="button" aria-haspopup="menu" aria-expanded="false" data-action="account"><span class="${css.avatar}" aria-hidden="true">${SIGNED_IN_AS.initials}</span><span>${escapeHtml(SIGNED_IN_AS.name)}</span>${deskIcon(css.navIcon, DESK_GLYPHS.chevron)}</button>
</div>
</header>`;
}
