// The live spend budget a person sets: `lab-slots/spend-budget.json`,
// `{ "maxUsd": number, "window": "day" }`. Absent or invalid, it is no budget,
// and no live run starts.

import { readFile } from "node:fs/promises";

/**
 * @typedef {{ ok: true, maxUsd: number, window: "day" } | { ok: false, reason: string }} SpendBudget
 */

/**
 * @param {string} file
 * @returns {Promise<SpendBudget>}
 */
export async function readSpendBudget(file) {
  let text;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return { ok: false, reason: `no live spend budget is set: ${file} does not exist` };
    throw error;
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) return { ok: false, reason: `no live spend budget is set: ${file} is not valid JSON (${error.message})` };
    throw error;
  }
  const maxUsd = parsed?.maxUsd;
  if (typeof maxUsd !== "number" || !Number.isFinite(maxUsd) || maxUsd < 0) {
    return { ok: false, reason: `no live spend budget is set: ${file} has no "maxUsd" that is a non-negative number` };
  }
  if (parsed.window !== "day") {
    return { ok: false, reason: `no live spend budget is set: ${file} must say "window": "day" (it says ${JSON.stringify(parsed.window ?? null)})` };
  }
  return { ok: true, maxUsd, window: "day" };
}

/**
 * The start of the budget window `now` falls in: local midnight, so "a day"
 * is the day on the clock of the person who set the budget.
 *
 * @param {"day"} window
 * @param {number} now epoch milliseconds
 */
export function budgetWindowStart(window, now) {
  if (window !== "day") throw new Error(`unknown budget window ${JSON.stringify(window)}`);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start.getTime();
}
