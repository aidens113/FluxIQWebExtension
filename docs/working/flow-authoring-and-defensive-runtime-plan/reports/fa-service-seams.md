# fa-service-seams — B0, A2, A10, A9, A11 (Core half), B8

Task t087, Core-paired. Worktrees `F:\fxwork\t087\!FluxIQWebExtension` and
`F:\fxwork\t087\!FluxIQ`, both on `task/t087-service-seams`. No commit was made.

## Outcome

**Done.** One step was **skipped as already satisfied** (A9), and A11 grew
during the task: the supervisor sent two findings from t081 mid-flight, and both
are built rather than noted.

| Step | State | How it was proved |
| --- | --- | --- |
| B0 | Done | End to end, model-free: a real recording through the real service into a Flow, and the real executor spending the gap as its wait ceiling |
| A2 | Done | Model-free through the real `generateFlowBootstrapAdaptation`, plus a live DeepSeek build that ran with the hook wired |
| A10 | Done | Model-free assertion on the stored trace of a real build |
| A9 | **Skipped — already reachable** | Measured: the domain runs 18 nodes through `core.run_node`, two of them waits |
| A11 (Core half) | Done, and wider than briefed | Three model-free cases through the real service, gate, **conversation store** and approve path |
| B8 | Done | Refusal list and target-override change covered by tests; the resume half is a guard removal, not proved live |

`runtime/service.ts` went **down**, from 4,637 lines to 4,614, and its structure
baseline was re-recorded at the lower figure.

## What changed and why

### B0 — the recorded gap reaches the node, and the run spends it

The reader half landed with t076 and had nothing to read. Four edits close it:

- `runtime/recording-flow-proposal.ts` — `RecordingFlowActionCandidate` gains
  `recordedGapMs?: number`.
- `runtime/service/recordings/proposal-candidates.ts` — the candidate builder
  accepts and validates it; `appendRecordingProposalToFlow` writes it into node
  metadata; `recordingCandidateRecordedGapMetadata` is the one place that spells
  the field, used by the node writer and the definition writer both.
- `runtime/service/recordings/candidate-definitions.ts` — a reviewed candidate's
  node definition carries it too.
- `runtime/service.ts` — the derivation, at the one call site where the
  recording's clock and the candidates meet.

**The gap is measured between candidates, not between timeline entries**, and
that is the one judgement in the step. The executor-ladder report proposed
`entry.monotonicOffsetMs - previous.monotonicOffsetMs` over consecutive entries.
A Flow node follows the previous *node*, so what the run may wait for is
everything since the previous action — the observations in between are part of
that wait. Measuring to the entry immediately before would report a few
milliseconds for a pause of seconds and leave every ceiling on its 2 s floor,
which is the inert outcome B0 exists to end. `recordingCandidateGapTracker()`
holds the last candidate-bearing entry's offset; the first candidate gets no
gap, two candidates from one entry give the second a zero, and a clock that went
backwards is dropped rather than clamped.

A zero is kept rather than dropped, because absent and zero are different facts:
absent is "nothing came before", zero is "recorded back to back". Both clamp to
the same 2 s floor today.

### A2 — the state digest hook is passed for a build

`runtime/service/flow-bootstrap-commands/state-digest.ts` (new) adapts the
loop's hook, which names only a call and a tool, to the domain's, which needs
the phase. The side is tracked by call — the first answer for a call id is its
"before", the second its "after" — rather than derived one from the other, which
would make the loop's own state-chain check vacuous
(`recovery/exploration-state/digest-source.ts` says why). A domain with no
`captureStateDigest` gets no hook at all, so a build against it behaves exactly
as before.

### A10 — a proposed build's trace says what each step did

`sanitizeEvidenceLoopTrace` dropped `effectApplied` and `resultCode`, so the
stored trace of a **proposed** build — the one anyone wants to study — was a
list of iterations naming a tool each, with no way to tell a call that changed
the page from one that only looked, or a refusal from a success. Both are now
validated and kept; the result code is held to the same bound as an id, because
it comes from a domain.

