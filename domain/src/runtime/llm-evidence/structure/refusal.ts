// Which of the things "no repeating structure" can mean happened here.
//
// The page answers a detection with one of four words (`extraction/structure-detection.ts`),
// and three of them were passed straight out as a bare code. That left the
// model with a refusal it could do nothing with, and the measured cost is a
// whole build: on `run-mug25fdp-21ba8385` (the cross-border marketplace, which
// puts a robot check in front of its content) 24 of 30 decisions were
// `web.detect_repeating_structure` answered `no_repeating_structure`, 85 bytes
// each and identical, until Core's no-progress guard ended the build. Nothing
// was executed, no Flow was built, and it cost 29 provider calls and 316,536
// tokens. A model told only "no" has nothing to change, so it asks again.
//
// So a refusal says which situation it is, in this domain's own closed words,
// and the four are four different next moves:
//
// - `nothing_repeats_around_target` -- the call named an element and what it
//   sits in has no repeating children. Detect without a target, or name an
//   element inside a row of the list actually wanted.
// - `repeating_groups_not_readable` -- the page does repeat and none of its
//   runs is a list a field can be read from. Name an element inside one, or
//   narrow the page first.
// - `nothing_repeats_on_page` -- nothing on this page repeats at all. This is
//   not where the list is.
// - `page_is_not_the_content` -- what was captured stands in front of the
//   content instead of being it. Deal with what is in the way, or go where the
//   content is.
//
// **What may be said, and what may not.** A refusal must never become the side
// channel for the page content the refusal was protecting (`../tool-rejection.ts`).
// Nothing here reads a value, a selector or a word of the page. What it reads
// is the packet the model was *already shown*, and it reports counts of it:
// how many records the packet's controls sit in, the most copies any one of
// them has (`elements[].repeats`, a published field), and how many controls
// the page offered (`elementTotal`, likewise). A count says how many and never
// what, and every one of these numbers the model could have counted itself
// from the packet in front of it.
//
// **Why the page's own refusal is not enough to tell them apart.** The four
// words the page sends are `target_not_found`, `ambiguous_target`,
// `no_repeating_run` and `sensitive_region`, and the third is one word for
// three of the situations above. Widening that wire contract means changing the
// content script, the contract and the domain together, and rebuilding the
// extension before a live run could see any of it. Everything below is decided
// from what this domain already holds: whether the call named a target, and the
// capture that came back with the detection.

import type { WebLlmPageEvidence, WebLlmSnapshotBinding } from "../sanitize";
import { recoverable, rejectionDetail, type WebLlmToolRejectionReason } from "../tool-rejection";
import type { WebAutomationStructureDetectionRefusal } from "../../../extraction";

/**
 * At most this many controls and the page is not the content: a robot check, a
 * consent wall, an interstitial, or a page that has not drawn. A real listing
 * page carries a search box, a filter or two and a navigation bar before it
 * carries a single row.
 */
const INTERSTITIAL_CONTROLS = 3;

/** Two of anything is a run; one is not (`elements.ts` says the same of `repeats`). */
const A_RUN = 2;

/** What the capture says about repetition, in numbers a refusal may carry. */
type PageCounts = {
  /** Distinct records -- rows, cards, list items -- the capture's controls sit in. */
  groups: number;
  /** The most copies any one control has: the largest repeating run the capture saw. */
  rows: number;
  /** How many controls the page offered, before the packet's own bounds cut it. */
  controls: number;
};

/**
 * Refuse the detection, saying which situation it was.
 *
 * Throws, as `recoverable` does, so a caller cannot forget to stop. The page's
 * two target refusals become the reasons the rest of this domain already has
 * for a handle that stopped naming one control -- they were bare
 * `target_unobserved` until now -- and a sensitive region stays a bare code,
 * because the code is already the whole of what the model can act on.
 */
export function webLlmStructureRefusal(input: {
  refused: WebAutomationStructureDetectionRefusal;
  /** The handle the call named, when it named one. */
  target: string | undefined;
  /** The capture the detection came back with, which is also the page the model was shown. */
  page: WebLlmSnapshotBinding;
}): never {
  const { refused, target, page } = input;
  if (refused === "sensitive_region") recoverable("sensitive_value");
  if (refused === "target_not_found") {
    recoverable("target_unobserved", rejectionDetail({ reason: "handle_no_longer_on_page", target, instead: undefined, missing: undefined, requestId: undefined }));
  }
  if (refused === "ambiguous_target") {
    recoverable("target_unobserved", rejectionDetail({ reason: "handle_names_several_now", target, instead: undefined, missing: undefined, requestId: undefined }));
  }
  const counts = pageCounts(page);
  recoverable("no_repeating_structure", rejectionDetail({
    reason: whyNothingRepeats(page.evidence, counts, target),
    target,
    instead: undefined,
    missing: undefined,
    requestId: undefined,
    groupsSeen: counts.groups,
    rowsSeen: counts.rows,
    controlsSeen: counts.controls
  }));
}

/**
 * Which of the three "nothing repeats" situations this is.
 *
 * The interstitial is decided first and deliberately: when something stands in
 * front of the page, every other answer would be a statement about a page the
 * capture never saw, and the move it implies -- deal with what is in the way --
 * is the one that has to happen before any of the others could.
 *
 * A named target comes next, because the page looked only where the call
 * pointed: what it did not find says nothing about the rest of the page, and
 * the model's move is to point somewhere else or to ask page-wide.
 */
function whyNothingRepeats(evidence: WebLlmPageEvidence, counts: PageCounts, target: string | undefined): WebLlmToolRejectionReason {
  if (pageIsNotTheContent(evidence, counts)) return "page_is_not_the_content";
  if (target !== undefined) return "nothing_repeats_around_target";
  return counts.groups >= A_RUN || counts.rows >= A_RUN ? "repeating_groups_not_readable" : "nothing_repeats_on_page";
}

/**
 * Whether what was captured is standing in front of the content rather than
 * being it.
 *
 * Three signals, all structural and none of them a word the page wrote: a modal
 * dialog, which is the shape of a consent wall and of a sign-in; something
 * painted over the controls, which is the shape of a cookie banner and of an
 * overlay; and a page that offers almost nothing at all, which is the shape of
 * a robot check and of a page that has not drawn. A page with no list on it but
 * a working search box is none of these, and is told the truth about itself
 * instead.
 */
function pageIsNotTheContent(evidence: WebLlmPageEvidence, counts: PageCounts): boolean {
  if (evidence.dialogs?.some((dialog) => dialog.modal === true) === true) return true;
  if (evidence.blockedBy !== undefined) return true;
  return counts.controls <= INTERSTITIAL_CONTROLS;
}

/**
 * The counts, read off the packet and its bindings.
 *
 * `groups` comes from the binding's record addresses rather than the packet,
 * because the address itself never leaves the domain -- only how many distinct
 * ones there were. `controls` prefers the page's own pre-filter total, so a
 * packet the byte budget trimmed to one element does not read as a bare page.
 */
function pageCounts(page: WebLlmSnapshotBinding): PageCounts {
  const evidence = page.evidence;
  return {
    groups: new Set(page.records.values()).size,
    rows: evidence.elements.reduce((most, element) => Math.max(most, element.repeats ?? 0), 0),
    controls: Math.max(evidence.elementTotal ?? 0, evidence.elements.length)
  };
}
