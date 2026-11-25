/**
 * The site's names for the columns a plan renamed: each kept column's detected key, readable name
 * (`../../structure/column-names.ts`) and stored label -- the page's own words -- when the plan's own name is none of them, so a record output that still writes
 * `number_2` for the column kept as `rating` is read as `rating` (`./stored-columns.ts`, lead's decision 2026-11-25).
 * A site name that is also a kept column's own name, or that two renamed columns share, names no one column and is left out.
 */
export function webPlanSiteNames(sources: Record<string, string>, names: Record<string, string> | undefined, labels: Record<string, string> | undefined = undefined): Record<string, string[]> | undefined {
  const kept = new Set(Object.keys(sources));
  const owners = new Map<string, string[]>();
  for (const [id, source] of Object.entries(sources)) {
    for (const name of new Set([source, names?.[source], labels?.[source]])) {
      if (name === undefined || name === id || kept.has(name)) continue;
      owners.set(name, [...(owners.get(name) ?? []), id]);
    }
  }
  const result: Record<string, string[]> = {};
  for (const [name, ids] of owners) if (ids.length === 1) (result[ids[0]!] ??= []).push(name);
  return Object.keys(result).length === 0 ? undefined : result;
}
