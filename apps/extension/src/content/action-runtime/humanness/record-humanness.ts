// What a result says of the humanness its command ran at, above level 0.
//
// A command at level 0, or with none, is answered exactly as today: the result
// comes back as the very object it was, with no `humanness` key. Above 0 the
// result carries the level, whether the press point came from the humanness
// aim (`aim-press.ts`), and the point of the one misclick made before the
// press, so a run's step files show every random choice the command made.

import type { CommandHumanness } from "./command-humanness";

/** What a result records of its command's humanness. */
export type HumannessRecord = { level: number; aimed: boolean; misclick?: { x: number; y: number } };

/** The result with its humanness record when the command ran above level 0; otherwise the result itself, untouched. */
export function recordHumanness<R extends object>(result: R, human: CommandHumanness | undefined, aimed: boolean, misclick?: { x: number; y: number }): R {
  if (!human) return result;
  const record: HumannessRecord = { level: human.level, aimed, ...(misclick ? { misclick: { x: misclick.x, y: misclick.y } } : {}) };
  return { ...result, humanness: record };
}
