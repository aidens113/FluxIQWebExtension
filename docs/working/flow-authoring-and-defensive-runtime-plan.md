# Flow Authoring And Defensive Runtime

Status: Active
Status detail: Design drafted 2026-09-22; five discovery reports in flight to pin the seams. No implementation dispatched yet.
Created: 2026-09-22
Last updated: 2026-09-22
Owner: Senior supervisor agent
Scope: Make a model-authored Flow faithful to what the model actually did, and make a Flow's execution survive a site we do not control. Covers the build loop's authoring model, the draft Flow and its edit and dry-run tools, branch and loop authoring, the runtime's deterministic recovery ladder, and the adversarial fixture conditions that measure both. It deliberately does not cover the real-site lane itself, the campaign measurement, new extraction capabilities, or the Week 2 exit criteria, which stay in their own documents.
Paired document: none yet — the build loop and the recovery ladder are generic framework behaviour and land in FluxIQ Core, so a Core-side document is required once the phases below are accepted.
Related: [week2-exit-plan.md](./week2-exit-plan.md) (the campaign this defers), [mvp-week2-automation-loop-plan.md](./mvp-week2-automation-loop-plan.md) (the adaptation loop this hardens), [AGENTS.md](../../AGENTS.md)

---

## Current State

The user asked on 2026-09-22 for a side plan to execute **before** live testing
continues, so that Flow creation and Flow execution work defensively on sites we
do not control. This document owns that work. The Week 2 exit campaign is paused
behind it; its integration branch and its cut-off workers still need landing, but
no further live measurement runs until the phases here are built.

**The evidence this plan answers.** Round 1 of the live campaign, 2026-09-21,
across ten realistic sites: about seventy attempts to build a Flow from an
instruction, one Flow produced, and that one failed on replay. The per-lane
reports are in `week2-exit-plan/reports/w2x-e2e-lane-{a..e}.md`. Two findings in
that round are the reason this document exists rather than another round of
defect fixes:

1. **The Flow the model saved was not what the model did.** On `everything-store`
   the build explored successfully, then proposed a Flow that kept none of the
   cookie and notification dismissals exploration had performed, and whose
   `navigate` node reported success while the tab never left the start page
   (identical before and after screenshot hashes, Core's after-location still the
   start page). Authoring is a separate act from exploring, so the two diverge.
2. **A failing node has no cheap way to recover.** Retries repeat the same
   attempt, the recorded expected state is not consulted, and the model — the
   expensive last resort — is the only escalation, and is itself blocked for
   granted runs.

**The user's direction, in their words.** Exploration should behave like taking a
recording, except the model can remove, edit and retry parts of that recording in
flight, iterate on the final Flow, and actually test the node settings it chose,
rather than the exploratory tool calls being different from the Flow it creates.
At run time the model should be operating the same recording with more direct
control of timeline and branches than a human has; and when a node fails
repeatedly the runtime should try the state checker first and only then pass to
the model.

**What is decided.** The two designs below — *Authoring By Accrual* and the
*Recovery Ladder* — are the shape of the work. Both are generic framework
behaviour, so both land in FluxIQ Core, with the web-specific judgements
(which actions change a page, how a DOM state digest is taken, how an overlay is
recognised) owned here.

**Core is authorized** (user, 2026-09-22). The supervisor raised that the build
loop, the draft Flow and its edit tools, the dry run, and the ladder's
orchestration are framework behaviour that must be built in `F:\!FluxIQ` rather
than approximated downstream, and the user answered "yes good, i want to edit
core". A Core-side paired document is therefore required, and this work follows
Core's own agent instructions while in that repository.

**What discovery changed.** Seven read-only workers were dispatched; d1, d2, d3
and d5 have reported and their findings are below, with the load-bearing claims
re-checked in source by the supervisor. Three things moved the plan materially:

- **Most of Design One already exists in Core and is wired to the wrong entry
  point.** `runtime/exploration-reduction/` holds exactly the step shape and the
  minimum-replayable-sequence reduction this plan asks for, used only by
  *recovery* exploration, with its output discarded. Nothing under
  `runtime/flow-bootstrap/` imports it.
- **The `everything-store` Flow's missing dismissals are explained, and it was
  not forgetfulness.** The build's evidence window keeps the newest entry *per
  tool*, and every dismissal shares one tool id, so only the last was visible
  when the model wrote the Flow. It could not see what it had done.
- **Design Two's premise was wrong and is corrected below: no per-node retry
  exists at all.** The ladder must bring its own retry loop.

**Settled by the user, 2026-09-22, after reading the above.** Recorded state is
the product's central selling point, so three things are requirements rather than
options: **retries are on by default** with a real default attempt count; the
**recorded state is read at execution time**, not merely stored; and a **recorded
delay is a maximum wait for the expected state, not a sleep** — if the state
appears sooner the node runs immediately, and if it never appears the node is
attempted at the deadline anyway rather than failed. This is Design Two's
opening section and steps B0, B1 and B1a.

