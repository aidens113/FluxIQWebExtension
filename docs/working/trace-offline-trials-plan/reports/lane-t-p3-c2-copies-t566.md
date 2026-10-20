# lane-t-p3-c2-copies-t566: copies of t566's saved Flows and its round-4 trace store

## Outcome

Done. Four idle workspaces from lane tree t566 were copied whole into this tree's ignored `test-runs/`. Each copy matches its source in file count, byte count and the SHA-256 of every SQLite file (main file, `-wal` and `-shm`; 5 SQLite files per copy). No model call was made, no Lab run was started, and no database in a source tree or in `test-runs/` was opened.

## What changed and why

Only ignored paths under `test-runs/` changed, plus this report. No tracked file changed. Nothing existed at any destination before the copy, so nothing was displaced.

Source root: `C:/Users/osrs_/FluxStuff/fxwork/t566/!FluxIQWebExtension/test-runs/instances/<instance>/persistent-isolated/<workspace>`.
Destination root: `C:/Users/osrs_/FluxStuff/fxwork/t742/!FluxIQWebExtension/test-runs/`.

| copy | source (instance : workspace) | destination | size (files) | project | traces |
| --- | --- | --- | --- | --- | --- |
| auction-marketplace saved Flow | bf-slot-3 : codex-auction-shop-t566-20261018-r1 | persistent-isolated/t742-auction-marketplace | 59 MB, 59335159 B (407 files) | 7c64c7f0-317f-45bd-b934-322868b3c29e | none (no trace tables); 4 flows, 14 runtime runs |
| local-classifieds saved Flow | bf-slot-3 : codex-classifieds-furniture-t566-20261018-r1 | persistent-isolated/t742-local-classifieds | 50 MB, 50445964 B (330 files) | 7e60ea86-eee1-4255-8109-e1ffeee579cc | none (no trace tables); 2 flows, 9 runtime runs |
| professional-network saved Flow | bf-slot-3 : codex-professional-positive-t566-20261018 | persistent-isolated/t742-professional-network | 41 MB, 40525518 B (278 files) | dc585c9c-3cc7-4749-b465-546f7b7892d7 | none (no trace tables); 2 flows, 6 runtime runs |
| social run-mvgw3ve5-294881b5 (social-network-feed-recent-group-posts) | rr4-slot-3 : claude-social-groups-t566-20261020-r7 | round4/run-mvgw3ve5-294881b5 | 849 MB, 849290136 B (794 files) | a846814f-becd-4569-934f-f3a10df1ce79 | 9 traces, 2002 trace events, 89 trace artifacts; 1 flow (flow.de7e910c-4fa5-4106-8a2f-620cdb9a4a26), 8 runtime runs |

Layout is the same as `lane-t-p3-c-copies.md`: a saved-Flow copy is the whole workspace renamed `t742-<scenario>`; the round-4 copy is the whole workspace renamed to the run id, with its Core store root at `round4/run-mvgw3ve5-294881b5/fluxiq-root`. The run's workspace name came from `lab-runs/2026-10-20/run-mvgw3ve5-294881b5/run.json` (`"workspace": "claude-social-groups-t566-20261020-r7"`); `entry.json` names instance `rr4-slot-3` and mentions t566.

Each saved-Flow copy holds the named Flow's `*.flow.ts` plus its bootstrap graph subflows (auction: find_hood, list_shop, main; classifieds: list_furniture; professional: find_lead_engineer).

Replay commands (run from this tree; not run):

```text
FLUXIQ_TEST_ENV_FILES=none node scripts/lab/run-lab.mjs replay auction-marketplace --workspace t742-auction-marketplace --flow flow.1f2bf956-9e4a-4651-beca-b9a33a0c0069 --project 7c64c7f0-317f-45bd-b934-322868b3c29e --instruction-task auction-marketplace-lens-hood-seller-shop
FLUXIQ_TEST_ENV_FILES=none node scripts/lab/run-lab.mjs replay local-classifieds --workspace t742-local-classifieds --flow flow.0745fb05-dcb2-4bac-966d-0886062e3b87 --project 7e60ea86-eee1-4255-8109-e1ffeee579cc --instruction-task local-classifieds-nearby-furniture
FLUXIQ_TEST_ENV_FILES=none node scripts/lab/run-lab.mjs replay professional-network --workspace t742-professional-network --flow flow.f6a17d8a-6f51-44a4-96a8-b296f8cca2c3 --project dc585c9c-3cc7-4749-b465-546f7b7892d7 --instruction-task professional-network-kade-lead-contact
```

## Commands run and observed results

1. Idle check at 10:14 local, 2026-10-20, immediately before copying:
   - `Get-CimInstance Win32_Process` filtered on `fxwork[\/]t566` in command line or executable path: `procs: 0`.
   - Files newer than 10 minutes: `bf-slot-3 recent=0` (newest 10-19 14:20:48), `rr4-slot-3 recent=0` (newest 10-20 09:52:08, `run-mvgw3ve5-294881b5/extension-start.local.json`).
2. `cp -a` of each workspace (destinations checked absent first with `test ! -e`).
3. Copy check, source/destination (file count, `du -sb`, SHA-256 over the sorted per-file hashes of all `*.sqlite*` files):
   - t742-auction-marketplace: 407/407 files, 59335159/59335159 bytes, 7e41d83c062a both sides.
   - t742-local-classifieds: 330/330, 50445964/50445964, 5e14475c5be2 both sides.
   - t742-professional-network: 278/278, 40525518/40525518, 5cc204c366db both sides.
   - run-mvgw3ve5-294881b5: 794/794, 849290136/849290136, 62a40a83dd0d both sides.
4. Trace counts: each copy's `project.sqlite`, `-wal` and `-shm` were copied together into a scratchpad directory and counted read-only with `node:sqlite` (tables matching `%trace%`, plus `flows` and `runtime_runs`). The scratch directory and counting script were deleted afterwards (confirmed absent from the scratchpad listing).

## Not verified

- No replay was run (the brief did not ask; it also forbids Lab runs).
- Round-4 trace completeness and readability through Core's trace reader were not checked; only rows were counted.
- Only `project.sqlite` was counted; `fluxiq-root/.fluxiq/global.sqlite` and `runtime/sqlite/global.sqlite` were hashed but not opened.

## Open questions or contradictions found

1. The three t566 saved-Flow stores have no `client_gateway_trace*` tables (written 10-18, before trace capture). Replayable, but no traces. Opening them with current Core may migrate the schema in the copy.
2. The social copy is large (849 MB), most likely its browser profile; I did not inspect it. Like the earlier copies, it and the saved-Flow copies contain `.identity/`, `browser-profile/` and `.sessions/`: ignored, never to be committed, not read by me.
