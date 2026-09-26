# t163 — What every node and every runtime path does when something goes wrong

Read-only audit. No source, test or document outside this file was changed.

Repositories read: `F:\!FluxIQ` (Core, `packages/fluxiq/src`) and
`F:\!FluxIQWebExtension`. Evidence from `test-runs/campaigns` (30 campaign
summaries naming `everything-store-plus-earbuds-under-50`) and from
`test-runs/run-muht9lpw-a39aa056`.

---

## The one-sentence finding

**The defensive runtime exists, is on by default, and is gated behind a single
boolean that almost nothing sets — and three of its four rungs are read by the
executor but written by nobody, so for an instruction-built Flow the "recovery
ladder" is one rung deep.**

The boolean is `attempt.failure.retryable`. The gate is
`automationStudioAttemptIsRetryable`
(`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\executor\retry-policy.ts:88`):

```ts
export function automationStudioAttemptIsRetryable(attempt: AutomationStudioNodeAttemptTrace): boolean {
  if (attempt.failure?.retryable !== true) return false;
  return attempt.failure.stage !== "verification" && attempt.failure.stage !== "confirmation";
}
```

Its result is `ladder.retryable`, and `ladder.retryable` gates rungs 2, 3 **and**
4 in `ladderCandidates` (`recovery-ladder.ts:137`, `:146`, `:158`). So an
attempt that arrives without a structured failure record, or with one whose
stage is `verification` or `confirmation`, gets **no deterministic recovery of
any kind** — not a retry, not a wait, not an interference clear. It goes
straight to the bottom of the ladder, which is `llm_diagnosis`, which is not
executed in-run, which ends the run.

---

## 1. The inventory

### 1a. Core built-in nodes — 41 definitions

Enumerated from `packages/fluxiq/src/programs/automation-studio/nodes`
(`registry.ts:27` composes nine groups):

`builtin.control.{branch,end,for-each,loop,merge,parallel,start,switch}`,
`builtin.policy.{action,expectation,recovery}`,
`builtin.routine.{approval,subroutine,task-policy}`,
`builtin.logic.{and,compare,not,or}`,
`builtin.math.{add,clamp,divide,multiply,round,subtract}`,
`builtin.random.{choice,jitter,number,weighted-choice}`,
`builtin.data.{constant,filter-list,get-variable,map-object,set-variable,write-records}`,
`builtin.database.{insert,query,update}`,
`builtin.timing.{debounce,retry,timeout,wait}`.

**Of these 41, exactly four emit a structured `failure` record at all**
(`grep -rln "failure:"`, tests excluded):

| File | `retryable` |
| --- | --- |
| `nodes/control-flow/for-each.ts:81` | `false` |
| `nodes/data/write-records.ts:58` | `false` |
| `nodes/policy/action.ts:101` | `false` |
| `nodes/policy/expectation.ts:17` | **`true`** (stage `verification`) |

**The other 37 are silent about every fault class.** Silence is the finding: a
`builtin.database.query` whose adapter returns a 503, a `builtin.logic.compare`
that throws on a malformed value, a `builtin.control.for-each` over a list that
arrived empty — none of them produces a record, so none of them is retryable,
so none of them gets a rung.

And the one node that *does* say `retryable: true` says it with
`stage: "verification"`, which the gate at `retry-policy.ts:90` excludes. **No
Core built-in node can currently reach the retry rung on its own record.**

The three `builtin.database.*` nodes do not execute anything themselves: they
emit `database.{insert,query,update}.requested` effects
(`nodes/database/query.ts:34` and siblings) and whatever the host dispatcher
answers is merged over their result by `dispatchAutomationStudioEffects`. Their
fault behaviour is therefore the host's, not theirs — which means a transient
5xx from a database adapter is classified by nothing in Core.

### 1b. This repository's web output nodes — 18 definitions

`WEB_AUTOMATION_ACTION_TYPES` (`domain/src/actions/types.ts:20`):
`web.browser.{navigate,tab,download}`,
`web.dom.{click,type,clear,select,scroll,keypress,wait_for_selector,wait_for_text,extract,capture_snapshot,check,assert,extract_list,upload,dialog}`.

**Fault behaviour for all 18 is handled centrally, at one seam, and the nodes
themselves say nothing.** `createOutputNodeImplementation`
(`domain/src/output-nodes/native-runtime.ts:67`) returns the same
`status: "success"` + one `policy.output.dispatch` effect for every one of them
(`dispatching`, line 76). The file documents this deliberately at lines 50-66:
the implementation runs *before* dispatch and "cannot report the command's
outcome, and must not pretend to".

The one exception is `web.dom.extract_list`, which refuses its own bad record
output before anything runs (`output-nodes/extract-list/dispatch.ts:66` →
`recordOutputRefusal`, line 80): `graph_validation_or_unknown_node`,
`retryable: false`, stage `dispatch`. Correct — an unsaveable record output is a
Flow edit, not a retry.

