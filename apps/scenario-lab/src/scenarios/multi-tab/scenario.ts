import { defineScenario } from "../../types.js";
import { detailsPage } from "./details-page.js";
import { listPage } from "./list-page.js";
import { multiTabManifest } from "./manifest.js";
import { purchaseOrdersFor } from "./purchase-orders.js";
import { applyMultiTabOperation, type MultiTabState, type OpenPath } from "./transitions.js";

/**
 * Multi-tab fixture (corpus W15): a purchase-order list whose "Open details"
 * links open a new tab and whose one control opens a window through
 * `window.open`, plus a details document per order at
 * `/scenarios/multi-tab/details/<order>`, served by `route`, which records
 * every visit and how the tab was opened.
 */
export const multiTabScenario = defineScenario<MultiTabState>({
  id: "multi-tab",
  title: multiTabManifest.title,
  startPath: multiTabManifest.startPath,
  seed: multiTabManifest.seed,
  manifest: multiTabManifest,
  createState: (seed) => ({ seed, orders: purchaseOrdersFor(seed), popupsBlocked: false, detailsVisits: [], blockedOpens: [], reviewedOrders: [] }),
  mutate: applyMultiTabOperation,
  render: (state, context) => listPage(state, context.runToken),
  route(state, request) {
    const number = /^details\/([^/]+)$/.exec(request.subpath)?.[1];
    const order = state.orders.find((candidate) => candidate.order === number);
    if (!order) return undefined;
    const via = openPath(request.query.get("via"));
    return { status: 200, body: detailsPage(order), mutation: { operation: "record-visit", payload: { order: order.order, via } } };
  },
});

function openPath(value: string | null): OpenPath {
  return value === "link" || value === "window" ? value : "direct";
}
