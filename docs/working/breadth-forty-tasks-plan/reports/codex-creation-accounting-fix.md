# Shared creation-accounting patch map

## State and boundaries

Read-only design on isolated t563 Core2b13e40c/downstream57ad8dc2. Read Core AGENTS Repository Boundary/Code Structure and architecture/code-structure. No implementation/tests/builds/provider calls/UI actions. Shared Coree58, installed Chrome/profile/host/lease untouched. Own report only. The prior t721 accounting diagnosis and independently confirmed creation/replay results remain evidence; strict acceptance gates stay unchanged.

## Proven seam and closest existing regression

`runtime/service.ts:2485?2491` resolves a caller-paid provider; `result-verification/run-outcome.ts:570?587` does not supply the optional canonical runBudget that verify.ts already forwards to the harness. run-record.ts only introduces the no-provider zero gate, never a paid gate. This remains the first missing receipt seam.

Existing `runtime/tests/service-adaptation/tests/caller-paid-result-check.test.ts:299` already executes a clean caller-funded actual service run with one successful mock loop_verification usage of input4/output2/total6/cost0.001. It currently asserts the verdict and provider dispatch only. Extend this exact case first to require public full-detail canonical receipt: calls1, pending0, matching reported usage/cost, one itemized loop_verification call, omitted0. It must fail before the fix. This test is a better first reproducer than a new parallel service harness.

## Budget/authority distinctions

| Existing source/field | Actual scope | Design treatment |
|---|---|---|
| session-key-provider.ts maxTotalEstimatedCostUsd | Whole run; server/Flow run-cost ceiling | One shared ledger's global cost bound |
| resolver maxCallsPerRun / maxTotalTokensPerRun; Flow-narrowed maxCalls | Whole run | One shared ledger limits, never reset per check |
| resolver maxEstimatedCostUsd; Flow llmExecutionSettings.maxEstimatedCostUsd | Per call (`flow-execution-limits/resolution-within-flow-settings.ts:35?61`) | Preserve each request's narrower existing ceiling |
| redeemed standing check maxEstimatedCostUsd | Authorization for this check, applied to provider request at runtime-adaptation/result-check.ts:189?199 | Do not permanently reinterpret as a smaller whole-run ceiling |
| recovery/refuted-result/purse.ts | Existing outer repair-part spending window | Preserve it; do not add its spent total a second time to canonical ledger |

Production caller resolver, frozen caller and canonical Flow metadata do not demonstrate a late narrower *whole-run* profile: the caller's default run total stays the same. A small standing check grant is not evidence that a new ledger constrain API is needed. Do not add a general constrain API merely because that field is smaller. The generic resolver contract can supply narrower run-count/token/total limits later; a phased fix must either keep one validated run-global profile and fail closed on incompatible later whole-run declarations, or separately authorize canonical monotonic narrowing in run-budget.ts. It must not silently ignore those declarations. Per-call token/timeout/cost limits remain attached to each ask in either phase.

Existing `costCeiling()` at run-outcome.ts:653 explicitly describes its inputs as this call's ceilings. This map does not silently change standing-authority quota semantics or provider selection. If product requirements demand a cumulative cap for a multi-ask standing check, that is an explicitly separate quota decision, not justification for replacing the run ledger.

## Recommended object/lifecycle

Use one `AutomationStudioLlmRunPurse` object per logical runtime execution, bound to project+run identity once the session is admitted. It lazily opens exactly one canonical AutomationStudioLlmRunBudgetLedger after a usable provider and run profile have been resolved. No provider resolution, authorization redemption or ledger initialization merely to report a deterministic run.

The service creates the holder next to runLlm. The same holder travels through normal verification, verification reasks, in-run repair binding, detached recovery annotation, refuted-result repair and same-run rerun callbacks. Remove the binder's independently allocated `{}` purse at in-run-repair.ts:96. Do not allocate a replacement inside runVerification or on each result-check pass. A new replay with a new run ID receives a fresh holder.

Purse module API: `current` exposes the existing `{budget,ledger}` shape; `open(profile)` creates it once or verifies compatible run-global limits; a snapshot/read method uses ledger.snapshot/runId and ledger.callRecords/runId. Do not implement charging or token arithmetic in this helper. Profile is the existing recovery budget shape moved as a type only into the lower LLM owner, with the old RecoveryRunBudget type retained as a compatibility alias. This avoids llm ? recovery ? llm runtime imports.

