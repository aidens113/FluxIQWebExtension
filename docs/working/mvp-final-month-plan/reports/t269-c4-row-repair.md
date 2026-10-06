# t269-c4-row-repair: C4 saved-row repair

Worker: t269-c4-row-repair. Trees: `fxwork/t269/!FluxIQ` and `fxwork/t269/!FluxIQWebExtension`, both at the t264 S1-S3 merge (`cdb195c2` / `3e0e2fc5`). No commits. No Lab, browser or provider calls.

## Outcome

**Partial. The fix is complete and verified, but one line in a file I do not own is needed.**

- The fail-first fixture passes **only with a one-line change to Core `R/service.ts`**. That file is outside my ownership, so I applied the line to verify, then reverted it. The exact diff is below under "Required supervisor edit". My tree is left without it.
- Without that line the fixture still fails, and only at its last group of assertions: the saved row body keeps its stable node id. Every behaviour assertion before that passes: fresh reset, fresh listing, the two rows in their current order, the summary, and the accepting judge.
- Everything else is done inside my owned paths: the seed fix, the plan-key fix, Core unit tests and the downstream fixture.

## The actual failure, recorded first

**Run 1: the WIP fixture as taken from `1d6baa6f`, against current dev.** It failed with `actual writer must admit the only faulty-step replacement`.
- Diagnosis: this was fixture drift, not C4. The draft view now withholds private selectors, so the fixture's `step.input.parameters.selector === "#message"` never matched. The model script threw on decision 1 and every later decision.
- Fix to the fixture: the saved summary step is now identified by its public `element.attributes.id === "message"`, through a new `isSummaryControl` helper.

**Run 2: the real C4 failure.** The replacement was admitted (`core.run_node.written`) and the old step was dropped (`llm_evidence_loop.draft_amended`). Then every `complete` was refused before any action ran:
- Refusal: `bootstrap.required_input_unconnected`, from `flow_bootstrap.completion_refused` with `refusal: flow_bootstrap.evidence_completion_plan_invalid`.
- This repeated (`llm_evidence_loop.no_progress`) until `flow_bootstrap.evidence_budget_exhausted`.
- The repair phase ran no `web.browser.navigate`, no `extract_list` and no row `type`. The assertion that failed was `repaired whole test must reset and freshly replay the untouched listing`.
- Cause, seen in the seeded draft: `[extract_list, builtin.control.for-each, type(row, $row desired), type(summary)]` with no `routing` on any step. `automationStudioFlowDraftSeedFromFlow` read the For Each back as a plain step, so nothing fed its required `items` and there was no repeat span. The Codex preflight predicted this gap.

**Run 3: after the seed fix.** Status `succeeded`. Trace: reset, then fresh `extract_list`, then rows Beta then Alpha (the fresh, reversed order), then the summary `right`, then the accepting build judge. The session's `repairedRerun` then walked Beta and Alpha again, followed by a second judge.
- Two remaining failures, in this order:
  1. The fixture's row assertion did not allow for the `repairedRerun` pass. I fixed the fixture (see below).
  2. **A second real defect:** the applied graph gave the body's saved id `row-type` to the loop's head **Merge**, and minted a new id for the body.
- Cause of the second defect: `automationStudioFlowDraftPlanNodeIds` maps proposed step *n* to plan key `s<n>`. The assembler also numbers the joins and loops it derives (`s2` = loop Merge, `s3` = For Each, `s5` = exit Merge). So every step from the first derived node onwards was mapped to the wrong node. This was a latent bug for any routing that adds a node. Before this unit, only the held-join optional case avoided it, which is why the existing test passed.

## What changed and why

Core (owned: `R/llm/node-tools/**`):

- **`R/llm/node-tools/seeded-loops.ts` (new, private, not in the barrel)**
  - Reads a For Each back as the `repeat` a draft states, only when it is in the assembler's own shape. That means:
    - exactly one list into `items`;
    - one contiguous body from `body`, whose last step closes back into the For Each or into the Merge at its head;
    - nothing else entering or leaving a body step;
    - `item` going only to body steps;
    - settings equal to the For Each's defaults, which is what the assembler writes (`maxIterations: 100`, `maxStepsPerIteration: 50`).
  - Returns the list node, the body, and the framing nodes: the For Each, the head Merge, and an exit Merge that only `done` enters.
  - Any other shape is not returned, so it is seeded as before. Examples: a nested loop, a branching body, a stray `item` edge, no `items`, or settings of its own. The completion check then refuses it; it is never run flattened.
