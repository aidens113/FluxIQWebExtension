// A target handle names one control, on one page, for as long as one Flow is
// being authored -- and no other control on that page or any other.
//
// The sanitizer numbers a packet's elements positionally --
// `target.${index + 1}` -- because it sees one snapshot and has no memory. That
// was fine while the model only read. It stopped being fine the moment a Flow
// could act, twice over.
//
// **Across a recapture of one page.** A handle the model read out of one packet
// is written into a plan that is resolved against the *newest* packet for that
// page (`plan-resolution/target-packets.ts`), and an ordinary recapture -- what
// `web.press_control` does on success, and what a second inspect does --
// renumbers everything after any element that appeared or disappeared.
// Measured: with the page `[banner, beds, band, search]`, `target.2` resolved
// to the Bedrooms select; the banner was dismissed, the page recaptured, and
// the same `target.2` resolved to the Price-band select, with no refusal and
// nothing to tell anybody anything had moved. Live, a created Flow chose
// `target.2` for its first filter and the run failed with `expected a select
// element to choose value "5" in, actual the target is a <button>`
// (`run-mu6btt9u-8ba762fd`).
//
// **Across pages.** Until 2026-09-21 every page numbered its own controls from
// `target.1`, and a handle meant nothing off its page. But the Flow script
// format has the model write a step's target bare, `target: target.7`
// (`fluxiq` `flow-script-format.ts`), and an exploration visits several pages:
// the store's front page, its results, a product. Every page had a
// `target.7`, so a bare handle named a different control on each page the
// exploration had seen, and the plan resolver -- correctly -- refused it as
// `web.handle.ambiguous`. That was the build's end in 6 of E1 lane B's 12
// builds on the realistic stores (`core.decision_unusable` with
// `web.handle.ambiguous`), and three refusals in a row ended one outright
// (`run-mubrnb6e-3f2862cb`). The model had done nothing wrong: it copied the
// handle it was shown, exactly as it is told to.
//
// So a number is now spent for the whole Flow, not for one page. The same
// control keeps its number across every capture of its page; a control on
// another page -- even one with the same selector, such as the header's search
// box -- is another page's control and has a number of its own; and a number,
// once given, is never given to anything else while the Flow is being
// authored. A bare handle therefore names exactly one element, and a
// `location` beside it only confirms what the handle already says.
//
// What this is not. It never invents a handle for something the capture did
// not describe; it only chooses the number an element already described is
// given. And it does not reach across Flows: each project and Flow has its own
// numbers, exactly as the packet store keys them.

import { createHash } from "node:crypto";
import type { WebLlmPageEvidence, WebLlmSnapshotBinding } from "./sanitize";

/**
 * The handle numbers one Flow's authoring may issue, as
 * `plan-resolution/handle-tokens.ts` matches them: `target.1` to `target.9999`.
 *
 * Sized so it is never reached by one exploration. Core allows an exploration
 * 64 tool calls (`AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_LIMITS.maxToolCalls`), a
 * call takes at most three captures (the look before it acts, the look after,
 * and a page refusal's look), and a capture describes at most
 * `WEB_LLM_EVIDENCE_BOUNDS.elements` (40): 7,680 numbers if every element of
 * every capture were new, which on a real site they are not. Numbers are
 * spent lowest first, so a handle is only as long as the exploration needed.
 */
export const WEB_LLM_TARGET_HANDLE_MAX_NUMBER = 9_999;
/** Every handle this module can issue and nothing else: `target.` and a number from 1 to `WEB_LLM_TARGET_HANDLE_MAX_NUMBER`. */
export const WEB_LLM_TARGET_HANDLE_PATTERN = "^target\\.[1-9][0-9]{0,3}$";
/** Flows remembered, as the packet store bounds them: a Flow the store still resolves still has its numbers. */
const RETAINED_FLOWS = 32;

export type WebLlmStableHandleScope = { projectId: string; flowId: string };

export type WebLlmStableTargetHandles = {
  /**
   * The same binding with each element's handle chosen so it keeps naming the
   * control it named, and names nothing else in this Flow. The binding passed
   * in is not changed.
   */
  restamp(scope: WebLlmStableHandleScope, binding: WebLlmSnapshotBinding): WebLlmSnapshotBinding;
};

