# Lab records the model and provider of a live run

## Outcome
Partial. The code, the tests and the structure check are done and pass. One new test (the attempt-evidence one) could not be run through the normal test runner because Core's compiled dist is broken by Core's own uncommitted source; I ran its logic through a scratch probe instead (below).

## What changed and why
Ledger side (`scripts/lab/live-guards/`), resolved once at the source (`describeLiveLaunch`) and copied from the start to every finish:
- `live-launch.mjs`: `describeLiveLaunch` now also returns `provider` (`--llm-provider`, else `anthropic`) and `model` (`--llm-model`, else the provider's Lab default from `../provider/defaults.mjs`, the mirror of the runner's `labDefaultModelValue`; the Lab's environment never picks a model, as in the runner).
- `record-live-run.mjs`: start entry carries `provider` and `model`.
- `close-launch.mjs`: each finish entry carries its start's `provider` and `model` (absent for old starts that lack them, so reconcile of old ledgers is unchanged).
- `ledger.mjs`, `admit-live-run.mjs`: typedefs only.
- Guard decisions untouched (new fields are not read by any rule).

Attempt side (`packages/test-runner/src/attempt-lane/live/`):
- new `model-record.ts` (`attemptModelRecord`, type `AttemptModelRecord`): live run -> the plan's `provider` and `model` (from `LiveLlmRun.describe()`); scripted run -> `{ provider: "scripted" }` and NO model (the id the scripted run's Core is configured with is a stand-in, not a model that answered).
- new `report-model-header.ts` (`attemptModelHeader`).
- `run-attempt-command.ts`: `attempt.json` (single and series) starts with `provider` and `model`; `attempt-report.txt` first line is the header.
- `unscored-attempt-evidence.ts`: same for the evidence written when a run throws (optional `model` input, passed by the command).
- `index.ts`: barrel exports.

Tests:
- `scripts/lab/live-guards/tests/live-launch.test.mjs`: existing expectations extended; new test for flags, defaults, env ignored.
- `scripts/lab/live-guards/tests/admit-live-run.test.mjs`: start and finish ledger entries carry `anthropic` / `claude-sonnet-5-5` (the ledger writer's test, beside it).
- `packages/test-runner/src/attempt-lane/live/tests/model-record.test.ts` (new) and an added case in `tests/unscored-attempt-evidence.test.ts` (attempt.json and header, live and scripted, single and series).

## Samples
Ledger (live, defaults): start `{"event":"start",...,"authoringMode":"project","provider":"anthropic","model":"claude-sonnet-5-5",...}`; finish carries the same two fields.
attempt.json (live): `{"provider":"anthropic","model":"claude-sonnet-5-5","ordinal":1,...}`; report line 1: `model claude-sonnet-5-5, provider anthropic`.
attempt.json (scripted): `{"provider":"scripted","ordinal":1,...}`; report line 1: `model none, provider scripted`.
(Last two are real output of a scratch probe against the built `writeUnscoredAttemptEvidence`.)

## Commands run and observed results (all through heavy-slot t885, no --priority)
- `node --test scripts/lab/live-guards/tests/*.test.mjs` -> 52 tests, 52 pass, 0 fail (before the final test reformat); after it, `live-launch` + `admit-live-run` -> 18 pass, 0 fail.
- `node --test scripts/lab/live-campaign/tests/*.test.mjs` -> 24 pass, 0 fail.
- `pnpm structure:check` -> first run failed on two rules I caused (3 files sharing the `attempt-` prefix; a packed statement in a test); fixed; rerun: `structure-audit: passed (249 warning(s), 552 baselined)`.
- `pnpm --filter @fluxiq-web-extension/test-runner check` and `build` -> refused: Core's build is stale ("inputs changed: packages/fluxiq"). I ran Core's documented rebuild (`pnpm --filter @fluxiq/contracts ... build` in `!FluxIQ`); it failed in Core source I do not own: `rounds.ts(47,10): '"./stuck-ask.ts"' has no exported member named 'automationStudioAnswerFirstAskStuck'` (Core has uncommitted edits to `answer-first/attempt/*`; its own `stuck-ask.test.ts` still imports the old name).
- Fallback typecheck, `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` in test-runner -> exit 0 (after the final rename, `tsc -p tsconfig.json` emit -> exit 0).
- `node --test dist/attempt-lane/live/tests/model-record.test.js` -> 2 pass, 0 fail.
- `unscored-attempt-evidence.test.js` (existing file plus my new case) -> fails to load: `SyntaxError: ... './stuck-ask.js' does not provide an export named 'automationStudioAnswerFirstAskStuck'` (Core dist import, same Core defect, not my change).

## Not verified
- The new case in `unscored-attempt-evidence.test.ts` has compiled but not run under node --test; only the scratch probe exercised that writer.
- The main success path of `run-attempt-command.ts` (the header line and `attempt.json` spread) is type-checked only; no run executed (no live or scripted Lab run was made).
- The wrapped `pnpm ... check` / `pnpm test` for test-runner, because of the Core defect above.
- Nothing else checked for `lab matrix` / `lab run` paths: their ledger entries come from the same `describeLiveLaunch`, but no attempt.json-like file was in scope for them.

## Open questions or contradictions found
- Core (`!FluxIQ/packages/fluxiq`) source is internally inconsistent right now (rename of `automationStudioAnswerFirstAskStuck` -> `...StuckAsking` not applied to its test and dist). My attempt at the documented Core rebuild ran its clean step and then failed, so `!FluxIQ/packages/fluxiq/dist` is now a partial build (a mix that fails at import). It is generated output and will be fixed by rebuilding once Core's source compiles; the lead should know before relying on that dist.
- A scripted run records `provider: "scripted"` and no `model`; say if you want the stand-in id recorded instead.
