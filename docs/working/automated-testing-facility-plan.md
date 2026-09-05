# Automated FluxIQ Web Testing Facility Plan

## Status

The first facility implementation completed on 2026-09-04 under the `Execute
Plan With Subagents` workflow. Core promotion and real-site execution remain
deliberately deferred by their safety gates, and synthesized Flow execution is
recorded as follow-up scope. A new Phase 9 now covers attaching to an existing
FluxIQ installation, executing an existing persisted Flow, and reusing a
validated web-panel login session from an ignored local cookie store. The
implementation is complete in this repository. The primary agent's integration
results are below; live certification of the `existing` lane remains pending
only because no external installation credentials, project, or persisted Flow
were supplied to this run.

## Execution Log

| Phase | Status | Owner | Notes |
| --- | --- | --- | --- |
| 0. Contracts and boundary lock | validated | `phase0_contracts` | Workspace wiring and lockfile are integrated; fail-fast scenario/run/evidence/evaluation/comparison validation and all 14 contract tests pass, including sanitized existing-FluxIQ execution provenance. |
| 1. Deterministic scenario lab | validated | `phase1_scenarios`, `phase0_contracts`, then `phase4_evidence` | All ten deterministic loopback fixtures expose validated WebScenario manifests; cross-origin iframe and synthetic secret non-retention behavior is covered; all 16 direct tests pass. |
| 2. Real extension fixture | validated | `phase2_extension_fixture`, integrated/hardened by primary and `phase0_contracts` | Pinned Chromium 134 / Playwright 1.51.1 loaded the freshly built E2E artifact; install/UI, content injection, production action dispatch, MV3 restart, isolation, and enforced loopback-only networking pass 8/8 on Windows. |
| 3. Isolated FluxIQ topology | validated | `phase3_topology` (rotation 2) | Live run `run-mtnla9cz-a4da1119` paired the production extension, persisted a Core recording, and proved Core-issued `web.browser.navigate` plus `web.dom.type` reached/asserted the automation page. Chrome 134 was recorded, bundle inspection passed, all ports closed, and runner tests pass 13/13. |
| 4. Evidence bundle and review | validated | `phase4_evidence` (rotations 1 and 5) | Canonical validated evidence events/policy, pre-write redaction, integrity, deduplication, correlation, and HTML review output pass 8/8 tests. The live runner published and revalidated 15 indexed artifacts. |
| 5. Matrix and CI | implemented and locally validated | `phase0_contracts` (rotations 2 and 6), `phase3_topology` | Ten-scenario corpus (16/16 unit, 10/10 site-only Chromium), selector (5/5), finite run/matrix/inspect/compare CLI, Windows headed lane, and Linux Xvfb/dependency configuration are complete. Linux execution and the scheduled three-repeat baseline await CI. |
| 6. Bounded improvement agents | validated primitives; dispatch remains human-triggered | `phase4_evidence` (rotations 2 and 4) | Task/result/review/audit/worktree-plan CLI, six role policies, trusted-diff reconciliation, path/budget/invariant gates, human-review-only verdicts, hash-chain checks, and explicit reparse/symlink attestations pass 16/16 tests. The package intentionally generates and validates plans; it does not invoke agents or mutate worktrees. |
| 7. Core extraction | validated defer | `phase0_contracts` (rotation 3) | Automated audit finds one domain consumer, zero Core consumers, and four browser/extension-specific fields; 6/6 tests pass and no Core files were changed. |
| 8. Real-site probes | safeguards validated; execution deferred | `phase0_contracts` (rotation 4) | Fail-closed authorization, exact HTTPS allowlists, read-only actions, rate limits, external secret references, private pre-write-redacted retention, expiry, and review gates pass 7/7 tests. No target or secret is configured and no real site was contacted. |
| 9. Existing FluxIQ and persisted Flow execution | implemented and locally validated; live external certification pending | primary, `phase0_contracts`, `phase3_topology`, `phase4_evidence` | Existing-install attachment, reusable API authentication, strict persisted-Flow execution, extension pairing, scenario assertions, run/action/event snapshots, panel verification, containment, bounded cancellation, and evidence provenance are integrated. Unit/integration gates and an isolated full-topology regression pass; a real existing-install run awaits configured credentials/project/Flow. |
| 10. Clone an existing Flow into an isolated installation | implemented and locally validated; live external certification pending | primary, `clone_contracts`, `clone_source`, `clone_destination`, `post_crash_hardening` | Strict clone contracts and cache, read-only source export, isolated destination import/remapping, orchestration, evidence, failure-safe cleanup, and pre-mutation destination-registry compatibility checks are complete. Full workspace gates, the synthetic clone pipeline, and a fresh live isolated regression pass; live clone certification awaits a configured external source. No Core files were changed. |

Phase 10 Steps 1 and 4 (`clone_contracts`, 2026-09-04): completed the
versioned private clone-package contract, sanitized Flow-document boundary,
explicit dependency policy, deterministic project/Flow/node/edge ID mapping,
destination remapping, and read-back equivalence attestation primitives. The
contract rejects unknown package and Flow-root fields, credentials, cookies,
authorization material, identity/gateway state, schedules, runtime history,
recordings, published state, and recognizable opaque secrets before
persistence. Every node definition must be explicitly registered as domain or
native, or explicitly classified as an external side effect with a named test
double; unknown and undoubled definitions produce a bounded incompatible
verdict. Clone execution provenance is strict and sanitized. Contract tests
pass 19/19 and the integrated test-runner suite passes 89/89 after the parallel
source-export and destination-import slices were integrated.

Phase 10 Step 5 and destination failure cases from Step 7
(`clone_destination`, 2026-09-04): a read-only Core audit confirmed that the
existing public `create-project`, `create-flow`, `save-flow`, and `get-flow`
HTTP endpoints are the complete destination persistence seam; project/Flow
mutations enforce the configured authorization PIN and no Core change is
needed. The runner now creates a uniquely named run-owned destination project,
imports only a contract-validated compatible clone package, requires explicit
source-to-destination project and Flow mappings, deterministically remaps graph
node/edge identities through the shared clone policy, and reads the saved Flow
back before returning. Both the direct saved/read-back comparison and the
source-normalized equivalence attestation fail closed on scope escape,
undeclared changes, incompatible dependencies, import/save errors, or hash
drift. A bounded Flow ID is derived deterministically from the complete run
and source identity. The destination control interface exposes only public project/Flow
methods and never receives the source client or a filesystem path. Focused
type-checking passes; the six destination importer tests and the public-route
transport test pass. Whole-workspace validation passed after orchestration
integration.

Phase 10 synthetic pipeline validation (`clone_destination`, 2026-09-04): an
independent mocked source and destination integration test now exercises the
complete export, dependency-classification, package, deterministic-remapping,
public destination import, read-back, and equivalence sequence. It proves the
source receives only login/session and Flow/project/dependency/definition read
operations, the destination receives exactly create-project, create-flow,
save-flow, and get-flow, all destination project/Flow/node/edge identities are
distinct and consistently remapped, and both the source canonical hash and
serialized bytes remain unchanged. The focused pipeline test and runner
type-check pass; live configured-source certification remains separate.

