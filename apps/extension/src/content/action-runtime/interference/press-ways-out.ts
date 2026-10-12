// The presses themselves, one per layer in the way, each recorded as the layer's
// kind and the dismissal's allow-list word (t401).
//
// `clear.ts` says why the defence presses at all and which guards stand in
// front of a press; this is the loop it describes, and the record of what it
// did. The record is what lets Core's trace and the chat say "Closed a notice
// the page put in the way" rather than only that something was closed: the
// layer's kind comes from the same classifier the snapshot names layers by
// (`layer-kind.ts`), or `dialog` when none names it, and the control is named
// by the allow-list phrase that admitted it (`control-word.ts`), never by its
// label. Nothing else the page said leaves it.

import type { WebAutomationClearedLayer } from "@fluxiq-web-extension/domain/client";
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
      const record: WebAutomationClearedLayer = { kind: clearedKind(overlay), control: clearedControlWord(control) };
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

/** Presses the control at the centre of its own box, as a person would. False when it has no box to aim at. */
function press(control: Element): boolean {
  const box = control.getBoundingClientRect();
  if (!(box.width > 0) || !(box.height > 0)) return false;
  dispatchClickGesture(control, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  return true;
}
