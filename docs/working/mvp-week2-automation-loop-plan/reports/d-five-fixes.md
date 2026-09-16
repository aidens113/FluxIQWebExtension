# d-five-fixes — Phase D, the five fixes, in FluxIQ Core

Path prefix: `AS/` = `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\`.

## Outcome

**Done.** All five fixes are implemented, in the order 1 → 3 → 2 → 5 → 4, each
with a failing test observed before the fix. Core's live-patch red is cleared.

The single underlying change: `validationResults` can now only be built from an
executed-and-compared run. Everything else follows from that.

## What I inherited, and what I wrote

**Inherited** from the worker the crash killed — four tests in
`AS/runtime/tests/live-patch.test.ts` (+97 lines) plus the `emptyComparison()`
helper, and an import of `AutomationStudioTransitionComparison`. No source file
had been touched, so the tests were red by design. I kept all four unchanged and
they now pass.

**Everything else is mine**: every source change, every other test, the
`AS/runtime/recovery/` module, and the rewrite of the two existing tests that
encoded the defect as intended behaviour.

## Fix 1 — success is no longer inferred from silence

`AS/runtime/live-patch.ts`. `runtimePatchRestoredExpectedState` is replaced by
`verifyRuntimePatchOutcome`, returning the new exported type:

```ts
export type AutomationStudioRuntimePatchVerification =
  | { status: "verified"; basis: "expected_route" | "expected_outputs" }
  | { status: "unverifiable"; reason: "no_expectation_declared" | "expectation_empty" }
  | { status: "contradicted"; reason: string }
  | { status: "not_executed"; reason: string };
