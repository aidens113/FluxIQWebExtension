# Archived from the Week 2 automation loop plan

Moved out of `mvp-week2-automation-loop-plan.md` on 2026-09-16 under the
800-line compaction rule. Both sections are settled: Phase D is built and
supervisor-verified, and the initial scoping briefs were delivered as the
reports `w2-scope-context-recovery` and `w2-scope-repair-reuse`. Nothing here
is live work; it is kept because it records what was approved and why.

## Worker Briefs — initial scoping

Recorded at dispatch on 2026-09-15, before the three investigations above.

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

## The five fixes — approved by the user, to be built as Phase D

The user approved these on 2026-09-15 and asked that they be **planned, not
started**: they are Phase D below, and no code changes until he says go.

Detail, including the executed reproductions and the per-fix regression lists,
is in `reports/w2-a-defect-fixes.md`. Summary:

- **Fix 1 — stop inferring success from silence.** Replace the boolean
  `runtimePatchRestoredExpectedState` with an outcome that can say *I could not
  tell*: `verified`, `unverifiable`, `contradicted`, `not_executed`. Only
  `verified` writes a `validationResults` entry; `unverifiable` writes none and
  leaves the adaptation `testing`. There are **two** vacuous-true paths, not one
  — `!comparison` and `[].every()` on an empty expectation — so fixing only the
  first leaves the defect alive.
- **Fix 2 — stop writing a success that declares itself not to have run.** Delete
  the fabricated `validationResults` entry from
  `targetOverrideProposalAdaptation` and record the structural check as
  `metadata.structuralChecks`. Count only executed validations in
  `adaptation-store.ts:161`.
- **Fix 3 — make patch application total and fail closed.** `applyRuntimePatchToFlow`
  has **no branch at all** for `temporary_action_sequence`, so it silently
  returns the unmodified flow and the rerun validates the *original* flow.
  Make the switch exhaustive, return `not_executed` for an unapplied kind, and
  only then implement real application. Stop writing the dead
  `parameterValues.recovery`.
- **Fix 4 — wire the gate that already exists.** `decideAutomationStudioLlmInvocationGate`
  implements L5 correctly, is tested, and has **zero production callers**. Call
  it before resolving the provider, and chain the patch call on the diagnosis
  actually succeeding and calling for a patch — today the two calls are
  independent and the second bills even when the first failed.
- **Fix 5 — thread the adaptations into classification.** The signature is
  genuinely never written, but that is not why matching fails: the only
  production call site passes **no adaptations at all**, so the match set is
  always empty. This is a seam change, not a one-line edit.

**The single underlying cause, which is why these are one job and not five:**
success is recorded from the *absence of contradicting evidence* rather than
from observed evidence of the intended effect. Making `validationResults`
constructible **only** from an executed-and-compared run dissolves fixes 1-3 and
leaves every downstream gate correct as written — those gates already ask "is
there a succeeded validation?", and the question becomes trustworthy for free.
That is also exactly what L7's confidence tiers require.

**Order: 1 → 3 → 2 → 5 → 4, and the order is load-bearing.** Fixes 4 and 5 must
come **last**. Once adaptations are actually passed to classification, matches
start returning results, which flips the model's eligibility to false — so doing
4 and 5 first would make the loop skip the model on the strength of exactly the
unverified `validated` records that defects 1-3 fabricate. It would look like
progress and would make the system worse. Fixes 1, 2 and 3 all edit
`live-patch.ts` and are serial for one worker.
