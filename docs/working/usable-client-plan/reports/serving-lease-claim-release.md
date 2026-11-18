# Serving lease: claim release and the web-workspaces timeouts (t931)

## Round 3 (lead chose option 1): no well-known admin login on any new install

### What changed and why

- **`apps/web/src/lib/fluxiq.ts`, `opened()`.** It now calls
  `identityAccess.firstRun.startUnclaimed()` for every instance on every profile. Before, it did
  so only under `local`.
  - A new install's identity store starts with no account. The owner is created by the claim:
    the printed setup link on `local`, the one-time setup code on `self-hosted` and `service`.
  - This covers tenant instances too. `opened()` runs for every workspace, and under `service`
    each tenant store had been seeding its own `admin`/`admin` as well. The service case of the
    composition test now checks that a tenant starts "unclaimed".
- **`apps/web/src/server/owner-claim/**`: no product change was needed.**
  - On `self-hosted` and `service`, `prepareOwnerClaim` and `isOwnerClaimOpen` key on the claim
    marker, never on Identity Access's first-run state. An empty store therefore already gets the
    setup code, and `/setup` stays open until the marker is written.
  - `claimOwner` creates the owner through provisioning. `retireDefaultAdmin` already answers
    `"absent"` when there is no default admin.
  - `retire-default-admin.ts` is unchanged. A root made before this change that still holds
    `admin`/`admin` has it deleted on claim, or disabled if its password was changed.
- **Identity Access and `temporary-admin.ts`: unchanged.** "Unclaimed" mode already exists and is
  what `local` used: `seed()` returns false and the store stays empty. No password handling was
  added or changed.
- **Tests:**
  - `owner-claim/tests/owner-claim-instance.ts` takes `start: "fresh" | "old-root"`. "fresh"
    starts the store unclaimed before setup, as the web composes every instance. "old-root", the
    default, seeds `admin`/`admin` as a store made before this change does.
  - `owner-claim/tests/claim-owner.test.ts`, new describe "claimOwner on a fresh root", one case
    each for self-hosted and service. Each checks:
    - the store is "unclaimed" with no users, and `admin`/`admin` cannot sign in;
    - `prepareOwnerClaim` issues a 40-hex setup code and `isOwnerClaimOpen` is true;
    - the claim returns `defaultAdmin: "absent"`, the owner is the only account and can sign in,
      and `admin`/`admin` still cannot;
    - the marker is written, the claim closes, and a second claim gets `already_claimed`.
  - The existing claim tests are now labelled "on a root made before, whose store still holds the
    default admin/admin", and `service-bootstrap.test.ts` asks for `start: "old-root"`
    explicitly. They prove an old root's `admin`/`admin` is retired on claim.
  - `lib/tests/fluxiq.test.ts`: the local-only test now runs for local, self-hosted and service.
    A new install starts unclaimed with no users and `admin`/`admin` refused; under service, a
    tenant also starts unclaimed. An install made before still reports "temporary-admin", left
    for the claim to retire.
- **Docs I did not edit (not in my paths), each needing a sentence:**
  - `docs/operations/self-hosting.md` line 201, "retires the default admin login". Suggested: a
    new install has no login until the owner is claimed, and an install made before this change
    keeps its `admin`/`admin` until setup retires it.
  - `docs/operations/data-and-state.md` line 408, "The first default admin user is created with
    username `admin`…". This is still true for a bare `FluxIQ` instance. The web panel now starts
    every store unclaimed.
- **Not this round, as instructed: the connection pool.** Measured in round 2: each
  `createAccount` opens, prepares, closes and checkpoints `global.sqlite` 22–26 times, about
  270–330 ms of SQLite per account, because the platform store and IAM repositories are built
  without a pool.

### Commands run and observed results (round 3)

- `cd apps/web && npx vitest run src/server/owner-claim src/app/api/auth src/app/setup src/lib/tests/fluxiq.test.ts`:
  `Test Files 13 passed (13)`, `Tests 99 passed (99)`, exit 0. Fresh-root claims passed for
  self-hosted and service. The composition test took 3548 ms (local), 2876 ms (self-hosted) and
  2825 ms (service).
