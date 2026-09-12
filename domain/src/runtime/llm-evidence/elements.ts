// One page element, reduced to the smallest description an LLM can still act
// on: what it is, how to address it, what it is called, and where on the page
// it sits. Values are never carried -- only whether one is present -- and a
// control whose signature says it holds a secret is dropped entirely.
//
// That last decision is `isSensitiveElementDescriptor`, the one shared rule in
// `domain/src/sensitivity/`. This module used to carry its own copy and it was
// the weakest of the four in the repository: it compared the whole
// `autocomplete` attribute rather than its tokens, so a card field marked
// `billing cc-number` -- the ordinary form, and the form that leaked a card
// number in Wave 2 -- was described in full, and it cut the attribute to 200
// characters before reading it, which is a way past a security test. Signature,
// not value: the packet never sees a value, so refusing to describe the
// control at all is the only defence there is.

import { isSensitiveElementDescriptor } from "../../sensitivity";
import { WEB_LLM_EVIDENCE_BOUNDS } from "./limits";
import { sameOriginHref } from "./location";
import { boundedCount, boundedText, isJsonRecord, trueFlag } from "./untrusted-json";

/**
 * A merged tab snapshot rewrites a child frame's selector as
 * `frame[<id>] >> <selector>` and stamps `data-fluxiq-frame-id` onto the
 * element (`apps/extension/src/background/connection/frame-geometry.ts`). The
 * packet undoes the rewrite: `selector` goes back to the selector that works
 * inside the frame and `frameId` carries the frame, which is what a Flow's
 * `browserFrameId` needs. Left joined, the selector is valid in no frame.
 */
const FRAME_SELECTOR_PATTERN = /^frame\[(\d{1,6})\]\s*>>\s*(.+)$/u;
const FRAME_ID_ATTRIBUTE = "data-fluxiq-frame-id";

export type WebLlmEvidenceElement = {
  target: string;
  tag: string;
  selector: string;
  /** Present only for an element that lives in a child frame of the captured tab. */
  frameId?: number;
  role?: string;
  name?: string;
  text?: string;
  inputType?: string;
  controlType?: string;
  hasValue?: boolean;
  selectedValue?: string;
  href?: string;
  options?: Array<{ value: string; label: string }>;
  revealKind?: "disclosure" | "view";
  expanded?: boolean;
  /** The document's focused element, when it survived sanitizing. */
  focused?: true;
  /** The user touched this element recently; the capture ranks these first. */
  recent?: true;
  /** This element differs from the previous capture of the same page. */
  changed?: true;
  /** The owning form's id or name, so controls read as a group. */
  form?: string;
  /** The nearest landmark role: `main`, `navigation`, `search`, and so on. */
  landmark?: string;
  /** The nearest preceding heading, when it says something the name does not. */
  heading?: string;
  /** Position inside a repeating list, which is also how many items there are. */
  item?: { index: number; total: number };
  /** Position inside a table. */
  cell?: { row: number; column: number; header?: string };
};

export type ResolvedWebLlmEvidenceElement = WebLlmEvidenceElement & { selector: string };

/** What the sanitizer needs from the page to describe one element. */
export type EvidenceElementContext = {
  target: string;
  url: URL;
  focusedSelector?: string | undefined;
};

/**
 * One raw snapshot element as a packet element, or `undefined` when it cannot
 * be addressed (no tag or no selector) or must not be described (a sensitive
 * control).
 */
