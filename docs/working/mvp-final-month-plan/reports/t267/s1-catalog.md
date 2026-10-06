# t267-s1-catalog report

## Outcome
Done.

## What changed and why
- `apps/scenario-lab/src/scenarios/crossborder-marketplace/live-tasks.ts`: added the row `crossborder-marketplace-hub-to-cart-basket-redesign-after-creation` (variant `basket-redesign`, `variantArmedAfterBuild: true`) directly after the flash-deal row, and extended the `-hub-to-cart` header bullet with the brief's sentence.
- `apps/scenario-lab/src/scenarios/crossborder-marketplace/tests/live-tasks.test.ts` (new): the new row equals the base hub-to-cart row except `id`, with `variantId: "basket-redesign"` and `variantArmedAfterBuild: true`; the manifest declares a `basket-redesign` variant.

## Commands run and observed results
1. `run-subset.mjs` failed first with `Error: Cannot find module 'esbuild'` (esbuild is not hoisted in this worktree; it lives only in `node_modules/.pnpm/esbuild@0.24.2`). Re-run with `NODE_PATH=<repo>/node_modules/.pnpm/esbuild@0.24.2/node_modules` bundled the three files. `node --test` on the three .mjs: `# tests 25 # pass 25 # fail 0`. Scratch dir `.test-build-scratch/t267-s1-catalog` and the empty `.test-build-scratch` deleted.
2. `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab check` -> exit 0.
3. `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab build` -> `scenario-lab:build ... stored in the shared store (846 file(s))`, no error. Dry run, exit 0, full output:

```
# 3 task(s), one at a time, npm_config_workspace_concurrency=1; each spawned as node scripts/lab/run-lab.mjs with these arguments
pnpm lab run crossborder-marketplace --variant basket-redesign --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow --instruction-task crossborder-marketplace-hub-to-cart-basket-redesign-after-creation --llm-max-input-tokens 992000 --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 48 --target persistent-isolated --workspace t267-WS --replays 1
pnpm lab run bigbox-retail --variant redesigned-buy-box --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow --instruction-task bigbox-retail-pickup-cart-redesigned-after-creation --llm-max-input-tokens 992000 --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 48 --target persistent-isolated --workspace t267-WS --replays 1
pnpm lab run social-network-feed --variant regrouped --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow --instruction-task social-network-feed-group-post-regrouped-after-creation --llm-max-input-tokens 992000 --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 48 --target persistent-isolated --workspace t267-WS --replays 1
```

## Not verified
No Lab run, browser or provider call (per brief). Build exit code was read from output only (piped through tail).

## Open questions or contradictions found
- run-subset.mjs needs esbuild resolvable from the package dir; in this worktree it is not, so NODE_PATH was needed.
- `git diff --stat` also shows `flow-lane/repair/tests/run-repair-lane.test.ts` modified; not mine (another worker's).
