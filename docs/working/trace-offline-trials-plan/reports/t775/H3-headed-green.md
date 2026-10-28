# t775-H3: headed site-reset suite on the integrated t775 trees

## Outcome

**Partial.** The final full headed run gave 24 passed and 3 failed (31.0m). Every remaining failure is a product defect, recorded here with evidence and left for the owner:

- photo-toggle and photo-dialog-destination fail on defect A, in Core.
- photo-dialog-step fails on defect B, in the domain.

**Item 1, save-then-read: resolved.** It passes, and both of its trials skip the save `already_in_state`.

**The four H2 photo failures were all spec-side first.** Each came from the old sequence: a second test of an unchanged revision is now answered with the stored judged run and not run again. I rewrote all four specs:

- photo-looped-other-item passes after the rewrite.
- The other three, once the rewrite let them run real trials, exposed the two defects.

I touched no source, ran no mutating git command, and made no model calls.

## Final full run (headed)

`cd apps/extension && pnpm test:e2e e2e/site-reset/tests --workers=1 --reporter=list` printed `3 failed / 24 passed (31.0m)`. It was run after `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` in the Core tree (all three packages printed `build-cache reuse`). `test:e2e` rebuilt the extension, printing `inputs changed: domain` and `verified 22 files` for chrome, firefox and e2e-chromium.

| # | Spec | Result |
| --- | --- | --- |
| 1 | installed-project (new-row inverse) | ok |
| 2 | installed-project (failed save vs retry) | ok |
| 3 | job-failed-save | ok |
| 4 | job-undo-redraws-on-load | x, the known `test.fail` (t772 w11), counts as passed |
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
| 22 | photo-dialog-destination | **x**, line 254: defect A |
| 23 | photo-dialog-step | **x**, line 282: defect B |
| 24 | photo-looped-other-item | ok |
| 25 | photo-page-order-limit | ok |
| 26 | photo-toggle | **x**, line 246: defect A |
| 27 | repair-first | ok |

## Item 1: judged-change-save-then-read

I first reran it unchanged; it printed `1 passed (1.5m)`.

The diagnostic showed:
- The save press answered `toggle: {"signature":{"via":"class","gains":["css-04lcxz0"],"loses":[]}}`.
- **Both** trials' step 3 ("save the job") were `skipped: "Its control already showed the asked state, so it was not pressed."`.
- Both siteChanges list `{step:3, outcome:"already_in_state"}`.
- The witness reads 3 rows before and 3 after (`change: "none"`).

Exploration had left the job saved, so the first trial skips too, not only the second.

Spec change:
- **Old:** a `DRAFT` comment line, and the skip asserted only on the last trial.
- **New:** the draft line is gone and the header is updated. The skip is asserted on **each** trial (`siteChanges` has length 2, each has at least one `already_in_state` act and no `changed` act).

This is strictly stronger: the old assertion still holds, and it now also proves the first trial never toggled the explored save off.

## Why the four photo specs failed under H2 (spec-side)

These specs build a single-subflow plan, so `core.test_subflow` is the judged whole run. On such a plan, a test of a revision whose yes stands is answered by `supervisor/whole-trial.ts` `alreadyJudged` (t679, line 137). That answer carries `alreadyJudged: true`, the stored `trialRunId` and `complete`, and has no steps, no `actsToUndo`, no judge call and no siteChange.

- Before t775, each spec's first test was refused, and the next one ran.
- Now the first test runs. So D4's "test again with the same revision and digest" got the stored echo. That explains H2's empty steps, empty `trialAct`, missing siteChange and `undo_unknown_act` observations.
- A resubmission of the identical Flow is refused as unchanged (t464, `candidate/unchanged-submission.ts`).

So each spec now makes every later trial that must run a **changed revision**. The change is a trailing (or, in the loop spec, leading) `web.dom.capture_snapshot` look step, the precedent `judged-change-add-to-cart.spec.ts` sets.

Two more spec-side facts surfaced in the runs:
- **The trial's leading arrival step shifts step numbering.** A trial act's `did` is now `trial step 4 "like the post" …`, not `trial step 3 …`.
- **Core's after-look closes the dialog.** Since t775 Core reads a trial's change after its end view by loading the witness page (`trial-change/readings.ts`). After a dialog trial, the browser is on the post's own page, not in the dialog. That is why H2 saw `dialogLikedAfterTrial` 0 and `likedAnywhereAfterTrial` 1.

