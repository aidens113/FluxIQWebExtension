# Automated testing facility

## Current status

This repository contains a working, finite FluxIQ web testing facility. Its
components are intentionally private, downstream web-automation
infrastructure: deterministic fixture websites, isolated Chromium and Core
topology, an authenticated production-extension path, attested evidence,
changed-capability selection, bounded-agent workflow contracts, and real-site
policy validation.

The browser suite and the four facility target modes must not be conflated:

1. The extension Playwright suite loads the real E2E extension build and tests
   a finite browser-local content-script/action path against a small loopback
   page. It does not start or authenticate to FluxIQ Core.
2. The default `pnpm lab run` target starts the scenario lab and isolated Core, launches the
   production extension code in a clean Chromium profile, pairs it, executes a
   scenario manifest, checks Core recording persistence, and publishes an
   evidence bundle. The verified `basic-form` run also sent Core-issued
   `web.browser.navigate` and `web.dom.type` actions through the production
   client API and gateway and asserted the resulting automation-page state.
3. The explicit `existing` target attaches to a separately managed FluxIQ
   installation and executes one configured persisted Flow. The runner opens
   and seeds the scenario page; the persisted Flow, not the manifest replay
   loop, must then drive the declared browser state. This path is implemented
   and covered by mocked/unit integration tests, but has not yet been reported
    as validated against a live existing installation.
4. The explicit `clone` target authenticates to that existing installation as
   a read-only source, exports and validates one Flow, then starts the ordinary
   isolated topology and imports a deterministically remapped copy through
   Core's public create/save/read APIs. Only the isolated copy is paired,
   executed, recorded, panel-verified, and removed.
5. The explicit `persistent-isolated` target starts and owns local FluxIQ just
   like ordinary isolation, but retains a named workspace's `.fluxiq` data and
   Chromium profile between finite invocations. Ports, processes, the Core web
   copy, and process logs remain unique to each invocation.

The isolated action proof uses Core's production client-action API; isolated
mode does not synthesize or persist a FluxIQ Flow. Existing mode never creates
or rewrites the selected Flow: it executes the exact pre-existing Flow after
checking its project scope and recording a stable content hash.

## Ownership boundary

The testing facility belongs in this repository because it is specific to a
browser extension and the `web-automation` domain.

| Concern | Current owner | Boundary |
| --- | --- | --- |
| Browser manifests, DOM access, extension loading, tabs, service workers, and browser actions | `apps/extension` | Browser implementation; never Core infrastructure. |
| Scenario pages, selectors, fixture state, and web expectations | `apps/scenario-lab` | Web-domain fixtures. |
| Scenario, run, evidence, and evaluation types | `packages/test-contracts` | Private repository-local contracts, not Core API. |
| Run directories, ports, owned child processes, isolated Core startup, existing-Core attachment, and authenticated control client | `packages/test-runner` | Concrete topology spanning this checkout and its Core sibling; an attached installation remains externally owned. |
| Screenshot policy, artifact hashing, redaction, and human-readable reports | `packages/test-evidence` | Private facility implementation; browser bytes enter through adapters. |
| Change-to-scenario selection | `packages/test-matrix` | Repository-path and web-capability knowledge. |
| Bounded task/review/audit contracts | `packages/agent-orchestrator` | Human-triggered facility workflow; it does not invoke agents. |
| Real-site allowlist and operational review checks | `packages/real-site-policy` | Web-specific safety policy; it does not browse or execute probes. |
| Pairing, authorization, durable projects/recordings, generic gateway, runs, attempts, and runtime events | sibling FluxIQ Core | Domain-neutral framework ownership. |

Core never imports this repository. This repository may consume public Core
packages and may start the sibling Core application as an external process.
Browser/DOM/URL/selector/tab/extension concepts remain downstream.

## Implemented topology

The isolated runner allocates a unique directory, three loopback ports, and a
random controller token for every run. It builds the repository's domain host,
starts the scenario lab, creates an isolated copy of Core's web workspace,
starts the Core web process and client gateway, probes readiness, launches the
current E2E extension build, and cleans up supervised processes and the
disposable topology on completion or failure. Existing mode uses the distinct
attachment lifecycle documented below.

```text
pnpm lab run <scenario-id>
  |
  +-- test-runs/.work/<run-id>/        removed after the run
  |     +-- fluxiq-root/.fluxiq/       isolated Core data
  |     +-- core-workspace/apps/web/   disposable Core web copy
  |     +-- browser-profile/           fresh persistent Chromium profile
  |     +-- logs/                      copied before cleanup
  +-- test-runs/<run-id>/              finalized attested evidence bundle
  |
  +-- scenario lab    http://127.0.0.1:<random>
  +-- FluxIQ web      http://127.0.0.1:<random>
  +-- client gateway  ws://127.0.0.1:<random>/client
  +-- isolated identity, disposable project, production pairing and actions
  +-- finalized evidence bundle retained after disposable topology cleanup
```

