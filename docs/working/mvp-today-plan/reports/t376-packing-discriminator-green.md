# t376 — packing discriminator green

## Verdict

PASS. The provider-free Core discriminator is green with the lossless packed
draft source and packed-draft measurement source present. Decisions 11–26 keep
all 7–22 listed steps and all bounded inputs inside the unchanged 4,000-byte
draft budget. The exact completion-feedback, offered-decision grammar,
registered/visible record-producer counts, exhaustion accounting/trace checks,
and decision-11 convergence branch remain intact.

## Change

Edited only Core
`packages/fluxiq/src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts`.

The exhaustion loop already carried the selected green assertions for every
decision 11–26:

- `steps === iteration - 4` (7 through 22);
- `unlisted === 0`, `withoutInput === 0`, and `inputTooLarge === 0`;
- serialized bytes are at most the 4,000-byte budget; and
- `overBudget === false`.

I tightened the fixture's content-free draft observer so those assertions also
measure `step_rows_v1` rows. It resolves the `input` column from the packed
`fields` array and counts a missing or null row value as `withoutInput`.
Malformed packed fields/rows therefore fail the zero-withheld-input assertion
instead of being silently counted as complete. Existing object-line handling,
including the `inputTooLarge` distinction, is unchanged.

## Validation

```powershell
pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts -t "reproduces|converges"
```

PASS — one file, two selected tests passed, eight skipped. The measured
26-decision exhaustion test passed in 14.883 seconds and the decision-11
convergence test passed in 7.579 seconds (27.12 seconds total).

This was deterministic fixture validation only. I made no production or other
test changes, invoked no provider/live run, and did not commit or push.
