# t200-w3-core-build report

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t200/!FluxIQ`, branch `task/t200-model-sees-whole-page`. Nothing committed. `R/` = `packages/fluxiq/src/programs/automation-studio/runtime/`.

## Outcome

**Partial.** Everything in the brief is done inside my ownership. `tsc` still fails, on 5 errors. All 5 are in files I do not own, and each needs a one-line removal (listed below). The structure audit passes.

The vitest scope has 6 failures:

- 5 tests assert limits that t200-w4 removed, or that sit in a file I do not own.
- 1 is a timeout. That test passes when run alone.

## What changed and why

The model now sees every evidence entry in full, and nothing ranks the entries. The only size limit on a request is the model's context window, which is enforced loudly.

**The window and the decision context.** The model is shown every entry, whole, in call order.

- `R/llm/context-window.ts`: `automationStudioLlmEvidenceContextWindow(records)` returns every entry in call order. The byte allowance, the entry count and the newest-per-tool ranking are gone.
- `R/llm/decision-context/shown.ts`: builds `[...evidence, history, draft, budget]` with no byte arithmetic.
- `R/llm/decision-context/entry.ts` and `compression.ts`: the history is always the full telling, `decision_rows_v1`.
  - The ladder is removed: codes-only, folded calls, joined refusals and the least form.
  - The `omitted`, `folded` and `unlisted` fields are removed.
  - The "calls row" sentence is removed from the instruction.
- `R/llm/decision-context/closed-detail.ts`: the 8-object and 4-field caps are removed. The closed-code filter stays, because it is the no-prose rule and not a size limit.
- `R/llm/decision-context/index.ts`: comment updated.

**Loop limits and the loop itself.**

- `R/loop-limits/flow-bootstrap-evidence-loop.ts`:
  - `AUTOMATION_STUDIO_EVIDENCE_CONTEXT_BYTES` (24,000) is removed.
  - `loop.maxEvidenceBytes` and `loop.maxEvidenceContextBytes` are removed.
- `R/loop-limits/evidence-loop.ts`: `AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_LIMITS.maxEvidenceBytes` is now `Number.MAX_SAFE_INTEGER`. It no longer limits anything.
  - The key stays because two t200 readers of recorded traces still bound parsed byte counts with it: `R/flow-bootstrap/evidence-loop-steps.ts:327,446-449` and `generation-failure/diagnostic-parse.ts:258`. I cannot edit either file.
- `R/llm/loop-configuration.ts`:
  - Removed from the input: `maxEvidenceBytes`, `maxEvidenceContextBytes` and `draft.maxBytes`.
  - Removed from `executeTool`: its `maxEvidenceBytes`.
  - Removed from `EvidenceLoopLimits`: `maxEvidenceBytes`, `maxEvidenceContextBytes`, `toolEvidenceBytes` and `draftBytes`.
  - Removed: the 1,280 floor (`AUTOMATION_STUDIO_LLM_EVIDENCE_MIN_DRAFT_BYTES`), the default `min(64,000, …)` window, and the check that refused a window above 64k tokens.
- `R/llm/evidence-loop.ts`:
  - `reserveEvidence` becomes `accountEvidence`. It counts bytes and never refuses.
  - Every `evidence_limit` exit is removed: the initial look, each call, feedback, the resume path and the refused-decision paths.
  - A no-progress note is no longer dropped silently.
  - `executeTool` is called without `maxEvidenceBytes`.
  - The `AUTOMATION_STUDIO_LLM_EVIDENCE_MIN_DRAFT_BYTES` re-export is removed.
- `R/llm/decision-handlers/{amendment,answer-check,answered-request,completion,failed-call,types}.ts`: `accountEvidence` replaces `reserveEvidence`, and none of them ends a loop with `evidence_limit` any more.
  - `answered-request.ts` no longer moves the earlier result to the end, so entries stay in call order.
- `R/llm/evidence-loop/answered-request.ts`: the note text "…, just before this one" becomes "the evidence entry named by answeredByCallId".
- `R/llm/evidence-loop/completion-attempt.ts`: the `evidence_limit` ending is removed.
- `R/llm/evidence-loop/result.ts`: `evidence_limit` stays in the union, marked "no longer produced". The outcome tables in flow-bootstrap and recovery key by it.
- `R/llm/evidence-loop/stall-redirect.ts` and `resume.ts`: the 8-item and 16-item caps on what a Core note names are removed.
- `R/llm/node-tools/dry-run-gate.ts` and `replay-draft.ts`: `maxEvidenceBytes` and `evidence_limit` are removed, and `accountEvidence` is used.

**The draft.** It is always shown whole.

- `R/flow-draft/entry.ts`: `automationStudioFlowDraftEntry({ steps })` always returns the whole object-form draft: every step, its full `input`, and the full guidance.
  - Removed: the 512-byte `inputTooLarge` rule, the packed `step_rows_v1` rows, the brief and minimal tellings, and `omitted`/`unlisted`.
  - The phrase "whether or not its result is still shown" is removed from the draft instruction.
- `R/llm/evidence-loop/draft-shown.ts`: the measurement is now `{ bytes, budget: bytes, steps, instructionBytes }`.
  - The legacy optional fields stay on the type, because `evidence-loop-steps.ts` parses them from stored rows.
  - It fails closed on a packed shape.

**JSON checks.** Cycle detection and a depth-64 recursion guard remain; every size limit is gone. The `exactKeys` lists are unchanged.

- `R/llm/evidence-loop-decision.ts` `isJsonValue`: the array, entry and key-length limits are removed.
- `R/llm/deepseek/preflight.ts` `boundedJson`:
  - Removed: the 1,000-children limit, the 20,000-entry total, the 20,000-character string limit and the 500-character key limit.
  - Removed: the evidence-count check (`<= maxToolCalls`).
  - The 64,000 total-token check now reads `AUTOMATION_STUDIO_LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST`.

**The window value.**

- New leaf directory `R/llm/model-limits/`, containing `model-limits.ts`, `max-context-tokens.ts` and `index.ts`.
  - `AUTOMATION_STUDIO_DEEPSEEK_MODEL_LIMITS` moved here unchanged.
  - New: `AUTOMATION_STUDIO_DEEPSEEK_MAX_CONTEXT_TOKENS` = the largest `contextTokens`, which is 1,000,000.
  - `R/llm/deepseek/models.ts` re-exports both, so the public `fluxiq/automation-studio/llm-models` surface is unchanged.
- Why a leaf directory:
  - The harness reads the window while its modules are loading.
  - Importing it through the deepseek barrel re-enters `harness/index` half-loaded, by way of the provider's pre-flight. I tried it: 37 tests failed, with `runAutomationStudioLlmHarness is not a function` and `MAX_ACCOUNTED_TOKENS` equal to NaN.
  - A direct `../deepseek/models.ts` import fails the audit's barrel rule. The audit also caps directory depth at 9, which ruled out `deepseek/limits/`.
- `R/llm/harness/token-limits.ts`:
  - `AUTOMATION_STUDIO_LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST = AUTOMATION_STUDIO_DEEPSEEK_MAX_CONTEXT_TOKENS`, so it is 1,000,000 and derived rather than restated. The name is kept.
  - The clamp message now names the context window.
- `R/llm/session-key-provider.ts`: each resolved call gets its own model's window, `{ maxInputTokens: window - 8,000, maxOutputTokens: 8,000, maxTotalTokens: window }`.
  - The `DEFAULTS.tokenLimits` value is the largest window: 992,000 / 8,000 / 1,000,000.
  - The cost fields are unchanged.
- `api/handlers/llm-execution-settings.ts`: the token bounds are now `AUTOMATION_STUDIO_LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST`.
- `apps/web/.../settings/flow-settings-model.ts`: `FLOW_LLM_HARD_MAX_TOKENS = AUTOMATION_STUDIO_DEEPSEEK_MAX_CONTEXT_TOKENS`, and the error message is built from it.

**How the live chat build gets its token limits.**

- `flow-execution-limits/resolution-within-flow-settings.ts` deliberately does not read the Flow's stored token limits. It narrows only the call count and the per-call cost.
- So the live build's `tokenLimits` are the session-key resolution: the model window.
- `harness/run.ts` `resolveAutomationStudioLlmTokenLimits` clamps against the 1,000,000 ceiling.
- The build's `maxTokensPerDecision` in `flow-bootstrap-evidence-loop.ts` comes from the same limits.
- The effective limit is therefore the model window.

**The loud failure.**

- `R/llm/harness/run.ts`: `llm_budget.input_limit_exceeded` and `llm_budget.request_total_exceeded` now state the size. For example: "Packed LLM request is an estimated N input tokens (B bytes), over its 992000-token input limit: the 1000000-token context window less 8000 reserved for the reply. It was not sent, and nothing was trimmed to fit."
  - The metadata gains `estimatedInputBytes`, `maxOutputTokens` and `maxTotalTokens`.
- `R/llm/deepseek/provider.ts:97-110`: also checks the model's own `contextTokens`. `llm.provider_input_budget_exceeded` now states the estimated tokens, the bytes, the limits and "<model>'s context window is W tokens".

**Kept unchanged:** the spend ceiling, the per-call cost check, and every `exactKeys` list. `supersede.ts` is kept. `answer-check.ts` still replaces an earlier look that a fresh look found "exactly as before".

**Doc:** `docs/architecture/automation-studio/llm-flow-bootstrap.md` is updated in the per-request ceiling, draft entry, history entry and coordinator/window paragraphs.

**Tests I updated:**

- `flow-draft/tests/{entry,accrual,routing}.test.ts`; `entry-budget.test.ts` is deleted.
- `decision-context/tests/{compression,entry,closed-detail,recorded-windows}.test.ts`.
- `evidence-loop/tests/{draft-shown,completion-attempt,resume}.test.ts`.
- `node-tools/tests/dry-run-gate.test.ts`.
- `llm/tests/{context-window,evidence-loop,evidence-loop-draft-shown,draft-amendment-feedback,loop-budget,deepseek-evidence-preflight,session-key-provider}.test.ts`.
- `loop-limits/tests/flow-bootstrap-evidence-loop.test.ts`.
- `api/handlers/tests/llm-execution-settings.test.ts`.
- `apps/web/.../settings/tests/settings-view.test.tsx`: only line 122.

**Tests I added:**

- 100 entries of 50 KB, all shown in call order: `context-window.test.ts`.
- History and draft shown in full beside them, with 60 rows and 60 steps of 5 KB inputs: `context-window.test.ts`. Also a 200-step draft of 2 KB inputs (`entry.test.ts`) and a 40-step loop draft (`evidence-loop-draft-shown.test.ts`).
- `isJsonValue` and pre-flight accept a 5,000-element page, a 50,000-character string and 81 evidence entries; depth 70 is refused: `deepseek-evidence-preflight.test.ts`.
- A request over the window is refused with its measured size, and no secret or transport call is made. Three cases in `context-window.test.ts`: the harness, the DeepSeek adapter, and a loop driving the real harness and adapter, which ends failed with the message.
- The profile equals the model window, per model: `session-key-provider.test.ts`. The ceiling is derived and equals 1,000,000: `flow-bootstrap-evidence-loop.test.ts`.
- The loop runs past 1 MiB, never ends `evidence_limit`, and passes no `maxEvidenceBytes` to a tool: `evidence-loop.test.ts`.

### Exports removed, renamed or changed

- **Removed:**
  - `AUTOMATION_STUDIO_EVIDENCE_CONTEXT_BYTES` (loop-limits).
  - `AUTOMATION_STUDIO_LLM_EVIDENCE_MIN_DRAFT_BYTES` (loop-configuration, and its evidence-loop and llm barrel re-export).
  - `automationStudioLlmDecisionContextTellings` and `AutomationStudioLlmDecisionContextTelling` (compression.ts, internal). They are replaced by `automationStudioLlmDecisionContextHistoryValue`, also internal.
- **Renamed:** `reserveEvidence` is now `accountEvidence`, returning `number`. This applies to the handler context and to `AutomationStudioFlowDraftDryRunGateInput`.
- **Signatures narrowed:**
  - `automationStudioLlmEvidenceContextWindow(records)`.
  - `automationStudioLlmDecisionContextEntry({records})`.
  - `automationStudioLlmDecisionContextShown({evidence, records, draft?: {steps}, budgetEntry?})`.
  - `automationStudioFlowDraftEntry({steps})`.
  - `automationStudioLlmEvidenceLoopDraftShown({value})`.
  - `AutomationStudioLlmEvidenceLoopInput`, `EvidenceLoopLimits` and `AutomationStudioFlowBootstrapEvidenceLoopLimits.loop`, as above.
  - `AutomationStudioFlowDraftReplayInput` loses `maxEvidenceBytes`.
  - `AutomationStudioFlowDraftDryRunRefusal` and the completion attempt's ended code lose `evidence_limit`.
- **Values changed:**
  - `AUTOMATION_STUDIO_LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST`: 64,000 becomes 1,000,000.
  - `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_MAX_ACCOUNTED_TOKENS`: 4,096,000 becomes 64,000,000.
  - `AUTOMATION_STUDIO_SESSION_KEY_PROVIDER_DEFAULTS.tokenLimits`: 48k/8k/56k becomes 992k/8k/1M.
  - `AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_LIMITS.maxEvidenceBytes`: becomes `Number.MAX_SAFE_INTEGER`.
  - `FLOW_LLM_HARD_MAX_TOKENS` (web): becomes 1,000,000.
- **Added:** `AUTOMATION_STUDIO_DEEPSEEK_MAX_CONTEXT_TOKENS`, and the `R/llm/model-limits/` barrel.

## Commands run and observed results

- `bash .../heavy.sh "t200 core-build tsc" pnpm --filter fluxiq check` exited 2 with 5 errors, all outside my ownership:
  - `flow-bootstrap/action-permissions.ts(188)`
  - `flow-bootstrap/person-needed.ts(142)` ×2
  - `recovery/runtime-exploration.ts(288)`
  - `runtime/tests/service-bootstrap/tests/generation.test.ts(1)`
  - Earlier runs showed 113 errors; the rest were in tests I have since updated, or in w4 tests that w4 fixed.
- `bash .../heavy.sh "t200 core-build vitest" pnpm --filter fluxiq exec vitest run …llm …loop-limits …flow-draft …flow-bootstrap …api`: `Test Files 4 failed | 139 passed (143)`, `Tests 6 failed | 1628 passed (1634)`. The failures:
  1. `api/handlers/tests/runs.test.ts` "exports a real run's audit…": `Test timed out in 15000ms`. Run alone with `cancel-runtime-session` and `flows`, all pass; this one took 13,027 ms.
  2. `llm/harness-options/tests/binding.test.ts:93` expects `maxEvidenceBytes: Any<Number>` on the domain call. This is an unowned file (see fix 3).
  3. `llm/tests/deepseek-evidence-preflight.test.ts:32` "sends a runtime patch…": refused `llm.provider_exploration_evidence_invalid`. The test's `slot()` helper still sends `withheldPackets: 0`, which t200-w4's explored-evidence check now refuses. This is a w4 subject.
  4. The same file, `:93` "returns the refusal through the harness…": `result.ok` is `true`. A `Bearer …` value inside an explored packet is no longer refused. This is a w4 subject; see the open questions.
  5. The same file, `:121` case "a summary past its byte ceiling": no longer refused, because w4 removed the result-summary ceiling.
  6. `llm/tests/deepseek-provider.test.ts:93`: failure evidence with a 2,001-character note is no longer refused, because w4 removed the limit.
- `node scripts/structure-audit.mjs` (Core root): `structure-audit: passed (199 warning(s), 354 baselined)`. It also says "1 baseline entries can be lowered".
- `pnpm --filter fluxiq build`, run to refresh `dist` for the web app: exit 1 on the same 5 type errors. `tsc -b` still emitted `dist`, and `dist/.../deepseek/models.js` contains `MAX_CONTEXT`. The declaration-rewrite step did not run.
- `npx vitest run src/features/automation-studio/settings` (apps/web): `Test Files 9 passed (9)`, `Tests 60 passed (60)`, run against that dist.
- Focused reruns: `…/llm/decision-context` 41 passed; `…/llm/evidence-loop` 69 passed.

## Not verified

- **No live build.** The effect of whole-page requests on cost has not been measured. A request near 1M tokens on deepseek-flash costs about $0.30 at the cache-miss rate. The unchanged per-call cost check and the $0.25 ceiling will then refuse or stop it, by design.
- **apps/web `tsc --noEmit` was not run.** The fluxiq declaration build is blocked by the 5 errors above.
- **The t200-w4 test fixes.** Failures 3 to 6 are not fixed and not re-checked against w4's final state.

## Open questions or contradictions found

1. **One-line fixes outside my ownership** that make `tsc` clean. The brief asked that `maxEvidenceBytes` not be passed to `executeTool`; these are the remaining pass-throughs.
   1. `R/flow-bootstrap/person-needed.ts:142`: delete `maxEvidenceBytes: call.maxEvidenceBytes, `.
   2. `R/llm/harness-options/registry.ts`: delete `maxEvidenceBytes: number;` at `:77`, drop `maxEvidenceBytes` from the destructure at `:203`, and delete `maxEvidenceBytes,` at `:210`. This clears `flow-bootstrap/action-permissions.ts:188` and `recovery/runtime-exploration.ts:288`.
   3. `R/llm/harness-options/option.ts:69` and `binding.ts:120,406`: delete `maxEvidenceBytes`. This is the public option-execution contract, and the domain no longer reads it. Then update `harness-options/tests/binding.test.ts:93`.
   4. `R/tests/service-bootstrap/tests/generation.test.ts:1,181-185`: drop the `AUTOMATION_STUDIO_EVIDENCE_CONTEXT_BYTES` import and the `maxEvidenceBytes` expectation.
2. **Web UI text still says 64,000.** `apps/web/.../settings/FlowSettingsView.tsx:331-335` (not mine) still reads "Core hard ceiling of 64,000 total tokens" and has `max={64000}` on three inputs. `settings-view.test.tsx:130` asserts that text. Both should read `FLOW_LLM_HARD_MAX_TOKENS`.
3. **Size-less failures in one band.** The harness estimates characters ÷ 4, and the adapter estimates UTF-8 bytes ÷ 3. A request of roughly 2.98M to 3.97M bytes passes the harness and is refused by the adapter as `llm.provider_input_budget_exceeded`.
   - The recorded diagnostic of a pre-flight refusal is replaced by the safe sentence (`provider-contract.ts` `safeProviderFailureMessage`). In that band the stored failure carries the code but not the size.
   - Using bytes ÷ 3 in `harness/token-limits.ts` `estimateTokens` would make the harness refusal the loud one every time. I did not do it, because it changes estimates in w4's harness tests.
4. **Recovery ledger sized at the window.** `harness/run.ts` reserves `tokenLimits.maxInputTokens`, now 992,000, per call against the run-budget ledger. Only recovery uses a ledger (`recovery/annotation/run-budget.ts`, w4's), and it sizes its pot from the same limits. t200-w4 should confirm that recovery's token pot and per-call reservation still admit calls at the window profile.
5. **Credential in an explored packet no longer refused.** `deepseek-evidence-preflight.test.ts:93` sends `Bearer …` inside an explored packet, and the harness now returns `ok: true`. If D5 withholding replaced the value, the test needs updating. If not, it is a screening regression. This is w4's call.
6. **Kept deliberately:**
   - `answer-check.ts` still removes an earlier look when a fresh look finds the page "exactly as before".
   - `run-node.ts:44` `MAX_ENUMERATED_NODES = 400` still caps the node library, not the page.
   - `progress-trace.ts` `MAX_LISTED` applies to the log only.
   - `MAX_AMENDMENTS_PER_DECISION` bounds the model's output.
7. **Structure baseline.** The audit reports that one baseline entry can be lowered. The Core baseline file is not mine to regenerate.
