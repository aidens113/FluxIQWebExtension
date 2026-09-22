// What the Adaptations view readings mean against Core: the payload is reduced
// the way the view reads it, the history table must hold Core's first page
// with Core's statuses, the Changes tab must render Core's before/after rows,
// and a review is judged on Core, the view and the Flow graph together.

import assert from "node:assert/strict";
import test from "node:test";
import {
  ADAPTATION_UI_CODES,
  adaptationChangesResult,
  adaptationHistoryResult,
  type AdaptationReviewFacts,
  adaptationReviewVerdict,
  closedAdaptationStatus,
  coreAdaptationView,
} from "../adaptation-facts.js";

const payload = {
  status: "applied",
  subflowId: "subflow.primary",
  patch: [
    { kind: "edit_action_target", targetId: "notes", before: { selector: "#a" }, after: { selector: "#b" } },
    { kind: "edit_action_target", targetId: "name", before: { selector: "#c" }, after: { selector: "#c" } },
    { kind: "edit_action_target", targetId: "notes", before: { selector: "#a" }, after: { selector: "#d" } },
  ],
  metadata: {
    applicationRecord: { mutations: [{ before: { timeout: 1 }, after: { timeout: 2 } }] },
    phase9: { auditTotal: 3, auditEvents: [{ toStatus: "proposed" }, { toStatus: "validated" }, { toStatus: "applied" }] },
  },
};

test("Core's payload is reduced to closed statuses, sorted distinct targets and the rows each change renders", () => {
  const view = coreAdaptationView(payload);
  assert.equal(view.status, "applied");
  assert.equal(view.subflowId, "subflow.primary");
  assert.deepEqual(view.targetIds, ["name", "notes"]);
  assert.deepEqual(view.planned, [[{ path: "selector", before: "#a", after: "#b" }], [], [{ path: "selector", before: "#a", after: "#d" }]]);
  assert.deepEqual(view.applied, [[{ path: "timeout", before: "1", after: "2" }]]);
  assert.equal(view.auditTotal, 3);
  assert.deepEqual(view.auditToStatuses, ["proposed", "validated", "applied"]);
});

test("a payload without audit metadata, or no payload at all, reads as empty rather than failing", () => {
  const bare = coreAdaptationView({ status: "Proposed", patch: [] });
  assert.equal(bare.status, "proposed");
  assert.equal(bare.auditTotal, 0);
  assert.equal(coreAdaptationView(undefined).status, "unknown");
  assert.equal(closedAdaptationStatus("Submitted"), "unknown");
});

test("the planned list is the detail view's first page of eight", () => {
  const many = { patch: Array.from({ length: 10 }, (_, index) => ({ kind: "edit_expectation", targetId: `n${index}`, before: { v: index }, after: { v: index + 1 } })) };
  assert.equal(coreAdaptationView(many).planned.length, 8);
});

test("the history table must hold Core's list with Core's statuses", () => {
  const core = [{ adaptationId: "a1", status: "applied" }, { adaptationId: "a2", status: "rejected" }];
  const rows = [{ id: " a1 ", status: "applied" }, { id: "a2", status: "rejected" }];
  assert.equal(adaptationHistoryResult({ present: true, rows }, core, { a1: "applied" }).code, "adaptations.verified");
  assert.equal(adaptationHistoryResult({ present: false, rows: [] }, core).code, "adaptations.table_missing");
  assert.equal(adaptationHistoryResult({ present: true, rows }, core, { a1: "reverted" }).code, "adaptations.core_status_unexpected");
  assert.equal(adaptationHistoryResult({ present: true, rows: rows.slice(0, 1) }, core).code, "adaptations.row_count_mismatch");
  assert.equal(adaptationHistoryResult({ present: true, rows: [rows[0]!, { id: "a3", status: "rejected" }] }, core).code, "adaptations.row_missing");
  assert.equal(adaptationHistoryResult({ present: true, rows: [rows[0]!, { id: "a2", status: "applied" }] }, core).code, "adaptations.row_status_mismatch");
});

