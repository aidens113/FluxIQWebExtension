# MVP Week 2 Automation Loop Plan

Status: Active
Status detail: Planning started 2026-09-15; two read-only scoping investigations cover Phases 2.1-2.4 and 2.5-2.9, and no loop work has started.
Created: 2026-09-15
Last updated: 2026-09-15
Owner: Senior supervisor agent
Scope: Week 2 of the 30-day MVP, Phases 2.1-2.9: the automation loop (standardized adaptation context, diagnosis separated from exploration, bounded harness exploration, recovery success detection, converting exploration into reusable automation, validating, persisting, and resuming adaptations, and proving deterministic reuse), with Testing Lab verification. Phase 2.0, the data extraction foundation, lives in first-class-data-extraction-plan.md.
Paired document: none
Related: [30-Day MVP plan](../../FluxIQ%20Web%20Extension%20%E2%80%94%2030-Day%20MVP%20Implementation%20Plan.md) (Week 2), [Week 1 plan](./mvp-week1-web-automation-reliability-plan.md), [data extraction plan](./first-class-data-extraction-plan.md), [LLM production automation plan](./llm-production-automation-plan.md), [testing facility plan](./automated-testing-facility-plan.md)

---

## Current State

**Phase, as of 2026-09-15: planning; no loop work started.** Week 2's objective
is the automation loop (MVP plan, "Week 2 Objective"). The data extraction
foundation, Phase 2.0, was pulled into the first half of the week to run beside
the loop, not instead of it (`first-class-data-extraction-plan.md` D1). Until
now every worker went to extraction and Core's credential hardening, so the
loop phases are behind; the user pointed this out, and this plan starts them.

**Done:** this document.

**In progress:** read-only scoping `w2-scope-context-recovery` (Phases 2.1-2.4)
and `w2-scope-repair-reuse` (Phases 2.5-2.9).

**Next steps:**
1. Write the phased plan from both reports, separating Core-owned work and
   creating a Core paired document if the scoping finds any.
2. Stop for the user's review before any loop phase is built: on 2026-09-15 the
   user asked for the rest of Week 2 to be planned now and reviewed together.

**Blockers:** none.

---

## Decisions

- **L1. The loop comes first in Week 2.** If Week 2 capacity runs short, the
  extraction work beyond X4 and Core's Data window (extraction plan K12) move to
  Week 3 rather than delay Phases 2.1-2.9. Core's credential hardening (K0)
  continues, because it fixes a real weakness.

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

None yet.
