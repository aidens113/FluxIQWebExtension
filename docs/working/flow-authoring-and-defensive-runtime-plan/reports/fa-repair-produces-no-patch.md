# t113 — a validated diagnosis that produced no patch, and said nothing about it

Worktree: `F:/fxwork/t113/!FluxIQWebExtension` paired with `F:/fxwork/t113/!FluxIQ`,
both on `task/t113-repair-produces-no-patch`. No Lab run, campaign or provider
call was made. Nothing was committed.

Subject: `test-runs/run-muesyox4-930bef98`
(`everything-store-first-page-plus-earbuds`, `deepseek-flash`, 33 provider
calls, 407,352 tokens, $0.0387, 311s).

## What the run actually did, step by step

The Flow had seven nodes. From `snapshots/flow-lane.json` `actions` and
`run.json`:

| # | node | action | result |
| --- | --- | --- | --- |
| 1 | `…main.s1` | `web.browser.navigate` | succeeded, `matched` |
| 2 | `…main.s2` | `web.dom.click` | **failed** `web.target.not_found`, selector `#\:r13b8o\: > div > div:nth-of-type(2) > button:nth-of-type(1)`, "nothing matched; 6 control(s) of the same family are on the page; best scored -0.12" |
| 3 | `…main.s2` | retry 2/3, `retry_node` rung | **failed**, same selector, same evidence |
| 4 | `…main.s2` | retry 3/3, `retry_node` rung | succeeded — resolved by **selector**, candidateCount 1, bestScore 0.643 |
| 5 | `…main.s3` | `builtin.control.merge` | succeeded |
| 6 | `…main.s4` | `web.dom.type` | succeeded |
| 7 | `…main.s5` | `web.dom.click` | succeeded, bestScore 1.0 |
| 8–10 | `…main.s6` | `web.dom.click` ×3 | **failed** `web.target.not_found`, selector `main > div:nth-of-type(2) > aside > div:nth-of-type(1) > a`, "nothing matched; **0 control(s) of the same family are on the page**", fingerprint strategy, candidateCount **0** |

The extraction node (`…main.s7`, `web.dom.extract_list`) never ran:
`evaluation.json` records `extraction[0].status: "not_run"`, 0 of 16 expected
records.

**The failure the model was asked about is not the repairable one.** The
React-id selector failures on `s2` — the ones with six same-family controls —
were recovered deterministically by the ladder's `retry_node` rung and never
reached a model. `annotate.ts` picks the *last* failed attempt
(`[...actionAttempts].reverse().find(status failed|unknown)`), which is `s6`,
whose evidence says zero controls of the same family and zero fingerprint
candidates. So the "most repairable failure there is" was handled without the
model, and the one the model saw looked, from its evidence packet (819 and 827
bytes — a nearly empty page), like a page that no longer has the thing at all.

The whole recovery was **one pass**: `harnessActivations: 2` is the intervention
count, not two activations (`persisted-flow-run.ts:553`,
`harnessActivations: interventions.length`). `snapshots/live-llm.json` `repair`
records `calls: 1`, one `runtime_diagnosis` at stage `gather`, `validationOk:
true`, 4,641 tokens, $0.0016 — against a grant of 48 calls, 600,000 tokens and
$2. The loop stopped with 47 calls of headroom.

## 1. Why the first diagnosis "failed validation" with an empty code list

**Nothing rejected it. It is not a model answer at all.**

The run detail served to the Lab is assembled by
`runtimeSessionToFlowRunDetail` (Core,
`runtime/service/summaries/conversions.ts`) and then handed to `annotate.ts`,
which appends its own interventions. The first of the two therefore comes from
Core's executor, not from a provider — which is why `live-llm.json` records one
provider call and two interventions.

