# f-host-runtime-policy-action — the domain snapshots a recorded Flow's web actions

## Outcome

Done. I checked the item at HEAD before starting, and it was still open:
`host-runtime.ts:76` accepted a node only when its `definitionId` was a
`web.output.*` node id.

The host runtime now recognises a recorded action. Core runs a recorded action
as `builtin.policy.action` and puts its web output id in
`parameterValues.outputId`, and the domain now snapshots that node. The state
diff also declines when either side's snapshot is missing. Both guards have a
mutation proof, and each mutated file was restored byte-identical.

## What changed and why

**`domain/src/runtime/host-runtime.ts`**
- **Which nodes count as web nodes.** A new private helper,
  `actsOnPage(node)`, accepts exactly two shapes:
  - a `definitionId` in `WEB_AUTOMATION_NODE_IDS`;
  - `definitionId === "builtin.policy.action"`, with a string
    `parameterValues.outputId` in `WEB_AUTOMATION_ACTION_TYPES`.

  Nothing else is accepted. `captureStateSnapshot` calls the helper in place
  of the old `definitionId`-only check.
- **New constants.** Two private constants back the helper:
  - `WEB_AUTOMATION_OUTPUT_IDS`, a `ReadonlySet<string>` of the action types;
  - `POLICY_ACTION_DEFINITION_ID`.

  The policy-action id is written out as a literal because Core exports no
  constant for it. Core itself repeats the literal at six places in its source,
  for example `nodes/policy/action.ts:5` and `proposal-candidates.ts:99`.
- **A one-sided diff.** `inspectStateDiff` now throws unless both
  `input.before?.summary` and `input.after?.summary` are present. A ref that came
  back without a summary counts as missing. Core catches the throw and records
  no diff (Core `host-state.ts:37-39`). Before this, a before-only attempt wrote
  a `web-state-diff.v1` claiming every element had been removed. The diff call
  still uses optional chaining, so deleting the guard makes it return a diff
  rather than crash. That is what makes the mutation proof meaningful.
- **Header comment.**
  - It no longer says that binding the boundary gives a web attempt its
    `stateRefs`. It now says a capture or diff this module declines leaves its
    key off the attempt.
  - The "only web nodes" decision describes both node shapes.
  - A fourth decision was added: a diff needs a snapshot on both sides.
- **Unchanged.** No exports were added or removed. The exported pure function
  `webAutomationStateDiff` still accepts `undefined` sides; only the boundary
  refuses them.

**`domain/src/runtime/tests/host-runtime.test.ts`**
- **Helpers.** `captureInput` takes an optional `parameterValues` argument, and
  the file gains a `POLICY_ACTION_ID` constant and a `DiffSides` type. The type
  is derived from `WebAutomationHostRuntimeBoundary`, which the test now imports.
- **New row 1:** "a recorded action, Core's policy node naming web.dom.click, gets
  a state ref from web.dom.capture_snapshot". It uses `outputId: "web.dom.click"`
  and asserts:
  - exactly one dispatch, of `web.dom.capture_snapshot`;
  - the ref;
  - `schemaVersion` `web-llm-evidence.v1`;
  - `typeof summary.truncated === "boolean"`.
- **New row 2:** "a policy node naming no web output, or a web output on another
  node, is declined without a gateway round trip". The gateway answers every
  call successfully, so a wrong acceptance would show up as a dispatch. Six
  inputs are declined, with 0 dispatches in total:
  - `outputId: "email.send"`;
  - `outputId` set to the web output *node* id `web.output.dom-click`;
  - `outputId: 7`;
  - empty `parameterValues`;
  - no `parameterValues` at all;
  - a non-policy node, `builtin.code.run`, carrying `outputId: "web.dom.click"`.
- **New row 3:** "a diff with a side missing is declined, so no diff claims every
  element appeared or left". It declines three cases: before only, after only,
  and an after ref with no summary. It then checks that a diff with both sides
  still returns `web-state-diff.v1` with `removedElementCount: 0`.
- **Renamed row.** "the diff survives a missing side and never lists more than
  the bound" is now "the diff never lists more than the bound, and its counts
  stay exact". It passes `{ elements: [] }` as the before side instead of
  `undefined`, so no row endorses one-sided behaviour. Its assertions are
  unchanged.
- **Header comment.** Updated to name both node shapes and the diff rule.

## Commands run and observed results

All commands used `DOMAIN_TEST_BUILD_LABEL=f-host-policy` where tests ran. Output
went to `.test-build-scratch/f-host-policy`. `domain/dist` and
`domain/.test-build` were not written: both `tsc` passes in `check` use
`noEmit`.

