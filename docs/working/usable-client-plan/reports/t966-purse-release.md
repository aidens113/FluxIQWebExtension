# t966 purse release (F13)

## Outcome
Partial: fix and reproducing test pass; the wider harness/budget/build-purse run and the structure audit were queued behind other heavy-slot users and had not finished when this was written.

## What changed and why
- `packages/fluxiq/src/runtime/llm/harness/run.ts`, provider-failure branch: the failure's reported usage (`failure.reply?.usage ?? failure.paid`) is charged only when it carries a valid finite non-negative `estimatedCostUsd` (`billedUsage`). Otherwise the call settles at an explicit zero usage (`UNBILLED_USAGE`: 0 tokens, $0), on both the run-budget lease (`lease.complete`, which still records the call and its outcome) and the Flow/build purse hold (`hold.settle`; `not_attempted` still `release`s as before). Before, both fell back to the reservation/hold when no usage was reported, which is how three HTTP-400 refusals charged $1.4233.
- Decision rests on whether the provider reported usage, not on an error code. Billed refusals (`paid-refusal.test.ts`, output_invalid and unparseable result) are untouched: they still charge the reported usage.
- New test `harness/tests/refused-unbilled.test.ts`: real DeepSeek adapter answering HTTP 400 with no usage, under a purse and a run ledger -> purse spent 0, pending 0, run ledger 1 call at $0 (hold was >0); then a real priced call -> purse and ledger hold only its $0.002. Plus an untyped transport throw charges 0.

## Commands run and observed results
- `heavy-slot run t966-vitest -- vitest run refused-unbilled.test.ts paid-refusal.test.ts` -> 2 files, 5 tests passed.
- `heavy-slot run t966-wide -- vitest run src/runtime/llm/harness src/runtime/agents/budget src/runtime/llm/build-purse` plus `node scripts/structure-audit.mjs`: submitted, still waiting for a slot at time of writing (output in `C:/Users/osrs_/AppData/Local/Temp/t966wide.out`).

## Not verified
- Wider harness/budget/build-purse suites and the structure audit (above). No targeted tsc run.
- I did not run the new test against the unfixed code to watch it fail.
- The new test's "real call" uses a stub provider, not the live Anthropic path; the run-call record's `charged` for a zero-usage failure now says tokens/cost "reported" (0).

## Open questions
- A zero-usage settle counts the call in `spentCalls`/run `calls` (as before for charged failures); only `not_attempted` is uncounted.

## Update (after the wider run)
- Wider run `vitest run src/runtime/llm/harness src/runtime/agents/budget src/runtime/llm/build-purse` -> 66 files, 491 tests passed.
- `node scripts/structure-audit.mjs` then FAILED on my new test: an `as never` cast and the harness `tests/` directory over its 25-file limit. Fixed by moving it to `harness/tests/refused/unbilled.test.ts` and replacing the stub with a real DeepSeek-adapter 200 reply carrying usage (no cast).
- That revised test and a re-run of the audit are queued in the heavy-slot (`t966-final`, output `C:/Users/osrs_/AppData/Local/Temp/t966final.out`); NOT yet observed. The moved test has not been run since the edit.