## Exact initial implementation file map

All paths below are relative to Core `packages/fluxiq/src/programs/automation-studio/`. These are proposed ownership, not edits made by this report.

| Path | Bounded responsibility |
|---|---|
| `runtime/llm/run-budget-profile.ts` NEW | One exported domain-neutral run-budget profile type, structurally the current RecoveryRunBudget result; no policy/math/provider selection |
| `runtime/llm/run-purse.ts` NEW | One exported run-identity-bound purse class, one lazy ledger, compatible-profile/reentry guards |
| `runtime/llm/index.ts` | Barrel exports for the two new owners; existing exported symbols preserved |
| `runtime/recovery/annotation/run-budget.ts` | Retain RecoveryRunBudget compatibility alias to extracted profile; existing resolver arithmetic unchanged |
| `runtime/recovery/annotation/in-run.ts` | Replace embedded anonymous purse contract with typed shared purse |
| `runtime/recovery/annotation/annotate.ts` | Optional shared purse input for detached recovery as well as inRun; use same holder; preserve current standalone fallback and per-call pricing |
| `runtime/service/runtime-session/in-run-repair.ts` | Typed optional shared purse binding; reuse service's holder rather than own closure holder; standalone callers still work |
| `runtime/service.ts` | Allocate/pass holder through runLlm, verifyRunResult and every repair callback. No authorization/provider changes; no other service refactor |
| `runtime/result-verification/run-outcome.ts` | Add typed optional purse to runtime verification input; open from existing resolved run profile; pass its ledger to verify request; reuse across recursive verification |
| `runtime/result-verification/run-record.ts` | Save shared canonical paid snapshot with verdict; no sum/count guesses; preserve existing gate diagnostics |
| `runtime/result-verification/run-accounting.ts` NEW | One exported gate-projection function: preserve gate diagnostic fields, replace only owned totals/itemization from this exact shared ledger, keep pending explicit |
| `runtime/result-verification/index.ts` | Barrel for the focused gate helper if imported across owning boundary; no wire/public endpoint changes |
| `docs/architecture/automation-studio.md` | Amend current run-budget/itemization section around2168 to cover routine checks and shared lifecycle/pending/reentry boundaries |

No runtime-adaptation/contracts.ts context member is necessary: pass holder explicitly through existing service closure/callback inputs rather than making shared adaptive context mutable. No API handler, result-check authorization, downstream collector, schema migration, browser or domain source change is needed. `AutomationStudioResultVerificationRequest.runBudget` already exists; do not add another budget option there.

If provider-resolution run-global limits are consumed for the first routine check, extend the existing `AutomationStudioResultVerificationProvider` type in run-outcome.ts with the relevant optional fields of AutomationStudioLlmProviderResolution (maxCallsPerRun/maxTotalTokensPerRun/maxTotalEstimatedCostUsd). This is an in-memory structural contract; preserve bare-provider and resolution wrapper behavior. Do not cast hidden fields through any to evade the contract.

## Persisted continuation: required choice before implementation

Exact source `service.ts:2449` permits another runRuntimeSession call for an existing runId. Sharing an object in one invocation alone does not preserve accounting across that reentry. The canonical ledger has **no restoration API** today (run-budget.ts exposes constructor/reserve/snapshot/callRecords only).

Existing precedent: `recovery/refuted-result/purse.ts:40?56,95?107` restores an outer repair purse from its marker, records unreportedParts when a paid part has no cost, and explicitly says it is a number on a record, not a ledger. It cannot reconstruct canonical provider call records or pending reservations. The build purse similarly is not a canonical run-budget restoration seam. Do not use either as fabricated complete run accounting.

Choose one bounded phase explicitly:

1. **Recommended narrow first phase: preserve/fail closed on paid or unknown reentry.** Fresh/queued sessions with no past model activity may open a new purse. Reentry with an existing canonical nonzero/pending receipt or verification/intervention evidence but no in-memory holder must preserve that receipt and refuse a new paid dispatch as accounting unavailable. An absent gate on an already executed run is unknown, not zero; the current installed confirmed run is exactly this case. No new zero gate or replacement cheaper account may be written. Deterministic read/replay can proceed without claiming finalized combined spend. Implementation must choose/report a closed diagnostic in the owning purse guard; do not mislabel an accounting refusal as a provider rejection.
2. **Separate restoration phase if continued paid reentry is required immediately:** extend **canonical** run-budget.ts plus owning run-budget.test.ts with validated restore input. Require identity match, finite nonnegative totals, internally consistent itemized+omitted counts, and a settled pending0 baseline. Unknown/malformed/pending>0 history refuses; persisted totals cannot reconstruct exact in-flight reservation IDs/amounts. Restore completed state and retained request IDs before reserving anything new. Never seed missing fields with zero or sum a restored account again on each save. Existing itemization limit/omitted semantics remain canonical. Add a focused typed receipt contract/barrel only if required by that API. No restoration from verdict.calls or summary tokenUsage alone.

Thus restoration is an explicit additional owner/API choice; it is not smuggled into the clean-run fix. A narrowly scoped live proof can use a fresh run/profile after the first phase, while old paid-history continuation remains truthfully blocked pending restoration.

## Save/settle invariants

- One canonical ledger accounts for repair/check/recheck calls under the same run. Gate fields such as invoked/repairAuthority/patchSkipped/code stay intact; snapshot and itemized records replace their prior snapshot rather than being added to themselves.
- No ledger opened means no inferred paid or zero receipt. Existing zero-provider path remains the only explicit zero writer for a genuinely settled no-model run.
- Pending reservations survive as pending in saved metadata; verdict terminality does not imply accounting finalized. A timed-out/cancelled verification may retain completed receipts and pending>0, and cannot pass readiness.
- Provider failure or missing/invalid usage follows canonical harness/ledger conservative charging and reported-versus-reserved provenance; no invented reported zero cost. A known pre-dispatch refusal must not be presented as a real provider call. If a fail-first test exposes a mismatch in existing harness reservation complete/release behavior, notify root before adding harness/run.ts ownership.
- A deadline-abandoned provider completion must not rewrite verdict/source/other run state through an obsolete closure. Initial phase may leave pending history unknown; do not pretend late settlement was durably reconciled. A future accounting-only reconciliation needs explicit ownership and idempotent publication.
- Preserve creation purse/build-purse reservation as existing outer policy; it is not another source to add into one runtime run's gate. Itemized+omitted must reconcile with canonical count.

## Exact tests and public roundtrip

Existing source test paths relative to the same Core base:

- `runtime/tests/service-adaptation/tests/caller-paid-result-check.test.ts`: extend clean every-check caller test first; then repair+check additive receipt using existing mock usages. Exercise actual service storage and public full getFlowRunDetail, not only returned session metadata. Add real registry `get-flow-run-detail` read using same registry/actor pattern already in this file.
- `runtime/result-verification/tests/run-outcome.test.ts` and existing `run-outcome-harness.ts`: clean successful check, reask, outer deadline with pending second dispatch, missing usage, confirmed versus accounting readiness independence.
- `runtime/result-verification/tests/run-outcome-repair.test.ts`: same holder across refutation/repair/reverification; earlier spend preserved exactly once.
- `runtime/result-verification/tests/zero-provider-run.test.ts`: unchanged true zero replay; no zero over paid/unknown/pending history.
- `runtime/service/runtime-session/tests/in-run-repair.test.ts`: binder receives same purse identity and later verification observes its spent ledger.
- `runtime/llm/tests/run-purse.test.ts` NEW: one ledger/identity, laziness, compatible-profile and fail-closed paid/unknown reentry behavior.
- `runtime/result-verification/tests/run-accounting.test.ts` NEW: exact snapshot projection, diagnostic preservation, repeated publication idempotence, pending semantics.
- Only if restoration is chosen: existing `runtime/llm/tests/run-budget.test.ts` plus a new receipt-contract owning test if a new contract is introduced. Only if typed-store roundtrip fails independently: propose exact storage owner first; do not preemptively edit it.

Public detail regression expectation: provider dispatcher observed once, persisted confirmed verdict, positive exact fixture-independent records, receipt calls1/pending0/itemized1/omitted0, cost0.001 and usage4+2=6 from the mock's actual reply. Read it through the registered read handler and again from the persisted full store; bare session success or summary totals are insufficient. Actual live installed paid accounting is still unknown until fixed artifacts are independently accepted and a new run is coordinated.

Validation: source/API/type inspection only. No tests or builds executed; no changed product files. Report is ready for supervisor choice of narrow phase/ownership before implementation.

