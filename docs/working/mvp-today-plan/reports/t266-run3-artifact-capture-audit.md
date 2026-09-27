# t266 — Run-3 artifact-capture audit

## Verdict

**GO with the corrected serial procedure below; NO-GO for reusing `Invoke-T178LiveRun` unchanged.**

The established run-3 plan has the right artifacts and privacy boundary, but its inherited helper
calls `inspect` before the pending debug is renamed. `inspect` hashes every indexed artifact and
parses `run.json`; although it emits only bounded fields, that ordering is weaker than the explicit
no-hindsight rule to bind Stage 1 to the real run id before any bundle inspection. The inherited
helper also allows the live command's stderr to reach the operator terminal. The CLI's top-level
error path includes an error message, so the capture procedure must not assume every future stderr
message is safe to display.

The corrected order is:

1. create and finish the pending Stage-1 debug after all preflight/readiness gates;
2. invoke the provider exactly once while retaining stdout in memory and discarding stderr;
3. parse only the final stdout JSON line, validate the real run id, and never print the raw result;
4. immediately rename the pending debug to `<run-id>.md`;
5. validate the returned default bundle path;
6. run `inspect`, retaining its output in memory and discarding stderr;
7. require a valid, matching inspection result, then apply the index/redaction gate;
8. only then open the minimal structured artifacts in t223 order and complete the debug.

No run-3 pending debug, dry run, live run, bundle, browser, provider, Lab process, build output, or
source/shared document was created, opened, executed, or changed for this audit.

## Copy-ready serial procedure

### 1. Create and attest Stage 1

After every t249/t262 product, validation, freshness, one-Lab, credential, and zero-provider
readiness gate is green, first assert that the pending path is unused:

```powershell
$pending = 'docs/working/language-driven-flow-loop-plan/debugs/pending-t249-run-3.md'
if (Test-Path -LiteralPath $pending) {
  throw 'NO-GO: run-3 pending debug already exists; reconcile it without overwriting it'
}
```

Use `apply_patch` to add `$pending` with the exact copy-ready block from t262. Do not use a prior
run's debug and do not backfill from runs 1 or 2. Before proceeding, manually attest that the file
contains the complete header and all Stage-1 fields from t262: verbatim instruction, nine-step
expected chain, plausible wrong answer, exact 13-record ordered oracle, hypotheses, authority and
accounting invariants, pass threshold, and consecutive-pass rule. It must still say the run id and
outcome are pending. Run the second one-Lab/process gate only after that attestation passes.

Do not start a transcript. The real credential remains process-only and must never be interpolated
into a command or written to the debug.

### 2. Invoke once and capture without disclosure

Run the unchanged command below. Do not add a max-call, token, cost, timeout, target, Lab-instance,
or run-root override. Redirect stderr to the null sink rather than the terminal or a file. Keep
stdout only in memory and never echo, format, serialize, or save `$liveRaw` or `$liveResult`; the
successful CLI result includes nested observation/evaluation objects beyond the small fields needed
to bind the run.

```powershell
$liveRaw = @(& node packages/test-runner/dist/cli.js run everything-store `
  --target isolated `
  --live-llm `
  --llm-profile mvp-hard-scenario `
  --llm-provider deepseek `
  --llm-task create-flow `
  --instruction-task everything-store-plus-earbuds-under-50 `
  --replays 1 2>$null)
$liveExitCode = $LASTEXITCODE
$liveLine = $liveRaw | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } |
  Select-Object -Last 1

