# w2-a-defect-fixes — proposed fixes for the five loop defects

Investigation only. **No source file in either repository was changed.**
Reproduction ran against a copy of Core's `live-patch.ts` in a scratch
directory outside both repositories.

Path prefix: `AS/` = `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\`.

---

## Summary: what was proved, and what the brief got wrong

| # | Defect | Status | Verdict on the brief's description |
| --- | --- | --- | --- |
| 1 | "Did recovery work" returns true with nothing to compare | **Proved by execution** | Correct, and there is a second vacuous path it missed |
| 2 | Never-executed proposal recorded as a succeeded validation | **Proved by reading; consequence partly wrong** | The fabricated success is real. "Passes both apply gates" is **wrong** for the runtime path |
| 3 | Action-sequence repair reaches `applied` without running | **Proved by execution; cause is deeper** | True but understated — the patch is never applied *at all*, not merely unread |
| 4 | Deterministic classifier is not the LLM gate | **Proved by reading + call-site search** | Correct, and better than described: a correct gate already exists and is wired to nothing |
| 5 | `failureSignature` never written, so matching cannot match | **Half wrong** | The field is indeed never written, but that is *not* why matching fails |

All five share one cause, stated in "The single underlying cause" below.

---

## Defect 1 — success is inferred from the absence of an expectation

### The failing test (executed, output below)

Drive `executeAutomationStudioRuntimePatch` with a patch whose failed attempt
carried **no** `transitionComparison`, and a graph rerun that succeeds.

Observed, from the scratch run:

```
PASS  D1a restoredExpectedState with NO comparison      expected=true actual=true
PASS  D1a adaptation.status                             expected="validated" actual="validated"
PASS  D1a validationResults[0].status                   expected="succeeded" actual="succeeded"
PASS  D1a retryOriginalAction                           expected=true actual=true
PASS  D1b restoredExpectedState with EMPTY comparison    expected=true actual=true
PASS  D1c restoredExpectedState with a REAL expectation  expected=false actual=false   (control)
```

("PASS" = the defective behaviour was observed as predicted. D1c is the control
showing the check does work when there is something real to compare.)

This is reachable from the only production caller: `service.ts:3101` passes
`expectedComparison` **only** when the failed attempt carried a
`transitionComparison`, so every failure on a node with no declared expected
state takes the vacuous path.

### The real cause

`runtimePatchRestoredExpectedState` (`live-patch.ts:324-330`) has **two**
vacuous-true paths, not one:

- `if (!comparison) return true;` (line 326) — the one the brief names.
- `expectedOutputs.every(...)` on an empty key list (lines 328-329) — `[].every()`
  is `true`, so a comparison that declares neither `expectedRoute` nor any
  `expectedOutputs` also returns true. **The brief missed this**; fixing only
  line 326 leaves the defect alive whenever a comparison exists but is empty.

`adaptationFromRuntimePatch:228` then converts that boolean straight into
`status: "validated"` and a `validationResults` entry of `"succeeded"`.

### The fix

Replace the boolean with an outcome that can say "I could not tell", in
`live-patch.ts`:

```ts
type RuntimePatchVerification =
  | { status: "verified"; basis: "expected_route" | "expected_outputs" }
  | { status: "unverifiable"; reason: "no_expectation_declared" | "expectation_empty" }
  | { status: "contradicted"; reason: string }
  | { status: "not_executed"; reason: string };
