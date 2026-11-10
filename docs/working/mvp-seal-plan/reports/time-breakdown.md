# Where the time goes in a live attempt

Read-only analysis, 2026-11-10. Data: the per-step logs in `C:/Users/osrs_/FluxStuff/lab-runs/<date>/run-*/steps/NNNN-*/meta.json`
(start/finish time, provider, model, tokens, cache). Every step has exact timestamps, so this is measured, not estimated, except where marked INFERRED.
Sample: 44 live Claude runs from 2026-11-04 to 11-09 (28 Sonnet 5.5, 16 Haiku 5.5, 11 tasks, ids below). Time is measured over the span from the
first step start to the last step end ("attempt time"); Lab startup (24-60 s alone, up to 6 min when lanes queue) is outside it.

## 1. Split of an attempt (mean seconds)

| Part | Sonnet 5.5 (28 runs) | Haiku 5.5 (16 runs) |
|---|---|---|
| Attempt time | 230 | 264 |
| Model decisions (`evidence_tool_decision`) | 129 (56%) | 162 (61%) |
| Browser nodes (`core.run_node`) | 52 (23%) | 48 (18%) |
| Judge (`loop_verification`) | 17 (7%) | 23 (9%) |
| Chat interpretation call (`panel_command`) | 4 (2%) | 4 (1.5%) |
| Other tools (detect list, find, describe) | 1 | 2 |
| Not in any step log | 26 (11%) | 24 (9%) |

The "not in any log" part is: 10 s of gaps between steps (1,876 gaps, median about 0.2 s: Core is not the problem), and the unlogged flow replay
of attempt 2 (see section 2). No fixed `sleep` appears as its own step; waits live inside the browser node (below).

Per model call (all calls, runs 11-05 onward):

| Call | n | Seconds each | Input tokens | Output tokens | Cache hit | Seconds per 100 output tokens |
|---|---|---|---|---|---|---|
| Sonnet decide | 513 | 7.0 | 32.9k | 766 | 69% | 0.91 |
| Haiku decide | 284 | 9.1 | 33.8k | 1,837 | 76% | 0.50 |
| Sonnet judge | 53 | 9.2 | 8.3k | 1,094 | 16% | 0.84 |
| Haiku judge | 34 | 10.9 | 10.6k | 2,437 | 11% | 0.45 |
| Sonnet / Haiku chat | 39 / 23 | 2.9 / 3.0 | 3.1k | 236 / 485 | 0% (writes the cache each time) | |

