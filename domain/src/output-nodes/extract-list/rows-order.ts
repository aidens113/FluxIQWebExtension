/**
 * How the list extraction's rows come out, as its node definition declares it
 * to Core (`../definitions.ts` metadata, t751).
 *
 * **Page order, and nothing reorders it.** The read hands the rows it kept to
 * the next node -- a For Each a `repeat over` became -- in the order the page
 * shows them. Its `sort` and `maxItems` do not reach those rows: since read-list
 * S4 they leave the page request and become the record output's `process.sort`
 * and `process.limit` (`./one-page-read.ts`, `./record-output-process.ts`),
 * which shape only the answer the run saves at its end.
 *
 * Core's rule for a lasting act repeated over a listing
 * (`flow-bootstrap/script-statements/listing-order-in-repeat.ts`) told every
 * builder to put the order on the listing, `extractList.sort`. Here that was
 * moved into the process and refused in turn, and so was the one coherent shape
 * left, a limit equal to `repeat most` with no sort: photo rerun 5
 * (`run-mvhibis0-b536958b`) spent its last sixteen steps between the two. So
 * the node says what it can do, and Core asks only for that:
 *
 * - `answersRows: "page_order"` -- Core admits a process limit of N when the
 *   lasting repeat it feeds stops after the same N (saved rows = acted rows).
 *   Since t796 Core also hands each such repeat the listing's own sort as its
 *   order, applied before its stop, so a sort written on the listing is
 *   admitted; one written only in the process is refused with an answer that
 *   puts it on the listing.
 * - `recordProcessWrittenAt` -- where a model writes the two process keys this
 *   node fills from its own request, so Core reads them there too and refuses
 *   at the key the model wrote (`extractList.sort`, `extractList.maxItems`),
 *   never at a `process` key it never wrote. The pairs are the mapping
 *   `./record-output-process.ts` makes: `sort` stays `sort`, `maxItems`
 *   becomes `limit`.
 */
export const WEB_AUTOMATION_EXTRACT_LIST_ROWS_ORDER = {
  answersRows: "page_order",
  recordProcessWrittenAt: { sort: "extractList.sort", limit: "extractList.maxItems" }
} as const;
