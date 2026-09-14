# `i-bench-durability-audit` — benchmark durability and supervision audit

**Status:** complete — read-only source/test audit; no raw evidence, secrets,
run roots, source, shared working documents, Core state, commits, or pushes were
changed.

## Finding

The evidence bundle has a useful publication boundary, but the benchmark does
not yet have a durable campaign boundary. A process interruption normally
leaves an unpublished `.staging-*` directory or an already renamed final
bundle. By contrast, `runs.json`, evaluations, and final reports are written
directly to their published names. `runs.json` is truncated and replaced after
every cell, so interruption during one replacement can destroy the only
campaign index even though earlier final bundles remain intact. Process and
child ownership is also memory-only. The controlled Windows restart therefore
preserved many completed bundles but killed the only component capable of
continuing the matrix or producing its aggregate.

This is a downstream Testing Lab defect. An OS reboot will always terminate
the running browser, Core, and Node processes; the correctness requirement is
that the next invocation can validate durable state and continue the exact
campaign, not that user-space processes survive the reboot.

## What is durable or atomic today

### Evidence bundle

- A run is built under `<runs>/.staging-<runId>` and is made visible at
  `<runs>/<runId>` by one same-parent directory `rename` only after
  `artifact-index.json` and `bundle.complete.json` have been written.
- `events.ndjson` has the strongest write behavior. Appends are serialized,
  each append is awaited, and the journal file handle is `sync()`ed after every
  event. Finalization awaits outstanding appends and closes that handle before
  publication.
- `bundle.complete.json` binds the artifact-index bytes by SHA-256, and every
  indexed artifact has a size and SHA-256. Existing inspection can therefore
  reject a corrupt published bundle.
- The final directory rename is an atomic *namespace visibility* boundary when
  source and destination remain on the same filesystem and the rename
  succeeds. Before it, consumers see only staging; after it, they see the final
  name.

Those properties prevent an ordinary process kill midway through finalization
from intentionally publishing the staging directory. They are not full
power-loss durability: ordinary artifact writes, the index, and completion
marker are not file-synced; neither the staging directory nor its parent is
directory-synced; and the post-marker directory rename is not followed by a
parent-directory sync.

### Benchmark files

- `runs.json` is awaited initially, after each evaluated cell, and at
  closeout. Therefore a normal returned write is ordered before the next cell.
- Each evaluation has a unique `evaluations/<runId>.json` name, and the final
  report is derived from in-memory evaluations.
- None of `runs.json`, evaluation JSON, `report.json`, or `report.md` uses a
  temporary sibling, `FileHandle.sync()`, or directory sync. These writes are
  neither atomic replacement nor power-loss durable.

### Processes and signals

- `ProcessSupervisor` owns child handles in memory and centralizes cleanup.
  On Windows it invokes `taskkill.exe /pid <pid> /T /F`; on POSIX it uses a
  detached process group. Cleanup is idempotent within the live supervisor.
- `withTopology` installs `SIGINT` and `SIGTERM` handlers, aborts the operation,
  and starts cleanup. Its `finally` also closes the topology.
- There is no durable campaign/lifecycle record, boot identity, active-cell
  record, persisted process ownership, or startup reconciliation. Windows has
  no Job Object containment here. The signal handler deliberately does not
  await its fire-and-forget cleanup, and Windows restart/session teardown is
  not guaranteed to deliver either handled signal or enough time for async
  work.

## Specific interruption and corruption windows

1. **During an event append:** only the journal tail is at risk. A fully
   returned append was synced; an interrupted append can leave a truncated
   final line in staging. Staging must never be accepted without full bundle
   validation.
2. **During artifact/final metadata writes:** a partial ordinary file remains
   in staging. No final directory should exist yet, but there is no current
   stale-staging reconciler.
3. **After completion-marker write, before directory rename:** staging may look
   complete. It is not published and must be hash-validated before any recovery
   promotes or consumes it.
4. **During/after directory rename:** ordinary process termination should
   yield one namespace name, but power loss can leave filesystem-dependent
   results because file and directory state were not flushed. A final name is
   a candidate, not proof; marker/index/artifact verification remains required.
5. **After final bundle rename, before evaluation write:** a valid final bundle
   is orphaned from the bench directory.
6. **During evaluation write:** a partial JSON file can exist at its published
   name. It must not count as a completed cell.
7. **After evaluation write, before `runs.json`:** a valid evaluation and
   bundle exist but the campaign index omits them.
