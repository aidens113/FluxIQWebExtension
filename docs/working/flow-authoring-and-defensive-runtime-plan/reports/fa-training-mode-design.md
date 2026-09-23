# Training mode: automatic result evaluation as part of the loop

Design only. No source file in either repository was changed, no Lab run,
campaign or provider run was launched.

Read across into FluxIQ Core at `F:\!FluxIQ`. Every file and type named below
was read, not inferred; line numbers are from the working tree at
`F:\!FluxIQWebExtension` `dd90e6b` / Core as checked out on 2026-09-23.

---

## Headline: three things that change the brief

**1. The judge already exists, already asks exactly the user's question, and
already runs on every finished run — but only when the run carries a person's
grant.** `verifyAutomationStudioRuntimeSessionResult` is called unconditionally
at the end of `runRuntimeSession` (`runtime/service.ts:2844` and `:2898`). What
is conditional is the *provider*: `resultPorts.resolveProvider` is wired only
when `input.llmExecution` exists and its purpose grants `loop_verification`
(`runtime/service.ts:2710`). Without it the outcome is
`performed: false, code: "core.result.no_model_available"`, the run keeps the
status its steps earned, and the result is recorded `unverified`. So an
unattended replay is never judged.

Training mode is therefore **not a new check**. It is a policy that decides
which runs get a model attached to the check that already runs, and a seam that
carries a refutation into the repair ladder.

**2. "Training mode" is already a name in Core, and it means something else.**
`runtime/training-modes.ts` defines `AutomationStudioExecutionMode` =
`normal | train_for_runs | train_until_stable | continuous_adaptive`, with
`AutomationStudioTrainingModeSettings` stored per Flow, read by
`trainingModeSettingsFromMetadata`, surfaced in the web settings view, and
gating `invokeLlm` on the repair path. Reusing the phrase for a second,
different mechanism would leave two meanings in one file. **This design calls
the new thing the *result-check schedule*, presents it to the person as
"Training checks", and hangs it off the existing settings object as one field.**

**3. The model is not shown action parameters or results, and cannot be without
re-opening a deliberate content-protection decision.** The action chain in the
packet is `AutomationStudioLlmRecentActionContext` — nine identity fields, no
selector, no typed text, no URL, no extracted value. `recovery/context.ts`
states the rule explicitly: `attempt.inputs` and
`transitionComparison.actual.outputs` "hold live data of unknown sensitivity, so
nothing here reads them". This is section 1's main finding and section "What the
architecture makes hard" item 2.

---

## 0. Where this lives, and why

FluxIQ Core, `packages/fluxiq/src/programs/automation-studio/runtime/`. Nothing
here is web-specific: a run, a result, a record set and an instruction are all
domain-neutral, exactly as `result-verification/contracts.ts` argues for the
verification itself. No part of it belongs downstream.

New directory: `runtime/result-check-schedule/`.

It cannot go in `runtime/training-modes.ts`. That file is **397 lines against
`.structure-baseline.json`'s 400-line warn and 800-line limit**, and carries
**11 exported values against an 8 warn / 15 limit**. Adding a policy interface,
five implementations and a resolver would breach both. `runtime/` itself holds
21 entries against a `directoryFiles` limit of 25, so this is close to the last
new directory that fits there without splitting something else first.

Touched, by one line each: `runtime/training-modes.ts` (one optional field on
the settings type), `runtime/service/flow-settings/` (one new reader file plus
one call), `runtime/service/runtime-adaptation/contracts.ts` (two fields on the
adaptation context), `runtime/service.ts` (the `resolveProvider` condition at
`:2710`), `storage/project/schema/` (one migration),
`storage/project/runtime-stream-store.ts` (one column written).

---

## 1. What the check actually is

### The judge, reused whole

`verifyAutomationStudioRunResult` (`runtime/result-verification/verify.ts:95`),
reached through `verifyAutomationStudioRuntimeSessionResult`
(`runtime/result-verification/run-outcome.ts:116`). It makes at most two calls,
never a loop, at `taskKind: "loop_verification"` through
`runAutomationStudioLlmHarness`. **No second judge is designed here and none
should be built.**

Its prompt already asks the user's question in the user's terms.
`AUTOMATION_STUDIO_RESULT_VERIFICATION_INSTRUCTION`
(`runtime/llm/diagnosis-instructions.ts:19`) says, verbatim:

> "Answer diagnosis.answersRequest yes only when what came back is what the
> request asked for; answer no when it is not — too few records, the wrong
> records, a count that cannot match the request, **or a Flow with no step that
> could have narrowed or filtered what the request asked to narrow** … Do not
> answer yes because no step failed: every run you are shown finished without a
> failed step, and that is exactly why you are being asked."

The emphasised clause is cause 1 of `fa-r5-postmortem.md` stated as a prompt.
The judge was already looking for the exact defect the campaign measured, and it
found it — twice, in both r5 runs
(`verdicts: ["does_not_answer", "does_not_answer"]`).

### What the model is shown, exactly

Assembled by `packAutomationStudioLlmContext`
(`runtime/llm/harness/context-packet.ts:158`). For `taskKind:
"loop_verification"` the packet carries:

| Slot | Source | Content | Bound |
|---|---|---|---|
| `instructions` | `ports.flowInstructionSet` | **the user's original instruction**, as the Flow's own instruction set | `resolveAutomationStudioLlmInstructions` |
| `resultSummary` | `summarizeAutomationStudioRunResult` | **the output**: per record set `recordCount`, `refusedCount`, `truncated`, `columns`, `rowsChecked`, `rowsMissingRequired`, `missingRequiredColumns`, and `sampleRows` | ≤4 record sets, ≤4 sample rows per set, ≤8 overall, values cut at 120 chars, whole summary byte-bounded |
| `resultSummary.flowShape` | `input.flow.nodes` | **the Flow's shape**: `[{nodeId, definitionId}]` in authored order — "what it can do at all" | ≤40 steps |
| `recentActions` | `runDetail.actionAttempts` | **the action chain**: `{attemptId, nodeId, definitionId, order, status, route?, durationMs?, comparisonStatus?, failureCategory?}` | last 12 (`AUTOMATION_STUDIO_LLM_MAX_RECENT_ACTIONS`) |
| `policyGates` | `input.policy` | what the run was allowed to do | — |