Core's source packages and installed dependencies are linked into the
run-scoped web copy. This avoids sharing Core data, ports, or a web build
directory between runs. The runner is therefore coupled to a compatible
sibling Core checkout and its installed web dependencies.

### Persistent isolated topology

Persistent isolation separates retained FluxIQ/browser state from disposable
process state. A workspace name is a sanitized identifier, not a path, and the
resolved workspace must remain below the configured runs root. Names use 1–64
lowercase ASCII letters, digits, dots, underscores, or hyphens; they must start
and end with a letter or digit and must not use a Windows device name.

```text
pnpm lab run basic-form --target persistent-isolated --workspace regression-main
  |
  +-- test-runs/persistent-isolated/regression-main/   retained
  |     +-- fluxiq-root/.fluxiq/                       projects, recordings, runs
  |     +-- browser-profile/                           Chromium and extension state
  |     +-- .identity/credentials.json                 owner-protected test identity
  |     +-- .sessions/<run-id>/                        removed after this invocation
  |           +-- core-workspace/apps/web/             disposable Core web copy
  |           +-- logs/                                copied before cleanup
  +-- test-runs/<run-id>/                              finalized evidence bundle
```

Only one invocation may own a named workspace at a time. The runner acquires
the workspace lock before starting Core or Chromium, rejects a concurrent live
owner, and may reclaim only a verifiably stale lock. It releases the lock and
removes the current `.sessions/<run-id>` directory on success, failure,
timeout, or handled interruption. It never deletes the stable workspace as a
cleanup shortcut. Different workspace names remain independent.

Sequential commands using the same name start fresh supervised processes and
allocate new ports, while seeing the same `.fluxiq` database, browser profile,
projects, recordings, trusted-client state, and run history. Sanitized run
metadata and reports contain the target mode and workspace name, never an
absolute workspace path, credentials, cookies, controller tokens, recorded
values, or database contents.

If explicit credentials are not configured, the first Core-requiring run
generates a random administrator password and PIN and atomically stores them in
the workspace's private `.identity/credentials.json`. The exact schema and
size are validated on every reuse; malformed state fails closed. The directory
and file are restricted to the current owner (`0700`/`0600` off Windows and a
verified current-user-only ACL on Windows). Credential values never enter CLI
status output, manifests, process logs, or evidence. Later invocations verify
the retained identity rather than rotating an existing Core credential.

Persistent isolation has no automatic reset/delete command. First ensure no
run owns the workspace, then manually remove the exact directory
`test-runs/persistent-isolated/<workspace>` (or its equivalent below the
configured `FLUXIQ_TEST_RUNS_DIR`) when a clean state is intentionally needed.
That deletion permanently removes the workspace's FluxIQ and browser state;
finalized evidence bundles at `test-runs/<run-id>` are separate and remain.

The CLI is finite and machine-readable. `run` executes one scenario; `matrix`
executes an explicit scenario list or the full registry with bounded repeats;
`auth status` and `auth clear` inspect or remove a scoped session cache;
`inspect` re-hashes a completed bundle and validates its run manifest; and
`compare` validates two bundles and emits a contract-checked candidate
comparison. Commands exit with a nonzero status on a failed run or invalid
input/evidence.

### Authenticated and unauthenticated starts

For a Core-requiring isolated scenario, absent explicit credentials cause the runner to
bootstrap a random run-local administrator and authorization PIN through
Core's public `FluxIQ.create`, setup, and identity-access program APIs. This
state is written only under the run-scoped FluxIQ root. The HTTP control client
then authenticates, creates and selects a disposable `web-automation` project,
approves the production extension's pairing code, and authorizes client
actions. `FLUXIQ_TEST_USERNAME`, `FLUXIQ_TEST_PASSWORD`, optional
`FLUXIQ_TEST_TOTP`, and optional `FLUXIQ_TEST_PIN` may instead provide an
explicit test identity.

The verified Windows run `run-mtnla9cz-a4da1119` paired the extension, retained
one connected/ready Core session, persisted a completed recording, and proved
Core-issued navigate and type actions reached the expected automation page.
Its finalized bundle passed `lab inspect`; Chromium and all three child ports
were closed, and the disposable browser/Core workspace was removed. Exit codes
recorded after supervised termination are lifecycle diagnostics, not a claim
that killed long-running servers exited naturally.

### Existing FluxIQ target

