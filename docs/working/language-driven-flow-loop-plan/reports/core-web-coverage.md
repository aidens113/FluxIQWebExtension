# Core `apps/web` quality coverage — making `pnpm quality:coverage` pass

Worker report. Repository: `F:\!FluxIQ`, branch `dev`, tip `08656d9`. Nothing
committed.

## Outcome

Done. `pnpm quality:coverage` exits 0. The `apps/web` half went from
87.56% statements / 80.48% branches (thresholds 90 / 85) to **99% statements,
96.61% branches, 100% functions, 99% lines**. No threshold was lowered, no
coverage exclude was added, and no existing test was deleted or skipped.

One file changed: `F:\!FluxIQ\apps\web\src\lib\tests\login-attempts.test.ts`,
27 tests added (7 → 34).

## What changed and why

### The uncovered code was one file, not the three the brief expected

The brief pointed at route handlers, `src/lib` helpers and the
automation-studio model. In fact `apps/web/vitest.quality.config.ts` measures
coverage over exactly two files:

```
coverage: { include: ["src/lib/login-attempts.ts", "src/lib/program-route.ts"] }
```

`program-route.ts` was already 100/100/100/100. Every missing statement and
branch was in `src/lib/login-attempts.ts` — 86.55% statements, 76.47% branches,
uncovered lines `69, 90-93, 127-131, 133-134, 142-143, 150-151, 169-173,
177-180`. Route handlers and the studio model are not in the coverage
`include` at all, so testing them could not have moved the number.

`src/lib/login-attempts.ts` is the login brute-force limiter: an in-memory
tracker, a file-backed tracker shared across processes behind a lock file, and
the client-address derivation that decides which bucket a login attempt is
counted against. Everything untested in it was an error path, an eviction
path, a lock-contention path or a malformed-input path — which is why the
tests below are worth having rather than line-execution filler.

### Tests added

**`describe("in-memory login attempt limits")`**

- *forgets an unlocked key only once its window has passed* — covers line 26's
  second operand and line 69's durable twin. Asserts that checking the lockout
  mid-window does **not** discard the running failure count (count still
  climbs 1 → 2), and that the record is dropped only after the window closes.
  A wrong condition here lets an attacker reset their own counter by polling
  the lockout endpoint.
- *evicts the stalest key when the entry cap is reached, not the key under
  attack* — covers `trimOldest` (175-181). With `maxEntries: 2` and three keys
  it asserts the least-recently-updated key is the one evicted and the active
  key keeps its count. A reversed comparator would evict the account currently
  being attacked.

**`describe("durable login attempt storage")`**

- *keeps an open failure window alive when the lockout is checked* — line 69,
  plus a direct read of the persisted file to confirm `count: 2` survives.
- *forgets only the key that succeeded* — covers `clear` (89-93), the one
  uncovered function. Asserts the other key's record is still in the file and
  still counting. A `clear` that wiped the store would let any successful
  login clear everyone else's lockout.
- *evicts the least recently updated key when the durable store is full* —
  covers `trimRecord` (166-173) against the persisted file.
- *serialises concurrent failures for one key instead of losing an update* —
  two tracker instances calling `registerFailure` concurrently must yield
  counts 1 and 2 and leave 2 on disk. This is the read-modify-write race the
  lock file exists to prevent.
- *reclaims a lock left behind by a process that died* — covers 126-131. A
  lock file back-dated 60s with `utimesSync` must be broken and removed, or a
  crash permanently bricks every login.
- *waits for a live lock rather than writing through it* — covers the
  not-stale branch at 129. A fresh lock is held; the call is still unsettled
  after 80ms; removing the lock lets it complete.
- *reports an unreadable store instead of silently clearing every lockout* —
  covers 140-143. The store path is a directory, so `readFile` fails `EISDIR`.
  Asserts the error propagates (it must not be swallowed into an empty store,
  which would drop every lockout) **and** that the lock file is released, not
  left behind to block all later logins.

**`describe("poisoned login attempt stores")`** — 1 control + 11 cases,
covering `validAttemptRecord` and `validTimestamp`.

The control case writes a well-formed locked entry and asserts
`remainingLockout` returns 8,999,000. Every rejection case is that same entry
with exactly one field corrupted, so `resolves.toBe(0)` proves rejection
rather than passing vacuously. Cases: array at the root, string at the root,
`null` document, `attempts` as an array, entry as an array, entry `null`,
fractional count, negative count, negative timestamp, timestamp as a string,
and `1e999` (which `JSON.parse` yields as `Infinity` — an attacker-writable
permanent lockout if `Number.isFinite` were dropped).

**`describe("login client address")`** — covers the fallbacks at 113-114:
real-ip when no forwarded list is present; a blank forwarded list must not win
over real-ip; the client entry is trimmed out of a forwarded chain; and three
cases that must bucket to `proxy-unknown`. A blank `x-forwarded-for` becoming
the client id would collapse every request into one rate-limit bucket.

### Placement

Appended to the existing `apps/web/src/lib/tests/login-attempts.test.ts`,
which is the `tests/` subfolder of the directory owning the subject and is
already listed in `vitest.quality.config.ts`'s `include`. A second
`login-attempts-*.test.ts` beside it was avoided. File is 276 lines, under the
400-line advisory threshold.

