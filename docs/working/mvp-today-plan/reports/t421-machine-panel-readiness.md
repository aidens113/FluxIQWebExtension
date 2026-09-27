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
