# A press the page ignored is pressed once more inside the same command (t896)

## Outcome

Partial. The work is held for the dining rerun, which waits on lane t885's rows-rule fix.
- **Done.** The extension change, under the coordinator's decision that the user's retry rule (t528) wins:
  - A first press the settled look finds certainly did nothing is pressed once more inside the same command.
  - If that press also certainly did nothing, the command fails as `web.action.no_effect` (`certainNoEffect`), and Core gives it its first attempt plus three retries.
  - Each Core attempt presses at most twice, and every press is made only after a certain-nothing verdict on the one before it.
- **Tests.** Every new row fails against HEAD. The Post T2 spec is updated, the stale "once only" comments are corrected, and the extension check and structure audit pass.
- **Post on the real page (T2):** one command, two presses, exactly one group-post request.
- **Live Lab, Post on Haiku** (`run-mwb5cnxg-003415b4`, $0.0164, no balance error): every answer was right.
  - The series posted exactly once, in attempt 1. Attempts 2-4 found the post already made, since attempts are not reseeded, and posted nothing; none posted twice.
  - Attempt 3 was not deterministic (judge 3 calls, `run_flow_then_explore`). That is a Core answer-first issue, outside this lane.
- **Dining tables:** held. Attempt 1's answer is wrong on this tree, with or without this change (control run below). Suspect: Core `150aa58ef`, lane t885's rows rule. The rerun at `--attempts 4` waits for the coordinator.

## What changed and why

**`apps/extension/src/content/actions/click.ts`, `pressInPlace` and the new `afterSettled`.**

What changed:
- A first press that the settled look found certainly did nothing is now a press the page ignored. The look requires that the only sign was a change in the section that came and went, and that the page then settled exactly as before (`settledUnchanged`, t517).
  - It is pressed once more in the same command, through the existing press-again path, as a press with no sign at all already was.
  - Before, it failed as `web.action.no_effect`, and Core made the second press as a retry. That retry made every dining replay deviate as `step_retried` at Apply, so no replay could stand on its record.
- The press made once more is looked at with the same settled look (`lookAgain` set). A second change that comes and goes is no more an answer than the first was.
- The extra press is counted against the command (`noteExtraPress`) before it is made, on both press-again paths.

How `afterSettled` ends the press made once more:
- Answered (a request, a lasting change, a navigation, a focus move): it passes, with "...so it was pressed once more".
- Settled exactly as before again: it fails as `web.action.no_effect` (`certainNoEffect`).
- Nothing but the page's notice: it fails as `web.action.page_reported_failure` (`certainNoEffect`), as a first press with only a notice already did (t743).
  - In both certain cases Core makes the act again under its first attempt plus three retries (t528).
- No sign at all: it fails as `output_not_observed`, which is not certain. The ignored-press watch that saw nothing does not look outside the control's section.
- The control is now covered, disabled or gone: the press reads as answered, as after any press made once more.

Two related cases:
- A first press with nothing but the page's notice still fails at once as `page_reported_failure` (t743), unchanged.
- A first press that came to nothing and whose control a layer then covered now takes the covered path of t476: refused, the recovery closes the layer, and the run after it makes the command's one extra press, which is not looked at again. Before, it passed as answered by the layer.

