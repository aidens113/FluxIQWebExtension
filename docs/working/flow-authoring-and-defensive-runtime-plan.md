# Flow Authoring And Defensive Runtime

Status: Active
Status detail: Wave one landed 2026-09-22, tasks t076-t080 plus the t082 correction. Wave two is out as four Core-paired tasks: t081 continued, t087, t088 and t089.
Created: 2026-09-22
Last updated: 2026-09-22
Owner: Senior supervisor agent
Scope: Make a model-authored Flow faithful to what the model actually did, and make a Flow's execution survive a site we do not control. Covers the build loop's authoring model, the draft Flow and its edit and dry-run tools, branch and loop authoring, the runtime's deterministic recovery ladder, and the adversarial fixture conditions that measure both. It deliberately does not cover the real-site lane itself, the campaign measurement, new extraction capabilities, or the Week 2 exit criteria, which stay in their own documents.
Paired document: `F:\!FluxIQ\docs\working\flow-authoring-and-defensive-runtime-plan.md`
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

**What discovery changed.** Seven read-only workers reported, and every
load-bearing claim below was re-checked in source by the supervisor. Three things
moved the plan materially:

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

**All seven discovery reports are in**, and the plan below names real files. The
binding constraint they found is that Core's `service.ts` sits *exactly* on its
ratchet at 6,275 lines and 223 methods, so every step lands in a new module and
no edit may add a line to the service.

**Dispatched 2026-09-22.** The t075 integration landed in both repositories
(downstream `c32d664`, Core `7952512`), so wave one went out — five workers, no
two sharing a file, each on its own task branch and worktree:

| Task | Worker | Steps |
| --- | --- | --- |
| t076 (Core-paired) | `fa-executor-ladder` | B0, B1, B1a, B2, B3, B4, B9 |
| t077 (Core-paired) | `fa-build-draft` | A1, A3, A4, A5, A6 |
| t078 | `fa-extension-defenses` | B5, B6, B7 |
| t079 | `fa-domain-tools` | A8, A11 |
| t080 | `fa-lab-measurement` | D0, A12 |

Every brief puts the live proof **before** unit tests, and the four deterministic
ones must show **zero provider calls**, since a paid call would mean the
determinism did not work.

**Wave one landed, all six tasks.** t076 and t077 were Core-only and merged there
alone (`cda4bb1`, `bf8792b`); t078, t079 and t080 merged in both repositories
(`a772560`, `cdb038e`, `387b314`). The correction below then went out as t082,
`fa-explore-with-output-nodes`, and merged (`9393cbd`, Core `1987317`), rebuilding
the build loop around the real node registry. The recovery ladder is built and
runs live, but its own worker found that **no variant in the scenario corpus is
absorbable by a deterministic ladder**, so it has never been shown to absorb
anything. That is workstream D's job now, not a defect in the ladder.

**Two constraints stated above are out of date.** Core's `service.ts` is **4,637
lines**, not the 6,275 quoted throughout this document: the headroom tasks landed,
so wave two may add lines there within reason. And the four `flow-bootstrap` edits
that `fa-flow-permission-gate` was blocked on landed inside t082 (`0607038`), so a
consequence declaration now has a carrier and t081 is no longer unsatisfiable.

**Wave two dispatched 2026-09-22** — four workers, partitioned by file, each on
its own task branch and Core-paired worktree:

| Task | Worker | Steps |
| --- | --- | --- |
| t081 (continued) | `fa-flow-permission-gate` | the Flow-step gate and its grammar, reconciled onto t082's path |
| t087 | `fa-service-seams` | A2, A9, A10, A11's Core half, B8, B0's missing line |
| t088 | `fa-draft-dry-run` | A7 |
| t089 | `fa-adversarial-measurement` | D0a, A12, D1, D2, D3 |

`runtime/service.ts` belongs to t087 alone; t088 names the line it needs there in
its report rather than writing it. Workstream C stays held behind A7, which owns
`runtime/flow-draft/`.

