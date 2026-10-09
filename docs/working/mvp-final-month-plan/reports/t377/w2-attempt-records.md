# t377 W2: attempt records keep each value once

Worker: W2 (Core attempt records). Tree: `fxwork/t377/!FluxIQ`, branch `task/t377-workspace-read-scaling`. Nothing committed.

## Outcome

Done. A saved (persisted) trace now keeps each run value once. Every attempt after the
first holds in `inputs` only what changed since the attempt before it, plus an
`inputsSince` record naming that attempt, the earlier attempt and output key that hold
each changed value, and the keys that were dropped. A reader gets an attempt's whole
inputs back with `automationStudioAttemptInputs(attempts, index)`. The executed trace,
which live-patch reruns and Call Flow parents read, still keeps whole `inputs`.

Measured with a synthetic 46 KB page snapshot per step:

| Steps | Attempt inputs before | Attempt inputs after | Whole saved trace before | Whole saved trace after |
| --- | --- | --- | --- | --- |
| 19 | 5.82 MB | 661 bytes | 7.64 MB | 1.83 MB |
| 40 | 25.3 MB | 1.4 KB | 29.1 MB | 3.82 MB |

What is left after the change is linear: each page once in its own attempt's `outputs`,
and once in the run's `values`. `JSON.parse` of the 40-step trace dropped from 150 ms
to 16 ms.

## What changed and why

**Cause.** The cause was not `attempt.ts:120` itself. `collectNodeInputs`
(`executor/node-inputs.ts`) gives each attempt the whole run `values` map, and
`graph-run.ts` writes every attempt's outputs into that map under two keys
(`<nodeId>.<key>` and the bare `<key>`). In memory this costs nothing, because the
copies share their objects. When the saved trace is serialized, though, every copy is
written out again, so the trace grows with the square of its steps. This is the
`attempts[].inputs` growth seen in lane A round 8.

**Where the fix sits.** The fix is applied once, where the saved trace is made
(`graph-run.ts`, `runGraphToTrace`), and it runs on the executed trace. It runs before
row markers (`records.apply`) and withholding, while object identity still proves that
an input is the same object as an earlier output. Every persistence sink (session,
candidate-trial session, summaries, run detail) gets the saved trace, so all of them
benefit.

Files (Core, `packages/fluxiq/src/programs/automation-studio/runtime/`):

- `executor/node-execution/shared-inputs.ts` (new): `automationStudioTraceWithSharedInputs(trace, runInputs)`.
  - **Exact by construction.** A changed value is named only when it is the very object
    an earlier attempt's `outputs` hold, or the same text of 128 characters or more. It
    is also checked that a reader walking back by attempt id finds that very attempt.
    Anything else stays in `inputs`.
  - A run input still at its own key stays in place, so positional withholding
    (`automationStudioWithholdRunInputs`) still applies to it.
  - Attempts saved earlier (the first part of a resumed run) are left as they were.
  - A trace with nothing to share comes back by identity.
- `executor/node-execution/attempt-inputs.ts` (new): `automationStudioAttemptInputs(attempts, index)`.
  - Walks the `inputsSince` chain back without recursion.
  - It leaves out a value whose source attempt is missing from the list, rather than
    guessing it.
  - An attempt without `inputsSince` comes back as is. That covers executed traces and
    traces saved before this change.
- `executor/node-execution/index.ts`: exports both. `executor/index.ts` exports
  `automationStudioAttemptInputs`. This changes the public surface, so I regenerated
  `docs/reference/framework-reference.md` and `packages/fluxiq/docs/reference/framework-reference.md`
  with `node scripts/docs-reference.mjs`.
- `executor/contracts.ts`: added the `inputsSince?` field to
  `AutomationStudioNodeAttemptTrace` and documented `inputs`. The keys inside it
  (`attemptId`, `shared[].input/attemptId/output`, `removed`) are not among
  trace-withholding's data or prose keys, so withholding never rewrites them.
- `executor/graph-run.ts`: added one import and wrapped `defended` in
  `automationStudioTraceWithSharedInputs`. The comment above it now says the sharing
  runs first. The file was at exactly 800 lines on HEAD (the hard limit), so I shortened
  that comment by one line to stay at 800.
- `result-verification/run-outcome.ts` (reader): the failed attempt handed to the
  step-failure repair (`lastFailedAttempt`) is now read back with its whole inputs and
  without `inputsSince`. It used to be the raw saved attempt.
- `docs/architecture/automation-studio.md`: added a paragraph on how the saved trace
  keeps each value once.

**Readers audited.** I grepped Core, apps/web, and downstream domain, test-runner,
extension and Lab for every read of attempt `inputs`:

