# Flow build quality and Lab-only budget

Status: Complete
Status detail: Lab-only budget and authoring feedback implementation verified; live cost comparison remains pending panel authorization.
Created: 2026-10-03
Last updated: 2026-10-03
Owner: Codex senior supervisor
Scope: Keep the .env $0.10 limit confined to Testing Lab runs and improve evidenced Flow-authoring inefficiencies without weakening final whole-Flow judgement.
Paired document: ../!FluxIQ/docs/working/flow-build-quality-and-lab-budget-plan.md
Related: [handoff](./claude-work-handoff-2026-10-03.md), [live loop](./language-driven-flow-loop-plan.md)

## Current State

- User clarified that FLUXIQ_LLM_RUN_COST_CEILING_USD from .env is a Testing Lab control only, not the normal user-driven UI default. Wants better actual build quality, not more room for inefficient add-to-cart builds.
- Before this fix Core read this value in both default Flow policy and runtime ceilings. Lab CLI flags could override .env, and a prior Pro comparison requested $0.30.
- Task t261 has isolated paired worktrees. Claude's dirty A-D lane trees must remain untouched.
- No paid run or manual panel operation has started. This task first uses source and provider-free scripted regressions.
- Core investigation confirms the normal UI/Flow default immediately before the Lab change was $0.25. Preserve that default and explicit user policy; ignore the Lab variable in ordinary UI processes. Lab-started Core opts in with generic `FLUXIQ_LLM_RUN_COST_CEILING_SCOPE=test` and a resolved numeric ceiling.
- Lab run flags may lower the configured env/default ceiling, never raise it. This prevents the earlier $0.30 comparison override while the configured Lab limit is $0.10.
- Implemented child-process test scope, matching Lab plan/accounting, and explicit $0.10 fallback. Configured the local ignored .env.local budget key to 0.10 in the main checkout and t261; no other private settings are disclosed or tracked.
- Core feedback now checks opaque recorded places before suggesting a choice reorder. When the later choice belongs to a different place, it asks for act-claim review instead of moving the choice before the step that may expose its target. Same-place and unknown-place behavior, whole-Flow tests and final judgement remain intact.
- Supervisor observed 26 Core owning test files / 430 tests, 16 web settings tests and 136 downstream Lab/environment tests pass. Core/web/test-runner package checks and Core/test-runner builds passed. Both final structure audits and git diff --check passed. Paired task integration follows these verified gates.
- Compiled provider-free subprocess probe using local config printed ordinary runtime default 0.25 / explicit policy 1 / stored default 0.25, versus test runtime default 0.1 / explicit policy 0.1 / stored default 0.25. A 0.30 Lab flag was refused before process/provider startup.

## Worker Briefs

### Brief: core-budget
- Repository: FluxIQ Core, C:/Users/osrs_/FluxStuff/fxwork/t261/!FluxIQ.
- Task: Investigate normal UI defaults before Lab ceiling change, all ceiling consumers and least invasive separation. Propose precise Core seam so existing .env Lab knob never affects ordinary UI defaults; explicit Lab-started Core remains bounded. Inspect git history read-only; do not implement before supervisor agrees.
- Required reads: this Current State; Core AGENTS boundary/validation; model/run-cost-ceiling, model/flows.ts, runtime/llm/flow-execution-limits/run-cost-ceiling.ts, service Flow creation/budget consumers; corresponding tests and UI default source.
- Owns (may edit): Core model/run-cost-ceiling source/barrel/tests, model/flows.ts, runtime/llm/flow-execution-limits/run-cost-ceiling.ts and tests, result-check-authorization/contracts.ts and tests, session-key-provider.ts and tests, web settings flow-settings-model.ts/settings-round-trip.test.tsx, service-flow creation and bootstrap generation tests; supervisor-approved recovery/annotation/run-budget.ts and tests, iteration-guards.test.ts and loop-limits/tests/flow-bootstrap-evidence-loop.test.ts; own report.
- Must not touch: other source/docs (supervisor owns architecture docs), other worktrees, env/private/runtime data; no provider/panel calls/commits.
- Definition of done: exact historical normal defaults, concrete seam and source/test file partition; report how Lab $0.10 and UI-specific settings coexist; identify residual hardcoded bounds.
- Report to: downstream docs/working/flow-build-quality-and-lab-budget-plan/reports/core-budget.md in t261.

### Brief: authoring-efficiency
- Repository: paired t261; source inspection Core and web domain.
- Task: Inspect add-to-cart lane A's authored debug/lead reports and current build code; identify and implement one coherent provider-free-proven reduction of wasted build decisions/retests. Prefer an underlying generic authoring feedback/progress defect, preserve full-run judged completion and explicit routes, avoid raising budget/caps. Report proposed file ownership before editing for conflict check.
- Required reads: this Current State; main handoff Current State; t174/reports/t174-lead-1003.md and its two authored debugs, current draft/amend/replay/decision code needed for the chosen reproduction; corresponding owning tests.
- Owns (may edit): Core runtime/flow-bootstrap/instructed-acts/{choice-order.ts,checklist.ts,check.ts,tests/choice-order.test.ts}, Core docs/architecture/automation-studio/llm-flow-bootstrap.md, own report.
- Must not touch: all other worktrees, budget modules/model flows/Lab budget source, service.ts, env/private/run artifacts; no paid live/panel/commits.
- Definition of done: clear wasted-work cause, deterministic regression that fails before and passes after, bounded source edit proposal, observed narrow checks; no claim of live cost improvement without live proof.
- Report to: downstream docs/working/flow-build-quality-and-lab-budget-plan/reports/authoring-efficiency.md in t261.

