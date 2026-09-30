# t174-w28 — full debugs of lane A runs 23, 27, 29, 30, 32, 33

Worker t174-w28, brief t174-w28 (lane A), 2026-09-30.

## Outcome

Done. Six full debugs are written from the surviving evidence, one per run, following `run-debug-template.md` and the
shape of `debugs/run-muoga8at-123533a4.md`. Each Stage 1 section is a byte-for-byte copy of the lead's file, checked by
substring match. Every run reached stage 2 only, and none created a Flow. The six cost $0.6028 together.

## What changed and why

New files (this worker owns them), all under `docs/working/language-driven-flow-loop-plan/`:
- `debugs/run-munuks76-80ecb268.md` (run 23)
- `debugs/run-munvqvf5-01f8ebda.md` (run 27)
- `debugs/run-munw3g8n-69782f57.md` (run 29)
- `debugs/run-munwdqey-485b875e.md` (run 30)
- `debugs/run-munwq8zd-c13ea655.md` (run 32)
- `debugs/run-munwwkwq-064c4203.md` (run 33)
- `reports/t174-w28-older-debugs.md` (this report)

No source, lab-slot, shared document or lane report was touched. No Lab or live run was started.

Evidence used per run:
- `flow-lane.json`: the step records, joined to the build trace by iteration. They give node, result, reason and the
  draft's bytes, guidance bytes, steps without input, and steps unlisted.
- The `[FluxIQ build-trace]` lines in `core.log`: decision kinds, call ids (readable only in run 23, before F9),
  completion-check verdicts, dry-run replays and their durations.
- `live-llm.json`: cost.
- 41 UI-review pictures, opened and read: page state, cart header and lines, overlay and panel.

Parameters and page packets are NO EVIDENCE in every debug, named as gap G1 and as fixed since by the decision dump
(F12). This era's trace logs no act claims, so which acts each refused completion lacked is NO EVIDENCE; it is named as
gap G2.

## Per run

| Run | Id | Task | Stage | Cost | Calls / loop | Ended |
| --- | --- | --- | --- | --- | --- | --- |
| 23 | `run-munuks76-80ecb268` | bigbox pickup cart | 2 | $0.1341 | 64 / 507 s | `evidence_iteration_limit` |
| 27 | `run-munvqvf5-01f8ebda` | everything-store kettle | 2 | $0.0971 | 51 / 143 s | `evidence_repeat_without_progress` |
| 29 | `run-munw3g8n-69782f57` | crossborder hub | 2 | $0.0328 | 23 / 89 s | `evidence_unusable_decision` |
| 30 | `run-munwdqey-485b875e` | everything-store kettle | 2 | $0.1239 | 64 / 195 s | `evidence_iteration_limit` |
| 32 | `run-munwq8zd-c13ea655` | bigbox pickup cart | 2 | $0.0839 | 43 / 208 s | `evidence_repeat_without_progress` |
| 33 | `run-munwwkwq-064c4203` | everything-store kettle | 2 | $0.1310 | 64 / 490 s | `evidence_iteration_limit` |

