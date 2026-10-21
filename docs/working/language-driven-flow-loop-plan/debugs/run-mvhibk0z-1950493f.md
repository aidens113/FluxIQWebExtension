# Debug: run-mvhibk0z-1950493f

- Instance: rr5-slot-2 (rerun round 5), lane tree `fxwork/t719`, task `job-board-save-quillmark-remote`, built from
  the real extension chat. Frozen source: downstream `e04711f0`, Core `3caf1ff0` (dev with t743 and t748). $0.25 purse.
- Verdict: **failed**, `flowCreated: false`, 116 steps, 59 provider calls, $0.0789, chat 02:53:39 to end 02:59:08 UTC.
- Read-only diagnosis. Evidence: `steps/` (decisions, calls, results), the run folder (`summary.json`,
  `evaluation.json`), the slot-2 Lab log (no fault: clean prelude, cost recorded, exit 1 = verdict), the UI review
  (`rr5-slot-2/run-mvhibk0z-1950493f.ui-review.local/`), the fixture's save handler, and Core source at `3caf1ff0`.
- **Furthest so far on this task: a subflow trial judged yes.** Round 4 reached a judged-no whole run. Round 5 never
  reached a whole run, but its save subflow saved exactly the three rows the oracle wants, first time.

## How far it got

| Phase | Steps | What happened |
| --- | --- | --- |
| Plan | 0002 to 0008 | Two subflows: `save_quillmark_jobs` (p1, `create_new`) and `read_saved_jobs` (p2, after it). Both briefs were dispatched. |
| Brief-1 (save) | 0009 to 0065 | It dismissed the layers, searched, and read the 7-row list (0019). `find_on_page` "Save"/"save" answered 0 matches and named the wordless icons (0025, 0027). It described icons (0029 to 0041) and pressed the detail pane's icon declaring `modify_existing`. That was **refused `candidate.reset_witness_required`** (0043, correct). It read My jobs, which issued `destination-1` (2 items) plus t748's `retryRefused` (0045). **0047 resent the press "the same as before", with the stale handle**, and got `target_unobserved`. It never pressed again. Then it went back and forth between My jobs and the results (0048 to 0059), and 0054 to 0056 read the results list believing it was the saved list. Three navigations were refused as repeats (`same_result`, 0061 to 0065), and the builder was stopped. Brief-2 was not run (it starts after brief-1). |
| Brief-3 (save, resent) | 0068 to 0100 | Same opening, then `find_on_page` and `describe_element` until four `already_answered` refusals (0084 to 0090). **0091 submitted a save loop whose lasting step was never pressed while exploring:** a `dom-click` on a row icon, `consequences: modify_existing`, `repeat over: jobs`, with no witness of any kind. It was accepted (0092). **0094 was the subflow trial: site check admit (0095).** Saving on pass 1 was absorbed as `web.action.page_reported_failure` and retried, the read kept 3 rows, and the three saves landed (act-10 to act-12). It was judged yes four times (0096 to 0099). Completed at 0100. |
| Brief-4 (read) | 0101 to 0111 | **Entry preparation re-ran the save subflow on the un-reset site** (act-13 to act-15). The hearts toggle, so it *unsaved* the three jobs: My jobs read 2 at 0103, the baseline. It submitted a correct read (0107). **0109 `test_subflow` was refused `candidate.trial_reset_required`, `failed: acts_unsettleable`, `canMeet: no_call`**: all six acts were `gate_unsatisfiable` / `nothing_to_name`. It ended blocked as told (0111). |
| End | 0112 to 0116 | The supervisor sent a reset brief plus the read brief again. The read brief was refused `project.brief_repeated`. Brief-5 (reset) completed at once ("no lasting acts remain", 0115) and returned `gate_unsatisfiable`. The supervisor ended `blocked` (0116). |

**The build stopped going forward at 0109.** That was the first trial after the build's first lasting acts, and the
cause was already fixed at 0094/0095, when a trial was admitted for a lasting step that nothing could ever settle.

## Root cause

**A product defect (Core), decisive. Not task, oracle, fixture or environment.** The task is achievable and
unambiguous: brief-3's trial saved exactly Quillmark's three remote UK rows, and the read subflow was correct.

### 1. Decisive: a lasting step can reach a trial with no reset witness (the witness rule guards only exploration)

