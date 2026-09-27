# t421 — Machine and panel readiness

Status: **GO for the one-Lab machine predicate; panel not running**

Snapshot window: `2026-09-27T18:34:20.6341032Z` through
`2026-09-27T18:34:29.4780174Z`.

## Decision

- Matching FluxIQ Lab, Scenario Lab, test-runner, Playwright/campaign-browser, or live-run
  processes: **0** in two independent metadata-only snapshots.
- Node-owned listening sockets: **0** in both snapshots.
- Repository build lock `F:\!FluxIQWebExtension\.lab-locks\build.lock`: **absent** in both
  snapshots.
- FluxIQ panel process: **not detected**. No Node listener or common development-panel listener
  was present in the initial listener survey.

The machine satisfies the one-Lab predicate at these timestamps. This is a point-in-time snapshot,
not a reservation or authorization; repeat it immediately before a live invocation.

## Panel action

Panel management is needed if the qualifying live path requires the web panel. The safe start is:

```powershell
Set-Location -LiteralPath 'F:\!FluxIQ'
pnpm dev
```

Core's `dev` script resolves to `pnpm --filter @fluxiq/web dev`. A restart is not currently
applicable because no panel process is running. Starting it remains a supervisor operation that
requires the user's explicit current-session panel-management authorization.

## Method and boundary

The process checks used command metadata internally only to classify candidates and excluded the
checking process and its ancestor chain. Only derived process classifications, listener metadata,
and lock presence were observed; no command line, environment value, credential, browser profile,
raw artifact, or page/provider content was printed or recorded.

I did not start, stop, restart, or signal any process; invoke a browser, provider, Lab, test, build,
or dry-run command; inspect generated output contents; or stage, commit, or push. This report is my
only edit.

## Follow-up — Does the isolated live command need the user's panel?

**No.** The prospective command selects `--target isolated`. `runScenario` maps that target to an
owned isolated topology, and `startTopology` prepares a cached production build of Core's web app,
allocates a fresh loopback web port, starts that build with supervised `next start`, waits for it,
initializes its gateway, and cleans the owned processes up in the run's `finally` path. It does not
connect to or require the user's `pnpm dev` panel on port 3000.

Accordingly, no separate panel start/restart is required and current-session permission to manage
the user's panel is not a prerequisite for this isolated command. Starting `pnpm dev` would add an
unrelated server and should be left out of this run. The live CLI invocation itself is the
authoritative owner/start action for the private panel; this audit does not authorize invoking it.

The private panel URL is allocated at runtime as
`http://127.0.0.1:<allocation.webPort>`; there is intentionally no fixed URL to pre-start or probe.
The runner's non-secret readiness sequence requires an HTTP-success response from that origin,
performs an unauthenticated snapshot request to initialize Core's gateway, and then requires the
allocated gateway TCP port to accept a connection. Scenario Lab separately requires its authenticated
`/__control/health` response; its token must remain internal. These built-in checks are the
authoritative readiness signal, so no manual health command is needed.

The start creates disposable run state below ignored `test-runs/` (including isolated FluxIQ state,
profiles, logs, evidence, and `.work` topology state), may populate Core's ignored
`F:\!FluxIQ\.tmp\core-web-build` production-build cache, and may regenerate ignored downstream
`dist/` host output. The code and ignore rules therefore predict no tracked or status-visible
untracked repository state. This conclusion is read-only: I did not execute the command to test that
prediction.

## Working-document reconciliation

The following present-tense claims are stale in both working documents:

| Location / stale claim | Proposed replacement fact |
| --- | --- |
| MVP pre-packing baseline: the root task-fixture check “remains machine-limited” by the Git spawn failure | Git for Windows was repaired; the completed t170 finish gate recorded task fixtures at 120/120. Retain the earlier failure only as historical evidence, not a current exception. |
| MVP `Next` and language-loop `The next action`: t170 is only merged locally, GitHub authentication is expired, downstream is unpushed, and Core then downstream still need pushing | t170 is delivered. Read-only refs show local `dev` and `origin/dev` aligned in both repositories with zero inbound and zero outbound commits. Core `dev` is clean; downstream is now on the t171 preflight branch with only the expected t420–t422 report files untracked. |
| MVP fix-first evidence: provider-free closure remains subject to the worktree-fixture block and “final candidate review and integration remain” | Provider-free t170 closure, integration, task finish, and remote delivery are complete. The packing correction remains live-unproven; that is now a measurement gap, not an integration or Git-environment gap. |
| Both `Next` sections and both `Blockers`: current-session permission to manage the user's panel precedes the provider call | The isolated lane owns and health-checks a private production panel on a fresh loopback port. The user's `pnpm dev` panel is neither required nor to be started, so panel-management permission is not a blocker for this command. |
| Both `Next` sections: the entire preflight still needs to be frozen from scratch | t420 now supplies the no-hindsight request/oracle/evidence contract, and t421 recorded a point-in-time one-Lab GO. The machine predicate must still be repeated immediately before launch; the accepted provider-free dry run, final unchanged-identity freeze, and exact copied command remain pending. |
| Both `Blockers`: remote delivery waits on GitHub re-authentication | Remove this blocker. Current blockers are live product uncertainty, pending provider-free command evidence, credential readiness not yet proved by the authorized launch process, final pre-launch identity/machine rechecks, and fresh command-specific authorization. T422's credential result is provisional and process-scoped, not proof that the machine has no usable credential source. |

