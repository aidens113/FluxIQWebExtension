# Settled worker briefs ? October 11 continuation

Status: Archived
Status detail: Historical briefs retained with their original budgets and gates; current work is owned by the live-testing handoff document.
Created: 2026-10-11
Last updated: 2026-10-11
Owner: Codex senior supervisor
Scope: Preserve earlier continuation and round-four/five execution briefs without obscuring active work.
Paired document: none
Related: [Current execution](../../live-testing-handoff-audit-2026-10-11.md)

## Current State

Historical reference only. The parent document owns current source repairs, budget authorization and launch decisions; original amounts below record the authorization when each brief was written.

## Historical Briefs

### Brief: recording-index-review
- Repository: paired t454, supervisor synced dev1a7e47c6/b16ad470; implementation worker finished, source frozen.
- Task: independent read-only review of recording repair/index and focused test adequacy before supervisor integration. Report concrete defects with owner paths/reproductions, not a completion claim.
- Required reads: this Current State + recording-stream-owner.md; git changed/untracked Core paths for this unit only, named below. Do not read other MVP planning/history.
- Owns: new downstream reports/recording-index-review.md only. Read Core recording-stream/{entry,projection,store}.ts; schema/recording-stream.ts + administration/table-names wiring; runtime-stream recording methods; recordings/store/load-timeline and service recording-only wiring; changed owning adapter/schema/retry/restart/storage tests. No source edits, builds/merges/commits/providers/browser/full suites.
- Definition of done: evaluate generation/cursor invalidation, concurrent append/control catch-up, transactional rollback, exact ID/public sequence/body-digest proof and generated-time retry scope, explicit recording-delete reference unlink versus unrelated refs/content retention, legacy file+SQL/conflict and late durable finalization recovery. Check index linearity versus full-history scans, schema migration compatibility, owner close/disposal. Identify unsupported ack-loss or general authority claims separately; preserve established API identity/public sequence semantics. Recommend narrow meaningful supervisor cases; do not treat worker test counts alone as correctness.
- Report to: t454 docs/working/live-testing-handoff-audit-2026-10-11/reports/recording-index-review.md.

### Brief: worker-start-recovery
- Repository: t455-worker-start-observation downstream task; Core shared3291fb25 read-only.
- Task: finish supervisor's isolated browser observation-gap recovery; keep actual worker readiness and network containment strict.
- Required reads: this Current State, worker-start-observation brief/probe results; t455 existing root-authored chrome-worker-target.ts/tests and launch-extension-session.ts prototype; original run-scenario browser setup, readiness/control/guard owners and four source-order identity/containment tests.
- Owns: t455 new helper/probe helpers and owning tests, browser-session/index.ts, run-scenario.ts narrow wiring, directly affected source-order tests only; own worker-start-observation.md report. Supervisor transferred unfinished prototype, no concurrent source edits.
- Must not touch: Core/source defaults/model/scenarios/oracles/existing profiles/.env/shared docs, commits/merges/full suites; no CDP-target-only acceptance or timeout/guard relaxation. Probe only actual extension/allowed everything-store in isolated/copied profiles, model disabled.
- Further approved ownership: browser-session/session-observers.ts + tests/session-observers.test.ts keep capture/watch registration single and dispose/rebind console watcher when context replaces, preserving spine budget and context/guard evidence ownership. Directly affected guarded-browser launch-containment, run-evaluation runner-wiring and Core/host/server identity source-order tests may follow extraction, without weakening dispatch/containment order.
- Definition of done: on first proved Chrome-present/Playwright-absent worker timeout, normal-close owned context and relaunch same profile once within attempt; second failure/missing/ambiguous target refuses. Fresh strict worker readiness and awaited canary proofs before returning control session; all actual identity/pairing gates still precede dispatch. Preserve screenshot/trace/console/perturbation ownership, single capture watcher, and terminal-failure cleanup. Unit fail-first plus injected actual-browser recovery with current stamps; owning test-runner build/type and affected tests/audit. Report natural16start probes allpassed (race not naturally reproduced), injected reproduction honestly; no live semantic qualification.
- Report to: t455 docs/working/live-testing-handoff-audit-2026-10-11/reports/worker-start-observation.md.

