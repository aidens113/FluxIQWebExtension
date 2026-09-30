// What one `pnpm ui:e2e` run reports: one entry per journey, each with a closed
// status and reason code, its ids, counts and timings, and the verdict folded
// from them. Nothing here reads a page; a failure keeps only its category and
// closed reason code, never its message, so no page text reaches the line the
// launcher prints.
import { RunnerFailure } from "../failure.js";
import type { UiE2eJourneyDefinition, UiE2eJourneyId, UiE2eJourneyLane, UiE2eLaneSelection } from "./journey-selection.js";

export type UiE2eJourneyStatus = "verified" | "failed" | "not_built" | "not_run";

/** A journey's facts: identifiers Core minted, and closed counts, flags and codes. */
export type UiE2eFacts = Readonly<Record<string, string | number | boolean | null>>;

export type UiE2eJourneyOutcome = Readonly<{
  id: UiE2eJourneyId;
  name: string;
  lane: UiE2eJourneyLane;
  selected: boolean;
  status: UiE2eJourneyStatus;
  /** Closed: why the journey is not `verified`, or null when it is. */
  reasonCode: string | null;
  /** The failure taxonomy category of a `failed` journey, or null. */
  failureCategory: string | null;
  durationMs: number;
  ids: UiE2eFacts;
  counts: UiE2eFacts;
  /** Milliseconds from the journey's start at which each of its stages was reached. */
  timings: Readonly<Record<string, number>>;
}>;

export type UiE2eSuiteResult = Readonly<{
  status: "passed" | "failed";
  lane: UiE2eLaneSelection;
  durationMs: number;
  selected: number;
  verified: number;
  failed: number;
  notBuilt: number;
  notRun: number;
  journeys: readonly UiE2eJourneyOutcome[];
}>;

const CLOSED_CODE = /^[a-z0-9_]+(?:\.[a-z0-9_]+)*$/u;

/** A journey that did not run or is not built: no ids, counts or timings. */
export function unmeasuredOutcome(definition: UiE2eJourneyDefinition, selected: boolean, status: "not_built" | "not_run", reasonCode: string): UiE2eJourneyOutcome {
  return { id: definition.id, name: definition.name, lane: definition.lane, selected, status, reasonCode, failureCategory: null, durationMs: 0, ids: {}, counts: {}, timings: {} };
}

/** A journey that threw: its category and closed reason code only; the message stays behind. */
export function failedOutcome(definition: UiE2eJourneyDefinition, error: unknown, durationMs: number): UiE2eJourneyOutcome {
  const reason = error instanceof RunnerFailure ? error.details?.reasonCode : undefined;
  return {
    id: definition.id, name: definition.name, lane: definition.lane, selected: true, status: "failed",
    reasonCode: typeof reason === "string" && CLOSED_CODE.test(reason) ? reason : "journey.failed",
    failureCategory: error instanceof RunnerFailure ? error.category : "unknown",
    durationMs, ids: {}, counts: {}, timings: {},
  };
}

/** Folds the journeys into the run's verdict: passed only when every selected journey is `verified`, and at least one was selected. */
export function foldUiE2eSuite(lane: UiE2eLaneSelection, journeys: readonly UiE2eJourneyOutcome[], durationMs: number): UiE2eSuiteResult {
  const selected = journeys.filter(journey => journey.selected);
  const count = (status: UiE2eJourneyStatus) => selected.filter(journey => journey.status === status).length;
  const verified = count("verified");
  return {
    status: selected.length > 0 && verified === selected.length ? "passed" : "failed",
    lane, durationMs,
    selected: selected.length, verified, failed: count("failed"), notBuilt: count("not_built"), notRun: count("not_run"),
    journeys,
  };
}

/** The launcher's exit code: 0 when the suite passed, 2 when any selected journey was not verified. A rig error (1) never reaches a result. */
export function uiE2eExitCode(result: Pick<UiE2eSuiteResult, "status">): 0 | 2 {
  return result.status === "passed" ? 0 : 2;
}
