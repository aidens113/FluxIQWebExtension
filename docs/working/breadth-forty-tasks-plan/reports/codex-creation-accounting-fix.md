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

## Isolated artifact preparation and installed-proof proposal (2026-10-18)

Supervisor independently observed188/188 owning cases, then63/63 post-current-dev/person integration cases and package tsc0. Supervisor committed Core source/baseline cb704f47 (architecture79e55db9) and downstream report ce53486f. Baseline regeneration lowered2/removed2; no new waivers. Those heads stayed frozen throughout this preparation; later main documentation-only commits were deliberately not merged.

Authorized isolated Core preparation ACTUALLY exited0:

```powershell
# C:/Users/osrs_/FluxStuff/fxwork/t563/!FluxIQ
$env:FLUXIQ_BUILD_CACHE_DIR='off'
node scripts/build-cache/cli.mjs contracts:build fluxiq:build client-gateway-websocket:build
```

Log: Core `node_modules/codex-creation-accounting-libraries.log`. Contracts reused1460ms; fluxiq rebuilt90905ms; gateway reused366ms. Core HEAD remained cb704f47ac3242871e3f2bdd2fc4146b9aca4609 and tracked source clean. No Web/shared-Core/whole-workspace build or browser/provider operation occurred.

### Approved collector hardening, frozen for supervisor review

Only scratch `codex-installed-proof-scripts/collect.mjs` changed (the historical scratchpad root remains the one identified in the prior installed-proof reports). SHA256 c68698c558e6210aef085098cef4f2c432ab3b5457d42d382afcaa0c2fec80ea. Other launcher/normal UI/native helpers are untouched.

Existing public `fluxiq/automation-studio` re-exports `AutomationStudioLlmRunBudgetLedger`. Its import-only conditional export cannot be resolved with CommonJS createRequire.resolve; that probe truthfully returned ERR_PACKAGE_PATH_NOT_EXPORTED. The approved loader instead reads the selected linked package's public manifest, follows ONLY exports['./automation-studio'].import, and checks realpaths before importing. It requires the exact isolated t563 downstream, its nonredirected own Core sibling, a linked package matching that Core's packages/fluxiq, and a public export target contained inside that package. No private-path fallback or new shipped API. Actual newly compiled public entry import succeeded and exposed the canonical class.

Paid creation acceptance additionally requires positive calls AND positive charged cost, complete itemization, omissions0, pending0, public count/cost consistency and canonical Ledger.restore acceptance. If full detail additionally publishes itemized calls, that public copy must restore too and equal the canonical metadata records. Only structural booleans/counts/costs are returned; parser failures and records stay private. Ordinary zero-call replay and unknown-accounting refusal remain unchanged. Receipt validation does not claim that separate re-author build calls belong to the run ledger.

Commands, with cache off, from t563 downstream:

```powershell
node <approved-scratch>/codex-installed-proof-scripts/collect.mjs --self-test --repo C:/Users/osrs_/FluxStuff/fxwork/t563/!FluxIQWebExtension
node --check <approved-scratch>/codex-installed-proof-scripts/collect.mjs
```

Observed native0 self-test: telemetry19, owning-oracle13, canonical14. Canonical controls include one real Ledger.reserve/complete-generated positive receipt; wrong artifact root; missing accounting; pending; omissions; public count/cost mismatch; missing request identity; inconsistent charge; different public request; extra private field; missing records; creation-zero refusal; unchanged zero replay acceptance. Private sentinel never appears in projected output. No real run was recollected or accepted with this change.

### Proposed narrow preparation commands (NOT executed; awaiting supervisor release)

Use process cache off for every command, remain on frozen t563 heads, inspect actual native exit before dependent steps. In t563 downstream:

```powershell
$env:FLUXIQ_BUILD_CACHE_DIR='off'
node scripts/check/core-build.mjs
pnpm.cmd --filter @fluxiq-web-extension/domain check
pnpm.cmd --filter @fluxiq-web-extension/extension check
node scripts/build-cache/cli.mjs domain:build
node scripts/build-cache/cli.mjs domain:host-build
node scripts/build-cache/cli.mjs extension:build
node scripts/build-cache/cli.mjs test-contracts:build
node scripts/build-cache/cli.mjs test-evidence:build
node scripts/build-cache/cli.mjs scenario-lab:build
node scripts/build-cache/cli.mjs test-runner:build
```

Each downstream cache CLI invocation accepts ONE registered step; its freshness check reuses current artifacts. The final four supporting steps provide the exact frozen task/oracle/fixture and collector's owning comparison modules, without a live Lab launch. Domain host externalizes Core, so the selected library artifacts must stay frozen/current for the entire host lifetime.

Production Web remains a concrete prerequisite, with SEPARATE supervisor release required. In OWN t563 Core only:

```powershell
$env:FLUXIQ_BUILD_CACHE_DIR='off'
node scripts/build-cache/cli.mjs web:build
```

The existing serve helper requires that selected Core's apps/web/.next/BUILD_ID and starts production Next from it. The old shared e58 Web must not be substituted for the fixed t563 runtime. No whole build is proposed.

After accepted narrow prep, package using existing owning script:

```powershell
node apps/extension/scripts/release/package-extension.mjs --out <NEW-dedicated-scratch-package-dir>
Expand-Archive -LiteralPath <NEW-package-dir>/fluxiq-web-extension-chrome-0.1.0.zip -DestinationPath <NEW-unpacked-dir>
```

Before packaging, resolve both NEW paths under the approved scratchpad and verify neither exists: the package owner recursively clears its output directory. Do not use --release or historical output paths. Record package verification, frozen pair, archive SHA256 and unpacked identity. The verified Chrome target supports Edge too; both installed browsers still require their own normal Load-unpacked action/profile.

