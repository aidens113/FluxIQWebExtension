// The save-time identity guard on a build's step (t425, the user's rule of
// 2026-10-10): whether the control a step's handle names would be saved with an
// identity found by one attribute alone -- fewer than two independent signals
// besides its address (`element-fingerprint/shortfall.ts`).
//
// `resolve-plan-node.ts` asks it last, of a step every other check accepted,
// and refuses such a step at its script line as `web.handle.unidentifiable`,
// the way it refuses every other handle mistake, so the model resubmits. The
// model is told the code and never which signals were missing: the identity is
// the extension's business, not the model's.
//
// Only an identity this resolution made is judged. A node that names no handle
// is a step the Flow already holds, or one a person wrote, and is never
// re-judged; and exploration's own act, which saves no step, is not judged at
// all -- it may press anything a person could.

import type { JsonObject } from "fluxiq/core";
import { webElementIdentityShortfall } from "../../../element-fingerprint";
import { elementFingerprint } from "../../../output-nodes";

/** Whether the identity a step's handle resolved to would find its control by one attribute alone. */
export function webPlanStepFoundByTooLittle(identity: JsonObject | undefined): boolean {
  const fingerprint = elementFingerprint(identity);
  return fingerprint !== undefined && webElementIdentityShortfall(fingerprint) !== undefined;
}
