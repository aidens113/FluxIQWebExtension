# Debug: run-mw9xfwvd-ccc692b2

Status: Failed as a pair (not judged). Attempt 1 right, and **the native judge schema on dev returned a full Haiku reply** (the check this run existed for). Attempt 2 never started as an attempt: Haiku's chat chose `run.execute` on the saved Flow, and that run failed at once with "Top-level orchestration Flow has no Router-selected Subflow execution path". The Lab waited 600 s and stopped with `AttemptProofStuck`.
Source: t885 (`task/t885-live-checks-r3`), both trees at dev after integration round 2 (Extension 843bb9aa3, Core 9de4def11), unchanged.
Task: company-website-apprentices, unchanged, `--attempts 2`, visible browser.
Provider: Anthropic claude-haiku-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 5`, normal guards, no overrides. Instance t885-live, slot-1.

## Result and distance reached

- **Attempt 1, right:** `achieved`, 4 rows stored and shown, $0.03, 3 m 21 s (36 steps). It explored, amended the draft, ran the Flow (0022-0028 replayed), amended again and completed.
- **Native judge on dev (still-open item 2):** dev now sends judges their real schema. Integration round 2 carried lane A's 05ff53e2a (`isOpenOptionalObject` is in Core `runtime/models/providers/anthropic/schema.ts`). Judge 0035's request carries `output_config.format.type: json_schema` with the judge's own schema, and Haiku's reply (2,244 output tokens) holds every field: expected, observed, changed, stillAchievable, deterministicRecoveryPossible, answersRequest yes, defects [], four `checked` rows, `answerRecords {asked: true, siteShows: 4}`, confidence 0.9, summary. No placeholder, no empty field.
- **Attempt 2:** the same words typed again. The chat call (0036, Haiku, $0.0007) answered `{"do":"run.execute","with":{"flowId":"flow.43f5c703-..."}}`. The panel showed "Running ... now", then "Run failed. The run failed: Top-level orchestration Flow has no Router-selected Subflow execution path. This run did not keep a change for future runs." No attempt record exists, so the Lab saw "no attempt yet" for 600 s.
- Whole run: $0.0294 (ledger), exit 1.

## Causes

1. **The chat routes the same words to Run on a weak model.** The chat's system text (Core `runtime/conversations/instructions/prompt.ts`) says a job "that no Flow above already does" is `flow.createHere`, and lists the task's own Flow under "The Flows in this project". `flow.createHere`'s description says the same words again start it as usual, but the routing sentence reads, to Haiku, as "a Flow already does it, so run it". Sonnet chose `flow.createHere` on the same text (run-mw9x529c-557f5402).
2. **Run on an answer-first task's Flow fails outright.** `run.execute` on the Flow attempt 1 saved ends in the orchestration error above (Core `framework/automation-service/service.ts`), and ends the person's request with "Run failed", which the hard rule forbids (a task ends only with its result or its budget).

## Next

Trace and fix both in Core through a worker (cause 2 is the structural one: whichever capability the chat picks for a task's Flow, the person must get the result), prove provider-free, then rerun this Haiku pair.
