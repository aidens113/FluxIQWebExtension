# t775-H: headed provider-free site-reset suite

## Outcome
Partial. 20 of 27 specs (the suite has 27 test entries, like-loop counts twice) pass headed after spec fixes. 6 still fail (7 test entries): the four new `judged-change` ones are 2 of 4 green. Remaining failures are not clearly spec-side; diagnoses below. Nothing in either repo's source was touched; no git command run; no model calls.

## How it was run
- Core libs rebuilt first (`pnpm test:e2e` refuses a stale Core): `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` in `fxwork/t775/!FluxIQ` (fluxiq built, 63 s).
- Specs: from `apps/extension`, `pnpm test:e2e <spec files> --workers=1` (builds the extension bundle, then Playwright headed through the extension fixture). Full suite: `pnpm test:e2e e2e/site-reset/tests --workers=1` (29 min).

## Root cause of most failures (spec-side): no start location
`projectBuild` (`site-reset/project-build.ts`) never passed `startLocation` to `generateFlowBootstrapAdaptation`. Without it Core's project build has no arrival and no `look` (`phase-start.ts` `arrival()`; D5 "returns undefined when no start location"), so trials took no before/after readings and the judge request had no `siteChange`. Evidence: the add-to-cart judge request had `resultSummary` keys `..., endView, startedWith, taskChecklist, recheck` with no `siteChange`; step log showed the `test_candidate` site_check reset taking 1 ms. Adding `startLocation` made the same spec pass.

## Spec fixes (all in apps/extension/e2e/site-reset/**)
1. `project-build.ts`: `projectBuild(build, name, task, startLocation?: string | (() => string))`, passed to `generateFlowBootstrapAdaptation` when given. Old: no start location. Why not weaker: it only supplies the input the real extension chat always gives; no assertion changed.
2. The 4 new specs pass the page they open (`detail`, `profile`, `viewJob`); 12 rewritten specs (office-address-confirm, office-buy-now, office-cross-brief, office-navigating-press, office-reloading-confirm-undo, photo-dialog-act, photo-dialog-destination, photo-dialog-step, photo-looped-other-item, photo-toggle, job-unexplored-step, job-undo-redraws-on-load) pass `() => installed.page.url()`.
3. `change-proof.ts` `judgeLog().siteChanges()`: old one entry per judge request; new one per trial run (first request of each `context.runId`). Why: each trial is asked twice (first ask plus confirmation, same run), so D4's `toHaveLength(trials)` and index-based reads (`[1]` = second trial) were off by 2x. Same data, asserted per trial; no expectation relaxed.
4. `change-proof.ts` `judgeLog(accounts?)`: optional `{quote, why}` makes the scripted yes account for a read condition's left-out rows (names `condition N`, quotes the request's words, same as `photo-page-order-limit.spec.ts`). Used by like-loop `newest` (task "three most recent posts"). Old: bare yes, which Core held as `candidate.trial_not_judged` / `yesUnconfirmed` ("did not provide the required exclusion evidence"). Core still decides; nothing passes the trial for it.
5. `photo-dialog-destination.spec.ts`, `photo-dialog-step.spec.ts`: `trialSteps` now filters to labelled steps. Old: all feedback steps; the trial now has a leading unlabelled step (entry arrival at the start location), so `[["succeeded",null]...]` was one entry too long. Same assertions on the Flow's own steps.
6. `judged-change-save-then-read.spec.ts`: detect the saved list from the target job's title link (as `offline-first-job` does), not the Unsave button. Did not fix the failure (see P2).
7. `judged-change-add-to-cart.spec.ts` and `judged-change-like-loop.spec.ts`: diagnostic now also keeps `judgeRequests`.

