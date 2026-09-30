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

import {
  WEB_AUTOMATION_EXTRACT_MAX_PAGES,
  type WebAutomationExtractFieldKind,
  type WebAutomationExtractFieldSpec,
  type WebAutomationExtractListPagination
} from "../../../actions/extraction";
import type { WebAutomationStructureDetection } from "../../../extraction";
import { present } from "../present";
import { screenedPageText } from "../withheld";
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
};

/** A detection split into what the model sees and what the handle keeps. */
export type WebLlmStructureSplit = {
  packet: WebLlmRepeatingStructure;
  binding: WebLlmExtractionBinding;
};

type DetectedStructure = Extract<WebAutomationStructureDetection, { ok: true }>;

export type WebLlmStructurePacketInput = {
  detection: DetectedStructure;
  handle: string;
  location: string;
  target: string | undefined;
  frameId: number | undefined;
};

/**
 * The packet and the binding, or `undefined` when no field is left once the
 * sensitive ones are dropped. Both halves are cut from the same list, so the
 * handle names exactly the fields the model was shown.
 */
export function splitDetectedStructure(input: WebLlmStructurePacketInput): WebLlmStructureSplit | undefined {
  const proposal = input.detection.proposal;
  const readable = proposal.fields
    .filter((field) => field.spec.handling !== "exclude")
    .map((field) => ({ key: field.key, spec: field.spec, shown: shownField(field.key, field.label, field.spec.kind, field.coverage) }));
  if (readable.length === 0) return undefined;

  const packet = present<WebLlmRepeatingStructure>({
    schemaVersion: WEB_LLM_STRUCTURE_SCHEMA_VERSION,
    trust: "untrusted-page-evidence",
    location: input.location,
    extraction: input.handle,
    target: input.target,
    itemCount: proposal.itemCount,
    fields: readable.map((field) => field.shown),
    pagination: paginationMode(proposal.pagination, input.detection.infiniteScroll === true),
    confidence: proposal.confidence
  });

  const paginate = boundPagination(proposal.pagination, input.detection.infiniteScroll === true);
  const binding = present<WebLlmExtractionBinding>({
    handle: input.handle,
    location: input.location,
    frameId: input.frameId,
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
    itemCount: proposal.itemCount
  });
  return { packet, binding };
}

function shownField(key: string, label: string, kind: WebAutomationExtractFieldKind, coverage: number): WebLlmStructureField {
  return {
    key,
    // A label is page structure, but it is still page text: one line,
    // screened, and the key when nothing readable is left of it.
    label: screenedPageText(label) ?? key,
    kind,
    coverage: Math.round(coverage * 100) / 100
  };
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
 */
function boundPagination(pagination: WebAutomationExtractListPagination | undefined, infiniteScroll: boolean): WebAutomationExtractListPagination | undefined {
  if (pagination !== undefined) return structuredClone(pagination);
  return infiniteScroll ? { mode: "scroll", maxScrolls: WEB_AUTOMATION_EXTRACT_MAX_PAGES } : undefined;
}
