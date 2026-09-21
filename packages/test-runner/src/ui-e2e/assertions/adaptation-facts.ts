// The pure half of the adaptation assertions: Core's adaptation payload reduced
// to what the Adaptations view presents, and the verdicts that compare it with
// what the view rendered. Raw strings read from the page come in; one closed
// code, closed statuses, counts and booleans go out.

import { adaptationChangedFieldRows, type ChangedFieldRow } from "./changed-fields.js";

export const ADAPTATION_UI_CODES = [
  "adaptations.verified",
  "adaptations.table_missing",
  "adaptations.row_missing",
  "adaptations.row_count_mismatch",
  "adaptations.row_status_mismatch",
  "adaptations.core_status_unexpected",
  "adaptations.changes_missing",
  "adaptations.changes_empty",
  "adaptations.changes_mismatch",
  "adaptations.action_unavailable",
  "adaptations.review_refused",
  "adaptations.review_status_mismatch",
  "adaptations.review_ui_stale",
  "adaptations.audit_event_missing",
  "adaptations.audit_ui_mismatch",
  "adaptations.graph_unchanged",
  "adaptations.graph_changed_unexpectedly",
  "adaptations.revert_not_restored",
  "adaptations.audit_stale_after_review",
] as const;
export type AdaptationUiCode = typeof ADAPTATION_UI_CODES[number];

const STATUSES = ["proposed", "testing", "validated", "applied", "rejected", "disabled", "reverted", "superseded"] as const;
export type AdaptationStatus = typeof STATUSES[number] | "unknown";
export type AdaptationReviewAction = "approve" | "apply" | "revert" | "reject";

/** The detail views page their lists at this size (Core `ADAPTATION_DETAIL_PAGE_SIZE`). */
const DETAIL_PAGE_SIZE = 8;
/** The Adaptations table pages at this size (Core `ADAPTATION_PAGE_SIZE`). */
const TABLE_PAGE_SIZE = 25;

/** An adaptation as Core serves it to the panel, reduced to what the assertions compare. */
export type CoreAdaptationView = {
  status: AdaptationStatus;
  subflowId?: string;
  targetIds: string[];
  planned: ChangedFieldRow[][];
  applied: ChangedFieldRow[][];
  auditTotal: number;
  auditToStatuses: AdaptationStatus[];
};

export function closedAdaptationStatus(value: unknown): AdaptationStatus {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (STATUSES as readonly string[]).includes(text) ? text as AdaptationStatus : "unknown";
}

/** Reads the `adaptation` of a `get-flow-adaptation` payload the way the Adaptations view reads it. */
export function coreAdaptationView(raw: unknown): CoreAdaptationView {
  const adaptation = record(raw);
  const metadata = record(adaptation.metadata);
  const phase9 = record(metadata.phase9);
  const patch = Array.isArray(adaptation.patch) ? adaptation.patch.map(record) : [];
  const application = record(metadata.applicationRecord);
  const mutations = Array.isArray(application.mutations) ? application.mutations.map(record) : [];
  const auditEvents = Array.isArray(phase9.auditEvents) ? phase9.auditEvents.map(record) : [];
  return {
    status: closedAdaptationStatus(adaptation.status),
    ...(typeof adaptation.subflowId === "string" && adaptation.subflowId ? { subflowId: adaptation.subflowId } : {}),
    targetIds: [...new Set(patch.flatMap(item => typeof item.targetId === "string" && item.targetId ? [item.targetId] : []))].sort(),
    planned: patch.slice(0, DETAIL_PAGE_SIZE).map(item => adaptationChangedFieldRows(item.before, item.after)),
    applied: mutations.map(item => adaptationChangedFieldRows(item.before, item.after)),
    auditTotal: typeof phase9.auditTotal === "number" && Number.isSafeInteger(phase9.auditTotal) ? phase9.auditTotal : auditEvents.length,
    auditToStatuses: auditEvents.map(event => closedAdaptationStatus(event.toStatus)),
  };
}

export type AdaptationTableReading = { present: boolean; rows: ReadonlyArray<{ id: string; status: string }> };
export type AdaptationHistoryFacts = { coreCount: number; rowCount: number; missingRows: number; statusMismatches: number; expectedMismatches: number };

