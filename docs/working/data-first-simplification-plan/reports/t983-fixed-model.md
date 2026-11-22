# t983 fixed-model discovery

2026-11-22, read-only discovery while t979 final tests wait. No implementation permitted until lead integrates t979 and syncs t983. This tree currently has pre-t979 routing code; inspect the incoming delta before editing.

## Remaining production escalation paths

1. `runtime/llm/role-routing/resolution.ts`: resolves all stronger Claude providers in advance, permits separate explore/judge/repair models from run overrides, and constructs the ladder. `provider.ts` dispatches requests according to active ladder level. `judge-model.ts` separately selects the judge model. `ladder/` owns mutable state, frame, climb logging and attempt identity.
2. `runtime/llm/decision-handlers/model-decision.ts`: executable escalate_model handler. `loop-check.ts`: automatic climbs for no progress or detected loops. Additional OUTSIDE-BRIEF path `decision-handlers/loop-signal.ts`: automatically climbs on change_approach.
3. Additional OUTSIDE-BRIEF path `runtime/llm/attempt-loop/run.ts`: automatically climbs after a failed repair round, preserving shared frame for nested loops.
4. Additional OUTSIDE-BRIEF path `runtime/llm/anthropic/panel-command.ts`: independent provider retry path selects the next stronger Claude model.
5. `runtime/llm/loop-decision/{tool-id,tool,ask,read}.ts` advertises/parses escalation; `options.ts` withholds ask_person until changed approach AND climbed/top. Additional OUTSIDE-BRIEF `decision-handlers/decision-options.ts` supplies those ladder facts. `repeat-guard/loop-detection/watch.ts` and completion/refused-words.ts mention escalation as a recovery option.
6. Additional OUTSIDE-BRIEF `repeat-guard/loop-detection/attempt-record.ts` persists optional version-1 ladder data and decisions; restore reconstructs live ladder from persisted seed. Removing only the obvious call handler leaves automatic escalation and restored-level routing executable.

## Defaults and compatibility

`runtime/models/catalog/default-model.ts` owns generic engine default `deepseek-flash`, explicit FLUXIQ_LLM_DEFAULT_MODEL, and provider-specific default fallback; `catalog/anthropic.ts` owns supported Claude models. Automation role-routing currently falls back to Haiku only when an unnamed engine default resolved to a stronger Claude. P4 should make the automation starting-model selection explicit while preserving an explicitly selected nondefault model. Confirm whether generic catalog default or automation-only default should change before editing that global behavior.

`runtime/run-overrides/frame.ts` exposes optional models.explore/judge/repair, while role-routing/index.ts reexports ladder APIs. Persisted attempt records have version 1, optional ladder base/escalations and decision history. Preserve old records as readable historical data; ignore old escalations for serving calls and reject obsolete live escalate_model instructions with actionable feedback. Avoid gratuitously deleting compatibility exports or changing record versions. Distinct role overrides must no longer cause switching within one automation task; document handling rather than silently choosing a stronger judge.

Attempt identity is currently tied to ladder frame by ladder/attempt-key.ts. Keep a stable attempt identity seam for Anthropic cached continuation when ladder mutation disappears; otherwise judge continuation breaks even though model routing is fixed. t979 adds semantic standalone fallback metadata that must remain same-model after sync.

## P3 follow-up owners

Initial guidance owner is `runtime/llm/evidence-loop-decision.ts`, whose instruction currently tells the model to call core.set_result_processing and describes row conditions. Related tool guidance lives in `runtime/llm/node-tools/result/` and authoring/result-processing. Follow-up should explain broad collection and all-column retention only after P1/P2 contracts land, and must not claim automatic processing already exists. Keep every example generic.

## Requested scope extension

Need approval for decision-handlers/loop-signal.ts and decision-options.ts; attempt-loop/run.ts; anthropic/panel-command.ts; repeat-guard/loop-detection/attempt-record.ts and directly owning tests. These are executable paths or persisted restore owners, not optional cleanup. Model catalog/default and run-overrides configuration need a concrete compatibility choice and any required related type/test scope.