## Spec changes (all in apps/extension/e2e/site-reset/**)

### change-proof.ts
- New `canonicalJson` and `ensureStatesIn(request)`. They return every `ensureState` a judge request's Flow carries, in canonical form.
- The judge request writes lists as `{count, items}`, and the helper reads them back as lists.
- These are diagnostic and assertion helpers only.

### photo-toggle.spec.ts
Old sequence (D4): `trial.liked`, then the probe, the undo of the explored like, and `trial.restored`, `trial.after` and `trial.final`, all on revision 1. Everything after `trial.liked` got echoes.

New sequence:

1. **trial.liked, revision 1.** It runs with the explored like in place.
2. **The probe and the targeted undo.** These are unchanged.
3. **trial.restored, revision 2** (a trailing look).
4. **trial.after, revision 3** (two trailing looks). It runs with trial 2's like in place.
5. **The probe for the trial act, then its undo.**
6. **trial.final**, answered from revision 3's judged run.

What it asserts:

- **Kept unchanged:**
  - the like declaration, the reads, `leftFromEarlier` greater than 0 on trial 1;
  - the explored like's settle, equal to `controlSettle(likedPage)`;
  - the refused undo on another post, with no click;
  - the own-page Unlike: admitted, the same place, one click, the post shows Like;
  - for the trial act: `did`, `settle`, its undo admitted and one click;
  - no retired codes, 4 tests, `tests[3]` yes.
- **Added in trial 1:** its like step was skipped (`typeof skipped === "string"`), and exactly one `already_in_state` act.
- **Added for trials 2 and 3:**
  - trial 2's like is not skipped (it presses the restored post), and it has no `already_in_state`;
  - trial 3's like is skipped `already_in_state`, with `leftFromEarlier` greater than 0;
  - every trial has a distinct `trialRunId`;
  - `siteChanges` has length 3;
  - `tests[3].trialRunId` equals `tests[2]`'s. This used to be compared with `tests[1]`, and is now the same echo of the newest revision.
- **Added: the ensureState check.** Every judge request's `ensureState` must equal the explored like's own signature. This is where it now fails (defect A).
- **Changed:** the trial act's `did` is matched as `/^trial step 4 "like the post"/`, not `/^trial step 3 /`. It is the same act; numbering shifted by the arrival step. This is tighter, since it names the step's label.

Not weaker: every earlier settlement and undo proof is kept, and trials 1 and 3 now prove both "runs with a like in place" and "the toggle is skipped, not pressed off".

