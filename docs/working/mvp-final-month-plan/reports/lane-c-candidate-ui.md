# Lane C candidate probe: UI review of run-mv0fuotv-805294d7

Worker report, read-only analysis. Run: lane C, task
everything-store-plus-earbuds-under-50, candidate authoring mode. The build
itself ran 04:06:57-04:08:18 UTC on 2026-10-09 (the Lab started 04:01:28; the
first five minutes were set-up with no UI moments).

## Outcome

Done. All 14 UI-review pictures (7 moments, panel + scenario) and all 10 Lab
browser views were viewed and placed against step start times. The chat never
tells the person why the build stopped: the real cause (the Flow it wrote had a
repeat instruction in the wrong place, step 0036) was never captured on screen,
and the visible part of the ending is a circular "it failed because it kept
trying" message under three copies of the model's false claim that it had
"corrected" the Flow.

## What changed and why

Only this report file was written. Nothing else was edited, run or committed.

## Moment-by-moment

Times are UTC. "UI n" = ui-review moment n; "Lab n" = Lab view 0000n (file times).

| Time | Picture | Step in progress | What is shown | Judgement |
| --- | --- | --- | --- | --- |
| 04:06:53 | Lab 1 | before 0001 | Fresh panel: "What can FluxIQ do for you?" with three suggestion chips. Store home page with cookie banner. | Good. No stale previous thread. |
| 04:06:53 | UI 1 | before 0001 | Panel captured from its devtools target shows only "Loading the conversation..."; overlay not yet present. | Fine: a brief loading state, no stale thread. |
| 04:06:57 | Lab 2, UI 2 | 0001 chat | Person's instruction bubble; live line "Starting..."; "Stop" button. Page overlay "Starting..." sits top-left over the store's app banner and hides its text. | Fine. Overlay covering page text is minor. |
| 04:06:58 | Lab 3 | 0001 done | Answer: "I'll make you a new automation for this, working out its steps by trying them on the page you had open and then test-running the whole Flow once from the start. I'll say here when it is ready, or why it is not." Store shows a "Never miss a deal" notification prompt. | Good plan statement. It sets a promise (say why it is not ready) that the ending does not keep. |
| 04:07:06 | Lab 4 | 0004 click | "Open page / Done"; "Clicking on the page — Closing the cookie consent banner ..."; "Click / Working on it"; live line "Building your Flow / Clicking on the page"; "Stop build". | Good. |
| 04:07:17 | UI 3 | 0006 type (11 s) | Click Done, "Typing into the page — Searching Brightaisle for wireless earbuds ...", "Type / Working on it". Page shows the store's "Continue shopping" browser check; overlay at bottom-left "Building your Flow / Typing into the page". | Acceptable. The overlay says typing while the page shows a browser check; the next frame explains it. |
| 04:07:22 | Lab 5 | 0007 decide | "Type / Done" then "Robot check / Done. The check cleared on its own after 9 s."; live line repeats "The check cleared on its own after 9 s." | Good, plain and honest. |
| 04:07:37 | Lab 6, UI 4 | 0020 read list | "Read list" card in red: "Didn't work: FluxIQ didn't read it, as the step didn't say which list on the page to read"; then "Decided the next step — The AI model's reply couldn't be read or used. Asking it again; the build stops if its replies keep being unusable."; then "Read list / Working on it". | Failure wording is plain. The heading "Decided the next step" is wrong for a reply that could not be read (nothing was decided). The three refused repeated looks (0010-0014, 04:07:25-27) are above the visible area in every picture; not seen. |
| 04:07:52 | Lab 7 | 0028 read list (page 2) | "Action · Dom next page / Done"; "Looking for the repeating list on the page — Reading page 2's results list ..."; "Look · the "Results" list / Done"; "Decided the next step — The AI model's reply couldn't be read or used ..."; "Read list / Working on it". | Defect: internal step name "Dom next page" with the generic title "Action". Same wrong "Decided the next step" heading. |
| 04:07:57 | UI 5 | 0030 next page | "Look · the "Results" list / Done", the unusable-reply paragraph, "Read list / Done: 21 rows from 1 page". Overlay samples include "Building your Flow \| Running the "Dom next page" step". | Read result is clear. Overlay repeats the internal step name "Dom next page". |
| 04:08:07 | Lab 8 | 0035 decide | Page 3. "Action · Dom next page / Done" (top, cut), "Look · the "Results" list / Done", third unusable-reply paragraph; live line "The AI model's reply couldn't be read or used. Asking it again; the build stops if its replies keep being unusable." Overlay: "The AI model's reply couldn't be read or used. Asking..." | Honest and plain, but three identical paragraphs for one kind of hiccup add noise. Overlay cut at a word boundary, which is fine. |
| 04:08:09 | (none) | 0036 refusal | No picture: the one moment that carries the real reason was not captured (Lab 8 at 04:08:07, UI 6 at 04:08:17). | Not verified how the refusal was worded. |
| 04:08:17 | UI 6 | 0041 decide | Two pairs of: "Saving the Flow's steps — Resubmitting the corrected Flow: the repeat now sits on the read step with repeat while: next, and the next-page step follows it." + card "Change the Flow · run the step again / Not done: it was already tried exactly this way and did not work". Live line "Not done: saving the Flow's steps — that didn't work, trying another way". Overlay samples change from that line to "Build failed". | Poor; see defects 1-4. |
| 04:08:18 | Lab 9 | 0042 refused, build ending | Same two pairs plus a third "Saving the Flow's steps — Resubmitting the corrected Flow ..." heading with no card yet. Panel still shows "Building your Flow ... trying another way" and "Stop build" while the page overlay already says "Build failed". | Panel and overlay disagree for a moment; the panel's "trying another way" is false. |
| 04:08:22 | Lab 10 | ended | Last two pairs, then the ending: ""Create an automation here" stopped because the build failed: it kept trying without getting any further, so it was stopped. The Flow "Find every pair of wireless earbuds in the store's search results that is..." has no steps yet, but it keeps your instruction, so you can build it again." Stop button gone, record button red again. Overlay "Build failed". | Honest that nothing was made, but does not say why. |
| 04:08:25 | UI 7 | ended | Same as Lab 10 (panel and scenario). | As above. |

