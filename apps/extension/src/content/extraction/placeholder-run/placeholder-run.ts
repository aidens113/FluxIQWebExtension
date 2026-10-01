// A list the page has not filled in yet: the skeleton cards a results page
// draws first and replaces with results a moment later (t194 G3).
//
// A skeleton is an element with nothing in it -- no element, no word -- drawn
// in a run of siblings of one tag and one class list. Three or more of them
// under one parent is a list still being drawn. A structure detection that
// answers while one is on the page has answered with whatever else the page
// holds: on the Spain hubs' results the grid is nineteen empty `div.skeleton`
// for 600 ms after load, and the largest readable run until then is the
// sidebar's five filter groups (`../detect-structure.ts` waits instead).
//
// Placeholders inside the detected items, or beside them under the items' own
// parent, are not another list: a card's empty rating stars are the card's,
// and a grid whose first ten cards are drawn and whose last nine are still
// skeletons is the detected list filling in.
//
// Only structure is read here -- tags, class names and whether an element is
// empty -- never a word of the page (decision D3).

/** The tags a skeleton card is drawn with. A `span` is left out: an empty one is an icon far more often than a card. */
const PLACEHOLDER_TAGS: ReadonlySet<string> = new Set(["DIV", "LI", "SECTION", "ARTICLE"]);

/** The fewest sibling placeholders that are a list being drawn rather than a spacer or two. */
const MIN_PLACEHOLDER_RUN = 3;

/**
 * The size of the largest run of sibling placeholders under `root` that sits
 * neither inside one of `items` nor beside them under one of their parents, or
 * 0 when there is none. See the header.
 */
export function largestPlaceholderRunApartFrom(items: readonly Element[], root: Element): number {
  const itemSet = new Set(items);
  const itemParents = new Set<Element | null>(items.map((item) => item.parentElement));
  let largest = 0;
  for (const parent of [root, ...Array.from(root.querySelectorAll("*"))]) {
    if (itemParents.has(parent) || withinAny(parent, itemSet)) continue;
    const runs = new Map<string, number>();
    for (const child of Array.from(parent.children)) {
      if (!isPlaceholder(child)) continue;
      const template = `${child.tagName}.${[...child.classList].sort().join(".")}`;
      runs.set(template, (runs.get(template) ?? 0) + 1);
    }
    for (const size of runs.values()) if (size >= MIN_PLACEHOLDER_RUN && size > largest) largest = size;
  }
  return largest;
}

/** Whether the element is one of `items` or sits inside one. */
function withinAny(element: Element, items: ReadonlySet<Element>): boolean {
  for (let current: Element | null = element; current; current = current.parentElement) if (items.has(current)) return true;
  return false;
}

function isPlaceholder(element: Element): boolean {
  return PLACEHOLDER_TAGS.has(element.tagName) && element.children.length === 0 && (element.textContent ?? "").trim() === "";
}
