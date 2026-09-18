# w2-live-create-a — live DeepSeek creation campaign (instance camp-a)

## Outcome

Done. The campaign ran end to end against the real DeepSeek provider
(`deepseek-chat`) and produced a result for all nine creation tasks: eight
passed, one failed, none returned `no-result`. Nothing failed for an
environmental reason. The campaign process exited 1 only because one task
failed; the campaign itself completed and wrote its summary.

Campaign: `2026-09-17T23-08-37-778Z`, started 23:08:37Z, finished 23:24:20Z
(15m 42s wall clock, including the one-off workspace build).
Summary: `F:\!FluxIQWebExtension\test-runs\campaigns\2026-09-17T23-08-37-778Z\summary.md`
Run artifacts: `F:\!FluxIQWebExtension\test-runs\instances\camp-a\<runId>\`

Command run, exactly as briefed, from `F:\!FluxIQWebExtension`:

```
DEEPSEEK_API_KEY=<read from .env.local, never printed>
FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=isolated FLUXIQ_LAB_INSTANCE=camp-a \
  pnpm lab:campaign instruction-only-form-submit llm-target-drift-activate \
  identity-drift-rename identity-drift-rename-moved-save \
  identity-drift-rename-relabelled-save identity-drift-rename-redesigned-save \
  product-catalog-first-page product-catalog-first-page-reworded-prices \
  product-catalog-first-page-sparse-cards
