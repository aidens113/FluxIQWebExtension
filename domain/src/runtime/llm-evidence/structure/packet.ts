// A detected repeating structure, as the model is shown it: an opaque
// extraction handle, and for each field a key, a label, what kind of read it is
// and how many items have it -- with how many items there are and how the list
// continues. No selector and no value, ever (D3).
//
// The page's detection arrives holding selectors; this module splits it in two,
// as `sanitize.ts` splits a snapshot. The packet goes to the model. The binding
// -- the `web.dom.extract_list` request the handle names -- goes to the handle
// store (`handles.ts`) and never leaves the domain. Both are cut from the same
// list of fields, so a handle never stands for a field the model was not shown.
//
// A field the page proposed `exclude` is a sensitive control (D12), and it is
// dropped from both halves outright, as the evidence packet drops a sensitive
// element rather than describing it. A run with nothing else is refused as
// `sensitive_value` by the caller.
//
// Every other field is listed, with its label whole (t200). Until 2026-09-30
// fields were popped from the end until the packet fit the call's byte budget,
// and the handle named only the fields that were left.
//
// **One record is a one-row table.** A list may have one item. A label/value
// receipt (a `<dl>` of Role, Company, Reference, Submitted) and a lone record
// on a page where nothing repeats arrive as the detection's proposal itself,
// with `itemCount: 1`, and pass through here as any list does. When the target
// sits outside the run the page found -- the reply card in a message thread,
// whose nearest run is the inbox's thread rows, which carry no price -- the
// page sends the card beside the run as `record`. It is split by the same rule
// into a second handle and binding, and the packet carries it as `record` with
// one closed sentence saying what it is and when to name it. Until 2026-10-01
// the model was shown only the thread rows, and no plan could read the card
// (t195 w19e, cause 1). A record's sensitive fields are dropped as a run's
// are. One with no field left (which the wire reader already refuses, in
// `extraction/structure-detection.ts`) would be left out, and the run answered
// alone.
//
// **A list whose section links to more says so.** Circleway's Friends home
// shows four of eight friend requests under a header whose "See all" opens the
// rest; the top bar's badge says 4, and the model read the four cards as the
// whole list (live run 36, `run-muq3uozx-3153564b`, cause 11). The page now
// sends that link beside the run as `continues`
// (`apps/extension/src/content/extraction/section-link/`), and the packet
// carries it with one closed sentence. The model already sees the link in the
// page view; the sentence tells it what the link means. It is never pagination:
// the handle's binding does not follow it.
//
// **A column says where it is in the page view.** On a site styled by atomic
// classes every label is a class path that means nothing
// (`div.x0531l50 > div.x1a4yqcp`), and a model shown seven of them mapped
// `mutual` to the Confirm button's column (live run 38, `run-muqilf9s-c3211328`,
// C2). Each field now carries `at`, the handle of its element in the list's
// first item, as the model was shown it (`./first-item/`), and the packet says
// once what `at` is. The page view prints that handle's words, so no value and
// no selector is added. A field whose element cannot be told has no `at`.

import {
  WEB_AUTOMATION_EXTRACT_MAX_PAGES,
  type WebAutomationExtractFieldKind,
  type WebAutomationExtractFieldSpec,
  type WebAutomationExtractListPagination
} from "../../../actions/extraction";
import type { WebAutomationExtractionProposal, WebAutomationStructureDetection } from "../../../extraction";
import { present } from "../present";
import { screenedPageText } from "../withheld";
import { webLlmFirstItemHandles, type WebLlmFirstItemPages } from "./first-item";
import type { WebLlmExtractionBinding } from "./handles";

export const WEB_LLM_STRUCTURE_SCHEMA_VERSION = "web-llm-structure.v1" as const;

/**
 * How the list continues past what the page shows now, in words a model can
 * act on: `next_link` and `numbered_pages` are controls that move to another
 * page, `load_more_button` appends to this one, `infinite_scroll` appends as
 * the page scrolls, and `none` means nothing was detected.
 */
export const WEB_LLM_STRUCTURE_PAGINATION_MODES = ["none", "next_link", "load_more_button", "infinite_scroll", "numbered_pages"] as const;

export type WebLlmStructurePaginationMode = (typeof WEB_LLM_STRUCTURE_PAGINATION_MODES)[number];

/** What the packet says of a `record`: domain text, never the page's. */
const RECORD_NOTE = "record is the one item you aimed at, read as a one-row table; name its handle in extractList when the instruction is about that item";

/** What the packet says of `at`, once, when a field carries one: domain text. */
const AT_NOTE = "a field's at is the handle of that column's element in the first item; its line in the page view shows what the column holds";

/** What the packet says of a section's link to more: domain text around the link's closed-phrase label. */
function continuesNote(label: string): string {
  return `this section links to more items ("${label}"); the list here may be partial -- open it to read every item`;
}

