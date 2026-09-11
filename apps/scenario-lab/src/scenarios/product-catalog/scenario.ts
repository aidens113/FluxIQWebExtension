import { page } from "../../html.js";
import { defineScenario } from "../../types.js";
import { catalogClientScript } from "./client-script.js";
import { defaultCatalogView, listCatalog } from "./listing.js";
import { productCatalogManifest } from "./manifest.js";
import { catalogPageBody } from "./markup.js";
import { routeCatalog } from "./route.js";
import { createCatalogState, mutateCatalogState } from "./state.js";
import type { ProductCatalogState } from "./types.js";

/**
 * Corpus rows W04-W07: a fixed 23-product catalog, eight per page, with
 * search on submit and an in-stock filter. The start page always opens on
 * page 1 of the whole catalog under the armed variant; every later view
 * comes from the `results` route, which records it through `mutate`.
 */
export const productCatalogScenario = defineScenario<ProductCatalogState>({
  id: "product-catalog",
  title: "Product catalog",
  startPath: "/scenarios/product-catalog/",
  seed: 114,
  manifest: productCatalogManifest,
  createState: () => createCatalogState(),
  mutate: mutateCatalogState,
  render: (state) => page("Product catalog", catalogPageBody(listCatalog(state.variant, defaultCatalogView()), state.variant), catalogClientScript()),
  route: (state, request) => routeCatalog(state, request),
});