### Fresh genuine installed Chrome and Edge procedure

Supervisor must designate available live capacity and explicitly release host/UI/provider operations. No launch has occurred. Proposed independent immediate-child proof roots: codex-installed-chrome-accounting-20261018b and codex-installed-edge-accounting-20261018b. Candidate Chrome ports3710/4710/3720/9360 and Edge3711/4711/3721/9361 must first be checked unbound; collision means choose a fresh set, never stop another process. New private config selects OWN t563 repo/Core, company-website, ceiling0.25 and the corresponding installed browser. No old config/private state copying.

1. Start existing reviewed serve.mjs once per new root using hidden process/private structural logs. It acquires the existing Core build lease for owned-host lifetime. Do not start until all selected artifacts are prepared; never rebuild while either new host holds its lease. Keep old Chrome155/profile/launcher6404/shared e58 lease untouched. Record actual installed browser version and ownership receipt.
2. Use normal installed-browser Extensions UI, Developer mode and one Load unpacked click; native exact-owned dialog handling selects only NEW verified unpacked package. Diagnose ambiguity rather than repeating Load. Open actual toolbar extension through the reviewed unique owned native controls. No extension-load launch flags or API-created Flow.
3. Through normal fresh-owner login/Finish setup, provider profile, project and pairing UI, configure isolated state. Use source-backed fresh bootstrap procedure only; credentials/new generated replacement and authorized provider credential stay in private files, never argv/output. No external messages or personal accounts.
4. Enter the EXACT current catalog company-website-apprentices instruction in actual extension chat, without expected rows or scenario-shaped product guidance. Preserve creation/trial records separately. This task has four ordered rows and three named fields (12 field values); owning schema/order/value/integrity/final-state oracle must all pass.
5. The panel's ordinary repair-check policy does not by itself establish judged creation. Normal Open in FluxIQ, then owner Advanced -> Explore and adapt with the actually saved provider profile and original instruction bound, runs ONE judged whole. Require succeeded + confirmed + exact positive oracle + finalized positive fully itemized canonical run receipt; report actual count/cost, pending0/omitted0 and public agreement. Record Flow/subgraph hashes before/after; disclose any repair. Separate re-author receipts are not silently folded into run call claims.
6. Restore starting page through ordinary site controls as needed. Run a SEPARATE normal panel Advanced No LLM whole replay. Require exact positive oracle/final state plus finalized calls0, cost0, pending0, itemized0, omissions0 and no non-result-check harness interventions. An unverified replay can establish goal/provider-free proof, never product-judge pass. Record its distinct run ID and Flow hashes.
7. Repeat actual create/judged/replay in the other installed browser if claiming acceptance for BOTH Chrome and Edge. Reusing a Chrome-authored Flow in Edge would prove only Edge replay. On failure preserve profile/evidence, diagnose before a changed-source paid rerun, and never force a verdict. Leave owned hosts running until supervisor cleanup release.

Known boundaries: current library preparation is accepted, while new Web/downstream packaging and both fresh installed proofs remain unexecuted. The old b393bc01 judged creation remains accounting-unknown/proof-false; the old d1fef089 zero replay remains its separate positive provider-free goal proof. No retroactive acceptance or guessed calls/spend. Existing helpers need no further change beyond the frozen collector delta unless fresh normal UI exposes a concrete bounded missing capability.

### Released preparation completed; fresh package ready (2026-10-18)

Supervisor released the proposed narrow isolated preparation and own Core Web artifact. Every actual native exit below was0. Source and helpers stayed frozen throughout; Core cb704f47 clean, downstream ce53486f with only this report dirty.

| Released gate/build | Result |
| --- | --- |
| Core build currentness |0|
| Domain source/test check |0; registered check51764ms|
| Extension source/test check |0; registered check63592ms|
| domain:build |0;23804ms|
| domain:host-build |0|
| extension:build |0;37510ms; Chrome/Firefox/e2e target verification passed|
| test-contracts:build |0|
| test-evidence:build |0|
| scenario-lab:build |0;15601ms|
| test-runner:build |0;30134ms|
| OWN Core web:build |0;239522ms; production compile/type/static generation/traces completed|
| Fresh owning package script |0|
| Fresh ZIP unpack and owning target verification |0;14files/errors0/warnings0; exact ZIP/unpacked bytes equal|
| Collector against rebuilt owner modules |0;19telemetry+13oracle+14canonical=46checks|

Logs: downstream node_modules/codex-installed-accounting-{core-current,domain-check,extension-check,domain-build,domain-host-build,extension-build,test-contracts-build,test-evidence-build,scenario-lab-build,test-runner-build,package}.log; Core node_modules/codex-installed-accounting-web-build.log. No raw runtime logs/data or secrets were read.

New artifact directories are immediate children of the approved historical scratchpad and were verified nonexistent before creation. Packaging used the owning script and unpacking used Expand-Archive, without an overwrite or cleanup of any historical path:

- codex-installed-accounting-packages-20261018b
- codex-installed-accounting-unpacked-20261018b

Chrome/Edge ZIP: fluxiq-web-extension-chrome-0.1.0.zip; SHA256 **5e00078bc61f0d9f71cebe04c4b21d4580afdf5420b374015b3ecb6d756f58e7**. The owning package script also verified its Firefox ZIP, which is not an installed Firefox proof. ZIP readback equals all14 unpacked files; owning verifyExtensionTarget errors0/warnings0. Both installed browser binaries exist: Chrome155.0.8059.82 and Edge155.0.4283.62 (file version inspection only).

Two NEW private configuration JSON files were created with exclusive CreateNew, without credentials or runtime state, in the existing approved codex-installed-proof-scripts scratch directory:

- config-chrome-accounting-20261018b.json
- config-edge-accounting-20261018b.json

