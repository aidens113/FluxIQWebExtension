# t791 fix 4: an unwitnessed reversible step no longer blocks its trial

Worker report. Core tree `C:/Users/osrs_/FluxStuff/fxwork/t791/!FluxIQ` (branch `task/t791-creation-witness-any-same-tab-read`). I ran no mutating git, no Lab runs and no model calls.

## Outcome

Done. A reversible lasting step whose witness stamp is missing or no longer resolves no longer refuses its trial on any of the three paths (whole candidate, subflow, phase-start entry). What changes:

- The trial runs and is judged by its end view and each step's done-when check.
- The trial's act is recorded as on the site.
- The builder's answer and the judge's packet both say which steps had no witness. The parts those steps serve are `unproven`.
- `candidate.trial_starts_in_end_state` still refuses exactly as before. A test shows it refusing even when a step with no witness is in the same trial.

## Decision and new shapes

**Admission.** A project reset's `admit` now always answers `{ kind: "admit" }`. When there are reversible lasting steps with no resolving stamp, the answer also carries this note:

`{ kind: "admit", unwitnessed: { steps: [{ step, label? }], instruction } }`

- `step` uses the plan-node numbering the door already used.
- `instruction` holds the builder's words.
- `site-reset/contracts.ts` was not edited, as the brief required. Its `{kind:"admit"}` branch has no `unwitnessed` field, so the note rides as an extra property, and gates read it through a validating reader. See Open questions.

**Gates.** The candidate gate and the subflow gate copy the note into a live trial's evidence as `unwitnessed`. Offline trials and trials kept from the recording do not get it.

**Packet the judge sees.** `siteChange.unwitnessed = { steps: [{ label?, ranAs: number[] }], parts, said, omitted? }`.

- `ranAs` holds the trial steps where the step acted. It uses the run feedback's numbering, which the packet's `acts` also use, matched by step definition the same way the session attributes acts.
- I did not put the plan numbers in the packet. The plan numbers and the feedback numbers differ (the feedback counts the start node and subflow calls), and mixing them would confuse the judge.
- For a part those steps serve, a `no_change` or `already_in_end_state` proof becomes `unproven`, and its `result.change_not_seen` finding is dropped. `shown`, `carried`, `unproven` and `contradicted` stand.
- `result-verification/site-change/held.ts` already does not hold a yes over `unproven`. I read it and did not edit it.

**Readings when nothing else is read.** Where no other step has a witness and nothing is left on the site, `automationStudioTrialChangeBegin` answers no session. `project-reset.beforeTrial` then supplies a session with no readings, so the judge is still told the gap. It does this with or without a look.

