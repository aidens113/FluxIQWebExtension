// Whether the page's own styles give an element a cursor itself, rather than
// the element inheriting it (lane 4, `run-mvcwf9u2-28bb44fd`).
//
// A computed cursor cannot say where it came from. `./press-cursor.ts` reads
// an element whose parent shows the same pointer as inheriting it, which is
// right for the insides of a pressable `<div>` and wrong for a control drawn
// inside a pressable card: a result card with a pointer of its own holds a
// small icon-only control the page styles with a pointer too, and both compute
// `pointer`. The icon was read as part of the card, carried no cursor, and so
// got no line in the page view: the model was shown its card's title and words
// and nothing it could press.
//
// So when the parent shows the same cursor, the page's style rules are asked:
// the element's inline `style`, and every style rule of its tree (the document
// or its shadow root) that declares this cursor and whose selector matches it.
// A rule whose subject is the universal selector (`.card *`) is passed over:
// it gives every descendant the cursor and says nothing about this one. A
// stylesheet the page loaded from another origin cannot be read and is passed
// over; a `@media` or `@supports` block counts only when it applies now.
//
// The rules are gathered once per tree and per capture: the cache is cleared
// on the next microtask, so a synchronous capture reads each stylesheet once
// and the next capture sees the page's styles as they are then.

type Cursor = "pointer" | "not-allowed";

/** What a style rule of the page looks like to this reader, whichever realm made it. */
type RuleLike = {
  selectorText?: string;
  style?: { cursor?: string };
  cssRules?: ArrayLike<RuleLike>;
  media?: { mediaText?: string };
  conditionText?: string;
  styleSheet?: SheetLike | null;
  constructor?: { name?: string };
};
type SheetLike = { cssRules?: ArrayLike<RuleLike> };
type RootLike = { styleSheets?: ArrayLike<SheetLike>; adoptedStyleSheets?: ArrayLike<SheetLike> };

const declaredSelectors = new Map<unknown, Readonly<Record<Cursor, string | undefined>>>();
let clearScheduled = false;

/** The page's own styles set `cursor` on this element itself: inline, or by a rule whose selector matches it. */
export function declaresCursor(element: Element, cursor: Cursor): boolean {
  const inline = (element as Element & { style?: { cursor?: string } }).style?.cursor;
  if (inline !== undefined && namesCursor(inline, cursor)) return true;
  const selectors = selectorsFor(element.getRootNode() as RootLike)[cursor];
  if (selectors === undefined || typeof element.matches !== "function") return false;
  try {
    return element.matches(selectors);
  } catch {
    return false;
  }
}

function selectorsFor(root: RootLike): Readonly<Record<Cursor, string | undefined>> {
  const known = declaredSelectors.get(root);
  if (known !== undefined) return known;
  const found: Record<Cursor, string[]> = { pointer: [], "not-allowed": [] };
  for (const sheet of [...listOf(root.styleSheets), ...listOf(root.adoptedStyleSheets)]) collectSheet(sheet, found, undefined, 0);
  const joined = { pointer: joinedSelectors(found.pointer), "not-allowed": joinedSelectors(found["not-allowed"]) };
  declaredSelectors.set(root, joined);
  scheduleClear();
  return joined;
}

function scheduleClear(): void {
  if (clearScheduled) return;
  clearScheduled = true;
  const clear = (): void => {
    declaredSelectors.clear();
    clearScheduled = false;
  };
  if (typeof queueMicrotask === "function") queueMicrotask(clear);
  else void Promise.resolve().then(clear);
}

/** A stylesheet's or block's nesting is bounded so an `@import` cycle ends. */
const MAX_DEPTH = 16;

function collectSheet(sheet: SheetLike | null | undefined, found: Record<Cursor, string[]>, parent: string | undefined, depth: number): void {
  if (sheet === null || sheet === undefined || depth > MAX_DEPTH) return;
  let rules: ArrayLike<RuleLike> | undefined;
  try {
    rules = sheet.cssRules;
  } catch {
    return; // A stylesheet from another origin cannot be read.
  }
  for (const rule of listOf(rules)) collectRule(rule, found, parent, depth);
}

