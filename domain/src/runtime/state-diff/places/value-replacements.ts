// Which shown values a step replaced (t772 value witness): the places, of those
// both of its pages show (`../../llm-evidence/control-spot/values.ts`), whose
// value changed while the old value is gone from the page. FluxIQ Core reads the
// same rule off two whole start-state reads for an act it read around itself
// (`flow-bootstrap/reset-settlement/value-witness.ts`); a trial step's diff
// carries what this rule found, since its whole reads stay here.
//
// **Gone, not merely moved.** A value still shown somewhere on the page after
// the step was not replaced: two places swapping their values (a list sorted
// again) or a row inserted above others (each row's positional selector now
// names the row it pushed down) leave every old value on the page.
//
// **`newValue`: the new value was not on the page before.** Without it the
// replacement is weaker evidence, and Core treats it so: the value may have
// been shown elsewhere before -- a chooser's option label, open over the value
// it then replaced (office `run-mvrj7qg8-6916b3f7`, a choice confirmed by a
// button that reloads the page) -- or the place may have only shifted, as when
// an inline notice above a line left and the page's positional selectors put
// that line at the notice's place. Core settles on a place showing the build's
// start value, and only a replacement with `newValue` showing the value the act
// set keeps it open.
//
// A value shown at two places and replaced at both is two replacements.

/** Core's bound on a step's replaced values (`service/candidate-trial/landed-acts.ts`): a step with more names none. */
const MAX_REPLACED = 256;

/** One shown value a step replaced, in opaque tokens: its place, its value before and after, and whether the new value was new to the page (header). */
export type WebStateValueReplacement = { place: string; from: string; to: string; newValue?: true };

/** Each place in both `before` and `after` whose value the step replaced (header), in `before`'s order; none past the bound. */
export function webStateValueReplacements(before: Readonly<Record<string, string>>, after: Readonly<Record<string, string>>): WebStateValueReplacement[] {
  const was = tally(before), now = tally(after);
  const replaced: WebStateValueReplacement[] = [];
  for (const [place, from] of Object.entries(before)) {
    const to = after[place];
    if (to === undefined || to === from || (now.get(from) ?? 0) >= (was.get(from) ?? 0)) continue;
    replaced.push({ place, from, to, ...((now.get(to) ?? 0) > (was.get(to) ?? 0) ? { newValue: true as const } : {}) });
  }
  return replaced.length > MAX_REPLACED ? [] : replaced;
}

/** How many places show each value. */
function tally(values: Readonly<Record<string, string>>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of Object.values(values)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}