## Implementation ledger (authorized 2026-10-18)

The supervisor authorized the exact map, canonical ledger restoration and owning tests. Root retains architecture/shared documents. No builds, live sessions, provider calls, commits or shared Core mutations are authorized here.

- Fail-first: extended the existing caller-paid service case, including real registered `get-flow-run-detail` and persisted full detail. After correcting the test's service method signature, native exit **1**: paid `loop_verification` happened, but persisted `metadata.llmGate` was undefined. Expected calls1/pending0/itemized1/omitted0/cost0.001/tokens4+2=6. Log: Core `packages/fluxiq/node_modules/codex-creation-accounting-red.log` (PowerShell UTF-16). Product files were unchanged before this observed red.
- Initial implementation: one run-owned purse; lower-layer budget profile plus recovery compatibility alias; canonical ledger validates settled itemized receipts before restoration; checks and repairs share that ledger; projection preserves recovery metadata. Missing, malformed, pending or omitted history refuses paid continuation. Supervisor explicitly approved omitted-history refusal because historical omitted identities/provenance cannot be reconstructed safely without a new persistence contract.
- Initial focused run native exit **1**: 24 passed, 3 failed of27. Ledger11/purse6/projection2 and the original public-detail paid regression passed. Three existing repaired-run cases exposed that result verification still reserved the harness's whole default cost after repair spend; the shared purse correctly refused it. Fix is to supply the existing time-priced per-call profile cap without changing global or standing authority. Log: Core `packages/fluxiq/node_modules/codex-creation-accounting-first.log`.
- Additional review before follow-up edits: no-model/early recovery can replace prior gate before a purse opens. Preserve the historical canonical receipt in final projection and suppress zero invention on unknown reentry. Supervisor approved same-owner fix and owning regression. Waiting for the first typecheck reader to finish before edits.

These are intermediate results, not a completion claim. Installed Chrome/shared Core remain untouched; no paid acceptance has been rerun.

- After cost-cap and unknown-history projection corrections, the8 owning-file focused batch observed native exit **0**, **101/101**. Exact service persisted/public check,3-call repair-plus-check receipt and2-call same-run continuation passed; pending second dispatch records calls1/pending1. New-run/no-model replay remains truthful zero; continued unknown history has no invented total. Second Core package typecheck also observed native exit **0**. Log: `codex-creation-accounting-focused.log`.
- First audit native exit1 found new prefix/directory limits, existing cycles exposed by the new owner and packed test statements. Supervisor approved grouping only NEW owners under `llm/purse/` and `result-verification/accounting/`, plus leaf-import-only changes in existing `llm/run-call-record.ts`; original ledger path remains stable, no baseline waiver. Second audit native exit1 found only the new run-outcome→annotation deep import; corrected to owning barrel. No old module moves.
- Supervisor review found actual outer-part quota implications. `service/runtime-adaptation/refuted-result-port.ts` passes remaining outer budget to annotation but formerly charged its whole returned gate. The canonical ledger now owns a temporary additional-cost window, including new pending reservations and patch holds, and owns validated before/after receipt deltas. Annotation retains global limits on first/restored as well as later recovery, installs the additional window and closes it in `finally`. The outer repair charges only the validated new delta. Missing, malformed, pending, omitted or mismatched canonical parts stay unknown; `unreportedParts>0` blocks later parts. Explicit older scalar-only part receipts retain their old reader path. Exact four extra existing owners and their tests were authorized by supervisor.
- Queued-start regression added from actual public service path: `startRuntimeSession` persists a never-executed queued session. Its first run may initialize a purse only with no execution times/trace, no attempts/interventions/adaptations and no paid/check/recovery metadata. A queued label with unknown paid metadata still requires history and refuses dispatch. A completed same-run receipt restores normally.
- Restore/receipt-change parser now rejects extra fields at call, charged, reported, validation and snapshot levels; synthetic private-marker negatives contain no page data or real secret.
- Current frozen readers: owning10-file focused tests session44750, package typecheck73920 and audit27165. No edits while these readers remain active. Review follow-ups pending their exit: remove unintended local-window upper bound (global canonical ceiling governs); compare canonically normalized record field order so legitimate JSON key reordering remains resumable.

Final exact source ownership (Core relative to `packages/fluxiq/src/programs/automation-studio/`):