if ([string]::IsNullOrWhiteSpace([string]$liveLine)) {
  $liveRaw = $null
  throw "Run 3 produced no parseable result; pending debug retained; exit code $liveExitCode"
}
try {
  $liveResult = $liveLine | ConvertFrom-Json -ErrorAction Stop
} catch {
  $liveRaw = $null; $liveLine = $null
  throw "Run 3 result was not JSON; pending debug retained; exit code $liveExitCode"
}
$runId = [string]$liveResult.runId
if ($runId -notmatch '^[A-Za-z0-9._-]{1,128}$') {
  $liveRaw = $null; $liveLine = $null; $liveResult = $null
  throw "Run 3 returned no safe run id; pending debug retained; exit code $liveExitCode"
}
```

A non-zero exit code is not by itself a reason to stop: a product failure normally has a real run
id and finalized bundle and must be debugged. If there is no safe run id, retain the pending file,
report only the generic startup state and numeric exit code above, and do not inspect stderr or
invent a name.

### 3. Bind Stage 1 to the run before inspection

Once a safe real run id exists, rename immediately. Do this before checking bundle contents or
calling `inspect`. A pre-existing destination is a hard stop; never overwrite it.

```powershell
$debugDirectory = 'docs/working/language-driven-flow-loop-plan/debugs'
$debugPath = Join-Path $debugDirectory "$runId.md"
if (Test-Path -LiteralPath $debugPath) {
  $liveRaw = $null; $liveLine = $null; $liveResult = $null
  throw 'NO-GO: the real run-id debug path already exists; do not overwrite it'
}
Rename-Item -LiteralPath $pending -NewName "$runId.md"

$expectedRunPath = Join-Path 'F:\!FluxIQWebExtension\test-runs' $runId
$reportedRunPath = [string]$liveResult.path
if ([string]::IsNullOrWhiteSpace($reportedRunPath) -or
    [IO.Path]::GetFullPath($reportedRunPath) -ne [IO.Path]::GetFullPath($expectedRunPath)) {
  $liveRaw = $null; $liveLine = $null; $liveResult = $null
  throw 'NO-GO: run bundle was reported outside the default run root; debug remains bound to the real run id'
}
$cliVerdict = [string]$liveResult.verdict
if ($cliVerdict -notin @('passed', 'failed')) {
  $liveRaw = $null; $liveLine = $null; $liveResult = $null
  throw 'NO-GO: CLI result carried no closed run verdict; debug remains bound to the real run id'
}
$liveRaw = $null; $liveLine = $null; $liveResult = $null
```

Renaming before path validation is intentional: if the CLI created a real run but reported a wrong
root, the prewritten expectations still remain immutably associated with that run id. The path
mismatch invalidates the measurement; it does not justify leaving an ambiguous pending file.

### 4. Inspect without printing bundle or error content

Capture `inspect` output in memory and suppress its stderr. `inspect` reads `bundle.complete.json`
and `artifact-index.json`, validates their digest relationship, verifies every indexed artifact's
byte count and SHA-256, and parses `run.json`. It does not itself enforce the operator's redaction
read boundary, so inspection success is necessary but not sufficient.

```powershell
$inspectRaw = @(& node packages/test-runner/dist/cli.js inspect $runId 2>$null)
$inspectExitCode = $LASTEXITCODE
$inspectLine = $inspectRaw | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } |
  Select-Object -Last 1
if ($inspectExitCode -ne 0 -or [string]::IsNullOrWhiteSpace([string]$inspectLine)) {
  $inspectRaw = $null
  throw 'NO-GO: run-3 bundle integrity inspection failed; do not open bundle content or make another provider call'
}
try {
  $inspection = $inspectLine | ConvertFrom-Json -ErrorAction Stop
} catch {
  $inspectRaw = $null; $inspectLine = $null
  throw 'NO-GO: run-3 inspection result was not JSON; do not open bundle content'
}
if ($inspection.valid -ne $true -or [string]$inspection.runId -ne $runId -or
    [IO.Path]::GetFullPath([string]$inspection.path) -ne [IO.Path]::GetFullPath($expectedRunPath)) {
  $inspectRaw = $null; $inspectLine = $null; $inspection = $null
  throw 'NO-GO: run-3 inspection identity/path mismatch; do not open bundle content'
}
$inspectRaw = $null; $inspectLine = $null; $inspection = $null
```

Do not print the CLI result object or inspection JSON. A user-facing status at this point may name
only the run id, closed CLI verdict, numeric exit code, and that integrity inspection passed.

### 5. Apply the redaction gate before semantic evidence reads

After `inspect` succeeds, read only `artifact-index.json` and then `run.json` for this gate. Do not
print hashes or artifact contents.

```powershell
$indexPath = Join-Path $expectedRunPath 'artifact-index.json'
$index = Get-Content -LiteralPath $indexPath -Raw -Encoding utf8 | ConvertFrom-Json -ErrorAction Stop
if ($index.schemaVersion -ne '0.1' -or -not ($index.artifacts -is [System.Array])) {
  throw 'NO-GO: invalid artifact index shape; stop evidence review'
}
$unsafeRedaction = @($index.artifacts | Where-Object {
  $_.redaction -notin @('applied', 'verified')
})
if ($unsafeRedaction.Count -ne 0) {
  throw 'NO-GO: an indexed artifact lacks applied/verified redaction; stop evidence review'
}