Each selects t563 downstream/OWN t563 Core, company-website and ceiling0.25. Chrome selects immediate-child proof root codex-installed-chrome-accounting-20261018b and ports web3710/gateway4710/fixture3720/CDP9360. Edge selects codex-installed-edge-accounting-20261018b and ports3711/4711/3721/9361. Both proof roots remain NONEXISTENT; all eight ports currently unbound. These are prepared config files, not launches. Config paths and proof roots must be rechecked immediately before launch.

Exact proposed hidden start command, AFTER supervisor release, from the approved scratch helper directory (shown with an explicitly set absolute task variable; repeat for Edge only upon its release):

```powershell
$installedHelperRoot='C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/469d0f8b-69b3-419c-8ee1-425911c239a2/scratchpad/codex-installed-proof-scripts'
Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList @((Join-Path $installedHelperRoot 'serve.mjs'),'start','--config',(Join-Path $installedHelperRoot 'config-chrome-accounting-20261018b.json')) -WorkingDirectory $installedHelperRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $installedHelperRoot 'chrome-accounting-launcher-20261018b.log') -RedirectStandardError (Join-Path $installedHelperRoot 'chrome-accounting-launcher-20261018b.err') -PassThru
```

For Edge, substitute edge for chrome in the config and launcher output filenames. The launcher creates its own new profile/root, ownership receipt and existing owner API Core lease; it never loads an extension by launch flags. Normal native Load unpacked must select the NEW unpacked directory above. Host/fixture/browser ownership must be checked structurally from the new receipt after launch; no PID exists yet. No launch command has been executed and no provider call, UI action or old profile change occurred. Old launcher6404/profile/shared Core e58 are preserved. Awaiting supervisor collector/package review and explicit next host/UI/provider release; no further build is needed before that release on this frozen pair.

### Fresh Chrome live bootstrap: diagnosed extension-storage path failure

Supervisor released Chrome host/UI/providers (Edge remained held). Rechecked absent proof root and unbound ports; launched reviewed helper ONCE, actual launcher26924/web21112/fixture23388/browser8224. Targets: web66EB722B40EB690273DF4D0DC0CA2EB0; fixture1E990AC216A0D6B4D22DD623B7A93DF9; normal Extensions tab F83B9332530B51B767DBF5A1BF75ECE6; actual toolbar-opened panel C98AA49697464A30B09567508F4657A6. Original launch did not retain its Extensions tab, so a normal owned Extensions tab was opened; no extension injection/load flag.

Normal Developer mode, ONE Load-unpacked click, strict native unique owned picker and approved directory selection succeeded. Chrome showed exactly one enabled0.1.0 card, no manifest errors. Toolbar exact public manifest name FluxIQ Web Automation Client uniquely matched and opened the panel. Fresh source-backed empty-user owner login and Finish setup succeeded; replacement credential stayed private. Normal UI saved the authorized DeepSeek key and created the isolated project. These setup operations called no LLM.

Panel address settings were entered and Save pressed, but no successful save receipt is claimed: it subsequently showed closed extension_not_answering, no usable Connect/approval controls and no chat readiness. Did NOT reload or repeatedly press Connect. Runtime-error count2, manifest-error count0, serviceworker target1. Owning background stack17741:1 points to completion of the onInstalled asynchronous readSettings/writeSettings/readOrCreateClientId initializer. Existing GET_STATUS, separately authorized readonly with timeout, actually returned ok:false/error (not timeout and not runtime.lastError); no settings/status response was manufactured.

Private error mapping found no owning source literal and isolated the closed lower-level category: IO error, redacted LOCK path, file-not-found; **ChromeMethodBFE15::LockFile::4**. Only enum/numeric receipts were printed. Privately selected installed-card ID gave actual extension-storage layout lengths: profile185; Local Extension Settings parent218 (EXISTS); selected extension DB directory251 (ABSENT); LOCK256; ordinary DB log262. The profile path chosen for this testing bootstrap exceeds legacy directory/file bounds; Chrome cannot initialize extension-local persistence, so this is an owned launcher/config path failure before connection/pairing, not provider/product-run acceptance or machine-load blame. Short-path comparative confirmation remains pending.

Proposed unchanged helper with NEW compatible immediate-child root codex-installed-chrome-c3: profile167, selected DB233, LOCK238, ordinary log244. Existing helper regex requires codex-installed-(chrome|edge)-suffix; a shortened root lacking chrome would refuse. Proposed NEW config-chrome-c3.json selects same frozen t563 artifacts/scenario/ceiling/ports after exact failed-launcher stop. Preserve failed root/profile/logs and owner/project; no state migration or overwrite. Awaiting supervisor exact owned-stop/restart release. Old launcher6404/shared e58 remain untouched; no extension chat build, judged run or replay/paid provider call has been dispatched in this failed bootstrap.

### Short-root comparative bootstrap passed; original Chrome proof resumed

Supervisor released exact owned stop and one shorter fresh launch. Existing serve stop actually returned stopped/native0 for failed launcher26924; ownership receipt verified stopped and failedprofile preserved. All four ports were free before exclusive new config-chrome-c3.json and absent codex-installed-chrome-c3 root. ONE unchanged-helper launch:2636; owned web12332/fixture27932/browser15348. No build/helper/source changed; failed b-root and old6404/e58 preserved.

Same fresh verified package installed normally with Developer mode, ONE Load click, unique owned native picker, and exact public-name toolbar entry. New targets: web930F9905E11B04722638EFFEAEA98E7A; fixtureCC72715370297778A57193C7198A18DB; Extensions117196F31D70C19F2F0E5C6966E1827F; panelC607E9B505F50A6D80BB983455F1AA4D. Readonly GET_STATUS now actually succeeds (disconnected/pairedfalse initially). Actual selected own extension DB CREATED: profile167, DBdirectory233, longest observed DBfile249; LOCK, LOG and numbered log all exist, every observed DBfile path below260. This comparative change confirms the original longer test-profile path caused bootstrap failure. Other unrelated Chrome-provided cards were ignored by exact own package name/version identity, not modified.

