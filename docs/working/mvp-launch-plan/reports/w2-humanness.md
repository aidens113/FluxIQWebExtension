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

## Checked point 3: step-gap floor, seed in pacing, chat path, H4 misclicks (2026-11-10)

### What changed
- **W3's step-gap floor is wired.**
  - New `pacing/arrival-pause.ts` (`automationStudioArrivalPauseMs`) reads `automationStudioRunOverrides()?.pace?.minStepGapMs` and returns max(human pause, floor).
  - At level 0 with no floor it returns 0, and `arrival.ts` awaits nothing. At level 0 with a floor it waits the floor.
  - `arrival.ts` now has a comment and two lines: compute the pause, await it only when above 0.
- **Seed setup and record moved into pacing.**
  - `pacing/humanness-seeded.ts` and `pacing/trace-with-humanness.ts`. Each returns the very same object at level 0.
  - graph-run.ts now has no added lines. Three existing lines are edited: the `./pacing/index.ts` import, the `executionOptions` line (one call) and the `defended` line (one call).
  - I did not reach a single line: the record must be attached where `defended` is built, because graph-run tracks the finished trace by object identity (`repeatTraceProvenance.copy`, `withheldBySavedTrace`, `executedLocations.remember`). A wrapper copying the returned trace would break those maps.
- **Chat path (chat-path worker, Sonnet).**
  - Core reads `humanness` on append-turn (validated; a bad value is refused before the turn is written), carries it on the command context, and adds it to the generation request in `commands/build.ts` and to the run-session request in `commands/run-flow.ts`. The run-session reader accepts and validates it.
  - The extension's explicit Flow run (`background/automation-relay/automation-relay.ts`) sends the saved setting when it is above 0.
  - Outside the brief, and accepted by me:
    - `service/runtime-session/run-input.ts`: a type field.
    - `apps/extension/src/background/index.ts`: one wiring line, `humanness: () => manager.currentSettings().humanness`.
- **H4 misclicks (worker-heavy, Opus).**
  - **The Core mark.** `humannessMisclick: true` is set only when humanness is above 0, the node declares an empty consequence list, and Core's own `automationStudioNodeActLasts`, `automationStudioNodeMutates` and `automationStudioNodeExplicitLastingRisk` all clear both the node and the dispatched output. The transport, `io-policy` and the domain mapping copy it only when it is `=== true`.
  - **The content side.** `content/action-runtime/humanness/misclick/**`. At most one misclick per marked command, with chance 8% x level/100, made before the real press.
  - **Refusals.** It never misclicks while a dialog, popover, menu, listbox or overlay is open, never on a backdrop, and never on a point where the hit element or any ancestor (through shadow roots) is interactive: a link, button, form control, label, summary, control role, tabindex, contenteditable, inline or property `onclick`, or cursor pointer. The point is always outside the target's box.
  - **After a misclick.** If it changed the page, the target is measured again before the press. The press itself is unchanged.
  - **Tests.** One per refusal, plus a positive case showing the press is identical with and without the mark.

### Integration changes I made
- `pacing/{arrival-pause,humanness-seeded,trace-with-humanness}.ts` with `pacing/tests/humanness-helpers.test.ts`, and the floor case in `pacing/tests/human-pause-run.test.ts`. That run test shows a level-0 run under a 400 ms floor waiting `[400, 400, 400]` and an empty frame waiting `[]`.
- The pacing imports of the engine's types now go through `../index.ts` (the Core audit's barrel rule).
- **Correction from me.** The "half-built contracts dist around 19:16" that H4 found and rebuilt was mine: I stopped the old build chain, as the lead asked, while its Core build was running. Nothing else was affected.

### Decisions in workers' reports I accepted
- H4's misclick draws from its own stream, seeded by the same command id, not H3's generator. H3 also draws on a second press, so drawing first from H3's stream would move that second aim. Each command still replays from its command id.
- H4's `open-layer.ts` holds a 10-line private copy of `outermostFixed`, because the `content/action-runtime/interference/` barrel does not export it and that directory is not W2's. **Ask:** let me add one export line to `interference/index.ts` and drop the copy.

### Still needed for chat runs to pause nodes in Core (exact lines, outside W2's files)
- `framework/automation-service/service.ts:~2487`: pass `humanness: input.humanness` to the runtime session.
- `framework/automation-service/service/runtime-session/graph-options.ts`: `humanness?: number` on `RunGraphOptionsInput` (~56), and `if (input.humanness !== undefined) options.humanness = input.humanness;` in `runGraphOptions` (~101).
- The answer-first leg through the flow-run ports' input, after t897 lands (approved; I make it when you say).
- Until these land, chat and explicit runs reach the page's clicks, typing and scrolls through the extension's saved-setting stamp, but Core node pauses only when the run's own options set the level.

### H5 started: the architecture page
- `docs/architecture/humanness.md` (Core) covers:
  - level 0 as today's path, and the tests that hold it;
  - what each level changes, with the formulas;
  - the safety lines, including the misclick mark and the page-side refusals;
  - seeds and replay;
  - the developer's least step gap;
  - where the level travels.
- It is indexed in `docs/architecture/README.md`.
- It does not link to W3's FluxNode overrides page yet, because that page is not in this tree. W3 links to this one.
- `node scripts/structure-audit.mjs --rule docs-links` -> passed. The `docs-reference.mjs --check` half of `pnpm docs:check` was not run; this page adds no generated reference.

### H5 Lab measurement needs paths (ask)
- Nothing in the Lab knows humanness yet. A provider-free attempt is `pnpm lab attempt --scripted-model ...` (`scripts/lab/provider-free-run.mjs`).
- To measure levels 0, 50 and 100 on two realistic sites, the Lab needs a `--humanness <0-100>` option that saves the level in the Lab browser's extension settings before the attempt. That edits `packages/test-runner/**` (extension setup) and `scripts/lab/**` (argument parsing), which are outside W2's paths.
- What I would measure, at `--attempts 4`, on everything-store and job-board:
  - the same verdict, model calls and Flow at all three levels;
  - level 0's per-step wall times within noise of a run without the option, and no `humanness` key in commands or the trace;
  - added time per step growing with the level;
  - the count of misclicks and their points, all inert, with no layer open;
  - no extra robot-check pauses.
- Provider-free first. A live run only after you approve it in a report.
- **Ask:** grant those two paths for H5, or route the option to the lane that owns the Lab.

