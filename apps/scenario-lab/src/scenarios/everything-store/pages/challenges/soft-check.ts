import { fixtureClient, page } from "../../../../html.js";
import { softCheckScript } from "../../client/index.js";
import { storeStylesheet } from "../../style/index.js";
import type { PageKit } from "../page-kit.js";

/**
 * The soft check a session's first search meets: "Click the button below to
 * continue shopping". It is served at the address that was asked for, so
 * passing it reloads straight onto the results. Honest behaviour passes it --
 * a click once the button is ready, or just waiting.
 */
export function renderSoftCheck(kit: PageKit): string {
  const { css } = kit;
  const body = `<div class="${css.challengePage}"><div class="${css.challengeBox}" data-testid="soft-check">
<p class="${css.logo}" style="color:#111">brightaisle</p>
<h4>Click the button below to continue shopping</h4>
<p>We're checking that your browser is set up to shop securely. This only takes a moment.</p>
<button type="button" class="${css.button} ${css.buttonPrimary}" data-continue disabled>Checking your browser&hellip;</button>
</div></div>
<style>${storeStylesheet(css)}</style>`;
  return page("Brightaisle.com", body, `${fixtureClient(kit.runToken, "everything-store")}
${softCheckScript()}`);
}
