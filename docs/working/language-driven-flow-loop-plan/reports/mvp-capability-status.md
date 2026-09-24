# MVP Capability Status — deterministic replay, self-repair, self-judgement

Worker report, 2026-09-24. Read-only survey of FluxIQ Core (`F:\!FluxIQ`,
`packages/fluxiq/src/programs/automation-studio/`) and this repository
(`domain`, `apps/extension`, `packages/test-runner`). No code was changed and no
live run was made.

Paths below are relative to
`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\` unless they
say otherwise.

---

## Headline

All three capabilities exist in code and all three are wired into
`service.ts#runRuntimeSession`. None of them is a stub, and none of them is
unreachable in the deployment this repository runs (`pnpm dev` starts Core's
`@fluxiq/web`, so `programs/_shared/runtime.ts` wiring applies).

The honest gaps are not "missing modules". They are four specific seams:

1. **A wrong-answer repair is never re-run inside the run that produced it.**
   The retry is decided before the verification runs, so the "verify, repair,
   retry, verify" circle the code's own comments describe closes across two runs
   of the Flow, not within one.
2. **A repair can only say five things**, and none of them can change what a
   node extracted, which parameter it filtered on, or insert a missing step.
   That is the exact cause class of a wrong answer.
3. **A Flow that stores no records is never judged at all.** Result
   verification is entirely record-set-shaped, so a six-node Flow whose product
   is a state change (searched, filtered, submitted) is recorded
   `core.result.nothing_to_judge` and passes.
4. **The repair is shown a freshly captured page, not the page as it was when
   the run broke** — even though the domain already captures the latter.

---

## Capability 1 — a created Flow runs deterministically

### What exists, and where

**The draft must replay before it may be proposed.** This is the strongest part
of the three capabilities and it is recent.

- `flow-draft/dry-run.ts` — the contract. Four per-step statuses: `replayed`,
  `failed`, `changed`, `unreproducible`.
- `llm/node-tools/dry-run-gate.ts:58` `automationStudioFlowDraftDryRunGate` —
  the gate.
- `llm/evidence-loop.ts:462` builds the gate (`enabled: drafting &&
  input.dryRun !== false`, i.e. **on by default**) and `:589` runs it as the
  last thing before a `complete` decision is accepted. A draft that does not
  replay clean is refused back to the model as issue code
  `llm_evidence_loop.dry_run_refused` and the model amends rather than the build
  dying.
- The two halves Core cannot own — putting the target back, and saying whether a
  step reproduced what it did — are this repository's:
  `domain/src/runtime/llm-evidence/node-run/replay.ts`
  (`replayWebOutputNode`, `webNodeReplayStatement`, `WEB_LLM_REPLAY_KEY`), with
  the per-step payload on `domain/src/runtime/llm-evidence/capture.ts:71`
  (`replay?: { from?: JsonObject; produced?: JsonObject }`).

**Execution is genuinely graph-shaped, not a step list.**
`executor/graph-run.ts` walks edges and ports, resets the recovery ladder on
each fresh *arrival* at a node, grants extra steps per `For Each` iteration
(`withIterationAllowance`), parks on a question and resumes from a seed
(`resumeAutomationStudioGraphRun`), and honours region timeouts. `maxSteps`
defaults to 250, hard ceiling 100 000.

**A created Flow can carry a branch.** `flow-draft/routing.ts` gives the model
four one-word statements about a step — `optional`, `only_if`, `on_failed`,
`repeat` — and `flow-bootstrap/authoring/draft-routing.ts` derives the actual
graph from them (a `builtin.control.merge` at every join, `builtin.control.for-each`
for a span, a back edge into the head Merge's `branches` port so plan validation
reads it as a join rather than a cycle). Both files are dated 2026-09-23/24, so
this is new and, as far as I can tell from the tree alone, largely unexercised
live.

**Replay costs nothing.** `runRuntimeSession` reaches a provider in exactly two
places: `maybeAnnotateRunDetailWithRuntimeLlm` (only on a *failed* run — see
`recovery/annotation/annotate.ts:104`, which returns immediately unless
`detail.summary.status === "failed"`) and the result verification (only when the
schedule says so). A successful replay with no grant and no scheduled check
makes zero provider calls.

**The Lab measures that from Core's own accounting, not from intent.**
`packages/test-runner/src/flow-lane/repair/replay-repair.ts#countedProviderCalls`
reads `detail.llmAccounting.calls ?? detail.providerCallCount ?? …` rather than
inferring "we passed no grant".