Fresh owner normal login/Finish setup, saved DeepSeek key, project creation and panel address Save succeeded. GET_STATUS confirms own gateway/web equality, then one Connect. Approval reference matched privately between actual panel and unique web modal before normal Confirm pairing. Status connected/pairedtrue/project3a632950-4de1-4a85-b9af-d344a90a1c4b equals normal created project's Studio URL identity. No old profile/credentials/runtime state was copied.

Fixture brought foreground; entered EXACT current catalog instruction from private input file and clicked actual conversationSendButton ONCE. It is now building under own project: build-9b7e2005-a935-4a1d-97b6-d1b4f0ce2def; draft Flow flow.3b82bc17-ad54-4d2c-8166-ba6fb80f2bdd. Existing readonly activityRead shows working, phase running, sequence114/history88; no terminal/promoted/judge/accounting/replay acceptance yet. No second instruction/rerun. Only closed phases/identities/counts were projected, no model/page text.

Per supervisor request created NEW config-edge-e3.json exclusively in the approved helper directory, with absent compatible immediate-child root codex-installed-edge-e3, same approved Edge ports/scenario/ceiling/frozen pair. Computed Edge profile165/DB231/normal manifest247. Long old Edge config is superseded before any launch. Edge HOST/UI/PROVIDERS remain held and unstarted.

## Fresh genuine installed Chrome acceptance: strict paid whole plus separate zero replay

Both actual collector runs exited0; supervisor independent acceptance remains its own verification step. Browser Chrome155.0.8059.82, genuine normally installed verified0.1.0 package SHA5e00078bc61f0d9f71cebe04c4b21d4580afdf5420b374015b3ecb6d756f58e7, own frozen t563 Corecb704f47/downstreamce53486f; source/helpers/builds never changed under the host lease. Company-website task company-website-apprentices was created from ONE real extension-chat instruction. Original source-backed catalog instruction remains exactly bound in the saved owning instruction set/Flow metadata (private equality only).

The real chat build9b7e2005-a935-4a1d-97b6-d1b4f0ce2def ended done/sequence141. Normal Automations showed root and generated graph separately; selected the UNIQUE root row matching its public owning Flow identity/name privately, never first-match. Normal Open in FluxIQ opened target99A31C6D1F6CE34695272A3F1DD32D0F. Normal Add tab -> Run and test -> select its tab -> Advanced -> Explore and adapt; exact original Flow URL, Ready1, actual Run enabled, owner mode selected/aria true, no readiness alerts. No API-created/modified Flow, no forced verdict, no supplied expected rows/model guidance.

Before each whole run used the fixture's own Home navigation to return the read-only site to its starting page. No fixture-reset API, browser storage changes, repeated lasting operation or test-only workaround. UI run requests were the ordinary supported controls. The extension's compact strip has ordinary Run without an explicit intervention-mode picker; explicit Explore and adapt and No LLM intervention were selected in FluxIQ's normal signed-in WEB panel inside this installed Chrome, executing through its paired real extension gateway. This surface distinction is intentional and recorded, not claimed as a nonexistent extension-only picker.

| Proof | Actual run ID | Observed terminal receipt |
| --- | --- | --- |
| Explicit owner judged whole |18311e53-cf79-4f65-bf81-69c5cdd29c68|succeeded/confirmed; proofPassedtrue; canonicalReceiptValidatedtrue; paidCreationAccountingReadytrue; calls1/itemized1/pending0/omitted0; charged estimated cost$0.002081724; public count/pending/cost agreementtrue; harness0|
| Separate actual normal No LLM replay |eb6df4a5-b35e-4369-933b-028636b9dcaa|succeeded/unverified; goal_and_provider_free_replay proofPassedtrue; explicitcalls0/cost0/pending0/itemized0/omitted0/harness0; all public agreementtrue; providerFreetrue|

EACH run has one result dataset, four actual ordered records and three named fields (12 field values), one dataset page, owning oracletrue, exact ordered rowstrue, integritytrue, finalStatePassedtrue and goalPassedtrue. No raw rows/schema values/pairing keys or messages were printed. Persisted verdict and finalized accounting were observed before acceptance, never inferred from status/compilation/UI. The positive paid gate uses the newly compiled public canonical Ledger.restore, including strict provenance/arithmetic validation, full itemization and optional public-call consistency.

The $0.002081724 is the judged WHOLE RUN's own canonical charged estimated total. Earlier authoring/generation calls retain their separate existing build ledgers; this number is not mislabeled as cumulative chat/build spend or a provider invoice. No aggregate build cost is guessed. Omitted/pending/unknown histories remain fail-closed; the old b393bc01 creation stays accounting-unknown and is not retroactively repaired.

Private STRUCTURAL receipts (no raw API payload/data) in scratch/codex-installed-chrome-c3:

- creation-receipt.json: accepted public collector read of18311e53; initial acceptance was observed before replay; later readonly recollection persisted the same accepted receipt with no provider dispatch.
- replay-receipt.json: actual separate replay acceptance, native0.
- before-judged-artifact-hashes.json / after-judged-artifact-hashes.json / after-replay-artifact-hashes.json: full canonical artifact and definition hashes; EXACTLY unchanged at all three boundaries, original instruction still bound. Definition hashes omit only createdAt/updatedAt; full hashes include them. No repair or saved artifact change occurred.

Full canonical artifacts, identical before/after judged whole/after zero replay:

