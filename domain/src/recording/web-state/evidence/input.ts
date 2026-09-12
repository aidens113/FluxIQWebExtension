// What a DOM snapshot offers this projection, and how it is got at.
//
// The shape is no longer stated here. It used to be -- the structure audit
// forbids `domain/src` importing `apps/extension/src`, so the domain restated
// the wire shape it expected and the two sides were kept in step by nothing but
// care. They came apart three times in one plan. The contract now lives in
// `domain/src/page-evidence/`, which both sides import: the producer through
// `apps/extension/src/content/evidence/types.ts`, this projection through the
// type below, whose keys are the contract's keys rather than a copy of them.
//
// ## The truncation rule, and every limit it governs
//
// This is the canonical statement for the whole evidence path; every other
// site carries a pointer here and the meaning of its own limit. It exists
// because three workers independently added a flag called `truncated` to this
// path in one wave, and a reader who found one could not tell which limit had
// bitten -- and the four limits have four different remedies.
//
// **The rule.** A bare `truncated` is legal only *inside* the structure whose
// own cap set it, beside that structure's counts, where the structure names
// the limit. Anywhere a flag would summarise more than one cap it is named for
// the cap instead, and the summary keeps the bare name so a consumer asking
// only "did I get everything" still has one question to ask.
//
// | Limit | Flag naming it | Set when | What is missing | Remedy |
// | --- | --- | --- | --- | --- |
// | The browser capture's element cap | `captureTruncated` | `evidence.elements.matched > evidence.elements.returned` | Elements never left the page | Capture less of the page: one frame, one region |
// | The state projection's element cap (`MAX_STATE_ELEMENTS`) | `stateTruncated` | More elements were worth capturing than `filterStateElements` kept | Eligible elements are absent from `elements.*` | Raise the cap, or narrow what is recorded |
// | A per-collection cap in this projection | the collection's own `truncated`, beside its `count` | `count` exceeds the collection's cap | Items of one evidence collection | Read `count` for the true total; the kept items are the first in declaration order |
// | The sanitized packet's element bound and byte budget | `elementsTruncated`, `budgetTruncated` | `runtime/llm-evidence/sanitize.ts` | Elements and page facts the model never saw | Re-ask with a larger budget, or narrow the page first |
//
// The state paths written from the first two are `elements.captureTruncated`
// and `elements.stateTruncated`, with `elements.truncated` as the summary of
// the two. `evidence.elements.truncated` mirrors the browser's own flag
// unchanged, which is the first row read at its source.

import type { WebAutomationPageEvidence, WebAutomationSnapshotElementTotals } from "../../../page-evidence";
import { record } from "./read";

/**
 * The page evidence as it arrives from the browser: the contract's item names,
 * and nothing said about any item's contents.
 *
 * Derived from `WebAutomationPageEvidence` rather than written out, so the
 * projection cannot come to read an item the producer does not send -- add or
 * rename an item in the contract and this type changes with it. Every value is
 * `unknown` and every key optional because this comes off a wire from a page: a
 * content script older than the domain reading it sends fewer items, and
 * nothing about their contents may be assumed. `read.ts` turns each into
 * something or into nothing.
 */
export type WebAutomationPageEvidenceInput = { [K in keyof WebAutomationPageEvidence]?: unknown };

/** Just enough of a snapshot to find the evidence on it, in the contract's own spelling. */
type SnapshotCarryingEvidence = { evidence?: WebAutomationPageEvidence | undefined };

/**
 * The page evidence on a DOM snapshot, or `undefined` when it carries none.
 *
 * `WebAutomationDomSnapshotInput` declares only the six fields the projection
 * read before this directory existed, so the field is reached through a narrow
 * read rather than through the declared type -- but the key it reads is the
 * contract's, not a string this file chose.
 */
export function pageEvidenceOfSnapshot(snapshot: unknown): WebAutomationPageEvidenceInput | undefined {
  return record<WebAutomationPageEvidence>(record<SnapshotCarryingEvidence>(snapshot)?.evidence);
}

/**
 * Whether the browser reported that its own element cap dropped elements --
 * the `captureTruncated` row of the table above.
 *
 * Read on its own because it is one of the two limits `snapshot.ts` writes as
 * its own state path: this one says elements never left the page, which is a
 * different fact with a different remedy from the projection's cap, and a
 * consumer that could only see the two ORed together could not act on either.
 */
export function pageEvidenceTruncatedElements(evidence: WebAutomationPageEvidenceInput | undefined): boolean {
  return record<WebAutomationSnapshotElementTotals>(evidence?.elements)?.truncated === true;
}