### What is absent or unproven

- Nothing is missing structurally. The working document's own `Current State`
  already records the empirical position: every reliable pass to date was a
  single `web.dom.extract_list` node on a page that was already correct.
  Multi-node instruction-built Flows have never produced a correct answer.
- The branch-authoring path (`draft-routing.ts`) is a day old. I found its unit
  tests (`flow-bootstrap/authoring/tests/`) but no evidence in the tree that a
  branched Flow has been built and replayed live.

---

## Capability 2 — a failing Flow repairs itself

### The trigger path, named

There is **one** repair entry point and two doors into it.

**The function that decides a repair happens** is
`recovery/annotation/annotate.ts:99`
`annotateAutomationStudioRunDetailWithRuntimeLlm`. It refuses, in this order,
and each refusal writes a four-stage `recoveryTrace` so "nothing happened" is
always a stage saying so:

1. no adaptation context → return unchanged;
2. `detail.summary.status !== "failed"` → return unchanged;
3. `!context.behavior.invokeLlm` → `llm.gate.training_mode`;
4. training budget exhausted → `llm.gate.training_budget_exhausted`;
5. `decideAutomationStudioRuntimeLlmInvocation` says a deterministic recovery
   must run first → `llm.gate.<requiredPriorAction>`;
6. provider resolution throws → `llm.provider_resolution_failed`;
7. failure-evidence capture throws → `llm.failure_evidence_invalid`.

Past those it runs the four stages: `runtime_diagnosis` call → deterministic
plan (`recovery/plan.ts`) → bounded exploration (`recovery/annotation/exploration.ts`,
only when the plan asked and the refusal is checkable) → optional re-plan
(`replan.ts`) → one `runtime_patch` call → `applyAutomationStudioRuntimeRecoveryPatches`.

**Door 1 — a failed step.** `service.ts:2792` (routed/subflow path) and
`service.ts:2851` (direct path) call it with the last failed attempt from the
executed trace.

**Door 2 — a refuted result.** `result-verification/run-outcome.ts:189` calls
`recovery/refuted-result/repair.ts:82`
`repairAutomationStudioRefutedRunResult`, whose `repair` port is wired at
`service.ts:2678` to the same `maybeAnnotateRunDetailWithRuntimeLlm`. It
synthesises the failed attempt the ladder needs
(`recovery/refuted-result/attempt.ts:77`) and marks the run
`metadata.resultRepair.attempted` so the entry point is taken once per run.

### Context the repair is given

Measured against the standing requirement (what it did before, the conversation,
the page as it broke, the Flow itself):

| Required | Present? | Where |
| --- | --- | --- |
| What it did before, with parameters and results | **Yes** | `recovery/repair-context/step-parameters.ts` — last 12 steps, each with the **authored** parameters (screened) and what it produced |
| The Flow itself, as a graph | **Yes** | `recovery/repair-context/flow-graph.ts` — up to 24 nodes, 32 edges, 2 routers, 12 rules each, plus the edges into and out of the failing node |
| The conversation so far | **Yes** | `ports.conversationForRecovery` → `conversations/`; deliberately not caught, so an unreadable thread fails rather than pretending silence |
| The failure's own record | **Yes** | `recoveryContext`'s `failure` section, parsed through `parseAutomationStudioFailureRecord` |
| What the run produced | **Yes, for the refuted door** | `resultSummary`, carried only when the domain declared denied keys |
| **The page as it was when it broke** | **No** | see below |

**The page gap is concrete.** `domain/src/runtime/adapter.ts` builds a sanitized
`web-llm-evidence.v2` packet *from the snapshot the content script captured at
the instant of failure* and attaches it to the command result as
`failureEvidence` (adapter.ts:118), explicitly because Core's own
`captureSanitizedFailureEvidence` "describes a page that has since moved on".
Core never reads it: grepping Core for `failureDiagnostics` / the attempt's
`failureEvidence` finds nothing outside the annotate module's own local
variable, and what the annotate module puts in that variable is
`ports.llmEvidenceRuntime.captureSanitizedFailureEvidence(...)` — which in
`domain/src/runtime/llm-evidence/tools.ts:344` dispatches a **fresh**
`web.dom.capture_snapshot`. So the domain captures the right page and Core
throws it away in favour of a later one. Only the digest survives, on the
failure record.

