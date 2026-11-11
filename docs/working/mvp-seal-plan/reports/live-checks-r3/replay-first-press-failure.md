# Replay first-press failure on company-website-apprentices (read-only trace)

## Outcome
Done. This was a read-only trace. I found two root causes, not one. Both sit in the extension's content runtime, and neither is in the lead's answer-first paths.

On every replay of the "Show more people" step (node `...main.s11` in the baseline Flow), Core retried the node 1 to 3 times:
- First, 0 to 2 failures with `web.target.not_shown`. The replay reaches the button before the page has shown it.
- Then exactly one failure with `web.action.page_reported_failure`. The site swallows the first press of each page load on purpose.
- Then the next attempt succeeds.

Any retry gives the step `retries > 0`. Core's S9 rule then names `step_retried` and calls the judge.

## Evidence (runs in `C:/Users/osrs_/FluxStuff/fxwork/t898/!FluxIQWebExtension/test-runs/attempts/`)

Here is how the "Show more" step failed in each replay of attempts 2 to 4. It is the same step at every level. Each sequence ends with a success on the next attempt.

| run (level) | attempt 2 | attempt 3 | attempt 4 |
| --- | --- | --- | --- |
| run-mwbvboi2-db25b0d8 (baseline), node s11 | not_shown, not_shown, page_reported (steps 0035-0038) | same (0051-0054) | same (0067-0070) |
| run-mwbvfudg-83544300 (0), node s9 | not_shown x2, page_reported | not_shown, page_reported | not_shown x2, page_reported |
| run-mwbvj6s7-68c83567 (50), node s11 | not_shown, page_reported | same | same |
| run-mwbvnaem-b0da2bc3 (100), node s9 | not_shown, page_reported | page_reported only | page_reported only |

local-classifieds (run-mwbvss5u-0f87ba22) has no failed Flow step.

At level 100, attempts 3 and 4 have no not_shown failure. The slower aimed clicks and the longer scroll dwell gave the grid time to load. That also explains the H5 open item: attempts 3 and 4 made 7 live steps against 9 at baseline.

Baseline attempt 3 timeline, from `steps/00NN-*/meta.json`:
- **s4, "Our team" click (0044):** ends 08:41:06.926.
- **s5 and s6, two scrolls to y=4000 (0045-0046):** end 07.556.
- **s7 chat close and s9 newsletter decline (0047, 0049):** status `ended` within milliseconds, passed over because attempt 1 dismissed both prompts on the server.
- **s11 starts at 07.590**, under 0.7 s after the team page loaded.
- **0051, not_shown:** `send.click` 1643 ms, failed. Core then waits 265 ms (`failed-attempt`).
- **0052, not_shown:** `send.click` 2007 ms, failed. Core waits 1009 ms.
- **0053, page_reported_failure:** `pressed` at +259 ms, `send.click` failed. Core waits 2008 ms.
- **0054, succeeded:** `pressed`.

Exploration hit the same retry. In step 0016 (`show-more-7`), `result.json` has `"attempts": 2`, and `meta.json` shows the first `send.click` failed after `pressed` and the second succeeded 0.5 s later. The explore tool result absorbed that retry without any visible failure.

S9 rule:
- `!FluxIQ/packages/fluxiq/src/framework/automation-service/service/answer-first/completion/replay-stands.ts:59`: `step_retried` when any step has `retries > 0`.
- `steps-ran.ts:155-157`, lines 150-152 in the t898 Core sibling: `retries` is the count of node attempts that carry a `retry`.

The run folder does not record the deviation word. That it was `step_retried` is my inference: the rule names it first, because s11 ended `succeeded` with retries.

## (a) The control, what the page shows, and what decides `page_reported_failure`

