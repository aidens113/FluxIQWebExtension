# t165 — Every node executes defensively by default, at one seam, in Core

Repository: `F:\!FluxIQ` (Core), branch `dev`. Nothing committed, nothing built.
All edits are under
`packages/fluxiq/src/programs/automation-studio/runtime/executor/`.

## Outcome

**Done.** The default policy exists, is on for every node with nothing to opt
into, is bounded, records what it absorbed, and no longer stops a Flow for a node
whose failure is not fatal to it. Three of the t163 audit's ranked fixes that land
on my files are done (3, 6, and 1 in the form argued below), and one dispatch hole
the audit inferred but could not measure is closed and now has a test.

Executor suite: **273 tests in 17 files, all passing** (before: 199 in 12).
`npx tsc --noEmit` clean for my files. `node scripts/structure-audit.mjs`: my one
violation fixed; one remaining violation belongs to another worker.

---

## The seam, and why no node can bypass it

`executeAutomationStudioNode` (`executor/node-execution.ts`) is the one place any
node is dispatched. It has four sub-paths, and every one is now inside the policy:

| Dispatch path | What reaches it | Covered by |
| --- | --- | --- |
| `definition.execute` | Core's 41 built-ins | inner try, as before |
| `options.effectDispatcher` | every domain output (`policy.output.dispatch`) | inner try — it is awaited inside it |
| `options.nativeNodeExecutor` | host-executed and importer nodes | **new outer try** |
| `options.compositeExecutor` | Call Flow children | **new outer try** |

`executeAutomationStudioNode` now **never rejects**: whatever throws, from the
dispatch or from capturing host state around it, becomes a classified failed
attempt. `runGraphFromSeed` never rejects either, so a throw from the step loop,
the question port, the record hook or a host callback becomes a failed trace
rather than reaching `service.ts` and ending the session with no attempt row.