### What a repair can actually say

`llm/harness/structured-response.ts:155` — the whole vocabulary:

```
temporary_action_sequence        targetNodeId, actionDefinitionIds
temporary_wait_retry             targetNodeId, timeoutMs?, retryCount?
temporary_target_override        targetNodeId, target.handles
temporary_recovery_subflow_call  subflowId
temporary_reroute                fromNodeId, toNodeId
```

`live-patch.ts#applyRuntimePatchToFlow` (line 505) can apply only three of
them. `temporary_action_sequence` and `temporary_recovery_subflow_call` are
explicitly refused with `unapplied_patch_kind:…`.

**Nothing in that list can change what a node extracted, which parameter it
filtered on, or insert a missing step.** `temporary_target_override` re-points a
control; `temporary_reroute` adds a `success` edge between two nodes that
already exist. A run refuted because "the rating read `3.7 out of 5 stars` where
`3.7` was expected" or "the instruction's filter was never applied" has no patch
kind that fixes it. The repair will be planned, a `runtime_patch` call will be
paid for, and the best available answer is a target override on the wrong node
(see the next section).

### Persistence and re-run

- **Persisted:** yes, when the promotion gate allows it.
  `service.ts:2503` — `if (!decision.autoApply) return withDecision;` else
  `reviewFlowAdaptation({ action: "apply" })`, which writes the Flow.
  `decideAutomationStudioAdaptationPromotionGate` weighs approval mode, risk
  level, patch kinds, confidence, whether a prior manual review exists, and
  whether the patch has external side effects.
- **Re-run, failed-step door:** yes. `service.ts:2529`
  `retryRuntimeSessionAfterAutoAppliedPatch` re-reads the patched Flow and runs
  it from `decision.resume.nodeId` — not from the start, so side effects already
  caused are not repeated. The resume point comes from the patch trial's own
  verdict, read back off `detail.metadata.runtimePatchAttempts` by
  `service/adaptations/adaptive-retry.ts:43` `decideAutomationStudioAdaptiveRetry`,
  which fails closed on every ambiguity (`resume_decision_missing`,
  `resume_point_subflow_mismatch`, `resume_point_completed`,
  `resume_points_disagree`).
- **Re-run, refuted-result door: no.** This is the sharpest finding in the
  report. In `runRuntimeSession` the order is:

  ```
  run graph → annotate (repair a failed step) → retryAfterAutoAppliedPatch
            → verifyAutomationStudioRuntimeSessionResult
                 └─ refuted → repairAutomationStudioRefutedRunResult → annotate
  ```

  The retry has already been decided and returned by the time the verification
  runs. `runCanonicalAutomationStudioFlow` / `runAutomationStudioGraph` appear at
  only four places in `service.ts` (2560, 2753, 2838, 2839) and none of them is
  after the verification. So a repair triggered by a wrong answer applies its
  patch, persists the adaptation, and the run ends still reported `failed`.

  The circle does close, but across runs: the Flow document has changed, and
  `result-check-schedule/decide.ts` checks the **next** run unconditionally
  because `state.lastStatus === "refuted"`. The module comments in
  `result-verification/index.ts` and `refuted-result/repair.ts` describe this as
  within-run ("a repaired run is re-run, and the re-run's result is verified in
  its turn"), and `automationStudioRepairedRunResultCheck` exists for exactly
  that case — but on the code as written that path is reachable only from the
  failed-step door. The `resultRepair` once-per-run marker still does useful
  work: it stops the failed-step retry's own re-verification from re-entering.

  *Partial caveat I could not settle statically:* the patch **trial**
  (`flow-change/trial.ts`) is itself a live execution "from the node the change
  starts at", described as "also the run's continuation". So a refuted-result
  repair does re-execute the tail of the Flow on a throwaway copy. What does not
  happen is a second result verification of what that produced.

### The Lab's repair lane (this repository)

`packages/test-runner/src/flow-lane/repair/` is instrumentation, not product:

- `declared-repair.ts` / `judge-repair.ts` — the repair the scenario declares,
  and whether the live run proposed it;
- `apply-repair.ts` — approve and apply the proposal onto the Flow;
- `replay-repair.ts` — `replayRepairedFlow`: run the applied Flow again with no
  execution grant, assert 0 provider calls and 0 harness activations from Core's
  own accounting, and re-check the fixture goal;
- `prove-repair.ts`, `run-repair-lane.ts` — `--replays N`, writes
  `snapshots/repair-lane.json` before it judges.

Note what this does **not** exercise: it approves and applies a proposal from
outside. It is not a test of Core deciding to repair itself and re-running.

---

## Capability 3 — a run measures its own progress

### The function that decides a result is wrong

`result-verification/verify.ts:95` `verifyAutomationStudioRunResult`, in this
order:

1. `nothingToJudge(summary)` (verify.ts:189) — no rows and no refusals →
   `performed: false`, code `core.result.nothing_to_judge` (no record set at
   all) or `core.result.no_records` (a set with no rows). **Never fails the
   run.**
2. `automationStudioResultCoreObservation(summary)`
   (`core-observation.ts`) — free, no provider: every row refused
   (`core.result.every_record_refused`), no rows stored
   (`core.result.no_records`), or rows missing a value for a field the Flow's
   own record schema declares required (`core.result.required_values_missing`).
   A deterministic finding wins outright.
3. No provider resolvable → `core.result.no_model_available`,
   `performed: false`, recorded `unverified`, never `confirmed`.
4. One `loop_verification` call. Anything but `yes` is asked **once more with
   the same evidence**, because at temperature 0 both flipped on identical rows
   on 2026-09-18 and 2026-09-21. `agreement.ts`: only two agreeing
   `does_not_answer` verdicts fail the run; anything else leaves it
   `unverified`.

`result-verification/run-outcome.ts:153`
`verifyAutomationStudioRuntimeSessionResult` then writes the verdict onto the
session and the run detail, flips the status to `failed` when
`automationStudioResultVerificationFailsRun`, says it on the run's conversation
thread via `sayResultCheck`, and enters the repair.

### The function that decides a run is checked at all

`result-check-schedule/decide.ts:39` `decideAutomationStudioResultCheck` — pure,
no database, no provider. Person's switches first (`enabled: false`,
`shape: "never"`), then three rules that sit outside the ordinal sequence:
`repairedThisRun`, "the last check was refuted", "the last scheduled check
settled nothing". Then the ordinal sequence (initial window, then interval).