Validation: read-only searches and named source reads only. No heavy command, paid call, code edit, or git mutation for t983.

2026-11-22 implementation resumed after lead integrated t979 and synced both trees. Production routing now resolves one starting model, ignores legacy per-role model switches, and uses Haiku only as automation's unnamed default. All automatic/model-requested escalation triggers are removed; inert compatibility APIs preserve old ladder histories and continuation identity. Person-question route no longer depends on climbing or approach counts; its genuine-impossibility explanation remains required. Panel retries retain the starting model. Owning tests are being migrated before the first narrow gate. P3/data guidance files remain untouched.

Later-attempt gap traced and lead approved task-memory/model seam. Added optional schema-v1 startingModel public ID, task-model resolver before service dispatch, and atomic first-writer selection under the existing task-memory lock. A different task identity can choose another explicit model. Existing-task continuations ignore later model/role overrides. Legacy inference uses only ordinal-one explicit caller model; absent that, documented automation/provider default. No inference from later escalated calls. Provider resolution failures do not save a model. New focused tests cover durable restarts, Run again identity, legacy data, concurrent owners and real-service caller continuation. Permission worker confirmed no overlap with the provider-resolution service.ts hunk.

Lead review correction before queued checks started: invalid present startingModel now throws a precise model/storage validation error from readHeld instead of being read as absent. This avoids unscoped legacy recovery setting aside the entire readable task and selecting a new default. Added unscoped restart regression requiring no resolver/generation call, byte-identical original file and no .unreadable rename. Missing model remains backward compatible. Existing test/type jobs remain queued; no additional heavy job was submitted.

First focused gate observed: 15 test files passed, 97 tests passed, including real-service nondefault-model continuation across restart/new-task, t979 unreadable native fallback, same-model routing, loop decisions, loop recovery, window/cost accounting and existing task-memory tests. One new task-model suite failed during module collection because its AutomationStudioProjectPaths import climbed one directory too far; no test from that suite ran. Package typecheck is still active; source stays frozen until it returns, then correct the test import and rerun that owner only.

Package check returned only test issues: the same missing ProjectPaths import and four calls to a test provider whose inferred zero-argument stub needed its real request parameter. Corrected both test contracts; no production type error was reported. Requeueing a focused task-model/role-resolution/runtime-judge regression stage, followed by package check and audit serially.

Focused rerun ran all 54 assertions successfully (7 task-model, 2 fixed-role, 45 runtime judge), but suite guard rejected the new disk-backed task-memory tests without the real-SQL marker: document locks themselves open SQLite. Added the required marker; no timeout was raised. Applied lead-requested normal task-model barrel import/delegation in service.ts, corrected comments, and kept service.ts at its prior 4,304 lines. Mode delegation now lives in the focused helper. Architecture contract added in docs/architecture/automation-studio/llm-flow-bootstrap.md for defaults, explicit choice, persistent task identity, concurrent winner, legacy model/role/ladder data and fail-closed corrupt records. A Windows default text-decoding error interrupted the first documentation write only; reran it explicitly as UTF-8. Final task-model/real-service integration stage is now running, with no other new heavy job enqueued.

Last task-model stage: real service 12/12 passed; 7/8 helper cases passed. One manual Run-again test input omitted the newly required authoringMode and therefore correctly took the non-Answer-First delegate; added its explicit mode. No product task identity change. Lead expanded interpreter scope after permission worker confirmed frozen, disjoint changes: removed active ConversationModelClimb construction/requests and rung-up claims while preserving correction text, retries, deadlines, paid callbacks and fallback routing. Kept deprecated type/field readable and inert; updated owning unanswered-task/recorded-chat tests. Architecture note now records same-model interpreter retry too. Permission worker's later declaredActs helper/success-return spread must be preserved at integration.

