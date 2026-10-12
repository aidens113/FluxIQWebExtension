# D terminal coverage and trial feedback repair
Status: Complete
Status detail: Implementation and all authorized narrow checks passed; supervisor review and live proof remain.
Created: 2026-10-11
Last updated: 2026-10-11
Owner: d-trial-feedback worker
Scope: t449 Core graph coverage and safe graph-level trial feedback; saved D run diagnosis.
Paired document: t449 Core docs/architecture/automation-studio/flow-authoring.md
Related: ../../../live-testing-handoff-audit-2026-10-11.md

## Current State
The D candidate's conditional wait never ran on trials 2-4 because its optional predecessor was absent on every pass. Core correctly took the optional failure edge into its Merge, then reached the final read successfully, but incorrectly required the bypassed wait to count as visited. No compiler change was necessary: the compiler's graph correctly implements optional/only-after/repeat.

Implemented in t449 Core: terminal coverage now exempts only a validated optional group's nonbranching success chain when the run actually takes its way past straight into the join. General untaken branches, disconnected nodes and required continuations still count. No candidate acceptance or lasting-act guard was weakened.

Graph-level terminal failures now carry closed unvisited-nodes/unmatched-route codes. Trial feedback explains those graph endings separately from successful steps, without copying raw trace messages, page content, selectors or node IDs. C files remain untouched; no paid calls/browser launches/commits/pushes.

## Saved-run diagnosis
- Run run-mv4jjsvj-25b4dc2a: failed during chat candidate build, 30 provider calls, $0.094104348; no promoted Flow, runtime oracle or replay proof.
- Trial 1 (step0037): 19 feedback steps, one true failed press with web.target.not_found. That remains a real trial failure and is not hidden by this fix.
- Trial 2 (0047), revision4: 27 shown steps, all succeeded; three optional skips. Trial 3 (0049) repeats revision4 and has the same failure. Trial 4 (0057), revision6: 30 shown steps, all succeeded; three optional skips.
- Local runtime artifacts independently confirm trial2/3 main.s12 skipped -> main.s14 Merge on every loop pass. main.s13 timing.wait is never attempted. Final main.s16 read succeeds. Trial4 adds a wait-for-text node; its final main.s17 read succeeds, and main.s13 still never runs.
- All three run_summary terminal reasons: final node completed without an outgoing edge before every graph node was visited. The model received candidate.execution_incomplete plus only successful displayed steps; it was never told this graph-level reason.
- Static refusals also remained meaningful: step0043 rejected an optional instructed act/way-out acceptance; step0053 rejected unknown extract-list fields. Later accepted submissions corrected them. No relaxation here.
- Source cause: executor/graph-navigation.ts hasUnvisitedAutomationStudioNodes treated all graph nodes as owed except handlers, forward state routes and alternative-entry prefixes. Only-after paths were missing from that accounting.
- Compiler owner read-only: flow-bootstrap/script-statements/guarded-steps.ts correctly emits optional.failed -> Merge, optional.success -> conditional wait -> same Merge and keeps its join inside a repeat span.
- Artifact evidence (read-only, no content copied): project e0755ba8-9874-470c-bef9-dc071e9092ea object hashes 799a213bc9a3b992512f6da17ed913fadace4dc9531660879179b42bd154cdc7, 3efd017036768783e8b7118c1edebf8bd09a8355b85be41ce9aa16968e4d0479 and a3b6447b382357975857604a576c9e78dd8867d5934f8004d0d7365d115a5f0b under the preserved t275 isolated runtime artifact store.

## Owned changes and dependency direction
- executor/graph-navigation.ts: recognize actual optional bypass; keep existing public edge-selector re-export.
- executor/graph-navigation/edge.ts and index.ts: edge selection extracted unchanged into focused navigation owner. This avoids a circular dependency through optional-step. A root choose-edge.ts temporarily exceeded the executor 25-file cap, so the final feature layout uses this directory.
- executor/step-skip/optional-step.ts: import selector through the focused barrel; optional-shape validation itself unchanged.
- executor/graph-run.ts: closed typed failure record on unvisited-node and unmatched-route endings.
- executor/step-skip/tests/guarded-group-run.test.ts and executor/tests/graph-navigation/tests/optional-groups.test.ts: final-read loop without End, absent on all passes, plus negative missing-continuation/disconnected/general-branch/wrong-bypass cases.
- service/candidate-trial/feedback.ts/tests/feedback.test.ts: allowlisted graph-ending guidance; unknown failure codes and raw messages withheld.
- Core docs/architecture/automation-studio/flow-authoring.md: terminal coverage and feedback contract documented.
- Downstream: own report and full run debug only. Supervisor explicitly approved edge-selector/optional-step/test ownership expansion before changes. No compiler module edits.

## Validation
- Fail first: pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/executor/step-skip/tests/guarded-group-run.test.ts -> 2 failed/2 passed. The main reproducer had every attempt succeeded but frame failed; negative failure-code assertion lacked the new typed code.
- After implementation: focused graph-navigation, optional-step, guarded-group, graph-run, feedback and detached-execution files -> 110 passed in 8 files.
- After final navigation module layout/import correction: graph-navigation + guarded-group + feedback -> 37 passed in 5 files.
- pnpm.cmd --filter fluxiq exec tsc --noEmit --incremental false -> exit0, no errors (before final path-only relocation).
- pnpm.cmd --filter fluxiq check -> exit0 against final layout; actual command ran, build-cache reports source command/no stamp, 52.399s (no cached pass reused).
- Core node scripts/structure-audit.mjs -> passed, 330 warnings/1159 baselined. Intermediate import-cycle and directory-cap failures fixed without baseline changes.
- Downstream node scripts/structure-audit.mjs -> direct command exit0; 184 advisory warnings, existing 646 baseline. The prior projected-output pipeline ambiguity was resolved by this direct run.
- git diff --check -> exit0.

## Limits and follow-up

Supervisor verification: reviewed the exact optional-shape/actual-bypass guard and closed graph feedback;
independently ran 8 owning vitest files (110/110), cache-free Core typecheck (exit 0), then after merging
current dev ran 6 owning/integration files (47/47). Fresh owning Core library build completed (7206 outputs),
and downstream domain check executed against that current build and passed. Final direct task audits and
downstream-first/Core-second integration follow; no new live proof claimed by these checks.
No fresh browser proof: these saved outcomes still fail and D remains unqualified. A fixed-source replay/creation must independently judge the instruction and verify durable interruption handling. The shown optional dismissal control was not evidence of a correct notice handler; this graph fix alone proves no adaptation policy or semantic oracle. Do not adopt the previous design's accept-unchanged-after-one-hold idea.

Every saved step's metadata/outcome was inspected, plus final candidate structural script lines, all four trial results and all three false-terminal runtime artifact streams. Screenshots and historical full page bodies were not inspected; no UI/live behavior claim is made. No original instructions, page values or raw captures are reproduced below.

## Work Ledger
### 2026-10-11 - Conditional wait terminal regression fixed
- Agent: d-trial-feedback worker.
- Changed: scoped Core navigation, graph terminal codes, trial feedback, owning tests/docs; own downstream report/debug.
- Why: an unneeded only-after step made every otherwise successful trial fail, and feedback hid the reason.
- Validation: fail-first reproduced; 110 focused tests then 37 final-layout tests passed; cache-free package tsc and final package check passed; direct Core/downstream structure audits passed; diff whitespace check exit0.
- Outcome: Partial; supervisor integration/live verification outstanding.
- Follow-up: supervisor review, narrow integration checks, fixed-pair B/C/D qualification.