So the real inventory question for the web nodes is not "what does each node
do" but "what does the classifier do", and that is section 2.

---

## 2. The fault classes, answered per seam

Every browser fault becomes one of **16 codes** in one table:
`domain/src/runtime/failure/codes.ts:138`,
`WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS`. Each row fixes the Core category,
the `retryable` flag and the stage. This table is the most load-bearing thirty
lines in either repository: it decides, for every web fault, whether the runtime
defends itself.

| Code | Category | `retryable` | Stage | Reaches retry rung? |
| --- | --- | --- | --- | --- |
| `web.target.not_found` | `target_not_found` | **true** | `target_resolution` | **yes** |
| `web.page.changed` | `page_changed` | **true** | `execution` | **yes** |
| `web.action.timeout` | `timeout` | **true** | `execution` | **yes** |
| `web.action.failed` | `action_failed` | **true** | `execution` | **yes** |
| `web.validation.output_not_observed` | `output_not_observed` | **true** | `verification` | **no — stage excluded** |
| `web.action.rejected` | `blocked_by_capability_or_policy` | false | `execution` | no |
| `web.target.ambiguous` | `target_ambiguous` | false | `target_resolution` | no |
| `web.validation.state_mismatch` | `unexpected_state` | false | `verification` | no |
| `web.navigation.unexpected` | `navigation_unexpected` | false | `confirmation` | no |
| `web.auth.required` | `auth_required` | false | `confirmation` | no |
| `web.intervention.required` | `user_intervention_required` | false | `execution` | no |
| `web.action.blocked_by_dialog` | `unexpected_state` | false | `execution` | no |
| `web.action.unsupported_type` | `blocked_by_capability_or_policy` | false | `dispatch` | no |
| `web.action.not_implemented` | `blocked_by_capability_or_policy` | false | `dispatch` | no |
| `web.action.invalid_parameter` | `graph_validation_or_unknown_node` | false | `dispatch` | no |
| `web.action.unknown` | `ambiguous_or_unknown` | false | `execution` | no |

**Four of sixteen codes can reach a retry.** Now the eight classes the brief
names.

### The target element is absent, or arrives later than the wait allows

**Handled, and handled well, at three depths.**

- The content script waits: `waitUntil`
  (`apps/extension/src/content/action-runtime/waits.ts:30`) re-evaluates on
  every DOM mutation *and* on a 50 ms poll, default `DEFAULT_WAIT_TIMEOUT_MS =
  10_000` (line 17). Running out of time resolves `undefined` rather than
  throwing (line 60-63) — "an outcome here, not an error".
- The list read waits: `RENDER_WINDOW_MS = 10_000`,
  `EMPTY_PAGE_SETTLE_MS = 2_000`, `LIST_GROWTH_SETTLE_MS = 900`
  (`content/extraction/page-render.ts:159-171`). The 2 s regression the brief
  names is **already fixed**, and the read now publishes `stoppedOn`,
  `waitedMs`, `waitedFor` so it is countable
  (`domain/src/actions/extraction/summary.ts:99-135`).
- Absence lands on `web.target.not_found`, which is **retryable** — so the node
  is attempted again, up to three times with backoff.

This class is the one the runtime currently defends properly.

### The page changed shape since authoring

**Partly handled, and the deterministic answer designed for it is dead code.**

- Re-resolution happens inside the host before a failure is ever reported —
  `content/action-runtime/resolve-target.ts` (663 lines), and
  `recovery-ladder.ts:118-122` says explicitly that re-resolving is not a rung
  "because it has already happened".
- Beyond that, the intended answer is rung 3, `clear_interference`
  (`ladder-run.ts:125`), which runs a Flow node marked
  `metadata.clearsInterference` (`ladder-run.ts:10`, `:141`). **Nothing in
  either repository writes that key.** `grep -rn "clearsInterference"` over
  Core's `src` and over `domain/src` + `apps/extension/src` returns only the two
  reader lines. The rung can never fire.
- Worse, the rung is gated on `ladder.retryable` (`recovery-ladder.ts:146`),
  and the commonest shape-change obstruction — a dialog over the page — is
  `web.action.blocked_by_dialog`, `retryable: false`. **The rung built for
  dialogs is switched off by the dialog code.** Even if a Flow did carry a
  `clearsInterference` node, a blocking dialog could not reach it.
- `web.action.rejected` covers "covered by another element"
  (`codes.ts:26`) and is pinned non-retryable by its category: Core's parser
  lists `blocked_by_capability_or_policy` in `NEVER_RETRYABLE`
  (`packages/contracts/src/failure/parse-record.ts:17-24`), so that row has no
  choice. An overlay that will close in 400 ms is treated as a policy refusal.

