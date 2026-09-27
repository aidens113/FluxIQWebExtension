# t419 — integrated candidate provider-free freeze

## Disposition

**GO for the supervisor to commit this report and perform the final clean-HEAD recapture; NO-GO for
a live/provider launch from this report alone.** At `2026-09-27T18:42:58.0489471Z`, before this
report existed, Core and downstream were clean, had no diff-check errors, and were bound to the
identities below. Corrected-order downstream outputs were fresh 6/6, all 12 markers existed, the E2E
manifest was byte-identical, the three downstream runtime resolutions matched Core byte-for-byte,
and the post-build dry-run returned `ready` with zero provider calls.

This report is now the sole expected untracked path. Its creation intentionally ends the clean-tree
snapshot. The supervisor must commit it and recapture the final downstream HEAD/status before a
candidate can satisfy t407's settled-tree authorization precondition. This report does not authorize
a provider, Lab, browser, panel operation, or live command.

## Clean pre-report repository identity

| Repository | Branch | HEAD | Status | `git diff --check` | Divergence |
| --- | --- | --- | --- | --- | --- |
| Core `F:\!FluxIQ` | `dev` | `f44930aba0640f850f2e09f06ea03c0343d69361` | clean, 0 paths | exit 0 | local `dev` and cached `origin/dev`: `0/0` |
| downstream `F:\!FluxIQWebExtension` | `task/t171-run5-live-validation` | `8ca0c1f9d95942e52c1d0ae33852c2a363537681` | clean, 0 paths | exit 0 | one commit ahead of local `dev` and cached `origin/dev`: `0/1` |

No fetch was performed in this task, so `origin/dev` means the existing local remote-tracking ref.
Core's local and cached remote-tracking refs both resolved to the recorded Core HEAD; downstream's
local and cached remote-tracking refs both resolved to
`b4fd477df01aac94c8b9a3db6f1884e89c5a0bcd`.

## Corrected-order output closure

The t409 build order was applied provider-free: domain, web-panel host, test-contracts, Scenario Lab
(including its owning test-contracts build), test-evidence, extension, then test-runner. The final
successful output writes are in that dependency order. Strict freshness (`output UTC > newest
tracked owner input or named built dependency UTC`) passed 6/6:

| Owner | Output UTC | Newest input/dependency UTC | Result |
| --- | --- | --- | --- |
| domain | `2026-09-27T18:35:46.4460639Z` | `2026-09-27T07:19:57.6615642Z` | PASS |
| test-contracts | `2026-09-27T18:36:06.6515736Z` | `2026-09-27T07:19:57.6615642Z` | PASS |
| Scenario Lab | `2026-09-27T18:36:11.6759415Z` | `2026-09-27T18:36:06.6515736Z` | PASS |
| test-evidence | `2026-09-27T18:36:22.9658986Z` | `2026-09-27T18:36:06.6515736Z` | PASS |
| extension E2E content | `2026-09-27T18:36:37.6214696Z` | `2026-09-27T18:35:46.4460639Z` | PASS |
| test-runner | `2026-09-27T18:36:54.0006666Z` | `2026-09-27T18:36:22.9658986Z` | PASS |

Marker/identity results: 12/12 required leaves present; authored/output E2E manifests byte-identical;
Core-through-junction hashes 3/3 identical. The three direct Core runtime SHA-256 values remain the
exact t409 identities: `9AF59262…F75AF`, `414B586C…B4BE0F6`, and `4C0295D4…EFF1D`.
Runtime resolution remained `fluxiq/dist/index.js`, `fluxiq/dist/core/index.js`, and
`client-gateway-websocket/dist/index.js` from the intended `F:/!FluxIQ` packages.

Two machine-level transients were observed and not concealed: one pnpm launcher load failed before
the host command, one nested `tsc` exited `0xC0000005` before Scenario Lab emitted output, and one
later pnpm launcher parse failed before extension output. `node --check` and `pnpm --version` then
passed; each affected command passed on one bounded retry. No failed attempt wrote the final owner
output, and the final successful write chronology above preserves the required dependency order.

## Post-build provider-free dry-run

Working directory: `F:\!FluxIQWebExtension`. The child process isolated test configuration without
editing `.env.local`:

```powershell
$env:FLUXIQ_TEST_ENV_FILES='none'
$env:FLUXIQ_TEST_TARGET='isolated'
node packages/test-runner/dist/cli.js run everything-store --target isolated --live-llm --llm-profile mvp-hard-scenario --llm-provider deepseek --llm-task create-flow --instruction-task everything-store-plus-earbuds-under-50 --replays 1 --dry-run
```