Phase 10 isolated-startup ownership hardening (`clone_destination`,
2026-09-04): isolated topology setup is now enclosed by the same failure-safe
ownership boundary as existing-target setup. Any failure after allocation
first stops supervised processes and then removes only the exact allocated
`runRoot`; the removal helper re-derives and verifies the run-ID path before a
recursive deletion and is shared by explicit run cleanup. A focused failure
test forces startup to fail before process launch and proves that the failed
run root is removed while both a sibling run sentinel and an external/source
sentinel remain byte-identical. The runner type-check and all three focused
topology ownership tests pass.
The complete test-runner regression also passes 89/89 after integration with
the finalized clone dependency metadata.

Phase 10 final integration and local validation (primary and
`post_crash_hardening`, 2026-09-04): the strict clone contract, facility-wide
cache, read-only source exporter, isolated destination importer/remapper,
end-to-end orchestration, sanitized evidence provenance, and failure-safe
cleanup are complete. The source lane remains read-only on every path,
including post-run hash verification, and the isolated destination registry is
reclassified against the cached Flow immediately before import; an
incompatibility therefore fails before any destination project or Flow
mutation. Contract tests pass 19/19 and test-runner tests pass 89/89. The
`pnpm check` gate passes, `pnpm test` passes across all 10 executable workspace
packages, and `pnpm build` passes. The synthetic source-to-destination clone pipeline
passes. A fresh live isolated regression, `run-mtnrj7ws-717a780f`, passed and
`lab inspect` validated all 10 indexed artifacts. Live clone certification
against an external existing FluxIQ installation remains pending because no
source base URL, credentials, project, or Flow were supplied. No FluxIQ Core
files were changed.

Phase 9 Steps 2–3 execution note (2026-09-04): `phase3_topology` added the
typed, mutually exclusive target configuration and `--target`/`--flow` CLI
plumbing. Isolated mode remains the default; existing mode requires validated
base URL, project, Flow, test identity, password, and authorization PIN, with
an optional gateway URL and TOTP. `.env` then `.env.local` are loaded without
overriding process environment values, local environment files are ignored,
and the tracked example contains placeholders only. Existing Flow execution
remains fail-closed until the later control-adapter and Flow steps are
integrated. The combined test-runner check and all 24 tests pass.

Phase 9 existing-topology ownership (`phase3_topology`): existing mode now
creates only the disposable run workspace, browser profile, logs, and Scenario
Lab process. It read-only health-checks and retains the configured external
Core origin/gateway reference, but never builds, bootstraps, starts, stops,
resets, or removes the external FluxIQ installation. Until the Flow adapter is
wired, the finite runner stops explicitly after safe topology attachment
rather than reporting a site-only pass. Ownership and failure-path cleanup
tests prove that only the supervised Scenario Lab and run-scoped directory are
removed; the external server and sentinel state remain live. The combined
runner check and all 26 tests pass.

Phase 9 Step 4 (`phase4_evidence`): implemented an origin-and-username-scoped
web-panel session cache under ignored `test-runs/.auth`, with atomic restricted
writes, expiry/scope/format rejection, validation before reuse, fresh-login and
one-shot 401/403 relogin behavior, and non-secret status/clear primitives. The
runner check, all four focused authentication tests, and the integrated runner
suite (24/24) pass after the parallel target-configuration work was integrated.

Phase 9 Step 9 CLI controls (`phase3_topology`): `lab auth status` and
`lab auth clear` now operate on only the resolved existing-install origin and
username and emit no cookie, cache path, password, PIN, TOTP, project, or Flow
data. Their narrow resolver does not require execution credentials or project
configuration. `--fresh-login` is accepted by run and matrix, rejected for an
isolated target, and retained on the typed existing-target configuration for
the control adapter. The runner check and the integrated suite (46/46) pass,
including subprocess-level status and clear coverage.

Phase 9 Step 5 Core audit/implementation note (2026-09-04): the read-only audit
confirmed the production Flow execution, run-detail/action/event, project,
gateway, pairing, and login routes required by the downstream adapter. Additive
Core improvements were identified for a current-session identity endpoint,
registered runtime cancellation, public command correlation, and remote
capability discovery. Implementation is blocked in this execution because the
active writable workspace is limited to `F:\!FluxIQWebExtension`; `F:\!FluxIQ`
is read-only and repository rules require patch-based edits. Phase 9 will use
the existing authenticated Automation Studio read endpoint for cookie validity,
fail closed on unsupported contracts, and report that aborting a synchronous
Flow request does not prove server-side cancellation. No Core file has been
changed.

Phase 9 Step 12 integration review (2026-09-04): an independent read-only pass
found two release-blocking false-positive risks (unsupported final-state
predicates and historical recording/session acceptance) plus bounded-request,
network-containment, failure-provenance, panel-depth, exact-origin, cleanup, and
Windows cookie-ACL hardening items. The primary immediately tightened matching
to the newly paired session and a recording created after the run baseline.
The remaining findings were assigned as Steps 13-15 and Phase 9 remains in
progress until they are integrated and revalidated.

Phase 9 Step 13 (`phase3_topology`): replaced the permissive scenario
final-state oracle with strict, typed evaluation of every predicate in the
current corpus: `text`, `contains`, `visible`, `exists`, `path`, `enabled`,
`iframe-count`, and `label-count:<label>`. Unknown predicates, invalid expected
value types, missing subjects, and mismatches now fail closed, so a candidate
page is selected only after all declared final-state facts pass. Text evidence
inside the named same-origin or cross-origin fixture iframe is resolved from
that iframe rather than from the outer element. The test-runner check and all
49 tests pass; Scenario Lab remains green at 16/16.

Phase 9 Step 15 (`phase0_contracts`): hardened existing-target configuration,
browser containment, and the reusable auth cache. The Core base URL must now
be an exact credential-free HTTP(S) origin with no non-root path, and cleartext
`ws://` gateway URLs are accepted only for loopback; remote gateways require
`wss://`. The runner installs request and WebSocket routing at the
`BrowserContext` before opening runner-created pages, permits only internal
extension/data/about/blob schemes plus the two exact Scenario Lab origins,
the exact Core origin, and configured gateway origin, and records sanitized
blocked destinations before failing the run. Windows cache directories and
files now use argv-only `whoami.exe`/`icacls.exe` calls with inheritance
removal, current-SID-only grants, native verification, and explicit ACL
inspection; inability to prove exclusivity fails closed, while other platforms
retain `chmod`. The test-runner check and all 60 tests pass, including live
Windows cache writes plus focused configuration, network-policy, and native
ACL command tests.

Phase 9 Step 14 (`phase4_evidence`): all authenticated control requests now
carry a default 30-second bound and accept explicit `AbortSignal`/timeout
overrides. Existing Flow context selection, start, synchronous run, detail,
action, and event reads share the caller's bound. A timeout/interruption after
a run ID exists preserves and rethrows the original failure, makes exactly one
independently bounded cancellation attempt, and exposes a non-secret report of
`confirmed`, `unconfirmed`, `unsupported`, or `failed`; the audited 404 is
reported as unsupported and never as cancellation. Timeout, abort, single-
attempt cancellation, unsupported-cancel, no-run-ID, and secret-exclusion tests
pass as part of the integrated runner suite (60/60).

Phase 9 downstream Step 6 (`phase4_evidence`): added the API-only
`ExistingFluxIQControlClient` with strict, sanitized DTOs for session, project,
and Flow preflight; stable Flow hashing; gateway discovery; context selection;
deterministic persisted-Flow start/run/cancel; and run detail/action/event
reads. Seven focused mocked API tests and the integrated runner suite (33/33)
pass. The adapter uses `/api/auth/session` when available and rejects an account
mismatch; on the audited Core revision, where that route is absent, it proves
only authenticated project access. The cancellation primitive fails closed on
that revision because Core declares but does not register the endpoint.

