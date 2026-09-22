# fa-lab-measurement — D0, A12, and what the rungs still need from Core

Task t080, worktree `F:\fxwork\t080-lab-measurement`, branch
`task/t080-lab-measurement`. 2026-09-22.

## Outcome

**Done** for D0. **Partial** for A12: the Lab half is built and tested, and the
half that is missing is Core's, specified below. The three "report only" items
are reported, and one of them is stale in d6 — it was fixed already.

D0 is the blocking item and it is finished, live-proved both ways. No
adversarial variant can now be authored that reads as a failure for being
absorbed correctly.

---

## What changed and why

### D0 — a declared zero-calls expectation

`assertLiveLlmProviderWasReached` (`packages/test-runner/src/live-llm/budget.ts`)
is **unchanged**, byte for byte. It is still the default and it still throws on
any `--live-llm` run that reached no provider. What was added beside it is a
declaration that inverts the check for the run that declares it.

**The contract.** `ScenarioExpected.providerCalls?: ExpectedProviderCalls`,
where `ExpectedProviderCalls = { count: 0; because: string }`
(`packages/test-contracts/src/scenario.ts`). `count` is `0` and nothing else —
this declares an absence, not a budget, and the per-run call caps stay the
operator's `--llm-max-calls`. `because` is required and bounded at 200
characters, so the run record carries a reason a reader can weigh rather than a
bare exemption. Validated in `packages/test-contracts/src/validation.ts`
(`validateProviderCalls`, and `providerCalls` added to `validateExpected`'s
`checkKeys`) and added to the portable `webScenarioJsonSchema`. Inheritance is
free: `resolveScenarioWorkflow` already resolves a workflow's `expected` with
`{ ...workflow.expected, ...variant.expected }`, so a variant's declaration
replaces the workflow's exactly as every other expectation does.

**The judgement.** New module
`packages/test-runner/src/live-llm/declared-provider-calls.ts`, shaped on
`run-evaluation/declared-failure-verdict.ts`:

- `declaredProviderCalls(expected, where)` resolves the declaration and stamps
  it with `{ scenarioId, workflowId, variantId }`, because the same scenario can
  declare a spend on one variant and none on another and the run file must say
  which one this run was.
- `assertProviderCallsAsDeclared(plan, usage, declared)` is what the settlement
  now calls. With `declared === null` it *is*
  `assertLiveLlmProviderWasReached(plan, usage)` and nothing else, so the
  undeclared path is unchanged. With a declaration the check inverts rather than
  disappearing: the run must have spent nothing, and a run that declared no call
  and then made one fails `runtime.behavior`. A declaration is an expectation,
  not an exemption — a variant that claims the runtime absorbs it and then
  consults the model has told us something worth failing on, and passing that
  would make the declaration a hole in the one measurement it exists to take.
  `usage.interventions` counts alongside `usage.calls`, matching
  `assertProviderFreeRun`.

**Scope, deliberately narrow.** Like `expected.failure`, this narrows one
judgement and no other. It does not touch the oracle, the declared final state,
the extraction judgement, the budget check or a facility failure — all of those
still run, in the same order, before and after.

**It never reaches a Flow build.** `LiveLlmRun.settleObserved` now takes the
declaration as a parameter; `settle` (the Flow run) passes
`this.declaredCalls`, and `settleBuild` passes `null` with a comment saying why:
a build that reached no provider proposed no Flow, so "the runtime absorbed it"
can never be what happened there. A `create-flow` run whose scenario declares
zero calls therefore still has its build held to reaching the provider.

**It is recorded, not inferred.** `snapshots/live-llm.json` gains a top-level
`expectedProviderCalls`, written on **every** live snapshot — `null` for the
ordinary run, and the full `{ count, because, declaredBy }` where one was
declared, spent or not. The settlement's evidence event also publishes
`declaredProviderCalls: 0`. The campaign row gains `declaredProviderCalls` and
`declaredProviderCallsBecause`
(`scripts/lab/live-campaign/row/summarize-task.mjs`), read from that snapshot
and sitting beside the existing `declaredFailure`, so a row showing
`providerCalls: 0` now says whether that silence was intended.

Wired in `run-scenario.ts` immediately after `live.assertLane(...)`, from
`flowWorkflow.expected` — the same resolved expectations the lane is judged by.