Exit was 0 with one structured result: status `ready`, provider-call count 0, lane `created-flow`,
target `isolated`, scenario/workflow/task `everything-store` / `plus-under-fifty` /
`everything-store-plus-earbuds-under-50`, expected-dataset judge step
`extract-plus-under-fifty`, and one replay. The instruction was 415 characters with SHA-256
`d4f7835b8fc63ee857b5c15bd6a01f1f08fe3df19446153ad0f443045fd087ef`.

The request retained DeepSeek `mvp-hard-scenario` / `deepseek-flash` and `create-flow`. Its raw
authorization metadata reports 26 calls, 48,000 input, 8,000 output, and 56,000 total tokens per
call, plus 560,000 total tokens and USD 2 under fields labelled `per run`, with USD 0.25 per call.
The independent t420/t421/t422 review confirmed that these `per run` labels apply to **each provider
grant**, not to the complete CLI invocation. This lane may issue two sequential provider grants, so
its derived invocation maxima are 52 provider calls, 1,120,000 tokens, and USD 4; the requested
replay is provider-free. This clarification preserves the captured dry-run metadata and does not
raise or override any grant ceiling. Credential source metadata named the expected variable and
`.env.local`; no value was read into this report. Dry-run metadata does **not** prove credential
validity, and the test-environment isolation flags do not establish a one-variable credential import
contract.

## Scope

No provider was called. I did not start, stop, inspect, or manage Lab, browser, or panel state; open
raw artifacts; stage; commit; push; or edit source/shared plans. Generated outputs were changed only
through their owning build commands. This report is my only authored repository path.

## Wrapper independent review

**NO-GO as written. Do not execute the t422 one-shot wrapper.** Static comparison confirms that its
live CLI tokens are ordinally identical to t419's accepted dry-run command with only terminal
`--dry-run` removed. It contains exactly one live `run` invocation and one provider-free `inspect`
invocation, no loop/retry branch, memory-held stdout, null stderr, final-nonblank-line parsing,
rename-before-path/verdict/inspect ordering, a pre-rename destination collision check, post-rename
pending-file identity check, default run-path/verdict checks, silent integrity inspection, and
`finally` cleanup of the live and inspection raw lines/objects. On the success path, only the safe
summary object can reach the pipeline.

Two static stop-path defects prevent the stronger claims that the run id is path-safe and that raw
content can never print:

1. The accepted character regex also accepts the complete ids `.` and `..`. When interpolated into
   `test-runs/$runId` and normalized with `GetFullPath`, those values resolve to `test-runs` itself
   or its parent, outside the required `test-runs/<run-id>` child. Reject `.` and `..` explicitly
   before constructing either destination, then require the normalized expected path's parent to be
   exactly the normalized default `test-runs` directory.
2. Live and inspect JSON parse failures are caught and replaced with bounded messages, but
   `artifact-index.json` and `run.json` are piped to `ConvertFrom-Json -ErrorAction Stop` without a
   sanitizing catch. PowerShell JSON parse errors may include input context. An invalid indexed file
   can therefore reach the operator as exception text before `finally` clears the variables. Wrap
   each file read/parse in a local `try/catch` that throws only a fixed sanitized message; do not
   attach the caught exception or its message.

The index/manifest variables are otherwise nulled in `finally`, and the renamed no-hindsight debug
correctly remains bound on every later stop. After the two corrections, re-run this static review;
no provider, wrapper, Lab, browser, or panel execution is needed for that review.

### Corrected-wrapper disposition

**GO on static wrapper review; execution remains separately unauthorized.** T422 now rejects the
complete ids `.` and `..`, canonicalizes the expected run directory, and proves it is an immediate
child of the normalized default `test-runs` root. It also replaces both artifact-index and manifest
read/JSON failures with fixed messages that do not include the caught exception. The two prior
blockers are closed.

The corrected block retains exact CLI argument equivalence with only `--dry-run` removed, one live
invocation and no retry, memory-only stdout/null stderr, safe-id and destination-collision gates,
rename-before-path/verdict/inspect ordering, default-path and closed-verdict checks, silent inspect,
conservative index/redaction/manifest gates, and `finally` cleanup of every raw line/object. Static
rescan found no new blocker and no success or stop path that intentionally prints raw content. I did
not execute the wrapper or inspect any live/run artifact.

