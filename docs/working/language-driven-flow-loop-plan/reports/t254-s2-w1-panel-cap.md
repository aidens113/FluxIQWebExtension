# t254-s2-w1: panel command output cap removed

## Outcome
Done.

## What changed and why
- `R/llm/deepseek/panel-command.ts`: deleted `PANEL_COMMAND_MAX_OUTPUT_TOKENS` (600) and `max_tokens` from the request body. The constant had no other use (no hold or limits object), so no reserve was needed. The body's doc comment now says no output cap is sent (t254, user 2026-10-03). The panel's reply path never compared reply length against the figure, so nothing refuses a long reply.
- `R/llm/deepseek/tests/panel-command.test.ts`: the body test asserts `not.toHaveProperty("max_tokens")`. A new test checks that a reply with 5,000 completion tokens is returned and charged at `estimateAutomationStudioDeepSeekCostUsd(100, 5000, 0, default model)`.

## Commands run and observed results
- `npx vitest run src/programs/automation-studio/runtime/llm/deepseek` printed: 9 files passed, 105 tests passed.
- `npx tsc --noEmit -p .` exited 0 with no output.
- `grep -rn "max_tokens" --include=*.ts src | grep -v /tests/` found only comments: build-call-reserves.ts:6, purse.ts:22, panel-command.ts:101, refusal.ts:13, request-body.ts:39, response-envelope.ts:47, token-limits.ts:51 and provider-refusal/record.ts:97.

## Not verified
- No live DeepSeek call was made.

## Open questions or contradictions found
None.