- The witness precondition is `create-baselines.ts` `AutomationStudioSiteResetCreateBaselines.check`, plus
  `site-reset/reset-witness.ts` `automationStudioSiteResetWitnessMissing`. It is called only from
  `flow-bootstrap/action-permissions.ts` (line ~355): for an **exploration** `core.run_node` call, before the seal.
- A Flow step cannot carry `resetDestination` (`reset-settlement/trial-repeat.ts` header). The only witnesses a
  trial act can get are these:
  - an explored act it repeats, through its destinations or its toggle;
  - its control sitting in a list recorded complete as an original;
  - adoption of an issued list. Since t743 (A1 narrowed), adoption is only of lists some act named, or lists read on
    the act's own page (`reset-settlement/judge.ts` `evaluate` → `adoptable`).
- Brief-3 explored no press. The save step repeated nothing. The icon shows no stated state (saved shows only as a
  class), so there is no toggle witness. The results list issued no ref. `destination-1` (My jobs) was issued at
  0045, but no landed act ever named it, because 0047's naming call was refused before it ran. Nothing was adoptable.
- Nothing checks this before the trial. `core.submit_subflow` accepted the step, and the subflow trial gate
  (`flow-bootstrap/subflow-candidate/subflow-trial-gate.ts`, ~line 490) asks only `siteReset.beforeTrial`. That asks
  only about acts *already* on the site, and with none it admitted (0095).
- The trial's act-10 was the build's first lasting act, and it **sealed the baselines** (`site-reset/ledger.ts`
  `record` → `createBaselines.seal()`). From then on `refsClosed()` holds, so `judge.ts` `unmet` answers
  `nothing_to_name` for every trial act. Every later trial of any subflow is refused for the rest of the build.
- This is the same failure class `reset-witness.ts`'s own header describes for round 2 ("sealed the baselines, and
  every trial was refused for the rest of the build"), now entering through the trial door instead of the
  exploration door.

### 2. Contributing: entry preparation repeats lasting acts on a site that was never put back

`service/project-build/phase-start.ts` `AutomationStudioProjectBuildPhaseStart.explore` runs step (d)
(`entry-preparation.ts` `automationStudioProjectBuildPrepareEntry`) even when `onSite.still` or `onSite.unsettleable`
is non-empty and no hook ran. The rerun of the save subflow repeated three lasting acts on top of three still in
place. That breaks the 2026-10-12 rule ("reset before re-running"). Here the fixture's save is a toggle
(`board/client-script.ts` `toggleSave`), so the repeat silently undid the saves and doubled the acts Core held as
unsettleable (3 → 6). On a site whose create is not a toggle, it would have doubled the entries.

### 3. Model choices the product invited or should have stopped

- **Brief-3 authored a lasting step it never explored**, and declared `modify_existing` for a save, which creates an
  entry on another list. The repeat-stop handoff pushed it that way (`project-agents/dispatch/run-brief.ts`,
  `earlierAttempt.note`): "Do not take the same path again ... Submit and test as soon as your steps do your parts."
  The `earlierAttempt.reason` lists only the repeat-guard calls. It drops the one lesson brief-1 had paid for: the
  save press needs `resetDestination` naming the issued My jobs ref.
- **Brief-1's stale-handle resend (0047)** followed t748's `retryRefused` words (`site-reset/words.ts`
  `retryRefused`): "go back to where it was refused and make that call again, **the same as before**". A handle never
  survives leaving the page. After that came model drift: the navigation ping-pong, and reading the results list as
  the saved list (0054). The repeat guard rightly ended it.

## Round 4 causes and the t743/t748 changes in this run