**This is audit fix 3, and the audit's inference was right.** The
`nativeNodeExecutor` and `compositeExecutor` awaits sat outside the only try, so a
host node or a Call Flow child that threw took the whole run down with no trace.
A test now drives a throw through each and observes the retry
(`tests/defensive-policy.test.ts`, "retries a host-executed node that throws,
which used to reject the whole run"). t167 guarded
`native-runtime.ts`'s own body on the domain side; this is the Core half, and it
was still necessary — a throw from the dispatcher underneath, or from host-state
capture, never reached that guard.

**A test proves no path is missed**, and it is the reason this is a default rather
than a convention: it reads every non-test source file under
`programs/automation-studio/runtime/` and asserts that the four dispatch
expressions occur in `executor/node-execution.ts` and nowhere else. A dispatch
path added tomorrow either goes there or fails that test.

---

## The default policy

New module: `executor/defensive/` (10 files, barrel, own `tests/`). Exported
through `executor/index.ts`, so a host, a domain or a test reads the same numbers
the runtime enforces.

### Retries, on by default, and now actually reachable

The default was already 3 attempts at 250 / 1 000 / 2 000 ms and did fire. What it
could not reach was almost everything, because `automationStudioAttemptIsRetryable`
demanded a structured failure record and answered no without one. The gate now
asks `automationStudioAssessAttemptFault`, which reads, in order:

1. **A fault classified where it happened** — a thrown value, caught at the
   dispatch seam with the error object still in hand. Richest evidence there is.
2. **The producer's own structured record.** Its `retryable` decides; Core does
   not second-guess it.
3. **The message**, for every node that reports a failure without a record —
   which is 37 of Core's 41 built-ins, `withRuntimeBounds`'s catch, and
   `failureForCommandStatus`'s `null`.

That third step closes the audit's "generic structureless-failure hole" at the
seam rather than per producer, so `io-policy.ts:148` needed no change: a record-less
`failed` whose message names a transient fault is now retried.

The comment at old `retry-policy.ts:78-80` — "the producers that matter, every web
action, always emit one" — was the audit's open question 4. It was false for three
paths and is gone.

### The fault classes, and where the line is drawn

`defensive/thrown-error.ts` and `defensive/transient-status.ts`. Retried:

- **Transient transport status** 408, 425, 429, 500, 502, 503, 504 — read off
  `status`, `statusCode`, a nested answer, a `cause` chain, or stated in the text.
  A bare three-digit number is **not** read as a status ("500 rows is over the
  export limit" stays deterministic); it must follow a word naming it or be
  followed by its own standard phrase.
- **Transport codes**: `ECONNREFUSED`, `ENOTFOUND`, `EAI_AGAIN`, `ENETUNREACH`,
  `EHOSTUNREACH`, `UND_ERR_CONNECT_TIMEOUT`, `ECONNRESET`, `ETIMEDOUT`, `EPIPE`,
  `ENETRESET`, `UND_ERR_HEADERS_TIMEOUT`, `UND_ERR_BODY_TIMEOUT`,
  `UND_ERR_SOCKET`, `ERR_SOCKET_CONNECTION_CLOSED`.
- **Type names**: `AbortError`, `TimeoutError`, `NetworkError`, `FetchError`,
  `ConnectTimeoutError`.
- **A malformed answer** — a parse failure over a body, which a truncated answer
  produces and a second read often does not.
- **Transient text** with no code or status at all: "fetch failed", "socket hang
  up", "temporarily unavailable", "rate limit", "service unavailable", and so on.

Refused: **any other status** (400, 401, 403, 404, 409, 422 — the same request is
answered the same way, and a 401 belongs to a person, not a loop); **an
unclassifiable throw** such as a `TypeError` inside a node, because attempting it
again spends the run's time to be told the same thing; **an abort raised while the
run was already being cancelled**, because the deadline it passed will not come
back; and **the deterministic refusals Core raises itself**, which now carry
explicit non-retryable records instead of none —
`executor.parameter.unresolved_state_path`,
`executor.node.definition_version_unavailable`, `executor.node.not_executable`,
`executor.region.timeout`.

**Where I drew the line and why:** on whether the same request, unchanged, could
be answered differently. A status or a transport code that says "not now" can be;
a status that says "not this" cannot. An unclassified throw is refused because the
run should not pay for optimism about a defect — but it is still **recorded**, and
the Flow may still carry on past it (below), which is the other half of the
instruction.

### A retry hint is honoured

`defensive/retry-hint.ts`. `Retry-After` is read from the error, its `headers`
(a bag answering `get` or a plain object), a nested answer, or its `cause`; as
delta-seconds, as a numeric string, or as an HTTP date measured from now. A
domain can also pass one through by putting `retryAfter` in the node's outputs.
The hint wins over the backoff table when it is longer, and is clamped at 60 s —
a remote service does not get the clock of the run.

### Nothing is swallowed

Every assessment, absorbed or refused, lands on a run-scoped ledger
(`defensive/ledger.ts`) that rides out on the trace as `trace.defence`:

```
{ absorbedCount, refusedCount, faultCount, waitedMs, waitBudgetMs,
  entries: [{ nodeId, attemptId, attemptNumber, outcome, category, code,
              source, effect, reason, waitedMs, hintedWaitMs?, httpStatus? }],
  continuedPastNodeIds? }
```

`outcome` is `retried`, `continued` or `stopped`. Entries are capped at 200 while
`faultCount` keeps rising, so a pathological run cannot balloon the trace. Absent
entirely on a run that met no fault.

### Bounded time, and the figures

| Bound | Value | Where |
| --- | --- | --- |
| One wait between attempts | **30 000 ms** | `AUTOMATION_STUDIO_MAX_RETRY_WAIT_MS` |
| All waits at one arrival at one node | **60 000 ms** | `AUTOMATION_STUDIO_MAX_NODE_RETRY_WAIT_MS` |
| All waits in one run | **300 000 ms** | `AUTOMATION_STUDIO_MAX_RUN_RETRY_WAIT_MS` |

Past the run bound the policy stops absorbing by attempting again at all
(`automationStudioRunMayStillAbsorb`), because attempts are what cost wall clock
after that point — a bound that only capped the sleeping would be stated and not
enforced. A fresh arrival at a node gets a fresh per-node allowance, the same way
it gets the whole ladder again; the run allowance is never reset.

These are enforced, not documented: a Flow asking for 25 attempts an hour apart is
held to two waits of 30 s and then 23 attempts with no wait at all
(`tests/defensive-policy.test.ts`). A run of six such steps spends exactly
300 000 ms and the sixth is attempted once.

**Combined worst case per node, composed with t167's in-page retries.**
t167 adds up to ~5 s per verb inside the page, and 0 where the verb already spent
the command's time. Core then adds, per arrival at one node:

- **by default** (3 attempts): 250 + 1 000 = **1.25 s** of waiting, plus 2 extra
  dispatches. With t167's ~5 s per dispatch that is ~16 s worst case, ~3× the
  command's own timeout in the ordinary case;
- **hard ceiling** for any document: 60 s of backoff, plus up to 30 s at the
  pre-node readiness gate and 30 s at the ladder's readiness rung (both capped by
  `AUTOMATION_STUDIO_READINESS_CAP_MS`), plus `maxAttempts` dispatches each
  bounded by the command's own `timeoutMs` and any region deadline.

Per run: **300 s of added waiting, full stop**, plus node execution time, which is
bounded by `maxSteps`, region `timeoutMs` and the Call Flow deadline. The two
policies **compose**: Core waits between whole-node attempts, t167 waits inside
one dispatch, and neither is nested inside the other's loop.

### A retried action does not act twice

Two rules, asking the question from opposite ends because the evidence differs:

1. **The failure was found after the action ran** (stage `confirmation` or
   `verification`). That is evidence the action ran, so looking again needs a
   *positive* reason — `automationStudioNodeRepeatCannotAct`: the node touches
   nothing outside the run (`sideEffectClass === "none"`), or it states
   `effect: "observe"` / `idempotent: true` / an idempotency key, or it declares a
   record output (its purpose is carrying rows out; reading them again presses
   nothing, and each attempt captures under its own batch key).
2. **The fault itself is `ambiguous`** — the request went out and only the answer
   was lost. No evidence either way, so the node keeps its retries unless it acts
   on the world. A fault that demonstrably never reached anything (`unacted`) is
   repeated freely however consequential the node is, because nothing happened to
   repeat. That distinction is per status and per code: 408, 425, 429, 503 and
   every connect-time code are `unacted`; 500, 502, 504 and every
   dropped-after-send code are `ambiguous`.

"Acts on the world" for this purpose is `automationStudioNodeMutates`: marked
`destructive`, marked `externalSideEffect`, declaring Core's `effect: "mutate"`,
gated behind `requiresApproval`, or a real (non-dry-run) `builtin.database.*`
write. It is **deliberately narrower** than `automationStudioNodeSideEffectClass`,
which stays exactly as it was for the host context. The two now answer different
questions in different functions, both documented (`defensive/node-side-effect.ts`).

---

## The contradiction t163 and t167 named, and what I did about it

`web.validation.output_not_observed` is `retryable: true` at stage `verification`,
and the old gate discarded it on the stage alone. **11 of ~18 reportable live runs
died there.** I agree entirely with t167's diagnosis: the stage was being used as a
proxy for side-effect safety and does not carry it, and rewriting the stage would
destroy the question the field answers. The domain's table is right; Core's gate
was wrong.

**I did not implement t167's specified predicate, because it cannot admit the case
it was specified for.** The specification was: admit a `verification` failure when
`sideEffectClassForNode` is `"none"`. That function returns `"external"` for
`builtin.policy.action` unconditionally
(`node-execution.ts`, now `defensive/node-side-effect.ts:18`), and **every** web
output node is a `builtin.policy.action`. So the literal change is a no-op for all
18 of them, including the paginated read t167 explicitly asked me not to skip.

What I built instead keeps t167's reasoning — ask the node about safety directly
rather than inferring it from the stage — and keeps its specified rule as one of
three signals:

- `sideEffectClass === "none"` — Core's own check and wait nodes. **t167's rule,
  honoured exactly.** `builtin.policy.expectation`, the one Core built-in that
  reports `retryable: true` at `verification`, is now retried; a test asserts it.
- the node states `effect: "observe"`, `idempotent: true`, or an idempotency key.
- **the node declares a record output.** This is the one that covers the measured
  failure, paginated or not: the extraction action node whose rows failed their own
  post-condition is looked at again.

And what it refuses is a domain output that says nothing about itself. Core cannot
tell a read from a press, t167 took specific care that a click is never pressed
twice, and re-dispatching the whole node on a guess would undo that care for the
sake of a case the third signal already covers.

### The exact change I recommend on the domain side (t167's files, not mine)

One line per verb, and it makes this exact rather than inferred:

> In `domain/src/output-nodes/native-runtime.ts`, have
> `createOutputNodeImplementation` stamp `metadata.effect` on the node it builds:
> `"observe"` for `web.dom.{extract, extract_list, capture_snapshot, assert,
> wait_for_selector, wait_for_text, scroll}` and `web.browser.tab`, and `"mutate"`
> for `web.dom.{click, type, clear, select, keypress, check, upload, dialog}`,
> `web.browser.navigate` and `web.browser.download`.

Core reads both today, with no contract change: `"observe"` admits a
verification-staged retry (`automationStudioNodeRepeatIsSafe`), and `"mutate"`
withholds an ambiguous-fault retry (`automationStudioNodeMutates`). It is the
same vocabulary as `AutomationStudioActionEffect` in
`runtime/action-permissions/declaration.ts`, so it introduces no new concept.
**`web.validation.output_not_observed` should stay `retryable: true` at stage
`verification`.** Nothing about the table needs to change.

---

## A Flow no longer stops for a node whose failure is not fatal to it

`defensive/continuation.ts`. When the ladder is spent and the Flow has no failed
route of its own, the run used to return `failed` — every time, for every node,
whatever the node was for. It now asks whether carrying on would be wrong, and
each way of being wrong is named and tested:

1. **The failure says the premise is gone.** A complete
   `Record<AutomationStudioAdaptiveFailureClass, boolean>`, so a new category is a
   compile error until somebody decides. Survivable: `action_failed`, `timeout`,
   `target_not_found`, `target_ambiguous` — "this step did not do its thing". Not:
   `auth_required`, `user_intervention_required`,
   `blocked_by_capability_or_policy`, `external_side_effect_denied`,
   `expected_state_missing`, `unexpected_state`, `output_not_observed`,
   `page_changed`, `navigation_unexpected`, `missing_router_or_subflow_target`,
   `graph_validation_or_unknown_node`, `ambiguous_or_unknown` — "the world is not
   what the Flow assumed". `ambiguous_or_unknown` is the entry worth defending:
   nobody knows what happened, so nobody can say the premise survived it.
2. **The result was never confirmed** (stage `confirmation`/`verification`): the
   node ran, what it did is unknown, everything after it assumes it worked.
3. **The author said so.** `onFailure: "stop" | "continue"` on the node, then on
   the Flow, and `metadata.optional: true`. These outrank every rule below, in
   both directions — stopping *is* sometimes the instruction.
4. **The node acted on the world.**
5. **The node held the answer** — it captures records, so walking past it returns
   a run that succeeded and answered nothing.
6. **Something downstream reads it** — a data edge, or a `$state` binding onto
   `nodeId`, an output id, or `nodeId.outputId`, walked to depth 16 over the nodes
   reachable from it.
7. **There is nowhere to carry on to**, or the node has no registered definition
   so Core cannot enumerate what it produces.

Otherwise the Flow takes the success route, the node keeps its failed attempt, and
`trace.defence.continuedPastNodeIds` names it.

---

## Audit fix 6: the rung for dialogs was switched off by the dialog code

Done. `recovery-ladder.ts` gated rungs 2 (`await_recorded_state`) and 3
(`clear_interference`) on `ladder.retryable`, and `web.action.blocked_by_dialog`
is `retryable: false`. Both rungs now read a new `mayRepeat`, which asks only
whether dispatching this node again could act on the world twice. **Only rung 4
(`retry_node`) still asks `retryable`, and it should: it is the only one that
repeats the failed action unchanged.** Rungs 2 and 3 change something first — wait
for a state, clear an obstruction — so the node that runs again is not running
against the same page. A test drives a non-retryable dialog failure through the
interference rung and observes the dismissal and the re-attempt.

---

## Audit finding 4: three rungs read metadata nothing writes

Unchanged, deliberately, and it is now the only item on this surface still open.
`readyState` and `clearsInterference` have no writer in either repository, and
`expectedState` is written only by the recording proposal path. The writers live in
`runtime/flow-bootstrap/` and `runtime/recovery/`, both explicitly outside my
brief and both being edited by other workers, so I could not add them; and
deleting three built, tested and now-ungated rungs is a larger decision than my
brief carries. I did the part that is mine: they are no longer gated off by
`retryable`, so the moment a writer lands they fire.

**The change I recommend**, in one place, matching the audit's own preference for
emitting over deleting: the Flow authoring path already knows what the model
expects, because the model names it while exploring. Have
`flow-bootstrap/authoring/assemble.ts` write `parameterValues.readyState` from the
pre-state the exploration observed before each accepted step, and mark any step
whose purpose was to dismiss an obstruction with `metadata.clearsInterference:
true`. Nothing in Core's executor needs to change for either.

---

## Commands run and observed results

From `F:\!FluxIQ\packages\fluxiq`:

- `npx tsc --noEmit` → **clean for every file I own.** Two errors remain, both in
  `src/programs/automation-studio/runtime/llm/provider-retry/tests/call.test.ts`
  (`TS2532: Object is possibly 'undefined'`, lines 115 and 137) — a directory
  another worker created during this task, which I must not touch.
- `npx vitest run src/programs/automation-studio/runtime/executor`
  → **17 files, 273 tests, all passing.** Before my change: **12 files, 199
  tests, all passing.**
- `npx vitest run src/programs/automation-studio/runtime`
  → **271 files: 237 passed, 34 failed; 2 762 tests: 2 756 passed, 5 failed, 1
  skipped.** Before my change, measured at the start of this task: **263 files:
  228 passed, 35 failed; 2 560 tests: 2 559 passed, 1 skipped.** The 34/35 failing
  *files* are collection failures from other workers' in-flight edits to
  `runtime/llm/` (at baseline every one of them was
  `automationStudioExploredEvidenceLabel is not a function`).
  The 5 failing tests, each re-run:
  - `live-patch.test.ts` × 2 — **pass when the file is re-run** (25/25 alone, and
    33/33 alongside a second file). Load, as the brief warned.
  - `instruction readiness summaries` — failed at **15 003 ms**, the suite
    timeout. Load.
  - `deepseek-bootstrap-exploration.test.ts` "asks again after a decision that
    runs past its deadline" and `deepseek-runtime-recovery` "keeps the grant
    through exploration decisions that run past the call's deadline" — **fail in
    isolation too**, with
    `code: flow_bootstrap.evidence_invalid_decision`,
    `stage: provider_output_validation`, `decisionCount: 0`. Not mine: the graph
    never runs, the provider's reply is rejected during validation, and
    `llm/evidence-loop.ts`, `llm/harness/run.ts`, `llm/provider-contract.ts` and
    `flow-bootstrap/plan/evidence-schema.ts` are all modified by other workers
    right now — the same path, including the half-finished `llm/provider-retry/`
    that does not type-check.
- From `F:\!FluxIQ`: `node scripts/structure-audit.mjs` → **1 violation**,
  `directory-files` on `runtime/llm/tests/` (26 files, limit 25), caused by three
  untracked test files another worker added. My own violation —
  `executor/contracts.ts` reaching into `./defensive/ledger.ts` instead of the
  barrel — is fixed. `pnpm structure:baseline` was **not** run; the audit reports
  2 baseline entries that could be lowered, left for the supervisor.

Tests added, against the brief's list:

| Required | Where |
| --- | --- |
| each retried fault class | `defensive/tests/thrown-error.test.ts` (18 tests) |
| a deterministic refusal not retried | same file, plus `tests/defensive-policy.test.ts` "attempts a deterministic refusal exactly once" |
| the bounded total time | `defensive/tests/retry-wait.test.ts`, and two end-to-end bounds in `tests/defensive-policy.test.ts` |
| an absorbed fault being recorded | `tests/defensive-policy.test.ts`, "records each absorbed fault with its code, its attempt and what it cost"; a refused one too |
| a dispatch path proving a node that opts into nothing still gets the policy | `tests/defensive-policy.test.ts`, one test per path plus the source-level guard |

Assertions that flipped, all deliberate and each re-commented in place:

- `tests/node-execution.test.ts` — the expectation node whose evaluator rejects is
  now attempted 3 times, not 1 (`sideEffectClass === "none"`). A new test covers
  the rejected node that carries rows out, also 3.
- `defensive/tests/assess.test.ts` — the old blanket "refuses a failure found
  after the action ran, whatever the record says" is now conditional on the node.

## Not verified

- **No live run, no browser, no `pnpm check`, no `pnpm build`.** I ran tsc,
  the runtime vitest scope the brief named, and the structure audit.
- **The combined worst case per node is arithmetic, not measured.** t167's ~5 s
  figure is theirs; I did not exercise the two policies together.
- **A resumed (parked) run starts with an empty defence ledger.**
  `AutomationStudioGraphRunSeed` does not carry it, so a run that parks on a
  question and is resumed loses the record of what it absorbed before parking, and
  gets its 300 s waiting allowance afresh. Both are bounded and safe; neither is
  right. It needs a field on the seed and is not done.
- **Whether the measured 11-run case is covered depends on the extraction action
  node carrying `recordOutput`.** I could not prove it from Core: the parameter is
  optional and `null` means "save nothing". The answerability machinery
  (`flow-bootstrap/answerability/plan-record-sets.ts`) implies a Flow that must
  answer declares one, and t167's own account of
  `output-nodes/extract-list/dispatch.ts` reading `recordOutput` is consistent
  with that, but I did not run a Flow through the builder to confirm. **If it turns
  out not to be set, the recommended `metadata.effect` stamp above is the fix, and
  it is a one-line change.**
- I did not exercise the `defence` summary through persistence — whether
  `service.ts` stores the new `trace.defence` field or drops it on the way to
  storage. `service.ts` was offered to me and I did not need it; this is the one
  thing that might.
- The two `deepseek-*` test failures are attributed to other workers by reading
  the failing stage and `git status`, not by reverting my changes and re-running.

## Open questions or contradictions found

1. **t167's specified predicate cannot admit the case it was specified for**, as
   set out above: `sideEffectClassForNode` is `"external"` for every
   `builtin.policy.action`. Flagging it because the coordinator relayed it as an
   exact change and it would have shipped as a silent no-op.
2. **`automationStudioNodeSideEffectClass` calls every domain output `external`,
   and nothing tells Core which of them act.** That is the root of finding 1 and it
   is a missing declaration, not a gate bug. The `metadata.effect` stamp above
   fixes it in one place; until then Core's refusal to guess costs a retry on every
   read verb that carries no record output.
3. **The audit's fix 7 — 37 of 41 Core built-ins emit no failure record — is now
   much less urgent than its ranking suggests**, because the message-based
   classification at the seam covers a transient fault from any of them without
   their cooperation. What a record would still add is a *deterministic* refusal
   being named as one, so those nodes do not spend three attempts on a defect.
   Worth doing, worth reranking.
4. **`builtin.policy.expectation` is now retried three times by default.** That is
   right — re-asking a check cannot act on anything — but it triples the calls to a
   host's expectation evaluator for a state that genuinely does not hold. If that
   proves expensive live, the answer is a shorter allowance on that one definition,
   not a narrower gate.
5. **Audit open question 5 stands untouched:** `llm_diagnosis` is a ladder rung
   with a priority and a budget that is never executed in-run. My continuation rule
   now softens its worst effect — a run reaching that rung no longer necessarily
   ends — but the rung is still a candidate that resolves nothing.
