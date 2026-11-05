import type { AskedChange } from "../asked/index.js";
import type { SiteChange } from "../change.js";
import { judgeSiteChange, type RepeatedAct, type SiteChangeJudgement } from "../judge-change.js";
import { stillAsked } from "./still-asked.js";

/**
 * The double-act oracle for an attempt that started from what an earlier attempt left, with
 * no reseed. A person who sends the same words again wants the end state they asked for and
 * the rows, so with the earlier acts landed the right change is none at all.
 *
 * - An act done already that moved further the same way is a repeat: asked 0 and what landed.
 *   This is what a pressed-again count shows (a cart holding 2 more).
 * - A name that moved back, away from the end state, is a change the task never asked for:
 *   `unaskedChanges` names it. This is what a toggle pressed again shows (a save undone).
 * - What an earlier attempt left undone is still asked, and is held to the plain oracle.
 *
 * This is not the first attempt's oracle loosened: the first attempt never comes here. A task
 * that means "do it again" says so in its own words, is another task with another key, and has
 * its own row in the asked table.
 */
export function judgeLaterChange(asked: AskedChange, left: SiteChange, change: SiteChange): SiteChangeJudgement {
  const remaining = stillAsked(asked, left);
  const plain = judgeSiteChange(remaining, change);
  const repeatedActs: RepeatedAct[] = [...plain.repeatedActs];
  const pressedAgain = new Set<string>();
  for (const act of asked.acts) {
    let landed = 0;
    for (const [name, wanted] of Object.entries(act.change)) {
      const moved = change[name] ?? 0;
      if (Object.hasOwn(remaining.change, name) || moved === 0 || Math.sign(moved) !== Math.sign(wanted)) continue;
      pressedAgain.add(name);
      landed = Math.max(landed, Math.abs(moved));
    }
    if (landed > 0 && !repeatedActs.some((repeat) => repeat.name === act.name)) repeatedActs.push({ name: act.name, asked: 0, landed });
  }
  const unaskedChanges = plain.unaskedChanges.filter((name) => !pressedAgain.has(name));
  return { held: repeatedActs.length === 0 && plain.missingActs.length === 0 && unaskedChanges.length === 0, repeatedActs, missingActs: plain.missingActs, unaskedChanges };
}
