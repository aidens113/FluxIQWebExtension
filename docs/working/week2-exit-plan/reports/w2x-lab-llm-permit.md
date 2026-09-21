# w2x-lab-llm-permit

Worker report, 2026-09-21. Task t036, worktree `F:\fxwork\t036-lab-llm-permit`
(branch `task/t036-lab-llm-permit`), shared Core `F:\fxwork\!FluxIQ` (read-only,
`2d3e69a`). All changes are uncommitted.

## Outcome

Done, with one file edited outside the owned list (see the first open question).
`pnpm lab run ... --llm-permit <class,...>` now puts exactly the named classes into
the execution grant's `permittedConsequences`. An unknown class is refused while
the command is parsed and again when the plan is built, which is before any key is
read or any provider is called. No grant carries a class nobody asked for: Core's
preflight and grant must report back exactly the requested set, or the run is
refused. Live run 2, made with `--llm-permit send_or_publish`, created the Flow,
raised no permission request, and passed its oracle with
`build.providerCalls == observed.calls` (5 == 5). The playback made 0 calls.

## What changed and why

- `packages/test-contracts/src/llm.ts`: adds `llmActionConsequences`, which mirrors Core's
  `AUTOMATION_STUDIO_ACTION_CONSEQUENCES` in Core's order, and the type `LlmActionConsequence`.
  `LlmExecutionProfile` gains the optional field `permittedConsequences`, which only a live
  run may carry. The field sits on the profile because the profile already travels unchanged
  from `commands.ts` to `planLiveLlmExecution`, so no `cli.ts`, lane or `live-llm-run.ts`
  change is needed.
