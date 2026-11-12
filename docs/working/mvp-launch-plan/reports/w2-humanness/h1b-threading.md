# H1b threading report (t898, W2)

## Outcome
Partial. Everything in the brief is done and tested, except two places that were outside my files: (a) the effectDispatcher context type in `graph-execution-options.ts` (another worker's file), and (b) the chat-turn path from the person's message to a graph run (it needs files I may not touch). Both are listed below with exact lines.

## What changed (Core, `C:/Users/osrs_/FluxStuff/fxwork/t898/!FluxIQ/packages`)
1. `contracts/src/client-gateway.ts` `ClientGatewayActionCommand.humanness?: number` (doc'd).
2. `fluxiq/src/runtime/contracts.ts` `FluxIQRuntimeCommand.humanness?`.
3. `fluxiq/src/runtime/client-gateway-transport.ts` `actionCommandFromRuntime` copies it when `!== undefined`.
4. `fluxiq/src/engine/automation/node-execution/attempt.ts` `effectDispatchContext` carries `options.humanness` (also makes the context non-undefined when only humanness is set). Local type `EffectDispatchContext` is now `... & { humanness?: number }` so I did not need to edit `graph-execution-options.ts`.
5. `fluxiq/src/framework/automation-service/io-policy.ts` `createRuntimePolicyEffectDispatcher`: context param type gains `humanness?`, `runtime.dispatch({kind:"execute_action"...})` gets `...(context?.humanness !== undefined ? { humanness } : {})`.
6. Request body: `service/flow-bootstrap-requests/generate.ts` (allowlist, `humannessSchema` check -> `ok:false` "invalid humanness", carried into `service.generateFlowBootstrapAdaptation` input); `service/flow-bootstrap-commands/generation/request.ts` (REQUEST_FIELDS, `humannessSchema` check, returned on the read request); `flow-bootstrap-commands/contracts.ts` input type `humanness?`.
7. `service/answer-first/flow-run/flow-run.ts` `gatedOptions`: one spread `...(ports.input.caller?.humanness !== undefined ? { humanness: ports.input.caller.humanness } : {})` appended to `own`.
Line endings: files were CRLF in the working copy; I restored CRLF after an early edit helper converted five of them to LF (git's eol normalisation shows only the real diffs).

## What changed (extension, `.../!FluxIQWebExtension`)
- `domain/src/client/gateway-mapping.ts`: `humanness: typeof command.humanness === "number" ? normalizeHumanness(...) : undefined` inside the `compactJsonObject` (undefined is dropped, so absent stays absent); imports `normalizeHumanness` from `@fluxiq/contracts/automation`.
- NEW DEPENDENCY: `domain` did not depend on `@fluxiq/contracts`. Added it to `domain/package.json` and `pnpm-lock.yaml` (importer `domain`, link spec identical to apps/extension's), and made the junction `domain/node_modules/@fluxiq/contracts` in this worktree. Supervisor: confirm you accept this, or `pnpm install` in the worktree to regenerate.
- `apps/extension/src/background/connection/server-command-channel.ts`: private `withSavedHumanness(action)` called at the `executeAction` line; run value wins (0 included), else saved `settings().humanness` when a number > 0, else the same action object.
- `apps/extension/src/background/panel/relay-context.ts` (new optional `humanness?: () => number | undefined`), `panel-control-deps.ts` (`humanness: () => connection.currentSettings().humanness`), `conversation-relay.ts` `turnPayload` (`humanness: savedHumanness(context)`, which is undefined unless saved > 0; `defined()` drops it). Settings were reachable inside `background/panel`, no `src/panel/**` file touched.

## Tests added
- `contracts`: none (type-only field).
- `fluxiq/src/runtime/tests/client-gateway-transport.test.ts`: 60 and 0 copied; absent has no key.
- `fluxiq/src/framework/automation-service/tests/io-policy.test.ts`: no-humanness command has no `humanness` key and exactly the pre-change key set (deep-equal proof); 60 and 0 set from context.
- `.../flow-bootstrap-commands/tests/generation-request.test.ts`: accepts 0,1,60,100; absent absent; refuses 101,-1,1.5,"x",null,NaN.
- `.../flow-bootstrap-requests/tests/generate-answer-first.test.ts`: valid values reach the build input, absent stays absent, 101/1.5/"x" refused before the service is called.
- `domain/src/client/tests/gateway-mapping-humanness.test.ts` (new): copy 60/0, normalise 140/-5/41.6, omit for absent and non-number.
- `apps/extension/.../connection/tests/server-command-channel.test.ts` (harness takes saved settings): fallback, run wins incl. 0, same object when nothing applies.
- `apps/extension/.../panel/tests/conversation-relay.test.ts`: payload includes 35, omits 0/undefined/no-setting context.

## Commands run and observed
- Core vitest (via heavy slot): `client-gateway-transport`, `io-policy`, `flow-bootstrap-requests`, `generation-request` -> before my test-placement fix 65/66 pass (1 was my brace error in generation-request.test.ts); after fix, `generation-request` + `answer-first/flow-run` -> 16 files, 94 tests passed; `io-policy` rerun after reformat -> 30 passed. A direct (no-slot) vitest run crashed with "Worker exited unexpectedly" under memory pressure; slot runs were fine.
- `cd domain && DOMAIN_TEST_BUILD_LABEL=t898-h1b node scripts/test-domain.mjs client/tests` -> 75 pass, 0 fail (includes the two new humanness tests).
- `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=t898-h1b node scripts/test-extension.mjs server-command-channel conversation-relay` -> 41 pass, 0 fail (includes the three new tests).
- Extension `node scripts/structure-audit.mjs` -> "passed (245 warning(s), 552 baselined)", exit 0.
- Core `pnpm structure:check` -> 3 violations, none mine: `engine/automation/graph-run.ts:1`, `pacing/human-pause.ts:1`, `step-loop/arrival.ts:4` import `@fluxiq/contracts/automation` (forbidden by the engine imports rule). Those are the other worker's files. (My one statement-packing violation in io-policy.test.ts was fixed and re-checked.)
- Not run: `pnpm --filter @fluxiq/contracts exec vitest run src/tests/client-gateway.test.ts` (no contracts test changed), no package typechecks (per brief).

## Lines still needed elsewhere
A. Type only, `packages/fluxiq/src/engine/automation/contracts/graph-execution-options.ts:74-76` (`effectDispatcher` context type): add `humanness?: number;` before `commandContext?:`. Not required for runtime or for `attempt.ts` (which has its own intersection type), but the declared option type should say it; its owner can add it. I removed my edit there after noticing the file was not mine.
B. Request-to-run gap (the important one). `generate.ts` now puts `humanness` on the `generateFlowBootstrapAdaptation` input, and `readAutomationStudioFlowBootstrapGenerationRequest` returns it, but `flow-run.ts` only sees `ports.input.caller`, and `caller` is built solely from code-only caller options (`service.ts:1570`, `caller: answerFirstOptions`). So a request value stops at `service.ts:~1493/1570`. Needed in `packages/fluxiq/src/framework/automation-service/service.ts`:
   - line ~1493: also destructure `humanness` from `readAutomationStudioFlowBootstrapGenerationRequest(unsafeInput)`;
   - line ~1570: `caller: answerFirstOptions` -> `caller: humanness === undefined ? answerFirstOptions : { ...answerFirstOptions, humanness }`.
   Caution: that makes `input.caller` defined for a chat attempt, and `answer-first/attempt/run-attempt.ts:198` then adds `confirm: { judge: "auto", check: undefined }` and other `input.caller` readers (ending.ts:79, keep.ts:54, caller/applied.ts:17) change behaviour. Safer: add `request`-derived humanness to `AutomationStudioAnswerFirstFlowRunPorts.input` (`flow-run/ports.ts:28` Pick) and read it in the one `gatedOptions` line instead of `caller` (flow-run.ts line becomes `ports.input.caller?.humanness ?? ports.input.humanness`), with attempt `run-attempt.ts`/service passing `humanness` into the ports input. Both need other lanes' files, so I did not do either.
C. Chat turn plumbing (relay now sends `humanness` on `append-turn`): Core must carry it `ConversationTurnAppendRequest` (`api-contracts/automation.ts`, add `humanness?`) -> `conversation-requests/append-turn.ts:47` (pass to `commandContext`) -> `conversation-requests/command-context.ts:14,36` (target + context field) -> `runtime/conversations/commands/command.ts:~103` (context type) -> `commands/build.ts:197` and `:254` (add `humanness` beside `interpretationCalls` in the generation request) and `commands/run-flow.ts:70` (run-session payload; `run-requests/run-session.ts:19-75` must also pass it to `runRuntimeSession` options). Until then the append-turn handler ignores or refuses the extra `humanness` field; check the handler's field policy before shipping the relay change (I did not find a strict refusal in `append-turn.ts`, which reads named fields only).

## Not verified
- No typecheck of Core, domain or extension (types: `ClientGatewayActionCommand` in the domain/extension needs Core's contracts and client-gateway dist rebuilt, otherwise `command.humanness` will not type).
- No live browser or live Core run; end-to-end from a real run to a page action unverified, and blocked by B and C for the chat path.
- Removing the domain junction or a fresh `pnpm install` was not tested for the new `@fluxiq/contracts` dependency.

## Open questions
- Accept the new `@fluxiq/contracts` dependency on `domain` (package.json, lockfile)? The alternative is re-exporting `normalizeHumanness` through `fluxiq`.
- B: which of the two options is preferred.