**Acts recorded as on the site.** No change was needed. `ledger.trialRan` already records a trial act with a spot as `strictReset` (it seals nothing and is said as on the site, t775's treatment). A test asserts the act lands in `leftOnSite` and the project snapshot. The supervisor's whole trial still records none of its acts, which is existing behaviour (`whole-trial.ts` passes `[]` to `trialRan`).

**Phase start.** A predecessor with an unwitnessed step now runs to the entry, and its act goes into the phase's own ledger. The note is not told there, because nothing judges the entry; a trial that runs that step says it. A refusal from any other reset still leaves the entry unprepared, because that branch is kept.

**Builder words** (`site-reset/unwitnessed-step-words.ts`, `AUTOMATION_STUDIO_SITE_RESET_UNWITNESSED_STEP_WORDS.ran(steps, issued)`):

> This trial ran with the step "label" (plan step N) changing something on the site where no place was named that shows its change, so Core could not read what it changed. The trial is judged by its end view and each step's done-when check, and the task parts it serves stay unproven by what Core read: give each such step a done-when check that shows its change on the page. To have the change read as well: `WORDS.stepWitnessRequired(issued)`

The words are generic and name no site. The issued refs still come from `project.issuedRefs()`, so fix 2's filter by resource will apply here automatically.

**Person's card** (`activity/candidate/trial-words.ts`). A trial that ran with the note adds: `what "label" changed on the site couldn't be checked, so it was judged by how the page ended`. It names steps by label, not number, because the card counts steps differently. The retired code `candidate.trial_step_unwitnessed` keeps its "not run" words for builds recorded earlier, as `trial_reset_required` does.

**Loop budget.** I removed the wrap-up sentence telling the model to "end blocked" on a `candidate.trial_step_unwitnessed` refusal.

### Exported names (new)

- `trial-change/unwitnessed-steps.ts`:
  - types `AutomationStudioTrialUnwitnessedStep`, `AutomationStudioTrialUnwitnessed`
  - `automationStudioTrialUnwitnessedOf(admission)`
- `trial-change/unwitnessed-outcome.ts`: type `AutomationStudioTrialSiteChangeUnwitnessed`, `automationStudioTrialChangeUnwitnessedOutcome(outcome, { steps, unwitnessed, acts })`
- `trial-change/unwitnessed-session.ts`: `automationStudioTrialChangeUnwitnessedSession({ session, steps, parts, unwitnessed, leftFromEarlier })`
- `site-reset/unwitnessed-step-words.ts`: `AUTOMATION_STUDIO_SITE_RESET_UNWITNESSED_STEP_WORDS`

All four are exported through the `trial-change` and `site-reset` barrels.

## What changed and why (files)

All paths are under `packages/fluxiq/src/programs/automation-studio/runtime/`.

**Source:**
- `flow-bootstrap/site-reset/project-reset.ts`: `admit` admits with the note; `beforeTrial` wraps the session; the header rule replaces t751 R3; the unused `refusal` import is dropped.
- `flow-bootstrap/site-reset/unwitnessed-step-words.ts`: new.
- `flow-bootstrap/site-reset/index.ts`: barrel line.
- `flow-bootstrap/trial-change/unwitnessed-{steps,outcome,session}.ts`: new.
- `flow-bootstrap/trial-change/index.ts`: barrel lines and header.
- `flow-bootstrap/candidate/trial-gate.ts`: reads the note into `evidence.unwitnessed`; header. 796 lines.
- `flow-bootstrap/subflow-candidate/subflow-trial-gate.ts`: the same; header reflowed so the file stays at 800 lines.
- `service/project-build/phase-start.ts`: header paragraph only.
- `activity/candidate/trial-words.ts`: card clause; the retired code is commented.
- `llm/loop-budget.ts`: sentence removed.

**Tests:**
- `flow-bootstrap/trial-change/tests/unwitnessed.test.ts`: new, 6 tests, forum follow and reply.
- `flow-bootstrap/site-reset/tests/project-reset.test.ts`: 3 new tests.
  - (a) admitted with the note, packet says the gap, `p1` is unproven, the act is in `leftOnSite`.
  - No session without a gap.
  - (b) `trial_starts_in_end_state` still refuses beside an unwitnessed step (library alert fixture).
- `flow-bootstrap/candidate/tests/reset-witness/tests/reset-witness-stamp.test.ts`: the refusal test now asserts the trial runs (`candidate.trial_yes`), with `evidence.unwitnessed` and a packet where `p1` is unproven.
- `flow-bootstrap/subflow-candidate/tests/subflow-trial-gate.test.ts`: new subflow-path test (forum follow) through a real project reset.
- `flow-bootstrap/reset-admission/tests/step-door.test.ts`: expects admit with `unwitnessed` and the builder's words.
- `service/project-build/tests/project-build-phase-start.test.ts`: the predecessor runs to the entry, its act is in the own ledger, the hook ran.
- `service/project-build/tests/project-build-brief-ports.test.ts`: the subflow trial runs with `unwitnessed`; hooks = 2.
- `service/project-build/tests/project-build-reset.test.ts`: the second whole trial now runs (4 judge calls); its answer is `ok: true, unwitnessed: [{ step: 4 }]`; the file is kept at 800 lines.
- `llm/tests/loop-budget.test.ts`: the exact-string test plus a test that the sentence is gone.
- `activity/candidate/tests/result.test.ts`: card clause test.
- `flow-bootstrap/reset-answers/tests/refusal-tools.test.ts`: **outside my named owned paths, but not on the must-not-touch list.** I removed `site-reset/project-reset.ts` from the list of files that must hold a meetable refusal site, since it no longer refuses. It is a one-line change plus a comment.

Together these give (c) agreement: the whole candidate, subflow and phase-start paths all run the unwitnessed step, and the two gates both say `unwitnessed`.

## Commands run and observed results

- Single files:
  - `npx vitest run` over the new and updated tests, each iteration: all passed.
  - Last individual run: 6 files, 51 tests passed (brief-ports, reset, unwitnessed, project-reset, reset-witness, subflow gate).
  - Card test: 24 passed.
- Prompt-contract tests (`llm/deepseek/tests/system-prompt.test.ts`, `flow-bootstrap/plan/tests/extraction-vocabulary.test.ts`, `flow-bootstrap/plan/tests/issue-feedback.test.ts`): `Test Files 3 passed (3)`, `Tests 70 passed (70)`. This ran before the last wording tweak in the builder words and the card; neither file is covered by those tests.
- `npx tsc --noEmit -p .` in packages/fluxiq, under the lock:
  - First run: V8 heap OOM at the default 2 GB (rc=134).
  - Rerun with `NODE_OPTIONS=--max-old-space-size=6144`: 2 errors, both in my test (`result.evidence` typing).
  - After fixing them: `tsc rc=0`.
- `pnpm test` (vitest-groups) over activity/candidate, flow-bootstrap/{site-reset, trial-change, candidate, subflow-candidate, reset-admission, reset-answers}, llm/tests/loop-budget.test.ts and service/project-build, under the lock: rc=0.
  - parallel group: `Test Files 128 passed (128)`, `Tests 1101 passed (1101)`
  - real-sql group: `Test Files 7 passed (7)`, `Tests 35 passed (35)`
- `node scripts/structure-audit.mjs`: 2 violations, neither in my files.
  - `site-reset/tests/` has 26 files against the 25-file limit; the new one is `page-destination.test.ts`, untracked and not mine.
  - `site-reset/ledger.ts` is 811 lines against the 800-line limit; it has 15 changed lines from another worker.
  - Two violations of mine (an 801-line test, a packed statement) were fixed.

## Not verified

- No live or browser run. Whether the judge actually reads `siteChange.unwitnessed.said` as intended is unobserved.
- The judge prompt (`result-verification/build-test/task-checklist.ts`, must not touch) does not mention the new key; the packet carries its own sentence.
- I did not run the downstream extension repo. Its `apps/extension/e2e/site-reset/tests/job-unexplored-step.spec.ts` expects `candidate.trial_step_unwitnessed` and `stepsUnwitnessed` (lines 27, 170, 173), so it will fail until it is updated.
- I did not run full `pnpm check` or whole-package suites, by the brief and the twice-a-day rule.

## Open questions or contradictions found

1. **`site-reset/contracts.ts`** needs your edit:
   - Add `unwitnessed?: AutomationStudioTrialUnwitnessed` to the admit branch of `AutomationStudioSiteResetStepAdmission`.
   - Reword its doc and `admit`'s doc ("refuse it unrun (`candidate.trial_step_unwitnessed`...)", "every reversible lasting step needs a witness stamp ... or the trial is refused unrun", t751 R3). Both are now stale.
   - The refusal-code union itself has no `trial_step_unwitnessed` member, so nothing must change there for compilation.
   - Until the contract changes, gates read the note through `automationStudioTrialUnwitnessedOf`, which validates it.
2. **Comments outside my ownership that still describe the refusal:**
   - `reset-admission/admission.ts:43` (owned by another worker / must not touch).
   - `site-reset/trial-stamp.ts` header ("the trial door refused it unwitnessed").
   - `ui/activity-status/steady/test-ending.ts:57` still words `trial_step_unwitnessed` (harmless for old records).
3. **Barrel overlap.** `trial-change/index.ts` and `site-reset/index.ts` are barrels that other workers also touch (git shows another worker's edits in `site-reset/index.ts`). My edits there are export lines only; check for a merge collision.
4. **Two numberings.** The admission's (and the builder's) step numbers are plan-node numbers, while trial feedback numbers count the start node and subflow calls (for example "save it" is plan step 1 but feedback step 3). The old `stepsUnwitnessed` had the same mismatch. I lead with the label in the builder's words, and the judge's packet uses `ranAs` in feedback numbering.
5. **The supervisor's whole trial records no trial acts** (`whole-trial.ts` passes `trialRan([])`). This is existing behaviour, so "recorded as on the site" holds for builder trials and phase-start entries but not for the whole trial. I left it unchanged.
