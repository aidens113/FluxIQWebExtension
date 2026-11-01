# Saved replay accounting contract

Outcome: Done. Read-only discovery; no successful replay was executed by this worker and no success-path defect requiring a fix was proven.

Changed: This owned report only.

## Measured baseline

The specified retained replay JSON was read with a closed-field PowerShell projection. It reports:

| Field | Observed |
| --- | --- |
| verdict / run status | failed / failed |
| run failure category / code | output_not_observed / web.validation.output_not_observed |
| modelProvidersEnabled / runIntent | false / null |
| environment credential variable count / stored-key identities preserved | 0 / true |
| coreProviderCallCount / accountedCalls / calls | null / null / null |
| interventions / harnessActivations | 0 / 0 |
| llmGate.invoked / llmGate.code | false / llm.gate.training_mode |
| resultVerification | null |

This proves factory wiring was disabled and no model intent/intervention was reported. It does not establish an explicit per-run metered zero. No raw page, model, request, selector or credential values were printed or copied into this report.

## Why failure has null totals

`packages/test-runner/src/saved-flow-replay/replay-saved-flow.ts:258-261` reads run detail and reduces usage after every returned run, before testing its status. Failed status does **not** skip downstream usage aggregation. `resultOf` at line 335 intentionally leaves receipt `calls` null when neither a public provider count nor a public accounting object exists, even though the generic observed-usage helper can derive an empty-intervention floor of zero.

The actual distinction is upstream. Core `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/run-outcome.ts:317` returns nonsucceeded sessions to failed-step handling before the successful-result accounting write. `flow-lane/replay/provider-free-replay-run.ts` requests verdict settlement, but explicitly does not wait for a result judgement on failed runs. The baseline has a declined recovery gate and no verification/accounting receipt, which is consistent with these paths. It is not evidence that failed runs universally omit accounting: an actual recovery ledger can still publish it.

The topology starts with `modelProvidersEnabled: false` (`replay-saved-flow.ts:204`), and replay passes no `llmExecution`. Those are separate prevention facts. The replay accounting guard deliberately does not convert them, empty intervention lists, or `llmGate.invoked: false` into fabricated counts.

## Expected clean success

Core `result-verification/zero-provider-run.ts:31-33` supplies its existing complete zero gate only when verification has settled, no gate already exists, and neither the prior run nor the completed verification has interventions. `run-record.ts:132,164` saves that gate with the result-verification metadata in the same write. Its normal shape has `invoked: false`, `ok: true`, all accounting totals zero, an empty provider-call list and zero omitted calls.

The public reader `packages/test-runner/src/existing-fluxiq-control.ts:424-444` obtains these facts through `get-flow-run-detail`, projecting `metadata.llmGate.costAccounting.calls` into `providerCallCount` and the accounting object into `llmAccounting`. A fresh clean provider-disabled success should therefore produce **coreProviderCallCount = 0, accountedCalls = 0 and calls = 0** in the saved replay receipt. This is source-supported expected behavior, not a newly measured successful replay.

The provider-free run helper waits for the saved verification on a succeeded run, preventing a read of the earlier succeeded status before its accounting save. Owning `saved-flow-replay/tests/run-flow.test.ts` covers both normal return and timeout readback with an initially missing verdict, then a settled unverified result and a complete zero ledger. Core `result-verification/tests/zero-provider-run.test.ts` covers writing the zero gate in the verdict's save without a selected provider. These tests were read, not run.

Success alone does not justify zero. An existing gate, continued unknown history, unfinished verification or actual interventions may keep accounting unknown by design. Core tests explicitly preserve unknown continued history and pending-provider work. A provider-disabled successful result can remain `unverified`; a model-confirmed result is not required for the replay's separate dataset/state oracle to pass.

## Exact accounting admission

`saved-flow-replay/provider/free-accounting.ts:9-15` requires at least one explicit public zero: `providerCallCount === 0` or `llmAccounting.calls === 0`. Both absent fails. If accounting is present, each of calls, inputTokens, outputTokens, totalTokens, estimatedCostUsd, budgetBreaches and pendingCalls must be exactly zero. Any nonzero public count, provider-call records or omissions, interventions, invoked model gate, or nonzero harness activations fails. A missing gate alone is not a failure when explicit accounting exists. The receipt must also satisfy the ordinary succeeded status, external oracle, unchanged saved Flow/graph and other replay checks.

The guard permits a count-only public zero, so a synthetic count-only passing fixture can have `accountedCalls: null`; it does not mandate all three receipt fields independently. Normal Core's complete zero gate should populate all three. The existing owning tests distinguish missing accounting from an explicit zero and reject contradictory totals and pending work.

Reader caveat, separate from this baseline: `existing-fluxiq-control.ts:585-598` defaults missing fields inside an already-present accounting object to zero. Therefore the receipt is not a raw field-presence proof for malformed/partial historical accounting. The current baseline contains no accounting object and remains null; Core's canonical clean-success gate supplies every field. No malformed successful receipt was measured and no change to that existing projection is proposed in this unit.

## If a successful replay still has null totals

Inspect closed accounting fields from the raw public `get-flow-run-detail` result before proposing a fix:

- Complete zero `metadata.llmGate.costAccounting` but missing projected totals: narrow downstream owner is `existing-fluxiq-control.ts`; meaningful acceptance must cross its real public reader into the replay guard, retaining missing/contradictory accounting refusals.
- Projected explicit totals but null saved receipt: narrow downstream owner is `saved-flow-replay/replay-saved-flow.ts` result projection; cover a full successful saved-replay receipt and a missing-accounting negative.
- No raw accounting and no settled verification: inspect the existing terminal-read/result-finalizer seam; a Core change needs lead authorization. Do not add a downstream zero fallback.
- Existing recovery gate, unknown continued history or unfinished provider work: preserve unknown and diagnose its provenance. Factory disablement does not authorize overwriting historical or incomplete accounting.

No such successful-path failure was proven here, so no source/test fix was requested or authored.

Validation: Read-only source/test inspection and a `Get-Content -Raw | ConvertFrom-Json` projection of the named retained receipt -> baseline fields above. No unit/full suite, Core startup/migration, provider, browser or panel execution. No runtime state, source, tests, shared documents or git were mutated.

Not verified: Actual successful installed replay accounting, live public readback timing, or owning test execution. The lead's next successful provider-free replay is the required measured acceptance.

Notes: Factory prevention and per-run accounting are distinct evidence. Preserve unknown rather than invent zero. Shared Core remained read-only.
