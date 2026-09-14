# `f-bundle-durable-publication` — durable evidence publication

**Status:** complete. The evidence bundle keeps its existing same-parent
`.staging-<runId>` to `<runId>` rename boundary and existing on-disk schema.
No runner, Core, shared working document, run root, commit, or remote was
changed.

## Files changed

- `packages/test-evidence/src/bundle.ts`
- `packages/test-evidence/tests/evidence.test.mjs`
- this report

## Behavior

- Every artifact write now uses an owned file handle and completes
  `write -> FileHandle.sync -> close` before the artifact can be indexed.
  This includes an empty event journal, which is synced during journal close;
  serialized event appends retain their existing per-append sync and ordering.
- Artifact parent directories are synced best-effort. Finalization writes and
  syncs `artifact-index.json`, then writes and syncs
  `bundle.complete.json`, best-effort syncs the staging directory, and only
  then publishes with the existing same-parent directory rename. The run root
  is best-effort synced after publication.
- Publication retries only Windows sharing violations (`EPERM`, `EACCES`, and
  `EBUSY`) with bounded delays of 10, 25, and 50 ms: four total attempts.
  Other errors fail immediately. The destination is checked before every
  attempt and is never unlinked or replaced deliberately; a collision leaves
  both the existing final bundle and new staging bundle intact.
- Optional, explicitly test-only hooks expose file sync, directory sync,
  rename, wait, and finalization boundaries. Default callers and the bundle's
  public on-disk behavior are unchanged.

## Deterministic validation

Command:

`pnpm --filter @fluxiq-web-extension/test-evidence test`

Result: **17/17 passed**. The focused durability case injected interruptions
after journal close, artifact sync, index sync, marker sync, and staging-
directory sync. Every pre-rename interruption retained staging and produced no
final name. It also observed physical file-handle syncs, verified index-before-
marker ordering, exercised two transient rename failures followed by success,
proved the four-attempt retry ceiling, proved a non-sharing error is attempted
once, preserved a colliding destination without invoking rename, tolerated an
unsupported directory sync, and revalidated every published artifact and the
completion marker. The existing 64-event concurrency case also remained green.

`pnpm --filter @fluxiq-web-extension/test-evidence check` passed, and
`git diff --check` passed for both changed package files.

## Mutation proof

Each mutation was applied alone, the focused package command was observed to
fail, and the source was restored before the next mutation:

1. Removed artifact `FileHandle.sync()`: durability case failed because
   `diagnostics.txt` had not reached physical sync before `artifacts.synced`.
2. Removed the empty-journal close sync: durability case failed at
   `journal.closed` with zero observed journal syncs.
3. Removed `EBUSY` from the sharing-violation allowlist: the injected second
   rename attempt failed instead of retrying to successful publication.
4. Removed destination collision refusal: the collision case failed with
   “Missing expected rejection.”
5. Removed the post-publication run-root sync: the durability case failed
   because the run root never reached the directory-sync hook.

The restored command passed 17/17 after all mutations.

## Platform limitations

- Node cannot portably fsync directories on Windows. Directory sync therefore
  remains best-effort; marker/index/artifact hash inspection is the portable
  integrity guarantee.
- Node exposes no cross-platform no-replace directory rename primitive. The
  explicit destination check and single campaign writer refuse ordinary and
  retry-time collisions without deletion. A non-cooperating process creating
  the exact final directory between the last check and rename is an OS/API race
  that must also be excluded by campaign ownership.
- These changes protect publication boundaries; they do not repair a failing
  filesystem or themselves implement campaign reconciliation/resume.