**Comment-only edits stating the rule as it now stands** (Core's first attempt plus three retries; within one attempt, the click presses once more only after a certain-nothing verdict):
- the `click.ts` header and the docstrings of `press()`, `afterSettled` and `unansweredValidation`;
- `ignored-press/press-again.ts` and `ignored-press/index.ts`;
- `action-runtime/recovery/fault.ts` (`ABSORBED_ELSEWHERE`);
- `domain/src/runtime/failure/codes.ts` (the `NO_EFFECT` doc);
- `domain/src/runtime/llm-evidence/node-run/press-effect/repeat-press.ts`;
- `domain/src/runtime/llm-evidence/node-run/run.ts:484`.

**`apps/extension/e2e/content/tests/press-answers/tests/wake-press-post.spec.ts`.**
- One click command on Post must now succeed with "...so it was pressed once more".
- The oracle is unchanged: exactly one group-post request, still one after a further 2 s, and the post in the pending box once. The second command is gone.

**Tests (`apps/extension/src/content/actions/tests/`).**
- `click/tests/swallowed-first-press.test.ts` is new, with 8 rows:
  1. Post-like: a swallowed first press, then a second press answered with a request. Result: success, two presses, `extraPressesMade = 1`, the second not looked at again.
  2. Apply-like: the second press leaves a lasting change. It passes after it is looked at, with two presses.
  3. A press made once more with any sign of landing (request, navigation, focus) is never pressed again: exactly two presses, success.
  4. Both presses certainly ignored: `web.action.no_effect`, `certainNoEffect`, `effect: "unacted"`, with exactly two presses in that command, each made after a certain-nothing look, and the extra press spent.
  5. The second press answered only by a notice gives `page_reported_failure` (`certainNoEffect`). A silent second press fails with no verb code (`output_not_observed`).
  6. Control swapped for a copy (t878): pressed once more on the copy, in the same command.
  7. Through `runWithRecovery`: a first press that came to nothing, then covered. The layer is closed and the click runs again. Two presses in all, the press made after the layer is not looked at again (`looked === 1`), and it fails as not observed.
  8. Through `runWithRecovery`: the press made once more, and the control is then disabled or gone. It passes, with two presses.
- `click/tests/settled-look.test.ts`: three rows that encoded "fails as `no_effect` for Core" were updated (busy-then-revert, swapped copy, and covered after settling).
- The harness (`click/press.ts`, `click/watches.ts`):
  - gives each press its own command object, as Core does, because the verb now notes the extra press against the command;
  - adds `secondSettledUnchanged`.

## The three safety points, from the code

**1. `settledUnchanged` means certainly nothing happened.**
- `settled-look.ts` answers `true` only under all of these conditions:
  - from just before the press until the section was quiet, no request, navigation or focus move was seen (`listenForPressAnswer`);
  - no mutation was seen anywhere outside the section, open shadow roots included, other than in the page's own notice regions and the extension's own UI host;
  - no new shadow root appeared;
  - the section's markup, shadow markup and every field's value, checked state and selected index were identical to the state before the press;
  - the control is a command control (`expectsAnswer`).
- `click.ts` additionally requires the control to be pressable now before pressing again.
- **The brief's premise was stale.** Core does not press exactly once more on `certainNoEffect`. Core commit `621de4484` (t528, 2026-10-13) records: "The latest user rule supersedes t517's one-extra-press cap: confirmed no-effect lasting acts use first attempt plus three retries" (`defensive/assess.ts`; `step-loop/tests/certain-no-effect-repress.test.ts` asserts four presses). The coordinator then ruled that this user rule wins.

**2. Presses within one command, and across Core's retries.**
- `extraPressesMade` and `noteExtraPress` are keyed by the command object (`command-presses.ts`). The in-page recovery re-runs the same object; every Core retry is a new object and starts from none, and the command carries no attempt number.
- Within one command, the click makes at most two presses (`pressAgain`: `extra < MAX_EXTRA_PRESSES (1)`, with `noteExtraPress` before the second press). This includes the covered path, because the look is asked only on a command's first press (`lookAgain = extra === 0`).
- Across Core's retries:
  - Core retries a `certainNoEffect` failure under its first attempt plus three retries (`failed-attempt.ts:160` sets `repress`, and `assess.ts` passes `unacted`).
  - So a control that certainly ignores every press gets at most 4 attempts × 2 presses.
  - Every press after the first is made only when the settled look found the press before it certainly did nothing.
  - The coordinator accepted this as the rule.
- A failure that is not certain (`output_not_observed`, stage `verification`, no `effect`) is not blindly re-pressed for a click:
  - a click is `effectClass: "commit"` (`domain/src/actions/action-effect/table.ts:20`);
  - `automationStudioNodeRepeatCannotAct` is false, so the attempt is refused;
  - Core's effect check decides, and only a positive `not_landed` lets it act again.

**3. social-network-feed's Post posts exactly once.**
- The fixture script (`client/composer-script.ts`): the first press sets `busy`, shows a spinner, waits 450 ms, restores "Post" and posts nothing. The second press calls `mutate('group-post', ...)` (a request).
- That request is a sign, so `pressAgain` refuses a third press (`seen` is not empty, `extra` is 1), and the press passes. Core sees success and makes no retry.
- On the real page, the updated T2 spec passes: one command, exactly 1 group-post request, still 1 after a further 2 s.
- Live: see "Live run".

## Commands run and observed results

**Unit tests**, `EXTENSION_TEST_BUILD_LABEL=t896 node scripts/test-extension.mjs src/content/actions/tests/click src/content/action-runtime/ignored-press/tests`:
- before t896: 151/151;
- with the change: `# tests 159 # pass 159 # fail 0`.

**Against HEAD** (HEAD's `click.ts` swapped in, the same command run, my file then restored): `# tests 159 # pass 148 # fail 11`.
- Failing: all 8 new rows (152-159) and the 3 updated rows (139, 142, 143).
- The earlier wider run, `node scripts/test-extension.mjs src/content/actions/tests src/content/action-runtime`, gave 741/741 (before the `NO_EFFECT` decision; only `click.ts` and these tests changed since).

**T2**, `node scripts/test-content.mjs -- e2e/content/tests/press-answers --reporter=list` -> `8 passed (2.1m)`. That includes `wake-press-post.spec.ts` "a Post that only wakes on its first press is pressed once more in the same command, and posts exactly once (4.5s)".

**Extension check**, `pnpm --filter @fluxiq-web-extension/extension check` -> exit 0. Its inputs included `apps/extension` and `domain`, so the domain comment edits are covered.
- Earlier in the lane, this worktree needed Core's libraries rebuilt (stale `packages/sdk/dist`) and its domain `dist/` built before the check could run. Those were builds only, with no source change.

**Structure audit**, `node scripts/structure-audit.mjs` -> `structure-audit: passed (245 warning(s), 552 baselined).` `click.ts` is at about 670 lines, an advisory warning; it was already past 400 at 613.

**Extension build**, `pnpm --filter @fluxiq-web-extension/extension build` -> exit 0. Each Lab run also rebuilds its own instance.

## Lab runs

**Provider-free.** `FLUXIQ_LAB_INSTANCE=t896 FLUXIQ_TEST_ENV_FILES=none pnpm lab attempt <site> --task <id> --authoring-mode answer-first --scripted-model --attempts 4`, in a visible browser, launched at 3 GB or more free. These runs predate the `NO_EFFECT` decision, which changes only the double-ignore case; neither task reached it.

**Dining tables with this change** (`run-mwb4bf67-3c240399`). Exit 1.

| Attempt | Path | Flow | Calls | Time | Answer |
| --- | --- | --- | --- | --- | --- |
| 1 | explore | `flow.b2202829-42d2-48f1-b1e0-d401aaf68846` | 23 (interpretation 1, judge 1, decisions 21) | 50.1 s | wrong: `records`, `not_shown` |
| 2-4 | did not run | | | | the first answer was wrong |

- **Apply.** Step 0014, `apply-1`: one command, 1,451 ms, `web.action.succeeded`, "...the first press changed the page only for a moment and left it exactly as before, so it was pressed once more". The chip then read "Within 5 mi", and there was no Core retry.
- **The act was right.** The three cheapest tables were saved, each once (`site.json`: `finalState: held`, `change: held`).
- **The answer was wrong.** It used step 0022 `read-tables` (3 rows: title, price, url; three `where` conditions). It did not use step 0047 `read-saved` (dataset `saved-items`, no conditions, 5 rows kept with a status), although the task asks for everything in the saved items.

**Control: HEAD's `click.ts`** (`run-mwb4ms4a-918c0bbf`). Attempt 1 was wrong for the same reasons: 3 rows stored and 3 shown, 22 calls, 32 s. Attempts 2-4 did not run. So the wrong answer does not come from this change.
- Suspect: Core `150aa58ef` (2026-11-10 10:47, `answer-first/rows`, lane t885), "Keep the rows that met every condition: a read lacking one never replaces the result".

**social-network-feed, provider-free:** refused, `--scripted-model has no script for social-network-feed-group-post`.

## Live run (authorised: one run, Haiku)

`FLUXIQ_LAB_INSTANCE=t896 pnpm lab attempt social-network-feed --task social-network-feed-group-post --authoring-mode answer-first --live-llm --llm-model claude-haiku-5-5 --llm-max-cost-usd 5 --attempts 4`

- Dry run first, with `--dry-run`: ready, `providerCallCount: 0`, provider anthropic, model `claude-haiku-5-5`, ceiling $5 for the whole run (`maxTotalEstimatedCostUsd: 5`), credential `CLAUDE_API_KEY` from the repository's `.env.local`.

**Result** (`run-mwb5cnxg-003415b4`, launched at 3 GB or more free, visible browser). Exit 1, because the deterministic proof failed at attempt 3. Every answer was right.
- No balance or provider error: `provider-failures.local.json` holds 0 records, and the live guard recorded a total of $0.0164 against the $5 ceiling.

| Attempt | Path | Flow | Calls by kind | Time | Cost | Posts made | Continuation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | explore | `flow.851e41c5-8832-44fb-852e-e9fd4621fc8e` | 9 (interpretation 1, judge 1, decisions 7) | 55.3 s | $0.0132 | **1** | n/a |
| 2 | run_flow | same | 0 | 1.3 s | $0 | **0** (already done) | held, proven by the steps digest |
| 3 | run_flow_then_explore | same | 3 (judge 3; Lab row; Core spend says 2) | 40.0 s | $0.0032 | **0** ("Already done earlier: Post.") | refused: `first_saved_nothing`, `second_found_something_else`, `second_ran_another_flow` |
| 4 | run_flow | same | 0 | 1.3 s | $0 | **0** (already done) | held, proven by the steps digest |

- **Posts, from each attempt's `site.json`.**
  - Attempt 1: `change: {"group-post:riverside-allotments:post": 1}`, activity "pending post in riverside-allotments".
  - Attempts 2-4: `change: {}`, no activity.
  - So the series posted exactly once, and no attempt posted twice.
- **"Exactly one post per attempt" cannot hold in this Lab, by design.** `lab attempt` runs each later attempt on the site as the previous one left it, with no reseed (the user's "reset as rarely as possible" rule). Each later attempt found the post already made and correctly did not post again. The safety requirement (Post never made twice) held on every attempt.
- **Not shown by this run:** how many presses attempt 1's Post took. This live run wrote no per-step folders. The single post and the T2 real-page run (one command, one request) are the evidence.
- **Two defects outside this lane, both Core answer-first:**
  - Attempt 3 took `run_flow_then_explore` and asked the judge 3 times on an already-done task. Its continuation proof was refused, which made the run fail as not deterministic.
  - Attempts 2 and 4 ended with status `working`, and their `answer-turn.json` is `null`, though the Lab scored the answer right.
  - The click is not involved in either: no press was made in attempts 2-4.

## Not verified

- **Dining attempts 3 and 4 standing on their record with 0 calls**, and the continuation proof. Held for the rows-rule fix in lane t885; the coordinator will say when to merge dev and rerun.
- **A control that certainly ignores both presses, on a real page.** Shown by unit tests only. Core's handling, up to 4 attempts × 2 presses, is traced from the code, not run end to end.
- **No full suites** (twice-a-day rule).

## Open questions or contradictions found

- **The dining answer-rows defect blocks this lane's dining acceptance.** Suspect `150aa58ef` (lane t885, must not touch).
- **The domain's own press-again (t511) sits on top of the click.** `node-run/run.ts`, `press-effect/settled.ts` repeat a press only for a call with no declared lasting consequence and not on a toggle. After the click's in-command press, a press that succeeded with no visible change on such a non-lasting step could still be made once more by that domain path. This is unchanged by t896, and lasting presses are excluded.
- **Latent, out of scope.** On the silent path (no sign at all on the first press), the press made once more is still not looked at (`lookAgain=false`), so a second change that comes and goes there passes. Left as is.
