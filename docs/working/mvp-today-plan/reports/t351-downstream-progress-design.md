# t351 — Downstream build-progress propagation design

## Decision

The Testing Lab already has the correct production seam for Core's proposed
privacy-safe build-progress fields. `CreatedFlowBuildStep` is intentionally an
open, shape-screened row, and both successful and refused builds pass every
safe row member through the same `publishableStepFields` policy. The live-LLM
snapshot and the created-Flow snapshot then embed the resulting
`CreatedFlowBuild` without rebuilding it.

Therefore the minimum downstream implementation is **tests plus explicit type
documentation**, not a second progress model or a new snapshot schema. If Core
publishes the new facts on each `evidenceLoop.steps[]` row, the existing
production mapping should carry them automatically. A production mapper change
is needed only if a failing integration test proves Core's public diagnostic
parser removed a field before the downstream reader received it.

## Exact propagation paths

### Refused build

1. Core returns `diagnostic.evidenceLoop.steps[]`.
2. `fluxiq/automation-studio`'s
   `parseAutomationStudioFlowBootstrapFailureDiagnostic` parses it.
3. `packages/test-runner/src/flow-lane/creation/build-proposal.ts` calls
   `buildSteps`, which retains the row identity and delegates every other
   member to `publishableStepFields`.
4. The result becomes `CreatedFlowBuild.evidenceLoop.steps`.
5. `packages/test-runner/src/live-llm/live-llm-run.ts` writes that build
   unchanged under `snapshots/live-llm.json.build`.
6. `packages/test-runner/src/flow-lane/creation/snapshot.ts` also writes the
   same build under `snapshots/flow-lane.json.build`.

The only cross-repository compatibility dependency in this path is step 2:
Core's public parser and exported step type must preserve the new bounded row
members. Downstream's mapper cannot recover a member that parser discarded.

### Proposed build

1. Core stores the same rows on the proposal's created audit event.
2. `packages/test-runner/src/existing-fluxiq-control/adaptation-evidence-loop.ts`
   reads `detail.steps[]` through `evidenceLoopSteps` and
   `publishableStepFields`.
3. `build-proposal.ts` calls `buildSteps` on the read adaptation.
4. The two snapshots receive the same `CreatedFlowBuild` as above.

This path does not require a hand-maintained field allowlist. It is important
that the successful and refused paths continue to use the same shape screen.

## Required Core row shape

Mirror Core's final public member names; do not translate them downstream.
The proposed facts fit the current safe value grammar:

- draft visibility: a one-level record of counts and booleans (`bytes`, budget,
  listed/unlisted counts, omitted-input count, instruction bytes, over-budget
  flags);
- draft identity: monotonic numeric before/after revisions;
- step identity: one code-shaped build-local id or a bounded list of such ids;
- mutation result: applied/refused/kept counts and the rerun step id;
- answerability: booleans for record producer/store presence and a closed issue
  code;
- semantic change: booleans for page-state, draft-structure, and answerability
  change.

Use sequential build-local ids, not content hashes. Every string must be a
whitespace-free code/identifier of at most 128 characters; lists are capped at
32 entries; nested records are scalar-only and capped at 24 members. A row is
capped at 24 members including `toolId`. Keep the progress representation
compact enough to stay below that row cap. No prompt, reply, instruction text,
page value, selector, URL, tool arguments, labels, or content-derived hashes
may enter these fields.

## Files and exact changes

### Production/type documentation

- `packages/test-runner/src/flow-lane/creation/build-proposal.ts`
  - Add named optional properties to `CreatedFlowBuildStep` for the exact Core
    fields once their public names are settled. Keep the index signature; it is
    the forward-compatible transport rule.
  - Expand the type comment to name privacy-safe progress as a supported row
    category. Do not add a second sanitizer or translate field names.
- `packages/test-runner/src/existing-fluxiq-control/adaptation-evidence-loop.ts`
  - Add the same named optional properties to
    `ExistingAdaptationEvidenceLoopStep` for discoverability.
  - No mapping change is expected: `evidenceLoopSteps` already uses the shared
    screen.
- `docs/architecture/testing-facility.md`
  - Document that created-build decision rows carry bounded draft revision,
    answerability, and semantic-change facts into both snapshots, and restate
    that these are identities/counters/flags rather than content.

No change is expected in `live-llm-run.ts`, `creation/snapshot.ts`,
`live-llm/build-usage.ts`, or `packages/test-contracts`: the snapshot writers
embed the build object, and usage accounting deliberately reads only
iteration/call/usage fields. The live-LLM snapshot is not reconstructed by a
repository-local contract validator.

### Required tests

- `packages/test-runner/src/existing-fluxiq-control/tests/publishable-step-value.test.ts`
  - Prove the exact progress records, ids, lists, counts, and booleans pass.
  - Pair that with prompt/page/selector/URL/content-hash-looking free text and
    nested content that must be dropped.
