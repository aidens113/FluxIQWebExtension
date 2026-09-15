# MVP Week 2 Automation Loop Plan

Status: Active
Status detail: Plan written 2026-09-15 from two scoping reports; nothing is built, and the user reviews the plan before any loop phase starts.
Created: 2026-09-15
Last updated: 2026-09-15
Owner: Senior supervisor agent
Scope: Week 2 of the 30-day MVP, Phases 2.1-2.9: the automation loop (standardized adaptation context, diagnosis separated from exploration, bounded harness exploration, recovery success detection, converting exploration into reusable automation, validating, persisting, and resuming adaptations, and proving deterministic reuse), with Testing Lab verification. Phase 2.0, the data extraction foundation, lives in first-class-data-extraction-plan.md.
Paired document: `F:\!FluxIQ\docs\working\mvp-week2-automation-loop-plan.md`
Related: [30-Day MVP plan](../../FluxIQ%20Web%20Extension%20%E2%80%94%2030-Day%20MVP%20Implementation%20Plan.md) (Week 2), [Week 1 plan](./mvp-week1-web-automation-reliability-plan.md), [data extraction plan](./first-class-data-extraction-plan.md), [LLM production automation plan](./llm-production-automation-plan.md), [scoping 2.1-2.4](./mvp-week2-automation-loop-plan/reports/w2-scope-context-recovery.md), [scoping 2.5-2.9](./mvp-week2-automation-loop-plan/reports/w2-scope-repair-reuse.md)

---

## Current State

**Phase, as of 2026-09-15: plan written; waiting for the user's review; no
loop code changed.** The user asked for the rest of Week 2 to be planned now,
while the extraction foundation and security fixes finish, and reviewed before
anything is built. Two read-only scoping reports cover Phases 2.1-2.4 and
2.5-2.9 with file:line evidence. Path prefix: `AS/` is Core's
`packages/fluxiq/src/programs/automation-studio/`.

**What is true today:** no Week 2 exit criterion is met. The parts exist and
are tested, but no runtime loop connects them.
- 2.1: Core's harness packet has slots for most of the MVP capture list, but
  the one runtime caller fills only instructions, recent actions, a 3,000-byte
  page snapshot, and policy. Expected state, the before/after state diff,
  subflow and router context, prior adaptations, and recording context never
  reach the model (`AS/runtime/service.ts:2865-3169`).
- 2.2: a deterministic "is AI eligible" classifier exists but only decorates
  run summaries; the LLM diagnosis is free text; there is no plan stage.
- 2.3: there is no exploration loop at run time (the bounded evidence loop
  serves Flow creation only), no whole-recovery time limit, and none of the
  five required completion states.
- 2.5-2.7: Core can test one LLM patch on a patched copy, save it, auto-apply
  it when low-risk, persist it with rollback, and rerun once, proven only by a
  mock-provider unit test. The shipped app saves one never-run, high-risk
  target-override proposal that a person applies.
- 2.8: "resume" reruns from the start, and is unreachable in the shipped app.
- 2.9: nothing records which adaptation a later run used; FluxBench has no
  adaptation lane, and its Week 2 metrics are typed `null`.

**Defects found by reading (not fixed, not yet reproduced):**
1. The "did recovery work" check returns true with nothing to compare, so any
   succeeded patched run counts as recovered, and the adaptation is marked
   `validated` (`AS/runtime/live-patch.ts:228,324-330`).
2. A never-executed proposal is recorded as a succeeded validation and passes
   both apply gates (`live-patch.ts:285-290`; `service.ts:5635`;
   `AS/storage/project/adaptation-store.ts:161`).
3. A persisted action-sequence repair writes `parameterValues.recovery`, which
   nothing reads, so it can reach `applied` without ever running
   (`AS/runtime/service/adaptations/patches.ts:52-55`).
4. The deterministic classifier is not the LLM gate, contradicting the
   deterministic-first rule (`service.ts:2876-2890`), and the patch request
   runs even when the diagnosis fails (`service.ts:3039-3065`).
5. `failureSignature` is never written, so known-adaptation matching cannot
   match (`AS/runtime/adaptive-orchestrator.ts:191-198`; `live-patch.ts:233-237`).

**Done:** both scoping reports; this plan and its Core pair.

**Not done:** every phase below.

**Next steps:**
1. The user reviews the plan, including L2, L6, and L9, which change
   authorization or repair boundaries.
2. On approval, phase D (defects 1-3 with failing tests first) and R0 start,
   after extraction's Core K4c.1-2, which also edits `service.ts`.

**Blockers:** the user's review.

---

