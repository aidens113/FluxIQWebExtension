# w2-unscanned-store — the `security.redaction` false failure

Worktree: `F:\fxwork\t014-redaction-unscanned-store`, branch
`task/t014-redaction-unscanned-store`. Not committed.

## Outcome

Done. The false failure is gone, proven live on the task that carried it, and the
check still catches a real leak into a store, proven by a planted synthetic
secret and by two mutations.

## First: it was not a leak

The run event reads "Redaction attestation found 1 file(s) holding a declared
literal **or left unread**". That is one fixed sentence covering both outcomes
(`run-scenario.ts:556`); the discriminator is the finding's `categories`. On every
occurrence the category was `unscanned-store`, never `secret-literal`.

This mattered more than usual, because `social-scheduler` declares no scenario
secrets, so the single declared literal (`literalCount: 1`) is
`LiveLlmRun.redactionLiterals` — **the real DeepSeek API key**. A leak of it into
Core's global store would have been urgent.

It is not there. Against the retained real workspace of a run that carried the
failure, with the actual key loaded into memory and never printed:

```
byte search of global.sqlite (utf8):    absent
byte search of global.sqlite (utf16le): absent
byte search of global.sqlite (utf16be): absent
cell read of global.sqlite:             clean
workspace scan: {"status":"passed","scannedFiles":19,"scannedBytes":13296923,"findings":[]}
```

The logic also runs the safe way round: the fix makes the scan read **more**, not
less. Had the key been in that store, raising the ceiling would have turned the
false `unscanned-store` into a true `secret-literal` and the run would still have
failed. The fix cannot conceal a leak; it can only expose one.

## What `unscanned-store` means, and why the file triggered it

`packages/test-runner/src/secret-leak-attestation.ts` never skips a SQLite store
as binary. A store is searched byte for byte for the literal in UTF-8, UTF-16LE
and UTF-16BE, and the database it belongs to is copied with its `-wal` and
`-journal` and read cell by cell (`stageDatabase` → `sqlite-store-reader/`), so a
literal split across overflow pages is found too. `unscanned-store` is the single
category for *any* reason the scan could not complete that on a file whose name
matches `/\.(db|sqlite3?)(-(wal|shm|journal))?$/i` — unreadable, not a database,
an orphan log, over a ceiling. It is a fail-closed marker: a scan that could not
look has not attested absence.

The file triggered it **purely on size**. `visit` gates every file on
`maxFileBytes`, and for a file named as a store relabels the resulting
`oversize-text` as `unscanned-store`:

```ts
if (metadata.size > limits.maxFileBytes) { unscanned("oversize-text"); return; }
```

`SECRET_LEAK_ATTESTATION_RUN_LIMITS.maxFileBytes` is 8 MiB, and it was already
the hard ceiling — `ABSOLUTE_LIMITS` refuses anything larger, so no caller could
raise it. **The measured store is 10,510,336 bytes (10.02 MiB).** Over the
ceiling, so it was never read, never staged, never cell-read, and its bytes were
excluded from `scannedBytes` — which is exactly what the attestations showed
(workspace `scannedFiles: 18`, `scannedBytes: 2,786,587`, one finding).

Proof that size alone does it, on the real workspace: at the production ceiling
only `global.sqlite` is flagged; lower `maxFileBytes` to 1,000,000 and the
perfectly readable 1.16 MiB `project.sqlite` gains the identical finding.

```
maxFileBytes=8388608 {"status":"failed","scannedFiles":18,"scannedBytes":2786587,
  "findings":[{"path":".fluxiq/global.sqlite","categories":["unscanned-store"]}]}
maxFileBytes=1000000 {"status":"failed","scannedFiles":17,"scannedBytes":1570075,
  "findings":[{"path":".fluxiq/artifacts/.../project.sqlite","categories":["unscanned-store"]},
              {"path":".fluxiq/global.sqlite","categories":["unscanned-store"]}]}
```

