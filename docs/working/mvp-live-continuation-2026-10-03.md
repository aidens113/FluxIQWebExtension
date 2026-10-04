# MVP live continuation and Claude handoff

Status: Active
Status detail: Resumed MVP implementation and live testing after scoped t261; reconciling Claude lane fixes before a fresh capped run.
Created: 2026-10-03
Last updated: 2026-10-03
Owner: Codex senior supervisor
Scope: Integrate evidenced lane blockers, run real extension-chat build/judge/playback/repair/reuse tests, and leave an executable Claude handoff.
Paired document: ../!FluxIQ/docs/working/mvp-live-continuation-2026-10-03.md
Related: [live loop](./language-driven-flow-loop-plan.md), [prior handoff](./claude-work-handoff-2026-10-03.md), [budget fix](./flow-build-quality-and-lab-budget-plan.md)

## Current State

- User explicitly resumed MVP implementation/live testing and requires Claude-quality durable records. This supersedes the earlier t261 note that panel authorization was pending: isolated Lab panel/browser operation is authorized for this session.
- Paired task t262 starts from downstream dev 88c58d82 and Core dev f6ef9f48. t261's Lab-only $0.10 ceiling is integrated; ordinary UI settings remain independent. No Pro comparison or higher Lab ceiling.
- Claude's t174/t193/t194/t195 trees are preserved. Round-1003 reports and source changes must be reconciled before accepting their results or rerunning.
- Process inventory found no node.exe/chrome.exe/msedge.exe/firefox.exe Lab processes; only unrelated nxnode/WebView processes. Existing slot directories/ledger remain intact. Workers inspect ownership metadata without deleting guards or profiles.
- Today already had two full sweeps. Use narrow owning tests, touched package checks, builds needed for changed runtime, and structure audits only.
- Supervisor owns source integration, working documents, verification, commits/pushes and live run. Workers initially inspect/report only; source partitions are released explicitly after review.
- Task provisioning completed (pnpm task start exit 0); local ignored .env.local copied by owning lifecycle with $0.10 setting intact.
- Metadata reconciliation found A run 3 ended failed: run-musuq910-0e2ae903, $0.048319884, finish 2026-10-03T20:41:11.339Z. Its lead's in-progress row is stale and no authored debug exists yet. Debug this ending before any fresh launch, even with a fresh instance.
- Initial coherent integration candidate is A's paired toggle cancellation / stale test marks / stable handles. Preserve t261 choice-order/budget fixes. Other A/B judgement/per-act changes require later serial reconciliation.

## Execution Steps

1. Inventory newest A/B and C/D reports, dirty source/test changes, last run endings and integration overlaps. Reconcile partial fixes; do not blindly copy whole trees.
2. Prepare the exact headed extension-chat lane-A command and waste-guard prerequisites on t262. Verify .10 reaches both Core and Lab; claim a free slot only after checking ownership.
3. Integrate the smallest coherent prepared blocker set, with Core generic behavior and downstream browser behavior kept in their owners. Reproduce provider-free regressions, then run narrow checks.
4. Run the actual add-to-cart build under Flash/$0.10, inspect complete logs and screenshots, judge all four facts, and play the resulting persisted Flow. Record all phases and total spend independently.
5. Debug every failed run before another launch; fix its cause, then rerun the same scenario only on changed source. Demonstrate deterministic reuse and repair/persistence when reachable; no compilation-only completion claim.
6. Continue the next B/C/D functional blocker from the verified inventory. Record pending work explicitly; preserve the paused standalone UI review unless a live-loop defect requires a focused UI fix.

## Worker Briefs

