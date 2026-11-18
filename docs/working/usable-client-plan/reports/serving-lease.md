# serving-lease (t931): report

Worker: worker-heavy. Core tree `C:/Users/osrs_/FluxStuff/fxwork/t931/!FluxIQ`, extension tree `C:/Users/osrs_/FluxStuff/fxwork/t931/!FluxIQWebExtension`. Round 1 was committed as `7cef0e55e`. This report covers round 2, which is uncommitted, on top of round 1 merged with dev (`1af346aeb`). No paid calls were made. Every heavy step ran through the slot gate. Nothing is left running and no slot is held.

## Outcome

Done. All four round-2 items are implemented and tested, and live checks pass 13 of 13.

1. **Any panel startup failure exits.** When `register()` fails for any reason, the panel exits 1 with a plain message. It no longer keeps listening half-started.
2. **A recreated container reclaims its own root.** The holder now renews a heartbeat on its owner file. A claim that cannot be checked by process id (another container or machine, or an unreadable start time or file) is watched for 20 seconds: refused if renewed, reclaimed if not. A live holder anywhere still refuses a second server. A holder that loses its claim while frozen exits.
3. **`change_feed` pruning is implemented.** It keeps a recent window and the newest rows, records a pruned-through watermark, and tells a reader whose cursor is older to reload, with an explicit `resync` flag, instead of silently missing rows.
4. **The docs describe the lease.** `docs/operations/self-hosting.md` and `docs/architecture/runtime-ownership.md` cover the claim, the reclaim and every refusal message. The FluxNode docs are updated too.

## What changed and why

### 1. Startup failures (`apps/web/src/instrumentation.ts`)

- `register()` catches any failure, writes it to stderr synchronously, and calls `process.exit(1)`.
  - The data-root refusal prints its own message only.
  - Any other failure prints `The FluxIQ web panel could not start: <reason>`, then `Details:` and the stack.
- Why: `next start` (Next 15.5.24) logs "Failed to prepare server" and keeps listening after a failed `register()`. This was observed live in round 1.
- Tests (`apps/web/src/tests/instrumentation.test.ts`, 5 cases): exit on the refusal; exit on any other failure, with its message and details; exit on a non-Error throw; nothing happens on edge; one start on node.

### 2. Heartbeat lease (`packages/fluxiq/src/server/data-root-owner/`)

- **`owner/heartbeat.ts` (`ownerHeartbeat`):**
  - `renew(file, owner)` touches the mtime while the file still carries the holder's token.
    - If the file is missing, it writes the record again with an atomic create, so it cannot overwrite a newer claim.
    - It reports `lost` when another token is in the file, and `gone` when the root directory is deleted.
  - `observe(file, waitMs)` compares the file before and after the wait and reports `renewing`, `stale` or `changed`. Only an mtime change is compared, never its value, so clock skew between hosts is irrelevant.
- **`renewal.ts`:**
  - `FLUXIQ_DATA_ROOT_LEASE`: renew every 5 s; a claim is stale after 20 s.
  - `renewFluxIQDataRootClaim` runs an unref'd interval that never overlaps itself.
  - On `lost`, the default `onLost` writes "FluxIQ stopped <role>: another process has taken over…" and exits 1. This is the fencing for a holder frozen past the window.
  - On `gone`, it stops renewing with a note on stderr.
  - A failed renewal is logged and retried on the next tick.
- **`claim.ts` settles an existing owner:**
  - On the same machine, by pid and start time: refused while the process is live, reclaimed at once when it is dead.
  - Anything else (`foreign`, `unverified`, unreadable file): watch the heartbeat. Refused as `renewing` if the file was touched, reclaimed if stale, retried if it changed.
  - A reclaim guard left by a claimant that died is removed once it is checkably dead, or once it has sat unchanged for the stale window.
  - New options: `onWaiting`, used by `fluxiq dev` and offline accounts to say "Checking whether … is still running (up to 20 seconds)…"; `onLost`; `lease`, for tests only.
- **`held-error.ts`:** holder kinds are now `live`, `renewing` and `contended`. The "delete the file" advice is gone, because no state needs a person to delete it any more.
- **`owner/file.ts`:** `removeIf(file, matches)` generalises `removeIfToken`, so an unreadable abandoned record can be removed too.
- **`owner/liveness.ts`:** doc updated. **`platform/provisioning/cli/claim-offline-data-root.ts`:** the waiting notice is added and the delete line is removed. **`server/cli/run-dev.ts`:** prints the waiting notice.
- **Tests** (`server/data-root-owner/tests/claim.test.ts`, 16 cases). New cases:
  - crash-then-recreate: a real holder process claiming as `container-a1` with no machine id is killed, and a claimant as `container-b2` with no machine id reclaims after watching;
  - a renewing real holder in another container still refuses;
  - an unreadable file is reclaimed once nobody renews it;
  - a running holder with no start time is settled by its heartbeat (refused while renewed, reclaimed after);
  - the holder renews its own claim;
  - a holder whose root was taken over gets `onLost`;
  - a missing file is re-created, and a deleted root stops renewal quietly;
  - a foreign dead guard is passed.