Nothing is wrong with the store itself. Node's SQLite reads all four of its
tables from the real 10 MiB file in **68 ms**, outcome `clean`.

This also explains why only the *good* runs failed. Runs that died early left a
7-file workspace and passed; runs that built a Flow and extracted records wrote
enough into `global.sqlite` to cross 8 MiB. The check was loudest exactly where
the product worked.

## Is `.fluxiq/global.sqlite` expected in an isolated run? Yes, by construction

It is the run's **own** store, not the developer's. `allocateRun`
(`packages/test-runner/src/allocation.ts:46`) creates
`<runRoot>/fluxiq-root/.fluxiq` and `environment.ts:64-65` passes it to Core as
`FLUXIQ_DATA_DIR` and `FLUXIQ_DATABASES_DIR`. An isolated run stands up its own
FluxIQ, and that FluxIQ's global database is `<storageDir>/global.sqlite`. The
redaction scope is rooted at that same directory
(`RunAllocation.storageDir`), so the path `.fluxiq/global.sqlite` *is* the
isolated store. Its presence is not a finding and never was — the check was
failing on its own byte budget.

## The rule that replaced it

Not an exclusion. The store is scanned; the budget that refused to scan it was
the wrong budget.

`maxFileBytes` is a **text** budget: it bounds what the scan decodes as UTF-8 and
runs its four credential regexes over. A store is never decoded and never
regex-scanned — it costs one `readFile` plus three `Buffer.includes`, a file copy,
and a SQLite read. Charging it to the text budget is a category error.

So SQLite stores now have their own named ceiling, `maxStoreBytes`, used in the
two places that judged a store by `maxFileBytes` (`visit` and `stageDatabase`):

- `SECRET_LEAK_ATTESTATION_RUN_LIMITS.maxStoreBytes = 33_554_432` (32 MiB),
  `SECRET_LEAK_ATTESTATION_DEFAULT_LIMITS.maxStoreBytes = 8_388_608`.
- `resolveLimits` now also requires `maxTotalBytes >= maxStoreBytes`, because a
  store is read whole or not at all and both its bytes and its staged copy count
  against the total.
- `ENTRIES_PER_BOUNDED_SCAN` divides by `max(maxFileBytes, maxStoreBytes)`, so a
  chunk of stores still cannot exceed the scan's total.
- A store past `maxStoreBytes` is **still** `unscanned-store`. The check still
  fails closed; it now fails closed at a ceiling sized against what Core actually
  writes rather than at a text budget.
- A store found only by its database *header* keeps the text ceiling: its size is
  judged before its first byte is read, and its name claims to be text.

32 MiB is a little over three times the largest store a healthy run has produced
(the measured 10.02 MiB), and three stores at that ceiling still fit
`maxTotalBytes`. The number and the measurement are in the constant's doc comment
and in `docs/architecture/testing-facility.md`, and
`demo-llm-attestation.test.ts` builds its fail-closed fixture from the constant,
so raising the ceiling without reading that test cannot quietly turn the
fail-closed case into a pass.

## The planted-secret test

`packages/test-runner/src/tests/secret-leak-attestation.test.ts`, "a synthetic
secret in a store past the text ceiling is still found, at the ceilings a Lab run
uses". It runs at the real `SECRET_LEAK_ATTESTATION_RUN_LIMITS`, builds a store
past `maxFileBytes` from nine megabyte rows of `hex(randomblob(...))`, and plants
the obviously synthetic `synthetic-deepseek-sentinel-123456` in an
**uncheckpointed `-wal`** that never reached the database file — asserted with
`readFile(database).includes(sentinel) === false`. Finding it in the database
therefore requires both changed ceilings: `visit` admitting the oversize store,
and `stageDatabase` copying it with its log for the cell read.

```
ok 5 - a synthetic secret in a store past the text ceiling is still found, at the ceilings a Lab run uses
```