Existing mode is opt-in and fail-closed. Configuration is read from `.env`,
then `.env.local`, then the process environment, with later values taking
precedence. Both local environment files are ignored; `.env.example` contains
placeholders only.

| Field | Existing-target meaning |
| --- | --- |
| `FLUXIQ_TEST_TARGET=existing` | Select the external-installation path. Isolated remains the default. |
| `FLUXIQ_TEST_TARGET=clone` | Treat the configured external installation as a read-only source and execute a remapped copy in disposable isolated Core. |
| `FLUXIQ_TEST_TARGET=persistent-isolated` | Start owned local FluxIQ against a retained named workspace; an explicit `--target` must agree with an environment-selected target. |
| `FLUXIQ_TEST_PERSISTENT_WORKSPACE` | Required safe workspace name for persistent isolation unless supplied by `--workspace`. It is an identifier, never a filesystem path. |
| `FLUXIQ_TEST_BASE_URL` | Required exact HTTP(S) panel/API origin without credentials, non-root path, query, or fragment. |
| `FLUXIQ_TEST_GATEWAY_URL` | Optional absolute client URL; `ws://` is loopback-only and remote gateways require `wss://`. Otherwise use the sanitized gateway snapshot value. |
| `FLUXIQ_TEST_PROJECT_ID` | Required accessible project containing the Flow. |
| `FLUXIQ_TEST_FLOW_ID` | Required persisted Flow; `--flow <id>` may override it for a run. |
| `FLUXIQ_TEST_USERNAME` / `FLUXIQ_TEST_PASSWORD` | Required named test identity. |
| `FLUXIQ_TEST_PIN` | Required for `existing` client-action authorization; not used by read-only `clone` source access. |
| `FLUXIQ_TEST_TOTP` | Optional current TOTP when the identity requires one. |
| `FLUXIQ_TEST_RUNS_DIR` | Optional local run/evidence root; defaults to `test-runs`. |
| `FLUXIQ_DEMO_RUN_DIR` | Optional persistent demo workspace below `FLUXIQ_TEST_RUNS_DIR`; defaults to `test-runs/web-extension-demo`. Both demo scripts reuse it. |
| `FLUXIQ_DEMO_BASE_URL` | Optional loopback origin for the demo-owned panel; defaults to `http://127.0.0.1:3300`. The stable port permits cookie reuse. |
| `FLUXIQ_DEMO_GATEWAY_URL` | Optional loopback URL for the demo-owned gateway; defaults to `ws://127.0.0.1:4877/client`. |
| `FLUXIQ_CORE_ROOT` | Optional FluxIQ Core checkout; defaults to the sibling checkout. |
| `FLUXIQ_DEMO_PROJECT_ID` | Optional existing web-automation project to reuse. Otherwise the recording script reuses a unique matching project or creates one. |
| `FLUXIQ_DEMO_PROJECT_NAME` | Optional persistent project name; defaults to `FluxIQ Web Extension Test`. |
| `FLUXIQ_DEMO_FLOW_ID` | Optional pre-provision lookup ID; after UI creation, `workspace.json` owns the generated persistent Flow ID. |
| `FLUXIQ_DEMO_FLOW_NAME` | Optional stable Flow name; defaults to `Web Extension Demo Flow`. |
| `FLUXIQ_DEMO_HEADLESS` | Optional `true`/`false`; defaults to `true`. Set `false` only for visible browser debugging. |

The runner preflights authenticated project access, an exact uniquely listed
Flow, the complete Flow document, its stable SHA-256 content hash, and an
enabled/listening gateway. It starts the disposable Scenario Lab, launches the
current extension in a fresh profile, opens the seeded scenario page, pairs the
extension, selects the configured project context, and starts recording. It
then starts and runs the persisted Flow in deterministic/dry-LLM mode with
external side effects disabled and supplies the scenario id, origin, URL,
seed, and facility run id as inputs. Success requires a matching successful
durable run, at least one successful durable action attempt, the scenario's
expected browser state, and a persisted recording.

Attachment does not transfer lifecycle ownership. The facility may remove its
own run workspace, browser profile, Scenario Lab process, logs, and staging
data after success, failure, timeout, or interruption. It does not build,
bootstrap, start, stop, reset, mutate configuration for, or delete the external
FluxIQ server or its durable project/Flow/run data.

Authenticated sessions are cached under ignored `test-runs/.auth` (or the
configured runs directory), keyed by exact origin and username. Cache files are
written atomically with restricted permissions, expire, and are reused only
after an authenticated cookie probe succeeds. Windows removes inherited ACLs,
grants only the current account SID, and verifies the result with argv-only
native tools; inability to prove exclusivity fails closed. Other platforms use
`chmod` modes `0700`/`0600`. A 401/403 causes one fresh login and retry.
`--fresh-login` bypasses reuse. These non-secret commands require
only `FLUXIQ_TEST_TARGET`, `FLUXIQ_TEST_BASE_URL`, and
`FLUXIQ_TEST_USERNAME`:

```powershell
pnpm lab auth status
pnpm lab auth clear
pnpm lab run basic-form --target existing --flow <flow-id> --fresh-login
```

Status and clear output includes scope/state/timestamps but never the cookie.
Passwords, PINs, TOTPs, and session cookies are not included in run results or
manifest metadata.

### Persistent-isolated target

Use the CLI flag for an explicit command:

```powershell
pnpm lab run basic-form --target persistent-isolated --workspace regression-main
pnpm lab run basic-form --target persistent-isolated --workspace regression-main
```

Both invocations retain the same local FluxIQ and browser state, but publish
independent evidence bundles and run with separate session directories and
ports. Environment configuration is equivalent:

```dotenv
FLUXIQ_TEST_TARGET=persistent-isolated
FLUXIQ_TEST_PERSISTENT_WORKSPACE=regression-main
```

Do not configure an external panel URL, project, or Flow for this mode. Those
settings belong to `existing` and `clone`; persistent isolation bootstraps and
owns its local Core instance. Unlike `existing`, it may safely manage that
instance's process lifecycle. Unlike disposable `isolated` and `clone`, it
retains local state. Unlike `demo:record`/`demo:run`, it uses the ordinary
scenario runner and produces a new attested evidence bundle per invocation.

### Reusable self-recording demo workspace

Two explicit smoke scripts exercise the complete author-and-run loop against a
self-managed persistent isolated FluxIQ installation:

```powershell
pnpm demo:record
pnpm demo:run
```

`pnpm demo:setup-local` creates or rotates one dedicated local test identity
inside `FLUXIQ_DEMO_RUN_DIR/fluxiq-root/.fluxiq` and writes the ignored
`.env.local` with the loopback panel/gateway and persistent workspace
configuration. Generated
credentials are never printed, and the command refuses to overwrite an
existing file unless passed `--force`.

`demo:record` authenticates through the normal reusable session cache, creates
or reuses one project bound to `web-automation`, and creates the configured
orchestration Flow only when it is absent. It starts the loopback `basic-form`
fixture, loads the current unpacked extension in persistent Chromium, pairs it
with FluxIQ, starts extension recording, performs the form interaction, stops
recording, and requires one new durable Core recording. It then opens that
recording in the real Automation Studio timeline and uses **Generate Subflow**
to create or replace the Router fallback Subflow deterministically from the
recorded actions. Replacement is allowed only for an empty or entirely unedited
recording-derived graph.

`demo:run` requires that saved workspace, reconnects the same extension profile,
opens the saved Flow and Runtime Debug through the real hierarchy UI, selects
**No LLM intervention**, clicks **Run**, and requires every generated action,
the Router decision, the Subflow entry, and the submitted form result to
succeed. Both commands open the real Subflow Nodes view and compare every
rendered node rectangle before continuing. Core lays generated actions out at a
non-overlapping interval and reconciles both the canonical graph document and
its SQL viewport index when a generated graph is replaced.

Both commands lock and reuse the exact `FLUXIQ_DEMO_RUN_DIR`. Each invocation
starts and stops its own copied Core web process while retaining
`fluxiq-root/.fluxiq`; temporary Core copies live under `.sessions` and are
removed after shutdown. The directory also contains `workspace.json`, a protected
`scenario-port.json` that keeps recording URLs replayable across invocations, separate
persistent extension and panel browser profiles, a workspace-local copy of the
latest built extension, append-only process/Scenario Lab logs, finalized
evidence bundles, and `latest-evidence.json`.
Each test-issued UI/browser action produces exactly two physical screenshots:
one immediately before and one immediately after. Flow actions use an
extension-to-runner acknowledgement boundary, so execution cannot proceed
until the before frame is durable; the after frame is captured before the
action result returns to FluxIQ. Timed/FPS sampling and screenshot
deduplication are disabled for these scripts. `workspace.json`
contains only origin, username, durable IDs, names, and timestamps; credentials
remain in ignored environment files and the authentication cookie remains in
the facility's protected auth cache. The workspace must resolve below
`FLUXIQ_TEST_RUNS_DIR`, and owner-only Windows ACL enforcement is applied
before Chromium can store its profile. Concurrent commands fail closed on the
workspace lock. Unlike normal finite lab runs, these commands deliberately do
not allocate a new evidence/run directory or delete the FluxIQ project, Flow,
recording, and runtime history.