| Round-4 cause / change | In round 5 |
| --- | --- |
| Loop pass recorded on the template row (t743 d3) | Not exercised by an undo. t748's per-pass naming works ("trial step 9, pass 1 of 3"). |
| Press the page answers with its own failure counted as landed (t743 d4) | **Fixed and working.** Pass 1 was absorbed as `page_reported_failure` and retried, and all 3 rows saved (round 4 lost one). |
| `undo_unproved` hiding its reason, ~90-step reset loop (t743 S2) | **Fixed and working.** `gate_unsatisfiable` with closed `nothing_to_name` / `no_call`. Brief-4 ended in 3 decisions, and the whole build cost $0.079. |
| Brief-1 navigation ping-pong to three `same_result` repeats | **Recurred**, same shape (0061 to 0065). |
| False ending sentence "no read ever showed a change" | **Recurred.** Now traced (see UI). |
| t743 A1 narrowing + "A1 choice" (witnessless trial act → `gate_unsatisfiable`) | **Exposed this failure.** Under round-4 code My jobs would have been adopted, and Core's look before 0109 would have read it at its original 2 rows. The acts would have settled and the read trial would have run. Reverting is not recommended: the adoption only "worked" because entry preparation had toggled the saves back off. |
| t748 `retryRefused` (office C6) | Contributed one wasted call (0047), through "the same as before". |
| t748 unidentified creation needs a witness | Never reached. It guards exploration only, and brief-3 made no exploration press. |
| t743 S3 repair-first | Correctly not held: the returns carried `terminalReason: gate_unsatisfiable`. |

## UI review (19 moments, side panel + scenario tab)

The chat reads as a clean turn stream. The user's message is a right-aligned bubble (`02-mid-build-panel.png`).
Each step has a bold heading, a reason and a tool card, there is a status line above the composer, a Stop button, and
the composer is always present. The overlay is visible at every build moment (16/16 samples from moment 2 on;
`01-start` was taken before the build started).

Defects:

1. **A CSS class shown as a control's name**, both in chat and in the overlay: "Reading the details of
   “css-0732x7m”", and Look cards titled the "css-0732x7m" label (`05-mid-build-panel.png`,
   `05-mid-build-scenario.png`). Source: `activity/wording/action.ts` (describe `named`) is fed a class token as the
   name.
2. **The ending contradicts itself** (`18-mid-build-panel.png`, `19-failure-panel.png`). The first paragraph says
   "The build left no change on the site that it knows of. It made 6 acts it could not name, but no read ever showed
   a change from them, so they may have changed nothing". The second paragraph says the saves "left changes on the
   site that can no longer be checked or undone". The trial's own page showed "Job saved". Source: an unsettleable
   act with no witness has `changeSeen === false`. `project-agents/supervisor/left-on-target.ts` (line ~110) maps it
   to `seen: false`, and `activity/wording/left-told.ts` then says "no read ever showed a change". "6 acts" counts
   the same three saves twice, and "it could not name" is internal jargon.
3. **Stuttered failure text**: the overlay and chat say "Build failed | Build failed: FluxIQ could not finish the
   Flow: I could not finish this." (`19-failure-scenario.png`). "could not finish" appears three times across the
   ending.
4. **Entry preparation is shown as "Testing your Flow"**, with step counts jumping (Step 1 of 3 → Step 2 of 5) during
   brief-4's entry run (moments 14 and 15, `15-mid-build-panel.png`). The person sees a second test of the save
   subflow that is really a setup rerun.
5. Minor: overlay texts from addresses ("Opening “myjobs”", "Opening “jobs”", moments 6 to 8), and a guard refusal
   shown verbatim in the overlay ("Not done: opening “jobs” — it was already tried exactly this way…", moment 8).
   The Stop button reads "Stop" at start and "Stop build" later (`02` vs `09`).

## Recommended fix

Everything below is generic: it names no site, task, saving, hearts or job boards.

**F1 (Core, decisive, structural): one witness precondition at every door a lasting act lands through.** The class
"a lasting act lands with nothing that could settle it, seals the baselines, and every later trial is refused" has
now come in through three doors: an exploration press (job round 2), a witnessless trial act (office rounds 3 and 4),
and an unexplored trial step (job round 5).

- Move the rule into one function that takes a declared lasting step plus the build's explored acts, originals and
  issued refs. The exploration door (`action-permissions.ts` → `create-baselines.ts` `check`) and the trial doors
  both call it, before any run:
  - `flow-bootstrap/subflow-candidate/subflow-trial-gate.ts`;
  - `flow-bootstrap/candidate/trial-gate.ts`;
  - `project-agents/supervisor/whole-trial.ts`.
- The trial doors ask it for every reversible lasting step of the candidate.
- A step has a witness when any of these holds:
  - it repeats (`reset-settlement/trial-repeat.ts`) an explored act that has a destination or a toggle;
  - its control sits in a list recorded complete as an original;
  - it has a toggle witness (stated state, exactly `modify_existing`).
