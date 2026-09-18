// One example per repeating control.
//
// ## The defect this closes
//
// The snapshot is a ranked list, and what reads it reads its head: the LLM
// evidence packet describes at most forty elements and a few thousand bytes of
// them. On a page built from a repeated template the head was the template.
// Measured on the Scenario Lab's social scheduler, a 280-row publishing queue,
// with the real content script in headless Chromium (2026-09-17): at rest the
// packet held the three filter selects and thirty-seven row checkboxes -- one
// per row, each named for its time slot -- and not one of the page's own
// buttons. After "Select all posts" the bulk bar's Retry button was on the page
// and still not in the packet. A job whose action is a button on a page with
// many rows -- retry, reply, dispatch, resolve, escalate -- could not be
// authored, because the model had no handle for the button.
//
// Two hundred and eighty row checkboxes are one kind of thing. The model needs
// to know the kind exists, what one looks like and how many there are, not to
// be shown every one. So each run keeps one member, the exemplar, ranked where
// it would have been and carrying the run's size; every other member is ranked
// after every distinct element on the page. Nothing is removed: a budget that
// reaches past the distinct elements still reaches the rest of the run, in its
// old order, so on a narrowed page a particular row's control is still listed
// and can still be named.
//
// ## What "repeating" means, from what the pages hold
//
// - **A run** is a record -- by `identity/record.ts`'s rule, the one a replay
//   already checks: `tr`, `li`, `article`, the ARIA row, list item, option,
//   tree item and article roles, or anything carrying a per-instance key such
//   as `data-post-id` -- whose parent holds at least `MIN_RUN` records of its
//   tag. Every many-row Lab page is built that way: the scheduler's posts, the
//   inbox's conversations, the desk's tickets, the operations orders and the
//   directory's members are keyed `tr`s, and the catalogue's products keyed
//   `li`s. The nearest record that is in a run counts, so a card's `article`
//   inside its keyed `li` is walked past to the `li`.
// - **A kind** is one position in that record: the tag and same-tag index at
//   every level from the record down to the element, with its role and input
//   type. The scheduler's row checkbox is `td 1 > input[checkbox]` in each of
//   280 rows, its "Post actions" button `td 6 > button`, its post link
//   `td 2 > a`. Names are deliberately not part of it. A row checkbox is named
//   for its row ("Select the post for Mon 21 Sep 2026, 09:00"), so a name
//   pattern would have to be guessed per page, while the position is exactly
//   what the template repeats.
// - **Not a kind**: something to act on that is its record's whole content,
//   such as the sidebar's `li > a` navigation links or a menu's `li > button`.
//   Each of those is a distinct destination named by its own words, and
//   folding "Drafts" into "Queue" would hide a place the model may need to go.
//   The same goes for a record that is itself something to act on -- an
//   option, a clickable row -- which is its own choice rather than a copy of
//   another. A passive wrapper is not exempt: the catalogue's `article`, which
//   is all its keyed `li` holds, is one card of eight like any other.
//
// An element the user or an action just touched keeps its place whatever run
// it is in. The snapshot passes those in: what the recorder saw an event reach,
// and what the runtime interaction ledger (`evidence/interactions.ts`) saw any
// click or input reach, recording or not. Checking row five's box and looking
// again must show row five's box, not only row one's. "Touched" is deliberately
// not `isEventBackedElement`, which also counts every element carrying an
// `onclick` -- on a page that writes one on every row's button, that would
// exempt the whole column this module exists to fold.
//
// ## Handles
//
// This decides which elements are ranked early, never what an element is
// called or how it is addressed. An exemplar is a real element with its own
// selector, and the domain's stable handles key on that selector and on the
// record it sits in (`domain/src/runtime/llm-evidence/stable-handles.ts`), so a
// handle issued for one row's control is never given to another row's.
//
// Every lookup is bounded: a record is looked for at most `MAX_RECORD_DEPTH`
// levels up, as `identity/record.ts` bounds its own walk, and each record's
// siblings and text are read once per capture.

import { isInteractableUiElement } from "./element-traits";
import { isRecordElement } from "./identity";

/** Records a parent must hold to be a run rather than a coincidence, as `evidence/repeating.ts` counts one. */
const MIN_RUN = 3;
/** How far above an element its record may be, as in `identity/record.ts`. */
const MAX_RECORD_DEPTH = 12;
/** Separates the parts of a kind; page markup cannot put it in a tag or a type. */
const KIND_SEPARATOR = String.fromCharCode(31);

