# Shared execution reference clock

Outcome: Done — implementation is frozen and all final named regressions passed.

## Changes

All source paths below are relative to `C:/Users/osrs_/FluxStuff/fxwork/t823/!FluxIQ`.

- `packages/fluxiq/src/programs/automation-studio/runtime/executor/`: uses/reexports shared `automationStudioReferenceNow` (now owned by `runtime/reference-now/`), captures a graph's start once, propagates the fixed reference to builtin/native/effect/child execution, and carries a distinct explicit reference through saved traces and resume seeds. All five new graph/reference cases and the hydrated resume case now live in existing `tests/resume.test.ts`.
- `runtime/native-node-runtime.ts`, `runtime/service/runtime-session/graph-options.ts`, and owning native/graph-options tests: the canonical native adapter carries validated host metadata. Native cooperative timeouts stay live; old direct calls without host metadata stay unchanged.
- `runtime/io-policy.ts` and `runtime/tests/io-policy.test.ts`: hand the validated reference through generic runtime dispatch; command timestamps retain their live clock.
- `runtime/service.ts`: only the authorized normal session graph-options field, `referenceNow: session.startedAt ?? startedAt`.
- `runtime/service/candidate-trial/run.ts`, `runtime/service/subflow-trial/run.ts`, `runtime/service/subflow-trial/from-step.ts`, and owning tests: pass the exact persisted trial start into detached options; whole/subflow summary callers also receive that reference. A new partial trial captures its own session start. Continuation within one execution keeps its prior reference.
- `runtime/flow-bootstrap/verification/detached-execution.ts`, `detached-subflow.ts`, `detached-subflow-from.ts`, and owning tests: capture before awaited routing and preserve one reference across predecessor/target roots and nested children.
- `nodes/control-flow/for-each.ts` and its owning test: relative date ordering uses `context.referenceNow`, with existing live-clock fallback for direct callers without metadata. Start and Wait remain on live `now()`.
- `runtime/service/runtime-adaptation/repair-rerun.ts`, `tests/repair-rerun.test.ts`, and `tests/repair-rerun-harness.ts`: legacy options lacking the new field inherit the retained trace/options/session reference. A reused execution keeps its existing start and dataset reference.

The lead owns additive contract fields in executor/contracts.ts, nodes/contracts.ts, nodes/importer-sdk.ts and runtime/contracts.ts. This worker did not edit those files, package versions, git or shared working documents.

## Validation

- Initial `pnpm --filter fluxiq exec vitest run ... --maxWorkers=2 --minWorkers=1` did not start: PowerShell refused `pnpm.ps1` under local script execution policy. Retried with `pnpm.cmd`.
- `pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/executor/tests/reference-now.test.ts src/programs/automation-studio/runtime/executor/tests/resume.test.ts src/programs/automation-studio/runtime/tests/native-node-runtime.test.ts src/programs/automation-studio/runtime/tests/io-policy.test.ts src/programs/automation-studio/runtime/service/runtime-session/tests/graph-options.test.ts src/programs/automation-studio/runtime/service/candidate-trial/tests/reference-now.test.ts src/programs/automation-studio/runtime/service/subflow-trial/tests/reference-now.test.ts src/programs/automation-studio/runtime/flow-bootstrap/verification/tests/reference-now.test.ts src/programs/automation-studio/nodes/control-flow/tests/for-each.test.ts --maxWorkers=2 --minWorkers=1` → `Test Files 1 failed | 8 passed (9); Tests 1 failed | 95 passed (96)`. Existing row-date reader treats plain `today` as the reference instant; the new test's noon comparison therefore did not distinguish midnight. Corrected only the fixture to `today 09:00`; original assertions were retained.
- `pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/nodes/control-flow/tests/for-each.test.ts src/programs/automation-studio/runtime/service/runtime-adaptation/tests/repair-rerun.test.ts src/programs/automation-studio/runtime/flow-bootstrap/verification/tests/detached-subflow.test.ts src/programs/automation-studio/runtime/flow-bootstrap/verification/tests/detached-subflow-from.test.ts src/programs/automation-studio/runtime/service/subflow-trial/tests/from-step.test.ts --maxWorkers=2 --minWorkers=1` → exit 0, `Test Files 5 passed (5); Tests 76 passed (76)`, 48.29 s. This corrects the prior fixture failure and validates the final repair/from-step changes. Across the final owning results, 143 tests in 13 unique named files passed (67 unaffected passes from the first run, plus 76 in the final run).