### Brief: handler-scope-feedback
- Repository: new paired task, supervisor provisioned current dev; unit stays isolated until reviewed.
- Task: preserve actionable trusted handler-scope static refusal explanation lost before candidate trial in B second run.
- Required reads: this Current State, B round5 report/full second debug/actual dist probe; Core bootstrap-completion.ts issue-feedback path, flow-bootstrap issue-feedback owner, authored script handler assembler and owning tests.
- Owns: initially named issue-feedback + bootstrap-completion owner/tests and own report; identify exact additional extraction path before editing if needed for structure budgets. No broad parser/graph changes.
- Supervisor provisioned paired t457 and approved exact Core flow-bootstrap/plan/issue-feedback.ts + plan/tests/issue-feedback.test.ts + llm/harness-options/tests/bootstrap-completion.test.ts + llm/repeat-guard/tests/candidate-feedback.test.ts (test-only latter). Existing routing carries messages when owner emits them; single trusted handler_invalid allowlist change, no parser relaxation or bootstrap-completion.ts edit.
- Approved new neutral harness regression in llm/harness-options/tests/handler-scope-feedback.test.ts after existing file would exceed800lines; preserve all existing tests and no baseline expansion.
- Must not touch: numeric domain/source peers, scenarios/oracles/user instruction, .env/user data/shared docs, model output cap or generic raw DOM/provider-message copying; no worker commits/merges/full suites/browser/paid calls.
- Definition of done: fail-first valid compiler refusal with missing explicit handler target label; actual next model feedback retains safe actionable explanation from trusted authored-statement/static issues. Preserve exact candidate receipt/revision/digest flow and existing privacy/code/path contracts; no realistic task-shaped examples or relaxing invalid handler acceptance. Narrow owner tests/type/fresh built-owner validation/audits; report limits and implementation paths. Supervisor owns architecture/integration.
- Report to: new task downstream docs/working/live-testing-handoff-audit-2026-10-11/reports/handler-scope-feedback.md.

### Supervisor unit: numeric-tool-contract
- Repository: t456-numeric-tool-contract, shared Core3291fb25 read-only.
- Task: correct registered tool prose that promises first-number parsing although deterministic numeric bounds already recognize complete composite counts; guide quantities toward numeric bounds, keep text matches lexical. Existing D raw-text regex failure is not a parser bug and changed prose is not live proof.
- Owns: domain/src/runtime/llm-evidence/tools.ts, build-loop architecture and own report. Preserve parser/action/wire/oracle semantics and description cap; remove existing realistic-task-shaped accessory example in the same tool prose, use generic status exclusion instead. No source consumer/schema invented, no model-answer injection. Run existing owning tool/condition tests and current domain typecheck/build/audit.

### Brief: worker-start-observation
- Repository: new isolated downstream task worktree; current Core3291fb25 read-only, no live-lane source edits.
- Task: reproduce C run-mv4p3qri-4c59c2ff startup mismatch before choosing a fix. Supervisor owns initial investigation; delegate if additional discovery exceeds bounded owners.
- Required reads: C round-five full debug and screened startup trace, run-lifecycle/extension-readiness.ts, extension-control-page.ts, launch-browser.ts and extension-start-trace.ts plus their owning tests.
- Owns: ignored isolated probe/evidence and own report initially; any source fix requires supervisor narrowed file assignment after reproduction.
- Supervisor narrowed recovery scope after16actual provider-free starts (all pass; intermittent original fault not naturally reproduced): extension-control-page.ts, focused browser-session Chrome worker target lookup plus barrel/owning tests, existing extension-control-page tests and testing-facility architecture. Inject the saved observation split (Chrome target present, Playwright observer absent) to fail first; recover only from a bounded extension.worker readiness failure using an unambiguous Chrome service-worker target. Control-page/pairing and all actual identity guards still follow before model dispatch. Missing/ambiguous/failed Chrome discovery preserves refusal; no timeout expansion or claims that target existence proves execution.
- Containment review revised that recovery before integration: a Chrome descriptor cannot replace Playwright's attached worker, because the network canary proof depends on that attachment. Keep original worker readiness strict. Supervisor owns browser-session/launch-extension-session.ts and its owning tests, Chrome target lookup/tests/barrel, run-scenario.ts narrow wiring and architecture. Only a proven Chrome-present/Playwright-absent readiness timeout restarts the isolated browser once inside the same attempt; close previous owner normally, preserve profile data and perform fresh strict readiness, awaited worker containment proofs and unchanged identity/pairing gates. No outer relaunch, target-only acceptance, timeout increase or containment relaxation.
- Must not touch: existing profiles/user data, Core, scenario/oracle/instruction, live-lane branches, model/provider, source-freeze heads, generic timeout or guard overrides. No worker commits/merges/full suites.
- Definition of done: provider-free actual current extension on allowed everything-store fixture; copied or new isolated profile, Chrome target versus Playwright worker exposure and diagnostic attachment timing compared. Trace actual fault with no load/memory attribution or synthetic browser fixture. Prove correction against actual browser and owning tests before changed-source C relaunch. Report limits honestly; never count CDP existence alone as extension identity or successful chat.
- Report to: isolated task downstream docs/working/live-testing-handoff-audit-2026-10-11/reports/worker-start-observation.md.

