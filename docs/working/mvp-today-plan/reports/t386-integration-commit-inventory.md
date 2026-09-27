# t386 — integration commit inventory

## Readiness verdict

**NO-GO to commit, finish, or push today.** The integration procedure is deterministic, but the
current trees are not closure-ready. Core's provider-free packing gate is worker-reported green in
t379, while t385 is still `HELD` waiting for the supervisor's explicit t379 release and therefore
has run none of the required downstream propagation, package/root, build, or freshness checks.
Both task refs still equal `dev`; every t170 change remains in the two dirty trees. Core also still
has the inherited partial index containing the generation-failure deletion and rename only.

No test, build, provider, browser, panel, Lab, live, stage, commit, finish, fetch, or push command
was run for this inventory.

## Observed topology and index state

| Repository | Branch / HEAD | `dev...HEAD` | Current status | Local `origin/dev...dev` |
| --- | --- | --- | --- | --- |
| downstream `F:\!FluxIQWebExtension` | `task/t170-mvp-today-integration` / `5b8429c543fdc27eb892c225641717aed43c5dc4` | `0 0` | 354 entries: 76 modified, 278 untracked, none staged | `0 51` |
| Core `F:\!FluxIQ` | `task/t170-mvp-today-integration` / `d035e1b7d17977951a2a2ec6b5e51570e3f2c537` | `0 0` | 218 entries: 124 modified, 92 untracked, one staged deletion, one staged rename with unstaged destination edits | `0 16` |

Each repository has exactly one t170 branch and it is the current main checkout, not a separate
task worktree. `pnpm task list` reports t170 ahead 0 / behind 0 and no separate task worktree on
both sides. Consequently downstream `pnpm task finish t170` will return no paired-Core
continuation; the supervisor must finish the two repositories explicitly.

Core's exact cached state is still:

```text
D    packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure.ts
R100 packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/tests/generation-failure.test.ts -> packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts
```

The destination is `RM`, so its current worktree contains later provenance/instrumentation and
t370 fixture edits that are absent from the cached rename. An immediate commit would lose those
edits from that commit. There are no unmerged index entries and current unstaged `git diff --check`
passes, with line-ending conversion warnings only.

## Hard holds before staging

The supervisor must freeze both trees and satisfy all of these first:

1. Explicitly release t385 after personally accepting t379's Core result. Let t385 complete the
   downstream-only serial matrix and return a recorded GO. At minimum this must include the exact
   Core link/runtime identity, downstream rebuild, progress/privacy/accounting tests, package and
   root gates, and six freshness comparisons described in t385/t373.
2. Close any remaining Core root gates from t373 that t379 did not run. T379 proves focused 145/145,
   the 3,138-test runtime suite, `fluxiq` package check, and package build; it does not record Core
   root `pnpm check`, root `pnpm test`, root `pnpm build`, or `pnpm docs:check` as completed.
3. Reconcile the Core architecture text and both working-document Current States to the actual
   final Core/downstream results. Preserve the distinction between provider-free closure and the
   still-missing newly authorized live proof.
4. Stop all editors/workers and confirm no validation or live process is reading either tree.
   Capture fresh branch, HEAD, full status, link identity, and candidate manifests. Any path added
   after this report must be assigned deliberately before staging.
5. Complete the final sensitive-value, pending-placeholder, conflict-marker, and forbidden-artifact
   reviews over the authored commit candidates. Never inspect or add raw run bundles to make this
   pass.
6. Require the validated files to be byte-identical to the files about to be staged. If a source,
   test, config, or architecture file changed after its gate, rerun the affected validation before
   committing.

The lack of a new live/provider run is not by itself a blocker to committing this provider-free
fix-first unit. It remains a blocker to claiming the MVP/live behavior is proven or authorizing an
unchanged run 5.

## Safe staging and task-branch commit sequence

Only the senior supervisor performs these operations. Commit Core first so downstream validation
and commits name a stable framework dependency. Do not clear Core's partial index with reset,
checkout, stash, or clean.

### 1. Core implementation and tests

First verify the cached pair is still exactly the two entries above. Then complete that index in
place with deletion-aware, reviewed pathspecs:

```powershell
Set-Location -LiteralPath 'F:\!FluxIQ'
git diff --cached --name-status
git add -A -- `
  '.structure-baseline.json' `
  'apps/web/src/features/automation-studio/runtime/tests/run-permission-request.test.tsx' `
  'packages/fluxiq/package.json' `
  'packages/fluxiq/src'
git diff --cached --name-status
git diff --cached --stat
git diff --cached --check
git diff --name-only -- `
  '.structure-baseline.json' `
  'apps/web/src/features/automation-studio/runtime/tests/run-permission-request.test.tsx' `
  'packages/fluxiq/package.json' `
  'packages/fluxiq/src'
```

This deliberately stages the old deleted path, renamed destination, and the destination's complete
current worktree bytes together; it does not unstage or reconstruct the inherited rename. The last
command must print nothing. Review the full staged patch and require the generation-failure move,
replacement directory, barrels, tests, projection/provenance work, packing work, and structure
baseline to be complete. Git may redisplay the move as a delete/add after content changes; path and
content completeness, not the similarity score, is the invariant.

Commit one or more coherent implementation groups only if the supervisor has an exact reviewed
manifest for every group. If retaining the older C1-C5 partition from t183/t203, stage and commit
the already-cached C2 group first, or explicitly unstage only the three old/destination pathspecs
before staging C1. The single implementation-and-tests staging block above is safer because it
cannot contaminate an earlier group or omit the `RM` destination edits.

Every task-branch commit uses the task id of the integration branch, not a report/subtask id:

```text
Task: t170
Worker: <actual producing agent label>
```

