# Diagnosis: photo-social priya-tags, august-over-1300, kiln-notes; everything-store canonical reset r6 (2026-10-27)

Read-only. No runs, builds, tests or model calls. Sources: the plan's Current State and 2026-10-19 diagnoses, the per-site task reports, debug notes `run-mvebbeom-a60886e1`, `run-mvdi88yz-e444d594`, `run-mvebqbm4-b3f3b742`, `reports/codex-photo-priya-tags.md`, `reports/codex-live-photo.md`, `reports/codex-reset-review.md`, git logs of both repos since 2026-10-17, and Core source at `result-verification/agreement/unsupported-no.ts`.

Standing fact: t751 (reset by observed state) is NOT merged (branch `task/t751-reset-by-observed-state`, final acceptance still in flight). t752 (grounded judging) IS merged: Core `534c41fb` / merge `149ba69e`, downstream merge `4da5947c`. t748, t743, t741, t738 and t739 are merged. Round 6 has not launched. No photo-social run exists after 2026-10-18.

## 1. photo-social `priya-tags` - run-mvebbeom-a60886e1 (2026-10-18, 90 calls, $0.073, 175 steps, 8 trials)

Task: 5 ordered rows / 15 values (author, comment, date) of comments and replies tagging @priya.nair.

1. Root cause, as established:
   - Measured outcome: the last trial (0172) stored 1 row of 3 values, which exactly matches expected row index 2, with 0 unexpected rows and 4 missing. Every one of the 6 judge calls (0056/0057, 0136/0137, 0173/0174) said no. The no's were right. No whole-run oracle, replay or promoted Flow was reached.
   - Loop failure: five of the eight trials (0101, 0107, 0111, 0129, 0164) stopped at `repeat.no_progress` at steps 27/27/27/29/33. The body was only click plus Merge, with no read. Revision 2's clicks grew the comment permalinks 13 -> 37 -> 41. The last four successful clicks left 41 permalinks, the same set hash and the same 899 interactive elements. So the authored "press Load more" loop had no end condition, and kept pressing after the list was exhausted. The guard (Core `executor/repeat-progress/no-progress.ts`) was right to stop it.
   - Under-collection: trials 0055 (read 6 / kept 0), 0135 (read 13 / kept 0) and 0172 (read 25 / kept 1) never read the whole expanded thread with a condition that keeps all five. The debug note says plainly that it cannot isolate "predicate or field binding" from "replies not expanded". I could not isolate it either. The task reports that replies sit under Priya's entry and the first Load more press is swallowed (`tasks-photo-social.md` line 11), so the likely gap is that the reply expansion and the match condition are both missing. That is an inference, not a proved cause.
   - Not a defect: task wording and fixture. `audit-photo-social.md` rated the task ok. The positive-corpus work added a non-empty dataset. The scope (`p1` quote covers every comment, reply and column) is legitimate.
   - Classification: build-model coverage plus loop-ending shortfall (product/framework territory: the framework did not give the builder a usable "list has ended" fact for a click-to-load comment thread). Same family as the social recent-group-posts shape (`run-mvdec14t-5b320706`: expansion not authored before reads) and photo newest-likes R3. No fixture defect.