Phase 9 primary integration validation (2026-09-04): the integrated workspace
passes `pnpm check`, `pnpm test`, and `pnpm build`; the test-runner suite passes
60/60. A new full isolated-topology browser run,
`run-mtnpc74q-89d850a9`, passed after the network and timeout hardening. Its
bundle independently passes `lab inspect` with 10 indexed artifacts. The
existing-target CLI also fails closed before startup when its exact Core origin
or required credentials/project/Flow configuration are absent. A live external
Flow was not executed because this session was not provided an external target
or secrets; this is a certification gap, not an unimplemented runner path.

Phase 9 downstream Step 8 (`phase0_contracts`): added a focused Playwright
web-panel verification helper that accepts an existing browser context and an
already-parsed session-cookie value. It injects one exact-origin HttpOnly/Lax
`fluxiq_session` cookie, opens the exact Automation Studio project/Flow runtime
URL, and verifies the rendered project shell plus the selected Flow hierarchy
item. For a requested run it first checks an already-rendered action log, then
uses the current run-search and run-row controls to select and assert the exact
run. If the current panel cannot select that run, it returns an explicit
`limited` outcome instead of claiming success; the audited non-authoritative
run-detail deep link is not treated as proof. Cookie values are absent from
results and sanitized errors. The test-runner check and all 39 tests pass.

Phase 9 Step 10 (`phase0_contracts`): extended the private `RunManifest` with
an optional discriminated `fluxiqExecution` provenance block. Its absence keeps
older evidence bundles valid. Isolated runs may record only `targetMode`, while
existing-installation runs must record an exact credential-free HTTP(S) origin,
project/Flow/runtime identifiers, a lowercase SHA-256 Flow content hash,
session-identity verification state, and an explicit `verified` or `limited`
panel-verification outcome. Strict nested unknown-property rejection prevents
cookies, PINs, credentials, and raw gateway data from being added to this
contract. The focused TypeScript check and all 14 contract tests pass.

## Implementation Validation (2026-09-04)

The primary agent independently ran the integrated gates after all phase work:

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Pass; all 11 workspace projects resolve from the committed lockfile. |
| `pnpm check` | Pass; all 10 executable workspace packages type-check. |
| `pnpm test` | Pass; domain smoke plus contract, fixture, runner, evidence, matrix, boundary, policy, and orchestration suites. |
| `pnpm build` | Pass; all workspace build targets, including the separate E2E extension artifact. |
| Extension Playwright E2E | Pass 8/8 on headed Windows Chromium with loopback-only network enforcement. |
| Scenario-site Playwright E2E | Pass 10/10 on Windows Chromium; every deterministic fixture behavior is exercised. |
| Finite full-topology run | Pass: `run-mtnla9cz-a4da1119`, Chrome/134.0.6998.35, paired session, persisted recording, successful Core-issued navigate/type actions, asserted page value, 15 indexed artifacts, and closed ports. |
| Bundle inspection | Pass: `lab inspect` rehashed and validated the run manifest and all indexed artifacts. |
| Three-repeat baseline | Pass 3/3: `run-mtnlid1v-def3d560`, `run-mtnlixjt-05233872`, and `run-mtnljjuj-097e55ff`; all three bundles independently inspect as valid. |
| Core promotion audit | `defer`: eight browser/extension vocabulary findings, one independent domain repository, and zero Core consumers. |
| Real-site execution | Deliberately not run; no reviewed target policy was supplied. |

Linux Chromium is configured to install browser dependencies and run headed
under Xvfb in CI, but it was not executable on this Windows host. The isolated
lane proves production client actions through Core and the gateway. The
existing-install lane executes an already-persisted Flow without synthesizing
or overwriting it; live certification of that lane requires the user-supplied
target configuration described above.

## Executive Decision

Build the first testing facility in `F:\!FluxIQWebExtension`, using Playwright Test and its bundled Chromium. Each run will:

1. build the current workspace version of the extension;
2. create a fresh, run-scoped browser profile;
3. start a deterministic local scenario site and isolated FluxIQ host;
4. launch Chromium with only the newly built unpacked extension;
5. pair the extension through a test-only host control seam;
6. exercise the production gateway, recording, state, and action paths;
7. assert browser state, gateway traffic, FluxIQ recordings, and runtime results;
8. retain an event-indexed evidence bundle for review; and
9. clean up all disposable processes and state.

Prefer Playwright over Puppeteer initially. FluxIQ already uses Playwright Test, its trace/report/artifact lifecycle fits this requirement, and it has a documented Manifest V3 fixture. Keep browser control behind a narrow internal interface so Puppeteer can replace it later if required; do not maintain two drivers from the outset.

The facility is not a FluxIQ global program. Scenario sites, browser launch code, DOM assertions, selectors, and extension controls are web-domain validation infrastructure. Only contracts and services that remain coherent without browsers, DOM, URLs, tabs, extensions, or `web-automation` may be promoted to `F:\!FluxIQ`.

## Goals

- Test the repository build of the extension, never a stale manually loaded copy.
- Reproduce extension and FluxIQ behavior in isolated, deterministic sessions.
- Make scenario websites small, inspectable, resettable, and agent-authorable.
- Cover the path from page events through the extension and gateway into FluxIQ recordings, then back through runtime actions to page state.
- Support both a disposable isolated Core topology and an explicit attachment to an already-running FluxIQ installation.
- Execute an existing persisted FluxIQ Flow against the test extension and scenario page, then assert its run, attempts, action results, and final browser state.
- Reuse a validated authenticated web-panel session across local runs without repeatedly submitting credentials.
- Produce event-indexed, low-cost visual evidence for human and agent review.
- Support bounded agents that create scenarios, diagnose defects, propose fixes, and compare candidates without merging automatically.
- Keep public FluxIQ code strictly domain-neutral.
- Add real-site probes later without weakening the deterministic release gate.

## Non-goals For The First Facility

- Pixel-perfect coverage of every browser-shell surface.
- Testing store-installed Chrome or Firefox release packages.
- Autonomous merging, publishing, deployment, or writes to live websites.
- Training directly from flaky public-site runs.
- Full-rate video for every passing run.
- General-purpose orchestration for unrelated FluxIQ importers.
- Moving `web.*` actions, web recording events, DOM models, or scenarios into core.

## Audit Findings

### Web-extension repository

The current product boundary is sound:

- `apps/extension` owns the Manifest V3 client, service worker, content scripts, side-panel/popup UI, lightweight local state, gateway connection, and browser actions.
- `domain` owns the `web-automation` manifest, recording definitions, state reducers, action/input mappings, node definitions, and runtime adapter.
- The extension uses the generic FluxIQ WebSocket client and canonical recording/state/action messages.
- Screenshots can already become content-addressed `automation-object://` references inside state visual frames.
- `pnpm dev` builds the local domain host, performs repo-local setup, and starts the core web application with its client gateway.

The testing gap is substantial:

