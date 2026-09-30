// Whether recording can start, and why not (the UI audit, section 4, "4.
// Manual actions row"). A disabled record control always says why: in the
// top bar as its tooltip, and on the automations tab as a visible line under
// "Record a new automation" (audit F2).
//
// "Start recording" keeps its exact name: the Lab presses it by that name.

import type { ExtensionStatus } from "../../shared/protocol";

/** What "Start recording" looks like for one status. */
export type RecordControl = {
  /** Hidden while recording: "Stop recording" is in the recording bar then. */
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
