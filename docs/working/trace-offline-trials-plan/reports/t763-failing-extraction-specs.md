# t763 failing extraction specs

## Outcome
Done. Both causes were stale specs after intended changes; no product change.

## What changed and why
1. `apps/extension/e2e/content/tests/extraction/tests/social-kept-row-disclosure.spec.ts` (1 failure): since t752 unit C2 (5f0b26ef, 2026-10-20) a list read discloses text by default and presses a kept row's own See more, so the kept collapsed post is no longer refused. The refusal is now asserted for a read with `discloseText: false` (the opt-out), which is the case the spec's step 2/3 still meant; the default behaviour is covered by social-read-discloses-kept.spec.ts. Assertion strength unchanged.
2. `apps/extension/e2e/content/tests/live-tasks/tests/local-classifieds-bike-search.spec.ts` (2 failures): detection labels for generated class paths are now readable (`price: '£149'`, domain/src/runtime/llm-evidence/structure/field-sample.ts, 7bb54be2/32be00d3 area) and drop the `(currency amount)` note, so the spec's price/title selection found two title columns. Added `isPrice` (label ends `(currency amount)` or starts `price: `) used for both the price and title/lines selection. Still exactly one column per role required.

## Commands run and observed results
- Repro: social spec 1 failed (expected failed, got succeeded); bike spec 2 failed ("one title column", got 2).
- After fix, the two specs together, headed, workers=1, three runs: `7 passed (2.6m)`, `7 passed (2.6m)`, `7 passed (4.1m)`.
- Neighbours (social-read-discloses-kept, social-read-completion, social-structure-row-control), headed: `5 passed (3.0m)`.
- `tsc -p tsconfig.json --noEmit` and `tsc -p tsconfig.test.json --noEmit` in apps/extension: no output (clean).
- `node scripts/structure-audit.mjs`: `passed (222 warning(s), 616 baselined)`.

## Not verified
Other specs in the live-tasks directory beyond the bike spec; full suites (not allowed). The social spec's file is CRLF; git warns it will normalise to LF on touch.

## Open questions
None. t762 paths untouched.