Unchanged facts should remain explicit: run 4 is the latest accepted measurement, the pass streak is
0, Flow creation is still live-unreliable, and no current evidence proves the later runtime,
judgement, repair-persistence, replay, recursive-judgement, or terminal-revocation stages.

## Preflight report privacy review

Status: **GO** for the reviewed report set.

Scope was exactly t420, t421, and t422 plus repository status/diff metadata. A conservative
value-pattern scan found zero private-key blocks, GitHub/provider-token-shaped values, bearer
values, JWTs, credential assignments, 40/64-character hexadecimal digest values, embedded data
URIs, or non-loopback URLs. Manual context review found no raw prompt/response, provider output,
page value, dataset row, selector, browser state, cookie/header, profile content, raw artifact, or
secret value. Credential names, bounded contract numbers, run identifiers, structural paths, and
the placeholder loopback URL are metadata only and are appropriate here.

Repository status contained only the three expected untracked preflight reports. There was no
tracked diff, no unrelated status path, and no whitespace error in the report files. This review is
limited to the current bytes of those three reports; any later edit requires rescanning. I did not
open a run artifact, inspect a secret source, or invoke a Lab, browser, provider, build, or test.

## Supervisor plan-diff review

Status: **NO-GO pending two factual corrections; privacy GO.** The diff contains no secret, raw
artifact, provider/page/browser content, or disallowed identity value, and its pushed/aligned and
isolated-private-panel statements match the read-only findings.

1. Both plans say the repaired Git installation now makes task fixtures pass 120/120 *without* the
   earlier workaround. The recorded 120/120 finish result used the process-local workaround; Git was
   repaired later, but this review has no post-repair fixture rerun. Replace with: “The t170 finish
   gate recorded 120/120 under its process-local workaround; Git for Windows has since been repaired
   and normal repository detection restored.”
2. MVP `Fix-first local evidence` still says the worktree-fixture block applies and final candidate
   review/integration remain; the pre-packing baseline also says that limitation “remains.” Mark
   those as historical or replace them with the completed t170 closure/integration/delivery fact,
   while retaining that provider convergence is not live-proven.

No other correction is required by this review.

### Immediate final review

Status: **GO.** The revised diff now distinguishes the recorded workaround-backed 120/120 result
from the later Git repair and explicitly says no post-repair fixture rerun is recorded. It also
marks the earlier task-fixture limitation and pending t170 review/integration language as historical,
without claiming live convergence. Remote delivery, isolated-panel ownership, remaining preflight
gates, and zero-pass/live-unproven status are stated accurately. No secret, raw artifact,
provider/page/browser content, or disallowed identity value appears in the diff. No further factual
or privacy correction is required.

## Default-envelope audit

Status: **NO-GO for describing 26 calls / USD 2 as a whole-invocation ceiling; otherwise verified.**

- `mvp-hard-scenario` is an opaque profile id, not a named source-code preset. With no limit flags,
  CLI parsing uses the shared defaults: 48,000 input, 8,000 output, 56,000 total tokens per request,
  26 calls, zero provider retries, USD 0.25 per call, and one concurrent run.
- Planning clamps the declared 30,000 ms request timeout to Core's 25,000 ms ceiling. With no
  `--llm-max-run-tokens`, it also supplies 560,000 total tokens per grant (ten full 56,000-token
  requests), a material effective default omitted from the current summary.
