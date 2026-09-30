// Waiting out a robot check that clears by itself, without touching it.
//
// A navigation or a click can land on a check the page lifts on its own: a
// "Checking your browser before you continue" page that moves on after five
// seconds, a "Robot or human?" page that checks again automatically after
// eight. FluxIQ never presses, types into, solves or reloads a check, and a
// reload is worse than useless here -- it asks again, and a countdown starts
// over. So the tab is left alone and its top frame is asked again every
// POLL_INTERVAL_MS, for at most SELF_CLEARING_WAIT_MS:
//
// - the page says it is no longer a check: the tab is let settle (the check
//   usually reloads or replaces its document to let the visitor on) and asked
//   once more, and a second "no check" is `cleared`;
// - the page turns into a check only a person can answer -- "Checking you are
//   human..." becoming "Confirm you are human" -- is `person_only` at once;
// - the frame cannot answer, because the check's own document is being
//   replaced, is no answer either way, and the wait goes on;
// - the time runs out with the check still up: `not_cleared`, which the caller
//   hands to the person as it would a person-only check.
//
// The time is also held within the command's own `timeoutMs`, less a margin
// for the reply to reach Core, so a wait never outlives the command it serves.

import type { BrowserActionCommand } from "../shared/protocol";
import { readLandedPage, type FrameSender, type LandedPageReading } from "./landed-challenge";

/** How a wait on a self-clearing check ended, and how long it took. */
export type LandedCheckWait = {
  outcome: "cleared" | "person_only" | "not_cleared";
  waitedMs: number;
};

/** How the worker reaches a landed tab: the runner's sender, and its wait for a tab to settle. */
export type LandedTabAccess = {
  send: FrameSender;
  settle(tabId: number): Promise<void>;
};

/** A landed page's reading once any self-clearing check on it has been waited out, and how that wait went. */
export type SettledLanding = {
  reading: LandedPageReading | undefined;
  checkWait?: LandedCheckWait | undefined;
};

/** What the wait reads the tab through. Injected, so the wait can be tested without a browser. */
export type LandedCheckProbe = {
  /** Asks the tab's top frame what the page is (`readLandedPage`). */
  read(): Promise<LandedPageReading>;
  /** Lets the tab settle after the check let it go (`waitForTabReady`). */
  settle(): Promise<void>;
  sleep?(ms: number): Promise<void>;
  now?(): number;
};

/** The longest a self-clearing check is waited out before it is handed to the person. */
export const SELF_CLEARING_WAIT_MS = 15_000;

/** How often the page is asked again while a check stands. */
const POLL_INTERVAL_MS = 500;

/** Kept back from the command's own timeout so the result still reaches Core in time. */
const REPLY_MARGIN_MS = 1_000;

/** Waits, without touching the page, for a self-clearing check to lift, for at most `budgetMs`. */
export async function waitOutLandedCheck(probe: LandedCheckProbe, budgetMs: number): Promise<LandedCheckWait> {
  const now = probe.now ?? Date.now;
  const sleep = probe.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const start = now();
  const waited = (): number => now() - start;
  const ended = (outcome: LandedCheckWait["outcome"]): LandedCheckWait => ({ outcome, waitedMs: waited() });
  while (waited() < budgetMs) {
    await sleep(Math.min(POLL_INTERVAL_MS, Math.max(0, budgetMs - waited())));
    const reading = await probe.read();
    if (isPersonOnly(reading)) return ended("person_only");
    if (reading.kind !== "no_robot_check") continue;
    await probe.settle();
    const confirmed = await probe.read();
    if (confirmed.kind === "no_robot_check") return ended("cleared");
    if (isPersonOnly(confirmed)) return ended("person_only");
  }
  return ended("not_cleared");
}

/**
 * The landed page as it stands once a self-clearing check on it, if that is
 * what `first` read, has been waited out: a check that lifted reads as no
 * check, and one that did not keeps its reading beside the wait that says why.
 * Any other reading is returned as it was, without waiting.
 */
export async function settleLandedReading(
  first: LandedPageReading | undefined,
  tabId: number,
  access: LandedTabAccess,
  budgetMs: number
): Promise<SettledLanding> {
  if (first?.kind !== "robot_check" || first.check !== "self_clearing") return { reading: first };
  const checkWait = await waitOutLandedCheck({
    read: () => readLandedPage(tabId, access.send),
    settle: () => access.settle(tabId)
  }, budgetMs);
  return { reading: checkWait.outcome === "cleared" ? { kind: "no_robot_check" } : first, checkWait };
}

/** How long a command started at `startedAt` may spend waiting out a check: SELF_CLEARING_WAIT_MS, held within its own timeout. */
export function checkWaitBudgetMs(action: BrowserActionCommand, startedAt: number, now: number = Date.now()): number {
  const timeoutMs = action.timeoutMs;
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs <= 0) return SELF_CLEARING_WAIT_MS;
  return Math.max(0, Math.min(SELF_CLEARING_WAIT_MS, timeoutMs - (now - startedAt) - REPLY_MARGIN_MS));
}

/**
 * A check that still stands on a landed page, in the words a failure record
 * carries after `captcha:`. `place` names the page ("the page the browser
 * landed on"); the wait, when there was one, says why the person is next.
 */
export function standingCheckWords(place: string, checkWait: LandedCheckWait | undefined): string {
  if (checkWait?.outcome === "not_cleared") {
    return `${place} is a robot check that said it would clear by itself and had not after ${checkWait.waitedMs} ms, so only a person can answer it now`;
  }
  if (checkWait?.outcome === "person_only") {
    return `${place} is a robot check that, after ${checkWait.waitedMs} ms of checking by itself, asked for what only a person can answer`;
  }
  return `${place} is a robot check, which only a person can answer`;
}

function isPersonOnly(reading: LandedPageReading): boolean {
  return reading.kind === "robot_check" && reading.check === "person_only";
}