### A12 — `evidenceLoop.steps` on a proposed build

**The Lab half is done. The data does not exist yet, and that is Core's.**

Tracing it end to end: a proposed build's record comes from `proposed()` in
`flow-lane/creation/build-proposal.ts`, which reads `getFlowAdaptation` →
Core's `get-flow-adaptation` → `bootstrapAdaptationAsFlowAdaptation`
(`runtime/flow-bootstrap/review-projection.ts`). Core **does** store the whole
trace on the proposal —
`AutomationStudioBootstrapAdaptation.evidenceTrace`, written at
`runtime/service.ts:2067` — but the review projection publishes only the created
audit event's `detail`, and that detail is `evidenceTraceAuditDetail`
(`service.ts:5946`), which emits counts and `toolIds` and no steps. So no
endpoint the Lab can call returns a proposed build's decisions today. Confirmed
against a real artifact: `run-mu6kjsm3-39948391`'s `build.evidenceLoop` is
`{decisionCount: 5, toolCallCount: 5, evidenceBytes: 16100, toolIds: [...],
steps: null}`.

What was built here, so that the Core change alone finishes it:

- `ExistingFlowAdaptation.evidenceLoop.steps?: Array<{ toolId; effectApplied?;
  resultCode? }>` parsed from the created audit detail in
  `existing-fluxiq-control.ts`, bounded at 65 entries (Core's
  `maxIterations + 1`) and holding identifiers only.
- `proposed()` now maps them through a new `buildSteps()` that applies the same
  `isVocabulary` filter the refused path applies, so a proposed build's trail
  and a refused build's read alike and a reader can compare them. `steps` stays
  `null` when Core publishes none, which is today.
- Test: "a proposed build keeps the decisions Core published on the proposal, in
  the shape a refused build's carry"
  (`flow-lane/creation/tests/build-proposal.test.ts`).

**The Core change, precisely.** Two edits in
`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime`:

1. `service.ts`, `sanitizeEvidenceLoopTrace` (:5931) currently keeps
   `iteration, decision, callId, toolId, evidenceBytes, usage` and **drops
   `resultCode` and `effectApplied`**, which are on
   `AutomationStudioLlmEvidenceLoopTrace` and are what the refused path's steps
   carry. Keep both, bounded as `flow-bootstrap/generation-failure.ts` bounds
   them (`DIAGNOSTIC_ISSUE_CODE`).
2. `service.ts`, `evidenceTraceAuditDetail` (:5946) — add
   `steps: clean.flatMap(evidenceLoopStep)`, reusing
   `evidenceLoopStep` from `flow-bootstrap/generation-failure.ts` (:388), which
   already sanitizes a decision to `{toolId, effectApplied?, resultCode?}` and
   names a tool-less decision with
   `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_DECISION_STEP_IDS`. It is not exported
   today, so that task exports it or moves it beside the loop limits.

That is one added member on an audit detail both readers already agree on, and
the Lab needs no further change.

---

## Commands run and observed results

### Live proof, first, before any unit test

Both runs used `FLUXIQ_TEST_ENV_FILES=none` and
`DEEPSEEK_API_KEY=sk-t080-declared-zero-calls-probe` in the process
environment. The dummy key is deliberate: `resolveLiveLlmProviderCredential`
prefers the process environment, so the real key in `.env.local` was never
read and **no provider was contactable and nothing could be spent**. Neither run
made a call — `llm.calls: 0`, `observed.interventions: 0` on both — so nothing
was billed either way.

The shape chosen is the cheapest honest one: `basic-form --flow --live-llm
--llm-task adapt`. The recorded Flow replays deterministically, so Core never
consults the model and the grant goes unspent. That is exactly the situation an
absorbed adversarial variant will be in.

**Control — undeclared, zero calls, must still fail.**

```
node scripts/lab/run-lab.mjs run basic-form --flow --live-llm \
  --llm-profile t080-control --llm-provider deepseek --llm-model deepseek-chat \
  --llm-task adapt --llm-max-calls 2
```

Run id **`run-mud4xk2c-18c83d3d`**, exit 1.

