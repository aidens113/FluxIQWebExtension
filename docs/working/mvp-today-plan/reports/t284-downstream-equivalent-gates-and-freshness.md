# t284 — Downstream equivalent gates and freshness

Status: **Complete with freshness NO-GO**

## Decision

The known machine-only task fixture was deliberately not rerun. The first pass found four broken documentation links and a stale generated working-document index. The supervisor repaired those owners and regenerated the index. On the settled repaired tree, the structure audit and recursive workspace package checks passed.

The exact t263 freshness procedure then found a real stale dependency and stopped at its first failure: `packages/test-evidence/dist/index.js` is older than `packages/test-contracts/dist/index.js`. The required command order built test-evidence, but the later Scenario Lab owning build script rebuilt test-contracts, invalidating the earlier test-evidence output.

This is separate from t281's `git worktree add` spawn limitation. It is a downstream build-closure ordering failure, not an environment limitation or TypeScript/package-check failure. This report does **not** establish complete downstream freshness, dry-run readiness, or live readiness.

## Gate results

All commands ran serially from `F:\!FluxIQWebExtension`.

| Gate | Result | Evidence |
| --- | --- | --- |
| `pnpm structure:test` | PASS, exit 0 | 182 passed, 0 failed, 0 skipped; 1.541 s test duration |
| `pnpm lab:test` | PASS, exit 0 | 96 passed, 0 failed, 1 skipped; 1.396 s test duration |
| `node scripts/structure-audit.mjs`, first pass | FAIL, exit 1 | 5 violations across 2 rules; supervisor subsequently repaired the named owners |
| `node scripts/structure-audit.mjs`, settled repaired tree | PASS, exit 0 | 107 advisory warnings, 121 baselined findings, 0 violations |
| `NODE_OPTIONS=--max-old-space-size=8192 pnpm -r check` | PASS, exit 0 | All 10 participating workspace projects completed their package checks |
| t263 tracked-input freshness procedure | **FAIL, exit 1** | First failure was stale `test-evidence` relative to the later rebuilt `test-contracts` dependency |

## Exact structure failures

`docs-links` reported four violations:

1. `docs/working/mvp-today-plan.md:10` links to `./mvp-today-plan/reports/`, a directory with no `README.md` target.
2. `docs/working/mvp-today-plan/archive/2026-09-26-pre-run-and-run1-coordination.md:10` links to `./language-driven-flow-loop-plan.md`, which resolves incorrectly relative to the archive directory.
3. The same archive line links to `./flow-authoring-and-defensive-runtime-plan.md`, also resolving incorrectly relative to the archive directory.
4. The same archive line links to `./fluxiq-conversations-plan.md`, also resolving incorrectly relative to the archive directory.

`working-docs` reported one violation:

5. `docs/working/README.md` is out of date with current working-document header blocks.

These failures named shared authored documents outside this worker's write ownership. The supervisor repaired them and regenerated the working index before the resumed settled-tree audit. The rerun passed.

## Freshness status

t281 successfully rebuilt all six owned outputs in the required serial order. After the repaired structure/package gates passed, t284 ran the unchanged dependency comparisons and stopped on the first stale marker:

```text
test-evidence output:
F:\!FluxIQWebExtension\packages\test-evidence\dist\index.js
2026-09-27T04:34:13.0088260Z

newest dependency:
F:\!FluxIQWebExtension\packages\test-contracts\dist\index.js
2026-09-27T04:34:27.5817816Z
```

The output is 14.573 seconds older than its dependency. This was produced deterministically by the closure itself: the explicit test-contracts build preceded test-evidence, then `pnpm --filter @fluxiq-web-extension/scenario-lab build` invoked the test-contracts build again after test-evidence.

Per the stop-on-first-failure rule, later freshness assertions were not evaluated to a verdict. Their statuses are:

- test-contracts: its comparison passed before the failure;
- test-evidence: **stale**;
- domain: not reached;
- extension bundle: not reached;
- Scenario Lab: not reached;
- test runner: not reached.

## Boundary confirmation

- The known failing `pnpm task:test` fixture was not rerun.
- No authored source or shared working document was edited.
- No run artifact was read or changed.
- No Lab process, dry run, browser, provider, or live command was started.
- No commit or push was made.

## Required follow-up

The downstream build closure must prevent Scenario Lab's nested test-contracts build from invalidating test-evidence, or must rebuild test-evidence and every dependent later output after that nested dependency rebuild. After the closure order/script is corrected or an explicitly approved serial order is supplied, rerun all six freshness assertions on the unchanged source/Core tree. Do not proceed to dry/live readiness while test-evidence is stale.
