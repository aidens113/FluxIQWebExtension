// Detecting a repeating structure on request, for Flow authoring: the flag the
// domain's authoring runtime sends on `web.dom.capture_snapshot`, and what the
// page answers beside the snapshot.
//
// It is the picker's inference (C4) reached without a person picking. A model
// authoring a Flow names an element it was shown -- or nothing, meaning "the
// page's largest readable list" -- and the page answers with the same proposal
// the picker would make: the item selector, the fields and how the list
// continues. The selectors stay in the domain; the model is given an opaque
// handle for them (`runtime/llm-evidence/structure/`).
//
// Why a flag on the snapshot rather than an action of its own: every action
// type is also an executable output node (`output-nodes/definitions.ts`), and
// this is not something a Flow should run. It only observes, it answers only
// the authoring runtime that asks through the gateway, and a Flow's
// `capture_snapshot` node sends no parameters (`output-nodes/payloads.ts`), so
// a Flow cannot reach it.
//
// A proposal holds selectors, labels built from page structure, counts and
// coverage, never a value read from the page (D3). The copy below admits
// nothing else: it rebuilds the result field by field, so a producer that put
// page text beside a proposal sends none of it.

import { webAutomationExtractListRequestValue, type WebAutomationExtractListPagination } from "../actions/extraction";
import type { WebAutomationExtractionProposal, WebAutomationExtractionProposalField } from "./proposal";

/** `web.dom.capture_snapshot`'s request to detect a repeating structure as well. */
export type WebAutomationStructureDetectionRequest = {
  /**
   * An element inside the structure, resolved in the frame the capture runs in.
   * It may match several elements, provided they all sit in one run. Absent,
   * the page's largest readable repeating run is detected instead.
   */
  selector?: string | undefined;
};

/**
 * Why no structure was detected, as a fact about the page:
 * `target_not_found`, the selector names nothing in this frame;
 * `ambiguous_target`, the selector names several elements that are not all in
 * the one run, so which structure was meant cannot be told;
 * `no_repeating_run`, nothing there repeats in a way a selector can name and a
 * field can be read from; `sensitive_region`, the element sits inside a
 * sensitive control, or every field the run exposes is one (D2, D12).
 */
export const WEB_AUTOMATION_STRUCTURE_DETECTION_REFUSALS = ["target_not_found", "ambiguous_target", "no_repeating_run", "sensitive_region"] as const;

export type WebAutomationStructureDetectionRefusal = (typeof WEB_AUTOMATION_STRUCTURE_DETECTION_REFUSALS)[number];

/**
 * What the page detected.
 *
 * `infiniteScroll` is carried beside the proposal rather than inside its
 * `pagination`, because the proposal contract never proposes `scroll`: the
 * picker leaves that to the person. It is set only when the page itself says
 * the list is a feed -- the ARIA feed pattern -- and no pagination control was
 * found, so an ordinary list that happens to end is never reported as one.
 */
export type WebAutomationStructureDetection =
  | { ok: true; proposal: WebAutomationExtractionProposal; infiniteScroll?: true | undefined }
  | { ok: false; refused: WebAutomationStructureDetectionRefusal };

/** The request copied, or `undefined` when it is not one. A selector that is sent must be a non-empty string. */
export function webAutomationStructureDetectionRequestValue(value: unknown): WebAutomationStructureDetectionRequest | undefined {
  const request = record(value);
  if (!request || Object.keys(request).some((key) => key !== "selector")) return undefined;
  if (request.selector === undefined) return {};
  return typeof request.selector === "string" && request.selector.trim() !== "" ? { selector: request.selector } : undefined;
}

/**
 * The detection copied field by field, or `undefined` when any part of it is
 * not well formed. A proposal is well formed when its item, its fields and its
 * pagination read as a `web.dom.extract_list` request -- the same reader the
 * parameter lift refuses a Flow's request by -- so a handle can never stand for
 * a request the page would refuse.
 */
export function webAutomationStructureDetectionValue(value: unknown): WebAutomationStructureDetection | undefined {
  const detection = record(value);
  if (!detection) return undefined;
  if (detection.ok === false) {
    const refused = WEB_AUTOMATION_STRUCTURE_DETECTION_REFUSALS.find((code) => code === detection.refused);
    return refused === undefined ? undefined : { ok: false, refused };
  }
  if (detection.ok !== true) return undefined;
  if (detection.infiniteScroll !== undefined && detection.infiniteScroll !== true) return undefined;
  const proposal = proposalValue(detection.proposal);
  if (!proposal) return undefined;
  return detection.infiniteScroll === true ? { ok: true, proposal, infiniteScroll: true } : { ok: true, proposal };
}

function proposalValue(value: unknown): WebAutomationExtractionProposal | undefined {
  const proposal = record(value);
  if (!proposal || typeof proposal.container !== "string" || proposal.container === "") return undefined;
  if (!Array.isArray(proposal.fields) || proposal.fields.length === 0) return undefined;
  const itemCount = count(proposal.itemCount);
  const confidence = unitInterval(proposal.confidence);
  const fields = proposal.fields.map(fieldValue);
  if (itemCount === undefined || confidence === undefined) return undefined;
  const named = fields.filter((field): field is ProposedField => field !== undefined);
  if (named.length !== fields.length || new Set(named.map((field) => field.key)).size !== named.length) return undefined;
  // One request of every field at once. It refuses a malformed spec, a
  // malformed pagination, and a run whose every field is excluded -- which the
  // page answers as `sensitive_region` rather than as a proposal.
  const request = webAutomationExtractListRequestValue({
    item: proposal.item,
    fields: Object.fromEntries(named.map((field) => [field.key, field.spec])),
    paginate: proposal.pagination
  });
  if (!request) return undefined;
  const copied: WebAutomationExtractionProposalField[] = [];
  for (const field of named) {
    const spec = request.fields[field.key];
    if (spec === undefined || typeof spec === "string") return undefined;
    copied.push({ key: field.key, label: field.label, spec, coverage: field.coverage });
  }
  const pagination: WebAutomationExtractListPagination | undefined = request.paginate;
  return pagination === undefined
    ? { container: proposal.container, item: request.item, itemCount, fields: copied, confidence }
    : { container: proposal.container, item: request.item, itemCount, fields: copied, pagination, confidence };
}

/** A proposed field before its spec is read. The spec is read with every other field's, by the request reader. */
type ProposedField = { key: string; label: string; spec: Record<string, unknown>; coverage: number };

/**
 * One proposed field's own parts. `element` is refused here, before the
 * request reader sees the spec, because a proposal never carries one: it holds
 * page values (`proposal.ts`).
 */
function fieldValue(value: unknown): ProposedField | undefined {
  const field = record(value);
  const spec = record(field?.spec);
  if (!field || !spec || spec.element !== undefined) return undefined;
  if (typeof field.key !== "string" || typeof field.label !== "string") return undefined;
  const coverage = unitInterval(field.coverage);
  return coverage === undefined ? undefined : { key: field.key, label: field.label, spec, coverage };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function count(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function unitInterval(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : undefined;
}
