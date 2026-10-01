# t200-w7 report: Core seams for "the model sees the whole page"

Worker report. Tree: `C:/Users/osrs_/FluxStuff/fxwork/t200/!FluxIQ` (branch `task/t200-model-sees-whole-page`). Nothing committed. R = `packages/fluxiq/src/programs/automation-studio/runtime/`.

## Outcome

Done, with pre-existing failures noted. All nine items are implemented.

- `pnpm --filter fluxiq check`: 0 errors.
- Root `pnpm check`: exit 0.
- Structure audit: passes.
- `pnpm --filter fluxiq build`: exit 0, and dist is fresh.
- Reference docs: regenerated, and `--check` passes.

In the brief's vitest run, every failure caused by t200 is fixed. What remains is one of two things:

- **Two pre-existing assertion failures and one other.** These are from commits on this base that t200 did not touch (see Open questions).
- **15-second timeouts under machine load.** Each passes when run alone, or alone with a longer timeout.

## What changed and why

1. **`maxEvidenceBytes` is removed from the executeTool contract.**
   - Removed from `llm/harness-options/option.ts`, `binding.ts` (declaration and pass-through) and `registry.ts` (type, destructure, pass-through).
   - Removed from `flow-bootstrap/person-needed.ts:142`.
   - Tests updated: `harness-options/tests/{binding,builtin,registry}.test.ts`, `flow-bootstrap/tests/person-needed.test.ts`, `activity/tests/observer.test.ts`, and `tests/service-bootstrap/tests/generation.test.ts`. The last had a dead import, and now asserts that the first look carries no `maxEvidenceBytes`.

2. **Secret screening in explored packets is not a regression.**
   - t200-w4 replaced the harness's refusal with in-place withholding. `harness/explored-evidence.ts` `carriedPacket` replaces a credential-shaped packet with `{schemaVersion:"automation-studio.explored-packet-withheld.v1", withheld:"secret_shaped"}`.
   - The adapter still refuses a slot that carries a credential (`request-evidence-check.ts` `credentialFree`).
   - The `:93` test now asserts the withholding: `transport: 1`, the Bearer value is absent from the outbound body and from the whole result, and the marker is present. A new test asserts the adapter's refusal of a raw slot.
   - `slot()` loses `withheldPackets`. The slot-shape cases were updated: a withheld count is an extra field, and a non-object packet is refused.
   - A new test sends a 2,001-character string, a schema-less packet and 65 packets whole.
   - The summary "past its byte ceiling" case now asserts the 5,000-character summary is sent.
   - `deepseek-provider.test.ts` now asserts the 2,001-character note is sent.

3. **One estimator, and the loud failure fires first.**
   - `harness/run.ts` measures with `estimateAutomationStudioLlmTokensFromUtf8Bytes` (UTF-8 bytes / 3). It takes the larger of the packed request and the provider's own measure.
   - The provider's measure comes from a new optional `AutomationStudioLlmProvider.measureInput` (`harness/provider.ts`). DeepSeek implements it with the new `measureAutomationStudioDeepSeekInput` in `deepseek/request-body.ts`, the exact figure the adapter refuses on. So the harness's size-carrying `llm_budget.input_limit_exceeded` fires before the adapter can refuse.
   - `AutomationStudioLlmProviderError` gains an optional eighth argument, `inputSize` (numbers only).
   - The adapter's `llm.provider_input_budget_exceeded` passes that size. `normalizedAutomationStudioLlmProviderFailure` validates it and returns `inputSize` plus a sized message (`provider-contract.ts`). The harness puts `inputSize` in the diagnostic metadata.
   - `flow-bootstrap/generation-failure/harness-failure.ts` stores the larger of the request's and the refused size as `accounting.estimatedInputTokens`.
   - `harness/token-limits.ts` `estimateTokens` (characters / 4) is still used, but only by `instruction.ts` for instruction truncation, not for request size.
   - New tests are in `llm/harness/tests/run-size.test.ts`.

4. **The ledger reserves each call's own size.**
   - `harness/run.ts` reserves the call's own `estimatedInputTokens`, not `maxInputTokens`.
   - It reserves cost as `min(ceiling, provider.estimateCostUsd(input, maxOutput))`, using a new optional `estimateCostUsd` on the provider. DeepSeek prices at peak rates with every input token a cache miss.
   - This was needed because at the window profile the per-call ceiling is the whole $0.25 purse (the worst case on flash is about $0.307). Every call after the first was refused on cost.
   - Two recovery pieces also held window-sized shares, so I fixed them:
     - `recovery/annotation/patch-reserve.ts` sizes a held call on the largest call the run has already made, priced by the provider (`annotate.ts` passes `provider.estimateCostUsd`). Before, the hold was the whole purse and was never taken.
     - `recovery/annotation/run-budget.ts` drops `AUTOMATION_STUDIO_RECOVERY_DEFAULT_TOKENS_PER_SHARE`, Core's default pot of 6,000 tokens per share (144,000 in all) for an unattended recovery. That pot refused a whole page's diagnosis outright. The pot is now the per-call total × shares, lowered by `maxTokensPerRun` or the resolver's `maxTotalTokensPerRun`.
   - Proofs:
     - `run-budget.test.ts` "a recovery at the window profile": ten 30,000-token calls are admitted under $0.25 with no breaches, for both explicit and unattended runs, and a window-sized reservation refuses the second call.
     - `patch-reserve.test.ts`: the window-profile hold is taken and the exploration still runs.
     - `run-size.test.ts`: a 30,000-token call is admitted with $0.20 already spent, reserved at its own size.
     - `recovery-default-limits.test.ts`: rewritten for own-size reservations; at least 8 decisions after the diagnosis and the patch hold.