Round-five launch preparation: coherent fixes and notes pushed to downstream e836e611/Core3291fb25; all three paired lane trees synced clean before workers started. B and D workers own their lane preflights, supervisor owns C. Ready dry-runs do not start topology, so a human pause before running-identity receipts is unavailable. Supervisor inspected the real awaited identity guards in run-scenario.ts (Core/host/server adapter before browser setup, extension before chat). Those guards refuse mismatch before provider dispatch. Supervisor reviews ready plan/intended artifacts before launch and independently reads all four actual receipts as soon as the topology writes them; no new gate or extra paid launch.

### Brief: live-b-round5
- Repository: existing paired t262 lane trees, supervisor synced to integrated t452/t453 pair.
- Task: original bigbox-retail-pickup-cart-store-remembered-after-creation, two consecutive candidate creations with separate disabled-model replays on frozen Core3291fb25.
- Required reads: this Current State; live-b-round4.md/full debug, t452 feedback report; current original task/oracles and live/replay guard rules.
- Owns (may edit): new lane-b-round5.md, live-b-round5.md and new run-id debugs; runtime evidence through owning Lab scripts only.
- Must not touch: source/shared docs/old reports/.env/user data/profiles; no commits/merges/pushes/full suites/guard overrides or user panel management. No reply-output cap or automatic relaunch.
- Definition of done: slot3/instance t262-slot-3/workspace t262-b; current owning library/build outputs and ready preflight proving zero calls, candidate/reset trial and whole-Flow $0.25 via process environment. Four actual identities match before provider, headed real chat, one attempt. First success fully debugged/independent exact oracles/separate unchanged-hash zero-provider/intervention/harness replay before second creation. Failure fully debugged then stops pending changed source; first balance failure stops all paid work. Report UI/costs honestly.
- Report to: t262 downstream docs/working/live-testing-handoff-audit-2026-10-11/reports/live-b-round5.md.

### Brief: live-d-round5
- Repository: existing paired t275 lane trees, supervisor synced to integrated t452/t453 pair.
- Task: original social-network-feed-confirm-requests, same two-creation/zero-model replay qualification, frozen Core3291fb25.
- Required reads: this Current State; live-d-round4.md/full false-acceptance debug, t453 report; original task/oracles and current live/replay/guard rules.
- Owns (may edit): new lane-d-round5.md, live-d-round5.md and new run-id debugs; runtime evidence through owning Lab only.
- Must not touch: same source/docs/profile/permission boundaries as B; no test-shaped guidance or expected-count injection.
- Definition of done: slot4/instance t275-slot-4/workspace t275-d; same current builds/$0.25 zero-call preflight/four identity/headed chat/single launch/full-debug/replay gates as B. Inspect all rows, duplicate acts, excluded witnesses, independent oracle and any encountered rate-limit recovery; a judge yes alone or automatic retry does not prove saved adaptation. Failure/balance stops as B; no unchanged relaunch.
- Report to: t275 downstream docs/working/live-testing-handoff-audit-2026-10-11/reports/live-d-round5.md.

### Supervisor lane: live-c-round5
- Repository: existing paired t451; slot1/instance t451-slot-1/workspace t451-c.
- Task: unchanged everything-store-plus-earbuds-under-50, same frozen Core3291fb25 and $0.25 environment/preflight/identity/debug/replay gates as B/D.
- Supervisor owns new lane-c-round5.md/live-c-round5.md/new run debugs. Recording worker stays in isolated t454.
- Preserve five-page exact dataset oracle and structured paging loop; no oracle/task alteration, output cap, source edit or unchanged failure relaunch. Only successful/debugged first creation and separate zero-model replay permit second.

