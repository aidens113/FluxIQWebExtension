# t422 — Live credential and capture gate

## Disposition

**GO for the credential resolver and capture procedure; this is not live-run authorization.** T419
reported the settled corrected-order rebuild/freshness gates green (freshness 6/6, markers 12/12,
and Core identities 3/3) and its exact provider-free seam returned `ready` with zero provider calls
and the unchanged isolated created-Flow request/profile/task/replay/default budgets. Final
clean-tree recapture and command-specific authorization remain supervisor-owned gates.

The credential name is `DEEPSEEK_API_KEY`; its value was never printed or persisted. It is absent
from this worker's inherited process, while the ignored repository `.env.local` contains a
syntactically nonblank declaration and t419 reported only credential-source metadata naming
`DEEPSEEK_API_KEY` from `.env.local`. The live credential resolver reads the process value first,
then parses `.env`/`.env.local` but returns only this provider's single named assignment; it rejects
blank, implausibly sized, or control-character-bearing values. Separately,
`FLUXIQ_TEST_ENV_FILES=none` prevents saved target/base-URL/account settings from entering the test
environment, and spawned scenario/Core environments remove provider-secret variables. This is GO
for local presence and syntactic resolver readiness without widening target configuration. Actual
provider acceptance is deliberately unproved until the one authorized invocation; no provider-free
check can validate it.

## Required capture order

The safe procedure is the corrected t266/t346 sequence:

1. Retain t419's accepted provider-free `ready` result with zero provider calls, and use its single
   prospective live seam below without reconstruction or alteration.
2. Freeze and independently attest the unused pending Stage-1 debug before launch. Immediately
   before launch, recheck the settled identities, outputs, one-Lab predicate, absence of competing
   jobs, and credential presence/nonblank status by name only.
3. Invoke the authorized command exactly once. Retain stdout only in memory and send stderr to the
   null sink. Never print, format, serialize, or save the raw stdout/result object.
4. Parse only the final nonblank stdout JSON line in memory. Require a safe run id matching
   `^[A-Za-z0-9._-]{1,128}$`; clear the raw variables on every stop path. A nonzero exit with a safe
   id may still be a finalized product failure; missing or unsafe identity is a hard stop.
5. Before inspecting any bundle content, require that the destination debug path does not exist and
   rename the pending debug immediately to `<run-id>.md`. Never overwrite a prior debug.
6. Require the reported path to equal the default `test-runs/<run-id>` path and the CLI verdict to
   be closed (`passed` or `failed`), then clear the retained live-result variables.
7. Run `inspect <run-id>` with stdout retained only in memory and stderr discarded. Parse only its
   final nonblank JSON line; require exit 0, `valid: true`, matching id, and matching default path,
   then clear all inspection variables. Do not print the inspection object or hashes.
8. Only after inspection, check artifact-index schema `0.1`, unique required entries, and every
   indexed redaction state (`applied` or `verified`); then check `run.json` identity, closed verdict,
   and manifest redaction (`verified` or `not_applicable`). Any failure stops semantic reading and
   any further provider call.
9. Open only the minimum indexed structured artifacts in the established order: `run.json`,
   `summary.json`, `evaluation.json`, `snapshots/live-llm.json`, then conditional
   `snapshots/flow-lane.json`, `snapshots/redaction-attestation.json`,
   `snapshots/extraction-mismatches.json`, and `snapshots/repair-lane.json`. Record missing facts as
   `NO EVIDENCE`. Never open raw provider/page content, logs/events, HTML/screenshots, selectors,
   credentials, headers, cookies, browser state, profiles, raw datasets, or unindexed artifacts.

The pending debug remains bound to the real run id after any post-rename stop. A failure consumes
the single authorization and never implies retry permission.

## Prospective command seam

T419's accepted provider-free command set only the two isolation variables below and ended in
`--dry-run`. The sole prospective live seam is the same command with only `--dry-run` absent,
wrapped by the required memory-only stdout/null-stderr capture:

```powershell
$env:FLUXIQ_TEST_ENV_FILES = 'none'
$env:FLUXIQ_TEST_TARGET = 'isolated'
$liveRaw = @(& node packages/test-runner/dist/cli.js run everything-store `
  --target isolated `
  --live-llm `
  --llm-profile mvp-hard-scenario `
  --llm-provider deepseek `
  --llm-task create-flow `
  --instruction-task everything-store-plus-earbuds-under-50 `
  --replays 1 2>$null)
$liveExitCode = $LASTEXITCODE
```

No budget, timeout, retry, concurrency, target, Lab-instance, or run-root override is present. The
full parse/rename/inspect/redaction order above is part of the seam, not optional follow-up. This GO
becomes NO-GO if the exact command changes, the credential resolver no longer reports the expected
name/source, the frozen tree/output identity changes, one-Lab/competing-job checks fail, or fresh
command-specific authorization is absent. It does not grant panel-management authority.

## Pending Stage-1 construction checklist

Create a new, unused pending debug only after the candidate tree and command are settled. Before
launch, it must contain all items below and then remain byte-stable; none may be reconstructed from
provider-free or live output.

- **Preamble and provenance:** state that the file and Stage 1 were completed before launch and
  before any new-run artifact was opened; later facts come only from integrity-valid sanitized
  evidence; missing facts become `NO EVIDENCE`. Name accepted run 4 as the latest live measurement,
  its Stage-2 terminal family, the zero-pass streak, and the no-unchanged-run-5 rule.
- **Request header:** scenario `everything-store`, no variant, task
  `everything-store-plus-earbuds-under-50`, isolated created-Flow lane, DeepSeek
  `mvp-hard-scenario` / `create-flow`, exactly one replay, the exact t419-derived command/capture
  seam, default 26 calls, existing token/cost ceilings, and an explicit list of forbidden
  call/token/cost/timeout/retry/concurrency/target/Lab/run-root overrides.
- **Measured correction:** state that this is one convergence measurement of lossless
  `step_rows_v1` packing of every bounded draft input within the unchanged 4,000-byte reservation;
  it is not evidence that convergence is already proved and does not weaken answerability or enlarge
  an allowance.
- **Instruction contract:** install the canonical instruction verbatim from its frozen source;
  identify that source and its normalization rule. Include all nine expected chain steps in the
  accepted order, the plausible-but-wrong answer description, and the pre-run hypotheses. Do not
  import any run-4 trace as a prediction.
- **Oracle contract:** name `extract-plus-under-fifty`; require exactly 13 ordered records, the four
  compared fields, exact predicates, organic-only extraction, all-page traversal, stable order, and
  identity-based de-duplication. State that matching count alone cannot pass.
- **Authority and accounting:** freeze continuation of only the existing run-owned grant through an
  authorized binding update; forbid minting, replacement, widening, reset, transfer, drift bypass,
  or missing terminal revocation. Require truthful attempt/response provenance and separate any
  overlapping accounting representations.
- **Pass, streak, and stop rules:** require the finalized integrity-valid passed bundle, Flow
  creation, exact oracle and reported pass, confirmed verification, exact ordered result, and one
  zero-provider replay. If repair occurs, also require screened direction, applied/persisted
  adaptation, authoritative binding, selected-Subflow replay, post-replay judgement, and terminal
  revocation. One pass changes the streak only from 0 to 1; any failure consumes the invocation,
  resets/leaves it at 0, and grants no retry.
- **Evidence contract:** freeze artifact-index schema `0.1`, finalized marker/index/digest and
  identity checks, conservative redaction states, the bounded structured-artifact allowlist, the
  corrected rename-before-inspect order, and complete Stage-1-through-terminal debug fields. Forbid
  raw provider/page/browser/log/screenshot/selector/credential/authorization material.
- **Pre-launch identities:** record Core and downstream roots, branches, exact HEAD identities,
  clean porcelain path sets, both `git diff --check` results, accepted validation/freshness and
  generated-output identities, Core junction/runtime targets, the isolated Lab/output target,
  one-Lab/competing-job result, credential name/source status only, and the single-invocation
  authorization identity. Any later edit, regeneration, staging or HEAD change invalidates them.

Compute and attest, without printing digest values in operator status, these immutable identities:

1. canonical instruction source path, strict UTF-8/LF/terminal-newline rule, logical length/byte
   count, and SHA-256;
2. accepted nine-step-chain source slice coordinates, the same normalized line/byte/SHA-256
   identity, and ordinal equality with the installed pending payload;
3. oracle source/fixture identity and SHA-256, including the exact ordered 13-record/four-field
   contract rather than only its count;
4. normalized pending Stage-1 payload line count, byte count, SHA-256, BOM/line-ending/terminal-LF
   state, and ordinal equality with its reviewed source payload; and
5. prospective live command/request identity copied from t419, plus the settled repository and
   output identities named above.

Only these run-derived header fields may remain literally `pending` at launch: safe run id; UTC
start/end date; observed model (provider remains preconfigured DeepSeek); provider calls, token and
cost accounting; reported verdict/category; and highest stage reached. All decision/tool results,
Flow shape, runtime, dataset comparison, judgement, repair, persistence, replay, and revocation
sections must contain no predicted observation before launch; fill them later from allowed evidence
or mark them `NO EVIDENCE` after the capture gates pass.

## Created-Flow grant exposure audit

**Finding: one CLI invocation can create at most two sequential execution grants, not one.** The
first is the lane's build authorization point; the second exists only after a proposal survives
build/review and the created Flow is about to run. There is no third result-verification grant on
this lane and no code path that renews or replenishes either execution grant.

| Layer | Purpose / occurrence | Calls | Token bound | Cost bound |
| --- | --- | ---: | ---: | ---: |
| One provider request | Any task under either grant | 1 | 48,000 input; 8,000 output; 56,000 total | USD 0.25 |
| Grant 1 | `build_and_adapt`; blank-Flow instruction build | 26 | 560,000 total across the grant | USD 2 total |
| Grant 2 | `explore_and_adapt`; created-Flow playback, result judgement, and repair | 26 | 560,000 total across the grant | USD 2 total |
| Whole CLI invocation | Both grants, when both are reached | **52** | **1,120,000 total** | **USD 4 total** |

The invocation-wide input-only ceiling is 1,120,000 tokens (the aggregate total-token ceiling binds
before 48,000 x 52). The output-only ceiling is 416,000 tokens (8,000 x 52). These are independent
projections under the same 1,120,000 aggregate total-token cap and must not be added together as an
extra allowance. Every request has a 25-second effective timeout and provider retry count zero.
Calls, tokens, and cost are componentwise upper bounds, not a claim that 52 calls can each consume
the per-request maxima: the per-grant token and cost ledgers stop that combination.

The arithmetic comes from the unchanged default plan: each iterating grant asks for 26 calls; an
unspecified run-token budget becomes the smaller of 56,000 x 26 and the ten-request confirmation
threshold, hence 560,000; and each grant's total cost is the smaller of USD 0.25 x 26 and Core's USD
2 grant ceiling. `repairPlan` copies those bounds rather than sharing the first grant's remaining
pot, so the two grants' maximum exposures add at the invocation boundary.

Grant lifecycle details close the possible widening paths:

- `buildAuthorizer` calls the authorization chain once for `build_and_adapt`. The build endpoint
  revokes that grant when generation ends; review/apply does not replenish it.
- `repairAuthorizer` calls the chain once for `explore_and_adapt`. That same held grant covers
  playback, `loop_verification`, diagnosis/evidence/patch work, any result reauthoring, and
  post-repair verification. The lane never calls the available `grantOverride`/`verify_result`
  mechanism, so no separate verification grant is minted.
- An applied binding update calls `continueAfterAppliedFlowAdaptation` on the same grant id. Core
  changes only its execution digest/settings revision after exact scope checks; remaining uses,
  committed tokens, committed cost, deadline, key, actor/session, purpose, and permissions are not
  reset. Failure revokes rather than renews.
- Core may exchange an expiring Secret Keys reveal authorization one-for-one for an in-flight call.
  That is credential-lifetime maintenance, not a new execution grant or provider-call allowance.
- The requested deterministic replay creates no grant and must make zero provider calls. Terminal
  run cleanup revokes the held second grant. A failed/facility outcome creates no retry authority.

Therefore earlier shorthand describing USD 2 or 560,000 tokens as the exact command's “total” is
correct only **per grant**. The conservative pre-launch authorization must disclose the true
invocation-wide worst case: two grants, 52 calls, 1,120,000 total tokens, and USD 4, while retaining
the unchanged per-request and per-grant bounds above.

## One-shot execution and disclosure gate

This block is execution-ready only after the named pending Stage 1 has been created, independently
attested, and frozen; repository/output identities, one-Lab state, credential readiness, and the
single-command authorization must still be green immediately before it starts. Run the whole block
once from a fresh PowerShell process at the downstream repository root. It deliberately contains
one `run` invocation and one `inspect` invocation, with no retry branch.

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-OrdinaryDirectory([string]$LiteralPath) {
  $item = Get-Item -LiteralPath $LiteralPath -Force -ErrorAction Stop
  if (-not $item.PSIsContainer -or
      (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
    throw 'unsafe directory boundary'
  }
}

function Assert-OrdinaryFile([string]$LiteralPath) {
  $item = Get-Item -LiteralPath $LiteralPath -Force -ErrorAction Stop
  if ($item.PSIsContainer -or
      (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
    throw 'unsafe file boundary'
  }
}

function Test-JsonObjectWithProperties([object]$Value, [string[]]$Names) {
  if ($Value -isnot [pscustomobject]) { return $false }
  $available = @($Value.PSObject.Properties.Name)
  foreach ($name in $Names) {
    if ($available -cnotcontains $name) { return $false }
  }
  return $true
}

function Test-WindowsReservedSegment([string]$Segment) {
  $first = ($Segment -split '\.', 2)[0]
  return $first -match '^(?i:CON|PRN|AUX|NUL|CLOCK\$|COM[1-9]|LPT[1-9])$'
}

$terminal = $null
$terminalExitCode = 1
$repositoryRoot = $expectedRepositoryRoot = $debugDirectory = $pendingPath = $pendingIdentity = $null
$runsDirectory = $runId = $debugLeaf = $debugPath = $expectedRunPath = $reportedRunPath = $null
$cliVerdict = $liveExitCode = $null
$liveRaw = $liveLine = $liveResult = $null
$inspectRaw = $inspectLine = $inspection = $inspectionPath = $inspectExitCode = $null
$completePath = $indexPath = $manifestPath = $complete = $index = $manifest = $normalizedEntries = $null
$pathSet = $null
$relative = $portable = $segments = $normalizedRelative = $containedPath = $runPrefix = $null
$entry = $segment = $manifestEntries = $null
$completeNames = $indexBytes = $indexText = $indexDigest = $null
$sha256 = $indexHashBytes = $null

try {
  $repositoryRoot = [IO.Path]::GetFullPath((Get-Location).Path)
  $expectedRepositoryRoot = [IO.Path]::GetFullPath('F:\!FluxIQWebExtension')
  if ($repositoryRoot -ne $expectedRepositoryRoot) { throw 'wrong repository root' }

  Remove-Item -LiteralPath 'Env:FLUXIQ_LAB_INSTANCE' -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath 'Env:FLUXIQ_TEST_RUNS_DIR' -ErrorAction SilentlyContinue
  if ((Test-Path -LiteralPath 'Env:FLUXIQ_LAB_INSTANCE') -or
      (Test-Path -LiteralPath 'Env:FLUXIQ_TEST_RUNS_DIR')) {
    throw 'location override survived clearing'
  }
  $env:FLUXIQ_TEST_ENV_FILES = 'none'
  $env:FLUXIQ_TEST_TARGET = 'isolated'

  $debugDirectory = [IO.Path]::GetFullPath((Join-Path $repositoryRoot 'docs/working/language-driven-flow-loop-plan/debugs'))
  $pendingPath = [IO.Path]::GetFullPath((Join-Path $debugDirectory 'pending-t171-run5-measured-correction.md'))
  Assert-OrdinaryDirectory $debugDirectory
  Assert-OrdinaryFile $pendingPath
  if ([IO.Directory]::GetParent($pendingPath).FullName -ne $debugDirectory -or
      [IO.Path]::GetFileName($pendingPath) -cne 'pending-t171-run5-measured-correction.md') {
    throw 'pending debug escaped its fixed directory'
  }
  $pendingIdentity = (Get-FileHash -LiteralPath $pendingPath -Algorithm SHA256 -ErrorAction Stop).Hash

  $liveRaw = @(& node packages/test-runner/dist/cli.js run everything-store `
    --target isolated `
    --live-llm `
    --llm-profile mvp-hard-scenario `
    --llm-provider deepseek `
    --llm-task create-flow `
    --instruction-task everything-store-plus-earbuds-under-50 `
    --replays 1 2>$null)
  $liveExitCode = $LASTEXITCODE
  $liveLine = $liveRaw |
    Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } |
    Select-Object -Last 1
  if ([string]::IsNullOrWhiteSpace([string]$liveLine)) { throw 'live result absent' }
  try {
    $liveResult = $liveLine | ConvertFrom-Json -ErrorAction Stop
    if (-not (Test-JsonObjectWithProperties $liveResult @('runId', 'path', 'verdict'))) {
      throw 'live result shape invalid'
    }
  } catch {
    throw 'live result boundary invalid'
  }

  $runId = [string]$liveResult.runId
  if ($runId -notmatch '^run-[a-z0-9]+-[0-9a-f]{8}$' -or
      $runId -in @('.', '..') -or $runId.EndsWith('.') -or
      (Test-WindowsReservedSegment $runId)) {
    throw 'unsafe facility run id'
  }

  $debugLeaf = "$runId.md"
  $debugPath = [IO.Path]::GetFullPath((Join-Path $debugDirectory $debugLeaf))
  if ([IO.Directory]::GetParent($debugPath).FullName -ne $debugDirectory -or
      [IO.Path]::GetFileName($debugPath) -cne $debugLeaf) {
    throw 'debug destination escaped its fixed directory'
  }
  if (Test-Path -LiteralPath $debugPath) { throw 'debug destination collision' }

  Rename-Item -LiteralPath $pendingPath -NewName $debugLeaf -ErrorAction Stop
  if ((Test-Path -LiteralPath $pendingPath) -or
      -not (Test-Path -LiteralPath $debugPath -PathType Leaf)) {
    throw 'rename postcondition failed'
  }
  Assert-OrdinaryFile $debugPath
  if ((Get-FileHash -LiteralPath $debugPath -Algorithm SHA256 -ErrorAction Stop).Hash -ne $pendingIdentity) {
    throw 'bound Stage 1 identity changed'
  }

  $runsDirectory = [IO.Path]::GetFullPath((Join-Path $repositoryRoot 'test-runs'))
  $expectedRunPath = [IO.Path]::GetFullPath((Join-Path $runsDirectory $runId))
  if ([IO.Directory]::GetParent($expectedRunPath).FullName -ne $runsDirectory -or
      [IO.Path]::GetFileName($expectedRunPath) -cne $runId) {
    throw 'run destination escaped default root'
  }
  try {
    $reportedRunPath = [IO.Path]::GetFullPath([string]$liveResult.path)
  } catch {
    throw 'reported path invalid'
  }
  if ($reportedRunPath -ne $expectedRunPath) { throw 'reported path mismatch' }
  $cliVerdict = [string]$liveResult.verdict
  if ($cliVerdict -notin @('passed', 'failed')) { throw 'open verdict' }

  Assert-OrdinaryDirectory $runsDirectory
  Assert-OrdinaryDirectory $expectedRunPath

  $liveRaw = $liveLine = $liveResult = $reportedRunPath = $null

  $inspectRaw = @(& node packages/test-runner/dist/cli.js inspect $runId 2>$null)
  $inspectExitCode = $LASTEXITCODE
  $inspectLine = $inspectRaw |
    Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } |
    Select-Object -Last 1
  if ($inspectExitCode -ne 0 -or [string]::IsNullOrWhiteSpace([string]$inspectLine)) {
    throw 'inspection failed'
  }
  try {
    $inspection = $inspectLine | ConvertFrom-Json -ErrorAction Stop
    if (-not (Test-JsonObjectWithProperties $inspection @('valid', 'runId', 'path'))) {
      throw 'inspection shape invalid'
    }
    $inspectionPath = [IO.Path]::GetFullPath([string]$inspection.path)
  } catch {
    throw 'inspection boundary invalid'
  }
  if ($inspection.valid -ne $true -or [string]$inspection.runId -ne $runId -or
      $inspectionPath -ne $expectedRunPath) {
    throw 'inspection identity mismatch'
  }
  $inspectRaw = $inspectLine = $inspection = $inspectionPath = $null

  $completePath = [IO.Path]::GetFullPath((Join-Path $expectedRunPath 'bundle.complete.json'))
  $indexPath = [IO.Path]::GetFullPath((Join-Path $expectedRunPath 'artifact-index.json'))
  $manifestPath = [IO.Path]::GetFullPath((Join-Path $expectedRunPath 'run.json'))
  if ([IO.Directory]::GetParent($completePath).FullName -ne $expectedRunPath -or
      [IO.Path]::GetFileName($completePath) -cne 'bundle.complete.json' -or
      [IO.Directory]::GetParent($indexPath).FullName -ne $expectedRunPath -or
      [IO.Path]::GetFileName($indexPath) -cne 'artifact-index.json' -or
      [IO.Directory]::GetParent($manifestPath).FullName -ne $expectedRunPath -or
      [IO.Path]::GetFileName($manifestPath) -cne 'run.json') {
    throw 'fixed artifact path escaped run root'
  }
  Assert-OrdinaryFile $completePath
  Assert-OrdinaryFile $indexPath
  Assert-OrdinaryFile $manifestPath

  try {
    $complete = Get-Content -LiteralPath $completePath -Raw -Encoding utf8 -ErrorAction Stop |
      ConvertFrom-Json -ErrorAction Stop
    $completeNames = @($complete.PSObject.Properties.Name)
    if ($complete -isnot [pscustomobject] -or $completeNames.Count -ne 2 -or
        $completeNames -cnotcontains 'schemaVersion' -or
        $completeNames -cnotcontains 'artifactIndexSha256' -or
        [string]$complete.schemaVersion -ne '0.1' -or
        [string]$complete.artifactIndexSha256 -cnotmatch '^[0-9a-f]{64}$') {
      throw 'completion marker shape invalid'
    }
  } catch {
    throw 'completion marker boundary invalid'
  }

  try {
    $indexBytes = [IO.File]::ReadAllBytes($indexPath)
    $sha256 = [Security.Cryptography.SHA256]::Create()
    try {
      $indexHashBytes = $sha256.ComputeHash($indexBytes)
    } finally {
      $sha256.Dispose()
      $sha256 = $null
    }
    $indexDigest = [BitConverter]::ToString($indexHashBytes).Replace('-', '').ToLowerInvariant()
    if ($indexDigest -cne [string]$complete.artifactIndexSha256) {
      throw 'current index digest mismatch'
    }
    $indexText = [Text.UTF8Encoding]::new($false, $true).GetString($indexBytes)
    $index = $indexText | ConvertFrom-Json -ErrorAction Stop
    if (-not (Test-JsonObjectWithProperties $index @('schemaVersion', 'artifacts')) -or
        [string]$index.schemaVersion -ne '0.1' -or
        -not ($index.artifacts -is [System.Array])) {
      throw 'index shape invalid'
    }
    $normalizedEntries = @()
    $pathSet = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach ($entry in $index.artifacts) {
      if (-not (Test-JsonObjectWithProperties $entry @('path', 'mediaType', 'bytes', 'sha256', 'redaction')) -or
          [string]::IsNullOrWhiteSpace([string]$entry.mediaType) -or
          -not ($entry.bytes -is [long] -or $entry.bytes -is [int]) -or
          [long]$entry.bytes -lt 0 -or
          [string]$entry.sha256 -notmatch '^[0-9a-f]{64}$') {
        throw 'index entry shape invalid'
      }
      $relative = [string]$entry.path
      if ([string]::IsNullOrWhiteSpace($relative) -or [IO.Path]::IsPathRooted($relative) -or
          $relative.Contains(':')) {
        throw 'index path invalid'
      }
      $portable = $relative.Replace('\', '/')
      $segments = @($portable -split '/')
      if ($segments.Count -eq 0 -or @($segments | Where-Object {
            [string]::IsNullOrWhiteSpace($_) -or $_ -in @('.', '..') -or
            $_.EndsWith('.') -or $_.EndsWith(' ') -or
            $_ -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]*$' -or
            $_ -match '[<>:"|?*]' -or (Test-WindowsReservedSegment $_)
          }).Count -ne 0) {
        throw 'index segment invalid'
      }
      $normalizedRelative = [string]::Join('/', $segments)
      if (-not $pathSet.Add($normalizedRelative)) { throw 'normalized index path duplicated' }
      $containedPath = $expectedRunPath
      foreach ($segment in $segments) { $containedPath = Join-Path $containedPath $segment }
      $containedPath = [IO.Path]::GetFullPath($containedPath)
      $runPrefix = $expectedRunPath.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
      if (-not $containedPath.StartsWith($runPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'normalized index path escaped run root'
      }
      if ([string]$entry.redaction -notin @('applied', 'verified')) {
        throw 'unsafe redaction state'
      }
      $normalizedEntries += [pscustomobject]@{
        relative = $normalizedRelative
        fullPath = $containedPath
        redaction = [string]$entry.redaction
      }
    }
  } catch {
    throw 'artifact index boundary invalid'
  }

  $manifestEntries = @($normalizedEntries | Where-Object { $_.relative -ieq 'run.json' })
  if ($manifestEntries.Count -ne 1 -or $manifestEntries[0].fullPath -ne $manifestPath) {
    throw 'manifest index authority invalid'
  }
  Assert-OrdinaryFile $manifestEntries[0].fullPath
  try {
    $manifest = Get-Content -LiteralPath $manifestEntries[0].fullPath -Raw -Encoding utf8 -ErrorAction Stop |
      ConvertFrom-Json -ErrorAction Stop
    if (-not (Test-JsonObjectWithProperties $manifest @('runId', 'verdict', 'redactionState'))) {
      throw 'manifest shape invalid'
    }
  } catch {
    throw 'manifest boundary invalid'
  }
  if ([string]$manifest.runId -ne $runId -or
      [string]$manifest.verdict -ne $cliVerdict -or
      [string]$manifest.redactionState -notin @('verified', 'not_applicable')) {
    throw 'manifest attestation invalid'
  }

  $terminal = [pscustomobject]@{
    status = 'go'
    code = 'capture_gate.passed'
    runId = $runId
    verdict = $cliVerdict
    liveExitCode = $liveExitCode
    integrity = 'passed'
    redaction = 'passed'
    debugBound = $true
  }
  $terminalExitCode = 0
} catch {
  # Deliberately ignore the ErrorRecord. Never format it or any nested exception.
  $terminal = [pscustomobject]@{
    status = 'no-go'
    code = 'capture_gate.no_go'
  }
  $terminalExitCode = 1
} finally {
  $repositoryRoot = $expectedRepositoryRoot = $debugDirectory = $pendingPath = $pendingIdentity = $null
  $runsDirectory = $runId = $debugLeaf = $debugPath = $expectedRunPath = $reportedRunPath = $null
  $cliVerdict = $liveExitCode = $null
  $liveRaw = $liveLine = $liveResult = $null
  $inspectRaw = $inspectLine = $inspection = $inspectionPath = $inspectExitCode = $null
  $completePath = $indexPath = $manifestPath = $complete = $index = $manifest = $normalizedEntries = $pathSet = $null
  $relative = $portable = $segments = $normalizedRelative = $containedPath = $runPrefix = $null
  $entry = $segment = $manifestEntries = $null
  $completeNames = $indexBytes = $indexText = $indexDigest = $null
  if ($null -ne $sha256) {
    try { $sha256.Dispose() } catch { }
  }
  $sha256 = $indexHashBytes = $null
}

