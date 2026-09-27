# t408 — task-finish readiness audit

## Verdict

**NO-GO to finish or push now.** Both repositories are still on
`task/t170-mvp-today-integration`, and in both repositories that branch still points at the same
commit as `dev`. All t170 changes therefore remain in the working trees rather than task-branch
history. Read-only `pnpm task finish t170 --dry-run` refuses on both sides because they are dirty.

This was a read-only lifecycle audit. I did not stage, commit, merge, finish, push, fetch, delete,
test, build, invoke a provider, inspect ignored runtime contents, or run browser/Lab/live work.

## Current observed state

Observed on 2026-09-27 from the main checkout of each repository (before this report was added):

| Repository | Branch / HEAD | `dev...HEAD` | Porcelain `-uall` | Index | Local `origin/dev...dev` |
| --- | --- | --- | --- | --- | --- |
| Downstream `F:\!FluxIQWebExtension` | `task/t170-mvp-today-integration` / `5b8429c543fdc27eb892c225641717aed43c5dc4` | `0 0` | 375 paths: 76 modified, 299 untracked | empty | `0 51` |
| Core `F:\!FluxIQ` | `task/t170-mvp-today-integration` / `d035e1b7d17977951a2a2ec6b5e51570e3f2c537` | `0 0` | 222 paths: 128 modified, 92 untracked, 2 staged | inherited partial index | `0 16` |

Neither repository has an unmerged index entry, and neither currently tracks a path matched by its
ignore rules. The local `origin/dev` comparisons were not refreshed from the network, so they are
not yet a push authorization.

Core's inherited cache remains exactly the deletion plus rename recorded by t386/t399:

```text
D    packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure.ts
R100 packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/tests/generation-failure.test.ts -> packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts
```

The rename destination is still modified in the worktree (`RM`). An immediate commit would omit
its later edits. Do not reset, restore, stash, clean, or otherwise reconstruct this index.

The task CLI has no `--help` command; its entry-point usage text and option table are authoritative.
`finish` accepts `--dry-run`, `--skip-checks`, and `--allow-running`. Every task command supports
`--dry-run`. On this non-worktree t170 topology, a clean dry-run will report no paired-Core
continuation, so the supervisor must finish downstream and Core explicitly. The real finish merges
`dev` into the task, runs `pnpm check` with provider secrets removed and workspace concurrency 1,
merges the task into `dev` with `--no-ff`, and deletes the local task branch. The dry-run decides
refusals but does not simulate those merge/check effects.

## Exact supervisor sequence after the closure validation

### 1. Freeze and bind validation to the candidate bytes

1. Stop editors/workers and confirm no validation or live process is reading either checkout.
2. Re-observe both branch names, HEADs, full non-ignored status, unmerged entries, the Core cache,
   Core link identity, and the allowed candidate manifests. Any path not allowed by t399 needs an
   explicit scope decision and a fresh staged-path review.
3. Require the final downstream closure, freshness/identity checks, generated-reference review,
   privacy/pending/conflict-marker review, and Current State reconciliation to be complete and
   recorded. The current MVP Current State still says downstream closure and reconciliation are in
   progress.
4. Preserve a manifest/hash of the exact validated candidates. Any later source, test, config,
   generated reference, architecture, or working-document edit invalidates the relevant gate.

### 2. Commit Core first

Run t399 Gates 1 and 2 first. Complete the inherited Core index in place with deletion-aware
pathspecs:

```powershell
Set-Location -LiteralPath 'F:\!FluxIQ'
git add -A -- `
  '.structure-baseline.json' `
  'apps/web/src/features/automation-studio/runtime/tests/run-permission-request.test.tsx' `
  'packages/fluxiq/package.json' `
  'packages/fluxiq/src'
```

For this and every later group, run t399 Gate 3: cached name-status/stat/check, unmerged and ignored
checks, repository-specific forbidden-path rejection, added-line sensitive/pending scan without
printing matching content, full staged-patch review, and a proof that no unstaged change remains
inside the group's pathspecs. Then commit these Core groups in order:

1. implementation/tests plus `.structure-baseline.json`;
2. the three authored architecture files;
3. exactly the two equal generated framework-reference mirrors.

Every commit carries `Task: t170`. Add one `Worker: <actual-producing-agent-label>` trailer for
each worker whose authored bytes are in that commit; never credit review-only agents or t408.
Packing provenance recorded by t386 includes t370, t372, t375, t377, and t378, but the supervisor
must use the ledger to attribute every other slice rather than guess. A supervisor-only
reconciliation commit has `Task: t170` and no invented `Worker:` trailer.