### Brief: recording-stream-owner
- Repository: paired t454 trees under `C:/Users/osrs_/FluxStuff/fxwork/t454/`, separate from live lane/source tasks.
- Task: repair the actual recording sequence/write/read ownership chain established by the provider-free dist probe; preserve existing projects and recordings, never merge t381 pool WIP wholesale.
- Required reads: this Current State; t381 recording-persistence-measurement.md and sanitized reproduction/private probe; model recording-framework sequence assignment; actual recording store, runtime-stream/event-chunk recording helpers, summaries/store fallback and owning tests; Core instructions/code structure.
- Owns (may edit): Core runtime/service/recordings/store.ts, recordings/load-timeline.ts and tests/storage-restart.test.ts/process-probe.mjs; storage/project/runtime-stream-store.ts, recording-stream/{store.ts,index.ts,tests/store.test.ts} and project/index.ts; runtime/service.ts pool injection/recording-only writes/removal wire and service/summaries/store.ts recording-only strict helper; owning recording/removal tests; own report. Supervisor approved exact helpers and narrow wiring after source trace; generic fallback unchanged.
- Must not touch: public model sequence semantics, global connection pools/t435, t452/t453 source or live lanes, oracle/scenarios, shared docs/.env/user data; no commits/pushes/merges/full suites/browser/providers. Runtime data only through owning APIs in isolated test roots.
- Retry refinement authorized: exact durable retries are idempotent; preserve original omitted timestamp/offset proof and return landed originals for mirror publication within recording-only owners. Cover post-typed metadata failure, conflicting contents and removed IDs; never guess packet identity or expand the gateway/model contract.
- Performance refinement authorized after measurements: recording-owned durable identity/projection metadata with exact cursor/generation catch-up, not connection caches. Additional Core owners: project/schema/recording-stream.ts, schema/index.ts and table-names.ts, existing migration registration, schema owning tests; focused helpers/tests inside approved recording-stream directory. Foreign keys and explicit delete/recreate/reopen/raw-chunk append/removal catch-up must invalidate derived state; no overwrite of historical chunks/public sequence. Append/read counters and conflict proof remain exact under partial write failure. Measure old/new chunk/SQL counts and 32/40-entry close/restart phases; unchanged15s child bounds and no baseline/schema-guard bypass.
- Finalization refinement authorized within existing owners: after typed endedAt commits but later metadata fails, retry/reopen adopts the proven durable end time and complete verified timeline. Direct typed conflicting put refuses; preserve public service repeat-finish returning its original end time even when repeated with a different value. Append/removal cannot reopen completed state. Add fail-first late metadata/finalize/reopen proof; no cross-filesystem atomic rollback claim. Supersede earlier gates after source change, rerun affected owners/fresh processes.
- Definition of done: fail-first real-owner zero-sequence append/batch and mixed fallback+SQL restart; positive storage cursor separate from unchanged public timeline identity/order. Exact endedAt/count/order survive rebuilt-process reopen and >32 chunks; mirror changes only after durable success. Explicit removal may append validated private control records under existing lock, never rewrite old content; controls stay out of public entries, fold after legacy merge and cannot resurrect removed IDs. Cover finalized/stale/conflicting/spoofed/duplicate removal, SQL/file modes and legacy ambiguous sequences without guessing/overwriting. No silent recording error, generic fallback change, authority bypass, timeout/baseline expansion or destructive history rewrite. Own narrow tests/current package types/audit pass after fresh build.
- Report to: t454 downstream `docs/working/live-testing-handoff-audit-2026-10-11/reports/recording-stream-owner.md`.

### Brief: recording-persistence-measurement
- Repository: t381 downstream report/probe workspace; subject read-only built Core `C:/Users/osrs_/FluxStuff/fxwork/t380/!FluxIQ` (77604650, actual rebuilt library verified by supervisor). Never load t381's conflicting Core WIP.
- Task: provider-free phase/queue measurements of actual recording append and finalization, before choosing a storage optimization.
- Required reads: this Current State; committed storage-reuse-review.md; named Core service.ts append/finalize/storage helpers, service/object-documents.ts, service/locks.ts, service-recordings/tests/storage.test.ts, _shared/performance-metrics.ts and current actual-built process-probe import order. Supervisor approved bounded read-only extension to actual service/recordings/store.ts, storage/project/runtime-stream-store.ts and referenced recording/event-chunk helper to classify restart mismatch.
- Owns (may edit): t381 downstream own report and ignored `test-runs/recording-persistence-measurement/` private probe/evidence only. Subject Core source/dist read-only; no source edits/builds/merges/commits/shared docs, full suites, browser/provider/user-panel operations.
- Definition of done: actual dist-backed service/canonical SQLite owners on isolated mkdtemp data, framework-first imports; measure lock queue/wait/drain, normalization/dehydration, global get/put, typed project append/index/summary and finalization spans. Preserve real call ordering and method behavior; no external models. Compare small and moderate synthetic state payloads/batch sizes using unit-only data, not recorded page content. Assert exact persisted count/order and endedAt after queued appends, no later mutation, normal close. Report medians/tails/counts and source/artifact identity; do not extrapolate a probe pass to browser backlog resolution. Explain any missing representative payload/process boundary.
- Report to: t381 downstream `docs/working/live-testing-handoff-audit-2026-10-11/reports/recording-persistence-measurement.md`.