**Supervisor finding, same day.** The delay data needed for that ceiling already
exists: Core's recording entries carry `timestamp` **and `monotonicOffsetMs`**
(`model/recording-framework.ts:20-22`), the latter being the clock that survives
a wall-clock change. Nothing carries the gap between consecutive entries onto the
Flow node, which is step B0 and is small.

**What is not yet decided.** Where genuinely new Core modules live, and the Lab
evidence needed to attribute a recovery to a rung — d6 and d7 are still out.

**Next:** fold the remaining three reports into a phase table, then dispatch.

**Blockers:** none. The Week 2 integration branch should still land first, since
this work edits the same Core files.

---

## Design One: Authoring By Accrual

Today a build has two separate acts. The model explores by making tool calls, and
then, at the end, emits a Flow it composes from its own memory of that
exploration. Everything that is true of the exploration but absent from the
emission is lost, and nothing checks the two against each other. That is the
`everything-store` failure exactly.

The replacement is that **the Flow is not authored at the end; it accrues as the
model explores**, in the same way a human recording accrues, and the model's
authoring tools operate on that accruing draft.

### Every action is classified once

Each tool the model can call is either **observational** or **effectual**.

- *Observational* calls look at the page and never become nodes: reading the
  element list, inspecting an element, taking a snapshot, asking what changed.
- *Effectual* calls change the page or produce the answer, and **always** become
  nodes: click, press, type, select, navigate, scroll-to, dismiss, extract.

This single rule fixes the dismissals problem without the model having to
remember anything. A cookie banner dismissal is effectual, so it is in the draft
the moment it happens, whether or not the model would have thought to write it
down.

### A node is written from the outcome, not the intention

When an effectual call succeeds, the node appended to the draft records what the
runtime *observed*, not what the model *asked for*:

- the element actually acted on, with its fingerprint and equivalence anchors —
  not the handle the model named;
- the page state before and after, as a digest;
- the readiness condition that held when the action succeeded;
- the exploration decision that produced it, for provenance.

A node written this way is faithful by construction. The model cannot save a
target it never hit, because the target field is filled in by the thing that hit
it.

### The model edits the draft, rather than composing a final answer

New authoring tools, operating on the draft:

- delete a node; replace a node; insert before a node; reorder;
- mark a node **exploratory**, meaning "I did this to look around, do not keep
  it" — the deliberate escape hatch from the effectual rule;
- edit a node's settings: its wait condition, its target strategy, its expected
  state, its extraction fields;
- group a span of nodes into a **branch** guarded by a state check, or into a
  **loop** over a list or while a condition holds.

Branches and loops are the "more direct control of the timeline than a human
would have" the user asked for. A human recorder cannot say "dismiss this only if
it is present" or "repeat this for every row"; the model can, and both are
exactly what a site we do not control demands.

### The build proves the Flow before proposing it

Before a build may propose, it performs a **dry run**: reset the page to the
start, replay the draft with no model attached, and record which nodes pass.

- If every node passes and the result matches the instruction, the build
  proposes, and it has already demonstrated the property we actually care about.
- If a node fails, the failure goes back to the model with the node attached, and
  the model edits the draft and dries it again.

This is the highest-value change in the document. It converts "does the Flow
replay deterministically?" from something we discover in a campaign days later
into something the build itself establishes, at the cost of one page reset and
one model-free replay per attempt — cheap next to a provider call.

### Failures are part of the record

Every effectual call is recorded whether it succeeded or failed, and a failure is
returned to the model as a result rather than raised as an exception. Round 1's
largest single defect was that a failed call ended the build *and was absent from
the trace*, so neither the model nor the reader could see it. A build that cannot
observe its own failures cannot iterate on them.

### Success looks like

A build ends with a draft whose nodes are the actions that were actually
performed, each carrying the target it actually hit and the state it actually
produced, which has already been replayed model-free from a reset page and
passed. The proposal is a handover of that artifact, not a fresh composition.

---

## Design Two: Recorded State Drives Execution

**The recorded state is the product's central selling point, and today the
runtime does not read it** (user, 2026-09-22). Everything below follows from
treating that as a product requirement rather than an option.

Three rules are settled and not open for re-weighing:

1. **Retries are on by default.** A node that fails is retried without anyone
   opting in, with a sensible default attempt count. Retry that exists but
   defaults to one attempt, or must be enabled per node, does not satisfy this.
2. **Recorded state is consulted, not merely stored.** Capturing a digest or an
   expected state and then never reading it at execution time is precisely the
   defect discovery found. State that only serves provenance or a later
   diagnosis misses the point of the feature.