```

`verifyRuntimePatchOutcome(trace, comparison, patch)` returns `verified` **only**
when a declared route matched or a non-empty declared output set was observed.
Then in `adaptationFromRuntimePatch`:

- `verified` → `status: "validated"`, one `validationResults` entry `"succeeded"`.
- `contradicted` / `not_executed` → `"rejected"`, entry `"failed"`.
- `unverifiable` → **no `validationResults` entry at all**, `status: "testing"`,
  and `metadata.verification` recording why. This is what makes L7 enforceable:
  a `validationResults` entry must mean "it ran and was compared", so every
  downstream `succeeded > 0` gate becomes trustworthy without being touched.

`retryOriginalAction` should require `verified`.

### Files and functions

- `AS/runtime/live-patch.ts`: `runtimePatchRestoredExpectedState` (→
  `verifyRuntimePatchOutcome`), `adaptationFromRuntimePatch`,
  `executeAutomationStudioRuntimePatch` (lines 185-199), and the
  `requiresChangeProposalForRuntimePatch` guard at line 188.

### What could regress

- **`AS/runtime/tests/live-patch.test.ts:306-322`** ("turns successful structural
  patches into adaptation and change proposal candidates") passes **no**
  `expectedComparison` and asserts `restoredExpectedState === true` plus
  `status: "validated"`. It **will fail** and must be rewritten to declare a real
  expectation. This is the test that encodes the defect as intended behaviour.
- The test at lines 7-37 supplies a real `expectedOutputs` and should still pass.
- Fewer change proposals: line 188 gates proposal creation on the old boolean, so
  reroute/recovery patches with no declared expectation stop producing proposals.
- `maybePromoteRuntimeAdaptation` (`service.ts:3180`) and
  `retryRuntimeSessionAfterAutoAppliedPatch` (`service.ts:3273`) both read these
  values, so auto-retry will fire less often. Intended, but it is a live
  behaviour change, not a no-op refactor.

### Confidence: **high** — this is the cause, not a symptom

Executed against Core's own code with only the graph runner stubbed. Both
vacuous paths were observed, and the control case proves the comparison logic is
otherwise sound.

---

## Defect 2 — a fabricated "succeeded" validation for work that is declared not to have run

### The failing test

Call `proposeAutomationStudioRuntimeTargetOverride` and assert the adaptation
carries no successful validation. Today it does:
`validationResults: [{ status: "succeeded", detail: "Proposal-only structural
validation succeeded; the target override was not executed." }]`
(`live-patch.ts:285-290`), alongside `metadata.executed: false` and
`traceStatus: "not-run"`. The record contradicts itself in one object.

### The real cause, and where the brief is wrong

The fabricated entry is real. Its consequences are **not** what the brief says.

- `evaluateFlowAdaptationPromotionGates` (`service.ts:5630`) passes it, but via
  **line 5633** (`counts.succeeded < 1`), not line 5635. Line 5635 only blocks
  `destructive`; this adaptation is `high`, so 5635 is simply not reached. The
  brief cites the line that *doesn't* fire.
- `adaptation-store.ts:161` computes
  `validated = validationResults.some(r => r.status === "succeeded")` → `true`,
  so `decidePolicy`'s `!input.validated` block (line 155) is cleared. Correct.
- **But "passes both apply gates" is wrong for the runtime path.** Runtime
  auto-promotion goes through `decideAutomationStudioAdaptationPromotionGate`
  (`training-modes.ts:306-318`), which the brief does not mention. Line 310
  refuses `high` risk and line 311 refuses external side effects, so a
  never-executed target override **does not auto-apply unattended**.

The defect is therefore narrower and more insidious than described: the fake
success does not by itself apply anything, but it makes a never-executed
proposal **indistinguishable from an executed, verified one** to every consumer
that asks "was this validated?" — the reviewer UI, `adaptationConfidenceScore`
(`service.ts:5654`, which reports 0.75 for a patch that never ran), and a human
clicking Apply. There is also a genuine bypass the brief missed: `reviewFlowAdaptation`
returns early at `service.ts:4275-4276` when the typed store handles the
adaptation, so `evaluateFlowAdaptationPromotionGates` (line 4331) **is never
reached on that path** — the only check is the store's weak `validated` boolean.

### The fix

In `targetOverrideProposalAdaptation` (`live-patch.ts:262-306`), delete the
`validationResults` array. Record the structural check as
`metadata.structuralChecks: [{ check: "target_resolution", status: "passed" }]`.
Keep `status: "proposed"` and `riskLevel: "high"`.

Then tighten the two consumers so the two concepts cannot be conflated again:

- `adaptation-store.ts:161`: count only executed validations.
- `service.ts:5633`: unchanged — it now correctly sees zero and blocks, which is
  the desired outcome for a never-run proposal.

### Files and functions

- `AS/runtime/live-patch.ts`: `targetOverrideProposalAdaptation`.
- `AS/storage/project/adaptation-store.ts`: `applyApprovedAdaptation` (line 161).
- `AS/runtime/service.ts`: `evaluateFlowAdaptationPromotionGates`,
  `adaptationConfidenceScore`, `adaptationValidationCounts`.

### What could regress

- `live-patch.test.ts:72-103` asserts the proposal object with `toMatchObject`
  and does not assert `validationResults`, so it should survive — but this is a
  `toMatchObject`, so it will not catch the change either. Add an explicit
  negative assertion.
- `adaptationConfidenceScore` drops to 0 for proposals (`counts.total === 0`),
  which will change any UI sorting or badge driven by it.
- **Unverified risk:** `validateAutomationStudioFlowAdaptation` (called on every
  `putAdaptation`, `adaptation-store.ts:51`) may require a non-empty
  `validationResults`. I did not read the validator. If it does, the field must
  become explicitly optional in the same change.

### Confidence: **high on the cause, medium on the blast radius**

The fabricated record and both gate computations were read directly. I did not
execute the store path, so the claim that no unattended apply occurs rests on
reading `decideAutomationStudioAdaptationPromotionGate`, not on a run.

---

## Defect 3 — the action-sequence repair is never applied, so the rerun validates the unmodified flow

### The failing test (executed, output below)

```
PASS  D3 preflight.ok                                        expected=true  actual=true
PASS  D3 flow handed to the graph is IDENTICAL to input flow expected=<flow> actual=<flow>
PASS  D3 patched flow mentions the proposed actions          expected=false actual=false
PASS  D3 restoredExpectedState                               expected=true  actual=true
PASS  D3 adaptation.status                                   expected="validated" actual="validated"
PASS  D3 persisted patch kind                                expected="edit_recovery" actual="edit_recovery"
PASS  D3b flow handed to the graph is IDENTICAL to input flow (recovery_subflow_call)
PASS  D3b start node (never the subflow)                     expected="constant" actual="constant"
PASS  D3b adaptation.status                                  expected="validated" actual="validated"
```

### The real cause — deeper than the brief states

The brief says the persisted repair writes `parameterValues.recovery`, "which
nothing reads". That is true (confirmed: the only writers are
`patches.ts:54` and `adaptation-store.ts:382`; the recovery node at
`AS/nodes/policy/recovery.ts` declares parameters `strategy`, `maxAttempts` and
`fallbackActionDefinitionId` and reads no `recovery` key, and
`executor/recovery-ladder.ts` selects nodes by `definitionId ===
"builtin.policy.recovery"` without reading it). But that is the *second* failure.

The first is that **`applyRuntimePatchToFlow` (`live-patch.ts:308-322`) has no
branch for `temporary_action_sequence` at all.** It handles `temporary_wait_retry`,
`temporary_target_override` and `temporary_reroute` and silently returns an
unmodified `structuredClone`. So the "validation" rerun executes the *original*
flow; if that happens to succeed, defect 1 marks the adaptation `validated`.
The repair is therefore never exercised at runtime **and** never effective when
persisted. Proved above: the flow handed to the graph is byte-identical to the
input and contains none of the proposed action IDs.

**`temporary_recovery_subflow_call` has the same hole** — a sixth instance of the
same defect, not in the brief's list of five. It also starts the rerun at the
failed node (`startNodeForPatch:351-355` falls through), never at the subflow.

### The fix

1. Make `applyRuntimePatchToFlow` total and fail closed. Return
   `{ flow, applied: true } | { applied: false; reason }` with an exhaustive
   switch (the `never` exhaustiveness trick already used at
   `adaptive-orchestrator.ts:173`). `executeAutomationStudioRuntimePatch` must
   return `not_executed` for an unapplied kind — never run the graph and never
   emit an adaptation.
2. Only then, if Week 2 wants these kinds to work, implement real application:
   insert the action nodes for `temporary_action_sequence`, and route to the
   subflow for `temporary_recovery_subflow_call`.
3. Stop writing `parameterValues.recovery` in `patches.ts:52-55` and
   `adaptation-store.ts:382` — it is dead state that makes an `applied`
   adaptation look effective.

### Files and functions

- `AS/runtime/live-patch.ts`: `applyRuntimePatchToFlow`, `startNodeForPatch`,
  `executeAutomationStudioRuntimePatch`, `changePatchFromRuntimePatch`.
- `AS/runtime/service/adaptations/patches.ts`: `applyFlowNodeAdaptationPatch`
  (lines 52-55).
- `AS/storage/project/adaptation-store.ts`: `graphPatchOperationsForAdaptation`
  (line 382).

### What could regress

- **No existing test covers either kind's execution** (`live-patch.test.ts` has
  none), so failing closed breaks no test. It does silently change production
  behaviour: flows currently receiving these patches stop producing
  (false) validated adaptations. That is the intent.