- USD 2 is the computed **per-grant** total-cost ceiling
  (`min(2, 0.25 × 26)`), and 26 is the per-grant call ceiling. A successful created-Flow lane can
  authorize a build grant and then a distinct playback/repair grant carrying the same envelope.
  Therefore one CLI invocation is not proven capped at 26 calls or USD 2 in aggregate; its two
  sequential grant phases can each carry those ceilings. The authorization contract should say
  “per grant” or add and verify an invocation-wide aggregate ceiling before calling them totals.
- `--replays 1` is explicit, not a default. The replay is provider-free; it issues no grant.
- There is no CLI retry, concurrency, Lab-instance, or run-root flag in the prospective command.
  Nonzero provider retries are refused, concurrency is fixed at one, and the current process has no
  `FLUXIQ_LAB_INSTANCE` or `FLUXIQ_TEST_RUNS_DIR`. However, the CLI honors either inherited variable;
  `FLUXIQ_TEST_ENV_FILES=none` does not clear process variables. Their absence must be rechecked (or
  explicitly cleared) in the exact launch process to prove the default `test-runs/` root and no Lab
  instance override.

This was a source-only/read-only audit. I did not execute the CLI, Lab, provider, browser, build, or
test and did not inspect credential values or artifacts.

## Stage-1 identity attestation

Status: **GO for no-hindsight source/oracle/evidence identity; no pending Stage-1 file was created.**

### Normalization and source identities

All text sources were decoded as strict UTF-8, CRLF/lone CR normalized to LF, existing terminal
newlines removed, and exactly one terminal LF added before byte count and SHA-256. Every named
source is BOM-free and currently LF-only. The instruction identity is the decoded string literal,
not its TypeScript quoting, normalized with the same single terminal LF.

| Identity | Source and slice | Lines / UTF-8 bytes | SHA-256 |
| --- | --- | ---: | --- |
| Task declaration | `apps/scenario-lab/src/scenarios/everything-store/live-tasks.ts:20-27` | 8 / 649 | `4fa34d5ce9c7bb5f68ebde5e1208422627e0d1c55650452623f6bfd1455d525f` |
| Canonical instruction scalar | `live-tasks.ts:24` decoded value | 415 Unicode scalars / 416 bytes | `46bd24470ade5869622a93cdc549071136bb29b0eaaa877c6940a7d3959351de` |
| Nine-step chain | `docs/working/mvp-today-plan/reports/t331-run4-no-hindsight-stage1-draft.md:49-57` | 9 / 1,424 | `60bd00a3bb29478dab0fbefc1a8d6a1fb46a04c2842876e0566ac668b9c1d319` |
| Oracle definition | `apps/scenario-lab/src/scenarios/everything-store/workflows/plus-under-fifty.ts` | 81 / 4,814 | `17d62daffd0ff2a99a17b06e6b6597ab12b1cb74ad39362d07f524b08709febd` |
| Oracle record mapper | `apps/scenario-lab/src/scenarios/everything-store/workflows/earbud-records.ts` | 15 / 569 | `fdebf3d9f715d059f3b39e9bfb5904d59cfe9d68976fe3861bc10b9bb7e27777` |
| Search ordering | `apps/scenario-lab/src/scenarios/everything-store/catalog/search.ts` | 101 / 4,850 | `e09e8df552f0bd050966547856b725f0dcc0ddadf3c7a4f295469ffc0de5e88c` |
| Page-boundary model | `apps/scenario-lab/src/scenarios/everything-store/catalog/results-page.ts` | 61 / 2,176 | `5a92ce9272d6c9d129b955619138da067b047e3e23a4baf2004bf91250c3fb16` |

The chain slice contains consecutive ordinals 1 through 9 exactly once and in order: **9/9**. Its
identity is the accepted t331 source attested by t340, not a reconstruction from a live result.

### Oracle identity

The authored workflow's `extract-plus-under-fifty` entry declares 13 records and contains 13:
**13/13**. Canonicalization is `JSON.stringify(records)` followed by one LF, preserving
array and field order; it is 3,457 UTF-8 bytes with SHA-256
`c8b7f87109cf593d6601863f19a488b4c2fa915bec65707813a19bab09e8c866`.
No record value was printed or copied.

Every record has exactly four string fields in the frozen order `name`, `price`, `rating`, `url`.
Re-deriving the answer through the source search and mapper is ordinal-exact with the stored oracle.
All 13/13 source products satisfy kind `earbuds`, Plus eligibility, rating at least 4, and price
strictly below 5,000 cents; all 13/13 identities are unique. The definition filters the complete
organic relevance-ordered search outcome before page slicing, so adverts are excluded, later-page
members remain represented, authored order is stable, and repeated display-page boundaries do not
duplicate the oracle. Count alone remains insufficient.

