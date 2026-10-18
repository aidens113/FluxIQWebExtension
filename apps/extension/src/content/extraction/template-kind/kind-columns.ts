// Each positional column read as one kind of element in every item.

import { isWithinSensitiveControl } from "../../sensitive-text";
import { elementKind, type ElementKind } from "./element-kind";
import { kindConditions } from "./kind-conditions";
import { sameKind } from "./same-kind";

/** A field source as far as this rule reads and rewrites it (`infer-fields.ts`, `FieldSource`). */
export type KindSource = {
  kind: string;
  label: string;
  selector?: string | undefined;
  attribute?: string | undefined;
  lines?: true | undefined;
  lineOf?: string | undefined;
  sensitive: boolean;
};

/** The label of the path from the item down to the element, as `infer-fields.ts` writes it. */
export type PathLabel = (item: Element, element: Element) => string | undefined;

/** A selector with a step that names its element by position among its siblings. */
const POSITIONAL = /:nth-of-type\(\d+\)/u;

/** A tag a step can name without escaping. */
const PLAIN_TAG = /^[a-z][a-z0-9-]*$/u;

/** How many of a run's items a column's kinds are read from. */
const MAX_KIND_ITEMS = 48;

/** The elements of one kind a column read, each with its item, in run order. */
type KindGroup = { kind: ElementKind; entries: Array<{ item: Element; element: Element }> };

/**
 * The sources with every positional column that reads different kinds of
 * element in different items made to read one kind.
 *
 * The column keeps the kind it reads in the first item that gives it a value,
 * under its own label and key, and reads it by a selector that names that kind
 * alone in each item -- by its tag and classes, and by what tells it from the
 * other kinds: an attribute it carries or lacks, its role, the folder its link
 * points into. Each other kind gets a column of its own by the same rule: an
 * existing column that reads that kind in the items it has becomes it, keeping
 * its label and key; otherwise a new one is added after this one, labelled by
 * its path. Where no selector names the kind alone anywhere in the item, the
 * positional selector is narrowed to the kind (`...span:nth-of-type(1) >
 * a[aria-label]`), so the column is split and never mixes kinds. A column a
 * rewritten one reads entirely, in every item it has, is left out as a
 * repeat. A source no rule changes is returned as it was.
 */
export function separateKinds<T extends KindSource>(sources: readonly T[], run: readonly Element[], pathLabel: PathLabel): T[] {
  const items = run.slice(0, MAX_KIND_ITEMS);
  const result: T[] = [...sources];
  const rewritten = new Set<T>();
  for (const source of sources) {
    const selector = source.selector;
    if (!result.includes(source) || source.lines === true || selector === undefined || !POSITIONAL.test(selector)) continue;
    const groups = kindGroups(items, selector);
    if (groups.length < 2) continue;
    const readable = groups.filter((group) => group.entries.some(({ element }) => resolves(source, element)));
    let last: T = source;
    for (const [index, group] of readable.entries()) {
      const found = kindSelector(items, source, group, groups);
      if (found === undefined) continue;
      if (index === 0) {
        last = replace(result, source, { ...source, selector: found.selector }, rewritten);
        continue;
      }
      const widened = found.positional ? undefined : result.find((other) => !rewritten.has(other) && sameRead(other, source) && readsWithin(items, other, found.selector));
      if (widened !== undefined) {
        replace(result, widened, { ...widened, selector: found.selector }, rewritten);
        continue;
      }
      const sensitive = source.sensitive || group.entries.some(({ element }) => isWithinSensitiveControl(element));
      const added: T = { ...source, selector: found.selector, label: columnLabel(items, source, found, pathLabel), lineOf: undefined, sensitive };
      result.splice(result.indexOf(last) + 1, 0, added);
      rewritten.add(added);
      last = added;
    }
  }
  return result.filter((candidate) => rewritten.has(candidate) || ![...rewritten].some((column) => sameRead(column, candidate) && covers(items, column, candidate)));
}

/** Puts `next` where `previous` was, and marks it rewritten. */
function replace<T>(result: T[], previous: T, next: T, rewritten: Set<T>): T {
  result.splice(result.indexOf(previous), 1, next);
  rewritten.add(next);
  return next;
}

/** The elements the selector names in the items, grouped by kind in the order the run first meets each kind. */
function kindGroups(items: readonly Element[], selector: string): KindGroup[] {
  const groups: KindGroup[] = [];
  for (const item of items) {
    const element = item.querySelector(selector);
    if (element === null) continue;
    const kind = elementKind(element);
    const group = groups.find((known) => sameKind(known.kind, kind));
    if (group === undefined) groups.push({ kind, entries: [{ item, element }] });
    else group.entries.push({ item, element });
  }
  return groups;
}

