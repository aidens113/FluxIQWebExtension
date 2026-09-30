# t188 node limits

Status: Ready to commit (2026-09-29 ~19:40). All three worker reports landed and were verified; see "Final validation".
"Discovery"; this top section records the implementation as it lands.

## Design (decided 2026-09-29, lane lead)

- **One setting.** `flow.metadata.flowSizeSettings.maxNodesPerSubflow`, default 100, whole number
  1..1000. Core has no per-project settings store; build-shaping settings (`trainingModeSettings`,
  `llmExecutionSettings`) are per Flow in `flow.metadata`, edited in the web panel's Flow Settings and
  saved through `update-flow-settings`, so this follows that pattern. A Flow with no value reads the
  default; nothing is migrated. Model: Core `P/model/flow-size/flow-size-settings.ts`
  (`AUTOMATION_STUDIO_FLOW_SIZE_SETTING`, `automationStudioFlowSizeSettingIssue`,
  `automationStudioFlowMaxNodesPerSubflow`). The 1..1000 range is the setting's validation range, not a
  Flow cap: it stops a mistyped value deriving byte budgets no reader can hold.
- **Derived bounds.** Core `P/runtime/flow-bootstrap/plan/size-limits.ts`
  (`automationStudioFlowBootstrapSizeLimits(n)`): edges per Subflow 2n; total nodes n x 8 Subflows;
  total edges 2 x total nodes; graph depth n (a straight n-chain fits); plan bytes
  max(65,536, total x 2 KiB); one reply's result bytes max(12,000, n x 1 KiB).
  `...SizeLimitsOf(flow)` reads a Flow; `...LargestSizeLimits()` (n = 1000) bounds readers of stored or
  published records that have no Flow in hand, so any record a Flow's setting allowed stays readable.
- **Reply and draft profiles both** take nodes and edges from the setting; their Subflow-count, rule,
  name and parameter bounds stay (they bound a reply's shape, not its nodes).
- **Constants kept for `runtime/llm/**`.** `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_OUTPUT_SCHEMA` and the
  evidence completion schema constants stay, equal to the default-size results, because llm code
  imports them (deepseek preflight compares the context schema to the constant by JSON equality).

## Work partition

| Brief | Agent | Files | Report |
| --- | --- | --- | --- |
| A1 plan core | worker-high | `runtime/flow-bootstrap/plan/**`, `plan.ts`, plan tests, one llm test if it pins numbers | `t188-node-limits-plan.md` |
| A2 other readers | worker | `evidence-loop-steps.ts`, `generation-failure/diagnostic-parse.ts`, `incomplete-draft/parse.ts`, `model/validation/adaptation.ts`, `storage/project/adaptation-store.ts` call, `recovery/repair-context/flow-graph.ts` | `t188-node-limits-readers.md` |
| B setting + UI | worker | `model/flows.ts`, `runtime/service/flow-settings/**`, `api/handlers/flows.ts`, web `settings/**` | `t188-node-limits-settings.md` |
| Lead | lead | `model/flow-size/**`, `plan/size-limits.ts`, `runtime/service.ts`, service-bootstrap tests, docs | this file |

## service.ts wiring (lead)

`runtime/service.ts`: one new line (`const size = automationStudioFlowBootstrapSizeLimitsOf(parent)` in
bootstrap generation) and inline edits: the bootstrap context, the evidence draft completion schema
shown to the model, the one-call build's validation, and the propose-time and apply-time validations
all take the Flow's size. File 4552 -> 4553 lines (file-lines baseline 4558).

## State at hand-back (2026-09-29)

- Lead's own edits: `model/flow-size/**` (its test passes: `npx vitest run src/programs/automation-studio/model/flow-size`
  gave 4 passed); `plan/size-limits.ts`; `runtime/service.ts` wiring plus propose and apply refusals now
  carrying issue messages, so they name the setting; `rejections.test.ts` uses the derived limit;
  `runtime/tests/service-bootstrap/tests/flow-size.test.ts` (end to end, not yet run); Core
  `docs/architecture/automation-studio/llm-flow-bootstrap.md` "Flow Size" section.
- Workers A1, A2 and B were still editing (see `git status` in the Core tree); their reports were not written.
- **Known gap: `runtime/llm/**` is out of this lane.** The evidence-loop completion verdict
  (`llm/harness-options/bootstrap-completion.ts` parse, profile limits and validate), `llm/harness/output-validation.ts`,
  `llm/harness/provider-result.ts`, `llm/deepseek/response-envelope.ts`, `llm/harness/context-packet.ts`
  (context build) and `llm/deepseek/preflight.ts` (schema equality) all use the default of 100. A changed
  setting is honoured at propose, apply, the one-call build and the schema shown to the model, but not
  inside the evidence loop's completion check. The fix is to add `size?` to the harness input
  `flowBootstrap` (`llm/harness/task-request.ts:196`) and pass it at those call sites.

