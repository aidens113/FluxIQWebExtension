# t178 — Existing-Flow entry point (lane lead report)

Week 2 exit criterion 3 (plan Phase 5): a person can improve an EXISTING Flow from language.
Trees: Core `C:\Users\osrs_\FluxStuff\fxwork\t178\!FluxIQ`, downstream `C:\Users\osrs_\FluxStuff\fxwork\t178\!FluxIQWebExtension`, both on `task/t178-existing-flow-entry`. Nothing is committed. No live runs and no provider calls were made.

## Outcome

Partial. Everything this lane owns is built, and it passes type checks, focused tests and the structure audit. Three things are still outstanding:
- The live proof, which belongs to t174. Per the supervisor's rule it is redesigned on everything-store `deal-wheel`; see "Live proof needed".
- An everything-store improvement task, which lane t184 has to add. t184 says `everything-store-first-page-plus-earbuds-deal-wheel` is ready for a dry run.
- Two optional or Core-side items; see "Hooks needed" items 2-3. The mount (item 1) and the chat-grant defect are now done.

## What was built

### Core API: the web can now ask for `mode:"extend"` (Core boundary)
The service accepted `mode` already (`runtime/service/flow-bootstrap-commands/generation-request.ts:95`). The **API handler** did not: `generate-flow-bootstrap-adaptation` refused `mode` as an unsupported field. No browser or chat caller could reach extend at all. `api/handlers/llm-generation.ts` was not on my forbidden list, and no sibling lane touches it, so I changed it:
- `packages/fluxiq/src/programs/automation-studio/api/handlers/llm-generation.ts`:
  - `"mode"` was added to `FLOW_BOOTSTRAP_GENERATION_REQUEST_FIELDS`.
  - Any value other than `"create"` or `"extend"` is refused with "Flow bootstrap generation request contains an invalid mode.".
  - `mode:"extend"` is forwarded to `service.generateFlowBootstrapAdaptation`. A request that says `create` or gives no mode behaves exactly as before.
- `.../api/contracts/adaptation.ts`: `GenerateFlowBootstrapAdaptationRequest.mode?: "create" | "extend"`.
- `.../api/handlers/tests/llm-generation.test.ts`: one new test covers extend being forwarded, create and absent being left unforwarded, and bad values being refused.

The grant is `build_and_adapt`, which Core already accepts for extend. The grant service has no blank-Flow check.

### Web authoring: the panel's improvement door (`apps/web/.../authoring/`)
- `flow-model-binding.ts` (new) holds the DeepSeek model/key binding and the "empty orchestration parent" test. `blank-flow-authoring-model.ts` now uses it, so its behaviour is unchanged and the logic is no longer duplicated.
- `existing-flow-improvement.ts` (new):
  - `existingFlowImprovementRequest(projectId, flow, readiness)` mirrors Core's extend target rule (`flow-bootstrap/extend.ts` `automationStudioBootstrapTargetRefusal`): an orchestration Flow with an empty parent graph, a Router, and at least one Subflow. It sends the website-exploration request profile (iterating, no `maxCalls`) and requires no prior instruction.
  - `improvementInstruction(text)` turns the text into `{ title: "Improvement: <opening>", body, requirement: "required", tags: ["generation"] }`.
- `authoring-commands.ts`:
  - `improveFlowFromWebsiteAdaptation` posts `generate-flow-bootstrap-adaptation` with `{ evidenceGuided: true, mode: "extend" }` and the exploration timeout.
  - `saveFlowImprovementInstruction` posts `save-flow-instruction`. `save-flow-generation-instruction` asserts a *create* target, so it refuses built Flows. Passing `instructionId` updates the earlier wording instead of adding a second instruction.
- `improvement-host.ts` (new): `useFlowImprovementCommands(base)` binds the two new commands. Preflight and grant come from the host's runtime commands, because runtime already imports authoring and importing the other way would create a cycle.
- `ImproveFlowPanel.tsx` (new) is a separate component rather than an edit of `BlankFlowAuthoringPanel.tsx`, which **t177 is editing**. The flow is:
  1. The person writes what should change.
  2. The panel saves it as an instruction, once per wording.
  3. Preflight runs, and the high-token confirmation is shown when needed.
  4. The grant is issued (`ttlMs` claim window).
  5. The extend build runs.
  6. The panel opens the suggested change.

  If Core asks about authoring-stage consequences, the panel asks the person and continues with only the consequences they allowed. It gives plain-language failure messages for `pending_adaptation_exists`, `blank_target_required`, `stale_grant_binding`, timeout, evidence limit, and tool or runtime failure.
- `index.ts` exports the new names.

