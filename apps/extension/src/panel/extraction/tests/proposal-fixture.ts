// A proposal shaped like the one the picker sends for a product list: a plain
// text column, a link, a table column with a header, an attribute, and a
// password field the sensitivity rule has already marked `exclude`.
//
// The planted card number is not decoration. Several rows below assert that it
// appears in nothing the panel builds, and a value that is distinctive enough to
// search for is the only way to assert that cheaply.

import type { WebAutomationExtractionProposal } from "@fluxiq-web-extension/domain/client";

/** A value no other part of a fixture holds, so finding it anywhere is proof it leaked. */
export const PLANTED_VALUE = "4242424242424242";

/** The proposal under test, with one field per kind the panel can offer. */
export function proposalFixture(): WebAutomationExtractionProposal {
  return {
    container: "ul.products",
    item: "ul.products > li",
    itemCount: 8,
    confidence: 0.9,
    fields: [
      { key: "name", label: "Name", coverage: 1, spec: { kind: "text", selector: ".name" } },
      { key: "detail", label: "Detail", coverage: 0.75, spec: { kind: "link", selector: "a.detail" } },
      { key: "price", label: "Price", coverage: 1, spec: { kind: "column", selector: "td", header: "Price" } },
      { key: "sku", label: "Sku", coverage: 1, spec: { kind: "attribute", selector: "[data-sku]", attribute: "data-sku" } },
      { key: "card", label: "Card number", coverage: 1, spec: { kind: "value", selector: "input.card", handling: "exclude" } }
    ],
    pagination: { next: "a.next", maxPages: 5 }
  };
}
