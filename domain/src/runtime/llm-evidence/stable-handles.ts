// A target handle keeps naming the control it named, for as long as one Flow
// is being authored on one page.
//
// The sanitizer numbers a packet's elements positionally --
// `target.${index + 1}` -- because it sees one snapshot and has no memory. That
// was fine while the model only read. It stopped being fine the moment a Flow
// could act: a handle the model read out of one packet is written into a plan
// that is resolved against the *newest* packet for that page
// (`plan-resolution/target-packets.ts`), and an ordinary recapture -- what
// `web.press_control` does on success, and what a second inspect does -- renumbers
// everything after any element that appeared or disappeared.
//
// Measured, not supposed. With the page `[banner, beds, band, search]`,
// `target.2` resolved to the Bedrooms select. The banner was then dismissed and
// the page recaptured, and the same `target.2` resolved to the Price-band
// select, with no refusal and nothing to tell the model or the resolver that
// anything had moved. Live, a created Flow chose `target.2` for its first
// filter and the run failed with `expected a select element to choose value "5"
// in, actual the target is a <button>` (`run-mu6btt9u-8ba762fd`).
//
// Two other readers already defended themselves against exactly this and said
// so in their own words -- `press.ts`'s `currentElementForReturnedTarget` and
// the detection tool's `boundTarget` both bind a handle through the selector
// recorded when it was issued. The plan resolver could not, because by then the
// packet that issued the handle is gone. So the fix belongs where the handle is
// minted: the same control keeps the same number across every capture of that
// page, and a number, once given, is never given to another control.
//
// What this is not. It does not make a handle mean anything across pages, or
// across Flows: the store below is keyed by project, Flow and location, exactly
// as the packet store is. And it never invents a handle for something the
// capture did not describe; it only chooses the number an element already
// described is given.

import type { WebLlmPageEvidence, WebLlmSnapshotBinding } from "./sanitize";

/** The handle numbers a page may issue, as `plan-resolution/handle-tokens.ts` matches them: `target.1` to `target.99`. */
const MAX_HANDLE_NUMBER = 99;
/** Pages remembered per Flow, and Flows remembered, as the packet store bounds them. */
const RETAINED_PAGES_PER_FLOW = 8;
const RETAINED_FLOWS = 32;

export type WebLlmStableHandleScope = { projectId: string; flowId: string };

export type WebLlmStableTargetHandles = {
  /**
   * The same binding with each element's handle chosen so it keeps naming the
   * control it named on this page. The binding passed in is not changed.
   */
  restamp(scope: WebLlmStableHandleScope, binding: WebLlmSnapshotBinding): WebLlmSnapshotBinding;
};

/** One page's assignments: which control has which number, and every number this page has spent. */
type PageHandles = { byAddress: Map<string, number>; spent: Set<number> };

export function createWebLlmStableTargetHandles(): WebLlmStableTargetHandles {
  const flows = new Map<string, Map<string, PageHandles>>();
  return {
    restamp(scope, binding) {
      const flowKey = `${scope.projectId}\0${scope.flowId}`;
      const pages = flows.get(flowKey) ?? new Map<string, PageHandles>();
      flows.delete(flowKey);
      flows.set(flowKey, pages);
      for (const oldest of flows.keys()) {
        if (flows.size <= RETAINED_FLOWS) break;
        flows.delete(oldest);
      }
      const location = binding.evidence.location;
      let page = pages.get(location) ?? { byAddress: new Map<string, number>(), spent: new Set<number>() };
      pages.delete(location);
      pages.set(location, page);
      for (const oldest of pages.keys()) {
        if (pages.size <= RETAINED_PAGES_PER_FLOW) break;
        pages.delete(oldest);
      }

      const addresses = addressesOf(binding);
      // A page with more distinct controls over its lifetime than there are
      // numbers starts again rather than handing one control's number to
      // another. That restores the positional behaviour for this page, which is
      // what it had before this module, and never silently reuses a number.
      if (page.spent.size + addresses.filter((address) => !page.byAddress.has(address)).length > MAX_HANDLE_NUMBER) {
        page = { byAddress: new Map<string, number>(), spent: new Set<number>() };
        pages.set(location, page);
      }

      const assigned: string[] = [];
      const takenHere = new Set<number>();
      for (const address of addresses) {
        const known = page.byAddress.get(address);
        const number = known !== undefined && !takenHere.has(known) ? known : nextNumber(page.spent, takenHere);
        if (number === undefined) {
          // Nothing free: keep the positional number, which is what this
          // element would have had anyway, rather than dropping it.
          assigned.push(`target.${assigned.length + 1}`);
          continue;
        }
        page.byAddress.set(address, number);
        page.spent.add(number);
        takenHere.add(number);
        assigned.push(`target.${number}`);
      }
      return rewrite(binding, assigned);
    }
  };
}

