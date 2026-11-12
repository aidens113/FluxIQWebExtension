# Phase 4: exploration overhead number in the Lab's attempt report

## Outcome
Partial. The reader, its tests, the report and result-line wiring are done. The typecheck exits 0 and `pnpm structure:check` passes. The 13 new or changed tests I could run pass. Two existing test files that exercise the changed report writers (`unscored-attempt-evidence.test.js`, `attempt-series.test.js`) cannot load because Core's dist is broken (`stuck-ask.js` has no export `automationStudioAnswerFirstAskStuck`); the lead needs to rebuild Core and rerun them.

## What changed and why
Everything is read from a run's `steps/` folders (`meta.json`, `call.json`, `result.json`, and `decision.json` for run-the-Flow decisions); no model call, so it works on old runs.

New directory `packages/test-runner/src/attempt-lane/overhead/` (one export per file, barrel `index.ts`, also re-exported from `attempt-lane/index.ts`):
- `step-record.ts` (type), `attempt-overhead.ts` (type), `decision-kinds.ts` (type)
- `read-step-records.ts`: folders to records. Only ENOENT is read as "absent"; malformed JSON is raised (the structure audit's failure-as-empty rule).
- `split-attempts.ts`: a new attempt starts at a `chat` step, or at a `flow` step that follows a `judge` or `note` step.
- `is-browser-call.ts`: a `tool` step whose result code starts `web.` or `core.replay.`.
- `repeated-calls.ts`, `count-decisions.ts`, `overhead-of-steps.ts` (pure), `read-attempt-overhead.ts` (files to result), `overhead-words.ts` (`36 / 8 = 4.5x`), `attempt-overhead-line.ts`.

Definitions used:
- live browser calls: tool step folders that reached the domain (`web.*` or `core.replay.*`). Describes, recalls, a written draft step, refusals and `answer_first.no_reset` do not count.
- Flow browser calls: non-`builtin.control.*` `flow` steps in the first block of replayed Flow steps (the first deterministic attempt). The same number is shown on every attempt of the run.
- overhead: live / flow (`null` when there are no live calls or no replay).
- repeated calls: key is node, parameters without the replay words (`replay`, `from`, `extractionBinding`), and place. Place is the replay's `from.location` plus the pass number from the call id (`.pass.N`, because the recorded location is the same on every pass); for a call made by hand it is the address the page stood at before it (the last by-hand `result.json` location); a navigation's place is its address. A call whose key was already seen counts once.
- whole-Flow runs from step 1: `core.run_flow` decisions whose `decision.json` has `from: 1`.
- decisions by kind, each counted once, first match: provider-format error (`error ...`); describe (`core.describe_nodes`, `web.describe_element`); refused (the steps answering it include an answer step containing "refused", or `answer_first.no_reset`); look (read-only results only, and no `add` in the summary); step (everything else).

Wiring (additive):
- `report.ts`: new `renderAttemptReport(series, overheads)` (series text plus one overhead line per attempt). `renderAttemptSeries` is unchanged because `run-attempt-proof.ts` passes it to `.map`.
- `live/result-line.ts`: optional `overhead` input appends ` Browser calls 36 / 8 = 4.5x, 18 repeated, 2 whole-Flow runs from step 1.` for an attempt with live calls.
- `live/unscored-attempt-evidence.ts`: optional `overhead` input, written into `attempt-report.txt`.
- `live/run-attempt-command.ts` (NOT in the brief's file list; minimal additive edit, it also carries the earlier model-header worker's uncommitted edits): reads the overhead once from `stepsDirectory` after the series, passes it to the result lines and `renderAttemptReport`, and to the unscored writer in the catch path.

Tests: `overhead/tests/overhead-of-steps.test.ts` (synthetic towels attempt 1 built from the design's table: 18 replayed, 4 ended, 8 actions, 5 reads or looks, 1 detection = 36; 3 describes, 1 format error, 2 refusals; two whole-Flow runs from step 1; then three attempts of the saved Flow's 8 browser and 5 control nodes), `overhead/tests/read-attempt-overhead.test.ts` (real folders in a mkdtemp dir, missing dir, malformed JSON raised), and a case in `live/tests/result-line.test.ts`.

## Commands run and observed results (all through heavy-slot t885, no --priority)
- `tsc -p tsconfig.json` in test-runner (emit, run directly because the package's `check` script needs a rebuilt Core) -> exit 0.
- `node --test dist/attempt-lane/overhead/tests/overhead-of-steps.test.js dist/attempt-lane/overhead/tests/read-attempt-overhead.test.js dist/attempt-lane/live/tests/result-line.test.js` -> 13 tests, 13 pass, 0 fail. The towels test asserts 36 live, 8 Flow, ratio 4.5, 2 whole-Flow runs from step 1, 18 repeated calls, and decisions 3 describe / 1 format error / 2 refused / 1 look / 13 step.
- `pnpm structure:check` -> `structure-audit: passed (249 warning(s), 552 baselined)`. The first run found three failures in my files (failure-as-empty, shared temp root, statement packing); fixed.
- `node --test dist/attempt-lane/live/tests/unscored-attempt-evidence.test.js dist/attempt-lane/tests/attempt-series.test.js` -> both fail to load: `SyntaxError: ... './stuck-ask.js' does not provide an export named 'automationStudioAnswerFirstAskStuck'` (Core dist, not my change).

## Proof over the kept step folders (files only; scratch script `C:/Users/osrs_/AppData/Local/Temp/claude/bc302d3e1bd85154/1d7e40a9-22b4-41e1-ad74-ba7e457da62b/scratchpad/proof-overhead.mjs` over the built dist)
run-mwbk0twg (towels, passed):
```
attempt 1 overhead: 36 live browser calls, the saved Flow runs 8, overhead 36 / 8 = 4.5x; 16 repeated calls; 2 whole-Flow runs from step 1; decisions: 3 describe, 3 provider-format error, 6 refused, 1 look, 16 step
attempt 2 overhead: 0 live browser calls, the saved Flow runs 8, overhead none (no live browser calls); 0 repeated calls; 0 whole-Flow runs from step 1; decisions: 0 describe, 0 provider-format error, 0 refused, 0 look, 0 step
attempt 3 (same as 2)
attempt 4 (same as 2)
```
run-mwc6ut8u (Saturday):
```
attempt 1 overhead: 83 live browser calls, no replay of the saved Flow in this run, overhead not worked out (nothing to compare with); 26 repeated calls; 0 whole-Flow runs from step 1; decisions: 8 describe, 0 provider-format error, 27 refused, 33 look, 47 step
```

Where this differs from the design's hand count: for towels it matches the hand count exactly (36 live, 8 Flow, 2 whole-Flow runs, 29 decisions = 3 + 3 + 6 + 1 + 16, with the design's 3 format errors and 3 describes). The Lab reported 38. My reader counts 36 because it leaves out the two `answer_first.no_reset` tool folders (0041, 0046: the rerun's put-back refused, which never reached the browser). Core's `liveSteps` counter (`attempt/call-chain.ts`, `input.stepped()`) increments for each call handed to the domain executor before it answers, so the likeliest source of the extra 2 is exactly those two refused reruns (36 + 2 = 38). I did not confirm this: the run's `attempt.json` was not kept (only `steps/`, `entry.json` in the lab-runs copy), and a refused rerun's exact path through `stepped()` was not traced, so treat it as the probable reason. The Saturday run has no replay of a saved Flow, so no ratio.

## Not verified
- The two Core-dist-blocked test files above (`unscored-attempt-evidence`, `attempt-series`), so the `overhead` input to `writeUnscoredAttemptEvidence` and the catch-path read in `run-attempt-command.ts` are type-checked only. No test of the unscored writer with overhead was added because it could not run.
- The main success path of `run-attempt-command.ts` (overhead lines in `attempt-report.txt`) is type-checked only; no Lab run was made.
- The 38 vs 36 reason is an inference (see above).
- Repeated-call counts are my definition applied to real data (16 for towels). The design gave no hand count to compare with. A by-hand call's place is the address left by the previous by-hand call (replays carry no page address), so after a replay run it can be stale; identical by-hand looks at that address count as repeats.
- Attempt splitting assumes the observed log shape (a replay's `flow` steps follow a judge or note). An attempt that explores after a replay stays with that attempt; other shapes were not seen.
- Tests were not run with each change reverted.

## Open questions or contradictions found
- Core's dist is still stale (same defect the model-header worker reported); the lead rebuilds Core, then reruns the two blocked test files.
- `result-line.ts` already had a misplaced doc comment (the "The run's one result line" block sits above `askedAgainWords`, not `attemptResultLine`); I left it alone.
- The "debug notes' per-attempt table" named in the design (b)4 is not written by this change; only `attempt-report.txt` and the result line are.