### The page navigated, reloaded or replaced the document mid-step

**Handled, and this is the best-built part of the extension side.**

- `executeContentAction` (`content/actions/execute.ts:114`) brackets every verb
  with `observePageIdentity()` / `reportPageChange(...)`, which supersedes the
  verb's own code with `web.page.changed` — **retryable**.
- `routeContentAction` (`execute.ts:126-177`) is one try block, every branch
  awaited, with `tests/execute.test.ts` asserting no branch loses its `await`.
  A caught rejection becomes `web.action.failed`, retryable, which the file
  argues for at lines 26-31.
- The worker side re-sends only `web.dom.assert` when it met a navigating page
  (`runtime/action-runner.ts:321-337`), deliberately not a click or a type,
  because those may already have acted. Sound.

### A transient HTTP failure: 429, 500, 502, 503, 504

**Not handled anywhere in the runtime, and the mechanism that classifies it
correctly is read by nothing that acts.**

- **No web failure code names an HTTP status.** The closed set of 16 has no
  member for 429 or 5xx. A gateway or adapter fault lands on `web.action.failed`
  (retryable) or `web.action.unknown` (not retryable) depending only on whether
  a message survived — `classifyOutcome`
  (`domain/src/runtime/failure/classify.ts:96-100`).
- On the **provider** side the classification is correct and complete:
  `deepSeekRefusalFailure` (`Core .../runtime/llm/deepseek/provider.ts:214-220`)
  marks 429 `retryable: true`, `status >= 500` `retryable: true`, and 401/403
  `false`; a request timeout (line 165) and a network boundary failure
  (line 167) are both `true`.
- **Nothing retries on it.** The only consumer is
  `runtime/llm/harness/run.ts:182`, which writes the boolean into a
  diagnostic's `metadata` and returns `ok: false`. `grep -rn
  "backoff\|attemptAgain\|sleep\|delay"` over the whole
  `programs/automation-studio/runtime/llm/` tree (tests excluded) returns
  **zero hits**. There is no retry loop, no backoff, no re-send anywhere in the
  LLM runtime.
- Live evidence: **two of the earbuds runs died on
  `flow_bootstrap.provider_transport_unknown`** (campaign tally, section 5).
  A transport fault ended the build.

### A request timeout, an aborted fetch, a dropped connection

**Bounded everywhere; classified inconsistently; retried only on the web path.**

- Core's runtime arms the deadline in `withRuntimeBounds`
  (`packages/fluxiq/src/runtime/service.ts:354`): `command.timeoutMs +
  COMMAND_ANSWER_MARGIN_MS` (3 000 ms,
  `client-gateway/service/command-answer-margin.ts:20`). A command with **no**
  `timeoutMs` arms no runtime deadline (line 364) but is still bounded by the
  gateway's `config.commandTimeoutMs`
  (`client-gateway/service/commands.ts:69`), so nothing hangs forever.
- `withRuntimeBounds`'s catch (line 384-386) returns
  `{ status: "failed", message, error }` with **no `failure` record**. On the
  web path `adapter.ts` has already built one, so this is harmless there. On any
  other path it is not: see the next bullet.
- `failureForCommandStatus` (`runtime/io-policy.ts:145-149`) recovers a record
  for `timed_out` (retryable) and `rejected` (not), and **returns `null` for
  plain `failed`**. So a dispatch that failed with a message and no parseable
  record reaches the attempt structureless → not retryable → whole ladder
  skipped. This is the generic structureless-failure hole.
- The web path does not fall into it: `commandFailure`
  (`domain/src/runtime/adapter.ts:186-208`) always classifies, and a dropped
  connection surfaces as `web.action.failed` (retryable) because
  `classifyOutcome` sees `status: "failed"` with a message
  (`classify.ts:96-99`). Good.
- Two spots on the web path still produce a record-less failure:
  `io/gateway-output-dispatcher.ts:14` (no single paired client) and its catch
  at `:41`. Both are recovered downstream by `adapter.ts`'s classifier, so the
  effect is only that the reason is coarse, not that the record is missing.
  *(Inferred from the call order at `adapter.ts:91-106`; not exercised.)*
- `captureWebAutomationSnapshot` (`adapter.ts:134-148`) awaits
  `clientGateway.captureSnapshot` with **no try/catch** (line 137). A throw
  there is caught by `withRuntimeBounds` and becomes a record-less `failed`.

### A provider or external API error, including a malformed response body

**Classified precisely, retried never, and it ends the build.**

- Malformed body: `llm.provider_malformed_response` for a non-JSON media type
  (`provider.ts:153`) and for unparseable JSON (`:160`), both
  `retryable: false` (the default at `provider-contract.ts:106`) — right, a
  re-send of the same prompt will parse the same way.
- A result that parses but is invalid: `llm_output.invalid_provider_result`
  (`harness/run.ts:205`), returns `ok: false`.
- Every one of these returns `ok: false` from the harness, and no caller
  re-sends. The `llm_diagnosis` rung of the ladder is **never executed
  in-run**: `runAutomationStudioRecoveryLadder` returns `{ kind: "stop" }` for
  it (`ladder-run.ts:68`), `graph-run.ts:469` finds no executable failed edge,
  and the run returns `status: "failed"` at `graph-run.ts:471` with
  `"Recovery ladder reached LLM diagnosis fallback before a configured provider
  was invoked."` (`recovery-ladder.ts:171`). Model repair happens only *after*
  the graph run returns, as a repair-and-replay
  (`runtime/service.ts:2834-2852`), never as a rung inside it.