/**
 * A selector for the group's kind: one step anywhere in the item that names
 * that kind alone in every item and the group's own element in each of its
 * items; failing that, one that names only that kind, the group's element
 * first, where an item embeds a second element of the kind (a post quoting
 * another, with its own timestamp); and otherwise the source's positional
 * selector narrowed to the kind. `undefined` when none holds.
 */
function kindSelector(items: readonly Element[], source: KindSource, group: KindGroup, groups: readonly KindGroup[]): { selector: string; positional: boolean; narrowed: string } | undefined {
  const others = groups.filter((other) => other !== group).flatMap((other) => other.entries.map(({ element }) => elementKind(element)));
  const { classes, distinct, conditions } = kindConditions(group.entries.map(({ element }) => elementKind(element)), others);
  if (PLAIN_TAG.test(group.kind.tag)) {
    const base = `:scope ${group.kind.tag}${classes.map((name) => `.${name}`).join("")}`;
    const candidates = [...new Set(["", ...conditions, conditions.join("")])].map((extra) => `${base}${extra}`);
    const found = candidates.find((candidate) => accepts(items, source, group, candidate, 1)) ?? candidates.find((candidate) => accepts(items, source, group, candidate, Infinity));
    if (found !== undefined) return { selector: found, positional: false, narrowed: "" };
  }
  const narrowed = `${distinct.map((name) => `.${name}`).join("")}${conditions.join("")}`;
  if (narrowed === "" || source.selector === undefined || !accepts(items, source, group, `${source.selector}${narrowed}`, 1)) return undefined;
  return { selector: `${source.selector}${narrowed}`, positional: true, narrowed };
}

/**
 * Whether the selector reads the group's kind and nothing else: at most
 * `most` elements in every item, every element it names of that kind and
 * giving the source a value, and -- first, which is the one a read takes --
 * the group's own element in each of the group's items.
 */
function accepts(items: readonly Element[], source: KindSource, group: KindGroup, selector: string, most: number): boolean {
  try {
    for (const item of items) {
      const named = Array.from(item.querySelectorAll(selector));
      if (named.length > most) return false;
      if (named.some((element) => !sameKind(elementKind(element), group.kind) || !resolves(source, element))) return false;
    }
    return group.entries.every(({ item, element }) => item.querySelector(selector) === element);
  } catch {
    // A selector this page cannot parse names no kind here.
    return false;
  }
}

/** Whether the source gives the element a value, as coverage counts it (`infer-fields.ts`, `resolvesIn`). */
function resolves(source: KindSource, element: Element): boolean {
  if (source.kind === "attribute") return source.attribute !== undefined && element.hasAttribute(source.attribute);
  if (source.kind === "link") return element.getAttribute("href") !== null;
  return true;
}

/** Whether two sources read an element the same way, so one can stand for the other. */
function sameRead(left: KindSource, right: KindSource): boolean {
  return left.kind === right.kind && left.attribute === right.attribute && (left.lines === true) === (right.lines === true);
}

/** The element the source gives a value from in the item, or `null`. */
function valued(item: Element, source: KindSource): Element | null {
  if (source.selector === undefined) return null;
  const element = item.querySelector(source.selector);
  return element !== null && resolves(source, element) ? element : null;
}

/** Whether, in every item where `other` gives a value, the selector names that same element, and it gives one somewhere. */
function readsWithin(items: readonly Element[], other: KindSource, selector: string): boolean {
  let found = 0;
  for (const item of items) {
    const element = valued(item, other);
    if (element === null) continue;
    found += 1;
    if (item.querySelector(selector) !== element) return false;
  }
  return found > 0;
}

/** Whether the column reads everything the candidate reads, in more items or by the same selector. */
function covers(items: readonly Element[], column: KindSource, candidate: KindSource): boolean {
  if (candidate.selector === undefined || candidate.lines === true) return false;
  let theirs = 0;
  let mine = 0;
  for (const item of items) {
    const read = valued(item, column);
    const own = valued(item, candidate);
    if (read !== null) theirs += 1;
    if (own === null) continue;
    mine += 1;
    if (read !== own) return false;
  }
  return mine > 0 && (theirs > mine || candidate.selector === column.selector);
}

/**
 * A new column's label: the path to its element in the first item that has
 * it, with the narrowing a positional split adds, and whatever the source's
 * label adds after its own path (` url`, ` aria-label`).
 */
function columnLabel(items: readonly Element[], source: KindSource, found: { selector: string; narrowed: string }, pathLabel: PathLabel): string {
  const pathIn = (selector: string): string | undefined => {
    for (const item of items) {
      const element = item.querySelector(selector);
      if (element !== null) return pathLabel(item, element);
    }
    return undefined;
  };
  const sourcePath = source.selector === undefined ? undefined : pathIn(source.selector);
  const suffix = sourcePath !== undefined && source.label.startsWith(sourcePath) ? source.label.slice(sourcePath.length) : "";
  return `${pathIn(found.selector) ?? sourcePath ?? source.label}${found.narrowed}${suffix}`;
}
