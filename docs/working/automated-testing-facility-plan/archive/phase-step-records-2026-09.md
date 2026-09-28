> Archived 2026-09-28 from `automated-testing-facility-plan.md`: the per-phase step records for Phases 9-12 that followed the Execution Log table, and the 2026-09-05 final implementation and live-validation transcript.

# Phase Step Records And 2026-09 Live Validation Transcript

## Per-phase step records (2026-09-04 to 2026-09-06)

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

Phase 11 implementation note (primary, 2026-09-04): `pnpm demo:record` and
`pnpm demo:run` now provide a deliberately persistent existing-install smoke
workflow. The exact local workspace is configured by `FLUXIQ_DEMO_RUN_DIR`,
must remain below `FLUXIQ_TEST_RUNS_DIR`, is protected with owner-only ACLs,
and is guarded by an exclusive operation lock. The recording command creates
or reuses one `web-automation` project, creates the deterministic browser-action
Flow only if absent, pairs the production extension, records its own
Playwright-driven interaction with `basic-form`, verifies one new durable Core
recording, and stores only sanitized IDs and timestamps in `workspace.json`.
The Flow command requires that state, reconnects the same browser profile,
executes the persisted Flow through FluxIQ, verifies successful durable node
attempts and the submitted page, and records the runtime run ID in the same
file. These scripts intentionally retain the remote project, Flow, recording,
and run history and do not create ordinary random evidence-run directories.
Live validation depends on a running configured FluxIQ installation and test
credentials. Focused test-runner checks pass 92/92, and `pnpm check`,
`pnpm test`, and `pnpm build` pass across the workspace. With no `.env` or
`.env.local` present, the recording wrapper was also verified to fail before
filesystem allocation or external mutation with the exact missing
`FLUXIQ_TEST_BASE_URL` configuration error.

Phase 11 live validation update (primary, 2026-09-04):
`pnpm demo:setup-local` created the dedicated local test identity and hardened
ignored `.env.local` without disclosing its generated password or PIN. The
repository-local FluxIQ panel was started at `http://127.0.0.1:3000`, with the
production client gateway listening at `ws://127.0.0.1:4777/client`.
`pnpm demo:record` then passed against the live panel, reused project
`34cc76c0-3932-4c00-b5c7-c0a216268259` and Flow
`flow.web-extension-demo`, persisted recording
`client.extension-5bdf49b4-158f-49ed-8de3-cdca8c03a704.1788581072665`, and
wrote `workspace.json` plus `recording.png` to the configured persistent
`test-runs/web-extension-demo` directory. The live pass exposed and resolved
three integration details: domain project enumeration must send
`domainId=web-automation`; domain-scoped Flows must not declare the
global-only `executionDefaults.authorizedDomainIds` grant; and project binding
is resolved from a fresh operator Automation Studio context when recording
starts, rather than being required in the initial pairing-ready status. The
runner now verifies recording acceptance and stop state explicitly and can
safely repair only the exact empty configured demo Flow left by an interrupted
first-time provision. The focused test-runner suite passes 92/92 after these
corrections. `pnpm demo:run` remains a separate, intentionally user-invoked
validation of persisted Flow execution.

Phase 11 final live validation update (primary, 2026-09-04): the reusable demo
workflow now drives the real Automation Studio UI for project/Flow selection,
No LLM runtime mode, pairing, and Run dispatch, while the production extension
executes the deterministic DOM actions. Both scripts run headless by default
and copy the freshly built Chrome extension to a stable workspace-local load
path on every invocation, preserving the persistent profile identity while
preventing a stale unpacked build. The panel uses a separate persistent browser
profile so panel focus cannot steal the extension's automation target.

Evidence policy is now strictly event-only: every test-issued state-changing
action has one physical JPEG immediately before it and one immediately after
it; timed sampling and deduplication are disabled. Extension-executed Flow
actions participate through an acknowledged before/after boundary that pauses
the action until capture completes. The successful headless `demo:record`
bundle contained 24 action pairs / 48 physical screenshots with zero missing
pairs. The successful headless `demo:run` bundle contained 26 action pairs / 52
physical screenshots, including four Flow actions / eight runtime-boundary
screenshots, also with zero missing pairs. Live playback run
`6b7dc744-9b4a-41ab-9421-912d5ccd0ee1` succeeded without LLM intervention.
The validation exposed and fixed stale active-tab races around evidence focus,
top-frame reinjection being poisoned by inaccessible child frames, the global
pairing modal, and Chromium startup blank tabs. Focused runner tests pass
108/108. Final extension-repository `pnpm check`, `pnpm test`, and `pnpm build`
gates all pass. The focused FluxIQ Core runtime UI regression passes 6/6; its
workspace web type check remains blocked by pre-existing duplicate-property and
runtime transport typing errors in unrelated live-session files.