Sample rows are screened before they leave: values cut, nested values replaced by
a marker, then put through `screenAutomationStudioLlmEvidence` against the bound
domain's `deniedEvidenceKeys` and Core's credential shapes. **A caller with no
declared-keys list gets no rows at all** — absent means nobody said, never "deny
nothing".

Not in the packet for this task kind: `recoveryContext` (held to
`runtime_diagnosis` / `runtime_patch` by `context-packet.ts:211`), `stateDiffs`,
`routeHistory`, `failureEvidence` — `verify.ts`'s `askOnce` passes none of them.

### The action chain has no parameters and no results

`AutomationStudioLlmRecentActionContext` (`context-packet.ts:109`) is nine
identity fields. There is no selector, no typed text, no navigated URL, no
extracted value, no per-node result. The `RECENT_ACTION_FIELDS` object below it
is a `satisfies` clause whose whole purpose is to make the list unextendable by
accident, and `deepseek-provider.ts:359` validates the array against
`isAutomationStudioLlmRecentActionContext` before the request is sent — a prior
drift between those two copies "refused every recovery from a failure with a
structured record before it was sent".

So the brief's "the action chain with parameters and results" is **not
available today**, and the reason is a stated rule rather than an oversight.

**Recommended maximum that can be reached without re-opening that decision:** a
new packet slot for `loop_verification` only — call it `resultChain` — built by
the same machinery `recovery/context.ts` already uses (`locator-text.ts` strips
anything shaped like a way to address an element; `screenAutomationStudioLlmEvidence`
strips credential shapes and denied keys), carrying per node:

- `definitionId` and an action verb (`open`, `press`, `type`, `run`);
- the **name** of the control acted on, as a person would recognise it, never
  its selector or fingerprint;
- for an extraction node: the field map's **column ids** and the row count it
  produced;
- for a navigate node: the **origin** only, never the full URL with its query.

That is enough for the judge to say "no step narrowed anything" with the node
that should have and did not — which is what cause 1 needs — and it carries no
value off the page. Widening `AutomationStudioLlmRecentActionContext` itself is
the wrong move: it is shared by every diagnosis call and would put page content
into paths that were designed not to carry it.

### The verdict returned

One field: `diagnosis.answersRequest: "yes" | "no" | "unknown"`
(`runtime/llm/harness/structured-response.ts:81`), beside `expected`, `observed`
and `changed` at ≤500 characters each. Read by
`automationStudioResultVerdictFromDiagnosis` (`verdict.ts:54`) into an
`AutomationStudioResultVerification`:

```
{ schemaVersion, verdict, basis, code, reason, observation, verdicts?, calls?, failure? }
```

`reason` and `observation` are **Core's own words**, composed from Core's counts
and the verdict word; the model's prose never reaches a run record
(`verdict.ts` header states why).

Rules that already hold and must not be re-litigated:

- **Fail-closed.** Only `answers` passes
  (`automationStudioResultVerificationAnswers`).
- **Two agreeing `no`s, and only that, refute.** `agreement.ts` — both `no` and
  `unknown` were measured to flip at temperature 0 on byte-identical rows
  (2026-09-18, 2026-09-21), so a single `no` is asked once more with the same
  evidence. `model_disagreed` and `model_unconfirmed` leave the run
  `unverified`, never `refuted`.
- **Core's own arithmetic is asked first and costs nothing.**
  `automationStudioResultCoreObservation` settles zero rows, every-row-refused,
  and rows missing a value their own schema declares required — with no provider
  call at all.
- **Four words a reader acts on**, from `automationStudioResultVerificationStatus`:
  `confirmed` / `refuted` / `unverified` / `no_result`.

### What training mode adds to the check

Nothing. It does not change the prompt, the verdict, the agreement rule or the
summary. It decides **which runs are put to the question**, and it pays.

---

## 2. Where the run counter lives

**Core's project SQLite store, in `runtime_runs`, derived rather than counted.**

The table exists (`storage/project/schema/domain-resources.ts:281`) with
`run_id`, `flow_id`, `flow_revision`, `status`, `trigger_kind`,
`finished_at_ms`, `summary_json`. It is written by
`AutomationStudioRuntimeStreamStore.upsertRunSummary`
(`storage/project/runtime-stream-store.ts:137`), which is where a new column is
set. It is Core's own store, per project, on disk, and survives a restart by
construction. Nothing extension-local is involved and nothing needs to be.

### The change

One migration, in the established per-concern style of
`storage/project/schema/flow-settings.ts` and `runtime-runs.ts`:

```sql
alter table runtime_runs add column result_verification_status text
  check (result_verification_status is null
         or result_verification_status in ('confirmed','refuted','unverified','no_result'));
create index if not exists runtime_runs_result_check_idx
  on runtime_runs (flow_id, flow_revision, finished_at_ms desc);
```

`upsertRunSummary` writes it from
`summary.metadata.resultVerification.status`, which `run-outcome.ts`'s
`recordedOutcome` already puts on the run detail and the session. `null` means
"this run was not part of a check", which is a different fact from
`unverified` and must stay so.

### The two facts the schedule reads

```
ordinal            = count of finished runs at the current epoch
lastCheckedOrdinal = ordinal of the newest run with result_verification_status not null
checksPassed       = count at this epoch with result_verification_status = 'confirmed'
```

as two indexed queries against `(flow_id, flow_revision, finished_at_ms desc)`,
placed in `runtime/service/summaries/` beside `listFlowRunSummaries`.

### The epoch, and why a repair restarts the window

`runtime_runs.flow_revision` is written from `summary.flowVersion`
(`runtime-stream-store.ts:149`). Keying every query on the Flow's **current**
revision means a landed repair restarts the 3-run window for free, with no
bookkeeping and nothing to reset. That is exactly the behaviour the user asked
for: a changed Flow is a Flow that has to earn its passes again.

**Caveat I could not close.** `adaptation-store.ts:209` records an
`appliedRevision` when an adaptation is applied, so a graph patch does advance a
revision — but I did not prove that `flows.graph_revision` advances on *every*
apply path, nor that `summary.flowVersion` carries the post-patch value.
**Fallback if it does not:** add `result_check_epoch integer not null default 1`
to `flow_settings`, bumped by the repair, and key the queries on that instead.
The implementer must settle this before Phase 3.