export type WebLlmStructureField = {
  /** The record field key the handle's extraction writes this column under (D16). */
  key: string;
  /**
   * What the column is called: a test id, a column header, an attribute name,
   * or an icon badge's accessible name when every item that has the badge gives
   * it the same one (`apps/extension/src/content/extraction/badge-name.ts`).
   * Page structure, never a value read inside an item.
   */
  label: string;
  kind: WebAutomationExtractFieldKind;
  /** The share of items that have the field, from 0 to 1. Below 1, a record without it carries `null`. */
  coverage: number;
  /**
   * The page-view handle of the field's element in the first item, as the
   * model was last shown the page (`./first-item/`). Absent when that element
   * cannot be told or was not shown.
   */
  at?: string;
};

/** The run's own section linking to more of it, outside its items and its pagination. */
export type WebLlmStructureContinues = {
  /** The link's label, one of a closed set of phrases ("See all", "View more"). */
  label: string;
  /** The link's path on the page's origin, when it is a link. */
  path?: string;
  /** What the link means. A sentence of this module around the label. */
  note: string;
};

/** The one item the detection was aimed at, beside the run it found outward, under its own handle. */
export type WebLlmStructureRecord = {
  /** The opaque handle that names this one-item list. Copy it exactly into `extractList`. */
  handle: string;
  itemCount: number;
  fields: WebLlmStructureField[];
  /** What the record is and when to name it. A constant of this module. */
  note: string;
};

export type WebLlmRepeatingStructure = {
  schemaVersion: typeof WEB_LLM_STRUCTURE_SCHEMA_VERSION;
  trust: "untrusted-page-evidence";
  /** The page it was detected on: origin and path. */
  location: string;
  /** The opaque handle that names this structure. Copy it exactly; it addresses nothing by itself. */
  extraction: string;
  /** The observed target the detection started from, when the call named one. */
  target?: string;
  itemCount: number;
  fields: WebLlmStructureField[];
  pagination: WebLlmStructurePaginationMode;
  /** How sure the detection is, from 0 to 1. */
  confidence: number;
  /** The one item the target belongs to, when it lies outside the list above. */
  record?: WebLlmStructureRecord;
  /** The section's link to more items, when the list here may be partial. */
  continues?: WebLlmStructureContinues;
  /** What a field's `at` is. A constant of this module, present when any field, the record's included, has one. */
  atNote?: string;
};

/** A detection split into what the model sees and what each handle keeps. */
export type WebLlmStructureSplit = {
  packet: WebLlmRepeatingStructure;
  binding: WebLlmExtractionBinding;
  /** The record's binding, under `recordHandle`; absent when there is no record or none of its fields is readable. */
  recordBinding: WebLlmExtractionBinding | undefined;
};

type DetectedStructure = Extract<WebAutomationStructureDetection, { ok: true }>;

export type WebLlmStructurePacketInput = {
  detection: DetectedStructure;
  handle: string;
  /** The handle reserved for `detection.record`; ignored when the detection carries none. */
  recordHandle: string | undefined;
  location: string;
  target: string | undefined;
  frameId: number | undefined;
  /** The pathname of the child frame's document the list was detected in (`./handles.ts`). */
  frameUrlPath: string | undefined;
  /** The captures each field's `at` is found with; `undefined` gives no field one. */
  firstItem: WebLlmFirstItemPages | undefined;
};

type ReadableField = { key: string; spec: WebAutomationExtractFieldSpec; shown: WebLlmStructureField };

/**
 * The packet and the bindings, or `undefined` when no field of the run is left
 * once the sensitive ones are dropped. Each half is cut from the same list, so
 * a handle names exactly the fields the model was shown.
 */
export function splitDetectedStructure(input: WebLlmStructurePacketInput): WebLlmStructureSplit | undefined {
  const proposal = input.detection.proposal;
  const readable = readableFields(proposal, input.firstItem);
  if (readable.length === 0) return undefined;
  const infiniteScroll = input.detection.infiniteScroll === true;
  const record = input.detection.record;
  const recordReadable = record === undefined || input.recordHandle === undefined ? [] : readableFields(record, input.firstItem);
  const recordBinding = record === undefined || input.recordHandle === undefined || recordReadable.length === 0
    ? undefined
    : boundList(input, input.recordHandle, record, recordReadable, boundPagination(record.pagination, false), true);

  const packet = present<WebLlmRepeatingStructure>({
    schemaVersion: WEB_LLM_STRUCTURE_SCHEMA_VERSION,
    trust: "untrusted-page-evidence",
    location: input.location,
    extraction: input.handle,
    target: input.target,
    itemCount: proposal.itemCount,
    fields: readable.map((field) => field.shown),
    pagination: paginationMode(proposal.pagination, infiniteScroll),
    confidence: proposal.confidence,
    record: recordBinding === undefined ? undefined : {
      handle: recordBinding.handle,
      itemCount: recordBinding.itemCount,
      fields: recordReadable.map((field) => field.shown),
      note: RECORD_NOTE
    },
    continues: continuesOf(input.detection.continues),
    atNote: [...readable, ...(recordBinding === undefined ? [] : recordReadable)].some((field) => field.shown.at !== undefined) ? AT_NOTE : undefined
  });
  const paginate = boundPagination(proposal.pagination, infiniteScroll);
  // A primary proposal of one item with no way to continue is a record by
  // construction: a list needs a run of three or a record pair, so only the
  // label/value receipt and a lone record are sent with one item.
  const binding = boundList(input, input.handle, proposal, readable, paginate, proposal.itemCount === 1 && paginate === undefined);
  return { packet, binding, recordBinding };
}

