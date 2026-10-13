// The created Flow's failed judgement, as the repair lane records it beside its
// own record (`LiveRepairLaneInput.laneFailure`). Closed words only: the
// runner's failure category and a closed code where the failure names one. The
// message is never kept, because an oracle's message may quote page text.

import { classifyRunnerFailure, RunnerFailure } from "../../failure.js";
import type { LiveRepairLaneFailure } from "./run-repair-lane.js";

/** A closed code: lowercase words joined by `.`, `_`, `:` or `-`, as Core's and the Lab's codes are. */
const CLOSED_CODE = /^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$/u;
const CODE_MAX_LENGTH = 80;

/** The category and closed code of the failure the created Flow's judgement threw. */
export function liveRepairLaneFailure(error: unknown): LiveRepairLaneFailure {
  const details = error instanceof RunnerFailure ? error.details : undefined;
  const named = [details?.code, details?.reasonCode].find((value): value is string => typeof value === "string" && value.length <= CODE_MAX_LENGTH && CLOSED_CODE.test(value));
  return { category: classifyRunnerFailure(error), code: named ?? null };
}
