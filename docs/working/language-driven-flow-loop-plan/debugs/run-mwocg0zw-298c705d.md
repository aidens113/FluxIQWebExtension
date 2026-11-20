# Debug: run-mwocg0zw-298c705d

## Run

| | |
| --- | --- |
| Status | FAILURE: stopped by the campaign supervisor, attempt 1 unfinished. Cause: blocked by F8, a stall after the model-ladder climb. |
| Campaign | 2026-11-19 evening, lane A (t959, instance campaign-a) |
| Source | dev, extension f9a462369 and Core e3f869237 (t962 ladder and t963 judge), force-rebuilt after the power cut, plus lane A's uncommitted F2 Lab fix |
| Site and task | everything-store, `everything-store-plus-earbuds-under-50` |
| Command | `pnpm lab attempt ... --authoring-mode answer-first --live-llm --attempts 4 --llm-model claude-haiku-5-5 --llm-max-cost-usd 5` |
| Models | claude-haiku-5-5, climbed once to claude-sonnet-5-5 at step 0061 (02:17:27Z) (`completion_refused_again near_repeat`) |
| Steps | `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-19/run-mwocg0zw-298c705d/steps` |
| Spend | about $0.22 by the step log; Core's own total was not published because the run was stopped |
| Stopped | 02:27Z (stalled since 02:17Z) with `pnpm lab stop` |

## What happened

- **Before the climb (Haiku):** 27 decisions in all. The build refused `amend_draft` edits as `act_on_a_read` four times, and the loop guard steered on `same_fix` (0019, 0022, 0036).
- **First judge (0053, $0.0795):** "recordSets contains rows that fail the conditions". The answer was refused as `not_judged`.
- **Second judge (0056, $0.0780):** "The stored rows are unfiltered: they include rows failing the Plus, rating, price ..." (`judged_no`).
- **The climb:** Haiku amended the draft (0059), completed again, and was refused as the same completion. The ladder then climbed to Sonnet (0061).
- **After the climb:** nothing but page reads, 0064 to 0075, on a 7, 10, 20, 40 s backoff and then every 60 s.
- **Judge cost:** each judge call cost about $0.08 now that it reads the whole trail (t963) on a 380-element search page. Lane B's judge on job-board cost $0.006.

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

## Second finding in this run (F9): an act_on_a_read refusal loop

- **What Haiku did:** at 0013 its plan was "add the next-page loop to the draft and read the remaining pages". It
  amended with `{step: 4, change: "add", act: "a1"}`, attaching the next-page act to step 4, which is
  `dom-extract_list`.
- **What Core did:** it refused each time with `act_on_a_read` (0014 partly applied, then 0016, 0018 and 0035). Its
  feedback said to run the press as a new call with `add: true`.
- **Loop decisions:**
  - 0021: `ask_person` on same_fix x2. The attempt went on regardless.
  - 0038: `change_approach` on same_fix x3. The next amendment was refused as `already_in_flow` (0040).
- **Classification:** FUNDAMENTAL (the build's amendment vocabulary and guidance for loops around a read). Recorded,
  not fixed.
