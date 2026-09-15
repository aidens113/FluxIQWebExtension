# ca-durable-temp-cleanup

## Outcome

Done. Worktree `F:\fxlab\fxlab-prod-core`, branch `week1-core-production-build`,
not committed. Only the two owned files changed.

## What changed and why

### `packages/test-runner/src/bench/durable-file.ts`

- **One retry policy.** `renameWithSharingRetries(source, target, ...)` is now
  `withSharingRetries(operation, options)`. It keeps the same platform check
  (Windows only), the same error set (EACCES/EBUSY/EPERM), the same delays
  (10/20/40/80 ms, so at most 5 attempts) and the same injectable `sleep`.
  Rename and temporary removal both call it, so the policy exists once. The
  constant is renamed `WINDOWS_SHARING_DELAYS_MS`.
- **Removal after a create publishes.** Create mode still links the temporary
  to the target first, then removes the temporary. That removal now retries
  Windows sharing violations.
- **If removal still fails, the call fails.** This is the single removal after
  publication. If it still fails once retries run out (or fails with an error
  that is not retried, on any platform), the call rejects with:
  - `code: "ERR_DURABLE_TEMPORARY_LEFT"`
  - `target` and `temporary`: absolute paths
  - `cause`: the last removal error

  The finally block does not try that removal again, so the call never
  reports failure over a directory that ended up clean. The directory sync
  and the two checkpoints after it do not run on this path.
- **Unpublished path.** When the target was never published (checkpoint fault
  before publication, link `EEXIST`, rename failure), the finally-block
  removal also retries. It stays best effort, so the original error still
  propagates unchanged.
- **Error shape.** The error is a plain `Error` with fields attached, not a
  new exported class. The file is not in `.structure-baseline.json`, and a new
  export could trip the one-exported-thing rule.
- **Unchanged:**
  - create-only `link`, so duplicates still fail with `EEXIST`
  - `wx` temporary open with mode 0600
  - file sync
  - directory sync (POSIX only, best effort when unsupported)
  - checkpoint names and order
  - per-target serialization
  - the replace path's success and failure behaviour

### Decision: fail with an error instead of recording the temporary for a later resume

1. **The writer cannot promise cleanup.** Nothing in the files I own can
   ensure a later resume or merge ever runs a cleanup. A "recorded" orphan
   that no consumer removes is still silent success at the call site. Wiring a
   sweep into `run-bench.ts`, `campaign/`, or `shard-merge.ts` is outside this
   brief.
2. **It keeps the merge's strict checks meaningful.** With this change, a
   successful create means the directory holds only the target. That matches
   `assertExactEvaluationFiles` and the checkpoint loader's `ignored` check
   (merge refuses any ignored checkpoint entry), without loosening either.
3. **Callers already recover when the error is raised.** The target is
   complete and durable, and existing recovery paths already converge on it:
   - `run-bench.ts` `persistEvaluation` treats `EEXIST` as "compare bytes and
     accept".
   - `shard-merge.ts` `createExclusiveOrVerify` does the same.
   - No caller matches the new code: lease and machine-slot contention sets
     cover only EACCES/EBUSY/EEXIST/ENOTEMPTY/EPERM, and only around `rename`.
4. **The error names the exact file.** It carries the one path that is
   provably this writer's temporary: same directory, the
   `.<basename>.<pid>.<hex>.tmp` name, and a hard link to the target (same
   bytes). Cleanup can remove exactly that file. Nothing else is ever deleted.

## Commands run and observed results

All runs were after the supervisor's "run now". The build lives in my
scratchpad `...\scratchpad\ca-durable-build`: a private tsconfig extending the
package tsconfig, `files` set to the test file only, and `outDir` in scratch.
The package `dist` was not touched. A `node_modules` junction pointed at the
package's `node_modules` during the runs and was removed afterwards with
`rmdir` (the link only; the target is still present).

- **Compile:** `node F:\fxlab\fxlab-prod-core\packages\test-runner\node_modules\typescript\bin\tsc -p <scratch>\ca-durable-build\tsconfig.json`
  printed nothing, `tsc exit=0`.
- **Tests:** `node --test --test-concurrency=1 --test-reporter=spec out\bench\tests\durable-file.test.js`
  (Node v22.11.0) printed `tests 11, pass 11, fail 0, cancelled 0`,
  `node exit=0`. The 3 new tests passed:
  - "Windows immutable publication retries sharing violations on its owned
    temporary and leaves none". Removal fails with EBUSY, or EPERM/EBUSY/EPERM,
    or EBUSY/EPERM/EACCES/EBUSY, then succeeds. The test checks: removals =
    failures + 1; delays = the policy prefix; all 7 checkpoints in order; the
    directory lists only `run-one.json`; the content is correct.
  - "a temporary that outlives bounded removal retries fails the publication
    closed and names the owned file", in three cases:
    - Windows, 5 × EBUSY/EPERM: 5 removals, delays [10, 20, 40, 80].
    - Windows, EIO: 1 removal, no delay.
    - linux, EBUSY: 1 removal, no delay (the non-Windows case).

    Each case checks: `code`, `target` and `temporary` on the error, and the
    `cause` code; checkpoints stop at `target-published`; the directory holds
    exactly the target plus the `.run-one.json.<pid>.0123abcd.tmp` temporary;
    the temporary's bytes equal the target's; the target content is complete;
    a later create of the same target still fails with `EEXIST`.
  - "an unpublished immutable write keeps its original error while retrying
    removal of its temporary". Link `EEXIST` with 2 sharing failures: `EEXIST`
    is kept, 3 removals, delays [10, 20], only the target remains. With 5
    persistent failures: `EEXIST` is kept and there are 5 removals.
