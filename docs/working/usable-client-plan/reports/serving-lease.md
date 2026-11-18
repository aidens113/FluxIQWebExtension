# serving-lease (t931): report

Worker: worker-heavy. Core tree `C:/Users/osrs_/FluxStuff/fxwork/t931/!FluxIQ`, extension tree `C:/Users/osrs_/FluxStuff/fxwork/t931/!FluxIQWebExtension`. Nothing is committed. No paid calls were made. Every heavy step ran through the heavy-slot gate. Nothing is left running and no slot is held.

## Outcome

Done. One process serves a data root.

- The web panel and `fluxiq dev` each claim the root before opening it. A second server is refused with a plain message naming the holder.
- Offline `fluxiq accounts` holds the root while its command runs. While a server holds the root, the command is refused and says how to run it against the live server.
- An owner file left by a crashed holder is reclaimed after a pid and start-time check.
- Live testing found two defects in my own work, both now fixed:
  - The claim call in `accounts` `main.ts` had not applied: a scripted edit silently matched nothing.
  - When `register()` throws, the panel stayed up half-started.

## How the panel behaves when `register()` throws (lead's question)

Next 15.5.24 under `next start` does not exit when instrumentation `register()` throws. Observed live in the second run:

- It logs `Failed to prepare server ... An error occurred while loading instrumentation hook: ...` and an unhandled rejection.
- It keeps port 3600 open (`listening=true`).
- Every request awaits the rejected prepare, so no route runs, but the server looks up.

Fix: `apps/web/src/instrumentation.ts` catches the data-root refusal (`code === "fluxiq.data_root_held"`), writes its message to stderr synchronously, and calls `process.exit(1)`. Other startup failures are left to Next as before. Re-run live: the panel exits 1 with the message and nothing listens on 3600.

All other startup failures still leave a half-started panel. That is a pre-existing behaviour and a candidate follow-up for the lead.

## What changed and why

- **New `packages/fluxiq/src/server/data-root-owner/`**, exported from `fluxiq/server` through one line in `server/index.ts`:
  - `claim.ts` `claimFluxIQDataRoot(rootDir, { role })`:
    - Creates the owner file atomically.
    - Reclaims only a holder verified dead: same machine, and either no such pid or a pid whose OS start time differs.
    - Reclaims under a `.reclaim` guard; a guard whose writer died is itself reclaimable, so a crash never locks the root.
    - Refuses holders that are live, foreign, unverifiable or unreadable.
  - `owner/`:
    - `path.ts`: the file is `<root>/.fluxiq.owner`. Inside `.fluxiq`, any entry makes `inspectFluxIQStorage` read a fresh root as v1.
    - `record.ts`: the record holds a token, role, pid, OS start time, platform, a hash of the machine id, the hostname and the claim time. It holds no data or keys.
    - `file.ts`: creation writes a draft and hard-links it into place, so the file is never half-written. Removal moves the file aside, compares the token, and puts it back if the token does not match.
    - `liveness.ts`: the verdicts `live | dead | foreign | unverified`.
  - `process/`:
    - The OS start time comes from `/proc` stat plus the boot id on Linux, from PowerShell `Get-Process` StartTime ticks on Windows, and from `ps -o lstart` in UTC elsewhere.
    - The machine id is the hashed MachineGuid, machine-id or IOPlatformUUID.
    - `systemProcessProbe` checks existence with signal 0.
  - `process-claims.ts`: one claim per process, shared through `globalThis` because Next bundles a copy into each graph. Released by the last caller, or synchronously on `exit`.
  - `held-error.ts` `FluxIQDataRootHeldError`: the plain refusal, which names the role, pid, host and claim time.
