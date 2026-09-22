# d5-existing-coverage

Read-only coverage audit for two proposed ideas, against the working documents
and architecture commitments already in `F:\!FluxIQWebExtension` and `F:\!FluxIQ`.
Nothing was changed. Path prefix `AS/` is Core's
`packages/fluxiq/src/programs/automation-studio/`.

- **Idea A — exploration is the recording.** The model explores by building the
  Flow incrementally, can revise, delete and re-test nodes it has already
  placed, and tests the node settings it chose in flight, so that what it
  explored and what it saved are the same artifact.
- **Idea B — defensive runtime.** A failing node first re-checks the recorded
  expected-state / state-digest and retries on that basis, and only escalates to
  the model after that ladder is exhausted; the model authors Flows with more
  direct control of timeline and branches than a human recorder has.

## Outcome

Neither idea is wholly new and neither is wholly covered.

- **Idea A's mechanism already exists, in the wrong entry point.** Recording an
  exploration step by step, hashing page state before and after each step,
  detecting reversals and reducing the trace to a replayable minimum is built,
  landed and live-proven — but only inside *recovery* exploration, and its output
  is thrown away. In the *build* entry point the model still writes the whole
  Flow script once, at `complete`, from memory. Making exploration the recording
  for a build is genuinely new work; the reducer, the digest port and the step
  recorder are reusable as they stand.
- **Idea B's second half is largely built and live-proven.** The model already
  authors routing rules, Subflows and in-Subflow branches in the Flow script, and
  one model-built Flow has replayed down two different routes with zero provider
  calls. Its first half — a deterministic expected-state/digest re-check and
  retry before the model is asked — is **absent**, and two recorded architecture
  decisions point the other way: `STATE_MISMATCH` is declared non-retryable, and
  target resolution is explicitly documented as never waiting, polling or
  retrying.

Three places would reverse a decision already recorded. They are listed in the
last section and must be taken to the user rather than assumed.

---

## Row-by-row coverage

`covers` = the idea's substance is already planned or built. `partially covers` =
part of it is, with a named gap. `conflicts with` = the idea as stated would
reverse what is written.

### Idea A — exploration is the recording

