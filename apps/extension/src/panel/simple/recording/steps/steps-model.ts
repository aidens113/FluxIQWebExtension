// What the recording's step list shows, as a pure reducer so every outcome of
// "Remove" is tested without a DOM.
//
// Remove sends `removeRecordingStep`. A removed step leaves the list at once
// and stays out of it, even if a later log read still carries its entry (the
// log is the background's activity record, not the recording). When this
// extension does not handle the message (`unsupported`), every Remove button
// goes for the rest of the panel's life and one sentence says where to delete
// the step instead; any other failure shows its sentence until a Remove works.
// Both sentences end with the recording.

import type { PanelResult } from "../../../state";
import type { StepRow } from "./step-rows";

/** The step list's state. */
export type StepsModel = {
  readonly rows: readonly StepRow[];
  /** False once the background said it cannot remove a step. */
  readonly removable: boolean;
  /** Entries whose Remove is on its way. */
  readonly removing: readonly string[];
  /** Entries removed during this recording. */
  readonly removed: readonly string[];
  readonly notice?: { sentence: string; detail?: string | undefined } | undefined;
};

/** Something that happened to the step list. */
export type StepsEvent =
  | { type: "logRead"; rows: readonly StepRow[] }
  | { type: "removeStarted"; id: string }
  | { type: "removeFinished"; id: string; result: PanelResult<unknown> }
  | { type: "recordingEnded" };

/** Shown once Remove turns out not to be handled by this extension. */
export const REMOVE_UNSUPPORTED = "Removing a step isn't available yet. You can delete it in FluxIQ after you stop.";

const START: StepsModel = { rows: [], removable: true, removing: [], removed: [] };

/** The step list after `event`; `model` undefined is the list before anything happened. */
export function reduceSteps(model: StepsModel | undefined, event: StepsEvent): StepsModel {
  const current = model ?? START;
  switch (event.type) {
    case "logRead":
      return { ...current, rows: event.rows.filter((row) => !current.removed.includes(row.id)) };
    case "removeStarted":
      if (!current.removable || current.removing.includes(event.id)) return current;
      return { ...current, removing: [...current.removing, event.id] };
    case "removeFinished": {
      const removing = current.removing.filter((id) => id !== event.id);
      const { result } = event;
      if (result.ok) {
        return { rows: current.rows.filter((row) => row.id !== event.id), removable: current.removable, removing, removed: [...current.removed, event.id] };
      }
      if (result.unsupported === true) return { ...current, removing, removable: false, notice: { sentence: REMOVE_UNSUPPORTED } };
      return { ...current, removing, notice: { sentence: result.sentence, detail: result.detail } };
    }
    case "recordingEnded":
      return { ...START, removable: current.removable };
  }
}