## Decisions (recommended, for the user's review)

- **L1. The loop comes first in Week 2.** If capacity runs short, extraction
  beyond X4 and Core's Data window move to Week 3 rather than delay 2.1-2.9;
  Core's credential hardening continues.
- **L2. One repair-target contract for the loop and extraction (E2, X6).**
  Core carries an opaque, domain-owned target object instead of `{selector}`.
  The web domain fills it fingerprint-first, with the selector as a hint, and
  evidence names elements by opaque `target.N` handles. List item and field
  selectors become domain-declared repairable parameters, so an `extract_list`
  repair uses the same contract.
- **L3. E54, option 3.** A candidate missing only an identifier clears the
  `destructive` rung only with a second agreeing signal, and exploration's
  destructive refusal is semantic (submit, delete-like, control role and type),
  never a similarity score.
- **L4. Names.** The harness context contract is `recoveryContext`, in a new
  Core `AS/runtime/recovery/` directory; the existing
  `AutomationStudioRuntimeAdaptationContext` (policy and budget) is untouched.
- **L5. Deterministic first is enforced.** The classifier gates the LLM: no
  provider call when a deterministic path or a known adaptation applies, or the
  failure is policy, auth, user intervention, or graph; no patch request unless
  the diagnosis says a patch or exploration is needed.
- **L6. A distinct grant purpose for runtime recovery,** explicit grant only,
  with its own call count and wall-clock budget, documented as an
  authorization boundary in Core's `automation-studio.md`.
- **L7. Confidence tiers.** An executed in-run success is Medium (used now,
  kept provisional); High only after a zero-LLM replay passes; a structural,
  never-executed validation never counts as success; Low asks a person.
- **L8. Resume, not restart.** Continue from the failed node, or the patch's
  start node, with accumulated values, after a host check that the node's input
  state still holds; restart only when no side-effecting node has run.
- **L9. In-run use on the explicit-grant lane.** A target override the domain
  validator matched or resolved against sanitized evidence may execute once in
  the current run without persisting, never for submit-like actions.
- **L10. Lab.** A provider-free scripted provider (Core test-only, loopback and
  a grant required) drives loop cells; loop lanes are their own lane class so
  deliberate harness activations do not read as Week 1 regressions; a `week2`
  corpus; a new A/B baseline after the loop phases, plus one live DeepSeek
  checkpoint through the existing demo lane.
- **L11. Recent browser events** are captured only if the W13 and W24
  dry-run diagnoses show the state diff is not enough; 2.1's Lab proof decides.

## Phases

Execution detail (files, tests, mutation targets, Lab proofs) is in the two
scoping reports: 2.1-2.4 in `w2-scope-context-recovery`, 2.5-2.9 in
`w2-scope-repair-reuse`.

| Phase | Work | Owner | Depends on |
| --- | --- | --- | --- |
| D | Defects first, each with a failing test: the recovery verdict replaces `runtimePatchRestoredExpectedState` and uses a node-definition expected transition (defect 1); structural validation is not success (defect 2); the gate refuses inert `edit_recovery` until 2.5 (defect 3) | Core | review |
| R0 | Move `maybeAnnotateRunDetailWithRuntimeLlm` out of `service.ts` into `AS/runtime/recovery/runtime-recovery-coordinator.ts`, no behaviour change | Core | review; extraction K4c.1-2 |
| 2.1 | `recoveryContext` builder (fixed section priority, byte budget, withheld copy); packet slot with counts-only `contextSummary`; coordinator passes it; the domain marks the failed target as an opaque handle | Core, domain | R0, L2 |
| 2.2 | Deterministic diagnosis gate (L5); structured LLM diagnosis; recovery plan; `recoveryTrace` stages (diagnosis, recovery_plan, exploration, resolution) and web UI; why W13 and W24 report `runtime.behavior` (W2-1, W2-3), then fixes | Core, domain | R0 |
| 2.3 | Closed exploration outcomes; exploration budget (wall clock, actions, domain-enforced scope policy, destructive off, repeat window); runtime exploration loop; task kind; grant purpose (L6); domain recovery tools (inspect, reveal, safe dismiss or click, bounded wait, scoped navigation) | Core, domain | 2.2, L3, L6 |
| 2.4 | The full recovery verdict: expected state, outputs including records completeness, required evidence, continuation; domain URL and presence conditions | Core, domain | D, R0; extraction X4 for records |
| 2.5 | Adaptations record observed and expected state and `failureSignature` (defect 5); exploration reduction; a durable deterministic-path patch inserting real action nodes; the L2 target contract with `extract_list` compatibility | Core, domain | 2.3, L2 |
| 2.6 | Validation kinds and a persisted confidence tier (L7); provisional replay promotion after two successes | Core | 2.5 |
| 2.7 | Persisted confidence, signature, and evidence columns; gateway precedence between an adapted target and the recorded element | Core, domain | 2.5, 2.6 |
| 2.8 | Resume from the failed node with an input-state check (L8); in-run use (L9); the domain input-state predicate | Core, domain | 2.4, 2.7 |
| 2.9 | Scripted test provider (L10); per-attempt adaptation provenance; typed FluxBench Week 2 metrics; adaptation-cycle lane; `week2` corpus and fixtures (side-effect counters, item-selector drift); A/B pair and live checkpoint | Core, Lab | 2.5-2.8, extraction X5 |
| X6 | Extraction repair through L2; W04, W08, and item-selector drift in the `week2` corpus | domain, Core | 2.5, extraction X4-X5 |

