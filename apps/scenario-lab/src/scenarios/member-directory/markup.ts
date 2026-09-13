import { applyIdentifierPolicy } from "../../identifier-policy/index.js";
import { escapeHtml, fixtureClient, page } from "../../html.js";
import { directoryClientScript } from "./client-script.js";
import { applyChanges, resultCountText, rosterFor, sortStatusText, statsText } from "./filters.js";
import { buildMarkerText, DIRECTORY_BUILDS, directoryClasses, directoryStylesheet, type DirectoryClasses } from "./styles.js";
import { memberTableMarkup, toolbarMarkup } from "./table.js";
import type { RenderContext } from "../../types.js";
import type { MemberDirectoryState } from "./types.js";

/** The workspace this console administers. Fictional, and named the same on every run. */
const WORKSPACE = "Halden Robotics";
const SIGNED_IN_AS = { name: "Avery Rowe", initials: "AR" };

/**
 * The navigation an internal tool of this size has: two groups, twelve
 * destinations, one of them current. Members is the page, so its link is the
 * one marked `aria-current`.
 */
const NAV_GROUPS: ReadonlyArray<{ label: string; items: ReadonlyArray<{ label: string; count?: number; current?: boolean }> }> = [
  {
    label: "Workspace",
    items: [{ label: "Overview" }, { label: "Projects" }, { label: "Datasets" }, { label: "Reports" }, { label: "Alerts", count: 4 }],
  },
  {
    label: "Administration",
    items: [
      { label: "Members", current: true }, { label: "Teams" }, { label: "Roles" },
      { label: "Billing" }, { label: "Audit log" }, { label: "Integrations" }, { label: "Settings" },
    ],
  },
];

const GLYPHS = {
  square: "M3 3h10v10H3z",
  bell: "M8 2a4 4 0 0 0-4 4v3l-1 2h10l-1-2V6a4 4 0 0 0-4-4z",
  sparkle: "M8 2l1.6 4.4L14 8l-4.4 1.6L8 14l-1.6-4.4L2 8l4.4-1.6z",
  chevron: "M4 6l4 4 4-4",
  life: "M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zm0 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4z",
  cross: "M4 4l8 8M12 4l-8 8",
} as const;

/** One design-system glyph. Every icon on the page is one path, drawn in the current colour, hidden from the accessibility tree. */
export function icon(className: string, path: string): string {
  return `<svg class="${className}" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="${path}" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`;
}

/**
 * The whole console for one state.
 *
 * Everything the run changed is rendered back: a reload shows the roles the
 * edit dialog saved and the people a bulk action removed, so the page and the
 * server oracle cannot disagree. The armed renderings differ from the baseline
 * in exactly one thing each -- the build hash, the roster, the sort order, or
 * an open support drawer -- and in nothing else.
 */
export function renderDirectoryPage(state: MemberDirectoryState, context: RenderContext): string {
  const build = state.mode === "restyled" ? DIRECTORY_BUILDS.restyled : DIRECTORY_BUILDS.baseline;
  const css = directoryClasses(build);
  const members = applyChanges(rosterFor(state.mode), state.roles, state.removed);
  const body = `<div class="${css.app}">
${sidebar(css)}
<div class="${css.main}">
${topbar(css)}
<main class="${css.content}">
<div class="${css.pageHead}">
<div><h1 class="${css.pageTitle}">Members</h1><p class="${css.statLine}" data-testid="member-stats">${statsText(members)}</p></div>
<div class="${css.pageActions}"><button class="${css.button}" type="button" data-action="import">Import CSV</button><button class="${css.button} ${css.buttonPrimary}" type="button" data-action="invite">Invite people</button></div>
</div>
<section class="${css.card}" aria-labelledby="members-heading">
<h2 class="${css.srOnly}" id="members-heading">Member list</h2>
${toolbarMarkup(css)}
<div class="${css.tableWrap}">${memberTableMarkup(css, members, state.mode)}</div>
<div class="${css.tableFoot}"><p class="${css.footNote}" data-testid="result-count">${resultCountText(members.length, members.length)}</p><p class="${css.footNote}" data-testid="sort-status">${sortStatusText(state.mode)}</p></div>
</section>
<footer class="${css.appFoot}"><small data-testid="build-marker">${buildMarkerText(build)}</small></footer>
</main>
</div>
</div>
<button class="${css.launcher}" type="button" aria-label="Help and support" aria-expanded="${state.mode === "support-drawer"}">${icon(css.navIcon, GLYPHS.life)}</button>
${state.mode === "support-drawer" ? supportDrawer(css) : ""}
<div class="${css.toastRegion}" data-testid="toast-region" aria-live="polite"></div>
<style>${directoryStylesheet(css)}</style>`;
  const script = `${fixtureClient(context.runToken, "member-directory")}
${directoryClientScript(css)}`;
  // Over the finished document, script included: the table rows and both
  // dialogs are built in the browser from the same attributes the served
  // markup uses, so a policy applied to the markup alone would leave every
  // control the client renders still labelled.
  return applyIdentifierPolicy(page("Members · Meridian", body, script), state.identifiers);
}