| # | Existing step or commitment | Verdict | Quote | Reference |
|---|---|---|---|---|
| A1 | Phase 2.5, exploration reduction | **partially covers A** | "Adaptations record observed and expected state and `failureSignature` (defect 5); exploration reduction; a durable deterministic-path patch inserting real action nodes" | `docs/working/mvp-week2-automation-loop-plan.md:197` |
| A2 | The 2.5 reduction is built but unwired | **partially covers A** (gap) | "the reduction is thrown away (`annotate.ts:302-308`)" | `docs/working/week2-exit-plan/reports/w2x-exit-loop-gap-audit.md:792` |
| A3 | Exploration step recorder with per-step state digest and per-step argument | **covers A's recording mechanism** | "The exploration runner now records, per action that ran, a caller-supplied state digest and the argument the action was given" | `docs/working/mvp-week2-automation-loop-plan/reports/w2-5e-exploration-state.md:14` |
| A4 | The digest port, live-proven in Chromium (t025) | **covers A's re-test mechanism** | "Core can now recognize a page-state reversal and publish the remaining successful action as replayable." | `docs/working/mvp-week2-automation-loop-plan/reports/w2-t025-live-state-digest.md:9` |
| A5 | P17: the Flow script now tells the model to keep a step per exploration change | **partially covers A** | "Live, n=1: the created Flow has one acting step for each change exploration made, in the same order." | `docs/working/week2-exit-plan/reports/w2x-created-flow-fidelity.md:27` |
| A6 | P17 cause 2, unfixed: the plan resolver forgets controls exploration removed | **argues for A** (a defect A would remove structurally) | "So a created Flow cannot currently name a control that exploration itself removed." | `docs/working/week2-exit-plan/reports/w2x-created-flow-fidelity.md:135` |
| A7 | N1 / slice CF+DL: revise an existing Flow, `keep <ref>`, retire by omission | **partially covers A's revise/delete** | "`step: keep <ref>` keeps a step … A block left out is retired." | `docs/working/week2-exit-plan/reports/w2x-existing-flow-and-repair-design.md:131,135`; plan row `week2-exit-plan.md:152` |
| A8 | N4 / CU2: existing-Flow revision panel and structural diff | **partially covers A** (the person's view of a revision) | "CU2: existing-Flow revision panel and structural diff … waiting" | `docs/working/week2-exit-plan.md:155` |
| A9 | Refusal feedback lets the model correct a completed plan inside one build | **partially covers A's "revise what it placed"** | "**A completed plan is refused.** The model is told each issue at its path." | `docs/working/mvp-week2-automation-loop-plan/reports/w2-creation-loop-keeps-going.md:32` |
| A10 | `trialAutomationStudioFlowChange` — a candidate Flow is run before it is trusted | **partially covers A's "test in flight"** | "It runs a candidate Flow on a throwaway copy." | `docs/working/mvp-week2-automation-loop-plan/reports/w2-c6-trial.md:13` |
| A11 | L1: the created-Flow lane replays what it built, in the same invocation | **partially covers A's "test in flight"** (whole-Flow, post-build) | "`run-mubmrcyv-beaa2a6b` build 2 = observed 2, repair applied, in-run replay 0 calls" | `docs/working/week2-exit-plan.md:144` |
| A12 | The first loop increment needs no new authoring contract | **covers A's feasibility claim** | "Action targets, expected state, retries and wiring are already expressible — and revertible — as graph operations" | `docs/working/mvp-week2-automation-loop-plan.md:177` |
| A13 | Extraction is recordable and compiles to ordinary Flow nodes | **covers A's feasibility claim** | "extraction is recordable and compiles to ordinary Flow nodes" | `docs/working/first-class-data-extraction-plan.md` (Scope header, line 8) |
| A14 | Core: a recording is raw material, not a draft Flow | **conflicts with A** (artifact model) | "Recording / Raw captured source timeline and state. It is not a draft Flow." | `F:\!FluxIQ\docs\working\recording-proposal-generator-plan.md:56` |
| A15 | Core: proposals are an explicit generation workflow, never an automatic side effect | **conflicts with A** (if exploration saves as it goes) | "This plan shifts proposals from an automatic post-recording side effect into an explicit generation workflow." | `F:\!FluxIQ\docs\working\recording-proposal-generator-plan.md:31` |
| A16 | Model output is untrusted proposal data, manual review mandatory | **conflicts with A** (if the explored artifact is the saved artifact) | "LLM output is untrusted proposal data; manual review, revision-bound apply, and zero-LLM deterministic replay remain mandatory for every accepted result." | `docs/working/llm-production-automation-plan.md:65` |
| A17 | A revision shows the model parameter names, never values | **constrains A** | "its parameter **names only**, never values, because resolved steps hold selectors (t020's rule)" | `docs/working/week2-exit-plan/reports/w2x-existing-flow-and-repair-design.md:123` |
| A18 | Storing the model's own step descriptions on the Flow was considered and declined | **conflicts with A** (A implies storing them) | "Storing the model's own step description at build time would help, but it would put model prose on the Flow. I did not design that in." | `docs/working/week2-exit-plan/reports/w2x-existing-flow-and-repair-design.md:544` |
| A19 | Entry point 3 (edge case in an existing Flow) is blocked at the blank-Flow check | **partially covers A** (a gap A depends on) | "`service.ts:1839` raises `flow_bootstrap.blank_target_required`" | `docs/working/week2-exit-plan/reports/w2x-exit-loop-gap-audit.md:394` |
| A20 | Testing Lab lane model: recording lane, Flow lane, created-Flow lane | **partially covers A** (a new artifact needs a lane) | "Recording lane and Flow lane" | `docs/architecture/testing-facility.md:996` |

### Idea B — defensive runtime

| # | Existing step or commitment | Verdict | Quote | Reference |
|---|---|---|---|---|
| B1 | The recovery ladder, in priority order | **partially covers B's ladder** | "Failed attempts pass through the recovery ladder in priority order: configured failed-route path, approved runtime patch, graph local recovery reroute, then LLM diagnosis fallback." | `F:\!FluxIQ\docs\architecture\automation-studio.md:482` |
| B2 | L5, deterministic first | **covers B's escalation rule** | "**L5. Deterministic first is enforced.** The classifier gates the LLM: no provider call when a deterministic path or a known adaptation applies" | `docs/working/mvp-week2-automation-loop-plan/archive/settled-decisions.md:26` |
| B3 | `deterministic-diagnosis.ts`, four answers, one reaches a model | **covers B's escalation gate** | "it resolves a failure into exactly one of four answers — `deterministic_recovery`, `known_adaptation`, `manual_intervention`, `model_required` — and only the last reaches a model" | `docs/working/mvp-week2-automation-loop-plan/reports/w2-2-diagnosis-plan.md:35` |
| B4 | Recovery budgets bound retries | **covers B's bounding** | "Recovery budgets can cap retries per action, recovery attempts per subflow, reroutes per run, and adaptation/LLM attempts per run" | `F:\!FluxIQ\docs\architecture\automation-studio.md:487` |
| B5 | The expectation seam: `expectedState` is evaluated by the host after a successful action | **partially covers B's first rung** | "Every web output node declares an `expectedState` parameter" | `docs/architecture/web-capabilities.md:514` |
| B6 | …and a rejection **fails** the attempt rather than triggering a re-check | **conflicts with B's first rung** | "A rejection there fails the attempt: its status and route become `failed`" | `F:\!FluxIQ\docs\architecture\automation-studio.md:561` |
| B7 | `STATE_MISMATCH` is declared non-retryable in the closed set | **conflicts with B's first rung** | "`STATE_MISMATCH` / `web.validation.state_mismatch` / `unexpected_state` / no / `verification`" | `docs/architecture/failure-taxonomy.md:27` |
| B8 | The `retryable` flag exists and means exactly what B needs | **partially covers B** (nothing consumes it as a retry trigger) | "`retryable` answers only Core's question — whether retrying the same action unchanged can succeed without a person or a Flow edit." | `docs/architecture/failure-taxonomy.md:45` |
| B9 | No acting verb waits, polls or retries at target resolution | **conflicts with B** | "No acting verb waits before resolving. `resolveTarget` runs its strategies and then scoring once and throws; nothing retries and nothing polls." | `docs/architecture/element-identity.md:202` |
| B10 | …the recorded answer is an authored wait step ahead of the action | **partially covers B** (defence at author time, not run time) | "When a proposal is appended to a Flow, the claim becomes the recorded node's `parameterValues.expectedState`." | `docs/architecture/extension-client.md:955,1003` |
| B11 | `temporary_wait_retry` exists as a patch kind | **partially covers B** (order reversed: model first, retry second) | "a `temporary_wait_retry`'s effect is the rerun itself — running the failed node again" | `docs/working/mvp-week2-automation-loop-plan/reports/d2-edit-recovery.md:210` |
| B12 | Runtime patches can express wait/retry adjustments | **partially covers B** | "It supports bounded action sequences, wait/retry adjustments, target overrides, recovery subflow calls, and temporary reroutes." | `F:\!FluxIQ\docs\architecture\automation-studio.md:639` |
| B13 | Core's roadmap already names a transient-spinner wait/retry as runtime recovery | **partially covers B** (as a model-driven recovery, not a pre-model rung) | "a transient spinner requires a wait/retry." | `F:\!FluxIQ\docs\working\adaptive-flow-training-roadmap.md:290` |
| B14 | …and "insert verification/retry node" as a learned patch | **partially covers B** | "insert verification/retry node;" | `F:\!FluxIQ\docs\working\adaptive-flow-training-roadmap.md:305` |
| B15 | The model authors routing, Subflows and branches in one Flow script | **covers B's second half** | "The Flow script, one format for create, repair and improve. A route is a block" | `docs/working/mvp-week2-automation-loop-plan/reports/w2-routing-and-subflows.md:22` |
| B16 | In-Subflow branch ports, fixed live | **covers B's second half** | "In-subflow branches exist (`on <port>: go to <label>`)" | `docs/working/mvp-week2-automation-loop-plan/reports/w2-routing-and-subflows.md:16` |
| B17 | N2 / slice CG: a repair that edits Flow structure, with `request_revision` and `step_missing` | **covers B's second half for repair** (waiting) | "CG: a repair that edits Flow structure … waiting" | `docs/working/week2-exit-plan.md:153` |
| B18 | P20: recovery cannot express "close the dialog, then press" | **partially covers B** (in flight on t071) | "Recovery cannot express \"close the dialog, then press\": its patches are a target override or a wait and retry" | `docs/working/week2-exit-plan.md:131` |
| B19 | Recover and Resume are unreachable today on any granted run | **partially covers B** (a gap B depends on) | "**Recover and Resume cannot happen in production Core for any model-written repair**" | `docs/working/week2-exit-plan.md:38` |
| B20 | Exit criterion 3 already demands one Flow, two routes, zero calls | **covers B's second half as a measured criterion** | "matches 14 of 14 on both routes with zero calls" | `docs/working/week2-exit-plan.md:35` |

---

## Already done and reusable

These exist in code, are landed on `dev` or on an integrating branch, and a new
plan should build on them rather than restate them.

1. **The exploration step recorder and its state-digest port.**
   `AS/recovery/exploration-state/` (`digest-source.ts`, `step-record.ts`,
   `recorder.ts`, `reduction-review.ts`) plus the web side,
   `domain/src/runtime/llm-evidence/state-digest.ts`, bound as
   `captureStateDigest` on `WebAutomationLlmEvidenceRuntime`. It records a
   before/after digest and the argument for every exploration action
   (`w2-5e-exploration-state.md:14`).
2. **The exploration reducer.** `AS/exploration-reduction/`, which drops
   inspections and reversed presses and reports `stateChainIntact` and
   `replayable`. Live-proven in Chromium on 2026-09-20: four recorded steps,
   "inspection and the two reversed presses are dropped, leaving one press"
   (`w2-t025-live-state-digest.md:28-36`).
3. **The Flow script authoring format**, one format for create, repair and
   improve, with `subflow <label>:` blocks, `when:` conditions and
   `on <port>: go to <ref>` branches; and the plain-line dialect the model
   actually writes (`w2-easy-model-output.md`). Idea B's "more direct control of
   timeline and branches than a human recorder has" *is* this, and it is proven:
   one model-built Flow replayed down two routes, 14/14 each, zero calls
   (`w2-routing-and-subflows.md`).
4. **The deterministic-first escalation gate.** `deterministic-diagnosis.ts` with
   its four resolutions and a drift test that walks every failure class
   (`w2-2-diagnosis-plan.md:33-51`). Idea B's "only escalates to the model after
   the ladder is exhausted" is already the enforced rule; what is missing is a
   rung, not the rule.
5. **The recovery ladder and its budgets**, including the `allowLlmDiagnosis`
   switch that removes the model rung entirely
   (`g-core-ladder-llm-off.md`; Core `automation-studio.md:482-490`).
6. **The expectation seam.** `expectedState` on every web output node, evaluated
   in the browser through `web.dom.assert`, with three honesty rules — it never
   throws, a condition that could not be judged is not a condition that failed,
   and no codes are written locally
   (`docs/architecture/web-capabilities.md:500-560`).
7. **The change trial.** `trialAutomationStudioFlowChange` runs a candidate Flow
   on a throwaway copy and returns a verdict with `resumable` and `resumeFrom`
   (`w2-c6-trial.md`). This is the existing answer to "test it before you trust
   it", and idea A's in-flight node test should extend it, not duplicate it.
8. **The build's self-correction loop.** Refused plans, malformed replies and
   repeated tool calls are fed back with the issue at its path and the shape the
   parameter accepts, and the build continues
   (`w2-creation-loop-keeps-going.md`).
9. **The created-Flow replay lane.** `--replays` on instruction tasks, plus
   keyless `lab replay`, proven at `build.providerCalls == observed.calls` and
   0 calls on replay (`week2-exit-plan.md:144`).

## Planned but not built

1. **N1 / CF+DL — improve an existing Flow** (`week2-exit-plan.md:152`, in flight
   on t072). Designed to file:line in
   `w2x-existing-flow-and-repair-design.md:99-190`: `revise?: { fromRunId? }`,
   the Flow rendered back to the model as a script, `step: keep <ref>`,
   retirement by omission, `mode: "extend"`, `revision/diff.ts`,
   `revision/apply.ts`, `revision/revert.ts`. This is idea A's "revise and delete
   nodes it has already placed", **between** generations rather than during one.
2. **N2 / CG — a repair that edits Flow structure** (`week2-exit-plan.md:153`,
   waiting). Adds the no-repair reason `step_missing`, the plan action
   `request_revision`, `metadata.revisionNeeded` on the run detail, and
   `revision/scope.ts` to keep a revision inside what the failed run touched.
3. **N4 / CU2 — the revision panel and structural diff**
   (`week2-exit-plan.md:155`, waiting).
4. **P20 — wire the reduced exploration path into a durable repair**
   (`week2-exit-plan.md:131`, in flight on t071). Its brief says explicitly:
   "when exploration reaches the expected state, its reduced replayable path (for
   example 'close the dialog, then press') becomes an `insert_deterministic_path`
   patch" (`week2-exit-plan.md:257`). This is the closest existing step to idea A,
   and it is scoped to the recovery entry point only.