## Execution partition

- **Serial Core `service.ts` chain** (frozen at 6,807 lines and 223 members;
  every edit offset): extraction K4c.1-2, then R0, then 2.1's coordinator
  change, then the coordinator integration for 2.2-2.4, then 2.8's two call
  sites.
- **Serial Core LLM-contract worker:** `context-packet.ts`, `task-request.ts`,
  `task-kind.ts`, `structured-response.ts`, `provider-result.ts`,
  `deepseek-provider.ts`, `intervention.ts`, `execution-grants.ts`.
- **Serial Core adaptation files:** `model/flow-adaptation.ts` (2.5, 2.6, 2.7),
  `storage/project/adaptation-store.ts` (2.5, 2.6, 2.7, 2.9), `live-patch.ts`
  (D, 2.5, 2.6).
- **Parallel after R0, one new file each:** `AS/runtime/recovery/`
  (`recovery-context`, `diagnosis`, `recovery-plan`, `recovery-trace`,
  `exploration-outcome`, `exploration-budget`, `recovery-verdict`,
  `runtime-exploration`; the integrator owns the barrel);
  `AS/runtime/exploration-reduction/`; `AS/runtime/adaptation-confidence.ts`;
  `AS/runtime/service/adaptations/{provisional,resume}.ts`; downstream
  `domain/src/runtime/llm-evidence/recovery-tools.ts`; downstream expectation
  conditions; the web UI's run detail stages.
- **Serial Lab chain, after extraction X5's files:**
  `packages/test-contracts/src/{evaluation,evaluation-validation,bench-report}.ts`,
  `packages/test-runner/src/flow-lane/persisted-flow-run.ts`,
  `packages/test-runner/src/bench/*`, then the new
  `flow-lane/adaptation-cycle/` and `bench/corpus/week2.ts`.
- At most four code workers run at once on this machine.

## Validation

- Every step: the test and mutation targets its report names, rerun by the
  supervisor; Core with `--no-file-parallelism`.
- Lab proofs per phase as the reports give them: counts-only context sections
  on W13 and W24 (2.1); stage order in `recoveryTrace` (2.2); every exploration
  trap ends in its named outcome within budget (2.3); W24, W13 before
  dismissal, W19, and an extraction under-read are not resumable, and a scripted
  W13 recovery is (2.4); a run-2 zero-call replay naming the adaptation and a
  side-effect counter of 1 (2.8, 2.9).
- Root gates in both repositories, one at a time; the `week2` A/B pair on the
  production-Core topology and `lab compare`.

## Risks

- `service.ts` contention with extraction K4c; R0 waits for it.
- L2, L6, and L9 change what a repair may persist and what a grant may execute;
  they need the user's explicit acceptance.
- E56 design A (corroboration) has not been explicitly accepted by the user,
  and exploration relies on it.
- The provider-resolver seam a Lab scripted provider needs is unverified.
- E57 and E58: validation reruns and resumes add captures on large pages;
  measure on `member-directory` in the `week2` corpus.
- Long Lab campaigns on this machine's faulty RAM carry an error bar.

## Worker Briefs

Recorded at dispatch on 2026-09-15.

### Brief: w2-scope-context-recovery
- Repository: this repository and FluxIQ Core (`F:\!FluxIQ`), read-only
- Task: for MVP Phases 2.1-2.4 (Standardize Adaptation Context, Separate
  Diagnosis From Exploration, Bounded Harness Exploration, Recovery Success
  Detection), read each phase's build items and exit criteria, then document
  with file:line what already exists in this repository and in Core
  (adaptation context, diagnosis, exploration harness, recovery detection,
  their tests, and Testing Lab coverage), what is missing against each exit
  criterion, and which Week 1 carry-overs bear on them (the Week 1 plan's Next
  steps and open questions E2, E54, and E56). Recommend concrete steps per
  phase, partitioned by file, with tests, mutation targets, the Lab proof, and
  repository ownership (Core or here), and note where the extraction plan's
  phases interact (X4 lands before Phase 2.4).