### Brief: result-cohort-judgement
- Repository: paired t453 trees under `C:/Users/osrs_/FluxStuff/fxwork/t453/`; supervisor will sync integrated t452 before final validation.
- Task: strengthen generic result-verification instruction for complete quantity interpretation and included/excluded cohort checking, based on D's false acceptance with full evidence already present.
- Required reads: this Current State; t275 live-d-round4.md and full run debug; Core runtime/llm/diagnosis-instructions.ts and owning instruction/request/verdict tests; Core instructions/code structure.
- Owns (may edit): Core packages/fluxiq/src/programs/automation-studio/runtime/llm/diagnosis-instructions.ts; llm/tests/diagnosis-channel.test.ts and deepseek/tests/system-prompt.test.ts; generated deepseek/tests/system-prompt-pins.json (regenerate only two verification entries through actual builder, never hand-edit); own report only.
- Must not touch: t452 files, judge schemas/coverage protocols, numeric condition semantics, oracle/scenario/fixture, shared docs, .env or user data; no commits/pushes/merges/provider/browser calls/full suites. No expected-count injection or scenario-shaped examples.
- Definition of done: generic verification requires interpreting all quantitative components and comparing relevant left-out witnesses against original requirements independently of the authored predicate, with uncertainty refusing acceptance. Distinguish before/after aggregate counts from distinct cohort size. Owning tests prove instruction delivery and preserve judgement/gate contracts; actual affected typecheck/audit pass. Do not claim wording/naming coverage proves deterministic arithmetic or completeness.
- Report to: t453 downstream `docs/working/live-testing-handoff-audit-2026-10-11/reports/result-cohort-judgement.md`.

### Brief: candidate-recovery-feedback-b
- Repository: paired t452 trees under `C:/Users/osrs_/FluxStuff/fxwork/t452/`, synced to integrated dev by supervisor.
- Task: fix B's proven generic cached-response/stall guidance mismatch in candidate mode and unsafe wrong-control correction advice; preserve guards and exact trial requirement.
- Required reads: this Current State; t262 live-b-round4.md and full run debug; named Core source and owning tests; Core instructions/code structure.
- Owns (may edit): Core runtime/llm/evidence-loop.ts; runtime/llm/candidate-receipt/{receipt.ts,index.ts,tests/receipt.test.ts}; evidence-loop/answered-request.ts and decision-handlers/answered-request.ts with own tests/barrels; runtime/llm/evidence-progress/{stall-redirect.ts,redirect-facts.ts,index.ts} and owning tests; runtime/flow-bootstrap/candidate/submission-refusal.ts and owning tests; own report only. Supervisor approved bounded receipt/answered-request/facts extraction and receipt relocation up one level to preserve directory, depth and coordinator budgets.
- Must not touch: C-owned domain instructions/Core UI files, D owners, shared docs/other reports, .env or user data; no commits/pushes/merges/provider/browser calls/full suites.
- Definition of done: fail-first generic regressions: discovery-only cached accepted submission directs exact trial path without nonexistent draft/amendments; legacy notes unchanged; wrong-control diagnostics distinguish control validity from intended purpose and offer valid alternatives without assuming keep-handle. No test-shaped examples, forced semantic acceptance, trial bypass or spend guard relaxation. Owning tests, actual Core typecheck/audit pass.
- Report to: t452 downstream `docs/working/live-testing-handoff-audit-2026-10-11/reports/candidate-recovery-feedback-b.md`.

### Brief: candidate-recovery-feedback-c
- Repository: same paired t452 trees; files partitioned from B worker.
- Task: generic semantic category filtering guidance and truthful failed-check UI finding text from C's trace.
- Required reads: this Current State; t451 live-c-round4.md/full debug; named source/tests; Core instructions/code structure.
- Owns (may edit): downstream domain/src/runtime/llm-evidence/system-instructions/instructions.ts and tests/instructions.test.ts; Core packages/fluxiq/src/ui/activity-action/check-why.ts and tests/action-of.test.ts; own report only.
- Must not touch: B-owned runtime modules/tests, condition semantics/compiler/catalog contracts, shared docs/other reports/.env/user data; no commits/pushes/merges/provider/browser calls/full suites.
- Definition of done: fail-first generic count-only finding rejected or replaced without false opposing counts; domain guidance distinguishes actual type/category from incidental text mentions using no scenario-shaped example and remains <=3200 characters. Existing filters unchanged. Owning UI/domain tests, affected actual typechecks and audits pass against current library build where needed.
- Report to: t452 downstream `docs/working/live-testing-handoff-audit-2026-10-11/reports/candidate-recovery-feedback-c.md`.

### Brief: a-review
- Repository: downstream lane tree `C:/Users/osrs_/FluxStuff/fxwork/t342/!FluxIQWebExtension` (existing task branch).
- Task: fully debug A round-3 run 2 and assess both runs' qualification, including identity/oracles/replay accounting and UI evidence.
- Required reads: this Current State; lane tree `docs/working/mvp-final-month-plan/reports/lane-a-round3.md`; both A bundles under `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-11/`; run-1 debug and run-2 pending debug.
- Owns (may edit): lane tree `docs/working/mvp-final-month-plan/reports/lane-a-round3.md`, `docs/working/language-driven-flow-loop-plan/debugs/run-mv4jvo7k-612f0bbb.md`, `docs/working/live-testing-handoff-audit-2026-10-11/reports/a-review.md`.
- Must not touch: source, Core, shared working documents, pending debug, other reports; no commits/pushes/merges/builds/launches.
- Definition of done: every step inspected; exact evidence for gate or gaps; saved run identities/provider accounting checked; report and run-2 debug saved without secrets or captured page contents.
- Report to: lane tree `docs/working/live-testing-handoff-audit-2026-10-11/reports/a-review.md`.

