import { escapeHtml } from "../../../html.js";
import { specOptions, storeById, VOLTBAY_OFFICIAL_ID, type Listing } from "../catalog/index.js";

/**
 * The item description: a separate document the product page frames, as the
 * seller's rich description is on the live site. It holds the specification
 * table and the seller's copy, including the one sentence that matters for a
 * buyer choosing a warehouse -- which options each warehouse actually stocks.
 */
export function renderItemDescription(listing: Listing): string {
  const store = storeById(listing.storeId);
  const specs = specOptions(listing);
  const rows: Array<[string, string]> = [
    ["Brand Name", listing.title.split(" ")[0] ?? ""],
    ["Origin", "Mainland China"],
    ["Interface", "USB Type-C"],
    ["Colour options", listing.colors.join(", ")],
    ...(specs.length > 0 ? [["Specification", specs.join(", ")] as [string, string]] : []),
    ["Ships from", listing.origins.join(", ")],
    ["Material", "Aluminium alloy"],
    ["Certification", "CE, FCC, RoHS"],
  ];
  const warehouseNote = listing.id === VOLTBAY_OFFICIAL_ID
    ? "<p>Items sent from our Spanish warehouse arrive in 3-5 working days anywhere in mainland EU. Please note that the Space Grey 7-in-1 is out of stock in Poland this month.</p>"
    : listing.origins.includes("Spain") ? "<p>Items sent from our Spanish warehouse arrive in 3-5 working days anywhere in mainland EU.</p>" : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Item description</title>
<style>body{font:14px/1.5 system-ui,sans-serif;margin:0;padding:16px;color:#222}table{border-collapse:collapse;width:100%;margin:12px 0}td{border:1px solid #eee;padding:6px 10px}td:first-child{background:#fafafa;width:40%}h2{font-size:16px}</style></head>
<body>
<h2>Specifications</h2>
<table>${rows.map(([name, value]) => `<tr><td>${escapeHtml(name)}</td><td>${escapeHtml(value)}</td></tr>`).join("")}</table>
<h2>Description</h2>
<p>${escapeHtml(listing.title)}.</p>
<p>Sold by ${escapeHtml(store.name)}. One cable for everything: plug in your monitor, keyboard, memory cards and charger at once. Plug and play, no drivers needed.</p>
${warehouseNote}
<p>Package includes: 1 x hub, 1 x user manual. Colours may vary slightly between monitors.</p>
</body></html>`;
}
