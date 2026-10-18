// What a selector can say about one kind of element that the other kinds a
// column met do not share.

import type { ElementKind } from "./element-kind";

/** A class name that needs no escaping, as `infer-fields.ts` holds its own steps to. */
const PLAIN_CLASS = /^[A-Za-z_-][\w-]*$/u;

/** A role a selector can name as written. */
const PLAIN_ROLE = /^[a-z][a-z-]*$/u;

/** At most this many classes enter a step, as `infer-fields.ts` caps its own. */
const MAX_STEP_CLASSES = 3;

/** The parts of a selector step for one kind, every part page structure. */
export type KindConditions = {
  /** Classes every element of the kind has, those no other kind has first, capped. */
  classes: readonly string[];
  /** Those of `classes` no element of another kind has. */
  distinct: readonly string[];
  /** Attribute tests that hold for this kind and not for some other: `[aria-label]`, `:not([aria-label])`, `[role="img"]`, `[href^="/posts/"]`. */
  conditions: readonly string[];
};

/**
 * The step parts for `own` (every element of one kind, all `sameKind`) against
 * `others` (every element of the other kinds). A test is written only where
 * some other kind differs, so a kind is never narrowed by what all kinds share.
 */
export function kindConditions(own: readonly ElementKind[], others: readonly ElementKind[]): KindConditions {
  const first = own[0];
  if (first === undefined) return { classes: [], distinct: [], conditions: [] };
  const common = first.classes.filter((name) => PLAIN_CLASS.test(name) && own.every((kind) => kind.classes.includes(name))).sort();
  const distinct = common.filter((name) => others.every((kind) => !kind.classes.includes(name)));
  const classes = [...distinct, ...common.filter((name) => !distinct.includes(name))].slice(0, MAX_STEP_CLASSES);
  const conditions: string[] = [];
  for (const name of new Set([...own, ...others].flatMap((kind) => kind.stated))) {
    const has = first.stated.includes(name);
    if (others.some((kind) => kind.stated.includes(name) !== has)) conditions.push(has ? `[${name}]` : `:not([${name}])`);
  }
  if (others.some((kind) => kind.role !== first.role)) {
    if (first.role === undefined) conditions.push(":not([role])");
    else if (PLAIN_ROLE.test(first.role)) conditions.push(`[role="${first.role}"]`);
  }
  if (others.some((kind) => kind.href !== first.href)) {
    if (first.href === undefined) conditions.push(":not([href])");
    else if (first.href !== "") conditions.push(`[href^="${first.href.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"')}"]`);
  }
  return { classes, distinct: distinct.slice(0, MAX_STEP_CLASSES), conditions };
}