5. **L6 — Resume on granted runs** and **L7 — the 2.9 metrics**
   (`week2-exit-plan.md:149-150`, waiting). Idea B's ladder cannot be measured
   until `providerCallCount` and `adaptationsExercised` land on every run.
6. **Phase 2.5's durable deterministic-path patch** — designed and built as a new
   adaptation kind in `w2-5c-deterministic-path.md`, with one safety gap handed
   back and `approvedRuntimePatchNodeIds` still produced by nothing.
7. **Phase 5 of the LLM production plan, existing-Flow editing**, still listed as
   pending (`llm-production-automation-plan.md`, "Not done").

## Absent — genuinely new work

1. **Incremental Flow construction during a build.** Nothing anywhere builds the
   Flow as exploration proceeds. Today the model explores through tools and then
   emits the whole script once at `complete`, judged by
   `checkAutomationStudioFlowBootstrapCompletion`
   (`w2-authoring-contract.md:22-40`). Every revision mechanism that exists —
   `keep <ref>`, retirement by omission, the diff — operates on a *finished* Flow
   in a *later* generation.
2. **A node the model placed being executed and re-tested in flight,
   individually.** The trial (A10) runs a whole candidate Flow after a patch is
   proposed; the created-Flow lane replays the whole Flow after the build.
   Nothing executes one just-authored node, observes it, and lets the model amend
   that node before writing the next.
