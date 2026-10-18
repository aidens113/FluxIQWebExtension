# Saved replay person handoff diagnosis

Status: Bounded correction implemented; owning tests, both package typechecks and both native audits passed. Source frozen for supervisor review. No build/browser replay/paid probe executed.
Owner: storage_comparison (worker). Date: 2026-10-18.

The failed saved replay did reach Core's deterministic person-needed handling, but its ask could not be persisted. A declared Lab actor is also absent from the saved-replay launcher; adding that actor alone cannot fix this recorded failure.

## Actual evidence

Receipt: `C:/Users/osrs_/FluxStuff/fxwork/t566/!FluxIQWebExtension/test-runs/instances/bf-slot-3/replays/replay-mvdjb3nf-5da28870.json`. Runtime run `21e98781-ca45-47d7-9e01-e675f96aff26`, project `a47be866-d10e-41f2-bc37-b86f3150d4e6`, Flow `flow.ddea0e5c-b845-45d3-844e-6c18660729f6`. Saved content hash/origin retained; seven of ten expected records, terminal failed, next-page action `user_intervention_required` / `web.intervention.required`. No full acceptance.

Read-only SQLite inspection of the existing project's project.sqlite established:

- Failed attempt `node.bootstrap.5f93fc20e19b0c44.collect_hubs.s7.attempt.12` has metadata.ask `{kind: choice, status: pending, personNeeded: true}`.
- That EXACT attempt ID already exists as an answered `conversation_asks.ask_id` in an earlier run conversation.
- New replay conversation `conversation.03def6dc-7557-4a1d-a01f-5e65ff88e2b3` has zero turns and zero pending asks; there are no asks belonging to it.
- Entire project contains only two person-check ask rows, both answered before this replay. Thus the actor has no new persisted ask to observe.

Inspection used SQLite URI mode=ro with Windows extended path support, selected only structural metadata and IDs, and closed connection. No runtime state was changed. Database path: `test-runs/instances/bf-slot-3/persistent-isolated/codex-crossborder-positive-t566-20261018-r2/fluxiq-root/.fluxiq/artifacts/automation-studio/projects/a47be866-d10e-41f2-bc37-b86f3150d4e6/project.sqlite` under t566 downstream.

## Causal source chain

Core `runtime/executor/person-needed.ts:80-81` uses run-local attemptId as project-global askId. Attempts restart at the same ordinal for the same saved graph. `runtime/parking/conversation-port.ts` opens through writer.ask; `runtime/conversations/store.ts:348` inserts ask with plain INSERT into project-wide PRIMARY KEY ask_id. The duplicate ID cannot be inserted; turn and ask transaction rolls back. `executor/step-loop/ask-or-park.ts` records pending metadata before open, catches open failure and ends failed rather than wait forever. This explains the exact pending-metadata/empty-thread combination. No exception stack was retained in the receipt; the collision is established directly by persisted identity and owning INSERT semantics, rather than an observed stack string.

The deterministic Core path is independent of model recovery intent. Ordinary project runtime service binds conversation parking. Existing executor/tests/person-needed.test.ts covers Continue/Stop/timeouts/cap with no model. The original completed run's answered handoffs also demonstrate this Flow reaches declared checks normally.

Downstream `run-scenario.ts:404` starts startLabPerson before execution. `saved-flow-replay/replay-saved-flow.ts` opens browser, resets/arms fixture and executes saved Flow without starting actor. Existing person-simulation actor polls actual Core conversation asks, handles only declared person-check controls, completes fixture's person module and answers normal person_done/person_stop. It cannot act until an ask exists, so both seams need correction.

## Approved scope (proposal below retained as design record)

Core (t566 own paired tree, shared frozen Core untouched):

- `packages/fluxiq/src/programs/automation-studio/runtime/executor/person-needed.ts`
- Existing `packages/fluxiq/src/programs/automation-studio/runtime/executor/tests/person-needed.test.ts`

Mint globally distinct person-needed ask IDs (existing flow-bootstrap/person-needed.ts uses person-needed.UUID), retain raisedBy.attemptId provenance and preserve persisted ask ID through resume. Current GraphExecutionOptions has no runId; avoid broad run-ID plumbing for this narrow fix. Red-first repeated same Flow/attempt ordinal against one persistence-like host must not reuse answered ask, then Continue second run independently. Keep Stop/timeout/cap/unbound and resumed pending ask behavior. If a genuine SQLite regression cannot fit this existing owner, propose existing conversations/tests/store.test.ts separately before editing.

Downstream:

- `packages/test-runner/src/saved-flow-replay/replay-saved-flow.ts`
- New owning `packages/test-runner/src/saved-flow-replay/tests/replay-saved-flow.test.ts`

Use existing startLabPerson with real project/domain/browser.context/scenario/workflow/task.personCheck; start before saved run and finish before browser close on success or failure, persist structural handoff evidence under replay's own directory. Never proactively clear check or change permissions. Test lifecycle ordering and cleanup failures with narrow seams; no broad launcher refactor. Any extra helper/barrel needs separate ownership proposal if required by structure budget.