### Evidence schema and disclosure contract

The evidence identity set is:

| Source | Lines / bytes | SHA-256 |
| --- | ---: | --- |
| `packages/test-evidence/src/types.ts` | 104 / 2,956 | `81c0949bc935b77b71d859305a148a3bd7eb226db5cf68975f73c3463bdb3ad3` |
| `packages/test-evidence/src/bundle.ts` | 354 / 16,803 | `ddc884838ad5653ac2b34d731c4eaf5bfce0d44555a30c39136a49c14e1703e3` |
| `packages/test-runner/src/inspect.ts` | 28 / 1,898 | `1bd1a76d047ca28a282089281908fde53bde9a0d0101e6591ac0a119c283522d` |
| `packages/test-contracts/src/run-validation.ts` | 197 / 16,658 | `e5ddcaf963afb37e06c26b7c9d0abc905323aa331cea48e44cc8cfc567913739` |

The composite is each normalized `path`, NUL, source digest, LF in the table's order: 415 bytes,
SHA-256 `be0a71851a5ec7ec8eede281dcc7996b75e0166aa61e6c41a3fcb5a4698552db`.
It freezes schema `0.1`; a finalized `artifact-index.json`; a `bundle.complete.json` marker binding
the index digest; per-entry safe relative path, byte count and digest; and `inspect` verification of
the marker, every indexed artifact, and parsed `run.json`.

The stricter launch gate permits only indexed redaction `applied` or `verified`, then requires
manifest redaction `verified` or `not_applicable` and matching run identity/closed verdict. The
bounded semantic allowlist is `run.json`, `summary.json`, `evaluation.json`,
`snapshots/live-llm.json`, and only when present and necessary,
`snapshots/flow-lane.json`, `snapshots/extraction-mismatches.json`,
`snapshots/repair-lane.json`, and `snapshots/redaction-attestation.json`. The index and complete
marker are integrity metadata, not semantic evidence. Every requested path must have exactly one
safe index entry; missing evidence becomes `NO EVIDENCE`.

Explicit limits remain: do not print/open raw stdout or inspection objects, provider prompts or
responses, page values or raw datasets, logs/events, HTML/screenshots, selectors, headers/cookies,
credentials, authorization material, browser profiles/state, unindexed files, or run-artifact
digests. The digests above identify pre-run authored sources and the value-redacted oracle only.
This attestation ran no Lab, provider, browser, build, or test and changed no pending debug or shared
working document.

## Final PowerShell disclosure/path review

Status: **GO on the final static wrapper; execution and provider authorization remain separate.**

The authoritative facility contract is narrower than its public validators. A normal `run` has no
run-id option: `packages/test-runner/src/run-scenario.ts` generates
`run-<base36 time>-<8 lower-case hex>` and passes it through
`assertSafeScenarioRunId` before bundle construction. With both location variables absent,
`resolveLabPaths` fixes the root at repository `test-runs`. `EvidenceBundle` converts authored
artifact paths to forward-slash relative form, indexes only files found below its staging tree,
writes schema-`0.1` index and digest marker, and publishes by staging-directory rename. `inspect`
uses the broader `^[A-Za-z0-9._-]{1,128}$` input gate, then verifies marker-to-index digest and every
indexed byte count/digest and parses `run.json`; its broad gate and unnormalized indexed-path joins
are not sufficient authorities for the stricter disclosure procedure by themselves.

Protections necessary at this boundary are present in t422's final block: clearing the two inherited
location overrides before the child; exact generated-id-shape validation; canonical default-root,
reported-path, and inspected-path equality; collision-free rename-before-inspection with identity
recheck; an outer catch that ignores the `ErrorRecord` and emits only one fixed sanitized terminal
object; strict object/required-property checks before access; ordinary/non-reparse fixed metadata
paths; silent `inspect`; exact case-sensitive completion-marker shape/schema/digest syntax; SHA-256
binding of the current exact index bytes; strict UTF-8 parse of those same bytes; ordinal-ignore-case
normalized index uniqueness/containment; conservative per-entry redaction; and unique indexed
manifest identity/verdict/redaction attestation. The compatible in-memory digest path uses
`SHA256.Create().ComputeHash(...)` and `BitConverter`, so it works in the actual Windows PowerShell
5.1 / .NET Framework shell; the earlier `.NET 5+` `HashData` / `ToHexString` blocker is gone.