## Work Ledger

### 2026-10-03 — Final narrow gates passed
- Agent: supervisor.
- Changed: regenerated both working indexes after final header updates; documented scoped implementation as complete with live comparison separately pending.
- Validation: node scripts/structure-audit.mjs printed passed (164 warnings, 118 baselined) downstream and passed (240 warnings, 349 baselined) Core; git diff --check exited 0 in both trees. No new unbaselined violations. All 582 affected tests and touched package checks passed as recorded above.
- Outcome: Coherent paired code/documentation unit ready for dev integration and push. Core finish's obsolete full-check gate will be skipped in favor of these observed narrow gates, honoring the user twice-daily suite limit.
- Follow-up: finish downstream first, then Core under its own task lifecycle, and push both dev branches. Live saving remains unmeasured.

### 2026-10-03 — Lab reach and compiled-process verification
- Agent: supervisor.
- Changed: corrected normalized numeric string expectation (0.20 resolves to 0.2), updated example config and both architecture contracts; regenerated working indexes and Core API references with their owning scripts.
- Validation: node --test --test-reporter=spec on dist/live-llm/tests and dist/tests/environment.test.js printed 136 tests / 136 pass / 0 fail after rebuild. pnpm --filter @fluxiq-web-extension/test-runner check and build exited 0. Compiled node subprocess probe printed ordinary .25/1/.25 and scoped test .1/.1/.25, and higher flag refused. Initial probe used repository-root package resolution and failed before loading Core; rerun from owning test-runner package succeeded. Initial structure audit found a cross-repository Markdown link and report wording in two ledger entries; both corrected, final audit pending.
- Outcome: Runtime budget isolation and refusal verified without provider calls. No live browser result or measured saving.
- Follow-up: final audits and paired task integration/push. Live comparison follows the protocol below when panel management is authorized.

### 2026-10-03 — Scoped fix and independent Core verification
- Agent: supervisor; bounded sources from core-budget and authoring-efficiency.
- Changed: Core test-runtime budget seam, ordinary model/UI defaults, policy-aware session resolver, recovery fallback; downstream Lab resolver/child environment/tests/example config; page-aware choice feedback and architecture docs.
- Validation: supervisor pnpm --filter fluxiq exec vitest run on affected Core owning directories printed Test Files 26 passed and Tests 430 passed; Core package build/check and web package check exited 0; focused web settings vitest printed 16 passed. Downstream pnpm --filter @fluxiq-web-extension/test-runner build/check exited 0; node --test on dist/live-llm/tests and dist/tests/environment.test.js printed 135 passed / 1 failed (normalized amount string expectation), now corrected and awaiting rebuilt rerun.
- Outcome: Implementation complete; integration validation in progress. No paid/provider/browser run or panel operation; live cost saving is not claimed.
- Follow-up: finish downstream focused checks, both structure audits and integration; perform the comparison below when live panel operation is authorized.

## Live Validation Plan

1. Use an isolated Lab slot/run profile and a pinned paired source revision; preserve Claude's existing lane trees and user profiles. Current prompt authorizes implementation and a testing plan, not panel management; AGENTS.md Testing And Live Validation requires explicit session authorization before starting the panel.
2. Verify the compiled Lab child and plan both resolve $0.10 from the local env key with test scope; refuse a $0.30 flag before provider work. Keep the same Flash model and add-to-cart instruction/fixture for every comparison. Do not substitute Pro or expand the ceiling.
3. Author from the existing lane-A hub entry, then judge and play the whole Flow. Require all four existing facts, the intended item/options/quantity, and no duplicate lasting cart action. A cheap run that fails these facts is not success.
4. Record initial creation and each recovery/re-author build separately: estimated spend versus $0.10, calls, repair decisions, whole-Flow test count, elapsed time, judgement and playback results. Cross-check Lab perBuild evidence and spend ledger with Core's resolved budget. Do not publish raw page data, tokens or profiles.
5. Inspect whether any choice was moved before its recorded target place. Compare against the historical Flash result ($0.024166530 / 20 calls, 4/4 facts), but label it historical: Claude's dirty lane source differs from t261. A causal cost comparison requires matching pinned source except this fix; do not claim savings from mismatched runs.
6. If a run fails or reaches its ceiling, debug the exact decision/test first, record the cause and change source before rerunning under Lab waste guards. Do not raise the budget to get a passing result. Live validation remains pending until these observed results exist.

### 2026-10-03 — Opened scoped implementation
- Agent: supervisor.
- Changed: paired worktree and downstream plan/briefs.
- Validation: initial source inspection confirms model and runtime both consume Lab knob; no product check yet.
- Outcome: In progress.
- Follow-up: agree Core seam, implement Lab integration and deterministic build-efficiency fix, validate narrowly.

### 2026-10-03 — Released bounded fixes
- Agent: supervisor with core-budget and authoring-efficiency.
- Changed: worker source partitions in this plan; source work released.
- Validation: historical default investigation and authored add-to-cart debug identify Lab/UI leakage and misleading reorder feedback; tests pending.
- Outcome: In progress.
- Follow-up: preserve normal defaults/explicit policy, bind Lab child process and accounting to one configured amount, reproduce wrong-page reorder advice before fixing it.
