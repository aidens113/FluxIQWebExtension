// The scroll request a `web.dom.scroll` command runs once its target is known.
//
// `gateway-action-parameters.ts` reads the `scroll` parameter alone, without the
// action or its target, so it cannot tell a scroll that names an element from
// one that names a position. A scroll step authored with a target and no
// `scroll` request was therefore left without one, and the extension's verb
// (`content/actions/scroll.ts`) made its legacy absolute move to `options.x`/
// `options.y` -- which Core fills with `0` defaults on every scroll step --
// never resolving the target, and reported `succeeded` under the target's name
// (breadth round, codex social revisions 1 and 3).
//
// A step that names an element and asks for no particular move means "scroll
// to that element": the existing `toElement` mode, so the verb resolves the
// target and an unresolved one fails as any other target does. Only a named
// element counts -- a selector or a recorded fingerprint. A point (`coordinates`)
// is a position to move to, and a visual target alone is a point too.
//
// What stays as it was: a readable request with an explicit mode; a request
// that was sent but could not be read (it asked for something, and the verb
// refuses it from `options.scroll`, rather than this reading it as a scroll to
// the target); and a scroll that names no element, the legacy absolute move.

import type { WebAutomationActionType, WebAutomationScrollRequest } from "../actions/types";

/**
 * `lifted` is what the parameter reader made of `parameters.scroll`; `sent` is
 * that raw parameter; `namesElement` says whether the command names an element
 * by selector or fingerprint.
 */
export function webAutomationTargetedScrollRequest(
  actionType: WebAutomationActionType,
  lifted: WebAutomationScrollRequest | undefined,
  sent: unknown,
  namesElement: boolean
): WebAutomationScrollRequest | undefined {
  if (actionType !== "web.dom.scroll" || lifted !== undefined || sent !== undefined || !namesElement) return lifted;
  return { mode: "toElement" };
}
