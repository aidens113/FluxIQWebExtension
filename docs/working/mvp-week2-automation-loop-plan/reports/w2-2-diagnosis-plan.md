# `w2-2-diagnosis-plan`: separating diagnosis from exploration (Phase 2.2)

Path prefix: `AS/` is Core's `packages/fluxiq/src/programs/automation-studio/`.
Core is `F:\!FluxIQ`; downstream is `F:\!FluxIQWebExtension`.

## Outcome

**Partial**, and the partial part is one clause of the brief that turned out to
be impossible inside the file boundary the brief drew. Everything else is built,
wired, tested and observed passing.

| Brief item | State |
| --- | --- |
| Deterministic diagnosis gate (L5), both clauses | **Done.** No provider call for a known recovery, a matched adaptation, or a policy / auth / user-intervention / graph failure; no patch request unless the diagnosis asks for one |
| Structured LLM diagnosis in place of free text | **Partial.** The structured record exists, is what the rest of the loop reads, and is bounded and tested — but the *model* cannot contribute a field today, because Core strips every structured response's `metadata`. Exact diff below |
| Recovery plan stage driving Phase S's protocol | **Done.** First production caller that passes a `stage`: `gather` → (deterministic `plan`) → `implement` |
| `recoveryTrace` stages and the web UI | **Done.** Four ordered, content-free stages on run metadata; rendered as the first four rows of the run detail's LLM and Adaptation panel |
| Why W13 and W24 report `runtime.behavior` | **Investigated, not fixed.** Neither is a domain classification defect. The cause is in the Lab and in a recording-pipeline rule, both outside my paths and both under another worker's edit right now. Evidence and diffs below |

**Two things need the supervisor before this can be pushed**, and the first one
breaks the Lab at parse level rather than at assertion level. Both are in
`### Owed elsewhere` and each has its exact diff.

`service.ts` is **6757 lines** against its 6757 baseline. No baseline was raised
or lowered.

---

## What changed and why

### Core — the gate now acts on the whole of L5

`AS/runtime/recovery/deterministic-diagnosis.ts` (new) is Stage A: what is wrong,
decided with no provider in reach. It resolves a failure into exactly one of four
answers — `deterministic_recovery`, `known_adaptation`, `manual_intervention`,
`model_required` — and only the last reaches a model.

The classifier already knew all of this. `llmEligibilityForFailure`
(`adaptive-orchestrator.ts:201-212`) has implemented L5 correctly for some time
and, before Phase D, had no production caller at all. Phase D wired the first two
of its refusals through `decideAutomationStudioRuntimeLlmInvocation`; this wires
the rest. Concretely, before this change a run whose failure was
`blocked_by_capability_or_policy`, `external_side_effect_denied`, `auth_required`,
`user_intervention_required` or `graph_validation_or_unknown_node`, or which had a
validated adaptation already matching it, still resolved a provider and billed a
diagnosis call. Now it resolves no provider.

**The drift guard is the part worth keeping.** The classifier carries the
authority and this module carries the vocabulary the rest of the loop reads, so
they must not disagree silently about whether a class reaches a model.
`deterministic-diagnosis.test.ts` walks **every** member of
`AUTOMATION_STUDIO_ADAPTIVE_FAILURE_CLASSES` in all four
candidate × adaptation combinations and asserts
`resolution === "model_required"` matches `llmEligibility.eligible` exactly.

`llm-invocation.ts` still asks `decideAutomationStudioLlmInvocationGate` first and
still acts only on its two deterministic-first refusals, so the sentence a run
records for "a deterministic path must run first" is unchanged from before this
phase. The gate's decision now also carries the diagnosis, so the gate, the plan
and the trace read one classification rather than three.

### Core — a structured diagnosis, and why it is only half a structured diagnosis