```text
runtime/llm/index.ts
runtime/llm/run-budget.ts
runtime/llm/run-call-record.ts
runtime/llm/tests/run-budget.test.ts
runtime/llm/purse/index.ts (new)
runtime/llm/purse/profile.ts (new)
runtime/llm/purse/purse.ts (new)
runtime/llm/purse/tests/purse.test.ts (new)
runtime/recovery/annotation/annotate.ts
runtime/recovery/annotation/in-run.ts
runtime/recovery/annotation/run-budget.ts
runtime/recovery/refuted-result/purse.ts
runtime/recovery/refuted-result/tests/purse.test.ts
runtime/result-verification/index.ts
runtime/result-verification/run-outcome.ts
runtime/result-verification/run-record.ts
runtime/result-verification/accounting/index.ts (new)
runtime/result-verification/accounting/accounting.ts (new)
runtime/result-verification/accounting/tests/accounting.test.ts (new)
runtime/result-verification/tests/run-outcome-repair.test.ts
runtime/result-verification/tests/run-outcome.test.ts
runtime/result-verification/tests/zero-provider-run.test.ts
runtime/service.ts
runtime/service/runtime-adaptation/refuted-result-port.ts
runtime/service/runtime-adaptation/tests/refuted-result-port.test.ts
runtime/service/runtime-session/in-run-repair.ts
runtime/service/runtime-session/tests/in-run-repair.test.ts
runtime/tests/service-adaptation/tests/caller-paid-result-check.test.ts
```

Downstream ownership remains this report only. Root owns current architecture wording, shared working plans, integration and final independent verification. Source is not accepted until final narrow checks and supervisor review; no library build authorized yet.

## Required conservative re-author charge handoff: bounded follow-up map

The ten-file focused run observed native exit1: **141 passed,2 failed of143**. Queued first execution, queued-with-paid-evidence refusal, settled continuation, the actual restored .06 global/.04 NEW in-run window, strict restore and pending controls all passed. Typecheck native exit0 and structure audit native exit0 (402 advisory warnings,1152 baselined). `codex-creation-accounting-final-focused.log` retains the exact failures: one old timeout fixture had genuinely unknown cost and the newly required outer fail-closed guard blocked its second build; one added test incorrectly expected an omitted property to be present with undefined. After all readers exited, the JSON-order normalization, local-window upper-bound removal and omitted-property assertion corrections were written. No subsequent reader has run yet.

**Do not release this unit yet.** The timeout behavior also exposes an actual production handoff gap; the supervisor correctly rejected hiding it through a known-cost test fiction. A temporary attempted argument to `flowBootstrapPhaseFailure` is not a valid fix: that factory deliberately drops optional accounting at provider_request. Keep the genuinely unknown timeout case as refusal, while production's known conservative creation-purse charge must enable an ordinary recoverable retry inside the remainder.

Concrete ownership/evidence:

- `flow-bootstrap/generation-failure/phase-failure.ts:39` drops optional provider-request accounting because generic `failureAccounting` may be a running aggregate belonging to earlier calls; preserving that rule is correct.
- `flow-bootstrap/generation-failure/generation-catch.ts` preserves a recognized diagnostic and adds only actual totalProviderCallCount. `runtime/service.ts:1750` supplies failureAccounting and `creation.purse.spentCalls()`; no trustworthy conservative cost reaches the outer repair on some timeout paths.
- `llm/build-purse/settlement-ledger.ts` already owns the answer: a settled no-usage call is charged its actual hold, releases are not charged, settlement is idempotent, calls/pending are explicit. `purse.spentUsd()` also includes carried prior creation spend and any external reported aggregate, so it must not be republished blindly as one generation's new charge.
- `service/flow-bootstrap-commands/creation-purse.ts` creates a fresh purse per generation. For repair it ignores creation store/interpretation and carries0; a Lab's outer Flow purse is separate. Nested allowances propagate each hold once into this owning root. Therefore the fresh creation root's own settlement ledger is a per-generation receipt, not earlier builds or a sum of child/parent copies.

Proposed minimal additional owners (not yet authorized or edited):

```text
runtime/llm/build-purse/types.ts
runtime/llm/build-purse/purse.ts
runtime/llm/build-purse/tests/purse.test.ts
runtime/llm/build-purse/tests/harness-hold.test.ts
runtime/service/runtime-adaptation/reauthor-build.ts
```

