# `f-bench-durable-file` — durable benchmark projections

**Status:** complete — implementation and focused validation passed; supervisor
integration and full-suite verification remain required.

## Scope

- Own `bench/durable-file.ts`, its colocated focused test, and
  `bench/report-store.ts` only.
- Add atomic, file-synced replacement for mutable bench projections and
  exclusive immutable publication for evaluations.
- Preserve secrets by accepting only caller-provided serialized values and
  never persisting environment, URL, log, or evidence data implicitly.

## Implementation ledger

- Added an injectable durable-file boundary using an exclusive private sibling
  temporary, complete write, file sync, close, and atomic publication.
- Mutable publication uses rename without ever unlinking the destination and
  bounds Windows sharing retries to 10/20/40/80 ms.
- Immutable publication uses a hard-link commit from the fully synced sibling
  temporary, so an existing destination fails with `EEXIST` and is never
  replaced.
- Writes to one resolved target are serialized in-process. Parent-directory
  sync is attempted on supported non-Windows platforms and is not a correctness
  dependency on Windows.
- Routed `runs.json`, `report.json`, and `report.md` through atomic replacement.
  Routed each `evaluations/<runId>.json` through exclusive immutable creation;
  a duplicate is an `EEXIST` failure rather than an overwrite.

## Validation

- Private focused compile with the package's strict NodeNext options: **passed**.
- `node --test <private-build>/bench/tests/durable-file.test.js`: **8/8
  passed**. Coverage includes seven injected publication checkpoints, a partial
  write, all three retryable Windows sharing codes, retry exhaustion, a
  non-retryable error, exact owned-temp cleanup/no destination unlink, sibling
  `wx`/`0600` creation, same-target serialization, file sync, best-effort
  directory sync, immutable duplicate refusal, and every report-store
  projection.
- `pnpm --filter @fluxiq-web-extension/test-runner check`: **passed** after the
  parallel campaign/CLI work settled enough to typecheck together.

## Mutation proof

Each mutation was applied alone, its focused test was observed failing, and the
source was restored before the final 8/8 run:

1. Retrying non-sharing `EIO` like a Windows sharing error failed the bounded
   retry test (`5/4` calls/delays observed instead of `1/0`).
2. Omitting the temporary file's `sync()` failed the sync-count assertion (`0`
   instead of `2`).
3. Replacing an immutable evaluation instead of exclusive creation failed with
   `Missing expected rejection`.
4. Opening a temporary with `w` instead of `wx` failed the exclusive-open
   assertion.

## Residual boundaries

- Windows directory sync remains intentionally best effort; complete
  checksummed campaign generations provide the cross-platform recovery seam.
- Serialization is process-local. The campaign owner/lifecycle layer must
  refuse a second process rather than treat this utility as a cross-process
  lock.
- Immediate process death may leave an owned sibling temporary, but cannot
  publish partial content. Startup reconciliation may preserve or clean such a
  file only after identifying it as this writer's owned temporary.
