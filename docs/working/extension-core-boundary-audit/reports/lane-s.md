# Lane S (t728 single-sources-telemetry)

Lane lead report and running progress log. Brief: `docs/working/extension-core-boundary-audit.md` findings 3, 4, 6-9
(audit phases 2 and 4), recorded in `docs/working/trace-offline-trials-plan.md` (lanes table, row S).

Trees: `C:/Users/osrs_/FluxStuff/fxwork/t728/!FluxIQWebExtension` and `C:/Users/osrs_/FluxStuff/fxwork/t728/!FluxIQ`,
both on `task/t728-single-sources-telemetry`. No commits; units end with `UNIT READY: <files>`.

## Plan

Unit 1 (audit phase 2, findings 6 and 8):
- 1a Run accounting: Core publishes one per-run spend total itemised by phase, every provider call (chat
  interpreter, failed re-author) in the run's ledger, instructed consequences on refused or ceiling-stopped builds,
  and a provider balance-exhausted failure code. `packages/test-runner/src/live-llm/*` reads them and drops
  `run-spend`/`step-log-spend`/`step-log-instructed` reconstruction. (`scripts/lab/live-guards/*` is lane H's: noted
  for them, not edited.)
- 1b Build lifecycle: Core passes an explicit build scope on evidence tool requests and publishes build start and
  end; the domain's per-build memories and cleared way-outs key off it (no `initial.<toolId>` parsing); durable
  state through a Core-owned store.

Unit 2 (audit phase 4, findings 3, 4, 7, 9):
- 2a Activity headline, pacer and wording: one browser-safe Core module imported by the extension and Core `apps/web`.
- 2b `where`/number reading: the domain imports `@fluxiq/contracts` record-sets; the parity test goes.
- 2c Dedupe and sort: `content/extraction/order-rows.ts` imports Core's record-set processing (bundle-safe).
- 2d Generic rules out of `WEB_LLM_SYSTEM_INSTRUCTIONS` into Core's prompt; contract pins updated deliberately.
- 2e Recording-capture switches and `requestsEnabled` policy owned by Core; the extension enforces it.
- 2f Card-number screen into Core's secret screen; Core owns the repeated-answer reason constant.

Order: discovery (read-only) for all pieces in parallel; then workers partitioned by file, Core first and rebuilt
before downstream consumes it. Files on L1's list (t724) and lanes G/H's lists are avoided.

## Progress log

### 2026-10-19 - Discovery done (four read-only Explore agents); decisions
- Accounting (finding 6): Core has no balance classification (402 falls into `llm.provider_http_error`); refused
  builds drop instructed consequences (only the success path calls `automationStudioBootstrapPermissionOutcome`);
  failed re-authors drop their call count (`reauthor-build.ts` `automationStudioRefutedResultFailureOf`); the chat
  interpreter calls DeepSeek outside every ledger (only a dollar sum reaches the Flow purse). Decision: Core adds
  `llm.provider_balance_exhausted`, instructed consequences on the failure diagnostic, re-author attempt calls, an
  interpreter call count, and a Flow spend record itemised by phase with a read endpoint; the Lab reads those and
  deletes `run-spend.ts`, `step-log-spend.ts`, `step-log-instructed.ts`. `scripts/lab/live-guards/balance-failure.mjs`
  is lane H's: noted for them to key on Core's code.
- Lifecycle (finding 8): the explicit request field would need Core `harness-options/binding.ts` and
  `llm/evidence-loop.ts`, both on L1's list. Decision: Core publishes the evidence call's build scope through an
  AsyncLocalStorage accessor set in `harness-options/registry.ts` (Core's own pattern, as
  `automationStudioActivityRunScope`; the domain host bundle keeps `fluxiq` external so it shares Core's instance),
  plus a Core-owned domain build-state store for durability. The explicit field is a follow-up once L1 lands.
- Twins (finding 4): the extension's activity copy is the authority (Core web differs: 1200 vs 1600 ms, waiting and
  failure headlines, echo rule); it moves to `fluxiq/ui` and Core web adopts it. Condition/number reading and
  dedupe/sort reach downstream through a by-name re-export in `fluxiq/automation-studio/nodes` (already in the
  content bundle, browser-safe); Core's blank-means-absent and nearest-year date rules win, so exploration answers
  match stored answers.
- Prompt (finding 3): recordings, limits, efficiency and loop-grammar sentences move into Core's system prompt
  (`deepseek/system-prompt.ts` core rules, pins re-pinned); the domain keeps web reading, paging, CAPTCHA.
- Policy (finding 7): Core read endpoint for the recording-capture and requests policy, on the paired-client
  allowlist; the extension clamps settings to it where it hands them to the content script and the settings UI.
- Screen and reason (finding 9): card-run helper in Core's `evidence-screen.ts`; the repeated-answer reason becomes a
  Core constant the domain and Core activity both import.

Wave 1 (Core, disjoint files): S-A accounting, S-B activity into `fluxiq/ui`, S-C record-process re-export,
S-D prompt rules, card screen and reason constant. Wave 2: lifecycle, capture policy, downstream switches.

### 2026-10-19 - Wave 1, Core (S-A accounting, S-B activity, S-C record process, S-D prompt/screen/reason)
- Changed (Core): see the reports `lane-s-a-accounting.md`, `lane-s-b-activity.md`, `lane-s-c-record-process.md`,
  `lane-s-d-prompt-screen.md`. S-D's open question (Flow Bootstrap and patch prompts would lose loop guidance once the
  domain dropped its Lists paragraph) closed by a follow-up: `AUTOMATION_STUDIO_LOOP_AUTHORING_INSTRUCTION` goes to
  flow_bootstrap (all cases) and runtime/subflow/expectation-target patches; pins re-pinned with a t728 header line.