- `packages/test-runner/src/existing-fluxiq-control/tests/adaptation-evidence-loop.test.ts`
  - Extend the “carries every member” fixture with every new progress fact and
    assert exact equality.
  - Assert the same row still excludes raw content.
- `packages/test-runner/src/flow-lane/creation/tests/build-proposal.test.ts`
  - Add one proposed-build case and one refused-build case with identical
    progress rows; assert `record.evidenceLoop.steps` are identical.
  - The refused case is the cross-repository integration guard for Core's
    public diagnostic parser. If it fails by dropping fields, fix/export the
    Core parser first rather than bypassing it downstream.
  - Assert the serialized build contains none of the supplied forbidden raw
    values.
- `packages/test-runner/src/live-llm/tests/live-llm-run.test.ts`
  - Settle a refused `CreatedFlowBuild` containing the progress rows and assert
    exact preservation at `snapshots/live-llm.json.build.evidenceLoop.steps`.
  - Assert no forbidden fixture literal appears in the whole snapshot.
- `packages/test-runner/src/live-llm/tests/build-usage.test.ts`
  - Add progress members to the two-rows/one-iteration fixture and prove call
    grouping, token totals, and cost remain unchanged.

An optional parity follow-up is
`packages/test-runner/src/demo-llm-create-ui/generation-failure.ts`. That older
panel-driven demo sanitizer still rebuilds `evidenceSteps` as only
`toolId`/`effectApplied`/`resultCode`; it is not on the Testing Lab created-Flow
snapshot path. Do not widen it as part of the minimum live-measurement fix
unless panel-demo evidence is explicitly brought into scope. If widened later,
reuse the shared safe-value policy rather than creating another whitelist.

## Compatibility and risks

- Additive row members are backward-compatible: older Core builds omit them,
  and existing downstream records still parse.
- The current open index signature means consumers compiling against the
  downstream type do not need an immediate schema version change.
- Proposed and refused records can diverge if Core stores richer audit rows
  than its exported failure parser accepts. The paired test above is the gate.
- `publishableStepFields` silently stops after 23 non-`toolId` fields. A Core
  row wider than that could lose late progress members. Keep the Core row below
  the cap (prefer grouped one-level records) and pin exact preservation in the
  integration fixtures.
- Code-shaped strings are necessary but not sufficient evidence of privacy.
  Core must mint ids from build-local sequence, never from page/provider/user
  content. Downstream cannot establish how an otherwise valid id was derived.
- Do not infer “progress” from `effectApplied` or tool success. Consume Core's
  explicit page/draft/answerability change flags.
- The existing `demo-llm-create-ui` sanitizer remains a narrower, separate
  surface; confusing it with the Lab path would create unnecessary scope.

## Validation commands

Run the focused downstream suite after Core's public types/parser are built:

```powershell
pnpm --filter @fluxiq-web-extension/test-runner test
pnpm --filter @fluxiq-web-extension/test-runner check
```

Then run the repository gates warranted by the cross-repository contract
change:

```powershell
pnpm check
pnpm test
pnpm build
```

Before any provider-backed measurement, rebuild the exact Core/downstream
outputs and repeat the repository's source/output freshness and identity gates.
These tests are provider-free; they do not authorize another live call.

## Inspected files

- `docs/working/mvp-today-plan/reports/t348-repeated-build-exhaustion-diagnosis.md`
- `docs/working/mvp-today-plan.md` (`Current State` only)
- `packages/test-runner/src/flow-lane/creation/build-proposal.ts`
- `packages/test-runner/src/flow-lane/creation/snapshot.ts`
- `packages/test-runner/src/flow-lane/creation/tests/build-proposal.test.ts`
- `packages/test-runner/src/existing-fluxiq-control/adaptation-evidence-loop.ts`
- `packages/test-runner/src/existing-fluxiq-control/publishable-step-value.ts`
- `packages/test-runner/src/existing-fluxiq-control/tests/adaptation-evidence-loop.test.ts`
- `packages/test-runner/src/existing-fluxiq-control/tests/publishable-step-value.test.ts`
- `packages/test-runner/src/live-llm/build-usage.ts`
- `packages/test-runner/src/live-llm/live-llm-run.ts`
- `packages/test-runner/src/live-llm/tests/build-usage.test.ts`
- `packages/test-runner/src/live-llm/tests/live-llm-run.test.ts`
- `packages/test-runner/src/demo-llm-create-ui/generation-failure.ts`
- `packages/test-runner/package.json`
- `docs/architecture/testing-facility.md` (created-Flow and live-LLM sections)

## Scope confirmation

I did not read raw run artifacts, provider/page content, prompts, responses,
logs, browser state, or credentials. I made no provider call and ran no tests,
builds, commits, or pushes. This report is the only file I wrote.
