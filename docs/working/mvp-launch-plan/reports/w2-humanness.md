# W2 Humanness (lane t898): sub-supervisor report

## Checked point 1: H1 contract and settings field (2026-11-10)

### Outcome
Partial: the I1 fields exist in both worktrees. Their narrow tests, Core's library build (which covers the fluxiq typecheck), the domain check and both structure audits pass. Two things are still open:
- The extension check fails only on a missing `domain/dist` in this fresh worktree, not on our code. A clean rerun waits for memory.
- Threading the value from run options to the browser command needs files outside W2's owned paths, so it waits for the lead's approval (see "Approval needed" below).

### What exists now (I1 is in place; other lanes can build on it)
- **Core `@fluxiq/contracts`**, root and `@fluxiq/contracts/automation`:
  - `HUMANNESS_MIN` (0), `HUMANNESS_MAX` (100), `HUMANNESS_DEFAULT` (0);
  - `type Humanness`;
  - `humannessSchema` (zod int 0..100);
  - `normalizeHumanness(value: unknown)` (rounds and clamps a finite number, else 0).
  - New directory `packages/contracts/src/humanness/` (bounds, humanness, schema, normalize, barrel, tests). `automation.ts` re-exports it.
- **Core options:**
  - `fluxNodeOptionsSchema.humanness`. `FluxNodeResolvedOptions.humanness?` is set only when the declaration or an override sets it, the same way `model` is, so existing resolved-options tests are unchanged.
  - Answer-first caller options accept `humanness`, validated with `humannessSchema`.
  - `AutomationStudioAnswerFirstCallerOptions.humanness?` and `AutomationStudioGraphExecutionOptions.humanness?`. Nothing reads them yet.
- **Extension `FluxIQSettings.humanness?: number`.** It is optional and absent means 0, so every existing typed settings literal and equality test stays unchanged.
  - The saved-state reader keeps a valid value, clamps an out-of-range number and reports it repaired, and drops a non-number.
  - The panel save merge (`background/panel/settings-save.ts`) keeps a finite number, normalised. Any other value leaves the current one, so W4's slider only has to send `humanness` in `panelSaveSettings`.
  - `storage.ts` normalises the value on write.
- **Domain `WebAutomationActionCommand.humanness?: number`** (`BrowserActionCommand`): the field only. Nothing sets it yet.

### Per-worker summary
| Worker | Tier | Brief | Outcome | What I verified |
| --- | --- | --- | --- | --- |
| h1-core | worker (Sonnet) | Core contracts module, FluxNode options, caller options, graph options | Done (fluxiq typecheck not run: memory) | Read the whole diff and reran its tests. I made one fix of my own: the caller reader now validates with `humannessSchema` instead of a hard-coded 0..100. |
| h1-extension | worker (Sonnet) | Settings field, saved-state, save merge, storage, domain command field | Code done, checks not run (memory) | Read the whole diff and ran its tests myself. I made one fix of my own: imports moved from `@fluxiq/contracts` root to `@fluxiq/contracts/automation`, the subpath the extension already uses. |
| core-map | Explore (Haiku) | Core chain: run options to caller to graph to dispatch, node timing, step log, chat request | Map returned | Used for the approval list below; not independently re-traced line by line |
| ext-map | Explore (Haiku) | Extension chain: gateway command to content, settings save, chat relay, click/type/scroll code | Map returned | Confirmed `saved-state.ts` and `settings-save.ts` copy fields one by one, which is why both needed edits |

Worker reports: `reports/w2-humanness/h1-core.md`, `reports/w2-humanness/h1-extension.md`.

### Paths touched beyond the brief's literal list (my call, flagged)
- `apps/extension/src/background/saved-state.ts` and `background/panel/settings-save.ts`. Both rebuild settings field by field, so without these edits the value would be dropped on every save and read. I treated them as part of "background storage normalisation". `background/panel/` is background code, not W4's `apps/extension/src/panel/**`.
- `domain/src/actions/types.ts`: the field only. `BrowserActionCommand` is an alias of this domain type, so I1's "`humanness` on each `BrowserActionCommand`" can only live here.