Final interpreter/task contract stage: 6 files passed, 72 tests passed (115.29 s), including eight task-model persistence/concurrency/corrupt-record cases, twelve real-service caller cases, twenty-eight interpreter regressions, recorded-chat/unanswered-task recovery, and panel same-model retry. Runtime model selection regression separately passed 45/45, and fixed-role resolution 2/2 in the preceding stage; its overall guard failure was corrected by the required real-SQL marker. Architecture updates now also replace the obsolete live model-ladder section in docs/architecture/automation-studio/failure-control.md and the old round-model reference in llm-flow-bootstrap.md. Source and docs frozen; audit next, package check after it, each as a separate gated stage.

Structure audit first run: four violations, all imports/formatting. Switched new resolver-contract type imports to runtime/llm barrel; changed attempt-record's old state.ts import to its now-usable ladder barrel; split the new test callback's packed statements. No import-cycle or baseline growth was reported. Audit rerun precedes package check; no baseline was relaxed.

Audit formatting/import fixes are in place. The first audit rerun failed in the Windows command wrapper before delivering an audit result (`Select-Object` was interpreted by cmd); no t983 audit child remained. Requeued the audit directly as node scripts/structure-audit.mjs through the gate, without shell output filtering. This is a harness invocation failure, not a new product finding.

## Final frozen handoff

Final package gate passed: `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t983-final-types -- pnpm --filter fluxiq check` -> exit 0; fluxiq:check executed TypeScript (66,731 ms), no diagnostics. `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t983-audit-direct -- node scripts/structure-audit.mjs` -> exit 0, structure-audit passed (562 warnings, 909 baselined). `git diff --check` -> exit 0, no output.

Final focused behavior command, under gate t983 final stage: `pnpm --filter fluxiq exec vitest run --maxWorkers=1 --minWorkers=1 --fileParallelism=false src/framework/automation-service/service/answer-first/task-model/tests/resolve.test.ts src/framework/automation-service/service/answer-first/attempt/tests/caller-seams.test.ts src/runtime/conversations/instructions/tests/unanswered-task.test.ts src/runtime/conversations/instructions/tests/recorded-chat-requests.test.ts src/runtime/conversations/instructions/tests/interpret.test.ts src/runtime/llm/anthropic/tests/panel-command-climb.test.ts` -> 6 files passed, 72 tests passed. Earlier observed focused behavior gates and their corrected collection/guard/test-fixture failures are recorded above; do not mistake those failed invocations for passing suite gates.

