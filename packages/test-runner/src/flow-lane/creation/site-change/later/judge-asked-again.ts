import type { AskedChange } from "../asked/index.js";
import type { SiteChange } from "../change.js";

/** An attempt a person asked for again, judged on whether it did the asked acts again. */
export type AskedAgainJudgement = Readonly<{
  /** Asked acts the site shows done again in this attempt, by name. */
  pressedAgain: readonly string[];
  /** Asked acts the site shows untouched in this attempt, by name. */
  notPressed: readonly string[];
  held: boolean;
}>;

/**
 * The oracle for an attempt a person started with Run again (t869): "you asked to do it again" is not a
 * repeated act. Each asked act must move again in this attempt, whichever way: a count moves further,
 * and a toggle a second press undoes moves back, which is what doing it again does to it. Nothing that
 * moved is called a repeat, and the first attempt's end state is not asked of it.
 *
 * This is the only place a repeat is right, and it is held to that press: the series knows it pressed
 * the button, and a typed message never reaches here.
 */
export function judgeAskedAgain(asked: AskedChange, change: SiteChange): AskedAgainJudgement {
  const pressedAgain: string[] = [];
  const notPressed: string[] = [];
  for (const act of asked.acts) {
    const moved = Object.keys(act.change).some((name) => (change[name] ?? 0) !== 0);
    (moved ? pressedAgain : notPressed).push(act.name);
  }
  return Object.freeze({ pressedAgain, notPressed, held: asked.acts.length > 0 && notPressed.length === 0 });
}
