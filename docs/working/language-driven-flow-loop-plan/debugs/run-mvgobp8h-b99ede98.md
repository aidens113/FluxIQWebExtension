# Debug: run-mvgobp8h-b99ede98 (photo-social-newest-likes, rerun round 3)

Status: FAILED. Diagnosis only (brief debug-rr3-photo, 2026-10-20). No source edits, builds, browser or paid runs.

## The run

- Task `photo-social-newest-likes`, built from the real extension chat (step 0001 `flow.createHere`), instance
  rr3-slot-4, lane tree `fxwork/t567`, $0.25 purse.
- Source: downstream `e1363c31`, Core `e74e0890` (dev with t738's fixes and t739's heart fix).
- 197 provider calls, $0.1416, about 29 minutes (12:42:58 to 13:11:52 UTC), 421 steps. The purse was not the limit.
- Ended: no Flow. `evaluation.json` says `verdict: failed`, `runtime.behavior`, `flowCreated: false`, no oracle verdict.
  The supervisor completed `ended: blocked` (0421).
- Environment: every step's `meta.json` is `status: ok`, and no step has a provider error. The Lab log
  (`rerun3/slot-4.log`) shows a clean ending and records the cost. **The environment is not the cause.**

## How far it got

The build got further than round 2. Seven trials ran and four were judged. One judged trial, brief 3's revision 8,
**stored exactly the oracle's three links** (D1OK… 2 Oct, DgYZ… 29 Sep reel, DPIE… 26 Sep), but liked three other
posts.

| Phase | Steps | Result |
| --- | --- | --- |
| Plan | 0002-0006 | Correct plan: one subflow `like_recent_posts` carrying both parts. |
| Brief 1: exploration | 0007-0041 | Opened the profile. Liked the first grid tile, D96… (pinned), at 0026 (act-9). |
| Brief 1: trials 1-5 | 0042-0111 | Revisions 1 to 5 open "the post" through one fixed handle: the pinned first tile (`Pinned post icon 2.9K47`, a dialog). Each trial fails, either on a wait for text that never appears or, on pass 2, with `web.target.not_found`. The act-9 undo landed (0059). act-13's undo landed (0072). Acts 15, 17 and 19 were refused `undo_wrong_target` and became `cannotUndo` (see contributor 5). |
| Brief 1: judged 1 | 0112-0119 | Revision 6 navigates by `$row.link` with `repeat most: 3`. It liked the first three grid rows, which are the pinned posts. Verdict no, correctly. |
| Brief 1: judged 2 | 0128-0146 | Revision 7 renamed the column to `link` and kept page order. It liked the pinned three again. Verdict no, correctly. The two leftover likes were undone, from settle clauses that carry real addresses (0133-0140). |
| Brief 1: wrap-up deadlock | 0147-0158 | Revision 8 dropped tiles with `svg…aria-label is absent`. Its trial was refused `trial_reset_required` for acts 23 to 25, each with a real address. Both undo navigations were refused `llm_evidence_loop.not_offered`: "the build is in its last decisions: only core.submit_subflow, core.test_subflow and completing run now". The trial was refused again. The brief ended at its iteration limit with revision 8 never tried. |
| Brief 2 (repair) | 0161-0199 | The builder looked for dates on the grid (`find_on_page` "ago", "datetime"). It switched Posts ↔ Reels until the repeat guard refused the same tab click from the same page (`same_result`). |
| Brief 3 (repair, resent) | 0202-0298 | It found dates in the tiles' `img…alt` ("Photo by … on October 2, 2026", 0229-0240). Revision 8 read `date` from that alt and sorted it **in `recordOutput.process`**. Its trial (0272) stored the right three, but the loop liked D96…, DQwj… and DZcq…, the page-order first three (settle addresses at 0284). Verdict no, correctly. Judge call 1's advice was wrong (see contributor 3). Revision 9 followed that advice (page order, pinned included). Its reset needed acts 31 to 33 undone. The builder navigated naming `undoes` without pressing, and the brief stopped `repeat_without_progress`. |
| Brief 4 (repair) | 0305-0391 | Following the receipt's judge advice, the builder believed "the first three tiles are the newest posts". Its whole-Flow tests were refused `candidate.unchanged_after_no` (correctly: these were revision 8 or 9 Flows again). Its submits were then answered `unchanged_submission` naming revisions 13 and 14 with digests that `core.test_subflow` refused as `subflow.trial_stale_revision` (latest 12; contributor 4). Repeat refusals ended the brief. |
| Brief 5 (repair) | 0396-0420 | The supervisor's brief carried a correct `recordingExcerpt`: "pinned posts first …, then regular posts newest first". **The builder was never shown it** (contributor 2). It saw only the receipt's judge advice, which said that DZcq… (the third pinned post) was "the newest". It went profile → DZcq… (0403, 0411), back to the profile (0405, 0413), then sent the same navigation from the same profile page three times. The repeat guard refused each one `same_result` (0416, 0418, 0420), as it should. |
| End | 0421 | The supervisor completed honestly as blocked. |

