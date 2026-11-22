# t976 permission continuation, 2026-11-22

Worker: p0_permission. Paired trees: `fxwork/t976/!FluxIQ` and `fxwork/t976/!FluxIQWebExtension`. No git mutations or paid runs.

## Final state

**Done, ready for lead integration and independent verification.** Chat interpretation declares act classes in its existing call; startup asks once about unanswered classes, combines actual saved-Flow declarations, and retains grants/refusals across attempts. Pending startup is shared by concurrent callers. Both wrapper and underlying gate close after settlement. Unforeseen or declined classes remain refused without a new request, a permission-induced loop abort, or silent authorization; repair and legacy/candidate/project paths can continue to another route. Missing request identifiers do not turn a held decline into a grant.

Final acceptance: **170 focused Core tests passed** (15 files), **66 Lab permission/person/lane tests passed**, **13 catalog tests passed**; Core and Lab package checks/builds and both structure audits passed. The updated startup fixture was independently rerun, **11/11 passed**. The four stale cleared-interruption cases were reconciled and their file passed **7/7** earlier; that pure helper was not changed afterward. No full sweep, live browser run, paid call or panel management occurred.

Lead-authored paired docs are included: Core `docs/architecture/automation-studio/client-action-effects.md` and downstream `docs/architecture/testing-facility.md`. Executable source, service.ts and interpretation seams are frozen/handed off to the lead/P4.

## Reproducible final acceptance commands

All heavy steps below ran through `C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <unique-label> -- <command>`, with no priority/threshold override. The following are the exact underlying commands and working directories, so acceptance does not depend on an ignored runner. Stages released and requeued separately during final builds/Lab validation.

**Core package directory:** `C:/Users/osrs_/FluxStuff/fxwork/t976/!FluxIQ/packages/fluxiq`.

```powershell
node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 src/runtime/action-permission-requests/tests/task-start.test.ts src/runtime/flow-authoring/bootstrap/tests/action-permissions-task-start.test.ts src/framework/automation-service/service/answer-first/chat-permission/tests/one-question-per-chat.test.ts src/framework/automation-service/tests/service-bootstrap/tests/permission.test.ts src/framework/automation-service/tests/service-bootstrap/tests/permission-ask.test.ts
```

Observed: **5 files / 43 tests passed**, exit 0. After the fixture typing correction, the same command restricted to `src/runtime/flow-authoring/bootstrap/tests/action-permissions-task-start.test.ts` passed **1 file / 11 tests**; executable behavior was unchanged.

```powershell
node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 src/runtime/flow-authoring/bootstrap/tests/action-permissions-task-start.test.ts
```

Observed: **1 file / 11 tests passed**, exit 0, after supplying the required empty constructor arrays. A later formatting-only statement split passed the structure audit.

```powershell
node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 src/runtime/flow-authoring/bootstrap/tests/action-permissions.test.ts src/runtime/flow-authoring/bootstrap/tests/action-permissions-witness-notes.test.ts src/framework/automation-service/service/answer-first/chat-permission/tests/store.test.ts src/framework/automation-service/service/project-build/tests/project-build-brief-ports.test.ts src/framework/automation-service/service/answer-first/flow-run/tests/permission-start.test.ts src/framework/automation-service/service/answer-first/attempt/tests/caller-seams.test.ts src/framework/automation-service/service/answer-first/attempt/tests/caller-replay.test.ts src/runtime/adaptation/recovery/tests/runtime-exploration.test.ts src/runtime/adaptation/recovery/annotation/tests/recovery-permissions.test.ts src/runtime/adaptation/recovery/tests/runtime-exploration-permission.test.ts
```

Observed: **10 files / 127 tests passed**, exit 0. Coverage includes saved replay without extra calls, held declines, repair continuation and actual legacy/project permission paths.

```powershell
node ../../node_modules/vitest/vitest.mjs run src/framework/automation-service/service/answer-first/flow-run/tests/steps-ran-interruption.test.ts
```