This is a mutating but isolated workflow. The generated demo fixture is
reconciled through Core's public Flow and graph-patch APIs so the canonical Flow
and the panel viewport index remain consistent. Set `FLUXIQ_DEMO_PROJECT_ID`
when an exact project in this isolated workspace should be used; otherwise the
script reuses one unique matching project name or creates it. A missing saved
workspace causes `demo:run` to fail with an
instruction to run `demo:record` first.

The scripts use Chromium headlessly by default. Set
`FLUXIQ_DEMO_HEADLESS=false` for visible debugging. The stable copied-extension
path preserves its browser identity and local session state while being
replaced from `apps/extension/dist/chrome` on every invocation, ensuring the
fresh build is the one loaded by the persistent profile.

Clone packages are cached across independent runs under the ignored
`test-runs/.clone-cache` directory. Each entry is scoped to the exact source
origin, username, project, and Flow. A lightweight Flow-summary revision and
policy fingerprint allow reuse without downloading the full unchanged Flow;
revision changes, expiry, scope mismatch, bad hashes, or schema failures force
quarantine and re-export. Entries are atomically written with the same
owner-only ACL enforcement as authentication state and are bounded by age,
entry size, and count. The cache contains the sanitized clone package, never
credentials, cookies, authorization headers, recordings, runtime history, or
published/scheduled state.

```powershell
pnpm lab clone-cache status
pnpm lab clone-cache refresh
pnpm lab clone-cache clear
pnpm lab run basic-form --target clone --flow <source-flow-id> --evidence events
```

Clone execution rejects unsupported dependencies before destination startup.
The destination gets new project, Flow, node, and edge identifiers; after
`save-flow`, the runner reads the document back and permits differences only
for the declared mappings, destination timestamps/origin, and named test
doubles. It then pairs the current extension with the isolated gateway,
executes the cloned Flow, asserts durable actions and browser state, confirms a
new recording, and re-reads the source to prove its content hash is unchanged.

After runtime verification, the same Playwright browser context receives one
exact-origin `fluxiq_session` cookie and opens
`/programs/automation-studio?project=...&flow=...&view=runtime-debug`. The
panel check requires the Automation Studio shell, selected project hierarchy,
and selected Flow item. For run detail it first checks a rendered action log,
then attempts the current run-search/run-row selection. The `detail=run:...`
query alone is not authoritative: if the exact run cannot be selected and
rendered, the outcome is explicitly `limited`, never falsely `verified`; the
finite existing-target run treats that limited result as a failed verification.

#### Compatibility limits of the currently audited Core revision

- `GET /api/auth/session` is absent. The runner falls back to proving that the
  cookie can access the gateway snapshot and project list; that proves an
  authenticated usable session, not that it belongs to the configured
  username. `sessionIdentityVerified` is therefore false on that revision.
- The `cancel-runtime-session` program service exists conceptually, but its
  HTTP program handler is not registered. The adapter fails closed if called;
  aborting the synchronous request does not prove server-side cancellation.
- Durable/public run-action attempt DTOs expose no sanitized
  `runtimeCommandId`/correlation field, so evidence cannot prove exact
  command-to-attempt correlation through that read API.
- Core exposes no minimal versioned capability-discovery endpoint. The runner
  validates the audited program response shapes at runtime and fails on absent
  or malformed contracts, but cannot negotiate a declared API version.

These are compatibility facts, not live existing-installation results. A real
existing target remains unverified until the primary validation run reports
the target, compatible Core revision, Flow behavior, and retained evidence.

## Scenario lab and contract

The lab binds only to `127.0.0.1`, rejects foreign `Host` headers, applies a
same-origin content security policy, and keeps state in memory per server
process. A random run token protects health, seed, reset, final-state, and
mutation endpoints. Reset and reseed deterministically reconstruct all fixture
state.

Each registered fixture exposes a versioned `WebScenario` manifest from
`@fluxiq-web-extension/test-contracts`. Fixture construction validates the
manifest immediately and fails if its id, title, canonical seed, or start path
disagrees with the render/state definition. The registry exposes
`getScenarioManifest(id)` and `listScenarioManifests()`.

A manifest contains:

- schema version, id, title, tags, canonical seed, and start path;
- declared web capabilities and a forced `loopback-only` network policy;
- a nonempty semantic recording script using click, type, select, scroll,
  navigate, wait-for-state, and checkpoint operations;
- expected page/final facts, recording events, and runtime actions as relevant;
  and
- screenshot, trace, video, sampling, and review policy.

The ten deterministic fixtures are:

| Fixture | Primary behavior |
| --- | --- |
| `basic-form` | Text entry, selection, submission, and result state. |
| `dynamic-list` | Mutation, stable seeded identities, add/remove, and reorder. |
| `navigation` | Full navigation, history state, reload, redirect, and back-compatible routes. |
| `long-document` | Below-fold targeting, scrolling, and sticky content. |
| `iframe-checkout` | Same-origin and distinct loopback-origin frames. |
| `ambiguous-targets` | Repeated roles/labels with stable target identities. |
| `delayed-ui` | Delayed mutation, waiting, retry, and late targets. |
| `failure-surfaces` | Disabled, detached, blocked-URL, and page-closure surfaces. |
| `reconnect` | Disconnect, queued-event, reconnect, and replay fixture state. |
| `sensitive-input` | Synthetic password/payment-like inputs whose server state discards values. |

Direct Node tests cover manifest validation, loopback-only policy, uniqueness,
fail-fast mismatch handling, HTTP rendering/control behavior, deterministic
reset/reseed, parallel server isolation, and sensitive-state discard. These are
fixture tests, not extension-to-Core E2E tests.

## Extension E2E build and finite browser suite

The normal extension build produces Chrome, Firefox, and E2E Chromium targets:

```text
apps/extension/dist/chrome/
apps/extension/dist/firefox/
apps/extension/dist/e2e-chromium/
```

The E2E manifest is Manifest V3 and restricts host permissions and content
script matches to `http://127.0.0.1/*` and `http://localhost/*`. It is a
separate artifact named `FluxIQ Web Automation Client (E2E)`.

Playwright 1.51.1 launches its bundled Chromium with a fresh persistent
profile, loads only the current unpacked E2E artifact, discovers the extension
id from the MV3 service-worker URL, and opens the side-panel page directly.
Locale, timezone, viewport, and color scheme are fixed. The fixture hashes the
complete extension artifact, attaches its metadata, closes Chromium, deletes
the temporary profile, and verifies deletion.

The implemented specs verify:

- manifest/service-worker startup, artifact hash, version/name agreement, and
  the side-panel heading;
- content-script injection into a small loopback page;
- `web.dom.type` and `web.dom.click` through the real extension-page to
  content-script message path;
- forced MV3 service-worker restart followed by a production status message;
  and
- storage isolation and cleanup across two fresh profiles.

The standalone specs do not use the ten-scenario registry or the FluxIQ
gateway. The verified isolated facility runner proves pairing, recording
persistence, and production client-action dispatch for `basic-form`; those two
verified lanes do not prove persisted Flow execution. The separate existing
target implements persisted-Flow execution but still awaits a live validation
run. The facility also does not yet prove full reconnect/replay, cross-frame
action behavior, Firefox behavior, or installed Chrome/Edge behavior. The
verified Windows E2E and isolated facility runs used bundled
`Chrome/134.0.6998.35`. Chromium is launched headed, so CI requires a
display-capable runner or suitable virtual display.

The finite facility runner installs a context-wide request and WebSocket guard
before it opens the extension control or scenario pages. It allows only
`chrome-extension:`, `data:`, `about:`, and `blob:` resources, the exact
`127.0.0.1` and `localhost` Scenario Lab origins for the selected port, the
exact FluxIQ HTTP(S) origin, and the configured gateway WS(S) origin. Other
destinations are blocked, recorded without query strings or credentials, and
make the run fail. Because the guard is attached to `BrowserContext`, it also
applies to pages subsequently created by extension actions.

## Evidence security and integrity

`packages/test-evidence` is browser-neutral and has no browser/media-composition
dependency; it consumes the repository-local canonical contracts package.
Callers supply screenshot, trace, or video bytes through adapters.

`EvidenceBundle` writes to `.staging-<run-id>` and publishes `<run-id>` by a
single directory rename. Structured and textual evidence is recursively
redacted before its first durable write. Denylisted credential/token fields,
configured secret literals, bearer patterns, circular data, and unverified
visual/binary artifacts fail closed.

The capture controller records every trigger and applies screenshot policy,
minimum intervals, frame/byte quotas, SHA-256 frame deduplication, and an
exception that permits an error trigger to attempt capture despite the normal
interval. Suppressed and duplicate frames remain represented in the event
stream.

Completed output can include:

```text
events.ndjson
summary.json
report.html
screenshots/
review/timeline.json
review/contact-sheet.html
artifact-index.json
bundle.complete.json
```

An existing-target bundle additionally contains pre-write-redacted snapshots
at `snapshots/existing-flow.json`, `snapshots/runtime-run.json`,
`snapshots/runtime-actions.json`, and `snapshots/runtime-events.json`. Its
validated `run.json` carries an optional `fluxiqExecution` block with
`targetMode`, exact origin, project/Flow ids, Flow content hash, runtime run id,
optional runtime id, `sessionIdentityVerified`, and the `verified` or `limited`
panel outcome. The schema rejects unknown nested fields so credentials,
cookies, PINs, and raw gateway payloads cannot be added. Older bundles without
the optional block remain valid.