`AS/runtime/recovery/structured-diagnosis.ts` (new) is the record the rest of the
loop reads: `failureClass`, `candidateKind`, `stillAchievable`,
`deterministicRecoveryPossible`, `explorationNeeded`, `patchNeeded`, `confidence`,
plus `expected`/`observed`/`changed` descriptions, `modelFields` saying what the
model actually supplied and `refusals` saying what was refused and why.

Two rules shape it.

**The deterministic answer is the default, and a model may narrow it, not
overturn it.** Where Core knows a person must act — `auth_required`,
`user_intervention_required` — a model claim that the goal is still achievable is
refused and the refusal is recorded. A model may say "no patch is needed" when
Core assumed one was, because that only reduces what happens; it may not talk
Core past a control.

**What is recorded is not what is carried.**
`summarizeAutomationStudioRuntimeStructuredDiagnosis` produces the verdicts,
counts and provenance that go onto the run, and never the model's prose. The
prose is the model's reading of a page whose contents Core deliberately does not
store; quoting it back onto a run record would be a second copy of the page under
another name. This is `recovery-context-summary.ts`'s rule, followed for the same
reason, and a test asserts no fragment of a model description reaches
`metadata.llmGate` or `metadata.recoveryTrace`.

**The limitation, stated plainly.** `parseAutomationStudioLlmProviderResult`
(`AS/runtime/llm/harness/provider-result.ts:37`) calls
`stripAutomationStudioLlmResponseMetadata`
(`harness/structured-response.ts:102-105`) on every response, so a `diagnosis`
reaches the runtime as `summary` and `confidence` and **nothing else**. That is
deliberate and correct — it stops a model smuggling arbitrary JSON past the
recognized-field allowlist — and it means there is no channel through which a
model can supply a structured field today. Both files are in `AS/runtime/llm/**`,
which this brief forbids. So in the shipped app `modelFields` is empty and every
verdict is Core's own. The reader is written against the shape the diff below
enables, it is tested directly, and a service-level test pins the fact that Core
strips the channel, so the day the diff lands that pin fails and somebody updates
it on purpose.

**Even with the channel closed, L5's second clause is now enforced.** A
`diagnosis_only` or `instruction_suggestion` candidate kind means the failure's
answer is a report, not a change to the Flow, so no patch is requested. Before
this, the patch fired for those too.

### Core — a recovery plan, and the first caller to pass a stage

`AS/runtime/recovery/recovery-plan.ts` (new) is Stage B and is **deterministic**:
it reads the structured diagnosis and the adaptation policy, and costs no
provider call. That is L5's ordering applied to planning itself — the cheaper
answer here is a candidate kind the classifier already produced and policy flags a
person already set.

A patch is requested only when three things hold, each with its own recorded
sentence: the diagnosis call succeeded and returned a diagnosis (Phase D's rule,
reused rather than restated), the diagnosis says a patch or exploration is needed,
and the policy permits at least one patch kind that could serve this failure.

The allowed kinds are narrowed twice — by candidate kind, then by the same policy
flags `preflightAutomationStudioRuntimePatch` enforces later.
`recovery-plan.test.ts` runs the **real preflight** for each of the three
policy-gated kinds and asserts the plan's refusal sentences are character-for-
character the preflight's own, so a plan can never ask the model for a kind the
preflight will refuse.

**The stages, as the harness now sees them:**

| Harness call | `stage` | `previousStage` | Provider |
| --- | --- | --- | --- |
| `runtime_diagnosis` | `gather` | — | yes |
| *(the plan)* | `plan` | — | **no** |
| `runtime_patch` | `implement` | `plan` | yes |

The plan stage is real work that happens between the two calls and costs nothing,
which is the whole point of the phase; `previousStage: "plan"` on the patch call
is the protocol being told so. `automationStudioLoopStageTransition` accepts
`plan → implement`, and a test observes the two outbound requests carrying
`context.stage` of `gather` and `implement`.

### Core — `recoveryTrace`