### Brief: b-debug
- Repository: downstream lane tree `C:/Users/osrs_/FluxStuff/fxwork/t262/!FluxIQWebExtension` (existing task branch); paired Core read-only.
- Task: trace `run-mv4jqkko-bc9a05c6` build failure to root cause, inspecting every step and relevant source; distinguish recording-practice failure.
- Required reads: this Current State; lane-b-round3.md; run bundle under `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-11/`; paired Core Repository Boundary.
- Owns (may edit): lane tree `docs/working/mvp-final-month-plan/reports/lane-b-round3.md`, `docs/working/language-driven-flow-loop-plan/debugs/run-mv4jqkko-bc9a05c6.md`, `docs/working/live-testing-handoff-audit-2026-10-11/reports/b-debug.md`.
- Must not touch: any code or other docs; no commits/pushes/merges/builds/tests/launches.
- Definition of done: concrete cause with file/line and failed sequence, smallest regression/fix proposal, full debug saved; clearly mark hypotheses; no secrets/page captures in report.
- Report to: lane tree `docs/working/live-testing-handoff-audit-2026-10-11/reports/b-debug.md`.

### Brief: c-validation
- Repository: paired trees `C:/Users/osrs_/FluxStuff/fxwork/t274/!FluxIQWebExtension` and sibling `!FluxIQ` (existing task branches).
- Task: inspect surviving C diffs and three lane-c-r3-fix reports; rebuild affected Core libraries and verify narrow owning tests/typechecks/audits; additionally fix B's confirmed completion-only last-decision defect and accepted-submission test-next guidance without weakening trial/purse gates.
- Required reads: this Current State; three reports in lane tree `docs/working/mvp-final-month-plan/reports/lane-c-r3-fix-{a,b,c}.md`; Core Repository Boundary and code structure; dirty source/test diffs.
- Owns (may edit): the existing dirty Core authoring-loop.ts/tests, progress.ts/candidate-endings.test.ts, loop-budget.ts and tests/loop-budget.test.ts, look-withdrawal.ts and its new finishing-tools test; downstream system-instructions/instructions.ts and tests/instructions.test.ts; own report.
- Must not touch: shared docs, other sources/reports; no commits/pushes/merges/provider/browser launches; no full suites. Generated output only through owning builds.
- Definition of done: fail-first candidate last-decision regression, exact accepted revision test-next guidance; focused candidate/endings/withdrawal/budget/state-digest/instructions tests pass, actual affected typechecks against rebuilt Core pass, both structure audits inspected; report cache concern with evidence, not assumption.
- Report to: downstream lane tree `docs/working/live-testing-handoff-audit-2026-10-11/reports/c-validation.md`.

### Brief: d-trial-feedback
- Repository: new paired task `C:/Users/osrs_/FluxStuff/fxwork/t449/!FluxIQWebExtension` and sibling `!FluxIQ`.
- Task: diagnose D's false-looking terminal failure and fix the underlying graph/compiler bug if confirmed, plus actionable safe graph-level trial feedback.
- Required reads: this Current State; D run bundle and lane `fxwork/t275` evidence; Core Repository Boundary/code structure; `runtime/flow-bootstrap/verification/detached-execution.ts`, `executor/graph-navigation.ts`, `executor/graph-run.ts`, `service/candidate-trial/feedback.ts` and their tests.
- Owns (may edit): Core executor graph-navigation.ts, graph-navigation/edge.ts and barrel (new), step-skip/optional-step.ts and owning imports, step-skip/tests/guarded-group-run.test.ts and graph-navigation tests; candidate-trial feedback source/tests and safe terminal-code producer; matching architecture docs; downstream D debug and own report in t449. Compiler changes require another ownership review.
- Must not touch: C's authoring-loop/progress/loop-budget/look-withdrawal/instructions files, other task trees, shared docs; no commits/pushes/merges, full suites, paid calls or browser launches.
- Definition of done: fail-first regression from D's optional/only-after/repeat shape, no weakening of missing/disconnected-node protection; graph-level failure reported safely without page/selector details; focused tests, affected Core typecheck and audits pass. Report exact source ownership before expanding beyond named modules.
- Report to: t449 downstream `docs/working/live-testing-handoff-audit-2026-10-11/reports/d-trial-feedback.md` and `docs/working/language-driven-flow-loop-plan/debugs/run-mv4jjsvj-25b4dc2a.md`.