- **`R/llm/node-tools/draft-from-flow.ts`**
  - The seed now leaves out the framing nodes and puts `routing: { kind: "repeat", over: <list step>, through: <last body step> }` on the first body step.
  - The scheduling candidate snapshot is taken after routing is set.
  - Body `parameterValues` are kept byte for byte: `$state item.*` is not rewritten to `$row`.
  - The ordering walk now visits `done` edges last, so the body precedes the steps after the loop whatever the document's edge order.
  - `automationStudioFlowDraftPlanNodeIds` takes an optional `plan`. With it, it reads steps against the plan's nodes in order, skips derived Merge and For Each nodes where they stand, and stops mapping (so later steps are minted) on the first mismatch rather than handing a step's id to another node.
  - Without `plan`, the old positional behaviour is unchanged.
  - The header comment documents C4.
- **`R/llm/node-tools/tests/draft-from-flow.test.ts`**: four new cases.
  - The hand-drawn loop seeds as `[list, row(repeat over f1 through f2), summary]` with the row binding unchanged. Its `done` edge is listed first.
  - The assembled round trip gives one For Each, and re-seeding the assembled Flow gives the same routing and the same plan definitions.
  - `PlanNodeIds` with `plan` maps exactly the three step nodes to same-definition nodes.
  - Unsupported shapes still seed a plain For Each.

Downstream (owned: the fixture):

- **`domain/src/runtime/tests/carried-row-service-repair.test.ts`**, taken from `1d6baa6f`, with these changes:
  - `isSummaryControl` (selector drift, above).
  - Mutations record their command index.
  - Row mutations are now split:
    - before the accepting build judge, they must be exactly the fresh rows in the fresh order;
    - after it (`repairedRerun`), they must again be exactly the fresh rows.
  - Gateway assertion failures are collected in `violations` and must be empty. A throw inside the gateway otherwise surfaces only as a failed action.
  - Fixed one `exactOptionalPropertyTypes` error (`code: undefined`) that blocked `domain check`.
  - Every other WIP assertion is kept: decoy never written, row identity from current scoped record values, single For Each, body id and `$state item.desired` binding and `[]` declarations preserved.

## Required supervisor edit (not applied; outside my ownership)

Core `packages/fluxiq/src/programs/automation-studio/runtime/service.ts`, line 1639:

```diff
-          if (extend) existingIds = { ...extend.existing, nodeIdByKey: automationStudioFlowDraftPlanNodeIds({ steps: loop.steps, nodeIdByStepId: extend.seed.nodeIdByStepId }) };
+          if (extend) existingIds = { ...extend.existing, nodeIdByKey: automationStudioFlowDraftPlanNodeIds({ steps: loop.steps, nodeIdByStepId: extend.seed.nodeIdByStepId, plan: buildPlan.plan }) };
```

`buildPlan` is already assigned on the line before (`accepted.verdict.buildPlan`). A cleaner, larger alternative would be to carry the assembler's own `draftStepIdByNodeKey` out of the completion verdict, but that lives in `R/llm/harness-options/bootstrap-completion.ts`, which is a t264 file.

## Commands run and observed results

- WIP fixture, through a copy of the t267-s1 runner (scratchpad `t269-c4/run-subset.mjs`):
  - The original runner throws for `domain`, because `createRequire(path.join(packageDir, "..", "..", "domain", "package.json"))` resolves outside the repository. My copy resolves `<packageDir>/package.json` instead.
  - Command: `node run-subset.mjs <abs>/domain t269-c4 src/runtime/tests/carried-row-service-repair.test.ts` then `node --test <bundle>`.
  - Run 1: exit 1, `actual writer must admit the only faulty-step replacement` (drift).
  - Run 2 (after the drift fix, before the source fix): exit 1, `repaired whole test must reset and freshly replay the untouched listing`. Codes as above.
- Core fail-first: `npx vitest run .../llm/node-tools/tests/draft-from-flow.test.ts`, with HEAD `draft-from-flow.ts` restored temporarily: **4 failed / 21 passed**.
  - `expected ['list','each','summary','row'] to deeply equal ['list','row','summary']`
  - `expected ['s1','s2','s3','s4'] to have a length of 3 but got 4`
  - and the plain-step and round-trip cases.