Narrow tests in changed owners, Core and test-runner package typechecks, both structure audits; Core library-only cache-off build only after source approval and no readers. No full suites.

## Proposed provider-free browser proof (not executed)

After approved fixes and gates, run supported saved replay against SAME existing persistent workspace and Flow, unchanged hash/origin, model providers disabled, process credential guard and stored keys preserved. Require newly persisted real person_check ask answered through declared actor, exact ten ordered records/forty fields and final-state oracle, finalized explicit zero provider calls/harness activations. Failed run accounting currently remains UNKNOWN: calls/providerCallCount/accountedCalls are null, not zero. Failed runs are not held for post-run verdict/accounting by provider-free-replay-run.ts, so this may be a distinct accounting seam; do not change null to zero. Successful proof must inspect actual finalized receipt rather than infer from disabled providers.

The initial diagnosis performed no source edits or tests. The subsequent supervisor-authorized implementation and validation are recorded below. No build, browser probe, paid call, commit or push has been performed. Existing unrelated debug evidence was preserved through supervisor sync.


## Implemented outcome and current validation

Supervisor authorized the exact two Core and two downstream owners in the main plan's repeatable-person-asks/saved-replay brief. Core mints person-needed.UUID only for an actual new automatic person-needed ask; raisedBy.attemptId stays the original attempt ID. Durable resume continues with the stored ask ID, including Stop/timeouts and the run-wide cap. No schema, permission, public protocol or run-ID plumbing changed.

Saved replay now starts the existing declared actor after browser start/reset/variant readiness and before the saved run. It forwards the selected project, browser context, scenario, task.personCheck and workflow/variant; the existing actor's web-automation domain default remains the owning domain. It does not supply permission defaults. Finally it finishes the actor before browser/Core teardown and writes per-replay person-hand-offs.json beside extension-start.local.json. A sidecar write failure is an explicit failed-replay reason. The testability seam injects existing external collaborators in this same owning module, avoiding a separate lifecycle implementation or production helper.

Red evidence: Core new repeated-saved-Flow test against shared durable-shaped ask map failed on original identity (14pass/1fail), second run failed before a fresh ask could be stored. Downstream absent-actor hunk was temporarily restored while retaining collaborator seams: both ordering tests failed, then actor hunk restored. Initial unit setup errors (missing action node/browser pages) were corrected before final successful-receipt assertion; these were harness issues, not browser or product conclusions.

Final owning results:

- Core person-needed + existing conversation-port + conversation store: 36/36 PASS, Vitest24.74seconds, max2workers. Core package tsc --noEmit actual exit0.
- Downstream owning saved replay lifecycle: 2/2 PASS,8.616seconds. Tests verify actor-before-execution, finish-before-browser/Core close, real task/workflow/variant/context/project forwarding, no permission defaults, written sidecar, successful receipt versus failed execution receipt.
- Downstream package tsc final native exit0,11.119seconds. Direct owning tsc avoids the build-currency wrapper because Core executable source is intentionally changed and not yet authorized for library build; no contract/type changes involved.
- Downstream structure audit native exit0,24.758seconds,211warnings/638baselined. Core structure audit native exit0,32.840seconds,402warnings/1154baselined.
- Both git diff --check commands passed. Source frozen for supervisor independent review; no full suite.

All paths absolute under C:/Users/osrs_/AppData/Local/Temp:

- t566-person-red.log
- t566-person-green.log
- t566-person-core-check.log
- t566-person-core-audit-final.log
- t566-person-runner-check-final.log
- t566-person-runner-audit-final.log
- t566-saved-person-red.log
- t566-saved-person-tests.log
- t566-saved-person-bundle.mjs (reviewable test-only esbuild helper; normal dist not rebuilt)

Exact focused commands, respective package working directories:

Core packages/fluxiq: `pnpm.cmd exec vitest run src/programs/automation-studio/runtime/executor/tests/person-needed.test.ts src/programs/automation-studio/runtime/parking/tests/conversation-port.test.ts src/programs/automation-studio/runtime/conversations/tests/store.test.ts --minWorkers=1 --maxWorkers=2`; `pnpm.cmd exec tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo`.

Downstream root: `node C:/Users/osrs_/AppData/Local/Temp/t566-saved-person-bundle.mjs`; `node --enable-source-maps --test packages/test-runner/node_modules/.cache/codex-saved-person/replay-saved-flow.test.mjs`. Downstream packages/test-runner: `pnpm.cmd exec tsc -p tsconfig.json --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo`.

Each repository root: `node scripts/structure-audit.mjs`. FLUXIQ_BUILD_CACHE_DIR=off process-only for compilation commands. Audits were recaptured through Python subprocess because Windows PowerShell redirection returned shell1 for native stderr warnings even while native tool printed passed; final native exit is authoritative.

Remaining proof: supervisor review, authorized own-tree Core library build/current runner build, then explicit provider-free saved replay release and actual exact dataset/final-state/fresh-ask/zero-accounting inspection. Units do not prove the live handoff or finalized accounting.
