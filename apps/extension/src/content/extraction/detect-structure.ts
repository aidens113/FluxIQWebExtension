// Structure detection on request: the picker's inference, reached by the
// domain's authoring runtime rather than by a person's click
// (`domain/src/extraction/structure-detection.ts`).
//
// Given a selector, the run is inferred from the element it names, exactly as a
// pick of that element would infer it. Given none, the page's runs are tried
// largest first (`largest-runs.ts`) and the inference that reads the most items
// wins, fewer fields and then lower confidence losing a tie. Either way the
// answer is the picker's own proposal, which holds selectors, labels built from
// structure, counts and coverage -- never a value read from the page (D3).
//
// Sensitive regions are refused the way every reader here refuses them, by the
// one shared rule (`sensitive-text.ts`): a selector naming an element that is,
// or sits inside, a sensitive control is `sensitive_region`, and so is a run
// whose every proposed field is excluded (D12) or whose items sit inside one.
// A run with some sensitive fields is still proposed, with those fields marked
// `exclude`, and the domain drops them before the model sees anything.
//
// `infiniteScroll` is reported only for a run whose page declares a feed and
// offers no pagination control (`feed-signal.ts`).

import type {
  WebAutomationExtractionProposal,
  WebAutomationStructureDetection,
  WebAutomationStructureDetectionRequest
} from "@fluxiq-web-extension/domain/client";
import { isWithinSensitiveControl } from "../sensitive-text";
import { isDeclaredFeed } from "./feed-signal";
import { inferListFromElement } from "./infer-list";
import { largestRunsFirst } from "./largest-runs";

type Refusal = Extract<WebAutomationStructureDetection, { ok: false }>;

/** Detect the structure the request names, or the page's largest readable one. */
export function detectStructure(request: WebAutomationStructureDetectionRequest): WebAutomationStructureDetection {
  return request.selector === undefined ? detectLargest() : detectAround(request.selector);
}

/**
 * The run around what the selector names. A snapshot's own selectors now name
 * one element each (`selector/unique-selector.ts`), but a selector sent here
 * need not be one of them -- `[data-testid="product-link"]` names every card's
 * link -- and for a read that is fine as long as every match sits in the one
 * run: the answer is the same whichever match was meant. Matches spread over
 * different runs, or over a run and something outside it, are
 * `ambiguous_target`.
 */
function detectAround(selector: string): WebAutomationStructureDetection {
  const elements = queryAll(selector);
  const first = elements[0];
  if (!first) return refused("target_not_found");
  if (elements.some(isWithinSensitiveControl)) return refused("sensitive_region");
  const proposal = inferListFromElement(first);
  if (!proposal) return refused("no_repeating_run");
  if (elements.length > 1 && !allInsideItems(elements, queryAll(proposal.item))) return refused("ambiguous_target");
  return detected(proposal);
}

/** Whether every element is one of the items, or sits inside one. */
function allInsideItems(elements: readonly Element[], items: readonly Element[]): boolean {
  const itemSet = new Set(items);
  return elements.every((element) => {
    for (let current: Element | null = element; current; current = current.parentElement) {
      if (itemSet.has(current)) return true;
    }
    return false;
  });
}

function detectLargest(): WebAutomationStructureDetection {
  let best: Extract<WebAutomationStructureDetection, { ok: true }> | undefined;
  let sensitiveSeen = false;
  const tried = new Set<string>();
  for (const first of largestRunsFirst()) {
    if (isWithinSensitiveControl(first)) {
      sensitiveSeen = true;
      continue;
    }
    const proposal = inferListFromElement(first);
    // The walk outward can land two starting items on one run; it is judged once.
    if (!proposal || tried.has(proposal.item)) continue;
    tried.add(proposal.item);
    const answer = detected(proposal);
    if (!answer.ok) {
      sensitiveSeen = true;
      continue;
    }
    if (isFormNotData(answer.proposal)) continue;
    if (best === undefined || outranks(answer.proposal, best.proposal)) best = answer;
  }
  return best ?? refused(sensitiveSeen ? "sensitive_region" : "no_repeating_run");
}

/**
 * A run whose only readable fields are live control values is a form's rows of
 * labels and inputs, not a list of records. Nobody asked for it, so the
 * page-wide search passes it over; a caller that names an element inside one
 * still gets the picker's answer for it.
 */
function isFormNotData(proposal: WebAutomationExtractionProposal): boolean {
  return proposal.fields.every((field) => field.spec.handling === "exclude" || field.spec.kind === "value");
}

/** More items first; then more readable fields; then the surer inference. */
function outranks(candidate: WebAutomationExtractionProposal, incumbent: WebAutomationExtractionProposal): boolean {
  if (candidate.itemCount !== incumbent.itemCount) return candidate.itemCount > incumbent.itemCount;
  const fields = readableFieldCount(candidate) - readableFieldCount(incumbent);
  if (fields !== 0) return fields > 0;
  return candidate.confidence > incumbent.confidence;
}

/** The proposal as an answer: refused when nothing in it may be read, with the feed signal beside it otherwise. */
function detected(proposal: WebAutomationExtractionProposal): WebAutomationStructureDetection {
  const items = queryAll(proposal.item);
  if (readableFieldCount(proposal) === 0 || items.some(isWithinSensitiveControl)) return refused("sensitive_region");
  if (proposal.pagination !== undefined || !isDeclaredFeed(items, queryOne(proposal.container))) return { ok: true, proposal };
  return { ok: true, proposal, infiniteScroll: true };
}

function readableFieldCount(proposal: WebAutomationExtractionProposal): number {
  return proposal.fields.filter((field) => field.spec.handling !== "exclude").length;
}

function refused(reason: Refusal["refused"]): Refusal {
  return { ok: false, refused: reason };
}

/** The element a selector names here, or `null` when there is none or the browser cannot parse it. */
function queryOne(selector: string): Element | null {
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}

function queryAll(selector: string): Element[] {
  try {
    return Array.from(document.querySelectorAll(selector));
  } catch {
    return [];
  }
}
