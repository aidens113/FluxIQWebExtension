Role: Heavy worker. Model gpt-6.1-sol, effort max. No spawning, git mutation, paid/network model calls or panel management.
Goal: Implement complete Anthropic Claude support in Core runtime, session keys, API settings and UI, for paired t816.
Own: ONLY C:/Users/osrs_/FluxStuff/fxwork/t816/!FluxIQ source/tests/architecture docs; own report in downstream main.
Must not touch downstream source, other trees, shared Current State/Work Ledger/index, secrets/.env/runtime data.
Read Core AGENTS.md, CODEX.md relevant binding rules; code-structure; docs/working/claude-live-provider-plan.md;
llm/{session-key-provider,provider-factories,provider-contract}, deepseek adapter/model/session key owners;
Flow LLM settings contracts and apps/web Secret Keys / Flow LLM UI owners. Investigate only relevant paths.
Standing user rule: all live tests use Claude via CLAUDE_API_KEY; no DeepSeek fallback, unchanged tasks/oracles,
report exact model/verdict/calls/billed cost/runtime. Your checks are provider-free; never read the real key.
Stable integration: provider id anthropic; live default claude-sonnet-5-5; support Sonnet/Haiku/Opus 5.5 model IDs.
Expose createAutomationStudioAnthropicProvider on fluxiq/automation-studio, options analogous to DeepSeek.
Expose AUTOMATION_STUDIO_ANTHROPIC_MODELS, AUTOMATION_STUDIO_ANTHROPIC_DEFAULT_MODEL,
AUTOMATION_STUDIO_ANTHROPIC_MODEL_LIMITS via browser-safe fluxiq/automation-studio/llm-models, retaining old exports.
Implement native Messages API in Core only, opaque per-call unlocked key release; provider-aware settings/model
validation and UI labels Anthropic (Claude), explicit key/provider/model matching, no cross-provider fallback.
Preserve existing DeepSeek APIs/configurations; do not let FLUXIQ_LLM_DEFAULT_MODEL=claude-* throw in DeepSeek imports.
Use official current docs: platform.claude.com/docs/en/{models/overview,api/messages/create,
build-with-claude/structured-outputs,about-claude/pricing}; browse needed exact details, primary sources only.
Observed: Sonnet5.5 id claude-sonnet-5-5, context1M/output128K, $2/$10 per MTok, cache write2.5/hit0.10;
Opus5.5 $4/$20, cache write5/hit0.20; Haiku5.5 tiered rates. Read full sources rather than assuming old API.
Do not cap provider output to save purse: use native maximum where API requires max_tokens, preserve billed-dollar
accounting and context measurement. Do not bypass refusal/truncation/balance/abort/redaction guards or schema checks.
Native structured output may need schema transformation; local original-schema validation stays authoritative.
Preserve current generic prompts, no task-specific guidance. Fake fetch tests prove requests/usage/cache/error paths.
Run owning tests, Core/web affected typechecks, structure/docs checks; regenerate reference when needed; no full sweeps.
Coordinate heavy-check.lock (lead t799 currently owns, then t813, t811). Source frozen before library builds.
Before final report give exact exported seam and any downstream integration needs. Lead independently verifies.
Report: C:/Users/osrs_/FluxStuff/!FluxIQWebExtension/docs/working/framework-heavy-lifting-plan/reports/codex-1030/t816-core-result.md
End contract: Outcome; Changed; Validation exact command/result; Not verified; Report; Notes <=3 lines.