- Acceptance, all through the machine gate in one slot, back to back:
  - `cd apps/web && npx vitest run src/lib/workspaces src/tests/instrumentation.test.ts src/features/automation-studio/sync`, three runs:

    | Run | Files | Tests | Slowest test on vitest's default 5 s timeout | tenant-eviction | "no longer renewed" lines |
    | --- | --- | --- | --- | --- | --- |
    | 1 | 26 passed | 268 passed, exit 0 | 3645 ms, "selects among existing workspaces…" ("provisions service accounts" 3008 ms) | 10822 ms | 0 |
    | 2 | 26 passed | 268 passed, exit 0 | 2233 ms, "provisions service accounts…" | 9436 ms | 0 |
    | 3 | 26 passed | 268 passed, exit 0 | 2444 ms, "provisions service accounts…" | 9901 ms | 0 |

    Collect phases were 745 s, 604 s and 543 s, so the machine stayed busy throughout.
    tenant-eviction is the only test above 5 s. It declares its own 180 s timeout and unlocks real
    keys at production scrypt cost by design. Same command and load pattern last round:
    "provisions service accounts" timed out at 5103 ms and 5269 ms.
  - Owner-claim and auth tests (`src/server/owner-claim src/app/api/auth`, run with `src/app/setup`
    and `src/lib/tests/fluxiq.test.ts`): 13 files, 99 tests passed (above).
  - `pnpm --filter fluxiq check`: exit 0 (cache reuse; the source has not changed since round 2's
    passing check).
  - `pnpm --filter @fluxiq/web check`: exit 0 (tsc rebuilt).
  - `node scripts/structure-audit.mjs` in Core: `structure-audit: passed (553 warning(s), 911 baselined).`
  - `node scripts/structure-audit.mjs` in the extension worktree: `structure-audit: passed (253 warning(s), 551 baselined).`

### Not verified (round 3)

- No real Next server was started on self-hosted or service: no `/setup` page render, no
  setup-code form submission through the browser. The claim was exercised through `claimOwner`
  and the existing `submitOwnerClaim` route tests, which use old roots.
- No real installation from before this change was upgraded. The old-root case is a store that
  seeds `admin`/`admin` on first load, as Identity Access does without `startUnclaimed`.

## Round 2 (lead's follow-up): the dead claim, and where the slow test's seconds go

### Outcome

- **Item 1, the dead claim: done.** When renewal ends by itself, the claim drops out of the
  process registry. "By itself" means the root was deleted or another process took it. A later
  claim on a root re-created at the same path then gets a fresh claim.
- **Item 2, the slow test: cause found, nothing edited.** The cost is in Core Identity Access
  first-run and the owner-claim design. That is outside t931's scope and security-sensitive, so
  I stopped as instructed. Options are below.

### Item 1: what changed

- `renewal.ts`: a new `onEnded` callback. Renewal calls it once when it stops by itself, with
  outcome "gone" or "lost".
- `claim.ts`: `held()` passes `onEnded: () => processClaims.forget(file, token)`.
- `process-claims.ts`: new `processClaims.forget(file, token)`. It deletes the registry entry only
  while that entry still holds this token.
  - Holders of the ended claim keep their handles. Their `release()` then does nothing, because the
    entry is no longer theirs.
  - A newer claim is left alone.
- `tests/claim.test.ts`, new test "claims a root made again at a deleted root's path afresh, not
  with the claim the deletion ended". It:
  1. claims a root, deletes it, and waits five renewals;
  2. re-creates the root and claims again;
  3. checks the new token differs from the old one and is the one in the owner file;
  4. checks the owner file's modification time advances (the new claim is live);
  5. releases the ended claim, which leaves the new claim's owner file in place;
  6. releases the new claim, which removes the file.

Validation:
- `npx vitest run src/server/data-root-owner`: `Tests 17 passed (17)`, new test 546 ms.
- Negative check, with `forget`'s body neutralised: the new test fails with
  `expected 'e1deff88-…' not to be 'e1deff88-…'` (the dead claim is handed back). The source was
  restored after that run, confirmed byte for byte with `cmp`.
- Final checks after this round, with the scratch test deleted:
  - `pnpm --filter fluxiq check`: exit 0 (tsc rebuilt, 23.8 s).
  - `cd packages/fluxiq && npx vitest run src/server/data-root-owner src/platform/provisioning/cli`:
    `Test Files 4 passed (4)`, `Tests 44 passed (44)`.
  - `node scripts/structure-audit.mjs`: `structure-audit: passed (553 warning(s), 911 baselined).`
  - The Core libraries were rebuilt with the fix:
    `node scripts/build-cache/cli.mjs contracts:build sdk:build fluxiq:build client-gateway-websocket:build ui-components:build`,
    exit 0.

### Item 2: where the seconds go in "provisions service accounts into separate personal workspaces"

Method:
- A temporary scratch test (`zz-t931-profile.test.ts`, deleted before hand-back) repeated the test
  with a timestamp after each phase, twice in one process.
