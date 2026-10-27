# t756 covered target on photo-social's grid (august-over-1300, run-mvdi88yz-e444d594)

Worker report. Tree `fxwork/t756-covered-target-grid-screens`, branch `task/t756-covered-target-grid-screens`. No commits, no model calls, no Lab runs.

## Outcome

Done for the covered target. That was a product defect in the extension's actionability gate, not a fixture or overlay-placement problem, and it is fixed and proven headed. Partial for "why screens 2-3 were never loaded". The builder authored no scroll, and the one-page grid read never reports that the list continues. That second cause is traced and reproduced but not fixed, because the honest fact needs a Core vocabulary change (see the list-continues entry).

## 2026-10-27 - Trace (read-only)

- Run step files read: `steps/0120`, `0132`/`0134`, `0138`, `0148`, `0260`, `0264`, `0286` (`result.json`), `0121-judge/request.json`.
- Trials 0138, 0148, 0260 all failed the same way: step "open the post", target the grid cell's `<img>` (found by alt, `Photo by Harbourlight Studio on September 20, 2026...`), `web.target.not_actionable`, "covered: the point 441,360 landed on ul.xodf1f4, which covers the target", four attempts, all `obstructed_target`.
- The covering element is the scenario's own grid cell markup (`pages/profile.ts` `gridCell`): `<a class=cell role=link><img class=cellImg ...><ul class=cellOverlay>` like/comment counts `</ul></a>`, and `look/stylesheet.ts` line 74 draws `cellOverlay` as `position:absolute; inset:0; opacity:0` (opacity 1 on hover). So the overlay sits over the whole picture, inside the same link. This is the ordinary photo-grid pattern (the counts overlay over the thumbnail inside the cell link), so the fixture behaves like a real site; a person's click on the picture lands on the overlay and opens the post.
- Not the FluxIQ activity overlay and not the scenario's dialogs: the hit element is the cell's own `ul`.
- The gate (`apps/extension/src/content/action-runtime/actionability.ts`) accepted a hit only on the target or its descendants; the overlay is the target's sibling, so every probed point was a cover and the runtime refused a press a person would make. Product defect.
- Trial 0134 (`web.action.blocked_by_dialog`, cookie consent): the trial starts from the site's reset start, consent unanswered. Reproduced below: before the fix, the defence declines the consent and then spends its retries on the cell overlay. The exact live wording ("closing 2 dialogs", consent covering again, "2 attempts") was not reproduced; see Not verified.
- Trials 0264/0280/0286 (step 10 `web.target.not_found` / `web.action.timeout` on "read the post's date footer", control "August 21"): these revisions read the date footer through a target fingerprinted on the text "August 21" while the loop opened other posts first (0264 kept 21 rows, first one September 20; 0286 kept 8 August rows, first not August 21). A text-bound target on a per-row value is a builder construction issue, not a page obstruction. Not changed here.
- Why screens 2-3 were never loaded: trials 0120/0128 authored no scroll and read 12 cells; later revisions read 24. See the 2026-10-27 list-continues entry: the one-page read itself never told the builder the grid goes on.

## 2026-10-27 - Reproduction, failing on current source

Change: new content-harness spec `apps/extension/e2e/content/tests/actionability/tests/grid-cell-overlay.spec.ts` (photo-social only, provider-free), three rows:
1. press the first grid thumbnail (the one the live trials pressed); expect success and the post dialog.
2. load screens 2-3 the visitor's way (scroll, rate limit "Try again", session "Continue as", each pressed by the runtime), press the 21 August thumbnail, read date and likes from the dialog; expect `{date: "August 21", likes: "1,349"}`.
3. from the site's start (consent unanswered), wait 4 s, press the first thumbnail; expect the consent declined (`consent: "essential"`) and the post dialog.

Command: `pnpm test:content -- e2e/content/tests/actionability/tests/grid-cell-overlay.spec.ts --headed --workers=1` (in `apps/extension`).

Observed before the fix:
- row 1: `x` - `Action rejected: the point 441,360 landed on ul.xodf1f4, which covers the target` (same point and element as the live run).
- row 2: `x` - screens 2 and 3 loaded (36 cells), then the August press failed with the same `ul.xodf1f4` refusal.
- row 3 (run as a probe with the fix temporarily disabled): `failed`, `web.target.not_actionable`, "the execution did not recover within its 4 attempts after absorbing blocking_dialog, obstructed_target, obstructed_target, obstructed_target, closing 1 dialog".

## 2026-10-27 - Fix

- New `apps/extension/src/content/action-runtime/pressed-control/`: `pressable-host.ts` (`PRESSABLE_HOST`, the one selector for the control a press is delivered to, moved out of `interference/press-guard/acting-control.ts`, which now imports it), `same-control-hit.ts` (`sameControlHit(target, hit)`), `index.ts` barrel, `tests/same-control-hit.test.ts`.
- `actionability.ts`: when no point reaches the target itself, a point whose hit lies inside the link or button the target is in, with no other control nested between, is accepted as a press on that same control (centre first, then the existing probe points). The press is still dispatched on the target. A hit outside that control (dialog, scrim, other card) or on a control nested in it (a Like button in the link) stays `covered`, so the dialog defences still run first. Retry ladders unchanged: first attempt plus 3 retries.
- No model guidance, fixture, task or oracle changed.

## 2026-10-27 - Validation

