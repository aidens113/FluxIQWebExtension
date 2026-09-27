# t370 — Core represented-draft projection bound fix

## Outcome

Implemented the Flow-Bootstrap-specific represented-draft ceiling requested by
t369. `evidence-loop-steps.ts` now derives the maximum from the supported
64-node seed, 64 evidence-loop append opportunities, and the deterministic
iteration-zero append: `64 + 64 + 1 = 129`.

The 129 bound now governs:

- `draftChange.keptStepCount`;
- `draft.steps`;
- `draft.unlisted`; and
- the `draft.steps + draft.unlisted` consistency check.

The 128 draft-revision ceiling is unchanged. Applied/refused amendment counts,
target count, byte bounds, and amendment-refusal limits are unchanged.

## Boundary coverage

The owned projection test now proves:

- a truthful 129-step seeded-and-appended draft survives sanitization and the
  strict stored-step parser;
- 130 is dropped by sanitization for both `draft` and `draftChange` and is
  rejected by the strict parser; and
- split listed/unlisted counts accept `64 + 65 = 129` and drop
  `64 + 66 = 130`.

## Validation

- `pnpm --filter fluxiq check`: **PASS**.
- Owned projection test: **25/25 PASS**.
- Service evidence-trace test: **24/24 PASS**.
- Combined focused projection/diagnostics/evidence-trace run: **100/100 PASS**.
  With supervisor authorization, the now-stale diagnostics fixture was changed
  from `steps: 2` plus `unlisted: 64` (66 total, valid under the corrected
  ceiling) to `steps: 2` plus `unlisted: 128` (130 total, deliberately invalid).

The first focused command accidentally supplied repository-relative paths to
the package-root Vitest invocation and found no tests; it exited zero and is
not counted as validation. The corrected package-relative invocation produced
the results above.

## Scope

Edited the assigned production source, its owned test, the one supervisor-
authorized stale diagnostics fixture, and this report.
No provider or live path ran. No raw artifacts were inspected. No commit,
push, or shared-plan edit was performed. The t355 preservation wording was not
changed because it is outside the assigned edit set; it should be updated by
the supervisor when integrating this fix.