| Artifact | SHA256 | Definition SHA256 |
| --- | --- | --- |
| Root flow.3b82bc17-ad54-4d2c-8166-ba6fb80f2bdd |0b56cd07c831670890044fac4f28441e3383cd17bf5ddfd3ba361caf66452be8|e25ef66061e6bb50da51c88fd7f83c2b6891e50b416a50358b114f83bcf7e085|
| Generated graph ending .bootstrap.b06e1cab3844508d.list_apprentices.graph (9nodes/11edges) |054a5be74d33a0fe77ce5db4c096139452f9488047a630af5d74536e6b84debc|0e4340fc924f7f7d108dfb9065503a66d872458e3cd0274fffe7b15df99c29ba|

Exact collector scope for supervisor independent verification: `--repo C:/Users/osrs_/FluxStuff/fxwork/t563/!FluxIQWebExtension --port 9360 --web-origin http://127.0.0.1:3710 --fixture-origin http://127.0.0.1:3720 --web-target 99A31C6D1F6CE34695272A3F1DD32D0F --fixture-target CC72715370297778A57193C7198A18DB --project 3a632950-4de1-4a85-b9af-d344a90a1c4b --flow flow.3b82bc17-ad54-4d2c-8166-ba6fb80f2bdd --task company-website-apprentices`. Use `--run 18311e53-cf79-4f65-bf81-69c5cdd29c68 --mode creation`, or `--run eb6df4a5-b35e-4369-933b-028636b9dcaa --mode replay`; `--wait-ms 0` is sufficient now. Existing reviewed collect.mjs is unchanged at c68698c558e6210aef085098cef4f2c432ab3b5457d42d382afcaa0c2fec80ea.

Current retained ownership: NEW Chrome launcher2636/Web12332/fixture27932/browser15348; root codex-installed-chrome-c3 and its existing lifetime Core lease remain running until supervisor exact cleanup release. No Edge host/UI/provider has started; short config-edge-e3.json is ready, root absent. A second helper on the SAME Core must not rebuild or disturb the held Core locks. Failed long-profile evidence, old Chrome6404/profile/shared e58 and all files are preserved. No worker commits, merges, pushes or shared-document/source edits.


### Independent final hash command and prepared Edge scope

Supervisor independently accepted BOTH live collector receipts (native0, strict paid creation and separate zero replay). Final post-replay hashes above also passed. This exact readonly command recomputes live public Flow artifacts and compares both captured boundaries; it prints structural identities/hashes/equalities only, never raw Flow content or instruction text. Run from t563 downstream; no source/helper file is written:

```powershell
$env:FLUXIQ_BUILD_CACHE_DIR='off'
$verify = @'

import fs from'node:fs/promises';import path from'node:path';import{createHash}from'node:crypto';
import{connectSurface}from'file:///C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/469d0f8b-69b3-419c-8ee1-425911c239a2/scratchpad/codex-installed-proof-scripts/controls.mjs';
const scope={projectId:'3a632950-4de1-4a85-b9af-d344a90a1c4b',flowId:'flow.3b82bc17-ad54-4d2c-8166-ba6fb80f2bdd'};
const w=await connectSurface({port:9360,surface:'web',origin:'http://127.0.0.1:3710',target:'930F9905E11B04722638EFFEAEA98E7A'});
let flows,instructions;
try {
 const result=await w.evaluate(async scope=>{
  if(location.origin!=='http://127.0.0.1:3710')throw Error('scope');
  const read=async(endpoint,payload)=>{if(!['list-flows','get-flow-instruction-set'].includes(endpoint))throw Error('read_only');const r=await fetch('/api/programs/automation-studio/'+endpoint+'?domainId=web-automation',{method:'POST',credentials:'same-origin',redirect:'error',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)});const e=await r.json();if(!r.ok||e?.ok!==true)throw Error('read_refused');return e.payload};
  const a=await read('list-flows',{projectId:scope.projectId});if(!Array.isArray(a.flows))throw Error('flow_list');const b=await read('get-flow-instruction-set',scope);return{flows:a.flows.map(entry=>entry.flow),instructions:b.instructions};
 },scope);flows=result.flows;instructions=result.instructions;
}finally{w.close();}
if(!Array.isArray(flows)||!flows.length||flows.some(f=>f.projectId!==scope.projectId||!Array.isArray(f.nodes)||!Array.isArray(f.edges)))throw Error('flow_scope');
const canonical=v=>Array.isArray(v)?v.map(canonical):v!==null&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const hash=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const hashes=flows.map(f=>({flowId:f.flowId,sha256:hash(f),definitionSha256:hash(Object.fromEntries(Object.entries(f).filter(([k])=>!['createdAt','updatedAt'].includes(k)))),nodes:f.nodes.length,edges:f.edges.length})).sort((a,b)=>a.flowId.localeCompare(b.flowId));
const root='C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/469d0f8b-69b3-419c-8ee1-425911c239a2/scratchpad/codex-installed-chrome-c3';
const original=await fs.readFile(path.join(root,'inputs/task-instruction.txt'),'utf8');const exact=v=>typeof v==='string'?v.trim()===original.trim():Array.isArray(v)?v.some(exact):v!==null&&typeof v==='object'?Object.values(v).some(exact):false;
const originalInstructionBound=exact(instructions)||exact(flows.find(f=>f.flowId===scope.flowId));

const before=JSON.parse(await fs.readFile(path.join(root,'before-judged-artifact-hashes.json'),'utf8'));
const after=JSON.parse(await fs.readFile(path.join(root,'after-replay-artifact-hashes.json'),'utf8'));
const beforeEqualsLive=JSON.stringify(before.hashes)===JSON.stringify(hashes);
const replayEqualsLive=JSON.stringify(after.hashes)===JSON.stringify(hashes);
console.log(JSON.stringify({originalInstructionBound,beforeEqualsLive,replayEqualsLive,hashes}));
if(!originalInstructionBound||!beforeEqualsLive||!replayEqualsLive)process.exitCode=1;

'@
$verify | node --input-type=module
```