`AS/runtime/recovery/recovery-trace.ts` (new) owns the closed vocabulary
`diagnosis | recovery_plan | exploration | resolution`, the ordering rule and the
prerequisites: exploration and resolution each require an earlier
`recovery_plan`. An out-of-order or repeated event is **dropped and the drop
recorded** in `refused`, never sorted into place — sorting it would invent a plan
that never happened. The builder returns rather than throws, because it runs
while annotating a run that already failed and that run must not be lost twice to
a bookkeeping error.

`AS/runtime/recovery/recovery-stages.ts` (new) assembles those four events from
one run's outcome, so the deterministic early return and a full patch attempt
cannot describe themselves in two different ways.

Three properties are deliberate:

- **Content-free.** Stage, status, a Core-authored reason, and counts. Never a
  model's prose, a page's contents or a repair target. A Lab assertion or a
  person reading the run a week later can read all of it safely.
- **`providerCalled` is the deterministic-first receipt.** A reader can tell from
  the trace alone whether a model was asked, and for which protocol stage.
- **Nothing says "succeeded".** The resolution event names what was *produced* —
  an adaptation, a proposal, a deterministic action to run, nothing — and never
  that the recovery worked. Whether it worked is a verdict from evidence observed
  afterwards, which is 2.4's, and claiming it here would be this plan's own
  Phase D defect in a new place: success recorded from the absence of
  contradicting evidence.

Only `diagnosis` (`gather`) and `recovery_plan` (`plan`) carry a loop stage
always; `resolution` carries `implement` only when a patch call was actually
made, and `exploration` carries none at all, because nothing drives it until 2.3.
Naming a protocol stage for work that did not happen would put a claim in the
record that no call backs up.

### Core — `service.ts`, at exactly zero net lines

The file may not grow, so every new statement replaced an existing one:

- the invocation decision now also returns the diagnosis (same line);
- `stage: "gather"` rides on the `taskKind` line of the diagnosis call, and
  `stage: "implement", previousStage: "plan"` on the patch call's;
- `decideAutomationStudioRuntimePatchRequest(result)` became
  `planAutomationStudioRuntimeRecovery({ … })`, one line for one line — the
  chain decision is now made **inside** the plan, so Phase D's rule is reused and
  not duplicated;
- `metadata.recoveryTrace` and `llmGate.structuredDiagnosis` ride on existing
  lines.

All four early returns that can carry one now record a trace: the deterministic
refusal, provider-resolution failure and failure-evidence failure each get a
diagnosis-stage event with `providerCalled: false`. The one path that does not is
the mode/budget refusal, which returns before the gate has run; adding it would
need the diagnosis computed earlier, which would grow the file.

### Core web UI — the four stages

`apps/web/src/features/automation-studio/runtime/run-detail-model.ts` gains
`runtimeRecoveryStageEvents`, and `runtimeLlmAdaptationEvents` now leads with it.

"LLM", "Patch Test", "Adaptation" and "Retry" name the *mechanics* — which call
was made, which array it landed in. They cannot distinguish a run where the model
was deliberately not asked from one where nothing happened. The four stages say
what the loop was doing, each with a plain title read from the trace's counts
(`Target not found`, `Apply known recovery`, `No exploration needed`,
`Deterministic recovery required`) and a `note` that reads either
`No model call` or `Model called for the "gather" step of the loop`. That note is
the one place a person can see L5 working. `RunDetailPanels.tsx` gained one
`<span>` and no new component, so its baselined component count is unchanged.

### Downstream — nothing changed, deliberately

I own `domain/src/runtime/**` and found **no defect there to fix**. The W13 and
W24 investigation below shows both domain classifications are correct. Editing
the domain to make a wrong Lab expectation pass would have been the wrong repair.

---

## W13 and W24: why they report `runtime.behavior`

### The category is the runner's, not the domain's

`packages/test-runner/src/flow-lane/expectations.ts:39-52`. `assertFlowFailure`
throws `RunnerFailure("runtime.behavior", …)` for **every** mismatch between a
workflow's `expected.failure` and the run's structured failure record — four
distinct outcomes under one name:

| line | outcome |
| --- | --- |
| `:41` | a failure was reported and none was expected |
| `:45` | no structured failure at all, and one was expected |
| `:48` | a failure of the wrong category |
| `:51` | the right category with the wrong code |

The domain's actual answer is in `details.actualCategory` /
`details.expectedCategory`, never in the category column. So "W13 and W24 fail 6/6
as `runtime.behavior` instead of `output_not_observed`"
(`cb-blocker-ranking-final.md:103,105`) does not say the domain classified
anything wrongly; it says the classification did not match, and the column cannot
say more. **Every conclusion drawn from that column alone about the domain's
classifier is unsupported.**

### W24 `unannounced` — the Flow contains nothing that observes the output

W24 is a negative variant expecting `output_not_observed`
(`apps/scenario-lab/src/scenarios/intermediate-state/scenario.ts:64`).

Its only observation of the result is
`{ id: "await-result", operation: "waitForState", target: "testid:claim-result", timeoutMs: 5000 }`
(`scenario.ts:35`). **`waitForState` records no action.**
`scenario-steps/step-runner.ts:119` performs a Playwright wait and returns `{}`,
and `run-evaluation/tests/runner-wiring.test.ts:250-251` states the rule as live
contract: `flowLaneExclusion` refuses a script of only `waitForState`,
`checkpoint` and `waitForDownload` precisely because none of them records
anything.

So the Flow built from W24's recording is `type, type, click` and nothing else.
The click's post-condition is the hit test
(`apps/extension/src/content/actions/click.ts:14-18`), which **succeeds** in
`unannounced` mode: the click landed on the submit button, and the confirmation
step appearing afterwards is not something the click claims anything about.
Nothing in the Flow waits for or asserts the result, so nothing fails, and
`expectations.ts:44-45` fires — "The Flow reported no structured failure, expected
output_not_observed".

**The domain cannot report `output_not_observed` for an output that nothing in
the Flow observes.** That is not a classifier defect; the Flow is missing a
post-condition.

There is a second obstacle behind the first, worth recording because it will bite
whoever fixes the first one naively. If `waitForState` were recorded as a wait
node, the run would report **`timeout`**, not `output_not_observed`:
`apps/extension/src/content/action-runtime/results.ts:214-230` reports a wait that
ran out of time as `status: "timed_out"` with `WEB_AUTOMATION_FAILURE_CODES.TIMEOUT`,
and `domain/src/runtime/failure/classify.ts:86-91` reads the status **first**, with
the comment "a wait that ran out of time also leaves a failed validation behind,
and `timeout` is the better name for it". Getting `output_not_observed` requires
the post-condition to ride on the **click** — a non-wait, non-assert action whose
validation fails (`classify.ts:89-91`).

**The fix, and why I did not make it.** W24 needs the recording pipeline to turn
`await-result` into a post-condition on `submit-claim` rather than into nothing.
That spans `packages/test-runner/src/scenario-steps/`, the scenario contract in
`packages/test-contracts`, and `domain/src/recording/`. Only the last is mine,
and a domain-only change cannot create a post-condition the recording never
emitted. `packages/test-runner` and `packages/test-contracts` both have
uncommitted edits from another worker right now. The alternative — changing the
manifest to expect `timeout` — is wrong: it would delete the plan's only
`output_not_observed` case rather than fixing it.

### W13 `banner-absent` — the domain is right and the loop is what is missing

W13 `banner-absent` is a **positive** variant: `expected: { finalState: [...publishedFacts] }`
with no `expected.failure` (`apps/scenario-lab/src/scenarios/modal-flows/manifest.ts:52-57`),
and `bench/tests/week1-corpus.test.ts:36` lists it under `PLAN_POSITIVE_VARIANTS`.
Its own description says what happens: *"The consent banner never renders, so the
recorded dismissal has no target; the run must still publish the draft."*