3. **A recorded delay is a ceiling, not a sleep.** See below.

### The recorded delay is a wait ceiling gated by expected state

The gap recorded between two steps during authoring becomes the **maximum** time
the runtime waits for that node's expected state before proceeding anyway:

- **State seen early → execute immediately.** A replay on a fast page is
  *faster* than the recording that produced it. The recorded delay is never
  spent idling once the page is ready.
- **State not seen by the deadline → attempt the node anyway, and mark it.** The
  recording is evidence the action was possible at that point, so a missing state
  is not by itself a reason to fail. Only if the attempt then fails does the
  ladder below begin.
- **The ceiling has a floor and a cap.** A 50 ms recorded gap must not mean the
  runtime gives up on the state after 50 ms on a slow day, and a 90 s gap where
  the author went to make coffee must not stall a run. Proposed defaults, all
  configurable: wait ceiling `clamp(recordedGap × 2, 2 s, 30 s)`; retry attempts
  **3**; backoff 250 ms, 1 s, 2 s. The Lab measures whether these are right.

This one mechanic replaces both of the failure modes round 1 showed: the timing
failures that a fixed sleep would have papered over slowly, and the ones a
missing wait caused outright.

## Design Two (continued): The Recovery Ladder

**A node that fails is never executed a second time. Verified.** The step loop
(`runtime/executor/graph-run.ts:211`) runs each node once; on a failure it picks
a recovery decision, and unless that decision is a `deterministic_path` matching
an authored `failed` edge, the run ends there (`:253-277`). The `continue` that
follows a recovery moves to the *target of the failed edge* — a different node —
so the same node is never re-attempted. The only retry loop in the whole runtime
belongs to a Call Flow child, with `maxAttempts` defaulting to 1.

This is the single most important correction discovery made to this plan, and it
has a consequence for how the user's instruction must be read. They asked that
"if a node fails multiple times, it should try the state checker first, THEN pass
to LLM" — but a node cannot fail multiple times today, because it is never given
a second chance. **The ladder therefore has to bring its own retry loop with it;
it is not an addition to an existing one.**

Worse, the recorded state checker is switched off at exactly the moment it would
help: the expected-state evaluation is guarded by `attempt.status !==
"succeeded"` (`runtime/executor/transition-comparison.ts:109`), so a state claim
is consulted only to *demote a success*, never to understand a failure.

The replacement is an ordered ladder, cheapest first, where **the model is the
last rung, not the first**. Each rung runs only if the one above it did not
resolve the failure.

1. **Re-resolve the target.** Fingerprint, then equivalence anchors, then
   accessible name, then selector, then visible text. Partly built already.
2. **Wait for the recorded readiness condition.** The node knows the state that
   held when this action succeeded during authoring. If the page has not reached
   it, wait for it rather than failing — most real-site failures are timing.
3. **Check the recorded post-state.** If the state the node was supposed to
   produce is *already* true, the action has already happened. Skip the node
   rather than repeating it — this is what prevents a double submit.
4. **Check the recorded pre-state.** If the state the node expected to start from
   is not true, the divergence is upstream. Report that specifically instead of
   reporting "target not found", which sends any later diagnosis after the wrong
   thing.
5. **Clear known interference.** If something is covering the target, and the
   Flow holds a dismissal node for it, run that node and retry. Overlays, consent
   banners and timed prompts are the single most common live-site obstruction,
   and they are deterministic to handle once recorded.
6. **Escalate to the model**, carrying everything the ladder learned: which rungs
   ran, what each observed, and the specific divergence found. The model then
   receives a diagnosis rather than a bare failure.

Rungs 2 to 5 are the "state checker first, then the LLM" the user asked for, and
they are the rungs that exist only because Design One makes the node carry an
honest record of its own pre-state, post-state and readiness condition. **The two
designs are one piece of work**: the ladder is only as good as the fidelity of
what authoring wrote down.

### Success looks like

On a site with timing jitter, a late-rendered overlay and a renamed control, a
Flow that was authored once completes with **zero provider calls**, because rungs
1 to 5 absorbed all three. The model is consulted only for a change no recorded
state can resolve.

---

## Design Three: Measuring It Without A Real Site

Neither design can be trusted on a site we do not control if it is only ever
measured against fixtures that behave identically every time. The fixtures must
be made adversarial in the specific ways real sites are.

Conditions to add as switchable fixture behaviour, so that every one of them is a
repeatable test rather than a live surprise:

- variable load and render latency, including content that arrives after the
  action that needed it;
- an overlay, consent wall or promotional prompt that appears on a timer rather
  than on load;
- a control that is renamed, moved, or rendered as a different element between
  authoring and replay;
- a list whose rows differ per visit, and pagination that changes shape;
- a session that expires partway through a Flow.

