# Week review 2026-09-29..2026-10-06: process and product friction

Worker: week-review-friction. Brief: `docs/working/mvp-final-month-plan.md`, "Brief: week-review-friction (worker)" and
"Shared rules for the week-review briefs". Read-only; nothing changed except this file.

## Outcome

Done. Part 1 lists 14 process time wasters drawn from the Work Ledgers (live and archived) of the named documents.
Part 2 lists 22 user-facing friction points from the manual panel findings, Codex's UI/UX review and the live UI
reviews and fix reports (t276, t277). Every row uses the shared table shape (cause, theme, runs affected, dollars,
status, evidence). Status hashes come from `git log` of downstream or Core `dev`. Dollar figures are quoted from the
ledgers; I did not recompute them (the numbers worker owns that).

Ledgers that had **no entries in the window**: `mvp-today-plan.md` (last entry 2026-09-27),
`agent-git-workflow-plan.md` (2026-09-17), `automated-testing-facility-plan.md` (an Execution Log table, no dated
entries), `week2-exit-plan.md` (2026-09-22). `codex-tasks-2026-09-30.md` has one entry (tasks written).
`live-activity-chat-plan.md` has two 2026-09-29 entries, both accepted with no friction. The substance is in
`language-driven-flow-loop-plan.md` (live ledger plus archives `ledger-2026-09-28-to-30.md`,
`ledger-2026-09-30-night.md`, `ledger-2026-09-30-to-10-01.md`, `ledger-2026-10-01.md`),
`mvp-live-continuation-2026-10-03.md` and `mvp-final-month-plan.md`.

Commit volume over the window (`git log dev --since=2026-09-29`, by author date): downstream 803 commits, 318 of them
merges; Core 571 commits, 248 merges. **No commit in either repository is dated 2026-10-04.**

## Top three

**Process time wasters**
1. **Integration as a serial, supervisor-only bottleneck** (P2, P9): lane work sat in lane trees and task branches,
   twelve integration rounds in four days each needed hand-resolved conflicts in the same hot files, leads could not
   run `git merge`, and Codex's t262 stayed local from 10-03 to 10-05.
2. **Unsupervised and undebugged live runs** (P1): on 09-30 the leads died on a session limit at about 04:00 and
   launcher loops kept relaunching; 112 runs and $9.46 that day, $4.25 of it after the leads died, ending at the
   DeepSeek balance stop. One loop survived the first kill.
3. **Slow, flaky full suites and stale builds** (P3, P4): 15 s timeouts in heavy Core service tests on every sweep
   (7, 9, 32, 39, 10 failures, all timeouts), a 1,316 s collection, stale Core and domain dists that produced false
   failures, and builds that ran from cold until t187 and t192 (09-29 to 09-30).

**User-facing friction**
1. **The chat speaks the system's language, not the person's** (F1, F3, F5, F8): node names, "pagination",
   "selector", step numbers, judge text cut mid-parenthesis, dollar bookkeeping in the ending. Mostly fixed by
   t276/t277. The ending (R2-U-2) is still open.
2. **Cards hide what happened** (F2, F4, F6, F7): read cards with no counts, "Passed" on an empty result,
   refusals shown as work and stacked six deep, and "it wasn't on the page" when the list was visible. Fixed in
   t276/t277, except build-time read counts, which need the domain to send rows.
3. **The failed build does not say what blocked it** (F8, F9). The ending gave either nothing or dollar arithmetic.
   It never said "each try to re-read the list was turned down, so no fix could be tested". Open (t279 in flight).

## Part 1: process time wasters

