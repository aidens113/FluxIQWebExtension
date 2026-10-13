// The presses themselves, one per layer in the way, each recorded as the layer's
// kind and the dismissal's allow-list word (t401), and the two names (t516).
//
// `clear.ts` says why the defence presses at all and which guards stand in
// front of a press; this is the loop it describes, and the record of what it
// did. The record is what lets Core's trace and the chat say "Closed a notice
// the page put in the way" rather than only that something was closed: the
// layer's kind comes from the same classifier the snapshot names layers by
// (`layer-kind.ts`), or `dialog` when none names it, and the control is named
// by the allow-list phrase that admitted it (`control-word.ts`).
//
// **The two names (t516).** An interruption met in a run must become a branch
// of the Flow -- wait for the layer, dismiss it, return -- and a handler built
// from "a dialog, closed by No thanks" can name neither. So the record also
// carries the layer's accessible name, computed exactly as the snapshot's
// dialog evidence labels it (`../../evidence/dialogs.ts`), which is what a
// `dialog` fact's name is matched against, and the pressed control's accessible
// name. Both are what a page view of the step already shows; the domain bounds
// them (`domain/src/actions/cleared-layers.ts`). Each is read before the press,
// for the reason the way out is; a layer the page gave no name has none.
//
// **The control pressed is described too (t470).** Lane D round 8
// (`run-mv5jnc5m-a47c3e59`): the defence closed the site's slow-down notice by
// its OK during a trial, the model was told to add a step closing the notice,
// and with no handle for that OK it pressed the chat's "Close chat". So each
// record also carries `wayOut`: the page's address and the control's
// descriptor, exactly as a capture describes an element (`describeElement`,
// sensitive values withheld at the source), read before the press because the
// layer is gone after it. The domain keeps it on its server half and names the
// control by a handle for the trial's feedback
// (`domain/src/actions/cleared-layers.ts`). Only the top frame describes one:
// a child frame's descriptor carries no frame address, and a handle built from
// it would name a control of the top document.

import type { WebAutomationClearedLayer } from "@fluxiq-web-extension/domain/client";
import { describeElement } from "../../describe-element";
import { isTopFrame } from "../../frame-geometry";
import { accessibleNameFor } from "../../identity";
import { dispatchClickGesture } from "../click-gesture";
import type { ClearingTarget } from "./clearing-target";
import { clearedControlWord } from "./control-word";
import { layerKind } from "./layer-kind";
import { overlaysOverPage } from "./overlays";
import { pressableWayOut } from "./pressable-way-out";

/**
 * At most this many overlays are dismissed in one intervention.
 *
 * More than one because a page that opens a consent sheet also opens a
 * newsletter modal, and clearing one to be stopped by the next is not clearing
 * anything. Bounded because a page that keeps producing dialogs is a page this
 * defence cannot win on, and the loop's own ladder is the place that gives up.
 */
const MAX_DISMISSALS_PER_ATTEMPT = 3;

/**
 * Presses the way out of each layer in the way of `spare` and answers what was
 * pressed, one entry per layer dismissed. It never throws: a fault while
 * reading the page ends the intervention with what it had already done.
 */
export function pressWaysOut(spare: Element | ClearingTarget | undefined): WebAutomationClearedLayer[] {
  const cleared: WebAutomationClearedLayer[] = [];
  try {
    for (const overlay of overlaysOverPage(undefined, spare)) {
      if (cleared.length >= MAX_DISMISSALS_PER_ATTEMPT) break;
      // Guard 1. A dialog that asks for what only a person can give is left
      // alone, way out or no way out (`pressable-way-out.ts`, which
      // `presence.ts` reads too, so what is cleared and what is looked for agree).
      const control = pressableWayOut(overlay);
      if (!control) continue;
      // Named before the press: a layer that closes is gone from the page after it.
      const record: WebAutomationClearedLayer = { kind: clearedKind(overlay), control: clearedControlWord(control), ...namesOf(overlay, control) };
      try {
        if (isTopFrame()) record.wayOut = { url: location.href, element: describeElement(control) as unknown as Record<string, unknown> };
      } catch {
        /* best-effort: a control that cannot be described is still pressed, and its layer recorded by its two words */
      }
      if (press(control)) cleared.push(record);
    }
  } catch {
    /* best-effort: a defence that throws would end the step it exists to save; what was pressed is still reported */
  }
  return cleared;
}

/** The layer's interference kind, or `dialog` when no classifier names it. A robot check is never pressed, so never named here. */
function clearedKind(overlay: Element): WebAutomationClearedLayer["kind"] {
  const kind = layerKind(overlay);
  return kind === undefined || kind === "robot_check" ? "dialog" : kind;
}

/** The layer's and the control's accessible names, each only when the page gave one. */
function namesOf(overlay: Element, control: Element): Pick<WebAutomationClearedLayer, "name" | "controlName"> {
  const name = accessibleNameFor(overlay);
  const controlName = accessibleNameFor(control);
  return { ...(name ? { name } : {}), ...(controlName ? { controlName } : {}) };
}

/** Presses the control at the centre of its own box, as a person would. False when it has no box to aim at. */
function press(control: Element): boolean {
  const box = control.getBoundingClientRect();
  if (!(box.width > 0) || !(box.height > 0)) return false;
  dispatchClickGesture(control, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  return true;
}
