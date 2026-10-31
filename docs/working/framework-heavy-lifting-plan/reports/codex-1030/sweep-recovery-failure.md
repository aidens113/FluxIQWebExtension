# Recovery/provider binding sweep investigation

Outcome: Done (read-only diagnosis; no source changes or checks in this investigation).

## Cause and distance reached

Both failures have the same product cause: runtime call sites send routing labels as `providerId`, but the t816 session-key resolver now correctly treats `providerId` as a concrete model provider.

- `runtime/recovery/annotation/annotate.ts:189-200` falls back from `policy.metadata.llmProvider` to `policy.policyId`. The failing fixture has `policy.checkout` and no provider metadata (`runtime/tests/deepseek-recovery-requests.test.ts:441-469`). The resolver therefore receives `providerId: "policy.checkout"`.
- `runtime/service.ts:2486` always sends `providerId: "host"` for caller-paid result judging. The SQL repair/replay fixture installs the real session-key resolver (`runtime/tests/refuted-result/tests/repair-replay-chain.test.ts:161-210`), so it reaches the identical refusal on its first judge resolution.
- `runtime/llm/session-key-provider.ts:91-96` calls `assertAutomationStudioLlmModelBinding(selectedProvider, selectedModel)` before constructing an adapter. `runtime/llm/models/default-model.ts:39-43` permits only `anthropic` and `deepseek`; either label throws `Live LLM execution supports DeepSeek and Anthropic (Claude).` No adapter, key release, request validation, fake fetch or billed call is reached.

The recovery catches that throw at `annotate.ts:210-232` and records `llm.provider_resolution_failed`, before the diagnosis/evidence/patch stages. The SQL chain has executed its Flow and produced its original wrong dataset, but its first judge cannot resolve: `result-verification/run-outcome.ts:584` rejects inside `automationStudioResultVerificationWithinDeadline`, whose `deadline.ts:103-108` returns `reason: "threw"`. The run records an unfinished/unverified check (`run-outcome.ts:327-340`); no refutation, re-author or replay chain can start. These outcome details are statically traced, not observed by an extra run.

The sweep log confirms six failed cases in `deepseek-recovery-requests.test.ts`, all with zero fake calls, versus 14,826 ordinary passing tests. The additional SQL failure is `repair-replay-chain.test.ts`, one case expecting eight scripted calls and receiving none (log lines 3392-3394 at inspection). The SQL group was still running.

## Why this is not a secret/environment failure

The sweep's stripped provider/FLUXIQ environment is the lead's stated environment. Each test supplies its own metadata-only key snapshot, fake reveal and fake fetch. The caller exists in both fixtures. The failed binding assertion runs before `releaseAutomationStudioSessionProviderKey`; its scoped-key checks (`session-keys/key.ts:45-75`, `90-102`) are never reached. The unset global-model branch resolves `deepseek-flash` (`models/default-model.ts:22-25`), but an invalid explicit provider throws before that default can be used. No env-file contents or real credentials were read.

## Minimal correct fix and owned paths

Keep the strict provider/model validator and all key custody, permission and budget checks.

1. `runtime/recovery/annotation/annotate.ts`: stop inventing a provider selection from the policy ID; pass only actual configured provider/model metadata, otherwise leave selection unspecified.
2. `runtime/service.ts`: remove the hardcoded host selection from caller-paid result judging and pass the canonical Flow's configured model/provider/key metadata. The budget-only `automationStudioLlmResolutionWithinFlowSettings` wrapper does not propagate selection into a resolver that already ran.
3. `runtime/service/flow-settings/adaptation-policy.ts`: preserve canonical `llmModel` and `llmSecretKeyId` in recovery policy metadata, alongside `llmProvider`. It currently drops both, so correcting only the bogus provider label would still lose an explicit Claude model or Flow-owned key on recovery.
4. `runtime/llm/session-key-provider.ts`: normalize only the existing `host` sentinel to unspecified at the owning resolver boundary. This compatibility handling is necessary because `model/flows.ts:322` still writes `llmProvider: "host"` on new Flows, and migration preserves it. Forwarding canonical metadata without normalizing that value still rejects default Flows. Unknown providers and mismatched concrete provider/model combinations must continue to refuse before any reveal/fetch.

Own the tests next to these modules; keep the two existing integration files' assertions unchanged. No model-default change, credential change or DeepSeek/Claude fallback belongs at either call site.

## Fail-first and acceptance recommendation

After the lead releases the source tree for checks, from Core root with sweep-safe stripped provider environment and a fresh ignored runtime root, use plain focused vitest (no `FLUXIQ_TEST_GROUP`; that config runs exactly named files):

```text
pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/tests/deepseek-recovery-requests.test.ts src/programs/automation-studio/runtime/tests/refuted-result/tests/repair-replay-chain.test.ts --maxWorkers=1 --minWorkers=1
```

The frozen-source sweep already supplies the fail-first result: six ordinary plus one SQL failure, zero calls. Add focused regressions covering default/legacy host, explicit Claude model/key preservation through recovery and caller-paid judging, and invalid provider/model refusal before reveal/fetch. Run those named regression files with the two integration files, then the `fluxiq` package typecheck and structure audit as the lead's narrow task gate. No full sweep or actual provider call is needed for this fix.

Validation: source/log inspection only; no commands that execute source/tests, provider calls or git operations ran.

Not verified: runtime metadata values by a new test run; repaired behavior; final SQL group totals; source history attribution beyond the lead's t816 premise.

Report: `docs/working/framework-heavy-lifting-plan/reports/codex-1030/sweep-recovery-failure.md`.