Repeat live validation (primary, 2026-09-05): after explicitly restarting the
repository-local panel, two consecutive headless record/playback cycles passed
against the same persistent workspace, project, Flow, browser profiles, and
cached authentication. Recording IDs were distinct, demonstrating new durable
Core recordings without recreating the project or Flow. Runtime runs
`9b996b58-401f-4f23-9689-d70e2789a9c9` and
`69ad3100-d502-4aea-9390-07cae2bcb9b6` both succeeded in No LLM mode and each
verified all four durable web action attempts plus the submitted scenario
state. Both recording bundles contained 24 complete action pairs / 48 physical
screenshots. Both playback bundles contained 25 complete action pairs / 50
physical screenshots, including four extension Flow actions / eight boundary
screenshots. All four bundle audits reported zero incomplete pairs. The
test-runner suite also passed 108/108 and the extension smoke test passed before
the live cycle.

Persistent demo isolation correction (primary, 2026-09-05): the reusable demo
scripts no longer attach to the repository-root FluxIQ installation. Each
command now locks `test-runs/web-extension-demo`, registers the web-automation
domain and test identity in `fluxiq-root/.fluxiq`, starts a copied Core web
workspace on stable dedicated loopback ports, and removes only the disposable
`.sessions/<run-id>` Core copy after shutdown. The isolated `.fluxiq`, project,
Flow, recordings, runtime history, authentication cache, extension identity,
and browser profiles persist across invocations. The setup command now seeds
the identity at that same isolated root. Old existing-install browser profiles
remain preserved under their former names; the isolated lane uses versioned
persistent profiles to prevent stale trust and UI state from crossing targets.

Live migration exposed three issues and fixed them at their owning boundaries:
extension status refreshes no longer overwrite an operator's in-progress
settings draft; the demo setup entrypoint honors an explicit isolated root; and
the generated Flow is reconciled through Core's public graph-patch seam so its
canonical document and paged viewport index agree. FluxIQ Core's generic
Runtime Debug connector now requests full Flow detail when activated and
prefers an already loaded full Flow over a summary entity. Its focused connector
test passes 13/13. Final real `pnpm demo:record` and `pnpm demo:run` commands
passed in separate Core lifecycles against the same project and Flow. Playback
run `e59ae7c8-63c0-4f49-8e7c-bd5382e4ca5c` succeeded with No LLM intervention
and all four browser actions. The successful recording evidence has 25 complete
before/after pairs (50 physical screenshots); playback has 28 complete pairs
(56 screenshots), with zero failed or missing pairs. The retained `.fluxiq`
exists, `.sessions` is empty after cleanup, and neither dedicated port remains
listening. The post-fix extension workspace `pnpm check`, `pnpm test`, and
`pnpm build` gates pass; the test-runner's final focused regression passes
111/111, including direct coverage of the public viewport/patch adapter.

Demo layout regression correction (primary, 2026-09-05): live browser
measurement showed that Core preserved the fixture's distinct `0, 240, ...`
coordinates, but the 240-pixel interval was narrower than the rendered node
card. Adjacent cards therefore overlapped after `fitView` and could appear
stacked. This was a testing-fixture defect, not a Core persistence or coordinate
mapping defect. The fixture now uses a 360-pixel interval, migrates the retained
fixture-owned graph through public `move_node` operations, and fails closed on
unexpected graph membership. Both demo commands now open the actual Nodes view
and assert pairwise non-overlap for all six rendered DOM rectangles. The
focused runner suite passes 111/111. A real `demo:record` migrated the existing
Flow to `0, 360, 720, 1080, 1440, 1800`, recorded a new durable session, and
passed the visual assertion. A subsequent real `demo:run` passed the same
assertion and completed No-LLM runtime run
`bc44c1a3-2fe4-48fc-809c-79d98dcf2eed`.

