# t367: the Lab accepts a promoted candidate and checks it with its own playback and oracle

Worker: t367-lab-candidate-pass. Worktree `fxwork/t367-lab-accepts-promoted-candidate` (branch
`task/t367-lab-accepts-promoted-candidate`, at `ee9200f6`). No commits, no provider calls, no paid runs, no override files.

## Outcome

Done. In candidate mode, the Lab now accepts a proposal that carries the promotion's `candidateTrial` audit, even when
the legacy evidence-loop audit is missing. It records the candidate, its trials and the deciding verdict, then continues
to the same fixture reset, playback page, run, oracle and evidence as a legacy build. Legacy mode still requires the
evidence audit. A candidate-mode proposal with no whole promotion is still refused with
`lab.proposal_without_evidence_audit`. A candidate draft still fails as `runtime.behavior` / `lab.candidate_not_promoted`
(the existing t348 test, unchanged and passing).

## What changed and why

Cause (round 6, `run-muz2cj6p-80eb2179`): `readCreatedFlowBuild` failed every proposal without `evidenceLoop` as
`lab.proposal_without_evidence_audit`. Both callers read the candidate promotion only after that check had passed. So
the chat path never reached `build-from-chat.ts:203-205`, `flow-lane.json` recorded `candidate: null`, and the lane
threw at the build stage.

- `packages/test-runner/src/flow-lane/creation/build-proposal.ts`
  - `readCreatedFlowBuild` takes an optional `authoringMode`.
  - In `candidate` mode it reads the promotion (`readCreatedFlowCandidatePromotion`) from the proposal's `created`
    audit event. It keeps the result on the build as `candidateOutcome` on every ending, including a refusal.
  - When `evidenceLoop` is absent, the promotion takes its place only if it is whole (`isWholeCandidatePromotion`):
    outcome `promoted`, verdict `yes`, a trial run id, a revision, a digest and at least 1 judge call. Otherwise the
    refusal stays `lab.proposal_without_evidence_audit`.
  - When `evidenceLoop` is present, the existing call-count and page-evidence checks apply unchanged, in both modes.
  - The direct path's `proposed()` passes the mode. The separate `withCandidate` re-read was removed, so the number of
    Core calls is the same as before.
- `packages/test-runner/src/flow-lane/creation/chat/build-from-chat.ts`
  - Passes `authoringMode` to `readCreatedFlowBuild`.
  - The applied branch now takes `candidateOutcome` from `read.build` instead of reading it a second time. The unused
    import was removed.
- `packages/test-runner/src/flow-lane/creation/candidate-outcome.ts`
  - `readCreatedFlowCandidatePromotion` now sets `verdict: "yes"` on the trial session that promoted the candidate (the
    one whose `runId` matches the audit's trial).
  - Core names no verdict for the other trials on a success, so theirs stay `null`.
- Tests
  - `tests/chat-core.ts` (new): the chat-entry fake (`chatCore`), moved unchanged out of `lane.test.ts` so the candidate
    tests can use it. `lane.test.ts` now imports it, and its unused `CreatedFlowLaneEntry` import was dropped.
  - `tests/lane-candidate.test.ts`: three new tests.
    1. **Round 6 shape, fail-first.** Chat entry, candidate mode, `evidenceLoop: null`, a `candidateTrial` audit
       (revision 4, `trial.4` yes, 2 judge calls, 4 trials) and four reset-start trial sessions (three failed, one
       succeeded). The run now passes, and the reset, playback page, run, oracle and publish happen in that order. The
       chat's proposal is not applied a second time. `candidateOutcome` matches the full expected record, with verdicts
       `[null, null, null, "yes"]`, and the snapshot names the candidate and the promoted adaptation.
    2. **Direct build, fail-first.** The same audit without an evidence loop, built by the Lab directly, is approved,
       applied, reset, run and checked by the oracle.
    3. **Refusals.** Each of these is refused with `lab.proposal_without_evidence_audit`, with no reset, run or oracle,
       on both the direct and the chat path:
       - legacy mode with no audit, even though the proposal carries a promotion;
       - candidate mode with no promotion;
       - a promotion whose trial verdict is `no`;
       - a promotion with 0 judge calls;
       - a promotion with no trial run id.

## Commands run and observed results

All commands ran in `fxwork/t367-lab-accepts-promoted-candidate`.

1. **Fail-first.**
   - `git apply -R <scratch src patch>` (tests kept, fix removed), then `pnpm run build` in `packages/test-runner`.
   - `node --test dist/flow-lane/creation/tests/lane-candidate.test.js` -> `# tests 7`, `# pass 5`, `# fail 2`.
   - Test 5 (round 6) failed with
     `FluxIQ did not build a Flow from the task's instruction (lab.proposal_without_evidence_audit); it said: "Created the Flow \"x\"."`,
     the same refusal as round 6.
   - Test 6 (direct) failed with the same code.
   - Test 7 (the refusals) passed before the fix, as it should.
2. **Fix re-applied** (`git apply <patch>`).
   - `pnpm run build` -> core-build current, domain reused, `test-runner:build` built with no tsc errors.
   - `node --test "dist/flow-lane/creation/**/*.test.js"` -> `# tests 159`, `# pass 159`, `# fail 0`.
3. **Wider set.** `node --test "dist/flow-lane/**/*.test.js" "dist/live-llm/**/*.test.js"` -> `# tests 601`,
   `# pass 601`, `# fail 0`.
4. **Test-runner typecheck.** `pnpm run check` in `packages/test-runner` -> `test-runner:check` ran with no errors.
5. **Structure audit.** `node scripts/structure-audit.mjs` -> `structure-audit: passed (177 warning(s), 257 baselined).`
   It made no baseline change. `git status` lists only the five modified files and the new `tests/chat-core.ts`.

## Not verified

- No live or Lab run: no paid run was allowed. The real Core's `list-runtime-sessions` was never exercised for a
  promoted chat build, so whether the trial sessions' `flowId` matches the Flow the chat made (which `trials` depends
  on) was not checked against a live Core. If they do not match, `trials` is empty, but acceptance does not depend on
  `trials`.
- `providerCalls` and `loopProviderCalls` stay `null` for a promoted candidate, because Core puts no call count on that
  proposal. Round 6's settlement and spend ledger handled a null count (it reached the lane's build check), but that
  path was not re-run here.
- I did not touch the `unchanged` live guard (L2 in the t342 report). It is outside `packages/test-runner/`, so the
  next run on unchanged source may still be refused until the supervisor resolves that.

## Open questions or contradictions found

- The brief mentions "the trial verdicts t362 put on the result". On a successful promotion, Core records only the
  deciding trial's verdict, in `candidateTrial.trial.verdict`. Per-trial verdicts exist only on a failed build's
  diagnostic (`diagnostic.candidate.trials`). So on a pass, the record has the deciding verdict and `null` for the
  other trials. Recording every trial's verdict on a pass would need Core to add them to the promotion's audit (Core
  `runtime/service/candidate-trial/promotion.ts`), which is frozen here.
- The debug file suggested still requiring "a call count and page evidence" for a candidate proposal. A promoted
  candidate's proposal carries neither, so requiring them would refuse round 6 again. The trial audit (judged yes, trial
  run, revision, digest, at least 1 judge call) is the evidence used instead.
