import type { AskedChange } from "./asked/index.js";
import type { SiteChange } from "./change.js";

/** An act that landed more than the task asked, by its name in the table: what was asked and what the site recorded. */
export type RepeatedAct = Readonly<{ name: string; asked: number; landed: number }>;

/**
 * The double-act oracle's answer.
 *
 * - `held`: the site's recorded change equals what the task asked for, once.
 * - `repeatedActs`: an asked act that moved further than asked, in the asked direction.
 * - `missingActs`: an asked act that moved less than asked, or not at all, or the wrong way.
 * - `unaskedChanges`: a lasting name the task never asked to move. A name, never a value from the page.
 */
export type SiteChangeJudgement = Readonly<{
  held: boolean;
  repeatedActs: readonly RepeatedAct[];
  missingActs: readonly string[];
  unaskedChanges: readonly string[];
}>;

/**
 * `change` against `asked`. An asked act is one or more names that move together: an
 * act that moved each of its names by exactly what it asks has happened once, and
 * one that moved a name further the same way has been repeated. What the site
 * recorded is the whole account, so an act a build landed and took back through the
 * site's own controls nets out and is no repeat.
 */
export function judgeSiteChange(asked: AskedChange, change: SiteChange): SiteChangeJudgement {
  const repeatedActs: RepeatedAct[] = [];
  const missingActs: string[] = [];
  const askedNames = new Set<string>();
  for (const act of asked.acts) {
    let repeated: RepeatedAct | undefined;
    let missing = false;
    for (const [name, wanted] of Object.entries(act.change)) {
      askedNames.add(name);
      const landed = change[name] ?? 0;
      if (landed === wanted) continue;
      if (Math.sign(landed) === Math.sign(wanted) && Math.abs(landed) > Math.abs(wanted)) repeated ??= { name: act.name, asked: Math.abs(wanted), landed: Math.abs(landed) };
      else missing = true;
    }
    if (repeated) repeatedActs.push(repeated);
    else if (missing) missingActs.push(act.name);
  }
  const unaskedChanges = Object.keys(change).filter((name) => !askedNames.has(name)).sort();
  return { held: repeatedActs.length === 0 && missingActs.length === 0 && unaskedChanges.length === 0, repeatedActs, missingActs, unaskedChanges };
}
