# t418 — precommit branch and lifecycle refresh

## Verdict

**NO-GO to finish.** At the final pre-report observation on 2026-09-27 at
00:12:20 -07:00, both repositories were still on `task/t170-mvp-today-integration`, both task
refs still exactly equalled their local `dev`, and both trees were dirty. Thus `dev` has **not
moved since the task base in either repository**, but neither task yet has a commit to finish.
Read-only finish dry-runs refused with exit 1 before merge/check planning.

This audit did not fetch, edit product code, stage, commit, merge, finish, push, test, build, invoke a
provider, or perform browser/Lab/live work. Adding this report itself adds one downstream untracked
path after the counts below.

## Exact observed state

| Repository | Branch / HEAD = `dev` = merge-base | `dev...HEAD` | Full / collapsed porcelain | Index | Local `origin/dev...dev` |
| --- | --- | --- | --- | --- | --- |
| Downstream `F:\!FluxIQWebExtension` | `task/t170-mvp-today-integration` / `5b8429c543fdc27eb892c225641717aed43c5dc4` | `0 0` | 385 / 95: 76 modified, 309 untracked | empty | `0 51` |
| Core `F:\!FluxIQ` | `task/t170-mvp-today-integration` / `d035e1b7d17977951a2a2ec6b5e51570e3f2c537` | `0 0` | 222 / 179: 128 modified, 92 untracked, 1 staged deletion, 1 staged rename whose destination is worktree-modified | inherited partial index | `0 16` |

Both repositories have zero unmerged index entries and zero tracked paths matched by ignore rules.
The local remote-tracking refs were not fetched, so the 51/16 outgoing counts are observations, not
push clearance. Core's inherited cache remains the same two-entry partial index recorded by t408:

```text
D    packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure.ts
R100 packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/tests/generation-failure.test.ts -> packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts
```

The rename destination remains `RM`; committing the current index would omit its later worktree
edits. Preserve and complete this index in place—do not reset, restore, stash, clean, or reconstruct
it.

`pnpm task finish t170 --dry-run` refused downstream on 95 collapsed dirty entries and Core on 179,
both with the rule that task content must be committed to history. Each command exited 1. No task
finish side effect occurred. Because this is the same non-worktree topology t408 inspected, once
clean each repository must still be finished explicitly; there is no paired-Core continuation to
rely on.

## Ordered supervisor steps after the commits

1. Quiesce writers, require both trees clean, and record the resulting task commit IDs. Re-observe
   `dev`, task refs, unmerged entries, tracked-ignored paths, and Core/downstream linkage.
2. Compare each current `dev` with its recorded task base. At this audit both are unchanged. If
   either moves before finish, merge that `dev` into its task branch without rebase/squash, resolve
   there, and rerun the affected closure checks against the integrated bytes; otherwise record the
   equality proof.
3. From downstream, run `pnpm task finish t170 --dry-run`; then from Core run the same command. Both
   must resolve only `task/t170-mvp-today-integration` and be clean. A dry-run is only refusal
   screening; the real finish will still merge current `dev` and run its own `pnpm check`.
4. Run the real downstream `pnpm task finish t170` first. Only if it succeeds, run the real Core
   `pnpm task finish t170`. Do not use `--skip-checks` to bypass a product, type, structure,
   package, or integration failure.
5. Verify both checkouts end clean on `dev`, each local t170 branch is absent, each expected
   `Merge task t170: mvp-today-integration` first-parent merge exists, and the recorded task commits
   are ancestors of their corresponding merge.
6. Fetch both remotes only after both local finishes. Audit inbound divergence and every commit in
   the complete outgoing ranges; stop on unexplained history or a non-fast-forward condition.
7. If the coherent-pair audit passes, push Core `dev` first and downstream `dev` second. If Core
   push fails, do not push downstream; never force, rewrite history, push `main`, or delete remote
   refs without the separately required approval.

## Stop conditions

The current blockers are the dirty trees, absent t170 task commits, and Core's incomplete partial
index. Any later movement of `dev`, unexpected staged path, unmerged entry, tracked ignored path,
omitted `RM` destination edits, failed closure/finish check, unexpected merge subject, or unexplained
outgoing commit requires renewed review rather than proceeding by assumption.
