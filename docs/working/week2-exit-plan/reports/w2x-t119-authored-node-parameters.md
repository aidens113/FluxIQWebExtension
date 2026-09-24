# t119 — a run now records what the Flow it built was told to do

Worker report. Worktree `F:\fxwork\t119-authored-node-parameters-recorded`,
branch `task/t119-authored-node-parameters-recorded`, commit `2a29378`.
`pnpm task finish` was not run.

## Outcome

Done.

## What changed and why

Six live `product-catalog` extract runs failed identically with
`expectedRecords 8, observedRecords 23`. The fixture serves eight products per
page across three pages (`apps/scenario-lab/src/scenarios/product-catalog/listing.ts`
slices to `CATALOG_PAGE_SIZE`), so 23 is a Flow that walked all three for an
instruction that asked for the first. None of the six could be diagnosed:
`snapshots/flow-lane.json` published only `flowShape` — node counts and output
names — and no Flow document is persisted under `test-runs/`, so whether the
model had authored `pagination: { mode: "next", maxPages: 3 }`,
`mode: "numbered"`, or a scroll with a cap was unknowable from any artifact. A
fix was shipped against an inferred cause and did not work. Two wrong diagnoses
is what an unrecorded parameter costs.

A created-Flow run now writes `authoredNodes` beside `flowShape`: one entry per
action node, carrying the node id, its `definitionId`, the output it dispatches,
its screened `parameters`, and `parametersWithheld`. Both members are derived
from the same node list and the same output map, so they cannot disagree about
which nodes acted.

**New files**

- `packages/test-contracts/src/authored-flow-node.ts` — `AuthoredFlowNode`, the
  unrecognized-output marker, and `AUTHORED_FLOW_NODE_BOUNDS`.
- `packages/test-contracts/src/authored-flow-node-validation.ts` —
  `validateAuthoredFlowNodes(input, deniedKeys)` and `assertAuthoredFlowNodes`.
  `deniedKeys` is required, not optional, for the reason Core's own parameter
  screen requires it: an absent declaration means nobody said what this medium's
  raw payload is called, never "deny nothing".
- `packages/test-runner/src/flow-lane/creation/parameter-screen.ts` — the screen.
- `packages/test-runner/src/flow-lane/creation/authored-nodes.ts` —
  `createdFlowAuthoredNodes(nodes, actionTypes, deniedKeys?)`.
- Tests: `packages/test-contracts/tests/authored-flow-node.test.mjs`,
  `packages/test-runner/src/flow-lane/creation/tests/parameter-screen.test.ts`,
  `packages/test-runner/src/flow-lane/creation/tests/authored-nodes.test.ts`.

**Edited**

- `packages/test-contracts/src/index.ts` — barrel.
- `packages/test-runner/src/flow-lane/creation/{index,lane,snapshot}.ts` — the
  lane computes `authoredNodes` from the same read of the Flow's nodes that
  produces the shape, before the run touches anything, and publishes it on the
  evidence and in the snapshot.
- `packages/test-runner/src/flow-lane/flow-action-types.ts` — `FlowNodeRecord`
  now reads the node's `definitionId`.
- `packages/test-runner/src/flow-lane/creation/tests/lane.test.ts` — see the
  behaviour change below.
- `domain/src/runtime/llm-evidence/index.ts` — exports
  `WEB_LLM_DENIED_EVIDENCE_KEYS` and `webLlmEvidenceKey` rather than letting the
  Lab keep a second copy of the declaration, which is exactly what
  `denied-keys.ts` says must not happen.

## The screen follows Core's convention rather than inventing one

Core screens a Flow's step parameters for a repair's context in
`packages/fluxiq/src/programs/automation-studio/runtime/recovery/repair-context/parameter-screen.ts`.
Every judgement that file makes about what a string *is* is made here by calling
Core's own exported screens — `automationStudioEvidenceKey`,
`automationStudioExecutableTargetKey`, `automationStudioLocatorShapedText` and
`screenAutomationStudioLlmEvidence`, all reachable from `fluxiq/automation-studio`.
Only the walk is restated. `automationStudioScreenedNodeParameters` itself sits
behind no public `fluxiq` subpath export, and no Core edit was in scope for this
brief, so it could not be imported; nothing here decides afresh what is safe.