```

- `verified` → `status: "validated"` and one `succeeded` validation entry.
- `contradicted` / `not_executed` → `"rejected"` and one `failed` entry.
- `unverifiable` → **no `validationResults` key at all**, `status: "testing"`,
  and `metadata.verification` recording why.

Both vacuous paths are closed: `!comparison` and an expectation that declares
neither a route nor any outputs. `restoredExpectedState` survives as a derived
field (`verification.status === "verified"`) because `service.ts` consumers read
it; `retryOriginalAction` now requires `verified`.

**A third vacuous path I found and closed, which the investigation did not
name.** `expectedTransitionForNode` (`AS/runtime/executor/expected-transition.ts`)
falls back to `expectedRoute: "failed"` for any failed attempt on an ordinary
node. That is the executor's way of not flagging the route, not a declaration —
and in production almost every failed attempt carries it, because
`attempt-trace.ts:37` attaches a comparison to every attempt. Treating it as a
declared expectation would have marked every rerun `contradicted`; ignoring the
whole comparison would have marked every rerun `unverifiable` regardless of what
was really declared. So an expected route is treated as evidence only when it
differs from `comparison.actual.route`: a route that merely repeats the one the
failure already took cannot tell a repair from the failure.

**Two existing tests encoded the defect and were rewritten, not deleted:**

- `live-patch.test.ts` "turns successful structural patches into adaptation and
  change proposal candidates" passed no expectation and asserted `validated`. It
  now declares `expectedRoute: "end"` (the route `builtin.control.end` really
  emits) and is joined by a companion asserting that the same patch with no
  declared expectation yields `testing`, no validation entry and no proposal.
- `service-flow-representation.test.ts:388` asserted `restoredExpectedState:
  true` as a proxy for "the rerun ran on the run's own inputs". It now asserts
  `traceStatus: "succeeded"` (which is what actually proves that) plus
  `restoredExpectedState: false` and
  `verification: { status: "unverifiable", reason: "no_expectation_declared" }`.

## Fix 3 — patch application is total and fails closed

`applyRuntimePatchToFlow` now returns
`{ applied: true; flow } | { applied: false; reason }` from an exhaustive
`switch`, with a `never`-typed `unappliedRuntimePatchKind` so a new patch kind
fails the type check until it is applied or explicitly refused.
`temporary_action_sequence` and `temporary_recovery_subflow_call` (the sixth
instance) return `unapplied_patch_kind:<kind>`;
`executeAutomationStudioRuntimePatch` then returns `not_executed`, **never runs
the graph, and emits no adaptation**. Node-absent cases also fail closed.

The two new tests reproduced the defect exactly before the fix: both reported
`{ status: "verified" }` — the rerun of the *unmodified* flow produced the
declared expected outputs and was recorded as a verified success for a patch
that was never applied.

**Not done, and deliberately:** the investigation's third item under fix 3 was to
stop writing the dead `parameterValues.recovery` in
`AS/runtime/service/adaptations/patches.ts:52-55` and
`AS/storage/project/adaptation-store.ts:382`. Removing the write alone converts
`edit_recovery` from a dead write into a *silent no-op that reports applied* —
the same defect one level down — so the honest change is to make `edit_recovery`
application fail closed in both paths. No test anywhere covers `edit_recovery`
(`grep -rn edit_recovery --include=*.test.ts` → no matches), so that is an
unmeasured live behaviour change in a file outside my brief's owned list. I left
it and am flagging it. With fix 3 in place the runtime no longer *creates* these
adaptations, so the dead write is now only reachable from an LLM change proposal.

## Fix 2 — no fabricated success, and a status is not evidence

- `targetOverrideProposalAdaptation` no longer writes a `validationResults`
  entry. The structural check is recorded as
  `metadata.structuralChecks: [{ check: "target_resolution", status: "passed", detail: ... }]`
  alongside `metadata.verification: { status: "not_executed", reason: "proposal_only" }`.
- `adaptation-store.ts:161` counted `some(succeeded) || detail.status === "validated"`.
  The status clause was a second vacuous path and is gone.
- **The consequence had to be handled, not just accepted.** A human reviewer
  clicking Approve then Apply went through that status clause, so removing it
  broke manual review outright. A reviewer's approval is real evidence; it just
  has to be recorded rather than inferred. `reviewFlowAdaptation` now writes
  `metadata.review.approvedBy` / `approvedAt` (separately from `lastAction`,
  which the following Apply overwrites), the typed path writes the same marker
  through a new optional `metadata` merge on `setAdaptationStatus`, and the store
  additionally accepts an `approved` audit event by a non-`runtime` actor
  (`hasReviewerApproval`). The gate now reads "at least one successful validation
  **or a named reviewer approval**". A bare `validated` status still satisfies
  neither — that is what the new store test pins.
- `service.ts` now reports `verification` inside each `runtimePatchAttempts`
  entry, so the run detail says what the rerun proved.

## Fix 5 — adaptations actually reach classification

The investigation was right that the stated cause was wrong. Both halves are
fixed:

- **The binding defect.** `runtimeSessionToFlowRunDetail` and
  `runtimeActionAttemptsFromSession` (`AS/runtime/service/summaries/conversions.ts`)
  take an optional `adaptations` list and pass it to
  `classifyAutomationStudioAdaptiveFailure`. `resolveRuntimeAdaptationContext`
  now loads the recent adaptation *records* (summaries carry no `failedAction`,
  so they cannot match) bounded by
  `AUTOMATION_STUDIO_KNOWN_ADAPTATION_LOAD_LIMIT = 25`, exposes them as
  `context.recentAdaptations`, and the production run-detail call site passes
  them. Three new tests in `conversions.test.ts` cover match, no-adaptations and
  wrong-node.
- **The signature.** Both adaptation builders in `live-patch.ts` now write
  `metadata.failureSignature`, taken from
  `classifyAutomationStudioAdaptiveFailure(...).signature` — the public
  classifier, so `adaptiveFailureSignature` did not need exporting. A new test
  asserts the 24-hex shape and that the executed and proposal builders agree for
  the same failure.

## Fix 4 — the gate is wired, and the patch call is chained

New module `AS/runtime/recovery/`:

- `llm-invocation.ts` — `decideAutomationStudioRuntimeLlmInvocation` classifies
  the failed attempt and calls `decideAutomationStudioLlmInvocationGate`. It acts
  **only** on that gate's deterministic-first refusals (`known_recovery`,
  `reroute`). Its other refusals — training mode, budget, manual approval mode —
  are already enforced at the call site, and applying them a second time would
  refuse work that is allowed today, which is a wider change than defect 4. That
  choice is pinned by a test.
- `diagnosis-chain.ts` — `decideAutomationStudioRuntimePatchRequest` requires
  `diagnosis.ok` **and** `response.kind === "diagnosis"` before the second billed
  call. A structured "the diagnosis asks for a patch" field does not exist on the
  diagnosis response, so "succeeded and returned a diagnosis" is the strongest
  chain available without inventing a contract.
- `adaptation-promotion.ts` — `evaluateFlowAdaptationPromotionGates`,
  `reviewerApprovalForAdaptation`, `adaptationValidationCounts`,
  `adaptationConfidenceScore`, moved out of `service.ts`.

`service.ts` holds only the calls: the invocation decision runs **before the
provider is resolved** and returns the existing `llmGate: { invoked: false,
reason, requiredPriorAction }` shape; the patch call is gated on
`patchRequest.request` and records `llmGate.patchSkipped` when it is not made.

**Correction on my own evidence.** I ran the call-site grep only after creating
the recovery module, so its output (2 hits) was my own import and call, not a
measurement of the before state. The "zero production callers" fact is the
investigation's, and I did not independently re-measure it. What I did observe
before editing is the second half: `service.ts:3050` read
`const patchResult = provider && input.runtimeFlow && input.failedTraceAttempt &&
input.context.behavior.createAdaptations` — no reference to the diagnosis result
at all, so the second call billed regardless of what the first one did.

## Commands run and observed results

```
# RED baseline, before any source change (the inherited test)
npx vitest run .../runtime/tests/live-patch.test.ts
  → Tests  4 failed | 15 passed (19)
    "expected undefined to deeply equal { status: 'unverifiable', … }"  ×2
    "expected undefined to be 'contradicted'"
    "expected undefined to deeply equal { status: 'verified', … }"

