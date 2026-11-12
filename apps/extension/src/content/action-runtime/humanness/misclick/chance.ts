// How often a press is preceded by a misclick (W2 H4, `before.ts`).
//
// The chance grows with the level, in proportion: `MISCLICK_CHANCE_AT_FULL`
// times the level's share of full humanness (level / 100), so 8% of marked
// commands at 100, 4% at 50, 0.8% at 10, and none at 0, where nothing here is
// asked. It is the chance per command Core marked safe; every other command
// never misclicks, whatever the level.

/** The chance a marked command misclicks first, at humanness 100. */
const MISCLICK_CHANCE_AT_FULL = 0.08;

/** The chance a marked command misclicks first at this share of full humanness (0 to 1). */
export function misclickChance(share: number): number {
  if (!(share > 0)) return 0;
  return MISCLICK_CHANCE_AT_FULL * Math.min(1, share);
}
