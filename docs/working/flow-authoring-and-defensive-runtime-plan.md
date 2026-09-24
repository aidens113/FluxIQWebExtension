# Flow Authoring And Defensive Runtime

Status: Active
Status detail: Eleven tasks landed 2026-09-23 (t095-t111), all merged and pushed in both repositories. Three live runs then failed at three successively later points -- blocked asking permission to read, every record refused on a type mismatch after reading all 16 correctly, and a selector built on a React-generated id. t112 and t113 are in flight.
Created: 2026-09-22
Last updated: 2026-09-24
Owner: Senior supervisor agent
Scope: Make a model-authored Flow faithful to what the model actually did, and make a Flow's execution survive a site we do not control. Covers the build loop's authoring model, the draft Flow and its edit and dry-run tools, branch and loop authoring, the runtime's deterministic recovery ladder, and the adversarial fixture conditions that measure both. It deliberately does not cover the real-site lane itself, the campaign measurement, new extraction capabilities, or the Week 2 exit criteria, which stay in their own documents.
Paired document: `F:\!FluxIQ\docs\working\flow-authoring-and-defensive-runtime-plan.md`
Related: [week2-exit-plan.md](./week2-exit-plan.md) (the campaign this defers), [mvp-week2-automation-loop-plan.md](./mvp-week2-automation-loop-plan.md) (the adaptation loop this hardens), [AGENTS.md](../../AGENTS.md)

---

## Current State

**Scope, set by the user on 2026-09-22 and binding on everything below.** The
only path that counts is: a person writes an instruction, the model explores the
live page by running real Flow nodes, and the Flow it builds then runs
deterministically and produces the right answer. **Recording-built Flows are not
to be tested, measured, or reported as progress**, and **the ten realistic
campaign sites are the only test surface**.

**Where the product actually is, measured 2026-09-23/24.** Three live runs of
`everything-store-first-page-plus-earbuds` against `deepseek-flash`, each
diagnosed to its cause and fixed before the next. Total spend for the three:
**$0.10**. No run has yet produced the right answer, and across every campaign
ever run that number is still zero — but each of the three failed further along
the chain than the one before, and every cause is now closed:

1. `run-mueozmp8-348a2057` — **no Flow at all.** The build spent 21 calls,
   explored the page, then asked the person for permission to *read a list*, the
   very thing the instruction requested. Nobody was there, so it parked.
   Cause: a declaration could say what class of consequence an action carried
   but not whether it acted at all. Fixed in t109.
2. `run-mueqynzb-ac54aab9` — **Flow built, 11 nodes, its own `navigate` node,
   replayed end to end, extraction ran and read exactly the 16 expected rows** —
   and Core refused all 16, because the record schema the model authored typed
   `price` and `rating` as numbers and a page returns text. The capture then
   reported success with an empty array, so the node was told nothing. Fixed in
   t111, both halves.
3. `run-muesyox4-930bef98` — **failed before extraction**, and my first reading
   of it was wrong. The two `#\:r13b8o\:` click failures were **not** the
   volatile id: that is the notifications modal, which this fixture opens four
   seconds after every load, and the clicks fired at about 1.0s and 2.4s before
   it existed. The third, at about 4.4s, succeeded. The recovery's **-0.12** is
   arithmetically what a same-family button scores when it shares only its
   family, so refusing was correct. **The Flow clicks a modal on a four-second
   timer with no wait node, and survived only by accident of the three-attempt
   retry ladder** — recorded state is supposed to drive execution, and here it
   did not. The run's *terminal* failure was a different node, `s6`
   (`main > div:nth-of-type(2) > aside > div:nth-of-type(1) > a`, "0 control(s)
   of the same family"), untouched and still open. Separately the volatile id
   **is** fatal across builds — under another seed `:r13b8o:` becomes
   `:r05rcq:` and the recorded address matches nothing — and t112 closed that.
   The repair loop engaged, spent two diagnosis calls, validated the second, and
   produced **no patch, no adaptation and no refusal code**; open as t113.

**Eleven tasks landed on 2026-09-23, t095 to t111**, all merged and pushed in
both repositories. The model can now see a page's filter controls (a facet
ranked 56th of 611 never reached it, so Flows read the unnarrowed list); a field
reads the value the page states rather than the sentence around it; a read waits
for a lazily loaded list to be complete; the Lab reports the failure that
decided a run rather than a recovered one, and stopped waiting 300s for a
recovery record that never comes (campaign wall clock ~959s to ~347s); a Flow
must reach its own page and now can, because the domain refuses every call until
it has; a clean run that answers wrongly is a repairable failure; a repair sees
screened step parameters and the Flow's real routing; a successful run is
checked on a decaying schedule; and an unattended run can both judge and make a
repair, funded by a standing Flow-scoped authorization with a ceiling and an
expiry.

