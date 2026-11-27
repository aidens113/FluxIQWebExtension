// The words a control shows as state, as one Flow's build has seen them (t1071, F1).
//
// **The defect.** Live run `run-mwyfc9uf-215bbd84` (bigbox, later attempts): the
// header's cart link is one link whose words are the cart -- an icon, a count
// and a total, "🛒 1 $3.97". Attempt 1 saved its click by those words, the next
// attempt met "🛒 2 $5.25" on the same link, and playback refused it four times
// (`web.target.not_found`): the page's veto acts only when something that says
// which control this is agrees exactly, and the words were the only such thing
// the step carried. The build had seen the words change -- "1 $3.97" on the search
// page, "2 $5.25" on the cart page -- and saved them as identity anyway.
//
// **What this keeps.** For each link, every wording its captures showed it in,
// and the wordings its own act left it in, in the same document. A link is what
// stays the same about it (t1079): its frame and shadow hosts, its tag, the facts
// that say which control it is -- id, test id, label, class names -- the region it sits in
// (its landmark and dialog), and the whole address it leads to within its site,
// its path and query without its fragment. Never its selector. Beside them, per
// address (frame, shadow hosts, selector), which links captures showed there, so
// a step saved by its address finds the link it named.
//
// **When the words are state.** When the link was shown in two or more wordings
// that are not its own act's effect. Its address cannot have changed with them:
// it is part of what the link is. Its saved identity then keeps
// the words, marked as a value (`readsWords`, the mark a read's target carries for
// the same reason -- an earlier step may have changed them; `../read-identity.ts`),
// and carries the destination (`href`, a root path with its query). The page judges such a target
// without its words and confirms it by what stays: a destination no other visible
// link in its region shares (`apps/extension/src/content/identity/veto.ts`,
// `destination/`). Never by one attribute alone where others disagree: the
// words are no longer a claim, and every other recorded signal is still weighed.
//
// **Why not the selector (t1079).** Two runs, one cause: a position names a place
// on one page, not a control.
// - Live run `run-mwytbimp-e0c33977` (bigbox): a results page's pagination slot
//   `nav > a:nth-of-type(2)` was the link "2" (`...&page=2`) on page 1 and, behind
//   a "Previous page" arrow that shifted the slot, the link "1" (no `page`) on
//   page 2. Keyed by the slot and read by its path alone, the two links were taken
//   for one whose words changed; the mark stripped the words "2" and the `page=2`
//   query, the very things that said which link it was, and the replay tied with
//   sixteen candidates. Words and address that change together are two links.
// - Provider-free run `run-mwyueo09-ea0204c3` (bigbox, scripted): the header's
//   cart link is `body > div:nth-of-type(1) > header > ...` on a results page,
//   where a support chat `div` follows the page, and `body > div > header > ...`
//   on the cart page, where it does not. "1 $3.97" and "2 $5.25" were kept under
//   two selectors, one wording each, so the click attempt 1 saved was never
//   marked and every later attempt refused it as `web.target.not_found`.
// A link one capture showed twice by these facts -- two links to one place in
// one region, alike in every stable fact -- names no one link, and its words are
// never state. The class names are what keep the header's `href="#"` links apart
// from its cart link on the cart page: the evidence spells an empty fragment as
// the page's own address (`../../location.ts`), so there "Sign In" reads as a
// second link to the cart, and only its class says it is another link. A class
// that toggles with the state splits one link in two, which leaves it unmarked
// as before: the failure is never a wrong mark.
//
// **Why only a destination.** An id, test id or label is often the template's,
// not the control's: every product card's title link can carry
// `data-testid="product-link"`, unique on each product page and saying a
// different product on each. Their words are who they are, and their destinations
// differ, so they are never read as one control whose words changed. A selector
// the capture gave to several elements names no one control and counts for none.
//
// **What it is not.** A control whose own act changed its words -- "Get coupons"
// that became "Collected", "Follow" that became "Following" -- keeps them as
// identity, and what the act made true is the step's effect (t442 F1, t447): the
// wording an act left in its own document is never counted as state, in this
// attempt or a later one. A control with nothing stable beside its words is not
// marked either: its words are all that say which control it is, so they stay a
// veto. Nothing here is particular to a cart, a site or a scenario.
//
// Bounded: the newest `CONTROLS_PER_FLOW` links, addresses and repeated links,
// and `WORDINGS_PER_CONTROL` wordings each.

