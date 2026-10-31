# t816 Core Claude implementation report

Outcome: Done
Core tree: C:/Users/osrs_/FluxStuff/fxwork/t816/!FluxIQ
Package: fluxiq 0.9.0 (version set by lead).

## Result and invariants

Native Anthropic Messages support now works through the runtime, encrypted per-call session keys, standing result checks, conversation decisions, Flow settings, authoring readiness and Secret Keys UI. Explicit DeepSeek APIs and configurations remain usable. A missing Claude key or mismatched provider/model/key never selects another provider.

- Supported IDs: claude-sonnet-5-5, claude-haiku-5-5, claude-opus-5-5. Each has 1,000,000 context tokens and native maxOutputTokens 128,000. The Anthropic default is Sonnet; the global FLUXIQ_LLM_DEFAULT_MODEL accepts either provider, and importing DeepSeek under a Claude default is safe.
- Uses native Messages API version 2026-10-21 and bearer authorization, with streaming, bounded response reads, parent cancellation and a deadline spanning key release, send and body read. No unsupported sampling or disabled-thinking parameters are sent.
- The native required max_tokens is the model's full 128,000 maximum. The harness's 8,000 reply reserve is unchanged and never becomes a purse-saving wire cap. Anthropic accepts input + max_tokens beyond its context size when input itself fits; max_tokens and model_context_window_exceeded stops remain paid truncation, never success. Oversized evidence is refused with measured size, never trimmed.
- Provider-neutral prompts, evidence preflight, schemas and refusal/transport checks were extracted with DeepSeek compatibility aliases. Existing prompt pins and task guidance remain unchanged. No scenario/task/oracle changes were made here.
- Closed native schemas retain supported structure and describe unsupported constraints. Schemas with arbitrary maps or excessive optional/union counts use a reversible native result_json envelope. Original local schema validation and the harness's semantic validation remain authoritative; nonempty nested parameter maps survive.
- Cache accounting includes uncached input, 5-minute/1-hour cache writes, cache hits and output; Haiku's whole-prompt tier is respected. Append-only evidence is split at JSON entry boundaries for native prefix reuse without changing the original projection.
- Incomplete streams before final usage leave the bill unknown, preserving Core's conservative reservation. Completed refused/truncated/malformed paid replies carry known usage and billed cost. Initial stream output counts are never treated as a completed bill.
- Decoded envelope content, recursively decoded JSON-text layers and the final structured answer are screened for the configured credential before raw reply logging or return. Rejected raw answers stay unlogged; encoded refusal fields are withheld. Fake Unicode-escape regressions prove no raw/success log callback executes for an encoded key, while paid accounting survives.
- Isolated test scope honors the explicit 5 USD build allowance and clamps narrower Flow policy. Ordinary defaults remain 0.25 USD and ignore test-only environment amounts. Flow Settings now permits Core's existing public 10 USD maximum while keeping its 0.25 default, and a 5 USD Flow roundtrips through the form.
- Secret Keys retains the option value Anthropic and displays Anthropic (Claude). Existing lowercase anthropic and explicit Anthropic (Claude) key metadata select that option when edited, while preserving their original persisted provider string. Keys never enter the form as decrypted values.

## Public integration seam

From fluxiq/automation-studio:

- createAutomationStudioAnthropicProvider({ secretReference, resolveSecret, fetchImpl?, model?, maxResponseBytes? }). resolveSecret uses the existing opaque request contract and provider anthropic.
- createAutomationStudioAnthropicPanelCommandModel({ resolveKey, fetchImpl?, model?, maxResponseBytes? }).
- automationStudioPanelCommandKeyFromSecretKeys(ports, { provider: "anthropic", model? }); the original one-argument DeepSeek form remains valid.
- createAutomationStudioSessionKeyProviderResolver retains its synchronous resolver API; providerId/modelId/metadata matching is explicit. The shipped host first resolves the selected Flow/key metadata and refreshes key selection per call.
- releaseAutomationStudioSessionProviderKey, automationStudioSessionKeyProvider, estimateAutomationStudioAnthropicCostUsd and the model registry helpers/types are exported.

From browser-safe fluxiq/automation-studio/llm-models:

- AUTOMATION_STUDIO_ANTHROPIC_MODELS: readonly ID tuple.
- AUTOMATION_STUDIO_ANTHROPIC_DEFAULT_MODEL: claude-sonnet-5-5 unless the configured global default names another supported Claude model.
- AUTOMATION_STUDIO_ANTHROPIC_MODEL_LIMITS[model]: { contextTokens, maxOutputTokens }.
- Existing DeepSeek exports remain. Provider/model validation/default helpers and Core's cost default/maximum constants are available without Node imports.