Top causes per run. The number in brackets is the lane's "Top causes for the audit" item.
- **Run 23:**
  - Invented item addresses [8] (fixed by P1 A): 16 navigations; three landed on `{"error":"not_found"}`, and a towels
    address opened the napkins page.
  - Size words in the search query: the towels search found nothing, and the napkins search found only a marketplace
    3-Pack, which was added x3 for shipping.
  - The act check passed completion 38 without a towels add [7] (fixed by P1 B).
  - 8 dry runs from the start took 315 s, 62% of the loop, and their replays grew the cart from 4 to 8 items (t196).
  - The draft is a transcript (t196), and its entry cap cut the guidance to 177 bytes (t200).
  - The Val card blocked the add at 17 (t195).
  - New: a navigation reports success on a not-found page (not in the lane's list).
- **Run 27** (before F10):
  - The full query found nothing, and the "No results" line never reached the model. It read and pressed on an empty
    page and never tried fewer words [1, search part] (fixed by F10).
  - The repeat guard ended the build while a way remained [6].
  - The draft is a transcript (t196), and the entry cap applied (t200).
  - 3 decisions were unusable, cause not established.
- **Run 29:**
  - Navigate-only exploration: 0 presses. The Voltbay Official Store card was on screen and never pressed [8, or t174's
    navigate-only cause].
  - The robot check was hit twice and not handed to the person [12] (t197).
  - The coupon dialog and cookie banner were open all build [9] (t195).
  - The result cards were likely not in the packet [1] (t200, proved in run 36, not here).
  - 7 identical refused completions in 9 s [6].
  - Dry runs from the start re-entered the robot check (t196).
  - No draft cap in this run.
- **Run 30:**
  - Reached and added the right kettle (sage green, 1.7 L, Brightaisle), but in quantity 1 [7] (fixed by P1 B).
  - Pressed "Save for later" on the kettle line instead of the phone case. The site answered "could not save", and it was
    never recovered (new, not in the list).
  - The cart table was never built: 3 reads refused `column_not_in_detected_list`, and a completion refused
    `cannot_answer_instruction` (new, not in the list).
  - The entry cap applied: 24 of 24 steps shown without input (t200). The draft is a transcript, and dry runs ran from
    the start (t196).
  - F10's effect is visible: the build retyped the query after "No results".
- **Run 32** (the closest):
  - The store was switched, and both item pages were reached with the right size and pickup (and quantity 2 on the
    towels). No "Add to cart" ever took effect, and the cart stayed at 1 item.
  - Candidate: the sticky "Add to cart" was outside the packet [1] (t200, not established).
  - `blocked_by_dialog` at 18 [9].
  - The build ended on 7 unchanged amendments of the refused step d3 [6], [4].
  - Dry runs took 96 s, 46% of the loop (t196). The entry cap applied (t200).
- **Run 33:**
  - Found the Tidewell listing with a shorter query (F10), but never pressed it: 8 reads, and no item page.
  - Alternated `target_covered` and successful presses 6 times on the phone case's Save for later under the site's "could
    not save … Try again". The line ended unsaved (new, not in the list).
  - 5 dry runs took 290 s, 59% of the loop, 4 of them on one unchanged draft (t196; F18 on dev now caps that).
  - 39 of 39 steps shown without input (t200).

What could not be answered, in every run:
- The model's parameters and page packets (G1).
- Which acts each refused completion lacked (G2).
- Which cart line each dry run added (the site's request log holds only its ready line).

Per run:
- Run 23: what `add.paper.towels.2` (19) pressed.
- Run 27: what made 3 decisions unusable.
- Run 29: whether the navigation addresses had been shown.
- Run 30: which columns the table read asked for, and which call added a $15.49 fourth cart line.
- Run 32: whether "Add to cart" was in any packet, and what raised `blocked_by_dialog`.
- Run 33: whether the listing's handle was in the packet, what `target_covered` meant inside the site's error state, and
  what "Saved for later (2 items)" held.

UI review (all t191's, named once each in the debugs): raw ids in the overlay (U1), "Build failed / Build failed" (U2),
"Add an AI model key: To do" during a build (U5), flicker and presence toggles (U7), no failure reason or next step (U8),
no robot-check notice (U9, run 29), dry runs shown as building (U10), "Worked for 50s-1m 25s" for 89-507 s loops (U12),
the cut-off detail line (U13, run 30), the Simple/Advanced toggle (defect 1), status cards above the chat (defect 2), and
the unlabelled "Page | Full | Small | Off" (defect 6). Also seen: "Building your Flow" over raw `not_found` pages (run 23),
and a second phase name, "Building the Flow" (run 32).

## Commands run and observed results

- `node scratchpad/w28-digest.cjs <run-id>` (per run): printed the failure code, accounting, loop counts and every step
  record. The accounting and failure codes above are quoted from it: 64, 51, 23, 64, 43 and 64 calls, and the costs above.
- `node scratchpad/w28-trace.cjs <run-id>`: the condensed build trace. It shows completion checks (12, 0, 10, 4, 2 and 5
  per run; run 23's iteration 38 was `ok=true`) and the dry runs.
- `node scratchpad/w28-ui.cjs <run-id>`: the per-moment page address, overlay status and overlay texts.
- `grep build-trace core.log | … awk` sums of `core.replay.*` durations: 315.4 s, 0, 33.5 s, 29.3 s, 96.2 s and 290.2 s.
- A step-record count: 66, 52, 24, 69, 47 and 65 records. Refused tool results: 7, 1, 2, 12, 3 and 9.
- `wc -l scenario-lab.log`: 2 lines in every run (a ready line and an exit line).
- The assembly check: each debug contains its Stage 1 file as an exact substring (`stage1 verbatim OK` x6), and each has
  all 10 template sections (`sections=10/10` x6).

## Not verified

- Draft step ids (`d3`, `d19`) are matched to iterations by draft revision number (revision n to n+1 creates dn). The
  pattern holds where both are visible, but it is not documented. The debugs say "inferred" where they rely on it.
- The launch commands are inferred from today's launcher less its later settings. The bundle does not hold the Session 2
  launch line.
- I opened 41 of the 102 UI moments' pictures. Overlay texts for the rest come from the UI-review JSON, not from pictures.
- Which press added which cart line is inferred from the timing of the screenshots.
- No repo check was run: this is documentation only, and the brief named none.

## Open questions or contradictions found

- The crossborder Stage 1 file was written "before the run (2026-09-30 ~19:05 UTC)", which is after run 29 (09:15 UTC).
  It was copied verbatim as instructed. Its P1 B note does not apply to run 29, which predates P1 B.
- Three findings have no owner in the lane's list:
  - A navigation reports `web.action.succeeded` on a `{"error":"not_found"}` page (run 23).
  - Save for later pressed on the wrong cart row, and the site's "could not save … Try again" never recovered (runs 30
    and 33).
  - Cart-table reads refused `column_not_in_detected_list` (run 30).

  The supervisor should route them.
- The lane's run table calls runs 30 and 33 "with F10, still no Flow". These debugs add that F10 visibly worked in both,
  and in 32: each retyped a shorter query after "No results". Their failures come later in the chain.
