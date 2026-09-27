# t322 — Exact paired-task finish sequence for t170

Status: **Procedure established; finish is currently blocked by uncommitted work in both repositories**

No lifecycle command, check, stage, commit, merge, push, or run-artifact read was performed.

## Current topology

| Repository | Checkout | Current branch | Separate t170 worktree | `dev...task/t170-*` |
| --- | --- | --- | --- | --- |
| Downstream | `F:\!FluxIQWebExtension` | `task/t170-mvp-today-integration` | no | `0 0` |
| Core | `F:\!FluxIQ` | `task/t170-mvp-today-integration` | no | `0 0` |

Both task refs currently equal their local `dev` refs; all t170 work is still in the index/worktrees rather than task-branch commits. Both trees are dirty, so even `pnpm task finish t170 --dry-run` currently refuses. Core also retains the mixed staged deletion/rename state identified by t318.

No other worktree holds either t170 branch, and no worktree currently holds `dev` in either repository. The many Lab worktrees are detached or hold other task branches and do not presently block t170 by ref.

Local `dev` is already ahead of the last locally known `origin/dev` in both repositories:

- downstream: `origin/dev...dev = 0 51`;
- Core: `origin/dev...dev = 0 16`.

No fetch was performed, so this is local tracking-ref evidence only. A later `git push origin dev` would publish those existing commits as well as t170; verify that full outgoing range before pushing.

## Why the sequence is explicit

t170 is a paired branch but not a nested downstream `--core` worktree pair. The downstream implementation calls `pairedCore(...)` only when the downstream task has its own separate worktree. Here `locateTask(...)` treats the main checkout as a flat task and returns `worktree: null`, so downstream finish will report `core: null` and will not print or execute the Core continuation.

The operator must therefore run two explicit finish commands. Downstream remains first because its validation resolves/builds against the sibling Core checkout; Core must remain on the t170 implementation until downstream integration validation finishes. Core then closes under Core's own task implementation and gates.

## Preconditions before either finish command

The supervisor must satisfy all of these first:

1. Run 3 has ended and is fully classified; its pending debug is renamed/finalized or explicitly retained under the no-safe-run-id rule.
2. Final authored docs, ledgers, reports, and sensitive-value/forbidden-artifact review are complete.
3. Core's mixed staged state is normalized deliberately; no partial delete/rename remains accidentally staged.
4. Every intended change is reviewed and committed on `task/t170-mvp-today-integration` in its owning repository. Each task commit carries `Task: t170` and the applicable `Worker:` trailer. Do not squash worker history.
5. Both repositories are completely clean, including untracked files. The finish implementations refuse any dirty/untracked entry; stashing is not a substitute for deciding whether a file belongs to t170.
6. Each repository has exactly one `task/t170-*` branch, and it is `task/t170-mvp-today-integration`.
7. Neither t170 nor `dev` is checked out in another worktree. Core checks both conditions before changing state.
8. No agent or process will move either local `dev` or modify either worktree during finish.
9. Required final validation evidence is accepted. The ordinary finish commands below run `pnpm check` again after integrating `dev`; previously passed checks do not make a dirty tree finishable.
10. Review `origin/dev..dev` in both repositories before any eventual push because the outgoing scope already predates t170.

After commits and cleanliness are established, these optional read-only decision commands should return `applied:false` without refusal:

```powershell
Set-Location -LiteralPath 'F:\!FluxIQWebExtension'
pnpm task finish t170 --dry-run

Set-Location -LiteralPath 'F:\!FluxIQ'
pnpm task finish t170 --dry-run
```

Do not proceed if either dry run refuses or resolves a different branch/merge subject.

## Exact finish commands and order

### 1. Finish downstream first

```powershell
Set-Location -LiteralPath 'F:\!FluxIQWebExtension'
pnpm task finish t170
```

With no title argument, the expected merge subject is exactly:

```text
Merge task t170: mvp-today-integration
```

The downstream command performs, in order:

1. locate the unique t170 branch and refuse a dirty tree;
2. stay on/check out the task branch;
3. merge local `dev` into the task with `git merge --no-edit dev`;
4. run `pnpm check` in the downstream root, with provider-secret environment entries removed and workspace concurrency set to one;
5. check out `dev`;
6. merge the task with `--no-ff` and the subject above;
7. delete the local task branch.

