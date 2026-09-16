// What the picker proposes for a picked element (C4): the repeating list the
// element belongs to, the fields each item exposes, and how the list continues
// past its first page, for the user to confirm, rename or exclude before
// anything is recorded.
//
// A proposal holds selectors, names and counts only, never a value read from
// the page (D3). It crosses the content message channel and is shown before the
// user has decided anything, including which columns are sensitive, so it must
// be safe to show whatever the page holds.
//
// That is why a proposed field's spec cannot carry `element`. The one
// fingerprint normalizer records an element's text, value and link target,
// which are page values. The picker attaches a fingerprint when the user
// records the extraction, not when it proposes one.
//
// A column header's text is page structure rather than a sample value (D16), so
// it may be a label or a spec's `header`. The text inside an item may not be a
// label.

import type { WebAutomationExtractFieldSpec, WebAutomationExtractListPagination } from "../actions/extraction";

/** A proposed field's spec: everything a recorded spec says, except the element fingerprint, which holds page values. */
export type WebAutomationExtractionProposalFieldSpec = Omit<WebAutomationExtractFieldSpec, "element">;

export type WebAutomationExtractionProposalField = {
  /** The record field key (D16), from `webAutomationExtractionFieldKey`. */
  key: string;
  /** What the picker shows for the field: a test id, a column header, an attribute name. Never text read inside an item. */
  label: string;
  spec: WebAutomationExtractionProposalFieldSpec;
  /** The share of the run's items that have the field, from 0 to 1. */
  coverage: number;
};

export type WebAutomationExtractionProposal = {
  /** A selector for the element that holds the run. */
  container: string;
  /** The generalized item selector, which selects exactly the run's items. */
  item: string;
  /** How many items the run holds on the page as it was proposed. */
  itemCount: number;
  fields: WebAutomationExtractionProposalField[];
  /** How the list continues past this page, when a control for it was detected. `scroll` is never proposed; only the user picks it. */
  pagination?: WebAutomationExtractListPagination | undefined;
  /** How sure the inference is, from 0 to 1. */
  confidence: number;
};