3. **Unifying the exploration trace and the saved artifact.** The trace is
   `AutomationStudioLlmEvidenceLoopTrace` on the evidence loop; the artifact is a
   bootstrap adaptation carrying a plan. They are different types with different
   owners, and Core "does not keep the model's raw completion"
   (`w2x-created-flow-fidelity.md`, step-by-step table note). Idea A's "the same
   artifact" does not exist in any form today.
4. **Handle history across exploration.** A created Flow cannot name a control
   that exploration itself removed, because `target-packets.ts` keeps only each
   page's newest packet (`w2x-created-flow-fidelity.md:116-145`). Idea A removes
   the need for this by recording the step when it happens; either way, the fix
   is unowned and unbriefed today.
5. **A deterministic expected-state re-check as a recovery rung.** The ladder's
   four rungs are failed-route path, approved runtime patch, reroute, model. None
   re-evaluates `expectedState` after a bounded wait. The expectation is
   evaluated exactly once, immediately after a successful action, and a rejection
   fails the attempt outright (Core `automation-studio.md:556-567`).
6. **A state digest at Flow runtime.** `captureStateDigest` is bound on the
   LLM-evidence runtime only; the host runtime binds `captureStateSnapshot`,
   `inspectStateDiff` and `expectationEvaluator` and no digest
   (`domain/src/runtime/host-runtime.ts:97,136,142`, read in source). Idea B's
   "re-checks the recorded state-digest" needs the digest to exist on an attempt,
   which it does not. The port is reusable; the binding and the per-node recorded
   digest are new.
