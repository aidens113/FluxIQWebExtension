# t345 — Final integration and partial-index recovery refresh

Status: **Procedure ready; NO-GO to stage or commit until run 4 is finalized and the tree is frozen**

Metadata captured at `2026-09-27T05:40:39.1664828Z` while run 4 was still in flight. This audit read t318, t322, t335, and Git metadata only. It did not open `test-runs` or artifacts, read changed-file contents, mutate either index/worktree, run validation/live commands, or commit.

## Current topology

| Repository | Branch | HEAD | `dev...HEAD` | Dirty scope before this report |
| --- | --- | --- | --- | --- |
| Downstream `F:\!FluxIQWebExtension` | `task/t170-mvp-today-integration` | `5b8429c543fdc27eb892c225641717aed43c5dc4` | `0 0` | 309 entries: 68 modified, 241 untracked, 0 staged |
| Core `F:\!FluxIQ` | `task/t170-mvp-today-integration` | `d035e1b7d17977951a2a2ec6b5e51570e3f2c537` | `0 0` | 206 entries: ` M` 116, `??` 88, `D ` 1, `RM` 1; 2 staged |

There is exactly one local `task/t170-*` branch in each repository. Neither branch has an upstream. No other worktree reports either t170 branch or `dev` checked out. The task refs still equal local `dev`; all campaign work remains uncommitted.

Downstream top-level scope is `apps` 26, `domain` 44, `packages` 52, and `docs` 187. The 122 non-doc paths exactly equal t335's 73 production plus 49 tests; growth since t335 is documentation-only. Core's 206-entry scope and staged pair remain unchanged from t318/t335.

The local tracking refs still show downstream `origin/dev...dev = 0 51` and Core `origin/dev...dev = 0 16`. No fetch was performed, so these are not claims about current remote state. Any eventual push includes pre-t170 local history and requires an outgoing-range review.

## Stop before index recovery

Do not stage anything until all of the following are true:

1. Run 4 has ended; no Lab/test-runner/Scenario-Lab/campaign-browser process or build lock remains.
2. The run-4 pending debug is either safely renamed and finalized against an accepted bundle or explicitly retained under the no-safe-id/facility rule. It is never silently dropped or committed ambiguously.
3. Run 4 is fully classified, the repeated-Stage-2 stop rule is applied if triggered, and both plans/ledgers/indexes are settled.
4. Final documentation consistency, sensitive-value, forbidden-artifact, and pending-placeholder scans pass.
5. All agents have stopped editing both repositories and the supervisor has captured a fresh branch/HEAD/status identity.

Any failure above is a hard stop. Do not use staging as a way to freeze an unsettled live/debug state.

## Non-destructive Core index recovery

The inherited Core index contains exactly:

```text
D    packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure.ts
R100 packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/tests/generation-failure.test.ts -> packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts
```

The rename destination also has unstaged edits (`RM` in short status). An immediate commit would therefore omit those edits and almost all other work.

After the tree is frozen, the supervisor can clear only this inherited index state without changing any working file:

```powershell
Set-Location -LiteralPath 'F:\!FluxIQ'
git diff --cached --name-status
git restore --staged -- `
  'packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure.ts' `
  'packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/tests/generation-failure.test.ts' `
  'packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts'
