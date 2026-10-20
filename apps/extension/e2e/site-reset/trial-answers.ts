import type { JsonObject } from "fluxiq/core";

/** One act as a trial gate or an undo refusal names it. */
export type NamedAct = { act: string; did: string; call?: string; settle?: string };

const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};

function named(value: unknown): NamedAct[] {
  if (!Array.isArray(value)) return [];
  return value.map(record).filter(entry => typeof entry.act === "string").map(entry => ({
    act: String(entry.act),
    did: String(entry.did ?? ""),
    ...(typeof entry.call === "string" ? { call: entry.call } : {}),
    ...(typeof entry.settle === "string" ? { settle: entry.settle } : {})
  }));
}

/** The acts an answer lists under `key` (`actsToUndo`, `actsToRestore`, `cannotUndo`). */
export function actsUnder(answer: JsonObject | undefined, key: string): NamedAct[] {
  return named(answer?.[key]);
}

/** The acts an admitted trial says it started with, left on the site (`startedWith.cannotUndo`). */
export function startedWithActs(answer: JsonObject | undefined): NamedAct[] {
  return named(record(answer?.startedWith).cannotUndo);
}

/** A trial answer's verdict or refusal code. */
export function trialCode(answer: JsonObject | undefined): unknown {
  return answer?.code ?? answer?.verdict;
}