One existing expectation changed with it, and the change is an improvement: a
malformed provider reply is now stored as `{ iteration, decision: "unusable",
resultCode: "llm.provider_malformed_response" }` instead of losing the reason.

### A9 — skipped, because a wait is already reachable

t082 replaced the old exploration verbs with `core.run_node` over the dynamic
registry, and the brief asked me to check before adding a second path. Measured
against the worktree's freshly built domain:

```
runnable node count: 18
waits: [ 'web.output.dom-wait_for_selector', 'web.output.dom-wait_for_text' ]
```

Both are `safe` in `domain/src/actions/safety.ts`, so both are offered as
observations, and both come from the same `webAutomationOutputNodeDefinitions`
array the importer manifest registers into Core's node registry — the array
`core.run_node` enumerates (t082 measured 59 = 41 Core built-ins + 18 web
outputs). **A wait on the authoring path needs nothing new.** Registering a Core
built-in wait as a harness option would have added a second path to the same
capability, and `builtin.timing.wait` is a blind sleep where
`web.dom.wait_for_selector` waits for page state — the wrong one to add.

### A11, Core half — the build asks a person, waits for the answer, and carries on

The brief asked for a recoverable `permission_required` instead of a throw. The
supervisor's first correction named what that should be built out of: the
conversation already has a `permission` ask keyed by the gate's own `requestId`
(`runtime/conversations/ask.ts`) and a parking port that opens one and holds the
work until it is settled (`runtime/parking/conversation-port.ts`), and nothing
outside `conversations/` ever created one. So this is wiring, not a mechanism.

**1. The gate can be answered** (`runtime/action-permissions/gate.ts`). Two
additions, both opt-in, so every existing caller behaves exactly as before:

- `endsOnRequest`, absent meaning yes. A caller that has nowhere to put the
  question still aborts on it — which is what the recovery exploration does and
  what the recorded user decision was about. A caller passing `false` is saying
  it will put the request to a person.
- `settle("granted" | "refused")`. A grant adds exactly the classes the request
  said were **missing** and forgets the request, so the same check asked again
  permits the action and a later action wanting something else can raise its
  own. A refusal keeps the request, which is what stops one person being asked
  the same question repeatedly.

**2. The build asks** (`runtime/flow-bootstrap/action-permissions.ts`). Every
check the build hands out — exploration step and plan step alike — now puts the
refusal it would return to a person first: it opens the ask under the request's
own `requestId`, with the request verbatim on it and Core's own sentence as the
turn's words, and waits. Granted, the gate is settled and the **same check is
asked again**, so nothing decides permission twice. Refused, or unanswered, the
domain's recoverable `permission_required` goes back to the model, which can
route around it.

One question per build, and at most one wait: a refusal nobody granted is
remembered, so a build nobody is watching costs one wait rather than one per
action. A thread that cannot be written to leaves the build with the refusal it
already had, rather than failing it — deliberately not the parking port's own
rule, because a build that loses its Flow over an unreachable thread is worse
than one that proposes a Flow and says a person still has to answer.

**3. Whether to wait is the caller's** (`permissionAskTimeoutMs` on the generate
input). Absent, or not positive, the question is still opened in the thread and
the build carries straight on. The API handler — where somebody has just pressed
build — passes `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_PERMISSION_ASK_TIMEOUT_MS`
(two minutes). An unattended caller, the Lab and every test pay nothing. This is
the one design choice here I made rather than inherited, and the alternative —
waiting by default — would have hung every automated build for two minutes on
the first refusal. The caller decides *whether* to wait; **how long** is capped
at that same two minutes, because a caller asking for a week would hold a
provider grant and its own request open for a week.