- A `node:inspector` CPU profile covered the slow phase.
- A wrapper around the `sqlite3` driver timed every open, exec, run, get and close per file.
- The same wrapper logged every timer of 20 ms or more and every `crypto.scrypt` call, with the
  Core frames that started it.

Phases, all on dev's code (nothing in t931 is on this path):

| Phase | Run 1 (cold process) | Run 2 (warm process) |
| --- | --- | --- |
| `initializeFluxIQWebRuntime` | 1449 ms | 41 ms |
| `getPlatformServices` | 132 ms | 129 ms |
| first `createAccount` | 1632 ms | 1581 ms |
| second `createAccount` | 339 ms | 224 ms |
| per account: store writes, `createSession`, consent | about 300 ms | about 300–600 ms |
| `workspaceFluxIQ`, the tenant open | 12 ms and 9 ms | 10 ms and 8 ms |
| `closeFluxIQWebRuntime` | 19 ms | 15 ms |
| total | 4183 ms | 2815 ms |

Inside the first `createAccount` (1422–1478 ms):
- The CPU profile shows 1424 of 1593 ms idle: the process is waiting, not computing.
- SQLite is only 365–413 ms of it, across 154 calls.
- The rest is two scrypt derivations at production cost (N=2^17), each 488–529 ms, run one after
  the other, both from Identity Access's first load of the primary's empty store:
  - `seedTemporaryAdmin` → `setCredentialHash` → `hashPassword`;
  - `seedTemporaryAdmin` → `setCredentialHash` → `createCredentialKey` (`credential-seal.ts`).
- The second `createAccount` has neither: 286–345 ms wall, almost all SQLite.
- A 1000 ms `BufferedIamAuditSink` flush timer is armed on the same path, but nothing awaits it.

Why: under the `service` and `self-hosted` profiles the web leaves the primary's identity store in
"temporary-admin" mode. Only `local` calls `firstRun.startUnclaimed()` (`lib/fluxiq.ts`,
`opened()`). So the first identity load on every new primary seeds `admin`/`admin` and hashes the
publicly known password "admin" at full cost.
- Every service and self-hosted test in this file pays about 1 s for this. That is why those tests
  take 1.4–2.6 s alone while local-profile tests take 0.3–0.7 s.
- A real deployment pays it once per new data root.
- `readFirstRunState` pays one more full derivation each time it proves the temporary password.

The owner claim depends on this account:
- `apps/web/src/server/owner-claim/retire-default-admin.ts` and `claim-owner.ts` retire
  `admin`/`admin` when the owner is claimed ("Owner claim replaces admin/admin").
- `programs/identity-access/runtime/first-run/temporary-admin.ts` itself says a host that serves
  people should start unclaimed.
- No option reaches Identity Access to change its KDF cost: `testOnlyWeakParameters` exists in
  `password-kdf` but is not wired into `IdentityAccessService` or `FluxIQOptions`.

Options, each a product decision outside t931:
1. **(Recommended) Start the primary unclaimed under `self-hosted` and `service`, as `local`
   already does.**
   - Code: a one-line change in `opened()`, plus making `prepareOwnerClaim`/`isOwnerClaimOpen`
     treat "unclaimed" like "temporary-admin" (`retireDefaultAdmin` already handles "absent").
   - Cost: removes the 1 s from every service and self-hosted primary.
   - Security: no well-known admin account exists on a served host before its owner is claimed.
     This is a security improvement, but it touches the owner-claim flow and its tests.
2. **Stop deriving a key for the public temporary password.**
   - Code: Identity Access marks the seeded admin as "on the temporary password" and checks
     `"admin"` with a constant-time comparison until it is changed, instead of scrypt-hashing and
     sealing a string everyone knows.
   - Cost: removes the 1 s, plus a derivation per first-run state check.
   - Security: this is a change to credential handling in Core Identity Access.
3. **Inject a test-appropriate KDF cost.**
   - Code: wire `testOnlyWeakParameters` through `FluxIQOptions` into Identity Access, set by the
     web composition from configuration.
   - Cost: only the tests get faster; real users keep paying for hashing a public password.
   - I would not choose this, since the cost is not deliberate strength.

Secondary costs (measured, not the dominant one):
- **The platform store and IAM repositories have no connection pool.** Each `createAccount` opens,
  prepares, closes and checkpoints `global.sqlite` 22–26 times: about 270–330 ms of SQLite per
  account. Running each provisioning operation inside a `SQLiteConnectionPool.keepWhile`, the
  pattern program state already uses, would cut most of it.
  - Where: Core `platform/provisioning` composition, or `apps/web/src/server/provisioning-listener/platform-services.ts`.
  - Not in my owned paths, so not changed.
