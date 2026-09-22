# conv-parking-and-resume — a run that stops on a question, and goes on from the answer

Task t086. Core worktree `F:\fxwork\t086\!FluxIQ`, branch
`task/t086-conversation-parking`. All paths below are relative to that
checkout unless said otherwise; source paths are relative to
`packages/fluxiq/src/programs/automation-studio/`.

## Outcome

Done.

`builtin.routine.approval` is live. A run that reaches it stops, raises a
question, and is resumed from the answer down `approved` or `rejected`, with
everything it had already done carried forward and the node never executed a
second time. Nobody answering takes the node's "if nobody responds" route, and
an answer offered to a run that has already moved on is refused.

Parking is not a property of that node. It is a property of a run: anything
executing inside one — a built-in node, a domain's own node, a gate — raises an
ask by emitting one effect, and `Ask.parks` decides whether the run waits. A
test proves a domain node that *succeeded* still parks the run, because the flag
is what decides and the status is not.

## What changed, and why

### New: `runtime/parking/` — the vocabulary (7 modules, 381 lines)

`automation-studio/runtime/` holds 24 of its 25 permitted files, so this is a
subdirectory, as the brief required. It depends on `core/` alone: nothing in it
imports the node catalog, because `nodes/routine/approval.ts` imports *it*, and
the other direction would close a module cycle of exactly the kind the audit's
own configuration was written about.

| File | What it holds |
| --- | --- |
| `ask.ts` | `AutomationStudioAsk` — the question, its kinds, its options, its routes, its stage — and `AutomationStudioAskDraft`, an ask as whoever raises it writes it |
| `ask-effect.ts` | `AUTOMATION_STUDIO_ASK_EFFECT`, the effect builder a raiser uses, and the defensive reader that finds an ask in an attempt's effects |
| `answer.ts` | `AutomationStudioAskAnswer` |
| `parked-run.ts` | `AutomationStudioParkedRun` — the run's place and everything it held — and its builder |
| `settlement.ts` | `automationStudioAskSettlement`: what became of an ask and which route the run leaves by, plus the refusal reasons |
| `port.ts` | `AutomationStudioParkingPort` — where the question goes, and optionally where the answer comes back from |
| `index.ts` | The barrel |

### Changed: the executor

- **`executor/graph-run.ts`.** After an attempt, the run reads its effects for
  an ask. When it finds one it builds the parked record, gives the ask to the
  port, and — when the ask parks — either waits in place or returns `waiting`
  carrying the parked record. The same module gained a seeded entry point,
  `resumeAutomationStudioGraphRun`, which enters the loop with a run's earlier
  attempts, values, effects, region transitions, variables, loop positions and
  spent step budget already in place, on a first pass that does nothing but
  leave the parked node by the route the answer chose.
- **`executor/resume.ts`** (new, 120 lines). `resumeAutomationStudioGraph` — the
  entry point a host calls. It takes the `waiting` trace, the resumption, and
  the options the run started with, and either returns the continued run or
  refuses and moves nothing.
- **`executor/contracts.ts`.** Three additions: `parking` on the run options,
  `parked` on the trace, and `ask` on an attempt — the attempt's own record of
  what it asked and what became of it.
- **`executor/node-execution.ts`.** An ask effect is never handed to a host's
  effect dispatcher, in the one place `records.write` is already held back. No
  domain is asked to know what an ask is.
- **`executor/expected-transition.ts`.** The effect a replay expects from the
  approval node is now `ask.requested`.
- **`nodes/routine/approval.ts`.** Rewritten. It returns `waiting` and emits one
  ask carrying its prompt, its timeout and `routes: { answered: "approved",
  denied: "rejected", expired: <its defaultRoute> }`. It no longer claims
  `route: "approved"` while waiting, and no longer writes `timeoutMs` and
  `defaultRoute` into the run's values under those bare names.

### The six decisions worth arguing with

1. **The ask is an effect, not a field on the node result and not a
   `definitionId` the executor knows by name.** A field would have meant editing
   `nodes/contracts.ts` and would still only serve nodes; an effect serves a
   node, a domain's native executor, and a gate, and `records.write` is the
   precedent for the executor reading one of its own effects. This is what makes
   parking general rather than a second life for one node.
2. **`parks` decides, not `status`.** A node that succeeded can park; a node
   that returns `waiting` with no ask behaves exactly as it did before, which is
   what keeps `builtin.timing.wait` unchanged.
3. **The parked record rides on the trace.** The trace is what
   `runtime/service.ts` already persists, so a parked run keeps for as long as
   its run record does and needs no store, no new table and no migration. That
   is also what keeps `service.ts` out of this change.