Require Core clean after the three groups and record the resulting Core task commit identity. This
Core-first commit order gives downstream validation a stable framework dependency; it does not
mean Core is finished or merged first.

### 3. Commit downstream second

Stage only explicit ownership groups, applying t399 Gate 3 before each commit:

1. `apps/extension/**` plus `domain/**` as the browser/domain contract group;
2. `packages/test-contracts/**` plus `packages/test-runner/**` as the facility contract group;
3. exactly the four architecture files listed by t386;
4. the reviewed authored working-document set: `docs/working/README.md`, the language-driven plan
   and its sanitized Markdown records, `docs/working/mvp-today-plan.md`, and sanitized Markdown
   under `docs/working/mvp-today-plan/**`, including this report.

Every downstream commit likewise carries `Task: t170` and only the applicable actual producing
`Worker:` trailers. Never root-add. Raw run bundles, logs, browser state, captures, recordings,
provider/page payloads, `.fluxiq`, `test-runs`, build output, or other t399 exclusions must not enter
the index. Require a clean downstream tree and record its task commit identity.

### 4. Integrate current `dev` before finish

The repository rule is stronger than merely having validated the pre-integration tree: each task
must contain current `dev`, and the affected checks must pass on that integrated commit.

1. Re-observe `dev` in both repositories. At this audit it is the task base on both sides, but that
   can change before closure.
2. Merge each repository's `dev` into its t170 task branch without rebasing or squashing. Resolve
   any conflict on the task branch and record any resulting merge commit. If `dev` moved, rerun the
   affected narrow checks and the final validation required by the closure matrix against the
   integrated trees. If it did not move, record the identity proof.
3. Require both trees clean and quiescent. Run, in this order:

```powershell
Set-Location -LiteralPath 'F:\!FluxIQWebExtension'
pnpm task finish t170 --dry-run
Set-Location -LiteralPath 'F:\!FluxIQ'
pnpm task finish t170 --dry-run
```

Both must resolve only `task/t170-mvp-today-integration`. Because t170 is not a separate paired
worktree, both dry-runs should report `worktree: null`, `core: null`, and `applied: false`. A clean
dry-run is necessary but not sufficient: the real finish still performs its own `dev` merge and
`pnpm check`. Do not use `--skip-checks` for a product, type, structure, package, or integration
failure.

### 5. Finish downstream first, then Core

```powershell
Set-Location -LiteralPath 'F:\!FluxIQWebExtension'
pnpm task finish t170
Set-Location -LiteralPath 'F:\!FluxIQ'
pnpm task finish t170
```

The expected merge subject in each repository is
`Merge task t170: mvp-today-integration`. If downstream finish refuses or fails, do not finish Core.
If downstream merges locally and Core then fails, preserve the downstream merge, repair and
revalidate Core, and push neither repository.

After both succeed, verify in each repository: HEAD is `dev`; status is clean; the local t170
branch is absent; the expected first-parent merge exists; and the recorded task commits are
ancestors of that merge.

### 6. Refresh and push the coherent pair

Fetch current remote refs in both repositories, inspect inbound divergence, and review every commit
in the complete outgoing ranges. The presently known 51 downstream and 16 Core commits predate
t170; any unexplained commit or non-fast-forward condition is a stop, not a reason to force.

Push only after both local finishes and outgoing audits pass, Core first and downstream second:

```powershell
git -C 'F:\!FluxIQ' push origin dev
git -C 'F:\!FluxIQWebExtension' push origin dev
```

If Core push fails, do not push downstream. If Core succeeds and downstream fails, report the
temporary remote mismatch and retry only the ordinary downstream push after resolving its cause.
Never force-push, rewrite history, push `main`, open a PR to `main`, or delete a remote branch/tag
without the required explicit user approval.

## Current blockers and stop conditions

- Downstream has 375 dirty paths and no staged task content; Core has 222 dirty paths.
- Core's two-entry partial index is not commit-ready until completed in place.
- Both task refs still equal `dev`; there is no t170 commit history to finish.
- Current dry-runs refuse on 95 collapsed downstream status entries and 179 collapsed Core status
  entries before reaching their merge/check planning.
- The authored Current State still records downstream root/freshness/identity closure,
  generated/staged-path review, and Current State reconciliation as unfinished.
- Candidate counts have grown since t399, so its frozen manifest must be refreshed, not assumed.
- Remote refs have not been fetched for this audit; the 51/16 outgoing counts are local observations,
  not a push clearance.
- Any post-validation edit, unexpected staged path, changed inherited cache, omitted `RM`
  destination bytes, sensitive/pending finding, raw/generated runtime artifact, partial reference
  mirror, failed post-`dev` gate, finish refusal, unexpected merge subject, or unexplained outgoing
  commit remains a hard stop.