- After the fix: the same file **25 passed**.
- With the `service.ts` line applied:
  - Core owners: `npx vitest run` over `llm/node-tools/tests/`, `flow-bootstrap/authoring/tests/`, `flow-bootstrap/unfinished-build/tests/`, `flow-draft/scheduled-candidate/tests/`, `llm/evidence-loop/tests/rerun-place`, `llm/harness/tests/draft-screen`, `llm/harness-options/tests/inherited-plan-nodes`, `llm/tests/evidence-loop-seeded-draft`, `recovery/refuted-result/tests/`, `service/runtime-adaptation/tests/`, `tests/refuted-result/tests/`, `tests/service-adaptation/tests/judged-promotion`, `activity/tests/scope`, `activity/wording/tests/run-ending`: **90 files, 820 tests passed**, exit 0. This was before the defaults-settings change.
  - Core `node scripts/build-cache/cli.mjs fluxiq:check`: exit 0. It first caught a test type error (`parameterValues` should be `parameters` on the plan node), which I fixed. Fixing it exposed that the assembler writes default For Each settings, hence the defaults rule.
  - After the defaults rule, the same 90-file owner set: **820 passed**, exit 0. `fluxiq:check` exit 0.
  - Core `node scripts/structure-audit.mjs`: `passed (249 warning(s), 349 baselined)`. The only warnings touching node-tools are pre-existing advisories.
  - Core `pnpm.cmd build`: exit 0 (4m37s).
  - Downstream `node --test` on `carried-row-service-repair` plus the sibling `carried-service-repair`: **7 passed / 0 failed** (run 4). Re-run after the type fix: 7/7 (run 5).
  - Downstream `pnpm.cmd --filter @fluxiq-web-extension/domain check`: exit 0, after the fixture type fix. The first run was exit 2 with TS2379 at line 159 of the fixture.
  - Downstream `node scripts/structure-audit.mjs`: `passed (170 warning(s), 118 baselined)`.
- With `service.ts` reverted (the final tree state):
  - `fluxiq:check`: exit 0. `fluxiq:build` rebuilt.
  - Row fixture: exit 1, failing only at the body-identity `deepStrictEqual` (`actual undefined`, `expected { $state: { path: 'item.desired' } }`). This is expected until the line is applied.

## Not verified

- No live run.
  - B and C creation are unaffected. This stage is proven live only by a **C-lane repair of an existing row-loop Flow**: a refuted run of a saved Flow with an extract-list For Each body, repaired without touching the body. The C13 ordered-records scenario's repair path is the candidate.
  - The fixture uses an authored command client, not browser DOM row resolution.
- Core `pnpm build` was not re-run after the `service.ts` revert; only `fluxiq:build` was. The full build from before the revert had the line applied.
- The 90-file owner set was not re-run with `service.ts` reverted. Only `draft-from-flow.test.ts` and `fluxiq:check` were.
- `docs/reference/framework-reference.md` is now stale: `node scripts/docs-reference.mjs --check` reports it, because `draft-from-flow.ts` export line numbers moved. It is generated, so regenerate it once at integration (`pnpm docs:reference`), after t270/t271 also land.
- These were not exercised:
  - while-check repeats (a repeat over a check, not a list);
  - a Flow with two loops;
  - interaction with optional steps inside or around a loop;
  - `PlanNodeIds` with derived optional/only_if/on_failed joins (its alignment covers them by construction, but no test).
- I did not update the architecture doc `docs/architecture/automation-studio/llm-flow-bootstrap.md`, which mentions the seed near line 1692.

## Open questions or contradictions

1. `service.ts` is not in my ownership and the fix needs one line there (above). Please apply it.
2. The provided runner `t267-s1/run-subset.mjs` cannot bundle `domain` entries; it resolves esbuild from `<repo>/../domain`. The t262-gate runner may differ.
3. Product behaviour seen, and not changed: after an accepted repair, the session immediately re-runs the persisted repaired Flow (`repairedRerun`) without a reset. The fixture now accepts this and checks it writes the right rows. It bears on adaptation-audit gap (5): the Flow is persisted before its re-run is judged.
4. The For Each node keeps no stable id across a repair: the assembler derives a new For Each and new Merges, so their ids are minted. The list, body and post-loop node ids are kept, once the `service.ts` line is in.
