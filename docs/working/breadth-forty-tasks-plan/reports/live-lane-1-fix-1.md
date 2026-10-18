# Live lane 1 fix 1 (Core): a builder stopped for repeating itself may be briefed once more

Worker report. Tree: `C:/Users/osrs_/FluxStuff/fxwork/t563/!FluxIQ`, branch `task/t563-a8-lab-comparison`. Nothing committed, Core not built, no dist writes.

## Outcome

Done. The design in the brief held up once I read the code. There are three small additions beyond the files it named, each explained below: `dispatch/ending.ts` (the structured signal), `supervisor/brief-input.ts` (the supervisor may not write the new field) and the supervisor test fixture.

## What changed and why

All paths are under `packages/fluxiq/src/programs/automation-studio/runtime/project-agents/`.

- **The structured signal** (`dispatch/ending.ts`, `contracts/builder-return.ts`). The return gains a new optional field, `stoppedRepeating?: true`. It is set only on a return that is not done, and only when:
  - the loop returned `llm_evidence_loop.repeat_without_progress` (in `built`, with no allowance refusal), or
  - the loop threw Core's build failure whose parsed diagnostic code is `flow_bootstrap.evidence_repeat_without_progress` (in `thrown`, not stopped, no allowance refusal). This is the path run-mvcx8na6 took.

  The field is read from codes and never from the reason text. The return parser accepts it. `issues()` refuses it on a done return (`project.return_stopped_repeating`). The supervisor's compact view of a return shows it.
- **New contract** `contracts/earlier-attempt.ts`, exported from the barrel. It defines the type `AutomationStudioProjectEarlierAttempt = { briefId, kind: "build"|"repair", reason, lastingActs: [{act, did}] }`, plus one value with two methods:
  - `of`: builds the attempt, bounding each field (reason up to 2000 characters, at most 20 acts, act up to 200, did up to 300).
  - `read`: reads it back from the record's shape.
- **The brief contract** (`contracts/subflow-brief.ts`). There is a new optional `earlierAttempt` field. It is parsed on build and repair briefs only, so the build record holds it.
- **The supervisor cannot set it** (`supervisor/brief-input.ts`). A brief the supervisor writes has any `earlierAttempt` removed, the same way `carriedFrom` already is. Without this, the supervisor could have invented an earlier attempt.
- **The repeat check and the attachment** (`supervisor/dispatch-tool.ts`).
  - `repeatedBriefs` skips a blocked latest return marked `stoppedRepeating` while this subflow has fewer than 2 such returns under the plan in force (the new `stopsRepeating` helper). A second stop, or any other blocked cause, is refused as before.
  - The new `withEarlierAttempt` attaches the earlier attempt to every build or repair brief whose subflow's latest return is not done and is marked `stoppedRepeating`. It carries that brief's id and kind, its reason, and the lasting acts that brief still has on the target (from `automationStudioProjectSupervisorLeftOnTarget`, filtered to that brief).
  - The header comment has a new paragraph naming lane-1 fix 1 and run-mvcx8na6-9554a3f1.
- **What the new builder sees** (`dispatch/run-brief.ts`). The builder's first look at the page now includes `earlierAttempt` (with a note), beside `repairOf` or `startsFrom` when the brief has one; `shownAtOpening` now takes several keys. The note is in generic words: the earlier builder was stopped before it finished for repeating calls that made no progress; the reason gives the calls it stopped on; its lasting acts are still on the target; do not take the same path, try a different way, submit and test. It names no site, task, product or control.
- **The supervisor's guidance** (`supervisor/guidance.ts`). One sentence was added to each of `refusals.briefRepeated`, `refusals.briefRepeatedOthersSent` and `next.afterReturnsNotDone`: a brief whose return says `stoppedRepeating` may be sent once more unchanged, and its new builder is shown the earlier attempt. The two refusal texts add that a second such stop is refused the same way.
- **Tests**
  - New: `dispatch/tests/stopped-repeating.test.ts` (5 tests).
    - The returned-loop code is marked and parses back.
    - The thrown build failure is marked, and its reason still lists the calls it stopped on.
    - These are not marked: another loop code, another build failure, a plain error that only contains the code's words, and a stopped build.
    - A done return carrying the flag is refused.
    - With the real builder loop, the builder's first look shows `earlierAttempt` with its note, a plain brief shows none, and the build record holds the brief with the field.
  - Added to `supervisor/tests/repair-repeats.test.ts` (5 tests).
    - The first stopped return lets the unchanged brief go: it carries `earlierAttempt` with the reason and one lasting act, and the record holds it.
    - After a second stop, the unchanged brief is refused `project.brief_repeated`.
    - A brief blocked for another reason is still refused, and its changed re-send carries no earlier attempt.
    - An `earlierAttempt` written by the supervisor is dropped.
    - All three guidance texts carry the new sentence.
  - `supervisor/tests/supervisor-fixture.ts`: `BuilderPlan` may now answer `"stopped"` (a blocked return marked `stoppedRepeating`), and the stopped reason is exported as `STOPPED_REASON`.
  - The supervisor tests went into the existing file rather than a new one because a new file put `supervisor/tests/` at 26 files, over the audit's limit of 25.

## Commands run and observed results

All were run from Core's root.

- `pnpm --filter fluxiq check`: exit 0 after the source changes; exit 0 again after the final test edits (build-cache log `"reason":"inputs changed: packages/fluxiq"`, no tsc errors).
- `pnpm --filter fluxiq exec vitest run <the three changed test dirs>` (`project-agents/supervisor/tests`, `project-agents/dispatch/tests`, `project-agents/contracts/tests`):
  - First run: 1 failed out of 360. `guidance.test.ts` "names none of the ten realistic scenarios": `guidance.refusals.briefRepeated: expected 'like' to be undefined`. My wording "refused like this" hit the banned-words guard; it now reads "refused the same way".
  - Rerun: `Test Files 50 passed (50)`, `Tests 360 passed (360)`.
- `node scripts/structure-audit.mjs`:
  - First run: `FAIL [directory-files] .../supervisor/tests/: 26 source files exceeds the 25-file limit`. I merged the new file into repair-repeats.test.ts.
  - Rerun: `structure-audit: passed (398 warning(s), 1155 baselined)`. The warnings are advisory line and file counts, for example dispatch-tool.ts at 637 lines against a warning at 400 and a limit of 800.

## Not verified

- No live run and no Core build, as the brief instructed (a live run is using dist). A live builder has not yet been shown `earlierAttempt` in the real web domain.
- Whole-package suites were not run, per the twice-a-day rule. No test outside the three directories was run. A literal search for the changed guidance text found it only in `guidance.ts` and the stale `dist/.d.ts`.

## Open questions or contradictions found

- The brief also asked for short summaries of that builder's last few decisions. Core keeps no model-written account of a builder's decisions: trace rows and the build record hold codes and ids only, by design. The return's `reason` already lists up to the last eight calls it stopped on, latest first, by tool, node, result code and reason code. So `earlierAttempt` carries that reason and adds no separate decision list.
- `earlierAttempt` is attached to any build or repair brief after a stopped return, changed or unchanged, and also after a stopped `partial` return. It is not limited to the unchanged re-send. Only the repeat exemption is limited to `blocked`, as before.
- "The same plan" is the plan in force (`answeredUnderPlan`). After an amendment, the stop count starts again at zero.
