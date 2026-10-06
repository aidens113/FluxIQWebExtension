# t194-w87: full debug of run-mustvzvg-99695308

## Outcome

Done. The debug is `docs/working/language-driven-flow-loop-plan/debugs/run-mustvzvg-99695308.md`. Every template
field is filled, with `NO EVIDENCE:` where the artifacts cannot answer.

## What changed and why

- New file `debugs/run-mustvzvg-99695308.md`, which contains:
  - the header and an order of events;
  - Stage 1, copied from the lead's report;
  - Stage 2, one row per decision (0001-0083);
  - Stage 3, the kept draft;
  - Stage 4, both build tests node by node, with no playback;
  - Stage 5, which has no oracle answer, so the test rows are compared to the expected list;
  - Stage 6: the two judges, the round-1 repair context, and the ending with the purse;
  - a per-call cost table that sums to `live-llm.json`;
  - a UI review of all 10 moments (20 pictures viewed);
  - causes C1-C7 and U-A to U-F, with the Task id column empty;
  - instrumentation gaps.
- No source was edited. Nothing was re-run, staged or committed.

## Commands run and observed results

- I read every step folder (`meta.json`, `decision.json`, `call.json`, `result.json`), the snapshots, `core.log`,
  `evaluation.json`, `run.json`, `summary.json` and the UI-review JSON, using Python digests in my scratchpad.
- Sum of step `costUsd` = 0.053622012, which equals `runSpend.totalEstimatedCostUsd`. By part:
  - chat 0.000156972;
  - round 0: 16 calls, 0.032386656;
  - judges: 2 calls, 0.002310396;
  - round 1: 9 calls, 0.018767988.
- Code was read at:
  - Core `R/llm/evidence-loop/rerun-input.ts`, `rerun-request.ts:123,134`, `draft-amendment-feedback.ts:84,205-210`,
    `decision-handlers/amendment.ts:107-119`, `flow-bootstrap/unfinished-build/phases.ts:501`, `loop-budget.ts:151-169`.
  - Downstream `slot.ts` (HEAD via `git show`, and the tree), and `detect-pagination.ts:106`.
  - `git status`: none of the Core files I cite as causes is modified, except one test
    (`llm/evidence-loop/tests/rerun-request.test.ts`). Downstream `slot.ts`/`resolve-plan-node.ts` were modified
    after the run: `run.json` does not list them, and the new comment in `slot.ts` names this run.

## The lead's findings, checked

- "No Flow was created ($0.0536)": confirmed. The run total is $0.053622; the build's own accounting is $0.053465.
- "Round 0 wrote a read that kept 3 rows from 1 page; judges 0052/0053 said no": confirmed. Both said `no` at
  0.9. The three rows are the first three of the expected 13, so the filters were right on page 1.
- "0057 reran the read with maxPages placed directly under extractList; refused malformed_handle
  (malformed:extractList.maxPages)": confirmed (0060).
- "The refused attempt became step 8, and every later rerun of step 8 still sent extractList.maxPages: 10, because a
  rerun is a merge patch over the targeted step's input": confirmed. 0063, 0070 and 0073 `call.json` carry both
  `paginate.maxPages: 10` and `extractList.maxPages: 10`. The merge is at `rerun-request.ts:123`.
- "changes_nothing refusals followed": confirmed (0065, 0067, 0075, 0077). The fourth stalled the round
  (`repeat_without_progress`).
- "The round handed back the same Flow and the build ended not_finished (repeated_unchanged)": the code agrees
  (`phases.ts:501`) and so does the message. The ending kind is not written anywhere in the bundle (gap).
- "$0.046 left (flow-lane.json failure message)": **disagree on the source**. The failure message states no purse.
  $0.046535 is derived from the accounting (0.10 - 0.053465). The loop's own `core.budget` at 0076 said
  `costLeftUsd 0.0435`, which is lower because of the amount kept back for judging.
- Fixes exercised or not:
  - **w84**: agree, exercised (0014).
  - **w79**: exercised only in its general path, not the new handle-lift.
  - **w78** `rerun_needs_input`: agree, not exercised. Every rerun had `input`.
  - **w83**: exercised. The bubble appears at send, and no "Deciding the next step" alternation shows in any sample.
  - **w80**: words exercised (moments 7 and 9).
  - **w76**: partly exercised.
  - **R1/w72**: agree, not reached.

## Where I extend or differ

- The lead framed the repair as one merge defect. I find three more causes that came before it or made it worse:
  - **C1, round 0 never paged.** `paginate: true` silently means the detected pagination, which proposes one page
    (`PROPOSED_MAX_PAGES = 1`). The read's "raise it" sentence never named `paginate.maxPages`, and the grammar shown
    documents only `paginate?: false` or the object form. Round 0 completed on a one-page read. This, not round 1,
    is why the build needed a repair at all.
  - **C2, where the misplaced key came from (inference).** 0052's advice, "In s7's extractList: set paginate.next
    ... and raise maxPages", is the likely source of the misplaced key. 0053 gave the exact path
    `extractList.paginate.maxPages`, but only the first judge's reading reaches the resume.
  - **C4, the wrong refusal text.** The `changes_nothing` text for a rerun of a step that *failed* says "Step 8
    already ran ... its result stands as shown ... if it lists the rows", which is false: that step was refused
    and listed nothing (`draft-amendment-feedback.ts:205-210`). The model then resent 0064 and 0071 verbatim.
- The model could have removed the stray key with `maxPages: null`. The draft entry showed it (0064
  request.txt:1186, 1231-1233), and the rerun field's description says "null removes a key". So C3 is
  "Core never connects the refusal's key path to the merged-in key". It is not "the model was never shown it".

## Not verified

- I could not establish why test 2's cards are missing from the final panel picture. No picture was taken during
  test 2's cards.
- The resolved selectors of the kept read, and whether the popup clicks are optional branches: `flowShape` is null.
- That 0052's wording caused 0057's misplacement is an inference; the model's summary does not say.
- Whether unusable decisions are hidden in the chat (w80): no picture was taken at 20:15:28-30.

## Open questions or contradictions found

- `build.accounting.calls` says 25 while its cost includes the 2 judges (27 calls' worth).
- `decision-trace.json` is empty for a failed build (`adaptations: []`). `core.log` stops at round 1's last
  decision: no test-2 lines, no round end, no build end.
- The downstream tree now carries an uncommitted `slot.ts` change that lifts `maxPages` beside `paginate` into
  `paginate`, citing this run. It addresses C2's refusal but not C1 (the meaning of `paginate: true`) or C3 (the
  merge keeping a refused key).