Observed in the initial focused batch: **1 file / 7 tests passed**, including the four reconciled cleared-interruption expectations. This pure helper/test file was unchanged afterward; it was not redundantly rerun.

**Core repository directory:** `C:/Users/osrs_/FluxStuff/fxwork/t976/!FluxIQ`.

```powershell
pnpm --filter fluxiq check
node scripts/structure-audit.mjs
pnpm --filter fluxiq build
pnpm --workspace-concurrency=1 --filter @fluxiq/contracts --filter @fluxiq/sdk --filter fluxiq --filter @fluxiq/client-gateway-websocket --filter @fluxiq/ui-components build
```

Observed: package check **exit 0**, cache stamp stored; audit **`structure-audit: passed (563 warning(s), 909 baselined).`**; changed package build **exit 0**; required five-library preparation **exit 0** (four reused cache, ui-components rebuilt against current Core). This is the dependency subset named by the downstream freshness guard, not a full workspace sweep.

**Downstream repository directory:** `C:/Users/osrs_/FluxStuff/fxwork/t976/!FluxIQWebExtension`.

```powershell
pnpm --workspace-concurrency=1 --filter @fluxiq-web-extension/test-runner... build
pnpm --filter @fluxiq-web-extension/scenario-lab build
pnpm --filter @fluxiq-web-extension/test-runner check
node scripts/structure-audit.mjs
```

Observed: all commands **exit 0**. Five Lab dependency packages built/restored successfully; scenario-lab restored a matching cached build; test-runner check stored its passing stamp. Audit: **`structure-audit: passed (256 warning(s), 551 baselined).`** Both paired `git diff --check` commands also exited 0.

**Lab package directory:** `C:/Users/osrs_/FluxStuff/fxwork/t976/!FluxIQWebExtension/packages/test-runner`.

```powershell
node --test dist/flow-lane/creation/tests/permission-point.test.js dist/person-simulation/tests/simulation.test.js dist/person-simulation/tests/asks.test.js dist/run-evaluation/permission-stop/tests/permission-stop.test.js dist/flow-lane/creation/tests/lane.test.js
```

Observed: **66 tests passed, 0 failed**, exit 0. These tests now actually load and run against current Core/domain/contracts artifacts; the earlier missing-module limitation is resolved.

**Scenario Lab directory:** `C:/Users/osrs_/FluxStuff/fxwork/t976/!FluxIQWebExtension/apps/scenario-lab`.

```powershell
node --test dist/scenarios/tests/live-instructions.test.js
```

Observed: **13 tests passed, 0 failed**, exit 0. The task `social-network-feed-delete-stranger-requests` explicitly declares `{ consequence: "delete", control: "Delete" }`; the Lab's task-start simulation recognizes its declared class without requiring a control name.

## Not verified

No real extension chat/browser session or paid model interpretation was exercised. The live model's act-class accuracy remains for the later provider-free/live campaign. No whole workspace sweep was run, as directed. The lead still owns parent synchronization, independent acceptance, commits and pushes.

## Progress

