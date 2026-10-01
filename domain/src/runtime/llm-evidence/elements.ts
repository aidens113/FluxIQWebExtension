// One page element, as the model is shown it: what it is, what it says, every
// attribute, where it is and whether it is on screen, what it holds where that
// is not a secret, and where it sits among forms, landmarks, lists and tables.
// Nothing is cut (t200). Never published: a control the shared sensitivity rule
// (`isSensitiveElementDescriptor`) marks, dropped before any of its strings is
// read; a string shaped like a credential (`./withheld.ts`, `./location.ts`);
// a selector; and an attribute map keyed by name (`./attributes.ts`).

import { isSensitiveElementDescriptor } from "../../sensitivity";
import { attributeRecord, publishedAttributes, rawAttributes, WEB_LLM_FRAME_ID_ATTRIBUTE } from "./attributes";
import type { WebLlmLayerMarks } from "./layer-marks";
import { evidenceHref } from "./location";
import { present } from "./present";
import { countValue, isJsonRecord, pageText, trueFlag } from "./untrusted-json";
import { screenedPageText, screenedText } from "./withheld";

/**
 * A merged tab snapshot rewrites a child frame's selector as
 * `frame[<id>] >> <selector>` and stamps `data-fluxiq-frame-id` onto the
 * element (`apps/extension/src/background/connection/frame-geometry.ts`). The
 * packet undoes the rewrite: `selector` goes back to the selector that works
 * inside the frame and `frameId` carries the frame, which is what a Flow's
 * `browserFrameId` needs. Left joined, the selector is valid in no frame.
 */
export const FRAME_SELECTOR_PATTERN = /^frame\[(\d+)\]\s*>>\s*(.+)$/u;

export type WebLlmEvidenceElement = {
  /** The opaque handle this element is named by. Its selector stays in `WebLlmSnapshotBinding.selectors` and never leaves the domain. */
  target: string;
  tag: string;
  /** Present only for an element that lives in a child frame of the captured tab. */
  frameId?: number;
  /** The `role` attribute the page wrote. */
  role?: string;
  /** The role the tag implies (`a[href]` is a link), where it differs from `role`. */
  implicitRole?: string;
  /** The accessible name. */
  name?: string;
  /** The text of the `<label>` naming the control, where it differs from `name`. */
  label?: string;
  /** The element's text, where it differs from `name`: its own words, or all of them for a control or a semantic text element. */
  text?: string;
  /**
   * The element's own visible words, where `text` is all of its descendants'
   * and the two differ (t223). The empty string is kept: it says the element
   * has no words of its own, which is how the page view knows a list item's or
   * a heading's words are its children's.
   */
  ownText?: string;
  /**
   * The handle of the nearest ancestor this packet describes, in the composed
   * tree (t223). An ancestor the packet does not describe -- a sensitive
   * control, an element with no address -- is passed over to the next one up.
   */
  parent?: string;
  /**
   * Only in a capture asked to include hidden elements (`includeHidden`): this
   * one is not rendered. A hidden element never moves a visible element's
   * handle (`./stable-handles.ts`) and never counts toward the page's state
   * (`./state-digest/`).
   */
  hidden?: true;
  /** Every attribute the page gave the element, `[name, value]`, in the page's order. */
  attributes?: Array<[string, string]>;
  inputType?: string;
  controlType?: string;
  hasValue?: boolean;
  /** What a non-sensitive text field holds, when the capture read it. Never on a control the sensitivity rule marks. */
  value?: string;
  /** A checkbox's or radio's checked state. */
  checked?: boolean;
  selectedValue?: string;
  href?: string;
  options?: Array<{ value: string; label: string }>;
  /** The page listens for a click on it. */
  hasClickHandler?: true;
  /** Where it is on the page, in document coordinates, rounded to whole pixels. */
  box?: { x: number; y: number; width: number; height: number };
  /** Whether any of it is inside the viewport as captured. */
  onViewport?: boolean;
  revealKind?: "disclosure" | "view";
  expanded?: boolean;
  /** The document's focused element, when it survived sanitizing. */
  focused?: true;
  /** The user touched this element recently. */
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
  /** How many of this control, link or cell one repeated list or table holds, this one included; each is listed in its own place. */
  repeats?: number;
  /** Only on a look-alike (`look-alikes.ts`): the name of the open dialog it sits in. */
  dialog?: string;
  /** Only on a look-alike, or a `repeats` element: the words of the row, card or list item it sits in, less its controls' words. */
  within?: string;
  /** Only on elements still alike after `dialog` and `within`: which of them this is, top to bottom, of how many. */
  alike?: { index: number; total: number };
} & WebLlmLayerMarks;

