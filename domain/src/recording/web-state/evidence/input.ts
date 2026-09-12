// What a DOM snapshot offers this projection, and how it is got at.
//
// The shape is declared here rather than in `web-state/types.ts` for the same
// reason `WebAutomationElementStateInput` is declared there rather than
// imported from the extension: the structure audit forbids `domain/src`
// importing `apps/extension/src`, so the domain states the wire shape it
// expects and the two sides are kept in step by tests rather than by the
// compiler. `apps/extension/src/content/evidence/types.ts` is the producer's
// side of the same contract.

import { record } from "./read";

/**
 * The page evidence as it arrives from the browser.
 *
 * Every field is optional and every one is loosely typed, because this comes
 * off a wire from a page: a content script older than the domain reading it
 * sends fewer fields, and nothing about the rest may be assumed. `read.ts`
 * turns each into something or into nothing.
 */
export type WebAutomationPageEvidenceInput = {
  elements?: Record<string, unknown> | undefined;
  loading?: Record<string, unknown> | undefined;
  navigation?: Record<string, unknown> | undefined;
  dialogs?: Record<string, unknown> | undefined;
  overlays?: Record<string, unknown> | undefined;
  regions?: unknown[] | undefined;
  repeating?: unknown[] | undefined;
  forms?: unknown[] | undefined;
};

/**
 * The page evidence on a DOM snapshot, or `undefined` when it carries none.
 *
 * `WebAutomationDomSnapshotInput` declares only the six fields the projection
 * read before this directory existed, so the field is reached through a narrow
 * read rather than through the declared type.
 */
export function pageEvidenceOfSnapshot(snapshot: unknown): WebAutomationPageEvidenceInput | undefined {
  return record(record(snapshot)?.evidence) as WebAutomationPageEvidenceInput | undefined;
}

/**
 * Whether the browser reported that its own element cap dropped elements.
 *
 * Read on its own because `snapshot.ts` folds it into `elements.truncated`
 * before the evidence is projected: the question that path answers is whether
 * the element list can be trusted to be the page, and either cap firing is
 * enough to answer no.
 */
export function pageEvidenceTruncatedElements(evidence: WebAutomationPageEvidenceInput | undefined): boolean {
  return record(evidence?.elements)?.truncated === true;
}