`artifact-index.json` records the media type, byte count, redaction state, and
SHA-256 digest of every payload artifact. `bundle.complete.json` hashes that
index and acts as the completion marker. The two integrity metadata files are
not self-indexed because a file cannot contain its own stable digest. The HTML
report identifies the first failing step and links event frames; the current
contact sheet is HTML plus JSON, not composed WebP.

The finite runner uses this package directly. The verified `basic-form` run
published 17 canonical events, five unique screenshots (plus five duplicate
references), 15 indexed payload artifacts, a completion marker containing the
index digest, and a validated run manifest. `pnpm lab inspect` independently
recomputed those hashes and accepted the bundle.

## Matrix selection and CI

`packages/test-matrix` maps changed repository paths to capability tags,
scenario ids, and required gates. Known changes select focused scenarios;
extension build, facility, dependency-topology, and unknown changes fail safe
to the full corpus. Documentation-only changes select the static gate.

`.github/workflows/testing-facility.yml` declares:

- prerequisite validation for a pinned sibling Core repository/ref and token;
- Windows and Linux static `check`, `test`, and `build` jobs;
- Windows and Linux Chromium smoke jobs when selected;
- changed-scenario execution for pull requests; and
- a nightly three-repeat full corpus with 90-day uploaded evidence.

The workflow forces `FLUXIQ_REAL_SITE_ENABLED=0` and uses 30-day browser/failure
artifact retention outside nightly certification.

The `run`, `matrix`, `inspect`, and `compare` command paths are implemented and
locally tested. The Windows headed configuration has been exercised locally.
Linux installs Playwright dependencies and invokes the runner under Xvfb in
the workflow, but those Linux commands have not been executed in this local
Windows validation and must remain an explicit CI verification item. The
nightly three-repeat baseline likewise awaits an actual scheduled run.

## Bounded agent workflow

`packages/agent-orchestrator` provides vendor-neutral, human-triggered workflow
primitives. It does not dispatch an agent, create or mutate a worktree, execute
a command, merge, publish, or deploy.

Its task packet records the human approval reference, role, objective, one
repository, exact allowed roots, scenario/seed/argv, baseline artifact hash,
protected and failing invariants, budgets, prohibited actions, required checks,
and a structured JSON response contract. Policies distinguish coordinator,
scenario author, read-only diagnosis, Core repair, extension repair, and
reviewer roles.

Review primitives enforce repository/path and changed-byte/file limits,
reported budget use, required checks, independently observed versus
agent-reported edits, invariant definition equality, candidate evaluation,
safety status, evidence completeness, and comparison verdict. A passing gate
returns `approve-for-human-review`, never permission to merge. Workflow events
can be appended to a serialized SHA-256 hash-chained NDJSON audit log, which
detects later mutation.

Edit authorization is checked against a trusted observed-diff input. The pure
worktree planner requires absolute repository, main-workspace, disposable-base,
and candidate roots; rejects overlap with the repository/main workspace; and
requires affirmative symlink-resolution and reparse-point-absence attestations.
It emits argv-only Git create/inspect/remove command plans but executes none of
them. The audit writer serializes one writer instance; it is not a
multi-process locking service. Phase 6 still has no automatic agent invocation,
worktree mutation, merge, publish, or deployment path.

## Core promotion decision

No testing-facility code has been promoted to FluxIQ Core. Promotion remains
deferred because a second real domain consumer has not demonstrated a shared
need.

A candidate may move only if it remains coherent after removing every browser,
DOM, URL, selector, tab, extension, Playwright, agent-vendor, and
`web-automation` concept, and at least two real domain consumers need it. A
promotion must then add an intentional public Core export, independent Core
tests and documentation, compatibility analysis, and migration of this
repository to the public seam. Core must never depend on this repository or
its scenarios.

## Real-site policy and execution deferral

`packages/real-site-policy` validates a policy document for an exact HTTPS
origin/path allowlist, `GET`/`HEAD`/`OPTIONS`, mandatory destructive-action
denials, read-only safe actions, bounded rates/concurrency/duration, private
redacted artifacts with at most seven-day retention, external secret
references, and current robots/terms/authorization review.

This is a policy decision tool only. It does not make requests, open a browser,
load credentials, or run a real-site probe. No real-site target has been
selected or authorized, no real-site executor is connected, and deterministic
CI explicitly disables the lane. Real-site execution is therefore deferred
until separate operational authorization and an execution adapter exist.

## Commands and prerequisites

