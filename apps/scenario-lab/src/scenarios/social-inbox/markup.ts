import { escapeHtml, fixtureClient, page } from "../../html.js";
import { inboxClientScript } from "./client-script.js";
import { conversationsFor, INBOX_SIZE } from "./conversations.js";
import { applyInboxChanges, inboxStatsText, inboxStatusText, pageOf } from "./inbox.js";
import { inboxBuildMarkerText, INBOX_BUILDS, inboxClasses, inboxStylesheet, type InboxClasses } from "./styles.js";
import { inboxTableMarkup, inboxToolbarMarkup, loadControlMarkup } from "./table.js";
import type { RenderContext } from "../../types.js";
import type { InboxMode, InboxState } from "./types.js";

/** The brand this inbox answers for. Fictional, and named the same on every run. */
const WORKSPACE = "Harbor & Pine";
const SIGNED_IN_AS = { name: "Dara Ogun", initials: "DO" };

/**
 * The navigation a social inbox of this size has: three groups, ten
 * destinations, one of them current. Inbox is the page, so its link is the one
 * marked `aria-current`.
 */
const NAV_GROUPS: ReadonlyArray<{ label: string; items: ReadonlyArray<{ label: string; count?: number; current?: boolean }> }> = [
  { label: "Engage", items: [{ label: "Inbox", current: true }, { label: "Assigned to me", count: 6 }, { label: "Saved views" }, { label: "Automations" }] },
  { label: "Listen", items: [{ label: "Mentions" }, { label: "Keywords" }, { label: "Sentiment" }] },
  { label: "Workspace", items: [{ label: "Accounts" }, { label: "Team" }, { label: "Settings" }] },
];

const GLYPHS = {
  square: "M3 3h10v10H3z",
  bell: "M8 2a4 4 0 0 0-4 4v3l-1 2h10l-1-2V6a4 4 0 0 0-4-4z",
  sparkle: "M8 2l1.6 4.4L14 8l-4.4 1.6L8 14l-1.6-4.4L2 8l4.4-1.6z",
  chevron: "M4 6l4 4 4-4",
} as const;

/**
 * The whole inbox for one state.
 *
 * Everything the run changed is rendered back: a reload shows the
 * conversations the run answered, marked handled or handed on, so the page and
 * the server oracle cannot disagree. The armed renderings differ from the
 * baseline in exactly one thing each -- the build hash, the reply dialog's
 * layout, or how much of the old backlog is still waiting -- and in nothing
 * else.
 *
 * Only the first twenty-five conversations are on the page. Everything older
 * comes from the control under the last row, which asks the `items` route for
 * the next page and appends it.
 */
export function renderInboxPage(state: InboxState, context: RenderContext): string {
  const build = state.mode === "restyled" ? INBOX_BUILDS.restyled : INBOX_BUILDS.baseline;
  const css = inboxClasses(build);
  const conversations = applyInboxChanges(conversationsFor(state.mode), state);
  const { items, more, shown } = pageOf(conversations, 1);
  const body = `<div class="${css.app}">
${sidebar(css)}
<div class="${css.main}">
${topbar(css)}
<main class="${css.content}">
<div class="${css.pageHead}">
<div><h1 class="${css.pageTitle}">Inbox</h1><p class="${css.statLine}" data-testid="inbox-stats">${inboxStatsText(conversations)}</p></div>
<div class="${css.pageActions}"><button class="${css.button}" type="button" data-action="views">Saved views</button><button class="${css.button} ${css.buttonPrimary}" type="button" data-action="refresh">Refresh</button></div>
</div>
<section class="${css.card}" aria-labelledby="inbox-heading">
<h2 class="${css.srOnly}" id="inbox-heading">Conversations</h2>
${inboxToolbarMarkup(css)}
<div data-testid="inbox-results" aria-busy="false">
<div class="${css.tableWrap}">${inboxTableMarkup(css, items)}</div>
<div class="${css.tableFoot}"><p class="${css.footNote}" data-testid="inbox-status">${inboxStatusText(shown, conversations.length)}</p><span data-testid="inbox-more">${more ? loadControlMarkup(css) : ""}</span></div>
</div>
</section>
<footer class="${css.appFoot}"><small data-testid="build-marker">${inboxBuildMarkerText(build)}</small></footer>
</main>
</div>
</div>
${replyDialogMarkup(css, state.mode)}
<div class="${css.toastRegion}" data-testid="toast-region" aria-live="polite"></div>
<style>${inboxStylesheet(css)}</style>`;
  const script = `${fixtureClient(context.runToken, "social-inbox")}
${inboxClientScript(css)}`;
  return page(`Inbox · Mentio`, body, script);
}