# Fix 3, failing first — the defect reproduced
  → Tests  2 failed | 20 passed (22)
    "expected { status: 'verified', …(1) } to deeply equal { status: 'not_executed', …(1) }"  ×2

# Fix 2, failing first — both halves
  → Tests  2 failed | 27 passed (29)
    "expected { schemaVersion: '0.1', …(15) } to not have property \"validationResults\""
    "promise resolved \"{ adaptation: …\" instead of rejecting"

# Fix 5, failing first
  → Tests  2 failed | 2 passed (4)
    "expected undefined to deeply equal [ { …(3) } ]"  (knownAdaptationIds)
  → Tests  1 failed | 22 passed (23)
    ".toMatch() expects to receive a string, but got undefined"  (failureSignature)

# GREEN, final, the suites covering every file I changed
npx vitest run live-patch.test.ts adaptation-store.test.ts conversions.test.ts
                runtime/recovery service-flow-representation.test.ts
  → Test Files  6 passed (6)
    Tests  53 passed (53)

npx vitest run .../runtime/tests/service.test.ts
  → Tests  108 passed (108)
    (4 failed first, all Phase T fallout; see below. After converting the four
     model-authored fixtures to opaque handles: green. Two further failures in
     one run at ~15s each were load timeouts and passed alone and on rerun.)

