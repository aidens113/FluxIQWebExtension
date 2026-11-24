// The refusal of a read whose list does not stand on the page it read, or
// nothing (t1022): the one check a fresh read, a read run again and a replayed
// read all make after the page answered (`../run.ts`, `../replay.ts`).
//
// Whether the list stands is `plan-resolution/extraction/list-stands.ts`, the
// refusal's words `action-failure/read-list-elsewhere.ts`. The page read is the
// one the read's answer states (`./read-address.ts`), or the page the call was
// made on where the answer states none; a list the build's own Next page moved
// stands where the pager took it (`./list-pages.ts`).

import type { JsonObject, JsonValue } from "fluxiq/core";
import { webReadListElsewhereRefusal, type WebActionRefusal } from "../../action-failure";
import { webPlanListReadElsewhere, type WebPlanListReadElsewhere } from "../../plan-resolution";
import type { WebNodeListPages } from "./list-pages";
import { webNodeReadAddress } from "./read-address";

/** The action a list read runs as. */
const EXTRACT_LIST_ACTION = "web.dom.extract_list";

/** Where a read's list stands instead, and its refusal, when `actionType` is a list read whose list is not on the page it read. */
export function webNodeReadElsewhere(
  pages: WebNodeListPages,
  actionType: string,
  parameters: JsonObject,
  payload: JsonValue | undefined,
  calledOn: string | undefined
): { elsewhere: WebPlanListReadElsewhere; refused: WebActionRefusal } | undefined {
  if (actionType !== EXTRACT_LIST_ACTION) return undefined;
  const elsewhere = webPlanListReadElsewhere(parameters, webNodeReadAddress(payload) ?? calledOn, (item) => pages.wasMoved(item));
  return elsewhere === undefined ? undefined : { elsewhere, refused: webReadListElsewhereRefusal(elsewhere) };
}