### Why not a counter column

A `runs_since_check` integer on `flow_settings` was the obvious first idea and
is worse on three counts. `flow_settings` carries a `revision integer not null
check (revision > 0)` that mutations bump, so a per-run write would churn it;
`service/flow-settings/settings-fingerprint.ts` would see the settings change on
every run; and a read-modify-write of a counter is a value two concurrent runs
of the same Flow can lose. Deriving from rows that are being written anyway has
none of those problems and doubles as the audit trail.

### Why not `resolveRuntimeAdaptationContext`'s existing count

`service.ts:2420` already computes `runsCompleted` — but from
`listFlowRunSummaries({limit: 100})`, so it saturates at 100 and counts every
run ever rather than runs since the last check. It is fine for the stability
score it feeds and wrong for this.

---

## 3. The schedule as a replaceable policy

### The interface

New directory `runtime/result-check-schedule/`, one exported thing per file,
barrel in the directory, per Core's code-structure rule.

`contracts.ts`

```ts
/** Where a Flow stands in its checking schedule. Derived from runtime_runs; never stored twice. */
export type AutomationStudioResultCheckState = {
  /** Finished runs at this epoch, the newest included. 1 is the first run after creation. */
  ordinal: number;
  /** The newest checked run's ordinal, or null when none at this epoch was checked. */
  lastCheckedOrdinal: number | null;
  /** Checks at this epoch whose verdict was `confirmed`. */
  checksPassed: number;
  /** The newest check's status, or null. `unverified` is not a pass. */
  lastStatus: AutomationStudioResultVerificationStatus | null;
};

/** Whether this run is checked, why, and when the next one falls due. */
export type AutomationStudioResultCheckDecision = {
  check: boolean;
  /** Core's own sentence, recorded on the run whether or not it was checked. */
  reason: string;
  /** The stable code a reader acts on, e.g. `core.check.initial_window`, `core.check.interval_not_reached`. */
  code: string;
  /** The ordinal of the next run this policy would check, or null when it would check no more. */
  nextCheckAtOrdinal: number | null;
};
```

`policy.ts`

```ts
export type AutomationStudioResultCheckSchedule = {
  readonly shape: AutomationStudioResultCheckShape;
  decide(input: {
    state: AutomationStudioResultCheckState;
    settings: AutomationStudioResultCheckSettings;
  }): AutomationStudioResultCheckDecision;
};
```

Pure. No clock, no store, no provider — the state is handed in, so every shape
is testable with no database and no money.

`settings.ts`

```ts
export type AutomationStudioResultCheckShape =
  | "initial_then_exponential"   // the default
  | "linear_decay"
  | "fixed_interval"
  | "every_run"
  | "never";

export type AutomationStudioResultCheckSettings = {
  enabled: boolean;
  shape: AutomationStudioResultCheckShape;
  /** Runs checked back-to-back after creation or after a repair. Default 3. */
  initialRunCount: number;
  /** The first interval once the initial window has passed. Default 5. */
  interval: number;
  /** How the interval widens: multiplied (exponential) or added to (linear). Default 5. */
  decay: number;
  /** A ceiling on the widened interval, so a long-lived Flow is still checked. Optional. */
  maxInterval?: number;
  /** Whether a refutation opens the repair entry. Default true. */
  repairOnRefutation: boolean;
};
```

### The five shapes, and the ordinals each produces

With the defaults `initialRunCount: 3, interval: 5, decay: 5`:

| Shape | Interval sequence | Checked run ordinals | Checks in first 50 runs |
|---|---|---|---|
| `initial_then_exponential` **(default)** | 1,1,1, then 5, 25, 125, 625 … | **1, 2, 3, 8, 33, 158, 783** | **5** |
| `linear_decay` | 1,1,1, then 5, 10, 15, 20 … | 1, 2, 3, 8, 18, 33, 53 | 6 |
| `fixed_interval` | 1,1,1, then 5, 5, 5 … | 1, 2, 3, 8, 13, 18, 23, 28, 33, 38, 43, 48 | 12 |
| `every_run` | 1 forever | every ordinal | 50 |
| `never` | — | none | 0 |

The default is the user's schedule read as *the interval decays geometrically*:
three back-to-back, then every 5th, then every 25th, then every 125th. The other
reading — check at run 5, then run 25, then run 125 — gives 1,2,3,5,25 and the
same count of five over 50 runs, so the cost figures in section 5 do not turn on
which reading is taken. The interval reading is the one that generalises to
"decay", so it is the default and the other is reachable as
`initialRunCount: 3, shape: "fixed_interval"` composed differently.

**Reset rule, shared by every shape:** a `refuted` check, or a repair that lands,
advances the epoch, so the next three runs are checked again. An `unverified`
check does **not** count as a pass (`verification-status.ts`'s rule, applied
one level up) and does not advance the interval — it is re-asked at the next
ordinal.

`resolve.ts` is the single switch that maps a shape to its policy, and an
unrecognised shape resolves to the default rather than to no checking — the same
fail-closed reading `trainingModeValue` applies in `settings-readings.ts`.

### Where the setting is stored

`flow_settings.training_json`, which surfaces on the Flow document as
`metadata.trainingModeSettings`. Read by a new
`runtime/service/flow-settings/result-check-settings.ts` exporting
`resultCheckSettingsFromMetadata(metadata)`, called from
`trainingModeSettingsFromMetadata` (`flow-settings/training-mode-settings.ts:10`)
in the same style as its existing `budgets` and `recoveryBudget` blocks, using
`finiteNumber` and `booleanSetting` from `scalar-readings` and
`settings-readings`.

One field is added to `AutomationStudioTrainingModeSettings`
(`runtime/training-modes.ts:24`):

```ts
resultCheckSchedule?: AutomationStudioResultCheckSettings;
```

That is one line and one import in a file already at its exported-value budget,
and no new exported value in it.

Persisted through the existing path: `update-flow-settings`
(`api/handlers/flows.ts`) merges the patch over the stored metadata, and
`flow-resource-mutations.ts:31` writes `training_json`. No new handler.

### How it reaches the runtime

`resolveRuntimeAdaptationContext` (`runtime/service.ts:2415`) already reads the
training settings and the recent-run history before the run starts. It gains two
fields on `AutomationStudioRuntimeAdaptationContext`
(`runtime/service/runtime-adaptation/contracts.ts`):

