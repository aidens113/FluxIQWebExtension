# lane2-supervisor-ending-words

## Outcome

Done, with one placement change from the brief (explained below). The supervisor's "stopped before a whole trial passed" ending now gives plain words and never shows an internal code.

## What changed and why

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t565/!FluxIQ` (branch task/t565-a8-lane-2).

- New `packages/fluxiq/src/programs/automation-studio/runtime/project-agents/stop-reason/stop-reason.ts`, which exports `automationStudioProjectSupervisorStopReason({ loop, stalledOn })`. Its barrel is `stop-reason/index.ts`, and its test is `stop-reason/tests/stop-reason.test.ts` (6 tests).
  - It returns `The supervisor stopped before a whole trial passed: <why>.`
  - Every code in `AutomationStudioLlmEvidenceLoopFailureCode` (`llm/evidence-loop/result.ts`) has words. They are kept in a `Record` over that union, so if a new loop code is added the typecheck fails until it gets words too.
  - Counts come only from the result's own data:
    - `unreadable_replies` uses `unreadable.inARow`: "the AI model's replies could not be read six times in a row".
    - `iteration_limit` uses `exhaustion`. With bound `iterations`: "it used all N of the decisions it was allowed". With bound `budget`: "the budget for the AI model's decisions ran out". With bound `tool_calls`: "it had no tool calls left to run".
    - Without that data, each gets a sentence with no count.
  - Stall issue codes (what `unusableDecisions.stalled` receives) have words for `repeat_refused`, `draft_amendments_refused`, `searching_without_acting`, `no_progress` and `refused_in_a_row`. Any other stall code gets "its decisions kept being refused without making any progress". If neither a loop code nor a stall code is known, the reason is "it could not go on".
- `project-agents/supervisor/supervisor-loop.ts`: I changed only the ending line, plus one import. It now reads `reason: automationStudioProjectSupervisorStopReason({ loop, stalledOn: stalled?.issueCodes })`. `stoppedBy` is still used for the cancel check.
- Machine-readable codes are unchanged: `loop.code` on the returned outcome, the loop trace and accounting, and the stall error, which is still thrown. The record's ending type has only `outcome` and `reason`, with no code field. The code used to reach the record only inside the reason text, and it no longer does.

**Placement change.** The brief asked for the file inside `project-agents/supervisor/`. That directory and its `tests/` are both at the audit's 25-file hard limit, so adding the file there failed with "26 source files exceeds the 25-file limit". A subfolder `supervisor/stop-reason/` then failed the 9-segment depth limit. So the file went to the sibling `project-agents/stop-reason/`, which is depth 9. The supervisor barrel is unchanged; the loop imports `../stop-reason/index.ts` directly. `project-agents/index.ts` does not re-export it, the same as `amendment/` and `single-subflow/`.

## Commands run and observed results

- `npx tsc --noEmit -p tsconfig.json` (packages/fluxiq): exit 0, no output.
- `node scripts/structure-audit.mjs` (Core root): `structure-audit: passed (397 warning(s), 1155 baselined).`, exit 0. Earlier placements failed as described above.
- `npx vitest run src/programs/automation-studio/runtime/project-agents/supervisor src/programs/automation-studio/runtime/project-agents/stop-reason`: `Test Files 27 passed (27)`, `Tests 187 passed (187)`. This includes whole-trial.test.ts and provider-stopped.test.ts, which check the reason's opening words.

## Not verified

- I did not run a live or Lab build, so the new sentence has not been seen in the extension chat.
- Outside the supervisor directory and its tests, no test other than a grep looks for the old "(code)" form. The grep found none in either repository's source.
- No full suites were run.

## Open questions or contradictions found

- The extension changes the reason further, and I did not edit it:
  - `apps/extension/src/background/activity/supervisor-ending.ts` drops reasons that match `RAW_ID` (`/\b[a-z]+\.[a-z_]+/iu`).
  - `apps/extension/src/panel/chat/stream/step/return-reason.ts` drops sentences with dotted or snake_case ids and turns `_`/`-` into spaces. That is likely where "llm evidence loop.unreadable replies" came from.
  - The new reason has no ids, so it should pass both filters, but this has not been checked live.
- The other Core endings in this file already used plain words: out of money, time limit, cancelled, and provider stopped.
- The git status shows unrelated changes in `llm/` from other work in this tree. I did not touch them.
