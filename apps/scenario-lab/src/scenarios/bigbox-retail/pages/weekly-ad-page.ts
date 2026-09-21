import type { RenderContext } from "../../../types.js";
import { findProduct } from "../catalog/index.js";
import type { BigboxState } from "../types.js";
import { renderShell } from "../shell/index.js";
import { listingMarkup, tileDefaultsFor } from "../listing/index.js";

const FEATURED = ["433201844", "417553090", "402918013", "418830190"];

/** This week's ad, which the department bar opens in a new tab. */
export function renderWeeklyAdPage(state: BigboxState, context: RenderContext): string {
  const featured = FEATURED.map((id) => findProduct(id)!.product);
  return renderShell({
    state, context, kind: "ad", title: "Weekly Ad",
    tileDefaults: tileDefaultsFor(featured, state.storeId),
    main: (c) => `<h1>Weekly Ad</h1><p>Prices valid Sep 20 &ndash; Sep 26 at participating stores.</p><ul class="${c.railList}">${featured.map((product) => listingMarkup(product, state.storeId, c, "rail")).join("")}</ul>`,
  });
}
