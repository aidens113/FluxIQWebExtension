// A live list read's answer with the list it read and the place the pager said, beside its rows (invariant I3), and
// the names of the columns it kept (t1038, D13).
//
// The same stamp a saved Flow's read gets (`output-nodes/extract-list/answered.ts`), so the model's
// `extraction.N` read and a Flow's read of one list carry one `listKey`. Only the node that reads a list
// has one; every other node's answer is handed back as it is.
//
// `columns` is every column the read kept, in the order its rows hold them, under the name each row
// holds it by: the plan's own key for a column `fields` asked for, and the column's readable name for every
// other (`../../structure/column-names.ts`). A read keeps every column of its list, so these are the names a
// later read's `fields`, a condition or the result's processing may pick from, and they are said even when no row
// was read. `asked` names the ones `fields` picked, where it picked some. Names only: never a value.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationExtractListAnswered } from "../../../../output-nodes";
import { isJsonRecord } from "../../untrusted-json";

/** The node that reads a list (`../call-words.ts` names it the same way). */
const LIST_NODE = "web.output.dom-extract_list";

/** `read` with its `listKey`, `place`, `columns` and `asked`, for a read of `nodeId` run with `ran`. */
export function webListReadAnswerKeys(nodeId: string, read: JsonValue | undefined, ran: JsonObject): JsonValue | undefined {
  if (nodeId !== LIST_NODE) return read;
  const answered = webAutomationExtractListAnswered(ran, read);
  const list = ran.extractList;
  if (!isJsonRecord(answered) || !isJsonRecord(list) || !isJsonRecord(list.fields)) return answered;
  const asked = Array.isArray(list.askedFields) ? list.askedFields.filter((name): name is string => typeof name === "string") : [];
  const whole: JsonObject = answered;
  const stamped: JsonObject = { ...whole, columns: Object.keys(list.fields) };
  if (asked.length > 0) stamped.asked = asked;
  return stamped;
}