import type { WebLlmSnapshotBinding } from "../../sanitize";
import type { WebPlanElementIdentity } from "../element-identity";

const CONTROLS_PER_FLOW = 4096;
const WORDINGS_PER_CONTROL = 32;

/** A retained target as this reads it: where it is and who it is, and whether its capture gave its address to several. */
type Placed = { selector: string; frameId: number | undefined; element: WebPlanElementIdentity; shared?: boolean };

/** What a control's words being state changes about its saved identity (header): it carries the address it always led to, path and query. */
export type WebLlmStateWordsMark = { destination: string };

export type WebLlmStateWords = {
  /** Every control `binding` described, as `targets` placed them: the wording each was shown in, and where a link led. */
  captured(binding: WebLlmSnapshotBinding, targets: ReadonlyMap<string, Placed>): void;
  /** An act on `handle` from `before` left `after`: in the same document, the wording it left is the act's, never state (header). */
  acted(handle: string, before: { binding: WebLlmSnapshotBinding; targets: ReadonlyMap<string, Placed> }, after: { binding: WebLlmSnapshotBinding; targets: ReadonlyMap<string, Placed> } | undefined): void;
  /** Whether this control's words were seen to be state, and so how its saved identity is marked; nothing when they say who it is. */
  of(target: Placed): WebLlmStateWordsMark | undefined;
};

type Seen = { destination: string; wordings: Set<string>; acts: Set<string> };

export function createWebLlmStateWords(): WebLlmStateWords {
  const controls = new Map<string, Seen>();
  /** Per address (frame, shadow hosts, selector), the controls captures showed there: a place, never an identity (header). */
  const places = new Map<string, Set<string>>();
  /** Controls one capture showed more than once: their stable facts name no one link, so their words are never state (header). */
  const several = new Set<string>();
  const seenFor = (key: string, destination: string): Seen => {
    const seen = controls.get(key) ?? { destination, wordings: new Set<string>(), acts: new Set<string>() };
    return newest(controls, key, seen);
  };
  return {
    captured(binding, targets) {
      const hrefs = hrefsOf(binding);
      // A link not rendered (a capture asked to include hidden elements) is shown in no wording and is no one's rival.
      const hidden = new Set(binding.evidence.elements.flatMap((element) => element.hidden === true ? [element.target] : []));
      const shown: { key: string; destination: string; wording: string; address: string }[] = [];
      for (const [handle, target] of targets) {
        const wording = wordingOf(target.element);
        const destination = destinationAddress(hrefs.get(handle));
        if (wording === undefined || destination === undefined || target.shared || hidden.has(handle)) continue;
        shown.push({ key: controlKey(target, destination), destination, wording, address: addressOf(target) });
      }
      const counts = new Map<string, number>();
      for (const { key } of shown) counts.set(key, (counts.get(key) ?? 0) + 1);
      for (const { key, destination, wording, address } of shown) {
        if ((counts.get(key) ?? 0) > 1) newest(several, key);
        if (several.has(key)) continue;
        bounded(seenFor(key, destination).wordings, wording);
        bounded(newest(places, address, places.get(address) ?? new Set<string>()), key);
      }
    },
    acted(handle, before, after) {
      const acted = before.targets.get(handle);
      if (acted === undefined || after === undefined || !sameDocument(before.binding, after.binding)) return;
      const hrefs = hrefsOf(after.binding);
      for (const [leftHandle, left] of after.targets) {
        const destination = destinationAddress(hrefs.get(leftHandle));
        const wording = wordingOf(left.element);
        if (addressOf(left) !== addressOf(acted) || factsOf(left) !== factsOf(acted) || destination === undefined || wording === undefined) continue;
        bounded(seenFor(controlKey(left, destination), destination).acts, wording);
      }
    },
    of(target) {
      // The controls captures showed at this target's address and with its stable facts, narrowed to the one its own words were shown on.
      const facts = factsOf(target);
      const keys = [...places.get(addressOf(target)) ?? []].filter((key) => !several.has(key) && key.startsWith(`${facts.slice(0, -1)},`));
      const words = wordsOf(target.element);
      const own = keys.filter((key) => [...controls.get(key)?.wordings ?? []].some((wording) => wordsOf(JSON.parse(wording) as Worded).some((each) => words.includes(each))));
      const [key, other] = own.length > 0 ? own : keys;
      const seen = key === undefined || other !== undefined ? undefined : controls.get(key);
      if (seen === undefined) return undefined;
      const state = [...seen.wordings].filter((wording) => !seen.acts.has(wording));
      return state.length >= 2 ? { destination: seen.destination } : undefined;
    }
  };
}