### Chat capabilities (`conversation/capabilities/catalog/`)
- `flows.ts` adds **`flow.improve`** (argument: `change`). In order, it:
  1. reads the model key through `get-flow-metadata-detail` (`settings.llm`, with `metadata` as the fallback);
  2. saves the improvement instruction;
  3. issues **its own** `build_and_adapt` grant;
  4. runs the extend build.

  It does not take a grant from `permission.allowModelRun`. The contract test showed why: saving the instruction changes the Flow's execution digest, so a grant issued before the save is refused with "LLM execution grant is no longer valid.". It also refuses to change anything when the Flow has no DeepSeek key, and builds nothing when the save fails.
- `adaptations.ts` is new and registered in `catalog/index.ts` after `VERSION_CAPABILITIES`. When no change is named, each capability finds the newest waiting change itself.
  - **`adaptation.show`**: reads the change and says in words what it does.
  - **`adaptation.apply`**: approve, then apply. `version.accept` only approves, which leaves a Flow Bootstrap change `validated` and never applied.
  - **`adaptation.reject`**: rejects a waiting change with a reason. It never reverts an applied one; `version.rollBack` stays the way back out.

### Adaptation diff view (`adaptations/**`, done by a worker, verified by me)
Worker report: `docs/working/week2-exit-plan/reports/t178-adaptation-diff.md`.
- `change-diff.ts`: `isFlowBootstrapAdaptation`, `flowChangeDiffMode`, `flowChangeDiffRows`. Rows are create or extend, marked added, changed, unchanged or unknown, with a by-nodeId step diff when step lists exist.
- `adaptation-queries.ts` `loadFlowChangeTopology` reads through `get-flow-router-summary`, `list-flow-subflows` and paged `get-graph-viewport`. The browser blocks `get-flow` and `get-flow-router` (`data-request-policy.ts`).
- `ChangeDiffSection.tsx` sits in the Changes tab for flow_bootstrap adaptations. It shows a Before/After table, added and removed steps, and the approve, apply and reject buttons beside the diff.

### Downstream (`apps/scenario-lab/src/scenarios/social-scheduler/`): the provider-free fixture
Live runs use only the ten realistic scenarios, so this is the unit and Lab fixture for the same shape. The live proof moves to everything-store (see below). The `whats-new` variant and both of its creation tasks already existed: `social-scheduler-week-ahead-whats-new` and `-no-announcement`. What was missing was the improvement itself, so I added:
- `improvement.ts`: `WEEK_AHEAD_IMPROVEMENT`. It builds `social-scheduler-week-ahead` on the unarmed console, improves the Flow on `whats-new` with a plain-language instruction, and verifies it by replay against both creation tasks, judged by `extract-week-ahead`. The file is exported from `index.ts`.
- `tests/improvement.test.ts`: the base task is unarmed and never mentions the announcement; both verify tasks share its dataset; the two renderings expect the **same 14 records**; the instruction is a goal, not a recipe.

## Validation (commands run, output observed)
- Core `packages/fluxiq`: `npx vitest run --maxWorkers=2 --minWorkers=1 src/programs/automation-studio/api/handlers/tests/llm-generation.test.ts` → `1 passed, 19 passed`.
- Core `npx tsc --noEmit -p apps/web/tsconfig.json` → exit 0, no output. This was run with all of my changes and the worker's in place.
- Core apps/web vitest (`--maxWorkers=2 --minWorkers=1`):
  - `authoring/tests/blank-flow-authoring.test.tsx`: 25 passed.
  - `capabilities/tests/dispatch.test.ts`: 19 passed.
  - `coverage.test.ts`: 7 passed.
  - `registry.test.ts`: 11 passed.
  - `catalog/tests/versions.test.ts`: 4 passed.
  - `authoring/tests/improve-flow.test.tsx`: 9 passed.
  - `catalog/tests/adaptations.test.ts`: 7 passed.
  - `core-contract.test.ts -t "flow.improve|adaptation\.|keeps overrides"`: 5 passed. All four new capabilities print `PASS` against Core's real handlers.
  - I added two entries to the contract harness, each with its reason: the WORDS value `change`, and two `EXPECTED_REFUSALS`.
    - `flow.improve` is refused with `flow_bootstrap.blank_target_required`, because the world's Flow has a Router and Subflows but no steps. The service checks this at service.ts:1498, before the evidence-runtime check at 1574.
    - `adaptation.apply` is refused with "Unknown Flow node for adaptation patch: expect.ready", because the world's seeded adaptation targets a node the Flow does not have. It is approved first, and then apply's own integrity check refuses it.
  - The **full** `core-contract.test.ts` file was run once while about 6 other lanes were running vitest. Result: 20 failed out of 62. 17 of those were timeouts (30 s per variant, 5 s for the classification checks) in capabilities I did not touch: subflow.*, route.*, project.*. The other failures were my 2 (now fixed) and the endpoint-reach check that depended on them. I have not re-run the full file on a quiet machine.
