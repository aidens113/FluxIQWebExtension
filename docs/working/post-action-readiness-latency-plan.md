# Post-Action Readiness Latency Plan

Status: Active
Status detail: Fresh current-dev task is ready for one live-first non-navigation after-state readiness optimization.
Created: 2026-09-20
Last updated: 2026-09-20
Owner: Senior supervisor agent
Scope: Remove redundant fixed readiness waits before immediate after-state capture without dropping snapshots, diffs, identity checks, or navigation safety.
Paired document: none
Related: [Week 2 automation loop](./mvp-week2-automation-loop-plan.md)

---

## Current State

Existing live evidence shows the warm panel is healthy and the integrated
snapshot-readiness proof reduced a four-action saved Flow from 14.774 seconds
to 8.165 seconds. The remaining likely redundant delay is the fixed readiness
wait before an immediate `after_action` snapshot following a successful action
whose contract cannot navigate. The snapshot and state diff remain required.

**Next:** implement a one-use bounded readiness proof for successful
non-navigation actions, then run the exact saved four-action live A/B before
focused checks.

**Blockers:** none. Stop and revert if document/URL identity, before/after
state references, diff categories, routes, action count, or fixture oracle
change.

---

## Worker Briefs

### Brief: w2-post-action-readiness-live
- Repository: downstream t034 worktree with shared read-only Core; disposable isolated Lab topology/profile on non-3000 ports.
- Task: implement and live-prove one-use readiness from a successful contractually non-navigation action to its immediate `after_action` capture.
- Required reads: this Current State; `F:\fxwork\t027\!FluxIQWebExtension\docs\working\mvp-week2-automation-loop-plan\reports\w2-mvp-latency-critical-path-audit.md`; current `action-runner.ts`, `automation-tab.ts`, direct snapshot readiness owner/tests, and exact saved four-action live command/report.
- Owns: smallest downstream runtime/readiness source and focused tests; this task's unique report `docs/working/post-action-readiness-latency-plan/reports/w2-post-action-readiness-live.md`.
- Must not touch: Core source, manual panel/user store/ports 3000+4711, provider APIs, t027/t029/t033, unrelated actions/snapshots, shared `dev`, git history.
- Safety: only successful actions statically incapable of navigation may produce a proof; consume once; require unchanged URL/document identity/freshness; click/submit/navigation/unknown/replacement/expiry retain current wait; never omit before/after snapshots or diff.
- Live order: establish current-build warm control if no directly reusable 8.165-second bundle exists, implement the smallest change, then run at least two warm candidate executions of the same saved four-action Flow with closed segment durations.
- Acceptance: 4/4 durable attempts, identical routes and state-ref/diff categories, submitted fixture oracle, zero provider/adaptation activity, no navigation reuse, and material median reduction beyond noise; stop/revert on any correctness drift.
- Definition of done: live pass before focused checks; then nearest readiness/runtime tests, extension build, diff check, and sanitized measured report; no full suite.
- Report to: `docs/working/post-action-readiness-latency-plan/reports/w2-post-action-readiness-live.md`

---

## Work Ledger

### 2026-09-20 — Live-first latency task opened
- Agent: supervisor
- Changed: isolated t034 task and implementation brief.
- Why: existing live timings isolate a likely redundant post-action readiness wait worth 2-3 seconds per four-action run.
- Validation: task start built current downstream successfully against current shared Core.
- Outcome: Partial
- Follow-up: execute the live-first worker brief.

---

## Open Questions

- None.
