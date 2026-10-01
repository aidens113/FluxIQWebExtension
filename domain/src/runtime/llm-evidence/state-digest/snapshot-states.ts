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
// ## Why both are read off the packet the call sanitized
//
// Both are compared for equality with values taken at other moments: a digest
// with other digests and with `captureStateDigest`, a route state with what
// `observeRouteState` reads when the Flow runs. So neither may depend on
// anything but the page. Until 2026-09-30 the packet a call returned depended
// on the call -- it was bounded to the call's own `maxEvidenceBytes` -- so both
// were taken from the capture sanitized once more at a fixed bound. The packet
// is now the whole page whatever the call (t200), so the packet the call
// sanitized is that sanitization and is read as it is.
//
// Both are taken the moment the capture is sanitized, before anything is
// written on the packet -- renumbered handles, a node's outcome keys -- because
// they are of the page, not of what a call said about it.

import { webAutomationRouteState } from "../../route-state";
import type { WebLlmSnapshotBinding } from "../sanitize";
import { webLlmStateDigest } from "./state-digest";

/**
 * The digest and the route state of the page `sanitized` was sanitized from,
 * equal to what `captureStateDigest` and `observeRouteState` return for the
 * same page. `sanitized` must not have been written on since.
 */
export function webLlmSnapshotStates(sanitized: WebLlmSnapshotBinding): Pick<WebLlmSnapshotBinding, "stateDigest" | "routeState"> {
  return { stateDigest: webLlmStateDigest(sanitized.evidence), routeState: webAutomationRouteState(sanitized.evidence) };
}
