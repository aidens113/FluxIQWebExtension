# lane-t-p3-d0-saved-flows: saved Flows for provider-free replay

## Outcome

Partial.

- Four scenarios have a replayable saved Flow from an allowed tree, and those are copied here: crossborder-marketplace, bigbox-retail, everything-store and social-network-feed.
- job-board has only a Flow from a build that failed (10-13). It is copied as a weak candidate and has not been shown to replay.
- auction-marketplace, company-website, local-classifieds and professional-network have passing Flows only in the live lane trees t566 and t567, which this brief forbids.
- photo-social has no passing build anywhere.
- The one proving replay could not run. FluxIQ Core next to this worktree (`fxwork/t742/!FluxIQ`) was being edited while I ran: its `packages/fluxiq/src` changed during each attempt. The Lab refused to start, so no browser opened. The replay command form is the same one P2 ran 36 times with a passing result, against copies of these same source workspaces (`reports/lane-t-p2-m-overhead.md`).

## What changed and why

I copied whole, idle workspaces into this tree's ignored `test-runs/persistent-isolated/`. No tracked file changed.

| scenario | copied to | source (tree : workspace) | project | Flow | instruction task | Flow's passing evidence |
| --- | --- | --- | --- | --- | --- | --- |
| crossborder-marketplace | t742-crossborder-marketplace | fxwork/t565 : test-runs/instances/a8-slot-2/persistent-isolated/a8e-candidate-crossborder-marketplace-hub-to-cart | e2d231e3-eece-4dde-b052-64754442e5a1 | flow.77711719-8dac-4117-9c25-19402953e140 | crossborder-marketplace-hub-to-cart | build run-mvan7ww9-93e9ab0f passed 10-16; P2 replays passed 10-20 (t736m copy) |
| bigbox-retail | t742-bigbox-retail | fxwork/t565 : .../a8-slot-2/persistent-isolated/a8e-project-bigbox-retail-pickup-cart | 3f1a311b-b79e-4ac8-bf09-41df79069335 | flow.8b6d3c62-ebf5-4df0-92f4-4146aaef4f88 | bigbox-retail-pickup-cart | build run-mvbyc30x-e827a493 passed 10-17; P2 replays passed 10-20 |
| everything-store | t742-everything-store | fxwork/t565 : .../a8-slot-2/persistent-isolated/a8e-project-everything-store-plus-earbuds-under-50 | 535f17f3-fa94-4912-bd35-9e8df8dc1428 | flow.a7a87ef8-89d5-40ef-a0be-6ac831b6c966 | everything-store-plus-earbuds-under-50 | build run-mv9qt9lt-d092c61f passed 10-15; P2 replays passed 10-20 |
| social-network-feed | t742-social-network-feed | fxwork/t565 : .../a8-slot-2/persistent-isolated/a8e-candidate-social-network-feed-confirm-requests | 0b68290c-f8c3-4dbe-bb91-57b860944453 | flow.5c557bc2-aeb7-4845-a12f-c02de6e1e212 | social-network-feed-confirm-requests | build run-mvanqgrc-513be545 passed 10-16; P2 replays passed 10-20 |
| job-board (weak) | t742-job-board | fxwork/t342 : test-runs/instances/t342-slot-2/persistent-isolated/breadth-job2 | c310f578-11f3-4e1e-89ec-648d22ac48b7 | flow.9cefb863-484b-439c-89e9-f8ebb3472593 | job-board-remote-rust-roles | build run-mv6v2kzn-d593231f FAILED 10-13; 4-node graph; never replayed |

Most workspaces hold more than one project. The `--project` flag picks the right one. The bigbox copy is 350 MB, everything-store 223 MB, crossborder 72 MB, social 59 MB and job-board 65 MB.

Replay commands, run from this tree:

```text
FLUXIQ_TEST_ENV_FILES=none node scripts/lab/run-lab.mjs replay crossborder-marketplace --workspace t742-crossborder-marketplace --flow flow.77711719-8dac-4117-9c25-19402953e140 --project e2d231e3-eece-4dde-b052-64754442e5a1 --instruction-task crossborder-marketplace-hub-to-cart
FLUXIQ_TEST_ENV_FILES=none node scripts/lab/run-lab.mjs replay bigbox-retail --workspace t742-bigbox-retail --flow flow.8b6d3c62-ebf5-4df0-92f4-4146aaef4f88 --project 3f1a311b-b79e-4ac8-bf09-41df79069335 --instruction-task bigbox-retail-pickup-cart
FLUXIQ_TEST_ENV_FILES=none node scripts/lab/run-lab.mjs replay everything-store --workspace t742-everything-store --flow flow.a7a87ef8-89d5-40ef-a0be-6ac831b6c966 --project 535f17f3-fa94-4912-bd35-9e8df8dc1428 --instruction-task everything-store-plus-earbuds-under-50
FLUXIQ_TEST_ENV_FILES=none node scripts/lab/run-lab.mjs replay social-network-feed --workspace t742-social-network-feed --flow flow.5c557bc2-aeb7-4845-a12f-c02de6e1e212 --project 0b68290c-f8c3-4dbe-bb91-57b860944453 --instruction-task social-network-feed-confirm-requests
FLUXIQ_TEST_ENV_FILES=none node scripts/lab/run-lab.mjs replay job-board --workspace t742-job-board --flow flow.9cefb863-484b-439c-89e9-f8ebb3472593 --project c310f578-11f3-4e1e-89ec-648d22ac48b7 --instruction-task job-board-remote-rust-roles
```

How I searched:

1. I parsed `lab-runs/index.md`, which lists 370 runs. For each run I read `entry.json` (tree and instance), `run.json` (the arguments it was invoked with) and `snapshots/creation-context.json` (project and Flow). 145 runs passed.
2. A run keeps its workspace at `<repo>/test-runs/instances/<instance>/persistent-isolated/<workspace>`, not at `test-runs/persistent-isolated/`.
3. I listed every saved `*.flow.ts` under the persistent workspaces of every fxwork tree except t563, t566, t567, t719, t741 and t742, and of the main checkout. That found 202 Flows in 75 workspaces. The main checkout holds none.
4. Outside the lane trees, the only workspaces for the six missing scenarios are 10-13 `breadth-*` workspaces and a t565 `bf-auction` workspace. All of them come from failed builds:
   - t451 breadth-auction, t565 bf-auction-marketplace-cheap-accessory-auctions, t275 breadth-company and t262 breadth-classifieds hold only an empty orchestration Flow, with no graph. They cannot be replayed.
   - t342 breadth-job2 has a 4-node graph, and is the one I copied as the job-board candidate.
5. The t518, t399/t404 (`rmx-*`) and t524 workspaces are for scenarios that are already covered.

Idle check:

- No process command line or executable path refers to `fxwork/t565` or `fxwork/t342`.
- No file in the chosen workspaces is newer than 24 hours. The newest are: t565 at 10-16 22:30 and earlier, t342 at 10-13 09:06.

## Commands run and observed results

1. `FLUXIQ_TEST_ENV_FILES=none node scripts/lab/run-lab.mjs replay social-network-feed --workspace t742-social-network-feed --flow flow.5c557bc2-... --project 0b68290c-... --instruction-task social-network-feed-confirm-requests`
   - Exit 1 before any replay. The Lab's stale-Core guard refused: `fluxiq:build (inputs changed: packages/fluxiq)`. Core's newest file was at 14:08:18Z; I ran at 14:21Z.
2. The same command with `FLUXIQ_LAB_ALLOW_STALE_CORE=1` and `FLUXIQ_CORE_WEB_BUILD_CACHE=<under this tree>`.
   - Exit 1. replay-mvgrxjbp-67d39cb1 gave verdict failed with `environment.missing`: the cache path is 110 characters, too long for the files Next writes.
   - My own mistake. I removed that cache directory afterwards.
   - The prelude rebuilt domain, extension and test-runner, and reported `not stamped, because inputs changed while it ran (core:packages/fluxiq/src)`.
3. The same command with only `FLUXIQ_LAB_ALLOW_STALE_CORE=1`, using the default web build cache.
   - Exit 1. replay-mvgs0acm-b78d259e gave verdict failed with `process.startup`: `Core's build inputs changed while the web panel was building (key 6e6a5571... became c4bb4e19...), so the build was not published`.
   - The Lab stopped there: no browser, no run, 0 model calls (`modelProvidersEnabled: false`).

