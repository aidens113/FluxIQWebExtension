# t549-w4-lab-project-mode

## Outcome

Done. The first pass built all five brief items inside the files the brief
named. The supervisor's follow-up then authorized the wiring in the other files,
which is now done too. A project-mode run is admitted, built from the chat,
read and costed the same way as a candidate run, and the per-role spend reaches
the run's report.

## What changed and why

- `packages/test-runner/src/flow-lane/creation/readiness.ts`
  - New `CREATED_FLOW_TRIAL_AUTHORING_MODES` (`candidate`, `project`), type
    `CreatedFlowTrialAuthoringMode`, and `createdFlowTrialsCandidates(mode)`.
    These are now the single test for "builds in this mode are tested
    candidates". Only the exact spellings count.
  - `createdFlowVerificationReady` and `assertCreatedFlowVerificationReady`
    let `project` in on exactly the candidate terms. The refusal codes are the
    same (`lab.candidate_verification_unavailable`,
    `lab.candidate_start_hook_unset`, `lab.candidate_start_hook_set`), and the
    details carry `authoringMode: "project"`. The wording is a project build's
    own, held in a per-mode `REFUSAL_WORDS` table.
  - New `assertLabModelResetOnlyApplies({ modelResetOnly, authoringMode })`.
    This is the `--model-reset-only` refusal moved out of `cli.ts` so it can be
    tested. It allows both `candidate` and `project`.
- `packages/test-runner/src/cli.ts:120-125`: uses
  `assertLabModelResetOnlyApplies`. It now gives the plan-side `candidateTrial`
  readiness to `project` runs as well, through `createdFlowTrialsCandidates`.
- `packages/test-runner/src/flow-lane/creation/candidate-outcome.ts`
  - `CreatedFlowCandidateOutcome.authoringMode` is now
    `CreatedFlowTrialAuthoringMode`.
  - The four readers take an optional trailing `authoringMode`, defaulting to
    `candidate`, and record it on the outcome. The readers are
    `readCreatedFlowCandidatePromotion`, `createdFlowCandidateDraftOutcome`,
    `createdFlowChatCandidateDraftOutcome` and
    `createdFlowFailedCandidateOutcome`.
  - `createdFlowCandidateDraftFailure` says "its assembled project candidate"
    and puts the outcome's own mode in its details.
  - Otherwise a project build is read exactly as a candidate build: same
    proposal audit and same draft. This follows the brief's statement that the
    promotion owner and the draft are the same.
- `packages/test-runner/src/live-llm/step-log-spend.ts`
  - `LiveLlmStepLogSpend` gains `largestInputTokens`: the largest
    `meta.usage.inputTokens` of any one provider call.
  - It also gains `byRole`: role, then calls, cost, largest input and
    `byBrief`, with the same three figures per brief. It is read from Core's
    `meta.role` and `meta.briefId` (Core `llm/step-log/model-step.ts:93`).
  - New exported types `LiveLlmStepLogAgentSpend` and
    `LiveLlmStepLogRoleSpend`.
  - A step that names no role is not counted in `byRole`. A role or brief that
    is not an identifier is not counted under it.
- Tests:
  - `flow-lane/creation/tests/readiness.test.ts`: project admitted; project
    refused with no trial runner, with no start reset, and with a hook under
    `--model-reset-only`; `Project` and ` project` refused; the CLI flag.
  - `flow-lane/creation/tests/candidate-draft.test.ts`: two project-build
    fixture tests appended (promoted; draft by direct, chat and failed paths;
    the draft failure). I put them here and not in a new
    `candidate-outcome.test.ts` because a new file put `creation/tests/` at 26
    files, over the 25-file structure limit.
  - `live-llm/tests/step-log-spend.test.ts`: a step-log fixture with two
    briefs, a supervisor and a repair agent, with input token counts that are
    present, malformed and null. The first test's expected object now includes
    `largestInputTokens: null` and `byRole: {}`.
- `docs/architecture/testing-facility.md`:
  - The authoring-mode list now includes `project`.
  - New paragraph "Project mode (automation-project-agents-plan, W4)" after the
    `--model-reset-only` section, covering readiness, outcome, the flag and
    per-role spend.
  - New paragraph on `largestInputTokens` and `byRole` after the step-log
    spend paragraph.

### Follow-up wiring (supervisor-authorized)

All paths are under `packages/test-runner/src/` unless noted.

- `environment.ts`: `labCandidateStartHookEnvironment` gives the start hook to
  any mode `createdFlowTrialsCandidates` accepts, which now includes
  `project`. It imports from the `./flow-lane/index.js` barrel, because the
  structure audit refuses a deep import.
- `flow-lane/creation/lane.ts`:
  - The readiness read now uses the shared check.
  - So does the guard against a proposal that names no tested candidate. That
    refusal now names the mode in its message and carries
    `details.authoringMode`.
- `flow-lane/creation/chat/build-from-chat.ts`:
  - The late-draft wait uses the shared check.
  - The chat-draft and failed-build readers get the run's mode.
  - `failedBuildOf` now takes `trialMode: CreatedFlowTrialAuthoringMode | null`
    instead of a boolean.
- `flow-lane/creation/build-proposal.ts`:
  - `readCreatedFlowBuild` uses the shared check and passes the mode to
    `readCreatedFlowCandidatePromotion`. This function serves the chat path as
    well as the direct build.
  - The test-only direct build stays on candidate, as instructed. In a project
    run it refuses before any provider call with
    `facility.contract` / `lab.direct_build_project_mode`, so it never quietly
    builds as some other mode. Lines 397 and 414 deliberately still say
    `candidate`.