```ts
resultCheckSchedule: AutomationStudioResultCheckSchedule;
resultCheckState: AutomationStudioResultCheckState;
```

and the decision is taken **at the end of the run**, at the verification call
site, because the state's `ordinal` includes the run that just finished.

The one condition that changes is `runtime/service.ts:2710`: `resolveProvider`
is wired when the decision says check **and** the Flow holds a standing check
authorization (see "hard or impossible", item 1) — instead of only when a person
handed the run a grant. An unchecked run still calls
`verifyAutomationStudioRuntimeSessionResult`; it simply reaches
`core.result.no_model_available` and records `unverified`, exactly as today,
with the decision's `code` and `reason` beside it so the run says why it was not
checked rather than being silent about it.

---

## 4. The seam with the repair loop, and what t099 must expose

### What is broken today, precisely

Read from `runtime/service.ts` `runRuntimeSession` and
`runtime/recovery/annotation/annotate.ts`.

**(a) The verdict arrives after the ladder has finished.** The order in
`runRuntimeSession` is: execute → `writeRuntimeSession` →
`maybeAnnotateRunDetailWithRuntimeLlm` (the whole four-stage repair ladder) →
`retryRuntimeSessionAfterAutoAppliedPatch` → `saveFlowRunDetail` → **then**
`verifyAutomationStudioRuntimeSessionResult` (`:2844`, `:2898`). There is no
second pass. Whatever the verification concludes, the ladder has already run and
stopped.

**(b) A clean run never enters the ladder.** `annotate.ts`:

```ts
if (input.detail.summary.status !== "failed") return input.detail;
```

**(c) The ladder needs a failed attempt.** Further down:

```ts
const failedAttempt = [...(input.detail.actionAttempts ?? [])].reverse()
  .find((attempt) => attempt.status === "failed" || attempt.status === "unknown");
```

and `planAutomationStudioRuntimeRecovery` returns `unclassifiedPlan(chain)` when
`!input.deterministic` (`recovery/plan.ts:100`), whose whole plan is
`steps: [{action: "stop", reason: "No failed attempt reached the diagnosis, so
there is nothing to plan."}]` with `candidateKind: "diagnosis_only"` and
`failureClass: "ambiguous_or_unknown"`. That is verbatim what both r5 runs
recorded.

**(d) A repaired run is never re-judged.** `runtime/service.ts:2842`:

```ts
if (retry?.session) return retry.session;
```

returns the retried session without verification, and
`result-verification/index.ts` documents that as deliberate: "A RETRIED session
is not verified at that call site: it came back through the change verdict,
which has already judged it." For a training check that reasoning does not hold
— the change verdict says the *patch* worked, not that the *result* answers the
request.

### What already fits, and should not be rebuilt

The verification's failure record is already a real
`AutomationStudioFailureRecord`
(`result-verification/core-observation.ts`, `automationStudioResultFailureRecord`):

```ts
{ category: "output_not_observed", code: "core.result.does_not_answer_request",
  retryable: false, stage: "verification",
  expected: "A result that answers the request the Flow was built for.",
  actual: <Core's bounded observation> }
```

Its own header explains the choice: `output_not_observed` is "Core's existing
name for 'the action reported success and its intended effect was never
observed', which is this exact situation one level up", chosen so "every
consumer that already reads the category list keeps working". And
`adaptiveFailureClassForAttempt` (`adaptive-orchestrator.ts:135`) reads a
structured record **first**, before any message heuristic. So the record is
already in the shape the classifier wants; what is missing is an attempt to hang
it on and a call site that runs at the right moment.

### What I need t099 to expose

Five things, stated as requirements on t099 rather than as work this design
does.

**1. Verification before the repair entry, or a second entry into it.**
Recommended: move `verifyAutomationStudioRuntimeSessionResult` ahead of
`maybeAnnotateRunDetailWithRuntimeLlm` in `runRuntimeSession`. The verification
already writes `status: "failed"` onto the session and the run detail when it
refutes (`run-outcome.ts`, `verifyAutomationStudioRuntimeSessionResult`), so
gate (b) opens by itself and nothing else has to learn a new status. If t099
instead adds a second entry point
(`annotateAutomationStudioRunDetailAfterResultVerification`), **it must say so**,
because this design's Phase 4 wires the schedule to whichever call site actually
decides.

**2. The candidate kind a refutation produces — and it must not be
`expectation_wait_retry`.** `adaptiveCandidateKindForFailure`
(`adaptive-orchestrator.ts:155`) maps `output_not_observed` to
`expectation_wait_retry`, which `plan.ts`'s
`AUTOMATION_STUDIO_PATCH_KINDS_FOR_CANDIDATE` maps to
`["temporary_wait_retry"]`. A wrong-answer failure repaired by adding a wait
will never be repaired. Two ways out:

- **(i)** attach the existing record to a synthesized attempt and accept the
  wrong candidate kind — cheap, and it will not fix the measured failure;
- **(ii)** add a failure class (`result_does_not_answer`) and a candidate kind
  that permits a **structural** patch — inserting the narrowing step the
  instruction asked for. `candidateKindForUnhandledClass(_failureClass: never)`
  is a compile-time exhaustiveness guard, so adding the class forces the
  mapping to be written. `AutomationStudioAdaptiveFailureClass` lives in
  `@fluxiq/contracts/automation-studio`, so this is a contracts change and its
  downstream reader in this repository (`lane-observation.ts:195`) moves in the
  same work unit.

**I need t099 to state which it took and what candidate kind and patch kinds a
refutation reaches**, because whether training mode is worth its cost depends
entirely on that answer. Under (i) the loop will propose waits for a Flow that
is missing a filter.

**3. The result in the recovery context.**
`AUTOMATION_STUDIO_RECOVERY_CONTEXT_SECTIONS` (`recovery/context.ts:75`) has
eleven sections — `failure`, `expected_transition`, `actual_transition`,
`state_diff`, `failed_target`, `recovery_candidates`, `subflow`,
`route_context`, `known_adaptations`, `recent_nodes`, `recording_context` — and
**none of them is the result**. A repair triggered by a wrong answer must be
shown what came back. I need t099 to add a twelfth section,
`result_verification`, carrying the same `AutomationStudioRunResultSummary` the
verification was shown plus the verdict's `expected` / `observed`, at priority
immediately after `failure`. The section's own budget rules apply unchanged, and
the `included` / `omitted` contract means a run whose summary was dropped for
bytes still says so. Without it the repair reasons about a wrong answer it
cannot see, which is the standing requirement in
`fluxiq-automatic-repair-with-full-context` restated for this entry point.