**Cost work, measured.** The cacheable prefix went from 1,272 bytes to 50,693 of
50,711, and the first live run after it reconciled at **62.3% cache hits**
(143,872 of 230,895 input tokens; $0.030 observed against $0.072 all-miss). The
model is `deepseek-flash` and is now configurable rather than hardcoded in six
places; the old prices were wrong in both directions and r5 recomputes from
$0.1720 to $0.1188.

**Not done, and the next things.** t112, t113 and t114 are merged. Nothing is in
flight.

**What t113 established, and it is the sharpest finding of the day.** The repair
loop is not dead — Core's own tests carry a `target_not_found` that reaches the
patch call and produces a proposal. Three things stopped this run. **The model
was asked about the wrong failure**: `annotate` diagnoses the *last* failed
attempt, and the three highly repairable failures with six same-family controls
were fixed deterministically by the retry rung and never reached it, so the one
it saw was `s6` with **0 same-family controls and 0 fingerprint candidates on an
819-byte page**. **The refusal was never checked against the page**: `annotate`
gates exploration on `plan.explorationRequested && plan.patchRequest.request`,
so the moment the plan says "no patch" the look is cancelled too, and the
model's unexamined "the goal is gone" is final. And `structured-diagnosis.ts`
is asymmetric — it refuses a model `yes` over Core's `no` and records it, but
accepts a model `no` over Core's `unknown` unexamined. **Saying why is not
repairing: t113 closed the silence, not the gap.**

**t114 closed the second of t113's three causes.** The loop now plans a second
time after looking. On a `goal_unachievable` refusal it explores anyway, then
makes a second `runtime_diagnosis` at the `plan` stage carrying the packets the
look returned and the model's own earlier answer, and rebuilds the plan from what
comes back. A refusal that survives keeps its code and changes rung from `plan`
to `exploration` - which is the whole difference between "the model declined" and
"the model declined after looking", said in the vocabulary that already existed.
A second call that returns no diagnosis leaves the first plan standing and
records it as unchecked rather than confirmed. Only `goal_unachievable` is
treated as checkable: a policy refusal is a person's setting no page can speak
to, and `diagnosis_asked_for_none` is unreachable because the flag that decides
it is the same flag that stops an exploration running. The Lab needed no change;
it already carries Core's rung through untouched.

**t115 closed the first of the three, and it was not the attempt selection.**
Diagnosing the terminal failure is right - that is what has to be repaired for
the run to succeed. What was wrong is that the repair was shown that failure
*alone*: `recent_nodes` keeps only succeeded attempts, and `recoveryAttempts` was
written on every run and read by nothing but a counter, so the three clicks the
ladder rescued - six same-family controls each, at offsets that say the modal
appears about four seconds in - reached nobody. A `recovered_failures` section
now carries them. Writing its test found two more: the locator screen's id rule
required a letter after the `#`, so React's `useId` ids - the exact shape t112 is
named after - passed through unwithheld; and `explorationRequested` was read
straight off the model's own `explorationNeeded`, which thirteen live runs
answered `false` every time, so t114's re-plan would have fired almost never. A
model does not get to both claim the goal is gone and rule that the page need not
be looked at. Both are closed.

**The next step is a live run.** Re-run
`everything-store-first-page-plus-earbuds` and read three things: whether a
refusal now carries `refusalRung: "exploration"`, whether the repair's context
carries `recovered_failures`, and whether a model shown that the page mutates on
a timer does anything different with it. Only then fan out. Nine of the ten sites
have not been touched by current code.

**Known and written down, not yet worked:** Core's flow-bootstrap catalog
actively teaches the model to author a record schema for a node that derives a
correct one itself, offering value types a page can never return — its own
header records three earlier live refusals from the same cause. The 40-element
evidence bound now cuts four of six packets with up to 2,233 bytes unspent.
Crossborder's header links crowd out its filters. A repair drains the shared
authorization about 150x faster than a check, so a repeatedly failing Flow
spends its purse and then stops being checked, with nothing telling the person.
The authorization clause has no UI or API. Cache-hit tokens are read by Core but
lost before the Lab can record them.

