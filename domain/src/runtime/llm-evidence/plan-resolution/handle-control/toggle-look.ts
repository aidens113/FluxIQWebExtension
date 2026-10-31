// What a capture's look at one control keeps so its state can be read later
// (CC9, interface I5): its toggle reading (the states it states, its name, its
// classes) and its role. The target store keeps it with each target, because
// what the Flow learns from a later press (`./learned-toggles.ts`) can only be
// read against a look that was already taken.

import type { WebToggleReading } from "../../../../actions/toggle-signature";
import { webControlRole, webToggleReadingOf } from "../../control-spot";
import type { WebLlmEvidenceElement } from "../../elements";

export type WebPlanToggleLook = { reading: WebToggleReading; role: string };

/** The look at `element` among `elements` (its capture); none for a hidden control, which no person can press. */
export function webPlanToggleLookOf(element: WebLlmEvidenceElement, elements: readonly WebLlmEvidenceElement[]): WebPlanToggleLook | undefined {
  return element.hidden === true ? undefined : { reading: webToggleReadingOf(element, elements), role: webControlRole(element) };
}
