# t194-w82: run-record gaps from run-musp39u8-9ac026ab

## Outcome

Partial. Gaps 1 and 3 are closed and tested. Gap 2 is blocked by file ownership. The writer of step-log answer folders is Core `R/llm/step-log/answer-step.ts`, called from `R/llm/evidence-loop/trace.ts`. It is not `decision-dump.ts`. Neither file is in this brief's ownership. I made no Core edit. The exact change needed is specified below.

## What changed and why

### Gap 1: re-author tries in live-llm.json

The run's two re-author builds were booked as `calls: null, callsFrom: not_recorded`. A failed build's `evidenceLoop` has no `totalProviderCallCount` or `providerCallCount`. It has only `decisionCount` (37 and 32). The reader also dropped `ending`, and it never read Core's `try`.

`packages/test-runner/src/live-llm/reauthor-record.ts`:
- Each attempt now has `try` (Core's `try`, `null` when absent) and `ending`. `ending` keeps `kind`, `bound` and `tried {rounds, decisions, stepsInFlow, tested, stops?, noRoute?}`, using only Core's closed words from `build-ending.ts`. It never copies `message` or `notDone`. A stop word outside the vocabulary is dropped. An unknown kind, or counts that are not well formed, publish `ending: null`.
- New `callsFrom: "loop_decisions"`. When no loop call count was recorded, `calls` comes from `evidenceLoop.decisionCount` (one paid call per decision; calls made outside the loop are not included). This also applies when the adaptation is unreadable or has no count.
- New exported type `LiveLlmReauthorEnding`, added to `live-llm/index.ts`.
- The fixtures in `tests/run-spend.test.ts` and `tests/live-llm-run.test.ts` were updated for the two new fields.

For this run's shapes, the record now reads calls 37 and 32 (total 69, `uncountedAttempts: 0`). The second try reads `try: 2` once Core records it. The endings are `budget_exhausted/rounds` and `budget_exhausted/cost`. `run-spend.ts` already uses `reauthor.calls` when it is non-zero, so the reauthor phase is counted (69) without needing the step-log fill.

I did not change `observedCalls` (36 rows with `requestId`/`taskKind` null). Those rows come from `build-usage.ts` reading the build loop's decision rows. Core records no call id, task kind or stage on those rows, and the module documents `null` as deliberate, so the fields stay null rather than being invented. The re-author calls are now itemized per try in `reauthor.attempts[]`, not in `observedCalls`.

### Gap 3: the playback read step

The read's step had `validation: null` and nothing else. `packages/test-runner/src/lab-runs/write-playback-steps.ts` now reads the action result's `extraction` summary and its `extracted` rows. It looks at both depths Core uses (`service/summaries/extraction-summary.ts`): the payload as sent, and the gateway's `{status, message, result}` wrapping. It writes `result.read = { records, pages, itemsSeen, emptyRecords, truncated, stop, conditionsKept, rowsReturned }`. The meta summary reads like "List extracted. 13 records over 5 pages (94 items seen, stopped on control_disabled); 13 rows returned". `stop` is checked against `RUN_EXTRACTION_PAGINATION_STOP` from test-contracts, and an unknown word becomes `unknown`. Only counts and closed words are written; no row, value or field name is copied.

`rowsReturned` is named for what the host attempt shows: the length of the `extracted` array. It is not "stored". Core's record capture can still refuse rows, and the attempt store does not say what was saved.

## Gap 2: needed change (not made; outside ownership)

`answer-step.ts` line `if (!amendment && !repeat) return;` writes an answer folder only for `amend_draft` and for the `REPEAT_REFUSALS` codes. These rows need folders too:
- `decision: "unusable"` rows: `decision_shape_invalid` (evidence-loop.ts around lines 339, 361, 670 and 738), a refused completion (`decision-handlers/completion.ts:77`, where `resultCode` is the first issue code), and `not_offered` (`evidence-loop/final-decision-row.ts`).
- `tool_call` rows whose `resultCode` is one of the answered-request codes (`already_answered`, `already_observed`, `not_offered`, `looked_again_unchanged`; evidence-loop.ts:773).

Core's feedback is not on the row today. The refused completion's `attempt.feedback` goes only into the evidence (completion.ts:72-75). The answered-request note is the fixed text in `evidence-loop/answered-request.ts`. The unusable-decision note is pushed into the evidence in evidence-loop.ts. The fix therefore needs:
1. an optional `feedback?: unknown` (and `issueCodes?`) on the trace row type (`evidence-loop/trace.ts`) and on `AutomationStudioLlmStepLogAnsweredRow`;
2. the callers to pass the feedback they push into the evidence;
3. `answer-step.ts` writing `answer-unusable/` or `answer-<toolId>/` with `verdict: "refused"`, `resultCode`, `issueCodes` and `feedback`, screened as step-log files already are.

Files: `R/llm/step-log/answer-step.ts` and its test, `R/llm/evidence-loop/trace.ts`, `R/llm/decision-handlers/completion.ts`, and `R/llm/evidence-loop.ts`. `decision-dump.ts` writes only the opt-in JSONL dump, which already records `check` verdicts with their feedback, so it needs no change.

## Commands run and observed results

- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194 w82 test-runner" npx tsc -p tsconfig.json --outDir node_modules/.cache/w82-dist --declaration false` (in packages/test-runner). This is the full package typecheck, compiled into a private outDir so it does not race other workers on `dist/`.
  - Before the fix: 4 TS2339 errors (`try` and `ending` missing on `LiveLlmReauthorAttempt`). The emitted tests then ran with `# tests 4 / # pass 1 / # fail 3`.
  - After the gap 1 fix, with the gap 3 test added: `# tests 14 / # pass 13 / # fail 1`. The failure was `not ok 9 - a list read's step carries the read's counts...`.
  - Final: tsc exit 0, and `node --test lab-runs/tests/*.test.js live-llm/tests/*.test.js` printed `# tests 158 / # pass 158 / # fail 0`.
- Core, in packages/fluxiq: `npx vitest run src/programs/automation-studio/runtime/llm/evidence-progress` printed `Test Files 1 failed | 3 passed (4); Tests 1 failed | 16 passed (17)`. The failure is `progress-trace.test.ts > says a completion the test refused after the check passed...`. That file and its test are modified in the tree by the worker who owns them. I made no Core change. `decision-dump.test.ts` passed.

## Not verified

- No live run. The new fields were checked against fixtures copied from this run's shapes, not against a regenerated `live-llm.json` or `steps/`.
- I did not check that the `command-attempts/*/attempt.json` of a real `extract_list` holds `extraction` and `extracted` at `result.payload.result` (or one level deeper). That run's `.fluxiq` was deleted. The path was taken from the domain's `webAutomationActionResultPayload` and Core's `extractionSummaryFromOutputs`.
- I did not run the structure audit or the package's full `pnpm test`.

## Open questions or contradictions found

- The brief named `decision-dump.ts` as the likely answer-folder writer. The writer is actually `step-log/answer-step.ts`, so gap 2 needs a brief that owns the files listed above.
- The brief says "stored rows' count". The attempt only shows the rows returned, so the field is `rowsReturned`.
- `perBuild.builds` in `run-spend.ts` still labels both tries `attempt: 1`. They will look the same there until a `try` is carried in that list as well (`LiveLlmBuildSpend`). I left this alone to keep the change small.