Each condition gets a scenario variant and an expected outcome: which ladder rung
should absorb it, and whether the model should be consulted at all. A rung that
does not absorb the condition it was built for is a failing test, not a judgement
call.

---

## Discovery Findings

Recorded as each report lands. A worker's report is a claim; findings the
supervisor confirmed in source itself are marked **verified**.

### From d2 — the recorded step (2026-09-22)

1. **The recorded state is captured and then never consulted. Verified.** Each
   recorded node carries `stateLink`, `stateSnapshotId`, `stateRef` and
   `screenshotRef` in its metadata
   (`runtime/service/recordings/proposal-candidates.ts`,
   `recordingCandidateStateLinkMetadata`). Every `stateRef` the executor reads is
   the **live** one — `currentStateRef(attempt)` and
   `attempt.stateRefs.afterAction ?? beforeAction`
   (`runtime/executor/transition-comparison.ts:111,149-150`,
   `runtime/executor/node-execution.ts:123`). No execution path reads the
   recorded link. The supervisor grepped every mention in Core's source and found
   writers, the recording contracts, fingerprinting and the recovery context's
   live diff — no reader. **Design Two's rungs 2 to 4 therefore need the runtime
   to read data it already stores, not to capture anything new.** This is the
   cheapest large win in the document.
2. **The only expected state a step carries is a URL path claim.**
   `webAutomationClickLandingExpectation` emits one `url` assertion with a 5 s
   timeout, and only when the output is `web.dom.click`
   (`domain/src/runtime/expectation/click-landing.ts:56-68`,
   `domain/src/web-panel-host.ts:144`). A condition that cannot be read is left
   **unjudged rather than failed** (`runtime/expectation/evaluate.ts:140-142`).
   So the "state checker" the plan leans on barely exists as an authoring
   surface, even though the storage for it does.
3. **The authoring ceiling is the mapper contract, not the action vocabulary.**
   Branch, switch, loop, for-each, merge, parallel and recovery all exist as Core
   node types and are **unreachable from a recording**: approval makes every
   candidate `builtin.policy.action` and wires `nodes.slice(1)` as a straight
   `success → ready` chain (`proposal-candidates.ts:107,134-141`), and a
   candidate carries no node kind, port, edge or predicate
   (`nodes/importer-sdk.ts:20-42`). Even the action node's own `failed` port is
   unreachable. **Design One's branches and loops are an authoring-path problem,
   not a new-capability problem** — materially cheaper than assumed. Also
   unreachable today: a recorded assertion, an authored wait, single-value
   extraction, and any statement of intent or tolerance.
4. **A recorded click does not wait for its target.** `clickAction` calls
   `resolveTarget` synchronously (`content/actions/click.ts:52`); the waiting
   engine is reached only by an explicit `wait_for_*` action. This is a direct
   cause of timing failures on a site we do not control, and it is why rung 2
   must exist.
5. **Rung 1 of the ladder largely exists.** Replay already resolves a target
   through recorded identity, shadow scope, selector, coordinates, visual target
   and fingerprint, then a visibility gate, a four-step veto, a positional
   cross-check, Core's matcher and finally the focused element
   (`content/action-runtime/resolve-target.ts:219-283`). The plan should reuse
   this rather than add to it.
6. **Three contradictions to resolve while here.** `coordinates` is tried second
   in the resolution order but is a declared parameter of no web action
   (`identity/veto.ts:296-300`) — dead precedence. A repair rewrites a node's
   target but leaves its recorded URL claim untouched, so a correctly repaired
   click can still fail on a stale claim. And `expectedConfirmation` and
   `expectedState` are two unreconciled "did it work" mechanisms, each needing
   opt-outs to avoid failing every replay (`web-panel-host.ts:172-177`).

### From d1 — the exploration-to-Flow seam (2026-09-22)

1. **The primitive this plan proposes already exists in Core, and the build path
   does not use it. Verified.** `runtime/exploration-reduction/` implements
   exploration-as-recording: `AutomationStudioExplorationStep` is
   `{actionId, input?, effect, outcome, stateBefore, stateAfter}` — the node
   shape Design One asks for, field for field — and
   `reduceAutomationStudioExploration` returns the minimum replayable sequence
   with a receipt giving one of five drop reasons per discarded step
   (`after_success`, `observation_only`, `did_not_succeed`, `changed_nothing`,
   `undone`) and a `stateChainIntact` honesty flag. The supervisor confirmed the
   module's contents and that **no file under `runtime/flow-bootstrap/` imports
   it**; its only importers are `runtime/index.ts` and two recovery modules.
   **Design One is substantially a wiring job, not a new invention.**