**Next:** verify each claim in source and by rerunning its proof, land the four one
at a time, then dispatch workstream C. The Core-side paired document is still owed.

**Blockers:** none.

---

## Correction, 2026-09-22: exploration runs the real output nodes

**Design One as written below is not what the user asked for, and the work built
from it missed the point.** Recorded here rather than quietly rewritten, because
the distinction is the whole lesson.

The user's instruction on 2026-09-18 was that the exploratory tool calls must not
be different from the Flow the model creates. Design One answered that with a
draft that *accrues* from exploration — but the model still explored with five
invented verbs (`web.inspect_current_page`, `web.press_control`,
`web.enter_field`, `web.navigate_same_origin`,
`web.detect_repeating_structure`) while the Flow was still made of the **18 real
output nodes** in `domain/src/output-nodes/definitions.ts`. Two vocabularies, so
what was proven while exploring is not what ships, and a node can enter a Flow
having never been executed. Faithful accrual of the wrong artifact.

On 2026-09-22 the user corrected it directly: the model must have access to **all
the output nodes** and be able to **test them in live time**; the tool calls are
for **editing the Flow**; the exploratory output is the **actual same output
nodes with the same functionality and real parameters**, so the Flow is put
together from nodes that 100% worked during exploring.

**The architecture, superseding Design One's tool model:**

1. The model's catalog is the real output-node catalog with its real parameter
   schemas — not a translation and not a subset we choose.
2. A decision is "run this node with these parameters", executed through the
   same path the runtime uses, against the live page.
3. A node that ran successfully is in the Flow, with the exact parameters it ran
   with. The Flow is correct by construction.
4. The editing decisions operate on the Flow: amend and re-run, remove, reorder,
   mark a node run-only-to-look.

**A consequence worth noting:** several capabilities the model appeared to lack
were only walled off by the split. `web.dom.wait_for_selector`,
`web.dom.wait_for_text`, `web.dom.scroll`, `web.dom.select`, `web.dom.check` and
`web.dom.assert` all already exist as nodes. Step A9, "there is no wait tool on
the authoring path", dissolves rather than needing to be built.

**The three-strike rule is deleted.** `maxStepsWithoutProgress` defaults to three
and ends a build after three non-productive steps
(`runtime/llm/evidence-loop.ts:445,469`, documented at `:239`). The user did not
ask for it and rejected it explicitly; it also contradicts the standing rule that
the loop iterates as far as cost, tokens, deadline and genuine progress allow.
Looking at the page again after a setback is correct behaviour and must not be
scored as failure. Only a far backstop that cannot fire during ordinary work
remains.

This is task **t082**, worker `fa-explore-with-output-nodes`. Steps A5, A8's
value and A9 are subsumed by it.

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

The seven discovery reports' findings are archived in
[archive/discovery-findings.md](./flow-authoring-and-defensive-runtime-plan/archive/discovery-findings.md);
the full reports are in `flow-authoring-and-defensive-runtime-plan/reports/`.
The facts the rest of this plan rests on, each verified in source by the
supervisor:

- Core's `runtime/exploration-reduction/` already implements exploration-as-a-recording, with the step shape and minimum-replayable-sequence reduction this plan wants, and **no file under `runtime/flow-bootstrap/` imports it**.
- The build's `evidenceContextWindow` keeps the newest entry **per toolId**, so every dismissal sharing `web.press_control` leaves only the last visible when the Flow is written — the mechanical cause of the `everything-store` Flow.
- **No per-node retry exists**; a node is executed exactly once, and the expected-state check is guarded by `attempt.status !== "succeeded"`, so recorded state is consulted only to demote a success.
- Every node carries `stateLink`, `stateSnapshotId` and `stateRef`, and **no execution path reads them**.
- `compareNavigatedUrl` compares requested against landed, so a navigate to the page the tab already shows reports success, and a navigate result carries no snapshot, title or element to catch it with.
- The model already authors routing and Subflows successfully; only the **accruing draft** needs to express branches.
- Core's `service.ts` sits exactly on its ratchet at 6,275 lines and 223 methods, and four directories this work would extend are already at maximum path depth.
- The dry run's loop already exists in the Lab, costing about 2.3 s per node plus a reset, with no provider calls.


