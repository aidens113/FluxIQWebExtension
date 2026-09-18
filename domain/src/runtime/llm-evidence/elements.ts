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
import { present } from "./present";
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
  /**
   * The opaque handle this element is named by, and the only way anything
   * outside the domain may refer to it. There is deliberately no `selector`
   * beside it: the packet is what a language model reads, and a selector in it
   * is a browser concept reaching the model however neutral the types around it
   * are. The selector lives in `WebLlmSnapshotBinding.selectors`, keyed by this
   * handle, and never leaves the domain.
   */
  target: string;
  tag: string;
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
  /**
   * This element is one example of this many of its kind: the same control,
   * link or cell in every row of one repeated list or table. The others are
   * listed after every distinct element, or not at all once the packet is
   * full, so a page of 280 rows shows its own buttons and one row checkbox
   * rather than 37 row checkboxes. A particular row's control is reached by
   * narrowing the page -- a search, a filter -- until it is listed, and is then
   * addressed by its own handle. Counted by the page
   * (`apps/extension/src/content/repeat-exemplars.ts`).
   */
  repeats?: number;
};

/** A packet element with its selector put back, which only domain code ever holds. */
export type ResolvedWebLlmEvidenceElement = WebLlmEvidenceElement & { selector: string };

/**
 * One described element: what the packet carries, and what stays behind -- the
 * selector that addresses it, and the record it sits in where the page repeats
 * one. Neither leaves the domain.
 */
export type DescribedEvidenceElement = { element: WebLlmEvidenceElement; selector: string; record: string | undefined };

/** More rows than a page holds; the bound only stops a hostile number reaching the packet. */
const MAX_REPEATS = 100_000;
/** Separates a record address's parts: a unit separator, which page keys and text do not use. */
const RECORD_ADDRESS_SEPARATOR = String.fromCharCode(31);

/** What the sanitizer needs from the page to describe one element. */
export type EvidenceElementContext = {
  target: string;
  url: URL;
  focusedSelector?: string | undefined;
};

/**
 * One raw snapshot element as a packet element and the selector that addresses
 * it, or `undefined` when it cannot be addressed (no tag or no selector) or
 * must not be described (a sensitive control).
 *
 * The two are returned side by side rather than as one object because only one
 * of them may be published: the caller puts the element in the packet and the
 * selector in the binding. Returning them joined and deleting a key afterwards
 * would be the silent-drop shape this directory is built against.
 */
export function sanitizedEvidenceElement(raw: unknown, context: EvidenceElementContext): DescribedEvidenceElement | undefined {
  if (!isJsonRecord(raw)) return undefined;
  const tag = boundedText(raw.tagName, WEB_LLM_EVIDENCE_BOUNDS.tag)?.toLowerCase();
  const addressed = frameAddressedSelector(raw);
  if (!tag || !addressed || isSensitiveElementDescriptor(raw)) return undefined;

  const attributes = isJsonRecord(raw.attributes) ? raw.attributes : {};
  const role = boundedText(raw.role, WEB_LLM_EVIDENCE_BOUNDS.role);
  // The extension sends an element's accessible name as `accessibleName`
  // (and leaves it out for a secret field). Reading only `name` dropped it
  // from every real packet while fixtures built with `name` kept passing, so
  // the model never saw the label a drifted control is usually found by.
  const name = boundedText(raw.accessibleName ?? raw.name, WEB_LLM_EVIDENCE_BOUNDS.text);
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
  const repeats = boundedCount(raw.repeatCount, MAX_REPEATS);

  const element = present<WebLlmEvidenceElement>({
    target: context.target,
    tag,
    frameId: addressed.frameId,
    role: role || undefined,
    name: name || undefined,
    text: text || undefined,
    inputType: inputType || undefined,
    controlType: controlType || undefined,
    hasValue,
    selectedValue: selectedValue || undefined,
    href: href || undefined,
    options: options?.length ? options : undefined,
    revealKind,
    expanded,
    focused,
    recent: trueFlag(raw.recentlyInteracted),
    changed: trueFlag(raw.changed),
    form: placement.form,
    landmark: placement.landmark,
    heading: placement.heading,
    item: placement.item,
    cell: placement.cell,
    // One is not a run: a count of one says nothing the element does not.
    repeats: repeats !== undefined && repeats > 1 ? repeats : undefined
  });
  return { element, selector: addressed.selector, record: recordAddress(raw.context) };
}

