# Flow Authoring And Defensive Runtime

Status: Active
Status detail: The nineteen-task extract lane measured twice on 2026-09-24: 9 stable passes, 6 stable failures, 4 tasks flipping between identical runs. Nine one-node extractions are correct to the field on hard pages; multi-step automation still is not. Five causes fixed (t116-t123), three of them not yet measured by a lane.
Created: 2026-09-22
Last updated: 2026-09-24
Owner: Senior supervisor agent
Scope: Make a model-authored Flow faithful to what the model actually did, and make a Flow's execution survive a site we do not control. Covers the build loop's authoring model, the draft Flow and its edit and dry-run tools, branch and loop authoring, the runtime's deterministic recovery ladder, and the adversarial fixture conditions that measure both. It deliberately does not cover the real-site lane itself, the campaign measurement, new extraction capabilities, or the Week 2 exit criteria, which stay in their own documents.
Paired document: `F:\!FluxIQ\docs\working\flow-authoring-and-defensive-runtime-plan.md`
Related: [week2-exit-plan.md](./week2-exit-plan.md) (the campaign this defers), [mvp-week2-automation-loop-plan.md](./mvp-week2-automation-loop-plan.md) (the adaptation loop this hardens), [AGENTS.md](../../AGENTS.md)

---

## Current State

**Superseded for measurement on 2026-09-24.** The user replaced corpus-wide lane
runs with a strict one-run, one-full-debug, one-fix loop on complex multi-node
scenarios only; that loop, its debug protocol and the MVP exit criteria are in
[language-driven-flow-loop-plan.md](./language-driven-flow-loop-plan.md). This
document stays active as the **design backlog** — workstreams A to D below are
the fixes that loop draws from. Do not run the extract lane from here.

**Scope, set by the user on 2026-09-22 and binding.** The only path that counts
is: a person writes an instruction, the model explores the live page, and the
Flow it builds then runs deterministically and produces the right answer.
Recording-built Flows are not tested, measured, or reported as progress.

**Where the product is, measured 2026-09-24 over two full runs of the
nineteen-task extract lane.** Both read 11 of 19, and that number is misleading:
task by task it is **9 stable passes, 6 stable failures, and 4 tasks that flip
between identical runs**. About one task in five changes verdict on unchanged
code, so a single lane run cannot tell a fix from noise. Report the stable sets.

**What works, and it is real.** Nine tasks pass in both runs, correct to the
field: `social-scheduler` 280 records and 1120 fields all matched in 5 calls,
`social-inbox` 25 and 125, `data-table` including its columns reordered,
`product-catalog` with price and rating absent on some cards, with the real
image in `data-src`, and with prices reading "16.00 USD". The pages are hard.

**What that is not.** All nine are **one-node Flows** -- a single
`web.dom.extract_list` on a page that is already the right page. Nothing
navigates, searches, clicks or filters. Single-step extraction from difficult
pages works; **multi-step automation does not**, and `everything-store` -- search,
then apply a filter, then extract -- has still never produced a correct answer.
`data-table-inventory-large` also passes on count alone (`presentFields: 0`,
`matchedRecords: 0`), so it should not be counted as a full pass until that is
understood.

**The six stable failures, each diagnosed to a named cause.**

1. `property-listings-newest-homes` and its `agent-withheld` variant: 10 of 10
   rows, **0 matching**, because the `address` column reads the listing's URL
   rather than its address text. `product-catalog` shows the same shape
   intermittently, reading `$49.00` for `rating`. A column mapped to the wrong
   element, and the largest open cause.
2. `admin-console-customer-book`: 19 records of 240, first row `CUS-0005`. Fixed
   in t121 but **merged after both lanes ran**, so unmeasured.
3. `company-directory-register-page` and `data-table-inventory-empty`: the
   subflow loop below. Fixed in t122/t123, also **merged after both lanes**, so
   unmeasured.
4. `product-catalog-photos`: the Lab's oracle passes the dataset and Core's own
   verification refutes it. The result check has now been seen wrong in both
   directions, and since t117 a false refutation triggers a real repair.

**Five causes found and fixed today, each proven or explicitly not.**

- **The page budget.** The grammar named `maxPages` and its ceiling and never
  said what the number does, so the model wrote the count it could see. Proven
  by a pair: "the first page" and "across all of its pages" produced the
  identical node, `paginate: { maxPages: 3 }`, one failing and one passing; with
  the clause in, `paginate: null` and `maxPages: 3`, 8 of 8 and 23 of 23. The
  clause needed room Core's 600-character parameter description did not have,
  and Core truncates silently, so that bound moved to 700.
- **A silent subflow rejection**, and four of the eight failures.
  `buildSubflow` returned no subflow and **no issue** when the node list was not
  under `nodes`, `steps` or `actions`; the caller then told a model that had
  written an array that subflows "must be an array". It rewrote the same plan
  15, 16, 24 times. Three distinct refusals now.