**Environment traps that cost five invocations before the first run started:**
the Lab executes Core's *compiled* output, so a Core merge invalidates it and
`pnpm --filter fluxiq build` must run first; `.env.local` configures an
`existing` target while every campaign run uses `isolated`; and blanking the
existing-install keys does not work because empty values are rejected. The
working invocation is `FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=isolated`
with `DEEPSEEK_API_KEY` exported into the shell.

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

Three findings, all since closed: the Flow-step permission gate (t095 onward),
the evidence repeat rule, and two corrections to this plan's own discovery.
They are in
[archive/2026-09-23-wave-one-ledger-and-partition.md](./flow-authoring-and-defensive-runtime-plan/archive/2026-09-23-wave-one-ledger-and-partition.md).

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
| A13 | **Cross-check what a step declared against the instruction the person gave.** The instruction-authority derivation is already computed and is never compared with the model's own declaration, so a build whose instruction plainly asks to publish, all of whose presses declare nothing lasting, passes without anyone noticing the contradiction. This is the independent signal the self-report needs; it does not require inferring anything from a control, which was deleted on 2026-09-18 and must not come back. | C | t081 |

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

The six-worker partition this document opened with was superseded on
2026-09-23, when the user narrowed the work to instruction-driven Flow
creation and it became a series of supervisor-direct tasks, t095 onward.
The table, and the eight ledger entries that ran under it, are in
[archive/2026-09-23-wave-one-ledger-and-partition.md](./flow-authoring-and-defensive-runtime-plan/archive/2026-09-23-wave-one-ledger-and-partition.md).

Discovery briefs d1 to d7 were all delivered on 2026-09-22 and are archived in
[archive/delivered-briefs.md](./flow-authoring-and-defensive-runtime-plan/archive/delivered-briefs.md).
Their findings are distilled in `## Discovery Findings` above and their full
reports are in `flow-authoring-and-defensive-runtime-plan/reports/`.

---

## Work Ledger

Entries before 2026-09-24 are in
[archive/2026-09-23-wave-one-ledger-and-partition.md](./flow-authoring-and-defensive-runtime-plan/archive/2026-09-23-wave-one-ledger-and-partition.md).
Their outcomes are settled and folded into `Current State`.

The 2026-09-24 entry for t095-t111 - eleven fixes and the three live runs that
followed them, each diagnosed to its cause - is in
[archive/2026-09-23-wave-one-ledger-and-partition.md](./flow-authoring-and-defensive-runtime-plan/archive/2026-09-23-wave-one-ledger-and-partition.md).
Its causes are all closed and its findings are in `Current State`.

The three entries for t114, t115 and t117 - the repair loop learning to
re-plan after looking, to see what a run survived, and to resolve a grant the
verification already claimed - are in
[archive/2026-09-24-t114-t117-repair-loop.md](./flow-authoring-and-defensive-runtime-plan/archive/2026-09-24-t114-t117-repair-loop.md).
All three are merged and pushed; what they changed is in `Current State`.

### 2026-09-24 - The furthest run yet, and the two things that stopped it

- Agent: supervisor, direct. Core `task/t116-grant-refusal-says-why`; web t114
  (worktree) and t115.
- The run: `run-muexhp0k-73172f73`, `everything-store-first-page-plus-earbuds`,
  deepseek-flash, 19 calls, $0.0233, 250s, verdict `failed` on
  `core.result.does_not_answer_request`.
- **How far it got, and it is the furthest yet.** A Flow was built
  (`flowCreated: true`, 12 actions: navigate, three clicks, a merge, a type,
  three more clicks, a second merge, two `extract_list`), it replayed end to
  end, and extraction returned **16 of 16 expected records with 64 of 64
  expected fields, 0 unexpected fields and 0 non-string values**. The value-shape
  defect t111 closed has stayed closed.
- **Why it failed, cause A: one intruder row shifts the whole list.** Positions
  1-6 matched exactly. Positions 7-12 are every one of them `kind: "moved"`,
  each observed exactly one position later - 7 at 8, 8 at 9, through 12 at 13 -
  with `fields: []`, so every field was right and only the position was wrong.
  Observed position 7 is therefore a row the expectation does not contain, and
  it pushes the real products down one, knocking the last three off the end.
  Those three then read as `values-differ` - expected "Oakhaven Sound Grove ...
  3.6" against observed "Aurelle Pods Fit ... 4.8" - which looks like three bad
  extractions and is one extra row counted once. `matchedRecords: 7`,
  `matchedInAnyOrder: 13`. Not yet fixed; the row is most likely a sponsored or
  interstitial card inside the same repeating container.