- `host-state.ts:29` reads the executed attempt, which is whole.
- `trace-withholding.ts:258` sees residual `inputs`. A run input stays in place for it.
- `live-patch.ts:280` uses the failed attempt from the executed trace
  (`automationStudioUnresolvedFailedAttempt(executed.attempts)` in `service.ts`).
- `recovery/context.ts:386` (`inputs.resultRepair`) reads a synthetic attempt from
  `refuted-result/attempt.ts`, which this change does not touch.
- `run-outcome.ts` is now expanded (above).
- The candidate-trial feedback, the LLM step-log files (`llm/step-log/`) and the action
  attempt records in `summaries/conversions.ts` do not read attempt inputs. So the
  per-step run files are unchanged.
- Downstream (domain, test-runner, extension, `scripts/lab`) has no reader of attempt
  `inputs`.

**Tests whose assertions read saved-trace inputs directly** now read them through
`automationStudioAttemptInputs`. In each case the expected values are unchanged:

- `executor/tests/graph-run.test.ts`: 4 assertions.
- `flow-bootstrap/authoring/tests/repeat-loop.test.ts`: 1.
- `tests/composite-executor.test.ts`: 1.
- `tests/service-flows/tests/representation.test.ts`: 1. This one reads the session
  back from storage through the service.

**New tests** in `executor/node-execution/tests/`:

- `shared-inputs.test.ts` (8 tests):
  - a 20-step graph run where every page contains a withheld run input. It checks that
    the saved attempt inputs are smaller than one page and the whole saved trace is
    under 3 × 20 pages, and that every saved attempt reads back exactly as the executed
    one with values withheld;
  - a JSON write and read round trip;
  - an equal-but-not-identical value is copied, not shared;
  - dropped keys are named;
  - a run input stays at its own key;
  - repeated attempt ids;
  - a resumed (already-saved) prefix;
  - a trace with nothing to share comes back by identity.
- `attempt-inputs.test.ts` (4 tests).

## Commands run and observed results

All run from `fxwork/t377/!FluxIQ/packages/fluxiq` unless noted.

- **Fail-first.** I temporarily removed the wrapper in `graph-run.ts`, ran
  `npx vitest run src/programs/automation-studio/runtime/executor/node-execution/tests/shared-inputs.test.ts`
  and got `expected 6439267 to be less than 46241`, with 1 failed and 7 passed. Then I
  restored the file (`grep -c` showed 1 call, 800 lines).
- `npx vitest run src/programs/automation-studio/runtime/executor/node-execution/tests`
  gave 2 files and 12 tests passed.
- `npx vitest run src/programs/automation-studio/runtime/executor src/programs/automation-studio/runtime/result-verification src/programs/automation-studio/runtime/flow-bootstrap/authoring/tests`
  gave 98 files and 1073 tests passed.
- `npx vitest run` over `runtime/recovery`, `runtime/flow-change`, `runtime/live-patch`,
  `runtime/tests`, `runtime/service/candidate-trial`, `runtime/service/runtime-adaptation`
  and `runtime/service/summaries`:
  - The first run had 3 failures, all tests that asserted saved-trace inputs directly
    (composite-executor and the 2 representation cases). The live-patch reruns
    themselves still succeeded.
  - After updating those assertions: `composite-executor.test.ts` and
    `representation.test.ts` gave 2 files and 16 tests passed.
  - The rest of that set was 181 files passed in the first run.
- `npx vitest run` over 5 more test files that touch attempts or traces and `.inputs`
  (`framework/tests/index.test.ts`, `detached-execution.test.ts`, `flow-draft/tests/entry.test.ts`,
  `replay-parity.test.ts`, `runtime-stream-store.test.ts`) gave 5 files and 99 tests
  passed.
- `npx tsc --noEmit -p .` (fluxiq package) exited 0 in 32 s. This included W1's
  in-progress files at that moment.
- `node scripts/structure-audit.mjs` (repo root) printed
  `structure-audit: passed (291 warning(s), 710 baselined)`. That includes the
  `import-cycles` and `file-lines` rules, with `graph-run.ts` at 800 lines.
- `node scripts/docs-reference.mjs --check` failed at first with
  `framework-reference.md is stale` (my new export). After `node scripts/docs-reference.mjs`
  it printed `Deterministic framework reference is current.`
- **Measurement.** A temporary test, deleted afterwards, produced the table above:
  `W2MEASURE steps=19 page=46241 before=7643184 after=1825942 attemptInputsBefore=5821152 attemptInputsAfter=661 parseBeforeMs=36 parseAfterMs=7`
  and `steps=40 ... before=29143299 after=3821971 attemptInputsBefore=25329837 attemptInputsAfter=1396 parseBeforeMs=150 parseAfterMs=16`.

## Not verified

- No full suite (`pnpm test`, `pnpm check`) was run, per the narrow-gate rule.
- I did not measure a real trial session from lane A's workspace. The numbers come from
  a synthetic page of the reported shape. W1 measures listings on a workspace copy.