- `packages/test-contracts/src/llm-validation.ts` (outside the brief's list): the strict
  profile validator accepts the new key, checks each entry against the class list, rejects
  duplicates, and rejects the field on a dry profile.
- `packages/test-runner/src/commands.ts`: kept to a minimal hunk. It adds `--llm-permit` to the
  first line of `llmOptionNames` (t027 appends at the end of that list), one spread in the
  profile literal, and the helper `permittedConsequencesOption` at the end of the file. The
  helper refuses empty entries, unknown classes and repeated classes. None of these lines is
  one that t027 or t033 changes (checked with `git diff dev...<branch>`).
- `packages/test-runner/src/live-llm/live-llm-plan.ts`: `LiveLlmPlan.permittedConsequences` is
  always present (empty without the flag) and in Core's order. Classes are judged against
  Core's own exported list. A repeated class is refused, and so is a permit on `diagnose`,
  which takes no action.
- `packages/test-runner/src/live-llm/execution-grant.ts`: both the preflight and the issue
  request send the plan's set. A second grant (`override`, whose only use is `verify_result`)
  sends `[]`. `confirmedConsequences` holds what Core reports in the preflight and in the grant
  to exactly the request: an extra class, a missing class, or a missing field when a set was
  asked for is refused. A Core that reports nothing is accepted only when nothing was asked
  for. `LiveLlmExecutionGrant` gains `permittedConsequences`. The created-Flow playback grant
  (`repairPlan`, which spreads the plan) carries the operator's set as well.
- `scripts/lab/live-campaign.mjs`: documentation only. Everything after `--` already reaches
  each Lab run unchanged (`CAMPAIGN_OWNED_OPTIONS` does not include `--llm-permit`); run 2
  went through this path.
- Tests: `llm-contracts.test.mjs` (validator), `live-llm-plan.test.ts` (a pin of the mirror to
  Core's export, the plan's set and order, refusals), `execution-grant.test.ts` (the fake Core
  now echoes the set, and the tests cover what is sent, the override sending `[]`, and all
  seven mismatch refusals), and `commands.test.ts` (parsing and refusals).

## Commands run and observed results

Live runs first, both through the campaign from the worktree:

- The first attempt, `pnpm lab:campaign social-scheduler-schedule-post -- --target persistent-isolated --workspace t036-permit-a`,
  was refused before any provider call:
  `--target persistent-isolated conflicts with FLUXIQ_TEST_TARGET=existing`. The worktree's
  `.env.local` targets the user's own panel. Every later run was prefixed with
  `FLUXIQ_TEST_ENV_FILES=none`; the key is still read from `.env.local`.
- **Run 1, without the option, on `dev` code before any edit.** The campaign spawned
  `pnpm lab run social-scheduler --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-chat --llm-task create-flow --instruction-task social-scheduler-schedule-post --llm-max-input-tokens 48000 --llm-max-output-tokens 8000 --llm-max-total-tokens 56000 --llm-max-run-tokens 600000 --llm-max-cost-usd 0.25 --target persistent-isolated --workspace t036-permit-a`.
  Result: `F:\fxwork\t036-lab-llm-permit\test-runs\run-mubktq9k-5cb2485b`, campaign
  `2026-09-21T18-26-02-353Z`, `verdict: failed`, `flowCreated: false`,
  `llm.calls: 1`, `build.failure: {"code":"lab.generation_http_400","httpStatus":400}`,
  `build.permissionRequest: null`. No class was requested, so run 2 used `send_or_publish`,
  as the brief says. The workspace's `adaptations` table has 0 rows.
- **Run 2, with the option.** Same command plus `--workspace t036-permit-b --llm-permit send_or_publish`.
  Result: `F:\fxwork\t036-lab-llm-permit\test-runs\run-mubl2o09-5679c7f2`, campaign
  `2026-09-21T18-32-52-529Z`: `verdict: passed`, `flowCreated: true`,
  `oracleVerdict: passed`, judgement `playback goal: yes`, a created Flow of 10 nodes.
  `snapshots/live-llm.json` records `build.outcome: proposed`, `build.providerCalls: 5`,
  `observed.calls: 5`, `build.permissionRequest: null`, `build.instructedConsequences: []`,
  and evidence-loop tools that include `web.press_control`. The playback grant (`repair`,
  `diagnose_and_adapt`) shows `observed.calls: 0`. Totals: 50,930 tokens, $0.02305512.
- Evidence that the preflight listed exactly `["send_or_publish"]`: the compiled
  `packages/test-runner/dist/live-llm/execution-grant.js` that run 2 used (compiled in that
  run's own build at 11:33 local) refuses the run unless both Core's preflight and Core's grant
  report exactly the requested set. Run 2 got past the grant. See "Not verified".

Then the focused tests, then the check:

- `npx tsc -p tsconfig.json && node --test tests/llm-contracts.test.mjs` (test-contracts): `# tests 9 # pass 9 # fail 0`.
- `pnpm build` (test-runner), then `node --test dist/live-llm/tests/*.test.js dist/tests/commands.test.js`:
  `# tests 109 # pass 109 # fail 0`. All ten new tests are among them.
- `pnpm check` exited 0: structure tests 182/182; `lab:test` 75 tests, 74 passed, 0 failed, 1
  skipped (a pre-existing probe for a Core build under `scripts\!FluxIQ`, absent in this flat
  worktree); `task:test` 113/113; `structure-audit: passed (82 warning(s), 122 baselined)`;
  every package's `check` reported Done.

## Not verified

- No artifact records the preflight's list directly. `live-llm.json` writes `granted` field by
  field in `live-llm-run.ts`, which I don't own and which t035 is editing. The proof is the
  refusal check that run 2 passed through, plus unit tests. Core's stores hold no plain-text
  record of the set either.
- The no-permit path of the new code has not been run live. Run 1 ran on `dev` before the
  change, as the live-first order requires. With the new code a no-permit grant sends `[]`,
  which Core treats the same as absent; this is covered by unit tests.
- `--llm-permit` with `--llm-task repair` and with `matrix` was not run live. Design item 3's
  proof also needs C3.
- The full suites were not run, per the brief.

## Open questions or contradictions found

1. **Edit outside the owned list:** `packages/test-contracts/src/llm-validation.ts`. The brief
   assigns the `LlmExecutionProfile` type in `llm.ts`, but its strict validator lives in this
   file. Without the change, `assertLlmExecutionProfile` in `commands.ts` refuses every profile
   that carries the field. The only alternative was to attach the field after validation,
   which would leave a contract whose validator rejects its own type. The edit is 9 lines.
   Neither t027 nor t033 touches the file (`git diff dev...` checked). Revert it if you want
   the partition kept strictly and the field placed elsewhere.
2. **The no-permit build ended in an unclassified 400, not a permission request.** Run 1 made
   one call and then got HTTP 400 with no diagnostic the Lab could parse. Nothing was
   persisted, and no request reached the Lab. The same task with `send_or_publish` permitted
   succeeded in 5 calls. If that 400 is the permission ending, the needs-permission outcome is
   being lost between Core's gate and the generation handler: either
   `flow_bootstrap.unclassified_failure`, or a diagnostic that Core's own
   `parseAutomationStudioFlowBootstrapFailureDiagnostic` rejects. That contradicts "a blocked
   action escalates to the user". I could not tell the two apart: Core's handler
   (`api/handlers/llm-generation.ts:135`) drops the cause, and the Lab's `build-proposal.ts:188`
   keeps only the status. This needs a Core investigation, outside this brief.
3. The permitted set should be recorded in `live-llm.json` (`granted.permittedConsequences`,
   and the same under `repair.granted`) once t035 has landed `live-llm-run.ts`. It is a
   one-line addition in each place.
4. Design choice to confirm: the created-Flow playback grant (`diagnose_and_adapt`) carries the
   operator's permit, because `repairPlan` spreads the plan. The `verify_result` override
   carries none.
5. `build.instructedConsequences` was `[]` for an instruction to schedule a post. Either
   Core's instruction reading found nothing instructed, or it never ran because the grant
   already covered every press. The Lab cannot tell which.