- **Why it failed, cause B: the repair never ran.** The three interventions
  `harnessRecovery` reports are not diagnoses - all three are
  `automation-studio.loop-verification.v1`. Two result checks ran and both
  correctly returned `does_not_answer`. The third activation, the repair, died
  at `llm.provider_resolution_failed`, `refusalRung: "gate"`. So neither t114's
  re-plan nor t115's `recovered_failures` was exercised at all.
- **And the record could not say why**, because `annotate.ts` caught the
  resolution failure with a bare `catch {}` and discarded it. It was not budget
  (19 of 48 calls, $0.0233 of $0.25) and not the grant's 600s run window (250s).
  Three changes close that: Core's grant claim path now throws a typed
  `AutomationStudioLlmExecutionGrantRefusal` carrying one of four codes -
  unavailable, scope mismatch, no longer valid, purpose invalid - with every
  sentence unchanged so no caller moves; `annotate` records it as
  `llmGate.cause` beside the step's own code, keeping only Core's vocabulary and
  never a thrown provider message; and the Lab carries it as
  `harnessRecovery.refusalCause`. The suspicion to test is `no_longer_valid`:
  the grant is minted against the Flow's execution digest, and a run that
  *creates* a Flow changes that digest itself.
- Also landed, web t114: `harnessRecovery.contextSections`. Core has written the
  recovery context's section names, byte counts and omission reasons on every
  run since the context existed, built so a test could require a section was
  carried without holding page data, and nothing read it. This run is where that
  bit - no artifact could say which evidence the repair would have been given.
- Validation: Core `tsc --noEmit` exit 0; `vitest run` over `runtime/recovery`
  and `runtime/llm` `Test Files 73 passed (73)`, `Tests 861 passed (861)`. Web
  `pnpm check` exit 0 through `pnpm task finish` for t114; test-runner
  `# tests 1338 # pass 1338 # fail 0`.
- Outcome: Partial - the run is the best yet and both of its causes are now
  named; cause A is not fixed, and cause B is instrumented rather than fixed.
- Next: re-run, read `refusalCause` to learn which grant refusal it is, and fix
  that; then the intruder row.

### 2026-09-24 - The extract campaign, and one cause behind five of six failures

- Agent: supervisor, with four read-only investigation workers and one
  implementation worker.
- **First passing run in the project's history.** `product-catalog-first-page`,
  `run-mueydi5d-8fad7bb7`: an instruction became a one-node Flow
  (`web.dom.extract_list`), the Flow replayed, and the dataset it produced was
  judged correct. 9 calls, $0.0070. Across every campaign before this, the
  number of instruction-built Flows that produced the right answer was zero.
- **And one cause behind almost every failure beside it.** Six
  `product-catalog` extract runs; five failed, and all five failed identically:
  `expectedRecords 8, observedRecords 23, matchedRecords 8`. Twenty-three is the
  whole three-page catalogue, 8 + 8 + 7. Every one of those runs read all eight
  page-one records perfectly - `presentFields == expectedFields`, no unexpected
  fields, no non-string values, including `text-variant`'s "16.00 USD" prices and
  `sparse-cards`' absent price and rating. Nothing was wrong with the read. The
  Flow took three pages for a request that said one.
- **Why.** `detectPagination` proposed `maxPages` as the count of the pager's
  numbered controls, or the domain's ceiling when it had none. How a list
  continues is a fact about the page; how much of it to take is a fact about what
  was asked for, and a proposal that answers the second turns "the first page"
  into "every page" with nobody choosing. The run that passed is the one whose
  model authored no pagination block at all.
- Fixed: a proposal now asks for the page in front of it and names its mode
  explicitly rather than leaning on what an omitted one happens to mean. A read
  that wants more pages says so, and one stopped by the bound reports
  `truncated`, so a Flow that should have taken more says it took fewer rather
  than quietly answering short.