What travels: numbers and booleans whole; a string only where its key names
something rather than holds something (`mode`, `field`, `column`, `role`, …) and
only in the top two levels, where the keys are the node definition's own; an
absolute URL as its origin. Everything else is withheld with its dotted path
recorded, and a key whose value did not survive keeps its place with `null`, so
"this step authored no parameters" and "this step's parameters were screened
out" cannot be read as one another.

Worked example, from `authored-nodes.test.ts`:

- `{ url: "http://127.0.0.1:4100/scenarios/product-catalog/" }` becomes
  `{ url: "http://127.0.0.1:4100" }`, nothing withheld.
- `{ selector: "[data-testid=\"card\"]", fields: { name: "[data-testid=\"name\"]" }, pagination: { mode: "next", maxPages: 3 } }`
  becomes `{ fields: { name: null }, pagination: { mode: "next", maxPages: 3 } }`
  with `parametersWithheld: ["selector", "fields.name"]`.

That second line is the answer the six runs needed and could not get.

## Behaviour change worth the supervisor's attention

`lane.test.ts`'s leak assertion previously required that the created-Flow
snapshot carry no `127.0.0.1`. Core's convention carries an absolute URL as its
origin, so a navigation node's `url` parameter now appears as
`http://127.0.0.1`. The assertion dropped the loopback host and gained
`/scenarios/` and `product-catalog/`: the path and the query are where a page
number, a search term and a session token live, and a Flow's page number is half
of what this member exists to expose.

If the origin should not travel either, that is a deliberate deviation from the
convention the brief named, and it is a one-line change in
`parameter-screen.ts` (`absoluteUrlOrigin` returning nothing).

## Commands run and observed results

| Command | Observed |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/test-contracts build` | ok, no diagnostics |
| `pnpm --filter @fluxiq-web-extension/test-runner exec tsc -p tsconfig.json --noEmit` | exit 0, no output |
| `pnpm --filter @fluxiq-web-extension/test-runner test` | `# tests 1350`, `# pass 1350`, `# fail 0` |
| `node --test "packages/test-contracts/tests/*.test.mjs"` | `# tests 132`, `# pass 132`, `# fail 0` |
| `node scripts/structure-audit.mjs` | `structure-audit: passed (100 warning(s), 121 baselined)` — no new finding |
| `pnpm --filter @fluxiq-web-extension/domain build` | required so the new barrel export reaches `domain/dist`; clean |
| `pnpm --filter @fluxiq-web-extension/domain check` | exit 0 |
| `pnpm --filter @fluxiq-web-extension/extension check` | exit 0 |

One intermediate failure is worth recording: before `lane.test.ts` was updated,
`pnpm --filter @fluxiq-web-extension/test-runner test` reported
`not ok 316 … the snapshot carries 127.0.0.1`, which is the behaviour change
above catching itself.

## Not verified

- No live run, no Lab, no Playwright, no browser — a campaign was using them.
- Only fixture Flow documents were screened. The exact key names a live Core
  Flow bootstrap writes for pagination are unconfirmed; if it writes them under
  a key not in the name list and not a number, they will read as withheld rather
  than as values. The first live `product-catalog` run after this lands is the
  check, and it costs nothing extra.
- Repository-wide `pnpm check`, `pnpm test` and `pnpm build` were not run.
- Nothing pushed; `pnpm task finish` not run.

## Open questions

- Should the validator be called at production time? It is not, deliberately:
  `harnessRecovery` sets the precedent, and a throw inside the lane would
  destroy the bundle the run exists to write — the same failure
  `packages/test-evidence/src/redaction.ts` documents at length. The producer
  screens; the contract is what the tests check against.
- The domain's denied-key declaration is now public API of the
  `llm-evidence` barrel. That is one more consumer than `denied-keys.ts`
  anticipated, and the comment there should probably name the Lab as the third.