### 3. `change_feed` retention (`framework/persistence/automation/project/change-feed-retention/`)

- **`migration.ts`:** `0039_change_feed_retention` adds the `change_feed_retention` table: a single row holding `pruned_through_sequence` and `pruned_at_ms`. The migration is appended to `AUTOMATION_STUDIO_PROJECT_ADMINISTRATION_MIGRATIONS`. The id `0038` is taken.
- **`policy.ts`:** the readers are polling clients that catch up after being away.
  - Keep 7 days of rows, and always keep the newest 1,000.
  - Prune at most hourly per project database, from writes only, so an idle project costs nothing.
- **`prune.ts`** `pruneAutomationStudioChangeFeed(sql, …)`:
  - Deletes rows older than the window, but never the newest `keepRows`.
  - Raises the watermark monotonically.
  - Returns `not_due` when it ran recently.
- **`position.ts`** `automationStudioChangeFeedPosition(sql, after)` returns `{ resync, prunedThrough, head }`. `head` comes from `sqlite_sequence`, so it survives deletion.
- **Writers:**
  - `unit-of-work.ts` prunes inside the mutation's own transaction.
  - `administration.ts` `append` prunes after the refusal checks, so a refused append changes nothing, and before its insert. On the whole-capability path this happens inside its transaction.
- **Readers:**
  - `AutomationStudioChangeFeedRepository.position()`.
  - `flows/store.ts` `listProjectChangeFeed` returns `{ events: [], cursor: head, hasMore: false, fallback: false, resync: true }` for a cursor below the watermark.
  - The contract `AutomationStudioProjectChangeFeedPage` gains the required `resync: boolean`.
  - `hierarchy/feed.ts` `listUpdatesAfter` gains `resync` too.
  - The panel's `project-sync.ts` takes `resync?` on the page and a new `onResync` callback, then follows the feed from the returned cursor.
- **`migration-cutover.ts`:** the hybrid-read "performed a write" check now compares the last sequence written (`sqlite_sequence`) instead of the row count. Otherwise pruning would look like a write.
- **Tests:**
  - `change-feed-retention/tests/prune.test.ts` (5 cases): window plus newest rows plus watermark, and not-due; resync for a cursor behind the watermark and paging for a current one; hierarchy resync; append and unit-of-work both prune; the hybrid read stays read-only.
  - `service-flows/tests/change-feed.test.ts`: a service-level resync case through `listProjectChangeFeed`.
  - `project-sync.test.ts`: the client calls `onResync` once and follows from the given cursor.

### 4. Docs

- **`docs/operations/self-hosting.md`:** new "One Server Per Data Volume" section. It covers the claim, the refusal message, panel startup failure, crash and recreate reclaim (same host at once; other host or container after 20 s unrenewed), the frozen-holder message, and offline accounts (the refusal text, and on self-hosted, stop then use `docker compose run --rm`). The provisioning CLI paragraph now points to it.
- **`docs/architecture/runtime-ownership.md`:** new "One serving process per data root" section. It covers who claims, the owner file, the heartbeat, how an owner is settled, the reclaim guard, fencing, refusals and the assumptions.
- **`docs/fluxnodes/README.md`:** the reclaim sentence now covers the renewal.

### Outside the items (to leave nothing known open)

- **`apps/web/src/lib/workspaces/tests/web-workspaces.test.ts`:** 7 tests failed on dev before my change. Commit `f9a1ae37c` (first-run setup link) added `prepareLocalFirstRun` to `lib/fluxiq.ts` without adding it to this test's `vi.mock` of `server/owner-claim`. I added a typed no-op to the mock (test only).
- **`pnpm install --frozen-lockfile` in the t931 Core worktree** (gated): the merged `stripe` dependency was not installed there, so the web check failed with TS2307. No tracked file changed.

## Commands run and observed results

All heavy steps went through `heavy-slot.mjs`. The logs are `t931-chain2.log` and `t931-live.log` in the scratchpad.