2. Fixed on dev?
   - Already in the failing run's frozen source (so they did NOT fix it): `2c529c60` (2026-10-17, hybrid lists continue before load-more appears), `ee1ebab2` (2026-10-17, repeats stop without progress; the guard that fired), `b9c008eb` (targeted scroll), `1e2accc3` (F8, an ended feed is not a continuing list).
   - Merged after the run: `ec401d5f` (2026-10-20, t738, load-every-row-first hint: only hint wording and a no-loop-in-loop change in `text-disclosure.ts`), `9b6b5b1b` (`repeat over` with `repeat most`, aimed at newest-likes), `b4710f72`/`d2302b5f` (t743), t748 (`b15dd24a` stall names the refusal it followed; `39947025` a looped act's pass is named), t752 (`534c41fb`: judge advice carried across revisions; and `earlier-advice-memory.ts`). t752's `read speed` item (extract_list expanding per-row "See more") targets text disclosure, not comment-thread Load more or reply expansion; I found nothing that does.
   - Verdict: NOT fixed. No commit I can cite covers the failing steps (the unbounded Load more loop at 27-33, and the missing reply expansion plus condition). The better feedback from t748 may help the builder after a stall, but nothing is proven for this shape.

3. Owed:
   - Rerun after round 6 gates (task never rerun since 2026-10-18). No unchanged retry rule applies to the same source; the source has since changed, so a rerun on current dev is legitimate once the round-6 launch conditions hold.
   - Possible code work, to be confirmed by the reproduction below before anyone writes it: a framework fact that the thread's Load more control is exhausted (gone or inert) on the read result, so the builder ends the loop with `repeat while` that control. Owner would be the list-continues module (Core `read-account/list-continues.ts` plus the extension `content/extraction/page-advance/load-more.ts`), alongside the existing F8 fact. Do not write it until step 4 shows the fact is missing.
   - No task or oracle rewording owed.
   - t751: no code dependency (read-only task, changes nothing). It is gated only by round 6's rule that t751 and t752 land before launch.

4. Provider-free reproduction (headed, realistic scenario photo-social only):
   - Add `apps/extension/e2e/site-reset/tests/photo-priya-thread.spec.ts` in the style of `photo-toggle.spec.ts` with `scripted-provider.ts`, plus the production Core judge as in t752's headed social spec.
   - Steps: open the Autumn Kiln Giveaway post; consent; script candidate A = press Load more under `repeat while` its presence, then one `extract_list` with a condition on the tag text; script candidate B = same loop with no end condition (the run's shape); candidate C = A plus reply expansion.
   - Assert: B ends with `repeat.no_progress` and the trial feedback names that the list had ended (this is the check that fails today if the fact is missing); A returns 3 rows (replies not opened); C returns exactly the 5 expected rows and the production judge says yes. The existing `breadth-paths.test.ts` (scenario-lab, real browser) already proves the honest path and the 3 wrong-path counts (3 / 0 / 6 rows), so reuse its expected data.

## 2. photo-social `august-over-1300` - run-mvdi88yz-e444d594 (2026-10-18, run, failed)

State whether ever run: YES, once, in its first positive form. Fresh workspace `codex-photo-positive-t567-20261018`, 146 paid calls, $0.102, 289 steps, process exit 1, no Flow, no oracle verdict, no replay.

1. Root cause, as established:
   - First divergence (debug note "Read-only diagnosis"): trials 0120/0128 read the profile grid once (12 items, 1 page, no scroll node), rejected all 12 on month/year, and stored 0. The later grid screens that hold the qualifying August cells were never loaded. The two judge pairs answered no, correctly (0121/0122, 0129/0130).
   - Later divergence: trial 0134 stopped at step 8 `web.action.blocked_by_dialog`; trials 0138/0148/0260 `web.target.not_actionable` (click point covered by the list element; 4 absorbed obstructed attempts); trials 0264/0280 step 10 `web.target.not_found` after 4 attempts; final 0286 `web.action.timeout`. The note says the cause of this second part (overlay and dismissal order, navigation, or repair construction) was NOT isolated. It names the app-prompt scrim (2.5 s after load), the conversation panel (3.5 s) and the rate-limit Try-again as candidate obstructions (`t730-atlas-3.md` line 190). No tracing was done.
   - Task and fixture: the run used the repaired positive form (1 row, 2 fields; `5b0d2e2f`, 2026-10-18; the earlier instruction expected an empty table, which breached "data-scraping tasks must have data"). The wording now names the date and likes formats. Not a wording or oracle defect. One note: `tasks-photo-social.md` line 87 flagged that an empty-result oracle might store no dataset; that is moot now.
   - Classification: first half is a build coverage miss (scroll to load the grid); second half is an unexplained obstructed/covered target in the product (possible overlay or scroll-reveal defect) - unknown.

2. Fixed on dev?
   - Partly, indirectly. `ec401d5f` (t738) described scroll keys; `f36181c0` made `untilStable` need `maxScrolls` at submit; `b9c008eb` made a targeted scroll scroll to its element. `d2302b5f`/`b4710f72` (t743) and t748 changed trial feedback. `c03a2c65`/`daabd593` (t753) made the overlay stable and readable - that targets chat/overlay presentation, NOT the page's own scrim or dialog that block clicks. None is shown to cover the covered-target or `blocked_by_dialog` steps (0134, 0138, 0148, 0260).
   - Verdict: NOT demonstrably fixed; the grid-coverage miss is a builder shortfall with no code fix to point at, and the obstruction part is undiagnosed.

3. Owed:
   - A bounded investigation first (not yet done): trace, in a headed provider-free run, the page state at trial 0134/0148 (which dialog, which element covers the post tile) on photo-social's grid after scrolling to screen 2 or 3. Owner of the trace: extension `content/action-runtime` (actionability and obstruction reporting) and the scenario's overlay scripts (`apps/scenario-lab/src/scenarios/photo-social/client-script.ts`/`overlays.ts` per the atlas). Then a code fix if a product defect shows; a rerun otherwise.
   - No task or oracle edit owed.
   - t751: none (read-only). P6 (offline trials inside builds) would speed iteration but is not a dependency.

4. Provider-free reproduction:
   - `breadth-paths.test.ts` in scenario-lab already runs the honest recording through a real browser (it was corrected after a caption-age selector issue) and covers wrong paths (reel plays, other year, impersonator, Kiln Theory). Add a headed e2e spec, same folder style as `photo-dialog-step.spec.ts`: scripted candidate that scrolls the grid to screens 2-3 (rate-limit Try-again handled), then opens the 21 August tile, then reads date and likes from the footer. Assert 1 row `{date:"August 21", likes:"1,349"}` and the untouched-account fact; also assert an actual click at the covered state reports an obstruction that names the covering element, and that the scripted dismissal order (scrim, conversation panel, rate-limit) clears it. If the click fails with a provider-free script, the defect is product; if it passes, the failure was the builder's ordering.

## 3. photo-social `kiln-notes` (never run)

State whether ever run: NO. No debug note, spend-ledger run id or lane report mentions a kiln-notes run; the ledger grep found only the task reports, the audit, the atlas and the 10-18 briefs. `lane-t-p3-d0-saved-flows.md` line 94 (2026-10) says photo-social has no passing build and lists only newest-likes, priya-tags and august-over-1300 as failed.

1. Root cause: none; no failure exists. Only offline proof: `breadth-paths.test.ts` honest and wrong paths (4+4 tests, `# pass 8`), and `breadth/tests/expected.test.ts`. Task wording audit: `audit-photo-social.md` is the source; I did not re-audit it.
2. Fixed on dev: not applicable. Relevant already merged: `0d46c0b7` / t739 (heart and dock show done only once the server has the act) - the save/bookmark controls are in the same family, so a lasting-act reset question may arise.
3. Owed:
   - A rerun is not owed; a FIRST live run is, and the plan's rule says only about one task per site runs end to end. It is a lasting-act task (creates a collection, "creates a private collection from posts already saved" in the permission list), so it depends on t751's site reset by observed state: a build trial that creates the collection must be undone before the next trial, and a trial run on leftovers measures nothing. Run only after t751 merges (or choose another photo task for the one-per-site end-to-end run, with kiln-notes proven provider-free by the audit).
   - Before launch: confirm the picker choice (two saved Kiln Theory posts) and the in-page order of tiles (Kitchen 3, Studio inspo 5, Kiln Theory notes 2) are unambiguous from the instruction (it states columns and "in the order my Saved page lists them"); that looks complete.
4. Provider-free reproduction (headed, photo-social):
   - New spec beside `photo-dialog-destination.spec.ts`: scripted build trial that runs New collection -> name -> pick the two Kiln Theory posts, then the reset between trials (needs t751). Assert (a) the collection is removed or restored before trial 2, (b) filled bookmarks are never pressed (would unsave), (c) the studio's kiln photo is not picked, (d) the final table equals the 3-row expected dataset. This reuses the t751 acceptance shape "a dialog act with no address that must not touch pre-existing state".

## 4. everything-store canonical reset (task `everything-store-kettle-to-cart`), r6 = run-mvebqbm4-b3f3b742 (2026-10-18)

Facts: launcher exit 0, exact oracle passed (2 ordered rows / 6 values, 3 final-state facts), Flow created, 716 s, 123 steps, $0.0529 raw. Separate zero-call replay `replay-mvec94bt-08e9adc6` passed (0 calls, same Flow content hash). The paid whole-run check on runtime `d58b5896-b7a7-457a-bbe5-9b352f3f8a45` split: call 0122 `does_not_answer`, call 0123 `answers`, identical system/user packets -> `core.result.verdicts_disagree` / `model_disagreed` -> UNVERIFIED -> acceptance held.

1. Root cause, as established:
   - The debug note (and `codex-reset-review.md`) locate it in the first whole-result checker, not in reset: the negative judge raised a "cart completeness / missing contents" concern while acknowledging the transfer. The packet had 1 record set / 2 sample rows / 3 columns / `noMissingRequired` / no truncation. The baseline item's exact title is in the rows and the end page before the Saved heading; the moved item's title appears after the Saved heading (count 3). The note concludes a model misreading of correct evidence, not a missing row or transport omission, and the oracle independently held both records.
   - Reset behavior (secondary): 4 dirty-trial refusals (0051/0071/0091/0101) before explicit own-create inverses succeeded (0055/0075/0095), a repeated inverse refused `already_done` (0097), a stale target (0103) recovered via fresh navigation (0105) and a modify inverse (0107), then subflow trial yes at 0109. That is the pre-t751 bookkeeping working through retries; no wrong state was left (final facts held).
   - Classification: framework judge-consistency defect (a no that names nothing Core can find in its record blocks acceptance), not a task wording or fixture defect. The task is unchanged and sound.

2. Fixed on dev?
   - YES for the judge part, by t752: Core `534c41fb` "Require grounded judge defects and retain trial advice across revisions", merged as `149ba69e`, downstream merge `4da5947c` (2026-10-21). Code path checked: `result-verification/agreement/unsupported-no.ts` `automationStudioResultVerificationReaskUnsupportedNo` handles exactly the shape of r6: `settled.basis === "model_disagreed"` with code `core.result.verdicts_disagree`, one call a no and the other a yes. It weighs the no against Core's stored record and the run summary (`supportOf`). If the no names no defect Core finds, it re-asks that no once with the packet and the request; if it still names none, the outcome becomes unsure (`refutationUnsupported`) - "never a no, and never a yes Core made"; if the re-ask answers yes, the agreement is a yes with the concern kept as advice. This is the r6 shape: two consistent record sets, the no's concern ("cart completeness") is not a located defect.
   - Caveats I could not close by reading: (a) the best case is still yes only if the re-asked no flips; an unsure outcome is not accepted and would still hold acceptance; (b) t752's tests and the headed acceptance used the SOCIAL scenario (recent group posts shape), not an everything-store cart-move whole result; (c) r6's second sentence of the judge ("the moved row appears after the Saved heading") is a presentation of the end view that t752 does not change. So "fixed" is by code path, not by a reproduction on this task.
   - Reset side: t751 not merged. t750 (`d0cb86e1`, one source of undo paths), t748 (`882cbb4d`, `9ce44ce9`) and t741/t743 improved witnesses and refusals, which would shorten the 4 dirty-trial refusals, but only t751 addresses the whole class.

3. Owed:
   - Rerun, not code: after t751 and t752 merge and the headed reproductions pass, rerun the canonical reset task once on fresh workspace (no unchanged retry rule is met, because the source has changed). Acceptance needs a whole-run judge that is yes (or an unsure that is accepted by policy - confirm with the supervisor which), plus the zero-call replay already passed.
   - Code work, only if the reproduction below shows the split still yields unverified: Core `agreement/unsupported-no.ts` / `agree.ts` (owner: t752 follow-up); and consider packet wording so the end view marks Active versus Saved sections (Core `result-verification/read-account/sentence.ts`).
   - No task, oracle or fixture edit owed.
   - Depends on t751: yes, for the rerun to be clean (reset by observed state replaces the dirty-trial/inverse dance); no, for the judge fix, which is already merged.

4. Provider-free reproduction:
   - Extend the t752 headed social spec pattern to everything-store: new spec in `apps/extension/e2e/site-reset/tests/` (`kettle-to-cart-whole-judge.spec.ts`) that loads the everything-store cart, performs the move of the case item from Active to Saved with the preserved baseline item, extracts the 2 expected rows, and passes the actual packet to the production Core verifier with a scripted provider returning [no with a "completeness" concern, yes] and then the re-ask answering [no again]/[yes]. Assert: outcome is not `verdicts_disagree`/`model_disagreed`; with re-ask yes the verdict is answers with the concern as advice; with re-ask no it is unsure and the report states why. The existing 11 passed ledger `unsupported-no` Core tests (e.g. `reask-route/tests/unsupported-no-route.test.ts`) cover the logic offline; this spec adds the real cart packet.

## Summary table

| Task | Cause | Fixed by (commit) or owed | Owed work owner/file | Depends on t751? |
| --- | --- | --- | --- | --- |
| photo-social `priya-tags` | Build never expanded replies or kept all 5 rows (1 of 5 stored, 3 correct judge nos); the Load more loop had no end condition and tripped `repeat.no_progress` after the thread was exhausted (41 links, trials at steps 27-33). Cause between predicate and reply coverage not isolated. Task and fixture sound. | Not fixed. Nothing merged after 2026-10-18 covers it (guard `ee1ebab2` and `2c529c60` were already in the run). | Reproduction spec first; then possible "list ended" fact in Core `read-account/list-continues.ts` and extension `page-advance/load-more.ts`; rerun after round-6 gates. | No |
| photo-social `august-over-1300` | Builder read the grid once and never loaded screens 2-3 (12 items, kept 0); later trials hit a dialog/covered target (0134, 0138, 0148, 0260), then not_found/timeout at step 10. Obstruction cause not isolated. Task is the repaired positive form (`5b0d2e2f`). Ran once (run-mvdi88yz-e444d594), failed. | Not demonstrably fixed (t738 scroll hints, t753 overlay polish do not cover the covered-target steps). | Trace the covered target on screens 2-3 (extension `content/action-runtime`, scenario overlay scripts), then fix or rerun. | No |
| photo-social `kiln-notes` | Never run; no failure. Offline proof only (`breadth-paths.test.ts` 8/8). | Not applicable; first live run owed (or prove provider-free if another photo task is chosen for the end-to-end slot). | A reset-aware spec and the first live run, after t751. | Yes (creates a collection; trial reset) |
| everything-store canonical reset (`kettle-to-cart`, r6 run-mvebqbm4-b3f3b742) | Whole-run checker split (no with unlocated "completeness" concern vs yes) on identical, correct packets: model misreading; oracle and zero-call replay passed. Task sound. | Fixed by code path: t752 Core `534c41fb` / `149ba69e` (re-asks an unsupported no, outcome unsure or yes, never unverified-by-disagreement); downstream `4da5947c`. Not proven on this task; unsure may still hold acceptance. | Reproduction spec on the everything-store cart packet; rerun once after t751 and t752 gates. Core `agreement/unsupported-no.ts` only if reproduction fails. | Rerun yes (clean reset); judge fix no |

## Not verified

- No test, spec, build or run executed in this diagnosis; every "fixed" statement is by reading code paths and commit stat/messages. In particular t752's re-ask behavior on the r6 split was read, not exercised.
- I did not open the raw step files under `lab-runs/2026-10-18/` for any run (only the debug notes and reports).
- I did not read the lane-tree copies of debug notes (all three needed runs' notes were on dev).
- I did not confirm what policy treats an `unsure` whole-run verdict as for acceptance.

## Open questions or contradictions

- The debug note for r6 lists the task as "everything-store-kettle-to-cart (unchanged)"; the breadth plan calls it the canonical reset task; the realistic-task baseline test (`realistic-task-baseline.ts`) is where its slug lives. Priya's note says reply expansion vs predicate is unresolved; the 25-read / 1-kept last trial suggests the match condition kept only the one non-reply entry, but that is unconfirmed.
- `codex-live-photo.md` says the August oracle expects 1 row / 2 fields; `tasks-photo-social.md` (written 2026-10-17) still says the expected table is empty. The task report predates `5b0d2e2f`; treat the report as stale on that point.
