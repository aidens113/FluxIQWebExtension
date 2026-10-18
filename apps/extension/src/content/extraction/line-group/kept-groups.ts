// Which groups of lines the proposal bound keeps.

/** A measured source as far as this rule reads it: whether it is a group, which group a line belongs to, and where it sits. */
type LineGroupEntry = {
  source: { selector?: string | undefined; lines?: true | undefined; lineOf?: string | undefined };
  position: number;
  coverage: number;
};

/**
 * The kept sources, with each group of lines the bound left out put back in
 * place of the last-placed of its own positional lines that it kept.
 *
 * A line named by position reads whichever line sits there on that item, and
 * the group is what a condition on "any of these lines" needs, so where the
 * bound has room for only one of the two the group is kept. The bound itself
 * is unchanged: a group takes a place one of its own lines held, and a group
 * none of whose lines was kept is left out like any other source.
 */
export function keepLineGroups<T extends LineGroupEntry>(measured: readonly T[], kept: readonly T[]): T[] {
  const result = [...kept];
  for (const group of measured) {
    if (group.source.lines !== true || group.coverage <= 0 || result.includes(group)) continue;
    const ownLines = result.filter((entry) => entry.source.lineOf !== undefined && entry.source.lineOf === group.source.selector);
    const last = ownLines.reduce<T | undefined>((latest, entry) => latest === undefined || entry.position > latest.position ? entry : latest, undefined);
    if (last === undefined) continue;
    result.splice(result.indexOf(last), 1, group);
  }
  return result;
}
