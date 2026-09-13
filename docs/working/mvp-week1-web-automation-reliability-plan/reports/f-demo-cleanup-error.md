# f-demo-cleanup-error — a demo keeps its lane's error when session cleanup fails (test-runner)

## Outcome

Done. All three tasks are implemented in `packages/test-runner/src/demo-workspace/core-process.ts`.
Ten new rows in `packages/test-runner/src/demo-workspace/tests/core-process.test.ts` cover them, and
a mutation proof for each guard fails its row. Each mutation was restored, and the file's SHA-256
matched the pre-mutation value afterwards. No Lab or demo command ran.

Re-verified at HEAD first: the item was open. At `d639415`, `withPersistentDemoCore` removed the
session in a nested `finally` with `rm(sessionDirectory, { recursive: true, force: true })` and no
retries (old `core-process.ts:99-108`), so an error there replaced the lane's error. The file had no
tests.

## What changed and why

`packages/test-runner/src/demo-workspace/core-process.ts` (192 lines before, 5 exported values;
now 7 exported values, under the 8-value advisory threshold):

1. **A failed lane keeps its error.** There is a new exported helper,
   `runThenCleanUp(operation, cleanUp, label = "Demo session cleanup also failed")`. It runs the
   operation and then always runs the cleanup:
   - Both fail: it throws the operation's *own* error object. That object's `message` gains a
     second line, `<label>: <cleanup message>`, and the same line is inserted into `stack`. A
     `RunnerFailure` therefore keeps its class and `category`. A non-`Error` throw becomes
     `new Error("<value>\n<line>", { cause: value })`.
   - Only the cleanup fails: the cleanup error is thrown unchanged, as before.
   - Only the operation fails: its error is thrown unchanged.

   `withPersistentDemoCore` now uses it twice. The outer call wraps the whole start-up and the lane.
   The inner call is the cleanup: `supervisor.cleanup()`, then the removal, labelled
   `Demo session removal also failed`. A lane error plus a process-cleanup error plus a removal
   error therefore prints three lines. The entry point `scripts/record-demo-workspace.mjs:12`
   prints `error.message`, so the second line reaches the `demo:record` output.
2. **The removal is retried.** There is a new exported helper,
   `removeDemoSession(sessionsDirectory, sessionDirectoryName, options?)`:
   - It keeps the existing refusal, `Refused to remove a demo session outside its workspace`, now
     as one check: the resolved session's parent must be the resolved sessions directory. That
     also refuses `..`, `.`, `""`, `../elsewhere` and `nested/deeper`.
   - It retries on `EBUSY`, `EPERM` and `ENOTEMPTY`, up to 8 attempts, waiting 250 ms × attempt
     between them (about 7 s in total). Any other code fails at once.
   - It runs only after `supervisor.cleanup()` has returned, which is the process-tree kill. The
     retry is an explicit loop over an injectable `remove` rather than `rm`'s own `maxRetries`, so
     a test can inject an `EBUSY`.
3. **A junction is never followed.** The default `remove` is still
   `rm(target, { recursive: true, force: true })`. The junction row proves on this machine
   (Windows 10, Node v22.11.0) that it unlinks a real junction without deleting its target's file.
   So the brief's "if it does not, unlink junctions first" branch was not needed, and no
   unlink-first code was added.

`packages/test-runner/src/demo-workspace/tests/core-process.test.ts` (new) has ten rows:
- EBUSY then success: 2 calls, on the resolved path.
- EPERM and ENOTEMPTY: each retried until `attempts: 3` runs out.
- EACCES: fails after one call.
- Outside-workspace names: refused with 0 calls.
- A lane's `RunnerFailure` kept when the cleanup throws EBUSY: the same object, the same category,
  exactly two message lines, and the line present in `stack`.
- Three-level labelling.
- A non-`Error` lane value.
- Only the cleanup fails: the cleanup error is thrown.
- A clean cleanup leaves the lane error unchanged, and a passing lane returns its value after the
  cleanup.
- The junction row: a real `symlink(..., "junction")` into a temp directory is confirmed as a link
  and readable through. After `removeDemoSession` the session is `ENOENT` and the target's
  `kept.txt` still reads `pinned core file`.

## Commands run and observed results

All from `F:\!FluxIQWebExtension`. Each exit status was captured by redirecting to a file, never
through a pipe.

- `pnpm --filter @fluxiq-web-extension/test-runner check` → `exit=0` (`tsc -p tsconfig.json --noEmit`,
  no diagnostics).
- Structure audit. The scratch `GIT_INDEX_FILE` was a copy of `.git/index` with
  `git add -N packages/test-runner/src/demo-workspace/tests/core-process.test.ts`, and
  `git ls-files` listed the file. `node scripts/structure-audit.mjs` → `exit=0`,
  `structure-audit: passed (41 warning(s), 17 baselined).` No line in the output names
  `core-process` or `demo-workspace/tests`. The scratch index was then deleted.
- `pnpm exec tsc -p packages/test-runner --outDir packages/test-runner/dist-f-demo-cleanup` → `exit=0`.
- `node --test "dist-f-demo-cleanup/demo-workspace/tests/core-process.test.js"` (cwd
  `packages/test-runner`) → `exit=0`, `# tests 10`, `# pass 10`, `# fail 0`.
