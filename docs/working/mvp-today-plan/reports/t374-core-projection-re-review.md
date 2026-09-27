# t374 — Core projection-bound re-review

## Verdict

**GO.** The represented-draft ceiling is correctly derived as
`64 + 64 + 1 = 129`, is applied only to represented draft counts, and rejects
130 in both sanitization and strict stored-step parsing. Closed nested shapes
remain fail-closed. The 128 draft-revision ceiling and the 64 applied/refused
amendment-count ceilings were not weakened.

## Evidence

- `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_LIMITS.maxTotalNodes` remains 64 and
  `AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_LIMITS.maxIterations` remains 64.
- `MAX_REPRESENTED_DRAFT_STEPS` is derived from those two limits plus the
  deterministic iteration-zero observation. It governs only
  `draftChange.keptStepCount`, `draft.steps`, `draft.unlisted`, and the combined
  `draft.steps + draft.unlisted` check.
- The boundary suite accepts 129, rejects 130 for `draft` and `draftChange`,
  accepts the split `64 + 65`, and drops `64 + 66`.
- The strict parser calls the same nested validators and returns `null` whenever
  a supplied nested object fails. `hasExactFields` rejects undeclared members;
  required members are independently validated, so omitting one also fails.
- `MAX_DRAFT_REVISIONS` remains `maxIterations * 2` (128). `appliedCount` and
  `refusedCount` remain bounded directly by `maxIterations` (64).
  `MAX_DRAFT_CHANGE_TARGETS` and the refusal-list ceiling remain 16.
- A direct executable probe confirmed revision 128 is accepted and 129 is
  rejected; amendment counts 64 are accepted and 65 are rejected; and an extra
  `draftChange` key is rejected.
- The diagnostics fixture now uses `steps: 2` plus `unlisted: 128` (130 total),
  so it remains deliberately invalid under the corrected 129 ceiling.

## Commands and results

```text
pnpm --filter fluxiq test -- src/programs/automation-studio/runtime/flow-bootstrap/tests/evidence-loop-steps.test.ts
PASS — 1 file, 25/25 tests

pnpm --filter fluxiq exec tsx -e "<boundary probe>"
PASS — {"revision128":true,"revision129":false,"amendment64":true,
        "amendment65":false,"changeExtraKey":false}
```

Inspection was limited to the t370 production/test/diagnostics files and the
directly referenced Flow Bootstrap and evidence-loop limit definitions. The
t369 brief filename was stale; the existing report is
`t369-core-progress-final-review.md` and was reviewed.

## Residual risks

- This was focused validation, not a Core-wide check/test/build run.
- No provider, live, browser, or service path was run.
- The checkout contains extensive unrelated in-progress changes; conclusions
  apply to the inspected working-tree state and focused tests only.
- The `+ 1` deterministic iteration-zero premise is encoded explicitly rather
  than represented by its own named limit; a future change to that lifecycle
  must update this expression and its boundary tests.

No Core source or shared document was edited. No commit or push was performed.