/** A packet element with its selector put back, which only domain code ever holds. */
export type ResolvedWebLlmEvidenceElement = WebLlmEvidenceElement & { selector: string };

/**
 * One described element: what the packet carries, and what stays behind -- the
 * selector that addresses it, the record it sits in where the page repeats
 * one, and the cues that tell it from a look-alike. The selector and the
 * record never leave the domain; a cue is published only on an element that
 * needs it (`look-alikes.ts`).
 */
export type DescribedEvidenceElement = {
  element: WebLlmEvidenceElement;
  selector: string;
  record: string | undefined;
  /** The record's own words, screened. Absent where the page keyed the record or it was not one of several. */
  within: string | undefined;
  /** Where the element starts on the page, when the capture measured it. */
  position: { top: number; left: number } | undefined;
  /** The open shadow hosts around it, outermost first: the other half of its selector's address. Never in the packet. */
  shadowHosts: readonly string[] | undefined;
};

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
  const tag = pageText(raw.tagName)?.toLowerCase();
  const addressed = frameAddressedSelector(raw);
  const attributes = rawAttributes(raw.attributes);
  const byName = attributeRecord(attributes);
  // Asked of the attributes in whichever form they arrived, so the rule sees
  // `type`, `autocomplete` and `data-sensitive` however the capture sent them.
  if (!tag || !addressed || isSensitiveElementDescriptor({ ...raw, attributes: byName })) return undefined;

  const role = screenedPageText(raw.role);
  const rawImplicitRole = screenedPageText(raw.implicitRole);
  // The extension sends an element's accessible name as `accessibleName`
  // (and leaves it out for a secret field). Reading only `name` dropped it
  // from every real packet while fixtures built with `name` kept passing.
  const name = screenedPageText(raw.accessibleName ?? raw.name);
  const rawLabel = screenedPageText(raw.label);
  const rawText = screenedPageText(raw.visibleText ?? raw.text);
  const text = rawText === name ? undefined : rawText;
  const rawInputType = pageText(raw.inputType)?.toLowerCase();
  const inputType = rawInputType === "text" ? undefined : rawInputType;
  const rawControlType = pageText(byName.type)?.toLowerCase();
  const controlType = rawControlType === rawInputType || rawControlType === "text" ? undefined : rawControlType;
  const href = evidenceHref(raw.href, context.url);
  const options = tag === "select" ? sanitizedOptions(raw.options) : undefined;
  const fillable = safeFillTag(tag, inputType);
  const hasValue = fillable && typeof raw.hasValue === "boolean" ? raw.hasValue : undefined;
  const value = fillable && typeof raw.value === "string" && raw.value !== "" ? screenedText(raw.value) : undefined;
  const selectedValue = tag === "select" ? sanitizedSelectedValue(raw.selectedValue, raw.options) : undefined;
  const revealKind = semanticRevealKind(tag, role, byName);
  const expanded = revealKind === "disclosure" ? semanticExpandedState(byName) : undefined;
  const placement = elementPlacement(raw.context, { name, text });
  const focused = context.focusedSelector !== undefined && context.focusedSelector === addressed.selector ? true : undefined;
  const repeats = countValue(raw.repeatCount);

  const element = present<WebLlmEvidenceElement>({
    target: context.target,
    tag,
    frameId: addressed.frameId,
    role,
    implicitRole: rawImplicitRole === role ? undefined : rawImplicitRole,
    name,
    label: rawLabel === name ? undefined : rawLabel,
    text,
    ownText: ownWords(raw.ownText),
    // Written by the packet (`./sanitize.ts`), which alone knows every
    // element's handle: the capture names the parent by its place in the list.
    parent: undefined,
    hidden: trueFlag(raw.hidden),
    attributes: publishedAttributes(attributes, context.url),
    inputType: inputType || undefined,
    controlType: controlType || undefined,
    hasValue,
    value,
    checked: typeof raw.checked === "boolean" ? raw.checked : undefined,
    selectedValue,
    href,
    options: options?.length ? options : undefined,
    hasClickHandler: trueFlag(raw.hasClickHandler),
    box: documentBox(raw.documentBounds),
    onViewport: typeof raw.isVisibleOnViewport === "boolean" ? raw.isVisibleOnViewport : undefined,
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
    repeats: repeats !== undefined && repeats > 1 ? repeats : undefined,
    // Written by the packet, not the element: only a look-alike carries them.
    dialog: undefined,
    within: undefined,
    alike: undefined,
    // Joined across the whole capture by `./layers.ts`, which writes them.
    isDialog: undefined, inDialog: undefined, covers: undefined, coversCount: undefined, kind: undefined, coveredBy: undefined,
    frontLayer: trueFlag(raw.frontLayer),
    statement: trueFlag(raw.leadStatement)
  });
  return {
    element,
    selector: addressed.selector,
    record: recordAddress(raw.context),
    within: recordWords(raw.context),
    // Document coordinates only: a viewport box is in another space, and one
    // look-alike measured in each would be put in the wrong order.
    position: documentPosition(raw.documentBounds),
    shadowHosts: shadowHostChain(raw.context)
  };
}