export function sanitizedEvidenceElement(raw: unknown, context: EvidenceElementContext): WebLlmEvidenceElement | undefined {
  if (!isJsonRecord(raw)) return undefined;
  const tag = boundedText(raw.tagName, WEB_LLM_EVIDENCE_BOUNDS.tag)?.toLowerCase();
  const addressed = frameAddressedSelector(raw);
  if (!tag || !addressed || isSensitiveElementDescriptor(raw)) return undefined;

  const attributes = isJsonRecord(raw.attributes) ? raw.attributes : {};
  const role = boundedText(raw.role, WEB_LLM_EVIDENCE_BOUNDS.role);
  const name = boundedText(raw.name, WEB_LLM_EVIDENCE_BOUNDS.text);
  const rawText = boundedText(raw.visibleText ?? raw.text, WEB_LLM_EVIDENCE_BOUNDS.text);
  const text = rawText === name ? undefined : rawText;
  const rawInputType = boundedText(raw.inputType, WEB_LLM_EVIDENCE_BOUNDS.tag)?.toLowerCase();
  const inputType = rawInputType === "text" ? undefined : rawInputType;
  const rawControlType = boundedText(attributes.type, WEB_LLM_EVIDENCE_BOUNDS.tag)?.toLowerCase();
  const controlType = rawControlType === rawInputType || rawControlType === "text" ? undefined : rawControlType;
  const href = sameOriginHref(raw.href, context.url);
  const options = tag === "select" ? sanitizedOptions(raw.options) : undefined;
  const hasValue = safeFillTag(tag, inputType) && typeof raw.hasValue === "boolean" ? raw.hasValue : undefined;
  const selectedValue = options ? sanitizedSelectedValue(raw.selectedValue, options) : undefined;
  const revealKind = semanticRevealKind(tag, role, attributes);
  const expanded = revealKind === "disclosure" ? semanticExpandedState(attributes) : undefined;
  const placement = elementPlacement(raw.context, { name, text });
  const focused = context.focusedSelector !== undefined && context.focusedSelector === addressed.selector ? true : undefined;

  return {
    target: context.target,
    tag,
    selector: addressed.selector,
    ...(addressed.frameId === undefined ? {} : { frameId: addressed.frameId }),
    ...(role ? { role } : {}),
    ...(name ? { name } : {}),
    ...(text ? { text } : {}),
    ...(inputType ? { inputType } : {}),
    ...(controlType ? { controlType } : {}),
    ...(hasValue === undefined ? {} : { hasValue }),
    ...(selectedValue ? { selectedValue } : {}),
    ...(href ? { href } : {}),
    ...(options?.length ? { options } : {}),
    ...(revealKind ? { revealKind } : {}),
    ...(expanded === undefined ? {} : { expanded }),
    ...(focused ? { focused } : {}),
    ...(trueFlag(raw.recentlyInteracted) ? { recent: true as const } : {}),
    ...(trueFlag(raw.changed) ? { changed: true as const } : {}),
    ...placement
  };
}

/** A tag whose value the page would let an automation type into. */
export function safeFillTag(tag: string, inputType: string | undefined): boolean {
  return tag === "textarea" || (tag === "input" && (!inputType || ["text", "search", "email", "tel", "url", "number"].includes(inputType)));
}

/** An element a click is a meaningful thing to do to. */
export function actionableEvidenceElement(element: WebLlmEvidenceElement): boolean {
  if (["button", "a", "summary", "select", "textarea"].includes(element.tag)) return true;
  if (element.tag === "input") return element.inputType !== "hidden";
  return ["button", "link", "checkbox", "radio", "option", "switch", "tab", "menuitem", "treeitem"].includes(element.role ?? "");
}

/** Which disclosure the element is, if any: the only interactions the reveal tool may drive. */
export function semanticRevealKind(tag: string, role: string | undefined, attributes: Record<string, unknown>): "disclosure" | "view" | undefined {
  if (role === "tab" || role === "menuitem" || role === "treeitem") return "view";
  if (tag === "summary") return "disclosure";
  const expanded = boundedText(attributes["aria-expanded"], 10)?.toLowerCase();
  const controls = boundedText(attributes["aria-controls"], WEB_LLM_EVIDENCE_BOUNDS.text);
  return expanded === "true" || expanded === "false" || controls ? "disclosure" : undefined;
}

function semanticExpandedState(attributes: Record<string, unknown>): boolean | undefined {
  const expanded = boundedText(attributes["aria-expanded"], 10)?.toLowerCase();
  return expanded === "true" ? true : expanded === "false" ? false : undefined;
}