Exact authored architecture docs changed in Core: `docs/architecture/automation-studio/llm-flow-bootstrap.md` and `docs/architecture/automation-studio/failure-control.md`. New `answer-first/task-model/{index,resolve}.ts` and `task-model/tests/resolve.test.ts`; durable model field in `task-memory/{memory,store}.ts`; service delegation, attempt barrel/caller/helper tests, completion refusal guidance, interpreter model/interpret and two owning tests; runtime role-routing (including inert ladder compatibility and owning tests), loop-decision/decision-handlers and tests, attempt-loop/run and tests, repeat-guard attempt-record/watch, Anthropic panel-command and test, and run-overrides/frame.ts. No downstream product source changed. Full exact Core file list follows for lead staging.
docs/architecture/automation-studio/failure-control.md
docs/architecture/automation-studio/llm-flow-bootstrap.md
packages/fluxiq/src/framework/automation-service/service.ts
packages/fluxiq/src/framework/automation-service/service/answer-first/attempt/index.ts
packages/fluxiq/src/framework/automation-service/service/answer-first/attempt/tests/caller-seams.test.ts
packages/fluxiq/src/framework/automation-service/service/answer-first/completion/refused-words.ts
packages/fluxiq/src/framework/automation-service/service/answer-first/task-memory/memory.ts
packages/fluxiq/src/framework/automation-service/service/answer-first/task-memory/store.ts
packages/fluxiq/src/framework/automation-service/service/answer-first/tests/later-attempts.ts
packages/fluxiq/src/runtime/conversations/instructions/interpret.ts
packages/fluxiq/src/runtime/conversations/instructions/model.ts
packages/fluxiq/src/runtime/conversations/instructions/tests/recorded-chat-requests.test.ts
packages/fluxiq/src/runtime/conversations/instructions/tests/unanswered-task.test.ts
packages/fluxiq/src/runtime/llm/anthropic/panel-command.ts
packages/fluxiq/src/runtime/llm/anthropic/tests/panel-command-climb.test.ts
packages/fluxiq/src/runtime/llm/attempt-loop/run.ts
packages/fluxiq/src/runtime/llm/attempt-loop/tests/run.test.ts
packages/fluxiq/src/runtime/llm/decision-handlers/decision-options.ts
packages/fluxiq/src/runtime/llm/decision-handlers/loop-check.ts
packages/fluxiq/src/runtime/llm/decision-handlers/loop-signal.ts
packages/fluxiq/src/runtime/llm/decision-handlers/model-decision.ts
packages/fluxiq/src/runtime/llm/decision-handlers/tests/loop-decision.test.ts
packages/fluxiq/src/runtime/llm/loop-decision/ask.ts
packages/fluxiq/src/runtime/llm/loop-decision/options.ts
packages/fluxiq/src/runtime/llm/loop-decision/read.ts
packages/fluxiq/src/runtime/llm/loop-decision/tool-id.ts
packages/fluxiq/src/runtime/llm/loop-decision/tool.ts
packages/fluxiq/src/runtime/llm/repeat-guard/loop-detection/attempt-record.ts
packages/fluxiq/src/runtime/llm/repeat-guard/loop-detection/watch.ts
packages/fluxiq/src/runtime/llm/role-routing/index.ts
packages/fluxiq/src/runtime/llm/role-routing/judge-model.ts
packages/fluxiq/src/runtime/llm/role-routing/ladder/climb.ts
packages/fluxiq/src/runtime/llm/role-routing/ladder/state.ts
packages/fluxiq/src/runtime/llm/role-routing/ladder/tests/state.test.ts
packages/fluxiq/src/runtime/llm/role-routing/provider.ts
packages/fluxiq/src/runtime/llm/role-routing/resolution.ts
packages/fluxiq/src/runtime/llm/role-routing/tests/judge-same-model.test.ts
packages/fluxiq/src/runtime/llm/role-routing/tests/ladder-resolution.test.ts
packages/fluxiq/src/runtime/llm/role-routing/tests/provider.test.ts
packages/fluxiq/src/runtime/llm/role-routing/tests/resolution.test.ts
packages/fluxiq/src/runtime/llm/role-routing/tests/served-model.test.ts
packages/fluxiq/src/runtime/llm/role-routing/tests/served-window.test.ts
packages/fluxiq/src/runtime/run-overrides/frame.ts
packages/fluxiq/src/framework/automation-service/service/answer-first/task-model/index.ts
packages/fluxiq/src/framework/automation-service/service/answer-first/task-model/resolve.ts
packages/fluxiq/src/framework/automation-service/service/answer-first/task-model/tests/resolve.test.ts

Outcome: Done
Changed: Core files listed above and this downstream worker report; source frozen for lead review/integration
Validation: final 72-case focused behavior gate, package typecheck, structure audit and diff whitespace check passed; prior additional focused assertions/results recorded above
Not verified: parent/dev combination after sync; full suites, live provider/browser behavior, P3 data guidance (intentionally outside scope)
Report: docs/working/data-first-simplification-plan/reports/t983-fixed-model.md
Notes: No git mutations, paid actions, cap or baseline relaxation. Preserve permission worker's declaredActs additions at integration. Lead owns commits, sync and independent acceptance verification.

## Lead acceptance, 2026-11-22

Permission source and current parent are merged. Lead independently observed **20 files / 140 tests passed in 152.82 s**, covering original-model persistence/concurrency/corruption, actual service continuation/replay, start-only permission, interpretation and all changed model-routing/loop handlers. Package typecheck passed (90,624 ms); structure audit passed (564 warnings, 909 baselined). Exact commands are in paired Core's working ledger. Version is 0.51.0. Final parent sync was documentation-only; library dependency build and paired integration remain. No live/browser/provider/full-sweep acceptance claimed.