## What the repair tried, and why it repeated an unchanged call

Brief 5 never wrote a submission. Its builder had two conflicting sources: the brief's parts ("most recent") and the
failing receipt's judge advice ("the profile's own newest-first order, pinned posts included … the profile's newest
posts are DZcqnvywrLW (March 2, 30w), D96… and DQwj…"). It could not resolve them, so it re-opened DZcq… to "confirm its
Like control". It had already seen that control at 0404 and 0412. A navigation from the profile to DZcq… had ended on
the same page before (0411 → 0412), so the guard (`llm/repeat-guard/outcomes.ts`) marked it `same_result` and refused
the next three unrun. **The guard was right.** The repeat is a symptom: the builder had nothing new to act on. The
supervisor's correction, which would have given it something, was dropped before it reached the builder.

## Where it went wrong, in order

1. **0042-0100 (model, caught by trials).** Revisions 1 to 5 open the post through a fixed handle on the pinned tile.
   This is the same fixed-handle mistake as R7 and round 2.
2. **0112-0146 (model, caught by judges).** Page order, so the pinned three get liked. The page view shows each pinned
   tile plainly as `link "Pinned post icon 2.9K47"`, then `"842 6"` (2 Oct), `"Clip 21.4K2"` (reel), and `"933 6"`
   (0017).
3. **0150-0158 (product, contributor 1).** The wrap-up refuses the reset calls the trial gate demands, so revision 8
   was never tried. That revision would most likely have failed anyway: `svg…aria-label is absent` also drops the
   `Clip` and `Carousel` tiles (coverage 0.5 over 12 tiles), which loses the reel. The right condition was
   `equals "Pinned post icon"` with `not: true`.
4. **0249-0272 (decisive: generic guidance gap, then the model).** Brief 3's revision 8 found the right three by date
   but sorted them only in `recordOutput.process`. `repeat over: posts` with `repeat most: 3` visits the listing's
   rows **in page order**, so it liked the three pinned posts. The format says so: "recordOutput.process … never
   changes which rows a repeat visits". But it gives no way to change which rows a repeat visits, other than
   `extractList.where`. The domain does order the rows a read answers, through `extractList.sort` (`slot.ts`
   `LIST_KEYS`, `order-request.ts`, content `order-rows.ts`, `as: "date"` included). Core's script format never
   names it: `grep extractList\.` in `flow-script-format.ts` finds only `fields`, `minItems` and `where`.
5. **0275 (judge model error, contributor 3).** Judge call 1 of trial 0272 read the run's end page (a post page and its
   "More posts" strip). It asserted that the newest posts were DZcq…, D96… and DQwj… (all three pinned), and advised
   "pinned posts included as the account published them". The verdict no was right, but this advice became the
   repair receipt that briefs 4 and 5 were shown.
6. **0331-0391 (model, plus product contributor 4).** The builder followed that advice. The `unchanged_submission`
   answers then named revisions and digests that the trial gate does not accept.
7. **0394-0420 (product, contributor 2).** The supervisor diagnosed the problem correctly, but its `recordingExcerpt`
   never reached the builder.

## Round 2's causes: gone

- **Withheld trial-act addresses: gone.** Every trial act reached by a row-bound navigation carries its real address
  in `settle`: acts 21-25 (0131, 0150, 0157, 0252) and 31-33 (0284, 0293). Each says "Its control at
  …/p/<id>/ still shows the state this act set". No result contains `[withheld]`: the one hit is a page view's
  `withheld` key note (0161). Every such undo the builder actually pressed was admitted and landed (0135, 0139, 0258,
  0262, 0269, 0286, 0297, 0329).
- **Trial answers without a page: gone.** Every `core.test_subflow` answer that moved the tab carries
  `pageAfterTrial` and its note: all 13 in brief 1, including the reset refusals whose start check loaded `~/`
  (0045, 4.6 s), and trials 0062-0272. The reset refusals in briefs 3 and 4 carry none, and their start check took
  3 ms (0253), so the tab did not move. That matches "one that did not move carries nothing new".

## Cause class

**Decisive: a generic guidance gap (Core script format), with model mistakes the trials and judges caught. Four
product contributors.** It is not the task, oracle or fixture: the page view shows the pinned marks and the next
three tiles, and one trial's table matched the oracle exactly. It is not the environment.