- `node scripts/structure-audit.mjs` (Core) -> `passed (553 warning(s), 911 baselined)`, after the final edits.
- `node scripts/structure-audit.mjs` (extension) -> `passed (253 warning(s), 551 baselined)`.
- Gated `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/ui-components build` -> exit 0.
- Gated `pnpm --filter fluxiq check` -> exit 0.
- Gated `pnpm install --frozen-lockfile` -> exit 0.
- Gated `pnpm --filter @fluxiq/web check` -> exit 0, and exit 0 again on the final re-run after the test-mock edit.
- Gated `pnpm exec vitest run src/server/data-root-owner src/server/cli src/platform/provisioning/cli src/framework/persistence/automation/project src/framework/automation-service/tests/service-flows/tests/change-feed.test.ts` -> **93 files passed, 2 skipped; 666 tests passed, 4 skipped.**
- Gated web vitest over instrumentation, the sync directory, `lib/tests/fluxiq.test.ts`, `existing-workspace-composition` and `web-workspaces` -> 65 passed and 7 failed, all from the stale mock above. After the fix, `pnpm exec vitest run src/lib/workspaces/tests/web-workspaces.test.ts src/tests/instrumentation.test.ts src/features/automation-studio/sync` -> 3 files, 34 tests passed. The other two files had passed in the gated run.
- Gated `pnpm --filter @fluxiq/web build` -> exit 0.
- **Live** `t931-live.mjs` under `acquire t931 60` (panel on 3600/5377, `fluxiq dev` on 3601/5378, a scratch root, no model key) -> **13/13 passed**:
  - A: the panel claims the root.
  - B: `fluxiq dev` is refused with exit 1 and no stack trace.
  - A2: storage is v2 beside the owner file.
  - C: offline accounts is refused and does not open the data.
  - D: a panel killed with `taskkill /F` leaves its file.
  - E: `fluxiq dev` reclaims the root.
  - F: a panel started while dev holds the root exits 1, and nothing listens on 3600.
  - G: a graceful stop removes the file.
  - **H: crash then recreate.** A stale claim written by host `container-a1` with no machine id, and never renewed. `fluxiq dev` printed "Checking whether the web panel (process 1 on container-a1) is still running (up to 20 seconds)…", then took the root and served, 27 s after starting.
  - **I:** the same foreign claim, touched every second, means `fluxiq dev` exits 1 with "It kept renewing its claim while this process watched…".
  - **J:** a panel with `FLUXIQ_CLIENT_GATEWAY_PORT=99999` exits 1 with "The FluxIQ web panel could not start: FLUXIQ_CLIENT_GATEWAY_PORT must be at most 65535." and nothing listens on 3600.
- Afterwards no t931 processes, scratch root or slot remained.

## Not verified

- Docker was not used. The crash-then-recreate case was proven with real processes claiming as container identities (unit level) and with a live `fluxiq dev` against a foreign stale claim (H).
- Linux and macOS start-time paths and `utimes` on network filesystems: only Windows ran.
- `next dev`, and a panel with a host module.
- The panel's `onResync` has no production caller yet: `AutomationStudioProjectSyncClient` is not constructed in the web app. Today the contract and the endpoint carry `resync`.
- Full package suites were not run (narrow checks per repository policy).

## Open questions or contradictions found

- A holder whose event loop is blocked for more than 20 s, or that is suspended, can lose its claim to a claimant on another host. It then exits through fencing rather than serve beside the new holder. This is the deliberate lease trade-off and is documented. Same-machine claimants never use the window; they check the pid and start time.
- Retention numbers (7 days, newest 1,000 rows, hourly) are a judgement for polling clients. They are one constant in `policy.ts`.
- `process/machine.ts` still duplicates the machine-id read in `fluxnode/act-scope/execution-owner.ts`. Now that t911 has merged, that file could import it (not done; outside the items).

```text
Outcome: Done
Changed: Core apps/web/src/instrumentation.ts, apps/web/src/tests/instrumentation.test.ts, apps/web/src/features/automation-studio/sync/{project-sync.ts,tests/project-sync.test.ts}, apps/web/src/lib/workspaces/tests/web-workspaces.test.ts (stale mock), docs/{operations/self-hosting.md,architecture/runtime-ownership.md,fluxnodes/README.md}, packages/fluxiq/src/server/data-root-owner/{claim.ts,held-error.ts,index.ts,renewal.ts (new),owner/heartbeat.ts (new),owner/file.ts,owner/index.ts,owner/liveness.ts,tests/claim.test.ts}, server/cli/run-dev.ts, platform/provisioning/cli/claim-offline-data-root.ts, api-contracts/automation/change-feed.ts, framework/automation-service/service/flows/store.ts, framework/automation-service/tests/service-flows/tests/change-feed.test.ts, framework/persistence/automation/project/{change-feed-retention/** (new),administration.ts,unit-of-work.ts,hierarchy/feed.ts,migration-cutover.ts,index.ts}
Validation: gated libs build, fluxiq check, web check, web build -> exit 0; Core vitest (changed dirs) -> 666 passed, 4 skipped; web vitest -> 34/34 after the mock fix (65/72 before; 7 failures from the stale mock); structure audits both trees -> passed; live t931-live.mjs -> 13/13 passed
Not verified: Docker (unit-level and live foreign-claim proofs instead), Linux/macOS paths, next dev, a production caller for onResync
Report: C:/Users/osrs_/FluxStuff/fxwork/t931/!FluxIQWebExtension/docs/working/usable-client-plan/reports/serving-lease.md
Notes: The heartbeat replaced every "delete the file" state; a frozen holder that lost its claim exits (fencing).
I fixed web-workspaces.test.ts's stale owner-claim mock (broken on dev by f9a1ae37c) and installed the merged stripe dependency in the worktree.
```