- Lead validation (Core tree): `pnpm --filter @fluxiq/contracts check`, `pnpm --filter fluxiq check` -> pass;
  `pnpm --filter @fluxiq/web check` -> pass; `node scripts/structure-audit.mjs` -> "passed (412 warning(s), 1152
  baselined)"; the three contract tests in `scripts/task/contract/list.mjs` plus every changed fluxiq test ->
  39 files, 389 tests passed; `@fluxiq/contracts` vitest -> 250 passed.

### 2026-10-19 - Wave 2, Core (S-E lifecycle, S-F capture policy); Core built
- S-E: `automationStudioEvidenceBuildScope()` (AsyncLocalStorage frame set in `harness-options/registry.ts` around every
  domain executeTool: projectId, flowId, buildId, callScope?, opening fresh|continuing) and
  `automationStudioDomainBuildState(fluxiq, domainId)` (file-backed per domain and Flow; 64 KiB per value, 256 KiB and
  64 keys per scope, 16 builds per Flow; flow-scoped when buildId is absent). No L1 file touched.
- S-F: `@fluxiq/contracts` recording-capture policy, default and clamp (re-exported from
  `fluxiq/automation-studio/nodes`); `get-recording-capture-policy` read endpoint on the paired-client allowlist.
- Lead validation: Core checks and structure audit as above -> pass; `pnpm --filter @fluxiq/contracts --filter fluxiq
  --filter @fluxiq/client-gateway-websocket build` -> Done; downstream `node scripts/check/core-build.mjs` -> "current
  with its source"; Core web vitest on every changed web test plus `conversation/activity` against the rebuilt dist ->
  12 files, 136 tests passed.

### 2026-10-19 - Wave 3, downstream (D1-D6) and lead fixes
- D1 activity barrels re-export `fluxiq/ui`, copies deleted; D2 condition/number/sort from Core, `condition-match.ts`
  and the parity test deleted, `order-rows.ts` reduced to the request binding; D3 instructions web-12 (2,547 chars),
  card screen via `automationStudioWithoutCardNumbers`; D4 memories and way-outs keyed on Core's build scope with
  write-through to Core's store, no `initial.` parsing left in domain source; D5 Lab reads `get-flow-spend`, re-author
  `calls`, failure-diagnostic consequences, three reconstruction modules deleted; D6 capture policy enforced in
  background, content and settings, domain request policy clamped.
- Lead fix: `instructedConsequencesFrom` union is now `"proposal" | "failure_diagnostic" | null` (lane.ts,
  live-llm-run.ts and their tests); `step_log` can no longer occur.
- Lead validation (downstream tree): domain, extension and test-runner checks -> pass; `node
  scripts/structure-audit.mjs` -> "passed (210 warning(s), 638 baselined)"; domain tests beside the changes (15 test
  folders) -> 846/846 pass; extension tests beside the changes (8 folders) -> 822/822 pass; test-runner
  `live-llm`, `flow-lane/creation`, `existing-fluxiq-control` -> 324/324 pass (after the union fix);
  `pnpm --filter @fluxiq-web-extension/extension build` -> chrome, firefox, e2e-chromium each "verified 22 files".

### 2026-10-19 - Docs (S-G downstream, S-H Core) and headed check (S-I)
- Docs: downstream extension-client, testing-facility, build-loop, page-evidence, web-capabilities; Core
  automation-studio, client-gateway, flow-authoring, llm-flow-bootstrap, package-boundaries, both framework-reference
  copies regenerated (`pnpm docs:check` needs both).
- Headed check: `node packages/test-runner/dist/extension-chat-check/cli.js --browser chrome --scenario everything-store
  --page ./ --no-ask --build` (lane-s-i Lab paths, no provider key) -> headed Chromium side panel; the chat live line and
  the overlay read "Building your Flow", then the overlay "Build failed", word for word Core's
  `ui/activity-status/headline.ts` (lead viewed screenshot 04). Harness exit 2: 13 of 14 checks held;
  `theMessageIsTheInstruction` failed because Core folded the conversation's earlier "What can you do?" turn into the
  saved instruction. Lead reviewed the t728 Core diff under `runtime/conversations/`: cost and call-count plumbing and
  one balance message only, no change to the words-only reading or turn handling. Not checked against `dev`.

### 2026-10-19 - Final gates on the finished trees
- `node scripts/check/core-build.mjs` -> current; `pnpm --filter @fluxiq-web-extension/extension build` -> chrome,
  firefox, e2e-chromium "verified 22 files"; test-runner, domain and extension checks -> pass; downstream structure
  audit -> "passed (210 warning(s), 638 baselined)"; Core structure audit -> "passed (412 warning(s), 1152
  baselined)"; Core `pnpm docs:check` -> "Deterministic framework reference is current."

## Units

Both units belong to one paired task and are consistent only together: Unit 1's downstream `repeated-refusal.ts`
imports the repeated-answer constant Unit 2 adds to `@fluxiq/contracts`, and Core `api/contracts/endpoints.ts` holds
both `get-flow-spend` (Unit 1) and `get-recording-capture-policy` (Unit 2), placed here in Unit 1. Commit Unit 1 then
Unit 2 on the branch. Deleted files appear with status `D`. Paths are relative to each repository root.