2. **The mechanical cause of the `everything-store` Flow is now known, and it is
   not forgetfulness.** Every decision is a stateless two-message request with no
   conversation history (`runtime/llm/deepseek-provider.ts:481-516`), and
   `evidenceContextWindow` keeps the newest entry **per toolId** before filling
   its byte budget (`evidence-loop.ts:638-670`). Every dismissal, every press,
   shares the toolId `web.press_control`, so **only the last one is guaranteed to
   be visible when the model writes the Flow.** A code comment at `:622-633`
   already records this exact loss producing a wrong Flow in an earlier run. The
   model did not omit its dismissals; it could no longer see them.
3. **The build's entire output is one string.** The completion schema requires a
   single `flow: string` in a plain-text grammar
   (`flow-bootstrap/plan/evidence-schema.ts:31-45`); the transcript is a local
   `const` destroyed when the Flow is written. A refused completion is re-emitted
   **from scratch**, with the previous script absent from the request — which is
   how a build once "completed again with those steps deleted and the wrong
   answer in their place" (`harness-options/bootstrap-completion.ts:65-70`).
4. **There is no wait tool on the authoring path, apparently by accident.** Core's
   six built-in harness options are never registered for a build
   (`runtime/service.ts:1881` passes no `host`), and the web domain's six
   recovery options — including a wait — are stage-pinned to `gather`/`iterate`
   while bootstrap resolution carries no stage, so `stageAllows` withholds all of
   them. The model cannot ask a page to settle.
5. **State digests are available to the build and simply not wired.**
   `captureStateDigest` exists on the binding (`binding.ts:100-107`) and the
   bootstrap loop call passes no digest hook (`runtime/service.ts:1889-1927`).
6. **A tool rejection tells the model nothing.** Rejections are deliberately
   content-free — eight codes, no detail (`domain/.../tool-rejection.ts:25-57`).
   The model is not told which handle failed or what would have worked, which is
   a direct cause of round 1's repeat-without-progress stalls.
7. **Permission is terminal on the authoring path.**
   `action-permissions.ts:72-80` throws on the first unpermitted action, its own
   comment saying this is "rather than handing the refusal back to the model to
   route around", while the domain can surface the same case as a recoverable
   `permission_required` (`press.ts:63`). This contradicts the standing product
   rule that a blocked action escalates to the person for permission rather than
   failing, and this plan should close it.
8. **A successful build's trace is poorer than a failed one's.**
   `sanitizeEvidenceLoopTrace` (`runtime/service.ts:5931-5944`) drops
   `resultCode` and `effectApplied` before a successful adaptation is stored,
   while the failure diagnostic keeps both.

### From d3 — runtime execution and failure (2026-09-22)

1. **No per-node retry exists. Verified** (see Design Two, which this corrected).
2. **The state diff is computed for every web node and decides nothing.**
   `web-state-diff.v2` costs a gateway round trip per node and is recorded on the
   attempt without being read.
3. **Three retry surfaces are inert.** `maxRetriesPerAction` is a cap that only
   *removes* a recovery candidate, not an allowance (`recovery-budget.ts:18`,
   default 1); `builtin.timing.retry` returns its own parameters as outputs and
   retries nothing (`nodes/timing/retry.ts:33`); `RetryPolicy.backoffMs` has no
   consumer at all. `retryable` on a failure code is likewise read by no runtime
   decision.
4. **Only one recovery candidate can execute.** The ladder ranks four kinds, but
   `graph-run.ts:260` executes **only** `deterministic_path`; selecting
   `llm_diagnosis` stops the run outright.
5. **Design constraint for the new rungs:** any deterministic candidate on offer
   suppresses the model (`adaptive-orchestrator.ts:92`), so a new rung must be
   *consumed and dropped from the list* or it will permanently block escalation.
6. The three known blockers on granted runs are confirmed, with one correction:
   the forced `manual_approval` at `service.ts:3060` is normalization, and the
   real refusal is `runtime-session-grant.ts:62-74`, which **throws**. A fix must
   change the refusal list, not that line.

### From d5 — existing coverage (2026-09-22)

1. **Design One's mechanism is built but attached to the wrong entry point** —
   the same finding d1 reached independently, from the plans' side: the step
   recorder, digest port and reduction are landed and live-proven, used only in
   *recovery* exploration, and the output is discarded.
2. **The model already authors routing and Subflows, and it is proven.** A
   model-built Flow replayed down two routes 14 of 14 with zero provider calls.
   So branches are not new work for model authoring — d2's finding that branches
   are unreachable applies to the **recording** path, not the script path. Design
   One's branch and loop work is therefore only about expressing them *in the
   accruing draft*.
3. **Three recorded decisions this plan touches.** Resolved below rather than
   reversed silently.

### From d4 — target resolution and existing defenses (2026-09-22)