`service/runtime-adaptation/result-check.ts:66` `automationStudioRunResultCheck`
combines that with the money: `redeemAutomationStudioResultCheckAuthorization`
against the Flow's standing, scoped, expiring, capped authorization. Both halves
fail closed with a code and a sentence.

`resolveAutomationStudioResultCheckProvider` takes a person's live execution
grant first, then the standing authorization, and applies the narrower ceiling.
`programs/_shared/runtime.ts:59` wires `resultCheckProviderResolver` into the
service, and `apps/web/src/features/automation-studio/settings/flow-result-check-model.ts`
+ `FlowSettingsView.tsx` give it a UI. This is the "unattended run can still be
judged" path and it is complete.

### The genuine absence

**The whole capability is record-set-shaped.** `summarizeAutomationStudioRunResult`
(`result-summary.ts`) reduces *stored record sets* — counts, column names, up to
8 sampled rows across up to 4 sets, 4 000 bytes total. A run that stored no
record set returns `core.result.nothing_to_judge` with `performed: false`, which
by `automationStudioResultVerificationFailsRun` does not fail the run and by
`automationStudioRefutedResultAttempt` produces no repair attempt.

So: "search for X, apply filter Y, then extract" is judged. "Log in, fill the
form, submit it, confirm the booking" is not judged at all, and reports success.

Nothing in this repository reads or asserts the result check —
`grep -rn "resultCheck\|ResultCheck" domain/src apps/extension/src packages/test-runner/src`
returns nothing. The Lab does exercise the verification indirectly (a created
Flow's playback carries a `verify_result` grant, which is why
`persisted-flow-run.ts` had to raise its request bound), but it asserts no
verdict.

---

## What breaks first on a multi-node Flow

Ordered by how early I expect it to bite. Items marked **(defect)** look like
bugs rather than design limits; items marked **(limit)** are the design working
as written and not being enough.

### 1. The recovery budget is consumed by one node's retries **(defect)**

`executor/recovery-budget.ts:3` `recoveryBudgetState`. Defaults from
`model/flows.ts:240` are `maxRetriesPerAction: 2`,
`maxRecoveryAttemptsPerSubflow: 2`, `maxReroutesPerRun: 2`.

