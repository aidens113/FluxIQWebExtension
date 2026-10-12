// The options of a select closest to a value it was asked for and does not
// offer, so the failure says what to write instead (t464).
//
// Lane B round 8 (`run-mv5jnc62-01c3609a`) sent a quantity select the three
// characters `"2"`, quote marks included. The failure listed every option and
// never said that `2` differed from what was sent only by those quote marks,
// so the model searched the page for another control instead of correcting
// its value. This ranks the control's own options against the value sent --
// nothing beyond the options the failure already lists -- and says when the
// closest one differs only by quote marks, surrounding spaces or letter case.
//
// Pure: the select verb (`./select.ts`) reads the options off the element and
// decides whether the select is sensitive, in which case nothing here is used.

/** One option as the failure names it: its value and the label a person reads. */
type OfferedOption = { value: string; label: string };

/** Quote marks a value is commonly written inside. */
const QUOTE_PAIR = /^(["'`])([\s\S]*)\1$/u;

/**
 * The `limit` options closest to `sent`, closest first, and the first of them
 * when it differs from `sent` only by quote marks, spaces or letter case.
 * Options keep their order on a tie, so the page's order breaks it.
 */
export function closestOfferedOptions(sent: string, options: readonly OfferedOption[], limit = 5): { closest: OfferedOption[]; sameButQuoting: OfferedOption | undefined } {
  const wanted = comparable(sent);
  const ranked = options
    .map((option, index) => ({ option, index, ...distance(wanted, option) }))
    .sort((a, b) => a.tier - b.tier || a.edits - b.edits || a.index - b.index);
  const closest = ranked.slice(0, Math.max(0, limit)).map((entry) => entry.option);
  const first = ranked[0];
  return { closest, sameButQuoting: first && first.tier === 0 ? first.option : undefined };
}

/** A value with any wrapping quote marks removed, spaces collapsed and letters lower-cased. */
function comparable(value: string): string {
  let text = value.trim();
  for (let match = QUOTE_PAIR.exec(text); match; match = QUOTE_PAIR.exec(text)) text = match[2]!.trim();
  return text.replace(/\s+/gu, " ").toLowerCase();
}

/**
 * How far an option is from what was wanted: tier 0 when its value or label is
 * the same once compared, tier 1 when one contains the other, tier 2 otherwise,
 * with the edit distance to the nearer of its value and label within a tier.
 */
function distance(wanted: string, option: OfferedOption): { tier: number; edits: number } {
  const forms = [comparable(option.value), comparable(option.label)];
  const edits = Math.min(...forms.map((form) => editDistance(wanted, form)));
  if (forms.includes(wanted)) return { tier: 0, edits };
  if (wanted && forms.some((form) => form && (form.includes(wanted) || wanted.includes(form)))) return { tier: 1, edits };
  return { tier: 2, edits };
}

/** Levenshtein distance, bounded in cost by the short strings an option holds. */
function editDistance(a: string, b: string): number {
  const left = a.slice(0, 200);
  const right = b.slice(0, 200);
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + (left[i - 1] === right[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[right.length]!;
}