- Required reads: `AGENTS.md`; `MVP_AGENT_INSTRUCTIONS.md`; the MVP plan's
  "Week 2 Objective" and Phases 2.1-2.4; the Current State of
  `mvp-week1-web-automation-reliability-plan.md` and the named entries in its
  `open-questions.md`; D1 of `first-class-data-extraction-plan.md`; the Current
  State of `llm-production-automation-plan.md`; the code those lead to
- Owns (may edit): its report only
- Must not touch: all source and documents; no builds, test suites, Lab runs,
  or web panel
- Definition of done: every exit criterion of 2.1-2.4 mapped to what exists
  and what is missing, with file:line and recommended steps
- Report to: `F:\!FluxIQWebExtension\docs\working\mvp-week2-automation-loop-plan\reports\w2-scope-context-recovery.md`

### Brief: w2-scope-repair-reuse
- Repository: this repository and FluxIQ Core (`F:\!FluxIQ`), read-only
- Task: for MVP Phases 2.5-2.9 (Convert Exploration Into Reusable Automation,
  Validate Proposed Adaptations, Persist Adaptations, Resume Current Execution,
  Prove Deterministic Reuse), read each phase's build items and exit criteria,
  then document with file:line what already exists in this repository and in
  Core (proposal and patch flow, adaptation validation, persistence, resume,
  reuse proof, their tests, and Testing Lab and FluxBench coverage), what is
  missing against each exit criterion, and which Week 1 carry-overs bear on
  them (the Week 1 plan's Next steps and open questions E2, E57, and E58).
  Recommend concrete steps per phase, partitioned by file, with tests,
  mutation targets, the Lab proof, and repository ownership (Core or here), and
  note where the extraction plan's X6 (drift variants through adaptation, an
  extraction workflow in Phase 2.9's reuse proof) interacts.
- Required reads: `AGENTS.md`; `MVP_AGENT_INSTRUCTIONS.md`; the MVP plan's
  "Week 2 Objective" and Phases 2.5-2.9; the Current State of
  `mvp-week1-web-automation-reliability-plan.md` and the named entries in its
  `open-questions.md`; X6 and D1 of `first-class-data-extraction-plan.md`; the
  Current State of `llm-production-automation-plan.md`; the code those lead to
- Owns (may edit): its report only
- Must not touch: all source and documents; no builds, test suites, Lab runs,
  or web panel
- Definition of done: every exit criterion of 2.5-2.9 mapped to what exists
  and what is missing, with file:line and recommended steps
- Report to: `F:\!FluxIQWebExtension\docs\working\mvp-week2-automation-loop-plan\reports\w2-scope-repair-reuse.md`

## Work Ledger

### 2026-09-15 — Phased loop plan written from both scoping reports
- Agent: supervisor; workers `w2-scope-context-recovery`,
  `w2-scope-repair-reuse`
- Changed: this document (Current State, Decisions L2-L11, Phases, Execution
  partition, Validation, Risks, Open Questions); its new Core pair
- Why: the user asked for the rest of Week 2 to be planned and reviewed before
  building; the reports found no exit criterion met and five defects by reading
- Validation: not validated; planning documents only, no code changed
- Outcome: Accepted
- Follow-up: the user's review; then phase D and R0

### 2026-09-15 — Plan created; scoping investigations dispatched
- Agent: supervisor; workers `w2-scope-context-recovery`,
  `w2-scope-repair-reuse`
- Changed: this document
- Why: the user pointed out that Week 2 is for refining the automated loop,
  while every worker was on extraction and Core credential hardening and the
  loop phases had no plan
- Validation: not validated; planning document only
- Outcome: Partial
- Follow-up: write the phased plan from both reports

## Open Questions

- **L2, L6, and L9 acceptance.** They change what repairs persist and what an
  explicit grant may execute. Owner: the user, at the plan review.
- **E56 design A.** The corroboration predicate that exploration relies on has
  not been explicitly accepted. Owner: the user.
- **Provider-resolver seam.** How the web-panel host supplies Core's provider
  resolver, which the Lab's scripted provider needs (Core
  `docs/architecture/automation-studio.md:606-612`). Owner: senior supervisor
  agent, a read-only check before 2.9's briefs.