### Brief: a-zero-call-replays
- Repository: existing `C:/Users/osrs_/FluxStuff/fxwork/t342/!FluxIQWebExtension` and paired Core, both source frozen at original round-3 pair.
- Task: run the two missing separate provider-free replays of A's accepted saved Flows using exact templates/IDs/hashes in a-review.md; verify full replay gate.
- Required reads: this Current State; a-review.md; testing-facility.md separate replay contract; lane-a-round3.md.
- Owns (may edit): lane tree `docs/working/live-testing-handoff-audit-2026-10-11/reports/a-zero-call-replays.md`, lane-a-round3.md; runtime evidence via owning Lab only.
- Must not touch: source/Core/shared docs/other reports, original profiles or stored Flows; no commits/pushes/merges, provider calls, full suites or user panel management. Do not sync/rebuild from newer source and silently claim the same pair.
- Definition of done: both exact stored hashes unchanged, provider/intervention/harness counts all zero, independent task oracle holds; IDs/build identity recorded; supervised headed replay through isolated Lab topology. If source or artifact unavailable, report blocker without recreating the Flow.
- Report to: lane tree `docs/working/live-testing-handoff-audit-2026-10-11/reports/a-zero-call-replays.md`.

### Brief: candidate-default
- Repository: paired new task `C:/Users/osrs_/FluxStuff/fxwork/t450/!FluxIQWebExtension` and sibling `!FluxIQ`.
- Task: after A's proven gate, change the Core product authoring default to candidate; retain explicit legacy opt-out and raw omitted-mode API compatibility.
- Required reads: this Current State; Core Repository Boundary; `model/authoring-mode/authoring-mode.ts` and tests, affected API handlers/configured-mode tests and conversation command mode resolver; architecture section is reference only.
- Owns (may edit): Core `model/authoring-mode/authoring-mode.ts`, its tests and affected configured-mode API/conversation tests if required; source comments describing the default; own report.
- Must not touch: runtime candidate/LLM/executor modules owned by C/D, architecture/working shared docs (supervisor owns), .env files, user data, Lab defaults; no commits/pushes/merges/full suites/launches.
- Definition of done: unset/blank configured product mode uses candidate, explicit legacy/candidate preserved, invalid values refuse; raw API omitted-mode compatibility retained; fail-first owning/configured API tests and affected package typecheck/audit pass; no build/push claims without observed checks.
- Report to: t450 downstream `docs/working/live-testing-handoff-audit-2026-10-11/reports/candidate-default.md`.

### Brief: storage-reuse-review
- Repository: existing paired t381 trees under `C:/Users/osrs_/FluxStuff/fxwork/t381/`; current Core dev read-only for comparison.
- Task: assess t381 WIP connection reuse against current t435 implementation and B's separate recording persistence failure; identify exact remaining lifecycle/process validation and any merge/ownership defects.
- Required reads: this Current State; t381 report; six files from Core commit 08eafd1a; current database-manager storage owners and t435 runtime-session connection lifetime; saved B provider-free recording failure summary.
- Owns (may edit): only t381 downstream `docs/working/live-testing-handoff-audit-2026-10-11/reports/storage-reuse-review.md`.
- Must not touch: source/tests/shared docs, other reports, generated or runtime data; no commits/pushes/merges/builds/tests/browser/provider launches.
- Definition of done: precise distinction between global database pool, project pool and recording path; compatibility/lifecycle/durability risks; actionable narrow validation/fix plan, including actual dist-backed process probes; hypotheses clearly identified.
- Report to: t381 downstream `docs/working/live-testing-handoff-audit-2026-10-11/reports/storage-reuse-review.md`.

### Brief: test-fixture-verification
- Repository: existing paired t380 trees under `C:/Users/osrs_/FluxStuff/fxwork/t380/`, just integrated current dev by supervisor.
- Task: verify t380's four committed test-fixture changes on current source; correct narrow fixture defects only if reproduced. Keep ready for integration without advancing dev during live qualification streaks.
- Required reads: this Current State; t380 report; Core diff for ebc3a1b3 and current four changed files.
- Owns (may edit): Core `runtime/service/flows/tests/creation.test.ts`, `runtime/tests/service-adaptation/tests/recovery-trace.test.ts`, `storage/canonical-authority/tests/whole-fixture.ts`, `storage/canonical-authority/tests/whole-sql.test.ts`; own report.
- Must not touch: product source/shared docs/other tests/reports, no commits/pushes/merges/full suites/provider/browser calls. No timeout increases; generated output only via owning library build.
- Definition of done: fresh owning Core library build when needed; changed tests plus existing whole-operation/whole-process consumers pass with actual built current code; owning package typecheck and audits pass; lifecycle/copy/WAL isolation inspected; precise results in report, no whole-suite requirement.
- Report to: t380 downstream `docs/working/live-testing-handoff-audit-2026-10-11/reports/test-fixture-verification.md`.

