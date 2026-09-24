# Accept the plan shapes the model actually writes

Task: make the JSON plan reader accept the wrappers a model plausibly puts its
nodes in, instead of refusing them with `bootstrap.invalid_subflows`.

## Outcome

Done, with one finding the brief could not have known and that the supervisor
must route: **the improved refusal message does not reach the model**, and that
is owned by a file outside this brief. Details in "Open questions" below.

## What changed and why

Repository `F:\!FluxIQ`, branch `dev`. Nothing committed.

| File | State | What it is |
| --- | --- | --- |
| `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/authoring/plan-shapes.ts` | new | Where a written plan put its nodes, and the refusal when it put none anywhere |
| `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/authoring/json-plan.ts` | changed | Builds the plan from the subflows the reader found; no longer answers the wrapper question itself |
| `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/authoring/tests/plan-shapes.test.ts` | new | 21 tests: one per accepted shape, the refusals, and the boundary |

### The shapes now accepted

Each is one arrangement of the same two steps and each now builds:

- `subflows` as an **object keyed by subflow name or id** — the map key becomes
  that subflow's key where the subflow object wrote none (`{"Open the list":
  {...}, "openMember": {...}}` gives keys `open-the-list`, `openmember`);
- a **single subflow object** where a list of one was expected;
- `subflows` holding a **bare list of nodes**, or a **single node object**, with
  no subflow wrapper at all — the shape a straight-line Flow naturally has;
- `subflows` as an **array of node lists**, one array per subflow;
- the node list under `nodes`, `steps` or `actions` **at whichever level it
  appears**, and matched through `authoringKey`, so `Nodes` and `nodes` are the
  same word;
- the plan written as **the bare array of nodes itself**;
- a node list **nested one level down** under a key like `plan`, `flow`,
  `workflow` or `graph` — which is what `{"summary": ..., "plan": [ ...nodes ]}`
  becomes by the time it reaches the reader, because `accept.ts`'s `planValue`
  only descends into an *object* `plan` and hands the whole wrapper on when it
  is an array;
- a step written as **the bare id of the node it runs** (`"nodes":
  ["web.browser.navigate"]`), which still goes through `matchAuthoringDefinition`
  against the registry.

### How the ambiguous cases are decided

- **Map vs. single subflow.** An object whose `key`, `name` or `role` is a
  *string* is one subflow; a map's values are subflows, so a map's `name` would
  be an object. A map is only read as one when every value is an object or an
  array.
- **Subflows vs. a bare node list.** If any entry of the array holds a node
  list, the whole array is subflows. Only when no entry holds one and at least
  one entry names a definition or carries `parameters` is the array read as the
  Flow's steps. So a plan that wrote real subflows is never taken apart.
- **The nested scan.** Last resort, depth-bounded at 2, skips `router`,
  `routing`, `routes`, `summary`, `metadata`, `meta`, `nodeCatalog`, `evidence`
  and `notes`, and accepts what it finds only when every subflow it found
  actually holds nodes — so a `router` object cannot be mistaken for the Flow.
  There is a test for exactly that.

### What is still refused, and how

`bootstrap.invalid_subflows` and `bootstrap.invalid_plan` now name what was
received before naming what would be accepted. Observed message for
`{"summary": "...", "notes": "..."}`:

```
Bootstrap plan holds no nodes: subflows is absent, and the plan is an object
with keys summary, notes. Write {"subflows":[{"key":"main","nodes":
[{"definitionId":"<id from nodeCatalog>","parameters":{}}]}]}, or just
{"nodes":[...]} for one straight line of steps. subflows may be an array of
subflows, an object keyed by subflow name, one subflow object, or the node list
itself; a node list may be written under nodes, steps, actions.
```

`subflows: []` says "is an empty array", `subflows: {}` "is an empty object",
`subflows: ["main","recover"]` "is an array of 2 strings", and a non-object plan
says "Bootstrap plan is a number".

**Only structure and key names are named. No written value is ever quoted**, so
nothing a page put into the reply can leave through a refusal. There is a test
asserting a planted secret written as a *value* appears in no issue message.

### Boundaries held

Nothing about node mapping or executability was loosened. Tested:

- a node naming a definition the registry does not resolve is still
  `bootstrap.definition_unavailable`;
- a *bare id* naming an unresolvable definition is refused the same way;
- a key naming no parameter of its node is still `bootstrap.unknown_parameter`.

Every plan this returns still goes through `parseAutomationStudioFlowBootstrapPlan`
and `validateAutomationStudioFlowBootstrapPlan` unchanged.

### The module split

`json-plan.ts` reached 566 lines by the structure audit's count, past the
400-line advisory threshold it had never crossed before. The wrapper question
("where are the nodes?") and the assembly question ("build the plan from them")
are separable, so the first moved to `plan-shapes.ts` in the same directory,
private and not added to the barrel — as `json-plan.ts` itself is. Both files
are now under the threshold and the audit's warning count fell from 185 to 184.

This creates one file the brief did not name. It is inside the directory the
brief gave me, adds no public surface, and no other worker is in `authoring/`.

## Commands run and observed results

All from `F:\!FluxIQ`. No repository-root `pnpm build` was run.

| Command | Observed |
| --- | --- |
| `pnpm --filter fluxiq check` (`tsc --noEmit`) | clean, no output, exit 0 — run twice, after the edit and after the split |
| `npx vitest run .../flow-bootstrap/authoring` | `Test Files 7 passed (7)`, `Tests 71 passed (71)` |
| `npx vitest run .../flow-bootstrap .../runtime/llm .../runtime/tests/service-bootstrap` | `Test Files 78 passed (78)`, `Tests 825 passed (825)`, 35.07s — re-run after the split with the same result |
| `node scripts/structure-audit.mjs` | `structure-audit: passed (184 warning(s), 359 baselined)`; `json-plan.ts` no longer warns; `plan-shapes.ts` does not warn |
| `npx biome check <the three files>` | `No files were processed` — biome's config ignores this path, so no lint applies here |

The 21 new tests are in `plan-shapes.test.ts`; the run above shows them passing
as part of the 71 and the 825.

No segfault and no `3221225477` exit occurred. Nothing was retried.

## Not verified

- **No live provider run.** This is a unit-level change; whether the model's
  actual reply for `run-mug2cjui-500e997c` is among the shapes now accepted
  cannot be confirmed, because **the run evidence does not contain the model's
  reply**. I checked `bundle.complete.json`, `events.ndjson`, `logs/core.log`,
  `snapshots/live-llm.json` and `snapshots/flow-lane.json`: the deepest record
  is `{toolId: "core.decision_unusable", iteration: 4, resultCode:
  "bootstrap.invalid_subflows"}` with token counts. The refused plan's text is
  not captured anywhere. The shapes implemented are the brief's list plus what
  the surrounding code makes reachable, not shapes read off that run.
- One signal from the evidence that is worth carrying forward: each
  `decision_unusable` reply was **71–87 output tokens**. Whatever the model was
  writing at completion was very short — which is consistent with a minimal or
  near-empty plan, not a long one written the wrong way round.
- The full `packages/fluxiq` test suite was not run; only the three directories
  above. `json-plan.ts` is imported by `accept.ts` alone, and `plan-shapes.ts`
  by `json-plan.ts` alone, both of which those directories cover.
- `pnpm structure:baseline` was **not** run. The audit reports "2 baseline
  entries can be lowered", and another worker has uncommitted changes in
  `runtime/action-permissions/` in the same checkout, so recording a baseline
  now would capture their in-flight state.

## Open questions or contradictions found

### The refusal still does not reach the model — and the fix is not in my files

The brief asks that "a refusal must name what was received and what shape would
be accepted, so a rewrite has somewhere to go". The message now does. **It is
discarded before the model sees it.**

`runtime/flow-bootstrap/plan/issue-feedback.ts` builds what a refused build is
asked again with. It emits `{code, path}` per issue and attaches the issue's own
`message` only for a route code (`ROUTE_CODES`) or a parameter shape. Everything
else — including `bootstrap.invalid_subflows`, `bootstrap.subflow_has_no_nodes`,
`bootstrap.invalid_plan` and `bootstrap.invalid_node` — loses its sentence.

I measured this rather than inferring it. A test in `plan-shapes.test.ts` runs
`automationStudioFlowBootstrapIssueFeedback` over the real refusal and observes:

```
[{ code: "bootstrap.invalid_subflows", path: "plan.subflows" }]
```

That is the entire feedback. An existing test in
`plan/tests/issue-feedback.test.ts` (lines 111–124) asserts the same behaviour
deliberately for `bootstrap.invalid_plan` and `bootstrap.primary_count`, with a
neighbouring test titled "never carries a validator's message".

So t122 and t123 improved messages that never travelled, which is why the
refusals kept dominating runs after them. **This change breaks the loop by a
different route** — the plans now build instead of being refused — but the
remaining refusals are still unactionable.

**The narrow fix, for whoever owns `plan/`:** carry `message` for the structural
bootstrap codes, the way `ROUTE_CODES` already does. These are Core's own prose
about the plan's shape and its key names — not a validator's message and not
page content, which is what that rule exists to keep out. It is a set-membership
change plus a bound, in one file.

### Secondary: `accept.ts`'s `planValue` drops a level it should descend

`{"summary": ..., "plan": [ ...nodes ]}` reaches the reader as the whole wrapper,
because `planValue` descends into `result.plan` only when it is an object. I
handled it here with the nested scan and there is a test for it, but the tidier
fix is one line in `accept.ts`, which I do not own.
