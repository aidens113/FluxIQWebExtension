import { escapeHtml, fixtureClient, page } from "../../../html.js";
import { photoClientScript, type ClientModule } from "../client/index.js";
import { VIEWER, postByCode } from "../data/index.js";
import { glyph, mountId, photoStylesheet, type GlyphName } from "../look/index.js";
import { RELAY_SUBJECTS } from "../relay.js";
import type { PageContext } from "./context.js";
import { photoAlt, photoSrc } from "./media.js";
import { consentMarkup } from "./overlays.js";
import { ROOT } from "./text.js";

export type ShellOptions = {
  title: string;
  main: string;
  /** Which of the page's behaviours load, beyond the shared ones. */
  modules: readonly ClientModule[];
  /** Facts about this page the page's own script needs: which post, profile, thread or collection it is. */
  page: Record<string, unknown>;
  /** The messages dock stays off the inbox, as it does on the real site. */
  dock?: boolean;
  /** The strip under the feed that asks the visitor to use the app. */
  appBanner?: boolean;
};

type NavItem = { label: string; glyph: GlyphName; href?: string; badge?: string };

/**
 * The left navigation. Every item is an icon whose svg carries the label and a
 * text label beside it, so each accessible name says the word twice. Search,
 * Notifications, Create and More are not links at all but divs that open
 * panels. The Messages badge says 2 and never changes: it is counted when the
 * app shell is cached, not when threads are read.
 */
const NAV: readonly NavItem[] = [
  { label: "Home", glyph: "home", href: ROOT },
  { label: "Search", glyph: "search" },
  { label: "Explore", glyph: "explore", href: `${ROOT}explore/` },
  { label: "Reels", glyph: "reels", href: `${ROOT}reels/` },
  { label: "Messages", glyph: "messages", href: `${ROOT}direct/inbox/`, badge: "2" },
  { label: "Notifications", glyph: "heart" },
  { label: "Create", glyph: "create" },
  { label: "Profile", glyph: "home", href: `${ROOT}${VIEWER}/` },
  { label: "More", glyph: "more" },
];

function navMarkup(ctx: PageContext): string {
  const { cls } = ctx.look;
  const items = NAV.map((item) => {
    const inner = `${glyph(item.glyph, cls.navIcon, item.label)}<span class="${cls.navLabel}">${item.label}</span>${item.badge ? `<span class="${cls.navBadge}">${item.badge}</span>` : ""}`;
    return item.href
      ? `<a class="${cls.navItem}" href="${item.href}">${inner}</a>`
      : `<div class="${cls.navItem}" role="link" tabindex="0">${inner}</div>`;
  }).join("");
  return `<div class="${cls.nav}"><a class="${cls.navBrand}" href="${ROOT}">Framelight</a>${items}</div>`;
}

function relayMarkup(ctx: PageContext): string {
  return (Object.keys(RELAY_SUBJECTS) as Array<keyof typeof RELAY_SUBJECTS>)
    .map((key) => `<script type="text/plain" data-testid="${RELAY_SUBJECTS[key]}">${escapeHtml(ctx.state.relay[key])}</script>`)
    .join("");
}

/** What the page's own script is handed: the styling, the run's changes, and this page's facts. */
function clientConfig(ctx: PageContext, options: ShellOptions): Record<string, unknown> {
  const { state } = ctx;
  const collectionCover = (codes: readonly string[]) => {
    const post = codes[0] === undefined ? undefined : postByCode(codes[0]);
    return post ? photoSrc(post, 0) : "";
  };
  return {
    root: ROOT,
    viewer: VIEWER,
    mode: state.mode,
    consent: state.consent,
    notificationsAnswered: state.notificationsAnswered,
    dockMinimized: state.dockMinimized,
    sessionConfirmed: state.sessionConfirmed,
    upsellDismissed: state.upsellDismissed,
    blocked: state.blocked,
    saved: state.saved,
    liked: state.liked,
    following: state.following,
    // The save dialog's counts are taken here, once, which is the stale badge
    // the real dialog has: a post added through it does not move its count.
    collections: state.collections.map(({ name, slug, codes }) => ({ name, slug, codes, count: codes.length, cover: collectionCover(codes) })),
    savedPosts: state.saved.map((code) => postByCode(code)).filter((post) => post !== undefined).map((post) => ({ code: post.code, alt: photoAlt(post), src: photoSrc(post, 0) })),
    cls: ctx.look.cls,
    hook: ctx.look.hook,
    ids: { dialog: mountId(ctx.seed, "dialog"), upsell: mountId(ctx.seed, "upsell"), notify: mountId(ctx.seed, "notify") },
    relay: RELAY_SUBJECTS,
    dock: options.dock !== false,
    page: options.page,
  };
}

/** One Framelight document: navigation, the page, the consent dialog when unanswered, the oracle scripts, and the page's script. */
export function photoDocument(ctx: PageContext, options: ShellOptions): string {
  const { cls } = ctx.look;
  const banner = options.appBanner ? `<div class="${cls.banner}"><span>Get the full Framelight experience in the app.</span><a class="${cls.primary}" href="${ROOT}l/?u=${encodeURIComponent("apps.example/framelight")}" target="_blank" rel="noopener">Open app</a><div role="button" tabindex="0" class="${cls.iconButton}">${glyph("close", cls.navIcon)}</div></div>` : "";
  const body = `<div class="${cls.app}" id="${mountId(ctx.seed, "root")}">
${navMarkup(ctx)}
<main class="${cls.main}" role="main">${options.main}</main>
</div>
${banner}
${consentMarkup(ctx)}
${relayMarkup(ctx)}
<style>${photoStylesheet(ctx.look)}</style>`;
  const script = `${fixtureClient(ctx.runToken, "photo-social")}
const FL = ${JSON.stringify(clientConfig(ctx, options)).replaceAll("</", "<\\/")};
${photoClientScript(options.modules)}`;
  return page(options.title, body, script);
}