No workspace build, typecheck, check, full suite, browser, panel, paid API call or git mutation was run by this worker.

Owning test directories changed: `runtime/executor/tests`, `runtime/tests`, `runtime/service/runtime-session/tests`, `runtime/service/candidate-trial/tests`, `runtime/service/subflow-trial/tests`, `runtime/service/runtime-adaptation/tests`, `runtime/flow-bootstrap/verification/tests`, and `nodes/control-flow/tests` (all below `packages/fluxiq/src/programs/automation-studio/`). Source and tests remain frozen for parent acceptance.

## Structural follow-up

The lead's audit found new directory-file limits, packed test statements and a cross-directory non-barrel test import. After the lead's GO, preserved all five executor cases/helper checks in existing `runtime/executor/tests/resume.test.ts`, and the one candidate-trial reference case in existing `runtime/service/candidate-trial/tests/run.test.ts`. Removed only this worker's two former `reference-now.test.ts` files in those directories. Both directories now contain 25 source files. The judging worker separately consolidated its candidate-trial file into `rejudge.test.ts`.

Formatted only this worker's added packed statements in `runtime/flow-bootstrap/verification/tests/reference-now.test.ts`, `runtime/service/subflow-trial/tests/reference-now.test.ts`, `runtime/tests/io-policy.test.ts`, `runtime/tests/native-node-runtime.test.ts`, and the moved cases. The native test now imports graph options through the existing `service/runtime-session/index.ts` barrel. No baseline, assertion, validator relocation, contract extraction or lead-owned node-execution expectation was changed.

- `node scripts/structure-audit.mjs --rule directory-files --rule imports --rule statement-packing` → exit 0, `structure-audit: passed (117 warning(s), 580 baselined)`.
- `pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/executor/tests/resume.test.ts src/programs/automation-studio/runtime/service/candidate-trial/tests/run.test.ts src/programs/automation-studio/runtime/flow-bootstrap/verification/tests/reference-now.test.ts src/programs/automation-studio/runtime/service/subflow-trial/tests/reference-now.test.ts src/programs/automation-studio/runtime/tests/io-policy.test.ts src/programs/automation-studio/runtime/tests/native-node-runtime.test.ts --maxWorkers=2 --minWorkers=1` → exit 0, `Test Files 6 passed (6); Tests 84 passed (84)`, 47.90 s.

Source/tests are frozen again. No build, typecheck, full suite or git mutation was run for this follow-up.

## Persistence and limits

- `writeAutomationStudioRuntimeSessionFiles` writes the whole session as JSON; `service/summaries/store.ts:96-99` reads `stored.session` without whitelisting trace fields. The resume regression serializes/deserializes its parked trace before continuing, with an explicit reference earlier than `startedAt` and a later, conflicting new options reference.
- Record capture validates/schema-copies rows and does not filter/sort them. The builtin For Each sorter was the in-graph record processor found sampling `context.now()` and is now anchored separately.
- Ordinary sessions, candidate/subflow trials and partial-trial sessions use the same persisted start as dataset processing. Custom graph-only hosts using an explicit reference distinct from a separately managed dataset run start must supply that same number to the store's existing `processRunDatasets(runId, { now })` override; graph execution itself has no dataset-store handle or authority to rewrite that host's persisted start.
- Whole suites remain outside this brief because both daily slots were already used. Parent acceptance owns affected-package types/build gates and the broader owning-directory checks after source freeze.

Not verified: live browser behavior, paid runs, whole-suite behavior, parent integration/typecheck, and custom-host dataset processing outside the canonical service boundaries.