/** The Adaptations table against Core's list: every row Core would show on the first page, with Core's status. */
export function adaptationHistoryResult(
  reading: AdaptationTableReading,
  core: ReadonlyArray<{ adaptationId: string; status: string }>,
  expected: Readonly<Record<string, AdaptationStatus>> = {},
): { code: AdaptationUiCode; facts: AdaptationHistoryFacts } {
  const rendered = new Map(reading.rows.map(row => [row.id.trim(), closedAdaptationStatus(row.status)]));
  const visible = core.slice(0, TABLE_PAGE_SIZE);
  const facts = {
    coreCount: core.length,
    rowCount: reading.rows.length,
    missingRows: visible.filter(item => !rendered.has(item.adaptationId)).length,
    statusMismatches: visible.filter(item => rendered.has(item.adaptationId) && rendered.get(item.adaptationId) !== closedAdaptationStatus(item.status)).length,
    expectedMismatches: Object.entries(expected).filter(([id, status]) => closedAdaptationStatus(core.find(item => item.adaptationId === id)?.status) !== status).length,
  };
  const code: AdaptationUiCode = !reading.present ? "adaptations.table_missing"
    : facts.expectedMismatches > 0 ? "adaptations.core_status_unexpected"
    : facts.rowCount !== Math.min(facts.coreCount, TABLE_PAGE_SIZE) ? "adaptations.row_count_mismatch"
    : facts.missingRows > 0 ? "adaptations.row_missing"
    : facts.statusMismatches > 0 ? "adaptations.row_status_mismatch"
    : "adaptations.verified";
  return { code, facts };
}

export type AdaptationChangesReading = { present: boolean; planned: ChangedFieldRow[][]; applied: ChangedFieldRow[][] };
export type AdaptationChangesFacts = { plannedCards: number; plannedRows: number; appliedCards: number; appliedRows: number; mismatchedCards: number };

/** The Changes tab against Core: each planned change's table, then each applied mutation's, row for row. */
export function adaptationChangesResult(reading: AdaptationChangesReading, core: CoreAdaptationView, requireFieldRows: boolean): { code: AdaptationUiCode; facts: AdaptationChangesFacts } {
  const mismatched = (rendered: ChangedFieldRow[][], expected: ChangedFieldRow[][]) => {
    const cards = Math.max(rendered.length, expected.length);
    let count = 0;
    for (let index = 0; index < cards; index += 1) {
      if (JSON.stringify(rendered[index] ?? null) !== JSON.stringify(expected[index] ?? null)) count += 1;
    }
    return count;
  };
  const facts = {
    plannedCards: reading.planned.length,
    plannedRows: reading.planned.reduce((total, card) => total + card.length, 0),
    appliedCards: reading.applied.length,
    appliedRows: reading.applied.reduce((total, card) => total + card.length, 0),
    mismatchedCards: mismatched(reading.planned, core.planned) + mismatched(reading.applied, core.applied),
  };
  const code: AdaptationUiCode = !reading.present ? "adaptations.changes_missing"
    : requireFieldRows && core.planned.every(card => card.length === 0) ? "adaptations.changes_empty"
    : facts.mismatchedCards > 0 ? "adaptations.changes_mismatch"
    : "adaptations.verified";
  return { code, facts };
}

/** One review action as measured on both sides. */
export type AdaptationReviewFacts = {
  action: AdaptationReviewAction;
  actionOffered: boolean;
  httpOk: boolean;
  statusBefore: AdaptationStatus;
  statusAfter: AdaptationStatus;
  detailStatus: AdaptationStatus;
  rowStatus: AdaptationStatus;
  auditTotalBefore: number;
  auditTotalAfter: number;
  auditEventsToStatusAdded: number;
  /** The Audit tab's event count in place, straight after the review answered. */
  renderedAuditTotal: number | null;
  /** The Audit tab's event count once the view has loaded the adaptation afresh. */
  reopenedAuditTotal: number | null;
  targetNodes: number;
  targetDigestBefore: string;
  targetDigestAfter: string;
};

export const REVIEW_RESULT_STATUS: Readonly<Record<AdaptationReviewAction, AdaptationStatus>> = {
  approve: "validated",
  apply: "applied",
  revert: "reverted",
  reject: "rejected",
};

export function adaptationReviewVerdict(facts: AdaptationReviewFacts, restoredDigest?: string): AdaptationUiCode {
  const expected = REVIEW_RESULT_STATUS[facts.action];
  if (!facts.actionOffered) return "adaptations.action_unavailable";
  if (!facts.httpOk) return "adaptations.review_refused";
  if (facts.statusAfter !== expected) return "adaptations.review_status_mismatch";
  if (facts.detailStatus !== expected || facts.rowStatus !== expected) return "adaptations.review_ui_stale";
  if (facts.auditTotalAfter <= facts.auditTotalBefore || facts.auditEventsToStatusAdded < 1) return "adaptations.audit_event_missing";
  if (facts.reopenedAuditTotal !== facts.auditTotalAfter) return "adaptations.audit_ui_mismatch";
  const graphChanged = facts.targetDigestAfter !== facts.targetDigestBefore;
  if ((facts.action === "apply" || facts.action === "revert") && !graphChanged) return "adaptations.graph_unchanged";
  if ((facts.action === "approve" || facts.action === "reject") && graphChanged) return "adaptations.graph_changed_unexpectedly";
  if (facts.action === "revert" && restoredDigest !== undefined && facts.targetDigestAfter !== restoredDigest) return "adaptations.revert_not_restored";
  // Checked last, so every check above reports on its own: the persisted trail
  // is right, but the view showed a different count until it was reopened.
  if (facts.renderedAuditTotal !== facts.auditTotalAfter) return "adaptations.audit_stale_after_review";
  return "adaptations.verified";
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
