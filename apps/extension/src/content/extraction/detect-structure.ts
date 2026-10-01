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
//
// **A page that has not drawn its list yet has no repeating run, and saying so
// is worse than waiting.** `detectStructureWhenPresent` is the same bounded
// wait the read makes (`page-render.ts`), for the same reason and with the same
// ceiling: it polls until a run is there and answers the moment one is, so a
// page that already has one costs nothing. Only the two refusals that a moment
// later could stop being true are waited on -- `no_repeating_run`, and a
// `target_not_found` for an element the page has not rendered yet. A sensitive
// region and an ambiguous target are facts about the page as authored, so they
// are answered at once.
//
// **Nor has a page that is still drawing its list as skeletons.** A run found
// while a larger run of empty placeholders stands elsewhere on the page is
// whatever else the page holds, not the list it is drawing
// (`placeholder-run/`): on the Spain hubs' results the grid is nineteen
// skeletons for 600 ms after load and the sidebar's five filter groups were
// answered at once, as final (t194 G3). Such an answer is waited on within the
// same window, and the run that fills in then outranks the sidebar. When the
// window closes first, the last answer stands, as for a refusal. Placeholders
// inside the detected items or beside them are that list filling in, and
// settle nothing either way.
//
// Live, this ended a build rather than spoiling an answer: on `company-website`
// the model detected one moment too early, was told `no_repeating_structure`,
// asked again five times and was answered `already_answered` by the loop's
// repeat cache each time, then completed with a Flow that had no extract node
// at all (`run-mudrimhl-47dee201`). A refusal a caller cannot usefully retry
// has to be right the first time.
//
// **A target is where to start looking, not the only place to look.** Until
// 2026-09-28 a detection aimed at an element with no run around it refused
// `no_repeating_run`, so a model had to aim at exactly an element inside a row
// to find anything. On the everything store's cart the model aimed at the
// heading, the subtotal, the rows and the buttons for a dozen decisions and was
// refused every time (`run-mulum3x7-18ceeb75`,
// `docs/working/language-driven-flow-loop-plan/reports/cart-extraction.md`). Now
// a target with no list around it searches outward -- the regions enclosing it,
// nearest first -- and answers with the nearest readable list, which for "what
// is in my cart" aimed at the cart's heading is the cart's lines.
//
// **A record's own controls are not the list.** A run whose items hold at most
// one value of their own (`content-fields.ts`) -- a line's Delete, Save for
// later, Compare and Share links; a card's rating stars -- is "thin". Aimed at
// one, the outward search is tried first and a rich list enclosing it wins; the
// page-wide search ranks every rich run above every thin one. A thin run is
// still answered when it is all there is.

import type {
  WebAutomationExtractionProposal,
  WebAutomationStructureDetection,
  WebAutomationStructureDetectionRequest
} from "@fluxiq-web-extension/domain/client";
import { isWithinSensitiveControl } from "../sensitive-text";
import { contentFieldCount } from "./content-fields";
import { isDeclaredFeed } from "./feed-signal";
import { inferListFromElement } from "./infer-list";
import { largestRunsFirst } from "./largest-runs";
import { waitUntil } from "./list-wait";
import { largestPlaceholderRunApartFrom } from "./placeholder-run";

type Refusal = Extract<WebAutomationStructureDetection, { ok: false }>;
type Detected = Extract<WebAutomationStructureDetection, { ok: true }>;

/**
 * How long a detection waits for a page to draw a list before answering that
 * it has none.
 *
 * Shorter than the read's own window: a read that waits has somewhere to put
 * the time, while a detection that waits spends part of a build's deadline on a
 * page that may genuinely hold no list. Long enough for the render delays the
 * campaign's own fixtures keep -- 700 ms for a results grid, a batch of cards
 * behind skeletons -- with room over.
 */
const STRUCTURE_WINDOW_MS = 5_000;
const STRUCTURE_POLL_MS = 100;

/** The refusals a moment later could stop being true. The rest are facts about the page as authored. */
const WORTH_WAITING_FOR: ReadonlySet<string> = new Set(["no_repeating_run", "target_not_found"]);

/** Detect the structure the request names, or the page's largest readable one, as the page stands now. */
export function detectStructure(request: WebAutomationStructureDetectionRequest): WebAutomationStructureDetection {
  return request.selector === undefined ? detectLargest() : detectAround(request.selector);
}

/**
 * The same detection, waiting for the page to draw a list first; see the
 * header. Answers the moment there is one, and answers the page's own refusal
 * when the window closes on it.
 */
export async function detectStructureWhenPresent(
  request: WebAutomationStructureDetectionRequest,
  timeoutMs?: number
): Promise<WebAutomationStructureDetection> {
  let answer = detectStructure(request);
  if (settled(answer)) return answer;
  const deadline = typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0 ? Date.now() + timeoutMs : undefined;
  await waitUntil(
    () => {
      answer = detectStructure(request);
      return settled(answer);
    },
    STRUCTURE_WINDOW_MS,
    STRUCTURE_POLL_MS,
    deadline
  );
  return answer;
}

/** Whether this answer is one waiting could not improve on: a refusal of the kind that stays true, or a run no larger list is still being drawn beside (see the header). */
function settled(answer: WebAutomationStructureDetection): boolean {
  if (!answer.ok) return !WORTH_WAITING_FOR.has(answer.refused);
  return document.body === null || answer.proposal.itemCount >= largestPlaceholderRunApartFrom(queryAll(answer.proposal.item), document.body);
}