- The extension test only verifies that five files exist.
- The domain test is a useful large smoke assertion script, but not a granular test suite.
- There are no browser E2E specs, fixture sites, extension fixtures, CI workflow, run manifest, or retained triage bundle.
- Clocks, randomness, timers, WebSocket construction, Chrome APIs, and process startup are mostly hard-wired, limiting deterministic component tests.
- Extension builds import sources through fixed sibling-repository paths; CI and agent worktrees must validate that topology explicitly.
- MV3 service-worker suspension and restart are not covered.

### FluxIQ core repository

Core already provides reusable seams:

- domain-neutral runtime commands, capabilities, clients, runs, attempts, and events;
- a generic client gateway and `MockClientGatewayClient`;
- immutable recording sessions with state, events, actions, observations, and evidence references;
- content-addressed object storage and safe visual-frame references;
- runtime trace/run concepts and deterministic Automation Studio fixtures; and
- an established web-panel Playwright suite with screenshots, video, traces, fixture verification, and browser/view matrices.

Core's browser suite tests the web panel, not an extension. It targets an already-running server, whereas this facility must own a complete run-scoped topology. Core's project object API currently accepts renderable images rather than WebM; use it for canonical recording screenshots, not arbitrary runner video.

## Architectural Boundary

Apply this placement test:

> If all browser, DOM, URL, selector, tab, extension, and `web-automation` terminology were removed, would the capability still have a coherent public contract useful to two or more importing repositories?

If no, it belongs here. If yes, it is only a core candidate after a second real consumer or concrete cross-domain requirement proves the abstraction. Apparent reuse alone is insufficient.

| Concern | Initial owner | Reason |
| --- | --- | --- |
| Playwright extension fixture and persistent context | Web-extension repo | Browser-extension-specific profile and process behavior. |
| Scenario sites and expected DOM/state/actions | Web-extension repo | Web-domain fixtures. |
| Browser drivers, tab selection, content-script probes | Web-extension repo | Depend on Chrome and DOM contracts. |
| `web.*` recording/action assertions | Web-extension `domain` tests | Protect importer contracts. |
| Test pairing/bootstrap adapter | Web-extension repo | Wires this importer, gateway, project, and extension. |
| Facility runner CLI | Web-extension repo | Knows both repos and the concrete topology. |
| Screenshot triggers and DOM-change deduplication | Web-extension repo | Browser-aware evidence policy. |
| Playwright trace, report, and WebM | Repo/CI artifacts | Tool-native diagnostics, not canonical FluxIQ evidence. |
| Generic run/result/evidence-reference schemas | FluxIQ candidate | Only if runner- and domain-neutral. |
| Generic artifact retention/redaction policy | FluxIQ candidate | Cross-domain when media-neutral. |
| Generic baseline/candidate evaluation | FluxIQ candidate | Can compare arbitrary deterministic runtimes. |
| Content-addressed recording images | FluxIQ core | Already canonical visual evidence. |
| Runtime command/run/attempt/event contracts | FluxIQ core | Already generic and reusable. |
| Agent dispatch implementation | Outside core initially | Vendor/CI orchestration is not framework runtime. |
| Agent task/result schema | FluxIQ candidate later | Promote after multiple domains consume it. |
| Real-site credentials and captures | Importer-local private storage | Forbidden from the public framework repo. |

Dependency direction stays one-way:

```text
FluxIQ contracts/runtime/testing primitives
                 ^
                 |
web-automation domain package
                 ^
                 |
browser extension + E2E facility + scenario sites
```

Core must never import this repository. The facility may consume public FluxIQ packages or start the core app externally. Core tests must never depend on this sibling checkout.

### Promotion checklist for FluxIQ core

Require all of the following before moving facility code into core:

- no browser-, DOM-, extension-, runner-, agent-vendor-, or web-domain fields in the base API;
- at least two credible domain consumers;
- unit and contract tests in core that run independently of this repository;
- an intentionally public export, compatibility assessment, and authored docs;
- defined migration and retention behavior for persisted data; and
- this facility consumes the public seam rather than a core internal path.

## Proposed Repository Layout

```text
apps/
  extension/
    e2e/
      fixtures/
        extension-context.ts
        fluxiq-host.ts
        scenario-server.ts
        evidence-recorder.ts
      specs/
        install-and-connect.spec.ts
        recording.spec.ts
        playback.spec.ts
        resilience.spec.ts
      assertions/
        gateway.ts
        recording.ts
        runtime.ts
      playwright.config.ts
    src/testing/
      test-control.ts          # included only in test builds
  scenario-lab/
    package.json
    src/
      server.ts
      registry.ts
      scenarios/
        forms-basic/
          scenario.ts
          site/
        dynamic-list/
          scenario.ts
          site/
        iframe-checkout/
          scenario.ts
          site/
packages/
  test-contracts/
    src/
      scenario.ts
      run.ts
      evidence.ts
      evaluation.ts
  test-runner/
    src/
      cli.ts
      coordinator.ts
      process-supervisor.ts
      workspace.ts
      run-writer.ts
      compare.ts
test-runs/                    # ignored local output
```

`packages/test-contracts` stays private and repository-local initially. The scenario lab is an executable fixture app; metadata and expectations live with each fixture. E2E hooks use a separate build/manifest and must be structurally unable to ship in production output.

## Runner Topology

```text
run coordinator
  +-- scenario HTTP server (random loopback port)
  +-- isolated FluxIQ data root and project
  +-- FluxIQ web/API process (random loopback port)
  +-- client gateway (random loopback port)
  +-- freshly built extension dist/e2e-chromium
  +-- fresh Chromium persistent profile
  |     +-- MV3 service worker
  |     +-- extension side-panel page
  |     +-- scenario pages and frames
  +-- evidence collector
        +-- structured event stream
        +-- event-triggered PNGs
        +-- Playwright trace and optional WebM
        +-- browser/network/process logs
        +-- run.json, summary.json, report.html
```

All ports, directories, IDs, seeds, clocks, and versions go into `run.json`. Prefer OS-assigned loopback ports. Parallel runs never share a FluxIQ root, storage directory, browser profile, or scenario state.

### FluxIQ target modes

The runner must expose two explicit, mutually exclusive target modes:

1. `isolated` remains the default. The runner creates a temporary identity,
   project, Core workspace, data root, gateway, and web process, and owns their
   cleanup.
2. `existing` attaches to an already-running FluxIQ web installation. The
   runner must not copy its workspace, run setup, create an administrator,
   start or stop its processes, reset its data, or delete its projects, Flows,
   recordings, or run history. Normal durable records produced by the selected
   Flow execution are expected and must be identified in the evidence bundle.

The proposed CLI/configuration contract is:

```powershell
# Values may be placed in an ignored .env file instead.
$env:FLUXIQ_TEST_TARGET = "existing"
$env:FLUXIQ_TEST_BASE_URL = "http://127.0.0.1:3000"
$env:FLUXIQ_TEST_USERNAME = "<test-user>"
$env:FLUXIQ_TEST_PASSWORD = "<password>"
$env:FLUXIQ_TEST_PIN = "<authorization-pin>"
$env:FLUXIQ_TEST_PROJECT_ID = "<existing-project-id>"
$env:FLUXIQ_TEST_FLOW_ID = "<existing-flow-id>"

pnpm lab run basic-form --target existing --flow $env:FLUXIQ_TEST_FLOW_ID --evidence events
```