git diff --cached --quiet
git status --short --untracked-files=all
```

Proceed only if the first command shows exactly the two entries above and `git diff --cached --quiet` returns exit 0 afterward. `git restore --staged` changes the index only: the deleted source paths remain deleted in the worktree, the destination retains its latest worktree content, and untracked files remain untouched. Stop if the staged set has changed; re-inventory it instead of applying this stale three-path recovery.

Do not use `git reset --hard`, checkout-based restoration, clean, stash, or deletion. A broad mixed reset is unnecessary. Never discard the `RM` destination's unstaged content.

## Explicit restaging method

Build a reviewed, repository-specific path manifest from the final frozen status. Keep any temporary manifest outside both repositories. Then:

1. Partition paths by the ownership groups below.
2. Stage only explicit pathspecs with `git add -- <reviewed paths>` (including both old and new paths for moves/deletions). Do not use `git add -A`, a repository-root wildcard, or an unreviewed status expansion.
3. After each partition, compare `git diff --cached --name-status` exactly with its manifest, inspect `git diff --cached --stat`, review the staged patch, and run staged/scoped `git diff --check`.
4. Require no `.fluxiq`, `test-runs`, browser profile/state, credential, build/dist output, domain test/script build, `.next`, database, or other forbidden runtime path in the index.
5. Stage `.structure-baseline.json` only with the Core structural source move it records. Stage no ignored generated output.
6. Commit only after the staged set is a complete coherent partition and its relevant settled-tree validation is accepted.

If an unexpected path appears, unstage that exact path with `git restore --staged -- <path>`, preserve its worktree content, investigate, and re-review the complete staged manifest. Never repair a staging mistake by resetting or checking out user changes.

## Commit partition and validation order

Only the senior supervisor commits. Every task commit uses `Task: t170` and the applicable `Worker:` trailer; worker history is not squashed.

### A. Core task-branch commits first

Core owns generic Automation Studio contracts/runtime, permissions/execution, Flow Bootstrap and failure structure, provider retry/evidence/grant continuation, result verification/repair wiring, colocated tests, Core package metadata, Core architecture, and its structure baseline.

Partition Core by coherent behavior plus its tests rather than by tracked/untracked status. Structural moves, their barrels/tests, and `.structure-baseline.json` stay together. Architecture may be a following documentation commit once it describes the final API. Do not split a production seam from the test or barrel that makes it valid merely to reduce commit size.

After Core commits, record the exact Core commit and run/accept Core's required checks on that committed tree. Core must remain checked out beside downstream so downstream validation resolves the exact dependency.

### B. Downstream task-branch commits second

Downstream owns extension/domain/test-contract/test-evidence/Scenario-Lab/test-runner production and tests, plus downstream architecture. Commit the production/test compatibility unit against the recorded Core commit, after the required downstream checks/build/freshness gates pass.

Keep the live-campaign documentation partition distinct: finalized run debugs, two active plans/ledgers, working index/archive, architecture reconciliation, and worker reports. Stage it only after final consistency and sensitive-value scans. Never stage `test-runs`; the sanitized authored debug/report is the commit surface, not the bundle.

After all intended downstream commits, both repositories must be completely clean, including untracked paths. Re-run the final cross-repository identity and outgoing-manifest review. A clean tree is required by task finish; stashing is not a substitute for deciding ownership.

## Task finish order

Commit order is Core first for dependency stability, but **finish/merge order remains downstream first** because downstream's finish validation needs the sibling Core task checkout:

```powershell
Set-Location -LiteralPath 'F:\!FluxIQWebExtension'
pnpm task finish t170 --dry-run

Set-Location -LiteralPath 'F:\!FluxIQ'
pnpm task finish t170 --dry-run
```

Both dry runs must resolve only `task/t170-mvp-today-integration`, report no dirty/worktree conflict, and make no change. Then run:

```powershell
Set-Location -LiteralPath 'F:\!FluxIQWebExtension'
pnpm task finish t170

Set-Location -LiteralPath 'F:\!FluxIQ'
pnpm task finish t170
```

Each ordinary finish merges local `dev` into the task, runs that repository's `pnpm check`, merges the task into `dev` with `Merge task t170: mvp-today-integration`, and removes the local task branch. Do not use `--skip-checks` for a product/type/structure/integration failure.

Downstream refusal, conflict, or check failure stops Core finish. If downstream succeeds and Core later fails, leave downstream's local merge intact, repair only Core on its task branch, and push neither repository until both finishes are coherent.

## Push preconditions and order

Before push, verify in both repositories: HEAD is `dev`; status is clean; the local t170 branch is gone; first-parent history contains the expected merge; current remote state has been fetched safely; and the complete `origin/dev..dev` range contains only intended validated history. A fetch or concurrent branch movement invalidates earlier divergence evidence and requires a fresh review.

Only the senior supervisor may push. Push Core first, then downstream, as one work unit:

```powershell
git -C 'F:\!FluxIQ' push origin dev
git -C 'F:\!FluxIQWebExtension' push origin dev
```

If Core push fails, do not push downstream. If Core succeeds and downstream fails, report the temporary compatibility mismatch and retry only the ordinary downstream push after resolving the non-history-rewriting cause. Never force-push, rewrite history, or delete remote refs without explicit user approval.

## Exact recovery stops

- Run 4/live/debug/docs not finalized: no staging.
- Core cached set differs from the exact two-entry snapshot: no scripted unstage; re-inventory.
- Any index/worktree content loss, conflict, forbidden artifact, credential/sensitive match, pending placeholder, or unexpected scope: stop and preserve state.
- A staged manifest differs from the reviewed manifest or line-ending churn obscures the patch: unstage exact affected paths and investigate.
- Required validation fails after commits or `dev` integration: do not finish the other repository and do not push.
- Finish reports an unexpected branch, merge subject, dirty tree, worktree conflict, or partial application: inspect HEAD/refs/merge state before any retry; never blindly rerun or abandon.
- Outgoing history contains an unexplained pre-t170 commit: no push until reviewed.
- Any concurrent edit or branch movement: freeze again and repeat identity/dry-run checks.

This report is t345's only write.
