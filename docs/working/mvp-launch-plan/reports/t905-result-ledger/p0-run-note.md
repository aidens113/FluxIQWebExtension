# p0 run note

Outcome: Done.

## What changed and why
- AF/rows/result-change.ts: new change kind `carried_on` (`now` only); told as `{code: "answer_first.result_list_carried_on", rows, pages}`, counts only, no words.
- AF/rows/row-sink.ts: a read with `call.value.replay` (a pass of a run) that stored rows and told no other change returns `resultChanged: carried_on` with the result's rows (`totalRows`) and pages as the sink holds them after the read. Reads made by the model (no replay) are unchanged.
- run/result-list.ts: the switching note (`replaced`, instruction) is the first note that is not `carried_on`; rows/pages come from the last pass that stored rows. No switching pass means no note (a run that changed nothing still has none). flow-part.ts needed no change; it already passes every pass's evidence.
- Tests: result-list.test.ts (2 new), AF/rows/tests/carried-on-stamp.test.ts (new), replayed-read.test.ts (2 assertions changed from "no note" to the counts-only stamp).
- No forbidden file touched (call-chain.ts already puts any `resultChanged` on the answer).

## Commands and results
- vitest run run/ + rows/: Test Files 19 passed (19) (first run had 2 failures in replayed-read.test.ts, the old "no note" assertions, updated).
- `pnpm check` via heavy-slot: tsc finished, no errors.
- structure-audit: "passed (535 warning(s), 969 baselined)".

## Not verified
- Did not literally revert the change to watch the new tests fail; by construction they fail without it (no stamp, and `first` would be the stamp).
- No live run.

## Open
- Side effect: every replay answer that carries a list on now has a counts-only `resultList` stamp (dry/forward/part runs); the model sees only the run summary, which drops it unless a pass switched.
- The `carried_on` stamp applies only to `fromCall` replays, not `recordBatch` run batches.

Outcome: Done
Changed: runtime/llm/node-tools/run/result-list.ts, run/tests/result-list.test.ts, answer-first/rows/{row-sink.ts,result-change.ts}, rows/tests/{carried-on-stamp.test.ts,replayed-read.test.ts}
Validation: vitest run (run + rows) -> 19 files passed; pnpm check -> no errors; structure-audit -> passed
Not verified: reverted-change failure of new tests; live behaviour
Report: C:/Users/osrs_/FluxStuff/fxwork/t905/!FluxIQWebExtension/docs/working/mvp-launch-plan/reports/t905-result-ledger/p0-run-note.md
