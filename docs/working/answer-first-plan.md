# Answer First

Status: Active
Status detail: Draft, being rewritten after the user's refinement of 2026-11-03: one live exploration, simulation with exact recorded inputs, subflow library, extension UI focus. Not yet shown to the user as a plan.
Created: 2026-11-03
Last updated: 2026-11-03
Owner: Senior supervisor agent
Scope: The extension and Lab side of the Answer First pivot: scoring "the person got the right answer" separately from "the Flow became deterministic", a same-workspace second attempt, a double-act oracle, the per-attempt report and the Lab's default build path. Core's plan owns the idea, the design and the phases.
Paired document: `C:/Users/osrs_/FluxStuff/!FluxIQ/docs/working/answer-first-plan.md`
Related: [testing facility](../architecture/testing-facility.md), [adaptation and breadth plan](./adaptation-and-breadth-plan.md), [offline trials plan](./trace-offline-trials-plan.md)

---

## Current State

**Planned, not started.** Core's paired plan holds the user's words, the findings, the design, the phases and the open questions, all as the lead's proposal until reviewed.

**On this side,** the finding that matters most: the live runs of 2026-10-31 and 2026-11-03 ran `legacy`, the Lab's default, while the product's default is `project`, so they did not exercise the path people use. P0 measures both on Claude on the same tasks, and afterwards the two defaults are the same.

**Blockers:** none for P7. **Next:** Core's P0, then P7.

## P7: Two Scores And The Second Attempt

The Lab today throws `lab.candidate_not_promoted` on a draft and never consults the oracle, so a task the person got right scores as a failure when no Flow was promoted. References are in Core's discovery report (`docs/working/answer-first-plan/reports/discovery.md`), section 8.

**Keep every rule that already binds a Lab run:** the ten realistic scenarios, starting from the extension chat, visible browsers, the task audit, up to four live lanes, no weakened oracle, and no fixture or guidance shaped to pass.

1. **`answerVerdict`.** Judge the attempt's stored rows and the site's state against the same private oracle, on the attempt itself, before any fixture reset (before `lane.ts:452`). `oracleVerdict` then means Flow playback only. Relax the validation that forces both null without a Flow (`lane-observation.ts:163`, `evaluation-validation.ts:137`). `judgeCreatedFlowDataset` takes a persisted Flow run today, and needs a dataset source without one.
2. **What the chat showed.** Score the answer the person actually saw, screened, as well as what is stored, so a right answer that never reached them fails.
3. **A double-act oracle.** For each task with a lasting act, the site's recorded change must equal what the task asked for, once. Final-state oracles are absolute today (`testing-facility.md`), so a finish on a used site needs a seeded baseline per attempt and a judgement of the change, as the standing rule says.
4. **A same-workspace second attempt.** Today each build starts blank in a fresh workspace, so repeated runs are repeats and not attempts. A new lane runs a task twice on one workspace and proves the second started from the first's draft. `persistent-isolated` and `lab replay` are the nearest existing pieces.
5. **The per-attempt report.** One row per attempt: task, attempt, path, calls, tokens, dollars, time, live trials, offline checks, both verdicts, repeated acts. A per-task series over it, and the bench report carrying both scores. Calls and tokens sit beside dollars, because models and prices change.
6. **The defaults.** After Core's D11, the Lab's authoring mode default (`packages/test-runner/src/live-llm/authoring-mode-env.ts`) equals the product's, and `testing-facility.md`'s stale line about it is corrected.

Old pass rates are not comparable to `answerVerdict` and are never blended with it. Only a few tasks run fully end to end (user rule), so a second attempt runs on about one task per site, and every other task stays proven provider-free.

**Done when:** a provider-free lane scores a task right with no Flow promoted, wrong with a repeated act, and shows a second attempt spending less than its first, all headed on a realistic site.

## Work Ledger

### 2026-11-03 - Plan

- Agent: lead.
- Changed: this document. No source.
- Validation: not validated; this is a plan. The evidence is in Core's ledger.
- Outcome: for the user's review.

## Open Questions

None here beyond those in Core's plan.