| # | Cause in plain words | Theme | Dates / runs affected | Dollars | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | **Live runs relaunched in a loop with nobody debugging.** The leads ended on a Claude session limit at about 04:00 (09-30). Scratchpad launcher loops kept starting live runs until the DeepSeek balance ran out. Renaming the scripts to `*.disabled` did not stop `t193/loop2.sh` (PID 23332, running since 03:06). It was found still running at the resume, and the permission check refused the supervisor's kill until the user approved it. Lane D's 12 "passed" runs were permission stops with `flowCreated=false`. | Lab, harness and infrastructure; agent process | 09-30; 112 runs with spend (t174 $3.86, t193 $2.65, t194 $0.25, t195 $2.70) | $9.46 total, $4.25 after the leads died | fixed: Lab guards refuse a run that is unbudgeted, after an empty balance, unchanged, undebugged or looping (downstream `5363e39b`, `ecf9c524`); spend ledger | archive `ledger-2026-09-28-to-30.md` entries "Stopped: the DeepSeek balance ran out…" and "Resumed: a live relaunch loop found still running" |
| P2 | **Integration lagged the work.** Lane fixes lived on task branches and in lane trees (t174/t193/t194/t195, later t262/t274/t275) and landed in batches: integration rounds 1-5 on 09-29..10-01, rounds 9-12 on 10-01. The same files conflicted round after round: `run-scenario.ts`, Core `service.ts`, `phases.ts`, `evidence-loop*`, `testing-facility.md` and the generated framework reference. Lane trees were snapshotted to `wip/<lane>-uncommitted` and retired on 10-05. Lane A's loop fix was uncommitted at the end of the 10-05 session. On 09-30 the work of seven crash-landed workers had to be audited and gated (t173) before anything else could move. | agent process | 09-28..10-06, every integration round | n/a | partly: lanes now merge between runs and trees are synced each round (10-06 entries); conflicts in hot files remain structural | archive `ledger-2026-09-28-to-30.md` (t173, rounds 1-2), `ledger-2026-09-30-to-10-01.md` (rounds 3-5), `ledger-2026-10-01.md` (rounds 9-12); `mvp-final-month-plan.md` 10-05 "t267 and t273 landed" and 10-06 "Live round 2" |
| P3 | **Full suites slow and noisy.** Every sweep produced 15 s timeouts in heavy Core service tests and no assertion failures: 7 on 09-29 (673 s for one directory alone), 9 and 32 on 09-30, 39 and then 10 on 10-01, 1 on 10-06 with a 1,316 s collection. Each needed a rerun at `--testTimeout=120000` to show it was not a real failure. Intermittent extras: the scenario-lab `naive-paths` test sat idle for 25 min (09-30) and Lab `unbuilt.test.mjs` failed 1 in 3 (10-01). Before t187: `pnpm check` 181 s, the finish check 314 s, the Lab prelude 81 s, `task start --worktree --core` 151-156 s. | Lab, harness and infrastructure | 09-29..10-06 | n/a | partly: build and check reuse (downstream t187 `4afa80fc`, Core t192 `fb05385a`/`3697462a`), t215 storage speedups (Core `21a190a6`), and the user's rule of full suites at most twice a day (10-01). Timeouts recur (10-06 sweep). | archive `ledger-2026-09-28-to-30.md` (round 1, t187 measurements); `ledger-2026-09-30-night.md`; `ledger-2026-09-30-to-10-01.md`; `mvp-final-month-plan.md` 10-06 "t277 … sweep 1" |
| P4 | **Stale build output gave false failures and false passes.** Dev's stale Core dist hid a bad import (09-30). test-runner failed TS2305 on a stale domain dist (10-01). Web tests failed on a stale Core dist (10-02). The main Core dist was stale again on 10-06. The 10-05 sweep's downstream half stopped on the main checkout's stale dist. Lane trees had to be synced and rebuilt before every round. A docs-only dev commit made the behind-dev guard refuse two lanes' launches (10-01). | Lab, harness and infrastructure | 09-30, 10-01, 10-02, 10-05, 10-06 | n/a | partly: test scripts and `pnpm check` now refuse a stale Core dist (09-30); test-runner rebuilds a stale domain dist (t225); the behind-dev guard (`af672ea8`) admits docs-only gaps (`a8f1971e`). The 10-06 stale main Core was still caught by hand. | archive `ledger-2026-09-30-to-10-01.md` round 3/4; `ledger-2026-10-01.md` "Fix list on dev"; `language-driven-flow-loop-plan.md` 10-02 entry; `mvp-final-month-plan.md` 10-05 "Sweep 1", 10-06 "Frame-stable digest" |
| P5 | **Extension start failures blamed on machine load.** Live runs 11 and 12 died before pairing with 0 provider calls. The extension start failed in 6 of 9 launches, and 1 of 10 under the unchanged Lab. A CPU priority governor was added first. The user rejected load as the cause. Probe t174-w7 then found the Lab's network-guard canary stopping the first `fluxiq.connect` inside the starting service worker. | Lab, harness and infrastructure | 09-29; `run-munhpy2m-036e9572`, `run-muni3pdr-80225d3f` | ~$0 (no provider calls) | fixed: downstream `5903a1e7` "The Lab's network guard no longer crashes the extension as it starts" | archive `ledger-2026-09-28-to-30.md` "After the restart" |
| P6 | **Machine and environment interruptions.** Both repositories were re-cloned off the F: drive, whose files were locked to another machine's accounts (09-29). A restart applied a fixed pagefile after the "memory" crashes turned out to be the Windows commit limit (09-30). The live slot sat idle for more than an hour after the restart, because the live lane was told to finish full validation first and t187's bench held a build slot; the user noticed. A Windows EPERM race crashed the build-cache step lock (09-30). | Lab, harness and infrastructure; agent process | 09-29..09-30 | n/a | fixed: pagefile; step-lock retry (`622763a4`); four slots, one per lane (`defcbe2d`) | archive `ledger-2026-09-28-to-30.md` "Parallel lanes", "Checkpoint before a machine restart", "After the restart"; `ledger-2026-09-30-night.md` third entry |
| P7 | **Every Lab stopped for design defects found in live evidence.** On 09-30 night the page view was about 500 KB of raw JSON per page; the user stopped every Lab and a watchdog killed `run-lab.mjs` until t223 landed. On 10-01 the wandering runs turned out to come from a page view that hid controls (one page search ran 29 times with 0 matches); live runs were held for the user's fix list. On 10-03 runs were held again for general Flow authoring (t251/t252). These stops were correct, but each one cost a live day. | model guidance/prompt; agent process | 09-30 night (lane B `run-mup2i28c-6c7fc209`), 10-01, 10-03 | not stated | fixed: t223 compact view (`3851db67`, `1ce054e5`); t232 page view; t251/t252 landed | archive `ledger-2026-09-30-night.md` second entry; `ledger-2026-10-01.md` first and third entries; `language-driven-flow-loop-plan.md` 10-02/03 entry |
| P8 | **Two supervisors with different conventions.** Codex ran t262 on 10-03 in its own paired tree, with local-only commits (16 downstream and 14 Core ahead of dev on 10-05) and a ledger written in compressed run-on text (about 210 KB of archives under `mvp-live-continuation-2026-10-03/archive/`). Codex's UI lane paused at 6% credits with t224 branches left for Claude to integrate, after it "did not observe Claude's round6 gates". On 10-05 three read-only workers were needed to reconcile the state, and slots 2-3 were still held by Codex's dead Oct 4 processes. A peer-session merge handshake ran on 10-02. Nothing was committed on 10-04. | agent process | 10-02..10-05 | n/a | fixed by decision: "One supervisor (Claude)" (Current State, Decisions in force); t262 landed 10-05 (downstream `20404503`, Core `1fbfa5ef`) | `mvp-live-continuation-2026-10-03.md` Work Ledger; `codex-ui-ux-review-2026-09-30.md` Current State; `mvp-final-month-plan.md` 10-05 "Intake…" and "Sweep 2 green" |
| P9 | **Permission and hook refusals stalled agents.** Leads cannot run `git merge` (hook), so the supervisor had to sync every tree itself before each round. A lead's `git restore` was refused, so files waited for t186. The brain's `worker-git-guard` change was refused as self-modification. Killing `loop2.sh` and removing stale slot owner files were refused. The downstream push after the fake-key history rewrite was refused by the classifier and waited on the user (10-02). D's downstream merge was refused and aborted because of uncommitted overlap (09-30). | agent process | 09-29..10-02 | n/a | open: the merge restriction is by design; the costs recur every round | archive `ledger-2026-09-28-to-30.md` (round 1 "Held for t186", "Resumed", round 3); `ledger-2026-09-30-night.md` first entry; `ledger-2026-10-01.md` "Rounds 10-12"; `language-driven-flow-loop-plan.md` 10-02/03 entry |
| P10 | **Work reverted, redone or broken by a merge.** The Click node's "click again" sentence broke the domain catalog test, had no live effect, and was reverted (`379763fb`, 09-30). t220 introduced an import cycle that also failed on its own branch (Core `1e27fbd8`, 10-01), followed by a second module-cycle hotfix (Core `bdc459dd`, 10-02). A merge dropped the `present` import (`84766496`, 10-01). A `$0.001` test fixture was mistaken for a product cost ceiling (09-29). D2-1 was sent back twice for borrowing the `changes_nothing` refusal (10-06). The lane D downstream merge was aborted (09-30). | agent process | 09-29..10-06 | n/a | fixed, each case | archive `ledger-2026-09-28-to-30.md`; `ledger-2026-09-30-to-10-01.md` round 4/5; `mvp-final-month-plan.md` 10-06 "Lane A loop fix … D2 follow-up" |
| P11 | **Peak-hour pricing halved what a run could buy.** Round 2 launched at 06:25 UTC on 10-06, inside DeepSeek's peak, so the $0.10 bought half the decisions (named for B's ceiling). Round 3 then waited for 21:20 UTC. | budget, cost and purse; agent process | 10-06; `run-muwaq9w3-baaa4e19` and round 2 generally | round 2 total $0.632 across eight runs (rounds 1+2) | partly: rule recorded (memory `live-runs-off-peak-deepseek`); nothing enforces it mechanically as far as these ledgers show | `mvp-final-month-plan.md` Current State "The pattern"; downstream `77687801` |
| P12 | **Serial waits on one long lead.** On 10-05 creation blockers queued behind t264 until the user asked why work was slow; they were then split by file and run in parallel. | agent process | 10-05 | n/a | fixed: lesson `parallelize-partitionable-work-dont-serialize` | `mvp-final-month-plan.md` 10-05 "Creation blockers in parallel" |
| P13 | **Working-document budgets failed gates.** The structure audit refused finishes because a working document broke its own rules: Current State over budget, a ledger entry without validation, or a stale index (`pnpm task finish t176` with 3 violations on 09-29; `DS_CHECK=1` on 09-30; 10-05 sweep downstream `check` exit 1 on a stale index; t262 doc pointer 10-03). Each was small, but each needed a rerun. | agent process | 09-29, 09-30, 10-03, 10-05 | n/a | open (by design) | archive `ledger-2026-09-28-to-30.md` "After the restart", round 3; `mvp-final-month-plan.md` 10-05 "Sweep 1" |
| P14 | **The repeat guard had never worked live, and nobody saw it.** The web state digest included the browser frame id, which is renumbered on each reload. So no rerun ever started on a page that already had a key, and the guard never fired. This hid behind lane A's nine-round loop the user watched. | loop bookkeeping and guards | found 10-06; contributes to `run-muwaobm2-882cadd9` | $0.0840 for that run | fixed: downstream `c16895b2` (merge `a142886b`), `web-state.v4` | `mvp-final-month-plan.md` 10-06 "Lane A loop fix…", "Frame-stable digest…" |