**4. A build that finished anyway is proposed carrying the request, and is held
until the answer is a grant.** `AutomationStudioBootstrapAdaptation` gains
`permissionRequest`; `approve` and `apply` both go through
`assertAutomationStudioBootstrapPermissionAnswered`, which reads the ask by the
request's id and releases only on `grant`. So the person who answers the
question in the thread — during the build or a day later — is the person who
unblocks the proposal, and no second mechanism records their answer. Both
response contracts and the API sanitizer carry the request so a caller can show
it.

That answers the gate report's objection to proposing while a request is
outstanding. It is load-bearing rather than tidy: today the domain declares no
consequences for a *plan* step on the explored path (t081's grammar work, not on
this branch), so without the hold a proposed Flow could contain the very action
exploration was refused.

**5. The build that never explored asks too.** This was the supervisor's second
correction. The one-call path resolved its plan with no `permissionFor`, so
every step fell back to `automationStudioActionPermissionDenied`, which refuses
any declared class with `requestId: null` — fail-closed, but silently, and on
that path the only declaration that let a build finish was the empty one.
**Settled as: it should ask.** The gate is now built above the
`evidenceGuided` branch and belongs to the build rather than to the loop, and
the one-call path passes `permissionFor: permissions.planStep` like the explored
one. A step nobody permitted now ends that build with
`flow_bootstrap.permission_required` carrying the request, instead of "Flow
Bootstrap generation returned an invalid plan", and the question is in the
thread either way. Hoisting the gate also hoisted the instruction-authority
derivation, so the one-call path's accounting now includes what reading the
instruction cost (`bootstrapHarnessAccounting`); left out, a build that asked
for permission would have reported less spend than it made.

**Why this matters more than the mechanism.** t081 measured four live builds in
which the model declared every press as causing nothing lasting. While a
declared consequence dead-ended in a refusal and an undeclared one did not, the
answer that let a build finish was the dishonest one. Now declaring leads to
being asked and the build carries on, so honesty is the cheap path.

### B8 — escalation unblocked for granted runs

- **`runtime/llm/runtime-session-grant.ts`.** The refusal list rejected a granted
  run carrying *any* run flag, and revoked the grant doing it, so the caller
  could not retry without asking a person for a new one. What remains: an
  unsupported purpose; an LLM dry run (a grant spent on no provider call); and
  side-effect authorization or an existing session under a purpose that changes
  nothing (`diagnosis_only`, `verify_result`). `adaptiveMode` is no longer
  refused, because the service normalizes it to `manual_approval` anyway —
  refusing it only threw away a grant over a field about to be overwritten. A
  purpose that *does* act (`diagnose_and_adapt`, `explore_and_adapt`) may now
  carry side effects, authorized domains and its own run id, which is what lets
  a repair act on the page and resume the run that failed.
  `automationStudioRuntimeSessionGrantMayAct` is the one predicate both the
  refusal and the service's normalization read.
- **The two `!input.llmExecution` guards** are gone, so a verified repair
  resumes a granted run. Withholding it left an explicit repair applying a patch
  and then reporting the original failure with nothing having re-run.
- **`live-patch/target-override-check.ts`.** `unexpected_state` and
  `action_failed` classify as `action_target_override` **only inside a Subflow**
  and `recovery_path_or_reroute` at the top level — a statement about where the
  node sits, not about what went wrong. Every override for a top-level
  `action_failed`, the commonest live failure, was refused before the domain was
  asked, with `failure_not_target_repairable`. Both classes are accepted
  wherever they occur; this widens only who gets *asked*, since the domain's own
  check runs immediately after and the policy's `allowModifyActionTargets` still
  governs application.

### One refactor, to pay for the lines

`runtime/service.ts` had no ratchet headroom (baseline 4,638, file 4,637). The
recording mapper loop moved out whole to
`runtime/service/recordings/proposal-generation.ts` — one responsibility, run a
mapper and build its proposal, which the service had no part in beyond holding
the registries it needs. Seven now-unused imports went with it. The file ends at
**4,614** lines and the baseline was re-recorded at the lower figure, which is
the standing direction for that file rather than merely staying under the line.