The Lab supplies its provider/key/default/budget policy downstream; no provider HTTP implementation belongs there. Core never reads a provider credential from the environment. No real key was read or copied by this worker.

## Validation observed

All commands below ran in the Core tree unless a package filter changes the working package.

- `pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/llm/anthropic/tests src/programs/automation-studio/runtime/llm/deepseek/tests/default-model-env.test.ts src/programs/_shared/tests/model-provider-admission.test.ts src/programs/automation-studio/runtime/result-check-authorization/tests/provider.test.ts src/programs/automation-studio/api/handlers/tests/llm-execution-settings.test.ts --maxWorkers=1 --minWorkers=1` -> 8 files / 55 tests passed, 93.63 seconds; before the additional encoded-key regression.
- `pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/llm/anthropic/tests/provider.test.ts --maxWorkers=1 --minWorkers=1` after encoded-key fix -> 24 tests passed, 16.98 seconds.
- Earlier combined owning DeepSeek/session/API/standing-check/Anthropic run -> 273 assertions passed; two new test-setup failures (unsupported Vitest matcher and once-read environment setup) were corrected and rerun in the passing checks above. Existing DeepSeek prompt/request/refusal/billing/key suites passed.
- `pnpm.cmd --filter fluxiq check` -> passed after restoring precise DeepSeek refusal request typing and annotating the Flow-aware host callback. Latest behavior check after encoded-key fix passed in 54.706 seconds; a comment was clarified afterwards.
- `pnpm.cmd docs:reference` -> regenerated docs/reference/framework-reference.md and packages/fluxiq/docs/reference/framework-reference.md, 4,367 public declarations.
- `pnpm.cmd --filter fluxiq build` -> passed, 122.162 seconds, 12,422 emitted files / 32,520,194 bytes. Core package source has remained frozen since this build.
- `pnpm.cmd --filter @fluxiq/web exec vitest run src/features/automation-studio/settings/tests src/features/automation-studio/authoring/tests src/features/automation-studio/onboarding/tests src/features/automation-studio/conversation/capabilities/catalog/tests/adaptations.test.ts src/features/automation-studio/conversation/capabilities/catalog/tests/browser-endpoints.test.ts src/features/programs/live-views/tests/secret-keys.test.ts src/features/programs/live-views/tests/secret-keys-recovery.test.tsx --maxWorkers=1 --minWorkers=1` -> 22 files / 230 tests passed, 64.09 seconds, against the completed library. Existing React test-renderer deprecation notices were emitted.
- After the final web-only lowercase provider normalization: `pnpm.cmd --filter @fluxiq/web exec vitest run src/features/programs/live-views/tests/secret-keys-recovery.test.tsx src/features/programs/live-views/tests/secret-keys.test.ts --maxWorkers=1 --minWorkers=1 --silent` -> 2 files / 36 tests passed, 16.11 seconds.
- `pnpm.cmd --filter @fluxiq/web check` -> passed before and after the final web-only fix. Final run: 111.365 seconds.
- `pnpm.cmd docs:check` -> documentation links passed and deterministic framework reference is current.
- Final `node scripts/structure-audit.mjs` -> passed with 471 existing advisory warnings / 1,144 baselined, no new violations. Four improved import-cycle baselines can be lowered by lead.
- `git diff --check` -> passed; only normal LF/CRLF warnings on generated references.

Initial pnpm.ps1 launch was rejected by PowerShell execution policy before tests ran; all actual commands used pnpm.cmd. Earlier mechanical audit issues were fixed without widening any baseline. The first package typecheck found circular host inference and a widened compatibility type; both were fixed before the successful checks and build.

## Freeze, coordination and limits

All worker commands are complete. Both heavy-check lock batches were created atomically, owner-verified and removed; the final release was handed directly to resume_t811. Core package source/library remain frozen. The final UI fix changed only apps/web files and was validated after the library build. No git mutations, registry publishing, panel management, paid calls, real credential reads or runtime-state edits were performed by this worker.

Not verified: authenticated Claude requests, live model quality, manual browser/key-entry flows, Next production build or full suites. Live provider calls: 0; billed live spend: 0 USD. Provider-free checks do not establish live behavior.

Lead-owned metadata remains lead-owned: AGENTS.md, working README/plan, version/commit/integration management. Root private package.json and its lock importer still used workspace:0.7.0 when reviewed despite linked fluxiq 0.9.0; lead was informed that workspace:* matches the existing apps/web/internal workspace policy and should be regenerated for fresh installs. This worker did not alter that packaging metadata while downstream used the frozen build.

