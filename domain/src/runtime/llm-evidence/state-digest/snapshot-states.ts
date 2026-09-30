// The state digest and the route state of one capture, taken from the capture
// a call already made.
//
// ## Why a call digests its own captures
//
// Core's build loop used to ask `captureStateDigest` (`./tools.ts`) before and
// after every call, and each answer was a whole `web.dom.capture_snapshot` of
// its own: a look cost three captures and an action four plus the action, and
// every one of them was a "Looking at the page" the person watching saw
// (`docs/working/language-driven-flow-loop-plan/reports/looking-at-page-repeat.md`,
// section 2). The call already holds those states -- a look's one capture, an
// action's read before acting and its read after -- so the digest is taken from
// them and reported on the result (`stateDigests`), and the binding says so
// (`stateDigestsOnCalls`), which is what stops Core asking.
//
// ## Why the route state rides on the same capture
//
// Core's build routing asks the host's `observeRouteState`
// (`../host-runtime.ts`) for the route state each exploration step left, and
// each answer is another whole capture
// (`docs/working/language-driven-flow-loop-plan/reports/flow-builder-walkthrough.md`,
// sections 3 and 7). That answer is a projection of the packet
// (`../route-state/project.ts`), and the call already holds the page it left,
// so the call reports it (`routeState`) and Core captures only where no call
// left one. It must be the very value `observeRouteState` would return for
// that page, or a Router built on one would test something the other never
// produces.
//
// ## Why neither is simply read off the packet the call returns
//
// Both are compared for equality with values taken at other moments: a digest
// with other digests and with `captureStateDigest`, a route state with what
// `observeRouteState` reads when the Flow runs. So neither may depend on
// anything but the page. The packet a call returns does depend on the call: it
// is bounded to the call's own `maxEvidenceBytes` -- a look keeps room for its
// envelope, a refusal for its own -- and a tighter bound drops elements both
// read (the digest its elements, the route state `page.controls`). So both are
// of the capture sanitized exactly as `captureStateDigest` and
// `observeRouteState` sanitize it, which is one and the same sanitization: the
// exploration budget's default bound, no expected origin (which only ever
// refuses, never changes a packet), and no failed action. Where the call's own
// bound was that default, the packet it already made is that sanitization and
// is read as it is; otherwise the same capture is sanitized once more, which
// costs this process a few milliseconds and the page nothing.
//
// Both are taken the moment the capture is sanitized, before anything is
// written on the packet -- renumbered handles, a node's outcome keys, a trim to
// fit a refusal -- because they are of the page, not of what a call said about
// it.

import { webAutomationRouteState } from "../../route-state";
import { present } from "../present";
import { sanitizeWebLlmSnapshot, type WebLlmPageEvidence, type WebLlmSanitizeOptions, type WebLlmSnapshotBinding } from "../sanitize";
import { webLlmStateDigest } from "./state-digest";
import { RecoverableToolRejection } from "../tool-rejection";

/**
 * The digest and the route state of the page `snapshot` is a capture of, equal
 * to what `captureStateDigest` and `observeRouteState` return for the same page
 * whatever `maxEvidenceBytes` the call's own packet was bounded to.
 *
 * `bounded` is the packet the call sanitized from the same snapshot, bounded to
 * `maxEvidenceBytes`, and must not have been written on since. Both are
 * `undefined` only where the page is too large for even an empty packet at the
 * default bound, which `captureStateDigest` and `observeRouteState` refuse as
 * well: the page is then simply not observed.
 */
export function webLlmSnapshotStates(
  snapshot: unknown,
  bounded: WebLlmSnapshotBinding,
  maxEvidenceBytes: number | undefined
): Pick<WebLlmSnapshotBinding, "stateDigest" | "routeState"> {
  const page = maxEvidenceBytes === undefined ? bounded.evidence : atDefaultBound(snapshot);
  if (page === undefined) return present<Pick<WebLlmSnapshotBinding, "stateDigest" | "routeState">>({ stateDigest: undefined, routeState: undefined });
  return { stateDigest: webLlmStateDigest(page), routeState: webAutomationRouteState(page) };
}

/** The capture sanitized as the host sanitizes it, or `undefined` when it is too large for any packet. */
function atDefaultBound(snapshot: unknown): WebLlmPageEvidence | undefined {
  try {
    return sanitizeWebLlmSnapshot(snapshot, present<WebLlmSanitizeOptions>({
      budget: "exploration",
      maxEvidenceBytes: undefined,
      expectedOrigin: undefined,
      failedAction: undefined
    }));
  } catch (error) {
    if (error instanceof RecoverableToolRejection && error.code === "evidence_budget_exhausted") return undefined;
    throw error;
  }
}
