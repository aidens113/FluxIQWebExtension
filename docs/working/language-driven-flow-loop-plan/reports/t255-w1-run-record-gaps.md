# t255-w1: what a live run's files fail to say (run-murzln6g-11debe1d)

Branch `task/t255-lab-run-record-gaps` in both `fxwork/t255` trees. Nothing staged or committed.

## Outcome

Done. All three gaps are fixed and tested. Items 1 and 2 are proved against the run's own strings and files: item 1 by a test built from its full ending, item 2 by re-deriving its records offline from `steps/`. None of the work needed an edit to `phases.ts` or any of the reserved files.

## What changed and why

### 1. FluxIQ's ending cut at "...was not..." (Lab)

- Cause: `packages/test-runner/src/flow-lane/creation/chat/build-from-chat.ts` cut `said` at `SAID_MAX = 600` (597 characters plus `...`). The lane put that text into the `RunnerFailure` message, and from there it reached `events.ndjson`, `summary.json`, `report.html` and `flow-lane.json` `failure.message`. In the run, the cut was the only truncation on that path: the evidence bundle and the contract validator cap nothing.
- Fix: removed `SAID_MAX` and `bounded()`. `said` is now FluxIQ's turn text in full, and no new cap was added. Secret screening is unchanged: the evidence bundle runs `redactStructured`/`redactText` and `assertNoSensitiveText` on every event and structured write. (`bounded()` itself never screened anything.)
- Test: `chat/tests/build-from-chat.test.ts` gets a `failedSaid` option on the fake chat and a new test that uses the run's full ending, transcribed from `screenshots/00015-878c8d0dfd05.jpg` (more than 600 characters). It asserts that `said` equals the full ending, including "...was not judged to do what you asked. The Flow so far was kept...".

### 2. live-llm.json attribution (Lab)

- Cause: Core's build accounting holds the build judge's spend and the instruction read's spend with no call count (`phases.ts` `judgeAccounting`). The Lab took that figure whole as `phases.build`. The step log's 3 extra calls then became `unattributed` with the leftover cost of $0, because the cost was already inside build. `instructedConsequences` is null because Core publishes it only on a proposal, and this build left none.
- Fix, all from the step log, with no Core change:
  - `live-llm/step-log-spend.ts`: adds `byPart` (part → phase → calls/cost), taken from each meta's `part` and `phase`.
  - `live-llm/run-spend.ts`: new `phases.read`. The creation build's `judge` calls join `phases.judge` and its `read` calls become `phases.read`. Their cost leaves `phases.build` only when Core's build cost is closer to the log's whole creation build than to the creation build without them. Their calls leave only when Core's count equals the log's creation calls with them. This is decided from the numbers, not assumed. New `stepLog.fromBuild` records what was moved. `perBuild` keeps Core's whole build cost, because Core's purse held the build to its ceiling with the judge and read included.
  - New `live-llm/step-log-instructed.ts`, exported from the barrel: reads `instructed` from the last complete creation/`read` model step's `decision.json`, taking only the consequence and quote strings. `live-llm-run.ts` `settleBuild` fills `build.instructedConsequences` from it only when Core's record is null. The snapshot gets `instructedConsequencesFrom: "proposal" | "step_log" | null`.
- Tests: `run-spend.test.ts` has two new tests using the run's real figures, and the existing expectations now include `read: null` and `fromBuild`. `step-log-spend.test.ts` has a new `byPart` test. New `step-log-instructed.test.ts` uses the run's real S/0015 list. `live-llm-run.test.ts` has a new settleBuild test, and two existing expectations were updated for `read` and `fromBuild`.

### 3. Core answer folders for amendments and refused repeats

- Cause: only model calls and tool calls opened step folders. An `amend_draft` decision and a call refused as a repeat run no tool, so Core's answer to them appeared only in the next request.
- Fix: new `llm/step-log/answer-step.ts` (`automationStudioLlmStepLogAnswer`), exported from the step-log barrel. The barrel's folder contract comment now documents it. For a row with `decision: "amend_draft"`, or with `resultCode` `llm_evidence_loop.repeat_refused` or `llm_evidence_loop.rejected.repeat_without_progress`, it writes `NNNN-answer-amend_draft/` or `NNNN-answer-<toolId>/`:
  - `result.json` holds the verdict (`applied | partly_applied | refused | ignored`), `resultCode`, `resultReason`, `reason`, `applied`, each refusal `{step, reason, nodeId}`, `draftChange` and `progress`.
  - `meta.json` has kind `answer`, part/round/phase, verdict and summary, and no provider or cost.
  - The step is also listed in `index.md`.
  - Writing is best-effort and does nothing when the step log is off.
