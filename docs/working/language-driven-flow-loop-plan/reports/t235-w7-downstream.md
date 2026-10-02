# t235-W7: downstream validation against the t235 Core

## Outcome

Done. Every scoped downstream check passed against the t235 Core (names-only
node catalog, `core.describe_nodes`). No test expectation needed changing,
and no downstream file was edited apart from this report.

## What changed and why

Nothing. No test failed, so there was no expectation to update.

## Commands run and observed results

1. Core resolution: `domain/node_modules/fluxiq` ->
   `/c/Users/osrs_/FluxStuff/fxwork/t235/!FluxIQ/packages/fluxiq`, and
   `domain/node_modules/@fluxiq/client-gateway-websocket` ->
   `.../fxwork/t235/!FluxIQ/packages/client-gateway-websocket`. Both point at the t235 worktree.
2. Core rebuild, run in the t235 Core with `pnpm --filter ./packages/<p> build`:
   contracts `reuse` (stamp matched); fluxiq `build` ("inputs changed:
   packages/fluxiq", 132 s); client-gateway-websocket `reuse`. `grep -rl describe_nodes packages/fluxiq/dist`
   found it in `flow-bootstrap/plan/contracts.d.ts`, `deepseek/request-body.js` and `harness/context-packet.js`.
   `node scripts/check/core-build.mjs` (downstream) printed "FluxIQ Core's build at ...fxwork\t235\!FluxIQ is current with its source."
3. `pnpm --filter @fluxiq-web-extension/domain check` -> exit 0 (fresh build, 29.6 s).
4. `pnpm --filter @fluxiq-web-extension/extension check` -> exit 0 (fresh build, 65.3 s).
5. Scoped domain tests. `domain/scripts/test-domain.mjs` has no file filter (only a label), so I used a scratch
   script (`<scratchpad>/t235w7-domain-scoped.mjs`). It uses the same esbuild options and externals as
   test-domain.mjs, bundles `domain/src/tests/domain.test.ts` plus every `domain/src/runtime/llm-evidence/**/tests/*.test.ts`
   into the ignored `domain/.test-build-scratch/t235-w7/`, and imports each bundle. Result: 95 entries,
   `# tests 601 # pass 601 # fail 0 # cancelled 0`, exit 0, no load failures.
6. test-runner: `node scripts/domain-dist.mjs` (rebuilt domain dist, since the Core inputs had changed), then
   `test-runner:build` (rebuilt). Then `node --test` over the dist of every test-runner test that greps for
   nodeCatalog, catalogSelection, catalogTruncated, describe_nodes, core.run_node or offered tool ids (14 files).
   These include build-usage, build-from-chat, build-proposal, existing-fluxiq-control (which asserts
   `evidenceLoop.toolIds.length === 20`), adaptation-evidence-loop, live-llm-run and exploration-record.
   Result: `# tests 167 # pass 167 # fail 0`, exit 0.
7. `node scripts/structure-audit.mjs` -> "structure-audit: passed (155 warning(s), 118 baselined)", exit 0.

No timeouts happened, so nothing needed to be rerun alone.

## Not verified

- Extension unit tests (`apps/extension` activity/chat tests that mention `core.run_node` as wording) were not
  run. They exercise extension UI strings, not the Core request packet or tool list, and the brief did not name them.
- Whole-package suites (`pnpm test`, the full domain suite, the full test-runner suite) were not run, per the narrow-checks rule.
- No live, Lab or model run. Whether the model uses `core.describe_nodes` well is untested.

## Open questions or contradictions found

- `domain/scripts/test-domain.mjs` cannot run a subset. The brief's "labelled/filtered form" exists only as a label,
  so scoped runs need an ad hoc script. This could be a small tooling gap worth a filter argument.
- `existing-fluxiq-control.test.ts` asserts that the evidence loop has 20 tool ids, and it still passes. So
  `core.describe_nodes` does not appear in that read's `toolIds` (it is offered only during a build), which matches the brief.