### An empty or partial result where some result was expected

**This is the dominant live failure, and the runtime cannot retry it by
construction.**

- `minItems` defaults to **1** (`content/actions/extract-list.ts:69-71`). A
  zero-row read therefore fails `validationFor` (`:129-139`) →
  `validation.status: "failed"` → `classifyOutcome` (`classify.ts:89-91`)
  returns `web.validation.output_not_observed`.
- That code is `retryable: true` **at stage `verification`** (`codes.ts:142`),
  and `automationStudioAttemptIsRetryable` excludes `verification`
  (`retry-policy.ts:90`). **The record says retryable and the gate says no.**
  A page that simply had not finished drawing gets zero rungs.
- The reasoning at `retry-policy.ts:82-86` is sound for a *mutating* action —
  a failure after the action ran must not be re-dispatched, that is how a
  double submit happens — but `web.dom.extract_list` and `web.dom.extract` are
  reads. The stage exclusion is doing side-effect safety with a blunt
  instrument and catching every read in it.
- Partial results are now deliberately *not* failures: a column some rows lack
  is reported as a stated gap rather than a shortfall
  (`extract-list.ts:112-132`) — the forty-good-rows regression the brief names
  is fixed, and fixed in the right direction.

### A permission, storage or browser-API failure

**No code names it, so it is misclassified as retryable and three attempts are
spent on a fault no retry can fix.**

Direct live evidence, `test-runs/run-muht9lpw-a39aa056/snapshots/flow-lane.json`:

```json
{"category":"action_failed","code":"web.action.failed","retryable":true,"stage":"execution",
 "expected":"the action to run",
 "actual":"Cannot access contents of url \"about:blank\". Extension manifest must request permission to access this host."}
{"attemptNumber":2,"maxAttempts":3,"backoffMs":250,"rung":"retry_node"}
{"attemptNumber":3,"maxAttempts":3,"backoffMs":1000,"rung":"retry_node"}
```