function collectRule(rule: RuleLike, found: Record<Cursor, string[]>, parent: string | undefined, depth: number): void {
  if (rule.styleSheet !== undefined) {
    collectSheet(rule.styleSheet, found, parent, depth + 1);
    return;
  }
  if (typeof rule.selectorText === "string") {
    const selector = parent === undefined ? rule.selectorText : nestedSelector(parent, rule.selectorText);
    const cursor = rule.style?.cursor;
    if (cursor !== undefined) {
      for (const name of ["pointer", "not-allowed"] as const) {
        if (namesCursor(cursor, name)) found[name].push(...ownSubjects(selector));
      }
    }
    if (rule.cssRules !== undefined) collectSheet(rule, found, selector, depth + 1);
    return;
  }
  if (rule.cssRules === undefined || !blockApplies(rule)) return;
  collectSheet(rule, found, parent, depth + 1);
}

/** A `@media` block applies when its media query matches now, a `@supports` block when the browser supports its condition; any other block (a layer, a container) is read. */
function blockApplies(rule: RuleLike): boolean {
  const kind = rule.constructor?.name ?? "";
  if (rule.media !== undefined) {
    const query = rule.media.mediaText ?? "";
    if (query.trim() === "" || typeof matchMedia !== "function") return true;
    try {
      return matchMedia(query).matches;
    } catch {
      return true;
    }
  }
  if (kind === "CSSSupportsRule" && typeof rule.conditionText === "string") {
    const supports = (globalThis as { CSS?: { supports?: (condition: string) => boolean } }).CSS?.supports;
    if (typeof supports !== "function") return true;
    try {
      return supports(rule.conditionText);
    } catch {
      return true;
    }
  }
  return true;
}

/** A nested rule's selector made whole: `&` is its parent, and a selector without one is a descendant of it. */
function nestedSelector(parent: string, selector: string): string {
  const scope = `:is(${parent})`;
  return selectorList(selector).map((part) => (part.includes("&") ? part.replaceAll("&", scope) : `${scope} ${part}`)).join(", ");
}

/** The selectors of a list whose subject is not the universal selector, each one the browser accepts. */
function ownSubjects(selector: string): string[] {
  return selectorList(selector).filter((part) => !/^\*(?=$|[:\s])/u.test(lastCompound(part)) && validSelector(part));
}

function validSelector(selector: string): boolean {
  if (typeof document === "undefined" || typeof document.createElement !== "function") return true;
  try {
    document.createElement("div").matches(selector);
    return true;
  } catch {
    return false;
  }
}

/** The declared cursor ends in this keyword: `pointer`, or `url(hand.cur), pointer`. A `var()` may be either. */
function namesCursor(declared: string, cursor: Cursor): boolean {
  const value = declared.trim().toLowerCase();
  if (value.includes("var(")) return true;
  return value.split(",").at(-1)?.trim() === cursor;
}

function joinedSelectors(selectors: readonly string[]): string | undefined {
  return selectors.length === 0 ? undefined : selectors.join(", ");
}

/** The parts of a selector list, split at the commas outside brackets and parentheses. */
function selectorList(selector: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < selector.length; index += 1) {
    const char = selector[index];
    if (char === "(" || char === "[") depth += 1;
    else if (char === ")" || char === "]") depth = Math.max(0, depth - 1);
    else if (char === "," && depth === 0) {
      parts.push(selector.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(selector.slice(start));
  return parts.map((part) => part.trim()).filter((part) => part !== "");
}

/** A selector's subject: the compound after its last combinator outside brackets and parentheses. */
function lastCompound(selector: string): string {
  let depth = 0;
  for (let index = selector.length - 1; index >= 0; index -= 1) {
    const char = selector[index];
    if (char === ")" || char === "]") depth += 1;
    else if (char === "(" || char === "[") depth = Math.max(0, depth - 1);
    else if (depth === 0 && (char === " " || char === ">" || char === "+" || char === "~")) return selector.slice(index + 1).trim();
  }
  return selector.trim();
}

function listOf<T>(list: ArrayLike<T> | undefined | null): T[] {
  return list === undefined || list === null ? [] : Array.from(list);
}