Automations was never opened in any picture.

## Answers to the brief's questions

1. **Refused submission and three resubmissions.** The person does not learn
   why the build stopped. The refusal at 0036 (repeat instruction in the wrong
   place) was not on screen in any picture, so its wording is unknown. What is
   visible is three copies of the model's narration "Resubmitting the corrected
   Flow: the repeat now sits on the read step with repeat while: next, and the
   next-page step follows it." each followed by "Change the Flow · run the step
   again / Not done: it was already tried exactly this way and did not work".
   The narration claims a correction that never happened (the script was
   identical) and uses script syntax ("repeat while: next"); the card then
   contradicts it. The card's sub-label "run the step again" is wrong for a
   whole-Flow submission. The ending names no cause beyond "it kept trying
   without getting any further". No codes or tool ids appear, but
   "Create an automation here" is the internal action name, quoted. Note: the
   step index shows all three resends (0038, 0040, 0042) refused by the repeat
   guard, not only the last two as the brief says.
2. **Ending honesty.** Honest about the outcome: "has no steps yet" and "keeps
   your instruction". It says nothing false: no claim of a test, a judgement or
   a made Flow. It is incomplete: it does not say the Flow was never tested,
   which the opening promised ("test-running the whole Flow once from the
   start. I'll say here when it is ready, or why it is not"), and "stopped
   because the build failed ... so it was stopped" is circular. The live line
   just before the ending, "that didn't work, trying another way", was false:
   the build tried the identical way and then stopped.
3. **Malformed replies and refused repeated looks.** Each malformed reply shows
   as a paragraph headed "Decided the next step — The AI model's reply couldn't
   be read or used. Asking it again; the build stops if its replies keep being
   unusable." (seen for 0017, 0025 and 0033; the third also as the live line and
   overlay). Plain and honest, but the heading is wrong and three identical
   paragraphs are noise. The three refused repeated looks (0010, 0012, 0014)
   were never visible in any picture (scrolled above or not yet rendered), so
   their wording is not verified.
4. **Earlier-round defects.**
   - Internal step names: recurs. "Action · Dom next page" card (Lab 7, Lab 8)
     and overlay "Running the "Dom next page" step" (UI 5 overlay samples).
   - Node ids such as "s6": not seen.
   - "(passes ..., collected ...)" counters: not seen.
   - "the judge": not seen.
   - Cards saying "Done" for nonsense: not seen. Every "Done" card matched a
     step that succeeded; failures showed "Didn't work" or "Not done".
   - Stale previous thread at start: not seen (Lab 1 fresh welcome, UI 1
     loading).
   - Text cut inside a word: not seen. Every cut ("that is...", "Asking...",
     "that didn't work...") falls at a word boundary.