A **manifest permission** fault — permanent, fixable only by an edit — was
classified `web.action.failed` / retryable and retried three times at 250 ms and
1 000 ms, then the ladder fell to `llm_diagnosis` and the run ended
(`recovery.ladder_diagnosis_unanswered` in that run's issue codes).

This is the retry machinery working exactly as designed and being fed a wrong
answer by the classifier, because the closed set has no member for a
browser-API refusal. `browserActionFailure`
(`apps/extension/src/runtime/action-runner.ts:101-109`) maps *every* worker-side
throw to `web.action.failed`.

Storage: `apps/extension/src/background/storage.ts` makes nine
`chrome.storage.local` calls in 56 lines with **zero try/catch**. Not on the
action path — these are settings, session, client id and the queued-event
buffer — so a quota or disabled-storage throw hits pairing and queueing, not
node execution. *(Impact inferred from the call sites; not exercised.)*

---

## 3. Where a fault ends the run today

### Ends the run — a single recoverable fault terminates it

| Line | What ends it |
| --- | --- |
| `executor/graph-run.ts:471` | **The one that matters.** The ladder returned `stop` and there is no executable failed edge, so the run returns `failed` at that node. Every fault that fails to clear the `retryable` gate arrives here. |
| `executor/graph-run.ts:321` | A region needs a runtime capability the run lacks. |
| `executor/graph-run.ts:323` | A region's `timeoutMs` elapsed. |
| `executor/graph-run.ts:394` | A question for a person could not be delivered. |
| `executor/graph-run.ts:402` | A person refused. |
| `executor/graph-run.ts:500` | A node finished on a route with no matching outgoing edge. |
| `executor/graph-run.ts:520` | `maxSteps` exceeded. |
| `executor/graph-run.ts:288` | No start node. |
| `runtime/service.ts:2856-2858` | A throw anywhere in the run ends the session failed and **rethrows**. |

### Ends the run by escaping every guard — unguarded throw paths

`runGraphFromSeed` (`graph-run.ts:101-126`) has **no try/catch**, and
`executeAutomationStudioNode` is called at `graph-run.ts:337` and `:339`
without one. Inside `node-execution.ts` the try block covers **only** the
`definition.execute` path (lines 126-155). These three awaits are outside it:

- `node-execution.ts:87` — `options.nativeNodeExecutor?.(...)`
- `node-execution.ts:99` — `dispatchAutomationStudioEffects(native.result, ...)`
- `node-execution.ts:102` — `options.compositeExecutor?.(...)`

**Every web output node takes that path.** Core holds no `definition.execute`
for `web.dom.click` and the rest, so `!definition?.execute` is true at line 86
and execution goes through `nativeNodeExecutor`. A throw from the web node
implementation, or from the effect dispatcher underneath it, propagates out of
`executeNodeAttempt` → out of the step loop → out of `runGraphFromSeed` → to
`service.ts:2856`, which ends the session and rethrows. **No attempt is
recorded, no ladder runs, no repair is possible, and the trace has no row for
the node that did it.**

The dispatcher underneath is `createRuntimePolicyEffectDispatcher`
(`runtime/io-policy.ts:75`), whose `await runtime.dispatch(...)` at line 88 is
itself unguarded. `withRuntimeBounds` catches transport throws, so in practice
this is narrow — but it is the difference between a recorded failure and a lost
one, and the guarantee is absent rather than narrow.

### Fails the node, Flow carries on

- An authored `failed`-route edge exists and the ladder selected
  `deterministic_path`: `graph-run.ts:482` follows it.
- `skip_satisfied_node` fired: the run takes the `success` route although the
  attempt keeps its failed status (`graph-run.ts:461-466`).
- A parameter path could not be resolved: `node-execution.ts:70-80` returns a
  failed attempt rather than throwing.
- A caught throw from `definition.execute`: `node-execution.ts:141-155`.

### Retried

Only through `ladder.kind === "retry"` (`graph-run.ts:455-459`), which requires
`automationStudioAttemptIsRetryable`. Default three attempts,
250 / 1 000 / 2 000 ms (`retry-policy.ts:28-31`). **Proven to work live** —
`run-muht9lpw-a39aa056` above.

---

## 4. The seams

Ten, and they are genuinely funnels — a policy at the right two would be
inherited by every node including one added later.

**Core**

1. `executeAutomationStudioNode` —
   `packages/fluxiq/src/programs/automation-studio/runtime/executor/node-execution.ts:22`.
   **Every node in a Flow, whatever its kind, passes through here.** Three
   sub-paths: `definition.execute` (line 138, Core built-ins),
   `nativeNodeExecutor` (line 87, all 18 web nodes and any importer node),
   `compositeExecutor` (line 102, Call Flow). **Only the first is inside a
   try/catch.** This is the single best place to put a throw-to-failed-attempt
   guarantee.
2. `dispatchAutomationStudioEffects` — `node-execution.ts:196`. The three
   dispatch paths (IO runtime, framework runtime, host dispatcher) meet only
   here; its own comment says so.
3. The step loop and the ladder — `graph-run.ts:266` (`executeAutomationStudioGraph`),
   ladder invoked at `:429`. One loop for the whole run.
4. `automationStudioNodeRetryPolicy` — `retry-policy.ts:50`. Every node's
   attempt allowance, resolved from node → Retry node → Flow → options →
   default, capped by `maxRetriesPerAction`.
5. `automationStudioAttemptIsRetryable` — `retry-policy.ts:88`. **The gate.**
   One function decides whether any node gets any deterministic recovery.
6. `createRuntimePolicyEffectDispatcher` / `dispatchPolicyOutput` —
   `runtime/io-policy.ts:75` and `:21`. Every `policy.output.dispatch`.
   `failureForCommandStatus` (`:145`) is where a record-less `failed` stays
   record-less.
7. `withRuntimeBounds` — `packages/fluxiq/src/runtime/service.ts:354`. Every
   runtime command's deadline, abort and throw boundary.

**This repository**

8. `createOutputNodeImplementation` —
   `domain/src/output-nodes/native-runtime.ts:67`. All 18 web output nodes,
   one function.
9. `executeWebAutomationRuntimeCommand` / `commandFailure` —
   `domain/src/runtime/adapter.ts:71` and `:186`. Every web command's
   classification on the runtime path.
10. `webAutomationFailureRecord` and `WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS`
    — `domain/src/runtime/failure/codes.ts:138` and `:184`. **The table that
    decides `retryable` for every browser fault.** With seam 5 this is where a
    default policy lives or dies.

**Extension**

11. `routeContentAction` — `apps/extension/src/content/actions/execute.ts:126`.
    Every content-script verb, one try block, every branch awaited.
12. `ExtensionRuntimeCommandRouter.executeAction` —
    `apps/extension/src/runtime/command-router.ts:22`. Every worker-side
    command; its catch at `:36` turns a throw into `browserActionFailure`.

**Which nodes go through which.** The split that matters: Core built-ins reach
seam 1 via `definition.execute` and are **inside** its guard; web output nodes
reach it via `nativeNodeExecutor` and are **outside** it. A policy written at
seam 1 that only wraps the `try` block would miss all 18 web nodes — which is
precisely today's situation.

---

## 5. What already exists and is not used

| Mechanism | On by default? | Read by anything? | Covers |
| --- | --- | --- | --- |
| **Per-node retry policy** (`retry-policy.ts:28`) | **Yes** — 3 attempts, 250/1000/2000 ms | **Yes**, and it demonstrably fires | Only faults that clear the `retryable` gate: 4 of 16 web codes, 0 of 41 Core built-in nodes on their own records |
| **Retry node** (`builtin.timing.retry`) | Opt-in, authored | Yes — `branchRetryPolicy`, `retry-policy.ts:101` | The branch its `success` port feeds |
| **Rung 1, `skip_satisfied_node`** | Automatic | Reads `expectedState`, written **only by the recording proposal path** (`service/recordings/proposal-candidates.ts:116`) | Recorded Flows only. **Dead for every model-built Flow.** |
| **Rung 2, `await_recorded_state`** | Automatic | Reads `parameterValues.readyState` / `metadata.readyState` (`recorded-state.ts:83`). **`grep` over both repositories finds no writer at all.** | **Nothing. Dead code.** |
| **Pre-node readiness wait** (`graph-run.ts:332` → `ladder-run.ts:157`) | Automatic | Same `readyState` key | **Nothing. Always returns `undefined`.** |
| **`recordedGapMs`** wait ceiling (floor 2 s, cap 30 s, `recorded-state.ts:35-38`) | Automatic | Written only by recordings (`proposal-generation.ts:80`) | Moot — gated behind the absent `readyState` |
| **Rung 3, `clear_interference`** | Automatic | Reads `metadata.clearsInterference` (`ladder-run.ts:10`). **No writer in either repository.** Also gated on `ladder.retryable`, which the dialog code sets to `false`. | **Nothing. Dead code, twice over.** |
| **Rung 4, `retry_node`** | Automatic | Yes | The only live rung |
| **`llm_diagnosis` rung** | Automatic | Recorded, **never executed in-run**. `ladder-run.ts:68` returns `stop`; `conversions.ts:331` maps it to `"diagnosis_only"` | Nothing at run time. Model repair is a post-run replay (`service.ts:2834-2852`) |
| **Recovery budgets** (`recovery-budget.ts:32`) | Yes when configured | Yes | Caps reroutes, subflow recoveries, LLM attempts |
| **Provider `retryable`** (`deepseek/provider.ts:214-220`) | Correctly set for 429, 5xx, timeout, network | **Written to a diagnostic's metadata and nothing else** (`harness/run.ts:182`). Zero `backoff`/`sleep`/`delay` in the whole LLM tree | **Nothing** |

**So: for an instruction-built Flow — the only target — the recovery ladder is
one rung deep.** Rungs 1, 2 and 3 all depend on node metadata that only the
recording path writes, and two of the three keys are written by nobody at all.
A mechanism that reads as done and does nothing is worse than an absent one,
and there are three of them here.

**Measured, not just inferred:** across all 150 run directories in
`test-runs/`, `await_recorded_state` appears in **0** runs and
`clear_interference` in **0** runs, while `retry_node` appears in **12**. The
source says those two rungs cannot fire; the evidence says they never have.

### Rung usage across all 150 run directories

`grep -rl` over every `*.json` in `test-runs/`, counting **distinct run
directories**:

| Rung / marker | Runs it appears in |
| --- | --- |
| `retry_node` | **12** |
| `await_recorded_state` | **0** |
| `clear_interference` | **0** |
| `recovery.ladder_diagnosis_unanswered` | 3 |

This is the empirical half of the section above. The source says rungs 2 and 3
*cannot* fire because nothing writes `readyState` or `clearsInterference`;
**150 runs of evidence say they never have.** And `retry_node` appearing in 12
confirms the retry policy is genuinely live, not merely configured — so the
ladder is not broken, it is one rung deep.

`recovery.ladder_diagnosis_unanswered` is a named Core constant,
`AUTOMATION_STUDIO_LADDER_DIAGNOSIS_UNANSWERED_CODE`
(`runtime/service/summaries/conversions.ts:291`), emitted when the selected
recovery kind was `llm_diagnosis` and nothing answered it — the terminal marker
of the run-ending path at `graph-run.ts:471`.

### Live tally — 30 campaigns naming `everything-store-plus-earbuds-under-50`

From `awk` over each `summary.md` row (`test-runs/campaigns/*/summary.md`):

| Count | Failure / issue codes |
| --- | --- |
| **11** | `output_not_observed / core.result.does_not_answer_request` |
| 2 | `flow_bootstrap.provider_transport_unknown` |
| 1 | `target_not_found / web.target.not_found` + `recovery.ladder_diagnosis_unanswered` |
| 1 | `action_failed / web.action.failed` + `llm.failure_evidence_invalid` + `recovery.ladder_diagnosis_unanswered` |
| 1 | `flow_bootstrap.evidence_unusable_decision` |
| 1 | `lab.generation_unfinished` |
| 1 | `ambiguous_or_unknown` |
| 4 | `environment.missing` — setup failures, not runs |
| 7 | no verdict row |

Read against the audit: **11 of ~18 reportable runs died on a class the retry
gate excludes by stage** (`output_not_observed`, stage `verification`), and
**2 more on a provider transport fault nothing retries**. That is 13 of 18
attributable to two findings below.

---

## 6. Ranked fix list

Ordered by how many of the 18 reportable live failures each would have
prevented. Each entry is one worker's task.

### 1 — Let a read's unmet post-condition reach the retry rung (≈11 runs)

`automationStudioAttemptIsRetryable` excludes stage `verification` wholesale
(`retry-policy.ts:90`). Right for a mutating action, wrong for a read. Admit a
`verification` failure to the retry rung when the node is a read — either by a
`sideEffectClass: "none"` test (`sideEffectClassForNode` already exists,
`node-execution.ts:308`) or by a new `idempotent` marker on the failure record.
**Core.** Touches `runtime/executor/retry-policy.ts`,
`runtime/executor/tests/retry-policy.test.ts`,
`runtime/executor/tests/ladder-run.test.ts`.

### 2 — Retry the provider on 429, 5xx, timeout and network faults (≈2 runs, and every future build)

The provider already says `retryable: true` for exactly these
(`deepseek/provider.ts:214-220`) and nothing reads it. Add a bounded retry with
backoff around `runProviderWithEnforcedDeadline`
(`llm/harness/run.ts:172`), honouring the existing deadline and run budget.
**Core.** Touches `runtime/llm/harness/run.ts`,
`runtime/llm/provider-contract.ts` (if the flag needs surfacing),
`runtime/llm/tests/`.

### 3 — No throw from a node may escape the executor (unquantified; it loses the evidence, so it cannot be counted)

Move `node-execution.ts:86-105` — the `nativeNodeExecutor`,
`dispatchAutomationStudioEffects` and `compositeExecutor` awaits — inside a
try/catch that produces a failed attempt the way lines 141-155 already do, and
wrap `runGraphFromSeed` (`graph-run.ts:101`) so a throw becomes a trace rather
than a rethrow. This is the whole-node-kinds gap: today only Core built-ins are
guarded and every web node is not. **Core.** Touches
`runtime/executor/node-execution.ts`, `runtime/executor/graph-run.ts`,
`runtime/executor/tests/node-execution.test.ts`.

### 4 — Give browser-API, permission and HTTP-status faults their own codes (≈1 run, and it stops wasted retries everywhere)

The closed set has no member for a manifest-permission refusal, a
`chrome.*` API failure, or an HTTP status. All land on `web.action.failed`
(retryable), so a permanent fault burns three attempts —
`run-muht9lpw-a39aa056`, quoted above. Add e.g.
`web.browser.permission_denied` (non-retryable, `dispatch`) and
`web.transport.transient` (retryable, `execution`), and classify from Chrome's
own message where `browserActionFailure` sits today. **This repository.**
Touches `domain/src/runtime/failure/codes.ts`,
`domain/src/runtime/failure/classify.ts`,
`apps/extension/src/runtime/action-runner.ts`, and the three
`domain/src/runtime/failure/tests/`.

### 5 — Make rungs 1-3 reachable for a model-built Flow, or delete them (dead mechanisms, currently reading as done)

Three ladder rungs depend on `expectedState`, `readyState` and
`clearsInterference`. Two have no writer anywhere; the third is written only by
the recording path. Either have the Flow builder and the repair author emit
them — the model already names what it expects when it explores — or remove the
rungs so the ladder's depth is honest. Recommend emitting, since the mechanism
is built and tested. **Core** (the builder and repair authoring live in
`runtime/flow-bootstrap/` and `runtime/recovery/`), with a note in this
repository's architecture docs if web nodes gain the metadata.

### 6 — Ungate `clear_interference` from `retryable` (small, and it unblocks the commonest live obstruction)

`recovery-ladder.ts:146` requires `ladder.retryable`, and
`web.action.blocked_by_dialog` is `retryable: false` (`codes.ts:149`). Clearing
a dialog is a state change, not a repeat of a failed action, so the rung should
not be gated on the failed action being repeatable. Depends on fix 5 to have any
effect. **Core.** Touches `runtime/executor/recovery-ladder.ts`,
`runtime/executor/tests/recovery-ladder.test.ts`.

### 7 — Give every Core built-in node a structured failure record (0 counted runs; it is the policy hole)

37 of 41 emit none, so none is retryable. A `builtin.database.query` whose
adapter 503s gets no rung. Add records at the four existing producers' standard
and extend to the rest, at minimum to `builtin.database.*` and
`builtin.routine.*`. **Core.** Touches
`programs/automation-studio/nodes/{database,control-flow,routine,data}/` and
their `tests/`.

### 8 — Close the record-less `failed` hole in `failureForCommandStatus` (0 counted runs on the web path; it protects every other domain)

`runtime/io-policy.ts:145-149` returns `null` for status `failed`, so a
record-less failure reaches the attempt structureless and skips the ladder.
Default to a retryable `action_failed` record the way
`domain/src/runtime/failure/classify.ts:96-99` already does. Also guard
`adapter.ts:137` (`captureWebAutomationSnapshot`). **Core** for the first,
**this repository** for the second.

---

## Not verified

- Nothing was run: no `pnpm check`, no tests, no build, no live run. This is a
  read-only audit and the brief forbade edits; three other workers were editing
  Core concurrently.
- The unguarded-throw claim (fix 3) is established from the source structure —
  `node-execution.ts:86-105` sits outside the `try` at `:126`, and neither
  `runGraphFromSeed` nor the `graph-run.ts:337`/`:339` call sites has a
  try/catch. I did **not** drive a throw through `nativeNodeExecutor` to observe
  it, so the consequence chain (lost attempt row, rethrow at
  `service.ts:2858`) is **inferred** from the code path, not measured.
- "No writer for `readyState` / `clearsInterference`" rests on `grep` over
  `F:\!FluxIQ\packages\fluxiq\src` and over `domain/src` + `apps/extension/src`
  + `packages/`. A writer in a fixture, a stored Flow document, or a `.fluxiq`
  runtime artifact would not appear. The claim is "no code writes it".
- The campaign tally counts rows in `summary.md` files by `awk` on columns 18
  and 19. Seven rows produced no verdict and I did not open their bundles to
  find out why; four were `environment.missing` setup failures and are excluded
  per the standing rule that a setup failure is not a run.
- ~~Two whole-tree `grep` invocations over `test-runs/` timed out~~ —
  **obtained on a re-run; see "Rung usage across all 150 run directories"
  above.** The counts confirm the source-level finding empirically.
- `background/storage.ts`'s impact is inferred from its call sites; I did not
  trace every caller to confirm none of them guards.
- I did not audit `domain/src/runtime/llm-evidence/` in depth, nor
  `runtime/recovery/runtime-exploration.ts` (624 lines) or
  `recovery/context.ts` (708 lines). The brief's exploration-path symptoms
  ("an extraction request refused whole because one of its parts was unusable")
  appear **already fixed** — `output-nodes/extract-list/issues.ts:15` documents
  the whole-request refusal being replaced by per-part codes — but I verified
  that from the file's own comment, not by test.

## Open questions or contradictions found

1. **`web.validation.output_not_observed` is declared `retryable: true` and can
   never be retried.** `codes.ts:142` sets the flag; `retry-policy.ts:90`
   discards it on stage. Two files disagree about the same fact, and the
   comments in both read as deliberate. One of them is wrong and I cannot tell
   which was intended.
2. **`clear_interference` is gated off by exactly the condition it was built
   for.** The rung's stated purpose is "the commonest live-site obstruction"
   (`ladder-run.ts:136`), i.e. a dialog; `web.action.blocked_by_dialog` is
   `retryable: false`; the rung requires `retryable`. Was the gate meant to be
   `expectationSatisfied`-style rather than `retryable`?
3. **Three ladder rungs read metadata nothing writes.** `recorded-state.ts:9-11`
   says of `readyState`: "Until now no execution path read any of them… This is
   the reader." The reader was added; the writer never was. Is the recording
   path expected to grow it, or was a Flow-builder change lost?
4. **`retry-policy.ts:78-80` asserts "the producers that matter — every web
   action — always emit one."** True for the content-script path. Not true for
   `withRuntimeBounds`'s catch (`runtime/service.ts:386`) or
   `failureForCommandStatus`'s `null` (`io-policy.ts:148`), and not true for 37
   of 41 Core built-in nodes. The comment justifies not retrying a record-less
   attempt on a premise that holds for one path only.
5. **Is the post-run repair-and-replay intended to be the only model recovery?**
   `llm_diagnosis` is a ladder rung with a priority, a budget
   (`maxAdaptationOrLlmAttemptsPerRun`) and a "candidate still standing"
   comment, all of which read as though it executes in-run. It does not. If
   post-run replay is the design, the rung and its budget are misleading; if
   in-run diagnosis is the design, it is unwired.
