# t195-w26c: phase 2/3 wiring (the judge's verdict decides; a wrong result is repaired)

Worker t195-w26c, 2026-10-01. Core `C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQ`, branch
`task/t195-live-control-flow`. `R` = `packages/fluxiq/src/programs/automation-studio/runtime/`. No Lab, no
browser, no model call, and no commit.

## Outcome

Done. Section 4.4 (W3) of `t195-w25-completion-judge-design.md` is implemented with the section 4.1 contracts. The
brief's two additions are also in: the `not-done.ts` clauses for w24b's reasons, and the `REPAIR_INSTRUCTION` change.
Three deviations from the design are deliberate and listed under the open questions (1-3).

## What changed and why

- **`R/flow-bootstrap/unfinished-build/contracts.ts`**
  - `AutomationStudioFlowBootstrapUnfinishedStop` gains `"judged_wrong"`.
  - New `AutomationStudioFlowBootstrapJudgeSpend` and `AutomationStudioFlowBootstrapTestVerdict`, exactly as in 4.1.
  - New `AutomationStudioFlowBootstrapJudgedWrong`, the type of the judgement's `judge?`.
  - `AutomationStudioFlowBootstrapJudgement` gains `judge?` and `flowSignature?`.
- **`judgement.ts`**
  - New `automationStudioFlowBootstrapJudgeFinished({ round, steps, verdict, checklist })`. It returns
    `{ judgement, seed }`. The seed is `automationStudioFlowBootstrapRepairSeed(steps)`.
  - The judgement it builds has:
    - `stopped: "judged_wrong"`;
    - `tested: "replayed_clean"`, or `"not_tested"` when there is `untestedCarried`;
    - `done` and `todo` from the checklist;
    - `judge`;
    - `flowSignature` from `automationStudioFlowDraftReplaySignature(seed)`.
  - `JudgeUnfinished` now also stores `flowSignature`.
  - `JudgementValue` adds `judge` with `verdict`, `expected`, `observed`, `advice`, `findings` and `untestedCarried`.
    Each optional one appears only when it is set.
  - `JudgementAdvanced`: when either judgement has `judge`, a repair has advanced only if `flowSignature` changed or
    `done` rose. Otherwise the old rule applies.
- **`phases.ts`**
  - The input gains `judge?(…)`, with the 4.1 signature. The finished outcome gains `judged?`.
  - A `finished` round with no `judge` returns exactly as before.
  - With `judge`, the round:
    - announces `verifying: Judging the Flow`;
    - calls the judge with `remaining(input, spent, elapsed).budget`;
    - adds the judge's spend to `spent`, with 0 iterations, tool calls and evidence bytes.
  - What the verdict leads to:
    - `yes`, `unknown` or `not_judged` without `untestedCarried`: `finished` with `judged`.
    - `no`, or `unknown`/`not_judged` with `untestedCarried`: `JudgeFinished`, then the same repair path as an
      unfinished round. That path is `previous`/`JudgementAdvanced` (else not doable), then `maxRepairRounds`,
      `maxRounds` and `exhaustedBound`. The repair is announced as "Repairing the Flow" with the judge's reason, and
      `resume()` carries the judgement with `stopped: "judged_wrong"`.
    - A judge that throws an `AbortError` gives `ended` with `llm_evidence_loop.cancelled`. Any other throw passes
      through.
  - The tail of the loop now reads a local `Phase2` record (stopped, judgement, seed, lastIssueCodes,
    completionAttempts, progress) instead of `ending`, so both paths share it. `callerEnding` still applies only to
    rounds that stopped short.
- **`not-done.ts`**
  - `TODO_WORDS` now covers `AutomationStudioInstructedActObjectTodo`, with clauses for
    `step_acts_on_another_object`, `quantity_is_a_repeat` and `quantity_presses_differ`. They used to fall back to
    "nothing I tried did it".
  - `STOP_WORDS.judged_wrong` added.
  - `TestSaid` gives a judged judgement its own sentence. A clean run is never said to have run "without failing" or
    to have done what was asked, and carried steps that were not run are named.
  - New export `automationStudioFlowBootstrapRepairingJudgedSaid`, the repair announcement. It moved here from
    `phases.ts` to keep `phases.ts` under the 400-line advisory limit; it is now 397 lines.
- **`not-doable.ts`**: with `judge`, the message is built in this order:
  1. "it was tested from its start and judged not to do what you asked", followed by what you asked (expected) and
     what its test did (observed), quoted and bounded to 200 characters each;
  2. the checklist clause, as today, when anything is not done;
  3. the test sentence;
  4. "... and the last repair handed back the same Flow as the one before it."
- **`R/llm/evidence-loop/resume.ts`**
  - `stopped` widens to include `"judged_wrong"`.
  - New `JUDGED_INSTRUCTION`, used when `judgement.judge.verdict === "no"`, with the design's wording.
  - New `UNJUDGED_INSTRUCTION`, used for an unsure verdict sent back for carried steps.
  - With `untestedCarried`, both add "Steps 5, 6, 7, 8, 9 were carried from the earlier Flow and not run in this
    build: rerun them live (amend_draft rerun), so the test runs them."
  - In `REPAIR_INSTRUCTION`, "complete only when every act and choice on the checklist is done" becomes "complete
    when the Flow does what the instruction asks".