## Commands run and observed results

`pnpm quality:coverage` — **exit 0**, run twice, identical both times:

```
packages/fluxiq half (thresholds 65/70/60/65) — 11 tests passed
All files   |   69.52 |    73.07 |   61.11 |   69.52

apps/web half (thresholds 90/85/90/90) — 63 tests passed (login-attempts 34)
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
All files          |      99 |    96.61 |     100 |      99 |
 login-attempts.ts |   98.92 |    96.15 |     100 |   98.92 | 150-151
 program-route.ts  |     100 |      100 |     100 |     100 |
```

No `ERROR: Coverage for ...` lines. Before the change the same command printed
`87.56` / `80.48` and three threshold errors.

`pnpm check` — **exit 0**. `structure-audit: passed (183 warning(s), 359
baselined)`; `scripts/structure-audit` and task tests passed; `tsc --noEmit`
done for `packages/contracts`, `packages/client-gateway-websocket`,
`packages/fluxiq` and `apps/web`. No warning names the changed file.

`pnpm --filter @fluxiq/web test` — **exit 0**, `Test Files 246 passed (246)`,
`Tests 1346 passed (1346)`.

`pnpm quality:check` — **exit 1, pre-existing and unrelated.** The single error
is `package.json format`, the repository root's own file, which I did not
touch. Cause: `core.autocrlf=true` on this checkout. Measured —

```
committed blob: 0 CR bytes, 49 LF bytes
worktree copy:  49 CR bytes, 49 LF bytes
```

Git rewrites the LF-committed file to CRLF at checkout and Biome then demands
LF. It cannot be fixed in the worktree (git would reconvert it) and it is
green in CI, whose Linux checkout has no such conversion. `git status` shows
only my one modified test file.

No segfault, no `3221225477`, no retry needed — every command above ran once
(twice only where noted deliberately, for stability).

## Not verified

- **Lines 150-151 of `login-attempts.ts` are still uncovered and look
  unreachable.** That is the `throw error` for a non-`SyntaxError` escaping
  `JSON.parse` / `validAttemptRecord`. `JSON.parse` on a `string` can only
  throw `SyntaxError`, and `validAttemptRecord` performs only plain
  object/array reads over JSON-derived values, so I found no input that
  reaches the rethrow. I did not force it with a stub, since the thresholds
  are met with 9 points of headroom on statements and 11.6 on branches.
- I did not run `pnpm test` or `pnpm build` across the whole monorepo — only
  the web package's full suite plus the three commands the brief named.
- No browser or live-run validation; this change is unit tests only.
- I did not verify CI itself, only the local commands.

## Open questions or contradictions found

1. **`biome.json`'s `files.includes` still lists the pre-move test paths.**
   It names `apps/web/src/lib/login-attempts.test.ts`,
   `apps/web/src/lib/program-route.test.ts`,
   `apps/web/src/features/programs/shared-ui.test.tsx`,
   `apps/web/src/features/automation-studio/model/project-artifacts.test.ts`,
   `packages/fluxiq/src/programs/_shared/storage.test.ts` and
   `packages/fluxiq/src/programs/permission-matrix.test.ts`. Commit `e55a141`
   ("Relocate every co-located test into a tests/ subfolder") moved all of
   them, so **Biome now lints none of the repository's tests**. Confirmed:

   ```
   biome check apps/web/src/lib/tests/login-attempts.test.ts
   → Checked 0 files. × No files were processed in the specified paths.
     i These paths were provided but ignored: apps/web/src/lib/tests/login-attempts.test.ts
   ```

   I did not change `biome.json` — out of my brief, and repointing it could
   surface findings in files another worker is editing. My content is
   Biome-clean regardless: routing it through an included path
   (`biome check --stdin-file-path=apps/web/src/lib/login-attempts.test.ts`)
   and diffing the result against the file produced an **empty diff**.

2. **An existing test does not test what its name claims.** In the original
   `it.each`, the case labelled `"an invalid state shape"` uses the fixture
   `"{\schemaVersion\:1,\attempts\:{\client:user\:{\count\:\many\}}}"`. `\s`,
   `\a`, `\c` and `\m` are not escape sequences, so the string is
   `{schemaVersion:1,attempts:{client:user:{count:many}}}` — unquoted, hence
   malformed JSON. It exits through the `SyntaxError` branch, identically to
   the `"malformed JSON"` case above it, and `validAttemptRecord`'s shape
   rejection was never exercised by it. I left the test untouched (deleting or
   modifying existing tests was forbidden) and covered the real behaviour in
   the new `poisoned login attempt stores` suite. Worth a one-line fix by
   whoever owns that file.

3. **The two quality configs measure a very narrow slice.** `apps/web`
   measures 2 files and `packages/fluxiq` measures 2, against 90/85 and 65/70
   thresholds respectively. The gate is now comfortably green, but it says
   nothing about the rest of either package — including the automation-studio
   runtime that the MVP work actually turns on. That is a deliberate ratchet
   rather than a defect, but it is worth knowing that "quality coverage
   passes" is a statement about four files.