1. **Decisive (generic guidance, Core).** `flow-bootstrap/plan/flow-script-format.ts`, loop lines around 396-407. Rows
   a `repeat over` visits can be narrowed (`extractList.where`) but, as far as the model is told, never ordered. The
   only sort it is taught (`recordOutput.process`) shapes the saved table. So "act on the N newest" produces a table
   that disagrees with the acts.
2. **Contributor 1 (product, Core).** `llm/loop-budget.ts` `automationStudioLlmEvidenceLoopWrapUp().withholds(toolId)`,
   applied at `llm/evidence-loop.ts:757`. In a candidate's wrap-up every `core.run_node` is withheld, including the
   undo calls that `core.test_subflow` (one of the finishing tools) requires before it will run. Finishing is then
   impossible.
3. **Contributor 2 (product, Core).** `recordingExcerpt` is read by `project-agents/contracts/subflow-brief.ts:304` and
   counted in `supervisor/dispatch-tool.ts` `sentKey`, so the brief counts as changed. But nothing gives it to the
   builder: `project-agents/dispatch/run-brief.ts` reads no excerpt, and no other runtime module does. Guidance tells
   the supervisor to "change what the builder is given (… a recordingExcerpt …)", which is a no-op today.
4. **Contributor 3 (judge model).** A wrong ordering claim in the advice, from the end page rather than the read.
   No product fix is proposed beyond contributor 2, so that the supervisor's correction can reach the builder.
5. **Contributor 4 (product, Core).** `flow-bootstrap/subflow-candidate/submission-numbering.ts` moves a refusal's
   revisions by the brief's offset but leaves its `digest`. That digest is the inner probe candidate's, not the
   subflow proposal's (`scoped-submission.ts` `proposalOf`, which `matches()` compares). Also, `proposalOf` returns
   the cached older proposal when the inner controller re-accepts an earlier plan (0375 answered "revision 12"). So
   the inner numbering runs ahead, and a later `unchanged_submission` names "revision 14" (0381), which this brief
   never issued. The model obeyed "test it using exactly that revision and digest" and was refused stale (0379,
   0385).
6. **Contributor 5 (product, not traced).** Trial acts 15, 17 and 19 (trial step 11, after step 10 opened the pinned
   post as a dialog by a tile click) got no place: no settle clause (0089), and every undo was refused
   `undo_wrong_target` (0079, 0096, 0111), so they stayed `cannotUndo` for the rest of the build. act-13, made the
   same way, did get a place. The chat ending then says a "Like" remains and "the site offers no way to undo it"
   (`61-failure-panel.png`). Both claims are wrong: D96…'s main control reads `Like` again at 0298, and the site does
   offer Unlike. The ledger's account of those acts is what is wrong.
7. **Minor (product, not traced).**
   - A press step saved as `Like` acted on a control then named `Unlike`. In trial 0115's pass 1, on D96… (left liked
     by the cannotUndo acts), the judge saw "removed 'Unlike' and added 'Like'". The saved target did not hold to its
     name across the toggle.
   - The structure read's column sample cut the alt text exactly before its date ("Photo by Harbourlight Studio on…",
     0019), so brief 2 decided that the grid had no dates.

## Proposed least, general fix and its test seams

**1. Teach the listing's own order (required, Core guidance).** In `flow-script-format.ts`, beside the
`extractList.where` line, add one sentence. It should say that to visit rows in another order, the order goes on
the listing step, `extractList.sort: [{"field": "issued", "order": "desc", "as": "date"}]`, and that `repeat most:
N` then acts on the first N in that order. Use a generic example of another kind of site, such as "pay the two newest
invoices". Never a feed, posts or likes.

Enforce it mechanically too. In the submission checks (the seam is `flow-bootstrap/plan/validation.ts` or the
binding-issue pass in `candidate/submission.ts`; I did not pick the exact function), refuse once a Flow that has both:

- a listing whose `recordOutput.process` carries `sort` or `limit`, and
- a `repeat over` that listing whose span makes a lasting act.

The refusal should say that the repeat visits the listing's own order, and that `sort`/`where` belong on
`extractList`.

Tests:

- `plan/tests/flow-script-format.test.ts`: the sentence is present and names no realistic-scenario words.
- A validation test: that Flow is refused, and one with `extractList.sort` passes.
- A domain test beside `extraction/tests/`: a handle-form `extractList.sort` with `as: "date"` over alt-like prose
  orders the rows a loop sees.

**2. Let a wrap-up reset (Core).** Make `withholds` take the call, not only its tool id, and not withhold a
`core.run_node` whose input names an open act under `undoes`. Navigations that carry `undoes` count too (the builder
already writes them, 0256). The test goes in `llm/tests/` beside the loop-budget tests: in a candidate wrap-up, an
exploring `core.run_node` is still answered `not_offered`, and one naming an open act under `undoes` runs.

