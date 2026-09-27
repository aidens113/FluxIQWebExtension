# t378 — discriminator re-review

## Verdict

GO after one test-local correction. The original packed observer could report
`withoutInput: 0` for a three-cell row whenever its abbreviated `fields` array
put `input` at index 2. It also ignored array rows in the object representation.
That meant a malformed encoding could satisfy the zero-omission assertion even
though the current service fixture itself was green.

The corrected observer now requires the exact ten `step_rows_v1` field names in
their specified order, requires every packed row to contain 7–10 cells, and
requires the input cell at index 2 to be present and non-null. A primitive or
array step in object mode is counted as withheld/malformed rather than silently
contributing zero. The service assertions were not relaxed.

## Evidence

- `deepseek-bootstrap-exploration.test.ts:402-450` defines the exact packed
  field catalog and maps every invalid catalog/row or absent packed input to a
  positive `withoutInput` count. Existing object-form `inputTooLarge: true`
  remains distinct from budget withholding.
- `deepseek-bootstrap-exploration.test.ts:471-485` directly proves that valid
  object steps and valid 7- and 10-cell packed rows report zero, while an
  object-mode array, reordered fields, a 6-cell row, a null input, and an
  11-cell row each report one withheld input.
- The exhaustion branch at lines 623–689 still pins decisions 11–26 to the
  exact completion-feedback code, the exact decision-kind grammar (three kinds
  through decision 25 and completion only at 26), one registered and one
  visible record producer, all expected 7–22 steps, zero unlisted/withheld/
  oversized inputs, at most 4,000 bytes, exact terminal accounting, no stored
  adaptation, one grant revocation, and zero active grants.
- The convergence branch at lines 691–731 still pins decision 11 to the same
  feedback, three-kind grammar, seven complete steps within 4,000 bytes, one
  registered/visible producer, exact accounting, the record-producing node,
  the unusable-to-complete trace, revocation, and zero active grants.

Because the deterministic draft crosses from the fitting object form to
`step_rows_v1` at the previously measured packing boundary, the unchanged
decision-11-through-26 loop now measures both forms with a discriminator that
cannot accept a malformed packed field catalog or malformed packed row as
complete.

## Changed files

- Core test only:
  `packages/fluxiq/src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts`
- This worker report.

No production source, shared working document, provider/live run, commit, or
push was touched.

## Validation

```powershell
pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts -t "draft observation discriminator|reproduces|converges"
```

PASS — one file; 3 selected tests passed and 8 skipped. Exhaustion passed in
15.414 seconds, convergence passed in 6.999 seconds, and the direct malformed-
shape discriminator coverage passed (27.26 seconds total). SHA-256 of the test
source was identical before and after the run, confirming the tested source
remained stable.

```powershell
git diff --check -- packages/fluxiq/src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts
pnpm --filter fluxiq check
```

PASS — no whitespace error (only the existing Git LF/CRLF warning), and
`tsc --noEmit` exited 0.
