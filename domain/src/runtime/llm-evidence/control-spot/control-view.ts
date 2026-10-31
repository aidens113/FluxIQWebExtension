// What a look says of a control's state (CC9, interface I5): whether it is a
// stateful control, the one state it shows, the `ensureState` signature a
// press would leave from that state, and the node that sets the asked state
// itself. It is read at look time and never guessed: a field the look does not
// show is absent, not false, and a plain button is no stateful control.
//
// Two sources. A control that **states** its state -- `aria-pressed`,
// `aria-checked`, `aria-selected`, a native `checked` -- is read from that
// statement: the state is its word (`pressed`/`unpressed`, `checked`/
// `unchecked`, `selected`/`unselected`), a press leaves the other one, and the
// node that sets it is the check. A control that shows its state **in its
// words or its class** (a toggle whose name changes with it) says nothing of
// itself; it is read only against a signature an earlier press of the same
// kind of control produced (`../../../actions/toggle-signature/`): shown, the
// control is `on`, and a press leaves the signature's other side; its other
// side shown, it is `off`, and a press leaves the signature. A signature that
// gains or loses nothing is no toggle and is never used.

import type { JsonObject } from "fluxiq/core";
import { webToggleOutput, webToggleSignatureShown, type WebToggleAttribute, type WebToggleReading, type WebToggleSignature } from "../../../actions/toggle-signature";
import type { WebLlmEvidenceElement } from "../elements";
import { present } from "../present";
import { webControlRole } from "./role";
import { webToggleReadingOf } from "./toggle-reading";

/** A control's state as the plan resolution answers it, on a handle's view (Core `AutomationStudioPlanHandleView.control`). */
export type WebControlView = { stateful: true; state?: string; shown?: JsonObject; ensures?: JsonObject; idempotentWith?: string };

/** Roles of controls that hold a state of their own even when the page states none. */
const STATE_HOLDING_ROLES: ReadonlySet<string> = new Set(["checkbox", "switch", "radio", "menuitemcheckbox", "menuitemradio"]);

/** The stated states, in the order they are read, and the word each says when on and off. */
const STATED: ReadonlyArray<readonly [WebToggleAttribute, string, string]> = [
  ["checked", "checked", "unchecked"],
  ["aria-checked", "checked", "unchecked"],
  ["aria-pressed", "pressed", "unpressed"],
  ["aria-selected", "selected", "unselected"]
];

/**
 * The view of `element` among `elements` (its capture), against the signatures
 * `learned` for this Flow; `undefined` when the look shows it to be no stateful control.
 */
export function webControlView(element: WebLlmEvidenceElement, elements: readonly WebLlmEvidenceElement[], learned: readonly WebToggleSignature[] = []): WebControlView | undefined {
  if (element.hidden === true) return undefined;
  return webControlViewOf(webToggleReadingOf(element, elements), webControlRole(element), learned);
}

/** The same view from a look already read: the control's toggle `reading` and its `role`. What a page keeps of a control so a later learning can still be applied. */
export function webControlViewOf(reading: WebToggleReading, role: string, learned: readonly WebToggleSignature[] = []): WebControlView | undefined {
  for (const [attribute, on, off] of STATED) {
    const shown = reading.states[attribute];
    if (shown === undefined) continue;
    const ensures: WebToggleSignature = { via: "attribute", attribute, to: !shown };
    const idempotentWith = webToggleOutput(ensures).idempotentWith;
    return present<WebControlView>({ stateful: true, state: shown ? on : off, shown: { via: "attribute", attribute, to: shown }, ensures: ensures as unknown as JsonObject, idempotentWith });
  }
  const worded = wordedView(reading, learned);
  if (worded !== undefined) return worded;
  return STATE_HOLDING_ROLES.has(role) ? { stateful: true } : undefined;
}

/** The view a learned name or class signature gives a control that states nothing itself. */
function wordedView(reading: WebToggleReading, learned: readonly WebToggleSignature[]): WebControlView | undefined {
  for (const signature of learned) {
    if (signature.via === "attribute" || signature.gains.length === 0 || signature.loses.length === 0) continue;
    const other: WebToggleSignature = { via: signature.via, gains: signature.loses, loses: signature.gains };
    if (webToggleSignatureShown(signature, reading)) return { stateful: true, state: "on", shown: signature as unknown as JsonObject, ensures: other as unknown as JsonObject };
    if (webToggleSignatureShown(other, reading)) return { stateful: true, state: "off", shown: other as unknown as JsonObject, ensures: signature as unknown as JsonObject };
  }
  return undefined;
}