/** The section link as the model is shown it, or `undefined` when the page sent none or its label screens to nothing. */
function continuesOf(continues: DetectedStructure["continues"]): WebLlmStructureContinues | undefined {
  if (continues === undefined) return undefined;
  const label = screenedPageText(continues.label);
  if (label === undefined) return undefined;
  return present<WebLlmStructureContinues>({ label, path: continues.path, note: continuesNote(label) });
}

/**
 * The proposal's fields a model may be shown and a handle may read: every one
 * not proposed `exclude`, each with its element's handle where it can be told.
 */
function readableFields(proposal: WebAutomationExtractionProposal, firstItem: WebLlmFirstItemPages | undefined): ReadableField[] {
  const at = firstItem === undefined ? new Map<string, string>() : webLlmFirstItemHandles(proposal, firstItem);
  return proposal.fields
    .filter((field) => field.spec.handling !== "exclude")
    .map((field) => ({ key: field.key, spec: field.spec, shown: shownField(field.key, field.label, field.spec.kind, field.coverage, at.get(field.key)) }));
}

/** The binding one handle keeps: the proposal's item, the readable fields under the keys shown, and its pagination. */
function boundList(
  input: WebLlmStructurePacketInput,
  handle: string,
  proposal: WebAutomationExtractionProposal,
  readable: ReadableField[],
  paginate: WebAutomationExtractListPagination | undefined,
  oneRecord: boolean
): WebLlmExtractionBinding {
  return present<WebLlmExtractionBinding>({
    handle,
    location: input.location,
    frameId: input.frameId,
    frameUrlPath: input.frameUrlPath,
    extractList: present<WebLlmExtractionBinding["extractList"]>({
      item: proposal.item,
      itemElement: undefined,
      fields: Object.fromEntries(readable.map((field) => [field.key, readableSpec(field.spec)])),
      paginate,
      maxItems: undefined,
      minItems: undefined,
      // A detection describes a list; which of its items a read wants is the
      // plan's to say, and `plan-resolution/extraction/conditions.ts` writes it there (C5).
      where: undefined,
      // Likewise which duplicates to drop and what order to return.
      dedupe: undefined,
      sort: undefined
    }),
    itemCount: proposal.itemCount,
    oneRecord: oneRecord ? true : undefined
  });
}

function shownField(key: string, label: string, kind: WebAutomationExtractFieldKind, coverage: number, at: string | undefined): WebLlmStructureField {
  return present<WebLlmStructureField>({
    key,
    // A label is page structure, but it is still page text: one line,
    // screened, and the key when nothing readable is left of it.
    label: screenedPageText(label) ?? key,
    kind,
    coverage: Math.round(coverage * 100) / 100,
    at
  });
}

/** The spec the handle keeps: the proposal's, with the handling left at its default, since every kept field is read. */
function readableSpec(spec: WebAutomationExtractFieldSpec): WebAutomationExtractFieldSpec {
  return present<WebAutomationExtractFieldSpec>({
    kind: spec.kind,
    selector: spec.selector,
    attribute: spec.attribute,
    header: spec.header,
    required: spec.required,
    handling: undefined,
    element: undefined
  });
}

function paginationMode(pagination: WebAutomationExtractListPagination | undefined, infiniteScroll: boolean): WebLlmStructurePaginationMode {
  if (pagination === undefined) return infiniteScroll ? "infinite_scroll" : "none";
  if (pagination.mode === "loadMore") return "load_more_button";
  if (pagination.mode === "numbered") return "numbered_pages";
  if (pagination.mode === "scroll") return "infinite_scroll";
  return "next_link";
}

/**
 * The pagination the handle keeps. A detected control keeps what the page
 * proposed. A feed the page only declared keeps a scroll bounded like the
 * picker bounds a control the page advertises no count for: by the domain's
 * own page bound, which the page-side reader stops short of when the feed ends.
 * A record is one item and continues nowhere, so the feed is never its.
 */
function boundPagination(pagination: WebAutomationExtractListPagination | undefined, infiniteScroll: boolean): WebAutomationExtractListPagination | undefined {
  if (pagination !== undefined) return structuredClone(pagination);
  return infiniteScroll ? { mode: "scroll", maxScrolls: WEB_AUTOMATION_EXTRACT_MAX_PAGES } : undefined;
}
