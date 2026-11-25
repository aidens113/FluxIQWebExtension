// Which fields of a list read are held to showing their full text (t1033).
//
// A read keeps every detected column beside the asked ones (t982), and the
// request says which were asked (`askedFields`). A kept-only column is read as
// the page shows it: its collapsed "See more" is never pressed, and never
// refuses the read `incomplete_text`. What the read judges or orders by -- a
// column a `where` condition, `dedupe` or `sort` names -- still needs its whole
// text, since a decision made on a partial one is a wrong decision.

import type { WebAutomationExtractListRequest } from "../../types";

/**
 * The fields held to full text, or `undefined` when every field is: a request
 * that names no `askedFields`, as every request written before t1033.
 */
export function wholeFields(request: Pick<WebAutomationExtractListRequest, "askedFields" | "where" | "dedupe" | "sort">): ReadonlySet<string> | undefined {
  if (request.askedFields === undefined) return undefined;
  const whole = new Set(request.askedFields);
  for (const condition of request.where ?? []) if (typeof condition.field === "string") whole.add(condition.field);
  for (const name of request.dedupe?.by ?? []) whole.add(name);
  for (const key of request.sort ?? []) whole.add(key.field);
  return whole;
}