## Stage-1 evidence-contract attestation

**NO-GO for final evidence-contract closure pending one marker-schema gate and one allowlist wording
reconciliation.** Static source confirms that evidence finalization writes schema `0.1`, then an
`artifact-index.json` containing safe relative path, byte count, SHA-256, and redaction state for
every payload, then `bundle.complete.json` containing schema `0.1` and the index digest before the
staging directory is renamed final. `inspect` parses the marker and index, compares the marker's
index digest, verifies every indexed artifact's bytes and digest, and parses `run.json`. T422 then
adds index schema `0.1`, unique/safe path, exact run identity/path/verdict, and redaction gates.

The conservative disclosure values are exact: every indexed artifact must be `applied` or
`verified`; the manifest must be `verified` or `not_applicable`. Source types also admit indexed
`not-required` and manifest `pending`/`failed`, but the launch contract intentionally rejects those
weaker states.

After integrity succeeds, the exact bounded semantic read order is:

1. `run.json`
2. `summary.json`
3. `evaluation.json`
4. `snapshots/live-llm.json`
5. `snapshots/flow-lane.json` when present and necessary
6. `snapshots/extraction-mismatches.json` when present and necessary
7. `snapshots/repair-lane.json` when present and necessary
8. `snapshots/redaction-attestation.json` when present and necessary

Before opening any item, require exactly one safe indexed entry; an absent optional/conditional fact
is `NO EVIDENCE`. `artifact-index.json` and `bundle.complete.json` are integrity metadata, not
semantic evidence. No other structured file, raw provider/page material, event/log, HTML, image,
selector, credential, authorization value, browser state, raw dataset, or unindexed artifact is in
the allowlist.

Two documentation/gate mismatches remain. First, current `inspect` and the corrected t422 wrapper
validate the marker's index digest but never assert `bundle.complete.json.schemaVersion === '0.1'`;
t422 asserts only the index schema. Add a sanitized marker-schema check before semantic reads.
Second, t421's frozen allowlist correctly includes `snapshots/redaction-attestation.json`, while
t422's earlier “Required capture order” list stops at `snapshots/repair-lane.json`. Reconcile t422
and the pending Stage-1 payload to the eight-path order above. I performed no wrapper/provider/Lab/
browser/panel execution and opened no run artifact.

### Minimal safe completion-marker contract

Apply this metadata-only gate after successful silent `inspect` and before any semantic artifact
read. Derive both paths from the already normalized `$expectedRunPath`; they must be the exact leaf
siblings `$expectedRunPath\bundle.complete.json` and `$expectedRunPath\artifact-index.json`. Require
the normalized parent of each to equal `$expectedRunPath`, require both to be regular leaves, and
reject `ReparsePoint` on the normalized default `test-runs` root, the run directory, and both leaves.
Do not accept a caller-supplied path or a path taken from marker/index content.

Read and parse the marker inside a sanitizing `try/catch`. Its closed shape is exactly two
case-sensitive fields: `schemaVersion` and `artifactIndexSha256`. Require schema string `0.1` and a
lower-case 64-hex digest. Hash the exact current bytes of the exact sibling index file with SHA-256
and compare ordinally to `artifactIndexSha256`; do not hash decoded/re-serialized JSON and do not
print either digest. Perform the index read/schema/safe-path/redaction checks against that same
already-identified index path. Any filesystem, parse, shape, reparse, containment, or digest failure
must become one fixed message without the caught exception, path detail, JSON context, or hash.

Current `inspect` already parses the exact sibling marker and index, compares the marker digest to
the exact index bytes, verifies every indexed artifact's byte count and SHA-256, and parses
`run.json`. It does **not** assert marker schema/closed shape/digest syntax, reject reparse points,
prove canonical containment, or protect the post-`inspect` index from replacement. Therefore the
wrapper should still perform the compact gate above rather than treating `inspect.valid` alone as
the completion-marker schema attestation. This is a static contract only; no artifact was opened.

### Final stable-wrapper review

**NO-GO as written: one execution-compatibility blocker remains.** The stable t422 wrapper closes
all earlier identity, traversal, reparse, marker-schema, exact-byte digest, normalized-index,
redaction, raw-output, cleanup, and eight-path allowlist defects. Its live arguments still differ
from the accepted dry run only by removal of `--dry-run`; it retains one invocation and no retry.