- Read the written brief, current plan decisions, Core boundary/validation and code structure, and the older permission report.
- Inspected both working trees before edits. Option (c) is partly implemented in interrupted work: the chat interpretation already carries declared act classes into answer-first. This supersedes the older report's added instruction-read approach.
- Repair currently refuses unknown consequences without asking, but it terminates exploration with `operator_approval_required`; checking this against the task's required continuation behavior before accepting it.
- Legacy/candidate/project gates have lazy start wiring; checking ask closure and held refusal handling before testing.
- Baseline narrow Core run passed all 21 selected files (258 tests). It also confirmed that several missing invariants were not covered: the gate still allowed a second saved-Flow permission question and runtime repair terminated on an uncovered consequence.
- Added aggregation of the saved Flow's actual assembled consequence declarations before the start question, ahead of witness reads; the start gate now closes after its single question. The lead approved the added flow-run/permission, flow-stage and related seam/test scope.
- Legacy/candidate/project production entry now starts permission before its first model decision; every brief shares the completed start and its held answer.
- Added a closed-asking state to the shared permission gate: runtime repair refuses uncovered acts as ordinary evidence and keeps exploring. Recovery reads both held grants and held declines from the same chat, and records newly discovered classes for the next task start.
- Added provider-free coverage for combined saved-Flow classes, chat interpretation/command forwarding, persisted answers after restart, and repair refusal/continuation.
- Lead review caught a held decline with a missing request identifier overriding an existing grant. The gate now retains that decline (`requestId: null`, `declined: true`); a regression starts with the class already permitted and proves it is still refused without another ask.
- A post-change run reached 115 tests: 106 passed, 9 failed. Causes: six stale request/stop expectations, two refusal-count assertions exposed that the continuing repair no longer counted gate refusals, and one test saw pre-edit gate code after the lead's edge regression was added during the run. Fixed refusal accounting and accurate refused-patch traces; reconciled old request assertions. Source and tests are frozen for the next validation.

## Validation