8. **During any `runs.json` rewrite:** `writeFile` can truncate the last valid
   checkpoint and leave empty, partial, or malformed JSON. This is the largest
   present durability defect because the earlier snapshot is not retained.
9. **After the last cell, before closeout:** `runs.json` may list every cell but
   lack `finishedAt`; `report.json` may be absent or partial; or `report.json`
   may exist while the finished `runs.json`/Markdown does not. Aggregates are
   reproducible output and must be regenerated from validated cell records.
10. **During a signal or host restart:** cleanup and terminal reporting may
    never finish. Children can outlive a crashed wrapper on Windows when the
    host itself does not reboot; after a reboot the processes are gone, but
    memory-only ownership and cause information are gone too.

## Windows constraints

- Node's same-volume `rename` is the right publication primitive, but Windows
  sharing rules allow antivirus, indexers, or another open handle to make it
  fail with `EPERM`, `EACCES`, or `EBUSY`. Retrying those errors for a short,
  bounded interval is safe; deleting the destination before retrying is not.
- A temporary file must be in the destination directory so the rename cannot
  cross volumes. It should use a unique, owned name and exclusive creation.
- File-handle `sync()` is available and should precede rename. Portable
  directory fsync is not reliable on Windows (opening/syncing a directory may
  fail), so correctness cannot depend on it there. Attempt parent-directory
  sync where supported, but use versioned checksums and fail-closed recovery as
  the cross-platform guarantee.
- Signal delivery during logoff/restart is advisory. A stale `running` record
  reconciled against a persisted boot identity is more trustworthy than a
  shutdown callback. PID alone is insufficient because it can be reused.
- `taskkill /T` is cleanup, not durable containment. A Windows Job Object with
  kill-on-close would improve orphan containment after wrapper death, but it
  requires a native boundary or dedicated guardian and is not necessary for
  the first campaign-resume correctness slice.

## Narrowest safe implementation boundary

### 1. One atomic file writer in `test-runner`

Add a small allowlisted-byte/JSON writer used by bench state, evaluations,
reports, and lifecycle records:

1. create a unique sibling temporary with `wx` and private mode;
2. write the complete serialized value through its owned handle;
3. `sync()` and close the handle;
4. rename the temporary over the target without first unlinking the target;
5. retry only Windows sharing violations with a short bounded backoff;
6. sync the parent directory where the platform supports it;
7. leave or safely remove only the writer's own temporary on failure.

This immediately guarantees that a process-level interruption leaves the old
or new complete JSON, never a truncated published file. Immutable evaluation
names should still use exclusive creation, so an existing cell cannot be
silently overwritten. Serializing writers per target avoids races; the bench
currently has one writer, so no locking protocol is needed in this slice.

### 2. Keep bundle staging, strengthen its commit

Do not redesign evidence storage. Keep the current staging directory,
completion marker, hash index, and same-parent rename. Before writing the
completion marker, sync every newly written artifact (or write each through an
owned synced handle), then durably write the index and marker in that order.
After the directory rename, sync the run-root directory where supported.
Retry bounded Windows rename sharing failures without removing an existing
final directory. A final-name collision fails closed.

Recovery rules are simple at this boundary:

- a staging directory without a valid marker/index/all-artifact hash set is
  incomplete and never counts;
- a fully valid staging directory is recoverable only under the campaign
  resume contract, never opportunistically by an ordinary new run;
- a final bundle is accepted only after the same integrity inspection;
- an invalid final bundle is a hard corruption error, not a reason to rerun
  over the same identity.

### 3. Put lifecycle state inside the bench command

Create an allowlisted campaign lifecycle record before the first cell and
atomically replace it at these boundaries: `running`, active cell selected,
bundle/evaluation committed, aggregate committed, and terminal state. Store no
environment values or evidence content. It needs campaign/plan identity,
repository pins, boot identity, wrapper PID/start identity, timestamps, active
cell key, last committed generation/count, and terminal classification.

On startup, reconcile rather than trust shutdown handlers:

- same boot plus matching live process identity means the campaign is active
  and a second writer must refuse;
- different boot means a stale `running` lifecycle becomes
  `interrupted_by_system_restart`;
- same boot with no matching process becomes `interrupted_by_process_exit`;
- resume proceeds only after validating checkpoint generations and auditing
  owned processes/listeners/staging. Exact campaign identity and completed-cell
  reconciliation belong to the companion resume-contract work.