**Finding A: model time is output time, and most output is hidden thinking.** I parsed the streamed responses (`steps/*/response.txt`).
The visible JSON answer is about 140 tokens; the rest is thinking blocks (signature of 2.6 KB Sonnet, 6.7 KB Haiku).
Implied thinking per decision: Sonnet about 570 of 715 output tokens (80%), Haiku about 1,700 of 1,837 (93%). At 0.9 s and 0.5 s per 100 tokens that is
about 5 s of a 6.4 s Sonnet decision and 8.5 s of a 9.1 s Haiku decision. This is why Haiku is slower than Sonnet per decision. Input size is not
the driver: 33k tokens with 70% read from cache; the uncached part is about 3.5k new tokens a step (page view about 7 KB).
The request sets no thinking or effort control: `!FluxIQ/packages/fluxiq/src/runtime/models/providers/anthropic/request-body.ts` (comment: "no sampling or
disabled-thinking fields: current models reject them"; only `max_tokens` and a JSON-schema `output_config`).

**Finding B: read-only decisions cost a whole model call for a result that takes under half a second.** In 798 decisions: `describe_nodes` 57
(5.8 s each), `detect_repeating_structure` 66 (5.5 s), `find_on_page` 30 (6.4 s), `describe_element` 18 (5.9 s): 171 decisions, 991 s, about 22 s per attempt.
The tools themselves took 6 ms (describe_nodes) to 253 ms (detect list). Also 96 `complete` decisions (8.8 s) each followed by a judge (9 s).

## 2. Browser nodes and replay: why about 3 s a step

For every `core.run_node` (n=426 with timing, runs 11-04 on), the extension's own result carries `read.startedAt/finishedAt`. Time inside the page versus the rest:

| Node | Step ms (mean) | Inside the page | Outside the page |
|---|---|---|---|
| dom-click (221) | 3,059 | 438 | 2,621 |
| browser-navigate (79) | 3,746 | 1,173 | 2,572 |
| dom-extract_list (71) | 4,458 | 1,718 | 2,740 |
| dom-type (26) | 3,627 | 1,286 | 2,342 |
| dom-select (9) | 2,490 | 85 | 2,404 |
| capture_snapshot alone (60) | 753 (median 587) | | |

So a click is 0.44 s of work and about 2.6 s of constant overhead, the same for every node type. Not a clock I could read directly; what the code does around each
acting node (INFERRED split, about 1 s + 1.2 s + 0.4 s, needs timing spans to confirm):
1. `domain/src/runtime/llm-evidence/node-run/run.ts` line 265: a full page capture before the act (`currentPage`), and line 473 / `captureAfterAction` after it: two
   snapshots at about 0.6 s each (a lone snapshot node costs 0.59 s median), each sanitized and diffed in Core.
2. `apps/extension/src/runtime/action-runner.ts:142` then `automation-tab.ts:298 waitForTabReady`: a poll every 250 ms that finishes only when the URL has been stable for 1,000 ms.
   A shortcut exists (`consumeSnapshotReadiness`, one proof per snapshot, valid 10 s), but the act consumes the proof of the before-look, and the after-look finds none.
   So each acting node most likely pays a 1.0 s stable-URL clock even when nothing navigated.
3. `press-effect/settled.ts` `EFFECT_WAIT` 1.5 s polled every 250 ms with a full snapshot each, but only when a press changed nothing; the content-side click windows
   (`apps/extension/src/content/actions/click.ts` 500/800/1,500 ms) end on the page's first sign, so they are paid only by a silent press.
   List reads add quiet-period clocks in-page (900 ms growth windows, `content/extraction/list-wait.ts`, `page-render.ts`): that is the 1.7 s inside an extract.

**Replay of a saved Flow (about 5 steps).** Pure replays, 11-05: run-mw4hd8qc-2e33f505 (24 s), run-mw4ffp8c-29ff62e8 (26 s), run-mw4bxkn9-004e2667 (33 s).
Split of mw4hd8qc: chat interpretation 2.6 s, flow execution 14.6 s (not logged per step, about 2.9 s a node, matching the explore overhead above), judge 7.2 s.
So about 45% of a replay is two model calls that never touch the browser, and the "7 s per step" figure is total over 5 steps; the browser part is about 3 s a step,
all of it the per-node overhead, not the action. mwa05th9 (company-website) took 45.7 s of replay execution, the slowest seen.

## 3. Top time sinks, minutes per attempt (mean over the 44 runs, about 3.9 min)

| Rank | Sink | Min per attempt | Where |
|---|---|---|---|
| 1 | Hidden thinking on routine decisions | about 1.7 (Sonnet 5.5 s x 17 calls) to 2.3 (Haiku) | `anthropic/request-body.ts` |
| 2 | Per-node overhead outside the action (2 captures, 1 s tab-ready clock, diff) | about 0.7 (2.6 s x 16 nodes) | `node-run/run.ts:265,473`; `automation-tab.ts:298`; `action-runner.ts:142` |
| 3 | One model call per read-only tool | 0.37 | decision loop, `runtime/llm/node-tools/` |
| 4 | Judge after `complete` (writes a 1.1-2.4k-token diagnosis, thinking included) | 0.3 | `framework/automation-service/service.ts:2485` `verifyRunResult`, `runtime/llm/harness/run.ts` |
| 5 | In-page quiet clocks (list growth 900 ms, render settle) | about 0.15 | `content/extraction/*` |
| 6 | Chat interpretation call | 0.07 | `runtime/llm/anthropic/panel-command.ts` |

The long tasks are the same sinks times a step count: crossborder-free-hubs run-mwa19obz-abd5d558: 963 s, 54 calls, 45 decisions, 7 judge calls;
dining tables run-mw37vz9n-a77a02c2: 800 s, 55 calls (599 s deciding). Step count is the multiplier; fixing per-step cost comes first and is general.

## 4. Root-cause cuts, ranked by minutes saved (none is a cap, shorter timeout or fewer retries)

Per-step cost today is about 7 s decision + 3 s node = 10 s, so 3 minutes is only about 16 steps. These cut the cost of a step, not the number of tries.

| # | Cut | Saves per attempt | Risk |
|---|---|---|---|
| 1 | Stop paying for thinking the decision does not need. Set the request's effort/thinking control per decision: low for a step whose evidence shows a clear next act (page answered, `loopVerdict` clean), full after a failure, a no-effect press or a loop catch. Confirm the control is accepted by `claude-sonnet-5-5` / `claude-haiku-5-5` (INFERRED, not tested here). Expected decision 6.4 s to about 3 s (Sonnet), 9.1 s to about 3.5 s (Haiku). | 1.0 min Sonnet, 1.7 min Haiku | Medium: quality on hard steps; keep full effort on repair and judged paths, and run the ten-scenario Lab to compare |
| 2 | Read-only tools stop costing a decision: allow several calls in one decision (batch the look, detect, describe), and let Core attach list detection and node definitions to the first result when it already knows them (Core already describes a node on first run, so `describe_nodes` is pure waste). | 0.35 min | Low |
| 3 | Replace the 1 s URL-stable clock with an event: the same document id and no navigation event since the act means ready (the proof logic in `consumeSnapshotReadiness` already reads `documentId`); wait only when a navigation actually started. Make the proof survive the act so the after-look uses it. | 0.25 min explore, 5 s per replay | Low-medium: must still catch pages between documents (`captureAfterAction` loop remains as the net) |
| 4 | One snapshot per step, not two: the after-look of step N is the before-look of step N+1 when the content script reports no mutation or navigation since (cheap counter), so `currentPage` can reuse it. | 0.15 min (0.6 s x 16) | Medium: stale look must never reach an act; invalidate on any page event |
| 5 | Judge writes a verdict, not an essay: ask for pass/fail plus evidence references and explain only on failure (fewer output tokens, at 0.45-0.9 s per 100). Where the result check is deterministic (rows stored equal rows shown, nothing missing; the Lab's "answer" gate already computes it), run the judge only on disagreement. Start it speculatively as soon as the last read lands, discard if the model adds steps. | 0.25 min explore, 0.12 min per replay | Low (speculation) to medium (skipping) |
| 6 | Replay: skip the chat interpretation call when the request text equals the saved task's (the Flow is already bound), and drop the before-snapshot unless a target must be re-found. | 3 s + 0.5 s a step | Low |
| 7 | Replace polling-with-full-snapshot (`settled.ts` 250 ms) with the page's own signal (the content script's watchers already know when it went quiet). | only on silent presses | Low |

Cuts 1+2+3+4+5 together: a step goes from about 10 s to about 4.5 s, a mean attempt from about 3.9 min to about 1.8 min, with the same step count.

## 5. What it takes for each task's first attempt to be under 3 minutes

First-attempt span (mean over the runs sampled) and step counts; after the cuts a step costs about 4.5 s (3.5 s decision + 1.1 s node), plus about 10 s fixed (chat, judge).
Budget: about 40 steps of that size fit in 3 minutes.

| Task (runs) | Now, mean s | Decisions / nodes | Verdict |
|---|---|---|---|
| auction-marketplace-lens-hood (7) | 93 | 9 / 7 | Already under 3 min |
| professional-network-accept-invitations (1) | 126 | 9 / 10 | Under; it failed for another reason |
| bigbox-retail-napkins (3) | 149 | 13 / 11 | Under after cuts 1-5 (about 1 min) |
| everything-store-batteries (8) | 166 | 14 / 10 | Under after cuts 1-5 |
| company-website-apprentices (10) | 174 | 12 / 15 | Under; Haiku runs 183-257 s need cut 1 |
| job-board-save-quillmark (6) | 314 | 26 / 17 | About 2.2 min after cuts; run-mw4b7kav-cbff03e1 (647 s, 54 calls) is a loop, not cost |
| photo-social-kiln-notes (2) | 337 | 34 / 25 | About 2.9 min: borderline, needs fewer steps (below) |
| local-classifieds-nearby-furniture (2) | 416 | 27 / 23 | About 2.3 min after cuts |
| social-network-feed-recent-group-posts (1) | 475 | 14 / 13 | 80 s judge and 115 s of nodes: needs cuts 3-5 and a look at its extract steps |
| local-classifieds-save-dining-tables (3) | 513 | 40 / 29 | About 3.3 min: needs 10-15 fewer steps |
| crossborder-marketplace-free-hubs (1) | 963 | 45 / 52 | About 5 min: needs half the steps, 7 judge calls is the root problem |

The fewer-steps work is again root cause, not a cap: why a build takes 30-50 steps. Evidence in the logs: `amend_draft` decisions (about 10-20 s each; 87 in total)
write the Flow one amendment at a time (cut: let one decision write a whole loop/step group), and repeated judge calls on the long tasks (7 in
run-mwa19obz-abd5d558) mean the model finishes, is told no, and goes on: judge feedback should name the missing part so one more pass finishes it.

## Not verified / caveats

- The 2.6 s per-node overhead is measured (step time minus the extension's own start/finish); its split into captures, the 1 s clock and transport is INFERRED from code.
  Next step: add timing spans (dispatch sent, content start, content end, after-look start/end, sanitize) to `meta.json`; it is a one-hour change and settles cuts 3 and 4.
- Thinking share is computed from streamed text length versus billed output tokens (3.3 chars per token); the thinking text itself is withheld by the API.
- Whether the effort control is accepted by these model ids, and the quality effect, were not tested (no paid calls made).
- Replay execution time is read from gaps between logged steps; per-step replay timing is not logged, so the 2.9 s a node is an average over 5 steps in three runs.
- The sample is mostly 11-05 runs from four concurrent lanes; the 25-50 s gaps in some runs (e.g. mwa0t77i-114 s, mw4glu5c-188 s) are not explained by any step log. I did not attribute them to machine load.
- Runs used: lab-runs 2026-11-04/05/09 (run-mw37qofs through run-mwa19obz); earlier Oct runs used DeepSeek and were excluded.
