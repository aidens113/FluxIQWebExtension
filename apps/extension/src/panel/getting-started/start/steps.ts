// The getting-started screen as data: whether it replaces the chat, and its
// numbered steps -- Start FluxIQ, Sign in, Connect this browser, Approve it,
// Add a model key, and Unlock this browser once (only when the key says it needs
// it) -- each marked done, under way, a problem, or still to do. Pure, so every
// state is tested without a DOM.
//
// A tick is only ever for something detected: FluxIQ reached (pairing, connected),
// signed in and approved (the browser is paired), a key listed (the key reading).
//
// When the background lost the wait it was on (its worker was stopped
// mid-pairing or mid-connect, `panel/state/background-loss.ts`), the screen
// says so and offers Connect, and never shows the old approval code: FluxIQ
// withdrew it with the session (t707 P1).
//
// The screen shows while FluxIQ is not connected, this browser is not approved
// yet, or something critical is wrong (the background does not answer). Once the
// browser is connected the chat comes back. A model key that is missing or locked
// does not hold the chat back (the Lab types into it right after it connects and
// adds its key): `card` says the setup card shows above the chat instead.
//
// The Connect button's names are the Lab's: it presses /^(Connect|Try again|Try now)$/
// (packages/test-runner/src/demo-workspace/browser-session.ts), so exactly one of
// them is on screen whenever the connection is idle or failed.

import type { ExtensionStatus } from "../../../shared/protocol";
import type { BackgroundLoss } from "../../state";
import type { ModelKeyReading } from "../model";
import * as words from "./step-words";

/** Where one step stands. `current` is the next thing to do; `waiting` is under way. */
export type StartStepState = "done" | "current" | "waiting" | "problem" | "todo";

/** The six steps, in the order a person does them. */
export type StartStepKey = "start" | "signin" | "connect" | "approve" | "key" | "unlock";

/** One numbered step. */
export type StartStep = { readonly key: StartStepKey; readonly title: string; readonly state: StartStepState; readonly line?: string };

/** The connect step's button: its words, and what pressing it asks the background. */
export type StartConnect = { readonly label: "Connect" | "Try again" | "Try now" | "Cancel"; readonly action: "connect" | "disconnect" };

/** Everything the getting-started screen shows for one status. */
export type StartGuide = {
  /** The screen replaces the chat. */
  readonly gated: boolean;
  readonly heading: string;
  readonly line: string;
  /** Empty while the status is unknown, or when something critical is wrong. */
  readonly steps: readonly StartStep[];
  readonly connect?: StartConnect | undefined;
  /** The approval code, while FluxIQ is asked to approve this browser. */
  readonly pairingCode?: string | undefined;
  /** Shows "Check the connection address", which opens settings. */
  readonly addressLink: boolean;
  /** Connected, and the model key is missing or locked: the setup card shows above the chat, which stays usable. */
  readonly card: boolean;
};

const HEADING = "Get started with FluxIQ";
const NO_CODE = "------";
const LOST_LINES: Readonly<Record<BackgroundLoss, string>> = {
  pairing: "The approval code expired because the extension restarted. Press Connect for a new code.",
  connecting: "The extension restarted before it connected. Press Connect to try again."
};

/**
 * The guide for `status`. `noAnswer` is true when the background did not
 * answer the panel; the next status to arrive ends it. `lost` is the wait the
 * background lost, from the panel store. `key` is the model key reading, used
 * only once connected (before that nothing can read it).
 */