Phase 11 deterministic recording-to-Subflow completion (primary, 2026-09-06):
the recording script no longer seeds an executable graph through a control API.
It drives the production extension to create a durable recording, opens that
recording through the real Automation Studio hierarchy, and submits the real
**Generate deterministic Subflow** dialog. Core maps only domain-declared action
inputs, reuses the Flow Router's configured fallback Subflow, replaces only an
empty or wholly unedited recording-derived graph, spaces generated nodes at 340
pixels, and reconciles an already-materialized SQL graph index after canonical
document replacement. The runner reloads the panel and verifies the rendered
Subflow has four form actions plus at most one self-contained fixture navigation,
linear edges, recording provenance, and no pairwise overlap.

The paired playback script now expands/searches the real hierarchy instead of
assuming Runtime Debug children are already virtualized, selects No LLM mode,
and dispatches Run from the actual Runtime Debug surface. Live validation found
that a self-contained recorded start navigation referenced the Scenario Lab's
per-invocation port. The demo workspace now persists one protected
`scenario-port.json`, so independent record and playback processes expose the
fixture at the same address without keeping a server alive. The same isolated
`fluxiq-root/.fluxiq`, project, Flow, Subflow, Router, recordings, runtime
history, authentication cache, and browser profiles remain reusable.

Final live `npm run demo:record` produced recording
`client.extension-bbe5ab04-3eca-415f-b64c-d0c54e135ad2.1788718034927` and
replaced the generated Subflow through the panel UI. The following
`npm run demo:run` passed as runtime run
`8db01689-2074-4432-9551-130d301dd1a5`; it verified the Router decision,
Subflow entry, every recording-generated action attempt, and the submitted demo
result. The successful playback evidence contains 37 balanced before/after
pairs, 74 physical screenshots, no deduplicates, and no error boundary. Focused
validation passes: test-runner 116/116, domain smoke, extension smoke, and Core
Automation Studio service 89/89 including canonical/SQL graph replacement.
A second independent `npm run demo:run` reused the same saved Flow and
fixture address without recording again and passed as runtime run
`e23d811e-208d-4287-9815-780d67ec1548`; its evidence also contains 37 balanced
pairs and 74 physical screenshots.
### Phase 12: persistent isolated topology

This phase adds `persistent-isolated` as a fourth explicit target. It owns and
starts a local FluxIQ web process just like ordinary isolation, but separates
ephemeral execution state from a stable named workspace. The stable workspace
is rooted below `FLUXIQ_TEST_RUNS_DIR/persistent-isolated/<workspace>/` and
retains `fluxiq-root/.fluxiq/` plus `browser-profile/`. Each command still gets
a unique `.sessions/<run-id>/` containing the disposable Core web copy and
process logs, while its finalized evidence remains at the ordinary
`FLUXIQ_TEST_RUNS_DIR/<run-id>/` location.

1. Extend CLI and environment target contracts with
   `--target persistent-isolated`, `--workspace <safe-name>`, and
   `FLUXIQ_TEST_PERSISTENT_WORKSPACE`. Reject missing, conflicting, path-like,
   reserved, or traversal-capable workspace names and reject existing-install
   URL/project/Flow configuration for this target.
2. Add a persistent allocation that creates the stable FluxIQ root, `.fluxiq`
   storage, and browser profile idempotently while allocating a unique session
   root, Core web copy, logs, ports, and controller token per invocation. All
   resolved paths must remain under the configured runs root.
3. Acquire an exclusive workspace operation lock before starting processes.
   Reject a concurrent live owner, safely reclaim a verifiably stale lock, and
   release it on success, failure, timeout, or signal cleanup. Never delete the
   retained workspace as an error-recovery shortcut.
4. Reuse the isolated Core startup, domain host, identity/bootstrap, pairing,
   recording, runtime action, network containment, and readiness paths. Core
   receives the stable FluxIQ root/storage paths and per-invocation ports; the
   browser receives the stable profile. No FluxIQ Core source change is
   required.
5. Change final cleanup ownership so ordinary `isolated` and `clone` continue
   deleting all run-owned destination state, while `persistent-isolated`
   removes only its `.sessions/<run-id>` directory after copying logs. Its
   `.fluxiq`, browser profile, projects, recordings, trusted-client state, and
   run history survive.
6. Record the sanitized target mode and workspace name in the run manifest and
   human report without exposing absolute private paths, credentials, cookies,
   tokens, recorded values, or internal database content.
7. Add allocation, target parsing, lifecycle, concurrent-lock, stale-lock,
   failure cleanup, manifest, and two-invocation persistence tests. The second
   invocation must observe a sentinel or public Core state written by the
   first while using new ports/session directories and leaving finalized
   evidence independent.
