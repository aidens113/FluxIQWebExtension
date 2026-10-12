# Lane C r3 fix A: a completion with nothing submitted says so, and the ending says so

## Outcome

Done. Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t274/!FluxIQ` (branch task/t274-live-lane-c), uncommitted.

## What changed and why

All under `packages/fluxiq/src/programs/automation-studio/runtime/`.

- `flow-bootstrap/candidate/authoring-loop.ts`: `checkCompletion` now refuses in one of two ways, both still under
  `candidate.latest_submission_required`. I kept the single code because the only other references are comments in
  `llm/loop-budget.ts` and its test. Nothing in Core or the extension tree keys on the code's value.
  - No accepted submission (`controller.latest()` undefined): the feedback has `submitted: false`. The instruction says
    "No Flow has been submitted yet, so there is no revision or digest to complete with: never invent them. Write the
    whole Flow and submit it with core.submit_candidate; test the revision it returns with core.test_candidate; then
    complete with that revision and digest exactly as core.submit_candidate returned them." The test step appears only
    when a trial runner is available (`gate.available`).
  - A submission exists but the result does not match it: the feedback has `submitted: true` plus `revision` and
    `digest`. The instruction gives the exact `{"revision": N, "digest": "..."}` to complete with, adds "after
    core.test_candidate has answered yes" only when a trial runner is available, and otherwise says to submit the whole
    Flow again and complete with what it returns.
  - None of this wording mirrors a scenario.
- `conversations/commands/progress.ts`: added `neverSubmittedWords`, which runs after `refusedWords` for the
  no-progress code. It applies only when the diagnostic's `issueCodes` include `candidate.latest_submission_required`
  and the build carries no refused submission (in that case `refusedWords` answers first and is unchanged). The
  `candidate` must also show no accepted revision and `trialCount === 0`. The ending is then: "the build failed: it
  never wrote a Flow to test: it kept trying to finish without one, so it was stopped". Without a candidate, or once a
  revision was accepted or tested, the old words stay.
  - Where this comes from: `context.unusable(..., attempt.issueCodes)` in `llm/decision-handlers/completion.ts` passes
    the stall's codes to `candidate-generation.ts` `stalled`. There, `automationStudioCandidateStallCode` gives
    `evidence_repeat_without_progress` because the code is not a reply-shape code, and `submissions.codes` is empty
    because nothing was refused. `flowBootstrapEvidenceUnusableDecisionFailure` keeps the `issueCodes`, and
    `with-candidate.ts` adds `candidate` with `draft: "none"`, no revision and `trialCount` taken from the trial records.
- The diagnostic has no count of completion attempts, so the ending says "kept trying to finish" without "N times".
  `service/candidate-failure/` was not touched.
- Tests:
  - `flow-bootstrap/candidate/tests/authoring-loop.test.ts`: new describe "a completion the loop refuses says why".
    One case covers nothing submitted: the instruction, no revision offered, no test tool without a trial runner, and
    the stall carrying the code. The other covers a submission with the wrong revision: the latest revision and digest
    are named.
  - `conversations/commands/tests/candidate-endings.test.ts`: new describe "a candidate build that never submitted a
    Flow says so". It checks the new ending and that it reads plain; that the old words stay when a revision was
    accepted, a trial ran, or no candidate is carried; and that the refused-submission ending is unchanged.

## Commands run and observed results

All run from `packages/fluxiq` unless noted.

- `pnpm.cmd exec vitest run .../candidate/tests/authoring-loop.test.ts .../commands/tests/candidate-endings.test.ts`:
  2 files passed, 23 tests passed.
- `pnpm.cmd exec vitest run .../flow-bootstrap/candidate/tests .../conversations/commands/tests .../llm/tests/loop-budget.test.ts .../service/candidate-failure/tests`:
  19 files passed, 208 tests passed. After the statement-packing fix, `authoring-loop.test.ts` was re-run: 9 passed.
- `pnpm.cmd run check`: the build cache answered "reuse ... inputs and outputs match the stamp", so I also ran
  `npx.cmd tsc --noEmit -p .`, which exited 0 with no output.
- `node scripts/build-cache/cli.mjs structure-audit:check`, run from the Core root:
  - First run: FAIL statement-packing in `authoring-loop.test.ts`, on my lines 141 and 173 and the baselined line 84.
  - After fixing my two lines: "structure-audit: passed (330 warning(s), 1159 baselined)".

## Not verified

- No live run: I did not check how the model reacts to the new instruction.
- I did not run a full `candidate-generation` integration that confirms the end-to-end diagnostic has `trialCount: 0`
  and the code. The chain was traced by reading the code, and the stall codes were asserted in the authoring-loop test.
- The ending does not count attempts, because the diagnostic carries no count.

## Open questions or contradictions found

- The brief's example "tried to finish N times" cannot be built from what the failure carries. Adding a count would
  mean a new code in `service/candidate-failure/` and the stall path. I left that out as the brief preferred.
- `pnpm check` reused a stale-looking stamp despite the source changes. That is worth a look at the build-cache input
  set for `fluxiq:check`.