### Commands run and observed results (by me)
- `pnpm --filter @fluxiq/contracts exec vitest run src/humanness src/fluxnode/spec` -> 8 files, 32 tests passed.
- `pnpm --filter fluxiq exec vitest run src/framework/automation-service/service/answer-first/caller` (after my edit) -> 5 files, 23 tests passed.
- `pnpm --filter @fluxiq/contracts check` -> exit 0 (build-cache reuse: inputs match the stamp). `dist/automation.d.ts` exports `./humanness/index.js`.
- `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=t898-h1 node scripts/test-extension.mjs background/tests/storage-settings background/tests/saved-state background/panel/tests/settings-save` -> 16 tests, 16 pass, 0 fail.
- `node scripts/structure-audit.mjs` (extension) -> "structure-audit: passed (245 warning(s), 552 baselined)".
- `pnpm structure:check` (Core), rerun after my caller edit -> "structure-audit: passed (529 warning(s), 969 baselined)".
- When memory rose to 4.1 GB: `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket --filter @fluxiq/sdk --filter @fluxiq/ui-components build` (Core worktree) -> every package "build: Done", exit 0. This compiles fluxiq with `tsc -b`, so it is the fluxiq typecheck.
- `pnpm --filter @fluxiq-web-extension/domain check` -> exit 0 ("FluxIQ Core's build ... is current with its source").
- `pnpm --filter @fluxiq-web-extension/extension check` -> exit 1, with 14 `error TS` lines. Every one is in `packages/test-runner/src/offline-snapshot-page/*` or `apps/extension/e2e/content/tests/offline-reads/tests/*`: TS2307 "Cannot find module '@fluxiq-web-extension/domain/node'" and the TS7006 implicit-any errors that follow from it. This fresh worktree has no `domain/dist`, and that export resolves there. No error is in a file this lane changed.

### Not verified
- A clean `pnpm --filter @fluxiq-web-extension/extension check`. It needs `pnpm --filter @fluxiq-web-extension/domain build` first so that `domain/dist` exists. By then free memory had fallen to 1.2 GB, under the 2.5 GB floor, so neither has run. Rerun both when memory allows.

### Approval needed: threading the value (H1b), files outside W2's owned paths
Nothing reads the field yet. Making a run's level reach node timing and the content script needs three legs. The dispatch path today carries only actionType, parameters, target, timeoutMs and metadata (`runtime/client-gateway-transport.ts` `actionCommandFromRuntime`). The node `context` carries no graph options (`engine/automation/node-execution/attempt.ts:234-245`).

- **Leg A: Core run to the browser command.** A top-level `humanness` is set on a command only when the run's options set it, so level-0 commands stay byte-identical.
  - Core `packages/contracts/src/client-gateway.ts` (`ClientGatewayActionCommand.humanness?`).
  - `packages/fluxiq/src/runtime/contracts.ts` (`FluxIQRuntimeCommand.humanness?`).
  - `runtime/client-gateway-transport.ts` (copy the field).
  - `framework/automation-service/io-policy.ts` (set it from the dispatch context).
  - `engine/automation/node-execution/attempt.ts` (`effectDispatchContext` carries `options.humanness`).
  - Extension `domain/src/client/gateway-mapping.ts` (copy and normalise it onto the action).
- **Leg A threading.** Core `service/fluxnode/caller-options.ts` (W3's directory: one line beside `model`). Core `answer-first/flow-run/flow-run.ts` `gatedOptions` (W1's `answer-first/**`: one spread), plus `KeptCallerOptions` if a continued attempt must keep the level.
- **Leg B: the extension setting to Core for chat runs.** Core's node timing needs the level for runs started in chat.
  - Extension `background/panel/conversation-relay.ts` `turnPayload`.
  - Core: the conversations append-turn reader, `runtime/conversations/commands/build.ts`, `flow-bootstrap-requests/generate.ts` and `generation/request.ts` allowlists, and `api-contracts/automation/adaptation.ts`.
  - Validated at the request reader, never passed as code-only caller options (`service.ts:1493` treats those as unreachable from a request body).
- **Leg C: fallback stamp.** Extension `background/connection/server-command-channel.ts`: before `executeAction`, a command that carries no `humanness` gets the person's saved setting. Precedence: the run's own option wins, otherwise the extension setting.
- **Recommendation: approve A, A-threading, B and C.** Without B, chat runs get content-side humanness through C but no Core node timing. Each edit adds a field or a pass-through, and nothing changes at level 0.
- **Node timing and the seed (H2).** The one per-node await is `engine/automation/step-loop/arrival.ts:68`, outside `pacing/**`. The run's seed belongs on the trace at `engine/automation/graph-run.ts` (around 205 and 469). Both are engine files outside `pacing/**` and need approval: a one-line hook at each, with the logic in `pacing/**`.

### Open questions for the lead
1. Approve the H1b file list above (legs A, A-threading, B, C) and the two H2 hook lines?
2. Content work that needs no approval (H3 click jitter, typing cadence and scroll dwell in owned content paths) starts on resume. It derives its seed from the command id until Leg A carries a run seed.