**4. An origin a training check can write.**
`AutomationStudioFlowChangeOrigin` (`model/flow-adaptation.ts`) has
`{entryPoint: "run_failure"; runId: string; failedNodeId: string;
failureSignature: string}` and `failedNodeId` is required. A refutation has no
failed node. I need `failedNodeId` made nullable for this origin — **not** a
fourth entry point. `AutomationStudioFlowChangeEntryPoint` is already
`"instruction" | "run_failure" | "edge_case"`, and a training check is a run
failure discovered a different way, not a new kind of thing.

**5. Re-verification after a repair's retry.** Either route the retried session
back through `verifyAutomationStudioRuntimeSessionResult`, or mark it so the
schedule can tell. As it stands (item (d) above) a repair can land, re-run, and
produce a still-wrong answer with nothing saying so, and the schedule would
count the retry as a run that was not checked — which is at least honest, but
means the repair's own product is never judged.

### What this design adds that t099 does not

Only the decision of **which runs are put to the question at all, and who pays
for it**. t099 makes a refutation repairable; training mode makes refutations
happen on runs nobody is watching. They do not overlap and neither is useful
alone: t099 without a schedule only ever fires on runs a person already
authorized; a schedule without t099 produces refutations that stop at
`unclassifiedPlan`.

### Where I could not reuse the one loop

Reused whole: the judge (`loop_verification`, `verify.ts`, `agreement.ts`,
`verdict.ts`), the repair ladder (`annotate.ts`, `plan.ts`), the settings
vocabulary and budget (`training-modes.ts`,
`decideAutomationStudioTrainingBudget`), the conversation (`conversations/writer.ts`),
the storage (`runtime_runs`, `flow_settings`), and the failure record
(`output_not_observed`).

Genuinely new: **the schedule policy**. Nothing in Core samples runs.
`behaviorForAutomationStudioTrainingMode` decides whether a *mode* is active
(`runsCompleted < trainForRunCount`, or `stabilityScore < minimum`); it never
decides whether *this particular run* is examined. That is the one new idea and
it is deliberately small and pure.

**Where reuse failed: the provider authorization.** See the next-to-last
section, item 1. The grant service is built around a person's live session and
there is no standing-authorization concept to extend, so unattended checking
needs something that does not exist. I could not reuse my way out of it and I am
not going to pretend otherwise.

---

## 5. Cost

### Measured, per verification call

From `test-runs/instances/r5/*/snapshots/live-llm.json`, the `verification`
block's `interventions` array — real calls, real DeepSeek, seed 241:

| Run | Check | Input tokens | Output tokens | Cost USD |
|---|---|---:|---:|---:|
| `run-mudwci8d-de88aa32` | 1 | 2,614 | 317 | 0.0015686 |
| `run-mudwci8d-de88aa32` | 2 | 2,614 | 277 | 0.0015158 |
| `run-mudw1ktb-0557816b` | 1 | 2,190 | 341 | 0.00141372 |
| `run-mudw1ktb-0557816b` | 2 | 2,190 | 358 | 0.00143616 |

**Mean per call: $0.001483.** Input is byte-identical between check 1 and check
2 of the same run, which is `agreement.ts`'s "the same request, the same
evidence" showing up in the bill.

Therefore:

- **A check the result passes: 1 call, $0.00148.** (Only a non-`answers` first
  verdict is asked again.)
- **A check that refutes: 2 calls, $0.00285–$0.00308, mean $0.00297.**
- **A check Core settles itself: $0.** Zero rows, every row refused, or rows
  missing a required value never reach a provider
  (`automationStudioResultCoreObservation`).

For scale, the same campaign's *builds* cost $0.0753 (14 real calls) and $0.0907
(16 real calls) — a verification call is about 2,400 input tokens against a
build call's ~12,000, because it carries a bounded summary rather than the node
catalog and the evidence window.

### The default schedule over a Flow's first 50 runs

Checked ordinals 1, 2, 3, 8, 33 — **five checks**.

| Case | Calls | Cost |
|---|---:|---:|
| All five pass | 5 | **$0.0074** |
| All five refute (repair suppressed) | 10 | $0.0149 |
| Per run, amortized, all passing | — | **$0.00015** |

Against the alternatives:

| Policy | Checks in 50 runs | Cost (all passing) |
|---|---:|---:|
| Today (`never`, in effect) | 0 | $0 — and the wrong answer is never caught |
| **Default schedule** | **5** | **$0.0074** |
| `fixed_interval` 5 | 12 | $0.0178 |
| `every_run` | 50 | $0.0741 |

**Fifty runs of default checking costs 8–10% of building the Flow once**, i.e.
less than one build call. `every_run` costs about as much as building the Flow a
second time.

### The repair's cost is not measured, and I will not invent it

Both r5 runs record `repair: {calls: 2, interventions: 2, totalEstimatedCostUsd:
0.0030844}` — and those two calls are the *verification's*. The same request ids
(`llm.loop_verification.3af084e7-…`, `…a7b1e487-…`) appear in the verification
block at the same cost. **Zero repair calls were made in either run**, so the
project has no measured figure for a repair triggered by a wrong answer.

What bounds it today: `AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_DEFAULT_MAX_CALLS =
26`, `maxEstimatedCostUsd` 0.25 per call and `MAX_TOTAL_COST_USD = 2` per grant
(`runtime/llm/execution-grants.ts`). A repair is a `runtime_diagnosis`, an
optional bounded exploration and a `runtime_patch` — fewer calls than a build,
each carrying the recovery context rather than the node catalog. **The design's
answer is not to guess it but to bound it**: the schedule reuses
`AutomationStudioTrainingBudgetControls.maxCostUsdPerTrainingWindow`, which
already exists on the settings and is already read by
`decideAutomationStudioTrainingBudget`, so a Flow that refutes on every check
cannot spend without a ceiling the person set.

### One free saving worth naming