- **Mutation proofs:** `node run-mutations.mjs`. It mutates only the scratch
  compiled `out\bench\durable-file.js`, never the worktree source, runs the
  test file after each mutation, restores the file, and checks the SHA-256.
  Output:
  - baseline: pass 11, fail 0
  - M1 (removal after publication skips retries): killed; the retry test and
    the fail-closed test fail
  - M2 (exhausted removal error swallowed): killed; the fail-closed test fails
  - M3 (platform guard removed, so non-Windows retries): killed; the
    fail-closed test (linux case) fails
  - M4 (finally repeats the removal already reported): killed; the retry test
    and the fail-closed test fail
  - M5 (unpublished removal skips retries): killed; the unpublished test fails
  - M6 (a cleanup error replaces the original error): killed; the unpublished
    test fails
  - M7 (retry bound `>=` widened to `>`): killed; the existing exhausted-rename
    test, the fail-closed test and the unpublished test fail
  - `restored=true sha256=56624250d593b54a49eb03594058c0c0f6e0435bf535238b29a0373e688ed54d`
  - after restore: pass 11, fail 0
  - `MUTATION PROOFS: ALL KILLED, RESTORED`, exit 0
- **Worktree state:** `git -C F:\fxlab\fxlab-prod-core status --short` lists
  ` M packages/test-runner/src/bench/durable-file.ts` and
  ` M packages/test-runner/src/bench/tests/durable-file.test.ts`. Diff stat:
  124 insertions, 14 deletions. Git printed an LF→CRLF working-copy warning
  for `durable-file.ts`; the diff is not a whole-file line-ending rewrite.

## Not verified

- Behaviour on real Windows with a real scanner holding the file. Only
  injected EBUSY/EPERM/EACCES/EIO were exercised.
- Other test files that depend on this writer were not run: campaign store,
  lease, machine slots, shard-merge, run-bench. None of them injects
  `durableFileSystem`, and success behaviour is unchanged, but that is an
  inference, not a run.
- Package-level `tsc -p packages/test-runner/tsconfig.json --noEmit`,
  `pnpm check` (including the structure audit), `pnpm test`, and `pnpm lab`
  were not run, as the brief excludes them. The private compile covered only
  `durable-file.test.ts` and what it imports.
- These results come from one observation each on the machine with faulty RAM.

## Open questions or contradictions found

1. **Automatic recovery is not implemented.** When retries run out, the
   orphaned temporary still stops the merge seal until it is removed. The
   error now says exactly which file, and it surfaces when the file is
   written, not at seal time.

   For hands-off recovery, a resume or merge step outside this brief could
   remove only files that meet all of these:
   - same directory as the target
   - name matching `^\.<escaped basename>\.\d+\.[0-9a-f]+\.tmp$`
   - a regular file, not a symlink
   - byte-equal to the published target (stronger still: same file identity,
     since create mode hard-links them)

   That step would sit in `campaign/` or `run-bench.ts` resume and needs a
   brief for those files.
2. **Error code and path when the cell's evaluation write fails.** The cell
   now fails with the error instead of the campaign continuing. On resume,
   `persistEvaluation` should reach `EEXIST`, compare bytes, and accept. That
   only holds if the checkpoint still names the cell as the active attempt. I
   did not trace every run-bench resume branch to confirm it.
3. **Unpublished `EEXIST` path.** When the link fails with `EEXIST` and the
   writer's own temporary still cannot be removed after retries, the caller
   still sees plain `EEXIST`, and `createExclusiveOrVerify` treats that as
   success. An orphan can then remain in the parent `evaluations/` directory,
   which `assertExactEvaluationFiles` does not check. I kept original-error
   precedence to avoid breaking callers' `EEXIST` handling. Say if that path
   should also fail closed.
4. **What "non-Windows unchanged" means.** I read it as: no retries and no
   sleeps off Windows. A failed removal after publication on POSIX now also
   raises `ERR_DURABLE_TEMPORARY_LEFT`, where before it was swallowed, because
   requirement 1 forbids silent success on every platform.

---

# Round 2: separate, longer removal schedule (supervisor review)

## Outcome

Done. Same worktree and branch, not committed. Only the two owned files are
changed.

## What changed and why