## Commands run and observed results

### B0, end to end and model-free

`runtime/tests/service-recordings/tests/recorded-gap.test.ts` (new) records two
clicks 4 s apart on the monotonic clock with an observation 200 ms before the
second, runs them through `AutomationStudioService.createRecordingFlowProposals`
and `reviewRecordingFlowProposal`, then runs the approved graph through
`runAutomationStudioGraph`.

```
Test Files  1 passed (1)
      Tests  1 passed (1)
```

It asserts, and observed: the first candidate carries no `recordedGapMs`, the
second carries **4000**; the first node's metadata carries none, the second
carries **4000**; the host expectation evaluator is asked exactly
`[{ nodeId: <second node>, timeoutMs: 8000 }]` — twice the recorded gap, inside
the 2 s floor and the 30 s cap — and the attempt's `readiness.ceilingMs` is
8000. **The ceiling is read at run time, not merely stored.**

The `readyState` on that node is added by the test, as an author would: the
recording path writes the ceiling, but nothing writes a node's pre-state yet, so
a purely recorded node still has nothing to wait for. See *Not verified*.

### A2 and A10, model-free through the real service

`runtime/tests/service-bootstrap/tests/state-digest-and-trace.test.ts` (new)
drives `generateFlowBootstrapAdaptation` with a scripted provider and a stand-in
domain.

```
Test Files  1 passed (1)
      Tests  3 passed (3)
```

Observed: the binding's `captureStateDigest` is asked four times for two tool
calls — `call.look` before, `call.look` after, `call.act` before, `call.act`
after — each with the build's own `projectId` and `flowId`; a domain that
declares no `captureStateDigest` is asked nothing and the build still proposes;
and the stored adaptation's `evidenceTrace` reads `[{ look, effectApplied:
undefined, resultCode: "example.looked" }, { act, effectApplied: true,
resultCode: "example.acted" }, { complete }]`.

### A2, live, against the real DeepSeek in `.env.local`

Lab instance `t087`, `FLUXIQ_TEST_ENV_FILES=none`, no web panel started or
managed:

```
pnpm lab run social-scheduler --live-llm --llm-profile lab-create-flow \
  --llm-provider deepseek --llm-model deepseek-chat --llm-task create-flow \
  --instruction-task social-scheduler-schedule-post \
  --llm-max-input-tokens 48000 --llm-max-output-tokens 8000 \
  --llm-max-total-tokens 56000 --llm-max-run-tokens 600000 \
  --llm-max-cost-usd 0.25 --target persistent-isolated --workspace t087-a
```

Run **`run-mudjgijj-64df8a7d`**, in
`test-runs/instances/t087/run-mudjgijj-64df8a7d`:

- `build.outcome: "proposed"`, `build.failure: null`, `build.providerCalls: 7`
  == `observed.calls: 7`, $0.0334, 74,114 tokens.
- `build.permissionRequest: null` — the model declared nothing this empty grant
  refused, so the gate did not fire and **A11 was not exercised live**.
- The digest hook therefore ran against the real domain and a real page
  fourteen times (two per call) without failing a step: a hook that throws is
  recorded as the call having failed, and no call failed.
- The run's **verdict is `failed`, `environment.missing`**, and the build is not
  why: `run.json` records `processExits: { "scenario-lab": 1, "fluxiq-web": 1 }`,
  so the Lab's own processes exited non-zero after the build. The replay never
  happened (`flowCreated: false`).
- `build.evidenceLoop.steps` is `null` and `toolIds` is `[]`, so the Lab could
  not show me the stored trace. That is step **A12**, which is t089's and still
  open; A10's effect is asserted model-free above rather than read off this run.

This run predates the conversation wiring by some hours, so it says nothing
about it either way.

### A9, measured

In `F:\fxwork\t087\!FluxIQWebExtension`, against `domain/dist` as the Lab had
just rebuilt it from this worktree:

```
node -e "... webRunnableNodeIds() ..."
runnable node count: 18
waits: [ 'web.output.dom-wait_for_selector', 'web.output.dom-wait_for_text' ]
observation node: web.output.dom-capture_snapshot
```

### A11, model-free through the real service and a real conversation store

`runtime/tests/service-bootstrap/tests/permission-ask.test.ts` (new), three
cases:

```
Test Files  1 passed (1)
      Tests  3 passed (3)
