// The hover state a pointer resting on an element gives the page's stylesheets (t903, F5).
//
// A menu drawn by a stylesheet's `:hover` rule opens only while the browser
// itself says the pointer is over its control, and no event a script dispatches
// can say so: synthetic events never set `:hover`. The debugger's input API
// could, and is not used (standing rule). So the hover verb (`../../actions/hover.ts`)
// applies the hover state itself, for exactly the elements a resting pointer
// would put in it -- the hovered element and every ancestor in its document:
// each same-origin rule whose selector holds `:hover` gets a copy beside it, in
// the same sheet and at the next index so the cascade keeps its order, with
// `:hover` replaced by `:is(<a path naming each element of that chain>)`. The
// copy matches only what the original would have matched with the pointer
// there, and nothing else, so no other style changes.
//
// It is temporary. The copies are removed when the pointer leaves -- any
// `pointerover` outside the hovered element, whether a later action's gesture or
// a person's own mouse -- when the next action that acts begins
// (`releaseFor`, read by `../execute-action.ts`), when another element is
// hovered, and when the document goes. A look or a read does not end it: a
// person reads an open menu without moving the mouse. A stylesheet another
// origin served cannot be read (`cssRules` throws) and is skipped, as is a
// stylesheet inside a shadow root.

/** `:hover` as a pseudo-class, not the start of a longer name. */
const HOVER = /:hover(?![\w-])/gu;

/** The actions that only look or read, which leave a hover in place (header). */
const READS: ReadonlySet<string> = new Set([
  "web.dom.capture_snapshot",
  "web.dom.extract",
  "web.dom.extract_list",
  "web.dom.wait_for_selector",
  "web.dom.wait_for_text",
  "web.dom.assert"
]);

type Inserted = { parent: CSSStyleSheet | CSSGroupingRule; rule: CSSRule };

type HoverState = {
  /** Applies the hover state of `element`'s chain, replacing any other; how many rules were copied. */
  point(element: Element): number;
  /** Removes every copy, if any. */
  release(): void;
  /** Ends the hover unless `actionType` only looks or reads (header). */
  releaseFor(actionType: string): void;
  /** The element the hover rests on, while it does. */
  hovered(): Element | undefined;
};

let hoveredElement: Element | undefined;
let inserted: Inserted[] = [];
let listening: Document | undefined;

export const hoverState: HoverState = {
  point(element) {
    release();
    const doc = element.ownerDocument;
    const paths = chainPaths(element);
    if (paths.length === 0) return 0;
    const chain = `:is(${paths.join(", ")})`;
    for (const sheet of Array.from(doc.styleSheets)) copyHoverRules(sheet, chain);
    hoveredElement = element;
    listen(doc);
    return inserted.length;
  },
  release,
  releaseFor(actionType) {
    if (!READS.has(actionType)) release();
  },
  hovered: () => hoveredElement
};

function release(): void {
  // A copy the page already removed, with its sheet or by rewriting it, is not found and needs nothing.
  for (const { parent, rule } of inserted.reverse()) {
    const index = Array.prototype.indexOf.call(parent.cssRules, rule);
    if (index >= 0) parent.deleteRule(index);
  }
  inserted = [];
  hoveredElement = undefined;
}

/** Each rule under `parent` that holds `:hover` copied beside itself for the chain; grouping rules are walked into. */
function copyHoverRules(parent: CSSStyleSheet | CSSGroupingRule, chain: string): void {
  let rules: CSSRuleList;
  try {
    rules = parent.cssRules;
  } catch {
    return; // Another origin's sheet (header).
  }
  // Backwards, so a copy inserted after a rule never shifts one not yet visited.
  for (let index = rules.length - 1; index >= 0; index -= 1) {
    const rule = rules[index]!;
    const selector = (rule as Partial<CSSStyleRule>).selectorText;
    if (typeof selector === "string") {
      HOVER.lastIndex = 0;
      if (!HOVER.test(selector)) continue;
      const copy = `${selector.replace(HOVER, chain)}{${(rule as CSSStyleRule).style.cssText}}`;
      try {
        parent.insertRule(copy, index + 1);
      } catch (error) {
        // A selector this browser cannot parse as a copy is left as the page wrote it; anything else is a fault.
        if ((error as { name?: unknown }).name === "SyntaxError") continue;
        throw error;
      }
      inserted.push({ parent, rule: parent.cssRules[index + 1]! });
      continue;
    }
    const group = rule as Partial<CSSGroupingRule>;
    if (group.cssRules !== undefined && typeof group.insertRule === "function") copyHoverRules(rule as CSSGroupingRule, chain);
  }
}

/** A path from the root naming each element of `element`'s chain in its own document: itself and every ancestor. */
function chainPaths(element: Element): string[] {
  const doc = element.ownerDocument;
  if (element.getRootNode() !== doc) return [];
  const paths: string[] = [];
  for (let current: Element | null = element; current !== null && current !== doc.documentElement; current = current.parentElement) {
    paths.push(pathOf(current, doc));
  }
  return paths;
}

function pathOf(element: Element, doc: Document): string {
  const steps: string[] = [];
  for (let current: Element = element; current !== doc.documentElement; current = current.parentElement!) {
    const parent = current.parentElement!;
    steps.unshift(`:nth-child(${Array.prototype.indexOf.call(parent.children, current) + 1})`);
  }
  return `:root > ${steps.join(" > ")}`;
}

/** Ends the hover when the pointer goes over anything outside the hovered element, or the document goes (header). */
function listen(doc: Document): void {
  if (listening === doc) return;
  listening = doc;
  doc.addEventListener("pointerover", (event) => {
    const over = event.target;
    if (hoveredElement === undefined || !(over instanceof Node) || hoveredElement.contains(over)) return;
    release();
  }, { capture: true });
  doc.defaultView?.addEventListener("pagehide", () => release());
}