All in `apps/extension` unless stated.
- `pnpm test:content -- e2e/content/tests/actionability/tests/grid-cell-overlay.spec.ts --headed --workers=1` -> `3 passed (30.3s)` (rows 1, 2, 3 ok; before the fix rows 1 and 2 failed as above).
- `EXTENSION_TEST_BUILD_LABEL=t756 node scripts/test-extension.mjs action-runtime/pressed-control/tests action-runtime/tests/actionability action-runtime/interference/press-guard/tests` -> `# tests 9 # pass 9 # fail 0` (6 new, 3 existing actionability).
- `EXTENSION_TEST_BUILD_LABEL=t756 node scripts/test-extension.mjs action-runtime/interference action-runtime/recovery` -> `# tests 151 # pass 151 # fail 0` (includes `interference/tests/acting-control.test.ts`).
- `npx tsc -p tsconfig.json --noEmit` -> exit 0; `npx tsc -p tsconfig.test.json --noEmit` (src + e2e) -> exit 0; `domain`: `npx tsc -p tsconfig.json --noEmit` -> exit 0.
- Repo root `node scripts/structure-audit.mjs` (`pnpm structure:check`) -> `structure-audit: passed (222 warning(s), 616 baselined).`, no line naming a touched file. `node scripts/check/core-mirror.mjs` -> `core-mirror: 1 mirror set(s) match FluxIQ Core ... structure-audit (72 files).`
- Content harness, photo-social and click-related specs (actionability, actions, dialog-dismissal, dialog-refusal, click, failures, identity, evidence, extraction pagination/inference/structure-detection, offline-reads, selectors, safe-clearing, own-layer, press-answers, reveal-by-scroll), `--workers=3` -> `211 passed, 2 failed (7.6m)`. The 2 failures are `press-answers/tests/wake-press-cover.spec.ts:71` (bigbox) and `reveal-by-scroll/tests/company-website-team-more.spec.ts:57`. Both details say "landed on the target", so they are not the new same-control path. Rerun with the fix temporarily disabled (`sameControlHit` short-circuited, then restored; `grep -c T756-TEMP` -> 0) -> the same 2 failed and 1 passed. They fail on the current source without this change.
- Installed-extension photo-social specs: `pnpm test:e2e:build` then `node --no-experimental-strip-types node_modules/@playwright/test/cli.js test -c e2e/playwright.config.ts e2e/site-reset/tests/photo-toggle.spec.ts e2e/site-reset/tests/photo-dialog-step.spec.ts e2e/site-reset/tests/photo-dialog-destination.spec.ts --workers=1` -> `3 passed (4.8m)`.

## 2026-10-27 - The grid's later screens: the read never says the list goes on (needs Core)

Probe (content harness, removed from the spec after recording): a one-page `web.dom.extract_list` of the grid cells on the studio profile.
- Read 1 s after load: `itemsSeen 12`, `pagesRead 1`, no `listContinues`.
- Read 2 s after load: `itemsSeen 24`, no `listContinues`; under the grid the page showed "Please wait a few moments before you try again. / Try again in 3s".

Cause: the read's own reveal (`extraction/list-wait.ts`) scrolls the list end, the grid loads a screen (or not, inside its 1.5 s pace limit from page load), and the next reveal is answered by the rate-limit notice. Nothing grew inside the 900 ms window, so the reveal ends `complete`, and F8 (`read-coverage/list-continues.ts`, which landed on 2026-10-19, after the run) reports nothing. So on current dev, as at the run, the builder is told the 12- or 24-row read is the whole list, while 45 posts and a pace notice are on the page. This matches trials 0120/0128 (12 seen) and 0138+ (24 seen).

Not fixed here, because it needs Core: the honest fact is a new evidence word (the list's loader answered a reveal with a wait / rate-limit notice), and Core whitelists the words in `packages/fluxiq/src/programs/automation-studio/runtime/service/summaries/extraction-summary.ts` (`CONTINUES_EVIDENCE`) and words them in `runtime/result-verification/read-account/list-continues.ts`; the domain's `domain/src/actions/extraction/list-continues.ts` `EVIDENCE` set too. Reusing `still_growing` would be untrue for the 12-row case (nothing grew). Proposed owner: a Core-paired task (extension `read-coverage/list-continues.ts` using `rate-limit-notice.ts`/`isRateLimitLayerText` on the element after the list, domain and Core vocabularies, tests beside each).

## Not verified

- No live or paid run; whether a rebuilt Flow now completes august-over-1300 is unproven. The read still says nothing about the list continuing, so a builder may still read only 12 or 24 cells.
- The scenario-lab `breadth-paths.test.ts` was not run. It drives Playwright directly, not the extension runtime, so this change does not reach it.
- Firefox build not exercised; the change is engine-neutral DOM logic.
- Trial 0134's exact live sequence was not reproduced (see open questions). Trials 0264/0280/0286 (text-bound date footer target) were not changed or retested.
- The two pre-existing content failures above were not investigated.

## Open questions or contradictions

- Trial 0134's exact sequence ("closing 2 dialogs", the consent dialog covering again after it was closed, "2 attempts") did not reproduce from the site's start; with the fix the consent is declined once and the press opens the post. Whether the live consent reappeared (start-hook reset racing the trial) is not isolated.
- `tasks-photo-social.md` corrected (row for `august-over-1300` and the old empty-dataset note), per the brief.

UNIT READY: apps/extension/src/content/action-runtime/actionability.ts, apps/extension/src/content/action-runtime/interference/press-guard/acting-control.ts, apps/extension/src/content/action-runtime/pressed-control/pressable-host.ts, apps/extension/src/content/action-runtime/pressed-control/same-control-hit.ts, apps/extension/src/content/action-runtime/pressed-control/index.ts, apps/extension/src/content/action-runtime/pressed-control/tests/same-control-hit.test.ts, apps/extension/e2e/content/tests/actionability/tests/grid-cell-overlay.spec.ts, docs/working/breadth-forty-tasks-plan/reports/tasks-photo-social.md, docs/working/breadth-forty-tasks-plan/reports/t756-covered-target.md