8. Document exact commands, layout, ownership, reset semantics, and the
   distinction from `existing`, disposable `isolated`, `clone`, and the
   persistent demo scripts. Do not add an automatic reset/delete command in
   this phase; removal of a persistent workspace remains an explicit manual
   operation.

Acceptance:

- two sequential invocations with the same workspace name start independent
  supervised processes and unique execution sessions but resolve the same
  retained `.fluxiq` and browser-profile directories;
- stopping, failure, or interruption closes only owned processes and removes
  only the current `.sessions/<run-id>`, never the stable workspace;
- a second concurrent invocation of the same workspace fails before Core or
  browser startup, while a different workspace can run independently;
- ordinary isolated and clone cleanup behavior is unchanged;
- target configuration, manifests, logs, and reports contain the workspace
  name but no secret or private-state payload; and
- focused tests plus `pnpm check`, `pnpm test`, and `pnpm build` pass, followed
  by two live sequential runs demonstrating persistence when browser tooling is
  available.

Phase 12 execution update (primary plus assigned agents, 2026-09-04): target
and CLI configuration, stable allocation, operation locking, cleanup
ownership, sanitized manifest provenance, and current-state documentation are
integrated. The runner accepts `persistent-isolated` with one strict workspace
name; stable `.fluxiq` and browser-profile paths sit outside unique disposable
session roots. Live owners are rejected, confirmed stale PID locks are
reclaimed atomically, malformed locks fail closed, and Windows private paths
receive verified owner-only ACLs. Persistent startup failures and ordinary
cleanup remove only the current session. The integrated runner suite passes
103/103.

The first full headed Chromium run against workspace `phase12-live` passed as
`run-mtnvh2gt-787ce5f4`. Its processes stopped, finalized evidence was retained,
and its stable private workspace survived. The second invocation failed before
process startup with `Credential recheck required`: ordinary isolated bootstrap
generated a new password/PIN and attempted to replace the persisted identity.
The workspace itself was preserved. This is now an explicit Phase 12 blocker,
and a rotated agent owns an owner-protected, strict, atomic persistent identity
cache so later invocations reuse the same generated test credentials. Live
two-invocation acceptance remains in progress until that correction is
integrated and rerun with a fresh validation workspace.

Phase 12 completion update (primary and rotated `phase12_target_cli`,
2026-09-04): generated persistent test credentials now use a strict 4 KiB
owner-protected store at `.identity/credentials.json`. Creation is atomic,
malformed/oversized state fails closed, the generator runs only on first use,
and later starts verify the retained Core identity instead of attempting
credential rotation. The facility reuses one named web-automation project and
the persistent extension helper accepts either a new pairing challenge or an
already trusted session.

Two fresh sequential headed Chromium runs against the same workspace,
`phase12-live-v2`, passed: `run-mtnvptuo-800f61c7` and
`run-mtnvqwj5-169346f1`. Both finalized bundles pass `lab inspect` with 15
artifacts. They recorded different scenario/web/gateway ports
(`61420/61421/61422` then `61481/61482/61483`) while retaining the same
`.fluxiq`, browser profile, private identity, project, recording history, and
trusted extension state. After both runs the operation lock was absent and the
`.sessions` directory contained zero execution sessions. The runner suite
passes 107/107; full `pnpm check`, `pnpm test`, and `pnpm build` pass. No FluxIQ
Core files were changed.

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

## Final Implementation And Live Validation (2026-09-05)

Status: complete for the requested parent Flow / Router / Subflow ownership fix
and the two persistent-isolated demo scripts.

Core now owns and enforces explicit Flow representation metadata. Modern
top-level orchestration Flows reject public graph writes, owned Subflow graph
Flows require the exact parent/Subflow identity, and runtime execution must
enter through the parent Router and selected Subflow. The explicit,
PIN-authorized legacy migration endpoint copies and verifies the graph before
clearing the parent, is idempotent for the same target, and can safely finish a
verified interrupted migration. Generated source preserves the narrow public
representation fields across restart. A graph-store defect found during live
testing was also corrected: edge upserts now re-home `flow_id` consistently
with node upserts.

The facility's persistent workspace schema is `0.3` and records the parent
Flow, Subflow, graph Flow, and Router identities. The recording setup uses the
real web panel for project/Flow/Subflow/Router creation and selection, while
the documented deterministic-fixture exception seeds only the UI-created
owned graph through Core's public graph API. Playback uses the real Runtime
Debug UI with **No LLM intervention**, runs the parent Flow, and verifies the
durable Router decision, Subflow boundary, action attempts, and Scenario Lab
result. UI selectors were updated to the current runtime controls.