The recorded Flow is `click testid:consent-accept` then `click testid:publish-draft`
(`manifest.ts:41-45`). With the banner removed, the first click's target does not
exist, so the domain reports `target_not_found` — which is **correct**, and is
exactly what the plan's own vocabulary asks for. `expectations.ts:41` then turns
"an unexpected failure" into `runtime.behavior`.

W13 does not need a classification change. It needs the loop to recognise a
recorded step whose target is gone and whose effect already holds, and skip it.
That is Phase 2.2-2.5 work — it is the canonical `recovery_path_or_reroute` case
— and it is what this phase's plan stage is the first half of. **W13 is a loop
exit criterion, not a defect.**

### Fixes I recommend, none of them small and none of them mine

1. **Make the mismatch readable.** `runtime.behavior` should not be the name for
   four different classification outcomes. Either add a
   `classification.mismatch` member to `packages/test-contracts/src/evaluation.ts:19`'s
   `failureCategories` and use it at `expectations.ts:41,45,48,51`, or have
   `bench/evaluate-run.ts` carry `details.actualCategory` into `failureCause` so
   the bench table shows the domain's answer. Until one of them lands, the
   category column will keep producing findings like W2-1 that are not findings.
2. **W24:** record the post-condition, per above.
3. **W13:** leave it; it passes when the loop can skip a vacuous recorded step.

---

## Owed elsewhere — two blocking items, with their diffs

### 1. The staged prompt version breaks the Lab's run-detail parser (blocking)

Phase S made `promptVersion` `<version>+stage.<stage>`
(`AS/runtime/llm/harness/context-packet.ts:73`). This phase is the first caller to
stage anything, so from now on every runtime diagnosis records
`automation-studio.runtime-diagnosis.v1+stage.gather` and every runtime patch
`automation-studio.runtime-patch.v1+stage.implement`.

**`packages/test-runner/src/existing-fluxiq-control.ts:416` rejects the `+`.**

```ts
if (parsed.length > 200 || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(parsed)) invalid(`${at}.${field} is invalid`);
```

`promptVersion` goes through that guard at `:421`, so parsing any run detail with
a staged intervention **throws** rather than merely mismatching. This is a hard
break of every lane that reads run details through that module, not an assertion
failure. One character:

```ts
if (parsed.length > 200 || !/^[A-Za-z0-9][A-Za-z0-9._:+-]*$/u.test(parsed)) invalid(`${at}.${field} is invalid`);
```

Four equality assertions then need the staged strings. Each is a literal swap:

- `src/demo-llm-adaptation.ts:308` — both `requireLiteral` calls.
- `src/demo-llm-exploration-adaptation.ts:74` — the `prompt` ternary.
- `src/demo-llm-live.ts:74` — `intervention.promptVersion !== "automation-studio.runtime-diagnosis.v1"`.
- `src/demo-workspace/adaptation-ui.ts:141-144` — `expectedPromptVersion`.

I did not make these: `packages/test-runner` is not in my owned paths and has
uncommitted edits from another worker. **None of the downstream suites fail
today** — they all build their own fixtures with the old literals — so this is a
latent break that only a live Lab run surfaces. It must land in the same work
unit.

### 2. Core's `gather` stage instruction is the evidence loop's tool policy

`AS/runtime/llm/stages/instructions.ts:69` makes Core's default `gather`
instruction `AUTOMATION_STUDIO_LLM_EVIDENCE_DECISION_INSTRUCTION` verbatim. That
text is about tool calls — *"When the decision schema offers a complete variant,
evaluate it first"*, *"Never repeat the same toolId with the same input"*,
*"Do not select a tool merely because one remains available"*. The runtime
diagnosis call carries **no tools**, so roughly two thirds of that ~1,400-character
instruction is inapplicable and one sentence refers to a schema that is not there.
It is now sent on every runtime diagnosis.

It is prose, not a control, so this is a quality problem rather than a safety one,
and I staged the call anyway because the ordering statement and the stage
versioning are worth more than the noise costs. The fix is in `llm/**`:

