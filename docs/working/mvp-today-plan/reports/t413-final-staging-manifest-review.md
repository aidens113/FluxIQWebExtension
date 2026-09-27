# t413 — final staging manifest review

## Verdict

**NO-GO to stage yet; path scope is clean, but the candidate is not frozen.** At the snapshot below,
every dirty path in both repositories belongs to an approved t170 ownership group, neither tree has
an unmerged or tracked-ignored path, both working-tree diff checks pass, and no forbidden generated
or runtime path is a candidate. Core still has the intentional incomplete two-entry index, and other
final report reconciliation is still landing. Freeze both trees, include this report, refresh the
manifest, and rerun the path/privacy preflight before the first `git add`.

This was a path- and diff-metadata review. I did not stage, commit, build, test, invoke a provider,
inspect ignored runtime data, or operate Lab, a browser, or the panel.

## Observed repository state

| Repository | Branch / HEAD | Dirty manifest before this report | Index / unmerged / tracked-ignored |
| --- | --- | ---: | --- |
| downstream | `task/t170-mvp-today-integration` / `5b8429c543fdc27eb892c225641717aed43c5dc4` | 380: 76 modified, 304 untracked | empty / 0 / 0 |
| Core | `task/t170-mvp-today-integration` / `d035e1b7d17977951a2a2ec6b5e51570e3f2c537` | 222: 128 modified, 92 untracked, one staged deletion, one `RM` rename | 2 / 0 / 0 |

`git diff --check` exited 0 in both repositories; emitted messages were line-ending advisories, not
whitespace errors. The candidate-name sensitive scan found zero downstream hits. Core had hits in
five test files only; redacted inspection tied every hit to a synthetic credential-screening,
provider-refusal, or privacy-negative fixture. No real credential or runtime value was observed.
Forbidden-path checks returned zero in both repositories.

This report adds one downstream working-document path, so the immediate post-report minimum is 381
dirty downstream paths. Any concurrent edit or additional report makes that count non-authoritative
and requires another refresh; count equality alone is never a staging gate.

## Exact safe staging groups

Stage and commit Core first, in this order:

1. **Core implementation/tests (217 paths at snapshot):** `.structure-baseline.json`,
   `apps/web/src/features/automation-studio/runtime/tests/run-permission-request.test.tsx`,
   `packages/fluxiq/package.json`, and `packages/fluxiq/src/**`. Use deletion-aware
   `git add -A -- <these exact pathspecs>` so the inherited move and the current diagnostics
   destination bytes enter the same index.
2. **Core architecture (3):** `docs/architecture/automation-studio.md`,
   `docs/architecture/automation-studio/llm-flow-bootstrap.md`, and
   `docs/architecture/package-boundaries.md`.
3. **Core generated reference pair (2):** `docs/reference/framework-reference.md` and
   `packages/fluxiq/docs/reference/framework-reference.md`. Stage exactly both or neither, verify
   byte identity, and keep them separate from implementation and authored architecture.

After Core commits are recorded, stage and commit downstream in this order:

1. **Browser/domain contract (70):** `apps/extension/**` (26) and `domain/**` (44), with
   `git add -A -- apps/extension domain`.
2. **Facility contract (60):** `packages/test-contracts/**` (3) and
   `packages/test-runner/**` (57), with explicit deletion-aware pathspecs.
3. **Downstream architecture (4):** exactly `docs/architecture/failure-taxonomy.md`,
   `docs/architecture/sensitive-values.md`, `docs/architecture/testing-facility.md`, and
   `docs/architecture/web-capabilities.md`.
4. **Authored working record (246 before this report; at least 247 after it):**
   `docs/working/README.md`, `docs/working/language-driven-flow-loop-plan.md`, sanitized Markdown
   under `docs/working/language-driven-flow-loop-plan/{debugs,reports}/`,
   `docs/working/mvp-today-plan.md`, and sanitized Markdown under
   `docs/working/mvp-today-plan/**`. Regenerate/review the working-doc index before this group and
   stage only these explicit pathspecs, never the repository root.

After every group, require the cached name-status list to equal the frozen group, cached
`diff --check` to pass, zero unmerged/ignored/forbidden paths, zero unexplained sensitive or pending
added-line findings, full staged-patch review, and no remaining unstaged bytes under that group's
pathspecs.

## Inherited Core partial index

The index remains exactly the known staged deletion of
`runtime/flow-bootstrap/generation-failure.ts` and the staged rename from
`runtime/flow-bootstrap/tests/generation-failure.test.ts` to
`runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts`. The destination is `RM`, so
its current worktree edits are not yet in the index. Do not commit this state, and do not reset,
restore, stash, clean, or reconstruct it. After the freeze/privacy gates, complete it in place with
the full Core implementation pathspec group above. A changed similarity score is acceptable;
missing the old path, new path, or current destination bytes is not.

## Absolute exclusions

- Downstream: `.fluxiq/**`, `test-runs/**`, browser profiles, Playwright/test results, `.playwright`,
  `node_modules`, `.turbo`, every `dist/**`, `apps/extension/build/**`, domain test/script builds,
  harness/Lab scratch and locks, non-example `.env*`, and logs.
- Core: `.fluxiq/**`, `node_modules`, every `.next/**` and `dist/**`, coverage, Playwright/test
  results, `.e2e-host`, `.turbo`, logs/temp trees, non-example `.env*`, `*.tsbuildinfo`, dev logs,
  and package-root `recordings`, `indexes`, `storage`, `flows`, or `pipeline` runtime trees.
- Both: raw run bundles, prompts/responses, request headers, provider/page values, captures,
  recordings, screenshots, pairing/bearer tokens, local browser state, and machine-local secrets.

## Commit grouping and trailers

Use the seven groups above as seven commits unless the supervisor's final patch review establishes a
smaller coherent split. Every commit carries `Task: t170`. Add one repeated `Worker:` trailer only
for an agent that authored bytes in that specific commit; do not credit review-only agents such as
t399, t408, t409, or this audit. The packing portion of the Core implementation has recorded
producer/reviser provenance including t370, t372, t375, t377, and t378; use the existing ledger to
add the other actual producers rather than guessing. Supervisor-only reconciliation needs no
invented `Worker:` trailer. Generated-reference execution and review are not automatically authorship
of the generated bytes; use the owning generator/change provenance recorded by the supervisor.

## Blocks before the first stage

1. Stop all writers and final-review agents, apply the t411 report-only corrections, regenerate the
   working-document index if required, and declare both trees frozen.
2. Re-observe the full manifests. Require every path to fit the groups above; this report and any
   later report must be included deliberately.
3. Rerun the filename-only sensitive/forbidden scan and manually disposition synthetic fixture
   hits. Review later Markdown added after the last privacy audit without opening raw run artifacts.
4. Confirm Core's cache is still exactly the inherited deletion plus rename and downstream's index
   is empty. Then complete Core's implementation group in place and run the staged-blob gates.
5. Resolve exact author trailers from the provenance ledger before each commit. This is a commit
   metadata gate, not a reason to widen or repartition path ownership.

Once those five conditions pass, there is **GO to stage the explicit groups serially**. There is
still no authorization here for a provider/live run, task finish, merge, or push.
