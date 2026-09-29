// The manual actions row's one control, from the table in the UI audit,
// section 4 ("4. Manual actions row"). A disabled "Start recording" always says
// why in visible text, never only through a greyed-out button (audit F2).
//
// "Start recording" keeps its exact name: the Lab presses it by that name.

import type { ExtensionStatus } from "../../shared/protocol";

/** What "Start recording" looks like for one status. */
export type RecordControl = {
  /** Hidden while recording: "Stop recording" is in the now card then. */
  hidden: boolean;
  disabled: boolean;
  /** The visible line under a disabled button. */
  reason?: string;
};

/** "Start recording" for `status`. */
export function recordControl(status: ExtensionStatus): RecordControl {
  if (status.recordingState === "recording") return { hidden: true, disabled: true };
  const reason = status.connectionState !== "connected" ? "Connect to FluxIQ to record."
    : status.unsupportedPage !== undefined ? "FluxIQ can't record this page."
      : status.runtime?.state === "running" ? "Wait for FluxIQ to finish."
        : undefined;
  return reason === undefined ? { hidden: false, disabled: false } : { hidden: false, disabled: true, reason };
}
