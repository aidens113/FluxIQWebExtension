# t420 — Next fresh-run no-hindsight contract

## Disposition

**NO-GO for a provider call now; GO as a copy-ready authorization checklist after every pending
item below is frozen and independently verified.** Run 4 remains the latest accepted live
measurement, the consecutive-pass streak is 0, and its repeated Stage-2 exhaustion forbids an
unchanged retry. The next eligible call is instead a single convergence measurement of the settled
`step_rows_v1` packing correction, with the scenario, instruction, oracle, profile, budgets, and
acceptance threshold unchanged. Provider-free evidence does not predict or prove live convergence.

## Frozen request identity

Mark this section GO only when one provider-free dry run returns `ready`, makes zero provider calls,
and supplies one runnable command that is copied byte-for-byte into the authorization record:

- scenario `everything-store`, isolated created-Flow lane, no variant;
- provider/profile DeepSeek / `mvp-hard-scenario`;
- task `everything-store-plus-earbuds-under-50`, LLM task `create-flow`, exactly one replay;
- the same canonical instruction source used by t331, frozen by path, strict UTF-8 normalization
  rule, byte count, and SHA-256 without reproducing page, provider, credential, or browser content;
- the same nine-step expected chain attested by t340, frozen by canonical source-slice identity and
  digest rather than reconstructed after the run;
- no call, token, cost, timeout, retry, concurrency, target, Lab-instance, or run-root override;
- per request: 48,000 input, 8,000 output, and 56,000 total tokens, USD 0.25 estimated
  cost, and an effective 25-second request timeout (the declared 30 seconds is clamped to Core's
  ceiling); and
- per grant: at most 26 calls, 560,000 total tokens, and USD 2 total estimated cost, with zero
  provider retries and concurrency fixed at one.

The created-Flow invocation may issue two distinct sequential grants with that same envelope: one
`build_and_adapt` grant for the build, then one `diagnose_and_adapt` grant for playback,
verification, and any proposed repair. The deterministic replay issues no grant and makes zero
provider calls. Thus 26 calls, 560,000 tokens, and USD 2 are **not invocation-wide totals**. The
source-proven worst-case authorization exposure for this lane is two grants: up to 52 provider
calls, 1,120,000 grant-total tokens, and USD 4 estimated cost across the invocation. This is the sum
of two separately enforced grant envelopes, not a third invocation-level aggregate budget; the
second grant is never reached if the build does not progress to playback.

Any mismatch between the accepted dry-run request and prospective live command is NO-GO. The
record must also bind the settled Core/downstream HEADs and clean statuses, final relevant checks,
fresh output identities, privacy scan, one-Lab predicate, output target, and credential readiness.
The exact launch process must prove inherited `FLUXIQ_LAB_INSTANCE` and `FLUXIQ_TEST_RUNS_DIR` are
absent or explicitly cleared; `FLUXIQ_TEST_ENV_FILES=none` does not clear inherited process
variables. This is required to prove the default Lab instance and default repository `test-runs/`
root. Do not record secret values.

## Stage 1 assertions frozen before output exists

The pending debug must state, and an independent ordinal comparison must attest, all of the
following before launch:

1. This is one measured-correction run after accepted run 4
   (`run-muje0grk-4d8d2d3f`), whose terminal family was
   `flow_bootstrap.evidence_unusable_decision` / `bootstrap.cannot_answer_instruction`; it is not
   another unchanged run-4 retry.
2. The only convergence hypothesis is lossless `step_rows_v1` packing of all bounded draft inputs
   within the unchanged 4,000-byte reservation. No weakened answerability or enlarged allowance is
   under test.
3. The instruction and nine-step chain are the frozen canonical identities above. Their text may
   not be regenerated from live output or edited after launch.
4. The oracle is exactly 13 ordered records from `extract-plus-under-fifty`; every record must
   satisfy `kind === "earbuds"`, `plus === true`, `rating >= 4`, and `priceCents < 5000`.
   `name`, `price`, `rating`, and `url` must match in exact order. Organic-only extraction,
   all-page traversal, stable order, and identity-based de-duplication are mandatory; count alone
   cannot pass.
5. The exact existing run-owned grant may continue only through an authorized binding update. It
   may not be minted, replaced, widened, reset, transferred, or spared terminal revocation.
6. The pre-run streak is 0. One complete pass can advance it only to 1.

Run id, UTC date, observed model, calls/tokens/cost, reported verdict, and stage reached remain
explicitly `pending`; no prior-run trace or predicted live result may fill them.

## Evidence and debug obligations