Signal handlers should request abort, await bounded cleanup at the CLI
boundary, and atomically record the terminal reason when time permits. They
remain a best effort; stale-state startup reconciliation is authoritative.
Job Object/guardian containment is a follow-up hardening item, not a reason to
delay durable campaign recovery.

## Deterministic tests required

### Atomic writer

- Inject failures after temporary creation, midway through writing, after
  file sync, after close, after rename, and during optional directory sync.
  At every observable boundary, the published target parses as the complete
  old or complete new value, never partial.
- Simulate Windows `EPERM`, `EACCES`, and `EBUSY` rename failures followed by
  success; assert bounded delays and no target unlink. Assert all other errors
  and exhausted retries fail closed while preserving the old target.
- Assert sibling placement, exclusive temporary creation, private mode, target
  serialization, and cleanup limited to the exact owned temporary.
- Assert immutable evaluation creation rejects a duplicate rather than
  replacing it.

### Evidence publication

- With injected filesystem hooks, interrupt at every boundary from journal
  close through artifact/index/marker sync and final rename. Before a
  successful rename, no final directory may be consumable.
- Feed recovery: an empty staging directory, truncated journal tail, partial
  artifact, missing marker, malformed marker, wrong index hash, wrong artifact
  size/hash, fully valid staging, fully valid final bundle, corrupt final
  bundle, and simultaneous staging/final names. Only the fully validated state
  may be proposed for reconciliation; ambiguous/corrupt states fail closed.
- Simulate transient Windows directory-rename sharing violations and a
  permanent collision. Assert one final name and no deletion/replacement of an
  existing bundle.

### Bench/lifecycle integration

- Crash/fault-inject before a run, during staging, after bundle rename, after
  evaluation commit, during checkpoint replacement, after the last checkpoint,
  and during each aggregate file. Restart from disk and assert exact-once cell
  accounting and deterministic aggregate regeneration.
- Corrupt the newest checkpoint generation and assert fallback only to a
  separately valid previous generation or a hard error according to the resume
  contract—never silent truncation or denominator reduction.
- Use injected boot and process-identity providers to cover live same-boot,
  dead same-boot, changed-boot, and PID-reuse cases. Assert the saved terminal
  classification and refusal of concurrent ownership.
- Drive `SIGINT`/`SIGTERM` through the CLI boundary and assert abort, bounded
  cleanup, and terminal persistence. Separately simulate immediate death so no
  handler runs, then prove startup reconciliation recovers from stale
  `running` state.
- Windows-only integration: start a child and grandchild, exercise normal
  cleanup and forced wrapper loss, and verify no unrelated PID is targeted.
  If Job Object containment is deferred, the forced-loss test should document
  the orphan risk and the startup ownership audit must detect it.

## Risks and non-goals

- Atomic replacement prevents torn process-level writes; it cannot make a
  failing filesystem healthy. Hash validation and preserved prior generations
  are still required.
- Reusing a bundle without exact plan/pin/target/identity validation could mix
  incompatible machine epochs. Durability must not weaken the original exact
  matrix or its denominator.
- Automatic deletion of stale staging, corrupt checkpoints, or orphan bundles
  would destroy diagnostic evidence and can hide ambiguity. Quarantine or
  preserve them until reconciliation has made a bounded decision.
- Lifecycle files must remain strictly allowlisted. Never serialize child
  environment, auth material, URLs with query data, logs, recorded page data,
  or evidence payloads.
- Automatic relaunch at Windows boot, services, Scheduled Tasks, and native
  Job Object bindings are operational enhancements outside the smallest safe
  resume slice. The first requirement is explicit restart/resume with durable,
  validated state.

## Files inspected

- `packages/test-evidence/src/bundle.ts`
- `packages/test-evidence/tests/evidence.test.mjs`
- `packages/test-runner/src/bench/report-store.ts`
- `packages/test-runner/src/bench/run-bench.ts`
- `packages/test-runner/src/bench/tests/run-bench.test.ts`
- `packages/test-runner/src/process-supervisor.ts`
- `packages/test-runner/src/tests/process-supervisor.test.ts`
- `packages/test-runner/src/coordinator.ts` (`withTopology` signal boundary)
- `reports/i-final2-termination-a.md`
- `reports/i-final2-termination-b.md`

No current test injects faults into bundle publication or bench replacement,
reconciles stale staging/orphan final bundles, persists campaign ownership, or
proves restart recovery.