`FLUXIQ_TEST_GATEWAY_URL` may override gateway discovery when the installation
does not publish the usable client URL. The runner must reject ambiguous mixed
configuration, such as `--target isolated` with an existing-install base URL.
It must preflight server reachability, authentication, compatible domain/client
contracts, project access, Flow existence, gateway availability, and extension
pairing before changing browser state or starting the Flow. The resolved target
mode and sanitized origin belong in `run.json`; credentials, cookies, PINs, and
pairing codes do not.

### Existing persisted Flow execution

In `existing` mode, the scenario manifest may reference a configured existing
Flow, or the CLI may supply `--flow <id>`. The runner must use supported FluxIQ
web/API contracts to select the configured project, pair the freshly built test
extension, start that exact persisted Flow, capture the returned run ID, and
observe the corresponding run and attempt events until a terminal state.

A Flow test passes only when all of the following agree:

- the requested project and Flow IDs are the ones Core reports as executed;
- the Flow run reaches the expected terminal status within a bounded timeout;
- required node attempts and client actions settle successfully;
- correlation IDs connect the Core run/attempts to gateway commands and
  extension results;
- the scenario website reaches the manifest's expected final state; and
- the evidence bundle records the Core installation fingerprint, Flow revision
  or content hash, run ID, attempt IDs, extension hash, and sanitized target
  origin.

The runner must not silently replace the selected Flow with a generated test
Flow. A later isolated-mode feature may import a fixture Flow explicitly, but
that is a distinct operation and artifact. Flow execution must use the public
or supported production web/API seam; implementation must first audit the
current Core run endpoints and event/status contracts rather than binding to
private database layout.

### Web-panel API login and reusable session cookies

The lab CLI must load local environment configuration before resolving test
credentials. Add `.env` and `.env.local` to the repository ignore policy before
supporting those files, retain a committed non-secret `.env.example`, and give
process environment variables precedence. At minimum, accept
`FLUXIQ_TEST_USERNAME`, `FLUXIQ_TEST_PASSWORD`, and `FLUXIQ_TEST_PIN`, retaining
the existing optional `FLUXIQ_TEST_TOTP`. Startup must fail clearly when an
existing-install run requires a missing value; secrets must never appear in
command arguments, logs, reports, manifests, or agent packets.

Authentication uses the same production login API as the FluxIQ web panel. On
the first run, the control client submits the configured username/password and
optional TOTP, captures the returned session cookie, validates it through an
authenticated read-only endpoint, and stores it in a private ignored auth
cache. The cache key must include the normalized FluxIQ origin and username so
a cookie is never sent to another installation or account.

Suggested local layout:

```text
test-runs/.auth/
  <origin-and-user-hash>.json
```

The cookie cache is sensitive runtime state, not evidence. Its implementation
must:

- write atomically with owner-only permissions where the platform supports it;
- store only the minimum cookie fields and session metadata needed for reuse;
- never copy cookies into finalized run bundles or process logs;
- validate the cookie against Core before each run;
- reject expired, malformed, wrong-origin, wrong-user, or authorization-failed
  sessions;
- on `401`/`403`, invalidate the cached entry and perform one fresh API login,
  then fail rather than loop if reauthentication is unsuccessful;
- support `--fresh-login` to deliberately bypass and replace the cache and a
  non-secret `auth status`/`auth clear` operation scoped to one origin/user;
- keep the PIN outside the cookie cache and require it from environment at the
  point of privileged Flow/client-action authorization; and
- inject the validated session into a browser context only for focused web-panel
  UI tests, with exact origin scoping and no persistent general-purpose browser
  profile reuse.

Cookie reuse removes repeated login requests; it does not mean reusing the
scenario browser profile. Every test still receives a fresh extension/browser
profile so extension isolation remains meaningful.

## Browser Strategy

### Required release lane

Use Playwright's bundled Chromium with `launchPersistentContext`, an empty run-scoped profile, and only the freshly built extension loaded. Set locale, timezone, viewport, color scheme, and permissions explicitly. Block non-loopback network unless a scenario is in the real-site lane.

Discover the extension ID from the MV3 service-worker URL. Drive `chrome-extension://<id>/...` pages for deterministic extension UI coverage. Keep a small headed canary for actual action/side-panel integration because direct extension pages do not prove browser-shell wiring.

### Compatibility lanes

- Chromium extension E2E: required for relevant pull requests.
- Headed Chromium shell canary: scheduled and pre-release.
- Firefox: build/manifest checks first, followed by a separate native lane; never claim Firefox parity from Chromium-only loading.
- Installed stable Chrome/Edge: separate release certification because side-loading behavior differs from bundled Chromium.

## Scenario Contract

Scenarios export declarative data, not arbitrary runner code:

```ts
type WebScenario = {
  schemaVersion: "0.1";
  id: string;
  title: string;
  tags: string[];
  seed: number;
  startPath: string;
  capabilities: Array<
    | "navigation"
    | "forms"
    | "scroll"
    | "mutation"
    | "iframe"
    | "popup"
    | "download"
  >;
  networkPolicy: "loopback-only" | "allowlisted-real-site";
  recordingScript: ScenarioStep[];
  playbackGoal?: ScenarioGoal;
  expected: {
    pageFacts?: ExpectedFact[];
    recordingEvents?: ExpectedEvent[];
    actions?: ExpectedAction[];
    finalState?: ExpectedFact[];
    allowedConsoleErrors?: string[];
  };
  evidencePolicy?: Partial<EvidencePolicy>;
};
```

Steps express semantic intent such as `click`, `type`, `select`, `scroll`, `navigate`, `waitForState`, and `checkpoint`. Fixtures favor accessible names and stable `data-testid` attributes. FluxIQ assertions target stable action/state contracts, never incidental selectors or timing.

### Initial deterministic corpus

1. Basic form: type, clear, select, validate, submit, and result state.
2. Dynamic list: mutation bursts, debounce, entity identity, and reordering.
3. Navigation: full navigation, history state, reload, redirect, and back.
4. Long document: below-fold targets, scrolling, sticky elements, and screenshot coordinates.
5. Iframes: same-origin and cross-origin loopback frames and coordinate mapping.
6. Ambiguous targets: repeated labels/roles and selector fallback.
7. Delayed UI: wait/retry/timeout and late content.
8. Failure surfaces: detached/disabled elements, blocked URLs, and page closure.
9. Reconnect: gateway interruption, queued events, replay, and MV3 worker restart.
10. Sensitive input: password/payment-like fields and evidence redaction.

Every fixture gets a direct site-level test independent of the extension, separating broken fixtures from broken clients.

## Test Layers

### Layer 1: pure and component

- Split the bundled domain smoke assertions into Vitest suites.
- Inject clock, ID generator, timer scheduler, WebSocket factory, storage, and Chrome API boundaries.
- Test queue limits, reconnect backoff, duplicate-click suppression, event mapping, state filtering, targeting, result mapping, and redaction.
- Use core's mock client for generic gateway contracts; keep web meanings here.

### Layer 2: extension integration

- Load the real built extension in Chromium.
- Verify manifest/worker startup, content injection, settings, connect/disconnect, pairing state, extension pages, and action routing.
- Exercise worker suspension/restart and persisted queue recovery.

### Layer 3: full FluxIQ E2E

- Start isolated Core and gateway processes.
- Create a run-scoped project through supported APIs/services.
- Pair with an authenticated test controller, not private browser-side memory.
- Record scripted human interaction and assert `RecordingSession`, ordering, state, image references, and action bindings.
- Execute a deterministic Flow through the extension and assert runtime results plus final page state.
- In an explicit existing-install lane, execute a named persisted Flow without
  taking lifecycle or cleanup ownership of that FluxIQ installation.
