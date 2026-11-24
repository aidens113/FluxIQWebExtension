// What finds a control shown chosen again on a later visit (t1030): its
// address and identity, as the look that showed it resolved its handle
// (`../../plan-resolution/target-packets.ts`, `resolveOn`), the same two a
// press's step keeps for the control it pressed (`ranWith`'s `selector` and
// `element`). The identity leaves out the classes that set a chosen option
// apart from its like siblings (`apps/extension/src/content/describe-element.ts`,
// t436), so it finds the option whether or not it is chosen when looked for.
//
// Core carries it unread onto the draft step (`chosen[].at`) and writes it into
// a saved act's `requiresChosen` (`../../../../actions/requires-chosen/`),
// which the page checks before the act. A control the look could not resolve
// to one address, or one in a child frame, has none: the act's own frame is
// the only one its check reads, so such an option is never required.

import type { JsonObject } from "fluxiq/core";
import type { WebLlmTargetResolution } from "../../plan-resolution";

/** The control's `{ selector, element }` from its resolution on the look that showed it, or nothing. */
export function webStandingChoiceAt(resolved: WebLlmTargetResolution): JsonObject | undefined {
  if (!resolved.ok || (resolved.frameId !== undefined && resolved.frameId !== 0) || resolved.frameUrlPath !== undefined) return undefined;
  return { selector: resolved.selector, element: structuredClone(resolved.element) as unknown as JsonObject };
}
