# t188 node limits: interim report (handed back early for machine restart)

Status: Partial. Discovery only. No worktree created, no code edited, no builds or tests run.

Why no worktree: `C:/Users/osrs_/FluxStuff/lab-slots/slot-1` exists, owned by a live t174 Lab
run (`owner`: `t174 crossborder-marketplace crossborder-marketplace-hub-to-cart 2026-09-30T00:47:11Z`).
Per the brief, the worktree waits until slot-1 is absent.

Source read: Core `dev` at `e85a02a` via `git show dev:` / `git grep dev` in
`C:/Users/osrs_/FluxStuff/!FluxIQ`. Paths below are relative to
`packages/fluxiq/src/programs/automation-studio/` unless they start with `apps/`.

## Node-count caps found (file:line)

Direct node caps, to replace with the one setting:

1. `runtime/flow-bootstrap/plan/limits.ts:29` `AUTOMATION_STUDIO_EVIDENCE_FLOW_BOOTSTRAP_LIMITS.maxNodesPerSubflow: 16`
   (the "reply" profile). Also `:30` `maxEdgesPerSubflow: 24`, which caps a 100-node Subflow as
   surely as the node cap does, and `:27` `maxSubflows: 4`.
2. `runtime/flow-bootstrap/plan/limits.ts:7` `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_LIMITS.maxNodesPerSubflow: 64`;
   `:9` `maxTotalNodes: 64`; `:8` `maxEdgesPerSubflow: 128`; `:10` `maxTotalEdges: 128`;
   `:11` `maxGraphDepth: 16` (a straight chain of 17+ nodes is refused `bootstrap.graph_too_deep`,
   so this is a hidden 16-node cap); `:12` `maxPlanBytes: 65_536` (100 real nodes may exceed it).
3. `runtime/flow-bootstrap/plan/profile-limits.ts:66` `maxNodesPerSubflow` (reply 16 / draft 64),
   `:67` edges, `:57` result bytes. This is what emits `completion_profile_limit_exceeded`.
4. `runtime/flow-bootstrap/plan/parsing.ts:76` nodes per Subflow vs 64 (`bootstrap.invalid_nodes`);
   `:79` edges vs 128; `:24` total nodes vs 64 (`bootstrap.too_many_nodes`); `:25` total edges; `:27` plan bytes.
5. `runtime/flow-bootstrap/plan/validation.ts:372` graph depth vs `maxGraphDepth` (16).
6. `runtime/flow-bootstrap/plan/output-schema.ts:100` `nodes maxItems: 64`, `:101` `edges maxItems: 128`
   (the schema the model is shown).
7. `runtime/flow-bootstrap/evidence-loop-steps.ts:381` `MAX_REPRESENTED_DRAFT_STEPS` = `maxTotalNodes` + ...
8. `runtime/flow-bootstrap/generation-failure/diagnostic-parse.ts:219` `EVIDENCE_LOOP_MAX_DRAFT_STEPS` = `maxTotalNodes` + iterations + 1.
9. `model/validation/adaptation.ts:15,182` `DETERMINISTIC_PATH_MAX_NODES = 16` (adaptation deterministic path).
10. `runtime/flow-bootstrap/incomplete-draft/parse.ts:11` `MAX_STEPS = 256` (comment `:7` "a Flow is at most 64 nodes"; stale once the setting exists).

Small fixed caps that bound something other than a Flow's node count (candidates to keep, each to be confirmed):

- `runtime/flow-bootstrap/plan/evidence-schema.ts:23` `MAX_ACT_CLAIMS = 16` (instructed acts per completion); `:45` `maxResultBytes 12_000` (script bytes: must scale if a reply may write 100 nodes).
- `runtime/flow-bootstrap/evidence-loop-steps.ts:195` `MAX_EVIDENCE_STEP_AMENDMENT_REFUSALS = 16` (refusal list length).
- `runtime/flow-bootstrap/answerability/check.ts:40`, `runtime/flow-bootstrap/reachability/check.ts:43` `MAX_FEEDBACK_STEPS = 24`; `runtime/flow-bootstrap/instructed-acts/check.ts:35` `MAX_LISTED_STEPS = 32` (feedback listing size).
- `runtime/recovery/repair-context/flow-graph.ts:35` `maxNodes: 24`; `runtime/recovery/repair-context/step-parameters.ts:31` `MAX_STEPS = 12`; `runtime/result-verification/verdict.ts:46` `MAX_OBSERVED_STEPS = 12` (prompt-context bounds; repair-context 24 needs checking: if it truncates the graph a repair of node 30 cannot see it).
- `runtime/llm/harness/structured-response.ts:176` `AUTOMATION_STUDIO_RUNTIME_PATCH_MAX_STEPS = 8` (runtime patch size).
- `runtime/llm/node-tools/run-node.ts:44` `MAX_ENUMERATED_NODES = 400`; `runtime/executor/graph-run.ts:216` `AUTOMATION_STUDIO_MAX_RUN_STEPS = 100_000` (run steps, not nodes).

Tests pinning the old numbers: `runtime/flow-bootstrap/plan/tests/profile-limits.test.ts:21,30`;
`runtime/llm/harness-options/tests/bootstrap-completion.test.ts:403`;
`runtime/tests/service-bootstrap/tests/rejections.test.ts:72`; `runtime/flow-bootstrap/tests/plan.test.ts:404` (depth).

Not yet swept: `runtime/flow-draft/**`, the rest of `model/validation/**`, executor, `api/contracts/**`,
the web editor (`apps/web`), and downstream `domain` plan limits and Lab contracts in this repository.

## Where the setting goes

- Core stores Flow settings in `flow.metadata` (`trainingModeSettings`, `adaptationPolicySettings`,
  `llmExecutionSettings`). Defaults: `defaultAutomationStudioFlowSettingsMetadata()` in `model/`.
  Merge: `runtime/service/flow-settings/merged-metadata.ts`. The read-time migration pattern to copy
  is `runtime/service/flow-settings/locked-default-migration.ts` (applied in `runtime/service/flows/store.ts`
  `getFlow` and in `merged-metadata.ts`). Save: `update-flow-settings` in `api/handlers/flows.ts` merges a patch.
- Web: `apps/web/src/features/automation-studio/settings/flow-settings-model.ts` (`FlowSettingsDraft` `:36`,
  `flowLimitsInterfaceErrors` `:91`, `FLOW_SETTINGS_DEFAULT_VALUES` `:114`, `flowSettingsFlowFromDetail` `:220`,
  `flowSettingsDraftFromFlow` `:282`, `buildFlowSettingsSavePayload` `:362`); the field goes in
  `FlowSettingsView.tsx:311` beside the "Recovery limits" inputs.

## Next step

1. Finish the sweep of the unswept areas above.
2. When slot-1 is absent: `pnpm task start node-limits --worktree --core` from `C:\Users\osrs_\FluxStuff\!FluxIQWebExtension`.
3. Implement: one `maxNodesPerSubflow` in Flow metadata, default 100, filled for existing Flows at read time;
   threaded as an argument into `parsing.ts`, `profile-limits.ts` (single profile for nodes),
   `validation.ts` (depth bounded by the node setting, not 16), `output-schema.ts`, `adaptation.ts`,
   `evidence-loop-steps.ts`, `diagnostic-parse.ts`; edges and plan/result bytes derived from it with the
   reason in a comment; the refusal names the setting and says to change it in Flow Settings.
   Web: integer 1..500 field and test. Tests for 20, 100 and 101 nodes.
4. Overlaps to watch: `runtime/service.ts` (t186) and `runtime/llm/**`, `flow-draft` (t186, t189).