- Worker, re-checked by me through tsc and the audit: `vitest run ... adaptations` → 5 files, 21/21 passed.
- Core `node scripts/structure-audit.mjs` → `passed (194 warning(s), 355 baselined)`. That is the same count as before, and none of the warnings is new. The "1 baseline entry can be lowered" note was there before this work.
- Downstream `apps/scenario-lab`:
  - `npx tsc -p tsconfig.json --noEmit` → exit 0.
  - `npx tsc -p tsconfig.e2e.json` → exit 0.
  - `pnpm build`, then `node --test dist/scenarios/social-scheduler/tests/improvement.test.js dist/scenarios/social-scheduler/tests/scenario.test.js dist/scenarios/tests/live-instructions.test.js` → `tests 30, pass 30, fail 0`.
- Downstream `node scripts/structure-audit.mjs` → `passed (115 warning(s), 120 baselined)`.
- Note: `--maxWorkers=2` on its own crashes vitest 2.1.9 ("minThreads and maxThreads must not conflict"). Add `--minWorkers=1`.

## Hooks needed outside my ownership (exact changes)

1. **Mount the improvement panel: DONE** (supervisor extended ownership). `flow-editor/components/FlowEditorView.tsx` now imports `ImproveFlowPanel`, `existingFlowImprovementRequest` and `useFlowImprovementCommands`. The start pane shows `ImproveFlowPanel` when the Flow is not blank but can be improved. Test: `flow-editor/components/tests/flow-editor-start-pane.test.tsx` checks that a built Flow gets "Improve this automation" and a blank Flow gets "Tell FluxIQ what to automate" only (2/2). Still unproven in a browser: whether a real built Flow reaches the start pane, which happens when `taskGraph` is null.
2. **Core extend writes into ONE Subflow; it cannot add a Router route or a second Subflow.** See `runtime/flow-bootstrap/extend.ts` ("One Subflow") and `service/flow-bootstrap-commands/extend-subject.ts`.
   - Improving first-page-earbuds for `deal-wheel` (or week-ahead for `whats-new`) therefore adds conditional steps inside the existing Subflow's graph ("if the wheel is showing, decline it"), not a new route.
   - If the exit row literally requires "gains the route/Subflow", that needs a Core change in `flow-bootstrap/**` and `runtime/llm/**` (plan assembly from a draft is single-block, `authoring/assemble-draft.ts`). Those paths are forbidden to this lane.
   - Recommendation: judge the row by 16/16 on both everything-store renderings with zero provider calls on replay, and accept "gains the branch" in place of "gains the route".
3. **Optional, for a step-level diff.** File: `runtime/flow-bootstrap/review-projection.ts` (forbidden to me). In `bootstrapAdaptationAsFlowAdaptation`:
   - add `mode: adaptation.mode ?? "create"` to `metadata.bootstrap`;
   - add `steps: entry.graphFlow.nodes.map((node) => ({ nodeId: node.nodeId, label: node.label, type: node.definitionId }))` to each `create_subflow` patch `after`.
   - `change-diff.ts` already reads both fields. Without them the diff falls back to comparing Router rules and Subflow step and connection counts by id.

## Live proof needed (t174): on everything-store, not social-scheduler

**Binding rule (supervisor):** live tests use only the ten realistic scenarios. social-scheduler stays as the provider-free fixture (`WEEK_AHEAD_IMPROVEMENT`, unit-tested). The live proof is designed on **everything-store's `deal-wheel`** variant, which already describes itself as "the existing-Flow entry point":
- A spin-to-win wheel opens over the first results page a moment after it loads, and the page behind it is inert.
- The home page and the results are otherwise the same as the unarmed store.
- `extract-first-page` expects the **same 16 records** on both renderings. I checked this against the built manifest: `count 16 / 16`, identical records.

**Task for lane t184 to add** (in `everything-store/**`, which I do not own):
```ts
{
  id: "everything-store-first-page-plus-earbuds-improved-past-deal-wheel",
  scenarioId: "everything-store",
  baseTaskId: "everything-store-first-page-plus-earbuds",          // exists; built on the unarmed store
  improveOnVariantId: "deal-wheel",                                // exists (workflows/first-page.ts)
  instruction: "The store sometimes opens a spin-to-win promotion over the search results a moment after they load. When it shows, turn it down without spinning and carry on; when it does not, carry on as before.",
  verifyTaskIds: ["everything-store-first-page-plus-earbuds", "everything-store-first-page-plus-earbuds-deal-wheel"],  // both exist, both judged by extract-first-page
}
```
Where to put it:
- The type is `ExistingFlowImprovementTask`, which today is in `social-scheduler/improvement.ts`. t184 should move it to a shared `apps/scenario-lab/src/scenarios/live-improvement-tasks.ts` exporting `LIVE_IMPROVEMENT_TASKS`, in the way `live-repair-tasks.ts` aggregates repairs.
- The social-scheduler definition can then import the type from there.
- A test in the style of `social-scheduler/tests/improvement.test.ts` should check four things:
  - the base task is unarmed;
  - the verify tasks exist and share `extract-first-page`;
  - both renderings expect the same records;
  - the instruction is a goal, not a recipe.