**The control.** "Show more people" on `/team`. In exploration it was handle t516, called `show-more-7` (step 0015's decision), and it was saved as s11, a `web.output.dom-click`. The fixture renders it as `<button ... hidden>Show more people</button>`, followed by a `<p ... role="status">` status line (`apps/scenario-lab/src/scenarios/company-website/pages/team.ts:31-32`).

**What the page shows at the first press.** The button's click handler (`client/team-script.ts:62-67`) runs its first branch while `stuckClickPending` is true:
- It sets `stuckClickPending = false`.
- It writes a spinner and "Loading more people…" into the `role="status"` paragraph.
- It returns without fetching anything.

The button stays visible and enabled. Nothing else changes: no request, no navigation, no change to the grid.

**How the extension decides the code.**
1. `apps/extension/src/content/actions/click.ts:521-555`, `press()`: the ignored-press watch sees only `"change"`, so `changedOnly` holds. `settleUnchanged` then returns `"announced"`, which sets `noticeOnly: true`.
2. `action-runtime/ignored-press/settled-look.ts:55,174-202`: the look answers `"announced"` when everything settled exactly as it was apart from a notice region that now holds new words.
3. `action-runtime/ignored-press/live-region.ts:1-27`: `role="status"` counts as a notice region. The words are never read.
4. `click.ts:388-392`, in `pressInPlace`: `if (first.noticeOnly && measure().actionable)` returns a failed validation with the code `PAGE_REPORTED_FAILURE` at once. The header at `click.ts:101-103` makes this exception to t896 on purpose: "A first press the page answered with nothing but its own notice still fails at once ... since the notice says the page meant the press to do something".
5. The domain maps it at `domain/src/runtime/failure/codes.ts:218` and `:371`: `web.action.page_reported_failure`, `retryable: true`, `effect: "unacted"`, `certainNoEffect: true`.
6. `action-runtime/recovery/fault.ts:109,134` places it in `ABSORBED_ELSEWHERE`, so the in-command loop never retries it. Core does, which is the retry S9 counts.

**What decides the not_shown failures.**
1. The button carries `hidden` until the grid has loaded its three automatic batches (`team-script.ts:52`, `data/team.ts:69` `TEAM_AUTO_BATCHES = 3`).
2. The batch endpoint answers `429` with `Retry-After: 2` to any request within 900 ms of the previous one (`pages/team-batch.ts:8-10,26-27`).
3. The page shows that wait in its status line, "We are getting a lot of requests right now. Trying again in 2 seconds." (`team-script.ts:35-39`). Its skeleton cards (`aria-hidden="true"`, no text) stay in the grid until a batch lands (`team-script.ts:27,32`).
4. The click gate refuses `hidden` as `web.target.not_shown`, which `recovery/fault.ts:114,189` maps to `"obstructed_target"`.
5. `recovery/attempt.ts:163-165` calls `reveal()`. The Flow's own scrolls had already reached the bottom, so I infer this scroll moved nothing.
6. With nothing moved, the loop waits on `recoveryBackoffLadder("obstructed_target")`, which is `RECOVERY_INTERFERENCE_BACKOFF_MS` [150, 400, 800] (`recovery/budget.ts:65,118-124`). That ladder is meant for a dismissed dialog to finish leaving. It gives up about 1.35 s plus the verb's own time after the first refusal, which matches the 1.6-1.9 s `page.click` spans.
7. Core then retries the node with its own backoff.

## (b) Real or misread?

**The first-press failure is real and deterministic.**
- The fixture swallows the first press of "Show more people" after every page load and after every branch chip (`team-script.ts:10-12` header, `:26` `stuckClickPending = true`, `:77` reset on chip).
- It does not depend on timing, so waiting longer before the press would not help. Only a second press loads the batch.
- The extension reads the effect correctly: nothing happened, there was no request, and the act did not land. Only the code's wording overstates. The page announced "loading" rather than a failure, which by design the extension never reads.
- The e2e spec `apps/extension/e2e/content/tests/reveal-by-scroll/tests/company-website-team-more.spec.ts:71-89` asserts this exact two-command behaviour today.

**The not_shown failures are real but premature.**
- The button truly is not shown yet. The page is still loading, and says so: skeleton placeholders in the grid and its own back-off notice in the status region.
- The extension's own wait gives up on the wrong ladder before the page finishes.
- In exploration the model's pace hid this. 5.3 s passed between opening the team page (step 0006) and the press (step 0016), because exploration also closed the chat and the newsletter.
- In the replay those two steps are passed over, so the press arrives about 0.7 s after load. The button appears roughly 5 s after load. This is inferred from the fixture's constants and the attempt timings, because replays log only `meta.json` and no page view.

## (c) What the fixture does, and how replay should handle it at the root

The fixture's two behaviours are deliberate and realistic: a swallowed first click, and a `429` that the page waits out by itself. A deterministic replay must absorb both without a Core retry.

1. **The swallowed first press.** Treat a first press answered by nothing but the page's own notice as a press that certainly did nothing, and press it once more inside the same command, as t896 already does for a silently ignored press.
   - Notice-only is as certain as settled-unchanged. It is reached only through `changedOnly`: no request, navigation or focus move, and the control and its section exactly as before.
   - The domain already marks it `certainNoEffect`, and Core already presses it again (t743/t528). So pressing again inside the command makes the same press Core would make, only earlier and without a counted retry.
   - The existing second-press check (`afterSettled`, `click.ts:447-466`) already fails a second notice-only press as `page_reported_failure`, so a site that refuses twice still reaches Core exactly as today.
   - job-board's "first save of each page load fails with a notice" (`e2e/site-reset/tests/job-failed-save.spec.ts:18-31`) has the same structure, so its save Flows would replay without a retry too.
2. **The button not shown yet.** Make the not-shown wait follow the page's own readiness evidence instead of the dialog ladder. A target refused as `hidden` while the page shows it is still working should be waited on while that work lasts, then tried as the page settles. The page shows work here through skeleton placeholders in the list's tail, `aria-busy`, a progress indicator, a status region that changed, or a request the page has in flight.
   - The extension already has these readers: `content/evidence/loading.ts` for page-working signals and `content/extraction/page-advance/list-loading.ts` for tail placeholders.
   - The recovery loop does not consult them.
   - A fixed ladder cannot fix this; I checked the arithmetic. The button appeared about 4.4 s after s11's command began. The reveal ladder (400/1000/2400) attempts at about 0.1/0.5/1.5/3.9 s, and the target ladder (250/500/1000/2000) last attempts at about 3.85 s. Both miss it.
   - A wait on evidence catches it inside the 5 s budget. Where a page's work outlasts the command's `timeoutMs`, the honest bound is an allowance for observed page work, like `checkWaitMs` in `domain/src/actions/check-wait.ts`. Lowering or raising a fixed number would be capping the symptom.

## (d) Fix: files and likely owners

None of the root fixes is in the lead's paths (`flow-run/**`, `run-acts/**`, `rows/**`, `engine/automation/{graph-run,person-*}`). I recommend keeping S9's `step_retried` as it is: the retries are real extra work, and once they are gone the replay stands on its own record at 0 calls.

1. **The swallowed first press.** Owner: the extension content lane that holds `actions/click.ts`, the t896 "press once more" work (task-speed plan).
   - `apps/extension/src/content/actions/click.ts`, `pressInPlace` (`:388-392` and `:396`): drop the early `PAGE_REPORTED_FAILURE` return for a first press and fold `first.noticeOnly` into `settled` (`const settled = first.settledUnchanged || first.noticeOnly`). The second press is then looked at (`lookAgain`), and `afterSettled` gives the verdict.
   - Update the header (`:84-114`) and the doc comment at `:673-676`.
   - Tests that assert today's behaviour and must change:
     - `actions/tests/click/tests/settled-look.test.ts:101-114`;
     - `actions/tests/click/tests/swallowed-first-press.test.ts`, where a new case is needed: first press notice-only, second press answered;
     - `e2e/content/tests/reveal-by-scroll/tests/company-website-team-more.spec.ts:71-89`, where one command should now succeed and load more;
     - `e2e/site-reset/tests/job-failed-save.spec.ts`, whose header and click counts describe the Core retry.
   - Docs: `docs/architecture/extension-client.md` around line 1481.
2. **The not-shown wait.** Owner: the extension content lane that holds `action-runtime/recovery/**` and `action-runtime/reveal/**`, the t759 reveal ladder (trace-offline-trials plan).
   - `apps/extension/src/content/action-runtime/recovery/attempt.ts:132,154-165`: for an `obstructed_target` that came from `TARGET_NOT_SHOWN`, where no layer was cleared and the reveal moved nothing, wait while the page shows it is working, then attempt, instead of using `RECOVERY_INTERFERENCE_BACKOFF_MS`.
   - `recovery/budget.ts:118-124`: the ladder choice.
   - `recovery/fault.ts:114,189`: the not-shown mapping, if it gets its own fault word.
   - Reuse `content/evidence/loading.ts` and `extraction/page-advance/list-loading.ts`.
   - If page work may outlast `timeoutMs`, add an allowance in `domain/src/actions/check-wait.ts`; that is a domain lane.
   - Add a unit test in `recovery/tests/`, plus the company-website e2e case: the button pressed from the end of the page right after the scrolls, with no reveal movement.

**Acceptance.** Run `lab attempt company-website --task company-website-apprentices --authoring-mode answer-first --scripted-model --attempts 4`. Attempts 2 to 4 should show "Show more people" with one `send.click` and no Core retry, and 0 calls (the judge not asked).

## Commands run and observed results
Read-only. I used `cat`, `grep`, `sed` and `ls` over the t898 run folders, the t898 worktree's sources, and Core's `replay-stands.ts` and `steps-ran.ts`, both in `!FluxIQ` and in the t898 Core sibling (the same rule: line 59 in main, line 61 in the t898 sibling). I ran no build, test or Lab command.

## Not verified
- What the page showed at each failed replay attempt. Replays log only `meta.json`, so the button's hidden period, the 429s and the skeletons are inferred from the fixture's code and constants together with the step timings.
- Whether the reveal scroll moved during attempts 0051 and 0052.
- That the deviation was `step_retried`. The run does not record the word; I inferred it from the rule and the record.
- Which of `evidence/loading.ts`'s signals fire on this page. The skeleton and spinner classes are hashed, but the `aria-hidden` empty placeholders and the status region are structural.
- Exact lane ownership of `click.ts` and `recovery/**` today. The owners above come from which plans made t896 and t759.
- That the proposed fixes work, and that pressing a notice-only first press again inside the command breaks no other spec. I did not search every spec that asserts `page_reported_failure` on a first press beyond the four listed.

## Open questions or contradictions found
- The brief says the click "fails once". It fails with `page_reported_failure` once per replay, but the same node also fails `not_shown` 0 to 2 times before that. Both are retries that S9 counts, so fixing only the notice case would still leave `step_retried` on most replays.
- `click.ts:101-103` deliberately keeps the notice-only first press out of t896. Fix 1 reverses that decision. The owner should confirm that the reason given, "the notice says the page meant the press to do something", is not needed for safety. The code's own `certainNoEffect` marking says it is not.
- H5's unexplained "7 live steps at level 100" is explained by this trace (see Evidence).