/**
 * The element's own words, screened, with the empty string kept: an element
 * with no words of its own says so with `""`, and only a capture that did not
 * report own words at all leaves the field absent.
 */
function ownWords(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  return screenedPageText(input) ?? "";
}

/** The element's open shadow host chain, whole or not at all: half a chain would scope the lookup to the wrong roots. */
function shadowHostChain(context: unknown): string[] | undefined {
  if (!isJsonRecord(context) || !Array.isArray(context.shadowHosts)) return undefined;
  const hosts: unknown[] = context.shadowHosts;
  if (hosts.length === 0) return undefined;
  const readable = hosts.every((host) => typeof host === "string" && host.trim() !== "");
  return readable ? hosts as string[] : undefined;
}

/**
 * The words of the record the element sits in, as the page read them
 * (`apps/extension/src/content/identity/record.ts`): the row's or card's own
 * text less its controls' words, which is what a person reads to say which row
 * they mean. Present only where the page did not key the record, since a key
 * is an identifier nobody reads.
 */
function recordWords(context: unknown): string | undefined {
  if (!isJsonRecord(context) || !isJsonRecord(context.record)) return undefined;
  return screenedPageText(context.record.text);
}

/** Where a measured box starts, or `undefined` for a box that is not one. */
function documentPosition(bounds: unknown): { top: number; left: number } | undefined {
  if (!isJsonRecord(bounds)) return undefined;
  const { x, y } = bounds;
  return typeof x === "number" && Number.isFinite(x) && typeof y === "number" && Number.isFinite(y) ? { top: y, left: x } : undefined;
}

/** The measured document box, rounded to whole pixels, or `undefined` for a box that is not one. */
function documentBox(bounds: unknown): WebLlmEvidenceElement["box"] {
  if (!isJsonRecord(bounds)) return undefined;
  const { x, y, width, height } = bounds;
  const parts = [x, y, width, height];
  if (!parts.every((part) => typeof part === "number" && Number.isFinite(part))) return undefined;
  return { x: Math.round(x as number), y: Math.round(y as number), width: Math.round(width as number), height: Math.round(height as number) };
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
  const key = pageText(record.key);
  if (key) return ["key", pageText(record.keyAttribute) ?? "", key].join(RECORD_ADDRESS_SEPARATOR);
  const text = pageText(record.text);
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
  if (element.hasClickHandler === true) return true;
  const roles = ["button", "link", "checkbox", "radio", "option", "switch", "tab", "menuitem", "treeitem"];
  return roles.includes(element.role ?? "") || roles.includes(element.implicitRole ?? "");
}