UNIT READY: Unit 1 (audit phase 2: run accounting and build lifecycle), Core:
```
packages/fluxiq/src/programs/automation-studio/api/contracts/adaptation.ts
packages/fluxiq/src/programs/automation-studio/api/contracts/endpoints.ts
packages/fluxiq/src/programs/automation-studio/api/contracts/index.ts
packages/fluxiq/src/programs/automation-studio/api/contracts/run.ts
packages/fluxiq/src/programs/automation-studio/api/handlers/conversations.ts
packages/fluxiq/src/programs/automation-studio/api/handlers/llm-generation.ts
packages/fluxiq/src/programs/automation-studio/api/handlers/register.ts
packages/fluxiq/src/programs/automation-studio/api/handlers/runs.ts
packages/fluxiq/src/programs/automation-studio/api/handlers/runtime-execution.ts
packages/fluxiq/src/programs/automation-studio/api/handlers/tests/llm-generation.test.ts
packages/fluxiq/src/programs/automation-studio/api/handlers/tests/runs.test.ts
packages/fluxiq/src/programs/automation-studio/api/handlers/tests/runtime-execution.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/commands/build.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/commands/command.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/commands/run-flow.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/conversations.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/instructions/decision.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/instructions/interpret.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/instructions/request.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/instructions/tests/interpret.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/creation-spend/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/creation-spend/parse.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/creation-spend/record.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/creation-spend/tests/parse.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/codes.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/diagnostic-parse.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/diagnostic.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/failure-state.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/generation-catch.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/harness-failure.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/generation-catch.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/build-purse/purse.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/build-purse/settlement-ledger.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/build-purse/types.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/panel-command.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/provider.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/call-id.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/tests/call-id.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/failure-disposition.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/registry.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/provider-contract.ts
packages/fluxiq/src/programs/automation-studio/runtime/recovery/refuted-result/reauthor.ts
packages/fluxiq/src/programs/automation-studio/runtime/service.ts
packages/fluxiq/src/programs/automation-studio/runtime/service/creation-spend.ts
packages/fluxiq/src/programs/automation-studio/runtime/service/flow-bootstrap-commands/contracts.ts
packages/fluxiq/src/programs/automation-studio/runtime/service/flow-bootstrap-commands/creation-purse.ts
packages/fluxiq/src/programs/automation-studio/runtime/service/flow-bootstrap-commands/generation-request.ts
packages/fluxiq/src/programs/automation-studio/runtime/service/flow-bootstrap-commands/tests/generation-request.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/service/runtime-adaptation/flow-spend.ts
packages/fluxiq/src/programs/automation-studio/runtime/service/runtime-adaptation/reauthor-build.ts
packages/fluxiq/src/programs/automation-studio/runtime/service/runtime-adaptation/tests/reauthor-build.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/service/runtime-session/run-input.ts
packages/fluxiq/src/programs/automation-studio/runtime/domain-build-state/accessor.ts
packages/fluxiq/src/programs/automation-studio/runtime/domain-build-state/document.ts
packages/fluxiq/src/programs/automation-studio/runtime/domain-build-state/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/domain-build-state/limits.ts
packages/fluxiq/src/programs/automation-studio/runtime/domain-build-state/refusal.ts
packages/fluxiq/src/programs/automation-studio/runtime/domain-build-state/store.ts
packages/fluxiq/src/programs/automation-studio/runtime/domain-build-state/tests/accessor.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/domain-build-state/tests/document.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/domain-build-state/tests/store.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/domain-build-state/types.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/creation-spend/phase-of.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/creation-spend/phases.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/creation-spend/tests/phase-of.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/balance-exhausted.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/tests/balance-exhausted.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/evidence-build-scope.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/evidence-build.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/tests/evidence-build-scope.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/service/tests/creation-spend-itemised.test.ts
```

