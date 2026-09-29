// The extraction panel's state, as pure data: the draft a user edits between
// picking an example item and confirming the extraction.
//
// Nothing here touches the DOM, `chrome`, or a message channel, so the whole of
// what the panel decides -- which columns are read, what they are called, and
// which are excluded -- is testable in Node.
//
// The draft holds no value read from the page. A proposal carries selectors,
// names and counts only (D3), and the preview rows the panel shows are held
// beside the draft rather than inside it (`preview.ts`), so an edit here can
// never carry a page value forward into the confirm payload.
//
// **D12 lives in `stale`.** A column the user excludes is marked stale forever,
// not just while it is excluded. Un-excluding it therefore does not bring its
// previously-read values back on screen: they were dropped when it was
// excluded, and the column stays blank until the extraction is run. The same
// mark covers a column whose kind the user changed, whose old values no longer
// describe what it now reads.

import type { WebAutomationExtractFieldKind, WebAutomationExtractionProposal, WebAutomationExtractionProposalField, WebAutomationExtractListPagination } from "@fluxiq-web-extension/domain/client";

/** What becomes of a column. `encrypt` (D13) is reserved for Week 3 and is not offered here. */
export type ExtractionFieldHandling = "include" | "exclude";

/** One editable column in the panel. */
export type ExtractionFieldRow = {
  /** The key the proposal gave the field. It never changes, so it names the column in a preview row however the user renames it. */
  sourceKey: string;
  /** The name the user sees, and the name the record key is derived from at confirm time. */
  label: string;
  kind: WebAutomationExtractFieldKind;
  /** Where inside an item the value is read; absent, the item itself. */
  selector?: string | undefined;
  attribute?: string | undefined;
  header?: string | undefined;
  required?: boolean | undefined;
  handling: ExtractionFieldHandling;
  /** The share of the run's items that have the field, from 0 to 1. */
  coverage: number;
  /** `true` when the picker pre-selected Exclude because the element or its control carries the sensitivity signature. */
  sensitive: boolean;
  /** `true` once the column has been excluded or its kind changed, so no preview value may be shown for it. */
  stale: boolean;
};

/** Everything the user is editing before confirming. */
export type ExtractionDraft = {
  /** The name the dataset is saved under. */
  label: string;
  /** The generalized item selector, exactly as proposed. */
  item: string;
  /** How many items the list held on the page as it was proposed. */
  itemCount: number;
  fields: ExtractionFieldRow[];
  /** How the list continues past this page, when the picker detected a control for it. */
  pagination?: WebAutomationExtractListPagination | undefined;
  /** `true` to follow that control. Off by default: reading one page is the smaller promise. */
  paginate: boolean;
};

/** The draft a proposal opens with: every column included except the ones the picker marked sensitive, which open excluded (D12). */
export function extractionDraftFromProposal(proposal: WebAutomationExtractionProposal, label: string): ExtractionDraft {
  return {
    label,
    item: proposal.item,
    itemCount: proposal.itemCount,
    fields: proposal.fields.map(fieldRow),
    pagination: proposal.pagination,
    paginate: false
  };
}

/** The same draft with `sourceKey` renamed. The record key is derived at confirm time, so renaming cannot collide here. */
export function renameExtractionField(draft: ExtractionDraft, sourceKey: string, label: string): ExtractionDraft {
  return mapField(draft, sourceKey, (field) => ({ ...field, label }));
}

/** The same draft without `sourceKey`. A removed column is absent from the request; an excluded one stays in it, so detection does not propose it again (D12). */
export function removeExtractionField(draft: ExtractionDraft, sourceKey: string): ExtractionDraft {
  return { ...draft, fields: draft.fields.filter((field) => field.sourceKey !== sourceKey) };
}

/** The same draft with `sourceKey` included or excluded. Excluding marks the column stale for good, so no value already read for it can be shown again. */
export function setExtractionFieldHandling(draft: ExtractionDraft, sourceKey: string, handling: ExtractionFieldHandling): ExtractionDraft {
  return mapField(draft, sourceKey, (field) => ({ ...field, handling, stale: field.stale || handling === "exclude" }));
}

/** The same draft with `sourceKey` reading something else. Its previewed values described the old read, so the column is marked stale. */
export function setExtractionFieldKind(draft: ExtractionDraft, sourceKey: string, kind: WebAutomationExtractFieldKind): ExtractionDraft {
  return mapField(draft, sourceKey, (field) => (field.kind === kind ? field : { ...field, kind, stale: true }));
}

/** The same draft reading one page or every page. */
export function setExtractionPaginate(draft: ExtractionDraft, paginate: boolean): ExtractionDraft {
  return { ...draft, paginate };
}

/**
 * The kinds `field` may be switched to without asking the user for anything
 * else: text, a link's target and a control's value are all readable from the
 * element the picker already named, while an attribute needs an attribute name
 * and a table column needs a header, so each is offered only when the proposal
 * supplied one.
 */
export function extractionFieldKindOptions(field: ExtractionFieldRow): WebAutomationExtractFieldKind[] {
  const kinds: WebAutomationExtractFieldKind[] = ["text", "link", "value"];
  if (field.attribute !== undefined) kinds.push("attribute");
  if (field.header !== undefined) kinds.push("column");
  return kinds.includes(field.kind) ? kinds : [...kinds, field.kind];
}

function fieldRow(field: WebAutomationExtractionProposalField): ExtractionFieldRow {
  const sensitive = field.spec.handling === "exclude";
  return {
    sourceKey: field.key,
    label: field.label,
    kind: field.spec.kind,
    selector: field.spec.selector,
    attribute: field.spec.attribute,
    header: field.spec.header,
    required: field.spec.required,
    handling: sensitive ? "exclude" : "include",
    coverage: field.coverage,
    sensitive,
    stale: sensitive
  };
}

function mapField(draft: ExtractionDraft, sourceKey: string, edit: (field: ExtractionFieldRow) => ExtractionFieldRow): ExtractionDraft {
  return { ...draft, fields: draft.fields.map((field) => (field.sourceKey === sourceKey ? edit(field) : field)) };
}
