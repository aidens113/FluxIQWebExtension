# sqlite-leak (t928 fix round, key-backend)

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t928/!FluxIQ` (branch `task/t928-key-backend`). Nothing committed.

## Outcome

Done. Both named tests pass, and every acceptance check passes. One limit is stated
under "Not verified": `FluxIQ.close()` (framework/index.ts, outside my ownership) waits
for nothing the runtime owns. So a ledger write that is already running when a close
begins still finishes on its own after the close. Nothing of the ledger starts after
close, and an instance that never reads or records model access never opens the
ledger's store at all.

## Cause, with evidence

`AutomationStudioModelAccessLedger` (runtime/models/secrets/model-access/ledger.ts)
started reading its persisted entries in its constructor (`this.loading = this.load()`).
`createGlobalProgramRuntime` builds it with `modelAccessLedgerStore(paths.data)`. In a
v2 layout `paths.data` is the `.fluxiq` root, so that store is the
`secret-keys/model-access-ledger` document in the `program.state` table of the
instance's `global.sqlite`. Nothing waited for that read: not `detach`, not
`FluxIQ.close()`. Each of the two tests creates a runtime and closes it within a few
hundred milliseconds. The read was still running, with its connection open outside any
kept pool, when the test removed the root, which gives EBUSY on Windows.

The evidence comes from a temporary diagnostic test, since deleted. It replaced
`sqlite3.Database` with a subclass that recorded when each handle was opened and the SQL
it ran. It ran on the unfixed build and replayed the cold-tenant test:

```text
STILL OPEN (opened during test) \\?\C:\...\fluxiq-diag-leak-laoKUq\.fluxiq\global.sqlite
STILL OPEN (opened during test) \\?\C:\...\fluxiq-diag-leak-laoKUq\workspaces\existing-tenant\.fluxiq\global.sqlite
LEAKED HANDLE ...\.fluxiq\global.sqlite ran:
[test] pragma foreign_keys = ON; pragma journal_mode = WAL; create table if not exists "program.state" (...
[after-close] select id, kind, data, ... from "program.state" where id = ? ["secret-keys/model-access-ledger"]
LEAKED HANDLE ...\workspaces\existing-tenant\.fluxiq\global.sqlite ran:
[after-close] pragma foreign_keys = ON; pragma journal_mode = WAL; create table if not exists "program.state" (...
[after-close] select id, kind, data, ... from "program.state" where id = ? ["secret-keys/model-access-ledger"]
```

Exactly two handles were open at cleanup: the restarted primary's and the cold tenant's.
Both read only the ledger's document, and their SQL ran after the runtime closed.

I checked the other suspects and ruled them out:

- The model-keys notice holds no store.
- The push installer's `identity().then(watch)` returns the identity object and opens
  nothing, and `watch` is guarded by `stopped`.
- The ledger's fire-and-forget write is a second case of the same defect, and is fixed
  with it.

## What changed and why

- `packages/fluxiq/src/runtime/models/secrets/model-access/ledger.ts`
  - No I/O at construction. The store is read once: at the first `whenLoaded()` (a
    model-access read) or at the first noted change. On a noted change the stored entries
    are merged in before the write, so a newer in-memory outcome still wins over a stored
    one, as before.
  - Every read and write of the store is tracked in `running`.
  - New `close(): Promise<void>`. After it, no read or write starts: a write waiting
    behind a read is dropped when its turn comes, and `whenLoaded` resolves without
    reading. The promise settles, never rejecting, once the reads and writes already
    running have. Outcomes noted after close are still read from memory.
  - A failed write is no longer dropped silently. It still leaves the in-memory reading
    as before, and now logs only its error's kind:
    `The model-access ledger could not keep a key's last outcome (<name>).` The waiting
    tail uses `then(() => undefined, () => undefined)`, which is the form the audit's
    `failure-as-empty` rule prescribes for a tail that only waits.
  - The persistence doc now says when `read` and `write` are called.
- `packages/fluxiq/src/programs/_shared/runtime.ts`: `detach`, the first thing
  `FluxIQ.close()` runs, now calls `void modelAccessLedger.close()`. The `detach` doc and
  the ledger's construction comment say so.
- Tests:
  - New `packages/fluxiq/src/programs/_shared/model-access/tests/ledger-store.test.ts`
    (real-sql). It creates and closes a real `FluxIQ` on a set-up v2 root and traces every
    SQLite handle. It asserts that no handle under the root is open when `close()` returns
    and that no SQL runs after it.
    - Before the fix it failed with exactly the bug:
      `expected [ Array(1) ] to deeply equal []`, receiving the instance's
      `...\fluxiq-model-access-close-14oQ4n\.fluxiq\global.sqlite`.
    - That failing run used the same assertions at the test's first location,
      `programs/_shared/tests/runtime-model-access-close.test.ts`. The audit then refused
      that location: the directory had 26 files against a limit of 25, and four lines held
      more than one statement. So I moved the test beside the ledger store it tests and put
      one statement per line, with the assertions unchanged. I did not revert the fix to
      re-prove the failure at the new path.
    - After the fix it passes.
  - `packages/fluxiq/src/runtime/models/secrets/model-access/tests/ledger.test.ts` has two
    new cases:
    - nothing is read until model access is asked for or an outcome is noted, and a note
      merges the stored entries before writing;
    - after close no read or write starts, a waiting write is dropped, and `close` settles
      only once the running write or read has.
- No web test file was added. The two named web tests prove the fix at the web level, and
  the temporary diagnostic under `apps/web/src/lib/workspaces/tests/` was deleted.

## Commands run and observed results

All heavy steps ran one at a time through `heavy-slot.mjs run sqlite-leak`.

- Build, before the fix:
  `node scripts/build-cache/cli.mjs contracts:build sdk:build fluxiq:build client-gateway-websocket:build ui-components:build`
  -> exit 0.
- Reproduction, before the fix, in apps/web:
  `npx vitest run src/lib/workspaces/tests/existing-workspace-composition.test.ts src/lib/workspaces/tests/web-workspaces.test.ts`
  -> 9 failed, 15 passed. These were the two named tests with
  `EBUSY ... unlink '...\.fluxiq\global.sqlite'`, plus the seven `prepareLocalFirstRun`
  mock failures.
- New regression test before the fix (at its first path) -> 1 failed, with the handle
  quoted above.
- First pass after the fix: Core vitest passed (86 files, 647 tests) and the web run
  matched the final one below. Two checks failed, all on my changes, and I fixed each as
  described above:
  - `pnpm --filter fluxiq check`: TS2322 on the new test's `sqlite3.Database` swap.
  - The structure audit: 3 rules (directory-files on `programs/_shared/tests/`,
    failure-as-empty on the ledger's `track`, statement-packing in the new test).

Final results:

- packages/fluxiq:
  `npx vitest run src/programs/_shared src/programs/secret-keys src/runtime/models/secrets`
  -> `Test Files 86 passed (86)`, `Tests 647 passed (647)`. This includes
  `ledger.test.ts (6 tests)` and `model-access/tests/ledger-store.test.ts (1 test)`.
- `pnpm --filter fluxiq check` -> exit 0.
- `node scripts/structure-audit.mjs` -> exit 0,
  `structure-audit: passed (554 warning(s), 911 baselined).`
- Rebuild with the same build-cache command -> exit 0 (`fluxiq:build` rebuilt).
- apps/web: `npx vitest run src/lib/workspaces`
  -> `Test Files 1 failed | 23 passed (24)`, `Tests 7 failed | 248 passed (255)`.
  - All seven failures are
    `No "prepareLocalFirstRun" export is defined on the "../../../server/owner-claim" mock`.
    They are the profile undefined and "local", null session, FLUXIQ_WORKSPACE_ID, domain
    probe, concurrent reloads and resource-close cases.
  - Both named tests pass: `existing-workspace-composition.test.ts (2 tests)` passed, and
    `keeps selected status and pending context writes tied to each exact tenant runtime`
    passed.
  - There is no EBUSY anywhere in the run.

## Not verified

- `FluxIQ.close()` does not wait for a ledger read or write that is already running when
  the close begins. `GlobalProgramRuntime.detach()` is synchronous, and `FluxIQ.close()`
  (framework/index.ts, not mine) awaits no runtime-owned work.
  - Since the fix, the ledger only does I/O inside a model-access read, where the request
    already awaits it, or right after an outcome is noted (the end of a chat call, or a
    key's free check). So the gap is a write in flight at the instant of close.
  - Closing it fully needs two changes outside my ownership. Add a runtime member such as
    `settled: () => modelAccessLedger.close()` to `GlobalProgramRuntime`. Then, in
    `FluxIQ.close()`, before `programStateConnections.close(...)`, add
    `try { await this.programs.settled(); } catch (error) { errors.push(error); }`.
  - I did not add a member that nothing calls.
- No live browser or panel run. `web:check` was not run: it is not in the acceptance
  list, and apps/web was not edited.

## Open questions or contradictions found

- Does the supervisor want the framework change above (a runtime member plus one line in
  `FluxIQ.close()`) in this task?
- Other program services may have the same pattern: async store work that the host starts
  and no close waits for. I did not investigate this; it is outside this brief.
