# t472: live candidate builds get the Lab's between-trial fixture reset again, with `--model-reset-only` to turn it off

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t472-live-fixture-reset-back-on`, branch
`task/t472-live-fixture-reset-back-on`. Nothing is committed. No paid run.

## Outcome

Done.

- Every candidate build, live or not, again gets the start hook, so the Lab resets the fixture between trials.
- `lab run ... --llm-task create-flow --authoring-mode candidate --model-reset-only` turns that reset off for a
  run meant to prove the model's own reset.
- The t470 admission check still applies in the off case. A Core that would still reset is refused before
  any provider call with `lab.candidate_start_hook_set`.
- The receipt's `candidateTrial.fixtureResetBetweenTrials` says which of the two the run does.

## What changed and why

- **`flow-lane/creation/readiness.ts`**
  - The policy is now `labCandidateTrialFixtureReset({ modelResetOnly })`, which returns `!modelResetOnly`.
    It used to be `({ live })`, returning `!live`.
  - The header comment records the t472 reason (lane D round 9, `run-mv5q4j2n-25784472`).
  - The `lab.candidate_start_hook_set` message now names `--model-reset-only`.
  - The admission logic is unchanged.
- **`commands.ts`** (not in the brief's owned list; needed to parse the flag the brief asks for)
  - `run` accepts `--model-reset-only`. The flag takes no value and may be given once.
  - It is allowed only with `--live-llm --llm-task create-flow`, the same rule as `--dry-run` and
    `--direct-api-build`.
  - The parsed command gets `modelResetOnly?: true`.
  - `directApiBuildOption` became a shared `flagOption(args, flag)` for both flags.
  - The usage text lists the new flag.
- **`cli.ts`**
  - The flag is refused unless `--authoring-mode candidate` is given. The error is "--model-reset-only applies to
    a candidate build's trials: pass --authoring-mode candidate".
  - The dry-run and pre-start `candidateTrial` is computed from the flag.
  - `modelResetOnly` is passed to `runScenario`.
- **`run-scenario.ts`**
  - New `RunScenarioOptions.modelResetOnly`.
  - The topology's `candidateTrialFixtureReset` and the created-Flow lane's `candidateTrialFixtureReset` both come
    from the policy with it. The policy no longer reads `live: true`.
  - The file is still 800 lines.
- **`environment.ts`, `coordinator.ts`, `flow-lane/creation/lane.ts`**: doc comments only. Behaviour was already
  driven by `candidateTrialFixtureReset`, and absent still means `true`.
- **Tests**
  - `readiness.test.ts`: the policy test now covers on-by-default and off with `modelResetOnly`.
  - `environment.test.ts`: the test was renamed and now also checks that an absent setting keeps the hook.
  - `commands.test.ts`: a new test covers parsing, the once-only rule and create-flow only.
- **`docs/architecture/testing-facility.md`**: a new "Proving the model's own reset: `--model-reset-only`
  (t470, t472)" paragraph after the candidate-mode admission text.
- **Model reset gate**: it keeps running. Core's `flow-bootstrap/candidate/authoring-loop.ts` wires the
  site-reset gate from the site-reset ledger, independent of `prepareStart` (the hook). In
  `candidate-trial/run.ts`, the hook only resets the fixture after the gate admits. No Core change.

## Commands run and observed results

- **Test-runner build:** `pnpm --filter @fluxiq-web-extension/test-runner build` exited 0. It printed:
  - `core-build: ... current`
  - `{"build-cache":"build","step":"test-runner:build",...}`

  After the environment-test edit I ran `npx tsc -p tsconfig.json` again, with no errors.
- **Tests beside the changed files:** `node --test` over these files, in `dist/`:
  - `flow-lane/creation/tests/readiness.test.js`
  - `tests/commands.test.js`
  - `tests/environment.test.js`
  - `tests/cli-llm.test.js`
  - `flow-lane/creation/chat/tests/build-from-chat.test.js`
  - `flow-lane/creation/tests/lane-candidate.test.js`
  - `flow-lane/creation/tests/lane.test.js`
  - `tests/coordinator-existing.test.js`
  - `tests/coordinator-persistent.test.js`

  Result: `# tests 133`, `# pass 133`, `# fail 0`.
- **Dry run, default:** `FLUXIQ_TEST_TARGET=persistent-isolated pnpm lab run social-network-feed --live-llm
  --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --authoring-mode candidate
  --llm-task create-flow --instruction-task social-network-feed-confirm-requests --target persistent-isolated
  --workspace t472-dry --dry-run`. Exit 0. Output: `"status":"ready"`, `"providerCallCount":0`,
  `"candidateTrial":{"trialRunner":true,"startReset":true,"fixtureResetBetweenTrials":true,"source":"lab-plan"}`.
- **Dry run with `--model-reset-only`:** the same command plus the flag. Exit 0. Output: `"status":"ready"`,
  `"providerCallCount":0`,
  `"candidateTrial":{"trialRunner":true,"startReset":false,"fixtureResetBetweenTrials":false,"source":"lab-plan"}`.
- **Dry run with the flag but no `--authoring-mode candidate`:** exit 1. Output:
  `{"status":"failed","category":"unknown","message":"--model-reset-only applies to a candidate build's trials:
  pass --authoring-mode candidate"}`.
- **Structure audit:** `node scripts/structure-audit.mjs` printed `structure-audit: passed (186 warning(s), 646
  baselined).`

## Not verified

- No live (paid) run was made, so `fixtureResetBetweenTrials` was not observed in a real lane receipt. The
  lane-side read is covered by `readiness.test.ts` and `lane-candidate.test.ts`.
- No full `pnpm test` or `pnpm check` run (per the twice-a-day rule).

## Open questions or contradictions found

- `commands.ts` was edited even though the brief did not list it. A CLI flag cannot exist without that parser.
- No environment variable was added. The Lab's created-Flow flags (`--direct-api-build`, `--dry-run`) have none,
  so the pattern does not call for one.
- A refused flag reports `category: "unknown"` because it is a plain `Error`, like the other parser and cli
  refusals.
- t470 had not updated `testing-facility.md`, so the new paragraph covers both t470 and t472.