Prepared Edge config is the NEW existing scratch helper file config-edge-e3.json. Exact own repo C:/Users/osrs_/FluxStuff/fxwork/t563/!FluxIQWebExtension, Core C:/Users/osrs_/FluxStuff/fxwork/t563/!FluxIQ, browser edge, scenario company-website, ceiling0.25, ports web3711/gateway4711/fixture3721/CDP9361, absent immediate-child scratch root codex-installed-edge-e3. It selects the same existing verified unpacked package through later normal native Load UI, not a config/load-extension flag. Profile165/DB231/manifest247. Chrome host2636 still holds the Core's exclusive owner step locks; Edge's unchanged launcher must wait until supervisor has verified Chrome hashes and released its exact owned stop, then verify ports/root again. No Edge host/UI/providers have started. Only report and fresh private config/receipt artifacts changed; tracked Core source clean, frozen heads unchanged.

### Released Edge e3 ownership and native-navigation diagnosis

After root independently verified the Chrome hashes, the exact own Chrome launcher2636 was stopped through the unchanged serve owner protocol, native0. Its profile/evidence were preserved; old launcher6404/sharedCoree58 remained running and untouched. Fresh e3 root and four ports were rechecked before one hidden unchanged-helper launch. Edge launcher35316 owns web36408, fixture42084 and browser26004. Parent independently confirmed actual Edge155.0.4283.62 and ownership. Ports3711/4711/3721/9361; web target B917C94AFA9B5A9A476920E26D460855, fixture C111E28C9FBC64D827E179BE10EEDB1F, normal Extensions target A73C7F791CB92F19E3B2B2D9C4386826. Source, package and helpers remain frozen; the host holds the existing Core build lease.

Normal Extensions navigation currently needs diagnosis before installation. This Edge uses nested Fluent shadow controls. Both exact Developer mode labels and their DEVELOPER-MODE-SWITCH owners are geometrically hidden. Exact scoped native Developer mode probes returned zero. A different unique geometrically visible Fluent switch was not toggled: root-authorized partial AX read (fetchRelatives false) returned role switch, ignored false, checked false, exact Developer mode label equality false and exact Allow other stores equality false, native0. The four visible Fluent buttons and one visible link did not exactly match the bounded normal-navigation captions checked; viewport921x928 has no horizontal overflow. No hidden switch mutation, duplicate Load click, installation or Edge provider call occurred. Proposed next seam is private read-only classification of only these normal browser-owned navigation controls, with closed categories and no raw captions output.

Navigation diagnosis resolved through the unique visible HAMBURGER-BUTTON-owned Extensions menu, normal selector click after label-mode safely refused its unsupported Fluent tag. That menu exposed one visible dev-switch with exact Developer mode label; normal toggle checked true. Closing the unique native Extensions menu exposed a unique visible enabled native Load unpacked button. One Load click produced exactly one real owned folder dialog/input1152/confirm1; normal folder action selected the frozen approved package, native0. No hidden toggle or install flag was used.

The actual installed panel target is 899E0BC645222C6F54FFEAB89C31222E. Edge's native Open-package caption differs from Chrome; private exact public-caption discovery found one owned visible enabled semantic Open control, then the unchanged native helper clicked it. GET_STATUS received/ok true, version0.1.0. Actual profile/Default extension DB exists length231/maxfile247, LOCK/LOG/numberedlog all present. An initial metadata check used the wrong browser-profile directory name and returned absent; corrected to the unchanged launcher's source-owned profile directory before this verified receipt.

Fresh normal sign-in/Finish setup, saved DeepSeek profile, project creation and reference-matched normal pairing completed. Project3c4f425c-f703-43ed-bf5e-d5b26386acd4; pairing web target4CCEA4E4B1D877D50724688AC20AB2FC. GET_STATUS connected/paired/projectMatches true, gateway/web match own ports, input empty before entry. One exact catalog instruction was typed and sent through the real panel after bringing the own fixture forward. Build79416657-6905-41d7-b36e-21be03168be1, Flow flow.c1ce6c21-7d4e-4710-8bd5-5013fe586725; first owning activity receipt thinking/working true. This is progress, not a terminal success or accounting acceptance.

### Root independent acceptance and released Edge cleanup

Root independently reran both actual Edge collectors: native0, all strict proof gates true, confirmed paid whole and separate unverified all-zero goal replay. Root also ran the exact public live hash command below: native0, original instruction binding and all three before/judged/replay-to-live comparisons true. Chrome had already been independently accepted; the original t721 paid-unknown proof remains held.

Under the written cleanup brief, first verified ownership launcher35316/not stopped, then invoked unchanged serve.mjs stop for only codex-installed-edge-e3. Actual native0 returned stopped. Subsequent native0 verification: ownership stopped true/expected launcher true, own launcher35316/web36408/fixture42084/browser26004 alive count0, remaining direct owned descendants count0. The selected own Core resolver's contracts:build, fluxiq:build and client-gateway-websocket:build stamp locks are all absent. Profile and all five structural receipt/hash files preserved. Old launcher6404 remains running; old sharedCoree58 and historical profiles/evidence untouched. No source, HEAD or build movement occurred. Own report frozen pending root's refresh/integration-gate handoff.

### Edge final judged and zero-replay receipts

The single extension-chat build completed done, sequence86/history71. Normal Automations root selection and Open in FluxIQ opened owned web target7193293397DA8B9465186E59AB0AA7CD. Through the actual browser's web UI, Run and test was added and activated, Advanced opened, Explore and adapt selected. Before launch mode-selected true/ready1/readiness-alerts0/Run-enabled true were verified. The compact installed side panel has no explicit intervention selector; the owner web Run and test UI provides it, and actual browser execution uses the installed extension gateway. No API-created Flow or API-started run was used.

