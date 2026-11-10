# Deterministic attempts by default (t889)

## Outcome

Partial. The code, contract, tests and docs are done and verified. The provider-free proof run did not finish: attempt 1 passed, then Chrome crashed in attempt 2 (see below), and free memory fell to 0.57 GB, so I did not retry.

## What changed and why

- `packages/test-runner/src/commands.ts`: `lab attempt --attempts N` takes any whole number 1..999 (a non-integer, 0 or a leading zero is refused). The default is `DEFAULT_ATTEMPTS = 4` for scripted and live models. `--restart-between` needs N >= 2 and restarts Core before every later attempt. Usage text and doc comment updated.
- `attempt-lane/run-attempt-series.ts`, `report.ts`: `attemptSeries(task, rows, continuations, asked, flowIds)` keeps every continuation (`series.continuations`) and builds `deterministic` through `deterministicSummary`. `renderAttemptSeries` prints one line per later attempt (path, Flow, continuation held or refused with reasons, model calls, time), a summary line, and one `NOT DETERMINISTIC: ...` line from `laterAttemptNotes`. The line names any later attempt that spent calls, took a path other than `run_flow`, or was not proven to continue the one before, and any later attempt asked for that did not run.
- `attempt-lane/live/run-attempt-command.ts`: all `series.continuations` are used. It passes only if every attempt is right, none waits for a person and every continuation held. With `--attempts 1` the status is `diagnosis_only` (never `passed`); exit 0 if right, 1 otherwise. `attempt.json` carries `continuations` and `deterministic`. The stdout JSON line carries per-attempt path, flowId, continuation, calls and ms, plus `continuations`, `deterministic` and `deterministicNotes`. `live/result-line.ts` now names "attempt N-1" instead of "the first".
- Contract (`test-contracts/src/attempt-score/`): `ATTEMPT_REPORT_SCHEMA_VERSION` is `0.2`. `secondStartedFromFirst` is replaced by `continuations: AttemptContinuation[]` and `deterministic: AttemptDeterministicSummary | null` (asked, ran, per-attempt path/flowId/continuationHeld/calls/ms, zeroCallAttempts, allHeld). Validation is strict: one ordered proof per later attempt, `held` iff nothing refused, the summary must match the rows and continuations, `allHeld` cannot be claimed while an asked attempt did not run, and `null` is valid only for a one-row series.
- Status readers in `scripts/lab`: `live-guards/rules/unchanged.mjs` (a `diagnosis_only` run no longer blocks a rerun on unchanged source) and `live-guards/run-outcomes.mjs` (a `diagnosis_only` run is not a facility failure). Test added in `live-guards/tests/rules.test.mjs`.
- Tests updated or added: `lab-attempt-command.test.ts` (default 4, N values, restart rule), `attempt-series.test.ts` (4-attempt series, call-spending and straying attempts named, one-attempt series), `attempt-score.test.mjs` (new contract), `result-line.test.ts` (version).
- Docs: `testing-facility.md` (the `--attempts N` section, default, per-attempt continuation, deterministic summary, diagnosis-only, the t888 speed section) and `extension-client.md` (new "Page readiness and the kept look": navigation-event readiness, page-change counter, kept look, page-changes message).

## Commands run and observed results