### photo-dialog-destination.spec.ts
Old sequence: `trial.settled`, then `trial.after` on the same revision (an echo with no `actsToUndo`, hence H2's `trialAct ""`).

New sequence:

1. **trial.settled, revision 1.**
2. **The probe.** An `undoes: act-9999` claim, which the ledger answers with `actsToUndo`.
3. **own.again, then unlike.trial.**
4. **trial.final, revision 2** (a trailing look).

What it asserts:
- **Points 1 to 4 are unchanged:** destination ref, own-page undo, `undo_already_back` with no click, the pre-trial look losing the list, and `startedLike` text.
- **Added: a judge log.** The default answer is the same bare yes, so verdicts are unchanged.
- **Added: the trial-1 like step.** Its `ensureState` must equal the explored like's signature, and it must not be skipped (the post shows Like at start). This is where it fails (defect A).
- **Added: point 5** (unreached because of the defect):
  - the trial act's settle;
  - unlike.trial permitted and landed, and the post shows Like;
  - `tests` has length 2 and the final trial is a distinct run, yes, not started with the trial act, with 3 labelled steps succeeded.
- **Replaced:** `trialCode(tests.at(-1))` yes, now covered by point 5.

### photo-dialog-step.spec.ts
Old sequence: `trial.dialog`, then `trial.after` (an echo), the probe, the undo, and `trial.final` (an echo).

New sequence: `trial.dialog`, then the probe, own.again, unlike.trial, and `trial.final` on revision 2 (a trailing look).

What changed and why:

- **Where the press landed** (point 2):
  - **Old:** `dialogLikedAfterTrial` 1 and `dialogUnlikedAfterTrial` 0, read from the browser after the trial. Since t775 Core's after-look has already left the dialog.
  - **New:** read from the first judge request's `endView`, the view Core took after the Flow's last step and before the after-look. The post's own action control (the Unlike whose next control is Comment) is inside a `[… dialog …]` region exactly once and never outside, the `DIALOG` header is present, and no post Like is in the dialog.
  - **Kept:** `likedAnywhereAfterTrial` 1.
  - **Observed:** `endUnlike: {inDialog:1, outside:0, dialogHeader:true}` and `endLike.inDialog: 0`. Same claim, from a view taken where the claim is about.
- **Trial act lookup:** `/^trial step 3 /` became `/^trial step 4 "like the post"/`, for the arrival step.
- **`ambiguous` check:** scoped to `tests[0]`, the trial point 2 is about; the old spec had only one trial. The changed revision gets its own explicit checks: its like resolution `inDialog` true, and no `web.target.ambiguous`. This is where it fails (defect B).
- **The final trial:** a distinct run, yes, not started with the trial act, 4 labelled steps succeeded, and 2 siteChanges.
- **Dropped:** D4's "trial.after runs while the trial's like stands, `leftFromEarlier` > 0". This spec's like control was never pressed in exploration, so it carries no toggle signature or `ensureState`, and a trial run over the like would press it off. photo-toggle trial 3 proves it instead.

### photo-looped-other-item.spec.ts
- **Old (D4):** `trial.1`, the probe, `trial.2` on the same revision (an echo with no siteChange, hence H2's line 148), the undo, then `trial.3` (an echo).
- **New:** `trial.1`, the probe, own.open, the undo, then `trial.2` on revision 2 (a look after the profile opens).

What it asserts:
- **Kept:** trial 1 yes, `likedAfterTrial == [PRESSED]`, the act listed once, the undo admitted and landed (not `already_back`), `likedAfterUndo == likedAtStart`, and the next trial yes with no `actsToUndo`, no unsettleable act and not started with the act.
- **Added:**
  - the act's settle names the **pressed** post's page and not the post the control was read on: observed `"Read the page at …/p/D96ahbWGjtY/ again so its control's state can be seen."`. This is the run-mvrj7qgf bug the spec exists for, and was never asserted before;
  - the next trial is a distinct run with a siteChange;
  - its `leftFromEarlier` does not name the settled act's `did`.
- **Dropped:** D4's "trial 2 runs while the pass's like stands, `leftFromEarlier` > 0". The reason is the same as in photo-dialog-step: the control was only read in exploration, so there is no `ensureState`, and the re-press would unlike the post and leave nothing for the undo to prove. photo-toggle and judged-change-like-loop prove a trial over a like in place.

## Product defects

### A (Core): a toggle step's `ensureState` is taken from an undo press, which reverses it

**Cause.**
- `flow-bootstrap/explored-toggles.ts` records every `core.run_node` whose answer carries a `toggle`, including calls under `undoes`. `action-permissions.ts:408` calls `exploredToggles.explored({ ...call, value }, execution)` on the undo path with no distinction.
- `script-statements/toggle-idempotent.ts` then ties a step to "the newest such press" on the same handle.
- When the build undoes an explored Like by pressing Unlike on the same control (stable handle t593), the newest press is the Unlike. Its signature is `{via:"name", gains:["like"], loses:["unlike"]}`.
- So the Flow's "like the post" step gets `ensureState` = *not liked*. It is skipped `already_in_state` on an unliked post and never likes it.
- A saved Flow built this way would never like anything. The scripted judge's yes hides that here.

**Evidence, from the final run:**
- **photo-toggle, line 246.** Each judge request's `ensureState`, deduplicated:
  - trial 1's two asks: `{"gains":["unlike"],"loses":["like"],"via":"name"}`, which is correct (before the undo);
  - trials 2 and 3, all 4 asks: `{"gains":["like"],"loses":["unlike"],"via":"name"}`.
  - The diagnostic shows `likeToggle` (explored press) `gains:["unlike"]` and `unlikeToggle` (undo) `gains:["like"]`.
  - `unlike.ok` true, `postShowsLike` true before trial 2, yet trials 0, 1 and 2 all show step 4 "like the post" `skipped: "Its control already showed the asked state, so it was not pressed."`.
  - The first headed run (before the ensureState assertion was added) failed at the trial-2 step check with the same skip.
- **photo-dialog-destination, line 254.** Exploration's last toggle press is the own-page Unlike under `undoes: act-2` (the second press, `unlike.again`, was refused and is not recorded). So trial 1's two asks both carry `gains:["like"]`, its step 3 "like the post" is skipped, no trial act exists, and point 5 is unreachable. H2's `trialAct ""` was this defect behind the echo.

**Suggested fix (owner's call, not made):**
- Do not record a press made under `undoes` as an explored toggle, or never let it override the press of the act it undoes.
- Then rerun photo-toggle and photo-dialog-destination. Both should pass as written.

### B (domain): a resubmitted dialog step resolves to the post's own page after later views at the same address

**What happens.**
- Revision 1's like step (handle t593, `precedingSteps` 2) resolved to view 7, the dialog view at `/p/D1OKDvAEHfa/`, with `inDialog: true`.
- After trial 1, the probe, own.again and unlike.trial, revision 2's identical like step (also `precedingSteps` 2) resolved to **view 19**, the post's own page at the same address, with `inDialog: false` and a different selector digest (`196022b7…` vs `0aa98b67…`).
- Its cell step resolved to view 12, a profile view taken after the build's dialog view, which no dialog press followed: Core's start location load or look before trial 1.
- Trial 2 then failed at step 4: `execution_failed`, `web.target.ambiguous`, "More than one control matched the step's control, and none could be chosen."
- This is the t743 e3b / t748 U1b shape the spec guards, now reached through a second revision.

**Likely cause:** the domain's view-history fold of `precedingSteps` picks the newest view of the cell's page, then the newest view at the step's address after it. That view is the own page, not the dialog the cell's press opened. It is not proven: I did not read the domain resolver, `resolvePlanNodeParameters` with `handleReach: view_history`.

**Evidence:** the resolutions in `reset-photo-dialog-step.json` (both lines quoted above), and `tests[1].feedback.stoppedBy`.

**Not caused by A.** The failure is in target resolution, not `ensureState`.

## Commands run and observed results

- **Core build** (fxwork/t775/!FluxIQ): `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` printed `build-cache reuse` for all three packages, and `Done`.
- **save-then-read, unchanged:** printed `1 passed (1.5m)`.
- **Four photo specs, first rewrite:** printed `4 failed`.
  - photo-dialog-destination and photo-dialog-step: `trialAct ""`. The first is defect A; the second was the step-number shift.
  - photo-looped-other-item: my new settle wording guess was wrong (the real settle names the pressed page).
  - photo-toggle: trial 2's like `skipped` (defect A).
- **Four photo specs, second run:** printed `3 failed, 1 passed (5.6m)`. looped-other-item passed. dialog-step `ambiguous` (defect B); the toggle pair failed on the ensureState check, which still compared raw `{count,items}` lists, since fixed.
- **Final full suite:** printed `3 failed / 24 passed (31.0m)` (table above).
- **`npx tsc -p tsconfig.test.json --noEmit`** (apps/extension), after the last edit: no output, exit 0.
- **`node scripts/structure-audit.mjs`** (downstream root):
  - First, after the full run: `structure-audit: 1 violation(s)`. The violation was `[statement-packing] change-proof.ts line 100`, mine; I split it onto separate lines with no change in behaviour.
  - Rerun: `structure-audit: passed (231 warning(s), 616 baselined).`
  - The one new advisory warning is `change-proof.ts: 9 exported values` (threshold 8). The other site-reset warnings predate this work.

## Not verified

- **The final full run used `change-proof.ts` before the line-100 reformat.** That edit only split one line, and tsc and the audit pass after it. I did not rerun the suite after it.
- **Defect B's cause in the domain resolver.** It is inferred from the view numbers, not from reading `resolvePlanNodeParameters`.
- **That the defect A fix would turn photo-toggle and photo-dialog-destination green.** It is reasoned from the evidence; I made no source change.
- **Whether a toggle step whose control was only read (never pressed) in exploration should get `ensureState`.** Core cannot know it is a toggle, so I did not exercise it. photo-looped-other-item and photo-dialog-step avoid running over an in-place like for that reason.
- **The real judge.** Every verdict is the scripted bare yes, so a yes here proves the trial ran, not that the Flow did the task (defect A's yes trials liked nothing).

## Open questions

1. **Defect A** (Core): should undo presses be excluded from explored toggles? This blocks photo-toggle and photo-dialog-destination.
2. **Defect B** (domain view-history resolution): owner and fix. This blocks photo-dialog-step.
3. **Marking the three as `test.fail`.** Should the supervisor mark them as known gaps until fixed, as job-undo-redraws-on-load is? I left them failing so the defects stay visible.
4. **`change-proof.ts` exports** are past the advisory export count. Split it if wanted.