```ts
// stages/instructions.ts
gather: coreStageInstruction("gather", "Gather information and explore",
  "Establish what is actually true before deciding anything. Prefer observing over changing. Say what you could not determine rather than assuming it. Complete as soon as what you have is enough to produce the result asked for."),
```

and the tool policy is appended to the `gather` resolution only when the request
carries an evidence loop — `automationStudioLoopStageInstructions(stage, registry)`
gaining a third argument, or `context-packet.ts:79` passing
`input.evidenceLoop ? [...] : []`. That keeps exactly one copy of the tool text
and stops sending it to a request with no tools.

### 3. The structured diagnosis channel (not blocking, but it is what makes 2.2 whole)

Four edits in `AS/runtime/llm/**` turn the structured diagnosis from Core's own
verdicts into the model's:

1. `harness/structured-response.ts:9` — add a recognized field to the variant:

   ```ts
   | { kind: "diagnosis"; summary: string; confidence?: number; diagnosis?: AutomationStudioLlmDiagnosisFields; metadata?: JsonObject }

   export type AutomationStudioLlmDiagnosisFields = {
     expected?: string; observed?: string; changed?: string;
     stillAchievable?: "yes" | "no" | "unknown";
     deterministicRecoveryPossible?: "yes" | "no" | "unknown";
     explorationNeeded?: boolean; patchNeeded?: boolean;
   };
   ```

2. `harness/structured-response.ts:105` — preserve it through the strip, which
   must stay a **named-field allowlist** and not become "keep metadata":

   ```ts
   if (response.kind === "diagnosis") return { kind: response.kind, summary: response.summary, ...(response.confidence !== undefined ? { confidence: response.confidence } : {}), ...(response.diagnosis !== undefined ? { diagnosis: response.diagnosis } : {}) };
   ```

3. `harness/provider-result.ts:59` — `[...commonFields, "confidence", "diagnosis"]`,
   plus a validator beside the confidence check at `:71` bounding each string to
   500 characters and each enum to its three values. The bounds already exist as
   `AUTOMATION_STUDIO_STRUCTURED_DIAGNOSIS_TEXT_MAX_LENGTH` and the readers in
   `recovery/structured-diagnosis.ts`, so this is the same rule stated where the
   response is parsed.
4. `deepseek-provider.ts` — the diagnosis response schema gains a `diagnosis`
   object with `additionalProperties: false`, and the prompt asks for it.

Then in `AS/runtime/recovery/structured-diagnosis.ts`, one line changes:

```ts
const reported = isRecord(response.metadata) ? response.metadata : {};
// becomes
const reported = isRecord(response.diagnosis) ? response.diagnosis : {};
```

and `tests/service-adaptation/tests/recovery-trace.test.ts`'s last test — the one
that currently pins `modelFields: []` — is updated to assert the fields arriving.

### 4. Core's architecture document is now stale

`F:\!FluxIQ\docs\architecture\automation-studio.md:618-622` says a runtime patch
request needs only a `diagnose_and_adapt` grant, and gives the `diagnosis_only`
lane's adaptation-creation switch as the only reason a patch is not sent. Three
more reasons now exist, all in this phase: the diagnosis resolved deterministically,
the diagnosis asked for neither a patch nor exploration, and the policy permits no
patch kind for the candidate kind. The same section should record that runtime
diagnosis and runtime patch now carry loop stages and that
`metadata.recoveryTrace` exists. `docs/` is not in my owned paths and the file has
another worker's edits in the tree, so I did not touch it.

---

## Commands run and observed results

All Core commands from `F:\!FluxIQ`, downstream from `F:\!FluxIQWebExtension`.

