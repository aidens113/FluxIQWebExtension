# t179 — Release inventory

Repository scope: `F:\!FluxIQWebExtension` and `F:\!FluxIQ`, both on
`task/t170-mvp-today-integration`. Read-only inventory except this report; no build,
test, Lab run, source edit, commit, or push.

## Outcome

**The current trees are not commit-ready until all untracked task files are included.**
Neither task branch has a commit ahead of `dev`, neither has staged changes, and the
entire integration currently exists only in the two working trees. Before this report
was added, the downstream tree had 61 tracked changes and 74 untracked files; Core had
105 tracked changes and 82 untracked files.

I found no generated/runtime artifacts, no unexplained deletion after accounting for
the intended module split, no missing barrel for a newly added source directory, and
no apparent real credential in the changed or untracked files. The only secret-pattern
matches are deliberately synthetic values in test files that exercise screening,
redaction, refusal, or authorization behavior.

## Release blockers

### 1. P0 — A tracked-only commit would omit 156 required files and break Core

All newly created implementation modules, their tests, and the worker reports are
untracked. The highest-risk pairing is:

- tracked deletion:
  `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure.ts`
- untracked replacement:
  `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/**`

The changed parent barrel already targets `generation-failure/index.ts`. Committing
only tracked paths would therefore delete the old module without adding the replacement.
The replacement preserves the old public exports and adds focused diagnostics/refusal
tests, so the deletion itself is an intentional split rather than suspicious loss — but
the delete and every replacement file must be captured atomically.

Other required untracked implementation groups are:

- downstream: `apps/extension/src/content/action-runtime/recovery/**`, the new
  extraction/failure/name-resolution source and tests under `domain/src/**`, and
  `packages/test-runner/src/run-scenario/**`;
- Core: `nodes/name-match/{synonyms,token-credit}.ts`,
  `runtime/executor/defensive/**`, `runtime/llm/{deepseek,evidence-loop,provider-retry}/**`,
  `runtime/provider-refusal/**`, and the new recovery/result-verification modules and
  tests shown by `git ls-files --others --exclude-standard`;
- downstream working evidence: the untracked task report files spanning t165–t180 under
  `docs/working/**/reports/`.

**Required commit action:** after all concurrent workers stop, re-run the inventory and
stage the complete intended set in *both* repositories, including deletions and
untracked files. Do not use a tracked-files-only commit path.

### 2. P1 — Two dispatched task outputs had not landed at the inventory snapshot

The plan dispatches t178 and t181, but these paths were absent:

- `docs/working/mvp-today-plan/reports/t178-live-run-preflight.md`
- `docs/working/mvp-today-plan/reports/t181-runner-authored-node-assertions.md`

The two t181-owned test files named by its brief were also unchanged in the current
diff. This may simply mean those workers were still running after the machine restart;
it is nevertheless a task-boundary omission in this snapshot. The supervisor should
not close the integration branch until both outputs land or their cancellation is
recorded explicitly. This report supplies the previously absent t179 output.

## Inventory details

### Generated and runtime data

No changed or untracked path matched the repository's forbidden/generated locations
or common run-artifact forms: `.fluxiq/`, extension `dist/` or `build/`, domain
`.test-build/` or `.script-build/`, `test-runs/`, coverage/Playwright reports,
`node_modules/`, `.env`, logs, archives, browser captures, screenshots, or video.

### Secret review

A filename-scoped scan of added diff lines and every untracked file checked private-key
headers and common OpenAI/GitHub/Google/Slack/Bearer/credential-literal patterns without
printing candidate values. Matches occurred only in these tests:

- downstream: `packages/test-runner/src/run-scenario/tests/resolve-run-secrets.test.ts`;
- Core: `api/handlers/tests/llm-generation.test.ts`,
  `runtime/flow-bootstrap/generation-failure/tests/provider-refusal.test.ts`,
  recovery screening tests, and result-verification repair/verdict tests.

Their surrounding assertions explicitly exercise synthetic authorization, refusal,
withholding, screening, or redaction data. No candidate appeared in product source,
configuration, documentation, or a runtime artifact. This was a targeted heuristic
scan, not a dedicated secret-scanner run; `gitleaks` is not installed on this machine.

### Deletions, tests, and indexes

- Downstream has no tracked deletion.
- Core has exactly one tracked deletion, the `generation-failure.ts` split described
  above. Its former test is moved to
  `generation-failure/tests/diagnostics.test.ts`, with additional focused tests.
- Every newly added non-test source directory in both repositories has an `index.ts`.
  Changed barrels/manifests needed by the new extraction, failure, name-resolution,
  defensive executor, provider-retry, provider-refusal, and repair-directive modules
  are present in the diff.
- Each newly introduced capability group has changed or new owned tests. I found no
  orphaned deleted test and no obvious missing test file from filename/ownership
  inventory. This does not substitute for executing the tests.
- `git diff --check dev` passed in both repositories.

## Validation and limits

I used `git status`, `git log dev..HEAD`, `git diff` name/status/stat/summary checks,
`git ls-files --others --exclude-standard`, targeted changed-barrel reads, a redacted
secret-pattern scan, and `git diff --check dev`. I did not run builds, type checks,
tests, browsers, provider calls, or Lab, and did not inspect recorded/runtime content.

## Files changed

- Added only `docs/working/mvp-today-plan/reports/t179-release-inventory.md`.