- **`server/cli/run-dev.ts`**: claims the root before opening the instance, and releases it only after the instance has closed.
- **`server/cli/run-command.ts`** (next to the brief's paths; part of the `fluxiq dev` command): prints the refusal without a stack, sets exit code 1, and disconnects an IPC parent so the process can exit.
- **`platform/provisioning/cli/`**:
  - New `claim-offline-data-root.ts`, which turns a refusal into an `AccountsTransportError` naming `FLUXIQ_PROVISIONING_LISTEN` and `FLUXIQ_PROVISIONING_TOKEN_FILE`.
  - `main.ts` claims the root before opening any data and releases it in `finally`.
  - `usage.ts` text and the `index.ts` export are updated.
- **`apps/web/src/lib/fluxiq.ts`**: the import from `fluxiq/server`, plus one statement at the top of `initializeFluxIQWebRuntime`: `await claimFluxIQDataRoot(resolveFluxIQWebHostRoot(process.cwd()), { role: "the web panel" })`. Nothing else in the file changed (t927 reconciles).
- **`apps/web/src/instrumentation.ts`**: the exit on refusal described above (outside the brief's literal list; needed for the lead's requirement), with a new test, `apps/web/src/tests/instrumentation.test.ts`.
- **`docs/fluxnodes/README.md`**:
  - The key setup now runs the panel on the data directory (`FLUXIQ_ROOT`) while `fluxiq dev` is stopped.
  - A new "One server per data directory" bullet covers the claim file, refusal and reclaim.
- **`.gitignore` in both t931 trees** (granted by the lead): `.fluxiq.owner`. Checked with `git check-ignore -v .fluxiq.owner`.

## change_feed pruning (report only: every writer is in t911-owned paths)

- **Schema:** `framework/persistence/automation/project/administration.ts:95`.
- **Writers:**
  - `administration.ts` `append`, both branches, at about :231 and :239, called from `framework/automation-service/service/flows/writer.ts:208`;
  - `framework/persistence/automation/project/unit-of-work.ts:120` `recordChange`.
- **Readers:**
  - `administration.ts` `listAfter` and `listEntity`;
  - `project/hierarchy/feed.ts:49` `listUpdatesAfter`;
  - `automation-service/service/flows/store.ts:144` `listProjectChangeFeed`, polled by the panel's `features/automation-studio/sync/project-sync.ts`, which keeps its cursor in memory.

  `mutations.first/last_change_sequence` record sequence numbers but never read the rows.
- **Design:**
  - Delete rows older than a retention window, always keeping the newest N.
  - In the same transaction, store a `pruned_through_sequence` watermark.
  - A read with `afterSequence` below the watermark returns an explicit resync signal (as `fallback` or `opened` do), so the reader reloads a snapshot and a gap is never silent.
  - Run the prune from the project database's open or maintenance path.

## Commands run and observed results

- `vitest run src/server/data-root-owner` -> 11 passed. Cases:
  - a second real process holding the root is refused, by name and pid;
  - a holder killed with SIGKILL is reclaimed;
  - a reused pid is reclaimed, and the same pid with the same start time is live;
  - a foreign holder, an unreadable file, and a holder with no recorded start time are all refused;
  - a dead reclaim guard is passed;
  - of two racing claimants exactly one wins;
  - claims are shared within a process;
  - a fresh root stays fresh.
- `vitest run src/platform/provisioning/cli src/server/cli` -> all passed (106 tests, 13 files on the first run, after fixing one wrong operation name in my own test).
- `vitest run src/platform/provisioning/cli/tests/claim-offline-data-root.test.ts` -> 3 passed.
- `node scripts/structure-audit.mjs` (Core) -> `structure-audit: passed (550 warning(s), 914 baselined)`, re-run after each later change.
- `node scripts/structure-audit.mjs` (extension tree) -> `structure-audit: passed (252 warning(s), 551 baselined)`.
- Gated `pnpm --filter fluxiq check` -> exit 0, before and after the `main.ts` fix.
- Gated `pnpm --filter fluxiq build` -> exit 0, rebuilt after the fix; `dist/.../cli/main.js` contains the claim.
- Gated `pnpm --filter @fluxiq/web check` -> exit 0, before and after the instrumentation change.
- Gated `vitest run src/lib/tests/fluxiq.test.ts src/lib/workspaces/tests/existing-workspace-composition.test.ts src/lib/workspaces/tests/web-workspaces.test.ts` (apps/web) -> 3 files, 59 tests passed.
- `vitest run src/tests/instrumentation.test.ts` (apps/web) -> 3 passed.
- Gated `pnpm --filter @fluxiq/web build` -> exit 0, before and after the instrumentation change.
- **Live**, under `acquire t931 60` with the scratch script `t931-live.mjs` and a scratch root (panel on 3600/5377, `fluxiq dev` on 3601/5378; no host module, no model key):
  - First run: 7 of 10 checks passed and 2 failed. C failed because offline accounts opened the data beside the live panel (the missing claim). A2 was a timing bug in my script. The run then aborted at E: the script's ready wait was buggy, so F and G did not run.
  - Second run: 9 of 10 passed. F failed: the panel stayed listening after `register()` threw.
  - Final run, after both fixes: **10/10 passed**:
    - A: the panel claims the root.
    - B: `fluxiq dev` is refused with exit 1 and no stack trace, naming "the web panel (process 12644 ...)".
    - A2: the panel's storage is v2 beside the owner file.
    - C: offline accounts is refused with exit 1, without opening the data.
    - D: a panel killed with `taskkill /F` leaves its file.
    - E: `fluxiq dev` reclaims the root and serves.
    - F: a panel started while dev holds the root exits 1 with the message, and nothing listens on 3600.
    - G: a graceful stop of `fluxiq dev` removes the file.
  - Afterwards no t931 node processes were left, the scratch root was deleted, and no slot was held.

## Not verified

- Linux and macOS start-time paths (only Windows ran live; the unit tests also ran only on Windows).
- `next dev` behaviour (only `next start` was tested).
- The panel started with a domain host module.
- Docker or a shared volume.
- The `main.ts` wiring has no unit test, because the module runs `main` when imported. It was proven live (C).
- Full package suites were not run (narrow checks only, per repository policy).

## Open questions or contradictions found

- Every other `register()` failure still leaves a half-started `next start` panel (pre-existing). Recommend making any startup failure exit, in a separate change.
- Docker: a container recreated after a crash (new hostname, no machine-id) reads the old file as foreign and refuses. The message names the file to delete. Restarting the same container reclaims normally.
- `docs/operations/self-hosting.md` and `docs/architecture/runtime-ownership.md` should describe the lease (not owned paths).
- Residual race: two owners are possible only if a reclaim guard crashed and two further claimants arrive within milliseconds of each other.
- `process/machine.ts` duplicates the machine-id read in t911's `fluxnode/act-scope/execution-owner.ts`. That file could import it once t911 lands.

```text
Outcome: Done
Changed: Core packages/fluxiq/src/server/data-root-owner/** (new), server/index.ts, server/cli/run-dev.ts, server/cli/run-command.ts, platform/provisioning/cli/{claim-offline-data-root.ts,main.ts,usage.ts,index.ts,tests/claim-offline-data-root.test.ts}, apps/web/src/lib/fluxiq.ts (import + 1 call), apps/web/src/instrumentation.ts, apps/web/src/tests/instrumentation.test.ts, docs/fluxnodes/README.md, .gitignore; extension .gitignore
Validation: gated fluxiq check/build and web check/build -> exit 0; web lib vitest -> 59 passed; owner vitest -> 11 passed; provisioning/server CLI vitest -> passed; structure audit both trees -> passed; live t931-live.mjs -> 10/10 passed
Not verified: Linux/macOS start-time paths, next dev, host-module panel, Docker, unit coverage of main.ts wiring (proven live)
Report: C:/Users/osrs_/FluxStuff/fxwork/t931/!FluxIQWebExtension/docs/working/usable-client-plan/reports/serving-lease.md
Notes: next start keeps listening when register() throws; instrumentation now exits 1 on the data-root refusal only.
```
