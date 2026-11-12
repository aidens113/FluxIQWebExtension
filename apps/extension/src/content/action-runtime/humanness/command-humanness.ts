// The humanness one command is run at, and the generator every choice it makes
// draws from.
//
// A run's humanness (0-100) reaches the content script on each command
// (`BrowserActionCommand.humanness`). At 0, or when the command carries none,
// there is nothing here to read: the caller takes today's path exactly. Above
// 0, every choice the command makes -- the point a press is aimed at, the gap
// before each typed character, the dwell after a scroll -- is drawn from one
// generator seeded by the command id (`humannessSeedOf`), so the step log's
// command id reproduces every choice the command made.

import { HUMANNESS_MAX, HUMANNESS_MIN, humannessRandom, humannessSeedOf, normalizeHumanness } from "@fluxiq/contracts/automation";

/** A command run above humanness 0: its level and the generator its choices draw from, in the order it makes them. */
export type CommandHumanness = {
  /** From 1 to 100. */
  level: number;
  /** How far toward full humanness the level is, from just above 0 to 1. */
  share: number;
  /** Numbers in [0, 1), seeded by the command id. */
  random: () => number;
};

/** The command's humanness, or `undefined` at level 0 or when it names none: today's path exactly. */
export function commandHumanness(action: { commandId: string; humanness?: number | undefined }): CommandHumanness | undefined {
  const level = normalizeHumanness(action.humanness);
  if (level <= HUMANNESS_MIN) return undefined;
  return { level, share: level / HUMANNESS_MAX, random: humannessRandom(humannessSeedOf(action.commandId)) };
}