export type RepeatExemplars = {
  /** Each run's exemplar, with how many elements the run holds, the exemplar included. Only runs of two or more. */
  counts: ReadonlyMap<Element, number>;
  /** Every other member of a run, which the snapshot ranks after every element that is not one. */
  followers: ReadonlySet<Element>;
};

/**
 * The runs among `elements`, which are the snapshot's included elements in the
 * order they were gathered. That order is document order within each kind --
 * every member of a kind shares its tag, so one sweep found them all -- with
 * the elements a recorded event reached gathered first, which makes the
 * exemplar the first row's unless a recording touched another. A member in
 * `touched` is never a follower, whichever member is the exemplar.
 */
export function repeatExemplars(elements: readonly Element[], touched: ReadonlySet<Element>): RepeatExemplars {
  const reader = createRunReader();
  const runs = new Map<string, Element[]>();
  for (const element of elements) {
    const kind = reader.kindOf(element);
    if (kind === undefined) continue;
    const run = runs.get(kind);
    if (run) run.push(element);
    else runs.set(kind, [element]);
  }

  const counts = new Map<Element, number>();
  const followers = new Set<Element>();
  for (const [exemplar, ...rest] of runs.values()) {
    if (!exemplar || rest.length === 0) continue;
    counts.set(exemplar, rest.length + 1);
    for (const member of rest) {
      if (!touched.has(member)) followers.add(member);
    }
  }
  return { counts, followers };
}

type RunReader = { kindOf(element: Element): string | undefined };

/** One capture's reader: the memos live as long as the capture does. */
function createRunReader(): RunReader {
  const tagCounts = new Map<Element, Map<string, number>>();
  const containerIds = new Map<Element, number>();
  const recordTexts = new Map<Element, string>();

  const inRun = (record: Element): boolean => {
    const parent = record.parentElement;
    if (!parent) return false;
    let counts = tagCounts.get(parent);
    if (!counts) {
      counts = new Map<string, number>();
      for (const child of parent.children) counts.set(tagOf(child), (counts.get(tagOf(child)) ?? 0) + 1);
      tagCounts.set(parent, counts);
    }
    return (counts.get(tagOf(record)) ?? 0) >= MIN_RUN;
  };

  const recordText = (record: Element): string => {
    let text = recordTexts.get(record);
    if (text === undefined) {
      text = collapsedText(record);
      recordTexts.set(record, text);
    }
    return text;
  };

  const containerId = (container: Element): number => {
    let id = containerIds.get(container);
    if (id === undefined) {
      id = containerIds.size + 1;
      containerIds.set(container, id);
    }
    return id;
  };

  return {
    kindOf(element) {
      const record = runRecord(element, inRun);
      const container = record?.parentElement;
      if (!record || !container) return undefined;
      if (record === element) {
        if (isInteractableUiElement(element)) return undefined;
      } else if (collapsedText(element) === recordText(record) && isInteractableUiElement(element)) {
        return undefined;
      }
      const position = positionWithin(record, element);
      if (position === undefined) return undefined;
      const role = element.getAttribute("role") ?? "";
      const inputType = element instanceof HTMLInputElement ? element.type.toLowerCase() : "";
      return [containerId(container), tagOf(record), position, role, inputType].join(KIND_SEPARATOR);
    }
  };
}

/** The nearest record at or above the element that is one of a run. */
function runRecord(element: Element, inRun: (record: Element) => boolean): Element | undefined {
  let current: Element | null = element;
  for (let depth = 0; current && depth < MAX_RECORD_DEPTH; depth += 1) {
    if (isRecordElement(current) && inRun(current)) return current;
    current = current.parentElement;
  }
  return undefined;
}

/** The element's place inside its record: each level's tag and same-tag index, record first. Empty for the record itself. */
function positionWithin(record: Element, element: Element): string | undefined {
  const steps: string[] = [];
  let current: Element | null = element;
  while (current && current !== record) {
    steps.push(`${tagOf(current)}${sameTagIndex(current)}`);
    current = current.parentElement;
  }
  return current === record ? steps.reverse().join(">") : undefined;
}

/** One-based, among the siblings that share the element's tag, as `:nth-of-type` counts. */
function sameTagIndex(element: Element): number {
  const tag = tagOf(element);
  let index = 1;
  for (let sibling = element.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
    if (tagOf(sibling) === tag) index += 1;
  }
  return index;
}

/**
 * The element's words with whitespace collapsed, used only to compare an
 * element with its record and never sent anywhere, so no sensitivity filter
 * applies: nothing read here leaves the page.
 */
function collapsedText(element: Element): string {
  return (element.textContent ?? "").replace(/\s+/gu, " ").trim();
}

function tagOf(element: Element): string {
  return element.tagName.toLowerCase();
}
