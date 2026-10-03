# t194-w67: full debug of run-murwcmx2-a1c6edf7

## Outcome

Done. `debugs/run-murwcmx2-a1c6edf7.md` is written from the run bundle with every template field filled.

## What changed and why

- Created `docs/working/language-driven-flow-loop-plan/debugs/run-murwcmx2-a1c6edf7.md`. It is copied from the
  template, follows "The Full Debug Protocol", and uses `debugs/run-muqk713g-d08ad3dc.md` as the model for layout.
  Sections: event order; Header (the command now comes from `run.json` invocation, with token limits kept as
  `[screened]`); Stage 1 (copied from the lead's report); Stage 2 (one row per model turn and tool result, 0001-0071,
  with phases marked); Stage 3 (the 7 authored nodes with real parameters from `authoredNodes`, the 0055 held seed
  and the playback calls); Stage 4 (playback 0072-0076 and both build tests); Stage 5 (13 expected rows, field by
  field); Stage 6 (judges, build repair, re-author turn by turn, cost per call, UI review of the seven screenshots);
  Causes; Instrumentation gaps.
- No other file was touched.

## Commands run and observed results

All were read-only, run on the bundle:
- Summary of every step folder (meta, decision, call, result) in a scratch script: 34 cost-bearing steps summing to
  $0.097482696, which matches the brief.
- `flow-lane.json`: authoredNodes, actions (playback timings, s4 retry), extraction (10/13, 7 in place, 40/40
  fields), harnessRecovery.
- `decision-trace.json`: re-author evidence loop, 16 steps, ending `not_doable` `noRoute: no_progress`,
  `tested: not_tested`.
- `extraction-mismatches.json`: positions 7-12.
- `logs/core.log`: build-trace from 04:36:59 to 04:41:13.849, with no ending line.
- greps of the request.txt files: 0035 has the `unknown` verdict and 0 alone rows; 0025 has the C1 note at :1870
  and the three pairs at :1445-1459; 0058 has `rerunPlace` at :858-861; 0065 has `stopped: unusable_decisions` and
  `test: not_tested`.
- Judge field lengths: 0033 `changed` is 581 characters. Core tree: `AUTOMATION_STUDIO_LLM_DIAGNOSIS_TEXT_MAX_LENGTH = 500`
  (`runtime/llm/harness/structured-response.ts:99`); `phases.ts:399-401`.
- Viewed screenshots 00002, 00003, 00008, 00012, 00016, 00020 and 00023.

## Not verified

- The re-author's amendment (name not contains ["ear tips","eartips","replacement","charging case replacement","for
  wireless earbuds"]) would have returned 13 of 13 from page 1. This is an inference from the row names and was not
  run.
- Code paths cited for C-A, C-B, C-C and C-D come from the lead's report and were spot-checked only: the length
  constant and `phases.ts:399-401`. The file named for C-G is approximate.
- Screenshots other than the seven named in the brief were not viewed.

## Open questions or contradictions found

Disagreements with the lead:
1. **The re-author's ending.** The lead says the unusable-decision guard ended it. Round 0 did stop on
   `unusable_decisions` (0065 resume). But the attempt as a whole ended `not_doable` with `noRoute: no_progress`
   after a second round, which `phases.ts:401` decided. `phases.ts:399` (`repeated_unchanged`) did not fire because
   the draft had changed.
2. **"Sent the same rerun six more times (refused)".** Six were refused, but the identical rerun was sent nine
   times in all, and three of those ran (0057, 0059, 0068). I recorded this as C-G.
3. **"Judged no four times out of five".** When the build finished, the build-test judges stood at 2 `no` (one
   refused) against 1 `yes`. The figure four in five includes the two runtime `no`s that came later.
4. **The code for C-A.** The code observed in the repair resume is `core.result.verdict_unavailable`. The lead's
   wording, `model_unavailable` read as `model_unconfirmed`, does not appear in the bundle.
5. **The ad condition in 0033.** Judge 0033 also called the ad condition over-broad. That is wrong: its alone rows
   carry `data-ad-id` and are not expected records.
6. **Causes the lead missed:**
   - **C-E.** The explorer kept the charging-case rule despite the 1002L C1 note at 0025, and again at 0044. At 0044
     the alone rows came through `core.run_flow` `readRows` with no note. Mitigated by w63 and w66.
   - **C-F.** A re-author round that ended with a changed draft was never tested from the Flow's start. That draft
     held the advised fix (the seed in 0064), and the resume falsely said it had been tested.
   - **UI-3.** "Join paths" merge cards appear in the run and are counted in "Step 7 of 7" (00020).
   - **UI-4.** The run announces "Testing the Flow so far" and then says "Run failed" without running a test (00023).
     The overlay and the panel show different statuses (00008, 00012), and there is no overlay at 00002 or 00003.
     The lead wrote "overlay present throughout", but 00003 has none.

   None of these has a task id; they are written in the Causes table as `-` (proposed).
7. **Confirmed as the lead stated.** C-A (581 > 500), C-B (0035 verdict `unknown`, no advice, no alone rows), C-C
   (a lone `yes` stands; `complete` was accepted on an unchanged Flow), C-D (reruns ran in place on page 5),
   UI-1 (00012) and UI-2 (00016).
