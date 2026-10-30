# t804 W2: the from-step-first repair gate

## Outcome

Partial. The gate, the words, the cross-brief carry and their tests are written, and the tests, the structure audit and model-text pass. `npx tsc --noEmit -p .` never ran: in over 75 minutes this worker never got `heavy-check.lock`. A full `pnpm -r test` sweep and about a dozen other waiters held it in turn. vitest strips types and does not check them, so the new code is not typechecked.

## What changed and why

All under `R = !FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime`.

### New files in `flow-bootstrap/subflow-candidate/`

- **`pending-repair.ts`**: the class `AutomationStudioSubflowPendingRepair`. It is exported from the barrel.
  - **When a repair is set.** A whole test sets one when its entry was prepared and it answered either `no` or `execution_failed` (but not Core's own trial runner failing).
  - **Which step it names.** For a stop it is `stoppedAtKey`. If that step is gone from the latest proposal, or the verdict was `no`, it is the first step, in plan order, whose node changed since the tested revision (nodes compared as canonical JSON). With no such step, no step is named.
  - **What clears it.** A from-step run of the latest proposal that starts at or before the step and has the step in `passedKeys`. With no step named, any run that ends clears it. A `no` repair is never cleared by the judged revision itself.
  - **Whole tests allowed while a repair stands.** When the named step is the part's first step. When `fromStepImpossible` carries a non-empty reason; empty or whitespace reasons are refused as `subflow.trial_input_invalid`.
  - **Answers that leave it alone.** A whole test answering yes, unsure or not_judged clears it. An unprepared entry or a runner failure leaves it as it was.
- **`from-step-run.ts`**: the `from` branch.
  - It calls only `port.fromStep`: no admission, start hook, reset, offline check or judge.
  - It checks that `from` is a step of the latest proposal. If not, it refuses with `subflow.from_step_unknown` and lists the keys.
  - It reads the port's answer as strictly as a trial answer. Identity, revision, digest, fromKey or status that don't match, or a thrown error (reported by kind only), become `subflow.from_step_*` refusals.
  - It records acts with `reset.trialRan`, except on an offline port.
  - It answers `{ok:true, fromStep:true, passed, from, stoppedAt?, passedKeys, steps, repairChecked?, repairStep?, instruction, leftOnSite?, trialRunId?}`. The answer has no `partial`, so it is never a trial, never kept, and never accepted by completion.
- **`repair-words.ts`**: all the model-facing words, in generic terms.
- **`test-input.ts`**:
  - the tool's input schema; `from` and `fromStepImpossible` are offered only when the port has `fromStep`;
  - the input read; `from` sent without a `fromStep` port is refused as `subflow.from_step_unavailable`.
- **`contradicted-no.ts`**: `notTaken` and `earlierBriefSaid`, moved out of the gate unchanged so the gate stays inside its 800-line budget. It is now 798 lines.

### Edited files in `flow-bootstrap/subflow-candidate/`

- **`subflow-trial-gate.ts`**:
  - It uses `test-input`.
  - A call with `from` goes to `from-step-run` straight after the stale-revision check.
  - After the closed, same-failure and retest-limit checks, a whole test is refused as `subflow.trial_from_step_first` while a repair stands. The refusal carries `repairStep` and the exact `{revision, digest, from}` call.
  - After a live whole test, `afterWholeTest` runs, and its repair words are appended to the instruction for `no` and `execution_failed`.
  - `completion()` gives the same refusal, after its yes, closed and repeated checks and before `trial_required`.
  - The tool description gains the repair sentence only when the port has `fromStep`. That keeps every existing pin unchanged.
  - The gate takes an optional `pendingRepair` input and a new header paragraph.
- **`subflow-trial-result.ts`**: now carries the port's `stoppedAtKey` through.
- **`builder-loop.ts`**:
  - It builds the repair memory (`input.pendingRepair` or a new one) and gives it to the gate.
  - When the port has `fromStep`, the submit tool description gets one extra sentence.
  - While a repair stands, `next` gives the exact from-step call; otherwise it adds when to test the whole part.
  - New header paragraph.
- **`index.ts`**: exports `pending-repair.ts`.

### Dispatch

- **`project-agents/dispatch/run-brief.ts`**: a `REPAIRS` WeakMap keyed by dispatcher, then by `planDigest` plus `subflowKey`, and `repairOfSubflow()`. Its value is passed to the builder as `pendingRepair`. Header updated.

### Tests

- `subflow-candidate/tests/from-step/tests/from-step-repair.test.ts` (11 tests) covers:
  - a from-step run: only the port's `fromStep` runs, its acts are recorded, it is not a trial, and completion still says `trial_required`;
  - an unknown step and a mismatched port answer are refused;
  - the rule does not apply without `fromStep`;
  - the tool description stays within 2000 characters;
  - a whole test is refused and completion mirrors it, then the repair clears: a run started after the step does not clear it, a run that stops before the step does not clear it, a run that passes it does;
  - a `no` repair names the first changed step, and the judged revision itself checks nothing;
  - with no step named, a run that ends clears it;
  - the `fromStepImpossible` exception, an empty reason, and the first-step exception;
  - unsure, not_judged, an unprepared entry and a runner failure stay ungated;
  - the repair carries across briefs through a shared memory;
  - only a judged whole run of the latest revision finishes the brief.
- `subflow-candidate/tests/from-step/tests/from-step-loop.test.ts` (2 tests): the builder loop runs submit, failed test, from-step run, whole yes, complete, and the `next` words are checked both while a repair stands and when none does.
- `dispatch/tests/pending-repair/tests/pending-repair-memory.test.ts` (2 tests): one memory per subflow across dispatches, another for another subflow, and a new one per build.
- All three are in nested folders because `tests/` in both directories was over the 25-file limit.
- No pin tests changed.

## Commands run and observed results

- From `packages/fluxiq`:
  - `FLUXIQ_TEST_GROUP=parallel npx vitest run R/flow-bootstrap/subflow-candidate/ R/project-agents/dispatch/ R/llm/tests/loop-budget.test.ts R/activity/tests/person-facing-sweep.test.ts` -> `Test Files 56 passed (56)`, `Tests 350 passed (350)`. This ran before the tests moved into nested folders.
  - After the move: `FLUXIQ_TEST_GROUP=parallel npx vitest run .../tests/from-step/ .../dispatch/tests/pending-repair/` -> `Test Files 3 passed (3)`, `Tests 15 passed (15)`.
  - Same paths with `FLUXIQ_TEST_GROUP=real-sql` -> `No test files found, exiting with code 1`. The real-sql group's include list contains none of these files.
- `npx tsc --noEmit -p .` under the lock -> not run. This worker never got the lock in over 75 minutes. I stopped the waiting loop before it took the lock, so I never held it and left nothing behind.
- `node scripts/structure-audit.mjs` (Core root) -> `structure-audit: passed (455 warning(s), 1152 baselined).` The first run failed three ways, all fixed before this one: two `as never` casts in my tests, and `tests/` over 25 files in both directories.
- `node scripts/check/model-text.mjs` (downstream) -> `model-text: ok (208 scenario tokens, 378 model-facing Core files, 11888 string literals)`.

## Not verified

- **Types.** `tsc` did not run. Two spots are the likeliest to fail:
  - in `from-step-run.ts`, the cast `raw as Partial<AutomationStudioSubflowFromStepResult>` from `object`;
  - in the gate, `cannotUndo` is now `JsonValue | undefined` from `test-input`.
- **The whole path.** Through `WholeTestPort` and the dispatch trial-port wrapper, the rule applies only once W1 forwards `fromStep` and `stoppedAtKey` there. My tests use fakes.
- **Real runs.** Not checked against a real from-step port, live, or in the Lab.
- **Binding closure.** The trace's `subflow.from_step_unbound` (a run that starts after the step producing a value it reads) is not in this gate. The brief did not ask for it. If W1's port refuses such a run, it reaches the builder as a `not_run` refusal.

## Open questions or contradictions found

- **Offline and recorded answers.** A failure taken from the recording (offline-first, or a recorded run) does set a repair, because the failure was demonstrated. A port whose `environmentKind` is not live never sets one. Please confirm this is wanted.
- **Repair memory key.** It is keyed by `planDigest` plus `subflowKey`. After a plan amendment, the repair from the old plan does not carry over.
- **Repeat guard.** A from-step refusal or an unchanged from-step run carries no `retry_allowed`. The loop's repeat guard therefore treats sending it again unchanged on the same page as a failed repeat. That seems right, but it is a choice.
- **Stable interface.** It did not need to change.