/**
 * Each described element's address on its page: the frame and selector that
 * name it, the record it sits in, and which occurrence it is where a page gave
 * one selector to several elements. A shared selector is refused at resolution
 * (`plan-resolution/target-packets.ts`), so the occurrence exists to keep two
 * such elements from claiming one number, not to make either resolvable.
 *
 * The record is there because a row control's selector is positional. On the
 * social scheduler the first row's checkbox is
 * `[data-testid="queue-rows"] > tr:nth-of-type(1) > td:nth-of-type(1) > input`
 * whichever post is in row one, and filtering the queue changes which post
 * that is. Keyed by the selector alone, the checkbox the model was shown for
 * "Mon 21 Sep 2026, 09:00" kept its number after a filter and named
 * "Mon 21 Sep 2026, 06:00" instead -- a handle meaning two controls in two
 * captures, which this module exists to prevent. It mattered more once the
 * snapshot began showing one row per repeated control
 * (`apps/extension/src/content/repeat-exemplars.ts`), because that row is the
 * first one, whose post is the one a filter replaces. With the record beside
 * the selector, another post in the same row is another address, so it gets a
 * number of its own and the old number is left to resolve to nothing.
 */
function addressesOf(binding: WebLlmSnapshotBinding): string[] {
  const seen = new Map<string, number>();
  return binding.evidence.elements.map((element) => {
    const selector = binding.selectors.get(element.target) ?? "";
    const record = binding.records.get(element.target) ?? "";
    const base = `${element.frameId ?? 0}\0${selector}\0${record}`;
    const occurrence = seen.get(base) ?? 0;
    seen.set(base, occurrence + 1);
    return `${base}\0${occurrence}`;
  });
}

/** The lowest number this page has never spent, or `undefined` when it has spent them all. */
function nextNumber(spent: ReadonlySet<number>, takenHere: ReadonlySet<number>): number | undefined {
  for (let candidate = 1; candidate <= MAX_HANDLE_NUMBER; candidate += 1) {
    if (!spent.has(candidate) && !takenHere.has(candidate)) return candidate;
  }
  return undefined;
}

/**
 * The binding with each element's handle replaced, element and selector map
 * together -- and the failed target with it, where the packet marks one, so a
 * failure packet cannot end up naming a handle its own elements no longer
 * carry. Authoring captures never mark one; the line is here so that a caller
 * that does cannot be broken silently by this module.
 */
function rewrite(binding: WebLlmSnapshotBinding, assigned: readonly string[]): WebLlmSnapshotBinding {
  const selectors = new Map<string, string>();
  const records = new Map<string, string>();
  const renamed = new Map<string, string>();
  const elements = binding.evidence.elements.map((element, index) => {
    const target = assigned[index] ?? element.target;
    renamed.set(element.target, target);
    const selector = binding.selectors.get(element.target);
    if (selector !== undefined) selectors.set(target, selector);
    const record = binding.records.get(element.target);
    if (record !== undefined) records.set(target, record);
    return { ...element, target };
  });
  const evidence: WebLlmPageEvidence = { ...binding.evidence, elements };
  if (evidence.failedTarget !== undefined) evidence.failedTarget = renamed.get(evidence.failedTarget) ?? evidence.failedTarget;
  return { evidence, selectors, records };
}
