# Script drift: company-website-apprentices

## Outcome
Done. The baseline provider-free run passes on all 4 attempts.

## Cause
The script (`packages/test-runner/src/attempt-lane/scripted-model/scripts/company-website-apprentices.ts`) held `loop_verification: [answersRequest]`, one judge reply, and `panel_command: [startAttempt]`, one chat reply. That is a one-attempt script. The Lab's default `--attempts 4` series asks the judge once per attempt, and later attempts type the instruction again. Evidence in the prior run (run-mwbu389o-17514ba5): two judge requests in attempt 1 (steps 0024-judge and 0039-judge); the second was refused. It is a fixture sizing defect, not Core or runner: Core's judge is answered by the script as designed, and the sibling scripts (crossborder `2 * attempts`, local-classifieds `SERIES_ATTEMPTS`) already size their replies by series. I did not find a Core or runner defect.

Observation: in the passing run the judge asked 4 times in total (one per attempt, ordinals 1 to 4), not twice in attempt 1 as in the earlier run. I did not trace why the earlier run asked twice (it could be the draft's test run path); the script holds 2 per attempt (8) so either shape is answered. Unused replies are harmless.

## Change
- `scripts/company-website-apprentices.ts`: `ATTEMPTS = 4`, `JUDGEMENTS_PER_ATTEMPT = 2`; `panel_command` and `loop_verification` now have `ATTEMPTS` and `ATTEMPTS * 2` replies. The judge answer is unchanged (`scriptedJudgement`, "yes" on Core's own records), so the oracle is untouched.
- `scripts/tests/company-website-apprentices.test.ts`: new test that the script holds at least 8 judge replies and 4 chat replies.

## Commands and results
1. `heavy-slot.mjs run t898-script -- pnpm build` in packages/test-runner: exit 0 (domain:build, test-runner:build).
2. `node --test dist/attempt-lane/scripted-model/scripts/tests/company-website-apprentices.test.js`: 5 tests, 5 pass, 0 fail.
3. `heavy-slot.mjs run t898-script --priority -- pnpm lab attempt company-website --task company-website-apprentices --authoring-mode answer-first --scripted-model --attempts 4` (log `C:/Users/osrs_/FluxStuff/fxwork/t898-script-run.log`): `status: passed`, exit 0. Evidence: `test-runs/attempts/run-mwbv3w5k-64e6d80e`.
   - attempt 1: right, explore, 12 stand-in calls (interpretation 1, judge 1, decisions 10), 30 s.
   - attempts 2-4: right, path run_flow, same flowId flow.6b62af03-41d1-49cd-bda2-d21015e00666, continuation held true from the previous attempt (digest proven), 7/8/9 live steps, 1 call each (the scripted judge only; interpretation 0, decisions 0), 18.5 / 18.8 / 14.7 s.

## Not verified
- "0 provider calls": no provider is called (`NOT LIVE, stand-ins: model, spend`); the later attempts each make 1 scripted judge call, so zero stand-in calls was not reached, only zero decisions and zero interpretation. The Lab notes this itself.
- Why the earlier run asked the judge twice in attempt 1.
- Other scripts and humanness levels not rerun.

## Open questions
None.
