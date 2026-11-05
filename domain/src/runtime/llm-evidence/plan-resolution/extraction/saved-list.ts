// What a saved list read holds, so that it needs no memory to run again (t869).
//
// A step's `ranWith` keeps a list read by its handle (`../../node-run/node-call.ts`),
// but `extraction.N` is only a name in one process's memory, for one Flow, and for the
// last sixteen lists detected (`../../structure/handles.ts`). So a read saved by one
// attempt could not be assembled under the Flow the chat makes for the next attempt,
// nor at all after Core restarted (`web.handle.unknown` at `extractList`), and the next
// attempt repaired steps it should have run. Worse, numbers start again in a new
// process, so the same `extraction.N` could come to name another list.
//
// So the step carries what its handle stood for beside it, under `extractionBinding`,
// as the detection kept it: every detected column, the item, the pager and the frame,
// never the handle. Then the columns, conditions and order the step wrote are read
// against that exactly as they are read against the store, on every path that reads a
// step: the assembly, a replay, a forward run. Where a step holds one it wins over
// the store, since it is what the handle meant when the step ran.
//
// **The model never sees it and cannot write it.** The key is one this domain denies
// (`../../denied-keys.ts`), so what the model is shown has it taken out, as a selector
// is, and a call the model wrote carrying one is refused (`./slot.ts`): it would be
// selectors it was never shown. A step it wrote or rewrote names its list by a handle
// the store must know, as ever.
//
// **Drafts saved before this hold no binding.** They read as they did: known to the
// store in the process that detected them, and otherwise refused, which sends the
// attempt to repair them, on its purse. Nothing reads one as a failed task.

import type { JsonObject, JsonValue } from "fluxiq/core";
import type { WebLlmExtractionBinding, WebLlmExtractionHandles, WebLlmExtractionHandleScope } from "../../structure";
import { present } from "../../present";
import { isJsonRecord } from "../../untrusted-json";
import { webPlanHandleKind } from "../handle-tokens";

/** Where a saved read keeps what its handle stood for. A denied evidence key (`../../denied-keys.ts`). */
export const WEB_PLAN_EXTRACTION_BINDING_KEY = "extractionBinding";

const LIST_PARAMETER = "extractList";

/** What `value`, a saved read's `extractList`, holds of the list `handle` named, or nothing where it holds nothing readable. */
export function webPlanSavedExtractionBinding(value: Record<string, unknown>, handle: string): WebLlmExtractionBinding | undefined {
  const saved = value[WEB_PLAN_EXTRACTION_BINDING_KEY];
  if (!isJsonRecord(saved) || typeof saved.location !== "string" || typeof saved.itemCount !== "number") return undefined;
  const list = saved.extractList;
  if (!isJsonRecord(list) || typeof list.item !== "string" || !isJsonRecord(list.fields)) return undefined;
  if (saved.frameId !== undefined && typeof saved.frameId !== "number") return undefined;
  if (saved.frameUrlPath !== undefined && typeof saved.frameUrlPath !== "string") return undefined;
  return present<WebLlmExtractionBinding>({
    handle,
    location: saved.location,
    frameId: saved.frameId,
    frameUrlPath: saved.frameUrlPath,
    extractList: structuredClone(list) as unknown as WebLlmExtractionBinding["extractList"],
    itemCount: saved.itemCount,
    oneRecord: saved.oneRecord === true ? true : undefined
  });
}

/**
 * `parameters` with what a list read's handle stands for now beside it (header), as the
 * step will be saved. Unchanged for a call that names no such list, or that holds one already.
 */
export function webPlanWithExtractionBinding(parameters: JsonObject, scope: WebLlmExtractionHandleScope, extractions: WebLlmExtractionHandles): JsonObject {
  const list = parameters[LIST_PARAMETER];
  if (!isJsonRecord(list) || Object.hasOwn(list, WEB_PLAN_EXTRACTION_BINDING_KEY)) return parameters;
  const handle = handleOf(list);
  if (handle === undefined) return parameters;
  const found = extractions.resolve(scope, handle);
  if (!found.ok) return parameters;
  const { binding } = found;
  const held = present<Omit<WebLlmExtractionBinding, "handle">>({ location: binding.location, frameId: binding.frameId, frameUrlPath: binding.frameUrlPath, extractList: binding.extractList, itemCount: binding.itemCount, oneRecord: binding.oneRecord });
  const saved = structuredClone(parameters);
  (saved[LIST_PARAMETER] as JsonObject)[WEB_PLAN_EXTRACTION_BINDING_KEY] = held as unknown as JsonValue;
  return saved;
}

/** The handle a read's value names: its own, its item's, or a field's, as the slot reads them. */
function handleOf(list: Record<string, unknown>): string | undefined {
  const fields = list.fields ?? list.columns;
  const named = [list, list.item, ...(Array.isArray(fields) ? fields : isJsonRecord(fields) ? Object.values(fields) : [])];
  for (const each of named) {
    const handle = isJsonRecord(each) ? each.handle : undefined;
    if (typeof handle === "string" && webPlanHandleKind(handle) === "extraction") return handle;
  }
  return undefined;
}