After the fixture's ordinary Home control, one judged whole run **3235be49-9e2b-4258-bd72-c999a92ff1c2** succeeded with persisted verdict **confirmed**. Frozen collector native0: proofPassed true, exact ordered4rows/12values, owning oracle/integrity/final state true, paid canonical receipt validated true, public count/cost consistency true. ProviderCalls1/itemized1/pending0/omitted0/harness0; estimatedCostUsd **0.002078274**. This is the run-owned ledger cost; authoring build spend and provider invoice totals are separate and were not guessed.

A separate normal explicit **No LLM intervention** selection was verified selected/Run enabled, followed by own fixture Home and one normal Run click. Replay **8d20ce19-6cba-439c-b1c5-827677b8522a** succeeded with verdict **unverified**. Frozen collector native0: goal/provider-free proofPassed true, exact same ordered4rows/12values and final state true; finalized calls0/cost0/itemized0/pending0/omitted0/harness0, all consistency checks true. This is not labeled a judged replay.

Full and definition hashes before judged, after judged, and after replay are unchanged for both Flow artifacts; original catalog instruction binding remains exact. Root Flow SHA ee53217a9135904872cb546cec64a266710121a1ba93da590a557e5cb9be5d82 / definition3007fc9d51a2db5f818a44c96a17012fe6eef1efd09999647201c52bb4d93731. Generated graph9nodes11edges SHA be067889bccf4d2e15252034a02738aca4bdb7fd060f2a044f0d7dae166b9b43 / definitionb1f8d43875d1d08b855f6aa544c83f57d372da3366612334225b9915b47b2773. No runtime graph repair was observed across these hashes.

Private structural receipt files in the own codex-installed-edge-e3 root: creation-receipt.json, replay-receipt.json, before-judged-artifact-hashes.json, after-judged-artifact-hashes.json, after-replay-artifact-hashes.json. No raw rows, page content, keys or pairing values are included in this report. Edge host35316 remains running/leased pending root cleanup release; source/HEAD/package/helper freeze remains. Old t721 paid-unknown proof is still held and unchanged.

Independent final Edge live hash command (read-only public owning APIs and private instruction comparison; prints only identities/hashes/booleans):

```powershell
$env:FLUXIQ_BUILD_CACHE_DIR='off'
$verify=@'

import fs from'node:fs/promises';import path from'node:path';import{createHash}from'node:crypto';
import{connectSurface}from'file:///C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/469d0f8b-69b3-419c-8ee1-425911c239a2/scratchpad/codex-installed-proof-scripts/controls.mjs';
const scope={projectId:'3c4f425c-f703-43ed-bf5e-d5b26386acd4',flowId:'flow.c1ce6c21-7d4e-4710-8bd5-5013fe586725'};
const w=await connectSurface({port:9361,surface:'web',origin:'http://127.0.0.1:3711',target:'7193293397DA8B9465186E59AB0AA7CD'});
let flows,instructions;
try {
 const result=await w.evaluate(async scope=>{
  if(location.origin!=='http://127.0.0.1:3711')throw Error('scope');
  const read=async(endpoint,payload)=>{if(!['list-flows','get-flow-instruction-set'].includes(endpoint))throw Error('read_only');const r=await fetch('/api/programs/automation-studio/'+endpoint+'?domainId=web-automation',{method:'POST',credentials:'same-origin',redirect:'error',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)});const e=await r.json();if(!r.ok||e?.ok!==true)throw Error('read_refused');return e.payload};
  const a=await read('list-flows',{projectId:scope.projectId});if(!Array.isArray(a.flows))throw Error('flow_list');const b=await read('get-flow-instruction-set',scope);return{flows:a.flows.map(entry=>entry.flow),instructions:b.instructions};
 },scope);flows=result.flows;instructions=result.instructions;
}finally{w.close();}
if(!Array.isArray(flows)||!flows.length||flows.some(f=>f.projectId!==scope.projectId||!Array.isArray(f.nodes)||!Array.isArray(f.edges)))throw Error('flow_scope');
const canonical=v=>Array.isArray(v)?v.map(canonical):v!==null&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const hash=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const hashes=flows.map(f=>({flowId:f.flowId,sha256:hash(f),definitionSha256:hash(Object.fromEntries(Object.entries(f).filter(([k])=>!['createdAt','updatedAt'].includes(k)))),nodes:f.nodes.length,edges:f.edges.length})).sort((a,b)=>a.flowId.localeCompare(b.flowId));
const root='C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/469d0f8b-69b3-419c-8ee1-425911c239a2/scratchpad/codex-installed-edge-e3';
const original=await fs.readFile(path.join(root,'inputs/task-instruction.txt'),'utf8');const exact=v=>typeof v==='string'?v.trim()===original.trim():Array.isArray(v)?v.some(exact):v!==null&&typeof v==='object'?Object.values(v).some(exact):false;
const originalInstructionBound=exact(instructions)||exact(flows.find(f=>f.flowId===scope.flowId));

const before=JSON.parse(await fs.readFile(path.join(root,'before-judged-artifact-hashes.json'),'utf8'));
const judged=JSON.parse(await fs.readFile(path.join(root,'after-judged-artifact-hashes.json'),'utf8'));
const replay=JSON.parse(await fs.readFile(path.join(root,'after-replay-artifact-hashes.json'),'utf8'));
const same=a=>JSON.stringify(a.hashes)===JSON.stringify(hashes);
console.log(JSON.stringify({originalInstructionBound,beforeEqualsLive:same(before),judgedEqualsLive:same(judged),replayEqualsLive:same(replay),hashes}));
if(!originalInstructionBound||!same(before)||!same(judged)||!same(replay))process.exitCode=1;

'@
$verify | node --input-type=module
```