```

1. **The question reaches the thread and holds the proposal.** A build whose
   model runs an action declaring `move_money` and `modify_existing` under an
   empty grant: the action is never taken, the build still proposes, and the
   Flow's thread holds an ask whose `askId` **is** the request's `requestId`,
   `kind: "permission"`, `parks: true`, `missing: ["move_money",
   "modify_existing"]`, the request verbatim on it, and a turn whose words are
   Core's own sentence. `approve` rejects with "has not been answered"; after a
   `deny` it rejects with "was refused".
2. **A grant while the build waits lets the action go ahead.** With
   `permissionAskTimeoutMs: 30_000`, the test answers the ask `grant` from
   outside while the build is parked inside the refused call. Observed: the
   action **ran** (`acted` is `["refund"]`), the build proposed, the response
   carries **no** outstanding `permissionRequest`, and `approve` resolves to
   `status: "validated"`.
3. **The build that never explored asks too.** No `evidenceGuided`, a stand-in
   domain that declares a consequence while resolving a plan step: the
   generation rejects with `flow_bootstrap.permission_required` — not the old
   "invalid plan" — the domain saw exactly one refusal, and the thread holds a
   `permission` ask whose request names a `flow_step`.

`runtime/tests/service-bootstrap/tests/permission.test.ts` — its first case is
rewritten, because it pinned the behaviour this step changes.

```
Test Files  14 passed (14)
      Tests  98 passed (98)