1. **The `everything-store` navigate is fully explained. Verified.**
   `compareNavigatedUrl` compares the **requested** URL against the **landed**
   one (`apps/extension/src/runtime/navigation-outcome.ts:25-30`), so a navigate
   issued while the tab is already on that URL matches trivially and reports
   success. The only thing that would make it do work is `updateTabUrl`'s reload
   (`runtime/automation-tab.ts:132-141`), and nothing verifies the reload
   happened. Worse, there is **no evidence with which to catch it**: a
   worker-side result carries status, validation, message, timestamps, url,
   failure and visualTarget and nothing else
   (`runtime/action-results.ts`, `workerActionResult`) — no snapshot, no title,
   no element, no resolution. Together with d1's finding on the evidence window,
   the campaign's single created Flow is now explained end to end.
2. **The "did the page answer?" mechanism exists twice and is wired almost
   nowhere.** `content/action-runtime/in-place-effect.ts` implements exactly the
   right shape — a rendered-text baseline, a structural-movement requirement and
   address polling — and is armed for `a[href]` clicks only
   (`actions/click.ts:76-80`). `domain/.../llm-evidence/state-digest.ts`
   implements an exhaustive page-state digest reachable only from
   `captureStateDigest`, whose input is the authoring loop's. **No replay path
   takes a before-and-after digest.** Design Two's rungs are, again, mostly
   wiring.
3. **A wait cannot see into a shadow root.** `wait-conditions.ts` resolves every
   selector with a bare `document.querySelector` (`:74,:82,:90,:96`) although
   `resolveShadowScope` exists for precisely this, so a Flow that waits for a
   control inside a widget times out and then resolves it fine immediately
   afterwards. No justification for this was found.
4. **Three actions skip actionability entirely.** `check`, `scroll` and `upload`
   never call `checkActionability`, so a covered or inert checkbox is set
   straight through an overlay with no `covered` refusal — a silent wrong result
   rather than a failure.
5. **Sequencing dependency. Verified.** Per-Flow handle numbering, the look-alike
   cues and dialog-controls-first packets are **not on `dev`** — the supervisor
   confirmed `look-alikes.ts` is absent there. They exist only on
   `task/t070-exploration-handles` and the t075 integration branch. Any phase
   that assumes them is blocked until that integration lands, which is the
   worker already running.

---

## Decisions On Recorded Commitments

Three existing commitments sit in this plan's path. None is reversed silently.

1. **"A Recording is not a draft Flow"** (Core's recording-proposal-generator
   plan), enforced mechanically by
   `assertAutomationStudioBootstrapHasNoRecordingProvenance`
   (`flow-bootstrap/adaptation.ts:290`), which throws on any stored key matching
   `/recording|timeline/i`. **Decision: Design One is scoped to model exploration
   only.** Human recordings keep their existing capture → proposal → review path
   untouched, which is what the user asked for and reverses nothing. The draft's
   fields are named so they do not trip that guard; the guard is narrowed only if
   it actually blocks, and then deliberately.
2. **"LLM output is untrusted proposal data; manual review mandatory for every
   accepted result"** (`llm-production-automation-plan.md:65`). **Decision:
   unchanged.** The review gate stays exactly where it is. What changes is that
   the artifact under review has already been replayed model-free from a reset
   page, so review gains evidence rather than losing it.
3. **`STATE_MISMATCH` is non-retryable** (`failure-taxonomy.md:27`) and **"nothing
   retries and nothing polls"** (`element-identity.md:202`). **Decision: split.**
   The state re-check happens *inside* the expectation evaluation, before the
   failure record is built, so no `STATE_MISMATCH` that would have been retried
   is ever produced — that reverses nothing. The node-level retry the ladder
   needs does contradict `element-identity.md`, so that document is updated in
   the same work unit to record the bounded retry and why it exists.

---

## Execution Plan

Repos: **C** = FluxIQ Core (`F:\!FluxIQ`), **D** = this repository's `domain`,
**X** = this repository's `apps/extension`, **L** = `packages/test-runner` (the
Lab). Every step names the file discovery found, so a worker does not rediscover
it. Directories for genuinely new Core modules are marked `d7` until that report
lands.

**P0 — land the t075 integration.** Already running. Per-Flow handle numbering,
look-alike cues and dialog-controls-first packets are not on `dev`, so every step
marked `after P0` is blocked until it merges.

### Workstream A — the build authors by accrual