5. **Web settings.** `FlowSettingsView.tsx` shows the text "...the model's context window of 1,000,000 total tokens" and `max={FLOW_LLM_HARD_MAX_TOKENS}` on all three inputs. `settings-view.test.tsx:130` asserts both and that 64,000 is gone.

6. **Secret-named words.** `recovery/repair-context/secret-named-key.ts` drops `key` and `keys`.
   - It adds `apikeys`, `secretkey`, `privatekey`, `accesskey`, `signingkey`, `encryptionkey`, `sessionkey` and `licensekey`.
   - Adjacent word pairs are now also matched (`api_key`, `private_key_pem`, `aws_access_key`).
   - New test: `repair-context/tests/secret-named-key.test.ts`. `key: "Enter"` and `hotkey` are carried; the secret kinds are withheld.

7. **Reusable context.** `reusable-llm-context.ts` orders by `createdAt`, newest first, then `recordId`. `score()` is deleted. The store already orders by `created_at_ms desc`. Two tests were updated.

8. **Orphaned exports.**
   - Deleted `loop-limits/result-summary.ts` (`AUTOMATION_STUDIO_RESULT_SUMMARY_LIMITS`, no reader) and its barrel line. `AUTOMATION_STUDIO_RECOVERY_DEFAULT_TOKENS_PER_SHARE` is removed as part of item 4.
   - Downstream grep (read only): none import either one.
   - Downstream object literals that still pass `maxEvidenceBytes` directly, which would now be excess-property errors, are listed under Open questions.
   - The `flowParametersWithheld` JSDoc in `result-verification/contracts.ts` now says it is set only by summaries written before 2026-09-30.

9. **Docs.**
   - `docs/architecture/package-boundaries.md`: a new migration entry, "Next minor (unreleased): the model sees the whole page". It covers the removed limits (6,000-byte failure evidence, recovery byte budget, result-summary limits, parameter-screen caps, 24,000-byte window, 64,000 ceiling, the 144,000 pot) and every contract change above.
   - `docs/architecture/automation-studio.md`: the 50,000 ceiling (twice) becomes the 1,000,000 window with one estimator; own-size reservations; `flowParametersWithheld` and the result data are no longer bounded; the patch reserve's new sizing.
   - `docs/architecture/automation-studio/persistence.md`: reusable context has no ranking and no five-record or 8,192-byte cap.
   - Reference regenerated with `node scripts/docs-reference.mjs`. It wrote both `docs/reference/framework-reference.md` and `packages/fluxiq/docs/reference/framework-reference.md`, which the script always writes.

## Commands run and observed results

- `bash .../heavy.sh "t200 w7 tsc" pnpm --filter fluxiq check`: no `error TS` lines; the build-cache recorded the step.
- `bash .../heavy.sh "t200 w7 root check" pnpm check` (Core root): `EXIT=0`.
  - Output includes `structure-audit: passed (199 warning(s), 354 baselined).`, `"step":"fluxiq:check"` and `"step":"web:check"`.
  - The script tests (`node --test`) passed.
- `node scripts/structure-audit.mjs`: `structure-audit: 1 baseline entries can be lowered...` and `structure-audit: passed (199 warning(s), 354 baselined).`
- `bash .../heavy.sh "t200 w7 build" pnpm --filter fluxiq build`: `BUILD_EXIT=0` (run twice; the second run follows the last source edit).
  - `dist/.../llm/harness/provider.d.ts` contains `estimateCostUsd`.
  - `dist/.../deepseek/provider.js` contains `measureInput`.
- `node scripts/docs-reference.mjs` wrote both files (2,752 public declarations). `node scripts/docs-reference.mjs --check`: `DOCS_CHECK_EXIT=0`.
- `npx vitest run src/features/automation-studio/settings` (apps/web): `Test Files 9 passed (9)`, `Tests 60 passed (60)`.