UNIT READY: Unit 1, downstream:
```
domain/src/cleared-way-outs/index.ts
domain/src/cleared-way-outs/owned-by.ts
domain/src/cleared-way-outs/registry.ts
domain/src/cleared-way-outs/tests/registry.test.ts
domain/src/io/gateway-output-dispatcher.ts
domain/src/io/tests/gateway-output-dispatcher-cleared-layers.test.ts
domain/src/runtime/llm-evidence/node-run/arrival.ts
domain/src/runtime/llm-evidence/node-run/held-literals/memory.ts
domain/src/runtime/llm-evidence/node-run/held-literals/tests/memory.test.ts
domain/src/runtime/llm-evidence/node-run/own-layers/memory.ts
domain/src/runtime/llm-evidence/node-run/own-layers/tests/memory.test.ts
domain/src/runtime/llm-evidence/node-run/retries/tests/uncertain-outcome.test.ts
domain/src/runtime/llm-evidence/node-run/run.ts
domain/src/runtime/llm-evidence/node-run/shown-addresses.ts
domain/src/runtime/llm-evidence/node-run/tests/arrival.test.ts
domain/src/runtime/llm-evidence/node-run/tests/press-raw-read.test.ts
domain/src/runtime/llm-evidence/node-run/tests/shown-addresses.test.ts
domain/src/runtime/llm-evidence/repeated-refusal.ts
domain/src/runtime/llm-evidence/tests/reauthor-reruns-own-extraction.test.ts
domain/src/runtime/llm-evidence/tests/repeat-across-explorations.test.ts
domain/src/runtime/llm-evidence/tools.ts
domain/src/runtime/llm-evidence/way-out-handles/cleared-control-handles.ts
domain/src/runtime/llm-evidence/way-out-handles/tests/cleared-control-handles.test.ts
packages/test-runner/src/existing-fluxiq-control.ts
packages/test-runner/src/existing-fluxiq-control/index.ts
packages/test-runner/src/flow-lane/creation/build-proposal.ts
packages/test-runner/src/flow-lane/creation/lane.ts
packages/test-runner/src/flow-lane/creation/tests/build-proposal.test.ts
packages/test-runner/src/flow-lane/creation/tests/lane.test.ts
packages/test-runner/src/live-llm/build-usage.ts
packages/test-runner/src/live-llm/call-rows.ts
packages/test-runner/src/live-llm/index.ts
packages/test-runner/src/live-llm/live-llm-run.ts
packages/test-runner/src/live-llm/reauthor-record.ts
packages/test-runner/src/live-llm/run-spend.ts
packages/test-runner/src/live-llm/step-log-instructed.ts
packages/test-runner/src/live-llm/step-log-spend.ts
packages/test-runner/src/live-llm/tests/build-usage.test.ts
packages/test-runner/src/live-llm/tests/call-rows.test.ts
packages/test-runner/src/live-llm/tests/canonical-judge-spend.test.ts
packages/test-runner/src/live-llm/tests/live-llm-run.test.ts
packages/test-runner/src/live-llm/tests/reauthor-record.test.ts
packages/test-runner/src/live-llm/tests/run-spend.test.ts
packages/test-runner/src/live-llm/tests/step-log-instructed.test.ts
packages/test-runner/src/live-llm/tests/step-log-spend.test.ts
packages/test-runner/src/run-scenario.ts
packages/test-runner/src/tests/existing-fluxiq-control.test.ts
domain/src/cleared-way-outs/build-state-source.ts
domain/src/runtime/llm-evidence/node-run/build-state/build-key.ts
domain/src/runtime/llm-evidence/node-run/build-state/index.ts
domain/src/runtime/llm-evidence/node-run/build-state/memory.ts
domain/src/runtime/llm-evidence/node-run/build-state/persistence.ts
domain/src/runtime/llm-evidence/node-run/build-state/tests/core-store.ts
domain/src/runtime/llm-evidence/node-run/build-state/tests/memory.test.ts
packages/test-runner/src/existing-fluxiq-control/flow-spend.ts
packages/test-runner/src/live-llm/flow-spend.ts
packages/test-runner/src/live-llm/spend-reader.ts
packages/test-runner/src/live-llm/tests/flow-purse.ts
packages/test-runner/src/live-llm/tests/flow-spend.test.ts
packages/test-runner/src/live-llm/tests/spend-reader.test.ts
```