$manifest = Get-Content -LiteralPath (Join-Path $expectedRunPath 'run.json') -Raw -Encoding utf8 |
  ConvertFrom-Json -ErrorAction Stop
if ([string]$manifest.runId -ne $runId -or
    $manifest.redactionState -notin @('verified', 'not_applicable')) {
  throw 'NO-GO: run identity/redaction attestation failed; stop evidence review'
}
if ([string]$manifest.verdict -ne $cliVerdict) {
  throw 'NO-GO: CLI and finalized manifest verdicts disagree; stop evidence review'
}
```

`inspect` has already verified every indexed byte count and digest against the completion marker,
so do not write a second ad-hoc hashing implementation. The index and manifest checks add the
missing disclosure gate. If integrity, identity, or redaction fails, keep the renamed debug, record
the blocker without bundle-derived detail, and make no further provider call.

### 6. Minimal post-gate read order

Only after all gates above pass, complete the renamed debug from the smallest bounded artifacts:

1. `run.json`, `summary.json`, and `evaluation.json`;
2. `snapshots/live-llm.json`;
3. `snapshots/flow-lane.json` when indexed;
4. `snapshots/extraction-mismatches.json` only for a judged mismatch;
5. `snapshots/repair-lane.json` only when indexed and Stage 6 was reached.

Require each file to have exactly one verified index entry before opening it. Corroborate the run id
across the manifest, summary, and evaluation. Follow t223's field map and t262's failure checklist.
Use `NO EVIDENCE:` for absent properties or artifacts; do not widen the read set to compensate.
Never open or quote provider sidecars, prompts/responses, raw logs, `events.ndjson`, screenshots,
video, HTML/contact sheets, browser profiles, databases, raw page snapshots, or raw datasets.

Do not revise Stage 1. Only replace pending header facts with corroborated, sanitized evidence.
Publish accounting representations separately and never sum overlapping build/main or repair/
verification buckets. Fully debug and classify run 3 before another provider call. A pass advances
the streak only to 1; a failure leaves it at 0.

## Contradictions and pitfalls resolved

- **Rename versus inspect:** t249's helper inspected first, while t249/t262's prose requires rename
  before bundle reading. The corrected sequence follows the stricter no-hindsight rule.
- **CLI stderr:** do not display or persist it. The top-level CLI error shape contains a message;
  a closed category is not proof that arbitrary message text is safe.
- **CLI stdout:** the final result contains nested structured observations/evaluation, not merely
  the five t178 display fields. It may be parsed in memory but never printed or saved wholesale.
- **`inspect` scope:** it proves completion-marker/index digest and every indexed byte/hash, but it
  does not enforce `redactionState` or restrict later operator reads. Apply the explicit index and
  manifest redaction gate afterward.
- **Failed product verdict:** a non-zero exit with a valid run id is still inspected and debugged.
  Only missing/unsafe run id, wrong root, integrity failure, identity mismatch, or redaction failure
  stops evidence reading.
- **No second call:** startup, facility, product, integrity, and redaction failures all retain their
  bound debug state and must be resolved or fully analyzed before another provider invocation.

## Audit basis

Read: t219, t249, t262, t178's live helper, t223/t228's run-2 evidence boundary, the accepted run-2
debug, the blank debug template, and the runner's CLI/parser/`inspect` implementation. The runner
confirms that dry-run stops before topology/browser/provider work; `inspect` verifies marker/index
and all indexed artifacts; and the live `run` stdout result can include nested observation and
evaluation objects. No command described above was executed during this report-only audit.