- Removing the `recovery` write changes `edit_recovery`'s durable shape. Note
  `adaptationRequiresChangeProposal` (`durable.ts:187`) treats `edit_recovery` as
  structural, so these adaptations already require a linked proposal at
  `service.ts:5638` — and `requiresChangeProposalForRuntimePatch`
  (`live-patch.ts:357`) does **not** create one for `temporary_action_sequence`.
  So today such an adaptation is blocked at the reviewer apply path anyway. The
  brief's "can reach `applied`" is therefore **not demonstrated** on that path;
  what is demonstrated is that it reaches `validated` having never run.

### Confidence: **high** — executed, and the cause is structural

---

## Defect 4 — the deterministic-first gate exists, is tested, and is connected to nothing

### The failing test

Assert that a failure with a deterministic recovery candidate available makes no
provider call. Today `maybeAnnotateRunDetailWithRuntimeLlm` calls the provider
regardless.

### The real cause — better than the brief describes

The brief says the classifier "is not the LLM gate". True, and the reason is
worth stating exactly: **Core already contains the correct gate.**
`decideAutomationStudioLlmInvocationGate` (`training-modes.ts:271-282`) refuses
invocation when `knownRecoveryAvailable` (line 277) or `rerouteAvailable`
(line 278) — precisely L5. A call-site search across `packages/fluxiq/src` finds
its **only** callers are in `runtime/tests/training-modes.test.ts`. It has zero
production callers.