Existing approved owners used by this follow-up: `runtime/service.ts` and `runtime/service/runtime-adaptation/tests/refuted-result-port.test.ts`.

Proposed mechanism: a typed own-ledger charged snapshot `{calls, chargedCostUsd, pendingCalls, pendingCostUsd}` from the existing creation purse; an optional trailing **internal** per-invocation `onCharged` callback on the re-author generate dependency/private service generator; the existing service generation `finally` hands the owning snapshot to that invocation, or undefined if no purse was established. ReauthorBuild captures it separately for each attempt, charges the settled canonical amount once, and uses pending/absent/invalid receipts as unknown. Preserve actual older scalar-only known accounting fallback. Reported usage and the central diagnostic/accounting provenance remain unchanged; no token/cost report is invented. There is no new public protocol field, diagnostic schema/state change, provider/harness capability, separate purse or persisted restoration format.

Required proof: actual provider-free harness timeout under an explicitly priced creation hold, proving conservative charge survives while reported usage remains absent; then ordinary retry gets only the exact remainder. Prove predispatch release yields known zero only when owning receipt and invocation evidence agree; carried prior builds excluded, nested allowance charged once, pending prevents paid retry, and repeated observation cannot recharge a generation. The supervisor chooses this bounded next unit before implementation. Installed Chrome/profile/host/shared Core and all live lanes remain untouched.

Supervisor subsequently approved the exact internal handoff owners above. Implemented additional ownership:

```text
runtime/llm/build-purse/types.ts
runtime/llm/build-purse/purse.ts
runtime/llm/build-purse/tests/purse.test.ts
runtime/llm/build-purse/tests/harness-hold.test.ts
runtime/service/runtime-adaptation/reauthor-build.ts
```

`llm/index.ts` exports only the additional charged-receipt type through its owning barrel; existing service and refuted-result-port test owners thread and prove the internal callback. No central diagnostic field/parser/state, provider/harness request contract or public transport was changed. Every generation's callback is independent and delivered from the service generator's outer finally, including an explicit undefined when no owning purse was established. ReauthorBuild consumes a settled finite/nonnegative owning receipt once; differing repeat deliveries, pending/missing/invalid receipts, or a zero receipt contradicting attempted activity are unknown and refuse another paid part. Repeated identical observation does not charge twice. Legacy explicit scalar-only known reports remain a compatibility path for hosts not participating in the internal handoff.

Current frozen verification: four affected owning test files session11873 (`codex-creation-accounting-handoff.log`), package typecheck92473 and audit73301. The retry-positive test uses the actual harness/provider-error/Flow-Bootstrap projection under a priced fresh build purse; it leaves reported usage absent and delivers conservative canonical charge. The genuinely unaccounted timeout remains a separate honest refusal. No fixture cost is supplied to phaseFailure to hide the production gap.

Handoff batch observed native exit1:68 passed/1 failed of69. The actual mock timeout consumed a canonical .01 reservation, delivered its receipt, retried with only the remainder and held the second edit; reported usage remained absent. The test then hit a worker assertion mistake: CEILING/usd helpers were scoped inside another describe. This is a test-only correction after active package typecheck exits; no product failure was exposed in that batch. Ledger14, build-purse17 and harness-hold3 all passed. Latest audit native exit0. Two changed owning test files will be rerun after correcting the lexical reference and adding explicit nested-allowance/root receipt once-only coverage; no need to repeat the unchanged143 batch.

That package typecheck observed native exit2, identifying only the same three CEILING/usd lexical-reference errors. They were corrected after its exit. Source review then found a meaningful provenance edge: an existing unpriced hold may settle at0 without a cost report, which is different from a provider explicitly reporting a free call. Supervisor approved two additional exact owners:

```text
runtime/llm/build-purse/settlement-ledger.ts
runtime/llm/build-purse/tests/settlement-ledger.test.ts (new)
```

The canonical settlement now counts `unreportedZeroChargeCalls` only when no valid reported cost exists and the actual charge was an unpriced0. The internal charged receipt carries that bounded count. Its consumer permits genuinely reported free calls, permits positive conservative reservation charges, and holds unknown unpriced0 rather than turning it into spendable money. Predispatch release increments neither calls nor this count. Reported usage remains unchanged; no model-specific pricing rule or public schema was added.