### Validation for checked point 3 (all run by me)
- `pnpm --filter fluxiq exec vitest run` over pacing, step-loop, graph-run.test, node-execution, io-policy.test, client-gateway-transport.test, conversation-requests, run-requests, commands/tests/build.test and commands/tests/run-flow.test -> 27 files, 296 tests passed.
- `pnpm --filter @fluxiq/contracts exec vitest run src/humanness src/tests/client-gateway.test.ts` -> 6 files, 21 tests passed.
- `heavy-slot run t898 -- pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket --filter @fluxiq/sdk --filter @fluxiq/ui-components build` -> `CORE_BUILD_EXIT 0`. This compiles every Core library with `tsc -b`.
- `cd domain && DOMAIN_TEST_BUILD_LABEL=t898-int node scripts/test-domain.mjs client/tests/gateway-mapping` -> 48 of 48 pass.
- `heavy-slot run t898 -- node scripts/test-extension.mjs` over content/actions/tests, content/action-runtime/tests, content/action-runtime/humanness (H3 and H4 misclick tests), keyboard/tests, server-command-channel, conversation-relay, automation-relay, storage-settings, saved-state and settings-save -> 536 of 536 pass, 0 fail.
- One slot, run back to back:
  - `pnpm --filter @fluxiq-web-extension/domain build` -> 0.
  - `pnpm --filter @fluxiq-web-extension/domain check` -> 2: one TS2379 in the H4 worker's test (`gateway-mapping-humanness.test.ts:27` passed `humanness: undefined`, which `exactOptionalPropertyTypes` refuses). I fixed the test with a cast and a comment, reran the domain tests (48 of 48), then reran `heavy-slot run t898 -- pnpm --filter @fluxiq-web-extension/domain check` -> exit 0.
  - **`pnpm --filter @fluxiq-web-extension/extension check` -> exit 0, the clean extension check.**
  - `node scripts/structure-audit.mjs` -> "passed (245 warning(s), 552 baselined)".
- Core `pnpm structure:check` -> "structure-audit: passed (529 warning(s), 969 baselined)". It failed first on my three new pacing files (imports past the engine barrel); fixed. Core `node scripts/structure-audit.mjs --rule docs-links` -> passed.
- The new slot queue works: each heavy step waited its turn. I bundled the four dependent extension steps into one slot run, so they did not re-queue three more times.

### Not verified
- Live browser behaviour of the click aim, typing cadence, scroll dwell and misclicks: the real cursor, `:popover-open`, shadow DOM and real overlays. That is H5.
- A run end to end from Core to the content script, and chat runs reaching Core node pauses (needs the lines above).
- The `docs-reference.mjs --check` half of `pnpm docs:check`.

## Checked point 4: receiving ends for chat runs, the interference export, and H5's Lab option (2026-11-11)

### What changed
- **The chat and explicit-run receiving ends (Core), granted.**
  - `service/runtime-session/graph-options.ts`: `RunGraphOptionsInput.humanness`, copied into the graph options when set; absent adds no key.
  - `service/answer-first/attempt/contracts.ts`: `AutomationStudioAnswerFirstAttemptInput.humanness?` (one type field; the flow-run ports input is a `Pick` of it, so this is its root). t897 did not touch this file.
  - `flow-run/ports.ts`: Picks `humanness`.
  - `flow-run/flow-run.ts`: a `const humanness = caller?.humanness ?? input.humanness` line plus the spread. That is one const and one edited line, because `exactOptionalPropertyTypes` cannot narrow the `??` inline. My first inline version failed the Core build with TS2375; the H5 worker found it and wrongly blamed another lane.
  - These go live when the `service.ts` line puts `humanness` on the attempt input and the runtime-session input (serial behind t885).
- **The interference export.** `outermostFixed` is exported from `content/action-runtime/interference/index.ts`, and H4's private copy in `humanness/misclick/open-layer.ts` is gone.
- **H5 Lab option (worker, Sonnet).** `pnpm lab attempt ... --humanness <0-100>` is validated at parse time and passed in the settings of the Lab's `fluxiq.connect`. The background spreads those over the stored settings and normalises them, so the level is saved. Absent writes nothing. Files: `packages/test-runner/src/commands.ts`, `attempt-lane/live/run-attempt-command.ts`, `attempt-lane/live/attempt/session.ts`, and the test `attempt-lane/tests/lab-attempt-command.test.ts`.

### H5 measurement: blocked, with its cause and how far it got
- **Runs.** 8 provider-free runs went through the slot with `--priority`, with no guard refusals and no provider used. The detail is in `reports/w2-humanness/h5-lab.md`, Part 2.
- **everything-store.** Its only provider-free script is built to fail (a wrong answer with a repeated act). Attempt 1 is "wrong" at every level (15-19 s, 10-11 scripted calls), so attempts 2-4 never run. Nothing about humanness can be judged from it.
- **company-website-apprentices** (the stand-in for job-board, which has no provider-free script). It is refused at the baseline and at 0, 50 and 100: "expects no request 2 of kind loop_verification". That is script drift in a script file W2 does not own, and the baseline fails the same way, so humanness did not cause it.
- **Not observable: the run records hold neither the level nor misclicks.**
  - This is a gap in W2 against the decision "randomness comes from a seeded generator recorded in the step log".
  - Core's seed and level are on the trace. But the page's choices come from the command id plus a level the action result never states.
  - The step log therefore cannot show whether a command ran at 0 or 80, nor where a misclick landed.
- **Timing.** No trend by level (page.click 188-268 ms at every level). That is consistent with aiming adding no time, and with these runs having little typing or scrolling, but it proves nothing until the level is recorded.