/**
 * Which record -- row, list item, card -- the element sits in, as the page
 * identified it (`apps/extension/src/content/identity/record.ts`): by the
 * per-instance key the author wrote, with the attribute it came from, or by
 * the record's own words where there is none.
 *
 * It is part of the element's address rather than of its description, and is
 * never published. A row control's selector is usually positional --
 * `[data-testid="queue-rows"] > tr:nth-of-type(1) > td:nth-of-type(1) > input`
 * on the social scheduler -- and filtering the queue puts another post in row
 * one. The selector alone would then hand the first post's handle to the
 * second post's checkbox (`stable-handles.ts`); with the record beside it, the
 * second post's checkbox is a different address and gets a number of its own.
 */
function recordAddress(context: unknown): string | undefined {
  if (!isJsonRecord(context) || !isJsonRecord(context.record)) return undefined;
  const record = context.record;
  const key = boundedText(record.key, WEB_LLM_EVIDENCE_BOUNDS.attribute);
  if (key) return ["key", boundedText(record.keyAttribute, WEB_LLM_EVIDENCE_BOUNDS.attribute) ?? "", key].join(RECORD_ADDRESS_SEPARATOR);
  const text = boundedText(record.text, WEB_LLM_EVIDENCE_BOUNDS.attribute);
  return text ? ["text", text].join(RECORD_ADDRESS_SEPARATOR) : undefined;
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
 * The five placement fields, every one of them named, `undefined` where the
 * page said nothing.
 *
 * Written as a projection of the element type rather than as its own shape, so
 * renaming `heading` on the contract fails here too. It is not `Partial<...>`,
 * which is what this used to be: a partial lets a clause be deleted and the
 * field simply stops arriving, which is the whole defect this directory is
 * being closed against.
 */
type EvidenceElementPlacement = { [K in "form" | "landmark" | "heading" | "item" | "cell"]: WebLlmEvidenceElement[K] };

/**
 * Where the element sits: the form, landmark, heading, list or table position
 * `describeElement` already derives. This is how the packet carries regions,
 * forms and repeating structure without a second page-level list -- the
 * placement rides on the element it describes, so trimming an element for
 * budget cannot leave a dangling reference behind.
 */
function elementPlacement(input: unknown, named: { name?: string | undefined; text?: string | undefined }): EvidenceElementPlacement {
  // A missing or malformed context reads as an empty record rather than an
  // early return, so every one of the five fields is still named below.
  const described: Record<string, unknown> = isJsonRecord(input) ? input : {};
  const form = boundedText(described.formId ?? described.formName, WEB_LLM_EVIDENCE_BOUNDS.placement);
  const landmark = boundedText(described.landmark, WEB_LLM_EVIDENCE_BOUNDS.tag);
  const rawHeading = boundedText(described.heading, WEB_LLM_EVIDENCE_BOUNDS.placement);
  const heading = rawHeading === named.name || rawHeading === named.text ? undefined : rawHeading;
  return {
    form: form || undefined,
    landmark: landmark || undefined,
    heading: heading || undefined,
    item: listPlacement(described.listPosition),
    cell: tablePlacement(described.tablePosition)
  };
}

function listPlacement(input: unknown): WebLlmEvidenceElement["item"] {
  if (!isJsonRecord(input)) return undefined;
  const index = boundedCount(input.index, 100_000);
  const total = boundedCount(input.total, 100_000);
  return index === undefined || total === undefined ? undefined : { index, total };
}

function tablePlacement(input: unknown): WebLlmEvidenceElement["cell"] {
  if (!isJsonRecord(input)) return undefined;
  const row = boundedCount(input.row, 100_000);
  const column = boundedCount(input.column, 100_000);
  if (row === undefined || column === undefined) return undefined;
  const header = boundedText(input.columnHeader, WEB_LLM_EVIDENCE_BOUNDS.placement);
  return present<NonNullable<WebLlmEvidenceElement["cell"]>>({ row, column, header: header || undefined });
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
