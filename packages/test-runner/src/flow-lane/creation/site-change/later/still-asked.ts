import type { AskedAct, AskedChange } from "../asked/index.js";
import type { SiteChange } from "../change.js";

/**
 * What a task still asks of an attempt that found the site as an earlier attempt left it:
 * the same acts, less what has already moved. A name moved as far as asked is done and gone,
 * and an act with no name left is done and gone. `left` is the site's change from the first
 * attempt's baseline to this attempt's, so an earlier attempt that finished leaves nothing
 * asked, and one its budget cut short leaves only what it did not reach.
 */
export function stillAsked(asked: AskedChange, left: SiteChange): AskedChange {
  const acts = asked.acts.flatMap((act): AskedAct[] => {
    const change = Object.fromEntries(Object.entries(act.change).flatMap(([name, wanted]): [string, number][] => {
      const remaining = wanted - (left[name] ?? 0);
      // Moved further than asked counts as done: that repeat was the earlier attempt's, and is judged on it.
      return Math.sign(remaining) === Math.sign(wanted) ? [[name, remaining]] : [];
    }));
    return Object.keys(change).length > 0 ? [{ name: act.name, change }] : [];
  });
  return Object.freeze({ acts, change: Object.freeze(Object.assign({}, ...acts.map((act) => act.change)) as Record<string, number>) });
}