Before launch, freeze the artifact schema/version, finalized marker/index and digest checks,
conservative-redaction policy, and bounded structured-artifact allowlist. The debug must reserve
sanitized fields for request identity; repository/build identity; reported verdict and highest
stage; decision/tool-call summaries; Flow proposal/review/creation; runtime and exact oracle result;
judgement/refutation; repair directive, application, persistence, and authoritative binding;
selected-Subflow zero-provider replay; post-replay judgement; terminal grant revocation; and
disjoint call/token/cost accounting. A missing fact is `NO EVIDENCE`, never an invitation to open
raw content.

After the one invocation, parse only the final nonblank stdout JSON in memory. Require a safe run id
matching `^[A-Za-z0-9._-]{1,128}$`; rename the pending debug to that id before inspection; require the
default `test-runs/<run-id>` path and closed `passed|failed` verdict. Then run silent integrity
inspection and require matching identity, `valid: true`, artifact-index schema `0.1`, exactly one
safe index entry per requested artifact, redaction `applied` or `verified`, and matching `run.json`
identity/verdict with manifest redaction `verified` or `not_applicable`. Until all gates pass, no
semantic artifact may be read. Never display or open raw stdout/inspection objects, prompts,
responses, page rows, logs/events, HTML/screenshots, selectors, credentials, headers, cookies,
browser state, hashes, unindexed artifacts, or authorization material.

## Authorization, stop, and pass branches

Immediately before launch, prove no other Lab/live run or competing build/test job is active,
`FLUXIQ_LAB_INSTANCE` and `FLUXIQ_TEST_RUNS_DIR` are absent/cleared in the exact launch process, and
the frozen repositories/outputs are unchanged. Panel start/stop/restart requires separate
current-session user authorization if the qualifying path needs it. Only after all gates are GO may
the supervisor issue fresh authorization naming the exact single command, single invocation, and
potential two-grant exposure (at most 52 calls, 1,120,000 grant-total tokens, and USD 4 estimated
cost; zero retries; concurrency one; replay zero-provider).

- **Pass 1:** accept only a finalized integrity-valid bundle with `verdict: passed`,
  `flowCreated: true`, `oracleVerdict: passed`, `reportedVerdict: passed`, confirmed verification,
  the exact ordered 13-record/four-field result, and one zero-provider deterministic replay. If a
  repair occurred, also require screened actionable direction, applied and persisted adaptation,
  authoritative binding, selected-Subflow replay, post-replay judgement, and terminal revocation.
  Then the streak becomes 1; stop and fully debug before considering another call.
- **Pass 2:** requires a second independent run under the same unchanged scenario, instruction,
  oracle, profile, budgets, and acceptance threshold, plus a new post-debug readiness freeze and a
  new explicit command-specific authorization. Only another complete pass makes the streak 2 and
  satisfies the two-pass live exit criterion.
- **Any failure/facility fault:** consumes the authorized invocation and leaves/resets the streak to
  0. Bind and classify any safe finalized evidence, but do not retry automatically. A missing or
  unsafe id, integrity/redaction/identity failure, budget breach, or repeated cannot-answer outcome
  is NO-GO for semantic reading where applicable and NO-GO for another provider call until a
  measured fix and fresh closure exist.

## Copy-ready GO/NO-GO authorization line

> **GO / NO-GO:** I verified the settled Core/downstream identities and checks; accepted the
> zero-provider `ready` dry run; attested the immutable Stage 1, 13-record ordered oracle, evidence
> contract, privacy boundary, credentials, one-Lab predicate, and absence/clearing of inherited Lab
> instance and run-root variables; and confirmed the exact live command matches the accepted
> request byte-for-byte. I understand that this one invocation can issue two sequential grants,
> each capped at 26 calls, 560,000 tokens, and USD 2, for a derived maximum exposure of 52 calls,
> 1,120,000 grant-total tokens, and USD 4; requests remain capped at 48,000 input / 8,000 output /
> 56,000 total tokens, USD 0.25, and 25 seconds, with zero retries, concurrency one, and a
> zero-provider replay. **GO** authorizes exactly that one invocation and no retry. Any unchecked or
> changed item means **NO-GO**.

## Scope

I reconciled only the assigned Current State and t331/t340/t346/t407 reports. I did not access raw
artifacts, provider/page/browser content, secrets, the panel, Lab, a browser, or a provider; did not
run tests/builds or inspect live processes; and did not edit source, a shared working document, or
Stage 1. This report is my only write and does not itself authorize a live run.

## Prospective-command equivalence audit

**GO, conditional on executing t422's complete wrapper in the required fresh PowerShell process.**
T419's accepted provider-free argument vector and t422's prospective live argument vector use the
same executable path, subcommand, scenario, and ordered option/value tokens. The sole request
mutation is removal of the final `--dry-run` token:

```text
node packages/test-runner/dist/cli.js run everything-store
--target isolated
--live-llm
--llm-profile mvp-hard-scenario
--llm-provider deepseek
--llm-task create-flow
--instruction-task everything-store-plus-earbuds-under-50
--replays 1
```

PowerShell whitespace, backtick continuations, `@(...)`, assignment of `$LASTEXITCODE`, and
`2>$null` do not add, remove, reorder, or alter CLI arguments. The array assignment retains stdout
in process memory; null redirection discards stderr. They are capture controls, not request
mutations. The later safe-id parsing, pending-debug rename, inspection, index/redaction checks, and
safe summary happen after the one live child and cannot change its request.

The environment difference is also wrapper-only safety normalization, not a wider request:

- both seams explicitly set `FLUXIQ_TEST_ENV_FILES=none` and `FLUXIQ_TEST_TARGET=isolated`;
- t422 first removes inherited `FLUXIQ_LAB_INSTANCE` and `FLUXIQ_TEST_RUNS_DIR` by name, without
  reading their values, and proves them absent before the child starts; this narrows execution to
  the default Lab instance and repository `test-runs/` root;
- no model, seed, workflow, evidence, Flow, budget, timeout, retry, concurrency, Lab-instance, or
  run-root argument or replacement environment override is introduced; and
- the credential resolver behavior is unchanged: the wrapper neither injects nor copies a secret.

T419 did not itself show an explicit removal of the two inherited location variables, so full
parent-process environment byte identity between the dry run and live run is not established. That
does not create a request mismatch: t422's clearing is the required fail-closed normalization of
the accepted default-location contract. If either variable survives the absence check, equivalence
is **NO-GO** and the live child must not start.

No unsafe persistence remains under t422's stated requirement to run the whole block in a **fresh
PowerShell process** and let that process end after the safe result. Inside that temporary process,
the wrapper intentionally removes the two inherited variables and leaves
`FLUXIQ_TEST_ENV_FILES=none` / `FLUXIQ_TEST_TARGET=isolated` set for both `run` and `inspect`; this
keeps the two commands on one environment contract. Running the block piecemeal in a reusable
interactive shell would persist those environment changes for later commands and is **NO-GO**
unless the caller first snapshots and restores them without printing values. Likewise, copying
only the `$liveRaw` command out of the wrapper would omit the location-variable absence proof and
is not equivalent to the reviewed seam.

This audit read only t419, the current t422 report, and the relevant command/environment resolution
sources. It did not execute a command, inspect an artifact or secret, or invoke a build, Lab,
provider, browser, or panel. The only edit is this appended audit.

## Independent PowerShell disclosure and path audit

**NO-GO as written. Do not execute the current t422 wrapper.** T419 correctly identified two
blocking defects: `.` and `..` pass the run-id regex and escape the required immediate-child path,
and uncaught `ConvertFrom-Json` failures for `artifact-index.json` / `run.json` may echo source
context. This review confirms both and finds additional fail-closed work needed before the wrapper
can truthfully promise that only sanitized output reaches the operator.

### Path and rename findings

- `^[A-Za-z0-9._-]{1,128}$` excludes separators and drive/ADS punctuation but admits `.` and `..`,
  Windows device basenames (`CON`, `NUL`, `COM1`, and peers, including with extensions), and names
  ending in a dot that Windows may alias. The first two can normalize to `test-runs` or its parent;
  device/trailing-dot names can make collision, rename, and existence checks disagree with the
  actual filesystem object.
- `$expectedRunPath` is built from the untrusted id before proving its normalized parent is exactly
  the default `test-runs` directory. Equality with the reported path does not cure this: both can
  agree on the same escaped path.
- `Rename-Item -NewName "$runId.md"` is otherwise directionally correct: it supplies only a leaf
  name, checks collision first, renames before inspection, and rechecks the pending payload hash.
  But `PathType Leaf` permits a reparse-point leaf, and neither the debug directory, pending file,
  destination, run root, nor finalized run directory is rejected when it is a reparse point.
- Collision is checked before rename and `Rename-Item` should fail rather than overwrite, but its
  failure is presently an uncaught PowerShell error. The same is true of hash, path, existence,
  file-read, and rename operations. Those errors may print filesystem paths, exception detail, and
  wrapper source context rather than one reviewed status.
- Artifact-index paths reject rooted values and a literal `..` segment, but they are not normalized
  and proved below the run directory, device/invalid segments are not rejected, and duplicate
  detection is not explicitly ordinal-ignore-case for the Windows filesystem. The wrapper opens
  only fixed `artifact-index.json` and `run.json`, so this is not current arbitrary-file reading,
  but the index is not yet a safe authority for the promised later bounded reads.

### Disclosure and parse-path findings