## Second pass (after the supervisor approved the llm pass-through), 2026-09-29 18:40

- Readers worker (A2) finished: Done; see `t188-node-limits-readers.md`. Its vitest run gave 563 passed and
  4 failed, all 4 in `plan.test.ts` (A1's area, still in progress). Its tsc gave 3 errors, none in its files.
- The llm pass-through is applied, with no behaviour change at the default:
  - `llm/harness/task-request.ts`: `flowBootstrap.size?`.
  - `harness/output-validation.ts`, `harness/provider-result.ts`, `harness/context-packet.ts`: pass `size`.
  - `harness-options/bootstrap-completion.ts`: input `size?` goes to parse, the profile limits and validatePlan.
    This is a 4-line change; t174's `fromDraft` summary bound is untouched.
  - `deepseek/response-envelope.ts` and `deepseek/preflight.ts`: size read from the packed context via the new
    `automationStudioFlowBootstrapSizeLimitsOfContext` (in `plan/size-limits.ts`).
  - `deepseek/output-schema.ts`: the response schema sent to the provider is sized the same way. This one-line
    change goes beyond the list the supervisor approved; I am naming it here.
  - None of `llm/evidence-loop.ts`, `llm/context-window.ts` or `llm/evidence-loop/**` was touched or needed.
- `service.ts` passes `size` to the completion check and to both harness `flowBootstrap` inputs.
  `saveFlowAdaptation` now validates deterministic paths at the Flow's own setting. It is still 4553 lines.
- `storage/project/adaptation-store.ts:64` (`putAdaptation`) now bounds at the setting's maximum, because the
  service has already checked the Flow's setting.
- `plan/contracts.ts`: the context has an optional `maxNodesPerSubflow`.
- `answerability/check.ts:39`: the stale comment is fixed.
- **Still to do:**
  - `plan/catalog.ts` must set `maxNodesPerSubflow` on the context when the size is not the default. It is A1's
    file, so this waits for A1. Until it is done, the deepseek preflight and envelope read the default for a
    non-default Flow.
  - The A1 (plan) and B (settings) reports.
  - All validation: the affected vitest dirs, `flow-size.test.ts`, tsc for fluxiq and web, and `pnpm check`.
- For t190 (reachability and instructed-acts are not mine): `instructed-acts/check.ts:97` cuts its step list at 32
  without saying so. It needs `stepsWithheld`, as answerability has.

## Third pass, verification by the lead (2026-09-29, before A1 reported)

- `service.ts`: `saveFlowAdaptation` reads the Flow with a plain `getFlow` (no `.catch`). The `.catch(() => undefined)`
  had pushed failure-as-empty to 17 against its baseline of 16, which B found. `node scripts/structure-audit.mjs`:
  "structure-audit: passed (198 warning(s), 355 baselined)", plus "1 baseline entries can be lowered".
- B verified. I read its diff (model/flows.ts default, merged-metadata, fingerprint only when the value is not 100,
  handler `assertFlowSizeSettings` and `withFlowSizeSettings`, the web field, draft, errors and payload, and a
  web mirror constant with a drift test). Core run:
  `npx vitest run runtime/service/flow-settings api/handlers/tests/flows.test.ts model/tests model/flow-size
  runtime/tests/service-bootstrap/tests/flow-size.test.ts --maxWorkers=2 --minWorkers=1` gave 14 files passed,
  1 failed; 112 tests passed, 2 failed. Both failures were in my `flow-size.test.ts`:
  - The apply case called approve and never apply.
  - The schema case read the draft completion schema, which A1 rightly left unsized (it asks only for a
    sentence).
  Both are fixed: the apply case now approves, lowers the setting, then applies; the schema case checks the
  context's `outputSchema` nodes/edges `maxItems` and `maxNodesPerSubflow`.
  Web run: `npx vitest run src/features/automation-studio/settings --maxWorkers=2 --minWorkers=1` gave
  "9 passed (9) / 59 passed (59)".
- The first two end-to-end cases passed: 100-node chain accepted and 101 refused naming the setting; a lowered
  setting of 20 and a raised one of 150 honoured through the settings endpoint.
- **Slot incident, from B:** at about 01:41Z B's command deleted another lane's `build-slots/b2` claim (an
  unconditional rm ran after its mkdir failed). The supervisor should tell that lane.

## Final validation (lead, 2026-09-29)

- A1 (plan) reported Done (`t188-node-limits-plan.md`). I acted on its open items:
  - Size refusals (`bootstrap.invalid_nodes`, `invalid_edges`, `too_many_nodes`, `too_many_edges`,
    `plan_too_large`, `graph_too_deep`) are added to `plan/issue-feedback.ts` `AUTHORED_CODES`. The model now sees
    the sentence naming `flowSizeSettings.maxNodesPerSubflow` and its value. The sentences are Core's own and
    quote only counts.
  - `service.ts:1534` and `llm/harness/context-packet.ts:250` pass `size` to the catalog byte budget.
  - The `rejections.test.ts` profile row now sends 5 Subflows, and a new "Flow size" row expects
    `plan_invalid` / `bootstrap.invalid_nodes` for 101 nodes.
  - The `flow-size.test.ts` apply case now expects `FLOW_BOOTSTRAP_STALE`, the designed behaviour: the setting
    is in the settings revision (when it is not the default), so a proposal built under the old value is stale.
- Affected Core suites:
  `bash build-slots/heavy.sh "t188 lead affected vitest" npx vitest run runtime/flow-bootstrap runtime/llm/harness
  runtime/llm/harness-options runtime/llm/deepseek runtime/tests/service-bootstrap runtime/service/flow-settings
  runtime/service/flow-bootstrap-commands api/handlers/tests/flows.test.ts model runtime/recovery/repair-context
  storage/project/tests/adaptation-store.test.ts --maxWorkers=2 --minWorkers=1` gave
  "Test Files 91 passed (91) / Tests 1191 passed (1191)".
- Web: `npx vitest run src/features/automation-studio/settings --maxWorkers=2 --minWorkers=1` gave 9 files and
  59 tests passed. Nothing in the web changed after that run.
- `bash build-slots/heavy.sh "t188 lead pnpm check" pnpm check` exited 0: structure-audit passed (198 warnings,
  355 baselined), and tsc for contracts, fluxiq, client-gateway-websocket and apps/web were all Done.
  `structure-audit --rule docs-links` passed after the doc edits.
- The audit offers to lower the `service.ts` file-lines baseline from 4558 to 4553. I did not record it:
  `--update` also dropped unrelated web entries, and other lanes edit `service.ts`. It is the supervisor's call
  at integration.
- Not verified: live browser or panel use of the new control (none allowed in this lane); whole-repo `pnpm test`;
  a live DeepSeek call at a non-default size.

## Downstream mirrors

Grepped `domain/src`, `packages/test-runner/src`, `packages/test-contracts/src` and `apps/*/src` for
16/64 node and step limits. None mirror a Flow node cap: test-runner `MAX_EVIDENCE_LOOP_STEPS = 65` and
`MAX_STEP_ROWS = 129` mirror Core's evidence-loop iterations (64 + 1 and 2 x 64 + 1), not nodes. The
downstream tree is unchanged apart from these reports.

---

# Discovery (interim report, handed back early for machine restart)

Source read: Core `dev` at `e85a02a`. Paths are relative to
`packages/fluxiq/src/programs/automation-studio/` unless they start with `apps/`.

## Node-count caps found (file:line)

1. `runtime/flow-bootstrap/plan/limits.ts:29` reply `maxNodesPerSubflow: 16`, `:30` edges 24, `:27` Subflows 4.
2. `runtime/flow-bootstrap/plan/limits.ts:7` `maxNodesPerSubflow: 64`; `:9` `maxTotalNodes: 64`; `:8` edges 128;
   `:10` total edges 128; `:11` `maxGraphDepth: 16` (a hidden 16-node cap on a chain); `:12` `maxPlanBytes: 65_536`.
3. `runtime/flow-bootstrap/plan/profile-limits.ts:66,67,57` (reply 16 / draft 64, edges, result bytes).
4. `runtime/flow-bootstrap/plan/parsing.ts:76,79,24,25,27`.
5. `runtime/flow-bootstrap/plan/validation.ts:372` graph depth.
6. `runtime/flow-bootstrap/plan/output-schema.ts:100,101` nodes maxItems 64, edges 128.
7. `runtime/flow-bootstrap/evidence-loop-steps.ts:381` `MAX_REPRESENTED_DRAFT_STEPS`.
8. `runtime/flow-bootstrap/generation-failure/diagnostic-parse.ts:219` `EVIDENCE_LOOP_MAX_DRAFT_STEPS`.
9. `model/validation/adaptation.ts:15,182` `DETERMINISTIC_PATH_MAX_NODES = 16`.
10. `runtime/flow-bootstrap/incomplete-draft/parse.ts:11` `MAX_STEPS = 256`.

Small caps to confirm as bounding something else: `plan/evidence-schema.ts:23` `MAX_ACT_CLAIMS = 16`;
`evidence-loop-steps.ts:195` refusals 16; `answerability/check.ts:40`, `reachability/check.ts:43` 24;
`instructed-acts/check.ts:35` 32; `recovery/repair-context/flow-graph.ts:35` 24;
`recovery/repair-context/step-parameters.ts:31` 12; `result-verification/verdict.ts:46` 12;
`llm/harness/structured-response.ts:176` 8; `llm/node-tools/run-node.ts:44` 400;
`executor/graph-run.ts:216` 100,000.
