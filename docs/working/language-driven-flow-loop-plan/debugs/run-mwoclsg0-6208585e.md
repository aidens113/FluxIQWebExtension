# Debug: run-mwoclsg0-6208585e

## Run

| | |
| --- | --- |
| Status | FAILURE: stopped by the campaign supervisor, attempt 1 unfinished. Cause: blocked by F8, a stall after the model-ladder climb. |
| Campaign | 2026-11-19 evening, lane B (t960, instance campaign-b) |
| Source | dev, extension f9a462369 and Core e3f869237 (t962 ladder and t963 judge), force-rebuilt after the power cut |
| Site and task | job-board, `job-board-remote-easy-apply` (the direct test of t963) |
| Command | `pnpm lab attempt ... --authoring-mode answer-first --live-llm --attempts 4 --llm-model claude-haiku-5-5 --llm-max-cost-usd 5` |
| Models | claude-haiku-5-5, climbed once to claude-sonnet-5-5 at step 0099 (02:21Z) (`completion_refused_again near_repeat`) |
| Steps | `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-19/run-mwoclsg0-6208585e/steps` |
| Spend | about $0.07 by the step log; Core's own total was not published because the run was stopped |
| Stopped | 02:27Z (stalled since 02:21Z) with `pnpm lab stop` |

## What happened

- **Before the climb (Haiku):** 46 decisions in all. The loop guard steered on `same_fix` three times (0059, 0072, 0092).
- **First judge (0094, $0.0059):** "The result is incomplete and includes rows that do not meet the request".
- **The climb:** the next completion was refused as the same evidence, and the ladder climbed to Sonnet (0099). It climbed after a single repeat.
- **After the climb:** page reads only, on the same backoff as lane A's run.
- **What this run could not test:** t963's judge on this task, and the date-sort saving the lead asked to watch. Neither was reached.

## Root cause (F8)

After the climb, every decision failed in under 200 ms with `flow_bootstrap.provider_secret_unavailable` (core.log
in the attempt's work folder, `decide throw ... code=flow_bootstrap.provider_secret_unavailable`).

- **Key selection:** Core's `runtime/models/secrets/session-key.ts`, `isProviderLlmKey`, takes a key only when
  `key.metadata.model` equals the requested model. The Lab saves its Anthropic key with the run's model (Haiku), so
  the Sonnet request found no key.
- **The binding is deliberate:** `tests/anthropic-session-panel.test.ts` refuses a provider/model mismatch. So the
  t962 ladder and model-bound keys conflict.
- **The retry never stops:** the failure is marked `retryable: false`, yet the attempt retried every 60 s, re-reading
  the page each time. Those page reads kept writing steps, so the run looked alive while it made no progress.

Classified FUNDAMENTAL (key scope versus the model ladder), for the lead and user. Not fixed.

## UI

Not reviewed: the run was stopped mid-attempt.
