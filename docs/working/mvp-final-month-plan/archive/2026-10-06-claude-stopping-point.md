# Claude stopping point

Preserved from downstream 92d790d7 before the consultant audit. Historical source/build claims below retain their original UTC dates.

# MVP Final Month Plan

Status: Active
Status detail: Handed off to Codex 2026-10-07 05:10 UTC; read-list redesign S1-S6 and the fix-everything workstreams landed; Lab stale-worker defect found and fixed; no lane passes twice; structural plan next.
Created: 2026-10-05
Last updated: 2026-10-07
Owner: Senior supervisor agent
Scope: The ordered plan from 2026-10-05 to the polished-MVP deadline of 2026-11-10: what is done, what is held on unmerged branches or dirty trees, what must be integrated and pushed, and the week-by-week work to pass the 30-day plan's Final MVP Acceptance Test. It does not redo intake already recorded in the 2026-10-03 handoff, and it does not itself run live provider calls.
Paired document: none (planning only; Core state is read, not changed)
Related: [30-day MVP plan](../../../../FluxIQ%20Web%20Extension%20%E2%80%94%2030-Day%20MVP%20Implementation%20Plan.md), [Claude handoff 2026-10-03](../../claude-work-handoff-2026-10-03.md), [live loop](../../language-driven-flow-loop-plan.md), [working index](../../README.md)

---

## Current State

Deadline 2026-11-10. Feature freeze 2026-10-29. Updated 2026-10-07 05:10 UTC at the end of Claude's 2026-10-06/07 session; **the user handed off to Codex**. One supervisor at a time: no Claude agent is running (all stopped at handoff); nothing is uncommitted in any tree. Dev heads: Core `e9b7d691`, downstream the handoff commit after `bc07b1cf`; both pushed. Final checks on those heads: Core `fluxiq:check` and structure audit exit 0; downstream domain, extension, test-runner and test-contracts checks exit 0; downstream structure audit passed.

**Read first, in this order.** (1) The week report `reports/week-review/report.md` (what failed 2026-09-29..10-06 and why). (2) `structural-agent-plan.md` — the user's agreed direction for what comes next, with the full list of 30 structural problems. (3) `node-catalog-plan.md` — the user's ordered node audit. (4) The Work Ledger entries of 2026-10-06/07 below for exact commits and validation.

**Biggest finding of the night (R4-1).** Every Lab browser profile ran a **cached extension service worker** (lanes A, B from 2026-10-03 18:31; C, D from 2026-10-05 21:19): Chromium keeps it in `Default/Service Worker` and starts it on a persistent launch even after the files change. So **no background-side change since 2026-10-03 ever ran live** (action runner, gateway mapping, activity relay and pacer, connection); lane C's round-4 Next page was answered `UNSUPPORTED_TYPE`. Verified by the supervisor: the cached `ScriptCache` has 0 mentions of `web.dom.next_page`, the built bundles 11. Fixed: the Lab deletes the cached worker before every launch (downstream merge `411e4b90`). Not yet built: a Lab guard that compares the running worker's build with `build-info.json` and refuses on mismatch. Treat every background-side live verdict since 2026-10-03 as unproven.