- Hook: one line in `llm/evidence-loop/trace.ts`, the recorder every row passes through, after `trace.push`. The recorder also takes an optional `env` (default `process.env`). This file is not on the reserved list. I did not touch `flow-draft/amendment.ts`, `dry-run.ts`, `rerun-request.ts`, `dry-run-gate.ts`, `replay-draft.ts` or `phases.ts`.
- Lab compatibility: the screenshot watcher matches only `tool-`/`test-` folders, and spend counting counts only metas that carry a provider, so answer folders are ignored by both. `rewrite-steps-index.ts` lists them.
- Test: new `step-log/tests/answer-step.test.ts` (4 tests) uses the run's rows from iterations 11, 12, 20 and 29, an undone edit and an unchanged edit, rows that must write nothing, and the real recorder writing an answer with its `draftChange` and `progress`.

## Commands run and observed results

- Core, `npx vitest run .../llm/step-log .../evidence-loop/tests/trace.test.ts` (heavy b2): 6 files, 29 passed.
- Core, `npx vitest run .../llm/decision-handlers .../unfinished-build/tests/phases.test.ts .../llm/evidence-progress`: 8 files, 53 passed.
- Core, `pnpm --filter fluxiq check` (heavy b1): tsc completed, no errors printed.
- Core, `node scripts/structure-audit.mjs`: "structure-audit: passed (228 warning(s), 349 baselined)". One advisory warning on my files: step-log/ has 17 source files against a 15-file advisory threshold (it had 16 before).
- Core libraries rebuilt (`pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`), because the test-runner build refused a stale Core dist.
- Downstream, `pnpm --filter @fluxiq-web-extension/test-runner check` (heavy b1): exit 0.
- Downstream test-runner build, then `node --test` on run-spend, step-log-spend, step-log-instructed, live-llm-run and build-from-chat: 49 tests, 49 pass, 0 fail. After the audit fix, step-log-instructed was rebuilt and rerun: 2 pass.
- `node --test dist/flow-lane/creation/tests/lane.test.js .../permission-point.test.js` (these read `said`): 38 pass.
- Offline re-derivation (scratch `t255-w1-rederive.mjs`) against the run's real `steps/` and `live-llm.json`, using the compiled dist:
  - Before: build 30 calls / $0.088570608, judge null, unattributed 3 calls / $0, `instructedConsequences` null.
  - After: build 30 / $0.086255124, judge 2 / $0.001935936, read 1 / $0.000379548, chat 1 / $0.000316476, unattributed 0 / $0. Total 34 calls / $0.088887084, which is unchanged. perBuild build is $0.088570608. `instructedConsequences` is now the two S/0015 entries (modify_existing, create_new).
- Downstream `node scripts/structure-audit.mjs`:
  - First run: my test used a fixed tmp path (`shared-temp-root`); I fixed it.
  - Final run: 1 violation, `[working-docs] docs/working/README.md is out of date with the documents' header blocks`. This existed before my work: I changed no docs, and the README is a shared document that is not mine to regenerate.

## Not verified

- No Lab live run, and no full suites (as instructed).
- Item 1 was not re-derived from the run's files, because they hold only the cut text. It is proved by a test built from the full text transcribed from the screenshot. The path from the RunnerFailure message to `events.ndjson`, `summary.json` and `flow-lane.json` was read, not exercised.
- `flow-lane.json`'s own `build.instructedConsequences` is still null for a build that left no proposal. The step-log fill applies only to the record live-llm.json keeps, because the lane writes its own copy. Filling it there would need `flow-lane/creation/lane.ts` to take the build back from `settleBuild`.
- Answer folders were not seen in a real Core run. The loop path is covered by the recorder test, not by a full evidence-loop run with the step log on.
- `phases.test.ts` sets `FLUXIQ_LLM_STEP_LOG_DIR` to a tmp "unused" path. Answer folders may now be written there during that test. It passed, but the directory may be left in tmp.

## Open questions or contradictions found

- The judge and read split depends on the step log's `part` and `phase`. A run whose step log predates `part`, or a run without a step log, keeps the old figures. If Core's `judgeAccounting` added a call count, or reported the judge spend separately, the Lab would not need the cost-closeness test. Missing in Core, not edited: a judge call count (or a separate judge accounting) on the build's diagnostic and proposal.
- `phases.judge` now holds both the playback's result check and the creation build's own judge. If a reader needs them apart, `stepLog.fromBuild.judge` gives the build's share.
- The step numbers in later runs shift, because an answer folder takes a number right after its decide folder.