function sidebar(css: DirectoryClasses): string {
  const groups = NAV_GROUPS.map((group) => `<p class="${css.navLabel}">${escapeHtml(group.label)}</p>
<ul class="${css.navList}">${group.items.map((item) => navItem(css, item)).join("")}</ul>`).join("");
  return `<aside class="${css.sidebar}">
<div class="${css.brand}"><span class="${css.brandMark}" aria-hidden="true">M</span><span>Meridian</span></div>
<button class="${css.userButton}" type="button" aria-haspopup="listbox" aria-expanded="false" data-action="switch-workspace">${escapeHtml(WORKSPACE)}${icon(css.navIcon, GLYPHS.chevron)}</button>
<nav aria-label="Main">${groups}</nav>
<div class="${css.sidebarFoot}"><p>Trial ends in 12 days.</p><button class="${css.button}" type="button" data-action="invite">Invite people</button></div>
</aside>`;
}

function navItem(css: DirectoryClasses, item: { label: string; count?: number; current?: boolean }): string {
  const classes = item.current ? `${css.navItem} ${css.navCurrent}` : css.navItem;
  const current = item.current ? ` aria-current="page"` : "";
  const count = item.count === undefined ? "" : `<span class="${css.navCount}">${item.count}</span>`;
  return `<li><a class="${classes}" href="#${item.label.toLowerCase().replaceAll(" ", "-")}"${current}>${icon(css.navIcon, GLYPHS.square)}<span>${escapeHtml(item.label)}</span>${count}</a></li>`;
}

/**
 * The top bar. Three icon buttons, labelled the way a real design system's
 * optional `label` prop ends up being passed: one properly, one only through
 * `title`, and one not at all. The search input's label is "Search", which is
 * also the members filter's label -- two controls, one accessible name.
 */
function topbar(css: DirectoryClasses): string {
  return `<header class="${css.topbar}">
<form class="${css.searchForm}" role="search"><label class="${css.srOnly}" for="global-search">Search</label><input class="${css.searchInput}" id="global-search" type="search" name="q" autocomplete="off" placeholder="Search Halden Robotics"></form>
<div class="${css.topActions}">
<button class="${css.iconButton}" type="button" aria-label="Notifications" data-action="notifications">${icon(css.navIcon, GLYPHS.bell)}</button>
<button class="${css.iconButton}" type="button" title="What's new" data-action="changelog">${icon(css.navIcon, GLYPHS.sparkle)}</button>
<button class="${css.iconButton}" type="button" data-action="apps">${icon(css.navIcon, GLYPHS.square)}</button>
<button class="${css.userButton}" type="button" aria-haspopup="menu" aria-expanded="false" data-action="account"><span class="${css.avatar}" aria-hidden="true">${SIGNED_IN_AS.initials}</span><span>${escapeHtml(SIGNED_IN_AS.name)}</span>${icon(css.navIcon, GLYPHS.chevron)}</button>
</div>
</header>`;
}

/**
 * The support drawer, docked down the right-hand edge over everything the page
 * has there: the row action column, and the right-aligned end of the bulk
 * toolbar. It reflows nothing, so every control underneath it is still laid
 * out, still visible to `getBoundingClientRect`, and no longer clickable.
 */
function supportDrawer(css: DirectoryClasses): string {
  return `<aside class="${css.drawer}" data-testid="support-drawer" aria-label="Support">
<div class="${css.drawerHead}"><span>Support</span><button class="${css.iconButton}" type="button" aria-label="Close support">${icon(css.navIcon, GLYPHS.cross)}</button></div>
<div class="${css.drawerBody}"><p>Start a conversation and someone from the workspace team will reply here.</p><p>Typical reply time: under an hour.</p><button class="${css.button} ${css.buttonPrimary}" type="button" data-action="support-message">New message</button></div>
</aside>`;
}
