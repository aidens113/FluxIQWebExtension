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

## Checked point 2: threading (H1b), node timing (H2), content gestures (H3) (2026-11-10)

### What now works in code
- **Run to page.** A run's `humanness` reaches the content script along this path:
  - It is set in the FluxNode options or the answer-first caller options, and enters the graph options through the one `flow-run.ts` spread.
  - From the graph options it goes to the node attempt's dispatch context, then `runtime.dispatch`, then `ClientGatewayActionCommand.humanness`.
  - The domain mapping passes it through unchanged to `BrowserActionCommand.humanness`, which click, type and scroll read.
  - A command whose run set nothing carries no `humanness` key. `io-policy.test.ts` proves this by equivalence: the level-0 command deep-equals the level-60 command minus the field.
  - Precedence: the run's own value wins, 0 included. Otherwise `server-command-channel.ts` stamps the person's saved setting when it is above 0, and otherwise the action object passes unchanged.
- **H2 node timing (Core).** `engine/automation/pacing/human-pause.ts` is a pure function of (level, run seed, node id, arrival ordinal). One line in `step-loop/arrival.ts` applies it once per node's first arrival.
  - With b = level/100, the pause is `1000*b*(0.8*E + reading)`, where E is exponential with mean 1. A reading pause of 2*(0.5+u) s happens with chance 0.2*b. The mean is about 8 ms at level 1 and about 1.2 s at level 100.
  - The run's seed is set at run start when the level is above 0, from the run's start time. Child frames inherit it through the options spread.
  - The seed is recorded as `trace.humanness: { level, seed }`, present only above 0.
  - Level 0 adds no await and no trace key. The evidence-based 429/503 pace is unchanged.
- **H3 content (extension).** The new module is `content/action-runtime/humanness/`. Each command's generator is `humannessRandom(humannessSeedOf(commandId))`, so the step log's command id reproduces every choice.
  - **Click:** only a press the gate accepted at the centre is re-aimed. The new point is near the centre: inset 20% per side (at least 2 px), within 40 px, spread 0.4 x reach x b. It must be strictly inside the visible box, pass the gate's own hit test on the target, and land on the same control as the centre's hit; otherwise the gate's point is used. Events still go to the target.
  - **Typing:** a right-skewed gap with mean 160 ms x b, and a 5% chance of a hesitation of 2-6 gaps. The events and the final value are the same. Number and date inputs keep their whole-value path.
  - **Scroll:** one right-skewed dwell with mean 900 ms x b, after the move.
  - **Timing budget:** all pauses together are planned to fit within 40% of the command's own time. A longer plan is scaled down, never failed.
  - Robot-check waits and the press's watch windows are untouched. At level 0 no point is drawn and nothing new is awaited.
  - The worker checked its own safety test by breaking the code: with the hit test removed, the covered-badge fallback test failed.

