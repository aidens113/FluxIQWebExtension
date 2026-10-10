// The save-time guard: a step whose control would be found by one attribute
// alone is not saved (user, 2026-10-10).
//
// Two independent signals besides the address is the floor (`./signals.ts`
// says what counts). One is what R4a saved -- a tag beside a selector through
// an id the page mints again on every load -- and it is a step that breaks the
// first time that one detail changes. Two means one detail can change and
// something is still left to say which control it was.
//
// The guard decides; each save path says it in its own closed vocabulary:
//
// - a build's step is refused at its script line as `web.handle.unidentifiable`
//   (`runtime/llm-evidence/plan-resolution/resolve-plan-node.ts`), so the model
//   chooses another control or resubmits, and is never told which signals were
//   missing -- the identity is the extension's business, not the model's;
// - a runtime repair is refused as Core's `target_indistinguishable`
//   (`runtime/llm-evidence/target/override.ts`);
// - a recorded step is still proposed, because the person recorded it, and
//   carries `reason` as its description so the person reviewing it is told why
//   it may not be found again (`web-panel-host.ts`).
//
// Steps already saved are never rewritten or re-judged: the guard runs only
// where an identity is being made.

import type { WebAutomationElementFingerprint } from "../actions/types";
import { webElementIdentitySignals } from "./signals";

/** The fewest independent signals a saved control may carry besides its address. */
export const WEB_ELEMENT_IDENTITY_MINIMUM_SIGNALS = 2;

/** The guard's closed code. */
export const WEB_ELEMENT_IDENTITY_SHORTFALL_CODE = "web.target.unidentifiable";

/** Why a saved control was refused, in words a person reads; never which signals it had. */
const REASON = "This step's control is described by too little to be found again: if the page changes one detail of it, the step will not find it. Choose a control the page names in more ways, such as by its words, its label or its own identifier.";

export type WebElementIdentityShortfall = {
  code: typeof WEB_ELEMENT_IDENTITY_SHORTFALL_CODE;
  reason: string;
};

/** The shortfall of `fingerprint`, or nothing when it carries enough to be found again. */
export function webElementIdentityShortfall(fingerprint: WebAutomationElementFingerprint): WebElementIdentityShortfall | undefined {
  return webElementIdentitySignals(fingerprint).length >= WEB_ELEMENT_IDENTITY_MINIMUM_SIGNALS
    ? undefined
    : { code: WEB_ELEMENT_IDENTITY_SHORTFALL_CODE, reason: REASON };
}