UNIT READY: Unit 2 (audit phase 4: single sources, prompt rules, policy, screen; plus docs), Core:
```
apps/web/src/app/api/programs/[programId]/[endpoint]/tests/route.test.ts
apps/web/src/features/automation-studio/conversation/activity/headline.ts
apps/web/src/features/automation-studio/conversation/activity/index.ts
apps/web/src/features/automation-studio/conversation/activity/pacer.ts
apps/web/src/features/automation-studio/conversation/activity/steps/index.ts
apps/web/src/features/automation-studio/conversation/activity/steps/messages.ts
apps/web/src/features/automation-studio/conversation/activity/tests/pacing.test.ts
apps/web/src/features/automation-studio/conversation/activity/tests/paused.test.ts
apps/web/src/features/automation-studio/conversation/activity/usePacedConversationActivity.ts
apps/web/src/features/automation-studio/conversation/activity/wording.ts
apps/web/src/features/automation-studio/conversation/components/ConversationLiveLine.tsx
apps/web/src/features/automation-studio/conversation/tests/conversation-activity.test.tsx
apps/web/src/lib/program-route.ts
apps/web/src/lib/tests/program-route.test.ts
docs/architecture/automation-studio.md
docs/architecture/automation-studio/client-gateway.md
docs/architecture/automation-studio/flow-authoring.md
docs/architecture/automation-studio/llm-flow-bootstrap.md
docs/architecture/package-boundaries.md
docs/reference/framework-reference.md
packages/contracts/src/automation-studio.ts
packages/contracts/src/failure/index.ts
packages/contracts/src/record-sets/process/condition-holds.ts
packages/contracts/src/record-sets/process/index.ts
packages/contracts/src/record-sets/process/tests/condition-holds.test.ts
packages/contracts/src/record-sets/process/types.ts
packages/contracts/src/record-sets/process/value-reading-cases.ts
packages/fluxiq/docs/reference/framework-reference.md
packages/fluxiq/src/programs/automation-studio/api/contracts/recording.ts
packages/fluxiq/src/programs/automation-studio/api/handlers/dependencies.ts
packages/fluxiq/src/programs/automation-studio/api/handlers/recordings.ts
packages/fluxiq/src/programs/automation-studio/api/handlers/tests/recordings.test.ts
packages/fluxiq/src/programs/automation-studio/nodes/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/repeated-reason.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/last-fix.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/system-prompt.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/tests/system-prompt-pins.json
packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/tests/system-prompt.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/evidence-screen.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/tests/evidence-screen.test.ts
packages/fluxiq/src/ui/activity-action/failure-reason.ts
packages/fluxiq/src/ui/index.ts
apps/web/src/features/automation-studio/conversation/activity/paced-status.ts
apps/web/src/features/automation-studio/conversation/activity/steps/tests/words.test.ts
apps/web/src/features/automation-studio/conversation/activity/steps/words.ts
packages/contracts/src/failure/repeated-answer.ts
packages/contracts/src/failure/tests/repeated-answer.test.ts
packages/contracts/src/record-sets/process/count-unsortable-rows.ts
packages/contracts/src/record-sets/process/tests/count-unsortable-rows.test.ts
packages/contracts/src/record-sets/process/tests/row-identity.test.ts
packages/contracts/src/record-sets/process/tests/sort-rows.test.ts
packages/contracts/src/recording-capture/clamp.ts
packages/contracts/src/recording-capture/default-policy.ts
packages/contracts/src/recording-capture/index.ts
packages/contracts/src/recording-capture/policy.ts
packages/contracts/src/recording-capture/tests/clamp.test.ts
packages/fluxiq/src/programs/automation-studio/nodes/record-process.ts
packages/fluxiq/src/programs/automation-studio/nodes/recording-capture.ts
packages/fluxiq/src/programs/automation-studio/nodes/tests/record-process.test.ts
packages/fluxiq/src/programs/automation-studio/nodes/tests/recording-capture.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/tests/card-number-screen.test.ts
packages/fluxiq/src/ui/activity-status/activity-display.ts
packages/fluxiq/src/ui/activity-status/candidate-trial.ts
packages/fluxiq/src/ui/activity-status/clock.ts
packages/fluxiq/src/ui/activity-status/cut-at-word.ts
packages/fluxiq/src/ui/activity-status/declined-submission.ts
packages/fluxiq/src/ui/activity-status/ending-kind.ts
packages/fluxiq/src/ui/activity-status/fan-out-gate.ts
packages/fluxiq/src/ui/activity-status/headline-echo.ts
packages/fluxiq/src/ui/activity-status/headline.ts
packages/fluxiq/src/ui/activity-status/history-limits.ts
packages/fluxiq/src/ui/activity-status/index.ts
packages/fluxiq/src/ui/activity-status/internal-step.ts
packages/fluxiq/src/ui/activity-status/model-thought.ts
packages/fluxiq/src/ui/activity-status/not-tried.ts
packages/fluxiq/src/ui/activity-status/pacer.ts
packages/fluxiq/src/ui/activity-status/project/agent.ts
packages/fluxiq/src/ui/activity-status/project/index.ts
packages/fluxiq/src/ui/activity-status/project/project-card.ts
packages/fluxiq/src/ui/activity-status/project/tests/agent.test.ts
packages/fluxiq/src/ui/activity-status/project/tests/project-card.test.ts
packages/fluxiq/src/ui/activity-status/run-retry.ts
packages/fluxiq/src/ui/activity-status/step-recovery.ts
packages/fluxiq/src/ui/activity-status/step-skip.ts
packages/fluxiq/src/ui/activity-status/supervisor-ending.ts
packages/fluxiq/src/ui/activity-status/tests/candidate-trial-live.test.ts
packages/fluxiq/src/ui/activity-status/tests/candidate-trial.test.ts
packages/fluxiq/src/ui/activity-status/tests/cut-at-word.test.ts
packages/fluxiq/src/ui/activity-status/tests/declined-submission.test.ts
packages/fluxiq/src/ui/activity-status/tests/fake-clock.ts
packages/fluxiq/src/ui/activity-status/tests/fan-out-gate.test.ts
packages/fluxiq/src/ui/activity-status/tests/headline.test.ts
packages/fluxiq/src/ui/activity-status/tests/model-thought.test.ts
packages/fluxiq/src/ui/activity-status/tests/pacer.test.ts
packages/fluxiq/src/ui/activity-status/tests/step-recovery.test.ts
packages/fluxiq/src/ui/activity-status/tests/step-skip.test.ts
packages/fluxiq/src/ui/activity-status/tests/supervisor-ending.test.ts
packages/fluxiq/src/ui/activity-status/tests/unit-history.test.ts
packages/fluxiq/src/ui/activity-status/tests/wording.test.ts
packages/fluxiq/src/ui/activity-status/unit-history.ts
packages/fluxiq/src/ui/activity-status/unit-situation.ts
packages/fluxiq/src/ui/activity-status/word-cut.ts
packages/fluxiq/src/ui/activity-status/wording.ts
```

