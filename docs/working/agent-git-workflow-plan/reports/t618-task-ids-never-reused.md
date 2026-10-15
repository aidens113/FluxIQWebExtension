# t618 task-ids-never-reused: worker report

## Outcome

Done. Once an id has been allocated, no later start will hand it out again, in either repository.

## What changed and why

The allocator used to count only open `task/t<NNN>-` branches and `Merge task t<NNN>:` subjects. Abandoning a task deletes its branch and leaves no merge, so its number became free again. That is how t574, t598 and t616 were each reused.

Downstream (`C:/Users/osrs_/FluxStuff/fxwork/t618/!FluxIQWebExtension`):

- `scripts/task/task-id.mjs`: `nextTaskId` now also treats two more things as used:
  - every ref under `refs/fluxiq/task-ids/`, read with `git for-each-ref`;
  - every `Task: t<NNN>` trailer on any local branch, read with `git log --branches --format=%(trailers:key=Task,valueonly)`.

  A fresh clone has neither, so it falls back to scanning merges as before.
- New `scripts/task/task-id-ref-prefix.mjs` holds the `TASK_ID_REF_PREFIX` constant. Each file exports one thing.
- New `scripts/task/record-task-id.mjs` adds `recordTaskId(root, id, startPoint)`. It writes the ref `refs/fluxiq/task-ids/<id>` at `startPoint^{commit}` using `git update-ref <ref> <commit> ""`. The empty old value means git creates the ref only if it does not already exist. If two starts race for the same number, the second is refused before it creates anything, with the message "claimed ... by another start at the same moment".
- `scripts/task/start.mjs` calls `recordTaskId` right after the dry-run return and before anything is created. It records in this repository at `from`. For a `--core` task it also records in Core at `coreFrom`. A dry run records nothing.
- `scripts/task/index.mjs` exports `recordTaskId` and `TASK_ID_REF_PREFIX`.
- Abandon and prune were already ref-free (neither touches refs under `refs/fluxiq/`), so they needed no change.
- `docs/architecture/repository-layout.md` has a new section, "Task Ids Are Never Reused", placed before "Panel Commands".

Core (`C:/Users/osrs_/FluxStuff/fxwork/t618/!FluxIQ`) gets the same rule:

- `allocateTaskId` in `scripts/task/task-id.mjs` counts refs and trailers. Its refusal names the source: "the earlier allocation recorded as refs/fluxiq/task-ids/tNNN" or "a "Task: tNNN" trailer on a local branch".
- New `record-task-id.mjs` and `task-id-ref-prefix.mjs`, the same as downstream.
- `start.mjs` records at `startPoint` for both allocated ids and ids passed with `--id`.
- The barrel `index.mjs` exports both new names.
- `AGENTS.md` gets one paragraph in the branches section, the only place Core describes the task lifecycle. The brief named "Core's equivalent" without giving a path, so check that this was the intended file.

Tests:

- Downstream `scripts/task/tests/task-id.test.mjs` has three new tests:
  - a ref counts as used;
  - a trailer-only id counts as used;
  - a ref present only in Core blocks a paired allocation.
- Downstream new `scripts/task/tests/record-task-id.test.mjs` has six tests:
  - start writes the ref at `dev`;
  - a dry run writes no ref;
  - start, abandon, start again gives t001 then t002, and the ref survives;
  - paired: the ref is recorded on both sides, both branches are deleted, and the next id is new;
  - a ref present only in Core blocks a paired allocation;
  - recording the same id twice is refused.
- Core new `scripts/task/tests/record-task-id.test.mjs` has seven tests:
  - start writes the ref;
  - a dry run writes nothing;
  - start, abandon, start again gives a new id;
  - an abandoned id cannot be requested again with `--id`;
  - a ref written by a downstream paired start is counted;
  - a trailer counts as used, and the refusal names it;
  - recording the same id twice is refused.

Every test uses temporary repositories.

## Commands run and observed results

- Downstream `node --test "scripts/task/tests/*.test.mjs"`: 62 tests, 62 passed, 0 failed. This includes all 6 tests in `record-task-id.test.mjs`.
- Core `node --test "scripts/task/tests/*.test.mjs"`: 27 tests, 27 passed, 0 failed.
- Downstream `node scripts/structure-audit.mjs`: "structure-audit: passed (194 warning(s), 639 baselined)". I ran it before and after the docs edit and got the same result both times.
- Core `node scripts/structure-audit.mjs`: "structure-audit: passed (362 warning(s), 1156 baselined)".
- A read-only `nextTaskId` against the t618 worktree, paired with the t618 Core, returned `t619` in 1.6 s. This confirms the trailer scan works on real history and is fast enough.

## Not verified

- A real paired `startTask --worktree --core`. That path runs pnpm install and build, so the paired test drives `recordTaskId` and branch deletion directly instead of going through it. The `start.mjs` paired branch (`if (core) await recordTaskId(coreRepositoryRoot, id, coreFrom)`) is exercised only by reading it, not by a test.
- I did not run `pnpm task` against the real checkouts, as the brief required. No refs were backfilled for ids already spent and abandoned. Past abandoned ids are covered only if a branch still carries their trailers.

## Open questions or contradictions found

- The `directory-files` advisory for `scripts/task/` rose to 22 files downstream (it was 20) and 18 in Core (it was 16). It is a warning, not a failure, and there was already a warning before this change.
- The refs are local. A second clone of either repository does not see them unless they are pushed or fetched. The brief asked for local refs only.
- `AGENTS.md` in Core was the file I chose as "Core's equivalent". This needs confirming.