Expected findings asserted exactly: `store/global.sqlite` → `secret-literal`
(cell read) and `store/global.sqlite-wal` → `secret-literal` (byte search), 2
files read, `scannedBytes === size + logSize`, and the sentinel absent from the
serialized report.

### Mutations, reverted

**M1 — the easy silence** (`if (namedStore) { skippedBinaryFiles += 1; return; }`,
i.e. the blanket "ignore binary files" non-fix the brief warned against). The
scan **passes** on a store that holds the planted secret, and the test fails:

```
not ok 5 - a synthetic secret in a store past the text ceiling is still found...
  + actual  []
  - expected [ { categories: [ 'secret-literal' ], path: 'store/global.sqlite' }, ... ]
# pass 5, fail 4
```

**M2 — reverting the ceiling** (store bounded by `maxFileBytes` again). The false
failure returns: the store carries `unscanned-store` alongside `secret-literal`,
and 2 tests fail. Both mutations were reverted; the file now contains no
`MUTATION` marker and `git diff` is the fix alone.

## Live evidence

All four runs are `social-scheduler-week-ahead`, DeepSeek live, instance `t014`,
run from the worktree with `FLUXIQ_TEST_ENV_FILES=none` and the key exported
explicitly. The key was never printed.

| # | Target | Run | Verdict | Redaction |
|---|---|---|---|---|
| 1 | isolated (baseline, before any change) | `run-mu7c8mn2-d3da2548` | **failed**, `security.redaction` | failed, 1 × `.fluxiq/global.sqlite` `unscanned-store`; workspace 18 files / 2,786,587 B |
| 2 | persistent-isolated (to retain the workspace) | `run-mu7cej77-56eeb4ad` | **failed**, `security.redaction` | identical finding |
| 3 | isolated (after the fix) | `run-mu7cnosv-36d787e4` | **passed**, no failure category | **passed**, 0 findings; workspace **19 files / 13,297,679 B** |

Run 1 and run 3 are the same command; only the ceiling changed between them. The
judgement was `passed` on every run, with extraction 14/14 records and 56/56
fields — the Flow was always correct; only the facility check was wrong.

The byte jump is the whole point: 13,297,679 − 2,786,587 = 10,511,092, i.e. the
store is now genuinely read rather than skipped. Offline against the retained
real workspace the arithmetic is exact: 2,786,587 + 10,510,336 = **13,296,923**,
status `passed`, 0 findings.

## Commands run and observed results

- Baseline live (before any edit): `FLUXIQ_TEST_ENV_FILES=none
  FLUXIQ_TEST_TARGET=isolated FLUXIQ_LAB_INSTANCE=t014 pnpm lab:campaign
  social-scheduler-week-ahead` → `failed (run-mu7c8mn2-d3da2548), judgement
  passed`, `failureCategory: security.redaction`, 3 provider calls, $0.0107.
- Same with `FLUXIQ_TEST_TARGET=persistent-isolated
  FLUXIQ_TEST_PERSISTENT_WORKSPACE=t014-store` → same failure; workspace retained,
  `global.sqlite` measured at 10,510,336 bytes.
- Offline scan of the retained workspace through the built
  `attestWorkspaceSecretAbsence` → before: `failed`, 1 `unscanned-store`; after:
  `passed`, 19 files, 13,296,923 bytes.
- `readSqliteStores` on the real 10 MiB store → `['clean']` in 68 ms.
- Live after the fix → `passed (run-mu7cnosv-36d787e4), judgement passed`,
  `"passed": 1, "failed": 0`, 3 calls, $0.0098.
- `node --test packages/test-runner/dist/tests/secret-leak-attestation.test.js`
  → `# tests 9, # pass 9, # fail 0`.
- `node --test packages/test-runner/dist/tests/demo-llm-attestation.test.js`
  → `# tests 5, # pass 5, # fail 0`.