UNIT READY: Unit 2, downstream (includes the lane-s worker reports under this folder):
```
apps/extension/e2e/content/tests/live-tasks/tests/auction-marketplace-kestrel-auctions.spec.ts
apps/extension/src/background/activity/activity-relay.ts
apps/extension/src/background/activity/candidate-trial.ts
apps/extension/src/background/activity/clock.ts
apps/extension/src/background/activity/ending-kind.ts
apps/extension/src/background/activity/fan-out-gate.ts
apps/extension/src/background/activity/headline.ts
apps/extension/src/background/activity/index.ts
apps/extension/src/background/activity/pacer.ts
apps/extension/src/background/activity/run-retry.ts
apps/extension/src/background/activity/send-start.ts
apps/extension/src/background/activity/supervisor-ending.ts
apps/extension/src/background/activity/tests/activity-relay.test.ts
apps/extension/src/background/activity/tests/activity-replay.test.ts
apps/extension/src/background/activity/tests/candidate-trial-live.test.ts
apps/extension/src/background/activity/tests/candidate-trial.test.ts
apps/extension/src/background/activity/tests/fake-clock.ts
apps/extension/src/background/activity/tests/fan-out-gate.test.ts
apps/extension/src/background/activity/tests/headline.test.ts
apps/extension/src/background/activity/tests/pacer.test.ts
apps/extension/src/background/activity/tests/supervisor-ending.test.ts
apps/extension/src/background/activity/tests/unit-history.test.ts
apps/extension/src/background/activity/unit-history.ts
apps/extension/src/background/activity/unit-situation.ts
apps/extension/src/background/connection.ts
apps/extension/src/background/connection/content-attachment.ts
apps/extension/src/background/panel/settings-save.ts
apps/extension/src/background/panel/tests/settings-save.test.ts
apps/extension/src/background/saved-state.ts
apps/extension/src/background/tests/saved-state.test.ts
apps/extension/src/content/activity-overlay/model-prose.ts
apps/extension/src/content/activity-overlay/overlay-view.ts
apps/extension/src/content/activity-overlay/overlay.ts
apps/extension/src/content/activity-overlay/tests/overlay-view.test.ts
apps/extension/src/content/extraction/item-filter.ts
apps/extension/src/content/extraction/order-rows.ts
apps/extension/src/content/extraction/tests/order-rows.test.ts
apps/extension/src/content/message-handler.ts
apps/extension/src/panel/settings/draft-store.ts
apps/extension/src/panel/settings/form-fields.ts
apps/extension/src/panel/settings/tests/connection-settings.test.ts
apps/extension/src/shared/activity/activity-display.ts
apps/extension/src/shared/activity/cut-at-word.ts
apps/extension/src/shared/activity/declined-submission.ts
apps/extension/src/shared/activity/extension-activity-state.ts
apps/extension/src/shared/activity/headline-echo.ts
apps/extension/src/shared/activity/history-limits.ts
apps/extension/src/shared/activity/index.ts
apps/extension/src/shared/activity/internal-step.ts
apps/extension/src/shared/activity/model-thought.ts
apps/extension/src/shared/activity/not-tried.ts
apps/extension/src/shared/activity/project/agent.ts
apps/extension/src/shared/activity/project/index.ts
apps/extension/src/shared/activity/project/project-card.ts
apps/extension/src/shared/activity/project/tests/agent.test.ts
apps/extension/src/shared/activity/project/tests/project-card.test.ts
apps/extension/src/shared/activity/step-recovery.ts
apps/extension/src/shared/activity/step-skip.ts
apps/extension/src/shared/activity/tests/cut-at-word.test.ts
apps/extension/src/shared/activity/tests/declined-submission.test.ts
apps/extension/src/shared/activity/tests/model-thought.test.ts
apps/extension/src/shared/activity/tests/step-recovery.test.ts
apps/extension/src/shared/activity/tests/step-skip.test.ts
apps/extension/src/shared/activity/tests/wording.test.ts
apps/extension/src/shared/activity/word-cut.ts
apps/extension/src/shared/activity/wording.ts
docs/architecture/build-loop.md
docs/architecture/extension-client.md
docs/architecture/page-evidence.md
docs/architecture/testing-facility.md
docs/architecture/web-capabilities.md
domain/src/actions/extraction/condition-grammar.ts
domain/src/actions/extraction/condition-match.ts
domain/src/actions/extraction/field-match.ts
domain/src/actions/extraction/index.ts
domain/src/actions/extraction/request.ts
domain/src/actions/extraction/tests/condition-match.test.ts
domain/src/actions/extraction/tests/value-reading-parity.test.ts
domain/src/actions/types.ts
domain/src/output-nodes/extract-list/column-match.ts
domain/src/requests/policy/contracts.ts
domain/src/requests/policy/tests/validation.test.ts
domain/src/requests/policy/validation.ts
domain/src/runtime/llm-evidence/node-run/context.ts
domain/src/runtime/llm-evidence/node-run/numeric-text-filter.ts
domain/src/runtime/llm-evidence/node-run/tests/rejected-rows.test.ts
domain/src/runtime/llm-evidence/structure/tests/badge-column.test.ts
domain/src/runtime/llm-evidence/system-instructions/instructions.ts
domain/src/runtime/llm-evidence/system-instructions/tests/instructions.test.ts
domain/src/runtime/llm-evidence/tool-rejection.ts
domain/src/runtime/llm-evidence/withheld.ts
apps/extension/src/background/capture-policy/capture-policy-source.ts
apps/extension/src/background/capture-policy/effective-settings.ts
apps/extension/src/background/capture-policy/index.ts
apps/extension/src/background/capture-policy/read-capture-policy.ts
apps/extension/src/background/capture-policy/tests/capture-policy-source.test.ts
apps/extension/src/background/capture-policy/tests/effective-settings.test.ts
apps/extension/src/background/capture-policy/tests/read-capture-policy.test.ts
docs/working/extension-core-boundary-audit/reports/lane-s-a-accounting.md
docs/working/extension-core-boundary-audit/reports/lane-s-b-activity.md
docs/working/extension-core-boundary-audit/reports/lane-s-c-record-process.md
docs/working/extension-core-boundary-audit/reports/lane-s-d-prompt-screen.md
docs/working/extension-core-boundary-audit/reports/lane-s-d1-activity-switch.md
docs/working/extension-core-boundary-audit/reports/lane-s-d2-record-process-switch.md
docs/working/extension-core-boundary-audit/reports/lane-s-d3-prompt-screen-switch.md
docs/working/extension-core-boundary-audit/reports/lane-s-d4-lifecycle-switch.md
docs/working/extension-core-boundary-audit/reports/lane-s-d5-lab-accounting.md
docs/working/extension-core-boundary-audit/reports/lane-s-d6-capture-policy-switch.md
docs/working/extension-core-boundary-audit/reports/lane-s-e-lifecycle.md
docs/working/extension-core-boundary-audit/reports/lane-s-f-capture-policy.md
docs/working/extension-core-boundary-audit/reports/lane-s-g-docs.md
docs/working/extension-core-boundary-audit/reports/lane-s-h-core-docs.md
docs/working/extension-core-boundary-audit/reports/lane-s-i-headed-check.md
docs/working/extension-core-boundary-audit/reports/lane-s.md
```

## Follow-ups and decisions for the supervisor

