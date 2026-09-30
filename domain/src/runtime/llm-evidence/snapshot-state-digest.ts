// The state digest of one capture, taken from the capture a call already made.
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
// ## Why it is not simply the digest of the packet the call returns
//
// A digest is compared for equality with digests taken at other moments, by
// other calls and by `captureStateDigest` itself, so it must not depend on
// anything but the page. The packet a call returns does depend on the call: it
// is bounded to the call's own `maxEvidenceBytes` -- a look keeps room for its
// envelope, a refusal for its own -- and a tighter bound drops elements the
// digest reads. So the digest is always of the capture sanitized exactly as
// `captureStateDigest` sanitizes it: the exploration budget's default bound, no
// expected origin (which only ever refuses, never changes a packet), and no
// failed action. Where the call's own bound was that default, the packet it
// already made is that sanitization and is digested as it is; otherwise the same
// capture is sanitized once more, which costs this process a few milliseconds
// and the page nothing.
//
// It is taken the moment the capture is sanitized, before anything is written
// on the packet -- renumbered handles, a node's outcome keys, a trim to fit a
// refusal -- because the digest is of the page, not of what a call said about
// it.

import { present } from "./present";
import { sanitizeWebLlmSnapshot, type WebLlmSanitizeOptions, type WebLlmSnapshotBinding } from "./sanitize";
import { webLlmStateDigest } from "./state-digest";
import { RecoverableToolRejection } from "./tool-rejection";

/**
 * The digest of the page `snapshot` is a capture of, equal to what
 * `captureStateDigest` returns for the same page whatever `maxEvidenceBytes`
 * the call's own packet was bounded to.
 *
 * `bounded` is the packet the call sanitized from the same snapshot, bounded to
 * `maxEvidenceBytes`, and must not have been written on since. `undefined` only
 * where the page is too large for even an empty packet at the default bound,
 * which `captureStateDigest` refuses as well: that side of the call is then
 * simply not observed.
 */
export function webLlmSnapshotStateDigest(snapshot: unknown, bounded: WebLlmSnapshotBinding, maxEvidenceBytes: number | undefined): string | undefined {
  if (maxEvidenceBytes === undefined) return webLlmStateDigest(bounded.evidence);
  try {
    return webLlmStateDigest(sanitizeWebLlmSnapshot(snapshot, present<WebLlmSanitizeOptions>({
      budget: "exploration",
      maxEvidenceBytes: undefined,
      expectedOrigin: undefined,
      failedAction: undefined
    })));
  } catch (error) {
    if (error instanceof RecoverableToolRejection && error.code === "evidence_budget_exhausted") return undefined;
    throw error;
  }
}