`failedAttemptsForAction` correctly excludes retried attempts
(`&& !attempt.retry`), and the file's own comment says why: "counting its own
attempts here as well would spend the reroute and subflow budgets on one node
retrying itself." But `recoveryAttemptsForSubflow` counts **every** previous
attempt carrying a `recoveryDecision`, and `graph-run.ts` stamps a
`recoveryDecision` on every failed attempt including retried ones. The exclusion
was applied to one field of four.

Consequence: a node that fails three times (the default retry policy is
`maxAttempts: 3`) leaves two attempts with a `recoveryDecision` behind it, which
is `maxRecoveryAttemptsPerSubflow`. From that point on
`recoveryBudgetExhaustion(...).recovery` is true for the rest of the run, and
`recovery-ladder.ts#chooseAutomationStudioRecovery` then withdraws **the Flow's
own authored `failed` route** as a candidate (`if (failedEdge &&
!budgetExhausted.recovery && …)`). That is precisely the class of bug the same
file says it already fixed for `maxRetriesPerAction`.

On a one-node extraction Flow this is invisible. On a six-node Flow, one flaky
early node disarms the error handling of the other five.

*I have not run this; it is read off the code and should be confirmed with a
targeted unit test before it is treated as fact.*

### 2. A wrong answer is always blamed on the last node **(limit)**

`recovery/refuted-result/attempt.ts:133` `resultProducingAttempt`:

> the last attempt that stored records is preferred … where no attempt recorded
> a count, the last step that succeeded stands in.

On a single-node extraction Flow that is the right node by construction. On
"search → filter → extract", a wrong answer caused by the filter never being
applied at step 2 produces a repair aimed at step 3, with step 3's page freshly
captured. The diagnosis is shown the whole 12-step chain
(`repair-context/step-parameters.ts`) so the model *could* name the earlier
node — but the patch is targeted, the trial resumes from the named node, and
`temporary_target_override` takes a `targetNodeId` the plan built around the
attempt. This is the single most likely way a multi-node repair does the wrong
thing quietly.

### 3. No patch kind fixes a wrong value **(limit)**

Covered above. Five kinds, three appliable, none of them touches an extraction
schema, a field mapping, a filter parameter, or the absence of a step. Both
named causes from the 2026-09-23 post-mortem (a rating read as
`3.7 out of 5 stars`; a filter never applied) are outside the vocabulary.

### 4. A Flow whose product is not rows is never judged **(limit)**

Covered above. `nothingToJudge` → `performed: false` → no failure, no repair.
Every multi-node scenario whose success criterion is a state change rather than
a record set currently self-reports success.

### 5. The Lab's 90-second terminal wait **(limit, and it bites the replay)**

`packages/test-runner/src/flow-lane/terminal-run-wait.ts:26`
`TERMINAL_DETAIL_WAIT_MS = 90_000`. A *granted* run gets
`AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_MAX_RUN_MS` instead
(`persisted-flow-run.ts:31`), raised deliberately after four units failed as
`environment.missing` on 2026-09-18. The provider-free replay — which is exactly
what capability 1 measures — still gets 90 seconds. Six nodes, each with a
readiness wait, up to three attempts and 250 ms / 1 s / 2 s backoffs, plus
navigation, is plausibly over that. A replay that times out is classified by
`classifyRunnerFailure` and recorded as `unreachable`, which reads as a product
failure rather than a harness bound.

### 6. Resolved parameter values are not recorded anywhere **(limit)**

`recovery/repair-context/parameter-screen.ts`, as summarised in
`step-parameters.ts`: "The parameters are the Flow's authored ones … the run's
resolved values are not used and could not be: they are not recorded anywhere."

A one-node Flow has no state bindings worth speaking of. A six-node Flow passes
`{{search.query}}` from node 1 into node 3, and neither the repair nor a human
post-mortem can see what value actually went in. Given that the loop's method is
a full step-by-step debug of every run, this is a direct hit on Phase 0's
instrumentation gate.

### 7. The router picks exactly one Subflow per run **(limit)**

`service.ts:2732` — `routeAutomationStudioRun` yields a single
`route.selectedSubflow`, one `routeDecisions: [route.decision]` and one
`subflows: [...]` entry. In-graph branching (Merge/For Each from
`draft-routing.ts`) is unaffected, but a Flow expressed as several Subflows in
sequence has no path through `runRuntimeSession`. I did not establish whether
anything builds such a Flow today.

