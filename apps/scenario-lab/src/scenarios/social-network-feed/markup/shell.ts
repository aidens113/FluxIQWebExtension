import { escapeHtml as esc, page } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import type { ClientConfig, ClientPage } from "../client/index.js";
import { COMMUNITIES, MAYA, OPEN_DAY_POST, STALE_REQUEST_BADGE } from "../content/index.js";
import type { FeedMode, FeedState } from "../types.js";
import { feedClasses, type FeedClasses } from "./classes.js";
import { avatarGraphic, glyph, photoSource, SITE_ROOT } from "./parts.js";
import { feedStylesheet } from "./stylesheet.js";

/** Which top-bar destination a page belongs to, so its icon is the current one. */
export type ShellSection = "home" | "friends" | "groups" | "none";

export type ShellContext = { css: FeedClasses; seed: number; state: FeedState; section: ShellSection };

/** Everything a page of the site renders from: the build's classes for this seed, the account's state, and which section it is in. */
export function shellContext(state: FeedState, context: RenderContext, section: ShellSection): ShellContext {
  return { css: feedClasses(context.seed), seed: context.seed, state, section };
}

/** What every page's script is told, before the page adds its own. */
export function baseConfig(shell: ShellContext, page: ClientPage): ClientConfig {
  const { css, state } = shell;
  return {
    C: css,
    root: SITE_ROOT,
    me: MAYA.slug,
    page,
    consent: state.consent,
    prompt: state.notificationsPrompt,
    chat: state.chat,
    boosted: state.trashed.includes(OPEN_DAY_POST.id) ? [] : [OPEN_DAY_POST.id],
    texts: {},
  };
}

/** The web client's version, as the left rail's footer prints it. The `regrouped` rendering is a later deploy. */
export function buildMarkerText(mode: FeedMode): string {
  return `Circleway © 2026 · web ${mode === "regrouped" ? "439.0.0.12" : "438.0.0.36"}`;
}

/**
 * One page of the site: the top bar, the page's own content, the consent
 * dialog while it is unanswered, the toast region, and the build's styles.
 * The script is the lab's fixture client followed by the page's own.
 */
export function sitePage(context: ShellContext, title: string, main: string, script: string): string {
  const { css, seed, state } = context;
  const body = `<div class="${css.app}">${topBar(context)}${main}</div>${state.consent === "pending" ? consentDialog(css) : ""}<div class="${css.toastRegion}" role="status" aria-live="polite"></div><style>${feedStylesheet(css, seed)}</style>`;
  return page(title, body, script);
}

/**
 * The top bar. The search box has a placeholder and no label. Friends and
 * Groups are links named only by `aria-label`; the badges on them, and on
 * Notifications, are counts the server worked out some time ago -- Friends
 * says 4 whatever the requests list holds.
 */
export function topBar(context: ShellContext): string {
  const { css, section } = context;
  const navItem = (href: string, label: string, name: Parameters<typeof glyph>[0], current: boolean, badge?: string) =>
    `<a class="${css.topNavItem}${current ? ` ${css.topNavCurrent}` : ""}" href="${SITE_ROOT}${href}" aria-label="${label}"${current ? ` aria-current="page"` : ""}>${glyph(name, 24)}${badge ? `<span class="${css.badge}">${badge}</span>` : ""}</a>`;
  return `<div class="${css.topbar}" role="banner"><a class="${css.logo}" href="${SITE_ROOT}" aria-label="Circleway">c</a><label class="${css.search}">${glyph("search", 16)}<input class="${css.searchInput}" type="search" placeholder="Search Circleway" autocomplete="off"></label><nav class="${css.topNav}" aria-label="Circleway">${navItem("", "Home", "home", section === "home")}${navItem("friends/", "Friends", "people", section === "friends", STALE_REQUEST_BADGE)}${navItem("watch/", "Video", "video", false)}${navItem("groups/feed/", "Groups", "grid", section === "groups", "2")}</nav><div class="${css.topActions}"><div class="${css.iconButton}" role="button" tabindex="0" aria-label="Menu">${glyph("grid")}</div><div class="${css.iconButton}" role="button" tabindex="0" aria-label="Messenger">${glyph("chat")}<span class="${css.badge}" style="right:-4px">3</span></div><div class="${css.iconButton}" role="button" tabindex="0" aria-label="Notifications">${glyph("bell")}<span class="${css.badge}" style="right:-4px">9+</span></div><div class="${css.iconButton}" role="button" tabindex="0" aria-label="Your profile">${avatarGraphic(MAYA.hue, 40)}</div></div></div>`;
}

/**
 * The left rail. "Friends" appears here as a link whose text is Friends, and
 * in the top bar as a link whose label is Friends, and they go to the same
 * place. The build marker in the footer is the one place the page says which
 * deploy it is.
 */