```
npx tsc --noEmit -p packages/fluxiq            -> TSC_EXIT=0, no output
npx tsc --noEmit -p apps/web                   -> TSC_WEB_EXIT=0, no output

npx vitest run src/programs/automation-studio/runtime --root packages/fluxiq --no-file-parallelism
  -> Test Files  90 passed (90)
     Tests      788 passed (788)
     Duration   281.14s
     (the brief's baseline was 84 files / 726 tests; +6 files, +62 tests, all mine)

npx vitest run src/features/automation-studio/runtime/tests --root apps/web
  -> Test Files  7 passed (7)
     Tests      44 passed (44)

node scripts/structure-audit.mjs
  -> structure-audit: passed (139 warning(s), 254 baselined).
     AUDIT_EXIT=0
     (139/254 is exactly what it read before this phase's first edit; no new
      finding against recovery/, and no baseline moved)

wc -l packages/fluxiq/src/programs/automation-studio/runtime/service.ts
  -> 6757    (baseline 6757)
```

Downstream:

```
domain> npm run check                          -> CHECK_EXIT=0, no output
domain> npm test                               -> # tests 494  # pass 494  # fail 0
                                                  TEST_EXIT=0
node scripts/structure-audit.mjs               -> structure-audit: passed (56 warning(s), 17 baselined).
                                                  AUDIT_EXIT=0
```

No downstream source changed, so those two are baselines rather than
verifications of my work.

### Failures I hit and what each was

Three, none environmental, all resolved and re-run clean:

1. **`llm-diagnosis.test.ts:37` found no intervention.** It looks one up by
   `promptVersion === "automation-studio.runtime-diagnosis.v1"`, which a staged
   call no longer produces. Updated to the staged string, with a comment saying
   a bare task-kind match no longer matches a staged call, by design. 8/8 pass.
2. **`runtime-patches.test.ts:85` observed zero provider calls.** Its fixture
   used `definitionId: "unknown.confirmation"`, which L5 now classifies as a
   graph failure and refuses to ask a model about — so the test, whose subject is
   the explicit grant's proposal path, never reached a provider. **This is the new
   gate working, not a regression.** The node became `builtin.math.divide`, which
   exists and fails at run time, with a comment saying why; the graph refusal has
   its own test now. 3/3 pass.
3. **Two of my own service-level tests were wrong about the fixtures, not about
   the code.** One asserted a second provider call that the run budget refuses
   when a stub returns no `usage` (the first call then reserves the whole per-run
   allowance); the other asserted a model-supplied field, which is how I found
   the metadata strip. Both corrected against observed behaviour, and the second
   became the pin on the closed channel described above.

---

## Not verified

- **No live provider and no live browser.** Every provider here is a stub.
- **The Lab was not run.** W13 and W24's current behaviour is derived from source
  — the manifests, `step-runner.ts`, `expectations.ts`, the extension's result
  builders and the domain classifier — and not from a bench run. The reasoning
  chain for each is given above with file:line so it can be checked cheaply, but
  **neither conclusion rests on an observed run**, and the W24 one in particular
  predicts "no structured failure at all", which a single Flow-lane run would
  confirm or refute outright.
- **`pnpm check`, `pnpm test` and `pnpm build` were not run whole** in either
  repository. Other workers have uncommitted edits in `packages/test-runner`,
  `packages/test-contracts` and Core's `docs/`, so a whole-repository gate would
  not attribute cleanly. The package type checks, the owned suites and both
  audits were run directly.
- **`apps/web`'s full suite was not run**, only the `automation-studio/runtime`
  feature tests plus the package type check.
- **Core's `dist/` was not rebuilt**, so the downstream type check and suite ran
  against the previously built Core. Nothing in this phase changes a type the
  domain imports — `recoveryTrace` is run metadata — but the domain has not been
  compiled against the new Core sources.
- **`loop_plan` and `loop_verification` are still never requested.** The plan
  stage is deterministic, so it makes no call; `iterate` and `verify` have no
  caller at all. Three of the protocol's five stages remain unexercised in
  production.
- **Exploration is a recorded stage with nothing behind it.** Every run records
  it as `skipped`. 2.3 gives it something to do.
- **No host registers stage instructions**, so every stage is Core's default,
  including the `gather` mismatch described above.

---

## Open questions and contradictions found

