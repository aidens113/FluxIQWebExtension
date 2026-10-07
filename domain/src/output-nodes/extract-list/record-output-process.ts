// What Core does with the rows a list read's dataset collects in a run, after
// they are stored, as the read declares it: which are the same row, their
// order, how many are kept, and how many there must be (read-list redesign P3).
//
// **Why it moved off the page.** A Flow reads a list one page a pass, and the
// run's dataset collects every pass (contract C3). `dedupe`, `sort`, `maxItems`
// and `minItems` used to run on the page over every page one read followed; a
// read of one page can only apply them to one page, so "newest first" would
// sort each page and "the first 25" would keep 25 a page. They now run over
// the whole collection, which only Core holds, so the dispatch writes them into
// the record output's `process` (`./dispatch.ts`) and stops sending them to the
// page.
//
// **Core's type, Core's validation.** `process` is Core's
// `AutomationStudioRecordProcessing` (read-list S1), reached through the record
// output's own type because the browser-safe `nodes` entry point does not name
// it. This module is only the mapping from the read; Core's record-output
// parser validates the whole output, `process` included, and the dispatch
// refuses the node with Core's issue codes when it does not parse.
//
// **"List each once" is Core's default.** A read whose dedupe is every column
// it reads -- which is what "list each once" resolves to
// (`../../actions/extraction/order-request.ts`) -- writes no `process.dedupe`,
// so Core's default whole-row identity applies: layout and case ignored, and
// rows with every value empty never merged. A `{by}` naming a subset is kept as
// written.

import type { AutomationStudioRecordOutput } from "fluxiq/automation-studio/nodes";
import { isWebAutomationExtractFieldRead, type WebAutomationExtractListRequest } from "../../actions/extraction";

/** A record output's post-processing: Core's `AutomationStudioRecordProcessing`. */
export type WebAutomationRecordOutputProcess = NonNullable<AutomationStudioRecordOutput["process"]>;

/**
 * The read's `dedupe`, `sort`, `maxItems` and `minItems` as Core's processing:
 * `dedupe {by}` stays `{by}` unless it is the whole row, `sort` keeps its keys,
 * `maxItems` becomes `limit` and `minItems` `minRows`. `wholeRowDedupe` says the
 * read deduplicates by the whole row, which is Core's default and so is written
 * as no dedupe at all.
 */
export function webAutomationRecordOutputProcessOfRead(request: WebAutomationExtractListRequest): { process: WebAutomationRecordOutputProcess; wholeRowDedupe: boolean } {
  const by = request.dedupe?.by ?? [];
  const wholeRowDedupe = dedupesWholeRow(request);
  const process: WebAutomationRecordOutputProcess = {
    ...(by.length > 0 && !wholeRowDedupe ? { dedupe: { by: [...by] } } : {}),
    ...(request.sort !== undefined && request.sort.length > 0
      ? { sort: request.sort.map((key) => ({ field: key.field, order: key.order, ...(key.as !== undefined ? { as: key.as } : {}) })) }
      : {}),
    ...(request.maxItems !== undefined ? { limit: request.maxItems } : {}),
    ...(request.minItems !== undefined ? { minRows: request.minItems } : {})
  };
  return { process, wholeRowDedupe };
}

/** Whether the read's dedupe names every column it reads: the whole record. */
function dedupesWholeRow(request: WebAutomationExtractListRequest): boolean {
  const by = new Set(request.dedupe?.by ?? []);
  const readable = Object.keys(request.fields).filter((key) => isWebAutomationExtractFieldRead(request.fields[key]));
  return by.size > 0 && readable.length > 0 && readable.every((key) => by.has(key));
}
