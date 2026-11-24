// The page a read read, as the page's own answer states it: the action result's
// `url`, the address of the document the read ran in (a frame's own, for a list
// inside a frame). Nothing else is read off the answer (t1022).

import type { JsonValue } from "fluxiq/core";

/** The address the read's answer states, or `undefined` where it states none. */
export function webNodeReadAddress(payload: JsonValue | undefined): string | undefined {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return undefined;
  return typeof payload.url === "string" && payload.url !== "" ? payload.url : undefined;
}