| Id | Work | Repo | After |
| --- | --- | --- | --- |
| A1 | Retain `decision.input` beside each evidence entry and return the step list; widen `AutomationStudioLlmEvidenceLoopResult` (`runtime/llm/evidence-loop.ts:127-139,466`). Today only a hash of the input survives. | C | — |
| A2 | Pass a state-digest hook from the bootstrap loop call (`runtime/service.ts:1889-1927`). `captureStateDigest` already exists on the binding and is simply not wired for builds. | C, D | — |
| A3 | Wire `flow-bootstrap` to `runtime/exploration-reduction/` via `automationStudioExplorationStepsFromTrace` and `reduceAutomationStudioExploration`. A1 and A2 close the exact two gaps that module's own header names. | C | A1, A2 |
| A4 | Add a sibling assembler taking reduced steps, beside the text-only `assembleAutomationStudioFlowScriptPlan` (`authoring/assemble.ts:53`), so the proposal is built from the accrued draft rather than re-emitted prose. | C | A3 |
| A5 | New decision kinds beside `tool_call` and `complete` (`evidence-loop.ts:70-72,532-560`): drop a step, amend a step's settings, mark a step exploratory. Today `complete` re-emits the whole Flow from scratch with its previous script absent from the request. | C | A4 |
| A6 | Reserve the draft's allocation in `evidenceContextWindow` (`evidence-loop.ts:638-670`), or carry it beside `routing` in the `flowBootstrap` packet. **This is the direct fix for the per-toolId eviction that produced the `everything-store` Flow.** | C | A4 |
| A7 | An execution seam that replays the draft from a reset page during the build, gated by the existing `AutomationStudioActionPermissionGate`; then forbid proposing until the draft has replayed clean. The highest-value step in the document. | C, D | A4, d6 |
| A8 | Give a tool rejection enough detail for the model to route around it — which handle, what was wrong (`domain/.../tool-rejection.ts:25-57`, eight bare codes today). Directly attacks round 1's repeat-without-progress stalls. | D | — |
| A9 | Register a wait tool on the authoring path: Core's builtins are never registered for a build (`runtime/service.ts:1881` passes no `host`), and the domain's wait is stage-pinned to `gather`/`iterate` while bootstrap carries no stage. | C, D | — |
| A10 | Stop `sanitizeEvidenceLoopTrace` dropping `resultCode` and `effectApplied` from a successful build's stored trace (`runtime/service.ts:5931-5944`). | C | — |
| A11 | Make an unpermitted action on the authoring path a recoverable `permission_required` that reaches the person, instead of a throw (`action-permissions.ts:72-80`). The domain already models it this way (`press.ts:63`). | C, D | — |

### Workstream B — the defensive runtime

| Id | Work | Repo | After |
| --- | --- | --- | --- |
| B0 | **Carry the recorded gap onto the node.** Core's recording entries already hold `timestamp` and `monotonicOffsetMs` (`model/recording-framework.ts:20-22`), which is the right clock for an inter-step gap; nothing carries that gap onto the Flow node. Derive it from consecutive entries and store it as the node's wait ceiling. | C | — |
| B1 | **A per-node retry loop, on by default**, in the step loop (`runtime/executor/graph-run.ts:211,253-277`). **None exists today.** Default 3 attempts with 250 ms / 1 s / 2 s backoff, configurable per node and per Flow. Not opt-in. | C | — |
| B1a | **The wait ceiling gated by expected state.** Before attempting a node, wait for its expected pre-state for up to `clamp(recordedGap × 2, 2 s, 30 s)`. State seen early → execute immediately, so a fast page replays faster than the recording. Deadline reached → attempt anyway and mark it, because the recording is evidence the action was possible. Only a failed attempt starts the ladder. | C, X | B0, B3 |
| B2 | Evaluate the recorded expectation on a failed attempt, not only a succeeded one (`transition-comparison.ts:109`), re-checking **inside** the evaluation before the failure record is built, so no non-retryable `STATE_MISMATCH` is minted that would have been retried. | C | B1 |
| B3 | **Read the recorded state link.** `stateLink`, `stateSnapshotId` and `stateRef` are written onto every node and no execution path reads them — the defect that makes the product's central feature inert. Rungs 2 to 4, and B1a's gate, read what is already stored. | C | B2 |
| B4 | Express the rungs as recovery candidates that are **consumed and dropped** from the list, since any deterministic candidate on offer suppresses escalation (`adaptive-orchestrator.ts:92`); and let a non-`deterministic_path` candidate execute (`graph-run.ts:260`). | C | B3 |
| B5 | Verify an action did something: arm `content/action-runtime/in-place-effect.ts` beyond `a[href]` clicks, make a navigate prove it moved or reloaded, and give a navigate result enough evidence to judge (`runtime/action-results.ts`, `navigation-outcome.ts:25-30`, `automation-tab.ts:132-141`). | X | — |
| B6 | Resolve wait selectors through `resolveShadowScope` instead of a bare `document.querySelector` (`wait-conditions.ts:74,82,90,96`), so a wait can be satisfied inside a shadow root. | X | — |
| B7 | Make `check`, `scroll` and `upload` call `checkActionability`, so a covered control refuses instead of acting through an overlay. | X | — |
| B8 | Unblock escalation for granted runs: change the refusal list in `runtime/llm/runtime-session-grant.ts:62-74` (not the normalization at `service.ts:3060`), the two `!input.llmExecution` guards (`service.ts:3203,3257`), and the target-override refusals (`live-patch/target-override-check.ts:83-91`). | C | B4 |
| B9 | Resolve the inert retry surfaces rather than leaving them as traps: `builtin.timing.retry` retries nothing, `RetryPolicy.backoffMs` has no consumer, `retryable` is read by no decision, and `maxRetriesPerAction` is a cap named like an allowance. Implement or retire each, explicitly. | C | B1 |

