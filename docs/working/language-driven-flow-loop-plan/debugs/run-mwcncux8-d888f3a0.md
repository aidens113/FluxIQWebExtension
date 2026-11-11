# Debug: run-mwcncux8-d888f3a0

Status: Failed only on determinism. All 4 answers were right, and continuations held from 1 to 2 and 2 to 3. 3 to 4 was refused (`second_found_something_else`). **Every replay needed a repair**: the first stopped on a stray Next page saved after the paging loop; the second ran a Flow whose repair had dropped the paging. Neither cause is humanness.
Source: lane t898 (W2 Humanness) at checked point 10, with dev merged in: Extension 55c42d5dd and Core fe3bb5956, plus the uncommitted round-10 edits (the extension settings type fix; Core's reviewer and paired-run narrowing). Core libraries rebuilt and the extension check passed (both exit 0) before launch. It includes the control-node arrival fix, so Core's control nodes no longer pause.
Task: company-website-apprentices, unchanged, `--attempts 4`, `--humanness 100` (rerun of run-mwcess01-e0124be6 after the control-node fix; the level-0 baseline is run-mwcdkd7h-832d9262), visible browser.
Provider: Anthropic claude-haiku-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 5`, normal guards, no overrides. Launched through the heavy-slot queue with `--priority` and watched to the end by the W2 supervisor.

## Result and distance reached

| attempt | path | calls | usd | wall | live steps | answer |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | explore | 19 (interpretation 1, judge 2, decisions 16) | 0.0366 | 182 s | 13 | right, 4 rows |
| 2 | run_flow_then_repair | 8 (judge 2, decisions 6) | 0.0208 | 144 s | 15 | right |
| 3 | run_flow_then_repair | 15 (judge 2, decisions 13) | 0.0315 | 167 s | 18 | right |
| 4 | run_flow_then_repair | 16 (judge 3, decisions 13) | 0.0326 | 175 s | 14 | right; continuation not proven |

- One Flow id (flow.37a22f94-b51d-44d3-a8f9-7095d502a29e). The total spend is $0.1215, against a $5 ceiling.
- No flow step failed in any attempt. No misclick happened. The level is recorded on every replayed click (0038, 0075, 0109: `{"level": 100, "aimed": true}`).
- Steps: `C:\Users\osrs_\FluxStuff\lab-runs\2026-11-11\run-mwcncux8-d888f3a0\steps`.

## Does the first replay still need a repair at level 100? Yes, and why

- **The first replay (steps 0037-0057) ran its page steps cleanly:**
  - navigate, then the "Our team" click;
  - the paging loop: read, then Next page, four times (0041-0054);
  - the loop's exit merge (0055);
  - a second Next page (0056, node s8). It succeeded, and the run then stopped with `executor.graph.unmatched_route` (note 0057: "stopped at step 10").
- **How that Next page got into the Flow:**
  - attempt 1 authored the loop early (0015: add Next page as step 7, repeat the read at step 6 while 7);
  - it then kept paging by hand (0022 `next.team.2`, 0026 `next.team.3`) and re-read the list (0020, 0024, 0028, 0033);
  - those manual calls were saved after the loop.
  - In the replay, the loop had already reached the end of the list, so the extra Next page had nowhere to go, and its outcome matched no route.
  - The repair model said it in its own words (0059): "Drop the stray Next page and final read steps that double-advance the list, since the loop at steps 6-7 already pages".
- **Why later attempts kept repairing:** the same repair then also dropped the loop itself (0061: "drop the unfiltered read and paging, since the page says That is everyone"). It judged from the page as the replay had left it, fully expanded. So attempt 3's replay read one page, 8 of 26 people (judge 0078: "Only one apprentice was read"), and had to page live again. Attempt 2 also hit the known filter loss again: the judge at 0067 found 28 rows kept, not 4.
- **Humanness is excluded as the cause:**
  - every replayed page step succeeded;
  - no misclick fired;
  - the stop is a graph-routing stop after a successful step;
  - the stray step and the dropped loop are authoring and repair decisions, not page events.
  - The level-0 baseline (run-mwcdkd7h) replayed its Flow with no repair. The previous level-100 run (run-mwcess01) needed a repair for a different authoring cause, filter loss. So the authored shape varies between explorations, and this run's shape came from the model paging by hand. At level 100, humanness changes only timing and click points, not what the page shows. I did not compare the baseline's exploration step by step.
- **For E1 / t905 (authoring and repair), three defects:**
  1. Exploration's manual Next page calls and reads are saved after a loop that already pages the same list, which duplicates the advance.
  2. A Next page that finds no next page, with no route for that outcome, stops the run (`unmatched_route`) instead of ending the list. Under "a task ends only with its result or its budget", reaching the end of a list is not a failure.
  3. A repair can drop a paging loop because the page, as the previous run left it, already shows everyone. It should judge from the page state at the start of the replay.

## Where the time went

- Replays took 144-175 s, against 129 s for attempt 2 of run-mwcess01, because each replay was followed by a live repair. The level-0 clean replays took 23-30 s.
- The designed pauses before page steps: navigate 2.1 s (0037 arrival), click 0.4 s (0038), Next page 0.6-3.5 s (0042, 0054, 0056), reads under 0.1 s. Core's control nodes paused 0-1 ms (0039, 0055), confirming the control-node fix live.
- This run cannot measure the added time of a clean replay at level 100, because no replay ran clean. That needs the authoring defects above fixed first.

## A W2 coverage gap found (not a cause here)

- Next page presses carry no humanness: no aimed point and no record (`content/extraction/page-advance/step-page.ts` presses through `pressLoadMore` and the numbered and next ways, outside `action-runtime/humanness`).
- The provider-free run run-mwckoxsx-f273a2ff shows the same: only clicks and scrolls carry the record.
- At level 100, a "Show more" or "Next" press is the level-0 centre press. That is safe, but less human than the brief asks for click points.
- Proposed W2 follow-up: route the page-advance press through `aimPress` and record it like a click, with the same safety lines (jittered points inside the visible box, re-hit-tested, no misclick on a control).

## Next

- Route the three authoring and repair defects to E1 / t905.
- Run another level-100 live rerun only after they land; otherwise it measures repair time, not humanness.
- The Next page humanness follow-up is for the lead to schedule.