test("the Changes tab must render each change's rows, and a change with nothing to show fails when rows are required", () => {
  const view = coreAdaptationView(payload);
  const reading = { present: true, planned: view.planned, applied: view.applied };
  assert.deepEqual(adaptationChangesResult(reading, view, true), { code: "adaptations.verified", facts: { plannedCards: 3, plannedRows: 2, appliedCards: 1, appliedRows: 1, mismatchedCards: 0 } });
  assert.equal(adaptationChangesResult({ ...reading, present: false }, view, true).code, "adaptations.changes_missing");
  assert.equal(adaptationChangesResult({ ...reading, applied: [] }, view, true).code, "adaptations.changes_mismatch");
  assert.equal(adaptationChangesResult({ ...reading, planned: [[{ path: "selector", before: "#a", after: "#x" }], [], view.planned[2]!] }, view, true).code, "adaptations.changes_mismatch");
  const empty = coreAdaptationView({ patch: [{ kind: "edit_action_target", targetId: "n", before: 1, after: 1 }] });
  assert.equal(adaptationChangesResult({ present: true, planned: [[]], applied: [] }, empty, true).code, "adaptations.changes_empty");
  assert.equal(adaptationChangesResult({ present: true, planned: [[]], applied: [] }, empty, false).code, "adaptations.verified");
});

function review(action: AdaptationReviewFacts["action"], overrides: Partial<AdaptationReviewFacts> = {}): AdaptationReviewFacts {
  const status = ({ approve: "validated", apply: "applied", revert: "reverted", reject: "rejected" } as const)[action];
  const moves = action === "apply" || action === "revert";
  return {
    action, actionOffered: true, httpOk: true,
    statusBefore: "proposed", statusAfter: status, detailStatus: status, rowStatus: status,
    auditTotalBefore: 2, auditTotalAfter: 3, auditEventsToStatusAdded: 1, renderedAuditTotal: 3, reopenedAuditTotal: 3,
    targetNodes: 1, targetDigestBefore: "before", targetDigestAfter: moves ? "after" : "before",
    ...overrides,
  };
}

test("a review that changed Core, the view and the graph as its action requires is verified", () => {
  for (const action of ["approve", "apply", "revert", "reject"] as const) assert.equal(adaptationReviewVerdict(review(action)), "adaptations.verified", action);
  assert.equal(adaptationReviewVerdict(review("revert", { targetDigestAfter: "restored" }), "restored"), "adaptations.verified");
});

test("each failed review check maps to its own code, the stale in-place audit count last", () => {
  const cases: Array<[string, AdaptationReviewFacts, string?]> = [
    ["adaptations.action_unavailable", review("revert", { actionOffered: false })],
    ["adaptations.review_refused", review("apply", { httpOk: false })],
    ["adaptations.review_status_mismatch", review("reject", { statusAfter: "proposed" })],
    ["adaptations.review_ui_stale", review("approve", { rowStatus: "proposed" })],
    ["adaptations.audit_event_missing", review("approve", { auditTotalAfter: 2 })],
    ["adaptations.audit_ui_mismatch", review("approve", { reopenedAuditTotal: 0 })],
    ["adaptations.graph_unchanged", review("apply", { targetDigestAfter: "before" })],
    ["adaptations.graph_changed_unexpectedly", review("reject", { targetDigestAfter: "moved" })],
    ["adaptations.revert_not_restored", review("revert"), "the pre-apply digest"],
    ["adaptations.audit_stale_after_review", review("revert", { renderedAuditTotal: 0 })],
  ];
  for (const [code, facts, restored] of cases) assert.equal(adaptationReviewVerdict(facts, restored), code, code);
  assert.equal(adaptationReviewVerdict(review("apply", { renderedAuditTotal: 0, targetDigestAfter: "before" })), "adaptations.graph_unchanged");
  const reviewCodes = new Set(cases.map(([code]) => code));
  for (const code of ["adaptations.action_unavailable", "adaptations.review_refused", "adaptations.audit_stale_after_review"]) assert.ok(ADAPTATION_UI_CODES.includes(code as never), code);
  assert.equal(reviewCodes.size, cases.length);
});
