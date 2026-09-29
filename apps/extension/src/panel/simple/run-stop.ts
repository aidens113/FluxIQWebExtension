// The now card's Stop, while FluxIQ is running something (UI audit, section 4,
// "Stop").
//
// Stop asks FluxIQ Core to cancel the run, through the background's
// `panelStopRun` relay. It never fakes a stop by disconnecting. When this
// extension's background does not handle that message (`unsupported`), the
// button is replaced for good by "To stop this, use FluxIQ." and Open FluxIQ.
// When the request fails, or Core found nothing to stop, or the step is still
// going long after Core said it stopped, the button comes back with a sentence
// saying so and the same way out. When FluxIQ refused this browser's token
// (`code: "refused"`, an older FluxIQ that takes only its own login), pressing
// again cannot help, so the button gives way to the sentence and Open FluxIQ
// until the run ends.
//
// Every one of those states ends when the run does: once the runtime is no
// longer running, the card goes back to a plain Stop for the next run.

import { RUNTIME_MESSAGES } from "../../shared/constants";
import type { ExtensionStatus } from "../../shared/protocol";
import type { PanelStore } from "../state";

/** How long "Stopping..." waits for the step to end before saying it has not. */
export const STOP_WAIT_MS = 20_000;

/** What the Stop area shows. */
export type RunStopView = {
  /** The Stop button, or undefined when the fallback replaces it. */
  button?: { label: string; disabled: boolean };
  /** Why the last Stop did not work, shown in the card. */
  sentence?: string | undefined;
  detail?: string | undefined;
  /** Shows "To stop this, use FluxIQ." with an Open FluxIQ button. */
  fallback: boolean;
};

export type RunStop = {
  /** Sends Stop. Resolves once the background has answered. */
  press(): Promise<void>;
  /** Reads the latest status; answers whether the view changed. */
  observe(status: ExtensionStatus, now: number): boolean;
  view(): RunStopView;
};

type Phase =
  | { name: "ready" }
  | { name: "sending" }
  | { name: "stopping"; since: number }
  | { name: "failed"; sentence: string; detail?: string | undefined }
  | { name: "refused"; detail?: string | undefined }
  | { name: "unsupported" };

const STOP: RunStopView = { button: { label: "Stop", disabled: false }, fallback: false };
const REFUSED = "FluxIQ didn't let this browser stop it.";
const STOPPING: RunStopView = { button: { label: "Stopping...", disabled: true }, fallback: false };

/** Creates the Stop controller; `clock` answers the time in milliseconds. */
export function createRunStop(request: PanelStore["request"], clock: () => number = Date.now): RunStop {
  let phase: Phase = { name: "ready" };
  let running = false;

  return {
    async press() {
      if (phase.name === "sending" || phase.name === "stopping" || phase.name === "refused" || phase.name === "unsupported") return;
      phase = { name: "sending" };
      const result = await request<{ payload?: { runtimeSessions?: unknown } }>({ type: RUNTIME_MESSAGES.panelStopRun });
      if (!result.ok) {
        phase = result.unsupported ? { name: "unsupported" }
          : result.code === "refused" ? { name: "refused", detail: result.detail }
            : { name: "failed", sentence: "Couldn't stop it from here.", detail: result.detail };
        return;
      }
      const stopped = result.value.payload?.runtimeSessions;
      if (Array.isArray(stopped) && stopped.length === 0) {
        phase = { name: "failed", sentence: "FluxIQ didn't find anything to stop." };
        return;
      }
      // The run may have ended while the request was out; then there is nothing to wait for.
      phase = running ? { name: "stopping", since: clock() } : { name: "ready" };
    },
    observe(status, now) {
      running = status.runtime?.state === "running";
      if (!running && (phase.name === "stopping" || phase.name === "failed" || phase.name === "refused")) {
        phase = { name: "ready" };
        return true;
      }
      if (phase.name === "stopping" && now - phase.since >= STOP_WAIT_MS) {
        phase = { name: "failed", sentence: "FluxIQ hasn't stopped yet." };
        return true;
      }
      return false;
    },
    view() {
      switch (phase.name) {
        case "ready":
          return STOP;
        case "sending":
        case "stopping":
          return STOPPING;
        case "failed":
          return { button: { label: "Stop", disabled: false }, sentence: phase.sentence, detail: phase.detail, fallback: true };
        case "refused":
          return { sentence: REFUSED, detail: phase.detail, fallback: true };
        case "unsupported":
          return { fallback: true };
      }
    }
  };
}
