# Claude Live Provider Plan

Status: Complete
Status detail: Claude runtime, keys/settings and $5 live-test defaults validated and integrated in both repositories.
Created: 2026-10-30
Last updated: 2026-10-30
Owner: Senior supervisor agent
Scope: Use CLAUDE_API_KEY for all live tests; implement real Claude provider, encrypted-key routing and model selection in Core, and provider-aware credential/default/accounting paths in the Lab.
Paired document: ../!FluxIQ/docs/working/claude-live-provider-plan.md
Related: [Framework continuation](framework-heavy-lifting-plan.md)

## Current State

The user requested Claude for every live model-backed test and explicitly asked that preference be recorded.
Both repositories' AGENTS.md now hold it. Never silently fall back to DeepSeek. Provider-free tests remain provider-free.
CLAUDE_API_KEY is present in the main downstream .env.local; its value was not printed, copied or committed.
Anthropic originally appeared in the keys UI without runtime support. Core now implements the native provider, per-call encrypted-key resolution and matching model/settings controls; the Lab migration passed its owning checks.
Paired task t816 is integrated: downstream fa99782d and Core61d29c1f, with Core library version0.9.0. No paid model call has run.
Live default: claude-sonnet-5-5, provider anthropic, selected for agentic task quality and speed; explicit model selection remains available.
The user raised Claude live tests to $5 per build on 2026-10-30. Main ignored `.env.local` now configures that ceiling;
the Lab's Claude default and declared budget also use $5, while explicit lower limits and normal product defaults remain.
Keep identical realistic task instructions/oracles and record model, verdict, calls, provider-reported usage/cost and runtime.
No paid run is started by implementation or unit validation; existing supervised paid-launch requirements remain.

## Implementation

1. Core: Anthropic Messages adapter behind existing provider contract; native schema output with local validation,
   abort/time/response limits, refusal/truncation/balance handling and usage-aware billing. Preserve opaque session keys.
2. Core: provider-aware models/settings and per-call unlocked key resolution; expose Anthropic (Claude) in keys/model UI.
   Existing DeepSeek keys and explicit configurations remain functional; an unavailable Claude key never selects DeepSeek.
3. Lab: provider-aware model/profile validation, CLAUDE_API_KEY credential resolution, key setup, default routing,
   child-process secret stripping, reporting and demo/live entry points. No provider HTTP implementation downstream.
4. Verify fake-HTTP provider requests/errors/accounting and UI/key/session roundtrips; changed owning Lab tests,
   affected package types, structure/model-text/docs checks. Lead independently verifies worker claims after integrating dev.
5. Commit and integrate both branches through pnpm task, push both dev branches together. Qualify a supervised Claude
   live run on an allowed realistic site when the launch is authorised; do not claim unit checks establish live quality.

## Verified Provider References

Official sources checked 2026-10-30: https://platform.claude.com/docs/en/models/overview,
https://platform.claude.com/docs/en/api/messages/create,
https://platform.claude.com/docs/en/build-with-claude/structured-outputs and
https://platform.claude.com/docs/en/about-claude/pricing.
Sonnet 5.5 uses id claude-sonnet-5-5, 1M context and 128K output; listed input/output rates are $2/$10 per million tokens.
Messages schema output uses output_config.format; refusals and truncation require explicit handling despite structured output.

## Work Ledger

### 2026-10-30 - Initial investigation and provider switch
- Agent: lead
- Finding: key variable present; UI lists Anthropic; runtime and Lab are DeepSeek-only.
- Validation: `node -e` credential-presence probe -> `CLAUDE_API_KEY: present`; no value emitted.
- Not verified: any Claude request, product key roundtrip or live task.

### 2026-10-30 - Lab routing and credential migration in progress
- Agent: lead
- Changed: provider-aware model defaults/validation, Claude credential aliases and child-process stripping, selected-provider key provisioning through API/UI, live/demo/campaign defaults and authored testing docs. Explicit DeepSeek configurations remain supported; no cross-provider fallback.
- Validation: `node --test scripts/lab/live-campaign/tests/arguments.test.mjs scripts/lab/pair/tests/provider-key.test.mjs` -> `6 passed, 0 failed`.
- Not verified: package types and remaining owning tests await the new Core public provider build; no real model request or live comparison.

### 2026-10-30 - Independent provider and Lab acceptance in progress
- Agent: lead
- Validation: `pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/llm/anthropic/tests --maxWorkers=1 --minWorkers=1` -> `4 files, 33 tests passed`; DeepSeek/session-key/settings owning batch -> `19 files, 196 tests passed`.
- Validation: `pnpm.cmd --filter @fluxiq-web-extension/test-contracts build` and `node --test packages/test-contracts/src/tests/llm-provider-defaults.test.mjs packages/test-contracts/tests/llm-contracts.test.mjs` -> `build passed; 11 tests passed`.
- Validation: `pnpm.cmd --filter @fluxiq-web-extension/test-runner check` and `pnpm.cmd --filter @fluxiq-web-extension/test-runner build` -> `both passed`.
- Finding: first Node owning batches lacked compiled test-evidence; built that dependency. Next batches reached149/241 tests with29/10 failures from stale DeepSeek/default-cost fixture expectations; correcting those without changing runtime acceptance.
- Not verified: final owning test rerun, paired integration, any paid Claude call or performance comparison.

### 2026-10-30 - Final independent acceptance
- Agent: lead
- Validation: compiled `live-llm/tests/*.test.js` via `node --test --test-reporter=spec` -> `150 passed, 0 failed`; changed non-live owning files plus commands/interactive-session -> `241 passed, 0 failed`.
- Validation: native Claude transport/session tests -> `33 passed`; legacy DeepSeek/session/settings -> `196 passed`; Claude settings and Secret Keys UI interaction files -> `33 passed`.
- Validation: `pnpm.cmd --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` in Core -> `all passed`; final downstream test-runner `check` and `build` -> `both passed`.
- Validation: `node --test scripts/lab/live-campaign/tests/arguments.test.mjs scripts/lab/pair/tests/provider-key.test.mjs` -> `7 passed`; contract/default tests -> `11 passed`; `node scripts/check/model-text.mjs` -> `ok (208 scenario tokens, 412 model-facing Core files, 12444 string literals)`.
- Finding: downstream full structure found only three credential-name references in the new source-only launcher registry; added that exact file with a boundary explanation. `node scripts/structure-audit.mjs --rule restricted-references` -> `passed, 0 warnings`; statement-packing -> `passed`. Core baseline update lowered4/removed8 entries and added none.
- Not verified: a paid Claude request, browser key-entry roundtrip or performance comparison. No panel was managed, and no full sweep was run.

### 2026-10-30 - Paired integration
- Agent: lead
- Validation: `pnpm.cmd task finish t816 'Claude live tests and five-dollar build allowance'` -> structure gate passed and task merged; final local branch deletion refused because the last parent-sync commit was newer than its backup. Pushing the final task tip and `git branch -d task/t816-claude-live-provider` both passed; remote backup retained.
- Validation: Core `pnpm.cmd task finish t816 'Claude runtime and five-dollar live-test allowance' --skip-checks` -> mandatory contracts `3 files, 70 passed`, merged61d29c1f. Narrow types/tests/builds above replace a full sweep at this merge.
- Validation: `git log -1 --oneline` -> downstream fa99782d and Core61d29c1f merge commits confirmed.
- Not verified: main promotion and paid/browser Claude quality; existing supervised-launch requirements remain.