## Per-spec results (final)
Command for the full suite after fix 1-2: `pnpm test:e2e e2e/site-reset/tests --workers=1` -> "13 failed, 14 passed (29.2m)". Then fixes 3 and 5 and targeted reruns:
- PASS: installed-project (2), job-failed-save, job-unexplored-step, judged-change-add-to-cart, judged-change-address-carried, office-address-confirm, office-buy-now (2), office-cross-brief, office-navigating-press, office-read-after-change, office-site-reverted-toggle, offline-first-job, offline-first-photo, photo-dialog-act, photo-page-order-limit, repair-first. (office-address-confirm, office-buy-now x2, office-cross-brief, office-navigating-press, job-unexplored-step, photo-dialog-act, the two new passes and office-site-reverted-toggle re-confirmed after fix 3 in targeted runs: "3 passed", "2 passed ... 1 failed", "5 passed".)
- job-undo-redraws-on-load: shows `x` but is the `test.fail` known gap (t772 w11), counted as passed.
- FAIL: judged-change-like-loop (newest), judged-change-like-loop (pinned), judged-change-save-then-read, office-reloading-confirm-undo, photo-dialog-destination, photo-dialog-step, photo-looped-other-item, photo-toggle.
- The last full 27-spec run was before fixes 3 and 5; the full suite was not rerun after them (29 min); the affected specs were rerun individually as above.

## Product defects / undetermined (not fixed)
P1 (suspected product, Core or domain): an unconditional like press in a Flow is not held to `ensureState`. like-loop pinned and newest: after the trial the liked-at-exploration post is unliked (`likedAtEnd = [DQw.., DZc..]`, expected to contain `D96ahbWGjtY` / `D1OKDvAEHfa`; assertion line 123). Judge `siteChange` (pinned): witness w1 at `D96ahbWGjtY`, before state 3 = 0, after "button Like added / Unlike gone", acts for steps 7, 11, 15 all `changed`, none `already_in_state`. The explored press's answer carried `toggle: {signature: {via: "name", gains: ["unlike"], loses: ["like"]}}` and the click's `flowShape` parameters in the judge request hold no `ensureState`. Same cause plausibly explains photo-dialog-step (`dialogLikedAfterTrial` 0, expected 1), photo-looped-other-item (second trial's `leftFromEarlier` empty), photo-toggle (explored like's act no longer listed with a settle: received "" for `settle`) and photo-dialog-destination (`trialAct` empty): the trial toggles the explored like off. Not proven; the E-domain-toggles report says the live path was never exercised and Core's tie of an explored press to a hand-written step (same node, same handle, exactly `modify_existing`) may not match `web.dom.click` vs `web.output.dom-click`.
P2 (undetermined): judged-change-save-then-read: `web.detect_repeating_structure` on `/myjobs` after the save throws a bare `Error` (step log `0009-tool-web.detect_repeating_structure`: status `threw`, code null, 61 ms), for the target row title link and for another row's title link. The same tool succeeds in offline-first-job on the same page before a save. Page at the call shows "3 saved jobs", target first with handle t98. Cause not found (2 attempts: button cell then title-link cell).
P3 (undetermined, spec or product): office-reloading-confirm-undo: with the start location, `trial.open` is `yes` and the trial's own fresh Buy Now checkout shows the default address, so `undo.chooser` answers `candidate.undo_already_back` (act-4 "already back": fresh complete reads show it as found) and the spec's `answers["undo.chooser"].ok` (line 147) is false. The spec's premise (confirm stays open after a trial) no longer holds when the trial opens a new checkout. Needs the owner to decide whether the settlement or the spec's scenario is right; I did not relax it.

## Acceptance output
- `npx tsc -p tsconfig.test.json --noEmit` in apps/extension -> exit 0, no output.
- `node scripts/structure-audit.mjs` at downstream root -> "structure-audit: passed (230 warning(s), 616 baselined)."

## Not verified
- Full suite after fixes 3 and 5 (only targeted reruns).
- Root cause of P1, P2, P3.
- Spec titles still describe the retired flow in office-buy-now and office-address-confirm (D4 noted).
