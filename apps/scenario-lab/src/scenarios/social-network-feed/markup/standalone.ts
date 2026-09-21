import { escapeHtml as esc, fixtureClient, page } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { feedClasses } from "./classes.js";
import { glyph, SITE_ROOT } from "./parts.js";
import { feedStylesheet } from "./stylesheet.js";

/**
 * The full-page "Circleway is better in the app" interstitial the
 * `app-install` rendering opens on. The big button leads to an app store page
 * and nothing else; the way on is the small grey "Continue in browser" line
 * underneath, which is not a link and not a button, only text that answers a
 * click. The answer is kept for the account, so the feed appears on reload.
 */
export function renderAppPromo(context: RenderContext): string {
  const css = feedClasses(context.seed);
  const body = `<div class="${css.promo}" data-testid="app-promo"><div style="display:grid;gap:16px;justify-items:center;max-width:420px"><span class="${css.logo}" style="width:72px;height:72px;font-size:40px">c</span><h1 style="margin:0;font-size:28px">Circleway is better in the app</h1><p style="margin:0;opacity:.9">Get notifications as they happen, send messages faster and watch videos without the wait. It's free, and it takes less than a minute.</p><a class="${css.promoButton}" href="${SITE_ROOT}app-store/">Open the Circleway app</a><p style="margin:24px 0 0;font-size:13px;opacity:.75;cursor:pointer">Continue in browser</p></div></div><style>${feedStylesheet(css, context.seed)}</style>`;
  const script = `${fixtureClient(context.runToken, "social-network-feed")}
const onward = document.querySelector('.${css.promo.split(" ")[0]} p:last-child');
onward.addEventListener('click', async () => { await mutate('app-promo', { choice: 'dismissed' }); location.reload(); });`;
  return page("Circleway", body, script);
}

/** Where "Open the Circleway app" goes: a store listing with an Install button and no way back to the feed but the browser's. */
export function renderAppStore(context: RenderContext): string {
  const css = feedClasses(context.seed);
  const body = `<div class="${css.pageBody}" style="margin-top:24px"><div class="${css.card}" style="padding:24px;display:grid;gap:12px"><span class="${css.logo}" style="width:72px;height:72px;font-size:40px">c</span><h1 style="margin:0">Circleway</h1><p class="${css.muted}" style="margin:0">Circleway Platforms · Social networking · 4.1 stars · 1B+ downloads</p><div class="${css.primaryButton}" role="button" tabindex="0">Install</div><p style="margin:0">Open this page on your phone to install the app.</p></div></div><style>${feedStylesheet(css, context.seed)}</style>`;
  return page("Circleway - Apps on the store", body, "");
}

/**
 * The outbound-link shim every external link passes through. It names the
 * destination and asks for a second press, and the lab being loopback-only,
 * the destination is shown and never followed.
 */
export function renderLinkShim(context: RenderContext, query: URLSearchParams): string {
  const css = feedClasses(context.seed);
  const destination = query.get("u") ?? "";
  const body = `<div class="${css.pageBody}"><div class="${css.card}" style="padding:24px;display:grid;gap:12px"><h1 class="${css.heading}">You're leaving Circleway</h1><p style="margin:0">The link you clicked is taking you to a website outside Circleway. Make sure you trust it before you continue.</p><p class="${css.muted}" style="margin:0;word-break:break-all">${esc(destination)}</p><div style="display:flex;gap:8px"><a class="${css.secondaryButton}" href="${SITE_ROOT}">Go back</a><span class="${css.primaryButton}" aria-disabled="true">Follow link</span></div></div></div><style>${feedStylesheet(css, context.seed)}</style>`;
  return page("Leaving Circleway", body, "");
}

/**
 * The embedded video player, served from the lab's second origin so the
 * frame is a cross-origin one, as a third-party player is. It plays nothing;
 * it is a document of its own that a run has to see past.
 */
export function renderEmbed(title: string): string {
  const body = `<div style="position:fixed;inset:0;background:#111;color:#fff;display:grid;place-items:center;font:14px system-ui"><div style="display:grid;gap:10px;justify-items:center"><div role="button" tabindex="0" aria-label="Play" style="width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,.2);display:grid;place-items:center;cursor:pointer">${glyph("play", 32)}</div><strong>${esc(title)}</strong><span style="opacity:.7">2:14 · ViewTube</span><a href="#" style="color:#9cf">Watch on ViewTube</a></div></div>`;
  return page(`${title} - ViewTube`, body, "");
}