- Validate and reuse an origin/account-scoped web-panel session cookie, while
  retaining one focused fresh-login test and separate UI-login coverage.

### Layer 4: improvement evaluation

- Run pinned baseline and candidate builds against identical seeds and environment fingerprints.
- Compare correctness, event fidelity, action success, latency, retries, evidence volume, bytes, and flake rate.
- A candidate cannot improve by suppressing evidence or weakening expectations.
- Safety invariants and existing checks pass before aggregate ranking.

### Layer 5: real-site probes

Add these only after the deterministic corpus is trusted. Real-site cases are quarantined, allowlisted, rate-limited, read-only by default, and excluded from merge gates. Credentials use an external secret provider. Artifacts are private, redacted, and short-lived. Terms, account impact, and authorization require explicit review before writes.

## Evidence And Human Review

Use three complementary channels:

1. A structured event log, always retained for failures and used as the artifact index.
2. Event-driven screenshots immediately before and after important actions, on navigation/checkpoints, and on failure.
3. A Playwright trace retained on failure and selected diagnostic runs.

Video is optional. Keep low-resolution WebM for failures, scheduled runs, or scenarios marked `reviewRequired`. For ordinary passes, generate a compact contact sheet/timeline from event screenshots. This provides the requested low-FPS/hybrid review without continuous-video storage cost.

### Capture triggers

- scenario/test step start and completion;
- extension-recorded action received by the gateway;
- runtime command dispatch and settlement;
- navigation/history transition;
- meaningful DOM/state fingerprint change after a quiet window;
- console/page/network error, disconnect, timeout, or failed assertion;
- explicit checkpoint; and
- final state.

Rate-limit triggers, hash frames, and drop exact duplicates while preserving the event with the prior image digest. An optional 0.5-1 FPS sampler runs only during long uninstrumented waits.

### Run bundle

```text
test-runs/<run-id>/
  run.json
  summary.json
  report.html
  events.ndjson
  screenshots/
  review/
    contact-sheet.webp
    timeline.json
  playwright/
    trace.zip
    video.webm
  logs/
    runner.log
    core.log
    gateway.log
    browser-console.ndjson
    network.ndjson
  snapshots/
    recording.json
    runtime-run.json
```

`run.json` records both repo SHAs and dirty-state flags, lockfile hashes, extension version/hash, browser and OS, seed, scenario revision, ports, process exits, timing, artifact index, redaction state, and verdict. Writes are atomic and SHA-256 indexed.

Never retain credentials, authorization headers, pairing tokens, password values, cookies, or unrestricted response bodies. Redact before durable write. A redaction failure fails closed and excludes the affected visual artifact.

### Retention defaults

- Passing PR: summaries and metrics for 14 days; only named checkpoint screenshots.
- Failed/flaky PR: full bundle for 30 days.
- Scheduled certification: full bundle for 90 days.
- Real-site probe: default 7 days.
- Golden images: commit only when deterministic, reviewed, and private-data-free.

CI retention is separate from canonical FluxIQ storage. Images intentionally linked to a recording may also use the existing content-addressed object API.

## Test-control Seams

- `FLUXIQ_TEST_MODE=1` enables loopback-only test endpoints.
- A random per-run bearer secret authenticates the controller.
- Endpoints create/select the project, approve the expected client, expose readiness, and request clean shutdown.
- Test mode refuses non-loopback binds; production configurations do not register these routes.
- The extension test build may expose typed status/checkpoint messages; the production manifest/build excludes them.
- After bootstrap, scenarios use the real production gateway messages and action paths.

Do not UI-automate pairing in every correctness test. Give pairing UI one focused spec; repeated UI pairing adds timing noise and obscures fault ownership.

## Agent And Subagent Workflow

Expose a machine-readable runner before autonomous repair:

```text
pnpm lab scenario create <id>
pnpm lab run <id> --seed <n> --evidence failure
pnpm lab inspect <run-id>
pnpm lab compare <baseline-run> <candidate-run>
pnpm lab matrix --changed
```

### Roles

- Coordinator: selects scenarios, creates isolated worktrees/run roots, assigns bounded tasks, aggregates results, and does not edit product code.
- Scenario agent: writes only one scenario folder and its expected contract.
- Diagnosis agent: read-only; returns evidence-linked hypotheses and ownership.
- Framework repair agent: writes only explicitly scoped `F:\!FluxIQ` paths.
- Extension/domain repair agent: writes only explicitly scoped paths here.
- Reviewer agent: compares baseline/candidate evidence and detects weakened tests.

### Dispatch packet

Each task includes its objective, allowed paths, scenario/seed/command, baseline run and failing invariant IDs, bounded artifact index, time/iteration/token/run budgets, prohibited actions, required checks, and a structured response schema.

### Safe improvement loop

1. Reproduce twice with the same seed.
2. Classify ownership: fixture, facility, extension, domain, or core.
3. Create one bounded candidate in a disposable worktree.
4. Run focused checks and the failing scenario.
5. Run regressions selected from changed capabilities.
6. Compare baseline and candidate evidence/metrics.
7. Independently reject expectation weakening, missing evidence, and boundary violations.
8. Leave a patch/report for human approval; never merge automatically.

One agent writes a worktree at a time. Subagents use disjoint paths. Cross-repo contract changes remain separate commits/reviews even when tested together.

### Promotion gates

- Three consecutive passes on clean profiles.
- No required capability-matrix regression.
- `check`, `test`, and `build` pass in each changed repo.
- Public contract changes also pass compatibility/package validation.
- No unexpected network destination or leaked secret.
- Invariant/assertion coverage does not decrease without approval.
- The evidence bundle is complete and hash-consistent.
- Reviewer-agent and human approvals are recorded.

## Failure Taxonomy

Every failure gets one primary category:

- `fixture.invalid`
- `environment.missing`
- `process.startup`
- `extension.install`
- `extension.worker`
- `gateway.connection`
- `gateway.pairing`
- `recording.contract`
- `recording.persistence`
- `action.dispatch`
- `action.targeting`
- `runtime.behavior`
- `visual.mismatch`
- `performance.budget`
- `security.redaction`
- `test.flaky`
- `unknown`

Classification drives agent ownership and prevents fixture defects from triggering framework edits.

## Metrics

Correctness gates precede scoring. Track expected/observed event recall, unexpected events, final-state pass rate, command outcomes, dispatch latency, persistence lag, reconnect recovery, lost/duplicate events, targeting tier/confidence, screenshot count/deduplication/bytes, browser errors, phase timing, and clean-profile flake rate.

Do not collapse these into one release score. Aggregate scores may rank candidates only after every safety and correctness invariant passes.

## Implementation Phases

### Phase 0: contracts and boundary lock

- Add this repository's `AGENTS.md` with the same public-framework/domain boundary as core.
- Add private scenario/run/evidence/evaluation contracts and JSON schema validation.
- Ignore run outputs and browser profiles.
- Record exact core revision/package compatibility in runs.

Acceptance: invalid scenarios fail before startup; run manifests are readable without Playwright; no core change is required.

### Phase 1: deterministic scenario lab

- Build the server and basic-form, dynamic-list, and navigation fixtures.
- Add run-token-scoped reset, seed, health, and final-state endpoints.
- Add direct fixture tests and block external network.

