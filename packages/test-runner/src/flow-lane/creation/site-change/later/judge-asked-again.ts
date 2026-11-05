import type { AskedChange } from "../asked/index.js";
import type { SiteChange } from "../change.js";
import { judgeSiteChange, type SiteChangeJudgement } from "../judge-change.js";
import { stillAsked } from "./still-asked.js";

/** An attempt a person asked for again, judged on whether it left what they asked for, and how. */
export type AskedAgainJudgement = SiteChangeJudgement & Readonly<{
  /** Asked acts that moved again the asked way in this attempt: a count's add pressed again. */
  pressedAgain: readonly string[];
  /** Asked acts that already stood as asked and did not move: a control checked and not pressed. */
  foundAsAsked: readonly string[];
  /** Asked acts that moved back in this attempt, away from what was asked: a toggle pressed off. */
  undone: readonly string[];
  /** Asked acts neither done before this attempt nor in it. */
  notPressed: readonly string[];
}>;

/**
 * The oracle for an attempt a person started with Run again (t869). Run again starts Core with an empty act
 * record and keeps each step's checked state, so the person gets what they asked for again:
 *
 * - a count moves further the asked way, and that is no repeat (a cart's add pressed again);
 * - a control already in its asked-for state stays as it is (a saved table stays saved), and that is right;
 * - a name that moved back, away from what was asked, is wrong (`unaskedChanges`): a Run again never
 *   presses a toggle off. This is the same-words oracle's reading of a toggle pressed again.
 * - an act an earlier attempt never reached is still asked, and is held to the plain oracle.
 *
 * **Its limit:** the Lab's lasting view does not say which name is a count and which a state, so a count that
 * stood as asked and was not pressed again reads as found as asked here. Core's own tests hold that a count
 * presses again (`same-words.test.ts`, "a person's Run again").
 *
 * This is the only place a move again the asked way is right, and it is held to that press: the series knows
 * it pressed the button, and a typed message never reaches here.
 */
export function judgeAskedAgain(asked: AskedChange, left: SiteChange, change: SiteChange): AskedAgainJudgement {
  const remaining = stillAsked(asked, left);
  const plain = judgeSiteChange(remaining, change);
  const pressedAgain: string[] = [];
  const foundAsAsked: string[] = [];
  const undone: string[] = [];
  const undoneNames = new Set<string>();
  const notPressed = new Set(plain.missingActs);
  for (const act of asked.acts) {
    if (remaining.acts.some((still) => still.name === act.name)) continue;
    const moves = Object.entries(act.change).map(([name, wanted]) => ({ name, moved: change[name] ?? 0, wanted }));
    const back = moves.filter(({ moved, wanted }) => moved !== 0 && Math.sign(moved) !== Math.sign(wanted));
    for (const { name } of back) undoneNames.add(name);
    if (back.length > 0) undone.push(act.name);
    else if (moves.some(({ moved }) => moved !== 0)) pressedAgain.push(act.name);
    else foundAsAsked.push(act.name);
  }
  const pressedNames = new Set(asked.acts.filter((act) => pressedAgain.includes(act.name)).flatMap((act) => Object.keys(act.change)));
  const unaskedChanges = [...new Set([...plain.unaskedChanges.filter((name) => !pressedNames.has(name)), ...undoneNames])];
  const missingActs = [...notPressed];
  return Object.freeze({
    held: asked.acts.length > 0 && plain.repeatedActs.length === 0 && missingActs.length === 0 && unaskedChanges.length === 0,
    repeatedActs: plain.repeatedActs, missingActs, unaskedChanges,
    pressedAgain, foundAsAsked, undone, notPressed: missingActs,
  });
}
