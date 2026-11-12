# H5 Lab humanness option and measurements (lane t898)

## Outcome
Partial. Part 1 (the `--humanness` option) is written but not compiled or tested. Part 2 (runs) was not started. Both are stopped by one cause: Core's library build in this worktree's sibling `!FluxIQ` fails to compile.

## What changed and why
- `packages/test-runner/src/commands.ts`: `lab attempt` accepts `--humanness <0-100>`. It is validated at parse time with `^(0|[1-9][0-9]?|100)$`, so non-integers, negatives, 101, "050" and "" are refused with "lab attempt --humanness takes a whole number from 0 to 100 ...". The parsed command carries `humanness` only when the option was given. The option and its value are stripped from the positional arguments, as `--attempts` is.
- `packages/test-runner/src/attempt-lane/live/run-attempt-command.ts`: passes `command.humanness` to the session only when present.
- `packages/test-runner/src/attempt-lane/live/attempt/session.ts`: new optional `humanness` input. It is added to the `settings` object of the existing `fluxiq.connect` runtime message. The background merges that onto the stored settings and runs `writeSettings`, which normalises humanness (`background/index.ts` ~line 190). This is before any attempt starts. Absent option: the message is byte-identical to today's, so nothing new is stored.
- `packages/test-runner/src/attempt-lane/tests/lab-attempt-command.test.ts`: new test for the option (absent writes nothing, 0/1/50/99/100 accepted, bad values refused, works with the paid form and with `--attempts`).
- Line endings: my edit tool rewrote the three source files with LF, where the working copy had CRLF. Git normalises them (it warned), and the diff is only my lines.
- No file outside owned paths was edited. `apps/extension/**` shows modifications in `git status` (`humanness/misclick/open-layer.ts`, `interference/index.ts`). They predate my work and are not mine.

## Commands run and observed results
1. `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t898-h5 -- pnpm build` (in packages/test-runner). It waited about 10 minutes in the queue, then failed in the Core-currency guard: "FluxIQ Core's build at ...\fxwork\t898\!FluxIQ is not current with its source. Stale: fluxiq:build, ui-components:build: inputs changed: packages/fluxiq". The test file was therefore never built or run.
2. Followed the guard's own remedy, through the slot: `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket --filter @fluxiq/sdk --filter @fluxiq/ui-components build` in `!FluxIQ`. contracts built. `fluxiq` failed:
   `src/framework/automation-service/service/answer-first/flow-run/flow-run.ts(145,9): error TS2375: Type '{ humanness?: number | undefined; ... }' is not assignable to type 'AutomationStudioGraphExecutionOptions' with 'exactOptionalPropertyTypes: true'.`
   Log: `C:/Users/osrs_/FluxStuff/fxwork/t898-h5-corebuild.log`.
   Cause: the Core worktree has uncommitted edits (git status: `answer-first/attempt/contracts.ts`, `flow-run/flow-run.ts`, `flow-run/ports.ts`, `tests/fake-library-engine.ts`, `runtime-session/graph-options.ts` and its test, plus an untracked `flow-run/tests/humanness.test.ts`). They are in-progress humanness plumbing from another lane, where `graph-options.ts` lacks `| undefined` on `humanness`. I did not touch Core, as the brief says.

## Not verified
- That my TypeScript compiles and that the new test passes. The test-runner builds against Core's compiled dist, which cannot be built.
- Every Part 2 measurement: levels 0/50/100 plus baseline, verdicts, calls, Flow continuity, step times, misclicks, robot-check pauses. No Lab run was started and nothing was spent.
- That the saved level reaches the background in a live browser. This rests on reading `background/index.ts`, not on a run.