Install from the repository root with Node 22 and the pinned pnpm 9.15.0:

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

The sibling Core checkout defaults to `F:\!FluxIQ` on the current Windows
layout. Both repositories must have compatible installed dependencies. Override
the roots when needed, then run one of the finite commands:

```powershell
$env:FLUXIQ_WEB_EXTENSION_ROOT = "F:\!FluxIQWebExtension"
$env:FLUXIQ_CORE_ROOT = "F:\!FluxIQ"
pnpm lab run basic-form --seed 1 --evidence events
pnpm lab matrix --all --repeat 1 --evidence failure
pnpm lab inspect <run-id>
pnpm lab compare <baseline-run-id> <candidate-run-id>
```

Core-requiring isolated scenarios create a random test identity through the
public Core API by default. To attach to an existing installation and execute
an already-persisted Flow, copy the placeholders from `.env.example` into the
ignored `.env.local`, set `FLUXIQ_TEST_TARGET=existing`, and supply all required
existing-target fields listed above. A direct process-environment example is:

```powershell
$env:FLUXIQ_TEST_USERNAME = "<test-user>"
$env:FLUXIQ_TEST_PASSWORD = "<secret>"
$env:FLUXIQ_TEST_PIN = "<authorization-pin>"
$env:FLUXIQ_TEST_TOTP = "<optional-current-code>"
$env:FLUXIQ_TEST_BASE_URL = "https://fluxiq.example.invalid"
$env:FLUXIQ_TEST_PROJECT_ID = "<existing-project-id>"
$env:FLUXIQ_TEST_FLOW_ID = "<existing-flow-id>"
$env:FLUXIQ_TEST_TARGET = "existing"
pnpm lab run basic-form --target existing --evidence checkpoints
```

Do not put those values in command output, manifests, reports, or committed
configuration. Runs are finite; the same supervisor cleanup path handles
normal completion, assertion failure, timeout, and interruption.

Root-level safety/control entry points build their owning package before
execution and produce machine-readable results:

```powershell
pnpm boundary:audit
pnpm agent:orchestrator worktree plan <worktree-request.json>
pnpm agent:orchestrator result validate <packet.json> <response.json> <observed-edits.json>
pnpm real-site:policy <policy.json>
```

The worktree command only validates roots/attestations and returns argv; the
result command validates against trusted observed edits; the boundary audit
currently returns the Core-promotion defer decision; and the real-site command
does not execute a probe.

Run the deterministic fixture tests:

```powershell
pnpm --filter @fluxiq-web-extension/scenario-lab test
```

Run the finite local extension suite after installing Playwright's Chromium:

```powershell
pnpm --filter @fluxiq-web-extension/extension exec playwright install chromium
pnpm --filter @fluxiq-web-extension/extension test:e2e
```

`FLUXIQ_E2E_EXTENSION_PATH` may point the fixture at another unpacked E2E
artifact. Using it changes what is tested; the fixture records and hashes the
selected path. A headed browser/display environment is required.

Run individual facility package checks with:

```powershell
pnpm --dir packages/test-contracts test
pnpm --dir packages/test-runner test
pnpm --dir packages/test-evidence test
pnpm --dir packages/test-matrix test
pnpm --dir packages/agent-orchestrator test
pnpm --dir packages/real-site-policy test
```

For GitHub Actions, configure repository variable `FLUXIQ_CORE_REPOSITORY`, a
specific compatible `FLUXIQ_CORE_REF`, and secret `FLUXIQ_CORE_TOKEN`. The
matrix CLI is implemented; the remaining environment verification is an
actual Linux/Xvfb execution and scheduled three-repeat run.

## Generated and ignored data

Do not commit or hand-edit generated runtime data:

| Path | Status and purpose |
| --- | --- |
| `.fluxiq/` | Ignored local Core configuration, databases, recordings, and project state. |
| `test-runs/` | Ignored finalized evidence bundles plus disposable `.work/` Core copies/data, browser profiles, and logs. |
| `.browser-profiles/` | Ignored disposable browser profiles. |
| `playwright-report/`, `test-results/`, `.playwright/` | Ignored Playwright output and local browser data. |
| `apps/extension/dist/` | Ignored loadable Chrome, Firefox, and E2E Chromium builds. Regenerate with the extension build. |
| `apps/extension/build/` | Tracked intermediate extension bundles. Regenerate; do not hand-edit. |
| `domain/.test-build/` | Tracked generated domain-test artifacts. Regenerate through domain test/build workflows. |

Run artifacts may contain page evidence even when synthetic. Keep all captures,
profiles, credentials, cookies, authorization headers, pairing tokens, and
recorded page data out of source control and user-facing logs.