- `live-llm/run-spend.ts`: `LiveLlmStepLogReconciliation` gains
  `largestInputTokens` (`null` when the log has none) and `byRole` (`{}` when
  the log has none). These reach `snapshots/live-llm.json`
  `runSpend.stepLog`, through `live-llm-run.ts:698`.
- `live-llm/index.ts`: exports `LiveLlmStepLogAgentSpend` and
  `LiveLlmStepLogRoleSpend`.
- `live-llm/authoring-mode-env.ts`: the error wording and header now list
  `project`. `scripts/lab/live-campaign/arguments.mjs:24`: usage now reads
  `legacy|candidate|project`.
- Tests:
  - `tests/environment.test.ts`: a project Core gets the hook; a
    `--model-reset-only` project Core gets none.
  - `flow-lane/creation/tests/lane-candidate.test.ts`, two tests:
    - project mode reads readiness first and refuses with no hook; a promoted
      project candidate that the chat applied reaches reset, playback, oracle
      and publish, recorded as `project`;
    - an unattributed project proposal is refused, and the direct build is
      refused before Core is asked to build.
  - `flow-lane/creation/chat/tests/build-from-chat.test.ts`: one test covering
    the late draft, the promotion, the failed build and the missing-hook
    refusal in project mode.
  - `live-llm/tests/run-spend.test.ts`: the new fields pass through, and an
    older log gives `null` and `{}`.
  - `live-llm/tests/live-llm-run.test.ts`: the `runSpend.stepLog` snapshot
    expectation gains the two fields, which shows they reach the report.
- `docs/architecture/testing-facility.md`: the project-mode paragraph now
  covers the start hook and lane, says project builds start from the chat only
  and that the direct build is refused, and gives where per-role spend sits in
  the report.

## Commands run and observed results

- `pnpm check` (packages/test-runner): core-build said "FluxIQ Core's build at
  ...fxwork/t549/!FluxIQ is current with its source"; `test-runner:check`
  passed with no tsc errors (run twice, the second after the test move).
- `node ../../scripts/build-cache/cli.mjs test-runner:build`, then `node --test`
  on these 7 test files (dist): readiness, candidate-draft, step-log-spend,
  run-spend, build-usage, tests/commands, lane-candidate.
  - Result: `# tests 83 # pass 83 # fail 0`.
  - The first run failed 1 test: my draft fixture had a digest Core's parser
    rejects. I fixed the fixture and re-ran.
- `pnpm structure:check` (repo root): the first run failed on two things, the
  26-file limit and statement packing in my new test file. I moved the tests
  and unpacked the statements. Re-run: `structure-audit: passed (194
  warning(s), 644 baselined)`.

Follow-up run:

- `pnpm check` (test-runner): **refused by the core-build gate**. It reported
  "FluxIQ Core's build ... is 15 minute(s) behind its source", with stale file
  `runtime/flow-bootstrap/action-permissions.ts`. That is the Core worker
  editing at the same time. As instructed, I ran `npx tsc -p tsconfig.json
  --noEmit` directly instead: no output, exit 0, both before and after the
  last fix.
- `node ../../scripts/build-cache/cli.mjs test-runner:build` (no gate), then
  `node --test` on 14 test files (dist): readiness, candidate-draft,
  lane-candidate, lane, build-proposal, build-proposal-call-count,
  build-from-chat, step-log-spend, run-spend, build-usage, live-llm-run,
  authoring-mode-env, tests/environment, tests/commands.
  - First result: `# tests 210 # pass 208 # fail 2`. One failure was my
    build-from-chat fixture: the failed-build diagnostic lacked the accounting
    Core's parser requires, so I fixed it. The other was the live-llm-run
    snapshot expectation needing the two new fields, so I updated it.
  - Re-run: `# tests 210 # pass 210 # fail 0`.
  - After moving the environment import to the barrel I rebuilt and re-ran
    environment, lane-candidate, readiness and commands:
    `# tests 69 # pass 69 # fail 0`.
- `node --test scripts/lab/live-campaign/tests/arguments.test.mjs
  scripts/lab/live-campaign/tests/command-line.test.mjs`: `# tests 8 # pass 8
  # fail 0`.
- `pnpm structure:check`: the first run failed one `[imports]` rule on the
  deep import in `environment.ts`. I moved it to the barrel. Re-run:
  `structure-audit: passed (194 warning(s), 644 baselined)`.

## Not verified

- Any real project-mode run, live or provider-free (no live run, per the
  brief). Project mode was exercised only against the fake Core in the lane
  and chat tests.
- The follow-up build and tests compiled against Core's dist, which was 15
  minutes behind Core's source because A5c was being edited at the same time.
  They need re-running once Core is rebuilt.
- Whether A5c's chat build actually answers in project mode with the same
  draft turn, promotion audit and failure diagnostic that the fake Core
  imitates.
- Whether Core A5c's step-log `usage.inputTokens` is filled on every decision.
  I only checked that the step-log writer emits it.

## Open questions or contradictions found

- Whether a chat build runs in project mode depends on Core: the chat build
  uses `configured`, which today resolves to `candidate` only
  (`conversations/commands/build.ts:138`, `api/handlers/llm-generation.ts:84`).
  A5c must make `configured` resolve to `project`, or the chat must ask for
  `project`. The Lab side needs nothing more either way.
- The refusal codes stay shared (`lab.candidate_*`). A8 tells the modes apart
  by `details.authoringMode`.
