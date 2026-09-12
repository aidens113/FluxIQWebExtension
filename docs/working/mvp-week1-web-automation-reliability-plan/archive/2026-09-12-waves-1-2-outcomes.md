# Waves 1 and 2 — settled outcomes

Moved out of the plan's `Current State` on 2026-09-12, when the document crossed
the 800-line compaction threshold. Every item here is finished and verified; the
plan keeps a one-line summary and points at this file. Nothing was deleted.

**Done** (evidence in the ledger)

- Domain tests run every `domain/src/**/tests/*.test.ts` (24 runtime tests
  had never run; all pass); `DOMAIN_TEST_BUILD_LABEL` isolates parallel runs.
- Scenario contract: `workflows`, `variants`, `extract` steps,
  `expected.extracted`, `expected.failure`, seven step operations,
  `resolveScenarioWorkflow`. Scenario Lab: a scenario-owned `route` hook
  and ten registered placeholder fixtures.
- Batch A and w1-content-aliases verified (ledger); an unknown action
  type now reaches the wire as `ACTION_REJECTED`.
- Domain tests are type-checked (22 errors fixed). All ten new fixtures
  verified; capability docs written; the content-script harness (31
  specs), evaluation and benchmark contracts, and the registry-derived
  test-matrix catalog verified.
- Scenario Lab consolidated (fixture barrels, one shared e2e lab fixture,
  22-fixture docs) and extension unit tests (64) verified; the sensitivity
  rule is one shared token-based function (`billing cc-number` leaked).
- FluxBench: `pnpm lab bench` with `week1` and `smoke` corpora; the panel host
  is an ES module on Core's public exports; isolated runs here use
  `FLUXIQ_TEST_ENV_FILES=none`.