**The run t174 needs to do:**
1. Build `everything-store-first-page-plus-earbuds` on the unarmed store (creation), then apply it.
2. Arm `deal-wheel`. On the built Flow, ask for the instruction above through the panel (`ImproveFlowPanel` on the Flow editor start pane) or chat (`flow.improve`, which saves the words, issues its own grant, and runs the extend).
3. Record whether the adaptation is an extend: it should keep the same Router and Subflow ids, and its patch `targetId`s should match the Flow's current ones.
4. Accept it (`adaptation.apply`, or Approve then Apply in the diff section).
5. Replay the improved Flow with provider calls disabled on both renderings: unarmed, and `deal-wheel` armed at replay. Note that the existing `-deal-wheel` task carries `variantArmedAfterBuild: true`, and here the Flow must *not* be rebuilt.
6. Expect `extract-first-page` 16/16 on each, and 0 provider calls on both replays.

**Risks to watch:**
- The wheel's way out is a text line ("No thanks, I would rather pay full price"), not a button. The model must choose it over "Spin the wheel", which is the consequential choice.
- The wheel opens *after* load. The improved Flow needs a bounded wait for an optional popup. It must neither miss the wheel nor stall on the unarmed page where no wheel ever comes.

**Runner gap:** `LiveInstructionTask` has no improve moment, and `packages/test-runner/src/flow-lane/creation/instruction-task.ts` parses the catalog strictly. The runner needs a lane that consumes improvement tasks (build → arm → improve → apply → replay each verify task). Until then, the proof is run by hand in the panel.

## Defect fixed: chat model-run grant read a browser-blocked endpoint
Before the fix:
- `permission.allowModelRun` and `permission.check` (`catalog/running.ts`, `flowModelKey`) read the key through `get-flow`.
- The browser refuses `get-flow`: `data-request-policy.ts` `AUTOMATION_STUDIO_BROWSER_BLOCKED_LEGACY_ENDPOINTS`, enforced at `programs/program-api.ts:129`.
- So in the real chat window both capabilities threw, and chat build and explore could never get a grant.
- The contract test missed it because its transport bypasses the browser guard.

Fix:
- `flowModelKey` now reads `get-flow-metadata-detail` through `loadFlowSettingsDetail`.
- It takes the key from `settings.llm`, falling back to `metadata`, using `flowModelFromDetail`. That helper was moved into `authoring/flow-model-binding.ts` and is shared with `flow.improve`.
- Both capabilities now declare `get-flow-metadata-detail` instead of `get-flow`.

Test: `catalog/tests/browser-endpoints.test.ts` (4/4) covers:
- a ratchet that no capability declares a browser-blocked endpoint;
- `permission.allowModelRun` and `permission.check` driven through a transport that enforces the real guard;
- the "no model key chosen" case.

The contract run now shows `PASS permission.allowModelRun -> get-flow-metadata-detail, issue-llm-execution-grant` and `PASS permission.check -> get-flow-metadata-detail, preflight-llm-execution`.

## Final validation (after the mount and the fix, `--minWorkers=1 --maxWorkers=2`)
- Core `npx tsc --noEmit -p apps/web/tsconfig.json` → exit 0.
- apps/web vitest over the authoring, adaptations, flow-editor/components and capabilities/catalog directories, plus the capabilities tests dispatch, coverage and registry → **15 files, 110/110 passed**.
- `core-contract.test.ts -t "permission\.|flow\.|adaptation\.|keeps overrides|agrees"` → 26 passed. Every permission.*, flow.* and adaptation.* variant printed PASS.
  - The 2 "agrees with Core's classification" checks timed out at the 5 s default under load. Re-run alone with `--testTimeout=120000`, they passed; the first took 19.8 s.
- Core `api/handlers/tests/llm-generation.test.ts` → 19/19.
- `node scripts/structure-audit.mjs` → passed (194 warnings, 355 baselined).

## Not verified
- No live browser, no Core server, no provider call. The extend build's behaviour on `whats-new` is untested; whether the model adds a conditional dismiss that also passes the unarmed rendering is exactly what the live proof decides.
- No CSS was added for the new panel and diff classes; they reuse existing class names.
- No repo-wide tests were run.