| Command | Where | Observed |
| --- | --- | --- |
| `pnpm check` | `domain` | exit 0; `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`, no diagnostics |
| `pnpm test` | `domain` | exit 0; `# tests 404`, `# pass 404`, `# fail 0`; rows 347, 348, 349 and 354 (the new and renamed rows) `ok` |
| `node scripts/structure-audit.mjs` | repository root | exit 0; `structure-audit: passed (41 warning(s), 17 baselined).` No line mentions `host-runtime` |
| Mutation 1: `if (!actsOnPage(input.node))` changed back to `if (!WEB_AUTOMATION_NODE_IDS.has(input.node.definitionId))`, then `pnpm test` | `domain` | exit 1; `# pass 403`, `# fail 1`; `not ok 347 - a recorded action, Core's policy node naming web.dom.click, gets a state ref from web.dom.capture_snapshot`, error `'Node builtin.policy.action does not act on a page, so no web state was captured.'` |
| Restore, then `sha256sum -c final.sha256` | scratchpad | `host-runtime.ts: OK`, `host-runtime.test.ts: OK`, exit 0 |
| Mutation 2: the three-line both-sides guard in `inspectStateDiff` deleted, then `pnpm test` | `domain` | exit 1; `# pass 403`, `# fail 1`; `not ok 349 - a diff with a side missing is declined, so no diff claims every element appeared or left`, error `'Missing expected rejection.'`, `ERR_ASSERTION` |
| Restore, then `sha256sum -c final.sha256` | scratchpad | both `OK`, exit 0 |
| `pnpm test` after the restore | `domain` | exit 0; `# tests 404`, `# pass 404`, `# fail 0` |

The hashes were recorded before any mutation:
- `host-runtime.ts`:
  `fbcad25ab7cfca7ebf6c825e3f973992154868e03a95b1630a6c07b307f6c89b`
- `host-runtime.test.ts`:
  `f64ab501e6c3a83197e720b34cd4528ece5249a1c5b90568a56bbd0357bf1d4d`

Every gate passed on its first run, so nothing needed a faulty-RAM rerun. Each
result is a single observation.

## Not verified

- **No live evidence.** Nothing here ran against Core or a browser. The only
  proof is unit tests against a fake gateway.
- **The Lab does not yet see this change.** The Lab loads the domain through
  `fluxiqHostModule: ./dist/host/web-panel-host.mjs`, and I did not rebuild
  `domain/dist` or the host bundle. The supervisor must run the build (or
  `host:build`) before a Lab run.
- **What a Lab run must show.** From `i-evidence-packets` section 4: one
  `lab run --flow` of `product-catalog`, default variant, with
  `FLUXIQ_TEST_ENV_FILES=none`. It must show:
  1. in `snapshots/flow-lane.json`, every web action has `evidencePackets` with a
     `beforeAction` entry;
  2. in `evaluation.json`, `sanitizedPacketBytes` has one entry per packet, each
     at most 6,000, and `truncationCount` equals the number of packets flagged
     `truncated`;
  3. the redaction attestation still reports 0;
  4. the Flow's statuses and `comparisonStatus` values are unchanged from
     stage2d.

  Until `g-core-host-state-node` lands, the run should show **no** `afterAction`
  entry and **no** `stateDiff`. That is expected, not a regression: Core passes
  `{ id, definitionId, parameterValues: {} }` at `after_action` and to the diff
  (Core `host-state.ts:25`), so the new rule declines the after capture, and the
  new guard then declines a before-only diff.
- **Root and extension gates.** I ran no root `pnpm check`, `pnpm test` or
  `pnpm build`, and no content harness. None of them is affected by a
  domain-internal change with no export change.

## Open questions or contradictions found

1. **Core has no named constant for `builtin.policy.action`.** The domain now
   writes the literal out, in `host-runtime.ts`. If Core exported a constant, this
   copy could import it. Whether that belongs in Core is the supervisor's call; I
   did not edit Core.
2. **`web.dom.capture_snapshot` is itself in `WEB_AUTOMATION_ACTION_TYPES`.** So a
   recorded `capture_snapshot` policy action is also snapshotted, which costs one
   more gateway round trip around a read-only action. The brief's rule ("a string
   in `WEB_AUTOMATION_ACTION_TYPES`. Nothing else.") includes it, so I followed it.
3. **Possible documentation update.** The architecture page on evidence or the
   host runtime may describe which nodes get `stateRefs`. I did not read or own
   it, so I have not checked whether this change needs a line there.