```
"verdict":"failed","failureCategory":"runtime.behavior"
"oracleVerdict":"passed","reportedVerdict":"passed","harnessActivations":0
actions: web.dom.type, web.dom.select, web.dom.type, web.dom.click — all recorded
"llm":{"mode":"live","profileId":"t080-control","calls":0}
```

`events.ndjson`: `Live LLM run reached no provider: --live-llm authorized 2
deepseek call(s) for --llm-task adapt and Core made none. Core published no LLM
gate for this run.` `snapshots/live-llm.json` →
`expectedProviderCalls: null`, `observed.calls: 0`, `observed.interventions: 0`.

So: every action succeeded, the oracle passed, and the run was failed **solely**
because it did not spend money. That is the defect D0 exists to fix, reproduced.

**Declared — the same scenario, the same run, with the declaration.**

`expected.providerCalls = { count: 0, because: "t080 probe: this recorded Flow
replays deterministically, so the grant must go unspent." }` was added to
`basic-form`. It was added to the **built** fixture
(`apps/scenario-lab/dist/scenarios/basic-form/scenario.js`, ignored build
output) and restored immediately afterwards, because the brief forbids touching
the scenario definitions under `apps/scenario-lab/src`. `git status` is clean of
it; the only untracked file left is the new source module.

```
node packages/test-runner/dist/cli.js run basic-form --flow --live-llm \
  --llm-profile t080-declared --llm-provider deepseek --llm-model deepseek-chat \
  --llm-task adapt --llm-max-calls 2
```

Run id **`run-mud4zvw9-2d497834`**, exit 0.

```
"verdict":"passed"
invariants: runner-verdict passed (expected "passed", actual "passed")
"llm":{"mode":"live","profileId":"t080-declared","calls":0}
```

`snapshots/live-llm.json`:

```json
"expectedProviderCalls": {
  "count": 0,
  "because": "t080 probe: this recorded Flow replays deterministically, so the grant must go unspent.",
  "declaredBy": { "scenarioId": "basic-form", "workflowId": null, "variantId": null }
}
```

and the settlement event carries `"declaredProviderCalls":0`.

Same scenario, same command shape, same zero calls: failed without the
declaration, passed with it, and the declaration is legible in the run files.

### Then the unit tests, then the checks

| Command | Observed |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/test-contracts test` | `# tests 124 # pass 124 # fail 0` |
| `node --test packages/test-runner/dist/live-llm/tests/declared-provider-calls.test.js` + `budget.test.js` + `build-proposal.test.js` | `# tests 29 # pass 29 # fail 0` |
| `node --test packages/test-runner/dist/tests/existing-fluxiq-control.test.js` | `# tests 21 # pass 21 # fail 0` |
| `node --test "packages/test-runner/dist/**/tests/*.test.js"` | `# tests 1286 # pass 1286 # fail 0` |
| `pnpm lab:test` | `# tests 79 # pass 78 # fail 0 # skipped 1` |
| `node scripts/structure-audit.mjs` | `structure-audit: passed (90 warning(s), 122 baselined)` — no new finding; the baseline was not regenerated and did not need to be |
| `pnpm check` | exit **0**; structure audit passed, all 10 workspace projects `Done` |

New tests, five in `live-llm/tests/declared-provider-calls.test.ts` and two in
`packages/test-contracts/tests/scenario-validation.test.mjs`, cover: no
declaration still fails a zero-call run; a declaration passes it; a declaration
that was then spent fails, naming where it was written; an intervention with no
counted call still breaks it; a variant's declaration replaces the workflow's;
`count: 2` is refused; a declaration with no `because` is refused; an unknown
member is refused.

---

## Report only, not implemented

### 1. `snapshots/repair-lane.json` — **d6's finding here is stale; it is already read**

`row/bundle.mjs` reads five files, not four: `repairLane: await
read("snapshots", "repair-lane.json")` is on the same line as the other four.
`summarize-task.mjs` passes it through `replaySummary()`
(`row/replay-summary.mjs`), which computes
`replayProviderCalls: counts.reduce(...)` over the lane's replays, and
`repairOutcome(recovery, providerCalls, flowLane, repairLane)` takes it as its
fourth argument: `const replayProviderCalls = repairLane?.replayProviderCalls ??
null`. It is `null` only when the run left no repair-lane record — that is, when
it was not given `--replays` — which is correct, not hard-coded. The row also
already carries `repairLane` with `application`, `declaredRepair`,
`replaysRequested`, `replaysRan` and `replaysPassed`.

