# t173-K8: the draft loses its step to the start location

Worker report. Core `F:\!FluxIQ`, branch `task/t173-audit-close`, nothing committed.
Ownership was extended mid-task to `llm/harness-options/bootstrap-completion.ts`
and `llm/evidence-loop.ts`, each with its tests.

## Outcome

**Done.** The fix covers both halves of the problem:

- **Completion.** Completion now builds the Flow with the withdrawn navigation
  put back as step 1, so the build does not spend a turn on the refusal.
- **Rerun.** A `rerun` no longer withdraws the step it replaces until the
  rerun has worked.

Reachability is not weakened. The plan built from the restored draft goes
through the same check as before, and a draft with no withdrawn step that
reached the start location is still refused, with the start location named.

## Diagnosis

- With a start location set, the build starts on a blank tab and the domain
  refuses everything except a navigation
  (`domain/src/runtime/llm-evidence/node-run/start-location.ts`, `run.ts:600-619`).
  So the navigation is always draft step 1. Both debugs show this: round 1 #1
  and round 2 #2 each take the draft from 0 to 1 steps.
- Completion built the Flow from proposed steps only
  (`automationStudioFlowDraftStepIsProposed`: disposition `kept`, plus worked).
- A step leaves the draft in three ways:
  - `drop`;
  - `exploratory`. A model plausibly reads the arrival as "I only did this to
    get there".
  - `rerun`. `evidence-loop.ts:644` dropped the original *before* running the
    replacement, so a rerun that failed left nothing kept.
- The bundle does not keep amendment targets and reasons (round 1 cause 3),
  so it cannot say which of the three happened in either run. Either way the
  arrival was still in the draft, just withdrawn, and the check correctly
  refused.
- The refusal already said exactly what to add. The cost was the turn. In
  round 1 it was the only completion attempt, and the budget ran out two
  decisions later.
- Two other suspects were ruled out:
  - Draft reduction: it is not on the completion path.
  - The draft entry's oldest-first trimming: it changes only what the model is
    shown, not what is kept.

## What changed and why

In `flow-bootstrap/reachability/`:

- **`location-agreement.ts` (new).** The loose "this value is about the start
  location" test (12 leading characters), moved unchanged out of
  `plan-locations.ts`. The check and the restore now share one definition. It
  is not exported from the barrel.
- **`plan-locations.ts`.** Now uses that test. Behaviour is unchanged.
- **`start-step.ts` (new).** Exports `automationStudioFlowBootstrapDraftWithStartStep({ steps, startLocation }) -> { steps, restored? }`.
  - It acts only when there is a start location, at least one kept step, and
    no kept step whose `ranWith ?? input` carries the location.
  - It then restores the **earliest withdrawn step that worked** and carries
    the location, the way `keep` does (`kept`, routing cleared), ahead of every
    kept step.
  - It works on copies and never mutates the loop's draft. It never invents a
    step.
- **`index.ts`.** Exports `start-step.ts`.
- **`tests/start-step.test.ts` (new).** 11 cases.

In `llm/harness-options/`:

- **`bootstrap-completion.ts`.** Computes `draftSteps` through the restore
  before `proposed`. It is used for the proposed filter, `fromDraft`, and the
  instructed-acts check.
- **`tests/bootstrap-completion.test.ts`.** New case: "builds a draft whose
  navigation was withdrawn with that navigation as its first step". The draft
  is an `exploratory` navigate plus a kept `extract_list`, and the Flow must
  start at the location. The test checks:
  - the verdict is `ok`;
  - the nodes are `[browser-navigate, dom-extract_list]`;
  - the input draft still says `exploratory`.

  **The test fails without the wiring and passes with it.** I checked this by
  temporarily bypassing the restore: 1 failed, 20 passed. Then I restored the
  file.

In `llm/`:

- **`evidence-loop.ts`.**
  - The rerun's original step is captured *before* the other amendments are
    applied. Previously it was looked up after a reorder could have
    renumbered the draft.
  - The line-644 early drop is removed.
  - After the rerun's call is recorded,
    `automationStudioLlmEvidenceRerunReplaced` withdraws the original only if
    the new step is proposable (it worked).
  - A rerun that throws or fails goes through `toolFailed`, so no drop
    happens and the original stays kept.
  - A rerun that is never run (a budget, tool-call or unknown-tool exit) also
    leaves the original kept.
  - The file is now exactly 800 lines, the limit. I trimmed my own comments
    and moved the rule into the module below.
- **`evidence-loop/rerun-replacement.ts` (new).** That rule and why. Exported
  from `evidence-loop/index.ts`.
- **`evidence-loop/tests/rerun-replacement.test.ts` (new).** 3 cases:
  - a rerun with `effectApplied: false` keeps the original;
  - a rerun that throws keeps the original;
  - a rerun that worked drops the original and keeps the rerun.

  **The two failure cases fail against HEAD's `evidence-loop.ts` and pass
  with the change.** I checked this by temporarily putting in `git show HEAD`:
  2 failed, 1 passed. Then I restored the file.

## Expectations that legitimately changed

- `llm/evidence-loop/tests/progress.test.ts`, trace row 5 (the `draft_rerun`
  row): `keptStepCount` changes from 0 to 1.
  - The count is taken when the amendment is recorded. At that point the rerun
    has not run yet, so the step it replaces is still kept.
  - The same test's final-draft expectation is unchanged: d1 dropped, d3 kept.
    That shows the original is still withdrawn once the rerun works.
  - I added a comment saying so.
- `tests/deepseek-bootstrap-exploration.test.ts`: passes unchanged, so no
  expectation moved there.

## Commands run and observed results

- `npx tsc --noEmit -p packages/fluxiq/tsconfig.json`: no output, `TSC_EXIT=0`.
- `npx vitest run --testTimeout=30000 --exclude ".tmp/**"` over `runtime/flow-bootstrap`,
  `runtime/flow-draft`, `runtime/llm`, `runtime/tests/service-bootstrap`,
  `runtime/tests/deepseek-bootstrap-exploration.test.ts`,
  `runtime/tests/llm-deepseek-flow-bootstrap.test.ts` and
  `runtime/service/flow-bootstrap-commands`: **121 files, 1516 tests passed.**
- `node scripts/structure-audit.mjs`:
  - First run after the loop change: FAIL `[file-lines] evidence-loop.ts: 809
    lines exceeds the 800-line limit`. I fixed it by extracting the module
    above.
  - Final run: `passed (194 warning(s), 355 baselined)`, plus "1 baseline
    entries can be lowered". That note is not from these files.
- Earlier, at the default 5 s timeout, service-bootstrap tests failed with
  `Test timed out in 5000ms` only (14, then 4). The set differed each run on a
  loaded machine; other `.tmp/core-web-build` trees were present.

## Not verified

- No live Lab run of a bigbox build with these changes.
- Which amendment withdrew the arrival in either debugged run. The bundle
  lacks that detail.
- The incomplete-draft path (t173-C), which writes an exhausted build's draft,
  does not use the restore. If it assembles from kept steps, an exhausted
  build's saved draft can still lack its arrival.

## Open questions or contradictions found

- `draftChanged` on a rerun-only `amend_draft` row stays `true`, although the
  draft itself now changes only when the rerun's call is recorded (in the same
  iteration). I left it that way to keep revision counting as it was.
- Service-bootstrap tests sit close to vitest's 5 s default under load. That
  is a source of false failures during concurrent validation.
