import { HUMANNESS_LIMITS } from "./limits";

/** Rounds to a whole number and clamps to the bounds; anything that is not a number is the default. */
export function normaliseHumanness(value: unknown): number {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
  if (!Number.isFinite(number)) return HUMANNESS_LIMITS.default;
  return Math.min(HUMANNESS_LIMITS.max, Math.max(HUMANNESS_LIMITS.min, Math.round(number)));
}
