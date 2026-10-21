import { keepLineGroups } from "../line-group";

/**
 * Propose the same bounded set discovery can collect. A separate smaller
 * proposal limit discarded late ordinary data from already discovered sources.
 * Mixed-template splitting can add sources; coverage and partial/group rules
 * still arbitrate those within this bound. The model packet has its own byte
 * budget and reports truncation (`structure/packet.ts`). Discovery's own bound
 * per item is the same number (`infer-fields.ts`, `MAX_CANDIDATE_FIELDS`).
 */
const MAX_PROPOSED_FIELDS = 64;

/**
 * How many of those places are held for columns that only *some* items have.
 *
 * Coverage decides the rest, and coverage alone is exactly the wrong judge
 * here: a column every item carries is the fullest column and says nothing
 * about *which* items a read wants, so a bound that keeps the widest-covering
 * fields cuts the marks first. A mark is by construction a partial column --
 * four sponsored cards among twenty -- so a few places are held for partial
 * columns before coverage spends the rest.
 */
const RESERVED_PARTIAL_FIELDS = 8;

/**
 * How many places are held, before the partial marks take theirs, for
 * controls only some rows carry: the per-row button that says a row is outside
 * the person's set. Coverage would put them last among the partial columns,
 * since such a control is often on few rows (see the barrel).
 */
const RESERVED_PARTIAL_CONTROLS = 4;

/** A measured source as far as the budget reads it. */
type BudgetEntry = {
  source: { pressable?: true | undefined; selector?: string | undefined; lines?: true | undefined; lineOf?: string | undefined };
  position: number;
  coverage: number;
};

/**
 * The measured sources the proposal keeps, back in document order: first a few
 * partial controls, then a few partial marks, then the widest-covering of the
 * rest, within `MAX_PROPOSED_FIELDS`; a group of lines takes the place of one
 * of its own lines where the bound has room for only one (`line-group/`).
 * `sort` is stable, so equal coverage keeps document order.
 */
export function keptSources<T extends BudgetEntry>(measured: readonly T[]): T[] {
  const byCoverage = [...measured].sort((left, right) => right.coverage - left.coverage);
  const partial = byCoverage.filter((entry) => entry.coverage > 0 && entry.coverage < 1);
  const controls = partial.filter((entry) => entry.source.pressable === true).slice(0, RESERVED_PARTIAL_CONTROLS);
  const marks = partial.filter((entry) => !controls.includes(entry)).slice(0, RESERVED_PARTIAL_FIELDS);
  const reserved = new Set([...controls, ...marks].slice(0, MAX_PROPOSED_FIELDS));
  const rest = byCoverage.filter((entry) => !reserved.has(entry)).slice(0, MAX_PROPOSED_FIELDS - reserved.size);
  return keepLineGroups(measured, [...reserved, ...rest]).sort((left, right) => left.position - right.position);
}