Meanwhile `maybeAnnotateRunDetailWithRuntimeLlm` (`service.ts:2882`) gates only
on `context.behavior.invokeLlm` and `budgetDecision.ok`, and
`classifyAutomationStudioAdaptiveFailure`'s `llmEligibility` is computed only in
`service/summaries/conversions.ts:143`, where it decorates a run summary and is
discarded. So the fix is **wiring, not authoring**.

The second half of the brief is confirmed: the patch request at
`service.ts:3042-3068` is guarded by
`provider && input.runtimeFlow && input.failedTraceAttempt &&
context.behavior.createAdaptations` — it never inspects `result.ok` or
`result.response`. A failed or malformed diagnosis still triggers a second,
billed `runtime_patch` call. Worse, the diagnosis result is **not an input** to
the patch call: both calls receive the same `runDetail`/`failureEvidence`, so the
"diagnose, then patch" sequence is two independent calls, not a chain.

### The fix

1. In `maybeAnnotateRunDetailWithRuntimeLlm`, before resolving the provider,
   classify the failure and call `decideAutomationStudioLlmInvocationGate`,
   feeding `knownRecoveryAvailable` and `rerouteAvailable` from
   `classifyAutomationStudioAdaptiveFailure(...).llmEligibility`. On
   `invoke: false`, return the existing `llmGate: { invoked: false, reason }`
   shape — the reporting path already exists.
2. Gate the second call on the first:
   `const diagnosisOk = result.ok && result.response?.kind === "diagnosis";`
   and require the diagnosis to call for a patch before running `runtime_patch`.
   (`AutomationStudioLlmTaskResult` is `{ ok, request, response?, provider?,
   usage?, diagnostics, intervention }` — `task-request.ts:34-42`.)

### Files and functions

- `AS/runtime/service.ts`: `maybeAnnotateRunDetailWithRuntimeLlm` (2868-3172).
- `AS/runtime/training-modes.ts`: `decideAutomationStudioLlmInvocationGate`
  (caller added; function unchanged).
- `AS/runtime/adaptive-orchestrator.ts`: needs the adaptations list — see D5.

### What could regress

- Fewer provider calls and fewer `interventions` entries. Any test asserting that
  a failed run produces an intervention, or asserting `interventions.length`, may
  break. **I did not enumerate those tests** (`runtime/tests/service.test.ts` is
  large); this must be checked before implementing.
- Suppressing the patch call when the diagnosis fails changes
  `llmGate.ok` composition at `service.ts:3159`.

### Confidence: **high on the cause, high on the fix shape**

Established by reading the control flow and by an exhaustive call-site search.

---

## Defect 5 — the brief's stated cause is wrong

### What the brief says

"`failureSignature` is never written, so known-adaptation matching cannot match."

### What is actually true