/**
 * A link as this tells links apart (header): its frame and shadow hosts, its tag, the facts that do not change with
 * its state -- id, test id, label, class names -- the region it sits in (its landmark and dialog), and the whole address
 * it leads to. Never its selector: a position names a place on one page, and the same link takes another one on the next.
 */
function controlKey(target: Placed, destination: string): string {
  return `${factsOf(target).slice(0, -1)},${JSON.stringify(destination)}]`;
}

/** The part of `controlKey` a target's own identity carries, as a JSON array (header). */
function factsOf(target: Placed): string {
  const { tagName, id, testId, label, classNames, context } = target.element;
  const classes = [...classNames ?? []].sort();
  return JSON.stringify([target.frameId ?? 0, context?.shadowHosts ?? [], tagName ?? "", id ?? "", testId ?? "", label ?? "", classes, context?.landmark ?? "", context?.dialog ?? ""]);
}

function addressOf(target: Placed): string {
  return JSON.stringify([target.frameId ?? 0, target.element.context?.shadowHosts ?? [], target.selector]);
}

function hrefsOf(binding: WebLlmSnapshotBinding): Map<string, string | undefined> {
  return new Map(binding.evidence.elements.map((element) => [element.target, element.href]));
}

type Worded = { accessibleName?: string | undefined; visibleText?: string | undefined } | readonly string[];

/** The words, each one, an identity or a kept wording shows: its name and its text, spacing collapsed. */
function wordsOf(worded: Worded): string[] {
  const [name, text] = Array.isArray(worded) ? worded as readonly string[] : [(worded as { accessibleName?: string }).accessibleName, (worded as { visibleText?: string }).visibleText];
  return [name, text].map((each) => each?.replace(/\s+/gu, " ").trim()).filter((each): each is string => Boolean(each));
}

/** The words a control is shown in, as its identity carries them; nothing for a control with none. */
function wordingOf(element: WebPlanElementIdentity): string | undefined {
  const name = element.accessibleName?.replace(/\s+/gu, " ").trim();
  const text = element.visibleText?.replace(/\s+/gu, " ").trim();
  return name || text ? JSON.stringify([name ?? "", text ?? ""]) : undefined;
}

/** A link's own destination: an http(s) address within its site, its path and its query, without its fragment (header, t1079 F1). */
function destinationAddress(href: string | undefined): string | undefined {
  if (href === undefined || !URL.canParse(href)) return undefined;
  const url = new URL(href);
  return url.protocol === "http:" || url.protocol === "https:" ? `${url.pathname}${url.search}` : undefined;
}

/** One document both captures show: the same location, and the same `navigation.timeOrigin` where both say one. */
function sameDocument(left: WebLlmSnapshotBinding, right: WebLlmSnapshotBinding): boolean {
  if (left.evidence.location !== right.evidence.location) return false;
  const before = left.evidence.navigation?.timeOrigin;
  const after = right.evidence.navigation?.timeOrigin;
  return before === undefined || after === undefined || before === after;
}

/** `key` made the newest entry of `kept`, letting the oldest go past `CONTROLS_PER_FLOW`; for a map, holding `value`. */
function newest<T>(kept: Map<string, T>, key: string, value: T): T;
function newest(kept: Set<string>, key: string): void;
function newest<T>(kept: Map<string, T> | Set<string>, key: string, value?: T): T | void {
  kept.delete(key);
  if (kept instanceof Map) kept.set(key, value as T); else kept.add(key);
  for (const oldest of kept.keys()) if (kept.size > CONTROLS_PER_FLOW) kept.delete(oldest); else break;
  return value;
}

/** `value` kept in `set`, letting the oldest go past the bound. */
function bounded(set: Set<string>, value: string): void {
  set.delete(value);
  set.add(value);
  for (const oldest of set) if (set.size > WORDINGS_PER_CONTROL) set.delete(oldest); else break;
}
