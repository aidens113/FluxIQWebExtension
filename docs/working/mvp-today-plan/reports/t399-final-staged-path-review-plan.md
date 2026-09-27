# t399 — final staged-path review plan

## Verdict

**NO-GO to stage or commit yet; the final review is deterministic once the trees are frozen.**
Core still has the inherited partial index reported by t386: one staged deletion and one staged
rename whose destination has later unstaged edits. Downstream has no staged entries. The final
candidate manifests have also grown since t386: both generated framework-reference mirrors are
modified and reviewed GO by t397, and downstream has additional authored reports. The supervisor
must freeze the trees, run the path-only preflight below, complete the inherited Core index in
place, then run the staged-blob checks before any commit.

This report is a command plan, not a privacy or integration approval. I did not inspect ignored or
runtime artifact contents, stage anything, or run tests, builds, providers, browsers, panels, Lab,
or live workflows.

## Current path-only facts

- Downstream has 367 status entries before this report: 76 modified and 291 untracked; none are
  staged and none are unmerged. This report adds one further untracked authored Markdown path.
- Core has 220 status entries: 126 ordinary modified, 92 untracked, one staged deletion, and one
  staged rename with a modified destination; none are unmerged.
- Core's cached entries are still exactly:

  ```text
  D    packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure.ts
  R100 packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/tests/generation-failure.test.ts -> packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts
  ```

  The destination remains `RM`. Do not reset, restore, stash, clean, or commit this partial index.
- Core's reviewed generated candidates are all modified:
  `.structure-baseline.json`, `docs/reference/framework-reference.md`, and
  `packages/fluxiq/docs/reference/framework-reference.md`. The reference pair is an intentional,
  deterministic generated mirror reviewed GO in t397; it must be staged together or not at all.
- `git ls-files -ci --exclude-standard` prints nothing in both repositories: no currently tracked
  path matches the current ignore rules.
- Ignored generated/runtime trees exist locally. Their existence is expected and is not a blocker;
  entering the index is a blocker. Do not use broad `git status --ignored` here: it recursively
  traverses large raw run trees, emits machine/runtime paths, and is unnecessary for this gate.

## Frozen candidate inclusion lists

Only these paths may enter the t170 integration commits. Any other dirty or staged path requires a
new owner/scope decision and a rerun of this review.

**Core authored/allowed candidates**

- `.structure-baseline.json` (tracked generated structural metadata; implementation group only)
- `apps/web/src/features/automation-studio/runtime/tests/run-permission-request.test.tsx`
- `packages/fluxiq/package.json`
- `packages/fluxiq/src/**`
- `docs/architecture/automation-studio.md`
- `docs/architecture/automation-studio/llm-flow-bootstrap.md`
- `docs/architecture/package-boundaries.md`
- `docs/reference/framework-reference.md` and
  `packages/fluxiq/docs/reference/framework-reference.md` (paired generated-reference group only)

**Downstream authored/allowed candidates**

- `apps/extension/**`, `domain/**`, `packages/test-contracts/**`, and `packages/test-runner/**`
- exactly the four architecture files named by t386
- `docs/working/README.md`, `docs/working/language-driven-flow-loop-plan.md`, authored Markdown
  below `docs/working/language-driven-flow-loop-plan/{debugs,reports}/`,
  `docs/working/mvp-today-plan.md`, and authored Markdown below
  `docs/working/mvp-today-plan/**`

The working-document allowance is for sanitized Markdown records only. It does not authorize raw
run bundles, logs, captures, screenshots, recordings, browser state, page/provider payloads, or
copied `.fluxiq` data.

## Absolute exclusion lists

Reject these paths even if force-added or accidentally made unignored.

**Downstream:** `.fluxiq/**`, `test-runs/**`, `.browser-profiles/**`, `playwright-report/**`,
`test-results/**`, `.playwright/**`, `node_modules/**`, `.turbo/**`, every `dist/**`,
`apps/extension/build/**`, `domain/.test-build/**`, any `.script-build/**`, test/harness scratch,
`.lab-instances/**`, `.lab-locks/**`, non-example `.env*`, and `*.log`.

**Core:** `.fluxiq/**`, `node_modules/**`, every `.next/**` and `dist/**`, `coverage/**`,
`playwright-report/**`, `test-results/**`, `.e2e-host/**`, `.turbo/**`, non-example `.env*`,
`*.tsbuildinfo`, `logs/**`, `tmp/**`, `.tmp/**`, `*-dev.stdout.log`, `*-dev.stderr.log`, and the
package-root runtime directories `packages/*/{recordings,indexes,storage,flows,pipeline}/**`.
`storage/.gitkeep` is the only ignore exception, but it is not a t170 candidate.

## Gate 1 — path-only preflight before staging

Run with both trees quiescent. These commands inspect names and Git metadata only.