export function startGuide(status: ExtensionStatus | undefined, noAnswer: boolean, lost?: BackgroundLoss, key: ModelKeyReading = "unknown"): StartGuide {
  const base = { gated: true, heading: HEADING, line: words.SETUP_LINE, addressLink: false, card: false };
  if (noAnswer && status === undefined) {
    return {
      ...base,
      heading: "The extension isn't answering",
      line: "Close this panel and open it again. If it keeps happening, reload FluxIQ in your browser's extensions page.",
      steps: []
    };
  }
  if (status === undefined) return { ...base, line: "Checking the connection...", steps: [] };

  const state = status.connectionState;
  if (state === "connected") {
    return { ...base, gated: false, steps: [...doneSteps(), ...keySteps(key)], card: key === "missing" || key === "locked" };
  }

  const paired = status.paired;
  const signin = paired
    ? step("signin", "Sign in to FluxIQ", "done", undefined, "Signed in")
    : step("signin", "Sign in to FluxIQ", "todo", words.SIGN_IN_LINE);
  const approve = paired
    ? step("approve", "Approve this browser in FluxIQ", "done", undefined, "This browser is approved")
    : step("approve", "Approve this browser in FluxIQ", "todo");
  const later = [step("key", "Add a model key", "todo", words.KEY_LATER_LINE)];
  const running = step("start", "Start FluxIQ", "current", words.START_LINE);

  if (lost !== undefined) {
    return {
      ...base,
      steps: [running, signin, step("connect", "Connect this browser", "problem", LOST_LINES[lost]), approve, ...later],
      connect: { label: "Connect", action: "connect" }
    };
  }

  switch (state) {
    case "pairing":
      return {
        ...base,
        steps: [
          step("start", "Start FluxIQ", "done", undefined, "FluxIQ is running"),
          paired ? signin : step("signin", "Sign in to FluxIQ", "todo", words.SIGN_IN_TO_APPROVE_LINE),
          step("connect", "Connect this browser", "done", undefined, "Connected"),
          step("approve", "Approve this browser in FluxIQ", "waiting", words.APPROVE_LINE),
          ...later
        ],
        pairingCode: status.pairingReferenceCode ?? NO_CODE
      };
    case "error":
      return {
        ...base,
        steps: [
          step("start", "Start FluxIQ", "problem", words.START_PROBLEM),
          signin,
          step("connect", "Connect this browser", "todo", words.CONNECT_FAILED_LINE),
          approve,
          ...later
        ],
        connect: { label: "Try again", action: "connect" },
        addressLink: true
      };
    case "connecting":
      return { ...base, steps: [running, signin, step("connect", "Connect this browser", "waiting", "Connecting to FluxIQ..."), approve, ...later], connect: { label: "Cancel", action: "disconnect" } };
    case "reconnecting":
      return { ...base, steps: [running, signin, step("connect", "Connect this browser", "waiting", "Lost the connection. Trying again..."), approve, ...later], connect: { label: "Try now", action: "connect" } };
    case "disconnected":
      return {
        ...base,
        steps: [running, signin, step("connect", "Connect this browser", "todo", paired ? words.CONNECT_AGAIN_LINE : words.CONNECT_LINE), approve, ...later],
        connect: { label: "Connect", action: "connect" }
      };
  }
}

/** One step; `doneTitle` replaces the title once it is done. */
function step(key: StartStepKey, title: string, state: StartStepState, line?: string, doneTitle?: string): StartStep {
  const shown = state === "done" && doneTitle !== undefined ? doneTitle : title;
  return line === undefined ? { key, title: shown, state } : { key, title: shown, state, line };
}

/** Steps one to four once the browser is connected: FluxIQ was reached, and the browser is signed in and approved. */
function doneSteps(): StartStep[] {
  return [
    step("start", "Start FluxIQ", "done", undefined, "FluxIQ is running"),
    step("signin", "Sign in to FluxIQ", "done", undefined, "Signed in"),
    step("connect", "Connect this browser", "done", undefined, "Connected"),
    step("approve", "Approve this browser in FluxIQ", "done", undefined, "This browser is approved")
  ];
}

/** The model key and unlock steps once connected. `unknown` lists neither: nothing is claimed. */
function keySteps(key: ModelKeyReading): StartStep[] {
  switch (key) {
    case "ready":
      return [step("key", "Add a model key", "done", undefined, "Model key added")];
    case "missing":
      return [step("key", "Add a model key", "current", words.KEY_MISSING_LINE)];
    case "locked":
      return [step("key", "Add a model key", "done", undefined, "Model key added"), step("unlock", "Unlock this browser once", "current", words.UNLOCK_LINE)];
    case "unknown":
      return [];
  }
}