# Core type check
npx tsc --noEmit
  → 223 errors, every one "Property 'classification' is missing" in
    programs/*/api/** and programs/tests/index.test.ts.
    Filtered to everything outside those: 0 errors.
    Filtered to src/programs/automation-studio/{runtime,storage,model}: 0 errors.

# Structure audit and the size ratchet
node scripts/structure-audit.mjs
  → (after my changes, before commit 7ed13dc landed) passed, 136 warnings, 256 baselined
  → (final) structure-audit: 1 violation(s) across 1 rule(s):
    FAIL [imports] .../automation-studio/tests/opaque-target-execution.test.ts:
    2 imports reach past a barrel, e.g. "../runtime/live-patch.ts" at line 27.
    That file is not mine: another worker committed it in 7ed13dc. See below.
    structure-audit: 1 baseline entries can be lowered.
wc -l AS/runtime/service.ts        → 6757   (baseline 6758, under it, not raised)
wc -l AS/runtime/tests/service.test.ts → 4787 (baseline 4787, exactly at it)
```

The audit's "1 baseline entry can be lowered" is `service.ts` at 6757. I did
**not** run `pnpm structure:baseline`: regenerating rewrites the whole baseline
file and would capture other workers' in-flight states.

## Failures that are not mine, with the evidence

**Four in `service.test.ts` — Phase T (opaque target) fixture fallout. Now fixed.**
"captures sanitized failure evidence once…", "creates no proposal when a target
override is absent…", "persists a canonical target override for manual review…",
"rejects multiple patches from an explicit diagnose_and_adapt grant…". Each mock
provider returns a model-authored `temporary_target_override` with
`target: { selector: "#…" }`. `isAutomationStudioModelAuthoredTargetOverrideTarget`
now demands `{ handles }` and nothing else, so the patch response fails output
validation: I probed one and observed both LLM calls made
(`costAccounting.calls: 2`) with `llmGate.ok: false`, and `runtimePatchAttempts`
absent. Phase T landed as commit `b06c74e` while I worked, so I converted the six
occurrences across those four tests (`{ selector: "#submit-order" }` →
`{ handles: { control: "submit-order" } }`, and likewise for `#replacement`,
`#missing`, `#first`, `#second`), each an in-line substitution that adds no lines.
`service.test.ts` is now 108/108 and still exactly 4787 lines. I converted the
same fixtures in `live-patch.test.ts` (22 occurrences) because that file is mine.

**One in `service-flow-bootstrap-adaptation.test.ts` — Phase P fallout. Now fixed.**
`identityAccess.authorizeSessionPin` was called 0 times instead of 2. Phase P
(decision L16) moved the PIN check out of authoring endpoints, and reviewing an
adaptation is authorship, so `review-flow-adaptation` is no longer PIN-gated. The
two cumulative-count assertions (lines 383 and 414, both inside the same test) are
now `expect(identityAccess.authorizeSessionPin).not.toHaveBeenCalled()` — asserting
it is never called, so a PIN requirement returning to this path fails loudly rather
than quietly satisfying a looser bound — and the test title no longer says
"PIN-gated". I checked the rest of my files for stale PIN expectations: the only
other hits are two `not.toHaveProperty("authorizationPin")` assertions in
`runtime/llm/tests/execution-grants.test.ts`, which are about a stored grant's
shape rather than endpoint gating, and they pass.

**Eight in `storage/project/tests/runtime-stream-store.test.ts`** — environmental.
The "million events" test timed out at 60s under concurrent load and left an
orphaned handle on its temp sqlite file; every later test in the file then fails
in `beforeEach` with `EBUSY: resource busy or locked, unlink
'…\fluxiq-…-runtime-stream-store-test\projects\project.million\project.sqlite'`.
`rm -rf` on that directory fails with "Device or resource busy". I changed
nothing in that store, and this file passed in an earlier full-suite run in this
same session.

## Final state, as observed

```
npx vitest run src/programs/automation-studio/runtime
                src/programs/automation-studio/storage/project/tests/adaptation-store.test.ts
  → Test Files  54 passed | 1 failed (55)
    Tests  681 passed | 1 failed (682)
    The one failure is "turns mapped observations into reviewed Flow actions…"
    at 15052ms — a load timeout. Run alone: 1 passed. Same for a second test
    that timed out in an earlier pass. This machine's known behaviour.

npx vitest run .../runtime/tests/service.test.ts                      → 108 passed (108)
npx vitest run .../service-flow-bootstrap-adaptation.test.ts          → 9 passed (9)
npx vitest run live-patch + adaptation-store + conversions
                + runtime/recovery + service-flow-representation     → 53 passed (53)

npx tsc --noEmit, filtered to automation-studio runtime/storage/model → 0 errors
wc -l AS/runtime/service.ts                                          → 6757  (baseline 6758)
wc -l AS/runtime/tests/service.test.ts                               → 4787  (baseline 4787)
node scripts/structure-audit.mjs                                     → 1 violation, in
  automation-studio/tests/opaque-target-execution.test.ts, another worker's file
```

## What I changed, and where

| File | Change |
| --- | --- |
| `AS/runtime/live-patch.ts` | Fixes 1, 3, 2, 5; opaque target type on the domain-validation seam |
| `AS/runtime/service.ts` | Fix 2 consequences, fix 5 seam, fix 4 wiring; promotion helpers extracted out |
| `AS/storage/project/adaptation-store.ts` | Fix 2: executed-or-approved only; `setAdaptationStatus` metadata merge; `hasReviewerApproval` |
| `AS/runtime/service/summaries/conversions.ts` | Fix 5: adaptations threaded into classification |
| `AS/runtime/recovery/` (new) | `llm-invocation.ts`, `diagnosis-chain.ts`, `adaptation-promotion.ts`, `index.ts`, `tests/` |
| `AS/runtime/index.ts` | Barrel export for `recovery/` |
| `AS/runtime/tests/live-patch.test.ts` | 4 inherited tests kept; 8 added; 1 rewritten; opaque-target fixtures |
| `AS/storage/project/tests/adaptation-store.test.ts` | 1 test added |
| `AS/runtime/service/summaries/tests/conversions.test.ts` | 2 tests added |
| `AS/runtime/tests/service-flow-representation.test.ts` | 1 assertion made honest |
| `AS/runtime/tests/service.test.ts` | 2 fixtures declare an expectation; 8 lines converted off `{ selector }` |
| `AS/runtime/tests/service-flow-bootstrap-adaptation.test.ts` | Phase P: review is no longer PIN-gated |

Files outside my brief's owned list that I edited, all because my own change
required it: `conversions.ts` (fix 5's seam has nowhere else to live),
`service-flow-representation.test.ts` and `service.test.ts` (they asserted the
behaviour I changed), `conversions.test.ts` (home of the fix 5 test),
`runtime/index.ts` (barrel). I touched none of the forbidden paths:
`graph-store.ts`, `runtime/llm/**`, `programs/_shared/**`,
`programs/identity-access/**`, `programs/*/api/**`.

## Not verified

- **No live browser or end-to-end run.** Everything here is unit and service-level.
- **`pnpm check`, `pnpm test` and `pnpm build` were not run whole.** `pnpm check`
  would fail on the 223 `classification` type errors that belong to another
  worker; I ran the structure audit and `tsc --noEmit` directly instead and
  attributed the output.
- **Fix 4's wiring has no service-level test.** Its two decisions are unit-tested
  in `AS/runtime/recovery/tests/`, and I probed the live call path once (observed
  `invoke: true` with only an `llm_diagnosis` candidate present, and
  `request: true` after a successful diagnosis), but no test asserts "no provider
  call when a deterministic candidate exists" through `AutomationStudioService`.
  I did not find an existing fixture that produces a deterministic recovery
  candidate for a failed attempt.
- **The fix 4 modules were written before their tests**, the reverse of the
  required order. The extraction requirement arrived after the module was
  drafted. Fixes 1, 3, 2 and 5 each had an observed failing test first.
- **Verification compares output *presence*, not output *values*.** A declared
  `expectedOutputs: { value: "ok" }` is satisfied by observing an output named
  `value`, whatever it holds. That matches the original behaviour and the
  investigation's specification, and it is a weaker claim than the field name
  suggests.
- **The `recentAdaptations` load is bounded at 25 and unmeasured.** It adds up to
  25 adaptation reads per adaptive run; I did not benchmark it.
- **`edit_recovery` durable application** — see fix 3 above. Still a silent
  no-op-in-waiting, deliberately untouched.

## Open questions for the supervisor

1. **The structure audit is red on someone else's file, and blocks `pnpm check`.**
   `packages/fluxiq/src/programs/automation-studio/tests/opaque-target-execution.test.ts`,
   added by commit 7ed13dc, imports `../runtime/live-patch.ts`,
   `../runtime/executor.ts` and `../runtime/host-runtime.ts` directly instead of
   `../runtime/index.ts`. The fix is changing those import paths to the barrel. I
   did not touch it: it belongs to the worker who just committed it, and it is
   outside my brief. My own files are clean — `service.ts` is 6757 against a 6758
   baseline and `service.test.ts` is exactly 4787 against 4787, neither raised.
2. **`edit_recovery` should fail closed** in
   `service/adaptations/patches.ts:52-55` and `adaptation-store.ts:382`. It is
   untested everywhere, so the change is safe for the suite but is a live
   behaviour change. Worth its own brief.
3. **A reviewer approval now substitutes for an executed validation.** That is
   the only way manual review survives fix 2, and it is a product decision as
   much as an engineering one: a person clicking Approve can still apply an
   adaptation that never ran. It is recorded explicitly (`metadata.review.approvedBy`,
   plus an `approved` audit event) rather than inferred, which is the point, but
   the user may want the reviewer path narrowed further.
4. **The `expectedRoute: "failed"` fallback** in `expected-transition.ts` is
   load-bearing for this fix and is arguably wrong at source: an expectation
   derived from the failure cannot describe success. I worked around it in
   `live-patch.ts` rather than change the executor, which is outside this brief.