- **The one-time process identity read (PowerShell start time) is about 1 s.** It lands in the
  first test that starts a web runtime, as reported in round 1.

Not done, as instructed: the three back-to-back directory runs. The fix that would make them pass
is the decision above, so I have not run them.

Worker report. Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t931/!FluxIQ`, branch
`task/t931-serving-lease`. Nothing committed.

## Outcome

Partial. The defect t931 did introduce is fixed: the web runtime's data-root claim outlived
`closeFluxIQWebRuntime`, so every closed runtime left a heartbeat running until its root was
deleted. That is where the "no longer exists; its claim is no longer renewed" lines came from. The
5000 ms timeouts are not t931's. They depend on machine load and remain. The acceptance web command
failed twice (1 test, then 4), and one directory run with the fix passed all 256 tests. Which tests
time out follows the load: they include the "self-hosted" test, which has no tenants. In the same conditions, dev runs the same
two tests no faster than t931.

## Cause

`initializeFluxIQWebRuntime` called `claimFluxIQDataRoot` on every start and dropped the claim.
Nothing released it: not `closeFluxIQWebRuntime`, not a failed start. So each test's runtime left
its owner file and its 5 s renewal timer behind. The timer printed the line once `rmSync` had
deleted the root.

The two tests time out because they already take 2.4 to 2.6 s alone and 3.6 to 4.2 s on dev when the
whole `src/lib/workspaces` directory runs in parallel on this shared machine. That leaves under a
second against vitest's 5 s default. A busier moment pushes them over, and the EBUSY is fallout: the
timed-out test body keeps writing SQLite while `afterEach` deletes its root. In one run the timed-out
test also ran into the next test ("Unknown or disabled user").

## What changed and why

- `apps/web/src/lib/workspaces/data-root-hold.ts` (new): `webDataRootHold`, the web runtime's one
  claim per root, on `globalThis` because Next bundles instrumentation and the routes separately.
  - `take(root)` claims once and shares the claim on later starts and reloads. A refused claim is
    forgotten, so a later start tries again.
  - `release(root)` gives it back. Exported from the `workspaces` barrel.
- `apps/web/src/lib/fluxiq.ts`: outside my owned paths, edited because the claim call t931 added
  is here and the runtime's close lives here. Two changes:
  - The claim moved inside the shared preparation, so a shutdown that awaits the preparation always
    finds the hold. A preparation that fails before any runtime exists gives the root back with the
    failure, as `run-dev` does when `openHostInstance` fails.
  - `closeFluxIQWebRuntime` releases the hold at the end of its close, once `workspaces.close()` and
    `closePlatformServices()` both succeeded: synchronously with the close, before it resolves. A
    close that failed keeps the root held until the process exits, so no other server opens storage
    this one may still have open. The exit hook then gives it up. This is `run-dev`'s rule.
- `apps/web/src/lib/workspaces/tests/web-workspaces.test.ts`:
  - New test: the owner file's token stays the same across a reload, the file is gone once
    `closeFluxIQWebRuntime` returns, and a second runtime on the same root in the same process
    claims at once and gives the root back the same way.
  - The close-failure test now asserts the owner file is still held after the failed close. The test
    then gives the root back itself after it really closes the primary.
- Not changed: anything under `packages/fluxiq/src/server/data-root-owner/**`, `run-*.ts` or
  `instrumentation*`. `run-dev` already releases after the instance closes. t931's guarantees still
  hold, since the claim, refusal, fencing and reclaim code are untouched; their Core tests pass
  below.

## Commands run and observed results

All heavy commands ran through `heavy-slot.mjs`, one at a time.

Reproduction on t931 before the fix, file alone (`npx vitest run src/lib/workspaces/tests/web-workspaces.test.ts`):
22 passed. "provisions service accounts" 3485 ms, "selects the oldest" 2447 ms. 12 "no longer
renewed" lines.

Interleaved comparison, t931 with the fix against dev (shared Core at `7431351c`, t931's merge
base), run back to back in one slot:

| Run | provisions service accounts | selects the oldest | tenant-eviction (evict test) | Result |
| --- | --- | --- | --- | --- |
| t931, file alone | 2633 ms | 2085 ms | n/a | 23 passed, 0 "no longer" lines |
| dev, file alone | 2639 ms | 1790 ms | n/a | 7 failed (local-profile tests, no `prepareLocalFirstRun` mock), 15 passed |
| t931, `src/lib/workspaces` | 3799 ms | 2774 ms | 10174 ms | 24 files, 256 tests passed, exit 0, 0 "no longer" lines |
| dev, `src/lib/workspaces` | 4150 ms | 3622 ms | 10254 ms | 7 failed (same local-profile tests), 248 passed |

The only test slower on t931 is the file's first, at 1547 ms against 809 ms. It pays the one-time
process identity read. Measured directly against the built dist with a scratch script: identity
996 ms once per process, then claim 17 to 139 ms and release 8 to 38 ms per root.

Other runs on t931 with the fix, under heavier machine load:
- `npx vitest run src/lib/workspaces`: 3 failed. Both named tests timed out (5047 ms, 5185 ms) with
  EBUSY, and the next test failed with "Unknown or disabled user". tenant-eviction took 15219 ms.
  No "no longer" lines.

Acceptance:
- `cd packages/fluxiq && npx vitest run src/server/data-root-owner src/platform/provisioning/cli`:
  `Test Files 4 passed (4)`, `Tests 43 passed (43)`, exit 0.
- `node scripts/build-cache/cli.mjs contracts:build sdk:build fluxiq:build client-gateway-websocket:build ui-components:build`:
  every step "reuse" (inputs and outputs match the stamp), exit 0.
- `cd apps/web && npx vitest run src/lib/workspaces src/tests/instrumentation.test.ts src/features/automation-studio/sync`,
  first run: `Test Files 1 failed | 25 passed (26)`, `Tests 1 failed | 267 passed (268)`, exit 1.
  "provisions service accounts" timed out at 5103 ms with EBUSY. "selects the oldest" took
  4153 ms, tenant-eviction 13868 ms. 0 "no longer renewed" lines.
- Re-run of the same command, under heavier load (tenant-eviction 18892 ms, against 10174 ms in the
  calm comparison run, and that test calls no claim code): 4 failed. Three timed out:
  - "keeps selected status" (the file's first test, which pays the one-time ~1 s identity read):
    6208 ms
  - "provisions service accounts": 5269 ms, with EBUSY
  - "self-hosted holds exactly one workspace": 5152 ms, with EBUSY

  "names the primary workspace" failed at 605 ms after them. "selects the oldest" took 3702 ms.
  0 "no longer renewed" lines.
- `pnpm --filter fluxiq check`: exit 0 (build-cache reuse).
- `pnpm --filter @fluxiq/web check`: exit 0 (tsc, 32.6 s). After the formatting fix below: exit 0 (tsc, 44.1 s).
- `node scripts/structure-audit.mjs`: the first run failed on one statement-packing line I wrote
  (`fluxiq.ts:276`). Unpacked, then: `structure-audit: passed (553 warning(s), 911 baselined).`,
  exit 0.

## Not verified

- Nothing ran in a real Next server: no `next start` with a held root, and no SIGTERM shutdown
  releasing the owner file. The release path was exercised only through `closeFluxIQWebRuntime` in
  vitest.
- I did not see dev time out. Dev's two tests came within 0.85 to 1.4 s of the limit in the
  comparison run, but load could not be made identical, so "dev times out under the lead's load" is
  inferred from those margins, not observed.
- Dev's directory run also has 7 local-profile failures of its own (t931's test fix is not on dev),
  so dev's per-file load was slightly lower than t931's.

## Open questions or contradictions found

- The brief's premise, that t931's claim makes the two tests hang, does not hold. The claim leak was
  real but cost almost nothing per test. The timeouts come from these service-profile tests sitting
  close to vitest's 5 s default on dev under parallel load. Making them pass reliably means finding
  why one test spends 2.4 s provisioning two accounts and opening tenant instances (dev code,
  outside this brief), or running the directory with less parallelism. Raising the timeout is
  excluded by the rules.
- Core, not fixed (outside this failure): when renewal finds the root gone it stops, but the
  `processClaims` entry stays registered with its holders. A later claim in that process on a root
  re-created at the same path would be handed the dead claim, with no owner file and no heartbeat.
  The entry could be dropped when renewal reports "gone".
- One small cost that is t931's: the first claim in a process reads its own start time by spawning
  PowerShell (`process/start-time.ts`), about 1 s on this machine and more under load. That lands
  in the first web test of the file. It has to come from the same source another process will
  compare against, so a cheaper in-process value would break the equality check. It is once per
  process and stays as is.
- The EBUSY after a timeout comes from the test file's `afterEach` deleting the root while the
  timed-out body still runs. It exists on dev too and is not a t931 defect.