/**
 * One Flow's assignments: which control has which number, and the last
 * number spent. Addresses are kept as digests, so a Flow's memory is at most
 * one short key per number whatever the page's selectors are.
 */
type FlowHandles = { byAddress: Map<string, number>; spent: number };

export function createWebLlmStableTargetHandles(): WebLlmStableTargetHandles {
  const flows = new Map<string, FlowHandles>();
  return {
    restamp(scope, binding) {
      const flowKey = `${scope.projectId}\0${scope.flowId}`;
      let flow = flows.get(flowKey) ?? { byAddress: new Map<string, number>(), spent: 0 };
      flows.delete(flowKey);
      flows.set(flowKey, flow);
      for (const oldest of flows.keys()) {
        if (flows.size <= RETAINED_FLOWS) break;
        flows.delete(oldest);
      }

      const addresses = addressesOf(binding);
      // A Flow that has described more distinct controls than there are
      // numbers starts again rather than handing one control's number to
      // another. One exploration cannot get here (see the bound above); a Flow
      // authored over and over could, and starting again is what every page
      // did before this module. The plan resolver still refuses a bare handle
      // two remembered pages disagree on, so the worst it can do is refuse.
      const unseen = new Set(addresses.filter((address) => !flow.byAddress.has(address))).size;
      if (flow.spent + unseen > WEB_LLM_TARGET_HANDLE_MAX_NUMBER) {
        flow = { byAddress: new Map<string, number>(), spent: 0 };
        flows.set(flowKey, flow);
      }

      const assigned = addresses.map((address) => {
        const known = flow.byAddress.get(address);
        if (known !== undefined) return `target.${known}`;
        flow.spent += 1;
        flow.byAddress.set(address, flow.spent);
        return `target.${flow.spent}`;
      });
      return rewrite(binding, assigned);
    }
  };
}

/**
 * Each described element's address in this Flow: the page it is on, the frame
 * and selector that name it there, the record it sits in, and which occurrence
 * it is where a page gave one selector to several elements. A shared selector
 * is refused at resolution (`plan-resolution/target-packets.ts`), so the
 * occurrence exists to keep two such elements from claiming one number, not
 * to make either resolvable.
 *
 * The page is there because a handle is written bare into a plan, so it must
 * name one page's control: the header's search box on the results page is not
 * the one on the front page, however alike their selectors, and it is on the
 * results page that the step using it will run.
 *
 * The record is there because a row control's selector is positional. On the
 * social scheduler the first row's checkbox is
 * `[data-testid="queue-rows"] > tr:nth-of-type(1) > td:nth-of-type(1) > input`
 * whichever post is in row one, and filtering the queue changes which post
 * that is. Keyed by the selector alone, the checkbox the model was shown for
 * "Mon 21 Sep 2026, 09:00" kept its number after a filter and named
 * "Mon 21 Sep 2026, 06:00" instead -- a handle meaning two controls in two
 * captures, which this module exists to prevent. With the record beside the
 * selector, another post in the same row is another address, so it gets a
 * number of its own and the old number is left to resolve to nothing.
 */
function addressesOf(binding: WebLlmSnapshotBinding): string[] {
  const seen = new Map<string, number>();
  const location = binding.evidence.location;
  return binding.evidence.elements.map((element) => {
    const selector = binding.selectors.get(element.target) ?? "";
    const record = binding.records.get(element.target) ?? "";
    const base = [location, String(element.frameId ?? 0), selector, record].join("\0");
    const occurrence = seen.get(base) ?? 0;
    seen.set(base, occurrence + 1);
    return createHash("sha256").update(`${base}\0${occurrence}`).digest("base64url");
  });
}

/**
 * The binding with each element's handle replaced, element and every
 * handle-keyed map together -- and the failed target with it, where the packet
 * marks one, so a failure packet cannot end up naming a handle its own
 * elements no longer carry. Authoring captures never mark one; the line is
 * here so that a caller that does cannot be broken silently by this module.
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
