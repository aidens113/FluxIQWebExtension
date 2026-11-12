// The generator a command's misclick draws from (W2 H4, `before.ts`).
//
// Seeded by the command id, as every humanness choice is (`../command-humanness.ts`),
// so the step log's command id reproduces whether the command misclicked, where,
// and how long it paused after. It is a stream of its own rather than further
// draws from the command's H3 generator: a press made once more is aimed again
// from that generator after the first press (`../../../actions/click.ts`,
// `aimAgain`), so any draw taken before the press would move that later aim.
// With a stream of its own, every H3 choice is the same with or without the mark.

import { humannessRandom, humannessSeedOf } from "@fluxiq/contracts/automation";

/** Numbers in [0, 1) for this command's misclick, seeded by its id. */
export function misclickRandom(commandId: string): () => number {
  return humannessRandom(humannessSeedOf(`${commandId}\u0000misclick`));
}