The second verification call's input is byte-identical to the first's, and Core
prices all input at the cache-**miss** rate
(`AUTOMATION_STUDIO_DEEPSEEK_PEAK_CACHE_MISS_INPUT_USD_PER_MILLION_TOKENS =
0.44`) while reading no cache figures back — fix B of `fa-build-cost.md`. With
that fix, a refuting check would cost roughly 1.05 calls instead of 2, cutting
the refutation path by about 45%. Nothing in this design needs to change for it.

---

## 6. How the person sees and controls it

### The settings view owns the configuration

`apps/web/src/features/automation-studio/settings/FlowSettingsView.tsx` with
`flow-settings-model.ts`. `FlowSettingsDraft` already carries `trainingMode`,
`trainForRunCount` and `minimumStabilityScore`, already validates them in
`flowGeneralRuntimeErrors`, and already round-trips through
`metadata.trainingModeSettings`. Add, in the same Runtime group, in plain
English:

| Control | Maps to | Default |
|---|---|---|
| **Check that results are right** | `enabled` | on |
| **How often** — *After creation, then less often* / *Every run* / *Every Nth run* / *Widening interval* / *Never* | `shape` | `initial_then_exponential` |
| **Runs checked to begin with** | `initialRunCount` | 3 |
| **Then every** | `interval` | 5 runs |
| **Widening by** | `decay` | ×5 |
| **Never wait longer than** | `maxInterval` | unset |
| **Try to repair when a check fails** | `repairOnRefutation` | on |
| **Spend limit per training window** | existing `maxCostUsdPerTrainingWindow` | unset |

Validation in the same shape as the existing rules: `initialRunCount >= 0`,
`interval >= 1`, `decay >= 1`, `maxInterval >= interval`. A widening interval
with no ceiling is allowed and is the default — it is the user's stated
schedule.

Beside it, read-only, from the schedule state:

> Checked 3 of this Flow's 8 runs. The last check said the result answered the
> request. The next check is at run 33.

`AutomationStudioTrainingStatus` (`training-modes.ts:386`) is the existing
carrier for exactly this kind of line and gains the schedule's fields.

The run view already reads `metadata.resultVerification` — `FlowRunView.tsx` and
`run-detail-model.ts` — so a checked run already shows its verdict, its code and
Core's observation with no new work.

### The conversation is where anything needing the person goes

Per the standing rule that the conversation is FluxIQ's general channel, and the
existing machinery: subjects are `project | flow | build | run`
(`conversations/thread.ts`), Core speaks through
`AutomationStudioConversationWriter` (`conversations/writer.ts`), a turn may
carry an `attachment {kind, ref}` the reader renders itself, and asks come in
`permission | choice | confirm | open` kinds. The overlay is
`conversation/components/ConversationDock.tsx`.

Exactly three moments, and no more:

**1. A refutation the person should see.** One automation turn on the **run**'s
thread, carrying the verification's `reason` and `observation` — Core's own
words, never the model's prose (`verdict.ts`'s rule) — with
`attachment: {kind: "dataset", ref: <datasetId>}` so they can look at the rows
that were judged. No ask: nothing is waiting on them, the repair is already
under way.

**2. A repair that needs permission.** Already built and must not be duplicated.
`annotate.ts`'s permission gate raises an
`AutomationStudioActionPermissionRequest` and `writer.askPermission` files it as
a **parked** ask keyed by that request's own `requestId`. Training mode
contributes nothing here beyond being the thing that started the repair.

**3. A check the model could not settle.** `model_disagreed` /
`model_unconfirmed` leave the run `unverified`. Rather than spend a third call
on a question two calls did not settle, post a `choice` ask on the run's thread
— "I could not tell whether this answered what you asked for. Did it?" — with
`parks: false`, because the run is over and nothing is waiting. A person's
answer here is cheaper and better than another call, and it is the one place in
this design where that is true.

**Do not build a training screen.** The settings view owns the configuration,
the run view already shows the verdict, and the conversation covers everything
that needs a person. A fourth surface would be exactly the "complex UI for every
single thing" the conversation exists to avoid.

---

## 7. Phased implementation, each independently validatable

Each phase's proof is the narrowest thing that can fail. Phases 1–6 spend no
money at all.

### Phase 1 — The schedule, pure and unwired

Create `runtime/result-check-schedule/` with `contracts.ts`, `policy.ts`,
`settings.ts`, `initial-then-exponential.ts`, `linear-decay.ts`,
`fixed-interval.ts`, `every-run.ts`, `never.ts`, `resolve.ts`, `index.ts`.

**Proof** — `runtime/result-check-schedule/tests/`, run with
`pnpm --filter @fluxiq/fluxiq test`:
- the default shape checks ordinals 1, 2, 3, 8, 33, 158 and no others over 200
  simulated runs;
- a `refuted` check at ordinal 8 advances the epoch, so ordinals 1, 2, 3 of the
  new epoch are checked again;
- an `unverified` check is neither a pass nor an interval advance;
- each of the other four shapes produces exactly the ordinals tabulated in
  section 3;
- an unrecognised shape resolves to the default, not to `never`.

No provider, no database, no service. If this phase is wrong, everything after
it is wrong, and it costs nothing to be sure.

### Phase 2 — Settings read, write and validate

`runtime/service/flow-settings/result-check-settings.ts`; one field on
`AutomationStudioTrainingModeSettings`; the draft fields and validation in
`apps/web/.../settings/flow-settings-model.ts`.

**Proof** — the existing pattern in `api/handlers/tests/flows.test.ts`: patch a
Flow's settings, read the Flow back, assert
`metadata.trainingModeSettings.resultCheckSchedule` holds what was sent; assert
a Flow that has never been patched reads the documented defaults, so **every
existing Flow gets the default schedule with no migration**; a settings-model
test that `interval: 0` reports an error and blocks the save.

### Phase 3 — The counter

The migration, the `upsertRunSummary` column write, and the two queries in
`runtime/service/summaries/`. **Settle the epoch question first** (section 2's
caveat) and take the `result_check_epoch` fallback if `flow_revision` does not
advance on every apply path.

**Proof** — `storage/project/tests/`, against an in-memory database: insert
runs, assert `ordinal`, `lastCheckedOrdinal` and `checksPassed`; close and
reopen the database and assert they are unchanged; bump the epoch and assert the
count restarts; assert a run with `result_verification_status` null reads as
unchecked rather than as `unverified`.