7. **Anything consuming the `retryable` flag as a retry trigger.** The flag is
   produced, bounded and stored for all fifteen codes, and the documented
   consumer is "Core's question" only. No document names a component that reads
   it and retries.
8. **Documentation.** `docs/architecture/` contains no description of the
   exploration loop, the state digest, the reduction, or the recovery ladder from
   this repository's side: grepping `exploration` across `web-capabilities.md`,
   `extension-client.md`, `page-evidence.md` and `element-identity.md` returns one
   incidental hit (`page-evidence.md:185`). A new plan that changes either area is
   also writing the first architecture page for it.

---

## Where idea A or B would contradict a decision already recorded

These are the reversals to put to the user explicitly. None is fatal; each is a
decision someone made on purpose, with a reason written down.

1. **"A recording is not a draft Flow" (Core product decision).**
   `F:\!FluxIQ\docs\working\recording-proposal-generator-plan.md:56` defines a
   recording as "Raw captured source timeline and state. It is not a draft Flow",
   and the plan's whole purpose is to stop a recording turning into a proposal
   automatically (`:31-33`). Idea A's phrasing — "what it explored and what it
   saved are the same artifact" — collapses exactly that distinction. The
   reconciliation that costs nothing: apply A to the *model's* exploration only
   and keep the human recording path as raw material. If A is meant to cover the
   human recorder too, that plan (currently `Paused`) must be re-opened and
   re-decided, not silently overridden.

