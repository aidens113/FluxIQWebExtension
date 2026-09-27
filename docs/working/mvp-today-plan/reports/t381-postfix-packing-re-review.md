# t381 — post-fix draft-packing re-review

## Verdict

**GO** for the corrected Core flow-draft entry seam.

The current implementation closes the oversized-input ordering defects identified
before t377. The candidate ladders are lossless-first, markers and omission notes
remain truthful, packed rows preserve the object representation's semantics, and
all lossy choices are deterministic and oldest-first. The focused suite passes all
20 tests.

## Independent review evidence

Reviewed in `F:\!FluxIQ`:

- `packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/entry.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/tests/entry.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/tests/entry-budget.test.ts`

### Candidate order

- Every non-empty action draft first tries the established complete object/full
  representation and returns it unchanged when it fits.
- For an all-bounded draft, `packedTrimmings` tries all inputs with full, brief,
  then minimal instruction. Only then does it reduce `withInput` one at a time
  under the minimal instruction. Only after every all-step rung fails does it
  remove oldest steps by taking contiguous suffixes.
- For a mixed bounded/oversized draft, packing is disabled. `objectTrimmings`
  tries brief and minimal object candidates with `withInput === steps.length`,
  so every bounded input and every oversized marker survives before any loss.
  It then withholds inputs oldest-first under the minimal instruction and removes
  oldest steps only after no all-step candidate fits.
- Accepted candidates are measured from exact serialized UTF-8 bytes. Repeated
  calls traverse fixed arrays and numeric loops in the same order, so selection
  and serialization are deterministic.

The regressions exercise the decisive boundaries: the five-step 3,107-byte
bounded case withholds only the oldest input and uses the minimal instruction;
the 1,711- and 1,343-byte mixed cases preserve the bounded input and oversized
marker after shortening the instruction; reversing which mixed step is oldest
still preserves both values before withholding.

### Marker and omission truthfulness

- `inputTooLarge: true` is produced only when an input was requested for the
  object line and fails the unchanged 512-byte serialized-input bound.
- A draft containing any oversized input cannot enter `step_rows_v1`; it remains
  object-shaped, preventing a packed `null` from conflating an oversized input
  with budget withholding.
- Once intentional withholding begins, `omitted` says how many oldest arguments
  were withheld (or that every listed argument was withheld), and shortened
  guidance is also declared.
- The least-entry fallback always returns the newest step. It deliberately omits
  a bounded newest input, but preserves `inputTooLarge: true` for an oversized
  newest input; `unlisted` counts every older step. This keeps the fallback honest
  even though it is the sole candidate allowed to exceed `maxBytes`.

### Packed row semantics and loss order

- `fields` names all ten positions. Every row carries the seven required values:
  step, action id, input/null, result code/null, change state, disposition, and
  result membership.
- Replay, routing text, and settings are copied under the same conditions as the
  object form. Optional trailing nulls are removed only after the last present
  optional field; internal null placeholders remain, so no value shifts position.
- The packed form adds only the closed literals `step_rows_v1` and its static
  field-name array. It exposes no result payload, page content, evidence artifact,
  provider output, prompt, token, or credential beyond fields already present in
  the object entry.
- `from = steps.length - withInput` makes input loss a prefix, so the oldest
  listed arguments go first. `steps.slice(dropped)` makes step loss a contiguous
  oldest prefix. No middle step can disappear silently.

### Ceilings and compatibility

Within the reviewed three-file seam, the serialized per-input ceiling remains
512 bytes and the live-budget test remains 4,000 bytes. The change only selects
representation and trimming order; it does not alter provider-call, token, cost,
timeout, evidence-context, or run ceilings. Ordinary fitting drafts remain in the
existing object/full shape. The current shared Core worktree has many unrelated
changes, including `runtime/llm/loop-configuration.ts`; I did not attribute or
review those, so this no-ceiling-change conclusion is deliberately scoped to the
owned flow-draft files.

## Validation observed

```text
pnpm --filter fluxiq exec vitest run
  src/programs/automation-studio/runtime/flow-draft/tests/entry.test.ts
  src/programs/automation-studio/runtime/flow-draft/tests/entry-budget.test.ts

PASS — 2 files, 20 tests
```

```text
git diff --check
PASS — exit 0, no non-warning output
```

The full Core worktree diff check passed despite unrelated concurrent changes;
the same check scoped to the three reviewed paths also exited 0.

## Scope and residual work

I made no source or shared-document edits, and did not commit, push, invoke a
provider, run a live scenario, or inspect private artifacts. This review does not
replace the remaining serial integration checks for packed-row measurement,
decision 11–26 service behavior, broader runtime tests, or downstream privacy and
accounting closure.
