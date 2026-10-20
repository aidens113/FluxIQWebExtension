# Lane S F4: balance guards recognise Core's codes

## Outcome
Done.

## What changed and why
- `scripts/lab/live-guards/balance-failure.mjs`: `detectBalanceFailure` now also matches `provider.code` equal to `llm.provider_balance_exhausted` or `flow_bootstrap.provider_balance_exhausted` (evidence `Core code <code>`). The 402 and text matches are unchanged. The header comment says why.
- `scripts/lab/live-guards/step-log-outcome.mjs`: the header comment no longer names the deleted `step-log-spend.ts` (lane-s-g-docs item 3). No logic change was needed, because it already passes `meta.error.code` as `provider.code`.
- Comment-only fixes: `scripts/lab/live-campaign/row/build-spend.mjs` (item 1) and `reported-spend.mjs` (item 2), both now name `live-llm/flow-spend.ts`, Core's Flow purse.
- Tests: `tests/balance-failure.test.mjs` gained a test that either Core code is a balance failure and an unrelated code is not. A new file, `tests/step-log-outcome.test.mjs`, checks that a step meta with `llm.provider_balance_exhausted` gives a balance failure and that an unrelated code gives none.

## Commands run and observed results
- `node --test scripts/lab/live-guards/tests/*.test.mjs`: tests 50, pass 50, fail 0.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (208 warning(s), 625 baselined).`

## Not verified
No live run was made. The `testing-facility.md` sentence about the guard (~line 3548) was not updated, because that file is outside this brief.

## Open questions or contradictions found
None.