## Part 2: what a person using the extension hits

Sources: `manual-panel-test-findings.md` (PANEL-001..007), `codex-ui-ux-review-2026-09-30.md` (Current State and
roadmap), `reports/live-C-ui-review.md` (round 1, run C `run-muw60j7c-bb7c9a62`), `reports/live-C-r2-ui-review.md`
(round 2, run C `run-muwansvz-a2b4a987`), `reports/t276-live-ui-fixes.md`, `reports/t277-r3-ui.md`. Fix hashes for
t276/t277 are the merges named in the ledger (t277: Core `e1551fa3`, downstream `f224b38a`). The t276 merge hash is
not in the material I read (see Not verified).

| # | Cause in plain words | Theme | Runs affected | Dollars | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| F1 | **Internal words in the chat**: node names, "extraction", "pagination", "selector", "markup", "dedup", "the judge", "next call", step numbers that contradict the Flow's own step count. | extension UI | C r1, C r2 (and A, D r1 per t276) | n/a | partly: t276 named edit cards without numbers; t277 added person-words for thoughts, reasons and check text (Core `e1551fa3`); the ending's "next call"/"the judge" remain in R2-U-2 | live-C-ui-review U-3; live-C-r2-ui-review R2-U-4; t277-r3-ui table |
| F2 | **Read cards with no row count**: "Read list / Done", "Records saved" with no number, while the overlay knew "Saved 20 records". | extension UI | C r1, C r2 | n/a | partly: test reads and playback show counts (t276); **build-time reads still show bare "Done"** because the domain does not send rows on every list read | live-C-ui-review U-1; t276-live-ui-fixes open item 2 |
| F3 | **Judge text cut inside a parenthesis and glued to the next sentence**, because a splitter ended sentences at "e.g.". | extension UI | C r2 | n/a | partly: fixed in chat rows and cards (t277); open in the repair heading and the ending (`judge-words.ts`), with the diff in `t277-core.md` | live-C-r2-ui-review R2-U-3; t277-r3-ui |
| F4 | **"Passed" on an empty result, then a bare "Didn't pass"**: the check card told the person that zero rows answered a list request; after that was fixed, the card said only "Didn't pass", with no count or reason. | extension UI; judges and verification | C r1, C r2 | n/a | fixed: t276 removed the false pass; t277 R2-U-1 says "N rows would be stored, but …" | live-C-ui-review U-6; live-C-r2-ui-review R2-U-1; t277-r3-ui |
| F5 | **Overlay status cut mid-word.** | extension UI | C r1 | n/a | fixed (t276 item 8; confirmed in round 2) | live-C-r2-ui-review "Previous defects" U-4 |
| F6 | **Refusals shown as work, stacked.** Every refused rerun added an "Edit the Flow · run the step again / Not done" card and a "Read list / Didn't work" card, about six times. | extension UI; loop bookkeeping and guards | C r1, C r2 | n/a | fixed: t276 folded identical refusals; t277 folds repeating cycles (`card-repeats.ts`) | live-C-ui-review U-8; live-C-r2-ui-review R2-U-7 |
| F7 | **"It wasn't on the page" while the person can see it.** The cause was a refusal (`target_unobserved` because of a malformed handle, or `changes_nothing`), not a missing element. | extension UI | C r1 (search box), C r2 (list) | n/a | fixed (t277 R2-U-6: "the step didn't say which list on the page to read") | live-C-ui-review U-12; live-C-r2-ui-review R2-U-6; t277-r3-ui evidence |
| F8 | **A failed build's ending does not say what blocked it.** Round 1 said only that the fix "used all its rounds". Round 2 said "its next call could have cost up to …, more than was left beside the … kept back for judging" and "$0.079 ($0.000 of it by earlier builds)". | extension UI; budget, cost and purse | C r1, C r2 | n/a | **open**: R2-U-2 is with t279 (`budget-exhausted.ts`); not in round 3 | live-C-ui-review U-10; live-C-r2-ui-review R2-U-2; t277-r3-ui "R2-U-2 proposed fix" |
| F9 | **The ending said "returned" rather than saved, and did not say why the rows were wrong.** | extension UI | C r1 | n/a | partly (t276 item 2: "Run failed — it saved 30 rows, but the check found …"); the "why" depends on F8 | live-C-ui-review U-10; t276 "next live run must see" item 2 |
| F10 | **The detect card names a page label, or no list at all**: first a sponsored tile's label, then "the repeating list on the page", never "the search results". | extension UI | C r1, C r2 | n/a | partly: t276 named it generically; **R2-U-9 open** (needs `list?: string` from the domain; t279 in flight) | live-C-ui-review U-2; live-C-r2-ui-review R2-U-9 |
| F11 | **One list, three names** across the build card, the test card and the overlay; and mid-word elision of card targets. | extension UI | C r1, C r2 | n/a | fixed (t276 item 8; t277 R2-U-8) | live-C-r2-ui-review R2-U-8; t277-r3-ui |
| F12 | **"Sending your message" lingers** about 2.7 s after the build has started. | extension UI | C r1, C r2 | n/a | fixed (t277 R2-U-5) | live-C-ui-review U-5; t277-r3-ui |
| F13 | **The overlay disappears on page loads**: about 2 s with no overlay at playback start in round 1, and one sample in round 2. | extension UI | C r1, C r2 | n/a | mostly fixed: round 2's gap was 7 ms into a new document; the Lab should judge gaps only 100 ms past a document's start | live-C-ui-review U-14; t277-r3-ui R2-U-11 |
| F14 | **The previous build's "is ready" chat flashes at the start of a new build.** The panel prefers the stored session project over Core's current one. | extension UI; Lab, harness and infrastructure | C r2, A r1 | n/a | open: established, with the fix outside t276/t277 files (`background/connection/project-context.ts` or the Lab's `chat-build/creation/project.ts`) | t276 open item 1; t277 R2-U-10 |
| F15 | **"Couldn't fix your Flow" on a creation build.** | extension UI | A r1 `run-muw60unq-591e23bd` | n/a | partly: guarded (`background/activity/ending-kind.ts`); root cause unproven; "Fixing your Flow" still appears during a creation build's first re-author | t276 open item 3 |
| F16 | **The step count stays after the run ends** ("Step 6 of 6" during the result check), and the overlay repeats it ("Step 1 of 6 / Running step 1 of 6"). | extension UI | C r1 | n/a | not exercised since (no Flow run in round 2); status unknown | live-C-ui-review U-7; live-C-r2-ui-review "Previous defects" |
| F17 | **A repeat whose list the test never reached reads "it only runs sometimes".** | extension UI | D r2 `run-muwao5n4-44977b2a` | n/a | fixed (t277 U11: "the test reached no rows for it to repeat over") | t277-r3-ui |
| F18 | **The extension could not run, ask or stop anything** (Core accepted only the panel's cookie, not the pairing token), and had no simple view. | extension UI | manual, 2026-09-28 | n/a | fixed on dev (PANEL-007: `d447ca70`, `65168e1a`, `1fc6143f`, `93140081`); retest of a real pairing, a live turn, Stop, and the Firefox popup still requested | `manual-panel-test-findings.md` PANEL-007 |
| F19 | **The chat could not operate the control panel**; the extension chat could not start a build. | extension UI | manual 09-28; flow-builder walkthrough 09-29 | n/a | partly: t198 extension chat builds (merged 09-30); PANEL-004 registry status "Assigned" in its document | `manual-panel-test-findings.md` PANEL-004; archive `ledger-2026-09-28-to-30.md` round 1, round 2 |
| F20 | **Permission prompts for everything, and the settings would not switch.** | permissions and consequential acts | manual 09-28 | n/a | partly: t186 removed LLM call grants (merged 09-29); the PANEL-005 entry still reads "Assigned" (the document was not updated) | `manual-panel-test-findings.md` PANEL-005; archive `ledger-2026-09-28-to-30.md` |
| F21 | **The control panel is clunky**: interrupted requests lost, no loading/error/retry states, poor keyboard and dialog focus, stale rows acting on old data. | extension UI | Codex review 09-30..10-01 (source-based) | n/a | partly: phase 1 complete; phases 2-4 active and 5-6 queued when Codex paused at 6% credits; no browser acceptance done | `codex-ui-ux-review-2026-09-30.md` Current State and roadmap; PANEL-006 |
| F22 | **Non-login forms trigger password autofill; project creation failed on storage layout v2.** | extension UI | manual 09-20 (carried into the window) | n/a | PANEL-003 ready for retest; PANEL-002 waits on an approved stop and backup of the prior root | `manual-panel-test-findings.md` PANEL-002, PANEL-003 |

## What changed and why

Only this report was created, at `docs/working/mvp-final-month-plan/reports/week-review/friction.md` (the directory
did not exist).

## Commands run and observed results

- `grep -n '^## '` / `'^### '` over the nine named documents: located each Work Ledger. Four have no entry in the
  window (listed in Outcome).
- `sed`/`cat` of the ledgers and of the four `language-driven-flow-loop-plan/archive/ledger-*.md` files covering
  09-28..10-01, `mvp-live-continuation-2026-10-03.md` lines 390-520, and `mvp-final-month-plan.md` lines 389-556.
- `git log dev --since=2026-09-29 --until=2026-10-07` per repository, bucketed by day: downstream 97/170/200/121/96/93/26
  commits on 09-29/30, 10-01/02/03/05/06; Core 57/118/143/120/59/56/18; no 10-04 commits in either repository.
- `git log … | grep` for fix hashes: `5363e39b`, `ecf9c524`, `af672ea8`, `a8f1971e`, `5903a1e7`, `622763a4`,
  `defcbe2d`, `379763fb`, `c16895b2`, `a142886b`, `4afa80fc` (t187 merge); Core `1e27fbd8`, `bdc459dd`,
  `21a190a6`, `fb05385a`, `3697462a`.
- Read the UI sources named in Part 2 in full, except `codex-ui-ux-review-2026-09-30.md`, of which I read Current
  State and roadmap (lines 12-160).

## Not verified

- Dollar figures are quoted from the ledgers and not recomputed. The numbers worker owns them.
- I did not find the t276 merge hash; the ledger names t276 as "verified and landing" (10-06), and the Current State
  lists it as on dev.
- The PANEL-004/005 rows in `manual-panel-test-findings.md` still read "Assigned", but later ledger work (t186, t198)
  addresses parts of them. Their true status is unconfirmed.
- Codex's 10-03 archives (about 210 KB) were sampled by keyword grep, not read in full.
- F16 (the step count after the run ends) has not been exercised since round 1.
- Whether off-peak launching (P11) is enforced by any guard: not checked in source.

## Open questions or contradictions found

- `manual-panel-test-findings.md` Current State is dated to the 09-20 t027 host and lists PANEL-004..007 as
  assigned. It no longer reflects the extension's state.
- The brief lists `automated-testing-facility-plan.md` under Work Ledgers, but it has an Execution Log table and no
  dated ledger.
- No commit on 10-04 in either repository, while the ledgers say Codex's processes held slots 2-3 that day. Was a
  day lost, or did work happen off dev?