export function leftRail(context: ShellContext): string {
  const { css, state } = context;
  const item = (href: string, label: string, icon: string) => `<li><a class="${css.railItem}" href="${SITE_ROOT}${href}">${icon}<span>${esc(label)}</span></a></li>`;
  const disc = (hue: number, letter: string) => `<span class="${css.railIcon}" style="background:hsl(${hue} 55% 50%)" aria-hidden="true">${letter}</span>`;
  const shortcuts = ["riverside-allotments", "harbourside-runners", "old-town-bakers"].map((slug) => {
    const group = COMMUNITIES[slug];
    return group ? `<li><a class="${css.railItem}" href="${SITE_ROOT}groups/${slug}/"><span class="${css.railIcon}" aria-hidden="true">${avatarGraphic(group.hue, 36)}</span><span>${esc(group.name)}</span></a></li>` : "";
  }).join("");
  return `<nav class="${css.leftRail}" aria-label="Shortcuts"><ul style="margin:0;padding:0">${item(`people/${MAYA.slug}/`, MAYA.name, `<span class="${css.railIcon}">${avatarGraphic(MAYA.hue, 36)}</span>`)}${item("friends/", "Friends", disc(210, "F"))}${item("memories/", "Memories", disc(200, "M"))}${item("saved/", "Saved", disc(280, "S"))}${item("groups/feed/", "Groups", disc(190, "G"))}${item("watch/", "Video", disc(220, "V"))}${item("events/", "Events", disc(0, "E"))}${item("ads/manager/", "Ads Manager", disc(215, "A"))}</ul><h2 class="${css.railLabel}">Your shortcuts</h2><ul style="margin:0;padding:0">${shortcuts}</ul><footer class="${css.railFoot}">Privacy · Terms · Advertising · Ad choices · Cookies · More · <span data-testid="build-marker">${buildMarkerText(state.mode)}</span></footer></nav>`;
}

/** The right rail: two adverts, birthdays, and contacts. None of it is the feed, and all of it is on screen beside it. */
export function rightRail(context: ShellContext): string {
  const { css } = context;
  const ad = (name: string, domain: string, hue: number) => `<a class="${css.railItem}" href="${SITE_ROOT}l/?u=${encodeURIComponent(`https://${domain}/`)}" target="_blank" rel="nofollow noreferrer"><img src="${photoSource(hue)}" alt="" width="120" height="64" style="border-radius:8px"><span><span style="display:block;font-weight:600">${esc(name)}</span><span class="${css.muted}">${esc(domain)}</span></span></a>`;
  const contacts = ["elena-sokolova", "aisha-khan", "tom-becker", "hannah-okafor", "dev-patel", "grace-liu", "marcus-reid"]
    .map((slug, index) => `<li><a class="${css.railItem}" href="${SITE_ROOT}messages/t/${slug}/"><span class="${css.railIcon}">${avatarGraphic(30 + index * 47, 36)}</span><span>${esc(contactName(slug))}</span></a></li>`).join("");
  return `<div class="${css.rightRail}" role="complementary" aria-label="Sponsored and contacts"><h3 class="${css.railLabel}">Sponsored</h3>${ad("Harbour Kayak Tours", "harbourkayak.example", 190)}${ad("Mill Lane Hardware", "milllanehardware.example", 30)}<h3 class="${css.railLabel}">Birthdays</h3><p class="${css.railItem}" style="margin:0">Nadia Rahman and 2 others have birthdays today.</p><h3 class="${css.railLabel}">Contacts</h3><ul style="margin:0;padding:0">${contacts}</ul></div>`;
}

/**
 * The cookie dialog, which is in front of everything until it is answered: a
 * scrim covers the whole page, so a press aimed at anything behind it lands on
 * the scrim. The site remembers the answer for the account.
 */
function consentDialog(css: FeedClasses): string {
  return `<div class="${css.scrim}" style="z-index:90"><div class="${css.dialog} ${css.consent}" role="dialog" aria-modal="true" data-lb="consent-title"><div class="${css.dialogHead}"><h2 class="${css.dialogTitle}" data-uid="consent-title">Allow the use of cookies from Circleway on this browser?</h2></div><div class="${css.dialogBody}"><p style="margin:0">We use cookies and similar technologies to help provide and improve content on Circleway. We also use them to provide a safer experience by using information we receive from cookies on and off Circleway, and to provide and improve Circleway Products for people who have an account.</p><p style="margin:0">Essential cookies are required to use Circleway. Optional cookies let us show you more relevant ads and measure how they perform. You can review or change your choice at any time in your cookie settings.</p></div><div class="${css.dialogFoot}"><div class="${css.secondaryButton}" role="button" tabindex="0">Decline optional cookies</div><div class="${css.primaryButton}" role="button" tabindex="0">Allow all cookies</div></div></div></div>`;
}

function contactName(slug: string): string {
  return slug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
