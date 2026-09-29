// How many of a proposal's fields are read from inside the item: the record's
// own content, as opposed to what the item says about itself.
//
// A run's worth as a list of records is not its length. Measured on the
// everything store's cart (`docs/working/language-driven-flow-loop-plan/reports/cart-extraction.md`):
// the page-wide search, ranking by item count alone, answered with the four
// "Delete | Save for later | Compare | Share" links inside one cart line --
// four items, one field, the `data-action` each link carries -- while the two
// cart lines around them, each holding a title, a link, a quantity and a
// price, were no run at all. A list whose items expose at most one value of
// their own is a record's controls or decorations (its action links, its
// rating stars, its variant chips), not the records a person asks for.
//
// What counts: a field with a selector inside the item, or a table column.
// What does not: the item's own `data-*` attributes (a statement *about* the
// item, useful beside content but never content alone), a sensitive field
// proposed `exclude`, and a live control value, which is a form's state rather
// than a record's data (`detect-structure.ts` passes a form's rows over for the
// same reason).

import type { WebAutomationExtractionProposalField } from "@fluxiq-web-extension/domain/client";

/** The fields read from inside the item, counting only those in at least `minCoverage` of the run's items. */
export function contentFieldCount(fields: readonly WebAutomationExtractionProposalField[], minCoverage = 0): number {
  return fields.filter((field) =>
    field.spec.handling !== "exclude"
    && field.spec.kind !== "value"
    && (field.spec.kind === "column" || field.spec.selector !== undefined)
    && field.coverage >= minCoverage).length;
}