I did not retry again, because the cause is that someone else is editing Core right now, not anything about the workspace.

The failed attempts touched the social workspace (`.sessions`, `fluxiq-root/.fluxiq/global.sqlite`). I deleted that copy and copied it again from t565, and confirmed no file in it is newer than 30 minutes.

Side effects in this tree, all ignored or generated by the Lab command:

- rebuilt `domain`, `apps/extension/build` and `dist`, and `packages/test-runner` outputs;
- two result files, `test-runs/replays/replay-mvgrxjbp-67d39cb1.json` and `test-runs/replays/replay-mvgs0acm-b78d259e.json`.

Attempt 3 may also have left a partial web build in Core's own default cache (`<core>/.tmp/web-build`).

## Not verified

- None of the copied workspaces has been replayed here. The four main ones replayed with a passing result on 10-20 in P2, but against copies taken from the same t565 source.
- The job-board Flow (breadth-job2) comes from a failed build on 10-13 code. It will probably not pass. `job-board-remote-rust-roles` still exists in `apps/scenario-lab/src/scenarios/job-board/live-tasks.ts`.
- I did not open the lane trees, so I have not confirmed their workspaces still exist.

## Open questions or contradictions found

1. **The replay cannot run in this tree while its Core is being edited.** The Lab refuses, and with the override it fails to publish the web panel. The lead needs Core to be quiet, or rebuilt with `pnpm --filter fluxiq build`, before running the replays.
2. **To cover auction-marketplace, company-website, local-classifieds, professional-network and a passing job-board Flow, the lead must copy from lane trees once they are idle.** The supervisor has to allow that. From `lab-runs`, without opening the trees:

| scenario | tree : instance | workspace | project | Flow | instruction task | passing run |
| --- | --- | --- | --- | --- | --- | --- |
| auction-marketplace | t566 : bf-slot-3 | codex-auction-shop-t566-20261018-r1 | 7c64c7f0-317f-45bd-b934-322868b3c29e | flow.1f2bf956-9e4a-4651-beca-b9a33a0c0069 | auction-marketplace-lens-hood-seller-shop | run-mvecxd6w-ed72a1ca |
| local-classifieds | t566 : bf-slot-3 | codex-classifieds-furniture-t566-20261018-r1 | 7e60ea86-eee1-4255-8109-e1ffeee579cc | flow.0745fb05-dcb2-4bac-966d-0886062e3b87 | local-classifieds-nearby-furniture | run-mvebbnwm-47169b0d |
| professional-network | t566 : bf-slot-3 | codex-professional-positive-t566-20261018 | dc585c9c-3cc7-4749-b465-546f7b7892d7 | flow.f6a17d8a-6f51-44a4-96a8-b296f8cca2c3 | professional-network-kade-lead-contact | run-mvdi9e8u-678c35df |
| job-board | t567 : bf-slot-4 | codex-halvard-office-t567-r1 | 2e50e5d9-4fda-475b-bad3-a8b4d17ef347 | flow.93146666-735b-4cb8-8303-5c451f7ed671 | job-board-halvard-labs-office-jobs | run-mvdgaz8z-27ff3d1b |
| company-website | t567 : bf-slot-4 | bf-company-apprentices-hybrid-codex | 9ae6d989-7007-4159-939a-413c9b6ee940 | flow.618a6f46-6330-450d-9a11-f6205b4244cf | company-website-apprentices | run-mvdes30x-65848f60 |

3. **photo-social has never had a passing build.** Every photo-social run in `lab-runs` failed: newest-likes, priya-tags and august-over-1300. A saved Flow for it needs either a passing build, which means a paid live run, or a Flow written by hand and proven against the fixture without a model.
4. **P2's note was misleading about where workspaces live.** It says the main checkout and `lab-runs` hold no workspace, which is true, but a Lab run's workspace sits under `test-runs/instances/<instance>/persistent-isolated/`. Anyone searching `test-runs/persistent-isolated/` alone will miss it.
