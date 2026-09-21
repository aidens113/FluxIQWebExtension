# Bootstrap Generation No-Proposal Investigation

Status: Active
Status detail: Read-once diagnostics now expose `flow_bootstrap.permission_required`; the missing explicit UI permission-confirm/reissue continuation is being implemented and live-tested.
Created: 2026-09-20
Last updated: 2026-09-20
Owner: Senior supervisor agent
Scope: Diagnose and fix the first closed boundary that turns a successful model-backed Flow bootstrap request into zero durable proposals, then rerun that same live UI path before focused tests.
Paired document: none
Related: [Week 2 automation loop](./mvp-week2-automation-loop-plan.md), [fresh UI repair report](./mvp-week2-automation-loop-plan/reports/w2-fresh-ui-repair-cycle.md)

---

## Current State

Current t027 production code created a fresh isolated workspace through the
real panel, provisioned the existing provider key through the documented UI,
accepted the high-token confirmation, and completed two live browser evidence
actions. The generation endpoint returned HTTP 200 with `responseOk: true` and
no visible generic error. Immediate provider-free inspection nevertheless
found `proposedCount: 0`, `bootstrap: false`, `providerMatches: false`, and
`modelMatches: false`.

The original driver read the Playwright response twice, so Core's closed
failure envelope was lost after the first parse. The read-once sanitizer fix is
live-proven and supervisor-verified. One identical rerun now reports
`flow_bootstrap.permission_required`: one provider invocation, three decisions
and tool calls, two successful evidence actions, 2,087 evidence bytes, and zero
proposals. Core correctly refuses because the authoring grant carries no
`permittedConsequences`; the UI has no confirmation/reissue continuation.

**Done:** live reproduction, exact response-consumption defect fixed, one live
rerun with a stable closed diagnostic, focused 8/8 checks, and supervisor
rebuild/test review.

**Next:** add explicit review of Core's bounded permission request, reissue the
build grant with only the confirmed consequences, and resume the same creation
request. Prove a durable unapplied proposal live before focused tests.

**Blockers:** none.

---

## Worker Briefs

### Brief: w2-bootstrap-no-proposal-diagnosis
- Repository: paired t027 worktrees and the disposable `t027-fresh-ui-repair` run.
- Task: identify and fix the exact first boundary that converted the successful model-backed bootstrap request into zero durable proposals; rerun the same production UI request once after the smallest root-cause change.
- Required reads: this document's Current State; `mvp-week2-automation-loop-plan/reports/w2-fresh-ui-repair-cycle.md`; the run's sanitized events and closed SQLite projections; direct generation handler, harness validation/normalization, bootstrap proposal persistence, and response projection files reached by tracing.
- Owns (may edit): the smallest directly owning downstream/Core generation or bootstrap files and their focused tests; a unique sanitized live helper under `scripts/lab/` only if needed; `docs/working/bootstrap-no-proposal-investigation/reports/w2-bootstrap-no-proposal-diagnosis.md`.
- Must not touch: unrelated t027 features/reports/docs; user store/profile; port 3000; provider credentials or raw response/page data in output; shared `dev`; git history.
- Live order: exhaust provider-free artifacts/source first; if ambiguity remains, add a closed categorical diagnostic and make at most one bounded provider rerun; fix one root cause; rerun the same UI instruction and require a visible durable proposal before focused tests.
- Definition of done: first discard/failure boundary has a stable categorical code; same live UI request produces a reviewable unapplied bootstrap proposal or stops at a narrower honest blocker; no proposal is auto-applied; focused checks follow only a live pass.
- Report to: `docs/working/bootstrap-no-proposal-investigation/reports/w2-bootstrap-no-proposal-diagnosis.md`

### Brief: w2-bootstrap-permission-continuation-live
- Repository: paired t027 worktrees; Core owns the authoring UI/grant continuation, downstream owns the production UI live driver/report.
- Task: present Core's bounded `flow_bootstrap.permission_required` request for explicit operator confirmation, reissue the build grant with exactly the confirmed consequences, and resume the same creation request to a reviewable proposal.
- Required reads: Current State; diagnosis report; Core action-permission failure contract and API grant issuance; `blank-flow-authoring-model.ts` plus its direct view/dialog; downstream evidence-guided UI driver and failure sanitizer.
- Owns: the smallest Core authoring model/view/API-client files and focused tests needed for the confirmation/reissue continuation; directly owned downstream driver/assertion files if live control needs them; `docs/working/bootstrap-no-proposal-investigation/reports/w2-bootstrap-permission-continuation-live.md`.
- Must not touch: unrelated runtime permission semantics, automatic authorization, other t027 features/reports/docs, user state/port 3000, raw credentials/provider response/page data, shared `dev`, git history.
- Live order: verify the current permission request is bounded and displayable without raw evidence; implement explicit confirmation and exact consequence reissue; rerun the same production UI instruction once; require no preapproval Flow mutation and one visible durable proposal; tests only after live pass.
- Definition of done: UI names consequences before approval; cancel leaves zero proposal; confirmation reissues only the requested set; resumed build yields one unapplied bootstrap proposal; provider/accounting bounds and evidence audit remain intact; focused UI/handler checks pass afterward.
- Report to: `docs/working/bootstrap-no-proposal-investigation/reports/w2-bootstrap-permission-continuation-live.md`

---

## Work Ledger

### 2026-09-20 — Live no-proposal boundary isolated
- Agent: supervisor, with worker `w2-fresh-ui-repair-cycle`
- Changed: investigation record and accepted live report; no product source.
- Why: a successful HTTP response is not product success when no reviewable proposal reaches durable state.
- Validation: production panel/extension reached two successful live browser evidence actions and HTTP 200; provider-free durable inspection immediately found zero proposed/bootstrap adaptations; no retry was made.
- Outcome: Partial
- Follow-up: trace and fix the first categorical discard boundary.

### 2026-09-20 — Closed diagnostic restored
- Agent: supervisor, with worker `w2-bootstrap-no-proposal-diagnosis`
- Changed: downstream response read/sanitizer boundary and focused tests; diagnosis report.
- Why: the live driver consumed one response twice and hid the safe Core failure that should guide the next product change.
- Validation: same live UI request -> `flow_bootstrap.permission_required`, one provider call, three tool calls, two applied evidence actions, zero proposals; supervisor package build -> passed; focused tests -> 8/8 passed.
- Outcome: Accepted
- Follow-up: explicit UI permission confirmation and exact grant reissue.

---

## Open Questions

- How should the existing authoring UI display the bounded consequence request while preserving the current high-token confirmation as a separate gate? Owner: `w2-bootstrap-permission-continuation-live`.