The first clause is confirmed: a repository-wide search for `failureSignature`
finds exactly one occurrence in source — the **read** at
`adaptive-orchestrator.ts:191`. Nothing writes it. `live-patch.ts:233-237` and
`262-305` write only `runtimePatchKind`, `traceStatus` and `retryOriginalAction`.

**But the conclusion does not follow.** `adaptationMatchesFailure`
(`adaptive-orchestrator.ts:187-199`) has three clauses, and the signature is the
last. Clause one (line 189) matches on
`failedAction.nodeId === attempt.nodeId && failedAction.definitionId ===
attempt.definitionId`. `live-patch.ts:213-219` **does** write `failedAction`, and
it survives persistence: `saveFlowAdaptation` passes
`adaptationEvidenceForStore` (`service.ts:4265`, `5620`) which includes
`failedAction`, and `adaptationFromRow` reconstitutes it (`adaptation-store.ts:336`).
So same-node re-failures *would* match today.

The real reason matching never happens is different and larger: **the only
production call site passes no adaptations at all.**
`conversions.ts:143-148` calls
`classifyAutomationStudioAdaptiveFailure({ projectId, flowId, runId, attempt })` —
with no `adaptations`, no `subflowId`, no `recoveryAttempts`. So
`knownAdaptationMatchesForFailure` iterates `input.adaptations ?? []`, i.e. an
empty array, and `knownAdaptationMatches` is **always** empty regardless of what
any adaptation records. Writing `failureSignature` alone would change nothing.

### The fix

1. Thread the adaptation list into classification. `resolveRuntimeAdaptationContext`
   (`service.ts:2846`) already loads `recentAdaptations` — the classification
   needs to happen where that list is in scope, or the list must be passed into
   the summary mapper. `conversions.ts` is a pure synchronous mapper with no store
   access, so this is a seam change, not a one-line edit.
2. Then write `metadata.failureSignature` in both adaptation builders in
   `live-patch.ts`, computed from a newly exported `adaptiveFailureSignature`
   (currently module-private, `adaptive-orchestrator.ts:214`). This buys
   cross-node matching on failure *class*, which the nodeId clause cannot do.

### Files and functions

- `AS/runtime/adaptive-orchestrator.ts`: export `adaptiveFailureSignature`;
  `adaptationMatchesFailure` unchanged.
- `AS/runtime/service/summaries/conversions.ts`:
  `runtimeActionAttemptsFromSession` (line 137) — needs adaptations threaded in.
- `AS/runtime/live-patch.ts`: `adaptationFromRuntimePatch`,
  `targetOverrideProposalAdaptation`.

### What could regress — and this is the important one

Once adaptations are actually passed, `knownAdaptationMatches` starts returning
results, which flips `llmEligibility.eligible` to `false` (line 72 counts
adaptations with status `applied` **or `validated`**). Combined with D4's wiring,
the loop would then **skip the LLM because of adaptations that were never
verified** — exactly the population that defects 1, 2 and 3 create. Sequencing
matters here more than anywhere else; see below.

### Confidence: **high that the brief's stated cause is wrong**

The `failureSignature` half is confirmed by search. The corrected cause is
confirmed by reading the single call site. I did **not** execute the
classification path, so "always empty in production" rests on that call site
being the only one — which the search supports (`service.ts` imports the symbol
at line 91 but contains no call).

---

## The single underlying cause

All five, plus the sixth found in D3, are one bug:

> **Success is recorded from the absence of contradicting evidence rather than
> from observed evidence of the intended effect.**

Three mechanisms express it:

- **Vacuous truth.** `!comparison → true` and `[].every() → true` (D1). Nothing
  was checked, so nothing objected, so it passed.
- **Asserted success.** A literal `status: "succeeded"` written into the field
  that means "we ran it", for work the same object declares `executed: false`
  (D2).
- **A silent no-op.** A patch kind with no application branch, so "the rerun
  succeeded" is a true statement about the *unpatched* flow (D3).

D4 and D5 are the same failure one level up, in the control plane: a correct gate
(`decideAutomationStudioLlmInvocationGate`) and a correct matcher
(`adaptationMatchesFailure`) both exist, are tested, and are connected to
nothing — so "no objection was raised" is again read as "the check passed".

