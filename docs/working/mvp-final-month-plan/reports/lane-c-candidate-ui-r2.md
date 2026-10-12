# Lane C round 2: UI review of run-mv0pa79q-ef91811b

Worker report, read-only review. Run: lane C, everything-store, candidate
authoring mode, 2026-10-09 08:29:05-08:30:56 UTC. Compared with round 1
(`lane-c-candidate-ui.md`, run-mv0fuotv-805294d7).

Picture names: "UI n" = `run-mv0pa79q-ef91811b.ui-review.local/0n-*-{panel,scenario}.png`
(UI 1 start 08:29:05, UI 2-7 mid-build every ~20 s, UI 8 failure 08:30:50);
"Lab n" = `run-mv0pa79q-ef91811b/screenshots/0000n-*.jpg` (Lab 1 08:29:05 to
Lab 11 after the ending).

## Outcome

Done. All 16 ui-review pictures, all 11 Lab views, the overlay samples of all 8
moments, `summary.json`, `review/timeline.json`, `snapshots/flow-lane.json` and
`steps/index.md` (plus step 0044's result) were read. The headline: the
ending still does not tell the person why the build stopped. The four refused
completions appear only as four "Checking whether the Flow is finished"
paragraphs of the model's own claims that the Flow "can be authored", with no
card saying they were refused or that no Flow had been written; then "The build
failed: it kept trying without getting any further, so it was stopped." The
quoted internal name "Create an automation here" is gone (fixed), and "Dom next
page" is now "Next page" (fixed).

## What changed and why

Only this report file was written. Nothing else was edited, run or committed.

## Answers to the brief's questions

1. **Onboarding at start (t376).** Not seen. UI 1 (panel) and Lab 1 both show
   only "Loading the conversation..."; Lab 2, 1.2 s later, already shows the
   person's instruction and "Starting...". No onboarding or welcome state is in
   any picture, so its wording cannot be judged. Round 1's Lab 1 showed the
   welcome ("What can FluxIQ do for you?"); here the capture fell inside the
   loading state. Verdict: not verified (not a proven regression).
2. **Stop and Take over / Hand back.** "Stop" (Lab 2, Lab 3, before the build
   is announced) then "Stop build" (UI 2-6, Lab 4-9) is present throughout the
   build and gone at the end (UI 7, UI 8, Lab 10, Lab 11). Take over / Hand
   back are not shown in any picture. That matches the source:
   `apps/extension/src/panel/chat/chat-panel.ts` line 182 says they sit beside
   Stop "for runs only", and no Flow ran. Verdict: Stop fixed/present; Take
   over not exercised (build, not run).
3. **Idle record button.** Neutral: a grey ring-and-dot in the top bar when
   idle (UI 1, UI 7, UI 8, Lab 1, Lab 10, Lab 11), dimmed while the build runs
   (UI 2-6, Lab 2-9). Never red in any picture. Accessible name cannot be read
   from a picture; source gives `aria-label: "Start recording"`, title "Record
   a new automation" (`apps/extension/src/panel/recording/recording-controls.ts`
   line 55), red only on hover/focus (`panel/shell/shell.css` line 80).
   Verdict: fixed (visual); name confirmed in source only.
