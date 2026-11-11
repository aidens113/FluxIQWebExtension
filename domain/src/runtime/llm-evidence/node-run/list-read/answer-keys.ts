// A live list read's answer with the list it read and the place the pager said, beside its rows (invariant I3).
//
// The same stamp a saved Flow's read gets (`output-nodes/extract-list/answered.ts`), so the model's
// `extraction.N` read and a Flow's read of one list carry one `listKey`. Only the node that reads a list
// has one; every other node's answer is handed back as it is.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationExtractListAnswered } from "../../../../output-nodes";

/** The node that reads a list (`../call-words.ts` names it the same way). */
const LIST_NODE = "web.output.dom-extract_list";

/** `read` with its `listKey` and `place`, for a read of `nodeId` run with `ran`. */
export function webListReadAnswerKeys(nodeId: string, read: JsonValue | undefined, ran: JsonObject): JsonValue | undefined {
  return nodeId === LIST_NODE ? webAutomationExtractListAnswered(ran, read) : read;
}
