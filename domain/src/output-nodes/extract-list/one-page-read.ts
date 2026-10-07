// The read a Flow's list extraction sends the page, and what moved off it
// (read-list redesign S4, contract C3).
//
// A Flow reads a list one page a pass; a Next page step and a repeat go through
// the rest, and the run's dataset collects each pass. So the parts of a request
// that worked over every page one read followed now work over every row the
// run collects, and only Core holds those: `dedupe`, `sort`, `maxItems` and
// `minItems` leave the page request and become the record output's `process`
// (`./record-output-process.ts`). `where` stays on the page, which is the only
// place that can test what a row does not store (design P6).
//
// - `dedupe {by}` stays `{by}`. A request with none sends none, and so does one
//   whose `by` is every column it reads -- "list each once" -- since that is
//   Core's default: the whole row, so only rows that carry nothing new are
//   folded (`./record-output-process.ts`).
// - `sort` keeps its keys; `maxItems` becomes `limit`; `minItems` `minRows`.
// - `minItems: 0` also stays on the page: it says an absent list is an answer,
//   which the page has to know to not fail the pass (`answer` below).
// - `paginate` is dropped. The dispatch has already refused one above a page
//   (`../../actions/extraction/retired-paging.ts`), so what is left reads the
//   page it was given.
// - `answer: "kept"` asks the page for the rows it kept, possibly none, never
//   the ones it rejected; the minimum it holds is then the items it saw
//   (`../../actions/extraction/request.ts`).
//
// The page request is the one the dispatch was going to send -- as written, or
// as the declared columns narrowed it (`./declared-columns.ts`) -- with those
// keys taken off, so anything else the author wrote reaches the page as before.

import type { JsonObject, JsonValue } from "fluxiq/core";
import type { WebAutomationExtractListRequest } from "../../actions/extraction";
import { webAutomationRecordOutputProcessOfRead, type WebAutomationRecordOutputProcess } from "./record-output-process";

/** The keys that leave a Flow's page request. */
const OFF_THE_PAGE = ["paginate", "dedupe", "sort", "maxItems", "minItems"] as const;

/**
 * The one-page request `sent` becomes, and the post-processing `request` -- the
 * same request, read -- declares for the collection, if any. `wholeRowDedupe`
 * says its dedupe is Core's default, written as none, which also clears any
 * dedupe its author wrote into the record output.
 */
export function webAutomationExtractListOnePageRead(sent: JsonObject, request: WebAutomationExtractListRequest): { page: JsonObject; process?: WebAutomationRecordOutputProcess; wholeRowDedupe: boolean } {
  const page: JsonObject = {};
  for (const [key, value] of Object.entries(sent)) {
    if (!(OFF_THE_PAGE as readonly string[]).includes(key) && value !== undefined) page[key] = value as JsonValue;
  }
  if (request.minItems === 0) page.minItems = 0;
  const { process, wholeRowDedupe } = webAutomationRecordOutputProcessOfRead(request);
  return Object.keys(process).length === 0 ? { page, wholeRowDedupe } : { page, process, wholeRowDedupe };
}