1. **A flow's `allowRuntimeRecovery: false` did not reach the runtime policy.**
   Writing `adaptationPolicySettings.allowRuntimeRecovery = false` into the flow
   metadata through `createFailingCanonicalFlow` left
   `context.policy.allowRuntimeRecovery` true at run time — observed directly:
   the plan reported `allowedPatchKinds: ["temporary_target_override",
   "temporary_wait_retry"]` and `policyRefusalCount: 0`. `adaptationPolicyFromFlowMetadata`
   (`service.ts:6506-6523`) reads the flag and other flags from the same object
   *do* take effect, so something between the parent flow's metadata and the
   subflow graph the run executes is dropping it. If that is real rather than a
   fixture mistake of mine, **`preflightAutomationStudioRuntimePatch`'s own
   `allowRuntimeRecovery` refusal is equally unreachable from flow metadata**,
   which would be a policy-enforcement gap rather than a test inconvenience. I
   dropped the service-level test that depended on it and kept the unit
   coverage; this wants ten minutes from whoever owns `service.ts` next.
2. **`temporary_wait_retry` and `temporary_action_sequence` have no policy gate
   at all** in `preflightAutomationStudioRuntimePatch` (`live-patch.ts:88-93`).
   My plan mirrors that, because a plan that refused what the preflight allows
   would be the wrong kind of disagreement. But a wait/retry patch changes an
   expectation's timing, and `allowModifyExpectations` exists and governs nothing
   here. Worth a decision: either the flag is meaningless for runtime patches, or
   the preflight is missing a gate.
3. **`resolution.providerCalled` means "a patch call was made", which is not
   quite "a provider answered".** The harness can refuse the call on budget after
   the coordinator makes it, as it did in one of my runs. The trace then reads
   `providerCalled: true` with `patchAttemptCount: 0`. That combination is
   readable and is not wrong, but if the Lab asserts on `providerCalled` as a
   billing signal it will over-count.
4. **The recovery trace duplicates facts `llmGate` already carries** —
   `patchSkipped`, the adaptation count. I left both, because `llmGate` is what
   existing consumers read and the trace is what new ones should. They are
   written from the same values in one place, so they cannot disagree, but this
   is a seam somebody should close once the web UI and the Lab both read the
   trace.
5. **`stillAchievable` is `no` only for `auth_required` and
   `user_intervention_required`.** `blocked_by_capability_or_policy`,
   `external_side_effect_denied` and `graph_validation_or_unknown_node` all
   resolve to `manual_intervention` but report `unknown`, because a policy flag
   or a graph edit could change and make the goal reachable again, whereas a
   sign-in cannot be automated away. That is a judgement and it is worth a second
   opinion.

---

## Working tree, so the supervisor is not surprised by the diff

**Core.** Eleven files are mine: five new modules and five new test files under
`AS/runtime/recovery/`, one new service test, the barrel, `llm-invocation.ts`,
`service.ts`, two existing tests I corrected, and the three
`apps/web/.../runtime/` files. `docs/operations/data-and-state.md` is modified in
the tree and is **not** mine.

**Downstream.** The only file I wrote is this report. Everything else in the
downstream tree belongs elsewhere:

- `apps/extension/build/**` — a rebuild whose content is about extraction inputs
  (`web.user.value_extraction_defined` being removed), which is another worker's
  brief, not this one.
- `domain/src/tests/w2probe.test.ts` — untracked, its own first line says
  *"TEMPORARY diagnostic probe (w2-recording-proposal-gap). Deleted after use."*
  Another worker's, created during this session. I did not touch it, and it may
  have been picked up by my `npm test` run, so **the downstream 494/494 is not a
  clean baseline** — it may include that probe's tests and it ran against
  whatever that worker had on disk at 00:00.
- `domain/.test-build/**` — regenerated by running `npm test`, which is the
  sanctioned way to update it. Some or all of that diff is mine as a consequence
  of running the suite; none of it was hand-edited.
