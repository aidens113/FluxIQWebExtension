// What a press did to its own control, as the signature a later step can be
// made idempotent with (t775): the output `toggle` of a press node. Core
// stores it whole and never reads inside; `web.dom.click` takes it back as
// `ensureState` (`actions/toggle-signature/`).
//
// Read from the same look before and after as `./toggle.ts`, on the control's
// own element: a control that states its state and flipped it says so by the
// attribute, and is idempotent with `web.dom.check`; any other control says
// the words its accessible name gained and lost, which a row's own words
// cancel out of. A target gone or replaced, or nothing seen to change, says
// nothing. What Core is told of the signature is the same rule a Flow's own
// press in a trial is told by (`actions/toggle-signature/output.ts`, t787).

import type { WebToggleOutput } from "../../../../actions/toggle-signature";
import { webToggleOutput, webToggleSignatureOf } from "../../../../actions/toggle-signature";
import { webToggleReadingOf } from "../../control-spot";
import type { WebLlmTargetPackets, WebLlmTargetScope } from "../../plan-resolution";
import type { WebLlmSnapshotBinding } from "../../sanitize";
import type { WebRunnableNode } from "../catalog";
import { webMovesThePage } from "../start-location";

/** The `toggle` output of a press, or `undefined`. */
export type WebPressToggleOutput = WebToggleOutput;

export function webPressToggleSignature(
  node: WebRunnableNode,
  before: WebLlmSnapshotBinding | undefined,
  after: WebLlmSnapshotBinding | undefined,
  handle: string | undefined,
  learnInto?: { targets: WebLlmTargetPackets; scope: WebLlmTargetScope }
): WebPressToggleOutput | undefined {
  if (node.definitionId !== "web.output.dom-click" || webMovesThePage(node) || handle === undefined) return undefined;
  if (before === undefined || after === undefined || before.evidence.location !== after.evidence.location) return undefined;
  const was = before.evidence.elements.find((element) => element.target === handle);
  const now = after.evidence.elements.find((element) => element.target === handle);
  if (was === undefined || now === undefined) return undefined;
  const signature = webToggleSignatureOf(webToggleReadingOf(was, before.evidence.elements), webToggleReadingOf(now, after.evidence.elements));
  if (signature === undefined) return undefined;
  // What the press flipped is what later looks at that kind of control read their state against (CC9).
  learnInto?.targets.learnToggle(learnInto.scope, signature);
  return webToggleOutput(signature);
}
