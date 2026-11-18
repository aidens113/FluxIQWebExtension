// The getting-started screen as data: whether it replaces the chat, and its
// numbered steps -- Start FluxIQ, Sign in, Connect this browser, and Approve it --
// each marked done, under way, a problem, or still to do. Pure, so every state is
// tested without a DOM. The AI key is not a step: the shared key card says its
// state in the chat and in Settings.
//
// A tick is only ever for something detected: a valid FluxIQ found at the configured
// address (its discovery document), signed in (the browser is paired), connected. Step 4
// is never ticked while the browser is not connected: a stored approval says only that
// FluxIQ approved this browser once, and after a refused or lost connection FluxIQ may
// have removed it (the background does not say which yet).
//
// When the background lost the wait it was on (its worker was stopped
// mid-pairing or mid-connect, `panel/state/background-loss.ts`), the screen
// says so and offers Connect, and never shows the old approval code: FluxIQ
// withdrew it with the session (t707 P1).
//
// The screen shows while FluxIQ is not connected, this browser is not approved
// yet, or something critical is wrong (the background does not answer). Once the
// browser is connected the chat comes back.
//
// The Connect button's names are the Lab's: it presses /^(Connect|Try again|Try now)$/
// (packages/test-runner/src/demo-workspace/browser-session.ts), so exactly one of
// them is on screen whenever the connection is idle or failed.

import type { ExtensionStatus } from "../../../shared/protocol";
import type { BackgroundLoss } from "../../state";
import type { ServerFinding } from "../reachability";
import * as words from "./step-words";

/** Where one step stands. `current` is the next thing to do; `waiting` is under way. */
export type StartStepState = "done" | "current" | "waiting" | "problem" | "todo";

/** The connection steps. */
export type StartStepKey = "start" | "signin" | "connect" | "approve";

/** One numbered step. `change` says the step offers to change the FluxIQ web address. */
export type StartStep = { readonly key: StartStepKey; readonly title: string; readonly state: StartStepState; readonly line?: string; readonly change?: boolean };

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
  /** What was found at the configured web address while disconnected; absent when not asked. */
  readonly server?: ServerFinding | undefined;
};

const HEADING = "Get started with FluxIQ";
const NO_CODE = "------";
const LOST_LINES: Readonly<Record<BackgroundLoss, string>> = {
  pairing: "The approval code expired because the extension restarted. Press Connect for a new code.",
  connecting: "The extension restarted before it connected. Press Connect to try again."
};

const START = "Start FluxIQ";
const SIGN_IN = "Sign in to FluxIQ";
const CONNECT = "Connect this browser";
const APPROVE = "Approve this browser in FluxIQ";

/**
 * The guide for `status`. `noAnswer` is true when the background did not
 * answer the panel; the next status to arrive ends it. `lost` is the wait the
 * background lost, from the panel store. `server` is what the configured web
 * address answered before pairing.
 */
export function startGuide(status: ExtensionStatus | undefined, noAnswer: boolean, lost?: BackgroundLoss, server?: ServerFinding): StartGuide {
  const base = { gated: true, heading: HEADING, line: words.SETUP_LINE, addressLink: false };
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
  if (state === "connected") return { ...base, gated: false, steps: doneSteps() };

  const paired = status.paired;
  const signin = paired ? step("signin", SIGN_IN, "done", "Signed in") : step("signin", SIGN_IN, "todo", words.SIGN_IN_LINE);
  // Never done while not connected; after a refused or lost connection it says FluxIQ may have removed this browser.
  const approveAfter = state === "error" || state === "reconnecting" ? words.MAY_HAVE_BEEN_REMOVED_LINE : paired ? words.APPROVED_EARLIER_LINE : undefined;
  const approve = step("approve", APPROVE, "todo", approveAfter);
  const running = step("start", START, "current", words.START_LINE);

  if (lost !== undefined) {
    return {
      ...base,
      steps: [running, signin, step("connect", CONNECT, "problem", LOST_LINES[lost]), approve],
      connect: { label: "Connect", action: "connect" }
    };
  }

  switch (state) {
    case "pairing":
      return {
        ...base,
        steps: [
          step("start", START, "done", "FluxIQ is running"),
          paired ? signin : step("signin", SIGN_IN, "waiting", words.SIGN_IN_TO_APPROVE_LINE),
          step("connect", CONNECT, "done", "Connected"),
          step("approve", APPROVE, "waiting", words.APPROVE_LINE)
        ],
        pairingCode: status.pairingReferenceCode ?? NO_CODE
      };
    case "error":
      return {
        ...base,
        steps: [
          step("start", START, "problem", words.START_PROBLEM, true),
          signin,
          step("connect", CONNECT, "todo", words.CONNECT_FAILED_LINE),
          approve
        ],
        connect: { label: "Try again", action: "connect" },
        addressLink: true
      };
    case "connecting":
      return { ...base, steps: [running, signin, step("connect", CONNECT, "waiting", "Connecting to FluxIQ..."), approve], connect: { label: "Cancel", action: "disconnect" } };
    case "reconnecting":
      return { ...base, steps: [running, signin, step("connect", CONNECT, "waiting", "Lost the connection. Trying again..."), approve], connect: { label: "Try now", action: "connect" } };
    case "disconnected": {
      // Step one is done only when the configured address answered with FluxIQ's own discovery document, and it says where.
      const found = server?.found === true;
      const first = server === undefined
        ? running
        : found
          ? step("start", START, "done", words.foundLine(server.host), true)
          : step("start", START, "current", words.notFoundLine(server.host), true);
      return {
        ...base,
        steps: [
          first,
          found && !paired ? step("signin", SIGN_IN, "current", words.SIGN_IN_LINE) : signin,
          step("connect", CONNECT, "todo", paired ? words.CONNECT_AGAIN_LINE : words.CONNECT_LINE),
          approve
        ],
        connect: { label: "Connect", action: "connect" },
        ...(server === undefined ? {} : { server })
      };
    }
  }
}

/** One step; `change` adds the offer to change the FluxIQ web address. */
function step(key: StartStepKey, title: string, state: StartStepState, line?: string, change?: boolean): StartStep {
  return { key, title, state, ...(line === undefined ? {} : { line }), ...(change === true ? { change } : {}) };
}

/** Steps one to four once the browser is connected: FluxIQ was reached, and the browser is signed in and approved. */
function doneSteps(): StartStep[] {
  return [
    step("start", START, "done", "FluxIQ is running"),
    step("signin", SIGN_IN, "done", "Signed in"),
    step("connect", CONNECT, "done", "Connected"),
    step("approve", APPROVE, "done", "This browser is approved")
  ];
}