**No fix is needed.** What d6 described was true of an earlier revision. The
plan's step list should drop it rather than commission a task for it.

### 2. No campaign row carries a duration — one line, two choices

`scripts/lab/live-campaign/runner.mjs` already injects `now` and already holds
both clocks around the attempt loop. The one-line fix is, inside
`for (const [position, task] of tasks.entries())`, capture
`const taskStartedAt = now();` before the attempt loop and add
`row.durationMs = Number(now()) - Number(taskStartedAt);` after
`summarizeTask(...)`. That measures the campaign's wall clock for the task,
retries and process startup included — which is the number a mandatory dry run
would have to be judged against.

The cheaper alternative measures something different and is worth having as
well: in `row/summarize-task.mjs`, `durationMs: evaluation?.durationMs ?? null`.
That is the runner's own measurement of the single successful attempt
(`evaluation.json` already carries it), so it excludes retries and startup.
Both, named distinctly, would be better than either. A later task owns it.

### 3. `navigation` and `state.change` evidence triggers

Unchanged from d6 and untouched here: both are in the vocabulary
(`packages/test-contracts/src/evidence.ts`) and were emitted zero times across
219 bundles. A ladder whose rung 2 waits for readiness has an obvious use for
`state.change`; whoever builds B1 should either emit it or delete it.

---

## What Core must expose for D0a, and what the Lab would then need

The brief scoped this out and asked for the specification. One correction first:
**only half of D0a is Core's.**

### The node id needs no Core work at all

Core's run detail already carries it. `runtime/service/summaries/conversions.ts`
writes `nodeId: attempt.nodeId` on every attempt (:160), and the Lab already
reads it: `readRunDetail` builds
`attemptNodeIds = attempts.flatMap(attempt => typeof attempt.nodeId === "string" ? [attempt.nodeId] : [])`
(`flow-lane/persisted-flow-run.ts:571`) and then uses it only for early-stop
detection and `startCandidateIndex`. It is `flowAction()` and
`flowActionsSnapshot` (`run-flow-lane.ts:428-437`) that throw it away.

The Lab-only change: add `nodeId: string | null` and `attemptIndex: number` to
`PersistedFlowAction`, fill them in `flowAction()` from the attempt (the
attempts are already sorted by Core's `order`, so `attemptIndex` is the
position), and publish both from `flowActionsSnapshot`. Two files, no Core
edit, no new endpoint. Once it lands, a retried node joins back to its node and
`action.recovery.resolvedBy` has something to attach to.

While in `flowAction()`, `attempt.durationMs` is on the same record and is
likewise dropped by the snapshot; rung 2 ("wait for readiness") is unmeasurable
without a per-attempt duration, so it should go in the same change.

### The target-resolution strategy is genuinely Core's

There are **two different records both called a target resolution**, and the one
the ladder needs is the one Core drops.

- **Core's own**, `AutomationNodeTargetResolution`, is its pre-dispatch
  resolution. Core publishes it at `conversions.ts:177` as
  `metadata.targetResolution`, and the Lab already narrows it to
  `status | candidateCount | minimumConfidence | confidence | normalizedScore`
  (`PersistedTargetResolutionField`, `persisted-flow-run.ts:190`). It names
  **no strategy**.
- **The browser's**, `WebAutomationTargetResolution`
  (`domain/src/actions/types.ts:418-425`), is the one that carries
  `strategy: "selector" | "coordinates" | "visual-target" | "fingerprint" |
  "active-element" | "scored-candidate"` plus `candidateCount`, `bestScore`,
  `runnerUpScore`, `confidence`. It travels to Core as `resolution` inside the
  dispatched action result payload
  (`domain/src/client/gateway-mapping.ts:311`), and Core stores that payload on
  the attempt's `outputs`. `conversions.ts` reads `attempt.outputs` for exactly
  one thing — `datasetMarkerRecordCount` (:157, :189) — and carries nothing else
  out of it. **That is why rung 1 is unmeasurable.**