The supervisor accepted the design, with one change. The 10-80 ms schedule
(about 150 ms) is shorter than a Windows Defender scan can hold a new file.
A throw from a checkpoint or evaluation write would then stop an unattended
child executor partway through a run.

### `durable-file.ts`

- **Two schedules instead of one.** `WINDOWS_SHARING_DELAYS_MS` is split into:
  - `WINDOWS_RENAME_DELAYS_MS = [10, 20, 40, 80]`: unchanged, for the
    replace-mode rename.
  - `WINDOWS_TEMPORARY_REMOVAL_DELAYS_MS = [10, 20, 40, 80, 160, 320, 640, 1280]`:
    up to 9 removal attempts and 2550 ms of sleep.
- **The helper takes the schedule as an argument.** Signature:
  `withSharingRetries(operation, delays, options)`. Both callers use the same
  loop. It still retries only on Windows and only for EACCES/EBUSY/EPERM.
- **Where each schedule applies.** The rename passes the rename schedule. The
  shared `removeTemporary` passes the removal schedule. That covers:
  - the single removal after a create publishes; when it runs out, it still
    throws `ERR_DURABLE_TEMPORARY_LEFT`
  - the best-effort removal in the finally block after an unpublished failure,
    in both create and replace modes (see open point 5)
- **No other behaviour changed.**

### `tests/durable-file.test.ts`

- **Retry test.** Removal fails 1, 5, and 8 times with mixed
  EBUSY/EPERM/EACCES, then succeeds. The test checks: removals = failures + 1;
  delays equal the matching prefix of the long schedule; all 7 checkpoints; no
  temporary left.
- **Fail-closed test, Windows case.** Now 9 sharing failures: 9 removals, the
  full delay list [10, 20, 40, 80, 160, 320, 640, 1280], then the named error.
  The EIO case and the linux case are unchanged.
- **Unpublished test, persistent case.** Now 9 removals; `EEXIST` is kept.
- **Exhausted-rename test.** It now checks the exact delays [10, 20, 40, 80]
  instead of just counting 4. This pins the rename schedule. The existing
  successful-rename test still checks [10, 20, 40].
- **Duplicate-create `EEXIST` corner.** Left as it is, per the supervisor.

## Commands run and observed results

- **Private compile:** `node F:\fxlab\fxlab-prod-core\packages\test-runner\node_modules\typescript\bin\tsc -p <scratch>\ca-durable-build\tsconfig.json`
  printed nothing, `tsc exit=0`. The scratch `node_modules` junction was
  recreated for the runs and removed afterwards with `rmdir`.
- **Tests:** `node --test --test-concurrency=1 --test-reporter=spec out\bench\tests\durable-file.test.js`
  printed `tests 11, pass 11, fail 0, cancelled 0`, `node exit=0`.
- **Mutation proofs:** `node run-mutations-2.mjs` mutates only the scratch
  compiled `out\bench\durable-file.js`. Output:
  - baseline: pass 11, fail 0
  - M1-M7: all killed again. M7's pattern is now `attempt >= delays.length`.
  - M8 (rename uses the removal schedule): killed; the exhausted-rename test
    fails
  - M9 (removal uses the rename schedule): killed; the retry, fail-closed and
    unpublished tests fail
  - M10 (rename schedule gains a 160 ms step): killed; the exhausted-rename
    test fails
  - M11 (rename schedule values become [10, 20, 40, 160]): killed; the
    exhausted-rename test fails
  - M12 (removal schedule loses its 1280 ms step): killed; the retry,
    fail-closed and unpublished tests fail
  - M13 (last removal delay becomes 2560 ms): killed; the retry and
    fail-closed tests fail
  - `restored=true sha256=5f196421111983529e039c9120005c32261c02898cfaafb89eb0a49a76b150de`
  - after restore: pass 11, fail 0
  - `MUTATION PROOFS: ALL KILLED, RESTORED`, exit 0
- **Worktree state:** `git -C F:\fxlab\fxlab-prod-core status --short` lists
  ` M packages/test-runner/src/bench/durable-file.ts` and
  ` M packages/test-runner/src/bench/tests/durable-file.test.ts`. Diff stat:
  133 insertions, 16 deletions.

## Not verified

- Whether 2.55 s covers real Defender holds on this machine. Sleeps were
  injected, and no real scanner lock was exercised.
- Everything else under round one's "Not verified" still applies: other test
  files that use the writer, package `tsc`, `pnpm check`/`test`/`lab`, and
  single observations on the machine with faulty RAM.

## Open questions or contradictions found

5. **The removal schedule also applies to cleanup after a failed write.** It
   is one schedule for every removal of the writer's own temporary, including
   the best-effort finally-block removal after an unpublished failure in
   replace mode (for example a checkpoint fault, or a rename that ran out of
   retries). Before this brief, that cleanup had no retries. Under a
   persistent lock, the original error can now take up to about 2.5 s to
   surface, on failure paths only. Rename timing itself is unchanged. If the
   brief meant create-mode removal only, the finally block can pass the rename
   schedule in replace mode; that is a one-line change.