`runtimeInterventionsFromRecoveryAttempts` writes one intervention per attempt
whose recovery ladder selected its `llm_diagnosis` rung
(`recovery-ladder.ts:93`, the last rung: "No lower-priority deterministic
recovery fully resolved the failed transition"). It wrote:

```ts
validation: { ok: false, issues: ["LLM diagnosis provider is not configured in this runtime slice."] },
```

Two defects in one line.

- **The issue carries no code.** Every other issue Core writes onto an
  intervention is `"<code>: <message>"`, and every reader takes the code and
  drops the message. The Lab's parser extracts it with
  `/^([a-z][a-z0-9_.-]{1,127})(?::|$)/u`
  (`packages/test-runner/src/existing-fluxiq-control.ts`, `runIntervention`),
  and a sentence beginning with a capital letter matches nothing, so
  `validationCodes` came out `[]` and the field was then omitted entirely.
  `{ validationOk: false, validationCodes: [] }` reads as "something rejected
  it and would not say what".
- **The sentence was false in this run.** A provider *was* configured; it was
  called moments later and its answer validated. This is the executor recording
  a ladder selection it does not itself answer.

Fixed in Core, `runtime/service/summaries/conversions.ts`: the issue now reads

```
recovery.ladder_diagnosis_unanswered: The recovery ladder exhausted its deterministic
rungs and selected its LLM diagnosis rung. The executor records the selection and calls
no provider; the run's recovery stage is what answers it.
```

`AUTOMATION_STUDIO_LADDER_DIAGNOSIS_UNANSWERED_CODE` is exported so the test
asserts the constant rather than a copy of the string. `ok: false` is kept: the
rung was selected and, at that point, unanswered. What changed is that it now
*says so*. This was the only intervention issue in Core's source without a code
prefix (`grep "issues: \[" packages/fluxiq/src`, excluding tests).

## 2. Why the validated diagnosis produced no patch attempt

`llmGate.patchSkippedCode` in the run's own artifacts
(`snapshots/live-llm.json`, `events.ndjson` sequence 3) is
**`llm.runtime_patch_not_requested`**. That code is emitted at exactly one place
(`recovery/annotation/annotate.ts`), for exactly one condition:
`!plan.patchRequest.request`.

`decidePatchRequest` (`recovery/plan.ts`) has five branches that can produce it
— one of which is `decideAutomationStudioRuntimePatchRequest`
(`recovery/diagnosis-chain.ts`) with three of its own, so seven distinct
decisions in all — and before this task **every one of them emitted the same
code**. Working through them against the run's evidence:

| clause | status for this run |
| --- | --- |
| `resolution !== "model_required"` | **Ruled out.** `annotate` returns early on `!invocation.invoke`, and `decideAutomationStudioRuntimeLlmInvocation` sets `invoke: false` whenever `!diagnosis.modelNeeded`, i.e. whenever the resolution is not `model_required`. The diagnosis call was made, so the resolution was `model_required`. |
| chain: no diagnosis / call failed / response was not a diagnosis | **Ruled out.** `runtime_diagnosis` resolves `expectedOutput: "diagnosis"` (`harness/task-kind.ts`), and a different kind is an **error** diagnostic `llm_output.kind_mismatch`, which would make `validation.ok` false. The recorded call is `validationOk: true, validationCodes: []`. |
| `!allowed.length` (policy permits no patch kind) | **Ruled out.** The failure class `target_not_found` maps to candidate kind `action_target_override` (`adaptive-orchestrator.ts`), whose kinds are `temporary_target_override` and `temporary_wait_retry`. The repair ran under a `diagnose_and_adapt` grant (`live-llm.json` `repair.purpose`), and `automationStudioRuntimeAdaptationContextForGrant` forces `allowModifyActionTargets: true`; `allowRuntimeRecovery` defaults to `true` (`service/flow-settings/adaptation-policy.ts`) and nothing in the facility sets it otherwise. A `grantSkip` would also have produced `llm.runtime_patch_grant_scope_refused`, not this code. |
| `stillAchievable === "no"` | **One of the two remaining.** |
| `!patchNeeded && !explorationNeeded` | **The other.** |

**So: a patch was possible, and the model's own diagnosis declined it.** Core's
policy, grant and classifier all allowed a `temporary_target_override` on that
node; the structured diagnosis fields the model returned stopped the request
before any patch call was made.

Which of the two fields did it is **not recoverable from this run's artifacts**,
and that is itself the defect. Core does record the sentence
(`llmGate.patchSkipped`), but the Lab deliberately carries no sentences into a
bundle, and the one code it does carry covered both clauses — plus three others
that mean something entirely different. Inference, not evidence: given that the
model was shown a page with zero same-family controls,
`stillAchievable: "no"` is the likelier of the two.

Two further observations from the same trace, both material:

- **A single unverified model field ends the loop.** `structured-diagnosis.ts`
  refuses a model's `yes` over Core's `no` and records the refusal, but accepts
  the model's `no` over Core's `unknown` with no scrutiny at all. `plan.ts` then
  makes that the end of the recovery. The safeguard is asymmetric in the
  direction that costs repairs.
- **The refusal was never checked against the page.** `annotate.ts` gates the
  exploration on `plan.explorationRequested && plan.patchRequest.request`, so
  the moment the plan asks for no patch the exploration is cancelled too. That
  directly contradicts the comment in `plan.ts`
  ("cancelling the look because the verdict is already 'no' would make the
  refusal one the model could not check before giving it"), and it is *pinned*
  by an existing Core test ("does not spend an exploration call when diagnosis
  requests exploration but no patch"). It is a deliberate cost decision whose
  consequence is that the model's unchecked "the goal is gone" is final. See
  **What I did not change**.

## 3. Why `refusalCode` was null

Because the field could not be set for this shape of run. Two mechanisms, both
in the facility.

`packages/test-runner/src/flow-lane/harness-recovery.ts` computed it as

```ts
refusalCode: attempted ? null : gateRefusalCode(runDetail)
```

and `gateRefusalCode` returned a code only when `llmGate.invoked === false`.
This run had `invoked: true` and two interventions, so **both** conditions
forced `null`. The contract agreed: `harness-recovery-validation.ts` added
`"$.refusalCode must be null when recovery was attempted"`.

The net effect is that the *only* refusal the Lab could ever record was a
recovery that never started. A recovery that engaged, spent a diagnosis call and
then declined — the one outcome that most needs explaining — was the one outcome
that structurally could not be explained. Core had said
`patchSkippedCode: llm.runtime_patch_not_requested` all along; nothing read it.

## What changed

### FluxIQ Core (`F:/fxwork/t113/!FluxIQ`)

- `runtime/service/summaries/conversions.ts` — the ladder's diagnosis
  intervention carries `recovery.ladder_diagnosis_unanswered` and a sentence
  that describes the rung instead of guessing at the deployment. New exported
  constant `AUTOMATION_STUDIO_LADDER_DIAGNOSIS_UNANSWERED_CODE`.
- `runtime/recovery/diagnosis-chain.ts` — new
  `AUTOMATION_STUDIO_RUNTIME_PATCH_SKIP_CODES` (seven codes, one per clause) and
  `AutomationStudioRuntimeRecoveryRung` (`diagnosis | plan | exploration |
  resolution`). `AutomationStudioRuntimePatchRequestDecision` gained `code` and
  `rung`, absent exactly when `request` is true. The three chain refusals carry
  their codes at rung `diagnosis`.
  The codes are shaped `llm.runtime_patch_[a-z_]+` deliberately: the Lab's
  run-detail parser accepts only that shape and **drops anything else
  silently**, so a code outside it would restore the silence.
- `runtime/recovery/plan.ts` — the four plan-side clauses carry their own codes
  and rungs.
- `runtime/recovery/annotation/annotate.ts` — `patchSkippedCode` now uses the
  plan's own code (falling back to the old blanket code), and a new
  `llmGate.patchSkippedRung` names the rung. `patchHeldRung: "resolution"` is
  recorded beside `patchHeldCode`.

Codes now distinguishable where one word stood before:
`llm.runtime_patch_no_diagnosis_requested`, `…_diagnosis_call_failed`,
`…_diagnosis_not_returned`, `…_resolved_without_model`, `…_goal_unachievable`,
`…_diagnosis_asked_for_none`, `…_policy_allows_no_kind`.

### Facility (`F:/fxwork/t113/!FluxIQWebExtension`)

- `packages/test-contracts/src/harness-recovery.ts` — `refusalCode` redefined as
  "why this run got no repair", from the gate *or* the loop; new
  `refusalRung` and `harnessRecoveryRungs`
  (`gate | diagnosis | plan | exploration | resolution`).
- `packages/test-contracts/src/harness-recovery-validation.ts` — the invariant
  changed from "null when attempted" to "null when the recovery **produced**
  something (a patch attempt, an adaptation or a change proposal)", because then
  the lists are the answer. A rung must be one of Core's words and must have a
  code to attribute.
- `packages/test-contracts/src/evaluation.ts` — the `harnessRecovery` doc.
- `packages/test-runner/src/existing-fluxiq-control.ts` — `ExistingRunLlmGate`
  gained `patchSkippedRung` and `patchHeldRung`, parsed against the closed list
  so a word Core does not own is dropped rather than carried.
- `packages/test-runner/src/flow-lane/harness-recovery.ts` — `gateRefusalCode`
  became `recoveryRefusal`, reading the gate's early-return code, then
  `patchSkippedCode` + `patchSkippedRung`, then `patchHeldCode`. It runs for any
  run that produced no repair, `attempted` or not.
- `scripts/lab/live-campaign/row/repair-outcome.mjs` — the campaign row's
  `refusalCodes` now includes Core's `refusalCode`, and a new `refusedRung`
  carries Core's rung, checked against the closed set like every other word the
  campaign keeps. Before this the campaign row for this run said
  `refusedAt: "no-patch"` with an empty code list — the whole of what a
  campaign could say about a validated diagnosis that repaired nothing.

Had these been in place, the run's evaluation would have read
`refusalCode: "llm.runtime_patch_goal_unachievable"` (or
`…_diagnosis_asked_for_none`), `refusalRung: "plan"`, and its ladder
intervention `validationCodes: ["recovery.ladder_diagnosis_unanswered"]`.

## What I did not change, and why it matters

**The exploration is still cancelled when no patch is requested**
(`annotate.ts`: `plan.explorationRequested && plan.patchRequest.request`). This
is the largest remaining gap and I left it deliberately: an existing Core test
pins it, removing the condition would spend provider calls on an exploration
whose result nothing re-plans from (`patchWillFollow` is computed from the same
`plan.patchRequest.request`), and making it useful means re-planning after
exploring — a real design change, not a fix. **Recommended as the next task**,
because it is the difference between "the model declined" and "the model
declined after looking".

**The asymmetry in `structured-diagnosis.ts`** — a model `no` on
`stillAchievable` is accepted over Core's `unknown` without evidence, while a
model `yes` over Core's `no` is refused and recorded. For a `target_not_found`
whose page still holds same-family controls, accepting the `no` unexamined ends
the loop on the model's word. A cheap first step: refuse or downgrade a
`stillAchievable: "no"` for a failure class whose evidence reports candidates of
the same family, and record the refusal the way the other refusals are recorded.

**t112's selector defect** was not touched.

## What the loop *can* act on

Asked directly, because the brief asks: on this evidence the loop is not dead.
`annotate.test.ts` already contains a passing case — "under a proposal grant,
still makes the patch call for a target that was not found" — where the same
failure class reaches the patch call and produces a change proposal. What
stopped this run was not Core's plumbing but the model's own two-field answer,
accepted without a look at the page, on the one failure of the run that had zero
candidates. The three failures that did have six candidates were resolved by the
deterministic `retry_node` rung and never reached the model at all.

So the loop can act on a `target_not_found` whose diagnosis says the goal is
still reachable and asks for a patch. It cannot act on one where the model says
otherwise, and it currently has no way to check whether the model is right.

## Commands run, and what they printed

In `F:/fxwork/t113/!FluxIQ`:

- `pnpm --filter fluxiq check` → `tsc --noEmit`, no output, exit 0.
- `npx vitest run --poolOptions.forks.singleFork src/programs/automation-studio/runtime/recovery`
  → `Test Files 29 passed (29)`, `Tests 384 passed (384)`.
- `npx vitest run --poolOptions.forks.singleFork src/programs/automation-studio/runtime/service/summaries`
  → `Test Files 5 passed (5)`, `Tests 24 passed (24)`.
- `node scripts/structure-audit.mjs` → `structure-audit: passed (181 warning(s), 360 baselined).`
- `pnpm check` → structure audit passed; `packages/contracts`,
  `packages/client-gateway-websocket`, `packages/fluxiq`, `apps/web` each
  `check: Done`.
- `npx vitest run --poolOptions.forks.singleFork src/programs/automation-studio/runtime`
  → `Test Files 235 passed (235)`, `Tests 2358 passed | 1 skipped (2359)`,
  572.1s. Run twice, before and after the mutation checks; identical both times.

In `F:/fxwork/t113/!FluxIQWebExtension`:

- `pnpm --filter @fluxiq-web-extension/test-contracts test` →
  `# tests 126 / # pass 126 / # fail 0`.
- `node --test tests/harness-recovery-refusal.test.mjs` → `# tests 3 / # pass 3 / # fail 0`.
- `pnpm --filter @fluxiq-web-extension/test-runner test` →
  `# tests 1336 / # pass 1336 / # fail 0 / # skipped 0`. Two of these runs
  overlapped and both reported failures across `dist/bench/**`; `pnpm test`
  begins with `clean` (`rm -rf dist`), so one run deleted the tree the other was
  reading. Re-run alone, green. A single `dist/flow-lane/creation/tests/secrets.test.js`
  failure seen while Core's vitest was running also passed alone — the
  disk-contention flakiness the brief warns about, in both cases.
- `node --test "dist/flow-lane/tests/harness-recovery.test.js"` →
  `# tests 10 / # pass 10 / # fail 0`.
- `node --test scripts/lab/live-campaign/tests/repair-rows.test.mjs` →
  `# tests 1 / # pass 1 / # fail 0`.
- `node --test "dist/tests/existing-fluxiq-control.test.js"` →
  `# tests 22 / # pass 22 / # fail 0`.
- `pnpm lab:test` → `# tests 90 / # pass 89 / # fail 0 / # skipped 1`.
- `pnpm check` → `structure-audit: passed (99 warning(s), 121 baselined).`,
  `# fail 0` for the script suites, and all ten workspace projects `check: Done`.

### Mutation checks

1. **Facility, the central one.** `harness-recovery.ts` reverted to
   `attempted ? { refusalCode: null, … } : recoveryRefusal(runDetail)` →
   `not ok 10 - a recovery that engaged and then repaired nothing states the rung
   that declined and why`, `# pass 9 / # fail 1`. Restored → `# pass 10 / # fail 0`.
2. **Core, the plan codes.** `diagnosis_asked_for_none` collapsed onto
   `goal_unachievable` → `FAIL … gives every reason for not requesting a patch
   its own code and names the rung that decided`, with
   `a diagnosis that asked for nothing: expected 'llm.runtime_patch_goal_unachievable'
   to be 'llm.runtime_patch_diagnosis_asked_for…'`. Restored → 384 passed.
3. **Core, the ladder code.** The code prefix removed from the issue string →
   `FAIL … states a code for the ladder's unanswered diagnosis rung, in the shape
   a reader extracts`, `expected undefined to be 'recovery.ladder_diagnosis_unanswered'`.
   Restored → 5 passed.

### Tests added or changed

- Core `recovery/tests/plan.test.ts` — new "gives every reason for not requesting
  a patch its own code and names the rung that decided" walks all seven clauses,
  asserts a distinct code and a rung for each, and asserts a requesting plan
  names neither. One existing `toEqual` updated for the new fields.
- Core `recovery/annotation/tests/annotate.test.ts` — new "names the rung and the
  code when a validated diagnosis leads to no patch attempt": no patch attempt,
  no adaptation, no proposal, the last intervention validated, and
  `patchSkippedCode` + `patchSkippedRung` both stated. One existing expectation
  updated from `llm.runtime_patch_not_requested` to `…_goal_unachievable`.
- Core `service/summaries/tests/conversions.test.ts` — new "states a code for the
  ladder's unanswered diagnosis rung, in the shape a reader extracts", which
  applies the Lab's own extraction regex and asserts the sentence no longer
  claims a provider is unconfigured.
- Facility `packages/test-contracts/tests/harness-recovery-refusal.test.mjs` —
  rewritten for the new invariant, including a recovery that engaged and
  declined, an older Core that names no rung, a rung with no code, and a refusal
  beside a produced repair.
- Facility `packages/test-runner/src/flow-lane/tests/harness-recovery.test.ts` —
  new "a recovery that engaged and then repaired nothing states the rung that
  declined and why", five gate shapes including an unknown rung word and an
  older Core, plus the ladder intervention reducing to its code, contract
  validation, and the no-free-text check.
- Facility `packages/test-runner/src/tests/existing-fluxiq-control.test.ts` —
  the gate parser keeps `patchSkippedRung` and `patchHeldRung`, and drops a rung
  word Core does not own.
- Facility `scripts/lab/live-campaign/tests/repair-rows.test.mjs` — the campaign
  row carries Core's refusal code and rung, an older Core's code without a rung,
  and a sentence in the code's place travelling as nothing.

## Not verified

- **No live run, campaign or provider call**, as instructed. Nothing here is
  proven against a real DeepSeek repair; the run's own artifacts and unit tests
  are the whole evidence.
- **Which of the two remaining clauses fired in `run-muesyox4-930bef98`.** The
  run's workspace is deleted (`fluxiqExecution.targetMode: "isolated"`), the
  bundle keeps no `structuredDiagnosis`, and the single code covered both. The
  next run of this shape will say.
- **`allowRuntimeRecovery` in that run** was inferred from Core's default and the
  absence of any facility setting, not read from the run.
- **The web UI** (`apps/web`) does not display `patchSkippedRung`; it typechecks
  and nothing there reads `llmGate` skip codes today.
- **A cross-repository build** (`pnpm build`) was not run in either worktree;
  `pnpm check` and the suites above were.

## What Core's paired working document should record

For `F:/fxwork/t113/!FluxIQ/docs/working/flow-authoring-and-defensive-runtime-plan.md`:

1. **Every reason the plan declines a patch now has its own code and rung.**
   `AUTOMATION_STUDIO_RUNTIME_PATCH_SKIP_CODES` in
   `runtime/recovery/diagnosis-chain.ts` is the list; `llmGate.patchSkippedCode`
   and the new `llmGate.patchSkippedRung` are where a run records them. The code
   shape `llm.runtime_patch_[a-z_]+` is load-bearing: a downstream reader drops
   anything else without complaint.
2. **Core's `llmGate` is the run's only durable statement of why nothing was
   repaired**, because an isolated run's workspace is deleted. Anything a person
   or an evaluation must be able to ask afterwards has to be a code on that
   record, never only a sentence.
3. **The ladder's `llm_diagnosis` rung leaves an intervention with `ok: false`**
   and now the code `recovery.ladder_diagnosis_unanswered`. It is a record of a
   rung selection, not a rejected model answer, and its old sentence claimed a
   provider was unconfigured when one was.
4. **Open, and recommended next:** the recovery's exploration is cancelled
   whenever the plan asks for no patch, so a model's `stillAchievable: "no"` ends
   the loop without the page ever being looked at — against `plan.ts`'s own
   stated intent. Paired with it: `structured-diagnosis.ts` accepts a model `no`
   over Core's `unknown` unexamined while refusing a model `yes` over Core's
   `no`.
5. **Measured:** live run `run-muesyox4-930bef98` spent 1 repair call of 48
   granted ($0.0016 of $2) and stopped. The failure it diagnosed was the run's
   last (`0` same-family controls); the three repairable ones (`6` same-family
   controls) were resolved by the deterministic `retry_node` rung and never
   reached the model.
