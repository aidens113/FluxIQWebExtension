// Reading a repeating structure into records.
//
// `item` selects each record's root; `fields` maps a field name to a selector
// inside it, in the scenario contract's forms: a plain selector reads text,
// `selector@attribute` reads an attribute, and `column:<header text>` reads the
// cell under that header when the items are table rows, so extraction survives
// a column reorder. With `paginate`, the `next` control is followed until it is
// absent or `maxPages` pages have been read, waiting for the list to change
// after each page rather than for a fixed delay. `maxItems` bounds the result.
//
// `missingFields` names every declared field that some record lacked, which is
// what makes the verb's validation fail instead of silently returning blanks.
//
// Owned by `w2-extract-list`, which replaces this stub.

import type { WebAutomationExtractListRequest } from "../types";

export type ExtractedListRecord = Record<string, string>;

export type ListExtractionOutcome = {
  records: ExtractedListRecord[];
  /** Pages actually read, the first included. */
  pagesRead: number;
  /** Whether `maxItems` or `maxPages` stopped the read before the list ended. */
  truncated: boolean;
  /** Declared fields that at least one record did not yield. */
  missingFields: string[];
};

export function extractList(_request: WebAutomationExtractListRequest): Promise<ListExtractionOutcome> {
  throw new Error("The list-extraction capability is not implemented yet.");
}
