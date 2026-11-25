// What a detection declares of each list it issued a handle for: the list's key, as a read of it carries one, and
// whether the list shows a way to another page (t1032).
//
// Core's result header said "paging after unplaced read 1 not yet checked" for a list whose detection had said
// `pagination: "none"` (run-mwv5m906-5e999159), and the model spent 24 decisions looking for a pager that was not
// there. The packet's `pagination` is words for the model; Core cannot tie them to a read, because a read names its
// list by `listKey` (`output-nodes/extract-list/answered.ts`) and the packet names it by a handle. So the packet also
// carries, per handle's binding, that same `listKey` -- made from the binding's item selector and frame exactly as the
// read of it makes it -- and `pages`, whether the binding kept a pager (`paginate`, which Next page reads its way from).
// Core reads it (`framework/automation-service/service/answer-first/result-feed/list-pager.ts` in Core).
import { webAutomationExtractListKey } from "../../../output-nodes";
import { present } from "../present";
import type { WebLlmExtractionBinding } from "./handles";

/** One list's declaration, as Core reads it: its key and whether it shows a way to another page. */
type WebLlmStructureListPaging = { listKey: string; pages: boolean };

/** Each binding's declaration, one per list; `undefined` bindings are skipped. */
export function webLlmStructureListPaging(bindings: readonly (WebLlmExtractionBinding | undefined)[]): WebLlmStructureListPaging[] {
  const declared = new Map<string, boolean>();
  for (const binding of bindings) {
    if (binding === undefined) continue;
    const listKey = webAutomationExtractListKey({ item: binding.extractList.item, frameId: binding.frameId, frameUrlPath: binding.frameUrlPath });
    declared.set(listKey, (declared.get(listKey) ?? false) || binding.extractList.paginate !== undefined);
  }
  return [...declared].map(([listKey, pages]) => present<WebLlmStructureListPaging>({ listKey, pages }));
}