Final freeze readers: four affected owning test files51113 (`codex-creation-accounting-handoff-final.log`, expected60 cases); Core package typecheck98011 (`codex-creation-accounting-type.log`); structure audit60974 (Core root `node_modules/codex-creation-accounting-audit.log`). No other source edits planned pending actual failures or supervisor review. Exact full ownership is the28-file map above plus the five approved handoff files and these two settlement owners:35 Core source/test/barrel files; downstream this report only.

## Final frozen handoff

All final reader processes have exited; source remains frozen for supervisor verification.

| Check | Observed native exit | Result/log |
| --- | --- | --- |
| Initial exact public-detail regression before product edits |1|Expected missing paid gate; `packages/fluxiq/node_modules/codex-creation-accounting-red.log` |
| Runtime ledger/purse/result/service focused batch before outer quota follow-up |0|101/101; `packages/fluxiq/node_modules/codex-creation-accounting-focused.log` |
| Ten-file owning integration batch |1|141/143; the two failures and their corrections are documented above; queued, restored-window, deadline and public service cases passed |
| Corrected ledger plus initial handoff batch |1|68/69; ledger14 passed, only scoped test assertion failed; corrected afterward |
| Final four handoff/provenance owning files |**0**|**60/60** (purse17, harness-hold4, refuted-result-port37, settlement2); `packages/fluxiq/node_modules/codex-creation-accounting-handoff-final.log` |
| Final Core package source/test typecheck |**0**|`packages/fluxiq/node_modules/codex-creation-accounting-type.log` (empty clean log) |
| Final Core structure audit |**0**|402 advisory warnings,1152 baselined,2 entries can be lowered; root `node_modules/codex-creation-accounting-audit.log`; no baseline modified |

Final exact commands (cache disabled for each process):

```powershell
# Working directory: paired t563/!FluxIQ/packages/fluxiq
$env:FLUXIQ_BUILD_CACHE_DIR='off'
pnpm.cmd exec vitest run src/programs/automation-studio/runtime/llm/build-purse/tests/settlement-ledger.test.ts src/programs/automation-studio/runtime/llm/build-purse/tests/purse.test.ts src/programs/automation-studio/runtime/llm/build-purse/tests/harness-hold.test.ts src/programs/automation-studio/runtime/service/runtime-adaptation/tests/refuted-result-port.test.ts --maxWorkers=2 --minWorkers=1
pnpm.cmd exec tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/codex-creation-accounting-check.tsbuildinfo
# Working directory: paired t563/!FluxIQ
node scripts/structure-audit.mjs
```

Observed behavior: a clean paid check persists and roundtrips through the registered public full-detail read as calls1/pending0/itemized1/omitted0/cost0.001/usage4+2=6. Runtime repair+check counts3/cost0.004 once. Settled same-run continuation counts2/cost0.002; a legitimately unused queued session can make its first paid check. Unknown/malformed/pending/omitted historical paid accounting remains intact and refuses new paid dispatch. No-model new runs keep truthful zero; continued unknown history never acquires an invented zero receipt. Pending outer verification retains calls1/pending1, and late settlement does not write over the ended run.

Temporary part windows retain global limits and count new pending/patch holds. Restored .06 under global .10 can use a separate .04 NEW repair grant, without charging history twice. Outer repair charging uses only validated cumulative receipt deltas; unknown parts refuse subsequent paid parts. Re-author generation keeps its existing separate build accounting. Its private per-attempt creation-purse callback now preserves known conservative charges across timeout, so the retry remains possible inside the exact remainder while reported usage stays absent. Actual mock harness paths prove priced-timeout retry, provider-reported free0 retry, unknown unpriced0 refusal and a proven unsent zero release. The owning root counts a nested allowance once; carried/external/parent aggregates are excluded.

Limits: this is a checked source unit awaiting independent supervisor acceptance. Runtime llmGate does not claim to itemize re-author build calls; those remain separate existing build receipts/outer charges. Omitted historical identities cannot be reconstructed, so paid continuation of an omitted receipt remains deliberately fail-closed. No library build, browser/UI session, installed-extension rerun, paid provider run, commit, merge or push was performed. Shared Core, installed Chrome/profile/host/lease and other live lanes are unchanged. The original installed judged run's unknown accounting has not been retroactively repaired or claimed verified.