4. **Two resume shapes, and the better one is free.** A port that can hold a run
   open supplies `awaitAnswer`; the run then never returns at all, nothing is
   serialised, and nothing is lost. A port without it parks durably, which
   survives a restart and costs the gaps named below. Both settle through the
   same function, so they cannot disagree about where an answer leads.
5. **The timeout is resolved into a route when the run parks, not when it is
   answered.** `onTimeout: "deny"` is folded into `routes.expired` there and
   then, so the stored record says outright where silence leads and nothing has
   to re-read a node's parameters days later.
6. **An ask that could not be delivered fails the run.** If a bound port throws,
   the run stops with a message naming the ask rather than parking on a question
   nobody was ever shown — which is the silent refusal the product rule exists
   to prevent. With *no* port bound the run still parks and is still resumable;
   a host that has not wired a conversation up yet should not have its runs fail
   for asking.

## The four proofs the brief asked for

`runtime/executor/tests/resume.test.ts`, 15 tests, all passing.

| Proof | Test |
| --- | --- |
| A run parks at the approval node | "parks on the question with everything needed to go on, and does not route out of the node" — status `waiting`, `parked.routes` `{answered: approved, denied: rejected, expired: rejected}`, `expiresAtMs` = park + 60 s, `carried.variables` = the variable written before the park, and the one dispatch before it made exactly once |
| An answer resumes it down the chosen route with its earlier work intact | "resumes it down the approved route with its earlier work intact, and never runs the parked node again" — same `startedAt`, attempts `start, draft, remember, send, approve` then `recall, done`, exactly one `approve` attempt, exactly one `send-draft` dispatch across both calls, and the variable written before the park read back after it |
| A timeout takes the default route | "takes the node's default route once the ask has run out of time", plus "takes the approved route when that is what the node says to do about silence" and, for the in-place port, "takes the default route when it waited and nobody answered" |
| A second answer is refused | "is refused once the run has moved on" (`not_parked`) and "is refused while the run is still parked, once the ask itself has been settled" (`already_settled`) — neither re-dispatches anything |

Also proved there: a refusal routes to `rejected`; an answer naming another ask
is refused and leaves the run parked; a timeout claimed before the deadline is
refused; a bound port is told the question and an unreachable one fails the run;
a host that can hold the run open finishes it in a single call; a domain node
parks the run while succeeding; an ask with `parks: false` is said without
stopping the run; and an ask is never handed to a host's effect dispatcher.

`runtime/parking/tests/settlement.test.ts`, 9 tests: the route for each answer
kind, a chosen option's own route, an unknown option refused, `onTimeout: deny`
resolving to the refusal route, the deadline arithmetic, a raiser keeping its
own ask id, and a malformed ask payload never parking a run.

## What `runtime/service.ts` needs — the exact lines

`service.ts` is still exactly 6,275 lines; nothing in this task touched it.

**To bind the port.** One line, immediately after
`if (this.hostRuntime) graphOptions.hostRuntime = this.hostRuntime;` (currently
line 3100), inside the `graphOptions` block that begins at line 3088:

```ts
    if (this.conversations) graphOptions.parking = this.conversations.parkingPort({ projectId: input.projectId, runId: session.runId });
```

That is one line at the point of use, but the port has to get in from somewhere.
Following the `runDatasets` pattern (`private readonly runDatasets:
AutomationStudioRunDatasets;` at line 655, assigned in the constructor) the true
cost is **three lines**: the field, the constructor assignment, and the use. A
plain readonly property does not count toward the 223-method ceiling, so only
the line ratchet is in the way. t084 already built
`AutomationStudioConversations` as "the collaborator the service will expose",
so the field is the one it needs anyway.

**To resume.** Nothing in `service.ts`. Write it as a free function in a new
`runtime/service/parking/` collaborator taking ports, the way
`verifyAutomationStudioRuntimeSessionResult` and
`endAutomationStudioRuntimeSessionAfterThrow` are already called with ports
rather than being methods. It needs:

- the session, from `getRuntimeSession(projectId, runId)` — it carries `flow`
  (the whole `AutomationStudioFlowDocument`, `model/runtime.ts:37`) and `trace`
  (with `parked`), which is everything the Flow side of a resume needs;
- rebuilt graph options. The host-side ones — `effectDispatcher`,
  `runtimeCapabilities`, `nativeNodeExecutor`, `hostRuntime`, `onRecordBatch`,
  `recoveryBudget`, `allowLlmDiagnosis` — are built from the service's own
  fields and can be rebuilt identically. **The request-side ones cannot.** See
  the next section;
