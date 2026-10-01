// Whether recording can start, and why not (the UI audit, section 4, "4.
// Manual actions row"). A disabled record control always says why: in the
// top bar as its tooltip, and on the automations tab as a visible line under
// "Record a new automation" (audit F2).
//
// "Start recording" keeps its exact name: the Lab presses it by that name.
//
// `working` is the shell's held "FluxIQ is working" (`panel/shell/working-hold.ts`),
// never `status.runtime.state`: that flips for every internal page read, so
// keying on it made the button flicker during a build.

import type { ExtensionStatus } from "../../shared/protocol";

/** What "Start recording" looks like for one status. */
export type RecordControl = {
  /** Hidden while recording: "Stop recording" is in the recording bar then. */
  hidden: boolean;
  disabled: boolean;
  /** The visible line under a disabled button. */
  reason?: string;
};

/** "Start recording" for `status`, while FluxIQ is `working` or not. */
export function recordControl(status: ExtensionStatus, working: boolean): RecordControl {
  if (status.recordingState === "recording" || status.recordingState === "paused") return { hidden: true, disabled: true };
  const reason = status.connectionState !== "connected" ? "Connect to FluxIQ to record."
    : status.unsupportedPage !== undefined ? "FluxIQ can't record this page."
      : working ? "Wait for FluxIQ to finish."
        : undefined;
  return reason === undefined ? { hidden: false, disabled: false } : { hidden: false, disabled: true, reason };
}