### Brief: live-b-round4
- Repository: existing paired t262 lane trees; source synced by supervisor to current dev with t274/t449/t450.
- Task: qualify `bigbox-retail-pickup-cart-store-remembered-after-creation`, two consecutive candidate creations on one frozen source pair, each followed by separate zero-model replay.
- Required reads: this Current State; lane-b-round3.md and b-debug.md; current testing-facility live/replay/waste-guard rules; original lane-b-candidate task/oracles.
- Owns (may edit): lane `docs/working/mvp-final-month-plan/reports/lane-b-round4.md`, new run-id debugs, own `docs/working/live-testing-handoff-audit-2026-10-11/reports/live-b-round4.md`; runtime evidence through owning Lab scripts only.
- Must not touch: source/shared docs/old reports, .env, user panel/data/profiles; no commits/pushes/merges, full suites, guard overrides or paid automatic relaunches. Core/extension own builds required; no model output cap.
- Definition of done: slot 3, instance t262-slot-3, workspace t262-b; build current Core libraries through owning package scripts, zero-call dry-run ready and four running identities proven before first provider call; headed real extension chat, $0.10 whole-Flow ceiling, one attempt per launch; every run fully debugged/UI reviewed before next. On failure report cause and await changed-source task; on balance error stop all further paid work and alert supervisor. Second paid creation allowed only after first passed and complete debug. Measure independent oracles/unchanged saved hash/zero counters for separate replays.
- Report to: t262 downstream `docs/working/live-testing-handoff-audit-2026-10-11/reports/live-b-round4.md`.

### Brief: live-c-round4
- Repository: new paired t451 lane trees; source synced by supervisor to current dev with t274/t449/t450.
- Task: qualify `everything-store-plus-earbuds-under-50` with two consecutive candidate creations and separate zero-model replays on the frozen pair.
- Required reads: this Current State; original lane-c-candidate reports/task/oracles and C verification report; testing-facility live/replay/waste-guard rules.
- Owns (may edit): lane `docs/working/mvp-final-month-plan/reports/lane-c-round4.md`, new run-id debugs, own `docs/working/live-testing-handoff-audit-2026-10-11/reports/live-c-round4.md`; runtime evidence through owning Lab scripts only.
- Must not touch: source/shared docs/old reports, .env, user panel/data/profiles; no commits/pushes/merges/full suites/guard overrides/automatic paid relaunches. Rebuild only through owners; no model output cap.
- Definition of done: slot 1, instance t451-slot-1, workspace t451-c; same preflight/identities/headed chat/$0.10/single launch/full-debug/zero-model gates as B. Preserve original task, five-page dataset oracle and structured loop requirement. On failure report cause and await changed source; balance error stops all paid work. Only a passing debugged first creation permits second on unchanged pair.
- Report to: t451 downstream `docs/working/live-testing-handoff-audit-2026-10-11/reports/live-c-round4.md`.

### Brief: live-d-round4
- Repository: existing paired t275 lane trees; source synced by supervisor to current dev with t274/t449/t450.
- Task: qualify `social-network-feed-confirm-requests` with two consecutive candidate creations and separate zero-model replays; check saved interruption behavior honestly.
- Required reads: this Current State; original lane-d-candidate task/oracles, latest D run debug and t449 report; current testing-facility live/replay/waste-guard rules; unimplemented D adaptation design is reference only.
- Owns (may edit): lane `docs/working/mvp-final-month-plan/reports/lane-d-round4.md`, new run-id debugs, own `docs/working/live-testing-handoff-audit-2026-10-11/reports/live-d-round4.md`; runtime evidence through owning Lab scripts only.
- Must not touch: source/shared docs/old reports, .env, user panel/data/profiles; no commits/pushes/merges/full suites/guard overrides/automatic paid relaunches. No model output cap; never adopt accept-unchanged-after-one-hold design.
- Definition of done: slot 4, instance t275-slot-4, workspace t275-d; same preflight/identities/headed chat/$0.10/single launch/full-debug/zero-model gates as B. Inspect row completeness/no duplicate acts, rate-limit retries/pacing and persisted recovery structure; distinguish passing outcome from adaptation proof. Failure awaits changed-source task; balance error stops all paid work. Only a passed/debugged first creation permits second on unchanged pair.
- Report to: t275 downstream `docs/working/live-testing-handoff-audit-2026-10-11/reports/live-d-round4.md`.