### From wave one's workers (2026-09-22)

1. **A created Flow's steps are never put to the permission gate. Verified, and
   now measured.** `WebPlanNodeResolutionInput`
   (`domain/src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts:103`)
   carries exactly `projectId`, `flowId`, `nodeDefinitionId` and `parameters`,
   and the whole file contains **zero** occurrences of "permission" or
   "consequence"; its outcomes are `unchanged`, `resolved` and `refused`, with no
   needs-permission state to reach. Core hands the domain a per-node check
   (`plan-parameter-resolution.ts:72,119-125`) the domain never declares or
   calls, and the Flow script grammar gives the model nowhere to state a step's
   consequences. `fa-domain-tools` measured the consequence live: a nine-node
   Flow that fills and submits a composer was authored and replayed **under an
   empty grant** with `permissionRequest: null` and `instructedConsequences: []`.
   This is the week2 plan's P3, promoted from a code reading to a measurement.
   **It must close before anything is pointed at a real site**, and it is larger
   than step A11 as briefed: it needs the grammar, the gate wiring, and a
   non-terminal throw.
2. **Better refusal detail cannot pay off until the repeat rule changes.
   Verified.** The repeat key is
   `canonicalJson([mutationEpoch, decision.toolId, decision.input])`
   (`runtime/llm/evidence-loop.ts:546`) and `mutationEpoch` advances only when a
   mutation is **applied** (`:585`). A refused press applies none, so a model
   that reacts to a refusal by looking again — exactly what a good refusal
   advises — repeats a signature, is answered `already_answered`, increments
   `stepsWithoutProgress`, and ends in `evidence_repeat_without_progress`, a top
   cause in round 1. `fa-domain-tools` built the detail and measured two of three
   live builds still dying this way. Relayed to `fa-build-draft`, which owns that
   file, with the caveat that a genuine no-op repeat must still count as no
   progress. **A8 and the A stream are one change, not two.**
3. **Two corrections to the plan's own findings.** d6's claim that
   `snapshots/repair-lane.json` is read by nobody is stale — the bundle reads it
   and `replayProviderCalls` is live. And D0a's node id needs **no Core work**:
   Core already sends `attempt.nodeId` (`persisted-flow-run.ts:571,601,697`) and
   the Lab drops it in `flowActionsSnapshot` (`run-flow-lane.ts:428-436`), which
   the supervisor confirmed. Only the browser's
   `WebAutomationTargetResolution.strategy`, stuck in Core's `attempt.outputs`,
   still needs a Core change.

