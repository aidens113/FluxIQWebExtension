# Pre-durability Week 1 ledger archive

Moved from the active plan during the 2026-09-14 durability compaction. These
accepted observations remain historical evidence; neither stopped partial
bench is criterion-5 acceptance.

## 2026-09-13 — f-host-runtime-policy-action: the domain snapshots a recorded Flow's web actions

- Agent: worker `f-host-runtime-policy-action`; the architecture page and the
  verification by supervisor.
- Changed:
  - `domain/src/runtime/host-runtime.ts`: a node acts on a page when it is a web output
    node, or `builtin.policy.action` naming a web action type in
    `parameterValues.outputId`. `inspectStateDiff` declines when either side's snapshot
    is missing, and the header comment says what the binding does and does not give;
  - `domain/src/runtime/tests/host-runtime.test.ts`;
  - by the supervisor, `docs/architecture/page-evidence.md`, which states which nodes
    are snapshotted.
- Validation: supervisor `sup66`:
  - domain `pnpm check` exit=0;
  - `DOMAIN_TEST_BUILD_LABEL=sup66 pnpm test` printed "# tests 404", "# pass 404",
    "# fail 0";
  - **mutation,** `sup-host-runtime-mutation.mjs`: the check back to definitionId-only printed
    "# pass 403", "# fail 1", failing "a recorded action, Core's policy node naming
    web.dom.click, gets a state ref from web.dom.capture_snapshot"; "restored identical=true".
- Not verified: a Lab `product-catalog` Flow run showing a `beforeAction` packet on every
  web action, each at most 6,000 bytes. `afterAction` also needs Core's
  `g-core-host-state-node`.
- Outcome: Accepted

## 2026-09-13 — l-stage3a and l-stage3b: the old-pin benches, stopped partway, show one new failure pattern

- Agents: workers `l-stage3a` and `l-stage3b` (Lab owners), stopped by the supervisor;
  tally by supervisor.
- Observed at `d639415` and Core `3cb8976`, in the first repeat only, under four
  concurrent Lab processes. Every figure is a single observation, and neither is the
  criterion-5 bench.
  - **Bench A:** 40 runs, 30 passed, 9 failed, 1 inconclusive (W16's recording lane).
  - **Bench B:** 34 runs, 25 passed, 9 failed.
- Found:
  - **W10 `navigation` failed `recording.persistence` in both benches,** with no
    discards: 3 runs in A (unarmed Flow, recording, `broken-link` Flow), 2 in B. At the
    same pins with one Lab running, `l-stage2d`'s partial bench passed W10 on both lanes.
    Dispatched as `i-stage3-load-failures`.
  - **W13 `consent-then-click`'s Flow row failed `gateway.connection`** in B only.
  - Otherwise the known shapes: W04's and W08's Flow rows get no proposal (fixed by
    `f-actionless-flow-lane`); W05 `short-catalog` and W13 `banner-absent` fail
    `target_not_found`, both ruled out; `harnessActivations` 2 on failed Flows (fixed by
    `f-runner-no-dry-run-llm` and `g-core-ladder-llm-off`); no evidence packet (fixed by
    `f-host-runtime-policy-action` and `g-core-host-state-node`).
- Validation: supervisor, a reader over every `evaluation.json` and
  `snapshots/flow-lane.json` under `F:\fxlab-runs\stage3\` `a` and `b` printed:
  - A: `evaluations=39 verdicts={"passed":30,"failed":9} flowLaneFiles=18 start0=18 actions=62 actionsWithPackets=0`;
  - B: `evaluations=34 verdicts={"passed":25,"failed":9} flowLaneFiles=14 start0=14 actions=49 actionsWithPackets=0`;
  - failures by scenario, workflow, variant, lane and category: `recording.contract` ×4 in
    each (`product-catalog` and `data-table`, unarmed and variant, Flow lane);
    `recording.persistence` ×3 in A and ×2 in B (`navigation`); `runtime.behavior` ×2 in
    each (`short-catalog`, `banner-absent`); `gateway.connection` ×1 in B
    (`consent-then-click`, Flow lane).
- Not verified: W14's Flow row onward, W16's Flow row through W29, and repeats 2 and 3
  never ran. Nothing was rerun, per the stop order.
- Outcome: Accepted