- Otherwise the trial is refused unrun, recording and sealing nothing. Use a closed code (e.g.
  `candidate.trial_step_unwitnessed`, `failed: no_witness`) that names the step's label. `canMeet` is
  `another_page` while unsealed. The words give the same route as `reset_witness_required`: press that step's control
  once while exploring, naming the `resetDestination` ref of the list where its effect would show.
- Files: new module beside `site-reset/reset-witness.ts`, where the directory cap allows (else a sibling directory,
  as `reset-answers/` was); `site-reset/create-baselines.ts`; the three gates; `site-reset/words.ts`.

**F2 (Core): never run entry preparation on a site holding this build's acts.** In `service/project-build/phase-start.ts`
`explore`, when no hook ran and `onSite.still` or `onSite.unsettleable` is non-empty, skip step (d). Answer `unprepared`
with a closed code (e.g. `project.entry_site_not_reset`), so the builder or supervisor resets or ends instead.

**F3 (Core words):**

- `site-reset/words.ts` `retryRefused`: "go back to that page and press the same control again by its handle in the
  newest view, naming that list's ref".
- `project-agents/dispatch/run-brief.ts` `earlierAttempt`: carry the earlier builder's site-reset refusals and the refs
  issued for them (e.g. "its press X was refused for want of a witness; ref R was issued for it"). Drop "submit and
  test as soon as" for a part that declares a lasting act no exploration has pressed.

**F4 (UI words):**

- `left-on-target.ts`: an unsettleable act with no witness is told "could not be checked", never "no read showed a
  change", and is counted once per step.
- The ending says "could not finish" once.
- `activity/wording/action.ts`: a describe of a wordless control never uses a class token as its name (use "a control
  with no words", or its item's heading).
- Entry preparation gets its own status ("Getting the site to where this part starts"), not "Testing your Flow".

**Tests that fail first:**

- **F1.** Core `flow-bootstrap/subflow-candidate/tests/trial-witness.test.ts`. Use a generic library catalogue: a
  per-book "reserve" icon with no stated state, a "My reservations" list read complete with its ref issued, and no
  explored press. A candidate whose `modify_existing` click step loops over books:
  - is admitted today, and its acts are `gate_unsatisfiable` / `nothing_to_name` after the run;
  - after F1, is refused unrun with the new code, ledger unsealed, nothing executed;
  - after an explored press of the icon naming the ref, is admitted.
- **F2.** Core `service/project-build/tests/project-build-phase-start.test.ts`. With an unsettleable act from a
  predecessor's trial and no hook, `explore` for the dependent builder calls `execute` today. After F2 it does not,
  and the entry is `unprepared` with the code.
- **F3/F4.**
  - `site-reset/tests/words.test.ts`: `retryRefused` never says "the same as before".
  - `supervisor/tests/left-on-target.test.ts`: an unwitnessed unsettleable act is never told "no read ever showed a
    change".
  - `activity/wording` test: a class-only control name is not echoed.

Not proposed: any change to the fixture (its failing first save and wordless toggle icons are documented traits),
the task, the oracle, or guidance naming any part of this site. Reverting t743's A1 narrowing is not proposed either.

## Not verified

- That the trial acts' `spot` had no `scope` in an original list, i.e. that the results list issued no original. This
  is inferred: no `resetDestinations` appeared on the results reads (0019, 0055, 0074), and the outcome was
  `nothing_to_name`. The ledger's act records are not in `steps/`.
- That the entry run's three presses unsaved the jobs. This is inferred from the fixture's toggle, the plain hearts
  at 0101 and My jobs reading 2 at 0103.
- Where `same_result` decided the navigation repeats (0061): not traced; the shape matches round 4.
- Live UI points come only from screenshots and overlay samples. Nothing was exercised interactively.
- Observation, not a cause: the Flow as written is a toggle. Run again on jobs already saved, it would unsave them
  (entry preparation showed exactly that), and "keep every job already saved" would then be broken. The oracle's
  pre-existing saves are other employers', so the oracle would not catch it. Surfacing a class-only on/off state as
  a page-view state is a possible later domain change, not proposed here.