Use one repeated `Worker:` trailer per worker whose authored change is present in that commit;
review-only agents are not authors. For the final packing slice, the producing/revising labels
recorded by the reports include t370, t372, t375, t377, and t378. Preserve the existing provenance
ledger for the older t170 implementation instead of guessing labels or attributing the whole unit
to t386. A supervisor-only reconciliation commit needs `Task: t170` but no invented worker.

### 2. Core authored architecture

After implementation is committed, stage exactly the three current Core architecture candidates:

```powershell
git add -- `
  'docs/architecture/automation-studio.md' `
  'docs/architecture/automation-studio/llm-flow-bootstrap.md' `
  'docs/architecture/package-boundaries.md'
git diff --cached --name-status
git diff --cached --stat
git diff --cached --check
```

Commit them with `Task: t170` and only the applicable actual author `Worker:` trailers. Require a
clean Core status, including no untracked source/test file, before proceeding downstream.

### 3. Downstream implementation and tests

Stage reviewed ownership groups, not the repository root. Current non-doc candidates are exactly
`apps/extension` (26), `domain` (44), `packages/test-contracts` (3), and
`packages/test-runner` (57). Commit the browser/domain contract together, then the test-contract /
test-runner contract together:

```powershell
Set-Location -LiteralPath 'F:\!FluxIQWebExtension'
git add -A -- 'apps/extension' 'domain'
# inspect cached name-status, stat, patch, and diff --check; then commit

git add -A -- 'packages/test-contracts' 'packages/test-runner'
# inspect cached name-status, stat, patch, and diff --check; then commit
```

Each commit carries `Task: t170` plus the applicable repeated `Worker:` author trailers. Before
each commit, compare the cached paths to the frozen manifest and require no remaining unstaged path
inside that group's pathspecs.

### 4. Downstream architecture and authored working record

Stage the four architecture candidates explicitly, then stage the reviewed working-document set:

```powershell
git add -- `
  'docs/architecture/failure-taxonomy.md' `
  'docs/architecture/sensitive-values.md' `
  'docs/architecture/testing-facility.md' `
  'docs/architecture/web-capabilities.md'
# inspect and commit with Task: t170 and applicable Worker trailers

git add -A -- `
  'docs/working/README.md' `
  'docs/working/language-driven-flow-loop-plan' `
  'docs/working/mvp-today-plan.md' `
  'docs/working/mvp-today-plan'
# inspect and commit only after the final sensitive/pending/artifact review
```

The last group includes finalized run debug Markdown, archive material, worker reports through this
inventory, and the two Current States. They are authored records, not raw run artifacts. Require
both repositories clean after all commits, rerun the final required validation against those exact
commits where the closure matrix demands it, and record both commit identities.

## Generated, ignored, and authored distinctions

- Never stage downstream `.fluxiq/**`, `test-runs/**`, `apps/extension/dist/**`,
  `apps/extension/build/**`, `domain/dist/**`, `domain/.test-build/**`, or
  `domain/.script-build/**`. They are ignored generated/runtime evidence even when rebuilding them
  is required for validation.
- Never stage Core `.fluxiq/**`, package `dist/**`, or `apps/web/.next/**`. Core build output remains
  ignored.
- Core `.structure-baseline.json` is tracked generated structural metadata. It belongs in the same
  implementation commit as the structural move it describes and must not be regenerated or edited
  by hand during integration.
- Sanitized authored debug/report Markdown under `docs/working/**` is commit material after review;
  raw `test-runs`, browser profiles, recordings, screenshots, logs, and provider/page data are not.

## Finish, merge, and push order

After both task branches are committed, clean, fully validated, and quiescent, make both read-only
decisions first:

```powershell
Set-Location -LiteralPath 'F:\!FluxIQWebExtension'
pnpm task finish t170 --dry-run
Set-Location -LiteralPath 'F:\!FluxIQ'
pnpm task finish t170 --dry-run
```

Both must resolve only `task/t170-mvp-today-integration`. Then finish **downstream first**, because
its integration check consumes the sibling Core task checkout, and finish **Core second** under
Core's own gates:

```powershell
Set-Location -LiteralPath 'F:\!FluxIQWebExtension'
pnpm task finish t170
Set-Location -LiteralPath 'F:\!FluxIQ'
pnpm task finish t170
```

Each expected merge subject is `Merge task t170: mvp-today-integration`. Do not use
`--skip-checks` for a product, type, structure, package, or integration failure. A downstream
refusal/failure stops Core finish. If downstream has merged locally and Core later fails, preserve
the downstream merge, repair Core, and push neither repository.

After both finishes, verify HEAD=`dev`, clean status, absence of the local t170 branch, and the
expected first-parent merge in both repositories. Fetch current remote refs and review the complete
outgoing ranges: the locally known ranges already include 51 pre-t170 downstream commits and 16
pre-t170 Core commits. Any unexplained outgoing commit blocks push.

Push the coherent pair **Core first, downstream second**:

```powershell
git -C 'F:\!FluxIQ' push origin dev
git -C 'F:\!FluxIQWebExtension' push origin dev
```

If Core push fails, do not push downstream. If Core succeeds and downstream fails, report the
temporary remote mismatch and retry only the ordinary downstream push after resolving the cause.
Never force-push, rewrite history, or delete a remote ref without explicit user approval.

## Stop conditions

Commit or push remains blocked by: t385 still held or returning anything but GO; any incomplete
t373/Core-root/doc gate; edits after validation; an index different from its reviewed manifest;
loss of the diagnostics destination's unstaged content; a dirty tree before finish; an unexpected
task ref/merge subject; a forbidden, sensitive, pending, or raw artifact candidate; any failed
finish check; or an unexplained outgoing commit. The current state hits several of these conditions,
so the immediate action is validation/reconciliation, not staging.