**The one structural change that dissolves D1-D3:** make
`AutomationStudioFlowAdaptation.validationResults` constructible *only* from an
executed-and-compared run. Introduce the `RuntimePatchVerification` outcome from
D1 as the sole producer of those entries; route structural checks to a separate
`metadata.structuralChecks`. Every downstream gate already asks "is there a
succeeded validation?" — those gates are correct, and become trustworthy for
free once the field can no longer be fabricated. This is also exactly what L7's
confidence tiers require: a structural, never-executed validation must never
count as success.

## Order of work, to avoid rework

Do them in this order. The dependencies are real, not stylistic.

1. **D1 first** — it defines the `RuntimePatchVerification` vocabulary the others
   consume. Doing anything else first means rewriting it later.
2. **D3 second** — its fail-closed path *returns* a D1 outcome (`not_executed`).
   It must land before anything is allowed to trust `validated`.
3. **D2 third** — once `validationResults` can only hold executed outcomes, most
   of D2 is deletion plus tightening `adaptation-store.ts:161`.
4. **D5 fourth**, and **D4 last**. Both change *which* failures reach the model.
   Landing either before 1-3 means wiring the gate to a corpus of adaptations
   marked `validated` that were never verified — the loop would confidently skip
   the LLM on the strength of the very records these defects fabricate. Doing
   them last also means their tests are written against honest outcomes.

**File contention:** D1, D2, D3 and part of D5 all edit
`AS/runtime/live-patch.ts`. They are **serial work for one worker**, not
parallelisable by file. D4 (`service.ts`) and D5's `conversions.ts` /
`adaptive-orchestrator.ts` edits can be a second worker, but only after step 3
lands. Note extraction's Core K4c.1-2 also edits `service.ts` — that collision is
real and is the supervisor's to sequence.

---

## Commands run and observed results

```
node --version                                    → v22.11.0
cp AS/runtime/live-patch.ts <scratch>/probe/live-patch-copy.ts   (unmodified copy)
node --experimental-strip-types run-probe.ts      → exit 0, "ALL EXPECTATIONS MATCHED"
```

Scratch probe (outside both repositories, nothing installed into either):
`C:\Users\mrjoh\AppData\Local\Temp\claude\f---FluxIQWebExtension\3454178a-dd53-4d6d-917d-85b8f63d0d91\scratchpad\probe\`

- `live-patch-copy.ts` — byte-for-byte copy of Core's `live-patch.ts`, **not edited**.
- `executor.ts`, `llm/index.ts` — stubs for the two value imports, so the copy runs
  unmodified. Only the graph run is stubbed; all logic under test is Core's own.
- `run-probe.ts` — the scenarios; 19 expectations, all matched.

The stub returns `{ status: "succeeded", ... }` for the rerun, which is the
honest representation of "the patched rerun happened to succeed" — the exact
precondition under which defects 1 and 3 fire.

## Not verified

- No repository gate was run (`pnpm check` / `test` / `build`) — the brief
  forbids it and no source changed.
- `validateAutomationStudioFlowAdaptation` was **not** read; whether it requires a
  non-empty `validationResults` is unknown and blocks D2's exact shape.
- The store, promotion and review paths (D2) were traced by reading only; nothing
  was executed against a database.
- The classification path (D5) was not executed; "always empty" rests on
  `conversions.ts:143` being the only production call site.
- I did not enumerate which tests in `runtime/tests/service.test.ts` assert on
  interventions or `llmGate`, so D4's regression surface is unmeasured.
- Real browser/live behaviour was not exercised at all.

## Open questions / contradictions found

1. **The brief's defect 2 overstates the consequence.** Runtime auto-apply is
   blocked by `decideAutomationStudioAdaptationPromotionGate` (high risk, line
   310), a gate the brief does not mention. Should the Current State be corrected
   before the user reviews the plan?
2. **The brief's defect 5 gives the wrong cause.** The signature is a real gap,
   but the binding defect is that no adaptations are passed to the classifier.
   Fixing only the signature would produce no behaviour change and would look
   like a completed fix.
3. **A sixth instance exists:** `temporary_recovery_subflow_call` has the same
   missing application branch as `temporary_action_sequence`. Should it be folded
   into phase D's scope?
4. `reviewFlowAdaptation` returns early for typed-store adaptations
   (`service.ts:4275-4276`), so `evaluateFlowAdaptationPromotionGates` is skipped
   entirely on that path. Is that intentional, or a separate defect?