- `pnpm --filter @fluxiq-web-extension/test-runner test`
  → `# tests 1143, # pass 1143, # fail 0`, exit 0.
- `pnpm check` (worktree) → `structure-audit: passed (73 warning(s), 122
  baselined)`, all 10 project `check` targets Done, **exit 0**.

One `pnpm --filter @fluxiq-web-extension/test-runner build` failed once with
`TS2307: Cannot find module '@fluxiq/contracts/automation-studio'` in
`packages/test-contracts`. The identical command succeeded immediately after with
no change. This matches the coordinator's note that the shared Core at
`F:\fxwork\!FluxIQ` was being rebuilt concurrently. I did not run any build in the
shared Core.

## Files changed

All in `F:\fxwork\t014-redaction-unscanned-store`, uncommitted:

- `packages/test-runner/src/secret-leak-attestation.ts` — `maxStoreBytes` added to
  the limits, both limit sets and `ABSOLUTE_LIMITS`; used in `visit` and
  `stageDatabase`; new `resolveLimits` invariant; doc comments carrying the
  measurement.
- `packages/test-runner/src/redaction-attestation/attest-run-redaction.ts` —
  `ENTRIES_PER_BOUNDED_SCAN` divides by the larger ceiling.
- `packages/test-runner/src/tests/secret-leak-attestation.test.ts` — the new
  planted-secret test; the existing fail-closed test now proves a store ignores
  `maxFileBytes` (set to 8 bytes) and obeys `maxStoreBytes`.
- `packages/test-runner/src/tests/demo-llm-attestation.test.ts` — new test that a
  10 MiB store is scanned; the fail-closed test moved to `maxStoreBytes`, read
  from the constant.
- `docs/architecture/testing-facility.md` — the limits paragraph.

## Not verified

- **Only `social-scheduler-week-ahead` was run live.** The other corpus tasks were
  not re-run. They share the one code path, and the 2026-09-18 corpus shows the
  identical single finding on each, so I expect the same result, but that is an
  inference.
- **The 32 MiB ceiling is sized from one measurement** (10.02 MiB, observed twice
  on the same scenario). I did not measure a long-lived `persistent-isolated`
  workspace, whose `global.sqlite` accumulates across runs and could approach the
  ceiling over time. If it ever does, the check fails closed and loudly — which is
  the intended behaviour, not a silent pass.
- **`ENTRIES_PER_BOUNDED_SCAN` drops from 8 to 2**, so a bounded
  `persistent-isolated` scope is scanned in four times as many passes. The unit
  test covering 40 written entries passes, and a pass with no store spawns no
  reader process, but I did not measure the wall-clock cost on a large persistent
  workspace.
- **The domain was not involved**, so
  `pnpm --filter @fluxiq-web-extension/domain test` with
  `DOMAIN_TEST_BUILD_LABEL=t014` was not run. Changes are confined to
  `packages/test-runner` and one architecture document.
- **Not committed**, per the brief.
- A store found only by its SQLite **header** under a non-store filename still
  uses the text ceiling. That is deliberate and documented, but it means an
  oversize database named, say, `cache.dat` would still be `oversize-text`. No
  Core store is named that way.

## Open questions

- **The retained persistent workspace is still on disk** at
  `F:\fxwork\t014-redaction-unscanned-store\test-runs\instances\t014\persistent-isolated\t014-store`.
  It holds a real Core workspace with recorded page data. `test-runs/` is ignored,
  so nothing can be committed from it, and I left it in place rather than
  destroying evidence. It is disposable whenever the supervisor wants it gone.
- **`unscanned-store` cannot say why.** One category covers "unreadable", "not a
  database", "orphan log" and "over a ceiling". That is precisely why this took a
  live run and a retained workspace to diagnose, and why a reader could reasonably
  assume the worst. Splitting it, or carrying a reason alongside the category,
  would make the next occurrence self-explaining. It touches the manifest schema,
  so I did not do it here.