## Open questions and contradictions
- The Core worktree must typecheck before any Lab run or test-runner build here. The owner of that lane needs to add `| undefined` to `humanness` in `AutomationStudioGraphExecutionOptions` (`graph-options.ts`) or stop spreading an undefined value, or commit a consistent state. Then rerun the build and the Lab commands.
- Site coverage: only everything-store has a provider-free script among the two requested sites (`everything-store-batteries-and-descaler`). job-board has none in `scripted-model/scripts/index.ts`. The scripted tasks are everything-store-batteries-and-descaler, company-website-apprentices, crossborder-marketplace-free-hubs-under-ten (and its timed-check), professional-network-accept-messaged-invitations and local-classifieds-save-dining-tables. I would substitute company-website-apprentices for job-board (closest: careers/listings). I did not run it.
- Planned commands once Core builds, each via `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t898-h5 --priority -- pnpm lab attempt <scenario> --task <task> --authoring-mode answer-first --scripted-model --attempts 4 [--humanness N]`. Scenarios and tasks: everything-store with everything-store-batteries-and-descaler, and company-website with company-website-apprentices. Levels: none (baseline), 0, 50, 100.
- Heavy-slot queue was 6-7 deep (two other lanes holding both slots for a long time). Each of the planned 8 Lab runs would queue separately.
- Expected, not observed: no Core per-node pause in chat-built runs (pending service.ts line).

## Part 2 results (lane t898, validation and provider-free runs)

### Outcome
Partial. The `--humanness` option builds and its test passes. All 8 provider-free runs were launched and none produced the four-attempt measurement the brief wanted, for two reasons that exist with no humanness option at all (the baseline runs fail the same way). Nothing was changed in the owned files in this part.

### Build and test
- `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t898-h5 -- pnpm build` in `packages/test-runner`: exit 0 (core-build "is current"; domain:build, test-runner:build stored). Log `C:/Users/osrs_/FluxStuff/fxwork/t898-h5-build2.log`.
- `test-contracts` and `test-evidence` had no `dist`, so the first test run failed three files with ERR_MODULE_NOT_FOUND; built both with `pnpm build` through the slot (exit 0).
- `node --test dist/attempt-lane/tests/lab-attempt-command.test.js dist/attempt-lane/live/attempt/tests/*.test.js`: 19 tests, 19 pass, 0 fail (includes "--humanness takes a whole number from 0 to 100, and absent leaves the command as it was").
- The Lab built the extension itself (prelude rebuilt scenario-lab, extension, test-runner; 253 s) so no separate extension build was needed.

### Commands (each through `heavy-slot.mjs run t898-h5 --priority --`, one at a time; logs in `C:/Users/osrs_/FluxStuff/fxwork/t898-h5-runs/`, driver `run-all.sh`)
`pnpm lab attempt <scenario> --task <task> --authoring-mode answer-first --scripted-model --attempts 4 [--humanness N]`
with everything-store / everything-store-batteries-and-descaler and company-website / company-website-apprentices. No guard refused any run. No provider was called.

### Why the measurement is incomplete (causes)
1. everything-store-batteries-and-descaler is a script that is built to fail ("a script that means to fail", its own header): it lands the descaler a second time through the cart line's Increase, so the Lab's oracle says wrong with a repeated act ("One descaler added to the cart (asked 1, landed 2)"). A wrong first attempt means attempts 2 to 4 do not run ("the site is in no known state to judge a second against"). So this task can never give a continuation proof or four attempts. It is the only provider-free script for the site. Expected, not caused by humanness.
2. company-website-apprentices: the script answers one `loop_verification` request; the product now sends a second one after the draft's test run of the Flow (steps 0030-0038) and the script refuses it: "The script for company-website-apprentices expects no request 2 of kind loop_verification" (status `not_judged`, why `AttemptScriptRefused`). Identical at baseline, 0, 50 and 100, so it is script drift against the current Core loop, not the option. Fixing it means editing `attempt-lane/scripted-model/scripts/company-website-apprentices.ts`, which is outside my owned paths. Its attempt report still shows attempt 1 as answer "right" (13 calls, 23.5 s in the baseline) before the refusal, but the run is not judged, and no later attempts ran.

### everything-store (attempt 1 only; attempts 2-4 did not run)
| Level | Verdict (att 1 / 2-4) | Model calls (scripted stand-in) | Flow continuity | Wall total | Per dom-click step | humanness on commands | Misclicks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| baseline | wrong (repeated act) / not run | 11 | not provable | 18.9 s | 1254 ms (page.click 212 ms) | not observable | not observable |
| 0 | wrong / not run | 10 | not provable | 17.9 s | 1290 ms (page.click 268) | not observable | not observable |
| 50 | wrong / not run | 10 | not provable | 15.3 s | 1277 ms (page.click 261) | not observable | not observable |
| 100 | wrong / not run | 11 | not provable | 15.8 s | 1072 ms (page.click 188) | not observable | not observable |

