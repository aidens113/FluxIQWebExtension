# lane-t-p3-c-copies: copies of saved Flows and round-4 trace stores

## Outcome

Done. Five idle workspaces were copied whole into this tree's ignored `test-runs/`. Each copy matches its source in file count, byte count and the SHA-256 of every SQLite file (main file, `-wal` and `-shm`). No model call was made, no Lab run was started, and no database in a source tree was opened.

## What changed and why

Only ignored paths under `test-runs/` changed. No tracked file changed.

Source root: `C:/Users/osrs_/FluxStuff/fxwork/<tree>/!FluxIQWebExtension/test-runs/instances/<instance>/persistent-isolated/<workspace>`.
Destination root: `C:/Users/osrs_/FluxStuff/fxwork/t742/!FluxIQWebExtension/test-runs/`.

| copy | source (tree : instance : workspace) | destination | size (files) | project | traces |
| --- | --- | --- | --- | --- | --- |
| job-board saved Flow | t567 : bf-slot-4 : codex-halvard-office-t567-r1 | persistent-isolated/t742-job-board | 47 MB (280 files) | 2e50e5d9-4fda-475b-bad3-a8b4d17ef347 | none (no trace table: this store is older than trace capture); 2 flows, 5 runtime runs |
| company-website saved Flow | t567 : bf-slot-4 : bf-company-apprentices-hybrid-codex | persistent-isolated/t742-company-website | 55 MB (273 files) | 9ae6d989-7007-4159-939a-413c9b6ee940 | none (no trace table); 2 flows, 3 runtime runs |
| office run-mvgvyaip-d856e135 (everything-store office-checkout-review) | t563 : rr4-slot-1 : claude-office-checkout-t563-20261020-r5 | round4/run-mvgvyaip-d856e135 | 72 MB (321 files) | c27bb819-0ada-4e3c-82ec-e71ffa1617a2 | 4 traces, 1759 trace events, 146 trace artifacts; 3 runtime runs |
| job run-mvgw1854-5d10955b (job-board save-quillmark-remote) | t719 : rr4-slot-2 : claude-job-save-t719-20261020-r5 | round4/run-mvgw1854-5d10955b | 58 MB (270 files) | 1fa185e9-b435-4616-9d51-72a92e54b135 | 2 traces, 1511 trace events, 42 trace artifacts; 1 runtime run |
| photo run-mvgw7320-de416190 (photo-social newest-likes) | t567 : rr4-slot-4 : claude-photo-likes-t567-20261020-r5 | round4/run-mvgw7320-de416190 | 105 MB (343 files) | 46260e60-39ac-433d-a319-1b814a0c45ac | 1 trace, 1693 trace events, 30 trace artifacts; 0 runtime runs |

Layout:

- A saved-Flow copy is the whole workspace directory, renamed to `t742-<scenario>`, so `--workspace t742-<scenario>` finds it under `test-runs/persistent-isolated/`.
- A round-4 copy is the whole workspace directory renamed to the run id. Its contents are unchanged: `fluxiq-root/.fluxiq/global.sqlite`, and `fluxiq-root/.fluxiq/artifacts/automation-studio/projects/<project>/` with `project.sqlite`, `-wal`, `-shm`, `runtime/sqlite/global.sqlite` and `objects/sha256/..`. It also keeps `browser-profile/`, `.identity/`, `.sessions/` and `scenario-port.json`. The Core store root is `round4/<run-id>/fluxiq-root`. The original workspace names are in the table above.
- Each run's workspace name comes from `lab-runs/2026-10-20/<run>/run.json` (`"workspace"`). Its tree and instance come from `entry.json`.

Displaced copy: the D0 job-board copy (t342 breadth-job2, from a failed build) was sitting at `persistent-isolated/t742-job-board`. I moved it, unchanged, to `persistent-isolated/t742-job-board-t342-weak` so the passing t567 Flow could take the name the brief asked for.

Replay commands (run from this tree; not run):

```text
FLUXIQ_TEST_ENV_FILES=none node scripts/lab/run-lab.mjs replay job-board --workspace t742-job-board --flow flow.93146666-735b-4cb8-8303-5c451f7ed671 --project 2e50e5d9-4fda-475b-bad3-a8b4d17ef347 --instruction-task job-board-halvard-labs-office-jobs
FLUXIQ_TEST_ENV_FILES=none node scripts/lab/run-lab.mjs replay company-website --workspace t742-company-website --flow flow.618a6f46-6330-450d-9a11-f6205b4244cf --project 9ae6d989-7007-4159-939a-413c9b6ee940 --instruction-task company-website-apprentices
```

Both copies contain the named Flow's `*.flow.ts` under `projects/<project>/flows/<flow>/source/flows/`, plus one bootstrap graph subflow each.

## Commands run and observed results

1. Idle check, run once at discovery and again right before copying (09:51 local, 16:51Z):
   - `Get-CimInstance Win32_Process` filtered on `fxwork[\/](t567|t563|t719)` in the command line or executable path: `procs: 0`.
   - Files newer than 10 minutes under each instance (rr4-slot-1, rr4-slot-2, rr4-slot-4, bf-slot-4): `recent=0` for all four.
   - Newest file in each: rr4-slot-1 at 09:28 local, rr4-slot-2 at 09:31, rr4-slot-4 at 09:36, bf-slot-4 at 10-19 14:01. The newest files in the saved-Flow workspaces themselves are from 10-17 (23:47 and 23:02).
2. `cp -a` of each workspace to its destination: printed `copied`.
3. Copy check (file count, `du -sb`, and SHA-256 over all `*.sqlite*` files, source/destination):
   - t742-job-board: 280/280 files, 48418263/48418263 bytes, hash 18109d719f27 on both sides.
   - t742-company-website: 273/273, 57112599/57112599, 972a054c2c83 on both sides.
   - run-mvgvyaip: 321/321, 74528355/74528355, bdff13f157a3 on both sides.
   - run-mvgw1854: 270/270, 59549019/59549019, c1804a832b89 on both sides.
   - run-mvgw7320: 343/343, 109124241/109124241, 4e9a616f1fe5 on both sides.
4. Trace counts: neither file names nor run folders expose trace ids. A grep of `steps/` found no trace identifiers, only the word "Trace" in prompt text. So I copied each `project.sqlite`, `-wal` and `-shm` into a scratchpad directory, ran a row count per table with `node:sqlite` (Node v22.23.3) on those scratch copies, and then deleted the scratch directory. The counts are in the table above. Neither the sources nor the copies in `test-runs/` were opened.

## Not verified

- Neither saved-Flow replay was run. The brief did not ask for it, and D0 found that this tree's Core was being edited, which blocks the Lab.
- I did not check that the round-4 traces are complete or readable through Core's trace reader. I only counted rows.
- The photo store has 0 `runtime_runs` and 1 trace. Whether that one trace covers the whole run is not checked.

## Open questions or contradictions found

1. The t567 job-board and company-website stores have no `client_gateway_trace*` tables, because they were written before trace capture existed. They can be replayed, but they contain no traces. Opening them with current Core may migrate the schema, which happens in the copy, not the source.
2. The copies include `.identity/credentials.json`, `browser-profile/` and `.sessions/` because the brief asked for whole workspaces. They are in ignored `test-runs/` and must never be committed. I did not read them.
3. The old t342 weak job-board copy now lives at `t742-job-board-t342-weak`. D0's report still names it `t742-job-board`.