Some checks are deliberate defense in depth rather than independent necessities. Once the exact
generated-id regex passes, separate `.` / `..`, trailing-dot, and Windows-device-name rejection
cannot fire, and the immediate-child proof is mathematically implied; retaining them makes the path
invariant explicit. A facility-authored index cannot normally contain duplicates or unsafe paths
because it is built by walking bundle-owned files, but normalization, containment, and duplicate
checks are still necessary before the wrapper treats post-run index content as authority for later
semantic reads. Rechecking the index digest after `inspect` duplicates its earlier integrity work
but closes the later read boundary and adds the marker schema contract that `inspect` omits. Nulling
variables in a fresh process is hygiene against accidental reuse/output, not secure memory erasure.

Final re-read found exactly one live `run`, one provider-free `inspect`, no retry/rerun branch, and
no `--dry-run`. Raw child output remains captured, stderr discarded, Stage 1 is renamed before any
run-path/verdict/bundle inspection, all modeled failures converge on the fixed no-go object, and
success exposes only syntax-bounded identity/verdict/gate facts. Later semantic review must still
repeat unique safe-index, containment, ordinary-file, and redaction checks for each allowlisted
artifact before opening it. I did not execute the wrapper, Lab, provider, browser, panel, build, or
test and did not edit t422 or any shared document.

## Pending Stage-1 identity review

Status: **NO-GO pending one wording correction; all byte identities, structural assertions,
privacy, and formatting otherwise pass.**

I recomputed the pending file's identities from the current authored sources under its stated
strict-UTF-8, newline-normalization, and single-terminal-LF rules. The task declaration is 8 lines /
649 bytes with the listed digest; the decoded instruction is 415 scalars / 416 normalized bytes
with the listed digest; its runner-convention no-terminal-LF form is 415 characters / 415 bytes with
the separately listed digest; and the accepted chain is 9 lines / 1,424 bytes with the listed
digest. Chain ordinals are consecutive 1 through 9 exactly once and in order: **9/9**.

The oracle definition, mapper, search-order, and page-model digests all match the pending table and
the fuller t421 attestation (respectively 81 / 4,814, 15 / 569, 101 / 4,850, and 61 / 2,176 normalized
lines/bytes). The authored expected entry declares 13 records and contains 13; its canonical JSON
plus LF is 3,457 bytes with the listed digest. All 13 have exactly the ordered string fields
`name`, `price`, `rating`, `url`; the source-rederived mapper output is ordinal-exact; all predicates
hold; and all source identities are unique. No value was printed or copied during this check.

The four evidence-source identities independently reproduce the frozen 415-byte composite and its
listed digest. Schema `0.1`, completion-marker/index binding, conservative redaction, and the exact
eight-path semantic allowlist are present in the required order, each path exactly once. The file
contains no secret/token-shaped value, raw instruction, record row, page/provider output, prompt or
response, selector, cookie/header, credential, browser state, or run-artifact digest. Its Markdown
has balanced fences, 12 level-two stages/sections, one terminal newline, and no trailing whitespace.

One sentence overstates the page assertion: “all pages are represented.” The frozen t421 assertion
is that the complete organic relevance-ordered outcome is filtered before page slicing, so
qualifying **later-page members** remain represented and repeated boundaries do not duplicate the
oracle. It does not assert that every rendered page contains a qualifying record. Source replay of
the full five-page unfiltered outcome has qualifying counts 3, 5, 5, 2, and 0 by displayed page, so
the current literal claim is false. Replace “all pages are represented” with “qualifying later-page
members remain represented” (or the equivalent pre-slicing assertion) before freezing Stage 1.

This was a read-only source/structure check. I did not edit the pending file, inspect any run
artifact or secret, or invoke a Lab, provider, browser, panel, build, or test.

### Immediate corrected-payload re-review

Status: **GO.** The false every-page wording is replaced by the attested statement that qualifying
later-page members remain represented. Recalculation against the current bytes again passes the
task slice, normalized and runner-convention instruction identities, 9/9 chain, all four oracle
source identities, 13/13 canonical oracle with exact field order, and the 415-byte evidence
composite. The exact eight allowlisted paths each occur once in order. The added grant-accounting,
prelaunch-attestation, evidence-only stage-slot, and no-retry language does not alter or overclaim
the frozen identities. A fresh privacy/format scan reports zero secret patterns, two balanced code
fences, zero trailing-whitespace lines, and one terminal newline. No further identity, privacy, or
format correction is required.
