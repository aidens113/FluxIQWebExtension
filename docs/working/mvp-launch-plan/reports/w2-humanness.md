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
