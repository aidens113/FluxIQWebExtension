// The getting-started screen as data: whether it replaces the chat, and its
// numbered steps -- 1 Open FluxIQ, 2 Connect this browser, 3 Approve it in
// FluxIQ -- each marked done, under way, a problem, or still to do. Pure, so
// every connection state is tested without a DOM.
//
// The screen shows while FluxIQ is not connected, this browser is not approved
// yet, or something critical is wrong (the background does not answer). Once
// the browser is connected the chat comes back.
//
// The Connect button's names are the Lab's: it presses /^(Connect|Try again|
// Try now)$/ (packages/test-runner/src/demo-workspace/browser-session.ts), so
// exactly one of them is on screen whenever the connection is idle or failed.

import type { ExtensionStatus } from "../../shared/protocol";

/** Where one step stands. `current` is the next thing to do; `waiting` is under way. */
export type StartStepState = "done" | "current" | "waiting" | "problem" | "todo";

/** One numbered step. */
export type StartStep = { readonly key: "open" | "connect" | "approve"; readonly title: string; readonly state: StartStepState; readonly line?: string };

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
};

const HEADING = "Get started with FluxIQ";
const LINE = "Three steps, then ask FluxIQ for anything in the chat.";
const NO_CODE = "------";

/**
 * The guide for `status`. `noAnswer` is true when the background did not
 * answer the panel; the next status to arrive ends it.
 */
export function startGuide(status: ExtensionStatus | undefined, noAnswer: boolean): StartGuide {
  if (noAnswer && status === undefined) {
    return {
      gated: true,
      heading: "The extension isn't answering",
      line: "Close this panel and open it again. If it keeps happening, reload FluxIQ in your browser's extensions page.",
      steps: [],
      addressLink: false
    };
  }
  if (status === undefined) return { gated: true, heading: HEADING, line: "Checking the connection...", steps: [], addressLink: false };

  const state = status.connectionState;
  if (state === "connected") return { gated: false, heading: HEADING, line: LINE, steps: doneSteps(), addressLink: false };

  const approve: StartStep = status.paired
    ? { key: "approve", title: "This browser is approved", state: "done" }
    : { key: "approve", title: "Approve this browser in FluxIQ", state: "todo" };

  switch (state) {
    case "pairing":
      return {
        gated: true,
        heading: HEADING,
        line: LINE,
        steps: [
          { key: "open", title: "FluxIQ is running", state: "done" },
          { key: "connect", title: "Connected", state: "done" },
          { key: "approve", title: "Approve this browser in FluxIQ", state: "waiting", line: "In FluxIQ, approve the request that shows this code." }
        ],
        pairingCode: status.pairingReferenceCode ?? NO_CODE,
        addressLink: false
      };
    case "error":
      return {
        gated: true,
        heading: HEADING,
        line: LINE,
        steps: [
          { key: "open", title: "Open FluxIQ", state: "problem", line: "FluxIQ isn't answering. Start it on this computer, then try again." },
          { key: "connect", title: "Connect this browser", state: "todo", line: "Can't reach FluxIQ." },
          approve
        ],
        connect: { label: "Try again", action: "connect" },
        addressLink: true
      };
    case "connecting":
      return {
        gated: true,
        heading: HEADING,
        line: LINE,
        steps: [openStep(), { key: "connect", title: "Connect this browser", state: "waiting", line: "Connecting to FluxIQ..." }, approve],
        connect: { label: "Cancel", action: "disconnect" },
        addressLink: false
      };
    case "reconnecting":
      return {
        gated: true,
        heading: HEADING,
        line: LINE,
        steps: [openStep(), { key: "connect", title: "Connect this browser", state: "waiting", line: "Lost the connection. Trying again..." }, approve],
        connect: { label: "Try now", action: "connect" },
        addressLink: false
      };
    case "disconnected":
      return {
        gated: true,
        heading: HEADING,
        line: LINE,
        steps: [
          openStep(),
          {
            key: "connect",
            title: "Connect this browser",
            state: "todo",
            line: status.paired ? "Connect to pick up where you left off." : "Connect this browser so FluxIQ can work in it."
          },
          approve
        ],
        connect: { label: "Connect", action: "connect" },
        addressLink: false
      };
  }
}

/** Step 1 while nothing says whether FluxIQ is running. */
function openStep(): StartStep {
  return { key: "open", title: "Open FluxIQ", state: "current", line: "Start FluxIQ on this computer, or open it if it's already running." };
}

function doneSteps(): StartStep[] {
  return [
    { key: "open", title: "FluxIQ is running", state: "done" },
    { key: "connect", title: "Connected", state: "done" },
    { key: "approve", title: "This browser is approved", state: "done" }
  ];
}