### Proposal (needs your yes): record humanness on the action result
- The content script's result for a command run above 0 carries `humanness: { level, aimed: true|false, misclick?: { x, y } }`. At 0, or with no level, nothing is added, so level-0 results stay byte-identical.
- Files: the content verbs and `humanness/**` (W2's), the domain result type and `webAutomationActionResultPayload` in `domain/src/client/gateway-mapping.ts` (copy when present).
- Core already stores the payload in the step files. I will confirm no strict reader drops or refuses it.
- With that in place, H5 can count stamped commands and misclicks from the step files.
- **Scripts.** H5 also needs a provider-free script that passes on each of the two sites. Fixing everything-store's deliberate failure, or company-website's drift, is in the Lab's scripts; route it to their owner, or grant me the two script files.

### Validation (run by me)
- `pnpm --filter fluxiq exec vitest run .../answer-first/flow-run/tests/humanness.test.ts .../runtime-session/tests/graph-options.test.ts` -> 2 files, 6 tests passed. Then the whole `answer-first/flow-run` directory plus graph-options -> 17 files, 92 tests passed.
- `heavy-slot run t898 -- <Core library build>` after the TS2375 fix -> `CORE_BUILD_EXIT 0`.
- Core `pnpm structure:check` -> passed (530 warnings, 969 baselined).
- `test-extension.mjs content/action-runtime/humanness content/action-runtime/tests/actionability content/actions/tests/click` -> 123 of 123. Extension `node scripts/structure-audit.mjs` -> passed (245 warnings, 552 baselined).
- H5 worker: test-runner build -> exit 0; `node --test` on lab-attempt-command and attempt/tests -> 19 of 19 (including `--humanness`). The Lab built the extension itself after the interference edit, and its build runs the extension typecheck.
- Not run this round: a separate `pnpm --filter @fluxiq-web-extension/extension check` (the Lab's extension build covered the compile).

## Checked point 5: the level recorded on action results, script drift fixed, H5 measured provider-free (2026-11-11)

### What changed
- **Recorded on the action result (worker, Sonnet).**
  - Above level 0, click, type and scroll results carry `humanness: { level, aimed, misclick?: { x, y } }`: new `content/action-runtime/humanness/record-humanness.ts`, with hooks in `content/actions/{click,type,scroll}.ts` and `humanness/misclick/before.ts`.
  - The domain result type has the field, and `webAutomationActionResultPayload` copies it when present.
  - At level 0, or with no level, the results deep-equal today's, and tests hold that.
  - **End to end in Core.** Nothing strict drops the payload field:
    - `client-gateway/service/command-ledger/dispatch.ts:232-233` checks top-level keys only;
    - the field is kept through `inbound.ts:160`, `action-result-reading.ts:43` and `io-policy.ts:53/126`.
  - **But Core's step files do not show it for flow steps.** `runtime/llm/step-log/flow-step.ts` writes only `meta.json`. The field is visible only in the explore attempt's model-facing evidence, which means the model sees it. Routing needed, below.
- **company-website-apprentices drift fixed (worker, Sonnet).** The cause was the fixture's size: the script held judge and chat replies for 1 attempt while the series runs 4. It now holds 4 chat and 8 judge replies, the judge's answer unchanged, so the oracle is untouched. Sibling scripts already size by series. The provider-free baseline passes 4/4 (run-mwbv3w5k-64e6d80e).
- **H5 measured.** 8 provider-free runs (company-website and local-classifieds; baseline, 0, 50, 100; `--attempts 4`). Full table and reading in `reports/w2-humanness/h5-lab.md`, Part 3.
  - All passed, 4/4 right, with continuation held and the same calls at every level.
  - Level 0 matches the baseline, with no field.
  - Scroll median: 321 / 339 / 735 / 1371 ms. Type median: 1311 / 1097 / 1929 / 3722 ms. Clicks on local-classifieds are unchanged.
  - The field was recorded at 50 and 100, with 4-6 of 7-8 presses aimed.
  - No misclicks: no step in these Flows declares an empty consequence list.
  - No robot-check pauses added.
  - Not explained yet, from single runs: company-website at level 100 had slower clicks and two long attempts, and local-classifieds at level 100 had one 43.6 s attempt. The machine was shared; a second series would tell.
- **Supervisor's own correction.** The H5 measurement worker ended before its runs did, leaving its driver running unattended. I watched the driver to the end and read every run myself.

### Routing needed (outside W2's paths)
1. **Hide the record from the model:** add `"humanness"` to `PAGE_RECORD_KEYS` in `domain/src/runtime/llm-evidence/node-run/page-record.ts` (one word). Above level 0 the model now sees `humanness` in its press evidence, which is noise to it.
2. **Record it for replays:** Core's `runtime/llm/step-log/flow-step.ts` should write the node result's `humanness` into the flow step's `meta.json`. Then every replay step records its level and choices, which the seeded-generator decision requires.
3. **`service.ts`** after t885 (as planned): Core node pauses for chat and explicit runs.

### Live run: approval asked
- **Proposal:** one live series on company-website-apprentices, which passes provider-free.
  - At `--humanness 0` and at `--humanness 100`, `--attempts 4`, with Claude Haiku. Each series is one build under the $5 Claude allowance; provider-free, attempt 1 used about $0.41 in stand-in pricing.
  - It checks: the same verdicts and Flow at both levels, replays at 0 decision calls, the added time per step kind, and no robot-check pauses added.
- **My recommendation: run it after the `service.ts` line,** so the live series also exercises Core node pauses. Running it now would measure the page side only.

### Validation (run by me)
- `cd domain && DOMAIN_TEST_BUILD_LABEL=t898-int node scripts/test-domain.mjs client/tests/gateway-mapping` -> 51 of 51.
- `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=t898-int node scripts/test-extension.mjs content/actions/tests/click content/actions/tests/humanness content/action-runtime/humanness` -> 126 of 126.
- `test-extension.mjs content/action-runtime/humanness content/action-runtime/tests/actionability content/actions/tests/click` -> 123 of 123. Extension `node scripts/structure-audit.mjs` -> passed (245 warnings, 552 baselined).
- 8 provider-free Lab runs through the slot with `--priority` -> all `"status":"passed"`, `allHeld: true`, run ids in h5-lab.md.
- The record worker's own run: `test-extension.mjs content/actions/tests content/action-runtime/humanness` -> 277 of 277; domain gateway-mapping -> 51 of 51; audit passed. The script worker's run: the script test -> 5 of 5.
- Package checks, one slot run back to back (`heavy-slot run t898 -- bash t898-checks.sh`): `pnpm --filter @fluxiq-web-extension/domain build` -> 0; `... domain check` -> 0; `... extension check` -> 0; `node scripts/structure-audit.mjs` -> passed (245 warnings, 552 baselined). Core is unchanged since checkpoint 4's build (exit 0).

## Checked point 6: per-Flow and per-task humanness, the record hidden from the model and kept on replays, second level-100 series (2026-11-11)

### The user's direction and the precedence built
"humanness slider should be for each individual fluxnode/task/flow" (2026-11-11). The precedence, highest first:
1. an explicit run option (FluxNode options or overrides, the answer-first caller's `humanness`);
2. the task's stored level;
3. the Flow's stored level;
4. the person's starting value (`FluxIQSettings.humanness`, sent with the request);
5. nothing, which is 0 and today's path.

- **The resolver.** `resolveHumanness({ runOption, task, flow, startingValue })` in `packages/contracts/src/humanness/resolve.ts`, with 6 tests, one per step. A stored 0 wins over a starting value. The lead committed it with checkpoint 5.
- **Flow (worker, Sonnet).**
  - Storage: `metadata.humanness`. The reader is `automationStudioFlowHumanness(metadata)` in `service/flow-settings/flow-humanness.ts`.
  - Set or clear: `update-flow-settings` with `flow.metadata.humanness` set to N or null. Refused with a message naming humanness: out of range, fractional, a string.
  - Read: `get-flow-metadata-detail` returns `payload.flow.metadata.humanness` (added by `withFlowHumanness`; the detail is a SQL row without metadata).
  - New Flow: `create-flow` takes an optional `humanness`. It is validated before anything is created, then stored by a settings update, so the creation is two writes, not one atomic one. A crash between them would leave the Flow without a level, falling back to the starting value.
- **Task (worker-heavy, Opus).**
  - Storage: `humanness?` on the task record. The store reader drops an invalid value and keeps the rest of the record.
  - New endpoint `update-task-settings`: request `{ projectId, taskId, humanness: number | null }`, response `{ taskId, humanness: number | null }`. Same permission as rename-task; IAM action `studio:UpdateTaskSettings`; allowed for paired clients so the extension can set it. Refusals: `task.humanness_invalid`, `task.not_found`.
  - `list-project-tasks` rows carry `humanness`.
  - A new task stores the attempt input's starting value; a stored level, 0 included, is never overwritten.
- **Run side (answer-first).**
  - `flow-stage.ts` re-reads the task's level just before the run, so a change made while the attempt was open applies.
  - `flow-run.ts` reads the run Flow's level from the `parentFlow` it already loads.
  - `gatedOptions` calls `resolveHumanness`, and omits the key when the result is undefined.
- **Tests per precedence step** through the real flow-run fixture (`flow-run/tests/humanness.test.ts`, 8 tests): run option over all; task over Flow and starting value; Flow over starting value; starting value alone; none gives no wait; a stored 0 beats a starting value.
- **Not live yet.** Chat attempts and `run-runtime-session` Flow runs read the starting value and the stored levels only once the `service.ts` line lands (serial behind t885): the attempt input's `humanness`, and the run-session's resolve.

### Granted lines
- **The model never sees the record.** `"humanness"` was added to `PAGE_RECORD_KEYS` in `domain/src/runtime/llm-evidence/node-run/page-record.ts`, with a test in `node-run/tests/press-raw-read.test.ts`.
- **Replays record it.**
  - `runtime/llm/step-log/flow-step.ts` writes `humanness: { level, aimed, misclick? }` into a flow step's `meta.json` when the node's result carries a well-formed record, and nothing otherwise.
  - The data comes from one change in `engine/automation/step-loop/step-timing.ts`: the step's outcome now passes the attempt's `outputs`. step-timing is not a step-log file.
  - Tests in `step-log/tests/flow-step.test.ts`: a record is written; nothing at level 0, with no outputs, or for a malformed record.

### Integration fixes I made
- The Flow worker's `packages/contracts/src/program-api/automation-studio/flows/flow.ts` put the zod v3 `humannessSchema` inside a zod/v4 object. That broke `toJSONSchema` for every endpoint, so the assistant tools could not be regenerated. Rebuilt as a v4 schema with the same bounds.
- The create-flow field-list test (which the broken schema had hidden) now lists `humanness`.
- Regenerated `assistant-tools.generated.json` (create-flow's `humanness` and the `update-task-settings` tool). The drift test passes.
- The task worker's "existing test fails" (`project-task-routes.test.ts`) did not reproduce: the whole file passes, 7 of 7.

### Replays now record the level: the real cause, and a correction from me
- The record reached Core one level deeper than the flow-step log reads it. The domain's output dispatcher (`domain/src/io/gateway-output-dispatcher.ts`) nests the client payload under `result`, so Core's attempt outputs held it at `outputs.result.result.humanness`. That is the same defect `skipped` had before (t775).
- **My mistake:** my Core probe had passed because I built it in the shape Core expects, not the shape the domain sends.
- **Fix (worker-heavy, Opus):** the dispatcher lifts `humanness` to the top of its payload beside `skipped`, on any status, through a shared reader (`domain/src/actions/humanness-record.ts`, now also used by `gateway-mapping.ts`). Level 0 adds nothing; a test compares the JSON byte for byte. The file is outside my granted list; I'm flagging it. It is one field, carried as its sibling is.
- **Confirmed by provider-free runs:** run-mwc2gdm2-f6917f92 (`--attempts 2 --humanness 100`) has `"humanness": {"level": 100, "aimed": false}` on all 6 replay steps that sent a click or scroll. run-mwc2jxb2-f218b42f (no option) has none.

### Second level-100 series: the slow attempts explained (provider-free)
Each level-100 run was followed straight away by a baseline, as the control.

| run | level | replay attempt ms | flow steps per replay | judge-to-next-start gap |
| --- | --- | --- | --- | --- |
| company-website run-mwc0xah1-abdee0a8 | 100 | 31083, 23353, 23390 | 13.4-14.5 s | 15-23 s |
| company-website run-mwc1bwwi-1a78424b | none | 21065, 21148, 22700 | (same window, also slow) | 14.5-20.5 s |
| local-classifieds run-mwc1jcjl-0f863ffd | 100 | 36808, 39269, 49891 | 27.8-30.5 s | about 16 s |
| local-classifieds run-mwc1r6o5-5b690601 | none | 20972, 19037, 17812 | 16.3-19.5 s | about 2.8 s |

**Reading: the slow attempts are the machine, not humanness.**
- **company-website:** the baseline straight after level 100 was just as slow (21-23 s per replay against 15 s in the first series, with the same 14-20 s Core-side gaps between attempts). Its flow steps per replay are about the same at both levels: at 100 the scroll dwell adds about 3.9 s, but the many quick passes over controls the page isn't showing are missing.
- **local-classifieds at level 100:** steps humanness never touches grew too. Navigation took 3-5 s longer per replay, select 0.6-1.4 s, extract about 0.5 s, and the judge-to-next-start gap went from 2.8 s to 16 s.
- **The designed costs are the only humanness ones:** typing about 2.2 s more per type step at 100, scroll dwell about 1 s per scroll, nothing on clicks.
- **Machine load:** throughout these runs the lead's sweep, t885's Lab runs and other lanes held the heavy slots.
- **Failures:** the one failing replay click (`web.action.page_reported_failure`, then a retry succeeds) fails exactly the same way at baseline and at every level in the first series, so humanness did not cause it. It would be worth routing to W1.
- **Test:** a quiet-machine series would confirm the absolute numbers. The relative reading does not need one.
- All 4 runs passed, 4/4 right, with every continuation held.

### Validation for checked point 6 (run by me unless noted)
- `pnpm --filter @fluxiq/contracts exec vitest run src/program-api src/humanness` -> 29 files, 80 tests passed (after my zod v4 fix and the create-flow field-list test update).
- `FLUXIQ_REGENERATE_ASSISTANT_TOOLS=1 pnpm exec vitest run src/programs/_shared/assistant/tests/generated-module.test.ts`, then again without regenerating -> 2 of 2 passed.
- `pnpm --filter fluxiq exec vitest run` over flow-settings, flow-settings-requests, handlers/tests/flow-settings, task-memory, attempt/tests/task-humanness, flow-run/tests/humanness, project-task-routes, program-route, step-log/tests/flow-step and step-loop -> 179 of 180.
  - The one failure is `project-task-routes.test.ts` "removes the task's memory and nothing else". It is unchanged since c04485499 and passes when its file runs alone (`... vitest run src/programs/automation-studio/api/tests/project-task-routes.test.ts` -> 7 of 7).
  - It fails reliably only when run beside the task-memory tests (`expected 0 to be greater than 0` on the conversation's outcomes). That is a real-SQL test run concurrently, which `pnpm test` separates (`tests/test-groups.ts`). Not caused by this lane; routing asked.
- `pnpm --filter fluxiq exec vitest run src/runtime/llm/step-log/tests/flow-step.test.ts src/engine/automation/step-loop` -> 6 files, 25 tests passed.
- `cd domain && DOMAIN_TEST_BUILD_LABEL=t898-int node scripts/test-domain.mjs io/tests/gateway-output-dispatcher client/tests/gateway-mapping runtime/llm-evidence/node-run/tests/press-raw-read` -> 112 of 112.
- Heavy jobs through the slot:
  - Core library build after the Flow, task and flow-step work -> exit 0.
  - Domain build, domain check, extension check and extension audit -> all exit 0. These ran before the dispatcher fix; the trace worker reran `domain check` after it -> exit 0, and its Lab runs rebuilt and loaded the extension.
- Core `pnpm structure:check` -> passed (530 warnings, 969 baselined). Extension audit -> passed (245 warnings, 552 baselined).
- 4 second-series provider-free Lab runs plus the trace worker's 2 confirmation runs -> all passed. No provider was used.

### Open for the lead
1. The dispatcher fix is outside my granted files (`domain/src/io/gateway-output-dispatcher.ts` and a new `domain/src/actions/humanness-record.ts`). Accept it, or route it.
2. `update-task-settings` is allowed for paired clients (`server/program-route/program-route.ts:124,316`), so the extension's per-task slider can call it. Say if it should be cookie-only.
3. The project-task-routes test fails under concurrency, before and outside this lane. Route it.
4. The replay click that fails once per replay (`web.action.page_reported_failure`) on company-website at every level. Route it to W1.
5. `service.ts` (after t885): pass the request's `humanness` onto the attempt input (the starting value; it also fills a new task's level) and resolve the run-session's level from the Flow's `metadata.humanness` and the request. Then the approved live series.

## Checked point 7: create-flow stores its starting humanness in the creating write (2026-11-11)

- **Root.** `service/flows/creation.ts` `AutomationStudioFlowCreation.createFlow` takes `humanness`:
  - It is validated with `humannessSchema` before any effect ("humanness must be a whole number from 0 to 100.").
  - It is set as the blank Flow's `metadata.humanness` inside `createRuntimeBlankFlow`, so it is part of the single creating save on both paths (the canonical authority and the legacy facade).
  - No Flow can exist without it after a failure part-way.
- **Tests** in `service/flows/tests/creation.test.ts`:
  - In both storage modes, a create with `humanness: 40` makes exactly the effects of a plain create (canonical, document and SQL names; 2 receipts; 1 feed entry), and the stored document's `metadata.humanness` is 40.
  - A create without it has no `humanness` key.
  - 101, -1, 2.5, "40" and null are refused, and no Flow is written.
- **Superseded below:** (at the time) still two writes at the HTTP handler: `programs/automation-studio/api/handlers/flows.ts` reaches creation through `service.createFlow`, whose input type is declared in `service.ts` (line 1320, `async createFlow(input: { projectId: string; name?: unknown; description?: unknown; flowId?: string })`). Passing `humanness` needs that type to gain `humanness?: unknown`. That file is serial behind t885, so the handler still creates then updates until that line lands. With the line, the handler becomes one call, `service.createFlow({ projectId, name, description, ...flowId, ...(payload.humanness !== undefined ? { humanness: payload.humanness } : {}) })`, and its second write and pre-check go. I make both with the other `service.ts` line, unless you approve this distant one-line hunk now.
- **Validation:** `pnpm --filter fluxiq exec vitest run src/framework/automation-service/service/flows/tests/creation.test.ts` -> 10 of 10 passed. `pnpm structure:check` -> passed (530 warnings, 969 baselined). Not run: the Core library build (it waits for the service.ts line).

### Checkpoint 7, completed: the handler is one write (lead approved the service.ts type hunk)
- `framework/automation-service/service.ts:1320`: `service.createFlow`'s input type gains `humanness?: unknown`. This is the only hunk in that file.
- `programs/automation-studio/api/handlers/flows.ts` create-flow handler: one `service.createFlow` call carrying `humanness` when given. The pre-check (`assertFlowHumanness`) and the second settings write are gone, and so is the now-unused import. A refusal from creation still reaches the caller as `ok: false` naming humanness, with nothing created.
- Handler test (`handlers/tests/flow-settings/tests/flows-humanness.test.ts`): a create with 40 stores 40 and ends on the same revision as a plain create (a second save would have moved it on), and is otherwise equal to it. The refusal cases now include null; 101, -1, 2.5, "50" and null each create nothing.
- Files this checkpoint: Core `packages/fluxiq/src/framework/automation-service/service.ts`, `.../service/flows/creation.ts`, `.../service/flows/tests/creation.test.ts`, `packages/fluxiq/src/programs/automation-studio/api/handlers/flows.ts`, `.../handlers/tests/flow-settings/tests/flows-humanness.test.ts`; extension `docs/working/mvp-launch-plan/reports/w2-humanness.md`.
- Validation:
  - `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/api/handlers/tests/flow-settings src/framework/automation-service/service/flows/tests/creation.test.ts` -> 2 files, 28 tests passed.
  - `pnpm structure:check` -> passed (530 warnings, 969 baselined).
  - `heavy-slot run t898 -- pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket --filter @fluxiq/sdk --filter @fluxiq/ui-components build` -> every package "build: Done", `CORE_BUILD_EXIT 0`.

## Checked point 8: service.ts lines, a new task follows its Flow, paired Flow humanness, notice-only press, live series (2026-11-11)

### Core: the run paths resolve stored levels (worker, Sonnet)
- **service.ts, chat attempt:** `generateFlowBootstrapAdaptation` reads `humanness` from the validated request and puts it on the attempt input as the starting value. It is not routed through `caller`.
- **service.ts, run-session:** `runRuntimeSession` loads the canonical Flow before building graph options and passes `humanness: automationStudioFlowHumanness(canonical?.metadata) ?? input.humanness`. That is the Flow's level, then the starting value; a run-session has no task and no run option. It uses `??` rather than the resolver, to keep service.ts at its baseline size.
- **Tests:**
  - `service/tests/run-session-humanness.test.ts` (new, 4): Flow over the starting value, the starting value alone, none gives none.
  - `attempt/tests/task-humanness.test.ts`: rewritten with no attempt-input mock, through `tests/later-attempts.ts` with a `humanness` option.
- **A precedence flaw the worker found, and my fix (worker, Sonnet):** a new task stored the request's starting value as its own level, which then outranked the Flow's level.
  - Now `attempt/run-attempt.ts` stores the starting value on a new task only when the run's Flow has no stored level. It reads the Flow through the flow-run engine's `parentFlow` and `automationStudioFlowHumanness`. If the Flow cannot be read, it falls back to storing the starting value.
  - When the Flow has a level, the new task stores nothing and follows the Flow, later Flow changes included, until someone sets the task's own level.
  - Tests: Flow 30 against a starting value of 70 stores nothing and runs at 30, then follows a later Flow change; Flow 0 against 70 runs at 0.

### Core: paired browsers may set a Flow's humanness and nothing else (worker-heavy, Opus)
- **The allowlist** (`server/program-route/program-route.ts`): `get-flow-metadata-detail` and `update-flow-settings` are added as one group, after `remove-task`.
- **The update-flow-settings narrowing:** it accepts exactly `{ projectId, flowId, flow: { flowId? (equal to flowId), metadata: { humanness: number | null } } }`. Any other key at any level, a missing humanness or a mismatched `flow.flowId` is refused before the handler, with the field named by path. The handler receives a payload rebuilt from the accepted fields only.
- **The refusal code** is the file's existing `authorization.forbidden`, with the field named in the message. A distinct code would mean widening the types in `handle-program-request.ts`.
- **Tests:**
  - `server/program-route/tests/program-route.test.ts`: the allowlist snapshot, plus a unit test per case.
  - New `tests/handle-program-request.test.ts`: the whole route against a real registry and store. A paired caller reads, sets 40 and clears with null. Every refused case returns 403 with the field named, the handler never runs, and the Flow is unchanged. A cookie caller can still change name, description, size and humanness.
- **Notes:**
  - The route strips `authSessionId` from token calls before narrowing, so it is dropped, not refused; a test pins this.
  - **Risk to decide:** `get-flow-metadata-detail` now returns the whole settings detail to a paired token (input default values, variable initial values), which was cookie-only before. Its reach is still the approving person's bound domain. My recommendation: since the extension needs only humanness, give paired callers a humanness-only answer.
  - The web app's mirrored route test (`apps/web/src/app/api/programs/[programId]/[endpoint]/tests/route.test.ts`) copies the allowlist and already lacked `update-task-settings`. It is W5's; it should list all three entries.

### Core: the project-task-routes test
- No shared state was found. Memory and locator maps are per instance, and every test world has its own temp data dir.
- The cause was a time flake: attempt times fixed at module load fell before the thread's `sinceMs` on a slow load. Dev commit 1c34609dc (t904) already fixed it by taking the times from the clock after the thread is noted, and it is merged here.
- `vitest run project-task-routes.test.ts + task-memory` -> 6 files, 51 tests passed, three times in a row. The file alone -> 7 passed.

### Extension: a notice-only first press is pressed once more (worker-heavy, Opus)
- **Safety evidence, from the code:**
  - `first.noticeOnly` (`click.ts`) is set only when the watch saw a single sign: a change in the control's own section, on the command's first press.
  - The settled look (`ignored-press/settled-look.ts:202`) must also answer "announced". That requires no request, navigation, focus move, outside change or new shadow root (`:132-145`, `:168-171`), and the section's markup and field values identical once settled.
  - `domain/src/runtime/failure/codes.ts:371` marks the result unacted and `certainNoEffect: true`. So a second press cannot repeat a landed act.
  - Pre-existing limit, not widened: a page that saves with no request and announces it only in a status region would also read as notice-only. Core already presses that again today.
- **Change:** `pressInPlace` no longer fails a notice-only first press at once. It takes the same in-command second press as a press that settled unchanged (t896), with the same aim, watch windows, and H3 and H4 hooks.
  - A second notice, or no change at all, still fails as `web.action.page_reported_failure`, with the notice named.
  - A second press with no sign at all ends as not observed, exactly as t896's existing path for a silently ignored press does.
- **Tests:** new `content/actions/tests/click/tests/notice-first-press.test.ts` (8 cases) and one humanness case. Two `settled-look.test.ts` rows that asserted the reversed behaviour were changed. Against the old click.ts exactly the 9 new-behaviour cases fail, and the "never pressed again" cases pass on both.
- **Left for their owners (routing asked):**
  - `apps/extension/e2e/content/tests/reveal-by-scroll/tests/company-website-team-more.spec.ts:71-89` still expects the first command to fail.
  - `docs/architecture/extension-client.md` (~1481) still describes the immediate failure.
  - `e2e/site-reset/tests/job-failed-save.spec.ts`'s header describes the Core retry.

### Validation for checked point 8 (run by me unless noted)
- `pnpm --filter fluxiq exec vitest run src/server/program-route src/framework/automation-service/service/answer-first/attempt/tests/task-humanness.test.ts src/framework/automation-service/service/tests/run-session-humanness.test.ts` -> 4 files, 71 tests passed.
- `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=t898-int node scripts/test-extension.mjs content/actions/tests/click content/action-runtime/humanness` -> 125 of 125.
- Core `pnpm structure:check` -> passed (533 warnings, 969 baselined).
- One driver through the queue, stopping at the first failure:
  - Core library build -> exit 0.
  - Domain build, domain check, extension check and extension audit -> all exit 0.
  - Provider-free confirmation `pnpm lab attempt company-website --task company-website-apprentices --authoring-mode answer-first --scripted-model --attempts 2 --humanness 100` (with `--priority`) -> passed, run-mwcc728x-36a46e21. No replay flow step failed, so the notice-only first press now succeeds inside its command. `humanness` is recorded on 4 replay flow steps (level 100; 2 aimed).
- Workers: service lines 4 and 4 passed; new-task level 6 passed; program-route 65 passed; click tests 286 of 286 (9 fail against the old click.ts).

### Live series: refused by the Lab's guard, nothing spent
- `pnpm lab attempt company-website --task company-website-apprentices --authoring-mode answer-first --live-llm --llm-model claude-haiku-5-5 --llm-max-cost-usd 5 --attempts 4 --humanness 0`, with `--priority` -> refused by rule `behind-dev`: "this repository ... is at 7761985, which lacks 10 commit(s) of its local dev (685d0eb); the FluxIQ Core ... is at dac4563, which lacks 3 commit(s) of its local dev (8feb5ab)". `spentUsd: 0`, no provider call.
- **Needed:** commit checkpoint 8 and merge dev into both t898 trees. I then rebuild through the queue and run the two live series (level 0, then level 100), watching each to the end.

## Checked point 9: live series, control-node pauses, a person's starting humanness, paired answer, notice-press specs (2026-11-11)

### Live series (approved, watched to the end)
- **Level 0, run-mwcdkd7h-832d9262:** 4 of 4 right; attempts 3 and 4 made 0 calls; about $0.02. No step failed, and no step carries humanness.
- **Level 100, run-mwcess01-e0124be6:** 4 of 4 right; about $0.04.
  - Attempt 2 needed a repair. Attempt 1's answer applied the apprentice filter through two draft amendments, but the saved Flow's read kept all 28 cards. That is an authoring defect, routed to E1; humanness is excluded (the Flow's click is the "Our team" link).
  - Replays took 49-61 s against 23-30 s at level 0, because Core paused before its own control nodes too.
  - Both debug files are under `docs/working/language-driven-flow-loop-plan/debugs/`.
- **Fixed:** `engine/automation/pacing/arrival-pause.ts` pauses only before nodes that act through a client (a domain's nodes and `builtin.policy.*`). The `arrival.ts` hook passes the node. Tests are in `pacing/tests/humanness-helpers.test.ts`, and `docs/architecture/humanness.md` is updated.

### A person's starting humanness (worker-heavy, Opus; names approved and sent to W5)
- **Storage:** `startingHumanness?` on the identity-access User record. It comes back from `validateSession` and `authenticate`, and never in other people's views (the snapshot, update-user, create-user, the authenticator endpoints).
- **Endpoints:** `get-my-preferences` and `update-my-preferences` in program identity-access.
  - IAM: `iam:GetMyPreferences` (Read) and `iam:UpdateMyPreferences` (Write). Permission `programs.read`, which every role holds. Resource `selfUser()`. Hidden from the assistant.
  - Any payload key other than `startingHumanness` is refused with `preferences.self_only`, the caller's own id included. The one exception is the panel route's own `authSessionId`, and only when it is the caller's session.
  - Bad values are refused with `preferences.starting_humanness_invalid`; null clears.
  - Setting a preference does not move `updatedAtMs`.
- **Precedence:** `resolveHumanness` ends with `person`: run option, task, Flow, request value, person, none.
  - Answer-first chat attempts use the caller's stored value when the request carries none.
  - Run-session runs too. The person is the authenticated caller: run-session passes `personUserId` from `request.actor`, never from the body, so even a signed-in run with no unlocked key gets it.
- **My integration:**
  - The host binding in `programs/_shared/runtime.ts`: `AutomationStudioPersonHumanness.bind(automationStudio, (userId) => identityAccess.preferences.startingHumanness(userId))`.
  - `personUserId` on the run-session input, set in `run-requests/run-session.ts` from the actor and read in `service.ts`'s run-session expression.
  - Both actions added to `FluxIQUserAccess`'s `SelfService` statement.
  - Tests: the run-request harness keeps `personUserId` apart, and two new cases cover the caller (locked or not) and a body naming another person (dropped). The person-humanness run-session test gains a case with no unlocked key.
- **New module, outside the brief** but forced by `service.ts`'s audit limits (4,304 lines, 221 methods): `framework/automation-service/service/person-humanness/`, keyed by the service object.
- **Not done:** `FluxIQReadOnlyAccess` stays at v1 though its generated list gained `iam:GetMyPreferences`. Its comment asks for a bump, but no check enforces it, earlier list changes left it at v1, and a test pins v1.

### Paired callers get a humanness-only Flow detail (worker-heavy, Opus)
- **The cut:** `program-route.ts` `projectPairedClientResponse` (paired callers only) answers `get-flow-metadata-detail` with exactly `{ flow: { flowId, metadata: { humanness? } } }`. It is built from scratch, so a field the handler adds later is never handed out. A missing Flow answers `{ flow: null }`; a failure keeps only `error` and `errorCode`.
- **The read request:** a paired read may carry only `{ projectId, flowId }`; any other key is refused, named.
- **Also cut, beyond the brief and accepted by me:** the answer of `update-flow-settings` for paired callers. Its handler reads the full detail back after saving, so re-sending the current level would otherwise hand out every input default and variable initial value.
- **Unchanged:** cookie callers' bodies are byte-identical, and tests show it.
- **Tests:** 7 in `program-route.test.ts`; 6 in `handle-program-request.test.ts` against a real registry and store, with seeded input defaults and variable values.
- **Mutation check:** with the cut disabled, all 7 projection tests fail.

### Notice-press follow-ups (granted)
- `apps/extension/e2e/content/tests/reveal-by-scroll/tests/company-website-team-more.spec.ts`: one command that succeeds on its second press.
- `docs/architecture/extension-client.md` (~1474): the press-again rule.
- `apps/extension/e2e/site-reset/tests/job-failed-save.spec.ts`: the header, the comments, and the attempts assertion now 1 (accepted).

### Test fixes of my own
- `flows-humanness.test.ts`: my checkpoint-7 "one write" test compared a non-existent `revision` field (`undefined` with `undefined`). It now counts `service.saveFlow` calls: a level-40 create makes exactly as many as a plain one, so the old two-write handler would fail it. It also checks that `createFlow` is called once carrying 40.
- `humanness-helpers.test.ts`: a typing fix.

### Notice-press specs (worker-heavy, Opus): both pass
- **`company-website-team-more.spec.ts`:** both "Show more people" tests now expect one command that succeeds, with "pressed once more" in its account. The old button-visible check went: once the second press loads the rest of the team, the page hides the button. 3 of 3 passed.
- **`job-failed-save.spec.ts`:**
  - It was already broken on dev by two Core changes on 2026-10-30, before t898:
    - Core `0bef3866f` and `f6760d4c3`: a toggle step must name its `ensureState`, so the scripted save without one was refused with `candidate.toggle_state_required`, which ended the build in `evidence_repeat_without_progress`;
    - Core `879ec6584` (t811): a brief completes as soon as its judged trial answers yes, so the builder gets no later turn.
  - My own expectations were also wrong: one attempt reports no `attempts` field (the domain's `run.ts:558`), and the click counter counts commands, not presses (`instrumented-runtime.ts:67`).
  - Now: the save's `attempts` is undefined, its click count is +1, and its account names "pressed once more"; the scripted save names its `ensureState`; the trial checks read the supervisor's `project.dispatch` answer, the judge's two views and the site's My jobs before and after. 1 passed.
  - `tsc -p tsconfig.test.json --noEmit` -> exit 0.
- **For their owners, routing asked:**
  - other site-reset specs (`judged-change-save-then-read`, `office-site-reverted-toggle`, `job-undo-redraws-on-load`) probably share the two Core drifts;
  - the comment at `instrumented-runtime.ts:48` says the counter sees a trial's clicks, but trial playback bypasses it.
- **A mistake of mine, no harm done:** while chasing the job-failed-save failure on a wrong theory, I edited `click.ts` and then reverted it (restored byte for byte from HEAD). The Lab's staleness guard refused the provider-free run it overlapped, before anything ran.

### Level 100 with the control-node fix (approved provider-free run; live rerun refused behind-dev)
- **Provider-free run-mwckoxsx-f273a2ff** (`--scripted-model --attempts 4 --humanness 100`): passed, 4 of 4 right, every continuation held. Replays took 29.6, 22.4 and 12.7 s; attempts 3 and 4 made 0 calls.
  - Control nodes now wait 0-1 ms on arrival (merge steps 0023-0051), against up to 3.5 s before the fix.
  - Page steps get the designed pause before arrival, now end to end from the extension's level: navigate 1.0 s, clicks 0.7-2.2 s, scrolls 0.3-1.9 s, extract 3.1 s.
  - The level is recorded on 12 page steps (level 100; 6 aimed).
- **Live level-100 rerun:** refused by `behind-dev` (extension ff991c1, 12 behind dev 008efac; Core e39e2d3, 9 behind dev 236c058). $0 spent, no provider call. It needs dev merged into both trees again.

### Validation for checked point 9 (run by me unless noted)
- `pnpm --filter fluxiq exec vitest run src/engine/automation/pacing src/engine/automation/step-loop src/engine/automation/tests/graph-run.test.ts` -> 12 files, 96 passed (the control-node fix).
- `... src/programs/automation-studio/api/handlers/tests/flow-settings` -> 18 passed (the create-flow test now counts saves).
- `... src/framework/automation-service/service/run-requests src/framework/automation-service/tests/person-humanness` -> 4 files, 33 passed; then person-humanness -> 2 files, 9 passed (after the locked-key case).
- `... src/platform/iam src/programs/identity-access` -> 38 files, 345 passed.
- `pnpm --filter @fluxiq/contracts exec vitest run src/humanness src/iam src/program-api` -> 35 files, 170 passed.
- Core library build through the queue -> exit 0, which typechecks all of this round. An earlier `pnpm --filter fluxiq check` had shown 6 errors in two of my test files: a typing issue, and a test reading a non-existent `revision`. Both are fixed, and this build includes them.
- `pnpm structure:check` -> passed (534 warnings, 969 baselined). Docs links -> passed.
- Workers: paired detail 78 passed (program-route); the notice-press specs 3 of 3 and 1 of 1, with the e2e tsc at exit 0.

## Checked point 10: settings type fix, level-100 live rerun, two Core hardening items (2026-11-11)

### The extension settings type (approved, root-cause form)
- **The break:** the first try at this round's live rerun failed in the Lab prelude, at no cost. `extension:build` exited 2: in `settings-view.ts` (168, 262, 290), `FluxIQSettings` was not assignable to `HumannessSettings`.
  - W4's stand-in `HumannessSettings = FluxIQSettings & { humanness?: number }` narrowed the field to `number`.
  - t898's `FluxIQSettings` already owns `humanness?: number | undefined` (H1).
- **The fix:** the alias is gone.
  - `humanness/settings.ts` is deleted, and its barrel export is removed.
  - `read-humanness.ts`, `with-humanness.ts`, `settings-view.ts` and `tests/humanness-settings.test.ts` use `FluxIQSettings` from `shared/protocol` directly.
  - No `HumannessSettings` reference remains in `apps/extension/src`.

### Two Core hardening items
- **Item 2:** done, with a test. Details are with the lead only; the lead words the commit.
- **Item 3:** `program-route.ts` `narrowRunRuntimeSession` refuses `llmExecution` and `personUserId` by name for paired clients, with and without `runIntent` (`authorization.forbidden`). There is a test in `program-route.test.ts`.

### Live level-100 rerun: run-mwcncux8-d888f3a0 (debug note committed beside the run)
- **Result:** all 4 answers right, $0.1215, attempts 182/144/167/175 s. It failed only on determinism: every replay was `run_flow_then_repair`, and the 3-to-4 continuation was refused (`second_found_something_else`).
- **Does the first replay still need a repair at level 100? Yes, and not because of humanness:**
  - Attempt 1 authored a paging loop and then also paged by hand. Its manual Next page and reads were saved after the loop.
  - In the replay, the loop reached the end of the list, the stray Next page succeeded with nowhere to go, and the run stopped with `executor.graph.unmatched_route`.
  - The repair then also dropped the loop, judging from the fully expanded page the replay had left. So the next replay read 8 of 26 people.
  - Filter loss on save recurred too: 28 rows were kept at 0067.
  - Every replayed page step succeeded and no misclick fired.
  - The three authoring and repair defects are routed to E1 / t905 in the note.
- **Humanness live:** Core's control nodes paused 0-1 ms (the control-node fix, confirmed live). Each click carries `{level: 100, aimed: true}`.
- **Coverage gap found:** Next page presses (`content/extraction/page-advance/`) go through no humanness and record nothing. At level 100 they are the level-0 centre press, which is safe but not aimed. Proposed follow-up: route them through `aimPress` with the same safety lines. It is not done in t898.

### Validation for checked point 10 (run by me)
- `node scripts/test-extension.mjs panel/settings/tests/humanness-settings` -> 3 passed.
- Core library build (`contracts, sdk, fluxiq, client-gateway-websocket, ui-components`) through the queue -> exit 0.
- `pnpm --filter @fluxiq-web-extension/extension check` through the queue -> exit 0.
- `node scripts/structure-audit.mjs` (extension) -> passed (247 warnings, 552 baselined). Core `node scripts/structure-audit.mjs` -> passed (536 warnings, 969 baselined).
- Core: `vitest run .../handlers/tests/recordings.test.ts` -> 10 passed; `vitest run src/server/program-route` -> 80 passed.
- Live: `pnpm lab attempt company-website --task company-website-apprentices --authoring-mode answer-first --live-llm --llm-model claude-haiku-5-5 --llm-max-cost-usd 5 --attempts 4 --humanness 100` -> exit 1, as described above.

## Checked point 11: nine Core handler tests after the dev merge (2026-11-11)

- **The failures:** after dev was merged into t898, 9 tests failed in `programs/automation-studio/api/handlers/tests`:
  - 2 in `llm-generation.test.ts`;
  - 1 in `llm-permission.test.ts`;
  - 6 in `runtime-execution.test.ts`.
- **Cause, the same for all nine:** every diff line (17 of them) is one extra field, `personUserId: "user.one"`, the signed-in actor.
  - No declared field was dropped: `permittedConsequences`, `runIntent` and its `llmExecution`, `resultCheckCallerPays` and a continued run's `runId` all still arrive as before.
  - These are dev's own tests, unchanged in t898. They pin the service input exactly, and on dev `run-session.ts` never sends `personUserId`, so they pass on plain dev.
  - The field comes from checked point 9: run-session now passes the person whose starting humanness the run reads, taken from `request.actor` only.
- **Fix:** the nine exact expectations now include `personUserId` equal to the actor. They now assert that the person comes from the caller.
  - The body still sets no execution context: the run-request tests from checked point 9 cover a body naming another person (dropped), and `program-route` refuses `llmExecution` and `personUserId` from paired clients.
- **Validation:**
  - `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/api/handlers` (heavy-slot) -> 48 files, 228 passed.
  - Core `node scripts/structure-audit.mjs` -> passed.