# The fresh PowerShell process emits exactly one reviewed terminal object and ends.
$terminal
exit $terminalExitCode
```

Proof notes:

- The two inherited location variables are deleted by name before the child exists and then tested
  absent. Their values are never read. Thus the CLI can use only the accepted default Lab instance
  and `test-runs/<run-id>` root.
- The pending file must pre-exist and its identity is retained only in memory. Collision is checked
  before rename; the safe-id gate requires the facility's `run-…-<8 hex>` shape and rejects dot,
  trailing-dot, and Windows device aliases. Both debug and run destinations are independently
  canonicalized and proved to be exact immediate children with exact leaf names. Debug/run roots,
  pending/destination debug files, the run directory, completion marker, index, and manifest must
  all be ordinary non-reparse objects. Rename occurs before path, verdict, `inspect`, or bundle
  reads; afterward the old name must be absent, the destination ordinary/present, and its in-memory
  digest unchanged.
- Both commands retain stdout only in variables and discard stderr. Each raw/nested object is nulled
  by the outer `finally`, including unexpected cmdlet/.NET/strict-mode failures. The outer catch
  ignores its `ErrorRecord`; the fresh process emits exactly one reviewed terminal object and exits
  with the corresponding code. A nonzero live exit may still proceed when it supplies a safe id and
  finalized closed failure bundle; integrity/redaction failures stop before semantic reads.
- `inspect` proves marker/index and indexed byte/digest integrity. The wrapper separately reads the
  ordinary, contained completion marker inside a sanitized boundary and requires the closed exact
  case-sensitive two-field shape, schema `0.1`, and a lower-case 64-hex index digest. It then reads
  the current index exactly once as bytes, computes SHA-256 in memory through the Windows
  PowerShell 5.1-compatible `SHA256.Create().ComputeHash(...)` / `BitConverter` path, disposes the
  algorithm in `finally`, compares ordinally to the marker, strictly decodes those same bytes as
  UTF-8, and parses that same text. No digest is displayed. Live, inspection, marker, index, every
  index entry, and manifest must be JSON objects/arrays with their required case-sensitive
  properties before property access.
- Indexed paths are reduced to accepted Windows-safe segments, normalized beneath the run root, and
  deduplicated with `OrdinalIgnoreCase`; rooted/colon, empty, dot, device, invalid-character,
  trailing-dot/space, escaped, or case-aliased entries fail closed. Conservative redaction is
  required for every entry. Before opening the manifest, the wrapper repeats unique-entry,
  containment, ordinary-file/non-reparse, and redaction authority. Later semantic review must
  repeat those checks for every allowlisted artifact, including conditional
  `snapshots/redaction-attestation.json`.
- There is no loop, recursive call, or catch-and-rerun branch. Every live/facility/product failure
  consumes this authorization; another invocation requires complete debugging and a new freeze.

The only intentional difference from t419's accepted dry run is removal of the terminal
`--dry-run` flag. Any other CLI token addition, removal, reordering, or value change invalidates its
identity, including scenario, target, profile, provider, task, instruction task, or replay count;
adding model/seed/workflow/Flow/evidence/budget/call/token/cost/timeout/retry/concurrency/Lab-instance
or run-root arguments; or running from another checkout/build. So does allowing
`FLUXIQ_LAB_INSTANCE` or `FLUXIQ_TEST_RUNS_DIR` to reach the child, changing either isolation
variable, persisting raw stdout/stderr, or adding any automatic retry. Capture syntax, safe parsing,
the required environment normalization, and null redirection do not mutate the CLI request.

## Scope

I read only the assigned Current State, reports t266/t310/t331/t340/t346/t407/t420, and the accepted
sanitized run-4 debug; consumed t419's sanitized reported dry-run/freshness facts; inspected only the
credential resolver and environment filter implementation; checked only credential-variable/
declaration presence and syntactic status; traced the downstream created-Flow authorization hooks,
budget planner, and Core grant/continuation implementation; and wrote only this report. I did not
inspect a secret value or raw artifact, invoke a provider/browser/Lab/panel, build/test, create or
edit Stage 1, edit a shared document, or touch staging, commits, or remotes.
