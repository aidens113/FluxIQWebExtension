// Which detected lists a command turns the page of, by their item selectors
// (t1096): a Next page step's own list (`nextPage.item`, resolved), or, for a
// plain press, every list this build detected whose Next control is the one it
// presses (`../../structure/handles.ts`, `pagedBy`). Nothing for anything else.
//
// The same two facts serve twice. A page turn whose answer was lost is judged
// off the page, where an unchanged list proves it did not land
// (`../retries/page-effect.ts`); and a page turn that landed moved its lists,
// so their reads stand where it took them (`./list-pages.ts`), on a site that
// pages by its path too (`/page/2`). Before, a press on a list's Next was only
// a press, so neither held for it.
//
// Selectors only, as the detection kept them and the command carries them; no
// word of the page is read.

import type { JsonObject } from "fluxiq/core";
import type { WebNodeRun } from "../context";

const NEXT_PAGE_ACTION = "web.dom.next_page";
const PRESS_ACTION = "web.dom.click";

/** The item selectors of the lists the command `actionType` run with `parameters` (resolved, as dispatched) turns the page of (header). */
export function webNodeTurnedLists(run: Pick<WebNodeRun, "stores" | "request">, actionType: string, parameters: JsonObject): string[] {
  if (actionType === NEXT_PAGE_ACTION) {
    const request = parameters.nextPage;
    const item = typeof request === "object" && request !== null && !Array.isArray(request) && typeof request.item === "string" ? request.item.trim() : "";
    return item === "" ? [] : [item];
  }
  if (actionType !== PRESS_ACTION || typeof parameters.selector !== "string") return [];
  const frameId = typeof parameters.browserFrameId === "number" ? parameters.browserFrameId : undefined;
  return run.stores.extractions.pagedBy({ projectId: run.request.projectId, flowId: run.request.flowId }, parameters.selector, frameId);
}