- **Tests**
  - New `unfinished-build/tests/judged.test.ts`, 9 cases, with a scripted judge:
    - judged yes, with the judge's cost in the accounting and the judge given $0.22 of the $0.25;
    - judged no, then repaired. The repair is seeded with the Flow and carries `judge.observed`/`findings` and the
      judged instruction. It then finishes judged yes. The trace is numbered 1-4 across rounds, both judges' spend is
      counted, and the repair's purse is $0.216;
    - judged no twice on the same Flow: not doable, with the judge's words in the message, and kept as
      `judged_wrong`;
    - judged no with `maxRepairRounds: 1` on a different Flow: `repair_rounds`;
    - `unknown`: finished with `judged.verdict === "unknown"`;
    - `unknown` with `untestedCarried: [5..9]` (run 41): a repair, told to rerun those steps, with its announcement;
    - no cost left: the judge receives `maxCostUsd: 0` and returns `not_judged`, so the build ends finished and
      unverified;
    - an `AbortError` from the judge gives `ended` cancelled;
    - any other judge error passes through.
  - `tests/not-done.test.ts`: plus 3 cases, one for each new clause.
  - `llm/evidence-loop/tests/resume.test.ts`: the existing repair case now expects the new phrase. Plus 2 cases: the
    judged instruction, and the carried-steps sentence.
  - `phases.test.ts` is unchanged and green, which shows behaviour without `judge` is unchanged.
- The files I wrote through Python came out with LF line endings. I converted them back to CRLF to match the tree.
  `git diff --stat` shows only content lines: 8 files, 396 insertions and 53 deletions before the move into
  `not-done.ts`.

## Commands run and observed results

- Baseline, before any edit:
  `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build src/programs/automation-studio/runtime/llm/evidence-loop`
  printed `Test Files 28 passed (28)`, `Tests 163 passed (163)`.
- The same command after the change, and again after the final move:
  `Test Files 29 passed (29)`, `Tests 177 passed (177)`.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t195-w26c tsc" npx tsc --noEmit -p tsconfig.json`, run in
  `packages/fluxiq`: it printed `[heavy] t195-w26c tsc holds b1` and no diagnostics, with exit 0. It ran three times,
  each clean.
- Revert check:
  - I copied my six source files to the scratchpad and wrote `git show HEAD:<path>` over each. I did not touch any
    git history.
  - Against the old sources, vitest gave `Tests 15 failed | 40 passed (55)`. Every new case failed: 9 in judged, 3
    in not-done and 2 in resume, plus the changed resume case.
  - I then restored my files. `git status` shows them modified again.
- `node scripts/structure-audit.mjs` at the Core root exits 1 because of one violation, which is not mine:
  `FAIL [exported-values] .../result-verification/build-test/tests/build-test-drafts.ts: 19 exported values,
  exceeding the 15-value limit`. That file belongs to W4. Nothing in `unfinished-build/` or `resume.ts` is reported.
  The `phases.ts` 413-line warning from the first run is gone at 397 lines.

## Not verified

- Integration with the real judge (W4) and `service.ts`. Nothing in `service.ts` passes `judge` yet, so the live path
  is unchanged until the lead integrates it.
- Whether W4's judge throws `AbortError` on cancel, or returns `not_judged`. Phases treats a thrown `AbortError` as
  cancelled and lets every other throw through.
- Whether `amend_draft rerun` on a seeded `f<n>` step yields a step with `replay`, as the design already noted. The
  carried-steps instruction relies on it.
- No full suite was run, as the brief requires. Only the two directories above were run.

## Open questions or contradictions found

1. **Deviation: `judge.verdict` is `"no" | "unknown" | "not_judged"`, not only `"no"`.** The `untestedCarried`
   repair carries an unsure verdict, and storing it as `no` would tell the model the Flow was judged wrong when it
   was not judged at all. Its `why` is kept in `findings`. The type is internal to `unfinished-build` plus
   `resume.ts`, so no other worker reads it.
2. **Deviation: `JudgementAdvanced` uses the signature rule when *either* side has `judge`**, where the design said
   `before.judge`. The case this covers:
   - a round stops short and is repaired;
   - the repair hands back the same Flow, which is judged no.

   This is not doable by the user's rule. The old count rule would reach the same answer in most cases, but not by
   that rule.
3. **Addition: an announcement `verifying: Judging the Flow` before the judge**, so the chat shows the step. It was
   not in the design.
4. **Lead hunk, outside my files: `R/flow-bootstrap/incomplete-draft/parse.ts:21`.** `resume.ts`'s `stopped` now
   includes `"judged_wrong"`, and `keep()` records it on a not-doable ending after a judge. `parse.ts` rejects any
   value outside its list, so that kept draft would not be continued. Exact hunk:
   ```ts
   -const STOPPED: readonly string[] = ["iterations", "budget", "tool_calls", "unusable_decisions", "repeat_without_progress"];
   +const STOPPED: readonly string[] = ["iterations", "budget", "tool_calls", "unusable_decisions", "repeat_without_progress", "judged_wrong"];
   ```
5. **`service.ts`, for the lead:**
   - pass `judge` exactly as in design 4.6 item 2;
   - on a `finished` outcome, a `judged.verdict` other than `"yes"` (`unknown` or `not_judged`) means the proposal is
     unverified. `service.ts` must surface that, because phases only returns it;
   - W4's judge should return `not_judged`/`unknown` for provider failures rather than throw, because phases passes
     a non-abort throw through.
6. **`untestedCarried` with no budget left.** The repair hits `exhaustedBound`, and the build ends with the budget
   ending, the Flow kept as an incomplete draft rather than proposed. This follows the user's run-41 exception
   (never accept carried claims), but it conflicts with the design's "not_judged ... never thrown away". It is the
   lead's call.
7. `EXPLORE_AGAIN_INSTRUCTION` (`resume.ts`) still says "Complete only when every act and choice on the checklist is
   done". The design named only `REPAIR_INSTRUCTION`, so I left it.
8. `R/flow-bootstrap/instructed-acts/checklist.ts:66-73` says an ending uses the general clause for the object
   reasons "until it has its own". That is now stale. W2 owns that file.