2. **"Model output is untrusted proposal data; manual review is mandatory."**
   `docs/working/llm-production-automation-plan.md:65` and `:99`. If exploration
   writes directly into the saved Flow as it goes, there is no inert proposal for
   a person to review before it becomes canonical. Core's apply gate already
   sends an `extend` to manual review (`training-modes.ts:337-350`, cited in
   `w2x-exit-loop-gap-audit.md:400-405`), so the seam exists — but idea A needs an
   explicit answer to "what is reviewed, and when". The honest options are (a) the
   incremental artifact is a draft that still takes one review at the end, or
   (b) review moves per step. Only (a) preserves the recorded decision.

3. **"Storing the model's own step description would put model prose on the Flow.
   I did not design that in."** `w2x-existing-flow-and-repair-design.md:544`. An
   incrementally built Flow almost certainly carries the model's intent per step,
   because that is what makes a later revision legible. A small reversal, but it
   was taken deliberately and should be re-taken deliberately.

4. **`STATE_MISMATCH` is `retryable: no`.**
   `docs/architecture/failure-taxonomy.md:27`, and Core's parser forbids six
   categories from ever being retryable (`:45-53`). Idea B's first rung — re-check
   the expected state and retry on that basis — needs a state mismatch to be worth
   retrying. Two ways out, and they differ in cost: either the taxonomy row
   changes, which by `AGENTS.md` is a wire-protocol change that must land across
   protocol types, background routing, gateway mappings, capabilities, tests and
   architecture docs at once; or the re-check happens *before* the record is
   built, inside the expectation evaluation itself, so the attempt never produces
   a `STATE_MISMATCH` it would have retried. The second reverses nothing.

5. **"No acting verb waits before resolving … nothing retries and nothing polls."**
   `docs/architecture/element-identity.md:202-204`. This is a deliberate design
   with its own stated answer: a wait step authored ahead of the action, which a
   recording proposes automatically (`late-target-wait.ts`). Idea B's ladder
   reintroduces run-time waiting at a different layer. That may not be a true
   contradiction — the ladder sits above the verb, in the executor, not inside
   `resolveTarget` — but the architecture page says "nothing retries" without
   qualification and would have to be amended to say where retrying now lives.

6. **The ladder's rung order is documented and tested.** Core
   `automation-studio.md:482-484` and `runtime/executor/tests/recovery-ladder.test.ts`
   (5 tests, per `g-core-ladder-llm-off.md`) pin the four rungs and their
   priority. Inserting an expected-state re-check as a new rung changes a
   documented, asserted order. Expect that test file and that paragraph to be part
   of the work.

7. **A smaller one, worth knowing.** `w2x-exit-loop-gap-audit.md:787-792` records
   that three phases the Week 2 document calls "built and landed" have no
   production caller — the 2.5 reduction, the 2.6 replay recorder and 2.8 resume.
   A new plan that says "reuse the exploration reduction" is reusing something
   that has never run in production. Treat A3, A4 and the reducer as *built and
   live-proven in a test*, not as *in service*.

---

## Commands run and observed results

Read-only inspection only. No build, test, Lab or live run was made.

- `ls` over `docs/working/` and `docs/architecture/` in both repositories, and
  over `docs/working/week2-exit-plan/reports/` (44 reports) and
  `docs/working/mvp-week2-automation-loop-plan/reports/` (about 150 reports).