---

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
4. **"The evidence loop is not a runtime executor for the workflow being
   authored"** (Core's `docs/architecture/automation-studio/llm-flow-bootstrap.md:432-434`).
   The in-flight dry run (A7) deliberately changes this, because a build that
   cannot run its own draft cannot know whether the draft works — which is the
   defect that produced round 1's single Flow. **Decision: make the change and
   rewrite that passage in the same work unit**, stating what the build may now
   execute, that it runs with `allowLlmDiagnosis: false`, and that it remains
   gated by the existing action-permission gate. A documented boundary is changed
   in the open, never quietly.

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
| A7 | An execution seam that replays the draft from a reset page during the build, gated by the existing `AutomationStudioActionPermissionGate`; then forbid proposing until the draft has replayed clean. The highest-value step in the document. **The loop already exists** — `flow-lane/repair/replay-repair.ts:79-125` is `prepare()` → model-free run → count Core's own provider calls → check goal, and its `prepare` already resets the scenario mid-run. What is missing is a node id on the published attempt and a place for the verdict. Costs ~2.3 s per node plus ~1 s of reset, 6-30% per attempt, zero provider calls. | C, D, L | A4 |
| A12 | Populate `evidenceLoop.steps` on **proposed** builds, not only refused ones (`build-proposal.ts:73-74`). Today the successful builds we most want to study are the ones we cannot see. | L | — |
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
| D0 | **A declared-zero-calls expectation, before any variant is authored.** `assertLiveLlmProviderWasReached` (`live-llm/budget.ts:101-109`) throws when a `--live-llm` run makes no provider call — correct for the creation lane, but it would fail every variant that the ladder absorbs correctly. Copy the `expected.failure` / `declaredFailureVerdict` precedent (`run-evaluation/declared-failure-verdict.ts:43-70`), which overrides only dispatch and targeting and never the oracle. **Blocks D1.** | L | — |
| D0a | **Make the rungs observable at all.** Publish the node id on `flowActionsSnapshot` (`run-flow-lane.ts:428-437`, dropped today) so a retried node joins back to its node, and carry `WebAutomationTargetResolution.strategy` through Core's run detail (`persisted-flow-run.ts:149-153` drops `outputs`). Without both, no rung can be attributed. | C, D, L | — |
| D1 | Fixture conditions: timed overlay, content arriving after the action that needed it, a control renamed between authoring and replay, per-visit row differences, session expiry mid-Flow. | L | D0 |
| D2 | Per-condition expectations naming the absorbing rung and the expected provider-call count. | L | D0a, B4 |
| D3 | A measured lane that runs every condition and reports rung attribution and provider-call count. Also fix the two dead evidence paths found here: `snapshots/repair-lane.json` is written and read by nobody (leaving `replayProviderCalls` hard-coded `null`), and no campaign row carries a duration. | L | D1, D2 |

### Validation

Per the standing rule, each slice proves itself with a narrow live run against
the real provider on the single scenario its step names, **before** unit tests;
the wider suites run as a regression net once a slice is believed finished, and
the full corpus is a measurement taken at the end, not a development loop. No
step is complete on compilation or on a worker's report.

---

## Worker Briefs

### Implementation partition

Six workers, partitioned so no two share a file. Core's `service.ts` is the
serial bottleneck as always and belongs to exactly one of them, and it has **zero
ratchet headroom**, so edits there may change lines and never add them.

| Worker | Steps | Owns |
| --- | --- | --- |
| `fa-build-draft` | A1, A3, A4, A5, A6 | Core `runtime/llm/evidence-loop.ts`, `runtime/flow-bootstrap/**`, new `runtime/flow-draft/` |
| `fa-service-seams` | A2, A10, B8 | Core `runtime/service.ts` (line-neutral), `runtime/llm/runtime-session-grant.ts`, `live-patch/**` |
| `fa-domain-tools` | A8, A9, A11 | `domain/src/runtime/llm-evidence/**` and Core's harness-option registration only |
| `fa-executor-ladder` | B0, B1, B1a, B2, B3, B4, B9 | Core `runtime/executor/**`, `runtime/recovery/**` |
| `fa-extension-defenses` | B5, B6, B7 | `apps/extension/src/content/**`, `src/runtime/**` |
| `fa-lab-measurement` | D0, D0a, A12 | `packages/test-runner/**` |

`fa-executor-ladder` and `fa-extension-defenses` are the pair to start first:
they are disjoint, they carry the user's stated requirements, and B5 to B7 are
standalone defects that need nothing else to land.

Workstream C waits on A5. Workstream D1 to D3 wait on D0 and B4.

Discovery briefs d1 to d7 were all delivered on 2026-09-22 and are archived in
[archive/delivered-briefs.md](./flow-authoring-and-defensive-runtime-plan/archive/delivered-briefs.md).
Their findings are distilled in `## Discovery Findings` above and their full
reports are in `flow-authoring-and-defensive-runtime-plan/reports/`.

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