Acceptance: parallel scenarios remain deterministic and reset recreates the declared state.

### Phase 2: real extension fixture

- Add and pin Playwright Test in this workspace.
- Build a separate E2E Chromium artifact from current source.
- Launch a fresh persistent profile and discover the worker/extension ID.
- Add install, injection, extension-page, action, restart, and cleanup specs.

Acceptance: no manual loading; metadata proves the loaded build hash; runs share no browser state.

### Phase 3: isolated FluxIQ topology

- Add process supervision and unique FluxIQ storage.
- Add authenticated loopback project/pairing bootstrap.
- Start and health-check Core and gateway.
- Assert recording and runtime-action round trips.

Acceptance: the basic form persists correct inputs/outputs; production
client-action commands reach expected page state; cleanup works on every exit
path. Persisted Flow execution is moved to Phase 9 and is not implied by this
phase's completed status.

### Phase 4: evidence bundle and review

- Implement event NDJSON, screenshot triggers/deduplication, traces, optional video, contact sheet, and report.
- Correlate scenario steps, gateway messages, recording entries, command attempts, and images.
- Add redaction and integrity tests.

Acceptance: `report.html` identifies the failing step and before/after state; every file is indexed/hashed; sensitive fixture values are absent.

### Phase 5: matrix and CI

- Complete all ten deterministic scenarios.
- Add changed-capability selection and a nightly full matrix.
- Upload bundles according to retention policy.
- Add Windows and Linux Chromium lanes with fail-closed prerequisites.

Acceptance: the clean-checkout PR matrix passes; seeded faults yield expected categories/evidence; a three-repeat flake baseline exists.

### Phase 6: bounded improvement agents

- Add task-packet generation, read-only diagnosis, worktree isolation, budgets, comparison, and review gates.
- Begin human-triggered with no automatic merge.
- Audit prompt, action summary, patch, validation, and verdict.

Acceptance: scenario agents cannot edit product code; repair agents can fix a seeded fault; weakened expectations and out-of-scope writes are rejected.

### Phase 7: core extraction only after proof

- Identify contracts used by a second domain.
- Propose the smallest neutral APIs in core.
- Add docs, migrations, exports, and move both consumers to public seams.
- Leave browser launch, Playwright, web scenarios, and extension logic here.

Acceptance: core tests have no dependency on this repo; two consumers use the seam; no web vocabulary enters core.

### Phase 8: real-site probes

- Add allowlists, external secrets, rate limits, destructive-action denial, private artifact storage, and operational review.
- Start with anonymous read-only sites and synthetic accounts.
- Keep results informational until stable.

### Phase 9: existing installation, reusable authentication, and Flow execution

1. Audit the current FluxIQ web/API contracts for session validation, project
   selection, Flow lookup/execution, run status, attempts, runtime events, and
   gateway discovery. Record the compatible Core revision and avoid private
   persistence access.
2. Add typed `isolated` and `existing` target configuration. Preserve isolated
   mode as the default and make attachment an explicit CLI/config choice.
3. Add `.env`/`.env.local` ignore entries and loading with
   process-environment precedence, a sanitized `.env.example`, and schema
   validation for base URL, username, password, PIN, optional TOTP, project ID,
   Flow ID, and optional gateway URL.
4. Implement an origin-and-user-scoped cookie jar with atomic private writes,
   pre-run validation, expiry handling, one-shot reauthentication, cache
   status/clear commands, and exhaustive log/evidence redaction tests.
5. Add the existing-install control adapter. It health-checks and fingerprints
   the installation but never starts, stops, initializes, resets, or deletes
   it.
6. Pair the freshly built E2E extension with the existing gateway using the
   authenticated control session and configured authorization PIN.
7. Select the configured existing project and Flow, execute it through the
   supported production API, capture its run ID, wait for terminal run/attempt
   state, and correlate its client actions with extension and browser evidence.
8. Add deterministic fixture Flows for compatibility testing while retaining a
   separate lane that points at a user-supplied existing Flow ID. Never mutate
   or overwrite the user-supplied Flow.
9. Add focused web-panel browser tests that reuse the validated cookie to open
   authenticated project, Flow, run, and recording views and assert their
   rendered state. Keep one independent login-UI spec; do not repeat UI login
   in every scenario.
10. Add CI and local tests for valid reuse, expiry, server-side revocation,
    wrong origin/account, TOTP-required login, incorrect PIN, unavailable
    project/Flow, incompatible Core, gateway failure, Flow failure/timeout, and
    cleanup that leaves the attached installation running.

Acceptance:

- two consecutive commands against the same existing installation authenticate
  once, validate/reuse the cookie on the second run, and use fresh browser
  profiles both times;
- a revoked or expired cookie is removed and replaced through exactly one API
  login without leaking credentials or cookie material;
- the selected existing Flow runs through Core and the paired repository build
  of the extension, its required attempts/actions pass, and the scenario's
  browser state is asserted;
- the evidence report links the Flow run and attempts to extension actions and
  screenshots without containing password, PIN, TOTP, cookie, pairing token, or
  authorization headers;
- focused browser assertions prove the authenticated web panel renders the
  selected Flow, run result, and recording; and
- after success, failure, timeout, or interruption, the existing FluxIQ server
  remains running and no pre-existing project, Flow, recording, or run is
  deleted or rewritten.

### Phase 10: clone an existing Flow into an isolated installation

This phase adds a third explicit target, `clone`. The configured existing
FluxIQ installation is always the read-only source. The normal run-owned
isolated Core, project, browser profile, extension, Scenario Lab, recordings,
and evidence directories are the writable destination. Clone mode must never
execute, save, publish, migrate, or delete the source Flow.

1. Add a versioned private clone-package contract containing source origin,
   source project/Flow identity, source content hash, sanitized Flow document,
   dependency inventory, compatibility decisions, and deterministic ID map.
   Reject unknown fields, credentials, cookies, authorization data, runtime
   history, publications, and opaque secret-looking values before persistence.
2. Extend target configuration and CLI with explicit `clone` mode. Reuse the
   existing source variables and scoped cookie cache; destination Core remains
   automatically provisioned and run-owned. `auth status`, `auth clear`, and
   `--fresh-login` apply to the source session.
3. Implement a read-only source exporter using only production read APIs:
   validate the source session, exact project/domain and Flow, fetch the full
   Flow document, inspect declared Flow dependencies, calculate the canonical
   content hash, and build the clone package. Assert through mocked transport
   tests that no source mutation endpoint can be called.
4. Add a facility-wide clone cache shared across independent runs under the
   ignored runs root. Scope entries by exact source origin, username, project,
   and Flow; use a source summary revision/fingerprint to reuse an unchanged
   sanitized clone package, and atomically replace it after a changed source is
   re-exported. Apply the same owner-only ACL guarantees as the auth cache,
   validate the complete package and hash on every read, quarantine corrupt or
   mismatched entries, bound cache size/age, and expose non-secret
   status/refresh/clear controls. Never cache credentials, cookies, headers,
   runtime history, recordings, or unredacted dependency values.
5. Classify dependencies before destination startup. Permit only registered
   domain/native node definitions and explicitly remappable Flow-local IDs.
   Never copy credentials, secrets, schedules, publications, run history,
   recordings, identity state, gateway state, or external integration state.
   Replace explicitly supported external side effects with named test doubles;
   otherwise fail closed with a bounded, sanitized incompatibility report.
