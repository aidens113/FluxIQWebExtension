import type { JsonObject } from "fluxiq/core";

// These are fresh fixture interpretations of the written tasks, never a fallback for omitted historical metadata.
const HUBS: JsonObject = {
  where: [{ field: "price", atMost: 10 }, { field: "shipping", equals: "Free shipping" }, { field: "ad", is: "absent" }],
  sort: [{ field: "price", order: "asc", as: "number" }],
  columns: ["title", "store", "price", "rating"],
};
const KESTREL_AUCTIONS: JsonObject = {
  derive: [
    { id: "gbp_native", from: "price", pattern: String.raw`^£([\d,.]+)`, as: "number" },
    { id: "gbp_approx", from: "text_4", pattern: String.raw`£([\d,.]+)`, as: "number" },
    { id: "ends", from: "text_8", pattern: String.raw`\((.*)\)`, as: "date" },
  ],
  dedupe: { by: ["link_text", "price", "text_8"] },
  where: [
    { field: "link_text", matches: String.raw`kestrel 35(?![\w-])(?!\s?(s\b|mk|mark))` },
    { field: "link_text", contains: ["case only", "lens cap", "lens only", "box only", "instruction manual", "half case", "hood", "strap", "filter", "flashgun", "self-timer", "Kestrel 35 & Kestrel 35S", "spares", "dummy", "untested", "not working", "Job lot"], not: true },
    { field: "text_2", contains: "parts", not: true },
    { field: "text_5", contains: "bid" },
  ],
  anyOf: [
    [{ field: "price", startsWith: "£" }, { field: "gbp_native", lessThan: 150 }],
    [{ field: "price", startsWith: "£", not: true }, { field: "gbp_approx", lessThan: 150 }],
  ],
  sort: [{ field: "ends", order: "asc", as: "date" }],
  columns: ["link_text", "price", "text_5", "text_9"],
};
const DECLARATIONS: Readonly<Record<string, JsonObject>> = Object.freeze({
  "company-website-apprentices": { where: [{ field: "role", contains: "apprentice" }], columns: ["name", "role", "branch"] },
  "company-website-saturday-certificate": {
    where: [{ field: "group heading", contains: "Sat" }, { field: "disabled", is: "absent" }],
    sort: [{ field: "date", order: "asc", as: "date" }, { field: "time", order: "asc", as: "text" }],
    columns: ["date", "time"],
  },
  "auction-marketplace-kestrel-auctions": KESTREL_AUCTIONS,
  "bigbox-retail-new-store-cheapest-towels": { columns: ["item", "quantity", "price"] },
  "bigbox-retail-rated-delivery-towels": {
    where: [{ field: "name", contains: "paper towel" }, { field: "name", contains: ["holder", "dispenser"], not: true }, { field: "rating", atLeast: 4.5 }, { field: "ad", is: "absent" }, { field: "fulfillment", contains: "Delivery" }],
    // The script selects Highest rating first; a stable rating sort preserves that site's tie order.
    sort: [{ field: "rating", order: "desc", as: "number" }],
    columns: ["name", "price", "rating"],
  },
  "crossborder-marketplace-free-hubs-under-ten": HUBS,
  "crossborder-marketplace-free-hubs-under-ten-timed-check": HUBS,
  // Final cart/saved/accepted datasets have already been scoped by their actual producer and actions.
  "everything-store-batteries-and-descaler": { columns: ["item", "quantity", "price"] },
  "professional-network-accept-messaged-invitations": { where: [{ field: "message", is: "present" }], columns: ["name", "message"] },
  "local-classifieds-save-dining-tables": { sort: [{ field: "price", order: "asc", as: "number" }], columns: ["title", "price", "status"] },
});

/** Exact per-task criteria only; an unsupported task never becomes empty processing or action-only. */
export function scriptedTaskProcess(taskId: string): JsonObject {
  if (!Object.hasOwn(DECLARATIONS, taskId)) throw new Error(`No processing fixture is declared for ${taskId}`);
  return structuredClone(DECLARATIONS[taskId]!);
}