### 2026-09-22 — Wave one: the Lab's zero-call declaration and the domain's refusal detail landed
- Agent: supervisor; workers `fa-lab-measurement`, `fa-domain-tools`
- Changed: t080 merged (`387b314`) and t079 merged (`cdb038e`), both pushed. D0 done; A8 done but inert until the repeat rule changes; A12 blocked on a two-line Core change; A11 done on the domain side only.
- Why: D0 unblocks every adversarial variant — without it the live-LLM guard fails each correct deterministic absorption. A8's detail is a prerequisite whose value waits on `fa-build-draft`.
- Validation: the supervisor re-ran both worktrees rather than trusting the reports. t080: every package `# fail 0`, `test-runner # pass 1286`. t079: every package `# fail 0`, `domain # pass 730`. Both `task finish` runs reported `"command":"pnpm check","passed":true`. t080's live proof stands: `run-mud4xk2c-18c83d3d` undeclared failed `runtime.behavior` with its oracle passing, `run-mud4zvw9-2d497834` declared passed; `budget.ts` is byte-for-byte unchanged and `settleBuild` passes no declaration, both confirmed by the supervisor.
- Outcome: Partial
- Follow-up: the permission-gate hole (finding 1) needs its own task; A12's Core half and the strategy field join wave two; `fa-domain-tools`' three named Core edits fold into the A11 successor.

---

### 2026-09-22 — Wave one closed; the correction landed; wave two dispatched
- Agent: supervisor; workers `fa-executor-ladder`, `fa-build-draft`, `fa-extension-defenses`, `fa-explore-with-output-nodes`
- Changed: t076 and t077 merged in Core alone (`cda4bb1`, `bf8792b`); t078 merged in both (`a772560`); t082, the correction that makes exploration run the real registry nodes, merged in both (`9393cbd`, Core `1987317`). A1, A3, A4, A5, A6, B1, B1a, B2, B3, B4, B5, B6, B7 and B9 are built; B0 is short one line in `service.ts`.
- Why: wave one was dispatched before the user's correction on 2026-09-22 that the model must explore by running the real output nodes, so t082 both replaced the second tool vocabulary and, incidentally, supplied the consequence carrier that t081 was blocked on.
- Validation: t082's live run `run-mudavyub-d34e3c9b` (real DeepSeek, everything-store): `build.providerCalls` 23 == `observed.calls` 23, and the proposed Flow's four steps were exactly the four nodes that succeeded while exploring, replayed with no model attached. Two things that run did **not** show: a correct answer — the replayed extraction returned 0 records against 16 expected — and a Flow that replays untouched, since `run-muddtosq-b92a4d5c` needed a paid repair mid-replay. Core's `service.ts` re-measured at 4,637 lines, so the zero-headroom constraint this plan was partitioned around no longer holds.
- Outcome: Partial
- Follow-up: wave two went out the same day as four Core-paired tasks — t081 continued (the Flow-step gate and its grammar, now satisfiable), t087 (A2, A9, A10, A11's Core half, B8, B0's line), t088 (A7, whose dry run is the direct answer to the 0-of-16 extraction that shipped inside a proposal), t089 (D0a, A12, D1 to D3, which is what will finally give the ladder something to absorb). Workstream C stays held behind A7.

## Open Questions

- Does the dry run reset the page, the workspace, or the whole browser context?
  Cheapest sufficient reset wins; d2 and d3 should settle what is available.
- Is "exploratory, do not keep" a model decision or inferred from whether a later
  node depends on the state it produced? Inference is safer but harder to
  explain; the model's own mark is honest but can be forgotten.
- Where does the draft Flow live during a build — in the run's state, or as a
  real unsaved Flow resource? The second gives editing and replay for free if the
  resource layer allows an unsaved draft.