/**
 * The reply composer, which the page ships closed: one dialog, reused for
 * whichever row's Reply was pressed, in the document but behind a `hidden`
 * scrim, so nothing inside it can be typed into or pressed until a row opens
 * it. The person, their message and the empty text area are filled in when it
 * opens.
 *
 * `moved-send` redesigns it and nothing else: Send moves out of the footer
 * into the dialog's header and loses the test id the recording took, while
 * Discard -- which sends nothing -- takes the place the recorded control had.
 */
function replyDialogMarkup(css: InboxClasses, mode: InboxMode): string {
  const moved = mode === "moved-send";
  const send = moved
    ? `<button class="${css.button} ${css.buttonPrimary}" type="button" data-testid="reply-send" data-action="send">Send</button>`
    : `<button class="${css.button} ${css.buttonPrimary}" type="button" data-testid="reply-submit" data-action="send">Send reply</button>`;
  const discard = `<button class="${css.button}" type="button" data-testid="reply-discard" data-action="discard">Discard</button>`;
  return `<div class="${css.scrim}" data-testid="reply-scrim" hidden>
<div class="${css.dialog}" role="dialog" aria-modal="true" aria-label="Reply" data-testid="reply-dialog">
<div class="${css.dialogHead}"><span data-testid="reply-to">Reply</span>${moved ? send : ""}</div>
<div class="${css.dialogBody}">
<p class="${css.footNote}" data-testid="reply-quote"></p>
<label class="${css.fieldLabel}" for="reply-text">Your reply</label>
<textarea class="${css.textarea}" id="reply-text" name="reply" autocomplete="off"></textarea>
</div>
<div class="${css.dialogFoot}"><button class="${css.button}" type="button" data-action="cancel">Cancel</button>${moved ? discard : send}</div>
</div>
</div>`;
}

/** One design-system glyph. Every icon on the page is one path, drawn in the current colour, hidden from the accessibility tree. */
export function inboxIcon(className: string, path: string): string {
  return `<svg class="${className}" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="${path}" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`;
}

function sidebar(css: InboxClasses): string {
  const groups = NAV_GROUPS.map((group) => `<p class="${css.navLabel}">${escapeHtml(group.label)}</p>
<ul class="${css.navList}">${group.items.map((item) => navItem(css, item)).join("")}</ul>`).join("");
  return `<aside class="${css.sidebar}">
<div class="${css.brand}"><span class="${css.brandMark}" aria-hidden="true">M</span><span>Mentio</span></div>
<button class="${css.userButton}" type="button" aria-haspopup="listbox" aria-expanded="false" data-action="switch-workspace">${escapeHtml(WORKSPACE)}${inboxIcon(css.navIcon, GLYPHS.chevron)}</button>
<nav aria-label="Main">${groups}</nav>
<div class="${css.sidebarFoot}"><p>${INBOX_SIZE} conversations kept for 90 days.</p><button class="${css.button}" type="button" data-action="views">Save this view</button></div>
</aside>`;
}

function navItem(css: InboxClasses, item: { label: string; count?: number; current?: boolean }): string {
  const classes = item.current ? `${css.navItem} ${css.navCurrent}` : css.navItem;
  const current = item.current ? ` aria-current="page"` : "";
  const count = item.count === undefined ? "" : `<span class="${css.navCount}">${item.count}</span>`;
  return `<li><a class="${classes}" href="#${item.label.toLowerCase().replaceAll(" ", "-")}"${current}>${inboxIcon(css.navIcon, GLYPHS.square)}<span>${escapeHtml(item.label)}</span>${count}</a></li>`;
}

/**
 * The top bar. Three icon buttons, labelled the way a real design system's
 * optional `label` prop ends up being passed: one properly, one only through
 * `title`, and one not at all. The search input's label is "Search", which is
 * also the inbox filter's label -- two controls, one accessible name.
 */
function topbar(css: InboxClasses): string {
  return `<header class="${css.topbar}">
<form class="${css.searchForm}" role="search"><label class="${css.srOnly}" for="global-search">Search</label><input class="${css.searchInput}" id="global-search" type="search" name="q" autocomplete="off" placeholder="Search Harbor &amp; Pine"></form>
<div class="${css.topActions}">
<button class="${css.iconButton}" type="button" aria-label="Notifications" data-action="notifications">${inboxIcon(css.navIcon, GLYPHS.bell)}</button>
<button class="${css.iconButton}" type="button" title="What's new" data-action="changelog">${inboxIcon(css.navIcon, GLYPHS.sparkle)}</button>
<button class="${css.iconButton}" type="button" data-action="apps">${inboxIcon(css.navIcon, GLYPHS.square)}</button>
<button class="${css.userButton}" type="button" aria-haspopup="menu" aria-expanded="false" data-action="account"><span class="${css.avatar}" aria-hidden="true">${SIGNED_IN_AS.initials}</span><span>${escapeHtml(SIGNED_IN_AS.name)}</span>${inboxIcon(css.navIcon, GLYPHS.chevron)}</button>
</div>
</header>`;
}