- **The corpus's most common event is a rejection, and it is model thrash.**
  Across 33 runs the build-loop result codes are led by
  `web.action.rejected.no_repeating_structure` at 39, against 19
  `web.action.succeeded`. The worst, `run-mueyx0xe-e4615f3c` on
  `product-catalog` `text-variant`, called `web.detect_repeating_structure`
  twenty-eight times: refused twenty-seven, answered once, 38 provider calls in
  all. So the model is calling the detection tool rather than guessing selectors
  at an extract node, which is the right tool - it just keeps being told no.
  **Not a detection defect**, on the evidence: the same task in the earlier
  campaign (`run-mueyh9ey-5ce143dc`) was refused five times on the same page and
  got there, and the plain `first-page` run found its list in one call. The page
  has a readable run and detection finds it; the variance is the model's.
  **And the guard that should bound it is a streak, not a total.** Core does
  count a refused look as no progress - `automationStudioLlmEvidenceLookWasRefused`
  is true for an `observe` tool answering `{ok:false}`, which is exactly what a
  refused detection returns - and trips at `maxStepsWithoutProgress`, 24. But
  `progressed()` resets the count to zero on any answered call, so twenty-seven
  refusals with three successes among them never come near it. The streak is
  bounded and the total is not. A build can be told "there is no list there"
  indefinitely as long as it occasionally looks at something else.
  **And the data will not support a bound, which is the finding.** Counting
  refused detections per run against its verdict: passing runs used 0, 0, 1, 1
  and **15**; failing runs used 1, 2, 2, 5, 10 and 27. They overlap almost
  completely, and the passing run at 15 sits above four of the six failures. So
  there is no total that separates a build working its way to an answer from one
  that is only asking again - a bound of 12 would have killed a run that went on
  to pass. The waste is real (27 refusals cost that build most of its 38 calls)
  but a count is the wrong discriminator, and picking one from the worst run
  alone would have been a guess dressed as evidence. What would separate them is
  whether the *target* changed between asks, which nothing currently records.
  `bootstrap.invalid_subflows` is the same shape, five times in that one run.
- **`everything-store` is a different failure, and it is not extraction.** Its
  instruction says "narrow the results to Brightaisle Plus items". The Flow
  searched and correctly excluded sponsored placements - 20 cards on the page,
  16 rows returned - and never clicked the Plus rail, so it read the unnarrowed
  list: `matchedRecords 7`, `matchedInAnyOrder 13`, the rest displaced. An
  earlier reading of this as "one intruder row shifting the list by one" was
  wrong; expected 12 was observed at 15, not 13. Whether the model was ever shown
  the Plus control cannot be answered from any artifact, because nothing records
  what a packet contained - which is now being fixed.
- Validation: extension `node apps/extension/scripts/test-extension.mjs`
  `# tests 747 # pass 747 # fail 0`; `tsc --noEmit` on the extension exit 0.
- Outcome: Partial - one cause fixed and pending re-measurement, one named and
  open, one unanswerable until the packet record lands.
- **An operational mistake worth writing down.** The first attempt at this
  campaign aborted after 5 tasks because Core source was edited while it ran,
  leaving Core's dist stale; the Lab's own guard caught it and refused to
  continue - "Nothing measured here is a product result until that is fixed."
  That guard is correct and cost nothing but time. Work during a live campaign
  belongs in a worktree, which is what the rest of this session used.

## Open Questions
- **A run does not record the parameters of the Flow it built.** `flow-lane.json`
  publishes `flowShape` and `actionTypes`, and no Flow document is persisted
  under `test-runs/`, so the pagination cause behind five of six failures on
  2026-09-24 had to be *inferred* from record counts rather than read from the
  node. The inference was solid - 23 is exactly the three-page catalogue, and
  the run that passed took 8 - but it should not have been an inference. A
  campaign that cannot say what the model actually wrote can only diagnose
  causes that happen to leave an arithmetic signature. Recording the authored
  parameters, screened the way the repair context already screens step
  parameters, is what would have answered it in one read.
- **`product-catalog-first-page` passed twice and failed once** on the same
  code, because the model sometimes copies the pagination proposal into the node
  and sometimes does not. Run-to-run variance of that size means a single run is
  not evidence about a task, and a pass rate needs repeats before it means
  anything.

- Does the dry run reset the page, the workspace, or the whole browser context?
  Cheapest sufficient reset wins; d2 and d3 should settle what is available.
- Is "exploratory, do not keep" a model decision or inferred from whether a later
  node depends on the state it produced? Inference is safer but harder to
  explain; the model's own mark is honest but can be forgotten.
- Where does the draft Flow live during a build — in the run's state, or as a
  real unsaved Flow resource? The second gives editing and replay for free if the
  resource layer allows an unsaved draft.