- test-runner `npx tsc -p tsconfig.json --noEmit` -> no output, exit 0. This needed `domain` and `test-evidence` built first, because the worktree started with `--skip-workspace-build`.
- test-runner `node ../../scripts/build-cache/cli.mjs test-runner:build` -> `"build-cache":"build" ... "source":"command"`.
- `node --test $(find dist/attempt-lane -path "*tests/*.test.js")` -> tests 123, pass 123, fail 0. The command and series tests alone (without the `scripted-model/scripts` tests): 78 pass, 0 fail.
- test-contracts: `pnpm run build` is refused by the Core guard (Core's `@fluxiq/sdk` dist was missing). I built `@fluxiq/sdk` in the Core worktree (generated output only) and ran the cache step directly: `node ../../scripts/build-cache/cli.mjs test-contracts:build -- "tsc -p tsconfig.json"` -> built. `node --test src/tests/attempt-score.test.mjs` -> pass 7, fail 0.
- `node scripts/lab/live-guards/tests/rules.test.mjs` via `node --test` -> pass 7, fail 0.
- `node scripts/structure-audit.mjs` (repo root) -> "structure-audit: passed (244 warning(s), 552 baselined)".
- Free memory before the proof: 3.75 GB (above the 3 GB bar).
- Provider-free proof, `FLUXIQ_LAB_ALLOW_STALE_CORE=1 FLUXIQ_LAB_INSTANCE=t889 FLUXIQ_TEST_ENV_FILES=none pnpm lab attempt local-classifieds --task local-classifieds-save-dining-tables --authoring-mode answer-first --scripted-model` (default 4). The stale-Core override was needed because building `@fluxiq/sdk` changed Core's inputs.
  - Attempt 1: ended `achieved`, scored right.
  - Attempt 2: typed the instruction, then "it ended: waiting_for_person for model_key_locked", then "page.evaluate: Target crashed". My 590 s `timeout` wrapper expired (exit 124) around the same time. The run left evidence in `test-runs/instances/t889/attempts/run-mwaa58vj-4429fd25` as unscored. Free memory afterwards was 0.57 GB, so I believe Chrome crashed under memory pressure. I did not confirm that, and I did not rerun.
  - The new report path, `deterministic` summary and `NOT DETERMINISTIC` line were therefore not exercised live. Only the unit tests cover them.

## Not verified

- The live (scripted-model) run of four attempts: the second attempt crashed, and the third and fourth never started.
- Whether the scripts have answers for attempts 3 and 4. This is the open finding, and it matters: the script for this task ends after attempt 2 (t888 saw attempt 2 make 1 call after 21), so attempts 3 and 4 may need a script request the file lacks. I did not edit the scripts.
- Whether the `model_key_locked` wait is only the crash or a real second-attempt problem: t888's two-attempt run of this same task did not show it.
- `--restart-between` with N > 2, and `diagnosis_only` end to end.
- A repo-wide `pnpm check` (only narrow checks were run, as the repository rules ask).

## Open questions or contradictions found

- A full-suite caller or a script that reads the final stdout JSON as `passed` for a one-attempt run will now see `diagnosis_only`. I found no such reader in `scripts/lab` other than the two I changed.
- `pnpm lab` refuses a Core whose `sdk` dist is missing. In a fresh `pnpm task start --skip-workspace-build` worktree this needs a manual `@fluxiq/sdk` build, then `FLUXIQ_LAB_ALLOW_STALE_CORE=1`.

## Follow-up: calls by kind, a stopped series, and the wording (after e92dc6262)

- **1. Calls include the interpretation, shown by kind.** `AttemptReportRow` gains `callKinds {interpretation, judge, decisions}`, and `calls` is their sum (validation holds it; schema version `0.3`). Source, for scripted and live runs alike: the run's step log. `attemptSpeed` now counts the model-backed `chat` steps (interpretation) and `judge` steps in the slice logged between one attempt's end and the next's, the same slice the speed section reads; the run wrapper attaches them to the outcome as `modelCalls`. Core's `spend.calls` already holds the judge (attempt 1: 20 `decide` steps + 1 judge = 21), so decisions = Core's count minus the judge, and the interpretation is added once: nothing is counted twice. Shown in the row table, the result line, `deterministic.attempts[].callKinds` and `laterAttemptNotes`. Limit: this assumes attempts run one after another, which they do here. When the log cannot attribute, `callKinds` is absent and the line says `(not split by kind)`; I did not guess. The live source is the same step log, so a live run is attributed the same way, but I did not run a live (paid) one.
- **2. A stopped series keeps what ended.** `partial-series.ts` builds the series of the scored attempts (`series-of-outcomes.ts`, shared with `runAttemptSeries`); `writeUnscoredAttemptEvidence` writes it into `attempt.json` (`series`, `continuations`, `deterministic`) and the full per-attempt lines and summary into `attempt-report.txt`.
- **3. Wording.** A refused request on an attempt the run typed and followed now reads "Attempt 4 of 4 started (the chat read the instruction in 1 model call(s); the run logged N steps for it), then was refused at request 4 of kind loop_verification, and did not end: ...". I first reported browser steps, but a replay's own steps are not in the step log (it showed 0), so I report logged steps and the interpretation call instead. The note prefix is `NOT DETERMINISTIC` only when a later attempt made decisions, strayed, was not proven, or did not run; later attempts with only interpretation and judge calls get their own wording. When a series stopped short with every ran continuation held, the summary says "all held for the ones that ran".

### Commands run and observed results
- test-runner `npx tsc -p tsconfig.json --noEmit` -> no output.
- `node ../../scripts/build-cache/cli.mjs test-runner:build` -> built; `node --test` on dist/attempt-lane/**/tests/*.test.js and lab-attempt-command.test.js -> tests 127, pass 127, fail 0.
- test-contracts cache build, `node --test src/tests/attempt-score.test.mjs` -> pass 8, fail 0.
- `node scripts/structure-audit.mjs` -> "structure-audit: passed (244 warning(s), 552 baselined)". (It flagged my first version, a swallowed failure and a packed line; both were refactored.)
- Proof rerun (free memory 3.63 GB before), run-mwad80ty-a5ca95cd: attempts 1-3 right; rows read `22 (interpretation 1, judge 1, decisions 20)`, `2 (interpretation 1, judge 1, decisions 0)`, `2 (...)`; per-attempt lines show continuation held and the Flow id; attempt 4 refused at request 4 of kind loop_verification; `attempt-report.txt` and `attempt.json` carried attempts 1-3 and the deterministic summary. Exit 1, status `not_judged`, as expected.

### Not verified
- That last proof ran with the first version of the stopped-attempt wording ("ran 0 browser steps") and printed the `NOT DETERMINISTIC` line twice. Both were fixed afterwards (wording above; the writer no longer repeats the notes) and covered by a unit test, but I did not rerun the proof (free memory then 1.2 GB).
- A live (paid) run's call attribution.