**What Core must do, precisely.** In
`runtime/service/summaries/conversions.ts`, beside the existing
`...(attempt.targetResolution ? { targetResolution: attempt.targetResolution } : {})`
at :177, add a bounded projection of the host's record out of `attempt.outputs`
— `...(hostTargetResolution(attempt.outputs) ? { hostTargetResolution: ... } : {})`
— keeping the five members above and nothing else. This is safe by
construction and the domain says so in the type's own doc comment: every field
of `WebAutomationTargetResolution` is a closed enum or a number, nothing is
derived from the page, and a test in `domain/src/client/tests/gateway-mapping.test.ts`
pins that the shape has not grown a string. The name must differ from
`targetResolution`, because both records are meaningful and a reader has to be
able to tell Core's pre-dispatch choice from what the browser actually did.

**What the Lab would then need**, once both land:

1. `PersistedTargetResolutionField` gains a sibling for the host record
   (`persisted-flow-run.ts:190`), parsed from
   `metadata.hostTargetResolution` with the same narrowing discipline, and the
   comment at `:149-153` — which currently explains why this is impossible —
   is replaced by what it now reads (the comment is at
   `persisted-flow-run.ts:183-185`).
2. `flowActionsSnapshot` publishes it alongside `nodeId` and `attemptIndex`.
3. Only then can the rung vocabulary land: a closed `RecoveryRung` list beside
   `harnessChangeVerdictOutcomes` in
   `packages/test-contracts/src/harness-recovery.ts`, an
   `action.recovery { rungsRun[], resolvedBy }` on the snapshot, and
   `expected.recovery { node?, absorbedBy }` beside the
   `expected.providerCalls` this task added — asserted in a new module next to
   `declared-provider-calls.ts`, on the same rule: it narrows the rung
   judgement and never the oracle.

The rung vocabulary itself cannot usefully be added before Core publishes which
rung ran, since nothing would ever populate it.

---

## Not verified

- **A declared run that then spends is only unit-tested, not live-proved.**
  Making it spend live needs a working key and real money, which the brief's
  provider-free instruction rules out. The unit test
  ("a declared zero-call run that reached a provider fails") covers the
  arithmetic and the message; nothing has watched Core actually make a call
  under a declaration.
- **The `settleBuild` exemption gap is read, not run.** A `create-flow` run whose
  scenario declares zero calls still passes `null` and keeps the guard — that is
  visible in the code and in the comment, but no live `--llm-task create-flow`
  run was made against a declaring scenario.
- **No adversarial variant exists yet**, so nothing has been absorbed by a rung
  and then declared. `basic-form` stands in for it: deterministic by nature
  rather than by recovery. That is the right proof for D0 (the guard fires on
  "no call", whatever the reason) but it does not exercise D1.
- **`declaredProviderCalls` on a campaign row is not live-observed.** The row
  reader is covered by `pnpm lab:test`'s existing suite passing, and the field it
  reads was observed in a real `snapshots/live-llm.json`, but no campaign was
  run.
- **A12's Core half is specified from reading Core's source, not from running
  it.** I did not build or run Core with the proposed change.
- **`pnpm test` and `pnpm build` were not run** — `pnpm check` plus the full
  test-runner, contracts and lab suites were, and nothing outside those packages
  was touched.

## Open questions or contradictions found

1. **d6's `snapshots/repair-lane.json` finding is wrong for the current tree**
   (see "Report only" 1). Worth correcting in the plan so nobody briefs a task
   for work already done.
2. **D0a is smaller than the plan says.** The node id half is a two-file Lab
   change with no Core dependency. Only the strategy half needs Core. Splitting
   the step would let the node id — and per-attempt `durationMs` with it — land
   immediately, which unblocks joining retries to nodes well before any Core
   work.
3. **Should a declaration be allowed to say "at most N" rather than "none"?** I
   refused anything but `0` on purpose: a budget belongs to the operator's
   `--llm-max-calls`, and a fixture that could raise its own ceiling would be
   able to hide a spend. If a later design wants "the ladder may escalate to the
   model once", that is a different declaration — a rung expectation naming
   `model` — and not a number on this one.
4. **`--llm-task create-flow` has no way to declare zero calls for its
   *playback*.** `settleRepair` never asserts that a provider was reached, so
   nothing is broken; but if D3 ever wants "the created Flow's playback was
   absorbed deterministically" as a *positive* assertion rather than an absent
   failure, that needs its own check, not this one.
