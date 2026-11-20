// The getting-started screen as data: whether it replaces the chat, and its
// numbered steps -- Start FluxIQ, Connect and approve, and Add your AI key --
// each marked done, under way, a problem, or still to do. Pure, so every state is
// tested without a DOM.
//
// Connecting is not a button press: once a valid FluxIQ is found at the configured
// address the request goes out by itself (`autoConnect`), and its approval code shows
// at once. Connect stays only as the retry after a request failed or was cancelled.
// Signing in is FluxIQ's own page and the extension cannot tell whether it is done
// (`paired` is the browser's approval, not the panel session), so it is not a step of
// its own: the approve step says "sign in if it asks".
//
// A tick is only ever for something detected: a valid FluxIQ found at the configured
// address (its discovery document), connected. The approve step is never ticked while the
// browser is not connected: a stored approval says only that FluxIQ approved this browser
// once. After a refused or lost connection it says "Access was removed" when the state
// shows the trust is gone, and "Not connected" otherwise.
//
// The AI key is the last step. The screen shows only until the browser is connected, and
// then the chat comes back with the shared key card, which says the key's state; the step
// here is a plain "to do", never a second reading of the key.
//
// When the background lost the wait it was on (its worker was stopped
// mid-pairing or mid-connect, `panel/state/background-loss.ts`), the screen
// says so and offers Connect, and never shows the old approval code: FluxIQ
// withdrew it with the session (t707 P1).
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

/** The setup steps. */
export type StartStepKey = "start" | "approve" | "key";

/** One numbered step. `change` says the step offers to change the FluxIQ web address. */
export type StartStep = { readonly key: StartStepKey; readonly title: string; readonly state: StartStepState; readonly line?: string; readonly change?: boolean };

/** The connect step's button: its words, and what pressing it asks the background. */
export type StartConnect = { readonly label: "Connect" | "Try again" | "Try now" | "Cancel"; readonly action: "connect" | "disconnect" };

/** What the panel remembers that the status does not say. */
export type StartMemory = {
  /** The browser was connected at some point while this panel was open. */
  readonly wasConnected?: boolean;
  /** The request already went out by itself once. */
  readonly autoSent?: boolean;
};

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
  /** FluxIQ is found and nothing has asked it yet: the screen sends the connection request itself. */
  readonly autoConnect: boolean;
};

const HEADING = "Get started with FluxIQ";
const NO_CODE = "------";
const LOST_LINES: Readonly<Record<BackgroundLoss, string>> = {
  pairing: "The approval code expired because the extension restarted. Press Connect for a new code.",
  connecting: "The extension restarted before it connected. Press Connect to try again."
};

const START = "Start FluxIQ";
const APPROVE = "Connect and approve";
const KEY = "Add your AI key";

/**
 * The guide for `status`. `noAnswer` is true when the background did not
 * answer the panel; the next status to arrive ends it. `lost` is the wait the
 * background lost, from the panel store. `server` is what the configured web
 * address answered before pairing. `memory` is what the panel remembers.
 */
export function startGuide(status: ExtensionStatus | undefined, noAnswer: boolean, lost?: BackgroundLoss, server?: ServerFinding, memory: StartMemory = {}): StartGuide {
  const base = { gated: true, heading: HEADING, line: words.SETUP_LINE, addressLink: false, autoConnect: false };
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

  // The trust is gone when FluxIQ refused this browser, or its approval was dropped after it had connected.
  const removed = status.enrolmentRefusalCode !== undefined || (memory.wasConnected === true && !status.paired);
  const goneLine = removed ? words.ACCESS_REMOVED_LINE : words.NOT_CONNECTED_LINE;
  const key = step("key", KEY, "todo", words.KEY_LINE);
  const running = step("start", START, "current", words.START_LINE);

  if (lost !== undefined) {
    return {
      ...base,
      steps: [running, step("approve", APPROVE, "problem", LOST_LINES[lost]), key],
      connect: { label: "Connect", action: "connect" }
    };
  }

  switch (state) {
    case "pairing":
      return {
        ...base,
        steps: [step("start", START, "done", "FluxIQ is running"), step("approve", APPROVE, "waiting", words.APPROVE_LINE), key],
        pairingCode: status.pairingReferenceCode ?? NO_CODE
      };
    case "error":
      return {
        ...base,
        steps: [step("start", START, "problem", words.START_PROBLEM, true), step("approve", APPROVE, "todo", goneLine), key],
        connect: { label: "Try again", action: "connect" },
        addressLink: true
      };
    case "connecting":
      return { ...base, steps: [running, step("approve", APPROVE, "waiting", words.CONNECTING_LINE), key], connect: { label: "Cancel", action: "disconnect" } };
    case "reconnecting":
      return { ...base, steps: [running, step("approve", APPROVE, "waiting", words.RECONNECTING_LINE), key], connect: { label: "Try now", action: "connect" } };
    case "disconnected": {
      // Step one is done only when the configured address answered with FluxIQ's own discovery document, and it says where.
      const found = server?.found === true;
      const first = server === undefined
        ? running
        : found
          ? step("start", START, "done", words.foundLine(server.host), true)
          : step("start", START, "current", words.notFoundLine(server.host), true);
      // Found, and nothing has asked yet (this panel never connected, the request has not gone out): it goes out by itself.
      const autoConnect = found && memory.autoSent !== true && memory.wasConnected !== true;
      const approve = autoConnect
        ? step("approve", APPROVE, "waiting", words.ASKING_LINE)
        : step("approve", APPROVE, "todo", memory.wasConnected === true || memory.autoSent === true || status.paired || removed ? goneLine : words.CONNECT_LINE);
      return {
        ...base,
        autoConnect,
        steps: [first, approve, key],
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

/** The steps once the browser is connected: FluxIQ was reached and approved this browser; the key card in the chat says the rest. */
function doneSteps(): StartStep[] {
  return [
    step("start", START, "done", "FluxIQ is running"),
    step("approve", APPROVE, "done", "This browser is approved"),
    step("key", KEY, "todo", words.KEY_LINE)
  ];
}