```
(that run covers `service-bootstrap` and `action-permissions` together)

The rewritten case observes: the action is still never taken; the model **is**
asked again (`requests` has 2, where it had 1); `status` is `proposed`; the
response's `permissionRequest` names the exploration step, the control "Refund
line 1", the two missing classes and the instruction that wanted it; the stored
adaptation carries the same `requestId`; `approve` rejects with
`FLOW_BOOTSTRAP_PERMISSION_REQUIRED`; and the Flow still has no topology. The
other cases are unchanged and pass, including the one that ends the build when
the *Flow it wrote* would take the action — a plan refusal nobody granted is
still terminal.

### B8, unit

`iterating-recovery.test.ts` and `llm-grants.test.ts` updated to the new
messages, plus one new row: a `diagnosis_only` grant carrying
`authorizedExternalSideEffects: true` is refused with "cannot carry side-effect
authorization", and one attaching to a pre-staged cross-domain session is
refused with "cannot attach to a session it did not create" — the smuggling case
that test was written for still refuses.

### Checks

**Core**, in `F:\fxwork\t087\!FluxIQ`:

- `npx tsc --noEmit` (packages/fluxiq) — clean.
- `node scripts/structure-audit.mjs` — `passed (175 warning(s), 360 baselined)`.
  It caught one real defect on the way: `permission-hold.ts` turned a failed ask
  read into "no answer" with `.catch(() => null)`. That failed closed, but
  "could not be read" and "there is no answer" are different facts and the
  second would have told a person their grant had not registered. The error
  propagates now, and the guard still releases nothing.
- `pnpm check` (Core root) — structure tests, task tests, the audit and
  `tsc --noEmit` across all four packages: **Done**, no failures.
- `npx vitest run --maxWorkers=4 --minWorkers=1` (packages/fluxiq) —
  **342 test files, 2,922 passed, 1 skipped, 0 failed.** Two earlier full runs
  failed 11 and 1; every one passed when its file was re-run alone, and the
  failing set differed between runs. After that clean run I capped a
  caller-supplied ask timeout, and re-ran `service-bootstrap`,
  `action-permissions` and `api/handlers` on top of it: **31 files, 172 tests,
  all passed.**

**Downstream**, in `F:\fxwork\t087\!FluxIQWebExtension`:

- `pnpm check` — structure tests, lab tests, task tests, the audit
  (`passed (92 warning(s), 122 baselined)`) and `tsc` across ten packages:
  **Done**, no failures.
- `pnpm --filter @fluxiq-web-extension/domain test` — **736 passed, 0 failed**.
- `pnpm --filter @fluxiq-web-extension/extension test` — **729 passed, 2
  failed**, and the two are **not mine**: this worktree has *no* downstream
  source changes at all (`git status` shows only this report), and both failures
  are `web evidence tool is not registered` thrown from
  `domain/.../tools.ts:283` because
  `apps/extension/src/content/identity/tests/created-node-identity.test.ts:62`
  still calls `executeTool` with `WEB_LLM_INSPECT_TOOL_ID`, which **t082**
  (`2e16cf0`, already on `dev`) removed. See *Open questions* 4.

### A note on this machine

`dev` with no task changes fails 17 tests under concurrent load, recorded in
`becdf07`. Every Core failure I saw across three full-suite runs passed when its
file was re-run alone, and the failing set differed between runs; I have
reported only results I re-checked that way.

## Not verified

- **Nothing writes a node's `readyState`**, so the ceiling B0 now stores is
  spent only by a node that also declares a pre-state, which today only an
  author or a test writes. The write path, the clamp and the executor's use of
  it are proved; a purely recorded node still waits for nothing. That writer is
  the highest-value piece left in this area and it is not Core's.
- **A11's ask was not exercised live.** The one live build's model declared no
  lasting consequence, so the gate never fired, which is also what t081
  measured across four runs — it is a prompt defect the t088 worker is fixing,
  not something a second run would have changed. The whole path is proved
  model-free instead, against a real sqlite-backed conversation store.
- **B8's resume half is a guard removal, unexercised.** Making a granted run
  resume after an auto-applied patch needs a `--llm-task repair` lane run; none
  was made. The refusal-list and target-override changes are covered by tests
  but neither was run live either, so what a widened target override does with
  real evidence is unmeasured.
- **The live run's own verdict, `environment.missing`, is undiagnosed.** The
  build succeeded; the Lab's `scenario-lab` and `fluxiq-web` processes exited 1
  afterwards. I did not chase it, and no replay happened.
- **A pending ask from a build that did not wait is never expired by anything.**
  The row carries `timeoutMs` and `onTimeout: "deny"`, and the parking port
  expires an ask only while something is waiting on it. So a question nobody
  answers stays `pending` in the thread, and the adaptation stays held. That is
  the safe direction, but it means an abandoned build leaves an open question.
- **A waiting build cannot be cancelled out of its wait.** The ask accepts an
  `AbortSignal`, but `generateFlowBootstrapAdaptation` takes none, so nothing is
  passed and a parked build waits out its own timeout. Bounded at two minutes,
  and only for a caller that asked to wait.
- I did not run `pnpm build` or `pnpm test` for the downstream packages other
  than `domain` and `apps/extension`, and I ran no scenario other than the one
  live build above.

## Open questions or contradictions found

1. **The repair entry point still throws where authoring no longer does.**
   `runtime/recovery/runtime-exploration.ts:252-269` ends a recovery exploration
   with `exploration stopped: operator_approval_required` the moment its gate
   raises a request — the exact terminal refusal A11 removed from the build, in
   the same loop's other entry point. The gate now supports being answered
   (`endsOnRequest: false`, `settle`), so the change there is the same few lines
   plus a parking port bound to the run, which that path already has for its
   nodes (`graphOptions.parking`). It is in `runtime/recovery/**`, outside my
   owns, and it is the pinned "one loop, three entry points" rule pointing at
   its second entry point.
2. **One request at a time is now load-bearing rather than incidental.** The
   gate raises one request; a second refused action is answered with the first
   request's id and its own `missing`. Granted, the first request is cleared and
   the next action can ask its own; refused, it is kept deliberately so one
   person is not asked the same thing repeatedly. A build needing two different
   grants therefore takes two builds. That is a deliberate reading of the
   recorded one-request decision, not a fix, and it is worth a user's eye.
3. **`permissionAskTimeoutMs` defaults to not waiting, and only the API handler
   passes it.** Any other caller — the Lab, a script, a test — asks the question
   and carries on. If the campaign should park instead, the Lab's granted-build
   call is where to pass it.
4. **t082 left two extension tests failing on `dev`.**
   `created-node-identity.test.ts` still drives the removed inspect tool. It is
   two lines of test to repoint at `core.run_node`, and it is failing for
   everyone until somebody does.
5. **A fourth target-override refusal is untouched.** `allowedPatchKinds`
   (`recovery/annotation/patches.ts:114-117`) drops an override before preflight
   ever sees it; B8's list names three and this is the fourth. Whether the
   recovery plan offers the kind is a separate decision from whether the check
   would pass it.
6. **A10 cannot be read from a live run until A12 lands.** The Lab leaves
   `evidenceLoop.steps` null for a proposed build, which is exactly the build
   whose trace this step enriched.

## Files changed

Core, `F:\fxwork\t087\!FluxIQ` (no commit):

- new `runtime/service/flow-bootstrap-commands/state-digest.ts`,
  `harness-accounting.ts`, `permission-hold.ts`
- new `runtime/service/recordings/proposal-generation.ts`
- new tests: `runtime/tests/service-recordings/tests/recorded-gap.test.ts`,
  `runtime/tests/service-bootstrap/tests/state-digest-and-trace.test.ts`,
  `runtime/tests/service-bootstrap/tests/permission-ask.test.ts`
- `runtime/service.ts`, `runtime/recording-flow-proposal.ts`
- `runtime/action-permissions/gate.ts`,
  `runtime/flow-bootstrap/action-permissions.ts`,
  `runtime/flow-bootstrap/adaptation.ts`
- `runtime/llm/runtime-session-grant.ts`,
  `runtime/live-patch/target-override-check.ts`
- `runtime/service/recordings/{proposal-candidates,candidate-definitions,index}.ts`
- `runtime/service/flow-bootstrap-commands/{contracts,evidence-trace,index}.ts`
- `api/contracts/adaptation.ts`, `api/handlers/llm-generation.ts`
- updated tests: `runtime/service/recordings/tests/candidate-definitions.test.ts`,
  `runtime/tests/deepseek-bootstrap-exploration.test.ts`,
  `runtime/tests/service-adaptation/tests/{iterating-recovery,llm-grants}.test.ts`,
  `runtime/tests/service-bootstrap/tests/permission.test.ts`,
  `api/handlers/tests/llm-generation.test.ts`
- `docs/architecture/automation-studio.md`,
  `docs/architecture/automation-studio/llm-flow-bootstrap.md`
- `.structure-baseline.json` (service.ts lowered 4,638 -> 4,614)

**Files outside the brief's Owns, and why.** `runtime/action-permissions/gate.ts`
— A11 cannot be answered without the gate accepting an answer; both additions
are opt-in and every existing caller is unchanged. `runtime/flow-bootstrap/
adaptation.ts`, `api/contracts/adaptation.ts`, `api/handlers/llm-generation.ts`
— a request that travels with a proposal has to be on the record, in the
contract and past the API sanitizer. `runtime/service/recordings/**` and
`runtime/service/flow-bootstrap-commands/**` are the service's own modules,
which is where the brief asked behaviour to live. **Nothing under
`conversations/` was changed** — the ask, the port and the store were used as
they stand.

Downstream, `F:\fxwork\t087\!FluxIQWebExtension`: no source changes. This
report only.