- **A refused attempt is not progress.** The loop cleared its no-progress count
  on a refused action, bounded instead by a signature that only catches an
  identical retry. `company-directory` spent 31 of 45 steps on
  `target_unobserved`. The repeat cache keeps its rule; progress now asks
  whether anything happened.
- **A declared row count is read.** A virtualised grid says `role="grid"` and
  `aria-rowcount`; only the ARIA feed pattern was read.
- **A grant refusal names itself**, and a repair can resolve a grant the
  verification already claimed -- which is why "a clean run that answers wrongly
  is repairable" had never once produced a repair.

**Three pagination theories were wrong first**, each diagnosed from record
counts alone: the detector's proposal, the worked example's `maxPages: 5`, and
the node's "across pages" description. What settled it was recording the
parameters the model actually wrote, then running two opposite instructions as a
pair. **The instrumentation should have come before the first fix, not after the
third.**

**Also landed:** the Lab records a Flow's authored node parameters and the
recovery context's section names; Core exports its parameter screen so nothing
downstream copies it; and the Lab's build lock survives a crash rather than
deadlocking the next campaign on a reused pid.

**Next.** Re-run the lane **with repeats** -- the flip rate makes single runs
uninformative -- to measure t121, t122 and t123, which no lane has yet seen.
Then the column mis-mapping, which is the largest stable cause. Then
`everything-store`, the multi-step case that has never worked.

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

### 2026-09-24 - The extract lane measured twice, five causes fixed, and a flip rate

- Agent: supervisor, direct, with four read-only investigation workers and two
  implementation workers.
- Changed: Core t116-t123 and web t114-t123, all merged and pushed in both
  repositories.
- **Result.** Two full runs of the nineteen-task extract lane, either side of
  four fixes, both 11 of 19. Task by task: 9 stable passes, 6 stable failures, 4
  flips. The flip rate is the finding -- one task in five changes verdict on
  unchanged code -- so the pass count was hiding both the fixes that worked and
  the ones that did not.
- **Causes fixed:** the undefined page budget (proven by a controlled pair of
  opposite instructions); a silent subflow rejection behind four of eight
  failures; a no-progress guard that a refused action cleared; a declared row
  count nothing read; a grant a repair could not re-resolve; a build lock that
  deadlocked on a reused pid after a crash.
- **Wrong first, three times**, all on pagination and all diagnosed from record
  counts: the detector's proposal, the example's `maxPages: 5`, the node's
  description. Each was shipped or drafted before the authored parameters were
  recorded. The instrumentation was the fix that mattered.
- Validation: Core `pnpm check` observed passing through `pnpm task finish` for
  t116, t117, t118, t119, t122 and t123; web `pnpm check` likewise for t114,
  t115, t119, t120, t121 and t122. Domain suite `# tests 779 # pass 779 # fail
  0`; extension `# tests 749 # pass 749 # fail 0`; test-runner `# tests 1343 #
  pass 1343 # fail 0`; Core `runtime/flow-bootstrap` + `runtime/llm` `61 files,
  693 tests, 0 failures`; `structure-audit: passed` in both repositories. Live:
  two campaigns of 19 tasks, 275 and 281 provider calls, $0.223 and $0.217.
- Outcome: Partial - five causes closed, three of them unmeasured because their
  fixes merged after the last lane ran.
- Not verified: t121, t122 and t123 have not been through a lane; the column
  mis-mapping has no fix; `everything-store` has still never produced a correct
  answer; `data-table-inventory-large` passes on count without comparing a field.


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

The entry for `run-muexhp0k-73172f73` - the furthest run of that morning and
the two causes that stopped it - is in
[archive/2026-09-24-t114-t117-repair-loop.md](./flow-authoring-and-defensive-runtime-plan/archive/2026-09-24-t114-t117-repair-loop.md).

The 2026-09-24 entry for the extract campaign - the first passing run and the
cause behind five of six failures - is in
[archive/2026-09-24-t114-t117-repair-loop.md](./flow-authoring-and-defensive-runtime-plan/archive/2026-09-24-t114-t117-repair-loop.md).
Its pagination conclusion was later falsified; see `Open Questions`.

## Open Questions
The day's full diagnosis -- the four causes, the three falsified pagination
theories, and the instrumentation that settled them -- is in
[archive/2026-09-24-extract-lane-diagnosis.md](./flow-authoring-and-defensive-runtime-plan/archive/2026-09-24-extract-lane-diagnosis.md).
The conclusions are in `Current State`.

- Does the dry run reset the page, the workspace, or the whole browser context?
  Cheapest sufficient reset wins; d2 and d3 should settle what is available.
- Is "exploratory, do not keep" a model decision or inferred from whether a later
  node depends on the state it produced? Inference is safer but harder to
  explain; the model's own mark is honest but can be forgotten.
- Where does the draft Flow live during a build — in the run's state, or as a
  real unsaved Flow resource? The second gives editing and replay for free if the
  resource layer allows an unsaved draft.
