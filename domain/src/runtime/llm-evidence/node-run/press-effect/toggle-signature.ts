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
// nothing.

import type { WebToggleAttribute, WebToggleReading, WebToggleSignature } from "../../../../actions/toggle-signature";
import { webToggleSignatureOf } from "../../../../actions/toggle-signature";
import type { WebLlmEvidenceElement } from "../../elements";
import { attributeValue } from "../../page-view";
import type { WebLlmSnapshotBinding } from "../../sanitize";
import type { WebRunnableNode } from "../catalog";
import { webMovesThePage } from "../start-location";

/** The `toggle` output of a press, or `undefined`. */
export type WebPressToggleOutput = { signature: WebToggleSignature; idempotentWith?: "web.dom.check" };

export function webPressToggleSignature(
  node: WebRunnableNode,
  before: WebLlmSnapshotBinding | undefined,
  after: WebLlmSnapshotBinding | undefined,
  handle: string | undefined
): WebPressToggleOutput | undefined {
  if (node.definitionId !== "web.output.dom-click" || webMovesThePage(node) || handle === undefined) return undefined;
  if (before === undefined || after === undefined || before.evidence.location !== after.evidence.location) return undefined;
  const was = before.evidence.elements.find((element) => element.target === handle);
  const now = after.evidence.elements.find((element) => element.target === handle);
  if (was === undefined || now === undefined) return undefined;
  const signature = webToggleSignatureOf(reading(was), reading(now));
  if (signature === undefined) return undefined;
  return signature.via === "attribute" ? { signature, idempotentWith: "web.dom.check" } : { signature };
}

function reading(element: WebLlmEvidenceElement): WebToggleReading {
  const states: Partial<Record<WebToggleAttribute, boolean>> = {};
  for (const attribute of ["aria-pressed", "aria-checked", "aria-selected"] as const) {
    const value = attributeValue(element, attribute)?.trim().toLowerCase();
    if (value === "true") states[attribute] = true;
    else if (value === "false") states[attribute] = false;
  }
  if (element.checked !== undefined) states.checked = element.checked;
  return { states, name: element.name ?? element.text ?? "" };
}
