// Whether a read's items carry a control that opens more of the list and has
// not been opened: "View 3 replies", "Show more replies", "Replies (3)" (t762).
//
// A thread read as it stands holds the items on the page, and the replies under
// each comment are not on it until a person opens them. Photo-social's comment
// thread keeps them out until a control fetches them: a read of the thread, even
// with every batch loaded, held a third of the rows the task counts, and nothing
// in the read said the rest were closed behind controls (t755 "Not done").
//
// What counts: a pressable control inside an item whose whole label opens
// replies -- an opening verb, then an optional count, then "replies" or
// "responses", or the count beside the word ("Replies (3)", "3 replies") -- and
// that the page does not mark expanded. A bare "Reply" is not one, nor is "Hide
// replies": the first answers a comment, the second means they are open already.
// The label is compared and dropped; nothing read leaves the page but the word
// `unopened_replies` (`./list-continues.ts`).
//
// Bounded: at most `ITEM_LIMIT` items and `CONTROLS_PER_ITEM` controls each.

/** The items looked at: a read's run, not a page. */
const ITEM_LIMIT = 400;
/** The controls looked at in one item. */
const CONTROLS_PER_ITEM = 24;
/** A label longer than this is a sentence, not a control. */
const LABEL_MAX = 40;

/** What opens something when pressed, each asked on its own: a stand-in that reads one selector at a time reads them all. */
const PRESSABLE = ["button", '[role="button"]', "summary", "a[href]", "[aria-expanded]"];

const NUMBER = String.raw`\d[\d,.]*[km]?`;
const WORD = String.raw`(?:replies|reply|responses?)`;
/** "View replies (3)", "View 3 replies", "Show all 5 replies", "Load more replies". */
const OPENING = new RegExp(String.raw`^(?:view|show|see|load|open|read|expand)\s+(?:(?:all|more|previous|earlier)\s+)?(?:${NUMBER}\s+)?(?:more\s+)?${WORD}(?:\s*\(${NUMBER}\))?$`, "iu");
/** "Replies (3)", "3 replies". */
const COUNTED = new RegExp(String.raw`^(?:${WORD}\s*\(${NUMBER}\)|${NUMBER}\s+(?:more\s+)?${WORD})$`, "iu");

/** Whether any item of `run` carries an unopened replies control; see the header. */
export function hasUnopenedReplies(run: readonly Element[]): boolean {
  const items = run.slice(0, ITEM_LIMIT);
  return items.some((item) => controlsOf(item).some(opensReplies));
}

/** The pressable controls of an item, at most `CONTROLS_PER_ITEM`; an item that cannot be asked holds none. */
function controlsOf(item: Element): Element[] {
  if (typeof item.querySelectorAll !== "function") return [];
  const controls = new Set<Element>();
  for (const selector of PRESSABLE) {
    for (const control of Array.from(item.querySelectorAll(selector))) {
      controls.add(control);
      if (controls.size >= CONTROLS_PER_ITEM) return Array.from(controls);
    }
  }
  return Array.from(controls);
}

function opensReplies(control: Element): boolean {
  if (control.getAttribute("aria-expanded") === "true") return false;
  if (typeof control.getClientRects === "function" && control.getClientRects().length === 0) return false;
  const label = (control.getAttribute("aria-label") ?? control.textContent ?? "").replace(/\s+/gu, " ").trim();
  return label.length > 0 && label.length <= LABEL_MAX && (OPENING.test(label) || COUNTED.test(label));
}