```

## Per-task results

Every row below is read from that run's own
`test-runs/instances/camp-a/<runId>/snapshots/live-llm.json`, not from the
campaign verdict. `observed.calls` is the provider call count the live-LLM
gate actually recorded; in all nine runs it matches `build.providerCalls`,
so every run really did reach the provider.

| Task | Run | Judgement | observed.calls | tokens | cost USD | exploration |
| --- | --- | --- | --- | --- | --- | --- |
| instruction-only-form-submit | run-mu655pc5-523eb6ed | passed | 1 | 4489 | 0.00213268 | `null` |
| llm-target-drift-activate | run-mu65awah-c3f634ab | passed | 1 | 4958 | 0.00226688 | `null` |
| identity-drift-rename | run-mu65d8j3-549ae380 | passed | 1 | 4932 | 0.0023364 | `null` |
| identity-drift-rename-moved-save | run-mu65eubf-aa1c225f | passed | 1 | 4906 | 0.00230824 | `null` |
| identity-drift-rename-relabelled-save | run-mu65gccy-0c6c472f | passed | 1 | 4935 | 0.00234916 | `null` |
| identity-drift-rename-redesigned-save | run-mu65ih10-44083913 | passed | 1 | 4912 | 0.00231176 | `null` |
| product-catalog-first-page | run-mu65k4ch-e3008843 | **failed** | 3 | 17079 | 0.0081774 | `null` |
| product-catalog-first-page-reworded-prices | run-mu65mdz4-44a262ea | passed | 3 | 17057 | 0.00816772 | `null` |
| product-catalog-first-page-sparse-cards | run-mu65ogx2-bf0eb017 | passed | 2 | 12193 | 0.0056694 | `null` |

Totals summed from the nine snapshots: **14 provider calls, 75,461 tokens,
$0.035720**. These match the campaign summary's own totals exactly
(`providerCalls: 14`, `reportedTokens: 75461`, `reportedCostUsd: 0.03571964`).

Flow shape per task, from the campaign summary (all nine created a Flow):

- the six form/drift tasks produced 1–4 node Flows of `web.dom.type`,
  `web.dom.select`, `web.dom.click`, `web.dom.clear` and `web.browser.navigate`,
  judged by playback goal;
- the three catalog tasks each produced a 3-node Flow
  (`web.browser.navigate`, `web.dom.extract_list`, `builtin.control.end`),
  judged by the `extract-page-one` dataset.

## The two figures the brief asked for that the snapshot does not carry

**`taskKind` per observed call is not recorded.** In all nine snapshots
`observed.observedCalls` is `[]` and `observed.perCallRecords` is the string
`"not recorded"`. The only task identity present is the snapshot-level
`task: "create-flow"` (profile `lab-create-flow`, purpose `build_and_adapt`),
which is the same for every run. So the per-call `taskKind` breakdown cannot
be reported from this artifact — not because the calls did not happen, but
because the gate keeps only an aggregate (`observed.calls`,
`observed.accounting`) and does not retain a per-call record. `observed.gate`
is `{invoked: true}` in every run, and `observed.interventions` is 0.

What is recorded per run is the evidence loop's tool use, which is the nearest
available proxy for what each call was doing:

- the six form/drift runs: `build.evidenceLoop.toolIds = ["web.inspect_current_page"]`,
  `decisionCount 1`, `toolCallCount 1`;
- the three catalog runs: `["web.detect_repeating_structure", "web.inspect_current_page"]`.

`build.outcome` is `proposed` and `build.failure` is `null` in every run,
including the failed one. `build.recoveredAfterTimeout` is `false` everywhere.

**`exploration` is `null` in all nine snapshots.** The field exists at the top
level of the schema and is explicitly null, so there is no
`exploration.requested` and no `exploration.status` to report: no exploration
was requested on any creation run in this slice. This is uniform across all
nine, form and extract lanes alike.

## The one failure, and why it is a product failure rather than an environmental one

`product-catalog-first-page` (run-mu65k4ch-e3008843), verdict `failed`,
`failureCategory: runtime.behavior`.

The Flow was created (`flowCreated: true`, 3 nodes) and executed all three
actions. The interesting part is the disagreement between two verdicts in
`evaluation.json`:

- `reportedVerdict: "passed"` — the run itself believed it succeeded;
- `oracleVerdict: "failed"` — the dataset oracle disagreed.

The oracle is right. `evaluation.extraction[0]` says
`expectedRecords: 8, observedRecords: 0, comparedRecords: 0,
matchedRecords: 0, expectedFields: 0, presentFields: 0`. The extraction step
ran for 2112ms, was judged, listed records and stated a count, and returned
nothing. So the created Flow extracted zero of the eight products on the
catalog's first page while reporting success.

That this is a genuine defect rather than flakiness is supported by the two
sibling variants of the same scenario passing in the same campaign minutes
apart, on the same build and the same provider: `text-variant` (reworded
prices) matched 8 of 8 records and 16 of 16 fields, and `sparse-cards` also
matched 8 of 8 and 16 of 16. The baseline variant is the one that failed.
`harnessRecovery.attempted` is `false` — nothing tried to repair it — and
`harnessActivations` is 0 across all nine runs.

The campaign made a single attempt at this task (`Attempts: 1` in the summary,
though up to 3 were allowed), because a clean `failed` judgement is a result
and is not retried; only a `no-result` would have been.

The evidence-packet budget invariant passed in the failed run as well
(`4 packets, the largest 5848 bytes`, limit 6000), so the failure is not a
truncated-evidence artefact.

## Budget and authorization state (identical across all nine runs)

`authorized.maxCalls 26`; `maxTotalTokensPerRun 100000`;
`maxEstimatedCostUsd 0.25` per call and `maxTotalEstimatedCostUsd 2` overall;
`timeoutMs 25000`. `granted` matches `authorized` in every run.
`highTokenConfirmation.sent: false` — the 100000-token run budget sits at, not
above, Core's confirmation threshold, so no confirmation was required.
`observed.accounting.budgetBreaches` is 0 and `pendingCalls` is 0 everywhere.
`credentialSource` is `DEEPSEEK_API_KEY` from `the process environment`, which
confirms the `FLUXIQ_TEST_ENV_FILES=none` plus explicit key export worked as
intended: the env file was not read, and the key arrived through the process
environment.

## Commands run and observed results

- The campaign command above, output captured to a scratchpad log. Final line
  from the campaign process:
  `{"campaign":"2026-09-17T23-08-37-778Z", ... "totals":{"tasks":9,"passed":8,"succeeded":8,"failed":1,"noResult":0,"judgementsPassed":8,"providerCalls":14,"reportedTokens":75461,"reportedCostUsd":0.03571964}}`
  followed by `ELIFECYCLE Command failed with exit code 1` — the non-zero exit
  is the one failed task, not a harness fault.
- Read each of the nine `snapshots/live-llm.json` files directly, plus
  `evaluation.json` for the failed run, and the campaign `summary.md`.

No source file was edited, no test was written, nothing was committed.

## Not verified

- Per-call `taskKind` — not present in the artifact (see above); not inferable
  from the snapshot without reading the raw provider transcript, which this
  brief did not ask for.
- Whether `exploration: null` is the expected shape for creation runs in this
  slice, or whether exploration was supposed to be requested and silently was
  not. The snapshot records absence; it does not say whether absence is correct.
- Why the baseline `product-catalog` variant extracted zero records while both
  of its variants extracted all eight. The failure is recorded, not diagnosed;
  no DOM, selector or prompt-level investigation was performed.
- The failure was observed once. Given this machine's known-faulty RAM, a
  single observation is not proof of a deterministic defect, though the two
  passing siblings in the same campaign make a hardware explanation unlikely.

## Open questions or contradictions found

- A run can report `passed` while its oracle says `failed`. In
  run-mu65k4ch-e3008843 the runtime's self-reported verdict was `passed` with
  zero records extracted. If anything downstream trusts `reportedVerdict`
  rather than `oracleVerdict`, it will record a success that extracted nothing.
- `observed.perCallRecords: "not recorded"` means the live-LLM snapshot cannot
  answer "what was each call for". If the plan intends per-call `taskKind` to
  be auditable, the gate needs to retain per-call records.
- All six form/drift tasks converged on exactly one provider call and a single
  `web.inspect_current_page` tool call, including the three drift variants that
  move, relabel and redesign the save control. Either the drift is being solved
  from one page inspection, or these variants are not exercising as much
  divergence as their names suggest. Worth confirming against the scenario
  definitions.