- `writeRuntimeSession(projectId, { ...session, status: trace.status, trace,
  finishedAt })` afterwards, and the ask marked answered in the conversation
  store in the same unit of work.

`answer-ask` (t084's endpoint) is the natural caller: it takes the answer, finds
the ask, and — when a run is parked on it — calls that function.

## Where a full resume is genuinely not possible, and exactly why

Three, stated rather than hidden. None of them applies to a host that binds a
port with `awaitAnswer`, which holds the run open and loses nothing.

1. **A durable resume cannot restore what the trace withheld.** The parked
   record rides on the *saved* trace, and the saved trace is the one
   `trace-withholding.ts` has cleaned: values the run resolved out of state are
   `[withheld]`, and rows it captured are dataset markers. Passing
   `options.inputs` again puts the run's own inputs back over the withheld
   copies — `graph-run.ts` seeds `{ ...seed.values, ...options.inputs }` for
   exactly that — but **the service cannot do it**, because a run's inputs are
   deliberately never persisted: `startInput.metadata` (`service.ts:3080-3083`)
   carries the idempotency key and the adaptive mode and nothing else. So a
   cross-process resume through the service resumes with `[withheld]` wherever a
   binding had resolved a value into a node's output. The fix, if it is wanted,
   is for the service to hold a run's inputs in memory keyed by run id for as
   long as it is parked — which then does not survive a restart, which is the
   whole trade.
2. **A run parked inside a Call Flow child is not resumable.**
   `composite-executor.ts:77` maps a waiting child to a waiting parent result
   and carries the child's trace, but the parent's own trace has no `parked`, so
   `resumeAutomationStudioGraph` refuses it with `not_parked`. The record is not
   lost — it is at `attempt.childTrace.parked` — so a nested resume is
   buildable: resume the child from there, then resume the parent from the
   child's outcome. It is a second, recursive path through `resume.ts` and
   `composite-executor.ts`, the latter of which this task does not own, so it is
   named rather than built.
3. **Dataset row ordinals restart on a durable resume.** The resumed run's
   record summary begins empty, so a capture after the park numbers its rows
   from 1 again for the same dataset id. This affects the markers in the saved
   trace, not the rows in the store, whose batch keys are attempt-based and
   still unique. A resume that captures no records — every case in the tests —
   is unaffected.

There is a fourth thing that is not a gap but reads like one: **the executor
cannot, by itself, guarantee an ask is answered once.** It refuses every second
answer it can see — the run has moved on (`not_parked`), or the ask is already
settled (`already_settled`), or the answer names another ask (`ask_mismatch`) —
but a caller holding two copies of the same still-pending parked trace could
drive it twice. That guarantee is the store's, and t084 built it: the store
refuses a second answer inside the transaction. The two must be used together;
the executor's checks are a net, not the lock.

## Specification only: the cases that today end an interaction that ought to ask

Not built. Every file named here belongs to another task.

### `no_repair` with reason `person_required`

`runtime/llm/harness/structured-response.ts:40` — "only a person can settle
this". Today the model says a human must decide, `runtime/recovery/annotation/
patches.ts:395-406` files a declined-repair receipt with
`verification.status: "not_executed", reason: "declined"`, and nobody is asked.

What should happen: the receipt stays — it is the record — and beside it the
repair raises an **open ask that parks**, on the run's conversation, carrying the
model's own account of the decision and the Flow's context. Concretely:

- `kind: "open"`, `parks: true`, `text` = the model's `reason` text, `routes:
  { answered: "success", denied: "failed", expired: "failed" }` — the defaults
  `AUTOMATION_STUDIO_DEFAULT_ASK_ROUTES` already supplies, so the raiser writes
  none of them.
- `timeoutMs` unset. This one waits indefinitely: there is no safe default for
  "a person must decide", and `onTimeout: "deny"` would recreate the silent
  refusal being removed.
- The person's words come back as the answer's `value` and are written into the
  run's values under `<nodeId>.answer`, which `graph-run.ts` already does, so the
  next recovery attempt can put them in the evidence the model reads. That is
  the whole point: the answer has to reach the loop, not just the receipt.
- The other four reasons — `control_gone`, `control_refused`, `several_alike`,
  `destination_gone` — are `kind: "choice"` asks, because each is a question with
  named candidates. `several_alike` in particular is one option per candidate,
  which is the case where a purpose-built UI would otherwise have been needed.

The one thing to decide first: **the repair path does not run inside the graph
executor**, so it cannot park by emitting an effect. It needs the same three
pieces at its own level — raise the ask through `conversations.writerFor`, stop,
and be resumable from the answer — and the recovery run's resumption point is a
recovery attempt, not a graph node. That is a second parking site, not a second
mechanism: it should reuse `AutomationStudioAsk`, `AutomationStudioAskAnswer` and
`automationStudioAskSettlement` unchanged, and hold its own equivalent of the
parked record.

### `automationStudioActionPermissionDenied` — "nobody to ask"

`runtime/action-permissions/gate.ts:200-203` refuses everything with a
consequence when the check runs with no run behind it. The sentence is exact:
there is nobody to ask. Two different situations are collapsed into it.

- **A run exists but no conversation is reachable.** This should no longer be a
  refusal. The gate raises the permission ask — `kind: "permission"`,
  `parks: true`, `askId` = the request's own `requestId`, `missing` = the
  consequence classes, `text` = Core's own `sentence` — and the run parks. t084's
  `writer.askPermission(request)` already files exactly that, keyed by
  `requestId`, and refuses any other key. When the gate is inside a graph run it
  raises the ask as an effect and the executor parks it, with no further
  plumbing; when it is not, it uses the writer directly.
- **There is genuinely no run.** A permission check outside any run — a
  validation pass, a dry compile — has no conversation to attach to and nothing
  to park. It should keep refusing, but the refusal should say *that*, not
  "nobody to ask": nothing is being executed, so nothing needs permission.
  Splitting the two is a one-line condition on whether a run context is present,
  and it is worth doing because today the second case's sentence is being read
  as a statement about the first.

Also on the "nobody to ask" list, and fixed by the same mechanism:
`runtime/recovery/runtime-exploration.ts:492-497`, which downgrades a domain's
`operator_approval_required` to `destructive_action_refused` because "a domain
code read as one here is a refusal with nobody to ask". With a conversation there
is somebody to ask, so the downgrade should become a permission ask carrying the
domain's own reason, and `user_intervention_required`
(`exploration-outcome.ts:54-55`) — which today only the permission gate can
produce — becomes its outcome.

`runtime/recovery/annotation/patches.ts:308-314`'s `permissionOutcome:
"undeclared"` should **not** become an ask. "Nobody can be asked to allow a
consequence nobody declared" is correct: the thing missing is the declaration,
not the person. Asking a person to approve an unnamed consequence is worse than
refusing.

## Reconciling with `runtime/conversations/` (t084)

There are now two ask types in Core and they must converge before either ships.

| | `runtime/parking/` (this task) | `runtime/conversations/` (t084) |
| --- | --- | --- |
| The ask | `AutomationStudioAsk` | `AutomationStudioConversationAsk` |
| The answer | `AutomationStudioAskAnswer` | `AutomationStudioConversationAnswer` |
| An option | `{ value, label, route? }` | `{ id, label }` |
| Answered at | `answeredAtMs` | (the plan's contract writes `answeredAt`) |
| Where silence leads | `routes.expired`, resolved when the run parks | `onTimeout`, with, in t084's words, "no default to take" |

Recommendation: **the conversation store's ask is the durable one and should be
the shared type; the parking module's should become a view of it.** The two
differences that matter are real, not cosmetic, and both are additions to
t084's:

- an option needs the route it resumes down (`route?`), or the answer cannot be
  turned into a branch without the raiser being consulted again;
- an ask that parks needs `routes` — where an answer, a refusal and silence each
  lead. This directly answers t084's open question 5: a `choice` ask does not
  need a `defaultOptionId`; it needs `routes.expired`, because what a timeout
  has to produce is a route, not an option.

It also answers t084's open question 4 — "`expired` is a status with nothing that
sets it" — and its own diagnosis was right: whatever parks a run is what expires
its ask. Here that is `AutomationStudioParkedRun.expiresAtMs`, and the sweep is
one job that, for each parked run past its deadline, calls
`resumeAutomationStudioGraph` with `{ kind: "timeout" }` and marks the ask
`expired`. The executor refuses a timeout claimed before the deadline, so the
sweep cannot take a default route early. Nothing schedules that job yet.

Two smaller notes for whoever integrates:

- I named the field `answeredAtMs`, matching this area's own convention
  (`requestedAtMs` on the permission request, `parkedAtMs` and `settledAtMs`
  here), not the plan's `answeredAt`. Renaming is one line in
  `runtime/parking/answer.ts` and its uses if the plan's spelling is preferred.
- The approval node's effect is now `ask.requested`, not
  `routine.approval.requested`. Nothing consumed the old name — the supervisor's
  grep and mine agree — and `executor/expected-transition.ts` was the only
  reference, which this task updated. t084's report still refers to the old name.

## Commands run and observed results

All in `F:\fxwork\t086\!FluxIQ` unless stated.

- `node scripts/structure-audit.mjs` → `structure-audit: passed (174 warning(s),
  361 baselined)` — the same counts discovery recorded before this task, so
  nothing was newly baselined and no ratchet moved.
- `pnpm check` → structure audit passed, `packages/contracts check: Done`,
  `packages/client-gateway-websocket check: Done`, `packages/fluxiq check: Done`,
  `apps/web check: Done`.
- `packages/fluxiq` → `npx vitest run runtime/executor runtime/parking` →
  **13 files, 206 tests passed**.
- `packages/fluxiq` → `npx vitest run runtime/executor runtime/parking nodes
  runtime/tests/executor.test.ts runtime/service/summaries/tests/
  run-detail-preservation.test.ts` → **302 of 303 passed**; the one failure was
  `Test timed out in 15000ms` on `run-detail-preservation`, which passes in
  3.7 s when run alone (verified immediately after).
- `packages/fluxiq` → `pnpm test` (the whole package, from inside the package as
  the brief requires) → **2,841 passed, 31 failed, 1 skipped, across 333 files**.
  See "Not verified" — the failures are environmental and not stable.
- `packages/contracts` → `pnpm test` → 53 passed. `packages/client-gateway-websocket`
  → 3 passed. `apps/web` → **1,256 passed**, 240 files.
- `pnpm build` → completed, Next.js route table printed, no errors.
- `F:\fxwork\t086\!FluxIQWebExtension` → `pnpm check` → `structure-audit: passed
  (91 warning(s), 122 baselined)`, and every one of the 10 workspace projects
  `Done`.

## Not verified

- **The 31 failures in the full `packages/fluxiq` run are not attributable to
  this change, and I could not prove that by baseline comparison** — `git stash`
  is blocked for workers, so I could not run the same suite on an unmodified
  tree. What I did instead: the failing *set* differs between runs (
  `adaptive-retry-resume` failed in the first full run and passed in the second,
  where different files failed instead); every failure text is environmental —
  `Test timed out in 15000ms`, `EBUSY: resource busy or locked, unlink
  ...global.sqlite`, `ENOTEMPTY: directory not empty, rmdir`, and
  `expected 527.2 to be less than 500`; each one I re-ran individually passed
  (`adaptive-retry-resume` in 21 s, `run-detail-preservation` in 10.9 s); and no
  failing test constructs an approval node or an ask, while the code path for a
  run that raises none is byte-for-byte the branch it was before. A supervisor
  with stash or a second worktree should still confirm this against `dev`.
- **No live browser or panel run.** Nothing in this task is reachable from a UI
  yet: no endpoint answers an ask into a run, because the service line above has
  not been added.
- **No run has ever parked against the real conversation store.** The port is
  faked in tests. The fake is small and the shape is two methods, but the first
  real binding may still find something.
- **The Call Flow gap (limitation 2) is read from `composite-executor.ts:77`,
  not exercised.** No test parks inside a child Flow.
- **Nothing sweeps expired asks.** The timeout resume path is tested; the job
  that would call it does not exist.

## Open questions or contradictions found

1. **Two ask types now exist.** Covered above. This needs a decision before
   either side is wired to a person, and my recommendation is to fold
   `runtime/parking/`'s ask into `runtime/conversations/`'s, adding `route?` to
   the option and `routes` to the ask.
2. **A parked run's trace is the durable record, and the runtime stream store
   writes `waiting` as `running`** (`storage/project/runtime-stream-store.ts:643`).
   Nothing in this task depends on the distinction, but a UI listing "what is
   waiting on me" will read `running` for a parked run and needs the parked
   record, not the status, to tell them apart.
3. **`admission.ts:12` counts `waiting` as active**, so a parked adaptive run
   holds its admission slot for as long as it waits. With an indefinite timeout
   that is forever. Whoever ships the permission gate's ask should decide whether
   a parked run keeps its slot; my view is that it should not, because the thing
   it is waiting for is a person, not a resource.
4. **A person's free-text answer is written into the run's values and therefore
   into the saved trace.** That is what makes an open ask useful — the answer has
   to reach the Flow — but it is a new thing the trace persists, and the
   withholding machinery does not cover it. If answers can carry anything
   sensitive, the answer's value needs the same treatment run inputs get.
5. **A late answer is honoured, not refused.** While a run is still parked, the
   answer is the only thing that will ever move it, and refusing it would strand
   the run for good. A sweep that marks an overdue ask `expired` is what closes
   that window, and until one exists an answer given a week late will resume the
   run. Stated here because it is a deliberate choice and the opposite is
   defensible.
