// Simple Mode's "Extract Data From This Page" entry, as data (plan 3.7, "Primary
// Entry Point"). The sheet itself is `panel/extraction`; this decides only
// whether its entry can be pressed and what the line under it says.
//
// Extraction is recorded into a recording so that it compiles into the
// recording's Flow like any other step (plan 3.7, "Important Requirement"). The
// entry is therefore offered whether or not a recording is running: pressed
// while none is, it starts one first (`startsRecording`), and the line says so
// before the person presses rather than after.
//
// "Extract Data From This Page" keeps its exact name: the Lab presses it by that
// name (packages/test-runner/src/ui-e2e/journeys/extraction.ts).

import type { ExtensionStatus } from "../../../shared/protocol";

/** What the extraction entry looks like for one status. */
export type ExtractControl = {
  disabled: boolean;
  /** Pressing starts a recording before the pick. */
  startsRecording: boolean;
  /** The visible line under the entry: why it is disabled, or what pressing does. */
  line: string;
};

/** The extraction entry for `status`. */
export function extractControl(status: ExtensionStatus): ExtractControl {
  const recording = status.recordingState === "recording";
  const reason = status.connectionState !== "connected" ? "Connect to FluxIQ to extract data."
    : status.unsupportedPage !== undefined ? "FluxIQ can't read this page."
      : !recording && status.runtime?.state === "running" ? "Wait for FluxIQ to finish."
        : undefined;
  if (reason !== undefined) return { disabled: true, startsRecording: false, line: reason };
  return recording
    ? { disabled: false, startsRecording: false, line: "Adds a list from this page to the recording." }
    : { disabled: false, startsRecording: true, line: "Pick one item; FluxIQ finds the rest and saves it as an automation." };
}