6. Start the ordinary isolated topology and create a uniquely named disposable
   destination project through Core's public API. Create a destination Flow,
   deterministically remap project/Flow and other declared local identifiers,
   save the remapped artifact, read it back, and require a content-equivalence
   attestation before execution. Never write directly to `.fluxiq` storage.
7. Pair the freshly built extension with the isolated gateway, seed the
   scenario site, execute only the imported destination Flow, require its
   durable actions and final browser state, and persist recording/run evidence.
   Source and destination identifiers must remain distinguishable throughout.
8. Add failure-safe ownership and cleanup tests for export rejection, missing
   dependencies, import/save failure, hash mismatch, Flow timeout, browser
   failure, and interruption. Cleanup may remove only the isolated destination
   and run-owned state; it must leave the source installation and cache intact.
9. Add evidence fields for clone provenance: source origin/project/Flow/hash,
   clone-package hash, destination project/Flow/hash, dependency verdict,
   remapping summary, destination runtime run ID, and cleanup outcome. Store no
   raw source cookie, PIN, TOTP, password, authorization header, secret value,
   or unrestricted Flow payload in the human report.
10. Validate with contract/unit/integration tests, the full workspace gates, an
   isolated synthetic source-to-destination clone test, and finally one live
   configured source Flow. The live test remains a certification requirement,
   not something unit mocks may satisfy.

Acceptance:

- clone mode performs only authenticated read calls against the source and the
  source Flow hash is identical before and after the run;
- two independent runs may reuse one valid facility-wide cache entry after a
  lightweight source revision check, while a changed Flow, different source
  origin/account/project, expired entry, or failed validation forces a safe
  re-export and atomic cache replacement;
- the destination uses a fresh isolated Core and new project/Flow identifiers,
  and a read-back equivalence check proves that remapping changed only declared
  identity/environment fields;
- unsupported or secret-bearing dependencies stop the run before importing or
  executing anything, with no secret material in logs or evidence;
- the cloned destination Flow drives the fresh repository extension against
  Scenario Lab, reaches the declared browser state, and produces a new isolated
  recording plus durable run/action/event evidence; and
- success, failure, timeout, and interruption remove run-owned destination
  state while the source installation, Flow, recordings, runs, and configuration
  remain untouched.

Phase 10 Steps 2-4 source lane (`clone_source`, 2026-09-04): implemented the
explicit `clone` target using the existing source origin/user/password/TOTP,
project, and Flow variables; clone source reads do not require an authorization
PIN. Auth status/clear and fresh-login now scope to either an existing target or
the clone source. The read-only exporter exposes only login/session/project,
Flow, dependency-inspection, and node-definition read methods, rejects a
non-web-automation project, sanitizes the Flow before packaging, and uses the
production `inspect-flow-dependencies` and `list-native-node-definitions`
endpoints. Mock transport tests prove that export makes no source mutation or
runtime-execution request and that credentials, cookies, TOTP values, and raw
dependency/definition fields do not enter its result.

The facility-wide cache is stored under ignored `test-runs/.clone-cache` and
is keyed by a SHA-256 digest of the exact source origin, username, project, and
Flow. A summary revision/fingerprint gates reuse. Every read validates strict
entry fields, complete clone-package structure, exact scope, canonical package
hash, age, and size; changed, mismatched, oversize, or malformed entries are
removed from service and moved into an owner-only quarantine where possible.
Writes are atomic and use the same verified Windows ACL hardening as auth
sessions (0600/0700 elsewhere), with seven-day, 5 MiB-entry, and 32-entry
defaults. `lab clone-cache status|refresh|clear` returns only non-secret scope,
timestamps, state, and package hash; `refresh` explicitly means invalidate now
and re-export on the next clone run, so it does not require or print source
credentials. Focused `pnpm --dir packages/test-runner check` and the
integrated test-runner suite pass with 89/89 tests, including proof that an
unchanged summary reuses the cached sanitized Flow without fetching the full
Flow again while still revalidating dependency and registry policy. A scoped directory lock now serializes
load/save/status/refresh-clear operations for the same source without blocking
unrelated cache keys. Concurrent independent-run tests prove that simultaneous
writers publish exactly one complete, hash-valid winner, readers never observe
partial JSON, temporary files and locks are removed, Windows ACL hardening is
preserved, and status/clear results contain no Flow document or secret data.

Phase 10 cache drift follow-up (`clone_source`, 2026-09-04): cache hits now
reuse only the strict, hash-validated sanitized Flow document. The exporter
always re-reads the lightweight published-Flow dependency inventory and current
native/domain node definitions, then reruns compatibility classification before
destination startup. A registry-drift test removes a previously available
definition without changing the Flow summary and proves the cached Flow becomes
incompatible while `get-flow` remains skipped. This prevents a stale compatible
verdict from surviving registry/capability changes.

## Initial CI Shape

Pull requests run:

```text
static/domain gate
  pnpm check
  pnpm test
  pnpm build

browser smoke gate
  install/connect
  basic form recording
  deterministic playback
  artifact redaction/integrity

changed capability gate
  scenarios selected from changed module tags
```

Nightly certification runs the full corpus, resilience tests, three-repeat flake sampling, and failure video. Core retains its existing panel suite. Core contract changes should trigger importer compatibility CI rather than copying extension E2E specs into core.

## Key Risks

| Risk | Mitigation |
| --- | --- |
| MV3 suspension causes false failures | Restart tests, persisted-state assertions, readiness polling, no reliance on private live handles. |
| Extension flags change | Pin Playwright/bundled Chromium; separate installed-browser certification. |
| Agents weaken expectations | Schema/invariant locks, assertion diffs, protected corpus, independent review. |
| Repositories drift | Record SHAs/locks, compatibility gate, public packages rather than source internals. |
| Processes/profile locks leak | Central supervisor, deadlines, signal handling, cleanup verification. |
| Evidence volume explodes | Event triggers, deduplication, contact sheets, quotas, failure retention. |
| Secrets leak | Synthetic data, pre-write redaction, denylisted fields, fail-closed capture. |
| Cached web-panel cookie is stolen or crosses environments | Ignore auth cache, minimize fields, owner-only atomic files, bind entries to normalized origin and username, validate every reuse, and never include cookies in evidence. |
| Existing installation is damaged by the runner | Explicit attach mode, read-only preflight, no lifecycle/setup/reset/delete ownership, named project/Flow selection, and destructive API denial tests. |
| Existing Flow drifts between runs | Record Core revision plus Flow revision/hash and reject comparisons whose execution inputs differ unless explicitly approved. |
| Public sites are flaky | Quarantine lane, allowlists, rate limits, never a merge gate. |
| Test hooks ship | Separate build/manifest and production bundle inspection. |
| Core becomes web-specific | Boundary test, second-consumer rule, core API review. |

## Recommended Defaults To Confirm In Phase 0

- GitHub Actions, matching core's current CI.
- Retention periods from this plan until measured costs exist.
- Vendor-neutral task/result JSON with the existing Codex workflow initially.
- Windows first for local path parity; Linux before treating E2E as a release gate.
- No real-site selection before Phase 5 is stable.

## Documentation Sources

- Playwright extension testing: <https://playwright.dev/docs/next/chrome-extensions>
- Playwright screenshot, trace, and video options: <https://playwright.dev/docs/test-use-options>
- Puppeteer extension alternative: <https://pptr.dev/guides/chrome-extensions>