/**
 * Which disclosure or view switch the element is, if any. A description for the
 * model, nothing more: it once decided what the reveal tool would press, and
 * nothing is decided from it now (see `./press.ts`).
 */
export function semanticRevealKind(tag: string, role: string | undefined, attributes: Record<string, unknown>): "disclosure" | "view" | undefined {
  if (role === "tab" || role === "menuitem" || role === "treeitem") return "view";
  if (tag === "summary") return "disclosure";
  const expanded = pageText(attributes["aria-expanded"])?.toLowerCase();
  const controls = pageText(attributes["aria-controls"]);
  return expanded === "true" || expanded === "false" || controls ? "disclosure" : undefined;
}

function semanticExpandedState(attributes: Record<string, unknown>): boolean | undefined {
  const expanded = pageText(attributes["aria-expanded"])?.toLowerCase();
  return expanded === "true" ? true : expanded === "false" ? false : undefined;
}

/**
 * The frame an element belongs to and the selector that addresses it there.
 * Both the rewritten selector and the stamped attribute are honoured, because
 * a merge that failed to translate geometry still stamps the attribute.
 */
function frameAddressedSelector(raw: Record<string, unknown>): { selector: string; frameId?: number } | undefined {
  const rawSelector = pageText(raw.selector);
  if (!rawSelector) return undefined;
  const match = FRAME_SELECTOR_PATTERN.exec(rawSelector);
  const selector = match ? pageText(match[2]) : rawSelector;
  if (!selector) return undefined;
  const frameId = stampedFrameId(raw) ?? (match ? countValue(Number(match[1])) : undefined);
  // Frame 0 is the top frame, which needs no addressing.
  return frameId ? { selector, frameId } : { selector };
}

function stampedFrameId(raw: Record<string, unknown>): number | undefined {
  const stamped = pageText(attributeRecord(rawAttributes(raw.attributes))[WEB_LLM_FRAME_ID_ATTRIBUTE]);
  return stamped === undefined ? undefined : countValue(Number(stamped));
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
 * placement rides on the element it describes.
 */
function elementPlacement(input: unknown, named: { name?: string | undefined; text?: string | undefined }): EvidenceElementPlacement {
  // A missing or malformed context reads as an empty record rather than an
  // early return, so every one of the five fields is still named below.
  const described: Record<string, unknown> = isJsonRecord(input) ? input : {};
  const form = screenedPageText(described.formId ?? described.formName);
  const landmark = screenedPageText(described.landmark);
  const rawHeading = screenedPageText(described.heading);
  const heading = rawHeading === named.name || rawHeading === named.text ? undefined : rawHeading;
  return {
    form,
    landmark,
    heading,
    item: listPlacement(described.listPosition),
    cell: tablePlacement(described.tablePosition)
  };
}

function listPlacement(input: unknown): WebLlmEvidenceElement["item"] {
  if (!isJsonRecord(input)) return undefined;
  const index = countValue(input.index);
  const total = countValue(input.total);
  return index === undefined || total === undefined ? undefined : { index, total };
}

function tablePlacement(input: unknown): WebLlmEvidenceElement["cell"] {
  if (!isJsonRecord(input)) return undefined;
  const row = countValue(input.row);
  const column = countValue(input.column);
  if (row === undefined || column === undefined) return undefined;
  return present<NonNullable<WebLlmEvidenceElement["cell"]>>({ row, column, header: screenedPageText(input.columnHeader) });
}

/** Every option, in the page's order, an empty value or label kept as the empty string it is. */
function sanitizedOptions(input: unknown): Array<{ value: string; label: string }> | undefined {
  if (!Array.isArray(input)) return undefined;
  const result = input.flatMap((raw) => isJsonRecord(raw)
    ? [{ value: typeof raw.value === "string" ? screenedText(raw.value) : "", label: screenedPageText(raw.label) ?? "" }]
    : []);
  return result.length ? result : undefined;
}

/** The selected value, when it is one of the options the page offered. */
function sanitizedSelectedValue(input: unknown, options: unknown): string | undefined {
  if (typeof input !== "string" || !Array.isArray(options)) return undefined;
  const offered = options.some((option) => isJsonRecord(option) && option.value === input);
  return offered ? screenedText(input) : undefined;
}
