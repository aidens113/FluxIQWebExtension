import { escapeHtml } from "../../../html.js";
import { VIEWER } from "../data/index.js";
import { mountId } from "../look/index.js";
import type { PageContext } from "./context.js";
import { avatar } from "./media.js";
import { ROOT } from "./text.js";

/**
 * The cookie dialog, over a scrim that takes every click until it is answered.
 *
 * The baseline is the dialog a large social network really ships, and it is the
 * one place on the site with test ids: its two buttons carry the
 * `cookie-policy-manage-dialog-*` hooks that network's own test suite left in
 * production. `consent-redesign` is the same site after a move to a new
 * consent vendor: the decline control is renamed "Only allow essential
 * cookies" and has no test id, "Allow all cookies" keeps its test id and moves
 * first, and a third control opens the vendor's preferences.
 */
export function consentMarkup(ctx: PageContext): string {
  if (ctx.state.consent !== "pending") return "";
  const { cls } = ctx.look;
  const titleId = mountId(ctx.seed, "consent-title");
  if (ctx.state.mode === "consent-redesign") {
    return `<div class="${cls.scrim}">
<div class="${cls.consent}" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
<h2 id="${titleId}">We use cookies to make Framelight work</h2>
<p>We use cookies to help personalise content, tailor and measure ads, and provide a safer experience. Essential cookies keep you signed in and remember your choices. You can review or change your choices at any time in your settings.</p>
<div class="${cls.consentActions}">
<div role="button" tabindex="0" class="${cls.primary}" data-testid="cookie-policy-manage-dialog-accept-button">Allow all cookies</div>
<div role="button" tabindex="0" class="${cls.secondary}">Only allow essential cookies</div>
<div role="button" tabindex="0" class="${cls.linkButton}">Manage options</div>
</div>
</div>
</div>`;
  }
  return `<div class="${cls.scrim}">
<div class="${cls.consent}" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
<h2 id="${titleId}">Allow the use of cookies from Framelight on this browser?</h2>
<p>We use cookies and similar technologies to help provide and improve content on Framelight. You can choose to allow optional cookies, which we use to personalise and measure ads and to improve our products. <a href="${ROOT}legal/cookies/">Learn more about cookies</a>.</p>
<div class="${cls.consentActions}">
<div role="button" tabindex="0" class="${cls.secondary}" data-testid="cookie-policy-manage-dialog-decline-button">Decline optional cookies</div>
<div role="button" tabindex="0" class="${cls.primary}" data-testid="cookie-policy-manage-dialog-accept-button">Allow all cookies</div>
</div>
</div>
</div>`;
}

/**
 * What the grid shows in place of its next screen once a visitor has scrolled
 * two screens: the saved-login check a session gets when its cookie is old.
 * Continuing needs no password. "Switch accounts" leads to a login form that
 * the lab's visitor has no password for.
 */
export function sessionWallMarkup(ctx: PageContext): string {
  const { cls } = ctx.look;
  return `<div class="${cls.wall}">
<div class="${cls.wallCard}">
${avatar(VIEWER, cls.avatarLarge)}
<p>Your session needs a quick check before we load more.</p>
<div role="button" tabindex="0" class="${cls.primary}">Continue as ${escapeHtml(VIEWER)}</div>
<a href="${ROOT}accounts/login/" class="${cls.linkButton}">Not ${escapeHtml(VIEWER)}? Switch accounts</a>
</div>
</div>`;
}