- No live or Lab run, and no downstream typecheck. The downstream code only constructs
  attempt objects, and the new field is optional.
- Sessions saved before this change still hold quadratic `inputs`. They read back
  unchanged, but nothing rewrites them. `t342-a`'s existing 193 MB stays until those
  rows are pruned.

## Open questions or contradictions found

- The brief points at `attempt.ts:120`. That line builds a native node's inputs. The
  copy that grows is `collectNodeInputs` (all run values) recorded as `inputs` on every
  attempt. I kept the executed attempt whole on purpose: the host capture, live-patch
  seeds and Call Flow parents read it. I shared values only in the saved trace, which is
  what gets persisted.
- The saved trace's `values` still holds each step's outputs once (under the node key,
  plus the latest under the bare key). That is linear, so I left it.
- The Core web panel (`apps/web/.../RunDetailPanels.tsx`) shows `attempt.inputs` raw
  when a run detail falls back to `trace.attempts`. Normally it shows `actionAttempts`,
  which carry no inputs. On the fallback it would show only what changed.
  `apps/web` was outside my brief, so I did not change it.

## Follow-up: clients never see the shared form

Outcome: Done. The coordinator asked for this after the first report.

**What changed.**

- **New helper.** `runtime/executor/node-execution/whole-inputs.ts` adds
  `automationStudioWithWholeAttemptInputs(answer)`. It walks an API answer once,
  following each object only the first time it meets it. Every list named `attempts`
  that holds attempt records gets each attempt's whole `inputs` back, with
  `inputsSince` removed. Call Flow `childTrace` and a repair's `completedTrace` are
  covered too. An attempt's whole inputs are not walked again, so serving a trace does
  not cost the square of its steps. An answer with no saved trace in it comes back by
  identity. The helper is exported from the executor barrel, reachable through
  `runtime/index.ts`. The framework reference was regenerated (3371 declarations).
- **Handlers.** These endpoints now answer through the helper:
  - `api/handlers/runtime-sessions.ts`: `get-runtime-session` and the full
    `list-runtime-sessions` (summaries carry no trace).
  - `api/handlers/runtime-execution.ts`: `start-`, `cancel-` and `run-runtime-session`.
  - `api/handlers/runs.ts`: `get-flow-run-detail` (a repair's `completedTrace`) and
    `export-flow-run-audit`.

  These are the only Automation Studio endpoints whose answers can carry a trace.
  `run-control` answers carry only progress, and action records carry no inputs.
- **Web panel.** `RunDetailPanels.tsx` needs no change. Its attempts come from
  `get-flow-run-detail`, `get-flow-run-action-detail` (action records, no inputs) or a
  runtime session, and all of those are now read whole before they are served.
- **Docs.** `docs/architecture/automation-studio.md` now lists these endpoints.
- **New tests.**
  - `api/handlers/tests/saved-trace-answers.test.ts` (5 tests). A real 3-step saved
    trace is written to JSON and read back, then served through
    `GlobalProgramApiRegistry` by get, list, run, cancel and run-detail (with
    `completedTrace`). In each answer, every attempt has no `inputsSince` and holds
    exactly the inputs the run executed with; attempt 3 holds `one.page`.
  - `node-execution/tests/whole-inputs.test.ts` (2 tests).

**Commands run and what they printed.**

- **Fail-first.** I removed the wrapper from `get-runtime-session` and ran
  `saved-trace-answers.test.ts`: 1 failed, 4 passed. Then I restored it.
- `npx vitest run` over `api/handlers/tests` and `node-execution/tests`: 25 files,
  150/150 passed. After the cast fix, `saved-trace-answers` plus `node-execution/tests`:
  19/19 passed.
- `npx vitest run` over executor, result-verification, flow-bootstrap/authoring tests,
  `composite-executor.test.ts` and `representation.test.ts`: 101 files, 1091/1091 passed.
- `npx tsc --noEmit -p .` (fluxiq) exited 0.
- `pnpm --filter @fluxiq/contracts --filter fluxiq build` exited 0 (fluxiq rebuilt, 84.6 s). The
  web tests refuse to run against a stale Core dist, so the rebuild was needed first.
- `apps/web`: `npx tsc --noEmit` exited 0. `npx vitest run src/features/automation-studio/runtime`:
  13 files, 134/134 passed.
- `node scripts/structure-audit.mjs` first failed on `as-never` in my new test. I
  replaced the cast with `as unknown as AutomationStudioService`, and the audit then
  printed `passed (291 warning(s), 710 baselined)`.
- `node scripts/docs-reference.mjs --check`: current.

**Not verified.**

- No browser check of the web panel's Data view.
- No full suites.
- The Core dist was rebuilt while W1 was still editing the same tree, so it includes
  whatever W1's files held at that moment.
