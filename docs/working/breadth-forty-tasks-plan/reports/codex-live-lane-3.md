# Codex live acceptance lane 3

Status: integrated build/checks passed; frozen and ready. Paid launch held pending explicit supervisor release.

Paired task `task/t566-a8-lane-4`: downstream HEAD `be9639c4e069f5428ace62de9e9cd1d2a8e827a3`, Core HEAD `c4c23666b0e7632fcc8af569706e3580be006930`. Both were clean before this report. Supervisor committed social fixes at downstream `97f970e7` / Core `7005f611`, independently reviewed/tested them, then merged latest dev into both trees without conflict. Core now includes preceding-context feedback; downstream includes paging/person handoff.

## Preparation

- Read main plan Current State and `codex-social-live-acceptance` brief, own completion report, prior `live-lane-3.md`, and debug notes for failed recent-group-posts/hide-suggested runs.
- `lab-slots/slot-3/owner` assigns t566 / bf-slot-3 to this lane. Latest recorded bf-slot-3 launch finished; no open run from this instance. No STOP file is present.
- Provider-key presence verified through `providerKeySource`, source `.env.local` in this downstream tree. No value printed/copied.
- Cache-off Core production library build **passed**: `$env:FLUXIQ_BUILD_CACHE_DIR='off'; node scripts/build-cache/cli.mjs contracts:build fluxiq:build client-gateway-websocket:build`. Contracts reused current stamp2.1s; fluxiq rebuilt88.9s; gateway reused0.4s. Only paired t566 outputs changed, now frozen. Supervisor notified build completion before its integrated tests.
- Once-only post-integration domain package check **passed/stamped**,24.9s; extension check **passed/stamped**,117.4s (source/test typechecks and all browser bundles). Both structure audits **passed**: downstream208 warnings/638 baselined; Core401 warnings/1154 baselined. Both HEADs include local dev (read-only ancestry check). Supervisor owns combined tests. No source changes, commits, merges, pushes, live launch or user panel management by this worker.

## Held live sequence

After explicit release: `social-network-feed-recent-group-posts`, then `social-network-feed-hide-suggested-posts`, each with a separate persistent-isolated workspace, instance bf-slot-3, real extension chat entry, judged whole run and one zero-call replay. Initial per-run ceiling $0.25 and250 calls. No guard override or task/oracle/model-example edits.

Launch shape from downstream root (task/workspace differs per run):

```powershell
$env:FLUXIQ_BUILD_CACHE_DIR='off'
$env:FLUXIQ_TEST_TARGET='persistent-isolated'
$env:FLUXIQ_TEST_ENV_FILES='none'
$env:FLUXIQ_DEMO_HEADLESS='false'
$env:FLUXIQ_LAB_INSTANCE='bf-slot-3'
$env:FLUXIQ_LAB_CORE_BRANCH='task/t566-a8-lane-4'
$env:FLUXIQ_LLM_RUN_COST_CEILING_USD='0.25'
pnpm.cmd lab run social-network-feed --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --authoring-mode project --llm-task create-flow --instruction-task social-network-feed-recent-group-posts --target persistent-isolated --workspace bf-codex-social-recent-acceptance --replays 1 --llm-max-cost-usd 0.25 --llm-max-calls 250 --llm-max-run-tokens 48000000
```

Project builds are required by the runner to originate in the extension chat. Keep source/build outputs frozen while a run is active. Inspect each actual outcome/cost/replay account. A failure needs an evidence-backed debug before any changed-source rerun; source changes require exact supervisor assignment.

## Results

Supervisor independent post-integration verification (reported and owned by supervisor): combined Core read-account/candidate/subflow trial feedback **37/37 passed**; combined extension paging/person/next-page/complete-reader/disclosure **103/103 passed**. Earlier supervisor own Chromium proof **2/2** and domain tests **19/19** also passed. These are supervisor-observed results, separate from this worker's build/type/audit observations above.

No new run launched or paid calls made yet.