- `node ../../node_modules/vitest/vitest.mjs run <21 focused permission, interpretation and caller files>` (via heavy slot, before continuation edits): **21 files / 258 tests passed**, exit 0. Includes the four reconciled cleared-interruption cases.
- `pnpm --filter fluxiq check`: **exit 0**, no type errors. Cache did not stamp because tests were added during the run. A second check on the frozen tree is queued.
- `node scripts/structure-audit.mjs`: one introduced violation, `service.ts` 4306 lines against baseline 4304. Corrected an obsolete three-line comment to the accurate one-line repair rule, returning it to its baseline; audit will be repeated.
- Final focused tests (one worker) and frozen-tree typecheck are queued behind other lanes at the machine heavy-slot gate. Machine free memory was 0.5 GiB at queue entry; no concurrency override used.
- Frozen focused rerun: **15 files, 147 passed / 2 failed**. All implementation behavior passed, including the missing-id decline regression. The two failures were old assertions expecting a fresh ask when a decline lacked its id, and expecting no patch receipt when the repair now legitimately continues. Updated those two assertions after the run finished, while typecheck was still queued.
- Queued a single serial provider-free validation job in ignored `.fluxiq/tmp/t976-lab-validation.mjs`: recheck the two corrected files and the previously reported answer-first regressions, build the changed Core package, build only the Lab dependency closure, check the Lab package, run permission/person/lane tests, run the scenario catalog check, and run the downstream audit. It stops at the first failed step. Source is frozen.
- Frozen-tree `pnpm --filter fluxiq check`: **exit 0**, no type errors, cache stamp stored. Updated only two explanatory source comment blocks afterward to describe refusal/continuation accurately; executable source and test assertions remain unchanged while remaining gates wait.
- Lead authored the paired architecture notes in Core `docs/architecture/automation-studio/client-action-effects.md` and downstream `docs/architecture/testing-facility.md`. Worker leaves these lead-owned edits unchanged; the queued audits cover them.
- Final Core audit, including the lead's authored architecture edit: `node scripts/structure-audit.mjs` -> **`structure-audit: passed (563 warning(s), 909 baselined).`**, exit 0.
- Inherited regression pass: **22 files / 195 tests, 192 passed / 3 failed**. Every prior answer-first regression passed. Three old recovery expectations still treated refused-only evidence as gathered evidence or expected a terminal permission request; these were reconciled to continuation with `no_evidence_found`.
- Additional entry/gate checks: **5 files / 63 tests, 61 passed / 2 failed**. Both remaining legacy assertions were stale: a generic start request precedes per-action instruction authority, and a chat that already declares an empty act list makes no extra instruction read. Updated the assertions and supplied the read-only chat declaration to that fixture.
- The serial job resumed with only the three corrected files, followed by final Core package check/build and Lab dependency build/check/test/catalog/audit. It stops on the first failure; unchanged passing tests are not being repeated.
- That recheck passed **3 files / 54 tests**, and Core package typecheck passed. Stopped its Core build (no paid work) when lead review identified a real underlying-gate lifecycle gap, before modifying executable source.
- Root cause: the startup wrapper closed but its underlying gate still raised an unforeseen request before the wrapper changed the returned id to null. Legacy/candidate `endedOnRequest()` could still read that outstanding request and end authoring. Startup now closes the underlying gate in `finally` after its one question is raised/settled; subsequent unknown actions never create a request. Unforeseen reporting also handles a verdict whose id is already null.
- Concurrent calls and checks now await one shared pending start. New grant/decline tests prove no call reaches the domain and no plan check finishes before that answer; duplicate starts share the same question. New assertions prove `request()` and `endedOnRequest()` remain empty after unforeseen classes, including the shared legacy/candidate/project gate path.
- A fresh serial final job is running the affected startup, legacy/project, saved-Flow, caller and repair tests, then final Core check/audit/build and the required Lab validation. Lead advised prioritizing this actual lifecycle boundary over a redundant composite persistence test.
- Follow-through on that root: a closed start-only gate also no longer turns an answered decline back into `latest` when validating a Flow step, and `planStep` no longer aborts the loop for start-only refusals. The invalid plan remains refused and the model receives feedback to find another route; callers that never entered the startup lifecycle retain their prior behavior. Added actual legacy-service regressions for unforeseen exploration and submitted-plan classes followed by a safe alternative.
- Stopped the earlier final test chain before completion to finish this additional root fix; its partial output is not counted as acceptance. The narrow startup/service proof is queued; no executable edits are planned while it runs.
- Startup/root-boundary proof passed: **5 files / 43 tests**, exit 0. Includes startup grant/decline, concurrent awaiting, missing-id refusal, shared project gates, actual legacy-service exploration/invalid-plan continuation, and no newly outstanding request or loop abort after startup.
- Remaining validation is serial in one heavy gate. It omits those five unchanged passing files, checks the remaining affected bootstrap/project/replay/repair files, then runs Core package check/audit/build and the required Lab builds/check/tests/catalog/audit.
- Remaining affected Core tests passed: **10 files / 127 tests**, exit 0. Together with the startup proof, **15 files / 170 tests** passed on current executable source.
- Final typecheck then found only a typing omission in the new concurrency fixture (required `permittedConsequences`/`instructionIds` were absent). Added the empty arrays. The old wrapper stopped at the failed check; no later stage was counted as run.
- The replacement ignored runner `.fluxiq/tmp/t976-stage-validation.mjs` rechecks only that fixture, then runs package check/audit/build and Lab stages, each through its own heavy-slot acquisition so the oldest pending lane can enter between stages. No memory thresholds or priority overrides changed. No further executable edits are planned.
- Rechecked concurrency fixture: **11/11 passed**. Final Core package typecheck: **exit 0**, cache stamp stored. The Core audit then caught one packed two-statement callback in that new fixture. Split the statements onto separate lines; this is formatting only. Resumed from the audit stage without rerunning unaffected runtime/type checks.
- Final Core audit after the formatting fix: **`structure-audit: passed (563 warning(s), 909 baselined).`**, exit 0. Core package build is now running; Lab dependency/check/test/catalog/audit stages have not yet run. service.ts and interpreter edits are handed off/frozen for P4's independent follow-up.
- `pnpm --filter fluxiq build` passed (19,819 generated files, exit 0). The Lab dependency build then stopped before compilation at the Core freshness guard: `ui-components:build` was stale against the changed Core dist. Added the guard's five-library Core preparation command with workspace concurrency 1; unchanged libraries reuse cache. Resuming from this dependency preparation, without bypassing the guard or rerunning source tests.

## Outcome

Done. All required scoped checks passed; no git mutations performed. P2 read-only discovery/proposal is separately recorded in t984 and has no product source edits.