**The brief's vitest command**, `bash .../heavy.sh "t200 w7 vitest" pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime src/programs/automation-studio/api`. It ran while my build and another lane's (t191) run were also going:
- Result: `Test Files 30 failed | 346 passed (376)`, `Tests 42 failed | 3760 passed | 1 skipped (3803)`, 607 s.
- Failures t200 caused, now fixed and re-run alone:
  - `iteration-guards` (now 17 calls and 15 decisions in a 30,000-token pot)
  - `run-call-record` (the failed call is charged its own size)
  - `recovery-default-limits` (rewritten)
  - `llm-diagnosis` "large capture": now 15,000 bytes, inside the resolver's 8,000-token default and the fixture's 12,000-token pot at bytes / 3
  - `deepseek-bootstrap-exploration` (w3's removed 4,000-byte draft cap)
- The rerun of those five files: `Tests 28 passed (28)` and `Tests 8 passed (8)`. Separately, `iteration-guards` gave `8 passed (8)`, the preflight and provider files `43 passed (43)`, and `run-size`, `run-budget` and `patch-reserve` `14 passed (14)` and `19 passed`. `repair-context` gave `24 passed (24)`, and the reusable-context files `7 passed (7)`.
- The other 23 failing files, rerun together: `28 failed | 105 passed`, almost all `Test timed out in 15000ms` plus `ENOTEMPTY`/`EBUSY` temp-dir cleanup.
- Rerun serially (`--no-file-parallelism`): `Tests 10 failed | 123 passed (133)`, 833 s.
- Each remaining timeout, run alone:
  - Passed: execution-digest (13,736 ms), durable-patches "filters" (11,550 ms), proposal-approval (6,631 ms), iterating-recovery (12,193 ms), failed-start (5,839 ms).
  - Four timed out again at about 15,070 ms. With `--testTimeout=60000` all four passed: proposals "turns mapped observations" in 16,193 ms, run-detail-preservation in 17,393 ms, durable-patches "applies and reverts" in 13,667 ms, and instruction-readiness in 13,998 ms.
- `scale-pages` (`566 < 500` ms timing check) passed in the serial rerun.

## Not verified

- A clean full run of the brief's vitest set. The shared machine (t191 was holding a build slot) pushes about ten service tests just past 15 s. Every one passes alone or with a longer timeout, but I have no single green run.
- No live run.
- Downstream (`!FluxIQWebExtension`) compile against the new dist was not run.
- apps/web beyond `web:check` (tsc) and the settings tests.

## Open questions or contradictions found

1. **Pre-existing failures that are not t200's (untouched):**
   - `conversations/commands/tests/execute.test.ts` "never grants a delete by typing": a typed "yes" to a `send_or_publish` confirm is refused. Commit 05266957 made `send_or_publish` destructive; the test (3997445b) and `answer-ask.ts`'s own comment say only delete and money need a PIN.
   - `service-bootstrap/tests/permission.test.ts` "the instruction itself asks for it": the build fails with `flow_bootstrap.permission_required`. The test predates 05266957 ("money, delete and send always ask").
   - `native-node-runtime.test.ts:25`: `expected NaN to be 8`. No native or graph file changed in t200.
2. **The default Flow setting `maxTokensPerRun: 12000`** (`model/flows.ts:263`, "binds as written") still caps every unattended recovery's token pot at 12,000. That stops a whole-page diagnosis, and it is a default rather than a person's choice. So is the harness's own 8,000/2,000/10,000 default for a resolver that names no token limits (`harness/token-limits.ts`). The shipped session-key resolver gives the window, so builds are unaffected. I did not change either.
3. **Downstream literals that still pass `maxEvidenceBytes`**, which are excess-property TS errors now that the field is gone:
   - `domain/src/runtime/llm-evidence/harness-options/tests/detect-option.test.ts:61`
   - `harness-options/tests/options.test.ts:229`
   - `tests/recovery-selector-hints.test.ts:135`

   These spread it through a `BASE` constant, which is probably not flagged: `node-run/tests/person-needed.test.ts:22`, `tests/press.test.ts:25`, `tests/tool-rejection-detail.test.ts:27`, `tests/extraction-failure-detail.test.ts:25`.

   The e2e specs `field-entry-target-stability`, `item-conditions` and `list-completeness` also mention it. `packages/test-contracts/src/harness-recovery.ts:236` still lists `byte_budget` (w4 noted this).
4. **A secret-shaped string withholds the whole explored packet**, not just the value. A page with one token in it is hidden from the repair. Redacting the value in place would keep the page; I left w4's behaviour.
5. **The patch hold is sized on the diagnosis's reported input.** The patch request also carries the explored packets, so it can still be refused after an exploration that spent right up to the hold.
6. **The reusable-context store still pages at most 100 candidates** (`service.ts` `packReusableLlmContexts` `limit: 100`; the store clamps to 1-100). That count bound is out of this brief.
7. `structure-audit` says one baseline entry can be lowered. The baseline is shared, so I did not run `pnpm structure:baseline`.