- `sed -n` reads of: `week2-exit-plan.md` (header, Current State, the full
  execution-plan table, brief headings), `mvp-week2-automation-loop-plan.md`
  (Current State, Phases, Execution partition),
  `llm-production-automation-plan.md` (Current State, objective, policy),
  `first-class-data-extraction-plan.md` (Current State), Core's
  `mvp-week2-automation-loop-plan.md`, Core's `recording-proposal-generator-plan.md`,
  Core's `adaptive-flow-training-roadmap.md` (Adaptation Layers, Runtime
  Comparison Model, Phases 3-5), Core's `architecture/automation-studio.md`
  (recovery ladder, expectation seam, patch kinds), and this repository's
  `architecture/{failure-taxonomy,web-capabilities,extension-client,element-identity,page-evidence}.md`.
- Targeted worker reports read in full or in part: `w2x-exit-loop-gap-audit.md`,
  `w2x-existing-flow-and-repair-design.md`, `w2x-created-flow-fidelity.md`,
  `w2-5e-exploration-state.md`, `w2-5c-deterministic-path.md`,
  `w2-t025-live-state-digest.md`, `w2-2-diagnosis-plan.md`,
  `w2-routing-and-subflows.md`, `w2-c6-trial.md`, `w2-c7-exploration-handoff.md`,
  `w2-creation-loop-keeps-going.md`, `w2-authoring-contract.md`,
  `w2-easy-model-output.md`, `g-core-ladder-llm-off.md`,
  `audit-core-runtime.md`, `d-five-fixes.md`, `d2-edit-recovery.md`,
  `settled-decisions.md`.
- Two source checks, to settle claims the documents did not answer:
  - `grep -rn "captureStateDigest" domain/src --include=*.ts` → only
    `domain/src/runtime/llm-evidence/state-digest.ts` and `llm-evidence/tools.ts`.
    The digest is an exploration-runtime capability.
  - `grep -n "expectationEvaluator|captureStateSnapshot|inspectStateDiff" domain/src/runtime/host-runtime.ts`
    → lines 97, 136, 142. The Flow-execution host runtime binds those three and
    no digest.

## Not verified

- Every file:line in the coverage tables except the two source checks above is
  quoted from a working document or architecture page, not re-checked in code.
  Several of those documents warn that their own line numbers have drifted since
  they were written.
- I did not read `docs/architecture/testing-facility.md` beyond its lane
  headings, `automated-testing-facility-plan.md`, or Core's
  `llm-assisted-deterministic-automation-expansion-plan.md` (Paused, 3,466
  lines) in full. If the new plan needs a Lab lane design, the first of those is
  the document to read next.
- Branch state: several rows describe work on unlanded branches (t071, t072,
  t075). I read the plan's status column, not the branches themselves.
- No command was run against a running panel, a browser, or a provider.

## Open questions or contradictions found

1. **Does idea A apply to the human recorder, or only to model exploration?**
   The answer decides whether Core's `recording-proposal-generator-plan.md`
   (Paused) must be reopened. The brief's wording ("exploration should itself be
   the recording") reads as model-only, which is the cheap answer.
2. **Is idea A a replacement for N1's revision design, or a layer above it?**
   Both express "revise and delete steps", but N1 does it by re-rendering the
   whole Flow to the model between generations, and A does it in flight. If A
   lands, N1's renderer is still needed — for entry point 3, an existing Flow the
   model did not build — but its `keep <ref>` dialect may become redundant for
   entry point 1. N1 is in flight on t072 right now, so this needs an answer
   before that branch merges, not after.
3. **Idea B's first rung overlaps P20, which is in flight on t071.** P20 is
   already wiring "exploration reached the expected state" into a durable repair.
   If idea B adds a deterministic expected-state re-check *before* the model, the
   two meet at `recovery/plan.ts` and `recovery/annotation/annotate.ts` — P20's
   files this week. Any B work must be sequenced after t071 lands, or it is a
   file conflict rather than a design one.
4. **Where does a per-node state digest come from at runtime?** The digest is
   computed from sanitized evidence during exploration. At Flow runtime the host
   captures a state snapshot only for nodes that act on a page
   (`docs/architecture/page-evidence.md:185-194`). A digest rung would therefore
   be available for web action nodes and absent for everything else, and the
   ladder needs a defined answer for "no digest recorded" that is not a failure.
5. **The Week 2 exit is mid-flight.** `week2-exit-plan.md` Current State records
   that not one instruction-built Flow reached a passing deterministic replay in
   E1 round 1, with fourteen fix workers in flight. Both ideas touch the same
   machinery. Whether the new plan runs concurrently with the exit push or after
   it is a sequencing decision I could not take from the documents.