Because this is a flat main checkout, it removes no worktree and returns no paired-Core continuation. Verify the result is `applied:true`, validation passed, HEAD is `dev`, the tree is clean, and the local downstream t170 branch is gone before touching Core.

### 2. Finish Core only after downstream succeeds

```powershell
Set-Location -LiteralPath 'F:\!FluxIQ'
pnpm task finish t170
```

The expected Core merge subject is also:

```text
Merge task t170: mvp-today-integration
```

Core performs, in order:

1. locate the unique t170 branch;
2. refuse if t170 is checked out elsewhere, `dev` is checked out elsewhere, or the tree is dirty;
3. stay on/check out the task branch;
4. merge local `dev` into the task with `git merge --no-edit dev`;
5. run Core `pnpm check`;
6. check out `dev`;
7. merge the task with `--no-ff` and the subject above;
8. delete the local task branch.

Verify `applied:true`, validation passed, HEAD is `dev`, the tree is clean, and the local Core t170 branch is gone.

## `--skip-checks` policy

The scripts accept `--skip-checks`, but it is not the normal finish command and must not silently replace the integration gate. Use it only if the supervisor has a specific, recorded, known-unrelated environment failure and has accepted equivalent settled-tree validation. If that exception is required, preserve the same ordering:

```powershell
Set-Location -LiteralPath 'F:\!FluxIQWebExtension'
pnpm task finish t170 --skip-checks

Set-Location -LiteralPath 'F:\!FluxIQ'
pnpm task finish t170 --skip-checks
```

Never use `--skip-checks` to bypass a product, type, structure, package, or integration failure.

## Recovery stops

### Refusal before merge

- Dirty/untracked tree, duplicate/missing branch, or conflicting worktree: stop and correct the named condition. Do not start the other repository's finish.
- A dry-run refusal changes nothing; re-run it only after the precondition is genuinely fixed.

### `dev` integration conflict

The repository remains on the task branch with the merge unresolved. Do not continue to validation, do not start the other repository, and do not push. Review and resolve the conflict, commit the integration resolution with the t170 trailer, then rerun finish. If abandoning the attempted integration is necessary, use the ordinary non-destructive merge-abort path only after confirming the exact repository state; never reset hard.

### `pnpm check` failure

The task branch already contains the merge from `dev`, but nothing has been merged into `dev`. Fix the failure on the task branch, commit it, and rerun finish. Use `--skip-checks` only under the documented exception above. Downstream failure stops Core finish.

### Failure after validation or during merge/delete

Inspect HEAD, refs, merge state, and status before retrying. Do not blindly rerun and do not run `abandon`: `dev` may already contain the task merge even if local branch deletion failed. Finish the remaining safe local cleanup only after proving what applied.

### Downstream succeeded; Core failed

Leave the downstream merge local. Repair Core on its t170 branch and rerun only Core finish. Push neither repository until Core also completes and the pair is coherent. Do not revert the downstream merge merely because Core needs another local correction.

### Concurrent branch movement

Stop if another actor moves `dev`, checks either target branch out elsewhere, or edits either tree during finish. Re-establish branch/worktree identity and repeat the dry-run decision before continuing.

## Post-finish verification and push order

After both commands succeed, verify in each repository that:

- HEAD is `dev`;
- status is clean;
- `task/t170-mvp-today-integration` no longer exists locally;
- first-parent history contains `Merge task t170: mvp-today-integration`;
- the outgoing `origin/dev..dev` range contains only intended, validated history.

Only the senior supervisor may push. If all push conditions remain satisfied, publish both `dev` branches in one work unit, Core first so downstream is never remotely visible before its framework dependency:

```powershell
git -C 'F:\!FluxIQ' push origin dev
git -C 'F:\!FluxIQWebExtension' push origin dev
```

If the Core push fails, do not push downstream. If Core succeeds and downstream fails, report the temporary mismatch and retry the ordinary downstream push after resolving the non-history-rewriting cause. Never force-push, delete a remote branch, or rewrite history without explicit user approval.

## Sources

- Downstream `package.json`, `scripts/task/run-task.mjs`, `finish.mjs`, `locate.mjs`, `paired-core.mjs`, command-option parsing, repository-layout guidance, and agent Git workflow plan.
- Core `AGENTS.md`, `package.json`, `scripts/task/run-task.mjs`, `finish.mjs`, `locate.mjs`, and check command.
- Read-only branch, divergence, status, and worktree metadata from both repositories.
