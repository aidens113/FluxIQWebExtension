import { defineScenario } from "../../types.js";
import { bigboxRetailManifest } from "./manifest/index.js";
import { renderHomePage } from "./pages/index.js";
import { routeBigbox } from "./route.js";
import { createBigboxState, mutateBigboxState } from "./state/index.js";
import type { BigboxState } from "./types.js";

/**
 * ValueRidge, a fictional big-box retailer modelled on the stores people
 * actually automate: a storefront, search with filters and ads, product pages
 * with sizes and fulfilment choices, a cart, and a guest pickup checkout.
 *
 * The lab seed reaches only the generated class names and element ids; the
 * catalog, the prices, the stores and every relative day are fixed, so the
 * manifest's expectations are literal text and hold under any seed.
 */
export const bigboxRetailScenario = defineScenario<BigboxState>({
  id: "bigbox-retail",
  title: "Big-box retail",
  startPath: "/scenarios/bigbox-retail/",
  seed: 239,
  manifest: bigboxRetailManifest,
  createState: () => createBigboxState(),
  mutate: mutateBigboxState,
  render: renderHomePage,
  route: routeBigbox,
});
