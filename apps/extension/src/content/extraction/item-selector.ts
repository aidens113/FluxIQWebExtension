// The selector that names a run of repeating items, generalized from the run
// itself (C4).
//
// A picked element belongs to a run of siblings that share a template
// signature, but a request carries a selector, not a list of elements. This
// module proposes the candidates a page's own markup offers, strongest first,
// and accepts one only when `document.querySelectorAll` returns exactly the run
// -- not a superset, not a subset. A selector that matched one row more than
// the run would put a header row, or a summary row, into every record the
// extraction reads.
//
// The candidates, in order:
// 1. the test id every item shares, `[data-testid="product-card"]`;
// 2. the shape that test id has when the page numbers its rows, as a prefix
//    match: `row-1`, `row-2` and `row-12` give `[data-testid^="row-"]`;
// 3. the container and the item's tag and classes, `<container> > li.card`;
// 4. the role the items carry, `<container> > [role="row"]`.
//
// Building the candidates is a pure function of what the page reads off the
// run, so it is decided and tested without a page; only the acceptance test
// touches the document.
//
// Nothing here reads a page value. A tag, a role, a test id, a class name and a
// container's selector are page structure (decision D3).

/** What the page reads off one item to name the run it belongs to. */
export type ItemSelectorParts = {
  /** A selector for the element that holds the run, from `selectorFor`. */
  container: string;
  /** The items' shared tag name, in any case. */
  tagName: string;
  /** The raw `role` attribute the items carry, when they all carry the same one. */
  role?: string | undefined;
  /** Each item's test id, as the attribute that carried it and its value, or `undefined` for an item with none. */
  testIds: ReadonlyArray<ItemTestId | undefined>;
  /** The classes the items share, in any order. */
  classes: Iterable<string>;
};

/** One item's test id: the attribute the page wrote it in, and its value. */
export type ItemTestId = { attribute: string; value: string };

/**
 * A candidate selector and how much of the proposal's confidence it carries:
 * a shared test id is what a page author wrote to name these items, while a
 * structural path is what is left when the page named nothing.
 */
export type ItemSelectorCandidate = { selector: string; confidence: number };

/** A class name that needs no escaping, so a candidate never depends on `CSS.escape` being reachable. */
const PLAIN_CLASS = /^[A-Za-z_-][\w-]*$/u;

/** At most this many of an item's classes enter a structural candidate, as the signature caps its own. */
const MAX_CANDIDATE_CLASSES = 3;

/** The shortest test-id prefix worth matching on, so `[data-testid^="a"]` is never proposed. */
const MIN_SHAPE_PREFIX = 2;

/**
 * The candidates for a run, strongest first. Pure: every part is read off the
 * run by `generalizedItemSelector`, and nothing here queries the document.
 */
export function itemSelectorCandidates(parts: ItemSelectorParts): ItemSelectorCandidate[] {
  const tag = parts.tagName.toLowerCase();
  const candidates: ItemSelectorCandidate[] = [];
  const sharedId = sharedTestId(parts.testIds);
  if (sharedId) candidates.push({ selector: attributeSelector(sharedId.attribute, sharedId.value), confidence: 1 });
  const shape = sharedTestIdPrefix(parts.testIds);
  if (shape) candidates.push({ selector: attributeSelector(shape.attribute, shape.value, "^"), confidence: 0.9 });
  candidates.push({ selector: `${parts.container} > ${tag}${classSuffix(parts.classes)}`, confidence: 0.75 });
  const role = parts.role?.trim();
  if (role) candidates.push({ selector: `${parts.container} > [role="${quoted(role)}"]`, confidence: 0.6 });
  return candidates;
}

/**
 * The strongest candidate `document.querySelectorAll` answers with exactly the
 * run, or `undefined` when none does. Equality is by element, so a candidate
 * matching a superset -- a table's header row beside its body rows -- is
 * rejected rather than accepted with a row the user never picked.
 */
export function generalizedItemSelector(run: readonly Element[], container: string): ItemSelectorCandidate | undefined {
  const first = run[0];
  if (!first || run.length === 0) return undefined;
  const parts: ItemSelectorParts = {
    container,
    tagName: first.tagName,
    role: first.getAttribute("role") ?? undefined,
    testIds: run.map(testIdOf),
    classes: first.classList
  };
  return itemSelectorCandidates(parts).find((candidate) => selects(candidate.selector, run));
}

/** Whether the selector answers with exactly this run, in the document's order. */
function selects(selector: string, run: readonly Element[]): boolean {
  let matched: Element[];
  try {
    matched = Array.from(document.querySelectorAll(selector));
  } catch {
    // A selector the browser cannot parse names nothing; the next candidate is tried.
    return false;
  }
  return matched.length === run.length && matched.every((element, index) => element === run[index]);
}

/** The test id one element carries, in the order the common tools write one. */
function testIdOf(element: Element): ItemTestId | undefined {
  for (const attribute of ["data-testid", "data-test", "data-cy"]) {
    const value = element.getAttribute(attribute);
    if (value !== null && value !== "") return { attribute, value };
  }
  return undefined;
}

/** The test id every item carries, when they all carry the same one in the same attribute. */
function sharedTestId(testIds: ReadonlyArray<ItemTestId | undefined>): ItemTestId | undefined {
  const first = testIds[0];
  if (!first || testIds.length === 0) return undefined;
  return testIds.every((id) => id?.attribute === first.attribute && id.value === first.value) ? first : undefined;
}

/**
 * The literal prefix a numbered run's test ids share, when every item carries
 * one in the same attribute and the prefix is long enough to name them. A run
 * whose ids differ before their first digit has no shape.
 */
function sharedTestIdPrefix(testIds: ReadonlyArray<ItemTestId | undefined>): ItemTestId | undefined {
  const first = testIds[0];
  if (!first || testIds.length < 2) return undefined;
  if (!testIds.every((id) => id?.attribute === first.attribute)) return undefined;
  let length = first.value.search(/\d/u);
  if (length < MIN_SHAPE_PREFIX) return undefined;
  for (const id of testIds) {
    const value = id?.value ?? "";
    while (length >= MIN_SHAPE_PREFIX && !value.startsWith(first.value.slice(0, length))) length -= 1;
  }
  return length >= MIN_SHAPE_PREFIX ? { attribute: first.attribute, value: first.value.slice(0, length) } : undefined;
}

/** `.a.b` for the classes a structural candidate can name without escaping, capped as the signature caps its own. */
function classSuffix(classes: Iterable<string>): string {
  const named = [...classes].filter((name) => PLAIN_CLASS.test(name)).sort().slice(0, MAX_CANDIDATE_CLASSES);
  return named.map((name) => `.${name}`).join("");
}

function attributeSelector(attribute: string, value: string, operator: "" | "^" = ""): string {
  return `[${attribute}${operator}="${quoted(value)}"]`;
}

/** An attribute value inside double quotes: only a backslash and a quote need escaping. */
function quoted(value: string): string {
  return value.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"');
}