The index hash uses `[Convert]::ToHexString(...)` and
`[Security.Cryptography.SHA256]::HashData(...)`. Those APIs require modern .NET and are not
available to the repository's Windows PowerShell/.NET Framework host; the wrapper says only “fresh
PowerShell process” and has no `pwsh`/runtime version gate. It would consume no provider call before
this late hash site, but it would deterministically end `capture_gate.no_go` after the authorized
live invocation and inspection, making an otherwise valid measurement unreadable.

Preserve the exact-byte property with a host-compatible in-memory hash:
`[Security.Cryptography.SHA256]::Create().ComputeHash($indexBytes)`, convert with
`[BitConverter]::ToString(...).Replace('-', '').ToLowerInvariant()`, dispose the hash object in a
`finally`, and clear that object with the other marker variables. Alternatively, require and verify
a specific `pwsh`/.NET runtime before any provider call. Re-run static review after that single
correction. I did not execute the wrapper or read any artifact.

#### Compatibility correction disposition

**GO on final static wrapper review; live execution remains separately authorization-gated.** The
stable t422 wrapper now hashes the already-read index bytes through the Windows PowerShell
5.1-compatible `SHA256.Create().ComputeHash(...)` and `BitConverter` path, disposes the algorithm in
the inner `finally`, and repeats disposal defensively plus clears both algorithm and hash bytes in
the outer cleanup. The correction preserves exact-byte hashing, lower-case ordinal comparison,
fixed sanitized terminal output, and all previously accepted command, single-invocation, no-retry,
capture, path, reparse, marker/index, redaction, allowlist, and cleanup gates. Final re-read found no
remaining static blocker. I did not execute the wrapper or read any artifact.

## Pending Stage-1 independent review

**NO-GO for committing the pending record until two identity wordings are corrected; substantive
no-hindsight content is otherwise GO.** I computed the pending file's SHA-256 internally and did not
display it. The current checkout confirms downstream
`98ceadad1f7f3a7329eceadc872a0f46033b80a8` with only the pending file untracked, and clean Core
`f44930aba0640f850f2e09f06ea03c0343d69361`.

Exact corrections required in the pending file:

1. Its corrected-order build sentence says “Core web host.” T419's accepted command and owner are
   the downstream domain **web-panel host** (`pnpm fluxiq:host:build`); replace that phrase so it
   cannot be read as a Core web-app build.
2. Its downstream identity is the correct current pre-Stage-1 parent, but t419's clean pre-report
   snapshot was `8ca0c1f9d95942e52c1d0ae33852c2a363537681`. State that `98ce…` is the later containing parent.
   The exact `8ca…98ce` diff contains only t419/t420/t421/t422 reports—no source, config, or generated
   output—so t419's 6/6 freshness, 12/12 markers, manifest identity, and 3/3 Core runtime identity
   remain correctly inherited.

The prospective command is ordinally equivalent to t419's accepted dry run with only terminal
`--dry-run` removed; its environment and working directory agree. Provider-call, token, timeout,
cost, two-sequential-grant, continuation, zero-provider replay, and no-retry semantics agree with
the corrected t419/t422 accounting. All observation-bearing header fields remain literally
`pending`; Stages 2–6 and final classification now contain fill-from-evidence/`NO EVIDENCE`
instructions but no observed claim. Hypotheses and pass/stop criteria are explicitly pre-run
contracts, not predicted observations. No run output or artifact was inspected.

### Corrected pending-payload disposition

**GO for the supervisor's dedicated Stage-1 commit and final clean prelaunch attestation.** The two
identity wordings are corrected: the build owner is the downstream domain web-panel host, and the
current `98ceadad…` parent is explicitly related to t419's `8ca0c1f…` clean snapshot through the
four report-only changes. T420/t421 corrections also separate build/playback grant accounting,
qualify issuance of the second grant, strengthen the no-retry rule, and keep point-in-time launch
facts outside the frozen Stage-1 claims.

The reviewed pending payload is strict UTF-8 without BOM, contains 235 LF-terminated logical lines
and 14,287 bytes, has no CRLF or lone CR, ends in exactly one LF, and has SHA-256
`2b4d33b85236d4347eda01b0dd6c6964e80fe4f92c021140e42641cb0968a6f0`. Its command remains exact,
budget/grant semantics remain correct, and no run-derived outcome is asserted: the header retains
only allowed `pending` observations, while Stages 2–6 and final classification contain instructions
to fill from gated evidence or `NO EVIDENCE`. No run output or artifact was inspected.
