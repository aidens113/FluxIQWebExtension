# t318 — Final integration worktree inventory

Status: **Integration inventory complete; not yet commit-ready while run 3 and its pending debug are in flight**

This audit used Git status, name/status, tracked-path, ignore, and diff-summary metadata across the downstream and Core repositories. It did not open `test-runs`, provider artifacts, secrets, or generated-output contents; it ran no tests, builds, browser, Lab, or live commands.

## Repository summary

Both repositories are on `task/t170-mvp-today-integration`.

| Repository | Status entries | Tracked changes | Untracked | Staged | Tracked diff summary |
| --- | ---: | ---: | ---: | ---: | --- |
| `F:\!FluxIQWebExtension` | 280 | 68 | 212 | 0 | 68 files, 4,481 insertions, 1,129 deletions; untracked files excluded |
| `F:\!FluxIQ` | 206 | 118 | 88 | 2 | unstaged: 116 files, 4,296 insertions, 2,128 deletions; staged: 2 paths, 817 deletions; untracked files excluded |

No cached/staged change exists downstream. Core has a mixed index/worktree state described below.

## Path classification

Classification is path-based and intentionally does not claim semantic review.

### Downstream (`F:\!FluxIQWebExtension`)

| Class | Tracked | Untracked | Total | Main path groups |
| --- | ---: | ---: | ---: | --- |
| Production/source | 37 | 36 | 73 | extension content/runtime, domain extraction/failure/evidence, test-contracts source, test-runner orchestration |
| Tests | 24 | 25 | 49 | extension E2E/unit tests, domain tests, test-contract tests, runner tests |
| Authored docs | 7 | 152 | 159 | architecture docs, two working plans/index, run debugs, archive, worker reports including this report |
| Generated tracked changes | 0 | 0 | 0 | None surfaced by Git status |
| Ignored runtime/build roots | not inventoried as changes | not inventoried as changes | n/a | `.fluxiq`, `test-runs`, extension `dist`/`build`, domain `.test-build`/`.script-build` are ignored |

The mechanical classifier count before this report was 158 authored-doc paths; adding this report makes the current total 159 and overall status count 281.

### Core (`F:\!FluxIQ`)

| Class | Tracked | Untracked | Total | Main path groups |
| --- | ---: | ---: | ---: | --- |
| Production/source | 65 | 61 | 126 | Automation Studio API, naming, permissions, executor, Flow Bootstrap, LLM/grants, recovery, verification, service wiring |
| Tests | 49 | 27 | 76 | unit/service/integration tests colocated with the affected Core runtime |
| Authored docs | 3 | 0 | 3 | Automation Studio and package-boundary architecture |
| Generated tracked metadata | 1 | 0 | 1 | `.structure-baseline.json` |
| Ignored build/runtime roots | not inventoried as changes | not inventoried as changes | n/a | package `dist`, web `.next`, and `.fluxiq` are ignored |

Core's `packages/fluxiq/package.json` is a tracked production/config change. No lockfile change appears in status; this metadata-only audit does not determine whether the package edit changes dependencies or only package structure/scripts.

## Forbidden/generated artifact gate

- No tracked file exists under the downstream forbidden roots: `.fluxiq/`, `test-runs/`, `apps/extension/dist/`, `apps/extension/build/`, `domain/.test-build/`, or `domain/.script-build/`.
- No tracked Core build output was found under package `dist`, `.next`, `.fluxiq`, or a run-artifact root.
- The tracked Core `.structure-baseline.json` change is generated structural metadata, not runtime output. It should be committed only with the source move whose accepted structure it describes.
- Git's ignored roots were not enumerated and their contents were not opened. Their presence on disk is not a commit candidate.

Result: **no tracked forbidden artifact is visible from Git metadata**.

## Integration risks and unexpected state

### 1. Core has a partial staged move

Exactly two Core entries are staged:

- staged deletion: `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure.ts`;
- staged rename with additional unstaged modification (`RM`): `runtime/flow-bootstrap/tests/generation-failure.test.ts` to `runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts`.

All other Core modifications are unstaged. A commit from the current index would therefore capture only an incomplete structural slice. Before any commit, the supervisor must deliberately normalize/stage the complete intended Core unit and re-check the staged name/status summary. The mixed `RM` state must retain both the rename and its worktree edits.

### 2. Run-3 evidence is intentionally pending

`docs/working/language-driven-flow-loop-plan/debugs/pending-t249-run-3.md` is untracked. That is expected while the live invocation is in flight, but the temporary pending name is not final integration state. It must be bound/renamed to the safe real run id and completed under the artifact gate, or retained and explicitly classified if startup produced no safe run id. Do not commit it ambiguously as `pending-*`.

The two prior run debug documents and the large worker-report set are authored documentation paths, not `test-runs` artifacts. Their contents were not re-reviewed here; the supervisor still needs the established final sensitive-value scan before staging them.

### 3. Broad but internally bounded scope

The changed paths stay within the campaign's known ownership areas:

- Core: generic Automation Studio permissions, defensive execution, evidence/provider retry, Flow Bootstrap, result verification/reauthor/grant continuation, colocated tests, architecture, and structure metadata;
- downstream: browser extraction/runtime behavior, domain extraction/evidence/failure mapping, test contracts, Scenario Lab runner orchestration, tests, and working/architecture docs.

No third repository, unrelated application, deployment file, credential file, lockfile, browser profile, or run-bundle path appears in status. Because this is a path-only audit, it cannot prove every hunk belongs to the campaign; the breadth (487 entries after this report across both repositories) warrants staging by reviewed manifest rather than `git add -A` without inspection.

### 4. Line-ending warnings

Git reported pending LF/CRLF normalization warnings for several downstream E2E/test paths and many Core paths. This is not itself a product defect, but it is an integration risk: final staging should verify that line-ending conversion did not create unintended whole-file churn. Use staged stats/name-status and the existing diff-check gate before commit.

## Cross-repository ordering

These repositories form one compatibility unit: downstream imports the sibling Core package and the live evidence depends on both trees.

Recommended final order:

1. Finish and classify run 3; rename/finalize its debug and update the two working documents before freezing the integration tree.
2. Resolve Core's mixed staged state. Stage Core from an explicit reviewed manifest, including the structure baseline only with its owning source moves; verify no generated/runtime roots enter the index.
3. Create the final Core commit(s) first on the task branch and record the exact commit identity. This gives downstream validation a stable dependency identity while leaving the Core worktree available.
4. Re-run the required downstream compatibility gates against that exact Core commit/tree, then stage and commit downstream source, tests, architecture, working docs, and reports from an explicit manifest.
5. When completing the paired task branches, follow the repository rule: finish/merge the downstream task first while its sibling Core task worktree still exists, then finish/merge Core under Core's gates.
6. Push both `dev` branches in the same coherent work unit only after both merges and required validations are green. Do not push one repository alone and leave the contract pair drifting.

No commit, merge, push, stage, reset, or source/shared-doc edit was performed by this audit.

## Method caveat

One discarded local classification attempt used a PowerShell function name that collided with the built-in `cat` alias and consequently read changed authored/source paths while computing a category. It did not access `test-runs`, provider artifacts, secrets, or generated-output contents, and it made no write. All counts and conclusions above were regenerated from Git metadata-only commands with a corrected classifier. This is recorded because the brief required a metadata-only audit.
