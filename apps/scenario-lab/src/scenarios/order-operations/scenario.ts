import { defineScenario } from "../../types.js";
import { orderOperationsManifest } from "./manifest.js";
import { renderOrderBookPage } from "./markup.js";
import { routeOrderOperations } from "./route.js";
import { createOrderOperationsState, mutateOrderOperationsState } from "./state.js";
import type { OrderOperationsState } from "./types.js";

/**
 * An order back office the size of a real one: a 280-order book in an
 * application shell, every class name a build hash, one action button per row
 * identical to the other 279, and an order page of its own holding the lines,
 * the delivery address and the refund control.
 *
 * Every workflow here changes something or reads something the list does not
 * hold, which is the point of the fixture: a run is judged on the state it left
 * behind, not only on what it managed to read.
 *
 * Nothing depends on the lab seed. The book is authored, the manifest's
 * expected records are literal text, and both must read the same on every run.
 */
export const orderOperationsScenario = defineScenario<OrderOperationsState>({
  id: "order-operations",
  title: "Order operations",
  startPath: "/scenarios/order-operations/",
  seed: 142,
  manifest: orderOperationsManifest,
  createState: () => createOrderOperationsState(),
  mutate: mutateOrderOperationsState,
  render: renderOrderBookPage,
  route: routeOrderOperations,
});