- Live and inspect stdout are captured, their stderr is discarded, only the final nonblank line is
  parsed, and the local JSON parse catches replace parse detail with fixed prose. Their `finally`
  blocks clear the raw arrays, lines, and parsed objects. These paths do not intentionally emit raw
  content.
- The live and inspection JSON values are not first required to be one object with the expected
  properties. With strict mode, a scalar, array, or missing property can raise an uncaught property
  error outside the local parse catch.
- The index and manifest parse pipelines have no sanitizing catch, confirming t419's raw-context
  defect. Their subsequent property enumeration can also throw on a malformed entry and escape the
  `finally` as an unsanitized PowerShell error.
- The final success object contains only the already syntax-bounded run id, closed verdict, numeric
  exit code, and fixed gate labels. No other success-path command uses `-PassThru`, and assigned
  pipeline results do not ordinarily reach the operator. The unsafe surface is failure formatting:
  there is no outer disclosure boundary, so any unanticipated cmdlet, .NET, strict-mode, or property
  error can be rendered by PowerShell. Nulling variables does not suppress an error record already
  emitted.

### Exact fixes required before static re-review

1. **Constrain the generated identity before any path use.** Require the facility's actual shape,
   for example `^run-[a-z0-9]+-[0-9a-f]{8}$`, rather than a generic filename regex. Independently
   reject `.` / `..`, trailing dot, and case-insensitive Windows reserved basenames before the first
   dot (`CON`, `PRN`, `AUX`, `NUL`, `CLOCK$`, `COM1`–`COM9`, `LPT1`–`LPT9`). Do not construct the
   debug or run destination until all checks pass.
2. **Prove immediate-child containment.** Normalize the fixed `$runsDirectory` first, then join and
   normalize the candidate. Require `[IO.Directory]::GetParent($expectedRunPath).FullName` to equal
   `$runsDirectory` and `[IO.Path]::GetFileName($expectedRunPath)` to equal `$runId`. Apply the same
   parent/leaf proof to `$debugPath` against the fixed debug directory and `"$runId.md"`. Continue
   to require the reported and inspected paths to equal this already-contained path.
3. **Reject link traversal.** Before hashing or renaming, require the debug directory and pending
   file to be ordinary non-reparse objects at their exact expected paths. After the run, require the
   default runs directory, immediate run child, artifact index, and manifest to be ordinary
   non-reparse objects before any content read. Treat inability to establish attributes as a fixed
   NO-GO; never follow a junction/symlink to satisfy containment.
4. **Make rename failure closed and atomic at the reviewed boundary.** Keep the pre-existing
   destination refusal, invoke the rename with `-ErrorAction Stop`, and after it returns require the
   old pending path absent, the exact destination present/non-reparse, and its in-memory digest
   unchanged. Never delete or replace a colliding destination, and never move the bound debug back
   after any later failure.
5. **Sanitize every JSON boundary.** Wrap each artifact-index and manifest read-plus-parse in its own
   `try/catch` that throws only a fixed code/message and never interpolates `$_`,
   `$_.Exception.Message`, input text, or paths. Require live result, inspection, index, manifest,
   and every index entry to be the expected object/array shape and to contain the required
   properties before property access. Put shape/property validation inside the same sanitized
   boundary.
6. **Normalize indexed paths before trusting them later.** For every entry, require a nonblank
   relative path made only of accepted segments, reject `.` / `..`, drive-relative/colon values,
   invalid/device/trailing-dot segments, normalize it below `$expectedRunPath`, and prove
   containment. Detect normalized duplicates with `StringComparer.OrdinalIgnoreCase`. Before each
   later allowlisted read, repeat the unique-index, contained-path, regular-file/non-reparse, and
   conservative-redaction checks.
7. **Add one outer disclosure boundary.** Enclose the entire wrapper in an outer `try/catch/finally`.
   The catch must ignore the caught object and emit exactly one fixed, predeclared sanitized
   status/code (then exit nonzero); it must never let PowerShell format the original `ErrorRecord`.
   Maintain a closed `$safeFailureCode` set before each risky operation if distinct operator
   reasons are needed. The outer `finally` must clear all raw/parsed objects, hashes, index/manifest
   values, and path values on every stop path. Keep the existing safe success object as the only
   success-stream output.
8. **Re-review the complete corrected block without execution.** Confirm one live invocation, no
   retry, rename-before-inspect, fixed default paths, all local and outer catches, and exactly one
   sanitized terminal object on both success and every modeled failure. Only then can the capture
   procedure become GO; the provider authorization remains a separate later decision.

This was a static read-only audit of t419's findings and the current t422 wrapper. I did not run
PowerShell, a provider, Lab, browser, panel, build, test, or artifact command; did not inspect raw
content or a secret; and did not edit t422. This appended section is the only change.
