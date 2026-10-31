import { webPacketElementFingerprint } from "../../llm-evidence/packet-fingerprint";
import type { WebFreshTarget } from "./fresh-target";
import type { WebTargetObservation } from "./observation";

/** Every current candidate in the intended frame, including hidden controls as ambiguity evidence. */
export function webTargetCandidates(observation: WebTargetObservation): WebFreshTarget[] {
  const { page, scope } = observation;
  if (scope.browserFrameId === undefined) return [];
  return page.evidence.elements.flatMap((element) => {
    // A scoped child capture carries local untagged elements; merged captures stamp their actual frame.
    const frame = element.frameId ?? (scope.kind === "single-frame" ? scope.browserFrameId : 0);
    const selector = page.selectors.get(element.target);
    if (frame !== scope.browserFrameId || selector === undefined) return [];
    return [{
      selector,
      element: webPacketElementFingerprint(element, {
        selector,
        shadowHosts: page.shadowHosts?.get(element.target),
        dialog: page.dialogNames?.get(element.target),
        drawing: page.drawings?.get(element.target),
        recordIdentity: page.recordIdentities?.get(element.target)
      }),
      hidden: element.hidden === true
    }];
  });
}