### Per-worker summary
| Worker | Tier | Outcome | What I verified or changed |
| --- | --- | --- | --- |
| h1b-threading | worker (Sonnet) | Partial (chat leg needs other lanes' files) | Read every diff. **Reverted** its new `@fluxiq/contracts` dependency on `domain`: the package.json entry, the hand-edited `pnpm-lock.yaml` and a junction in `domain/node_modules`. The mapping now passes the number through, and the content script normalises it as it reads it. **Moved** `humanness` onto the `effectDispatcher` context type in `graph-execution-options.ts`, replacing an intersection type in `attempt.ts`. **Rewrote** the level-0 test: the old one compared the command's keys against a list filtered by those same keys. Confirmed that `runtime/service.ts` spreads the command, so the field survives. Confirmed that Core's append-turn reader reads named fields only, so the relay's extra field is ignored rather than refused. |
| h2-node-timing | worker (Sonnet) | Partial: engine may not import `@fluxiq/contracts/automation` (audit rule) | **Exported** humanness from `@fluxiq/contracts/runtime` as well, since it is a neutral run option, and switched the three engine imports to it. The Core audit now passes. graph-run.ts has 4 changed lines, not 2: the import, the seed fill in `executionOptions`, one `humanness` const and the `defended` spread. |
| h3-content | worker-heavy (Opus) | Done | Read the click hook and `aim-press.ts`. Reran its tests inside the 495-test set below. |

### Integration changes I made
- New shared generator in `packages/contracts/src/humanness/{random,seed-of}.ts`, with tests: a seeded mulberry32 and an FNV-1a text-to-seed function. Both are exported from `./automation` and `./runtime`.
- `packages/contracts/src/runtime.ts` now re-exports `./humanness`.
- The domain dependency revert and the pass-through mapping (`domain/src/client/gateway-mapping.ts`), with its test updated.
- The `effectDispatcher` context type in `graph-execution-options.ts`, the intersection removed from `attempt.ts`, and the equivalence test in `io-policy.test.ts`.

### Chat runs: the exact lines still needed, outside W2's approved files, for the lead to route
The extension already sends `humanness`, when it is above 0, on `append-turn` (`background/panel/conversation-relay.ts`; no `src/panel/**` file was needed). Core's request readers for `generate-flow-bootstrap-adaptation` already accept and validate it (`flow-bootstrap-requests/generate.ts`, `flow-bootstrap-commands/generation/request.ts`). Two gaps remain.
- **Turn to request (Core conversations):**
  - `api-contracts/automation.ts` `ConversationTurnAppendRequest`: add `humanness?: number`.
  - `service/conversation-requests/append-turn.ts:~47`: pass `payload.humanness` into `commandContext(...)`.
  - `service/conversation-requests/command-context.ts:14,36`: carry it on the context.
  - `runtime/conversations/commands/command.ts:~103`: add it to the context type.
  - `runtime/conversations/commands/build.ts:197,254`: add `humanness` beside `interpretationCalls` in the generation request.
  - `commands/run-flow.ts:70`, plus `run-requests/run-session.ts:19-75`: pass it to the run-session options.
- **Request to graph run (Core service, W1's answer-first).** `service.ts:~1493` reads `humanness` from the validated request, but `flow-run.ts` sees only `ports.input.caller`. Recommended:
  - add `humanness?: number` to the flow-run ports input (`answer-first/flow-run/ports.ts:28`);
  - pass the request's value into it from the attempt and the service;
  - change the one `gatedOptions` spread to `ports.input.caller?.humanness ?? ports.input.humanness`.
  - Do not route it through `caller`: a defined `caller` changes `run-attempt.ts:198` (judge confirm), `ending.ts:79`, `keep.ts:54` and `caller/applied.ts:17`.
- **Until both land:** chat runs get human-like clicks, typing and scrolls through the extension's saved-setting stamp, but no Core node pauses.

### Commands run and observed results (by me)
- `pnpm --filter @fluxiq/contracts exec vitest run src/humanness src/tests/client-gateway.test.ts` -> 6 files, 21 tests passed.
- `pnpm --filter fluxiq exec vitest run` over pacing, step-loop, graph-run.test, node-execution, io-policy.test, client-gateway-transport.test, generation-request.test, flow-bootstrap-requests, answer-first/flow-run and answer-first/caller -> 348 of 349 passed. One `flow-run.test.ts` test ("...past the default hundred nodes...") timed out at 60 s while 45 files ran beside an extension test run. Rerun alone: `pnpm --filter fluxiq exec vitest run .../answer-first/flow-run/tests/flow-run.test.ts` -> 23 of 23 passed, that test in 8.6 s. It sets no humanness; the only new code it reaches is a guarded comparison.
- `cd domain && DOMAIN_TEST_BUILD_LABEL=t898-int node scripts/test-domain.mjs client/tests/gateway-mapping` -> 47 of 47 pass.
- `cd apps/extension && node .../heavy-slot.mjs run t898 -- node scripts/test-extension.mjs` over content/actions/tests, content/action-runtime/tests, humanness/tests, keyboard/tests, server-command-channel, conversation-relay, storage-settings, saved-state and settings-save -> 495 tests, 495 pass, 0 fail.
- Core `pnpm structure:check` -> "structure-audit: passed (529 warning(s), 969 baselined)". Extension `node scripts/structure-audit.mjs` -> "structure-audit: passed (245 warning(s), 552 baselined)".
- Heavy chain through the slot, the clean extension check the lead asked for:
  - The command: Core `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket --filter @fluxiq/sdk --filter @fluxiq/ui-components build`, then `pnpm --filter @fluxiq-web-extension/domain build`, `... domain check` and `... extension check`, each through `heavy-slot.mjs run t898`.
  - **Not yet run.** It had been queued since about 18:28 and had not got a slot by 19:01: `lead-sweep` and `t897` held both slots from 02:39Z (see open question 7).
  - Its log is `C:/Users/osrs_/AppData/Local/Temp/claude/bc302d3e1bd85154/1d7e40a9-22b4-41e1-ad74-ba7e457da62b/scratchpad/chain2.log` (lines `CORE_BUILD_EXIT`, `DOMAIN_BUILD_EXIT`, `DOMAIN_CHECK_EXIT`, `EXT_CHECK_EXIT`). It may not outlive this hand-back.
  - Earlier facts: the domain build alone passed (`DOMAIN_BUILD_EXIT 0`, through the slot). The extension check before this round failed only because Core's dist was stale after my contracts edit; it refused to compile, and no TS errors came from our code.

### Open questions for the lead
1. Route the chat lines above (Core conversations and W1's answer-first ports), or tell me to take them.
2. graph-run.ts has 4 changed lines, not the 2 allowed. Accept them, or move the seed fill into `pacing/` behind a one-line call?
3. H3 dwells once after a scroll-until-stable, not once per pass, because the growth polling already paces the passes. Say if you want a dwell per pass.
4. `docs/architecture/` has no humanness page yet. I propose one in H5 (levels, what each level changes, seed and replay, safety lines), unless W3's FluxNode docs should own it.
5. **W3's `pace.minStepGapMs`: merge t899 (af6bf1705) into task/t898-humanness so I can wire it.**
   - Already done: `automationStudioHumanPauseMs(level, seed, nodeId, ordinal, minStepGapMs?)` returns max(human pause, floor). A floor set at level 0 still waits; level 0 with no floor stays 0. `pacing/tests/human-pause.test.ts` -> 7 of 7 pass.
   - Not wired: `runtime/run-overrides` is not in this tree. Once it is, the `arrival.ts` hook stays one line: it reads `automationStudioRunOverrides()?.pace?.minStepGapMs`, waits when the level is above 0 or the floor is set, and passes the floor to the pause function. A graph-run test will show a level-0 run with no override never calling `delay`.
   - The floor applies before each node's first arrival. The gap since the previous step ended is therefore at least `minStepGapMs`, and slightly more when routing takes time.
6. **H4 needs one approval: a "may misclick" mark on the command, which absent means never.**
   - The rule is no misclick on a lasting-act step. Only Core knows whether a step is lasting (`engine/automation/defensive/lasting-act.ts`: the node mutates, or `metadata.declaredConsequences` holds a class), and the command carries nothing about it.
   - "Not known lasting" is not "known not lasting": Core's own header says an undeclared press may still commit. So the safe signal is a positive one.
   - Proposal: Core sets `humannessMisclick: true` on a command only when the level is above 0 and the node is known not lasting (it declares an empty consequence list and does not mutate).
   - Files: the gateway and runtime command types (field only), the node-attempt dispatch context (`attempt.ts`, reading the existing lasting-act check), `io-policy.ts` (copy), the transport (copy), the domain type and the gateway mapping (copy).
   - Without the mark, the content script never misclicks.
   - The content side follows the lead's lines: an inert point next to the target, verified non-interactive (no control, link, input or handler on it or its ancestors) and never on another control; then the real press as today.
   - H4 is ready to dispatch (worker-heavy) once the mark is approved. Without approval it can be built with misclicks unreachable, which proves nothing live.
7. **The heavy-slot helper can starve a lane (found 2026-11-10 18:49).**
   - My heavy chain waited more than 20 minutes while `lead-sweep` and `t897` took the freed slots again and again, under new pids each time.
   - Cause: `fxwork/.tools/heavy-slot.mjs` has no queue. Every waiter polls every 5 s and whoever's `mkdir` wins takes the slot, so a lane that chains jobs back to back usually wins.
   - Fix (the helper is yours; I did not touch it): a ticket queue. Waiters take an increasing ticket file, and a slot goes only to the lowest live ticket.
8. Next on resume: H4 inert misclicks (worker-heavy; `content/actions/click.ts` and `humanness/`), then H5, the Lab measurement on two realistic sites, provider-free first.