### Phase 4 — Wire the decision to the verification call site

`resolveRuntimeAdaptationContext` gains the schedule and the state; the
`resolveProvider` condition at `service.ts:2710` reads the decision; the
decision's `code` and `reason` are recorded on every run, checked or not.

**Proof** — a service-level test with a **fake** provider that counts calls: run
one Flow ten times, assert the provider is asked on runs 1, 2, 3 and 8 and on no
other; assert an unchecked run records `unverified` with
`core.result.no_model_available` and the schedule's reason beside it, and never
`confirmed`. No money.

**This phase is blocked on the standing-authorization decision** (next section,
item 1). Until it is settled, the wiring can only be proved with a grant-carrying
run, which is not what the feature is for.

### Phase 5 — The refutation reaches the repair. **Depends on t099.**

**Proof** — the model-free test `fa-r5-postmortem.md` cause 2 already specifies:
`planAutomationStudioRuntimeRecovery` with no `deterministic` diagnosis but a
refuted result verification must not return `stop`; it must request exploration
or a patch. Plus a service test that a scheduled check which refutes opens the
repair entry exactly once, and that the candidate kind it reaches is the one
t099 says it is — not `expectation_wait_retry`.

### Phase 6 — The conversation turn and the unsettled ask

**Proof** — `runtime/conversations/tests/`: a `refuted` outcome writes exactly
one automation turn on the run's thread containing the verification's code and
none of the model's prose; an `unverified` outcome writes one `choice` ask with
`parks: false`; a `confirmed` outcome writes nothing at all.

### Phase 7 — One live run

One run, on one of the ten difficult sites, with the schedule set to
`every_run`, against the real DeepSeek provider in `.env.local`. It is the first
and only provider spend in this plan, and the narrowest proof that the check
fires on a run nobody authorized and that its refutation reaches the ladder.

Per the standing rule, it is a post-mortem and not a data point: every step
walked, every action's expected and observed value read, and a change to Core or
the extension at the end of it. Not a campaign, and not launched without asking
first.

---

## What the current architecture makes hard, or impossible

### 1. An unattended run cannot obtain a model. **This blocks the feature.**

`resultPorts.resolveProvider` is wired only when `input.llmExecution` is present
and its purpose grants `loop_verification` (`runtime/service.ts:2710`). Grants
are issued by `AutomationStudioLlmExecutionGrantService.issue`, which does:

```ts
if (!session || session.user.id !== input.actorUserId)
  throw new Error("LLM execution actor session is unavailable.");
```

(`runtime/llm/execution-grants.ts:257`). A Flow replayed on a schedule at three
in the morning has no actor session, so it can never be verified as the code
stands. Training mode's entire premise is checking runs nobody is watching.

There is a `verify_result` grant purpose already
(`runtime/llm/runtime-session-grant.ts:41`) whose comment reads "a run with no
grant, plus the one call that asks whether the finished run's result answers the
request" — the right shape, still requiring a person's live session, and it
deliberately sets `invokeLlm: false` so a `verify_result` run may verify and may
**not** repair (`automationStudioRuntimeAdaptationContextForGrant`).

**This is a permission design question, not plumbing, and it must be settled
before Phase 4.** My recommendation: a **standing, Flow-scoped check
authorization** — the person turning result checking on in the settings view
*is* the authorization, stored beside the schedule with a cost ceiling and an
expiry, and redeemed by a new resolution path in `resultPorts.resolveProvider`
for `loop_verification` **and for nothing else**. It must not be a loosening of
the grant service, because that would let unattended work reach
`diagnose_and_adapt` and `explore_and_adapt` too. The repair that a refutation
triggers is a separate authorization question with a separate answer, and the
honest default is that a repair which would act on a page still raises a
permission ask in the conversation, exactly as it does today.

### 2. The model cannot be shown action parameters or results

`AutomationStudioLlmRecentActionContext` is nine identity fields, guarded by a
`satisfies` clause and re-validated by the provider before sending. The store
does not hold the parameters in a sendable form either: `recovery/context.ts`
states that `attempt.inputs` and `transitionComparison.actual.outputs` are never
read "because they hold live data of unknown sensitivity", and that rule is what
keeps a page's contents out of Core's storage under another name. The
`resultChain` projection in section 1 is the honest maximum without re-opening
that decision. `fa-r5-postmortem.md` records the same limit from the other side:
"The ledger gives refs, verbs and control names — it does not give the
selectors, typed text or extract field maps each node actually ran with."

### 3. The judge sees eight rows

`AUTOMATION_STUDIO_RESULT_SUMMARY_LIMITS`: 4 record sets, 4 sample rows per set,
8 rows overall, values cut at 120 characters, 40 Flow steps. The r5 failure — 24
rows where 13 were wanted, every one of the instruction's criteria violated — is
visible in that sample, and the model did call it correctly twice. A failure
that only shows on row 40 is unreachable by this check **at any schedule**, and
no amount of checking fixes it. Raising the sample raises the price of every
check linearly.

### 4. A repaired run is never re-judged

`service.ts:2842` returns the retried session directly, by documented intent.
Until t099 changes it, the schedule must treat a retried run as unchecked, and
a repair's own product goes unjudged.

### 5. `ambiguous_or_unknown` has three producers and no code on two of them

`plan.ts:209` (Core), `lane-observation.ts:198` (this repository, no `code` at
all), and `adaptive-orchestrator.ts`'s classifier fall-through. Training mode
will make refutations far more common, so this string is about to be written far
more often, and a reader cannot tell which produced it. Give each one a code
before the volume goes up; it is a few lines and it stops a diagnosis becoming
unreadable.

### 6. Nothing in Core schedules runs

`runtime_runs.trigger_kind` defaults to `"manual"` and I found no scheduler. The
decaying interval assumes a Flow is run repeatedly; today every run is started
by something outside Core. This does not block the design — the counter counts
completed runs whoever started them — but "the 33rd run" may be a long way off
in wall-clock time, and the person-facing copy must say **runs**, never days.
A `maxInterval` is the mitigation for a Flow that is run constantly; there is no
mitigation for one that is run twice a year, and a time-based shape would be a
sixth policy rather than a change to the interface.

### 7. `training-modes.ts` and `runtime/` are both near their budgets