/**
 * The run around what the selector names. A snapshot's own selectors now name
 * one element each (`selector/unique-selector.ts`), but a selector sent here
 * need not be one of them -- `[data-testid="product-link"]` names every card's
 * link -- and for a read that is fine as long as every match sits in the one
 * run: the answer is the same whichever match was meant. Matches spread over
 * different runs, or over a run and something outside it, are
 * `ambiguous_target`.
 *
 * With no rich run around the target, the search goes outward (see the
 * header); only a page with no readable list anywhere is `no_repeating_run`.
 */
function detectAround(selector: string): WebAutomationStructureDetection {
  const elements = queryAll(selector);
  const first = elements[0];
  if (!first) return refused("target_not_found");
  if (elements.some(isWithinSensitiveControl)) return refused("sensitive_region");
  const proposal = inferListFromElement(first);
  if (proposal) {
    if (elements.length > 1 && !allInsideItems(elements, queryAll(proposal.item))) return refused("ambiguous_target");
    const answer = detected(proposal);
    if (!answer.ok || !isThin(proposal)) return answer;
  }
  return nearestRichRun(first) ?? (proposal ? detected(proposal) : refused("no_repeating_run"));
}

/**
 * The best rich run in the nearest region enclosing `target` that holds one,
 * or `undefined` when no region up to the page's body does. Inferences are
 * shared between regions, since a region's runs are its inner region's runs
 * and more.
 */
function nearestRichRun(target: Element): Detected | undefined {
  const inferred = new Map<Element, WebAutomationExtractionProposal | undefined>();
  for (let region = target.parentElement; region && region !== document.documentElement; region = region.parentElement) {
    const best = bestRunUnder(region, inferred).best;
    if (best && !isThin(best.proposal)) return best;
  }
  return undefined;
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
  const { best, sensitiveSeen } = bestRunUnder(document.body, new Map());
  return best ?? refused(sensitiveSeen ? "sensitive_region" : "no_repeating_run");
}

/**
 * The best readable run under `root`, by `outranks`, and whether a sensitive
 * one was passed over. `inferred` memoizes each starting item's inference, so a
 * caller trying nested regions pays for each run once.
 */
function bestRunUnder(
  root: Element | null,
  inferred: Map<Element, WebAutomationExtractionProposal | undefined>
): { best: Detected | undefined; sensitiveSeen: boolean } {
  let best: Detected | undefined;
  let sensitiveSeen = false;
  const tried = new Set<string>();
  for (const first of largestRunsFirst(root)) {
    if (isWithinSensitiveControl(first)) {
      sensitiveSeen = true;
      continue;
    }
    if (!inferred.has(first)) inferred.set(first, inferListFromElement(first));
    const proposal = inferred.get(first);
    // The walk outward can land two starting items on one run; it is judged once.
    // A run whose items sit outside the region is not the region's.
    if (!proposal || tried.has(proposal.item) || !withinRegion(proposal, root)) continue;
    tried.add(proposal.item);
    const answer = detected(proposal);
    if (!answer.ok) {
      sensitiveSeen = true;
      continue;
    }
    if (isFormNotData(answer.proposal)) continue;
    if (best === undefined || outranks(answer.proposal, best.proposal)) best = answer;
  }
  return { best, sensitiveSeen };
}

/** Whether the run's items all sit inside `root`. The inference walks outward, so a run it lands on may enclose the region instead. */
function withinRegion(proposal: WebAutomationExtractionProposal, root: Element | null): boolean {
  if (!root) return false;
  const items = queryAll(proposal.item);
  return items.length > 0 && items.every((item) => root.contains(item));
}

/** How many values of their own the run's items hold between them, counting a field only where every item has it. */
function dataHeld(proposal: WebAutomationExtractionProposal): number {
  return proposal.itemCount * contentFieldCount(proposal.fields, 1);
}

/** A run whose items hold at most one value of their own: a record's controls or decorations; see the header. */
function isThin(proposal: WebAutomationExtractionProposal): boolean {
  return contentFieldCount(proposal.fields) <= 1;
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

/**
 * A rich run before a thin one; then the run holding more data -- its items
 * times the values of their own every item holds; then more items; then more
 * readable fields; then the surer inference.
 *
 * Data before length because length alone picked the wrong list on the
 * everything store's cart: Saved for later holds three items of a title, a
 * price and two links, the cart two lines of a dozen values each, and "the
 * largest list" was the one the instruction did not ask about.
 */
function outranks(candidate: WebAutomationExtractionProposal, incumbent: WebAutomationExtractionProposal): boolean {
  if (isThin(candidate) !== isThin(incumbent)) return isThin(incumbent);
  const data = dataHeld(candidate) - dataHeld(incumbent);
  if (data !== 0) return data > 0;
  if (candidate.itemCount !== incumbent.itemCount) return candidate.itemCount > incumbent.itemCount;
  const fields = readableFieldCount(candidate) - readableFieldCount(incumbent);
  if (fields !== 0) return fields > 0;
  return candidate.confidence > incumbent.confidence;
}

/** The proposal as an answer: refused when nothing in it may be read, with the feed signal beside it otherwise. */
function detected(proposal: WebAutomationExtractionProposal): Detected | Refusal {
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