Evidence folders under `test-runs/attempts/`: run-mwbtbvz7-3d132975 (baseline), run-mwbtneps-0ba00f6c (0), run-mwbtpmg8-7cfe882e (50), run-mwbtry5j-33164239 (100).

### company-website-apprentices (stand-in for job-board)
| Level | Verdict | Calls | Flow continuity | Time | humanness on commands | Misclicks |
| --- | --- | --- | --- | --- | --- | --- |
| baseline | not_judged (script refused loop_verification 2) | 13 before refusal | not run | 23.5 s to refusal | not observable | not observable |
| 0 | not_judged, same refusal | n/a | not run | n/a | not observable | not observable |
| 50 | not_judged, same refusal | n/a | not run | n/a | not observable | not observable |
| 100 | not_judged, same refusal | n/a | not run | n/a | not observable | not observable |

Evidence folders: run-mwbu389o-17514ba5, run-mwbu6n7x-6e676e33, run-mwbu8xgr-823fbe03, run-mwbubj56-4e36cd65.

### What the files can and cannot show
- Model calls: "0 expected" does not apply to attempt 1 (it is the exploring attempt, scripted stand-in answers: 10-11 calls). Zero-call replays were never reached.
- humanness on page commands and misclicks: the run folders (steps/*/call.json, result.json, meta.json spans, attempt.json, site.json) record neither the field nor any misclick or inert point; a search for "humanness", "misclick" and "inert" under test-runs found nothing. These are not observable from the Lab's artifacts today. Whether the saved level reached the page needs an extension-side log or a Lab artifact for the page command, which does not exist.
- Time: everything-store presses only (no typing, scrolling-only dwell is not separate), so there is no step type where 50/100 would add time through aim; page.click means (188-268 ms) vary with no trend by level. Robot-check pauses: none seen in any step list. Core per-node pauses do not reach chat-built runs yet (pending service.ts line); not addressed, as instructed.

### Not verified
Whether `--humanness` is stored and stamped on page commands in a live run; misclick counts; any continuation proof; any 4-attempt determinism at any level.

### Open items for the supervisor
- Pick or write a provider-free task that passes its first attempt on a stable path (the realistic ones with scripts: crossborder-marketplace-free-hubs-under-ten, professional-network-accept-messaged-invitations, local-classifieds-save-dining-tables), or have the company-website-apprentices script allow the second loop_verification (one-line reply list change in a path I do not own).
- Add the stamped level to a Lab artifact (for example the page command in step meta) so H5 can be measured; today it cannot.


## Part 3 results (recorded level), 2026-11-11, run and read by the supervisor

**How the runs were made.** Driver `C:/Users/osrs_/FluxStuff/fxwork/t898-h5-runs3/run3.sh`. Each run was `node .../heavy-slot.mjs run t898-h5 --priority -- pnpm lab attempt <scenario> --task <task> --authoring-mode answer-first --scripted-model --attempts 4 [--humanness N]`, one at a time. All 8 exited 0. No guard refused a run and no provider was used.

**How they were read.** By `scratchpad/h5-read.mjs` from each run folder:
- `attempt-report.txt` gives the attempt rows;
- each flow step's `meta.json` gives `ms`, grouped by step kind;
- `"humanness"` was searched for in step `result.json` and `call.json`.

| site, level | run | status | attempts right | continuation held | calls (a1 / a2-4) | attempt ms | live steps | median ms: click / type / scroll | humanness on results |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| company-website, baseline | run-mwbvboi2-db25b0d8 | passed | 4/4 | yes | 13 / 1 judge | 15657, 14933, 14843, 14819 | 11, 9, 9, 9 | 789 / - / 321 | none |
| company-website, 0 | run-mwbvfudg-83544300 | passed | 4/4 | yes | 12 / 1 | 13078, 15039, 12354, 14826 | 10, 9, 8, 9 | 797 / - / 339 | none |
| company-website, 50 | run-mwbvj6s7-68c83567 | passed | 4/4 | yes | 13 / 1 | 16191, 13951, 13468, 14008 | 11, 8, 8, 8 | 827 / - / 735 | 8 (level 50; aimed 4 of 8) |
| company-website, 100 | run-mwbvnaem-b0da2bc3 | passed | 4/4 | yes | 12 / 1 | 31718, 23503, 12000, 14182 | 10, 8, 7, 7 | 1261 / - / 1371 | 7 (level 100; aimed 4 of 7) |
| local-classifieds, baseline | run-mwbvss5u-0f87ba22 | passed | 4/4 | yes | 22 / 1 | 33013, 20650, 19688, 18425 | 24, 16, 16, 16 | 286 / 1311 / - | none |
| local-classifieds, 0 | run-mwbvwwpa-997c1e31 | passed | 4/4 | yes | 22 / 1 | 35871, 17802, 17466, 18029 | 24, 16, 16, 16 | 97 / 1097 / - | none |
| local-classifieds, 50 | run-mwbw0o8i-47fa288d | passed | 4/4 | yes | 22 / 1 | 30655, 18786, 18879, 19062 | 24, 16, 16, 16 | 93 / 1929 / - | 7 (level 50; aimed 6 of 7) |
| local-classifieds, 100 | run-mwbw40v6-f2ef725f | passed | 4/4 | yes | 22 / 1 | 32904, 21036, 21238, 43596 | 24, 16, 16, 16 | 188 / 3722 / - | 7 (level 100; aimed 6 of 7) |

Misclicks: none in any run. Robot-check pauses: none, at any level.

**What the levels did.**
- **The outcome did not change.** Verdicts, calls and Flow continuity are the same at every level on both sites. Attempts 2-4 make the same one scripted judge call at every level, the baseline included; humanness did not cause it.
- **Level 0 is the baseline.** No action result carries `humanness`, and step times are within run-to-run noise of the run without the option.
- **Scroll dwell grows with the level as designed:** median scroll step 321 ms at baseline, 339 at 0, 735 at 50, 1371 at 100. The dwell's mean is 900 ms x b.
- **Typing cadence grows with the level as designed:** median type step 1311 ms at baseline, 1097 at 0, 1929 at 50, 3722 at 100 (3 type steps per run).
- **Clicks on local-classifieds are unchanged** (aiming adds no time).
- **The level is recorded at 50 and 100.** Aimed presses are 4 of 8, 4 of 7, 6 of 7 and 6 of 7. The rest kept the gate's point, which happens when the aimed point fails the hit test.
- **No misclicks, as expected.** Core marks a step only when it declares an empty consequence list, and these tasks' Flows do not. Misclicks remain proven only by unit tests.
- **Core node pauses did not appear,** as expected: chat-built runs do not carry the level to Core until the `service.ts` line lands.

**Not explained yet, from single runs:**
- **company-website at level 100:**
  - Median click time is 1261 ms against 789-827 at the other levels.
  - Attempt 1 took 31.7 s and attempt 2 took 23.5 s, against about 15 s.
  - Attempts 3-4 made 7 live steps against 9 at the baseline.
- **local-classifieds at level 100, attempt 4:** 43.6 s against about 21 s, with single slow steps (navigate 4039 ms, extract 3841 ms, click 2787 ms).
- **What could explain them, and the test:** the machine was shared with other lanes' Lab runs, and the extra time is not in the dwell or typing steps. The test is a second series at 100, with the baseline on each site run straight after it. That has not been run.

**Where the record is visible: the gap.**
- The field shows only in the explore attempt's model-facing evidence (`steps/*-tool-core.run_node/result.json`), and so the model sees it too.
- Replays record nothing, because Core's flow-step log writes only `meta.json` (`packages/fluxiq/src/runtime/llm/step-log/flow-step.ts`).
- Fixing both means two edits, neither in W2's paths:
  - add `humanness` to `PAGE_RECORD_KEYS` in `domain/src/runtime/llm-evidence/node-run/page-record.ts`, so the model no longer sees it;
  - have Core's flow-step log write the node result's `humanness` into the step's `meta.json`, so replays record the level and the choices.