- `node --test "dist-f-demo-cleanup/**/*.test.js"` (cwd `packages/test-runner`) → `exit=0`,
  `# tests 572`, `# pass 572`, `# fail 0`.
- SHA-256 of `core-process.ts` before any mutation:
  `2414BEF316AAFAD353D5915F984C45732633E2FCB531BC4ED2667315C5956F13`.

Mutation proofs. Each mutation was followed by the same private rebuild (`build exit=0` every time),
then the new test file alone. The line was then restored with Edit and the hash compared.

| # | Guard | Mutation | Observed | Restored |
| --- | --- | --- | --- | --- |
| 1 | The lane error is kept | `catch (cleanupError) { throw withFollowingFailure(...) }` → `throw cleanupError;` | `test exit=1`, `# pass 7 # fail 3`: `not ok 5 - a failed lane keeps its error when the session cleanup then fails`, `not ok 6 - every later cleanup failure is appended under its own label`, `not ok 7 - a lane that throws a non-Error value still reports both failures`, each `The validation function is expected to return "true". Received false` / `AssertionError` | hash `2414BEF3…6F13`, `identical=True` |
| 2 | The retry | `RETRIED_REMOVAL_CODES = new Set(["EBUSY", "EPERM", "ENOTEMPTY"])` → `new Set<string>([])` | `test exit=1`, `# pass 8 # fail 2`: `not ok 1 - a removal that throws EBUSY is retried and then succeeds` (`code: 'EBUSY'`), `not ok 2 - EPERM and ENOTEMPTY are retried too, until the attempts run out` (`code: 'ERR_ASSERTION'`) | hash `2414BEF3…6F13`, `identical=True` |
| 3 | A junction is never followed | default `remove` → a walk that `lstat`s each entry and `rm`s the `realpath` of every link before removing the session | `test exit=1`, `# pass 9 # fail 1`: `not ok 10 - removing a session deletes a junction inside it without touching the junction's target`, `error: "ENOENT: no such file or directory, open '...\demo-session-junction-pKv4at\pinned-core\kept.txt'"` | hash `2414BEF3…6F13`, `identical=True` |

The bytes after restoring match the bytes that passed the 10-row and 572-row runs, `check` and the
audit, so those were not rerun.

Cleanup and state:
- `packages/test-runner/dist-f-demo-cleanup` was removed (`Test-Path` → `False`).
- `demo-session-junction-*` directories left in `%TEMP%`: `0`.
- `git status --short -- packages/test-runner` shows
  `M packages/test-runner/src/demo-workspace/core-process.ts` and
  `?? packages/test-runner/src/demo-workspace/tests/`.
- Nothing was written to the shared `dist` directories. No failure needed a RAM rerun.

## Not verified

- **`withPersistentDemoCore` end to end.** It spawns the host build, domain setup and Core, so no unit
  test runs it. The helpers are tested; the wiring (the outer `runThenCleanUp` around start-up and
  the lane, the inner one around `supervisor.cleanup()` and `removeDemoSession`) was read, not
  exercised.
- **The Lab proof owed.** A Windows `pnpm demo:record` run in a worktree must show:
  - If the recording lane fails, the stderr JSON `message` carries the lane's own error (for
    example the no-new-recording failure) on line 1. The EBUSY appears only as a second line,
    `Demo session cleanup also failed: ...`, and only if the removal still fails after 8 attempts.
  - `web-extension-demo\.s\<id>` is gone after the run, pass or fail.
  - Every file under the pinned Core its junctions pointed at (`F:\fxlab\!FluxIQ\packages`) is
    intact.
- **Whether about 7 s of retries is enough under load.** `supervisor.cleanup()` does not wait for the
  whole tree to exit: `process-supervisor.ts:97-111` waits up to 2 s for the shell only, and I do
  not own that file. The retry covers grandchildren still releasing handles, but its size is not
  measured.
- **Junction handling elsewhere.** It is proven for `fs/promises` `rm` on Node v22.11.0 on Windows 10
  only. Another Node version (for example the C++ `rmSync` in later releases) is not covered.

## Open questions or contradictions found

1. **Removal still runs after "process remained active".** When `supervisor.cleanup()` throws, the
   removal still runs and retries, as before. If a Lab run still shows the removal failing after
   the retries, the fix belongs in `packages/test-runner/src/process-supervisor.ts`: wait for the
   tree, not only the shell, to exit. A brief for that should own that file.
2. **A small behaviour change beyond the brief.** When both the process cleanup and the removal fail
   with no lane error, the process-cleanup error is now kept and the removal is appended as
   `Demo session removal also failed: ...`. Before, the removal error replaced it. This applies
   task 1's rule inside the cleanup as well. It still "fails with the cleanup error", now both parts
   of it.
3. **Old leftover sessions are not swept.** Earlier sessions under `.s` (`l-stage3-demo` open
   question 4) are untouched: only the current run's session is removed. Deleting them still needs
   the non-recursive junction-first procedure that report describes, done by hand or by a separate
   brief. Nothing under `F:\fxlab-runs` was touched.