### Brief: core-toggle-integration (release to resume-ab after inventory)
- Repository: t262 Core; read-only t174 Core source as implementation evidence.
- Task: Port the coherent A toggle/stale-mark unit into t262, preserving newer dev/t261. Review rather than wholesale-copy mixed files; run owning regressions. Stable handles/domain counterpart belongs to supervisor.
- Required reads: this Current State; A report group 2 and w103/w115; relevant existing source/tests.
- Owns (may edit): Core runtime/flow-draft/{reversal.ts,index.ts,step.ts,entry.ts,amendment.ts,dry-run.ts,tests/reversal.test.ts,tests/entry.test.ts,tests/amendment.test.ts,tests/dry-run.test.ts}; runtime/llm/evidence-loop-decision.ts; runtime/llm/evidence-loop.ts; runtime/llm/evidence-loop/{tool-execution.ts,call-record.ts,tests/authored-draft.test.ts}; runtime/llm/node-tools/{step-place.ts,rerun-check.ts,tests/step-place.test.ts,tests/rerun-check.test.ts}; own report.
- Must not touch: other files/source/docs, budgets/instructed-acts/service.ts, old trees, private env/run state; no provider/commits.
- Definition of done: cancellation contract strict and domain neutral, amendments invalidate stale marks correctly, focused tests pass. If dependencies require another file, request a release before editing. Identify any existing recorded run that motivates a test; no live pass claim.
- Report to: docs/working/mvp-live-continuation-2026-10-03/reports/core-toggle-integration.md downstream t262.

### Brief: resume-ab
- Repository: read-only t174/t193 paired worktrees; report in t262 downstream.
- Task: Reconcile latest round-1003 A/B lead/debug reports and dirty source changes; identify coherent fixes essential before another honest add-to-cart/pickup run. Inspect current dev counterpart where needed; no implementation.
- Required reads: this Current State, prior handoff lane A/B sections, newest t174/reports/t174-lead-1003.md and t193 docs/working/language-driven-flow-loop-plan/reports/t193-lead-1003.md, only named subsequent debug/worker reports needed.
- Owns (may edit): docs/working/mvp-live-continuation-2026-10-03/reports/resume-ab.md in t262 only.
- Must not touch: any source/shared doc/other tree/env/runtime state; no panel/provider/commits.
- Definition of done: exact file-group inventory and overlaps, latest run3 ending if known, completed vs partial fixes, recommended first import and owning regression commands; label evidence gaps.
- Report to: docs/working/mvp-live-continuation-2026-10-03/reports/resume-ab.md.

### Brief: resume-cd
- Repository: read-only t194/t195 paired worktrees; report in t262 downstream.
- Task: Reconcile latest C/D round-1003 source/report state, pagination/refutation/repeat/route blockers, and what can be safely integrated. No implementation.
- Required reads: this Current State, prior handoff C/D sections, newest lane lead/debug reports, bounded source/test diff needed to classify fixes.
- Owns (may edit): docs/working/mvp-live-continuation-2026-10-03/reports/resume-cd.md in t262 only.
- Must not touch: any source/shared doc/other tree/env/runtime state; no panel/provider/commits.
- Definition of done: file-group inventory/overlaps, completed vs partial work, latest run endings, recommended integration order and exact owning tests.
- Report to: docs/working/mvp-live-continuation-2026-10-03/reports/resume-cd.md.

### Brief: resume-live-prep
- Repository: t262 downstream; read existing authored lane reports and Lab source.
- Task: Establish exact safe headed extension-chat lane-A run command, scenario/task IDs, slot ownership procedure, build prerequisites, debug/unchanged/loop/balance guard state for a fresh labelled instance. Inspect metadata only; no launch or guard override.
- Required reads: this Current State; testing-facility live waste guards and instance commands; A lead run command; Lab invocation/admission sources; machine slot metadata.
- Owns (may edit): docs/working/mvp-live-continuation-2026-10-03/reports/resume-live-prep.md in t262 only.
- Must not touch: source/shared docs/env/private data/ledger/guards/slots; no browser/provider/panel/commits.
- Definition of done: ready-to-run command/env names (no secrets), correct slot claim mechanism, expected assertions/cost extraction/screenshot artifacts, exact unmet prerequisites.
- Report to: docs/working/mvp-live-continuation-2026-10-03/reports/resume-live-prep.md.

## Work Ledger

### 2026-10-03 — Resumed authorized MVP loop
- Agent: supervisor.
- Changed: isolated paired task t262, this continuation/briefs and paired Core memory.
- Validation: git worktree list and git status --short confirmed main dev clean and old lane trees present; Get-CimInstance process-name inventory found no live Node/Chrome/Edge/Firefox Lab process. pnpm task start mvp-live-continuation --worktree --core is provisioning; product/live checks not validated yet.
- Outcome: Active work resumed, including isolated live panel/browser testing; budget stays $0.10.
- Follow-up: reconcile lane changes, prepare guarded run, integrate narrowly, then live test and repair/reuse.
