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
// **What this keeps.** For each control, every wording its captures showed it in,
// and the wordings its own act left it in, in the same document. A control is its
// address (frame, shadow hosts, selector) with its tag and the stable facts that
// say which control it is -- its id, test id and label -- so two different
// controls that share a position are two entries. Beside them, every destination
// it led to: a link's own path, without its query or fragment.
//
// **When the words are state.** When the control was shown in two or more
// wordings that are not its own act's effect, and it is a link that always led to
// one destination, which does not change with them. Its saved identity then keeps
// the words, marked as a value (`readsWords`, the mark a read's target carries for
// the same reason -- an earlier step may have changed them; `../read-identity.ts`),
// and carries the destination (`href`, a path). The page judges such a target
// without its words and confirms it by what stays: a destination no other visible
// link on the page shares (`apps/extension/src/content/identity/veto.ts`,
// `destination.ts`). Never by one attribute alone where others disagree: the
// words are no longer a claim, and every other recorded signal is still weighed.
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
// Bounded: the newest `CONTROLS_PER_FLOW` controls, `WORDINGS_PER_CONTROL`
// wordings and destinations each.

import type { WebLlmSnapshotBinding } from "../../sanitize";
import type { WebPlanElementIdentity } from "../element-identity";

const CONTROLS_PER_FLOW = 4096;
const WORDINGS_PER_CONTROL = 32;

/** A retained target as this reads it: where it is and who it is, and whether its capture gave its address to several. */
type Placed = { selector: string; frameId: number | undefined; element: WebPlanElementIdentity; shared?: boolean };

/** What a control's words being state changes about its saved identity (header): it carries the destination it always led to. */
export type WebLlmStateWordsMark = { destination: string };

export type WebLlmStateWords = {
  /** Every control `binding` described, as `targets` placed them: the wording each was shown in, and where a link led. */
  captured(binding: WebLlmSnapshotBinding, targets: ReadonlyMap<string, Placed>): void;
  /** An act on `handle` from `before` left `after`: in the same document, the wording it left is the act's, never state (header). */
  acted(handle: string, before: { binding: WebLlmSnapshotBinding; targets: ReadonlyMap<string, Placed> }, after: { binding: WebLlmSnapshotBinding; targets: ReadonlyMap<string, Placed> } | undefined): void;
  /** Whether this control's words were seen to be state, and so how its saved identity is marked; nothing when they say who it is. */
  of(target: Placed): WebLlmStateWordsMark | undefined;
};

type Seen = { wordings: Set<string>; acts: Set<string>; destinations: Set<string> };

export function createWebLlmStateWords(): WebLlmStateWords {
  const controls = new Map<string, Seen>();
  const seenFor = (target: Placed): Seen => {
    const key = controlKey(target);
    const seen = controls.get(key) ?? { wordings: new Set<string>(), acts: new Set<string>(), destinations: new Set<string>() };
    controls.delete(key);
    controls.set(key, seen);
    for (const oldest of controls.keys()) if (controls.size > CONTROLS_PER_FLOW) controls.delete(oldest); else break;
    return seen;
  };
  return {
    captured(binding, targets) {
      const hrefs = new Map(binding.evidence.elements.map((element) => [element.target, element.href]));
      for (const [handle, target] of targets) {
        const wording = wordingOf(target.element);
        if (wording === undefined || target.shared) continue;
        const seen = seenFor(target);
        bounded(seen.wordings, wording);
        bounded(seen.destinations, destinationPath(hrefs.get(handle)) ?? "");
      }
    },
    acted(handle, before, after) {
      const acted = before.targets.get(handle);
      if (acted === undefined || after === undefined || !sameDocument(before.binding, after.binding)) return;
      const left = [...after.targets.values()].find((each) => addressOf(each) === addressOf(acted) && controlKey(each) === controlKey(acted));
      const wording = left === undefined ? undefined : wordingOf(left.element);
      if (left !== undefined && wording !== undefined) bounded(seenFor(left).acts, wording);
    },
    of(target) {
      const seen = controls.get(controlKey(target));
      if (seen === undefined) return undefined;
      const state = [...seen.wordings].filter((wording) => !seen.acts.has(wording));
      if (state.length < 2) return undefined;
      const [only] = seen.destinations;
      return seen.destinations.size === 1 && only !== undefined && only !== "" ? { destination: only } : undefined;
    }
  };
}

/** A control as this tells controls apart (header): its address, its tag, and the facts that do not change with its state. */
function controlKey(target: Placed): string {
  const { tagName, id, testId, label } = target.element;
  return JSON.stringify([addressOf(target), tagName, id, testId, label]);
}

function addressOf(target: Placed): string {
  return JSON.stringify([target.frameId ?? 0, target.element.context?.shadowHosts ?? [], target.selector]);
}

/** The words a control is shown in, as its identity carries them; nothing for a control with none. */
function wordingOf(element: WebPlanElementIdentity): string | undefined {
  const name = element.accessibleName?.replace(/\s+/gu, " ").trim();
  const text = element.visibleText?.replace(/\s+/gu, " ").trim();
  return name || text ? JSON.stringify([name ?? "", text ?? ""]) : undefined;
}

/** A link's own destination: the path of an http(s) address, without its query or fragment (header). */
function destinationPath(href: string | undefined): string | undefined {
  if (href === undefined || !URL.canParse(href)) return undefined;
  const url = new URL(href);
  return url.protocol === "http:" || url.protocol === "https:" ? url.pathname : undefined;
}

/** One document both captures show: the same location, and the same `navigation.timeOrigin` where both say one. */
function sameDocument(left: WebLlmSnapshotBinding, right: WebLlmSnapshotBinding): boolean {
  if (left.evidence.location !== right.evidence.location) return false;
  const before = left.evidence.navigation?.timeOrigin;
  const after = right.evidence.navigation?.timeOrigin;
  return before === undefined || after === undefined || before === after;
}

/** `value` kept in `set`, letting the oldest go past the bound. */
function bounded(set: Set<string>, value: string): void {
  set.delete(value);
  set.add(value);
  for (const oldest of set) if (set.size > WORDINGS_PER_CONTROL) set.delete(oldest); else break;
}
