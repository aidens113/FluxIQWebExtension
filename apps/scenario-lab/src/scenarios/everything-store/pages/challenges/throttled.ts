import { escapeHtml, page } from "../../../../html.js";
import { storeStylesheet } from "../../style/index.js";
import type { PageKit } from "../page-kit.js";

/** The 429 page the rate limiter serves: how long to wait, and a link back to the same address. */
export function renderThrottled(kit: PageKit, retryAfterSeconds: number, href: string): string {
  const { css } = kit;
  const body = `<div class="${css.challengePage}"><div class="${css.challengeBox}" data-testid="rate-limited">
<p class="${css.logo}" style="color:#111">brightaisle</p>
<h4>Sorry, you're going a little too fast</h4>
<p>To keep Brightaisle fast for everyone, please wait ${retryAfterSeconds} seconds and try again.</p>
<p><a href="${escapeHtml(href)}">Try again</a></p>
</div></div>
<style>${storeStylesheet(css)}</style>`;
  return page("Brightaisle.com", body, "");
}