**3. Show the excerpt (Core).** In `project-agents/dispatch/run-brief.ts`, put `brief.recordingExcerpt` into the
builder's opening words, as untrusted supervisor notes beside `repairOf`'s `said`. The test goes in
`project-agents/dispatch/tests/`: a brief with an excerpt yields a builder request that contains it, and one without
an excerpt is unchanged.

**4. One numbering and one digest for scoped refusals (Core).** In `scoped-submission.ts`, map every
revision/digest pair a refusal names (`revision`/`digest`, `standingRevision`) through `proposalOf(inner candidate)`
to the receipt the trial gate matches. Also stop `proposalOf`'s cache from answering an older revision number for a
newly accepted inner revision. The test goes beside the scoped-submission tests: submit A, then B, then A, then A
again. Every revision/digest the answers name must be accepted by `matches()`, or be the standing latest.

Not proposed:

- loosening the repeat guard (right at 0416-0420, 0195-0199 and 0238);
- changing the judge's verdicts (all four no's were right);
- anything that names this site, task, pinned posts or likes in model guidance.

## Next likely failure (after fix 1)

- The content-side `order-rows.ts` must read `as: "date"` from prose alt text ("Photo by … on October 2, 2026. May
  be an image of …"). Core's run-end sort did (0272 stored the right three). I have not verified that the in-page
  sort does.
- The toggle trap: if a trial starts with a post already liked, the "like the post" press unlikes it (minor
  contributor 7). The Flow should read the control's state, or the target should hold to its name.

## Chat and UI

Ending (`61-failure-panel.png`): "FluxIQ could not finish the Flow … tested 7 times … These changes the build made
are still on the site: used "Like" (the site offers no way to undo it)". This contradicts the supervisor's ending and
the page evidence (0287, 0298 and 0330 all show `Like`). It comes from the cannotUndo acts of contributor 5. "Saved
candidate draft … the Flow's steps are unchanged" is accurate. I did not review the mid-build panels.

## Rerun notes

The final state is most likely clean. Every act with an address was undone and landed, and D96…, DQwj… and DZcq…
read `Like` at their last views. I could not check this against the oracle, so use a fresh workspace anyway. Rerun
after fixes 1 to 3. Fix 3 alone would likely have saved brief 5, and fix 1 would have saved brief 3's revision 8.
Without them, a rerun is an unchanged retry.

## Not verified

- Why acts 15, 17 and 19 got no place while act-13 did (likely a dialog URL change by history push, not a
  navigation), and whether act-17 was an unlike of an already-liked post.
- That the Core script parser carries `extractList.sort:` through to the domain slot as it carries
  `extractList.where:`.
- The exact path by which the inner controller's revision numbering ran ahead (0371-0385). I inferred it from the
  answers and `proposalOf`'s cache, not from a trace.
- The exact target-resolution branch that let the `Like` step press `Unlike`.
- The final account state against the oracle (no Flow, so no oracle check ran).

## Evidence

- Run: `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-20/run-mvgobp8h-b99ede98/steps`. Step folders:
  - 0017: the grid in the page view.
  - 0019: column samples, coverage 0.5.
  - 0062-0115: brief 1 trials.
  - 0131, 0150 and 0157: real settle addresses.
  - 0153 and 0155: `not_offered`.
  - 0249: brief 3's revision 8 script (the sort in `recordOutput.process`).
  - 0272: that trial and its judge.
  - 0284: the page-order acts.
  - 0332-0385: the unchanged and stale answers.
  - 0394: the `recordingExcerpt`.
  - 0397 `request.txt`: no excerpt, and the judge advice present.
  - 0416-0420: the repeat refusals.
- Run folder and UI: `fxwork/t567/!FluxIQWebExtension/test-runs/instances/rr3-slot-4/run-mvgobp8h-b99ede98` and
  `...ui-review.local/61-failure-panel.png`.
- Code, Core at `fxwork/t567/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/`:
  - `flow-bootstrap/plan/flow-script-format.ts` (396-408);
  - `llm/loop-budget.ts` (`withholds`, 246);
  - `llm/evidence-loop.ts:757`;
  - `project-agents/contracts/subflow-brief.ts:130,304`;
  - `project-agents/supervisor/dispatch-tool.ts:430`;
  - `project-agents/dispatch/run-brief.ts` (`repairOf`);
  - `flow-bootstrap/subflow-candidate/submission-numbering.ts`;
  - `flow-bootstrap/subflow-candidate/scoped-submission.ts` (`submit`, `proposalOf`);
  - `flow-bootstrap/site-reset/settlement-words.ts`.
- Code, downstream: `domain/src/runtime/llm-evidence/plan-resolution/extraction/slot.ts` (`LIST_KEYS`),
  `domain/src/actions/extraction/order-request.ts` and `apps/extension/src/content/extraction/order-rows.ts`.