### Workstream C — branches and loops in the draft

Smaller than first assumed: the model already authors routing and Subflows in a
Flow script, proven at 14 of 14 down two routes with zero calls. Only the
accruing draft needs to express them.

| Id | Work | Repo | After |
| --- | --- | --- | --- |
| C1 | Let a draft step be marked conditional on a state check, so "dismiss this only if present" survives into the Flow. | C | A5 |
| C2 | Let a span of draft steps become a loop over a list or while a condition holds. | C | C1 |
| C3 | Make the action node's own `failed` port reachable from an authored draft, so a Flow can carry its own recovery edge. | C | A4 |

### Workstream D — adversarial fixtures and measurement

Waits on `d6`. Each condition gets a scenario variant, a stated rung that must
absorb it, and an expectation of **zero provider calls**.

| Id | Work | Repo | After |
| --- | --- | --- | --- |
| D1 | Fixture conditions: timed overlay, content arriving after the action that needed it, a control renamed between authoring and replay, per-visit row differences, session expiry mid-Flow. | L | — |
| D2 | Per-condition expectations naming the absorbing rung, and the Lab evidence needed to attribute a recovery to a rung. | L | d6, B4 |
| D3 | A measured lane that runs every condition and reports rung attribution and provider-call count. | L | D1, D2 |

### Validation

Per the standing rule, each slice proves itself with a narrow live run against
the real provider on the single scenario its step names, **before** unit tests;
the wider suites run as a regression net once a slice is believed finished, and
the full corpus is a measurement taken at the end, not a development loop. No
step is complete on compilation or on a worker's report.

---

## Worker Briefs

### Brief: d1-exploration-to-flow-seam
Dispatched 2026-09-22. How a model-driven exploration becomes a saved Flow in
Core today, what is discarded between the two, whether a build can revise a node
it already proposed, and what a tool failure tells the model. Report:
`reports/d1-exploration-to-flow-seam.md`.

### Brief: d2-recording-artifact
Dispatched 2026-09-22. The exact shape of a recorded step after t063, where it is
captured and mapped, what expected-state checking exists at replay, and what a
recording cannot express that a model would need. Report:
`reports/d2-recording-artifact.md`.

### Brief: d3-runtime-execution-and-failure
Dispatched 2026-09-22. What happens when a Flow node fails: the execution path,
every retry that exists, what state checking runs, the exact conditions under
which the model is consulted, and what suppresses it. Report:
`reports/d3-runtime-execution-and-failure.md`.

### Brief: d4-target-resolution-defenses
Dispatched 2026-09-22. Every defensive mechanism that already exists for finding
and acting on an element, which are on by default, and whether the runtime keeps
enough evidence to detect an action that reported success and changed nothing.
Report: `reports/d4-target-resolution-defenses.md`.

### Brief: d5-existing-coverage
Dispatched 2026-09-22. Which parts of these designs the existing plans already
cover, already built, or leave absent, and any place where they would contradict
a decision already recorded. Report: `reports/d5-existing-coverage.md`.

---

## Work Ledger

### 2026-09-22 — Document created; designs drafted; discovery dispatched
- Agent: supervisor
- Changed: this document; `docs/working/README.md`; five briefs dispatched.
- Why: the user asked for a side plan to make Flow authoring and Flow execution
  defensive before live testing continues, naming two defects from round 1: the
  saved Flow diverging from what the model did, and a failing node having no
  cheap recovery before the model.
- Validation: not validated — design and dispatch only, no code touched.
- Outcome: Partial
- Follow-up: fold the five reports into a phase and step table, then dispatch
  implementation.

---

## Open Questions

- Does the dry run reset the page, the workspace, or the whole browser context?
  Cheapest sufficient reset wins; d2 and d3 should settle what is available.
- Is "exploratory, do not keep" a model decision or inferred from whether a later
  node depends on the state it produced? Inference is safer but harder to
  explain; the model's own mark is honest but can be forgotten.
- Where does the draft Flow live during a build — in the run's state, or as a
  real unsaved Flow resource? The second gives editing and replay for free if the
  resource layer allows an unsaved draft.