### 8. Only the first dataset id travels **(minor)**

`run-outcome.ts` `datasetId = recordSets[0]?.summary.datasetId`. The summary
itself bounds to 4 record sets, but the conversation turn that reports a
refutation can attach only the first. A multi-node Flow that stores two record
sets reports one.

### Things that are *not* a problem on multi-node, contrary to what I expected

- **Per-node retry.** `executor/retry-policy.ts` resolves per node: node
  declaration, then a `builtin.timing.retry` node guarding the branch, then the
  Flow's, then Core's default. The ladder's `arrival` bookkeeping in
  `graph-run.ts` resets when the run moves to a different node, so a node
  reached twice inside a `For Each` body gets the whole ladder again.
- **Repair context breadth.** Graph section takes 24 nodes and 32 edges; step
  chain takes 12 steps; `recent_nodes` and `recovered_failures` take 8 each with
  a `totalFailuresSurvived` count beside the slice. A six-node Flow fits
  comfortably.
- **Result summary breadth.** 4 record sets, 40 flow-shape steps, 8 sample rows.
  Fits.
- **State capture.** `executor/graph-run.ts` writes every attempt's outputs to
  both `values["<nodeId>.<key>"]` and `values[key]`, carries variables and loop
  positions across a park/resume (`seedRunState`), and merges a child Call Flow
  trace's withholding and captured records into the parent. This is multi-node
  machinery and it looks sound.

---

## Where each capability actually lives

| | Core | `domain` | `apps/extension` | `packages/test-runner` |
| --- | --- | --- | --- | --- |
| 1 Deterministic replay | executor, dry-run gate, draft routing | replay statements, node run, snapshots | action execution, evidence capture | replay lane, provider-call accounting |
| 2 Self-repair | all of it | failure record + page-at-failure packet (unread), fresh failure snapshot, target-override validation | snapshot + action dispatch | declared/judge/apply/prove/replay |
| 3 Self-judgement | all of it | denied-key declaration only | nothing | nothing |

`apps/extension` holds no loop logic at all; it supplies snapshots, evidence and
action execution. `domain` owns the two halves of the replay contract Core
cannot own, and the sanitized page packets.

---

## Not verified

- **Nothing was executed.** No build, no type check, no unit test, no live run.
  Every statement above is read off the source tree at `dev`
  (Core `a055c92`, this repository `0d27f35`).
- **Finding 1 (recovery budget)** is inferred from reading
  `recovery-budget.ts`, `graph-run.ts` and `recovery-ladder.ts` together. It
  needs a unit test that fails one node three times and then asserts the
  authored `failed` edge of a later node is still offered.
- **The refuted-result re-run gap** is inferred from the four
  `runCanonicalAutomationStudioFlow` / `runAutomationStudioGraph` call sites in
  `service.ts` and the position of `verifyAutomationStudioRuntimeSessionResult`
  relative to `retryRuntimeSessionAfterAutoAppliedPatch`. I did not trace the
  patch trial (`flow-change/trial.ts`) far enough to say exactly how much of the
  Flow it re-executes, so "the tail of the Flow is re-executed on a throwaway
  copy but its new result is never verified" is my reading, not a measurement.
- **Finding 7 (one Subflow per run)** — I did not establish whether the
  bootstrap ever produces a multi-Subflow Flow, so this may be a limit nothing
  currently reaches.
- **Whether `draft-routing.ts` has ever produced a live branched Flow.** Its
  unit tests exist; I found no run artifact either way.
- I did not read `adaptive-orchestrator.ts`, `training-modes.ts`,
  `io-policy.ts`, `router-runtime.ts` or the bulk of
  `service.ts` (307 KB) beyond the regions named above.

## Open questions for the supervisor

1. Is the within-run "verify → repair → retry → verify" circle meant to exist?
   The comments in `result-verification/index.ts` and
   `refuted-result/repair.ts` say it does; the call order in `service.ts` says
   it does not. One of the two is wrong and it changes what the first live
   multi-node run will show.
2. Given finding 3, is a repair vocabulary extension (something that can edit a
   node's parameters or insert a step) in scope for this loop? Every wrong-answer
   cause named in the project's own post-mortems is outside the current five
   kinds.
3. Should capability 3 be extended past record sets before multi-node scenarios
   are run, or is the corpus going to be chosen so every scenario's product is a
   record set? On today's code the second is the only way a multi-node run gets
   judged at all.