397 lines against a 400-line warn, 11 exported values against an 8 warn, and
`runtime/` holds 21 entries against a 25-entry limit in
`.structure-baseline.json`. The design fits, with one line added to
`training-modes.ts` and one new directory — but there is not room for a second
feature to be added the same way, and the next one will have to split
`training-modes.ts` into a directory first.

---

## Outcome

**Done** — design only, as briefed. No source file in either repository was
changed. Nothing was committed or pushed.

## What changed and why

One file was written: this report. Nothing else. The brief was a design task
with an explicit "change no source file" constraint.

## Commands run and observed results

All read-only, in `F:\!FluxIQ` and `F:\!FluxIQWebExtension`.

- `grep -rn "does_not_answer" --include=*.ts packages/fluxiq/src` → located
  `runtime/result-verification/` (10 files, 1,127 lines), which holds the entire
  end-of-build verification the brief asked me to reuse.
- Read in full: `result-verification/{contracts,verdict,agreement,verify,
  run-outcome,core-observation,verification-status}.ts`,
  `runtime/training-modes.ts`, `runtime/recovery/plan.ts`,
  `runtime/recovery/annotation/annotate.ts`,
  `runtime/recovery/context.ts` (header and section list),
  `runtime/recovery/deterministic-diagnosis.ts` (head),
  `runtime/llm/diagnosis-instructions.ts`,
  `runtime/llm/harness/context-packet.ts` (packet assembly and recent-action
  projection), `runtime/llm/runtime-session-grant.ts`,
  `runtime/llm/grant-capabilities.ts`,
  `runtime/service/flow-settings/{training-mode-settings,settings-readings}.ts`,
  `runtime/conversations/{index,thread,turn,ask,writer}.ts`,
  `storage/project/schema/{domain-resources,table-names,flow-settings,runtime-runs}.ts`,
  `storage/project/runtime-stream-store.ts`,
  `model/flow-adaptation.ts` (run detail, attempt record, change origin).
- `sed -n '2700,2910p' runtime/service.ts` → the two
  `verifyAutomationStudioRuntimeSessionResult` call sites at `:2844` and
  `:2898`, the `resultPorts` definition at `:2710` with its grant-conditional
  `resolveProvider`, and the `if (retry?.session) return retry.session;` at
  `:2842` that skips verification on a retried run.
- `wc -l` on `runtime/service.ts` → **4,610**; `training-modes.ts` → **397**;
  `result-verification/*.ts` → 1,127 total.
- `grep -c "^export function\|^export const" training-modes.ts` → **11**;
  `ls runtime | wc -l` → **21**.
- `node -e` over `.structure-baseline.json` → `fileLines 800`,
  `fileLinesWarn 400`, `directoryFiles 25`, `exportedValues 15`,
  `exportedValuesWarn 8`.
- `python` over
  `test-runs/instances/r5/*/snapshots/live-llm.json` → the four verification
  intervention records quoted in section 5, with per-call input tokens
  (2,190 / 2,614), output tokens (277–358) and costs
  ($0.00141372 – $0.0015686), plus each run's build totals ($0.07534912 for
  14 calls, $0.09073592 for 20 recorded rows).
- `git branch -a` and `git worktree list` in `F:\!FluxIQWebExtension` → **no
  t099 branch or worktree exists yet**, so nothing of t099's implementation was
  read and section 4's requirements are stated against the code as it stands.

No test suite, build, Lab run, campaign or provider call was executed. Nothing
in this report claims a check was run that was not.

## Not verified

- **That `flows.graph_revision` advances on every applied-patch path**, and that
  `AutomationStudioFlowRunSummary.flowVersion` carries the post-patch value.
  `adaptation-store.ts:209` records an `appliedRevision`, which is suggestive
  and not proof. The whole "a repair restarts the 3-run window" mechanism rests
  on it; section 2 gives the `result_check_epoch` fallback.
- **The repair's cost.** No repair call was made in either r5 run, so the
  project has no measured figure. Section 5 bounds it by the grant's ceilings
  rather than estimating it.
- **DeepSeek's cache-hit price**, so the "~45% off the refutation path" figure
  inherits `fa-build-cost.md`'s own caveat.
- **That `loop_verification` works unattended at all.** It has only ever run
  under a person's grant. Phase 7 is the first thing that would prove it.
- **Whether the candidate kind a refutation reaches is usable**, because that is
  t099's to decide and t099 does not exist yet. If it lands as
  `expectation_wait_retry`, this feature will trigger repairs that cannot fix
  the measured failure, and that is the single biggest risk in the design.
- Any downstream reader of `AutomationStudioAdaptiveFailureClass` beyond
  `lane-observation.ts:195`, which I know of from `fa-r5-postmortem.md` rather
  than from a search of this repository.

## Open questions and contradictions found

1. **Who authorizes an unattended check?** The blocking question. Core cannot
   mint a grant without a live user session, and the whole feature is about runs
   nobody is watching. My recommendation is a standing Flow-scoped
   authorization redeemable for `loop_verification` only; it needs the user's
   decision, not mine, because it changes what runs unattended.
2. **Does a refutation's repair need its own authorization?** Verifying costs
   $0.0015 and changes nothing; repairing changes the Flow and may act on a
   page. Treating them as one authorization would be convenient and wrong.
3. **"Every 5th run, then the 25th"** — interval decay (1,2,3,8,33,158) or
   ordinal series (1,2,3,5,25,125)? Both give five checks in fifty runs, so the
   cost is the same either way; I took interval decay as the default because it
   is the reading that generalises to "decay" and to the linear shape. Worth one
   sentence of confirmation.
4. **A contradiction between two documented intents.**
   `result-verification/index.ts` says a retried session is deliberately not
   verified "because it came back through the change verdict, which has already
   judged it" — but the change verdict judges whether the *patch* worked, not
   whether the *result* answers the request. For a training check those are
   different questions and the reasoning does not carry over. t099 or this work
   has to pick one; I recommend re-verifying a retried run and amending that
   comment.
5. **`verify_result` sets `invokeLlm: false` by design** — a grant that verifies
   explicitly forbids repairing. Training mode needs a run that does both. Is
   that a sixth purpose, or does the standing authorization sit outside the
   purpose vocabulary entirely? I lean to the latter, since the purposes are
   about what *a person* authorized in a session.
