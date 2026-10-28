# t775-H4: the last three headed photo site-reset specs

## Outcome

**Partial.** The final full headed run printed `1 failed / 26 passed (30.2m)`. Two of the three specs are fixed in the spec
and pass. The third, photo-dialog-step, fails on product defect B in the domain, and the cause is now located.

- **photo-dialog-destination: fixed in the spec, passes.** The brief's premise was wrong: the spec does undo the trial's like
  (act-3) before trial 2. The failing check was a stale proxy, not the new rule.
- **photo-toggle: fixed in the spec, passes.** `tests[2]` was undefined because the scripted builder's third submission was
  refused (`web.handle.renumbered_by_reload` on the Like's handle t593). The builder threw `diagnostic.submission_refused`,
  and the build ended `proposed` on revision 2's judged run. This was the spec's sequence, not a product defect.
- **photo-dialog-step: still fails at line 296, on product defect B (domain).** I found the cause with a resolution probe and
  have left the spec failing so the defect stays visible.

I changed no source in either repository, ran no mutating git command and made no model calls.

## Final full run (headed)

`cd apps/extension && pnpm test:e2e e2e/site-reset/tests --workers=1 --reporter=list` printed `1 failed / 26 passed (30.2m)`.
- It ran after the last spec edit, with no probe in any spec.
- `test:e2e` rebuilt the extension (`inputs changed: apps/extension`; `verified 22 files` for chrome, firefox and e2e-chromium).
- Core was as the sub-supervisor left it (Defect A fixed and built). I did not rebuild it.

| # | Spec | Result |
| --- | --- | --- |
| 1 | installed-project (new-row inverse) | ok |
| 2 | installed-project (failed save vs retry) | ok |
| 3 | job-failed-save | ok |
| 4 | job-undo-redraws-on-load | x, the known `test.fail`, counts as passed |
| 5 | job-unexplored-step | ok |
| 6 | judged-change-add-to-cart | ok |
| 7 | judged-change-address-carried | ok |
| 8 | judged-change-like-loop (newest) | ok |
| 9 | judged-change-like-loop (pinned) | ok |
| 10 | judged-change-save-then-read | ok |
| 11 | office-address-confirm | ok |
| 12 | office-buy-now (create the cart never shows) | ok |
| 13 | office-buy-now (trial act repeating a create) | ok |
| 14 | office-cross-brief | ok |
| 15 | office-navigating-press | ok |
| 16 | office-read-after-change | ok |
| 17 | office-reloading-confirm-undo | ok |
| 18 | office-site-reverted-toggle | ok |
| 19 | offline-first-job | ok |
| 20 | offline-first-photo | ok |
| 21 | photo-dialog-act | ok |
| 22 | photo-dialog-destination | **ok** (was x at line 269) |
| 23 | photo-dialog-step | **x**, line 296 `expect(finalLike?.inDialog).toBe(true)`: defect B |
| 24 | photo-looped-other-item | ok |
| 25 | photo-page-order-limit | ok |
| 26 | photo-toggle | **ok** (was x at line 253) |
| 27 | repair-first | ok |

photo-dialog-step, from the final run's diagnostic:
- The like step's two resolutions were `{views:[7], inDialog:true, selector 0aa98b67...}` then `{views:[19], inDialog:false,
  selector 196022b7...}`.
- Its tests were `yes`, then `execution_failed`, with steps `[succeeded, succeeded, failed web.target.ambiguous]`.

## Spec changes (apps/extension/e2e/site-reset/tests only)

### photo-dialog-destination.spec.ts (line 269)

**What the run showed** (`reset-photo-dialog.json`, run before my edit):
- `trialAct` act-3. `unlike.trial` returned `ok: true`, `resetSettlement.settled: "act-3"`, and `postShowsLikeAfterTrialUnlike`
  was true, so the trial act was undone before trial 2.
- Trial 2's `startedWith.cannotUndo` still lists act-3, with the words `trial step 3 "like the post" on "Like" (put back as
  far as fresh complete reads can show; the list named for it (destination-1) could not be read again, ...)`. That is the
  same "settled restored, list unread" wording act-2 carries in trial 1. Core lists a settled act there whenever it has an
  unread list (`site-reset/ledger.ts:553`, `act.unread !== undefined`).
- Trial 2's like step was **not** skipped: the post showed Like, so the step pressed it. That left a new act (`leftOnSite`
  `[act-4]`).

So "not listed under startedWith" no longer means "put back". The brief proposed asserting that act-3 is listed as left and
that trial 2's like step is `already_in_state`. Both are contradicted by the evidence: the act was put back and the step
pressed.

**Old:** `expect(startedWithActs(tests[1]).map(a => a.act)).not.toContain(trialAct)`.

**New:**
- act-3 is listed exactly once under trial 2's `startedWith`. Its `did` contains `put back as far as fresh complete reads
  can show` and `(destination-1) could not be read again`, and does not contain `left on the site`.
- Trial 2's like step is on control `Like` and is not skipped.
- Trial 2's `leftOnSite` is exactly one act, and that act is not act-3.
- The header's point 5 now says this.

**Why not weaker:**
- The old check only said the act was absent.
- The new checks require the specific "put back" settlement, so an act left as it was, or settled `unchanged`, fails.
- They add that trial 2 really pressed the restored post and left one new act.

### photo-toggle.spec.ts (line 253)

**What the run showed** (`refusedSubmission` and `seen`, new diagnostics):
- At builder step 15 the evidence was `submit.after core.submit_subflow false`.
- The refusal was `flow_bootstrap.completion_refused` / `evidence_completion_parameters_unresolved`, with
  `web.handle.renumbered_by_reload` on line 9 ("like the post", t593).
- `next` said: "The handle t593 came from a view taken before the page was reloaded ... Look at the page again and copy the
  control's current handle."
- After trial 2, Core's look reloaded the post's page. The liked post's control shows Unlike under another handle (t724 in
  the dialog-step run), so no current view prints t593.

**Old sequence:**
1. Trial 2 (revision 2) leaves its like.
2. Revision 3 is submitted with the exploration-time handle t593. This is refused.
3. Trial 3 would run with the like in place.
4. List, undo, and an echo test.

**New sequence:**
1. Trial 2 leaves its like.
2. `act.list.trial` lists it.
3. `own.again`, then `unlike.trial` under `undoes`, which puts it back.
4. The build **looks again where the Flow acts**: `profile.again`, then `open.again` (the grid cell), then `dialog.again`
   (a look).
5. `submit.final` (revision 3, two trailing looks) uses the handles that look printed.
6. `trial.final` runs on the restored post.
7. `trial.repeat` is answered from revision 3's judged run (Core t679).

Budget: `maxIterations` 24 became 32 and `maxCallsPerRun` 36 became 48, for the six extra builder turns. Also added:
`seen`, `refusedSubmission`, `likeHandle`, `cellHandle` and `freshHandles` in the diagnostic.

**Assertions:**
- **Kept unchanged:** everything for exploration, trial 1, the refused undo on the other post, the own-page Unlike, trial 2,
  and the ensureState check on every judge request.
- **Kept for the trial act:** `did` (`trial step 4 "like the post"`), its settle, `unlike.trial` (permitted, same place,
  one click, post shows Like).
- **Added:**
  - trial 2's `leftOnSite` is exactly `[trialAct]`;
  - the fresh like handle is a handle;
  - trial 3 is `yes`, a distinct run and not started with trialAct;
  - all 5 labelled steps of trial 3 succeeded and none was skipped, and its like is on `Like`;
  - there are 3 siteChanges and no `already_in_state` in the third;
  - trial 3 left exactly one act, and not trialAct;
  - `tests` has length 4, `tests[3]` is `yes` with the same `trialRunId` as `tests[2]`, and there are no retired codes.
- **Dropped:** "trial 3 runs with trial 2's like in place and skips it `already_in_state`".
  - **Why it cannot be built:** while the post is liked, no view prints the Like's handle, so no revision naming it is
    accepted. Naming the Unlike's handle loses the tie to the explored press (Core ties by handle or by resolved target), so
    that step would press the like off.
  - **Where it is still proved:** "a trial over a like in place is skipped, not toggled off" is still asserted on trial 1 (the
    explored like): it skipped `already_in_state`, `leftFromEarlier > 0`, and exactly one `already_in_state` act. The skip
    depends on the page state and the step's ensureState, not on who made the like.
- The header comment now says all of this.

**Why not weaker overall:**
- The one removed claim could not be reached under the product's handle rules, and the same behaviour stays asserted on
  trial 1.
- Trial 3 now also proves, in the browser, that a revision written from a fresh look after a trial resolves into the dialog,
  keeps the explored ensureState, and presses the restored post.

### photo-dialog-step.spec.ts (line 296, still failing)

- Assertions are unchanged.
- **Diagnostics added:**
  - each resolution's `precedingSteps` (node and handles) and written `target`;
  - per-turn `seen` (the evidence tail).
- The comment above the failing assertion now names the cause and the owning file.
- A temporary probe (re-resolving the like step's own input at every builder turn) was used for diagnosis and then removed.
  The final file has no probe.

## Product defect B (domain): a trial's capture of the dialog drops the Like's handle from the dialog view

**Symptom.**
- Revision 1's like step (handle t593, `precedingSteps` = navigate, then click t116) resolves into the dialog (view 7,
  `inDialog` true).
- Revision 2's identical step, submitted after trial 1 and the undo of its like, resolves to the post's own page (view 19,
  `inDialog` false, selector digest `196022b7...` vs `0aa98b67...`).
- Its trial fails at "like the post": `execution_failed`, `web.target.ambiguous`.

**Probe evidence** (probe run, same spec). I resolved the like step's recorded input again at every builder turn, with three
handles taken from the exploration dialog view: the Like t593, the post's Comment t596 (also on the own page) and the
dialog's Close t452 (dialog only).

| Builder turn (after) | t593 Like | t596 Comment | t452 Close |
| --- | --- | --- | --- |
| step 6 (submitted rev 1) | dialog, view 7 | dialog, view 7 | dialog, view 7 |
| step 7 (trial 1 ran) | refused `renumbered_by_reload` | dialog, **view 13** | dialog, **view 13** |
| steps 8-9 (act.list, own.again) | refused | dialog, view 13 | dialog, view 13 |
| steps 10-11 (unlike.trial, submit rev 2) | **own page, view 19, inDialog false** | dialog, view 13 | dialog, view 13 |
| steps 12-15 (trial.final ran) | dialog, view 24 | dialog, view 24 | dialog, view 24 |

**Cause.**
- The fold (`step-views/views.ts`, `standing`) still finds the dialog the cell's press led to: Comment and Close resolve
  there throughout. So `led(t116)` is intact.
- The dialog view's contents changed during trial 1. A capture of the dialog in the Flow's scope (view 13) replaced the
  view's targets, because `captured` keeps only the newest capture's in-dialog controls (`views.delete(key)`; `kept` starts
  empty unless the capture was partial).
- That capture showed the post liked, its control under another handle. Trial 1's judge `endView` shows it as `t368 button
  "Unlike"` in `[dialog t226]` with no t593.
- So `standing` returns nothing for t593, and `inStandingView` falls back to `current`:
  - after the undo, the own page prints the Like as t593 again (view 19);
  - the step takes the own page's identity into the dialog, and fails ambiguous among the dialog's Likes.
- After trial.final's own dialog capture (view 24, post unliked), t593 resolves into the dialog again.

**Why it is the product, not the spec.**
- The builder names t593 from its **newest** view: the restored own page after `unlike.trial` prints `t593 button "Like"`.
  That is exactly the situation revision 1 was in, which the domain resolves into the dialog (t748 U1b), and which this spec
  exists to guard.
- A live model would write the same Flow and fail the same way.
- Making the scripted builder re-open the dialog before resubmitting would hide the defect rather than test the product.
  (photo-toggle does re-look, because its handle was genuinely stale.)

**Owning files (not changed):**
- `domain/src/runtime/llm-evidence/plan-resolution/step-views/views.ts`, `captured`: a newer capture of a dialog view
  forgets handles it no longer shows. One option, the owner's call: keep a handle a newer capture shows under a different
  state, or merge rather than replace.
- `plan-resolution/target-packets.ts`, `inStandingView`: falls back to the page shown last at the address.
- Possibly related: `stable-handles.ts` gives a toggled control a new handle per state (Like t593, Unlike t724), which is
  what empties the dialog view of t593.

**Not pinned:** which Core call took view 13 during trial 1. It is in the Flow's scope and numbering, while the post was liked
in the dialog: a trial reading or an end view.

## Other observations

- **Destination: two answers word act-3 differently (wording, not blocking).**
  - `unlike.trial`'s settlement says act-3 settled with "fresh complete reads show everything it could change as the build
    found it ... No act of this build is still open".
  - Trial 2's `startedWith` says its list (destination-1) "could not be read again, so whether it is as the build found it
    is not known".
  - The two answers disagree about the same act. Owner: Core `site-reset/ledger.ts` / `site-reset/words.ts`.
- **photo-toggle: a build left with a toggle in the "on" state cannot resubmit a step on that control without first undoing
  it.** While the post is liked, no current view prints the Like's handle, and the Unlike's handle carries no ensureState tie.
  A live builder that wants to amend its Flow after a passing trial must undo first, which this spec now does. Recorded for
  the owner; not claimed as a defect.

## Commands run and observed results

- **Diagnostic run 1** (photo-dialog-step + photo-toggle, `seen` and `refusedSubmission` added): printed `2 failed`.
  - photo-toggle failed at `trialCode(tests[2])` (`undefined`): the refusal is quoted above.
  - photo-dialog-step failed at the `finalLike` check: resolutions as above.
- **Probe run 1** (dialog-step): printed `1 failed`. `structuredClone` on the resolve input threw (the input carries a
  `permission` function) and refused the first submission. I fixed the probe and did not use this run's result.
- **Probe run 2** (dialog-step, t593 only): printed `1 failed`. t593 resolved dialog view 7 at step 6, was refused after
  trial 1, then own page view 19, then dialog view 24.
- **Run of three specs** (destination and toggle edited, three-handle probe in dialog-step): printed `1 failed / 2 passed
  (4.9m)`.
  - `ok photo-dialog-destination`, `ok photo-toggle (2.0m)`.
  - `x photo-dialog-step` at line 317 (`finalLike.inDialog`). The probe table above is from this run.
- **Final full suite:** printed `1 failed / 26 passed (30.2m)`. The per-spec results are in the table above.
- **`npx tsc -p tsconfig.test.json --noEmit`** (apps/extension), after the last edit: no output, `tsc-ok`.
- **`node scripts/structure-audit.mjs`** (downstream root), after the last edit: `structure-audit: passed (231 warning(s),
  616 baselined).`
  - The site-reset warnings are the same as H3's: directory file counts, and `change-proof.ts` / `photo-build.ts` exports.
  - None is new.

## Not verified

- **Which Core call took view 13 during trial 1** (above).
- **The real judge.** Every verdict is still the scripted bare yes.
- **The wording conflict on act-3 in destination.** I did not trace it beyond `ledger.ts:553` and `words.ts` `settledAs`.

## Open questions

1. **Defect B** (domain `step-views/views.ts`): owner and fix. It blocks photo-dialog-step.
2. **Should photo-dialog-step be marked `test.fail` until B is fixed**, as job-undo-redraws-on-load is? I left it failing.
3. **Destination act-3:** should a settled act's undo answer and the next trial's `startedWith` agree about an unread list?