- Lane H (`scripts/**`): `balance-failure.mjs` and `step-log-outcome.mjs` should key on Core's
  `llm.provider_balance_exhausted` / `flow_bootstrap.provider_balance_exhausted` (Core's message does not match the
  old text pattern; a balance failure is caught today only by its 402 status). Exact edits and three stale script
  comments are in `lane-s-d5-lab-accounting.md` and `lane-s-g-docs.md`.
- Lane G: `background/storage.ts` still forces `requestsEnabled` false and `gateway-session.ts` still sends the raw
  capture flags in the hello; both should follow Core's policy when G is done.
- Explicit build field: once L1 lands, the evidence tool request can carry Core's build scope as a contract field
  (`harness-options/binding.ts`, `llm/evidence-loop.ts`), replacing the AsyncLocalStorage accessor.
- Lost Lab diagnostics: deleting `step-log-spend.ts` removed `largestInputTokens` and per-agent `byRole` tallies; Core
  publishes no equivalent. Decide whether the A8 comparison still needs them.
- Core web now shows the extension's activity wording, including "Waiting for you: answer in the FluxIQ panel", which
  reads oddly inside Core's own panel; a host-supplied waiting phrase would fix it. Chat step-title wording is still
  two copies (`apps/web .../steps/words.ts`, extension `panel/chat/stream/step/words.ts`).
- `extension-chat-check` `theMessageIsTheInstruction` failed on the headed run (an earlier turn folded into the saved
  instruction); not traced to this diff, not checked against `dev`.
- `shown-addresses` can exceed Core's 64 KiB per-value bound; the write is then refused and that memory survives only
  in process (best effort, as before this task). `run.ts` sits at the 800-line limit.
- `summarize-task.mjs:39` (scripts, lane H) may double-count repair calls; pre-existing.

## Supervisor follow-ups (2026-10-20), after units 1-2 were committed and dev merged

### Results
- F1 host-aware wording: `ActivityPacerOptions.hostWords` and `activityHeadline(kind, outcome, words, situation?)` take
  each host's words (required). Extension unchanged ("Waiting for you: answer in the FluxIQ panel" / "finish the check
  on the page"); Core web "Waiting for your answer" / "Waiting for you: finish the check in your browser". Report
  `lane-s-f1-host-words.md`.
- F2 tallies: Core's Flow spend record and `get-flow-spend` carry `largestInputTokens` and `byRole` ({role: {calls,
  estimatedCostUsd}}, null when unknown); the Lab writes them as `runSpend.largestInputTokens` / `runSpend.byRole`
  (moved from `runSpend.stepLog.*`; no script read the old names). Report `lane-s-f2-tallies.md`.
- F3 instruction fold: not caused by lane S. `dev` (main checkouts, dev Core rebuilt as authorised) fails the same
  check 13/14 with the same folded instruction. Cause: Core `runtime/conversations/person-words.ts` read a build's
  instruction from every person turn since the thread last "showed something done", and a plain reply (words-only
  `whatICanDo`, or any model reply) never counted (Core 1f16b6e9, 2026-10-07). Fix (exact, after the lead rejected a
  first question-mark heuristic): Core records its decision kind (`reply` | `clarify` | `invoke`) on each answer turn
  (migration `0026_responded_turn_decision`, nullable `decision_kind`; never projected to any client read);
  `reply`/`invoke` close the earlier request, `clarify` keeps it open, turns without a record behave as before. Core's
  `dev` needs this when t728 merges. Report `lane-s-f3-instruction-fold.md`.
- F4 balance guards: `balance-failure.mjs` matches `llm.provider_balance_exhausted` and
  `flow_bootstrap.provider_balance_exhausted` (step-log codes already flow through `step-log-outcome.mjs`); 402 and text
  matches kept; stale script comments fixed; lead updated `docs/architecture/testing-facility.md`. Report
  `lane-s-f4-balance-guards.md`.
- F5 storage and hello: storage applies no policy and keeps the person's stored choice (a restart read before any
  policy writes nothing back); saves under a known live policy go through Core's clamp (`requestsChoice`); the hello
  reports the effective settings via a new `effectiveSettings` dep from D6's `CapturePolicySource`; the panel receives
  `captureAllowed` booleans and disables what Core forbids. Report `lane-s-f5-storage-hello.md`.

### Lead validation (final trees)
- Core: `pnpm --filter fluxiq build` current; fluxiq and web checks pass; structure audit "passed (419 warning(s), 1152
  baselined)"; contract tests + `ui/activity-status`, `runtime/conversations`, schema tests, creation-spend,
  build-purse, runs and conversations handler tests -> 62 files, 558 tests passed.
- Downstream: core-build gate current; extension, domain, test-runner checks pass (gated); structure audit "passed
  (208 warning(s), 625 baselined)"; extension `background/` + `panel/settings/` -> 618/618; test-runner live-llm,
  control and flow-lane/creation -> 361/361; `scripts/lab/live-guards` -> 50/50.
- Headed: F3's t728 rerun (label lane-s-f3) -> CHECK EXIT 0, 14/14, saved instruction exactly the typed sentence.

