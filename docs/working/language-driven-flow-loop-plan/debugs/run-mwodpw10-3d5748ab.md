# Debug: run-mwodpw10-3d5748ab

## Run

| | |
| --- | --- |
| Status | Lab `passed`; campaign verdict **PARTIAL**. All four answers right (13 rows) and all continuations held. Attempt 2 was not deterministic: 4 decisions and 3 judge calls. |
| Campaign | 2026-11-19 evening, lane A (`fxwork/t959`, instance `campaign-a`) |
| Source | dev, extension f9a462369 and Core db17d59c5 (t962 ladder, t963 judge, t964 key fix), plus lane A's F2 Lab fix |
| Site and task | everything-store, `everything-store-plus-earbuds-under-50` (multi-page filtered scrape) |
| Command | `pnpm lab attempt everything-store --task everything-store-plus-earbuds-under-50 --authoring-mode answer-first --live-llm --attempts 4 --llm-model claude-haiku-5-5 --llm-max-cost-usd 5` |
| Time | 18:47 to 19:00 local (about 13 min; attempts took 197 s, 72 s, 36 s and 40 s) |
| Cost | $4.70 ($3.2780 + $1.4233 + 0 + 0), nearly the whole $5 Flow purse |
| Steps | `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-19/run-mwodpw10-3d5748ab/steps` |
| Bundle | `test-runs/instances/campaign-a/attempts/run-mwodpw10-3d5748ab/` |

## Attempts

| Attempt | Path | Calls (interpretation / judge / decisions) | Cost | Ended | Answer | Continuation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | explore | 34 (1 / 3 / 30) | $3.2780 | achieved | right, 13 rows | n/a |
| 2 | run_flow_then_explore | 7 (0 / 3 / 4) | $1.4233 | budget_out | right | held |
| 3 | run_flow | 0 | $0 | budget_out | right | held |
| 4 | run_flow | 0 | $0 | budget_out | right | held |

Flow: `flow.8f13389e-1317-4840-a20c-bac6e5f38e08`.

## Model climbs (t962) and loop decisions

| Step | Climb | Trigger |
| --- | --- | --- |
| 0032 | Haiku to Sonnet | `loop_persisted exact_repeat`, after the repeat guard refused the same failed call three times (0022-0030) |
| 0073 | Sonnet to Opus | `completion_refused_again near_repeat`, after the judge's no at 0062 ("stored rows contain accessories") |
| 0130 (attempt 2) | Haiku to Sonnet | `repair_failed` |

- The model made no explicit `core.loop_decision` in this run.
- The key fix t964 held: no `provider_secret_unavailable` anywhere (F8's first half is closed).

## What went wrong

### 1. The judge rode the climbed model on the whole trail, and the cost emptied the purse (F11)

| Step | Model | Input tokens | Cost |
| --- | --- | --- | --- |
| 0062 | Sonnet | 160k | $0.34 |
| 0091 | Opus | 211k | $0.87 |
| 0092 | Opus | 211k | $0.87 |

- Most of attempt 1's $3.28 is these judges plus Opus decisions.
- Attempt 2 reached $4.70 in total and ended `budget_out`.

### 2. Raw page captures overflowed the judge's request (F10, corrected)

- Attempt 2's judge request was 3.39 MB (0117), against 538 KB for attempt 1's (0091).
- It held only attempt 2's own 23 saved-Flow steps. Three of them each carried the domain's raw page capture, about
  1 MB each, in `found.outputs`.
- Core's size estimate (UTF-8 bytes / 3) undercounts dense JSON, so window fitting stopped too early.
- Anthropic refused the request with HTTP 400 (`llm.provider_http_error`, not retryable) at 0117, 0124 and 0127. Each
  refusal gave `answer_first.not_judged` (0125, 0128).
- This is the lead's diagnosis. My first reading ("the trail grows across attempts") was wrong.

### 3. Attempts 3 and 4 got the right answer with zero calls, but are labelled `budget_out` (F12)

- Each replay was flagged "judged, because it deviated from the accepted run: flow_not_proven" (0154, 0178).
- No judge could run because the purse was empty, so the attempt ended `budget_out`.
- The Lab's oracle found the answer right.
- So an attempt that delivered the person's result reads as out of budget, and the replay was never proven.

### 4. Why attempt 2's replay deviated at all

Not traced further: the judge evidence for it is the 3.39 MB request that the provider refused.

## Classification

| Finding | Class | Note |
| --- | --- | --- |
| F10 | FUNDAMENTAL (judge) | Fix in progress (t965): raw captures leave the trail, a conservative or provider token count, fit and resend on a size refusal. |
| F11 | FUNDAMENTAL (judge and cost) | The lead's fix is in progress: the judge stays on the base model. |
| F12 | FUNDAMENTAL (ending formation) | Recorded for review. |

## UI

The answer turns were drawn for every attempt (13 rows shown). No UI defect was seen in the run log.