## Defects

| # | What the person sees | Why it is wrong | Picture | Likely layer |
| --- | --- | --- | --- | --- |
| 1 | Ending: ""Create an automation here" stopped because the build failed: it kept trying without getting any further, so it was stopped." | Circular; gives no cause. The person cannot tell that the Flow it wrote was rejected for a misplaced repeat instruction and then resent unchanged, so "build it again" invites the same failure. Quotes an internal action name. Does not say nothing was tested, though the opening promised to say why it is not ready. | Lab 10, UI 7 | Core conversation wording (it is `build.chat.said` in flow-lane.json). |
| 2 | Three times: "Resubmitting the corrected Flow: the repeat now sits on the read step with repeat while: next ..." | Model narration is shown as fact although nothing was corrected; it leaks script syntax ("repeat while: next"); repeated three times verbatim. | UI 6, Lab 9, Lab 10 | Model narration passed through by Core progress; the "Saving the Flow's steps" heading is Core progress wording. |
| 3 | Live line: "Not done: saving the Flow's steps — that didn't work, trying another way" | False: the next attempt was the identical submission, then the build ended. Shown in the panel at the same moment the page overlay already says "Build failed". | UI 6, Lab 9 | Core progress wording; panel/overlay disagreement is extension timing. |
| 4 | Card: "Change the Flow · run the step again" | A whole-Flow submission is labelled as re-running a step. | UI 6, Lab 9, Lab 10, UI 7 | Extension card rendering (title/sub-label for the repeat-refused submission), possibly fed by a Core label. |
| 5 | Card "Action · Dom next page"; overlay "Running the "Dom next page" step" | Internal step name from the node id (`dom-next_page`) and the generic title "Action"; should read like "Next page". Earlier-round defect, still present. | Lab 7, Lab 8, UI 5 overlay | Extension card rendering for the card; overlay text likely from the same name source. |
| 6 | Heading "Decided the next step — The AI model's reply couldn't be read or used ..." | Nothing was decided; the heading misdescribes an unusable reply. Shown three times identically. | Lab 6, UI 4, Lab 7, UI 5, Lab 8 | Core progress wording. |
| 7 | The 0036 refusal card (the real cause) | Never seen; it scrolled away within seconds and the ending does not restate it, so a person glancing at the end never sees the cause. | gap between Lab 8 and UI 6 | Ending composition (Core). |
| 8 | Page overlay at bottom-left covers store content ("Add to cart" button of the first card in a row); at top-left it covers the app banner text. | Minor: hides page controls during the build. | UI 2, UI 4, UI 5, Lab 5-10 | Extension overlay placement. |

## Commands run and observed results

- Python read of `run-mv0fuotv-805294d7.ui-review.local.json`: 7 moments at
  04:06:55, 04:07:00, 04:07:20, 04:07:40, 04:08:00, 04:08:20, 04:08:28; overlay
  texts per moment as quoted above.
- `steps/index.md` and every `meta.json`: 42 steps, 0001 at 04:06:57 to 0042 at
  04:08:18; 0038, 0040 and 0042 all `llm_evidence_loop.repeat_refused`.
- `flow-lane.json`: candidate verdict `not_tested`, trialCount 0, draft none;
  ending text in `build.chat.said` matches the panel. `live-panel.json` holds
  only `{"mode": "side-panel"}`.
- `date -u -r` on the 10 Lab views: 04:06:53 to 04:08:22.
- Viewed 14 UI-review pictures and 10 Lab views (24 in total).

## Not verified

- Wording of the 0036 refusal card and of the three refused repeated looks
  (0010-0014): no picture shows them.
- Whether three or four "Change the Flow" cards ended up in the chat (only two
  are fully visible at the end).
- Automations tab: never shown.

## Open questions or contradictions found

- The brief says the repeat guard refused the last two resends; the step index
  and flow-lane.json show all three (0037, 0039, 0041) refused at 0038, 0040,
  0042.
- The ui-review panel at moment 1 shows "Loading the conversation..." while the
  Lab view at the same second shows the welcome screen; the review captures a
  separate panel target, so they may differ briefly.
- The capture cadence (20 s ui-review, ~15 s Lab) missed the one step that
  carried the cause; a moment triggered on a refused submission would close
  this gap.