4. **Card wording.**
   - Kinds seen: "Click · Decline", "Click · Not now" (both buttons, so
     "Click" is correct), "Type · Search Brightaisle", "Robot check", "Look ·
     the "Results" list", "Read list · ...", "Next page" (Lab 4-9, UI 3-6). No
     dropdown or checkbox was used in this run, so "choose"/"tick" wording was
     not exercised. Verdict: correct where exercised; choose/tick not verified.
   - "Dom next page": gone. Card is "Next page" with a globe icon, heading
     "Running the "Next page" step" (UI 5, Lab 7-9). Verdict: fixed.
   - Unusable replies: now "Deciding the next step — The AI model's answer
     didn't make sense, so FluxIQ is asking it again. If that keeps happening,
     the build stops." (UI 3, UI 6, Lab 4, Lab 8). Body is plain; the heading
     still files an unusable reply under a decision heading ("Deciding" instead
     of round 1's "Decided"). Verdict: partly fixed. Owner: Core
     `automation-studio/runtime/activity/observer.ts`.
   - Model narration as fact: still wrong. See findings 2 and 5.
5. **Refused completions and ending.** Still wrong; see finding 1. The chat
   does not say no Flow was written or tested, and the four refusals have no
   card at all. "Create an automation here" is no longer quoted (fixed); the
   ending is still circular.
6. **Overlay.** Text matches the panel's live line at every moment: "Starting..."
   (UI 2 samples 0 ms), "Building your Flow / Opening where the Flow starts"
   (UI 2 samples 1.8 s), "Typing "wireless earbuds" into "Search Brightaisle""
   (UI 3), "Reading the list of "name, price and 4 more"" (UI 4, UI 6),
   "Running the "Next page" step" (UI 5), "Build failed" (UI 7, UI 8). Plain
   words, no internal names. It still covers page content (finding 7).

## Findings

| # | What is shown | Picture | Verdict | Likely owner |
| --- | --- | --- | --- | --- |
| 1 | Ending: "The build failed: it kept trying without getting any further, so it was stopped. The Flow "Find every pair ... that is..." has no steps yet, but it keeps your instruction, so you can build it again." The real cause (the build explored five pages but never wrote a Flow; each of four "finished" claims was refused because there was no draft to check, `candidate.latest_submission_required`, `draftStepsSoFar: 0`) is never said. Circular ("failed ... so it was stopped"); the opening promise "I'll say here when it is ready, or why it is not" (Lab 3) is not kept; "build it again" invites the same outcome. | UI 7, UI 8, Lab 10, Lab 11 | Still wrong (quoted "Create an automation here" fixed) | Core `runtime/service/candidate-failure/refusal-codes.ts`, `flow-bootstrap-commands/candidate-generation.ts`, `conversations/commands/progress.ts` (ending text); it maps `flow_bootstrap.evidence_repeat_without_progress` but ignores the second issue code `candidate.latest_submission_required`. |
| 2 | Four paragraphs "Checking whether the Flow is finished — Completing: the search results across all 5 pages were read, so the Flow can be authored ..." (variants "Completing now: ... can be written from that evidence"). No card follows any of them, so nothing on screen says each was refused or why. The person reads four claims that the job is done, then "The build failed". | UI 7, UI 8, Lab 10, Lab 11 | Still wrong (same class as round 1's "Resubmitting the corrected Flow") | Core `runtime/activity/wording/decision.ts` (heading + narration pass-through); the refusal result (step 0040-0046 `answer` kind) produces no visible card - extension card rendering or Core activity emission for refused `complete`. |
| 3 | Live line and overlay agree with the panel at the end ("Build failed"; Stop gone). Round 1's false "trying another way" line and panel/overlay disagreement are not seen. | UI 7, UI 8, Lab 10 | Fixed (at the captured moments) | - |
| 4 | "Next page" card and heading "Running the "Next page" step"; overlay "Running the "Next page" step". | UI 5, Lab 7-9, UI 5 overlay | Fixed (was "Action · Dom next page") | - |
| 5 | Narration mixes voices and leaks jargon: "I have read pages 1-3 ...; next I will read page 4" (first person, model) beside "FluxIQ is asking it again" (third person); "confirm the list handle and fields before writing the multi-page reading the list Flow" (internal term "handle", garbled); "the Flow can be authored". | UI 6, Lab 8, UI 7 | Still wrong / new instances | Model narration passed through unedited by Core progress (`activity/wording/decision.ts`). |
| 6 | Read-list heading and card name the columns as if they were the list: "Reading the list of "name, price and 4 more"" / "Read list · name, price and 4 more"; the failed first read is named by a product title "Read list · Pulsebud Neo ANC Wireless Earbuds, Hybrid Active Noise...". The same list is named two different ways. | UI 4, UI 5, UI 6, Lab 6, overlay UI 4/UI 6 | New (confusing) | Core activity wording for read list (`activity/wording/`) or extension card title. |
| 7 | Overlay placement: at start top-left over the store's app banner, logo and search box (UI 2 scenario, Lab 2-4); after the search, bottom-left over the filter sidebar ("Novaq", "See more") and the first card's "Add to cart" (UI 3-8 scenario, Lab 5-11). | UI 2-8 scenario | Still present (minor) | Extension `content/activity-overlay/`. |
| 8 | "Didn't work: FluxIQ didn't read it, as the step didn't say which list on the page to read" (cause `handle_in_wrong_parameter`). Plain and red-marked. | UI 4, Lab 6 | Fine | - |
| 9 | Refused repeated looks (steps 0014-0018, `already_answered`) show as "... already tried, so it was not done again." - only the tail is visible at the top of the scroll. | UI 4, Lab 6 (cut) | Not fully verified | Core `activity/observer.ts`. |
| 10 | "Robot check · Done. The check cleared on its own after 9 s." | Lab 5 | Fine (as round 1) | - |
| 11 | First read reports "Done: 4 rows from 1 page", later reads of other pages "21 rows". Possibly read while the page was still filling (Lab 7-8 show grey loading placeholders on pages 3-4). Not a wording defect, but the person sees an unexplained count. | Lab 6 vs UI 5, Lab 8 | New (observation) | Not determined. |
| 12 | No onboarding / welcome state in any picture; only "Loading the conversation...". | UI 1, Lab 1 | Not verified | Extension `panel/chat/view/empty-state*.ts` if it is slow; else capture timing. |

## Commands run and observed results

- Python read of `run-mv0pa79q-ef91811b.ui-review.local.json`: 8 moments,
  8 scenario + 8 panel pictures, panel source "side-panel (devtools target)".
  Distinct overlay texts per moment as quoted in answer 6; overlay rect y=16
  (top-left) in moments 1-2, y=620 (bottom-left) from moment 3.
- `summary.json`: verdict failed, 18 metric steps, first failure
  `lab.chat_build_failed` with the ending text quoted in finding 1.
- `snapshots/flow-lane.json`: candidate verdict `not_tested`; evidence steps
  19-22 `candidate.latest_submission_required`; failure issue codes
  `flow_bootstrap.evidence_repeat_without_progress`,
  `candidate.latest_submission_required`; `build.chat.said` matches the panel.
- `steps/index.md`: 46 steps; 0039/0041/0043/0045 `complete`, each answered
  `refused candidate.latest_submission_required`; 0006 and 0032 unusable
  replies. Step 0044 result: `draftStepsSoFar: 0`, `completionAttempts: 3`.
- Grep of the t274 worktree and its Core for the shown strings to name owners
  (paths in the table).

## Not verified

- Onboarding wording (never on screen).
- Accessible name of the record button (source only, not the live DOM).
- Choose/tick card wording (no select or checkbox used in this run).
- Take over / Hand back (build only, no Flow run).
- Whether any refusal card for the four completions was briefly rendered and
  replaced; none is in any picture, including Lab 10 and Lab 11 after the end.
- The full text of the refused repeated-look lines (cut at the top).
- `review/contact-sheet.html` was not opened; it indexes the same 11 Lab views.

## Open questions or contradictions found

- The brief says the build "explored 5 result pages"; the pictures show pages
  1-5 (URL page=3, 4, 5 in Lab 7-9) - consistent.
- The ending's cause text ignores `candidate.latest_submission_required`,
  although it is in the failure's own issue codes; whether Core's refusal-code
  map has wording for it was not checked in depth.
