// A read whose list is not on the page it read is refused, naming the list and
// the page it was made on, never kept as rows of whatever its selector matched
// there (t1022). Whether the list stands is `plan-resolution/extraction/list-stands.ts`;
// the words are `../rejection-next/list-made-on.ts`.
//
// The code is `target_not_found`, as a Next page asked where its list is not
// (`./next-page-list.ts`, t1013), and the reason the same `list_not_on_page`.

import type { WebPlanListReadElsewhere } from "../plan-resolution";
import { webLlmListMadeOn } from "../rejection-next";
import { rejectionDetail } from "../tool-rejection";
import type { WebActionRefusal } from "./refusal";

/** The refusal of a read whose list stands elsewhere (header). */
export function webReadListElsewhereRefusal(elsewhere: WebPlanListReadElsewhere): WebActionRefusal {
  return {
    code: "target_not_found",
    detail: rejectionDetail({ reason: "list_not_on_page", target: elsewhere.handle, instead: webLlmListMadeOn.code(elsewhere.madeAt), missing: undefined, requestId: undefined })
  };
}