### Current-dev integration gates: frozen post-merge pair

Supervisor committed the accepted installed proof report as3d85a471 and merged current published dev into both isolated task trees without conflicts. All checks below used frozen Core **be5669363300094bd9900417f057d53326e63d93** and downstream **db92f06dc3ec2bc9f1938a332b4e08aa3089a0c8**. Both trees were clean before and after all readers; only this report is edited afterward. Every process set FLUXIQ_BUILD_CACHE_DIR=off. No shared Core, source fix, HEAD movement, whole sweep, production Web build, new browser/provider run or historical profile mutation occurred.

The current exact scope is **13 distinct approved accounting owners (173 cases) plus four directly intersecting intermediate-output safety owners (57 cases), total17 files/230 passed**. The earlier supervisor14/188 claim is retained as historical evidence with a scope caveat: its extra distinct path could not be recovered; supervisor explicitly chose the documented13-owner map rather than inventing a14th. Current counts come from the actual final Vitest summary and per-file results.

| Gate | Actual native exit/result | Log relative to owning repository |
| --- | --- | --- |
| Core focused source tests |0;17/17files,230/230cases,225.67s |packages/fluxiq/node_modules/codex-accounting-currentdev-tests.log |
| Core contracts package check |0;actual compiler24.020s/no stamp |node_modules/codex-accounting-currentdev-checks.log |
| Core fluxiq package check |0;actual compiler137.232s/changed source |same Core checks log |
| Core structure audit |0;404 advisory warnings/1152 baselined |node_modules/codex-accounting-currentdev-audit.log |
| Downstream structure audit |0;211 advisory warnings/638 baselined |node_modules/codex-accounting-currentdev-audit.log |
| Own contracts library |0;actual rebuild6.204s |Core node_modules/codex-accounting-currentdev-libraries.log |
| Own fluxiq library |0;actual rebuild78.822s |same library log |
| Own gateway library |0;actual rebuild4.359s |same library log |
| Downstream owning Core currentness |0;current with own source |node_modules/codex-accounting-currentdev-core-current.log |
| Domain source/test package check |0;actual compilers50.044s |node_modules/codex-accounting-currentdev-domain-check.log |
| Extension package source/test check |0;actual check84.941s |node_modules/codex-accounting-currentdev-extension-check.log |
| Conditional Web package check |0;actual compiler100.356s/no stamp |Core node_modules/codex-accounting-currentdev-web-check.log |

All three library targets rebuilt from changed inputs; none was stamp reuse. All package check targets actually executed their owning check commands. Web typecheck was included because the merged intermediate-output shared contract/runtime changes cross into Web's consumer types; no Web production build was run.

A preliminary downstream cache-CLI command supplied two check targets at once; this downstream CLI supports one target. It truthfully refused usage/native2 before running either check, retained in downstream node_modules/codex-accounting-currentdev-checks.log. Corrected to the separate owning package commands below, both native0; no product or test failure was hidden.

Exact commands (each in the indicated own repository, with process cache off):

```powershell
# Own Core/packages/fluxiq:
pnpm.cmd exec vitest run src/programs/automation-studio/runtime/llm/tests/run-budget.test.ts src/programs/automation-studio/runtime/llm/purse/tests/purse.test.ts src/programs/automation-studio/runtime/llm/build-purse/tests/purse.test.ts src/programs/automation-studio/runtime/llm/build-purse/tests/harness-hold.test.ts src/programs/automation-studio/runtime/llm/build-purse/tests/settlement-ledger.test.ts src/programs/automation-studio/runtime/recovery/refuted-result/tests/purse.test.ts src/programs/automation-studio/runtime/result-verification/accounting/tests/accounting.test.ts src/programs/automation-studio/runtime/result-verification/tests/run-outcome.test.ts src/programs/automation-studio/runtime/result-verification/tests/run-outcome-repair.test.ts src/programs/automation-studio/runtime/result-verification/tests/zero-provider-run.test.ts src/programs/automation-studio/runtime/service/runtime-adaptation/tests/refuted-result-port.test.ts src/programs/automation-studio/runtime/service/runtime-session/tests/in-run-repair.test.ts src/programs/automation-studio/runtime/tests/service-adaptation/tests/caller-paid-result-check.test.ts src/programs/automation-studio/runtime/executor/tests/record-capture.test.ts src/programs/automation-studio/runtime/result-verification/build-test/tests/stores.test.ts src/programs/automation-studio/runtime/executor/state-routing/tests/reopen.test.ts src/programs/automation-studio/runtime/service/datasets/tests/intermediate-output.test.ts --maxWorkers=2 --minWorkers=1
# Own Core:
node scripts/structure-audit.mjs
node scripts/build-cache/cli.mjs contracts:check fluxiq:check
node scripts/build-cache/cli.mjs contracts:build fluxiq:build client-gateway-websocket:build
node scripts/build-cache/cli.mjs web:check
# Own downstream:
node scripts/structure-audit.mjs
node scripts/check/core-build.mjs
pnpm.cmd --filter @fluxiq-web-extension/domain check
pnpm.cmd --filter @fluxiq-web-extension/extension check
```

Scope limits remain unchanged: settled fully itemized same-run receipts restore; unknown/malformed/pending/omitted historical accounting refuses new paid continuation. Runtime ledger totals do not claim all separate re-author build spend. Chrome/Edge live proofs validated the preceding frozen installed artifact pair; these current-dev integration gates validate the refreshed source pair without claiming a new live run. Original old paid-unknown run remains unaccepted. All readers terminal; report frozen for supervisor independent inspection/integration.