Live persistent-isolated results:

- `pnpm demo:record`: passed; created recording
  `client.extension-1737c03f-152d-4299-8fde-08201100eeb3.1788661907053`.
- `pnpm demo:run`: passed; created runtime run
  `f977b001-e9c9-4d16-a8e0-adfe5b653a71`.
- Workspace state is reused at
  `test-runs/web-extension-demo`; its private FluxIQ root is
  `test-runs/web-extension-demo/fluxiq-root/.fluxiq`.
- Read-only database verification found zero parent graph rows, exactly six
  nodes and five edges on the owned Subflow graph, one active Subflow with the
  expected ownership triple, and a parent Router whose fallback targets that
  Subflow.
- Evidence capture produced exactly one before and one after screenshot for
  each browser action; no periodic low-FPS capture remains.

Final automated validation:

- Web-extension workspace: `pnpm check`, `pnpm test`, and `pnpm build` passed.
- Test runner: 116/116 tests passed.
- FluxIQ Core package: check and build passed; full suite passed 542/542 tests
  across 88 files.
- The separate Core web-package check still reports pre-existing unrelated
  dirty-worktree TypeScript errors in Automation Studio UI runtime files; they
  are outside this ownership/migration change and do not affect the passing
  Core package or live scripts.

Follow-up live regression (2026-09-05): an exact `npm run demo:record` run
reproduced a timeout after the Subflow hierarchy click because the persistent
panel workspace could retain a stale or inactive view instead of exposing the
Nodes canvas. The runner now performs a bounded canvas wait, then recovers
through the real Nodes tab activation/tab-picker UI; persistent failure reports
only bounded tab and alert labels. After the fix, the exact npm recording
command passed with recording
`client.extension-12020cdc-c441-47de-90d5-31dcbe892ddc.1788663676267`, and
`npm run demo:run` passed without LLM intervention with runtime run
`b314c621-92eb-4460-8026-5fc721b3b630`. The runner check and all 116 runner
tests also passed.
Clean-start regression follow-up (2026-09-05): deleting the persistent run
folder exposed two additional first-run races. The project button could accept
a pre-hydration click without opening its dialog, and Core opened a correctly
identified Subflow Nodes tab before its strict owned graph detail was hydrated,
leaving the view on its loading placeholder. Windows also allowed temporary
session paths long enough to trigger a Turbopack source-map path panic. The
facility now performs one evidenced Create Project retry after a bounded dialog
wait, uses short private Windows session paths, and bounds its gateway bootstrap
probe. Core Subflow navigation now hydrates the exact graph before selecting
and opening its Nodes view.

A never-used `test-runs/web-extension-demo-clean` workspace then passed the
complete `npm run demo:record` path, including identity, project, Flow, Subflow,
Router, graph, pairing, and recording creation. The same newly created workspace
passed `npm run demo:run` without LLM intervention with runtime run
`8e92eae8-f5a6-479d-8088-cd9e83bb972d`. The runner suite remains 116/116, and
the focused Core hydration regression passes.

Final run-path audit (2026-09-05): source tracing confirmed that
`scripts/run-demo-workspace-flow.mjs` delegates only to the panel-driving demo
runner. The runner selects the real project, parent Flow, and Runtime Debug row,
chooses **No LLM intervention**, observes the exact
`POST /api/programs/automation-studio/run-runtime-session` response caused by
clicking the visible Run control, and uses that response's run ID for all
subsequent verification. It never calls `runPersistedFlow`; control-client
requests after the click are read-only verification. This audit exposed a Core
summary persistence defect: routed detail contained Router and Subflow records,
but its durable summary retained zero counts. Core now derives route-decision,
Subflow-entry, and action-attempt counts from the completed detail, and the
facility fails closed if summary and detail disagree. The focused Core routing
regression passed, as did all 116 runner tests.

The post-fix live `npm run demo:run` passed as runtime run
`3e996492-70d3-4d33-b5ff-9de143783637`. Independent read-only database
verification found status `succeeded`, zero errors, six successful actions,
one Router decision, one Subflow entry, and six action attempts. The parent Flow
contained zero nodes and edges; its Router fallback targeted the active owned
Subflow, whose graph contained exactly six nodes and five edges. This proves the
tested browser work executed through the real panel-started parent Flow routing
path rather than through a direct API start or direct parent-graph escape.