**Landed this session (all verified, merged, pushed; details in the ledger).**
- Lane loop fixes: a refused amendment with a rerun no longer loops; frame-stable page digest `web-state.v4`; C R2-2/R2-4; D D2-1/D2-2; t278 `checked` rows reach repair.
- t279 plain failure ending, list names, field samples and readable labels; t280 node definitions on first use.
- Round-3 fixes: B act credited to its choices' opener; C left-out label check; D D3-1/D3-2/D3-5 and round funding; A run-2 C1a/C2/C3/F1; W15 no second copy of a step or read.
- The user's fix-everything order: t285 acts judged by the page change and refused when made, pickup choices; t286 judges see only this run's changes, nothing-to-change ending, R3-3, R2-C8; t287 every refusal names its way out, three same-kind refusals end the round; t288 UI; t289 peak-hour guard (`OVERRIDE-peak`), killed-run spend, pid stop, stale-dist refusal, heavy-test timeouts, large-page capture 30.9 s -> 2.1 s; t292 small gaps; t293 sweep stale tests.
- The **read-list redesign** S1-S6 (the user's direction): the read reads one page; a Next page node; a do-while repeat; every read's rows collect into the run's dataset and are processed at run end, whole-row dedupe by default; proof 1 passes lane C's 5-page shape provider-free (collected 17, answer 13).
- Round-4 fixes: A C1/C2b, B unchanged-press refusal, D D4-1/D4-2, R4-1.

**Live results.** Round 3 (2026-10-06 21:20 UTC, $0.46): A passed once (`run-mux6n7m4-8273e7a0`, 4/4 facts; replays `replay-mux70ks8-42b807a0` and `replay-mux72fiq-dbf45610` with 0 calls) and then failed its second run; B failed; C failed with the oracle at 13/13 (refuted); D failed (a wrong Flow accepted). Round 4 (2026-10-07 04:00 UTC, $0.273): all four failed (A `run-muxkzdjw-31a13429`, B `run-muxkyfxz-446c3a4e`, C `run-muxky0df-c9839389`, D `run-muxky54f-fadb9d03`); causes fixed as above. **No lane has passed twice in a row.** Round 5, a measurement round with the current background code, was cancelled at handoff before any launch.

**Not done / open.**
- Structural plan stage 1 and 2 designs were **stopped before writing their reports**: rerun from their briefs (`structural-agent-plan.md` "Brief: general-tools design", with the user's decisions; this document's "Brief: evidence-acts design", widened to the small edit language and cheap recovery).
- Node catalog audit: interaction and reading done (`node-catalog-plan/reports/node-audit-{interaction,reading}.md`); navigation and gaps were stopped, rerun them. One user decision pending from the interaction audit: hover menus and sites that ignore synthetic input need trusted input, which only the debugger channel gives (the user ruled the debugger out except for network capture behind the requests toggle).
- Open live causes: A C1b (a choice claim not judged when made); B 1b (a `set` act counts done on the press that opened its chooser) and 3 (a rerun of a lasting step is only checked and answered "changed nothing"); C R4-2 (repairs tried to add Next page by amendment) and R4-3 (a judge misread the Plus badge); D D4-2b (a repeat lands on an interruption press), D4-3 (no detect after the first confirm), D4-4 (all judges wrongly blamed a correct filter), D4-5 (a read that keeps none returns its rejected rows); UI R4-U-1..4 and the round-4 UI items in each lane's debug.
- Read-list S7 (retire the read's own paging) waits for lane C's live proof.
- Lane trees t262 (A, B), t274 (C), t275 (D) are on dev (Core `e9b7d691`, downstream `411e4b90`) but their **rebuild was stopped mid-way: rebuild before any live run** (`pnpm.cmd build` in each `!FluxIQ`; domain, test-runner and extension builds downstream). Slots 1-4 still name these lanes.
- Sweep 2 of 2026-10-07 not run; sweep 1 (01:48 UTC) was green after three stale-test fixes.
- Cleanup: task branches t262, t274, t275 and t281-t294 were merged by hand and still exist with their worktrees under `fxwork/`; remove finished ones with `pnpm task finish` or `pnpm task abandon` (never `git worktree remove --force`), then `pnpm task prune --dry-run`.

**Next, in order.** 1) Rerun the two structural designs and the two remaining node audits; bring the user their decisions with recommended defaults. 2) Build structural stages 1 and 2 in parallel by file, then stage 3; fix the open live causes the redesign does not remove. 3) Rebuild the lane trees, then a live round off-peak with the current background code; report JS use as "partial success, used JS". 4) Two consecutive passes per lane plus zero-call replays; then Phase 1b.

**Decisions in force (user).** One supervisor at a time. The read list never paginates; rows collect per read step and are processed at run end (memory `read-list-no-pagination-collect-then-postprocess`). Direct API requests are a toggle, OFF by default, in config and the settings UI; no debugger channel for JS; JS is a last resort after about three failed typed-node attempts, and a Lab run that used it is "partial success, used JS" (memory `js-last-resort-requests-off-by-default`). Live runs only off-peak (01-04 and 06-10 UTC weekdays are refused by the guard unless `lab-slots/OVERRIDE-peak` exists), on the ten realistic scenarios, headed, from the extension chat, supervised, never relaunched in a loop, and only once every agreed fix has landed. Full suites at most twice a day. Recording is evidence beside mandatory instructions and waits for A-D.

**Process lessons from this session.** Gates must stop at the first non-zero exit (twice a landing continued past a failure; the code was verified afterwards). After merging Core, rebuild main Core's libraries before downstream checks (the stale-dist guard refuses otherwise). Leads cannot run `git merge`; the supervisor resolves conflicts (`draft-amendment-feedback.ts` and `refusal-way-out.test.ts` conflicted repeatedly).
