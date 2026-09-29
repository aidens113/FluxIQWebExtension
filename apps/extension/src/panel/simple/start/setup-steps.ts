// The first-run checklist's steps, as data (plan 4.2, "Suggested Flow", steps
// 2 and 3): FluxIQ is running and reachable, this browser is approved, and an
// AI model key is set. Pure, so every row is tested without a DOM.
//
// The status card already carries the buttons for the first two (Connect, and
// the pairing code); this only says where the person is. The words are
// deliberately different from the status card's, so no sentence appears twice
// on the screen.
//
// Whether a model key is set is Core's to say. `ModelKeyState` is "unknown"
// until a reader answers, and stays so when this extension cannot ask (see
// `model-key.ts`); an unknown key is shown as a step to check rather than as
// done or missing, because guessing either way misleads.

import type { ExtensionStatus } from "../../../shared/protocol";

/** What Core says about the AI model key. */
export type ModelKeyState = "present" | "missing" | "unknown";

/** Where one step stands. `waiting` is under way (connecting, or a code shown for approval). */
export type SetupStepState = "done" | "waiting" | "todo" | "check";

/** One line of the checklist. */
export type SetupStep = { key: "runtime" | "pair" | "model"; title: string; state: SetupStepState; line?: string };

/** The checklist, and whether to show it at all. */
export type SetupSteps = { steps: SetupStep[]; complete: boolean };

/** The first-run message, from plan 4.2 ("Onboarding Message"). */
export const ONBOARDING_MESSAGE = "FluxIQ uses AI to build and adapt your automation, then reuses what it learns so routine runs don't keep needing AI.";

/** The checklist for `status` and what Core said about the model key. */
export function setupSteps(status: ExtensionStatus, modelKey: ModelKeyState): SetupSteps {
  const connected = status.connectionState === "connected";
  const reached = connected || status.connectionState === "pairing";
  const runtime: SetupStep = reached ? { key: "runtime", title: "FluxIQ is running", state: "done" }
    : status.connectionState === "connecting" || status.connectionState === "reconnecting" ? { key: "runtime", title: "Reaching FluxIQ", state: "waiting" }
      : {
        key: "runtime",
        title: "Start FluxIQ",
        state: "todo",
        line: status.connectionState === "error" ? "FluxIQ isn't answering. Start it on this computer, then press Connect." : "Start FluxIQ on this computer, then press Connect."
      };
  const pair: SetupStep = status.paired || connected
    ? { key: "pair", title: "This browser is approved", state: "done" }
    : status.connectionState === "pairing"
      ? { key: "pair", title: "Approve this browser", state: "waiting", line: "Approve the code shown above in FluxIQ." }
      : { key: "pair", title: "Approve this browser", state: "todo" };
  const model: SetupStep = modelKey === "present"
    ? { key: "model", title: "An AI model is set up", state: "done" }
    : modelKey === "missing"
      ? { key: "model", title: "Add an AI model key", state: "todo", line: "FluxIQ needs one to build automations. Add it in FluxIQ's settings." }
      : { key: "model", title: "AI model key", state: "check", line: connected ? "Check FluxIQ's settings for a model key." : "Checked once FluxIQ is connected." };
  const steps = [runtime, pair, model];
  // An unknown key does not hold the checklist open once the browser is connected
  // and approved: the person can build with recordings and extraction without one.
  const complete = connected && status.paired && modelKey !== "missing";
  return { steps, complete };
}