Official primary references checked 2026-10-30:
https://platform.claude.com/docs/en/models/overview
https://platform.claude.com/docs/en/api/messages/create
https://platform.claude.com/docs/en/build-with-claude/structured-outputs
https://platform.claude.com/docs/en/about-claude/pricing
https://platform.claude.com/docs/en/api/migration-2026-10-21
https://platform.claude.com/docs/en/models/sonnet-5-5/overview
https://platform.claude.com/docs/en/build-with-claude/context-windows#context-window-overflow-behavior

## Exact changed paths

Paths relative to the Core tree; generated references are listed, build artifacts are excluded. The package manifest includes worker export-path changes and the lead's version change. Shared working documents and lead-only root version metadata are excluded.

- apps/web/src/features/automation-studio/authoring/flow-model-binding.ts
- apps/web/src/features/automation-studio/conversation/capabilities/catalog/flows.ts
- apps/web/src/features/automation-studio/conversation/capabilities/catalog/tests/adaptations.test.ts
- apps/web/src/features/automation-studio/conversation/capabilities/catalog/tests/browser-endpoints.test.ts
- apps/web/src/features/automation-studio/onboarding/OnboardingView.tsx
- apps/web/src/features/automation-studio/onboarding/onboarding-steps.ts
- apps/web/src/features/automation-studio/settings/AiProviderSettingsSection.tsx
- apps/web/src/features/automation-studio/settings/FlowSettingsView.tsx
- apps/web/src/features/automation-studio/settings/ai-provider-model.ts
- apps/web/src/features/automation-studio/settings/flow-settings-model.ts
- apps/web/src/features/automation-studio/settings/tests/anthropic-settings.test.tsx
- apps/web/src/features/programs/live-views/secret-keys.tsx
- apps/web/src/features/programs/live-views/tests/secret-keys-recovery.test.tsx
- apps/web/src/features/programs/live-views/tests/secret-keys.test.ts
- docs/architecture/automation-studio.md
- docs/reference/framework-reference.md
- packages/fluxiq/docs/reference/framework-reference.md
- packages/fluxiq/package.json
- packages/fluxiq/src/programs/_shared/runtime.ts
- packages/fluxiq/src/programs/automation-studio/api/handlers/llm-execution-settings.ts
- packages/fluxiq/src/programs/automation-studio/api/handlers/tests/llm-execution-settings.test.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/anthropic/cache-content.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/anthropic/credential-screen.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/anthropic/index.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/anthropic/messages.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/anthropic/panel-command.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/anthropic/pricing.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/anthropic/provider.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/anthropic/request.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/anthropic/schema.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/anthropic/stream.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/anthropic/tests/cache-content.test.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/anthropic/tests/fixtures.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/anthropic/tests/provider.test.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/anthropic/tests/schema-pricing.test.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/anthropic/tests/session-panel.test.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/balance-exhausted.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/bounded-read.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/json-record.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/models.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/output-schema.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/panel-command-key.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/preflight.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/refusal.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/request-body.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/session-key.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/signal-race.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/system-prompt.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/tests/default-model-env.test.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/diagnosis-instructions.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/context-packet.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/index.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/models/anthropic.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/models/default-model.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/models/index.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/provider-factories.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/provider-task/index.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/provider-task/output-schema.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/provider-task/preflight.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/provider-task/request-messages.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/provider-task/system-prompt.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/provider-transport/balance-exhausted.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/provider-transport/bounded-read.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/provider-transport/index.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/provider-transport/json-record.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/provider-transport/refusal.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/provider-transport/signal-race.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/recent-actions/index.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/recent-actions/record.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/session-key-provider.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/session-keys/index.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/session-keys/key.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/session-key-provider.test.ts
- packages/fluxiq/src/programs/automation-studio/runtime/recovery/annotation/run-budget.ts
- packages/fluxiq/src/programs/automation-studio/runtime/result-check-authorization/provider-contract.ts
- packages/fluxiq/src/programs/automation-studio/runtime/result-check-authorization/provider.ts
- packages/fluxiq/src/programs/automation-studio/runtime/result-check-authorization/reveal.ts
- packages/fluxiq/src/programs/automation-studio/runtime/service.ts
- scripts/structure-audit/config.mjs

Outcome: Done
Changed: Exact Core paths above; this report in downstream main.
Validation: Owning Core/web tests, Core/web types, library build, structure, docs and diff checks passed as recorded.
Not verified: Paid/live Claude or manual browser flows; fresh-install root workspace pin cleanup is lead-owned.
Report: docs/working/framework-heavy-lifting-plan/reports/codex-1030/t816-core-result.md
Notes: Core 0.9.0 package/library frozen; heavy slot handed to t811. No commits or pushes by worker.