UNIT READY: follow-up F1
- Core:
```
apps/web/src/features/automation-studio/conversation/activity/index.ts
apps/web/src/features/automation-studio/conversation/activity/paced-status.ts
apps/web/src/features/automation-studio/conversation/activity/steps/messages.ts
apps/web/src/features/automation-studio/conversation/activity/tests/pacing.test.ts
apps/web/src/features/automation-studio/conversation/activity/tests/paused.test.ts
packages/fluxiq/src/ui/activity-status/headline.ts
packages/fluxiq/src/ui/activity-status/index.ts
packages/fluxiq/src/ui/activity-status/pacer.ts
packages/fluxiq/src/ui/activity-status/tests/candidate-trial-live.test.ts
packages/fluxiq/src/ui/activity-status/tests/candidate-trial.test.ts
packages/fluxiq/src/ui/activity-status/tests/headline.test.ts
packages/fluxiq/src/ui/activity-status/tests/pacer.test.ts
packages/fluxiq/src/ui/activity-status/tests/supervisor-ending.test.ts
apps/web/src/features/automation-studio/conversation/activity/host-words.ts
packages/fluxiq/src/ui/activity-status/host-words.ts
packages/fluxiq/src/ui/activity-status/tests/test-host-words.ts
```
- downstream:
```
apps/extension/src/background/activity/activity-relay.ts
apps/extension/src/background/activity/index.ts
apps/extension/src/background/activity/tests/activity-relay.test.ts
apps/extension/src/background/activity/host-words.ts
docs/working/extension-core-boundary-audit/reports/lane-s-f1-host-words.md
```

UNIT READY: follow-up F2
- Core:
```
packages/fluxiq/src/programs/automation-studio/api/contracts/run.ts
packages/fluxiq/src/programs/automation-studio/api/handlers/runs.ts
packages/fluxiq/src/programs/automation-studio/api/handlers/tests/runs.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/creation-spend/parse.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/creation-spend/record.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/creation-spend/tests/parse.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/build-purse/settlement-ledger.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/build-purse/tests/settlement-ledger.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/build-purse/types.ts
packages/fluxiq/src/programs/automation-studio/runtime/service/creation-spend.ts
packages/fluxiq/src/programs/automation-studio/runtime/service/tests/creation-spend-itemised.test.ts
```
- downstream:
```
packages/test-runner/src/existing-fluxiq-control/flow-spend.ts
packages/test-runner/src/live-llm/flow-spend.ts
packages/test-runner/src/live-llm/index.ts
packages/test-runner/src/live-llm/tests/flow-purse.ts
packages/test-runner/src/live-llm/tests/flow-spend.test.ts
packages/test-runner/src/live-llm/tests/live-llm-run.test.ts
packages/test-runner/src/tests/existing-fluxiq-control.test.ts
docs/working/extension-core-boundary-audit/reports/lane-s-f2-tallies.md
packages/test-runner/src/existing-fluxiq-control/tests/flow-spend.test.ts
```

UNIT READY: follow-up F3
- Core:
```
packages/fluxiq/src/programs/automation-studio/runtime/conversations/conversations.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/inputs.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/instructions/respond.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/instructions/tests/respond-to-turn.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/person-words.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/rows.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/store.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/tests/person-words.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/tests/store.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/turn.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/writer.ts
packages/fluxiq/src/programs/automation-studio/storage/project/administration.ts
packages/fluxiq/src/programs/automation-studio/storage/project/schema/index.ts
packages/fluxiq/src/programs/automation-studio/storage/project/schema/conversation-turn-decision.ts
packages/fluxiq/src/programs/automation-studio/storage/project/schema/tests/conversation-turn-decision.test.ts
```
- downstream:
```
docs/working/extension-core-boundary-audit/reports/lane-s-f3-instruction-fold.md
```

UNIT READY: follow-up F4
- downstream:
```
docs/architecture/testing-facility.md
scripts/lab/live-campaign/row/build-spend.mjs
scripts/lab/live-campaign/row/reported-spend.mjs
scripts/lab/live-guards/balance-failure.mjs
scripts/lab/live-guards/step-log-outcome.mjs
scripts/lab/live-guards/tests/balance-failure.test.mjs
docs/working/extension-core-boundary-audit/reports/lane-s-f4-balance-guards.md
scripts/lab/live-guards/tests/step-log-outcome.test.mjs
```

UNIT READY: follow-up F5
- downstream:
```
apps/extension/e2e/runtime/tests/requests-settings.spec.ts
apps/extension/src/background/capture-policy/index.ts
apps/extension/src/background/connection.ts
apps/extension/src/background/connection/gateway-session.ts
apps/extension/src/background/connection/host-lease/tests/gateway-carriage.test.ts
apps/extension/src/background/connection/tests/gateway-session.test.ts
apps/extension/src/background/index.ts
apps/extension/src/background/panel/panel-control-deps.ts
apps/extension/src/background/panel/panel-control.ts
apps/extension/src/background/panel/settings-save.ts
apps/extension/src/background/panel/tests/panel-control.test.ts
apps/extension/src/background/panel/tests/settings-save.test.ts
apps/extension/src/background/saved-state.ts
apps/extension/src/background/storage.ts
apps/extension/src/background/tests/connection-status.test.ts
apps/extension/src/background/tests/saved-state.test.ts
apps/extension/src/background/tests/storage-settings.test.ts
apps/extension/src/panel/settings/address-form.ts
apps/extension/src/panel/settings/draft-store.ts
apps/extension/src/panel/settings/form-fields.ts
apps/extension/src/panel/settings/index.ts
apps/extension/src/panel/settings/settings-view.ts
apps/extension/src/panel/settings/tests/connection-settings.test.ts
apps/extension/src/shared/protocol.ts
apps/extension/src/background/capture-policy/allowed-capture.ts
apps/extension/src/background/capture-policy/requests-choice.ts
apps/extension/src/background/capture-policy/tests/allowed-capture.test.ts
apps/extension/src/background/capture-policy/tests/requests-choice.test.ts
apps/extension/src/panel/settings/tests/policy-toggles.test.ts
apps/extension/src/panel/settings/toggle-view.ts
docs/working/extension-core-boundary-audit/reports/lane-s-f5-storage-hello.md
```

