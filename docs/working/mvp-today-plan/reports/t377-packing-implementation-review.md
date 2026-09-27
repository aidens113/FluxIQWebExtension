# t377 — draft-packing implementation review and correction

## Verdict

**GO** for the owned Core draft-entry seam after correction. The clarified
candidate ladder is implemented, the two blocking oversized-input cases are
closed, the exact synthetic regressions pass, and Core type-checks.

## Final implementation assessment

- A complete fitting draft still returns the established object/full shape
  byte-for-byte.
- When every input passes the unchanged 512-byte serialized bound, packed
  candidates first try all inputs with full, brief, then minimal instruction.
  Only after those lossless candidates fail do they withhold inputs oldest
  first, using the minimal instruction only. Step removal remains last and
  keeps a contiguous newest suffix.
- When any input exceeds 512 bytes, packing remains disabled. After the initial
  complete object/full candidate fails, object candidates try brief then
  minimal with `withInput` covering every step. This preserves every bounded
  input and each oversized step's `inputTooLarge: true` marker before any
  withholding. Object-form withholding is then oldest-first and minimal-only;
  oldest-step removal remains last.
- The least-entry fallback preserves `inputTooLarge: true` when the newest input
  is oversized. A bounded newest input remains deliberately withheld, rather
  than being included in an entry already known to exceed its budget.
- `step_rows_v1` remains self-describing: ten ordered field names, seven required
  row positions, and optional replay/routing/settings positions through the last
  present value with internal `null` placeholders.
- Packed rows preserve the same input, result code, change state, disposition,
  result membership, replay status, existing routing text, and settings values
  as object lines. They add only the closed `format` and `fields` literals and
  introduce no new private/provider/result data.
- Selection and serialization remain deterministic. Every accepted rung is
  measured by exact serialized UTF-8 bytes; only the intentionally preserved
  least-entry fallback can exceed `maxBytes`.
- No draft, provider, token, cost, timeout, evidence-context, or run ceiling was
  changed in the three owned files. The 512-byte input bound and 4,000-byte live
  budget assertion are unchanged.

## Closed blocking findings

1. The earlier packed generator tried longer instructions again after input
   withholding began. It now uses minimal-only lossy packed candidates. The
   five-step near-limit regression at `maxBytes: 3_107` proves the oldest input
   alone is withheld and the minimal instruction is selected.
2. The earlier object generator exhausted input counts under the full
   instruction before shortening it. Mixed bounded/oversized regressions at
   `maxBytes: 1_711` and `1_343` now prove a complete brief object candidate
   preserves the bounded input and oversized marker. The reversed step order at
   1,711 proves the rejected oldest marker and bounded newest input both survive.
3. The earlier least-entry fallback used `withInput: 0` unconditionally. A
   one-step `maxBytes: 1` regression now proves an oversized newest input keeps
   `inputTooLarge: true`, while a bounded newest input remains absent without
   that marker.

## Validation

Observed on 2026-09-26 in `F:\!FluxIQ`:

```text
pnpm --filter fluxiq exec vitest run
  src/programs/automation-studio/runtime/flow-draft/tests/entry.test.ts
  src/programs/automation-studio/runtime/flow-draft/tests/entry-budget.test.ts

PASS — 2 files, 20 tests

pnpm --filter fluxiq check
PASS — tsc --noEmit
```

No provider or live run was invoked. I edited only the owned Core
`flow-draft/entry.ts` and `flow-draft/tests/entry.test.ts`; the owned budget test
needed no source change. I did not edit other Core files, commit, or push.

## Residual risk

- Packed-row measurement in `draft-shown`, the deterministic decision-11-through-26
  fixture, the broader runtime suite, and downstream privacy/accounting closure
  remain serial integration work outside this bounded review.
- The shared Core worktree contains unrelated concurrent changes, including a
  separate `runtime/llm/loop-configuration.ts` diff. I did not inspect or
  attribute those changes; the no-limit-change conclusion above is scoped to
  the three owned flow-draft files.
