# Debug: run-mwo3dp11-a47a032d

## Run

| | |
| --- | --- |
| Status | PARTIAL. Attempt 1 right, attempt 2 right but not deterministic, attempt 3 stopped by the user, attempt 4 never ran. |
| Campaign | 2026-11-19, lane B (`fxwork/t960`, instance `campaign-b`, lab slot-2) |
| Source | dev at extension b7a8a1843 and Core 76535e793, built 13:05 |
| Site and task | job-board, `job-board-remote-easy-apply` |
| Command | `pnpm lab attempt job-board --task job-board-remote-easy-apply --authoring-mode answer-first --live-llm --attempts 4 --llm-model claude-haiku-5-5 --llm-max-cost-usd 5` |
| Model and browser | Anthropic `claude-haiku-5-5`, visible Chrome side panel |
| Time | 13:58 to 14:48 local (21:58:30Z to 22:48:22Z), about 50 min |
| Cost | $0.7601 ($0.2799 + $0.0320 + $0.4482) against a $5 ceiling |
| Steps | `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-19/run-mwo3dp11-a47a032d/steps` (576 steps) |
| Bundle | `test-runs/instances/campaign-b/attempts/run-mwo3dp11-a47a032d/` |
| Stopped by | the user, by hand, after 34 minutes of looping in attempt 3. The aborted call is step 0574 (`llm.provider_aborted`). |

## Attempts

| Attempt | Path | Calls (interpretation / judge / decisions) | Cost | Time | Answer | Continuation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | explore | 90 (1 / 8 / 81) | $0.2799 | 1228 s | right, 7 rows stored and shown | n/a |
| 2 | run_flow_then_explore | 7 (0 / 3 / 4) | $0.0320 | 175 s | right, 7 rows | held (digest) |
| 3 | run_flow_then_explore | 133 (0 / 8 / 125) | $0.4482 | 1356 s | stopped_by_person (7 rows shown) | held (digest) |
| 4 | did not run | | | | | |

Flow: `flow.e43ef779-3b39-4b88-8fb4-20d0171c31f9`, saved as `partly_works` / `unproven`.

## What happened and why

### 1. Attempt 1: right, but at 81 decisions

- At 0167, Haiku tried to complete after reading 4 of the pages.
- The judge said "only pages 1 to 4 were read" (0168).
- The loop guard steered it twice (0171, 0174), and Haiku then paged on.
- Overhead was 97 live browser calls for a 6-step Flow (16.2x).

### 2. Attempt 2: the saved Flow's replay hit the site's rate limit and went live

- At step 5, a `dom-click` failed with `web.action.rate_limited` (0220).
- The next three retries each failed `web.target.not_found` (0221-0223), and the run stopped at step 5 (0224).
- The model then explored live and got the right 7 rows with 4 decisions.
- The rate-limit interruption was not handled as an interruption: no wait, dismiss or return to the Flow.

### 3. Attempt 3: a stray Next page after the paging loop

- The replay ran the paging loop through five pages (0247-0266).
- It then ran one more `dom-next_page` after the loop's exit merge (0267).
- That stopped it at step 52 with `executor.graph.unmatched_route` (0268).
- This is the same authoring defect as run-mwcncux8-d888f3a0 (2026-11-11): Next-page presses made by hand during exploration are saved after the loop.

### 4. Attempt 3 then looped for 34 minutes and never ended

Across the run, the judge refused the completion 14 times (`answer_first.judged_no` or `judged_unsure`; the lead counts 16 refusals including the `same_evidence` ones). From 0331 on, every refusal in attempt 3 says the rows do not show "Easily apply":
- 0380: "never applied the Easily apply condition";
- 0391: "the seven stored rows were not shown to offer Easily apply";
- 0510: "nothing shows Easily apply".

**Root cause.** The rows never carried the Easily apply evidence:
- The saved read declares the columns title, company and salary.
- Easily apply was a read condition, not a column.
- Core notes that the saved read drops columns it was written with (0214-0216, 0236-0238, 0575-0576: "drops columns ... link, posted").
- So the judge had no field to verify the condition from.

**The same evidence was judged both ways:**
- "Yes" in attempts 1 and 2 (0212/0213, 0234/0235).
- "Unknown" in attempt 3 (0380, 0391, 0457, 0481, 0510).

**The loop guard did not end the attempt:**
- `core.completion_check` escalated to `ask_person` at near-repeat x3 and kept escalating to x11 (0516-0572), 24 loop rows in all.
- Each `ask_person` sets `run.askPerson` and ends the round (`answer-first/attempt/round.ts`, `checked`).
- But a new round started each time and the attempt went on, until the user stopped it.

### 5. Per-call time

- 210 decision calls took 2012 s, a mean of 9.6 s each, with 396,452 output tokens in all (about 1,890 per call).
- The lead's reading: 85-90% of each call's time was hidden thinking.
- The Lab's speed section reports "thinking about 0.0 s" for every attempt. It cannot split thinking from output, so it currently understates where the time goes.

## Classification

- **FUNDAMENTAL: result formation and judge.**
  - A read condition that is not a declared column leaves the judge unable to verify it.
  - Verdicts on the same rows flip between yes and unknown across attempts.
- **FUNDAMENTAL: authoring.** A manual Next page is saved after the paging loop, which gives `executor.graph.unmatched_route` on replay.
- **FUNDAMENTAL: recovery.** A rate-limited click in a Flow replay is not handled as an interruption.
- **FUNDAMENTAL: loop detection.** `ask_person` escalations do not end or park the attempt. Repeated identical refusals ran on for 34 minutes until the user stopped it.
- **SIMPLE (not fixed yet): report wording.** `attempt-report.txt` says "Attempt 4 did not run: a person stopped the first attempt", but attempt 3 was the one stopped.
- **Observation: speed report.** Thinking is reported as 0.0 s while calls average 9.6 s.

## UI

The attempt 3 answer turn reads "Stopped" and shows the 7 rows (`attempt-3/answer-turn.json`). No other UI defect was seen.