/**
 * The frame an element belongs to and the selector that addresses it there.
 * Both the rewritten selector and the stamped attribute are honoured, because
 * a merge that failed to translate geometry still stamps the attribute.
 */
function frameAddressedSelector(raw: Record<string, unknown>): { selector: string; frameId?: number } | undefined {
  const rawSelector = boundedText(raw.selector, WEB_LLM_EVIDENCE_BOUNDS.selector);
  if (!rawSelector) return undefined;
  const match = FRAME_SELECTOR_PATTERN.exec(rawSelector);
  const selector = match ? boundedText(match[2], WEB_LLM_EVIDENCE_BOUNDS.selector) : rawSelector;
  if (!selector) return undefined;
  const frameId = stampedFrameId(raw) ?? (match ? boundedCount(Number(match[1]), 999_999) : undefined);
  // Frame 0 is the top frame, which needs no addressing.
  return frameId ? { selector, frameId } : { selector };
}

function stampedFrameId(raw: Record<string, unknown>): number | undefined {
  const attributes = isJsonRecord(raw.attributes) ? raw.attributes : {};
  const stamped = boundedText(attributes[FRAME_ID_ATTRIBUTE], 20);
  return stamped === undefined ? undefined : boundedCount(Number(stamped), 999_999);
}

/**
 * Where the element sits: the form, landmark, heading, list or table position
 * `describeElement` already derives. This is how the packet carries regions,
 * forms and repeating structure without a second page-level list -- the
 * placement rides on the element it describes, so trimming an element for
 * budget cannot leave a dangling reference behind.
 */
function elementPlacement(input: unknown, named: { name?: string | undefined; text?: string | undefined }): Partial<WebLlmEvidenceElement> {
  if (!isJsonRecord(input)) return {};
  const form = boundedText(input.formId ?? input.formName, WEB_LLM_EVIDENCE_BOUNDS.placement);
  const landmark = boundedText(input.landmark, WEB_LLM_EVIDENCE_BOUNDS.tag);
  const rawHeading = boundedText(input.heading, WEB_LLM_EVIDENCE_BOUNDS.placement);
  const heading = rawHeading === named.name || rawHeading === named.text ? undefined : rawHeading;
  return {
    ...(form ? { form } : {}),
    ...(landmark ? { landmark } : {}),
    ...(heading ? { heading } : {}),
    ...listPlacement(input.listPosition),
    ...tablePlacement(input.tablePosition)
  };
}

function listPlacement(input: unknown): Partial<WebLlmEvidenceElement> {
  if (!isJsonRecord(input)) return {};
  const index = boundedCount(input.index, 100_000);
  const total = boundedCount(input.total, 100_000);
  return index === undefined || total === undefined ? {} : { item: { index, total } };
}

function tablePlacement(input: unknown): Partial<WebLlmEvidenceElement> {
  if (!isJsonRecord(input)) return {};
  const row = boundedCount(input.row, 100_000);
  const column = boundedCount(input.column, 100_000);
  if (row === undefined || column === undefined) return {};
  const header = boundedText(input.columnHeader, WEB_LLM_EVIDENCE_BOUNDS.placement);
  return { cell: { row, column, ...(header ? { header } : {}) } };
}

function sanitizedOptions(input: unknown): Array<{ value: string; label: string }> | undefined {
  if (!Array.isArray(input)) return undefined;
  const result: Array<{ value: string; label: string }> = [];
  for (const raw of input.slice(0, WEB_LLM_EVIDENCE_BOUNDS.options)) {
    if (!isJsonRecord(raw)) continue;
    const value = boundedText(raw.value, WEB_LLM_EVIDENCE_BOUNDS.attribute);
    const label = boundedText(raw.label, WEB_LLM_EVIDENCE_BOUNDS.attribute);
    if (value && label) result.push({ value, label });
  }
  return result.length ? result : undefined;
}

function sanitizedSelectedValue(input: unknown, options: Array<{ value: string; label: string }>): string | undefined {
  const value = boundedText(input, WEB_LLM_EVIDENCE_BOUNDS.attribute);
  return value && options.some((option) => option.value === value) ? value : undefined;
}
