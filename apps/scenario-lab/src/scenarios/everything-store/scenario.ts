import { defineScenario } from "../../types.js";
import { everythingStoreManifest } from "./manifest.js";
import { pageKit, renderHomePage, renderRobotCheck } from "./pages/index.js";
import { routeStore } from "./route.js";
import { createStoreState, mutateStoreState, robotCheckActive, type StoreState } from "./state/index.js";

/**
 * Brightaisle, an everything store at the scale and with the mess of a real
 * one: seventy pairs of earbuds over five pages of results with adverts
 * mixed in, a kettle in six variants with cheaper marketplace offers and a
 * lookalike, a returning shopper's cart, and a checkout that opens on the
 * store's preferences rather than hers. In front of it all sit the defences a
 * large store runs -- a honeypot, a rate limiter, a browser check, and a
 * robot check only a person can pass.
 *
 * The catalogue, the cart and every expected record are independent of the
 * lab seed. The seed renames every class and generated id on every page, and
 * draws the robot check's characters.
 */
export const everythingStoreScenario = defineScenario<StoreState>({
  id: "everything-store",
  title: "Everything store",
  startPath: "/scenarios/everything-store/",
  seed: 241,
  manifest: everythingStoreManifest,
  createState: (seed) => createStoreState(seed),
  mutate: mutateStoreState,
  render: (state, context) => robotCheckActive(state) ? renderRobotCheck(pageKit(state, context)) : renderHomePage(pageKit(state, context)),
  route: (state, request, context) => routeStore(state, request, context, Date.now()),
});