```powershell
$downRepo = 'F:\!FluxIQWebExtension'
$coreRepo = 'F:\!FluxIQ'

git -C $downRepo status --short
git -C $coreRepo status --short
if (@(git -C $downRepo ls-files -u).Count -ne 0) { throw 'Downstream has unmerged entries' }
if (@(git -C $coreRepo ls-files -u).Count -ne 0) { throw 'Core has unmerged entries' }
if (@(git -C $downRepo diff --cached --name-only).Count -ne 0) {
  throw 'Downstream index is not empty before planned staging'
}

$expectedCoreCache = @(
  "D`tpackages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure.ts",
  "R100`tpackages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/tests/generation-failure.test.ts`tpackages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts"
)
$actualCoreCache = @(git -C $coreRepo diff --cached --name-status)
$cacheDelta = @(Compare-Object $expectedCoreCache $actualCoreCache)
if ($cacheDelta.Count -ne 0) { $cacheDelta; throw 'Unexpected inherited Core index' }

$coreMoveState = @(git -C $coreRepo status --short -- `
  'packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure.ts' `
  'packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/tests/generation-failure.test.ts' `
  'packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts')
$coreMoveState
if ($coreMoveState.Count -ne 2 -or
    -not ($coreMoveState -match '^D  packages/.+/generation-failure\.ts$') -or
    -not ($coreMoveState -match '^RM packages/.+diagnostics\.test\.ts$')) {
  throw 'Inherited Core delete/rename worktree split changed'
}

if (@(git -C $downRepo ls-files -ci --exclude-standard).Count -ne 0) {
  throw 'Downstream tracks a currently ignored path'
}
if (@(git -C $coreRepo ls-files -ci --exclude-standard).Count -ne 0) {
  throw 'Core tracks a currently ignored path'
}
```

Acceptance: no unmerged entry; downstream index empty; Core cache exactly the two inherited
name-status records; Core move state exactly `D` plus `RM`; no tracked ignored path. Any deviation
blocks staging and must be reconciled without destructive index cleanup.

Next review dirty path names against the inclusion lists. `git status --short` is the authoritative
manifest. Require every entry to have an owner and require zero path outside the lists above. Do
not substitute `git add .`, root `git add -A`, or an ignored-tree traversal.

## Gate 2 — privacy scan of candidate working-tree files

This scan prints only offending file names, never matching values. Run separately in each repo
before staging. Deleted paths are intentionally omitted; their replacement/current files are
scanned. Every hit requires manual disposition, and any real credential, provider/page content,
pairing/bearer token, private project data, local browser state, or machine-local path blocks
staging.

```powershell
function Find-CandidateSensitiveFile([string]$repo) {
  $paths = @(
    git -C $repo diff --name-only --diff-filter=ACMRTUXB
    git -C $repo ls-files --others --exclude-standard
  ) | Sort-Object -Unique
  $paths = @($paths | Where-Object { Test-Path -LiteralPath (Join-Path $repo $_) -PathType Leaf })
  $pattern = '(?i)(-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9]{20,}\b|\bxox[baprs]-[A-Za-z0-9-]{10,}\b|\bsk-[A-Za-z0-9_-]{20,}\b|authorization\s*[:=]\s*["'']?bearer\s+[A-Za-z0-9._~+/-]{12,}|(?:api[_-]?key|pairing[_-]?token|password|secret)\s*[:=]\s*["''][^"'']{12,}["''])'
  foreach ($path in $paths) {
    rg --files-with-matches --pcre2 -- $pattern (Join-Path $repo $path)
  }
}

$downSensitive = @(Find-CandidateSensitiveFile 'F:\!FluxIQWebExtension')
$coreSensitive = @(Find-CandidateSensitiveFile 'F:\!FluxIQ')
$downSensitive
$coreSensitive
if ($downSensitive.Count -ne 0 -or $coreSensitive.Count -ne 0) {
  throw 'Sensitive-pattern candidate requires manual review'
}
```

Acceptance: zero unexplained hits. Also manually review every added hunk in working/debug/report
Markdown created after t391's bounded scan. It may contain aggregate counts, safe opaque run IDs,
commit/build hashes, closed issue codes, and synthetic examples; it must not contain prompts,
responses, selectors, recorded values, resolved secrets, request headers, local browser data, or raw
artifact excerpts. T391 covers reports through t390 plus the two Current States and three Core
architecture diffs; t397 separately covers the generated reference pair. Neither substitutes for
review of later reports, including this one.

## Completing the inherited Core index

Only after Gates 1 and 2 pass, complete the existing index in place with t386's deletion-aware
implementation pathspecs. This absorbs the `RM` destination's current bytes and preserves the old
deletion/rename relationship.

```powershell
Set-Location -LiteralPath 'F:\!FluxIQ'
git add -A -- `
  '.structure-baseline.json' `
  'apps/web/src/features/automation-studio/runtime/tests/run-permission-request.test.tsx' `
  'packages/fluxiq/package.json' `
  'packages/fluxiq/src'
```

Do not use reset/restore/stash/clean to manufacture an empty Core index. Do not stage the two
framework-reference mirrors with this implementation group; stage them together in their own
reviewed generated-doc group after the implementation and architecture groups are committed. A
changed similarity score is acceptable; missing old/new paths or missing destination edits is not.

Downstream staging remains by t386's explicit ownership groups. Add this report through the
reviewed working-document pathspec, never through a repository-root add.

## Gate 3 — after each staging group, before each commit

Run this block after every explicit group stage in the relevant repository. It reviews the actual
index bytes that will be committed.

```powershell
$repo = 'F:\!FluxIQ' # change to F:\!FluxIQWebExtension for downstream groups
$staged = @(git -C $repo diff --cached --name-only --diff-filter=ACMRTUXB)
if ($staged.Count -eq 0) { throw 'Nothing staged' }
$staged
git -C $repo diff --cached --name-status
git -C $repo diff --cached --stat
git -C $repo diff --cached --check
if ($LASTEXITCODE -ne 0) { throw 'Staged diff check failed' }
if (@(git -C $repo ls-files -u).Count -ne 0) { throw 'Unmerged staged entry' }
if (@(git -C $repo ls-files -ci --exclude-standard).Count -ne 0) {
  throw 'Tracked path matches ignore rules'
}
```

Then apply the repository-specific staged path rejection:

```powershell
# Downstream
$forbiddenDown = '(^|/)(\.fluxiq|test-runs|\.browser-profiles|playwright-report|test-results|\.playwright|node_modules|\.turbo|dist|build|\.script-build|\.test-build|\.test-build-scratch|\.harness-build|\.lab-instances|\.lab-locks)(/|$)|(^|/)\.env(?:\.|$)|\.log$'
$badDown = @($staged | Where-Object { $_ -match $forbiddenDown })
$badDown
if ($badDown.Count -ne 0) { throw 'Forbidden downstream staged path' }

# Core
$forbiddenCore = '(^|/)(\.fluxiq|node_modules|\.next|dist|coverage|playwright-report|test-results|\.e2e-host|\.turbo|logs|tmp|\.tmp)(/|$)|^packages/[^/]+/(recordings|indexes|storage|flows|pipeline)(/|$)|(^|/)\.env(?:\.|$)|\.tsbuildinfo$|-dev\.(stdout|stderr)\.log$'
$badCore = @($staged | Where-Object { $_ -match $forbiddenCore })
$badCore
if ($badCore.Count -ne 0) { throw 'Forbidden Core staged path' }
```

Finally scan only added staged lines without printing their content:

```powershell
$path = ''
$findings = [System.Collections.Generic.HashSet[string]]::new()
$secretPattern = '(?i)(-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9]{20,}\b|\bxox[baprs]-[A-Za-z0-9-]{10,}\b|\bsk-[A-Za-z0-9_-]{20,}\b|authorization\s*[:=]\s*["'']?bearer\s+[A-Za-z0-9._~+/-]{12,}|(?:api[_-]?key|pairing[_-]?token|password|secret)\s*[:=]\s*["''][^"'']{12,}["''])'
$pendingPattern = '(?i)\b(TODO|FIXME|TBD|REPLACE_ME|CHANGEME)\b'
foreach ($line in (git -C $repo diff --cached --unified=0 --no-color)) {
  if ($line -like '+++ b/*') { $path = $line.Substring(6); continue }
  if (-not $line.StartsWith('+') -or $line.StartsWith('+++')) { continue }
  if ($line -match $secretPattern) { [void]$findings.Add("$path [sensitive-pattern]") }
  if ($line -match $pendingPattern) { [void]$findings.Add("$path [pending-marker]") }
}
$findings | Sort-Object
if ($findings.Count -ne 0) { throw 'Added staged lines require manual review' }
```

Acceptance for every commit group:

1. Staged paths equal that group's frozen manifest exactly—no omission, cross-group path, or extra
   report.
2. No forbidden/ignored/generated-runtime path; no unmerged entry; staged diff check passes.
3. Added-line scan has zero unexplained findings and the supervisor has reviewed the full staged
   patch. Synthetic fixtures must be explicitly recognized rather than waived by directory.
4. `git diff --name-only -- <group pathspecs>` prints nothing, proving the staged group contains the
   current validated worktree bytes. For Core implementation this must include the formerly `RM`
   diagnostics destination.
5. For the generated-reference commit, staged paths are exactly the two mirror paths, their hashes
   are equal, and the t397 owning check remains applicable to those unchanged bytes. For the
   structural implementation commit, `.structure-baseline.json` is present exactly once.

## Stop conditions visible now

- Core's partial index is intentionally incomplete; an immediate commit would omit later
  diagnostics-destination edits.
- Downstream is wholly unstaged and this report changes its untracked manifest after the observed
  367-entry snapshot.
- T386's former Core documentation manifest did not include the two now-modified generated
  framework-reference mirrors; they need the separate paired group above.
- T391's privacy scope ended at t390. Later authored reports need final added-hunk review even
  though t397 independently cleared the generated references.
- Existing ignored raw/generated trees must remain untouched and untracked. Their presence alone
  does not justify cleanup and does not block a commit.

Any unexpected path, changed inherited cache, real sensitive hit, raw artifact, partial generated
mirror, unstaged remainder inside a commit group's pathspecs, or edit after validation is a hard
stop. The supervisor must reconcile and rerun the affected gate rather than widening an allowlist
ad hoc.
