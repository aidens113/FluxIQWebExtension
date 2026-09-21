# Automated testing facility

## Interactive development sessions

Use `pnpm lab:interactive <scenario> --target persistent-isolated --workspace <name>` when developing or debugging a small UI change. The command builds prerequisites once, starts one headed browser and one isolated topology, reuses the named FluxIQ state/browser profile, loads both the scenario and authenticated panel surfaces, and then accepts newline-delimited JSON commands on standard input until `{"action":"stop"}`. After the first build, the faster relaunch is `node packages/test-runner/dist/cli.js interactive <scenario> --target persistent-isolated --workspace <name>`.

Each command chooses `"surface":"scenario"`, `"surface":"panel"`, or `"surface":"extension"`. The allowlisted actions are `navigate`, `click`, `fill`, `select`, `check`, `wait`, `inspect`, and `screenshot`. Examples:

```json
{"id":"one","action":"inspect","surface":"panel"}
{"id":"two","action":"click","surface":"scenario","selector":"[data-testid=submit]"}
{"id":"three","action":"wait","surface":"scenario","selector":"[data-testid=success]","state":"visible"}
{"id":"four","action":"screenshot","surface":"scenario"}
{"id":"five","action":"fill","surface":"panel","selector":"input[type=password]","secretEnv":"FLUXIQ_TEST_PIN"}
{"action":"stop"}
```

The session accepts no JavaScript/evaluate command, limits requests, selectors, waits, and action count, and applies the deterministic exact-origin network guard. Navigation cannot leave the selected scenario, panel, or extension origin. Literal entry into password, PIN, one-time-code, payment, or explicitly sensitive controls is denied. A protected field can instead use `secretEnv`, restricted to `FLUXIQ_TEST_PASSWORD`, `FLUXIQ_TEST_PIN`, `FLUXIQ_TEST_TOTP`, or `DEEPSEEK_API_KEY`; the environment value is resolved in process memory, may only target a sensitive control, and is never returned. Screenshots are written only beneath the run allocation and are denied whenever a sensitive control contains a value. `inspect` returns bounded structural metadata without page text or input values. Provider credentials are removed from the browser environment. The command itself makes no provider request; a request can occur only through an explicit UI action in the loaded product.

## Instruction-driven web exploration seam

`packages/test-runner/src/web-flow-exploration.ts` provides the web-specific
orchestration boundary for instruction-to-Flow authoring. It captures the
initial page through the production extension action bridge, asks an injected
Core harness gateway to select a bounded subset of the observed same-origin
links, visits those allowlisted HTTP(S) pages, and converts their extension DOM
snapshots into an in-memory `web-flow-exploration.v1` evidence bundle. The bundle includes
bounded element identity, accessible text, and same-origin links, while
discarding input values, sensitive controls, selected text, credentials, URL
queries/fragments, and unrestricted element attributes. Page evidence is
explicitly marked untrusted and must not be written to Lab artifacts or logs.

Production composition uses the same ownership boundary. The web domain binds
`domain/src/runtime/llm-evidence/` through `registerWebAutomationRuntime`,
which is called by the web-panel host. Its authoring-time surface exposes
`web.inspect_current_page`, `web.navigate_same_origin`, and `web.press_control`
to Core's domain-neutral evidence loop. These tools use the
existing Automation Studio client-gateway action bridge; they
require exactly one ready, trusted, idle-recorder web extension and fail closed
on ambiguity. This prevents evidence actions from entering recording storage.
Navigation first inspects the current page, rejects credentials/non-HTTP(S)
URLs, origin changes, and a destination whose sanitized location is already
current, then captures the destination again. A same-location request returns
the recoverable `no_progress` result without applying an effect. Interaction
handles remain bound to the selector in the latest evidence returned for that
session, project, and Flow. A fresh snapshot must still contain that selector
uniquely at the same location before execution; fresh ordinal ranking cannot
silently rebind the handle to a different element. Press presses the control
the handle names and refuses nothing on FluxIQ's own judgement of what the
control looks like: the user's instruction is the authority. Until 2026-09-18
it accepted only semantic disclosures and view controls and refused any
control whose label -- or selector -- carried a committing word, which left a
plain "New post" button and every row control of an order-management site
unpressable. A press, or a Flow step, whose consequence lasts is asked of
Core's permission check first (`domain/src/runtime/llm-evidence/permission.ts`).
The model declares what its own action does in Core's classes -- `move_money`,
`delete`, `send_or_publish`, `modify_existing`, `create_new` -- on the press's
`consequences` input or on the step's target handle, and Core answers from the
person's grant and from what his instruction asks for. A refusal ends the build
with Core's permission request for the person; FluxIQ judges no control by how
it looks. A checkbox press is pressed back once the page has been read,
so exploration leaves the page as it found it. Form filling and option selection
are deliberately absent from the authoring tool catalog. Parsed evidence
already contains the control metadata and bounded options needed to propose
those Flow nodes, while executing them would perform the workflow being
authored instead of discovering structure. Those operations remain available
as ordinary `web.dom.type` and `web.dom.select` actions in Testing Lab/manual
runtime control and as generated Flow outputs. Every authoring interaction
recaptures evidence and rejects an origin change. A press whose post-click
parsed evidence is unchanged returns recoverable `no_progress` with
`effectApplied: false`. Expected model-correctable policy/input rejections return only a
`web-llm-tool-result.v1` object with `ok: false` and an allowlisted code, so
Core can give the model another bounded decision turn without echoing the
rejected selector, URL, or value. Disconnects, ambiguous clients,
cancellation, malformed snapshots, and failed gateway/browser actions remain
fatal. Tool declarations mark inspection as an observation with
`repeatPolicy: "after_mutation"`; navigation and reveal are mutations.
Core rejects repeated inspection until a successful state-changing tool
creates new evidence to observe. Select evidence includes at most 20 bounded
option label/value pairs so generation does not guess an option value. Every
execution returns Core's explicit `llm_evidence_tool_execution` outcome:
inspection and recoverable rejection set `effectApplied: false`, while a
mutation sets it to `true` only after its browser action succeeds and evidence
is recaptured. Outcomes also carry a bounded content-free `resultCode`, which
Core may retain with the tool ID and effect flag for Testing Lab diagnosis.
Interactive evidence assigns opaque handles (`target.1`, `target.2`, and so
on); model-selected actions copy a handle rather than reconstructing CSS. The
runtime resolves the handle to its last-returned selector and revalidates that
selector against fresh sanitized evidence before sending it to the browser.
Reveal guidance limits choices to observed controls that expose otherwise
unavailable structure required to author the instruction. The
`web-llm-evidence.v1` response is capped by Core's per-call allowance and a
12 KB downstream hard ceiling (6 KB when Core provides no allowance), with at
most 40 elements. It excludes
input values, sensitive controls, selected text, unrestricted attributes, and
URL queries/fragments. Ordinary non-sensitive input and textarea controls may
expose only a `hasValue` boolean so later evidence can distinguish empty from
completed fields without revealing entered text. A non-sensitive select may
expose its current `selectedValue` only when that value exactly matches one of
the same descriptor's already-sanitized bounded options.

Neither production nor Testing Lab web code resolves a provider or invokes a
model itself. Generic provider selection, secret access, budgets, grants,
prompt/tool iteration, strict output parsing, and proposal persistence remain
in Core's global Automation Studio LLM harness. The only accepted terminal
result is an inert `proposed` Flow Bootstrap Adaptation; review, apply, and
zero-LLM replay remain separate required operations.

Testing Lab's live exploration launcher accepts a bounded repository-local
scenario plus simple instruction without adding a scenario-specific runner.
Set `FLUXIQ_LLM_SCENARIO_ID` to a registered lowercase Scenario Lab ID and
`FLUXIQ_LLM_INSTRUCTION` to 1–4,000 safe text characters, then run
`pnpm demo:llm:explore`. If omitted, both values retain the certified
`instruction-only-form` defaults. The scenario ID is checked against the built
Scenario Lab registry before Core or a browser starts, and its authoritative
manifest `startPath` is used. This supports registered multi-route fixtures such
as navigation without accepting a caller-supplied path or URL; the destination
remains under the scenario server's exact loopback origin. The supplied
instruction is passed to Core's global evidence-guided
Flow Bootstrap harness; provider configuration, strict output parsing, and
proposal persistence are not reimplemented downstream. The run still requires
an idle recorder, proves the recording set unchanged, and stops at manual
review with the existing explicit DeepSeek budget.

Use `pnpm demo:llm:explore:request` first for a provider-free readiness check.
It validates the scenario and instruction, reports the exact scenario path,
instruction character/byte counts and digest, safety/review requirements, and
the effective provider budget with `providerCallCount: 0`. It never echoes the
instruction or any credential. This command does not start Core, browsers, or
the provider.

After `pnpm demo:llm:explore` creates its proposal, Testing Lab writes an
ignored private `llm-exploration-request-binding.json` continuation record in
the demo workspace. It contains only the registered scenario ID/start path, instruction
digest, and exact project/Flow/Adaptation IDs—never instruction content or
credentials. `pnpm demo:llm:explore:request:apply` reviews and applies only that
exact pending Bootstrap Adaptation; it does not select whichever proposal is
newest. `pnpm demo:llm:explore:request:run` then opens the same registered
scenario, connects the extension to the bound Flow, and performs one ordinary
panel run. It requires terminal success, zero provider calls and LLM
interventions, an unchanged recording set, and routing through the applied
owned Subflow graph. When the scenario manifest declares final-state facts, the
run evaluates them through the shared Scenario Lab oracle. The original
`demo:llm:explore:apply` and instruction-only baseline/adaptation commands keep
their existing checkpoint semantics. Apply and run reload the current manifest
and reject the continuation if its registered start path has changed.

The inspect tool targets the extension's current active tab. A Testing Lab
driver brings its scenario page to the front immediately before it sends the
generation request through the authenticated API. For ordinary browser-tab use, the panel
must provide an explicit target-tab handoff before evidence-guided generation;
same-origin navigation deliberately cannot recover from choosing the panel tab
as the initial target.

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
   Chromium profile between finite invocations. Processes, the FluxIQ web and
   gateway ports, the Core web copy, and process logs remain unique to each
   invocation; the Scenario Lab port is kept, so a Flow saved in the workspace
   can be [replayed later](#replaying-a-saved-flow).

On the `isolated` and `persistent-isolated` targets a run takes one of two
lanes. The recording lane, the default, drives the manifest's recording script
while the extension records, and proves Core's production client-action API
with a short Core action probe. The Flow lane, `lab run --flow`, goes on to
build a persisted Flow from that run's own recording through Core's public
proposal API, and runs it. Both are described in
[Recording lane and Flow lane](#recording-lane-and-flow-lane). Existing mode
never creates or rewrites the selected Flow: it executes the exact pre-existing
Flow after checking its project scope and recording a stable content hash.

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
prepares or reuses the production build of Core's web panel, starts the
scenario lab, starts the Core web process from that build and the client
gateway, probes readiness, launches the current E2E extension build, and cleans
up supervised processes and the disposable topology on completion or failure.
Existing mode uses the distinct attachment lifecycle documented below.

```text
pnpm lab run <scenario-id>
  |
  +-- test-runs/.work/<run-id>/        removed after the run
  |     +-- fluxiq-root/.fluxiq/       isolated Core data
  |     +-- browser-profile/           fresh persistent Chromium profile
  |     +-- logs/                      copied before cleanup, also when startup fails
  +-- <core>/.tmp/core-web-build/<key>/  production build shared by every run of that Core
  +-- test-runs/<run-id>/              finalized attested evidence bundle
  |
  +-- scenario lab    http://127.0.0.1:<random>
  +-- FluxIQ web      http://127.0.0.1:<random>   (next start)
  +-- client gateway  ws://127.0.0.1:<random>/client
  +-- isolated identity, disposable project, production pairing and actions
  +-- finalized evidence bundle retained after disposable topology cleanup
```

A run shares no Core data, ports, or logs with another run. It does share the
read-only production build of Core's web panel. The runner is therefore coupled
to a compatible sibling Core checkout with built packages and installed web
dependencies.

### Core web panel production build

Core's web panel runs as a production server,
`next start --hostname 127.0.0.1 --port <port>`, never as a development server.
Core accepts performance measurements only from a production host. A
development server also compiles each route on its first request and makes
requests wait on its file watcher; under shared load that stalled Core
readiness and the first authenticated request of isolated runs.

Every run of one Core shares one build cache, `<core>/.tmp/core-web-build/<key>/`,
whichever worktree or runs directory the run starts from. It used to sit below
each run's runs directory, which made it one cache and one lock per worktree:
task worktrees that share a detached Core each built the web panel at once.
Beside the Core, the existing create-only lock makes exactly one of them build
and the rest wait for its publication. `FLUXIQ_CORE_WEB_BUILD_CACHE` points it
somewhere else.

The location has to satisfy four things at once. It must not run through any
`node_modules` directory: Turbopack treats such a project as third-party code
and its build worker aborts within seconds with exit 3221225501 (0xC000001D),
which was measured by building the same Core with only the cache root changed,
and which a campaign then reported four times as this machine's memory fault. A
cache root inside `node_modules` is refused before anything is staged. It must
be shared by every worktree that links that Core, fit the path budget below, and
be ignored by Core's git, because `pnpm task sync-core` refuses a Core with
untracked files; Core's `.gitignore` already ignores `.tmp/`, and nothing in
Core scans it.

On Windows the cache root must also leave room for the deepest file Next writes
below it, 178 characters measured on a real build, inside the 259-character path
limit; a root longer than 80 characters is refused before anything is staged,
with a message naming both numbers. Below a worktree's `test-runs`, a task slug
three characters longer than its neighbour's was enough to fail every build as
a Turbopack internal error; beside the Core, the slug is not in the path. The key is a
SHA-256 over Core's `HEAD`; the content of the `apps/web` files the build copies
and of Core's `tsconfig.base.json`; the content of `packages/fluxiq/dist`,
`packages/contracts/dist`, and `packages/client-gateway-websocket/dist`; the
generated `next.config.mjs`; and the installed Next version. Changing any of
them makes the next run build again. The web panel host module and every
`FLUXIQ_*` value are read at runtime, so they are not part of the key.

A build runs in its own attempt directory, `<key>/b-<random>/`, laid out the
way the per-run workspace copy used to be: `apps/web` copied without build
output or dependencies, `node_modules` mirrored as links into Core's
installation, Core's `tsconfig.base.json`, and a `packages` link.
`next build --turbopack` runs there with a build-only FluxIQ root inside the
attempt, the client gateway disabled, and inherited `FLUXIQ_*`, `NEXT_PUBLIC_*`,
`NODE_ENV`, and `PORT` values removed. Only after the build exits 0 and leaves
`.next/BUILD_ID` does the attempt receive `build-complete.json`, and only then
does the key receive `published.json` naming the attempt. Both records are
written to a temporary file and renamed into place. A run accepts a build only
when those two records and `BUILD_ID` agree, so a failed, interrupted, or
half-written attempt is never reused. An attempt is never moved after its
build, and an unpublished attempt stays on disk until it is removed by hand.

Runs that share a runs directory build once. The first takes a create-only
`.operation.lock` in the key directory through `workspace-lock.ts`, which is
reclaimed only from a verifiably dead owner. The others poll for the
publication for at most twelve minutes: the build's own ten-minute bound plus
two minutes for staging. A lock that stays unreadable for ten seconds fails
closed and is never reclaimed automatically. The build's output goes only to
the building run's `logs/core-web-build.log`, and a failed build surfaces as a
closed `process.startup` failure.

Each run then serves the published build's `apps/web` with its own port,
`FLUXIQ_*` environment, readiness and snapshot probes, and `logs/core.log`.
Next 15.5 writes into `.next` at runtime only through its incremental cache
(revalidated pages and cached `fetch` responses) and its image optimizer, and
Core's panel uses none of them. Do not remove a build directory while a run is
serving it.

When startup fails, the runner stops the run's processes and hands the run's
logs directory to the caller before it removes the run root. `lab run` copies
those logs into the evidence bundle through the same redacting copy, and under
the same redaction attestation, as a run that started.

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
  |     +-- scenario-port.json                         the fixture's port, kept between invocations
  |     +-- .sessions/<run-id>/                        removed after this invocation
  |           +-- logs/                                copied before cleanup, also when startup fails
  +-- <core>/.tmp/core-web-build/<key>/                production build shared by every run of that Core
  +-- test-runs/<run-id>/                              finalized evidence bundle
```

Only one invocation may own a named workspace at a time. The runner acquires
the workspace lock before starting Core or Chromium, rejects a concurrent live
owner, and may reclaim only a verifiably stale lock. It releases the lock and
removes the current `.sessions/<run-id>` directory on success, failure,
timeout, or handled interruption. It never deletes the stable workspace as a
cleanup shortcut. Different workspace names remain independent.

Sequential commands using the same name start fresh supervised processes and
allocate new FluxIQ web and gateway ports, while seeing the same `.fluxiq`
database, browser profile, projects, recordings, trusted-client state, and run
history.

The Scenario Lab port is the exception: it is recorded in the workspace's
`scenario-port.json` on first use and bound again by every later invocation, the
demo workspace's rule. A Flow saved in the workspace goes to an absolute address
-- a created Flow's first node is a `web.browser.navigate` whose `url` is the
page its build explored, port included -- so a fixture served on a fresh port
each time left every saved Flow navigating to a closed port, and nothing saved in
a workspace could be replayed (measured 2026-09-18: `replay-mu7f5a3r-22085770`,
a Flow saved against port 60600 replayed against a fixture on 61538, failed its
navigate step and matched 0 of 14 records). A recorded port another process
now holds is replaced and recorded, and the allocation reports
`scenarioPortRetained: false`: Flows saved against the old address then no
longer reach the fixture. A record the runner did not write fails closed. Sanitized run
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

The control client's bounded transport failures retain a fixed operation stage
(`auth.login`, `auth.session.validate`, `project.create`, `project.select`, or
`control.request`) and the fixed `network` transport class. They may retain only
an allowlisted nested socket code; request URLs, response bodies and arbitrary
cause text are not persisted. Abort and timeout remain distinct bounded
outcomes. If topology startup later has to clean up, a cleanup failure cannot
replace this primary diagnostic.

The earlier HTTP readiness waits use a separate closed diagnostic. Scenario Lab
health is `scenario.health` and Core panel health is `core.health`; a timeout
persists only that stage, `bounded: "timeout"`, and the integer bound. It never
persists the checked URL, port, target, response, or cause. TCP gateway readiness
remains a `gateway.connection` failure, and does not share these HTTP stages.

The isolated lane selects the project again immediately before it starts the
recording, so whether Core accepts the start does not depend on how long
pairing, tab activation and the Core action probe took. The clone lane selects
its project once, when it imports the cloned Flow. How the extension answers a
start Core refuses is described under
[recording evidence](extension-client.md#recording-evidence).

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
placeholders only. A process variable can override a file value but cannot
remove it, so `FLUXIQ_TEST_ENV_FILES=none` skips both files for one run — for
example an isolated run on a machine whose `.env.local` configures an existing
installation. Any other value of that variable is rejected.

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
then starts and runs the persisted Flow in deterministic adaptive mode, without
asking Core for an LLM dry run, with external side effects disabled, and supplies
the scenario id, origin, URL,
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
FluxIQ ports; the fixture keeps its port. Environment configuration is equivalent:

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

### Replaying a saved Flow

A Flow the created-Flow lane builds is run once, in the invocation that built
it, and on the `isolated` target the FluxIQ install it was saved in is deleted
when that run ends. `lab replay` is the proof that what was saved is reusable:
a later, separate invocation on the persistent workspace the Flow was saved in
runs it exactly as saved, with no model anywhere, and judges it the way the task
that built it is judged.

```bash
# Build: a live create-flow run on the persistent target (the only target that keeps the Flow).
FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=persistent-isolated FLUXIQ_TEST_PERSISTENT_WORKSPACE=<name> pnpm lab:campaign <task-id>
# Replay: no provider key in the environment.
FLUXIQ_TEST_ENV_FILES=none pnpm lab replay <scenario> --workspace <name> --flow <flow-id> --instruction-task <task-id>
```

A replay makes "no model" true rather than observing it:

- it refuses to start when its own environment holds any provider credential
  variable (`PROVIDER_SECRET_ENVIRONMENT_VARIABLES`), naming the variable;
- it deletes every `llm` Secret Key the workspace's Core holds -- a live build
  installed one there -- and fails if one survives;
- it runs the Flow with no execution grant, so `runPersistedFlow` asks Core for
  `adaptiveMode: "deterministic"` and Core's provider resolver returns no
  provider at all (Core `programs/_shared/runtime.ts`, `bindLlmExecutionProvider`).

It then requires Core's own record of the run to show zero provider calls, zero
interventions and zero harness activations, the saved Flow's content hash to be
unchanged, and the task's judgement to hold: for a dataset task, every expected
record matched. The result is written to `<runs>/replays/<replay-id>.json` and
printed: the workspace, project and Flow ids, the content hash before and after,
the saved navigation origins against the origin served, the model block above,
the run's action types and statuses, the extraction measurements
(`matchedRecords` against `expectedRecords`), and each stored dataset's row
count and SHA-256, so two replays can be shown to have stored the same rows in
the same order. It holds counts, ids, origins and digests, never page content.

The flow id is the one the build's `snapshots/flow-lane.json` names. A build
whose run failed after the Flow was applied still saved it; its id is then in
the workspace's project, which `lab replay` checks before it starts anything.

### Reusable self-recording demo workspace

Two explicit smoke scripts exercise the complete author-and-run loop, and two
preparatory commands create the key and deterministic diagnosis Flow, against the same
self-managed persistent isolated FluxIQ installation:

```powershell
pnpm demo:llm:setup
pnpm demo:llm:prepare
pnpm demo:record
pnpm demo:run
```

`pnpm demo:setup-local` creates or rotates one dedicated local test identity
inside `FLUXIQ_DEMO_RUN_DIR/fluxiq-root/.fluxiq` and writes the ignored
`.env.local` with the loopback panel/gateway and persistent workspace
configuration. Generated
credentials are never printed, and the command refuses to overwrite an
existing file unless passed `--force`.

`demo:llm:setup` loads `DEEPSEEK_API_KEY` into driver memory, then reuses the
same workspace lock, copied-Core lifecycle, authentication cache, headless
browser profiles, and evidence policy. It creates or reuses the exact global
DeepSeek key through the real Secret Keys Programs UI. Before reporting
success, it scans the workspace's evidence, logs, `latest-evidence.json`,
metadata files, and Core storage tree (`fluxiq-root/.fluxiq`) for the key, under
the same `SECRET_LEAK_ATTESTATION_RUN_LIMITS` as the
[run leak check](#the-run-leak-check). Core's SQLite databases there are
scanned with their `-wal`, `-shm` and `-journal` files, byte for byte and cell
by cell; only other known binary formats are skipped. Output contains only
status, the validated key name, and
sanitized aggregate attestation counts/categories; the opaque key ID remains
internal. It neither stores key metadata in `workspace.json`
nor configures/runs adaptive execution. Core remains the durable owner of the
encrypted key. The command is idempotent and never invokes Reveal or the
provider. Its static launcher scrubs provider-secret environment variables
from every prerequisite build before the parent driver loads `.env.local`.

`demo:llm:prepare` is a separate provider-free preparation lane. It loads only an
explicit allowlist of local demo configuration, so provider-key variables are
not imported into its driver environment, and it scrubs provider secrets from
all prerequisite build and runtime children. Through the real panel and
extension UI it creates or reuses a dedicated **Web Extension LLM Target Drift
Diagnosis** parent Flow, Router, and owned **Stable target deterministic
baseline** Subflow; records one stable `llm-target-drift` target click; invokes
**Generate Subflow** on the durable recording; and runs the result from Runtime
Debug with **No LLM intervention**. Before that baseline run, it creates or
reuses one exact Flow-scoped **Diagnose deterministic target drift** instruction
through the real Instructions Library and Editor UI. It normalizes persisted
Library filters, reactivates the facility-owned record if necessary, authorizes
changes through the screenshot-suppressed PIN boundary, and verifies from the
reloaded Library that exactly one matching Flow instruction is Required and
Active. It never treats a same-title inherited instruction as the owned record.
It verifies exact ownership, a distinct
one-or-two-node rendered layout (optional navigation plus click), Router routing,
durable action success, and the `Completed: 1` scenario oracle. Repeated runs
validate and reuse the same identities. The owner-protected
`llm-diagnosis-workspace.json` contains only schema and project/Flow/Subflow/
graph/Router/recording IDs, rejects extra fields or credential substrings, and
never contains names, credentials, cookies, model configuration, or LLM usage.
This command does not create/reveal keys, arm drift, configure adaptive mode, or
call a provider.

When the preparation lane creates its owned Subflow, it carries the exact Flow
tree item ID from the verified Flow-open operation into child discovery. It
uses the real hierarchy controls to filter to folders and search for
`Subflows`, then resolves only one exact folder row whose
`data-tree-parent-id` is the captured Flow ID and which exposes one exact
`Add inside Subflows` action. A global `Subflows` role query is invalid
because several expanded Flows may render identically labelled folders. If the
target filtered row is outside Core's virtual window, the driver uses the
tree's Home/ArrowDown keyboard contract so Core's own focus controller mounts
it; it does not infer that scrolling a nearby Router row will mount a sibling.
Core unmounts the accessible hierarchy controls while the creation modal is
active, so the driver retains the original filter values only in memory and
restores them through the real UI after a successful create has closed the
modal. A failed create makes a bounded attempt to cancel only the known
creation dialog, confirms whether the hierarchy returned, and records only
boolean/stage diagnostics before attempting the same bounded restoration.
Every Flow-open helper also re-establishes a restart-safe hierarchy baseline
through the real scoped controls: it selects `All objects` before entering the
Flow search term, then clears the search after capturing the exact Flow tree
identity. This intentionally leaves the type filter at `all`, so a process
interrupted while a temporary Subflows folder filter was active cannot make the
next persistent-workspace run hide every Flow.
After capturing and reacquiring the exact expanded Flow, the helper changes the
real hierarchy search to `Router`. Filter projection retains matching
ancestors, so the driver reacquires the exact Flow ancestor by its captured ID,
then requires one typed `aria-label="Router"` child with that parent ID. It
activates the exact Router row and proves both its tree selection and the
matching Flow-scoped Router tab while the filtered rows are mounted; a
dedicated-pane fallback double-clicks the filtered ancestor Flow row. Only
after that proof does it clear search, and it does not require Router to remain
mounted afterward. Router discovery does not rely on ArrowDown,
`scrollIntoViewIfNeeded`, or sibling overscan.
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

All four demo commands lock and reuse the exact `FLUXIQ_DEMO_RUN_DIR`. Each invocation
starts and stops its own Core web process, served with `next start` from the
shared production build in the Core's `.tmp/core-web-build/<key>/`
(see [Core web panel production build](#core-web-panel-production-build)),
while retaining `fluxiq-root/.fluxiq`; each invocation's session directory
lives under `.sessions` and is removed after shutdown. The directory also contains `workspace.json`, a protected
`scenario-port.json` that keeps recording URLs replayable across invocations, separate
persistent extension and panel browser profiles, a workspace-local copy of the
latest built extension, append-only process/Scenario Lab logs, finalized
evidence bundles, and `latest-evidence.json`.
The shared demo path takes the ownership-token workspace lock from
`workspace-lock.ts`: a valid live PID blocks concurrent use, a valid absent PID
is reclaimed, and malformed or unverifiable ownership fails closed. Scenario
Lab normally retains its persisted loopback port. If that child exits before
health readiness (including a Windows `EACCES` bind failure after a reboot),
the runner atomically replaces `scenario-port.json` while holding the workspace
lock and starts it once more. A second failure is terminal, and both child
attempts remain owned by `ProcessSupervisor` cleanup.
Each test-issued UI/browser action produces two evidence boundaries, one
immediately before and one immediately after. Ordinary actions attach a
physical screenshot to each boundary. Credential entry and its submit action
retain both boundaries but suppress pixels with the truthful
`sensitive-action` reason, preventing a populated key, password, or PIN field
from appearing in a later before-action frame. Flow actions use an
extension-to-runner acknowledgement boundary, so execution cannot proceed
until the before evidence is durable; after evidence is captured before the
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
- a semantic recording script using the click, type, select, scroll,
  navigate, waitForState, checkpoint, press, check, upload, switchTab,
  closeTab, waitForDownload, and extract step operations, where an `extract`
  step with `pagination` declares up to `maxPages` pages (at most 50) and
  FluxIQ's own extraction, not the Lab, follows them
  ([the recording lane](#the-recording-lane)).
  A scripted `navigate` first arms an extension-internal, loopback-only intent,
  loads the fixture page, and waits for the extension to acknowledge that one
  executable navigation event reached its existing recording send path. The
  intent owns the matching top-frame commit independently of browser transition
  labels, while ordinary unarmed recording behavior remains unchanged;
- expected page/final facts, recording events, runtime actions, extracted
  records, and an expected automation failure category, as relevant;
- optional further `workflows`, each with its own script and expectations,
  and `variants` of the primary script or of a workflow, each armed by one
  fixture mutation, whose expected fields replace the workflow's and inherit
  the rest (`resolveScenarioWorkflow` resolves the pair a run uses); and
- optional `secrets`, naming the recording-script steps whose recorded value
  must never be what replays; and
- screenshot, trace, video, sampling, and review policy.

`expected.actions` lists the action attempts FluxIQ must report, each an action
type with an optional `outcome`. The lanes that run a Flow (the Flow lane, and
`executeExistingPersistedFlow` for the existing and clone lanes) all judge it
with `assertFlowActions`. An entry passes when at least one attempt of its type
exists and, if the entry names an `outcome`, finished with that outcome. An
entry with no `outcome` is judged on the attempt's presence alone, whatever its
status: a negative variant pins its action that way and names the failure in
`expected.failure`. Order and extra attempts are not checked. An outcome is
`succeeded` or `failed` (`expectedActionOutcomes`), the two a finished attempt
reaches. There is no `rejected`: no lane can report one, so an expectation
spelled that way would fail on itself, and manifest validation refuses it. A
client refusal is declared as `failed`, with `expected.failure` naming the
refusal: category `blocked_by_capability_or_policy`, code
`web.action.rejected`.

Validation also refuses an `expected.actions` entry, on a workflow or on any of
its variants, whose type no step of that workflow's recording script can yield
(`recordableActionTypes`, `packages/test-contracts/src/recordable-actions.ts`).
A variant never changes the recording, so its entries are judged against the
same script. A `click` step, for example, can yield `web.dom.click`,
`web.dom.check`, and a `web.dom.wait_for_selector` proposed before it. An
`extract` step yields `web.dom.extract_list`, or `web.dom.extract` for a
single-element read: the extraction intent puts one extract node in the
recording, and its pagination belongs to that node, so a paginated step yields
the same two types as an unpaginated one and no `web.dom.click`. A script with
no steps is a playback goal and is not checked.

This is why `flowLaneExclusion` excludes no `week1` workflow. It excludes a
workflow whose script records no action at all, and before an `extract` was
recordable that was W04 and W08, whose scripts only extract.

The runner reports every contract rejection as `fixture.invalid`, whether the
registry threw it while building a manifest or the runner's own validation
found it (`packages/test-runner/src/scenarios.ts`). The failure names each
issue's path and the validator's wording, never a typed value, an expected
record, or a fact. It happens before a run opens its evidence bundle, so such a
failure has no run bundle.

The Scenario Lab registers 25 deterministic fixtures. Each lives in
`apps/scenario-lab/src/scenarios/<id>/` behind an `index.ts` barrel, which is
what the registry and the page specs import. Twelve cover foundational browser
behavior:

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
| `llm-target-drift` | Seeded baseline target activation plus visibly controlled missing/renamed target drift, exact control oracle, and reset/restore for diagnosis and zero-LLM reproduction. |
| `instruction-only-form` | Name and plan form with an empty recording script and only a playback goal, plus a baseline/drifted target mode; the default scenario for instruction-only LLM exploration. |

Ten serve the FluxBench Week 1 corpus. Each row names the corpus rows the
fixture carries: the primary workflow is the manifest's own script, a named
workflow is a `workflows[]` entry, and a variant is armed by one fixture
mutation.

| Fixture | Purpose | Corpus rows |
| --- | --- | --- |
| `keyboard-forms` | Form submitted by Enter in a text field or by a button, a labelled checkbox and radio group, and an ARIA combobox that opens on keydown and filters on every `input` event. | W02 primary; W03 `combobox`. |
| `product-catalog` | Seeded 23-product catalog, 8 per page, with numbered pages and a Next control, a search that filters on submit and shows a result count, and an in-stock filter. | W04 primary, variant `text-variant`; W05 `paginated-extraction`, variant `short-catalog`; W06 `search`, variant `no-results`; W07 `in-stock-only`. |
| `data-table` | Captioned, sortable 12-row inventory table whose cells carry no column attributes, so fields resolve by header (`column:<header>`). | W08 primary, variant `column-reorder`; W09 `sort-by-price`. |
| `infinite-feed` | Feed that appends 10 posts each time a sentinel scrolls into view, with a loading indicator and an end-of-feed marker; 60 posts by default. | W11 primary, variant `end-early` (the feed ends at 25). |
| `modal-flows` | Accessible modal form, a cookie-consent banner covering the primary action, an interstitial that can be armed to block the page, and a `confirm()`-guarded delete. | W12 primary; W13 `consent-then-click`, variant `banner-absent`; W14 `interstitial`, variant `armed` (expected failure `user_intervention_required`). |
| `multi-tab` | Purchase-order list whose details open in a new tab, by a `target="_blank"` link or `window.open`, where they are extracted before the tab closes and the list confirms the review. | W15 primary, variant `popup-blocked` (expected failure `output_not_observed`). |
| `file-transfer` | Attachment download of a seeded CSV report, and a labelled file-upload form that echoes the uploaded name. | W16 primary (download); W17 `upload`. |
| `auth-gate` | Sign-in form for fixture-only demo credentials, whose page states the username and shows a placeholder where the password would be, in front of an account page that redirects to sign-in, with an expiry notice, once the session expires. | W18 primary; W19 variant `expired` (expected failure `auth_required`). |
| `identity-drift` | Settings form whose Save action drifts by mode: selectors only, visible text and name only, moved below the fold, wrapped with an `aria-labelledby` name, or — in `reworded-aria` — id, class, test id and text all at once, leaving only an `aria-label`. | Variants `selector-only` W20, `text-only` W21, `moved` W22, and `wrapped-aria` W23, each expected to succeed; the primary has no row, and `reworded-aria` is the fifth variant, which reaches [the scored fallback](element-identity.md#level-2-candidates-and-scoring) rather than an exact lookup and has no Week 1 corpus row. |
| `intermediate-state` | Claim form whose submission shows a fixed-delay "Processing" interstitial before the result; an armed mode adds a confirmation step the recording never saw. | W24 primary, variant `unannounced` (expected failure `output_not_observed`). |

Three reproduce larger application pages and carry no Week 1 corpus row:

| Fixture | Purpose | Workflows and variants |
| --- | --- | --- |
| `storefront-checkout` | Store checkout with a consent dialog that owns every click until answered, a promotion, a late address lookup and delivery estimate, and payment inside a card iframe, whose fields are marked the way real card fields are, including a security code that is not marked. | Primary, variant `declined-card`. Declares five replay secrets. |
| `admin-console` | CRM console with a virtualised customer list that scrolls inside its own pane, client-side routing, inline editing of a record, and a settings switch inside a web component's shadow root. | Primary, variant `read-only`; `extract-customer-list`, variant `short-book`; `browse-to-customer`; `switch-settings-tab`, variant `light-dom-toggle`. |
| `member-directory` | Members dashboard whose table carries generated class names, row action menus, an edit dialog, filters, and a bulk remove behind a confirmation. | Primary, variants `restyled` and `member-left`; `filter-members`, variant `sorted-by-activity`; `remove-invitations`, variant `support-drawer`. |
| `everything-store` | An everything store (fictional Brightaisle) with class names and ids generated per seed, a consent banner, a delayed app banner and notifications modal, a shadow-DOM chat that opens over the buy box, placeholder results, a results tail that loads on scroll, sponsored cards and a sponsored carousel among results, results repeated across pages, a broken Next, prices written twice, `div` pickers, a buy box dead until hydrated, a Save for later that fails once, and a checkout preset to the store's preferences with a payment iframe. Its defences are a search-form honeypot, a 429 rate limit with `Retry-After`, a soft browser check, and a canvas robot check only a person can pass. | Primary (buy a kettle, the playback goal); `add-to-cart`, variant `redesigned-header` (repair); `first-page-earbuds`, variants `deal-wheel` (new popup) and `robot-check` (expected `user_intervention_required`); `plus-under-fifty`, judged only in the created-Flow lane because no recording can pass it. |

Six fixtures carry an **extraction catalog** beyond what the corpus asks of
them: the shapes a real page takes, each with the expectation that judges it.
None of these workflows or variants has a Week 1 corpus row, so a `lab run` and
the fixtures' own page specs exercise them and the bench does not — which also
means the only paginated extraction a `week1` bench measures is W05's `next`.

| Fixture | Workflow or variant | What it pins |
| --- | --- | --- |
| `product-catalog` | variant `sparse-cards` | A card that carries no price, or no rating: the element is absent rather than empty, so the field reads as no value and the expectation names it in `optionalFields`. |
| `product-catalog` | variant `absolute-links` | A link field returns the href exactly as the page writes it, absolute or not. |
| `product-catalog` | `with-images`, variant `lazy-images` | Attribute reads over images: the loaded `src`, its `alt`, and the real source a deferred card keeps in `data-src`. Armed, the two attribute reads swap places. |
| `product-catalog` | `numbered-pages` | `numbered` pagination: all 23 products by visiting each page control in turn, three pages, rather than by following Next. |
| `product-catalog` | `paginated-extraction` variant `link-pagination` | The same catalog paged by a link rather than by a button control. |
| `data-table` | variant `large-table` | A 2,000-row table past the 1,000-record extraction cap: the read returns 1,000 records and reports itself truncated, rather than passing a partial table off as the whole one. The variant lists no records deliberately — what matters is that the cap reported itself, not where it cut. |
| `data-table` | `empty-table`, variant `no-rows` | `minItems: 0`, so an empty list is a valid answer instead of a failure; and `column:` fields still resolve against a table that kept its caption and headers and shows no rows. |
| `infinite-feed` | `extract-until-end` | `scroll` pagination: every post in one read, loading more until the feed ends, rather than the posts that happen to be on screen. |
| `infinite-feed` | `extract-by-load-more`, variant `load-more-button` | `loadMore` pagination. Unarmed the control does not exist, so the read returns the first page and stops instead of waiting for a button that is never coming; armed, every page after the first comes from pressing it. |
| `sensitive-input` | `extract-card-secrets` | Reading a password control through its value attribute is refused in every mode: the workflow expects `blocked_by_capability_or_policy` / `web.action.rejected` and no records at all, rather than a blank that later looks like data. |
| `sensitive-input` | `extract-card-labels` | The same list with that column left out, which is what excluding a column means: it is absent from the records rather than masked in them, and the read succeeds. |
| `admin-console` | `extract-customer-list`, variant `short-book` | Every customer read off a virtualised list that scrolls inside its own pane; the variant shrinks the book below the list's render window, so every row is mounted and the same extraction returns all of them. |

`iframe-checkout` has no extraction workflow. An extraction reads the document
its action was delivered to, and the definition lane pins the top frame -- the
picker takes a pick from frame 0 alone, and the confirm path dispatches with
`frameId: 0` -- so FluxIQ cannot be asked to read the lines inside the checkout
frame, and the intent seam refuses a `frame:` extract target. A workflow that
read them anyway would be served by the reference reader through Playwright and
would measure Playwright rather than FluxIQ. The frame still lists the order, so
the workflow returns as soon as the confirm path can be given a frame's document
path ([web capabilities](web-capabilities.md#recorded-actions)).

Direct Node tests cover manifest validation, loopback-only policy, uniqueness,
fail-fast mismatch handling, HTTP rendering/control behavior, deterministic
reset/reseed, parallel server isolation, sensitive-state discard, and the exact
target-drift control oracle. Each corpus fixture adds its own
`tests/scenario.test.ts` for manifest validity, deterministic state, every
mutate operation and variant arm, and every route response.

The page specs in `apps/scenario-lab/e2e/` drive the fixtures with plain
Playwright in headless Chromium. `scenario-pages.spec.ts` covers eleven of the
twelve foundational fixtures (all but `instruction-only-form`); its
target-drift test proves baseline success, persistent missing-target failure
across reload, renamed-target state, and restore. Each corpus fixture has its
own `<id>.spec.ts` that runs every workflow, asserts the final state, then arms
each variant and asserts the behavior its corpus row describes. The three
application fixtures have their own `<id>.spec.ts` too.
`negative-variants.spec.ts` proves that the armed pages of W10 `broken-link`,
W25 `too-slow`, W26 `no-context` and W27's three variants really fail the way
their manifests declare; the failure code a run reports is not pinned there.
Every spec takes its `test` object from `e2e/lab-fixture.ts`, which provides an
in-process lab (`lab`, on seed 42 unless the spec sets `labSeed` with
`test.use`), the loopback-only network guard (`networkGuard`), and
`readFinalState(lab, scenarioId)` for the `/__control/final-state` oracle.
These are fixture tests, not extension-to-Core E2E tests.

## Recording lane and Flow lane

Every `lab run` on the `isolated` or `persistent-isolated` target runs the
recording lane, and `--flow` adds the Flow lane after it. The existing and
clone targets run a pre-existing Flow on neither lane.

```powershell
pnpm lab run basic-form
pnpm lab run basic-form --flow
pnpm lab run auth-gate --flow --variant expired
pnpm lab run product-catalog --workflow search --flow
```

`--workflow <id>` selects a `workflows[]` entry; without it the manifest's
primary workflow runs. `--variant <id>` requires `--flow`, because only the Flow
lane arms a variant. `--flow` is refused on the existing and clone targets. A
`--flow` followed by a bare value is read as `--flow <flow-id>`, the existing
target's Flow override, so give the Flow-lane flag last or before another
option (`packages/test-runner/src/commands.ts`).

### The recording lane

The runner opens the scenario's start page, checks its page facts, and pairs
the extension when the run has a Core identity. It runs the
[Core action probe](#lane-rules), selects the project again, starts recording,
and waits up to 15 seconds for the extension to report that it is recording. A
start that never arrives fails as `recording.persistence`, and writes the
extension's own account of it, labels and reasons only, to
`snapshots/recording-start.json`.

Each recording-script step is then driven through Playwright as trusted input
while the extension records. An `extract` step's records are asserted against
`expected.extracted` as the step runs, and what the step read is kept before it
is judged and published as one counts-only measurement per extract step in the
run's `evaluation.json` (`run-expectations/extraction/measurements.ts`): the
records compared, the fields that carried a value, the pages the read followed,
whether it truncated, and how long it took. A step whose records did not match
is measured too, which is the measurement worth having; a step an expectation
named that never ran is `not_run`; a step nothing expected is `not_expected`;
and a run that never reached its script publishes `null`, which reads as
unmeasured rather than as "no extraction step".

An `extract` step is **FluxIQ's read, not the Lab's**
(`scenario-steps/extract-intent.ts`). The step is translated into a recorded
extraction definition and sent to the extension's own control page as
`fluxiq.test.defineExtraction`; the background worker records `data.extract`
and runs `web.dom.extract_list` through the same command a replayed Flow uses,
and answers with the records. Pagination is part of that definition, so FluxIQ
follows `next`, `loadMore`, `scroll` or `numbered` itself, up to the step's
`maxPages`, and the recording holds one extract node rather than a Next click
per page. The step sends no timeout: the read is bounded by the domain's own
budget, scaled by the pages the request may read, because a bound the harness
imposed would be the harness deciding how long the product may take.

A run with no extension control page falls back to the Lab's reference reader
(`scenario-steps/extract-records.ts`), which reads a page with Playwright,
clicks `next`, waits until the page it read has been replaced (15 seconds
unless the step sets `timeoutMs`), and reads again until `next` is absent or
`maxPages` pages were read. It exists for that case only: a run judged on what
it returns measures the Lab, not FluxIQ. It reports no pages read, no
truncation flag and no duration, so a step whose `expected.extracted` names
`pages` or `truncated` is refused on such a run as `fixture.invalid` rather
than passed on the half of the expectation it could still check.

While still recording, the runner asserts `expected.recordingEvents` against
the extension's own recording log and reads the extension's count of the
executable actions it recorded. It then checks the final state, stops
recording, and runs the [recording checks](#recording-checks).

A variant never changes the recording. The recording lane always records the
workflow unarmed, and judges it against the unarmed workflow's expectations.

### The Flow lane

After the recording checks pass, the Flow lane
(`packages/test-runner/src/flow-lane/run-flow-lane.ts`) runs with no provider
configured; every step is a Core call or a fixture assertion:

1. It requires exactly one new recording, and waits until Core has finalized it.
2. It asks Core's public `create-recording-flow-proposals` for the recording's
   proposal. A proposal with no candidate, or with fewer candidates than the
   executable recording events the workflow pins exact counts for, fails as
   `recording.contract` before anything is approved.
3. It approves the proposal into a new Flow through
   `review-recording-flow-proposal`. Core creates and writes the Flow; the lane
   never authors one.
4. It resets the fixture state through the Scenario Lab's `/__control/reset`, so
   the Flow is judged on state it produced itself.
5. It prepares the page: it arms the variant, if any, loads the scenario's
   `startPath` in the scenario tab, and checks the armed rendering's page facts.
   Every Flow run starts on the start page, never wherever the recording left
   the tab, and never by a reload.
6. It reads the Flow's nodes once, maps each node to its action type, and pairs
   the nodes' requests with the [declared replay secrets](#declared-replay-secrets)
   and [declared uploads](#declared-uploads).
7. It runs the Flow through Core's persisted-run API, with those values as run
   inputs and `web-automation` as the authorized domain, and reads Core's run
   detail whether the Flow succeeded or failed.
8. It consults the fixture oracle, publishes what it observed, and only then
   judges the workflow's expectations.

The expectations are judged in this order:

- `expected.failure`, against the structured `failure` record Core wrote on the
  first attempt that has one: its category, and its code when the workflow
  names one. An expected failure that did not happen, or a failure nobody
  expected, fails as `runtime.behavior`. Nothing is read from a message.
- `expected.actions`, by the rule in [Scenario lab and contract](#scenario-lab-and-contract),
  failing as `action.dispatch`.
- `expected.extracted`, against **the datasets Core stored for the run**
  (`flow-lane/run-datasets.ts`). The lane reads `runDetail.datasets` and pages
  `get-run-dataset-page` until Core advances no cursor, rebuilding each row over
  the page's schema and restoring `null` for every field the row lacks, because
  an expectation spells an optional miss as `null` and a `null` matches only a
  `null`. A dataset whose rows do not add up to its summary's `recordCount` is
  refused: a short read would turn a record regression into a missing one. A
  stored attempt never carries its rows — Core replaces them with a `$dataset`
  marker and keeps the count — so there is no other place to read them from.

  Datasets pair with the script's `extract` steps by the recording's candidate
  order, and one `RunExtractionMeasurement` per step is published on the
  observation and in `snapshots/flow-lane.json` **before** any expectation is
  judged. The assertions then run in this order: fewer extract nodes than
  recorded extract steps fails as `recording.contract`; any non-string field
  value fails as `runtime.behavior`; an expectation naming a step the script
  does not extract from fails as `fixture.invalid`; an expected step for which
  the Flow stored no dataset fails as `runtime.behavior`; and the records are
  compared last.

  Two members of the expectation are **stated as unjudged rather than judged or
  refused**: the pages a read covered, and whether it hit the page's item cap.
  Core's run detail and its datasets record neither, and a dataset's own
  `truncated` is Core's per-run row cap, a different event. They are therefore
  removed from the entry handed to the assertion, named on the step as
  `unjudged`, and enter no rate — so `paginationAccuracy` on this lane has an
  empty population and publishes no number. The records are still compared in
  full, which is the stronger claim: a step that read only page 1 cannot
  produce page 3's records.
- The fixture oracle. A Flow whose expectations held but whose fixture did not
  reach its expected final state fails as `runtime.behavior`.

What the lane observed is written to `snapshots/flow-lane.json` before any
expectation is judged, so a run that fails one still shows the Flow run it was.
The file holds Core's identifiers, statuses, counts and structured records,
never page content (`flowLaneSnapshot`):

- the recording's id and entry count, and the lane's own wait on it;
- the proposal's id, mapper, candidate count, and Core's own issues;
- the Flow and runtime run ids, the run status, the number of LLM interventions
  Core recorded (`harnessActivations`), and the first failure record;
- an `extraction` block: whether the workflow's expectation applied, the extract
  nodes against the recorded extract steps, datasets no step paired with, and
  per step its position, its status (`judged`, `not_run` or `not_expected`), its
  record, field and non-string counts, the expectation members this lane could
  **not** judge, and Core's own dataset flags. No step id, field name or value
  is in it. The `unjudged` list is the point of the block: a reader who sees a
  green extraction must be able to see what was not compared without opening
  the code;
- per attempt, in order: its action type and status; its failure record; Core's
  transition comparison status when Core reported one, kept only when it is
  shaped like one of Core's names; Core's target resolution, narrowed to its
  status and numbers; and the size in bytes and truncation flag of each
  sanitized evidence packet Core captured before and after it. The packets
  themselves never travel.

Every isolated or persistent-isolated run also writes `evaluation.json`, its own
`RunEvaluation`: the same judgement [the bench](#the-bench) records for a corpus
row. A Flow-lane run's evidence sizes are read from `snapshots/flow-lane.json`
by one reader, `run-evaluation/flow-lane-evidence-sizes.ts`, which a single run
and its bench row both use, so the two record the same packets. The same reader
feeds the `evidence-packet-budget` invariant: a measured packet over the
domain's exploration budget, 6,000 bytes, fails a run the runner had passed, as
`performance.budget`. A run with no packets gets no such invariant.
`rawSnapshotBytes` stays empty, because no producer measures raw snapshots.

### Declared replay secrets

The recorder withholds a sensitive control's value at the source, by the one
rule in `domain/src/sensitivity`, so the recording of a typed password holds no
password. The Flow generated from it asks for the value instead of carrying one:
the node's `text` is a binding to the run-input path `web.secret.<key>`
([sensitive values](sensitive-values.md)). A fixture whose Flow must type such a
value declares the recording-script step whose value is withheld:

```ts
secrets: [{ id: "auth-gate-password", step: "enter-password" }],
```

The Flow lane resolves each declaration from an environment variable named
`FLUXIQ_TEST_SECRET_<ID>`, the id upper-cased with hyphens as underscores,
before the run's evidence bundle is created, and adds each value to the bundle's
redaction list. Nothing falls back to the recording:

- a declaration whose variable is unset fails the run closed with
  `environment.missing`, naming the variable;
- a declaration naming a step that none of the scenario's recording scripts
  contains fails it as `fixture.invalid`.

Once Core has approved the Flow, the lane pairs every `web.secret.<key>` request
in the Flow's nodes with a declaration by control, not by the path's spelling.
The declared step's `target` is matched against the identity recorded on the
requesting node: a test id, a role and name, or an identical CSS selector. Only
declarations whose step this workflow recorded take part. The pairing must be
exactly one to one. A request that no declaration answers, or a declaration
that pairs with no request or with several, fails the run as `fixture.invalid`
before the Flow starts. The failure names secret ids, steps, node ids,
parameters and paths, never a value (`flow-lane/declared-secrets.ts`). Each
value is then supplied once, as a run input under the path its node asks for.
Core keeps a run's input keys and withholds their values at rest, as
[sensitive values](sensitive-values.md) describes.

Only the Flow lane resolves declarations, so a recording-lane run of the same
fixture needs no configuration.

| Variable | Meaning |
| --- | --- |
| `FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD` | The password a Flow-lane run of `auth-gate` types into the sign-in form: W18, and W19's `expired` variant, whose Flow signs in before the account page refuses it. It must carry the credential the fixture accepts, `authGateDemoCredentials.password` in `apps/scenario-lab/src/scenarios/auth-gate/constants.ts`. The sign-in page shows a placeholder in its place. |
| `FLUXIQ_TEST_SECRET_STOREFRONT_CHECKOUT_PASSWORD`, `..._CARD`, `..._CARD_NAME`, `..._CARD_EXPIRY`, `..._BILLING_CARD` | The five marked fields a Flow-lane run of `storefront-checkout` types into: the account password, the card number, the cardholder name, the expiry, and the billing card number. The unmarked security code is deliberately not declared, because nothing withholds it. |

**These are fixture credentials, not real ones.** Each is a synthetic value that
belongs to a deterministic loopback fixture. It opens nothing and protects
nothing, and it belongs in a local `.env.local` rather than in a secret store.
The manifest's recording script still carries it, as the value the recording
lane types, and the [run leak check](#the-run-leak-check) scans for exactly that
value. The Flow lane takes it only from the variable, never from the manifest
or the recording.

### Declared uploads

A file choice is recorded without its files, so the Flow generated from an
`upload` step asks for them the same way: the node's `upload` parameter is a
binding to `web.upload.<key>`, where `<key>` is the domain's key for the control
the node was recorded on. The Flow lane answers those requests with no
declaration (`flow-lane/declared-uploads.ts`):

- each request's path must be the one the domain derives from the node's
  recorded control, or the run fails as `recording.contract`;
- the lane supplies the file the recording script's `upload` steps name, with
  the same deterministic bytes the recording lane wrote and handed the browser,
  as media type `application/octet-stream`, once per path;
- a request when the script's `upload` steps name no file, or more than one
  distinct file, fails the run as `fixture.invalid`, because the lane does not
  pair different files with different controls;
- a script with an `upload` step but no request supplies nothing, and the
  workflow's pinned `web.dom.upload` judges that result.

Each failure happens before the Flow starts, and names node ids, steps and
paths, never a file's name or content.

### Lane rules

`packages/test-runner/src/lane-rules/` holds what a run needs, and what it is
judged on, by the lane it runs on:

- **Core identity** (`core-identity.ts`). A Flow-lane run and a clone run always
  bootstrap a Core identity. A recording-lane run bootstraps one only when the
  workflow it records pins recording events or actions, or the scenario has a
  playback goal. Without one nothing pairs the extension, and no probe,
  recording or Flow can run.
- **A Flow was built** (`built-flow.ts`). A Flow-lane run passes only when the
  lane published an observation with a created Flow. One that never reached
  the lane fails as `environment.missing` rather than passing on the
  recording's checks.
- **The Core action probe** (`probe-step.ts`). Before recording, Core navigates
  the extension's automation tab to the start page, then types a fixed probe
  text into the first `type` step, in script order, whose target resolves to a
  CSS selector visible on that page within one second. A field that only an
  earlier step reveals cannot take it. With no such step the probe is skipped,
  and a `runtime.settle` event publishes the reason (`no-css-type-step` or
  `not-on-start-page`) and the step ids considered, never a value.
- **Final-state facts** (`final-state-facts.ts`). A run's final state is judged
  on the resolved workflow's `finalState`, plus the scenario's playback-goal
  success facts only for the primary workflow expected to succeed. A negative
  run, one whose `expected.failure` is set, is not judged on the goal.

### Recording checks

After Stop, on both lanes, the runner checks that Core holds the recording the
extension made:

- **The recording persisted.** Core's gateway still lists the paired session, a
  new recording appears within five seconds, and the runner waits for Core's own
  `endedAt` on it, which Core stamps after the stop drain and the entry flush.
- **Recording completeness** (`run-expectations/recording-completeness.ts`). The
  extension's count of the executable actions it recorded, read before Stop, is
  compared with the action entries in Core's full recording (`get-recording`,
  counted by Core's own `recordingEntryIsActionLike` test). Core holding fewer
  fails as `recording.persistence`, naming only the two counts. Core holding
  more does not fail, because the page can emit an action between the read and
  Stop. An extension count that cannot be read fails as `extension.worker`, and
  a Core recording that cannot be read fails as `recording.persistence`.
- **Discard audit** (`flow-lane/recording-discards.ts`). Core audits a message
  that reaches a recording after it was finalized as
  `recording.action_discarded` or `recording.event_discarded`, and tells the
  client nothing, so its gateway audit log is the only place that loss shows.
  The runner reads it from `/api/client-gateway/snapshot`. An entry counts when
  it names one of this run's recordings, or names none and came from this run's
  session, and only when Core stamped it inside the recording's window. The
  window runs from just before the runner asks the extension to start
  recording until just before the Flow lane dispatches its Flow, or without an
  end when no Flow ran, so it excludes the confirmations of the Core action
  probe and of the Flow's own actions. An entry with no readable timestamp
  counts. Any discarded action inside the window fails as
  `recording.persistence`. Discarded evidence alone does not, because a page
  unloading after Stop emits some. A snapshot with no audit log fails closed as
  `gateway.connection`.

  The audit is read twice, because Core audits a discard only when the late
  message arrives. The first read follows Stop. The second runs after the
  browser has closed and before Core stops, fetches a snapshot once more when
  it cannot get one or finds no audit log in it, and unions both reads by audit
  entry id. A discarded action the second read finds replaces any other
  failure category the run reached; a second read that cannot rule a loss out
  fails only a run that had passed. Each read publishes, in a `runtime.settle`
  event, its discards, its window, and how many discard entries the window
  excluded, by whether each named this run's recording, no recording, or
  another.

### The run leak check

Every isolated, persistent-isolated and clone run scans for the values its
scenario declares secret, once Core has stopped and its logs are in the bundle,
and before the clone workspace is removed and the bundle is finalized
(`packages/test-runner/src/redaction-attestation/attest-run-redaction.ts`). It is
the Lab's on-disk proof that the recorder withheld what
[sensitive values](sensitive-values.md) says it withholds.

- **Literals.** The recorded `value` of each step that `secrets[]` names, across
  the primary script and every workflow's. The declaration is `secrets[]` alone:
  a `redaction` tag describes what a fixture is about, not which of its values
  are secret. A declared step that no script contains, or whose value is shorter
  than eight characters, fails the run as `fixture.invalid`. A scenario with no
  declaration is `not-applicable`. The literals never join the bundle's
  redaction list, which would scrub the very leak the bundle scan looks for.
- **Scopes.** `bundle`, the run's evidence bundle at its staging directory; and
  `workspace`, the FluxIQ storage directory the run's Core wrote
  (`fluxiq-root/.fluxiq`), which holds its recordings, run traces and SQLite
  databases. On `persistent-isolated`, whose workspace outlives the run, only
  files whose modification or creation time is at or after the run's start,
  less two seconds, are scanned, together with every link or entry the walk
  could not judge; a SQLite store this run wrote to is scanned whole. The
  browser profile is not scanned, because the extension's LevelDB storage is
  binary. The existing target's FluxIQ is remote, so a scenario declaring
  secrets is left unattested there.
- **Text files** are searched for each literal. The scanner's credential-syntax
  categories (`credential-field`, `credential-assignment`,
  `authorization-material`) are recorded as advisories and do not fail the run.
- **SQLite stores**, known by a `.db`, `.sqlite` or `.sqlite3` name with or
  without a `-wal`, `-shm` or `-journal` suffix, or by a database, WAL or journal
  header, are never skipped as binary. Each file is searched byte for byte for
  the literal in UTF-8, UTF-16LE and UTF-16BE, which also covers freed pages and
  log frames no query returns. The database each file belongs to is also copied,
  with its `-wal` and `-journal`, into a private temporary directory and read
  cell by cell, so a literal SQLite has split across overflow pages is found too
  (`sqlite-store-reader/`). A store the scan cannot read in full, a database
  over a ceiling, and a `-wal` or `-journal` holding bytes with no database
  beside it are each an `unscanned-store` finding.
- **Other binaries**, files with a known binary extension such as images,
  video, archives, fonts and executables, are skipped and counted.
- **Limits** are `SECRET_LEAK_ATTESTATION_RUN_LIMITS`: 10,000 files, 8 MiB per
  text file, 64 MiB of text per scan, and depth 32, and no byte ceiling on a
  SQLite store, which is streamed rather than held in memory. Anything
  the scan could not read, including an entry over a limit, is a finding,
  because a scan that could not look has not attested absence.

  A store has no size ceiling because a ceiling bounded only the answer: 8 MiB
  failed a healthy 10.02 MiB run, and the 32 MiB that replaced it failed a
  completed state-changing run whose store was 85.5 MiB. The byte search reads a
  store 1 MiB at a time with an overlap, the staging copy is `copyFile`, and the
  cell search runs inside SQLite, so memory does not grow with the store. A store
  the scan cannot read (unopenable, malformed, an orphan log, a link) is still an
  `unscanned-store` finding, and the reader is still killed after 120 s.

A finding fails the run as `security.redaction`, and replaces the run's failure
category only when the run had otherwise passed. The result holds counts, scope
names, relative paths with every literal redacted out, and categories, never
content or a literal. It is written to `snapshots/redaction-attestation.json`,
and `run.json` records `redactionState`, which is `verified` only when the
attestation passed.

The cell reader runs Node's built-in `node:sqlite` in a child process started
with `--experimental-sqlite`. It is given the literal on stdin, only the
environment a Node process needs to start, and two minutes. If the process
cannot run or fails, every database it was given is `unreadable`, so a run
whose scopes hold a database fails.

**Known limit:** a literal split across pages that SQLite has already freed is
missed. No contiguous copy exists for the byte search to find, and the cell
reader reads only live cells.

## The bench

`lab bench` runs a corpus of rows, each a scenario's workflow and its variants,
through the same `runScenario` a `lab run` uses
(`packages/test-runner/src/bench/run-bench.ts`):

```powershell
pnpm lab bench --corpus smoke --repeat 2 --target isolated
pnpm lab bench --corpus week1 --repeat 3 --target isolated
pnpm lab bench --corpus week1 --repeat 3 --target isolated --shards 2 --jobs 2
pnpm lab bench --resume <bench-id>
```

Without `--shards`, a new campaign is serial. `--shards <count>` selects the
deterministic sharded topology; the count is 2--8. `--jobs <count>` is 1 through
the shard count and controls how many child executors the parent schedules at
once. It is meaningful only with sharding. More jobs do not bypass the
machine-wide admission gate: at most two scenario cells may own global slots,
waiters are FIFO across concurrent campaigns, and available physical memory is
checked again before every cell. A waiter re-reads the pool every 100 ms but
runs the full process-identity probe (a PowerShell query on Windows) only when
it first sees an owner, when a spawn-free signal-0 check reports that owner's
PID gone (the probe confirms before a crashed owner is archived), and at most
once a minute per owner to catch a reused PID. Admission retains 4 GiB for the machine and
budgets 3 GiB for each active/new cell. A slot surrounds only `runScenario`, so
checkpointing, reconciliation, aggregation, and an idle child do not consume
it; the slot is released on success, failure, or interruption.

Every newly started bench is a durable campaign. Serial execution publishes
one immutable `campaign.json`; sharded execution publishes an immutable parent
authority and exact child authorities beneath `shards/<index>/`. The parent
records the fixed partition algorithm, shard count, and jobs. Complete result
groups are assigned round-robin in first-plan order, and every repeat of one
result stays in the same child. Child plan ordinals are local, but cell keys
retain their parent identity, so the partition has disjoint, exact coverage.
The parent coordinates and never executes a scenario cell itself.

Each executing serial campaign or child owns its directory with an independent
lease and adds an immutable, hash-linked checkpoint before and after every
executable cell. A machine or process failure therefore loses at most the
active attempt, not the campaign. Resume is always explicit:
`lab bench --resume <bench-id>` loads the saved request and topology; it never
guesses the newest bench. It accepts a finalized active run only when the
bundle's `bench-receipt.json`, evaluation identity, hashes, and completion
marker bind it to that exact campaign cell. Otherwise an interrupted staging
bundle is preserved under that serial/child campaign's `interrupted/` directory
and the cell gets a new deterministic attempt id. A lease refuses a concurrent
live owner and archives/reclaims only an owner proven stale by machine-boot and
process-start identities, so a reboot or PID reuse needs no lock-file edit.

After every child is terminal, the parent validates their exact partition and
authenticated evaluations, then publishes parent-ordered `runs.json`,
`report.json`, and `report.md`. A create-only merge seal authenticates the
parent manifest and plan, every child manifest, plan, terminal checkpoint and
projection, and the merged projections. Only then does the parent publish its
finished checkpoint. Repeating merge/resume is idempotent; missing,
overlapping, foreign, corrupt, or secret-bearing state fails closed.

Resume fails closed if the facility or Core commit, lockfiles, built runner,
extension, Scenario Lab, Chromium version, platform, architecture, locale,
timezone, or viewport differs from the campaign manifest. Both repositories
must consequently be clean when a resumable bench is created or resumed. A
paused campaign can resume only at its original compatible commit/build pin;
current code does not weaken compatibility to reopen it. Legacy completed
evaluations and reports remain readable and comparable through explicit
normalization, but a legacy bench without current campaign authority cannot be
resumed.

- **Corpora** (`bench/corpus/`). `smoke` is W01 (`basic-form`) and W28
  (`iframe-checkout`) on the recording lane only. `week1` is W01 to W29 on both
  lanes: every unarmed workflow runs on the recording lane and on the Flow lane,
  and every variant runs on the Flow lane alone. A workflow whose script
  performs no action has no Flow lane, because no recording of it can become a
  Flow, and a `lab run --flow` of one is refused as `fixture.invalid` before
  anything starts — but no `week1` workflow is such a workflow any more. W04 and
  W08 were, their scripts doing nothing but extract; an `extract` now records a
  `web.dom.extract_list`, so their four Flow-lane entries run again and their
  extraction is judged on the Flow lane. That leaves 67 runnable results per
  repeat and 0 skipped: 23 on the recording lane, and 44 on the Flow lane
  (23 unarmed and 21 variants).
  W19 to W23 and W29 are variants only. Because `week1` runs
  `auth-gate` on the Flow lane, it needs `FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD`.
- **Runs.** Each repeat is one pass over the corpus. `--target` must be
  `isolated` or `persistent-isolated`. A result the corpus runs on no lane, or
  one that does not resolve against the registry, is recorded as skipped with
  its reason, never as a pass.
- **Output**, under `<runs directory>/bench/<bench id>/`: immutable campaign
  authority and checkpoint generations plus derived `runs.json`, `report.json`
  (`BenchReport`), and `report.md`. A serial campaign keeps its evaluations in
  `evaluations/`. A sharded parent keeps each child's complete serial-shaped
  state under `shards/<index>/`; parent run records point to those immutable
  child evaluations, and `merge-seal.json` authenticates the merge. Derived
  aggregate files are published only after every executable plan cell has one
  validated completion. The bench passes only when at least one run was
  evaluated and every evaluated run passed.

```text
<runs directory>/bench/<bench id>/
  campaign.json
  checkpoints/                 serial checkpoints, or sharded parent finish
  evaluations/                 serial campaigns only
  shards/000/                  sharded campaigns only
    campaign.json
    checkpoints/
    evaluations/
    runs.json, report.json, report.md
  shards/001/ ...
  merge-seal.json              sharded campaigns only
  runs.json, report.json, report.md
```
- **Rates** (`packages/test-contracts/src/bench-report.ts`) are computed per lane
  and never combined, because the recording lane executes at most the Core
  action probe, never the workflow: `flowCreationSuccess`,
  `initialExecutionSuccess`, `deterministicReplaySuccess`, `fuzzyRecovery`,
  `falseFailure`, `falseSuccess`, `failureClassificationAccuracy`, and
  `harnessActivation`. Beside them, `notExecutedRuns` counts evaluated runs in
  which FluxIQ executed no action, which every rate counts as a miss, and
  `actionsExecuted` counts the actions it did execute. The report also carries
  p50 and p95 distributions of per-action-type latency, run duration and
  sanitized packet bytes, and a truncation count.
- **Extraction** (`metrics.extractionByLane`, `bench/extraction-metrics.ts`) is
  also per lane, and a lane whose runs measured no extraction states **no block
  at all** — absent is unmeasured, and a block of zeros would claim the bench
  looked and found none. The recording lane is that lane in a **bench** today,
  though no longer in a single run: `lab run` publishes one measurement per
  extract step in the run's `evaluation.json`, read from FluxIQ's own
  extraction, but the bench builds its recording-lane observation from
  `run.json` (`benchRecordingObservation`), which carries no measurement, so it
  still states `null` and `week1` states an extraction block for the Flow lane
  alone. One rule governs every rate: a step that
  could not judge something enters no rate for it, and a rate whose population
  is empty publishes `rate: null`, printed as `n/a`.
  `extractionRecordAccuracy` is pooled over the steps whose expectation listed
  records (Σ matched ÷ Σ max(expected, observed)), and `extractionCountAccuracy`
  over the count-only steps alone. The two populations never overlap, which is
  the point: a step that stated a count and compared no value has no matched
  record to pool, and counting one would let a single 1,000-row step publish a
  near-perfect record accuracy over values nobody looked at;
  `extractionFieldCompleteness` counts a field present only when the record
  carried a **value** for it, since Core's stored schema guarantees the key and
  a presence test would read 1.000 whatever happened; `paginationAccuracy`
  needs both an expected page count and an observed one, which the Flow lane
  cannot supply; and `extractionExactSuccess` and `extractionFalseSuccess` are
  per run. Beside them, `judgedSteps` and `unjudgedSteps`, and the split of the
  judged into `comparedSteps`, `countOnlySteps` and `unjudgeableSteps`, state
  what each number stands on; `report.md` prints that split as a sentence and
  each rate's own unit and population beside it, because no two of these rates
  are counted over the same steps. Two distributions,
  `extractionDurationMs` and `extractionMsPerPage`, complete the block; the
  second has no samples on a lane that cannot observe pages.
- **Causes.** A failed run's cause is the summary of its own last `error` event
  written under the category the runner returned (`bench/read-run-bundle.ts`),
  because the runner's result carries a category and no text. The outcome
  printed at the end, and the top of `report.md`, list each distinct cause with
  the number of runs that share it, most first (`bench/failure-cause.ts`). A
  bundle file the bench could not read, or a `lab inspect` that failed, is
  recorded separately as a problem of that run.

`lab compare` judges two reports, or one report's repeats split in halves, as
[Commands and prerequisites](#commands-and-prerequisites) describes.

For two reports, `lab compare <baseline> <candidate>` is also the durable Week
1 closeout view. It uses the existing `BenchReport` contract comparison and
adds every Metrics-table rate and latency, every per-lane extraction rate
(`extraction:<lane>:<metric>`), explicitly marked absent values and
unstated tolerances, differing result/run verdicts, and count-only figures for
all six exit criteria. `extractionExactSuccess` and `extractionFalseSuccess`
are compared under the same one-workflow tolerance as the Metrics-table rates;
the four accuracy and completeness rates are compared within one unit of their
own population — one record, one field, one step. A rate absent from one report,
or `null` in both because nothing judged it, is disclosed rather than compared,
so a lane that measured no extraction cannot read as a regression.

It reads `recording.persistence` run events only to
aggregate discard kinds, maxima, recording-presence/finalization counts, and
window-exclusion counts; it cannot emit event messages, payloads, page data, or
recording ids. Concurrent benches are labelled as shared-load measurements by
default. A shared-load comparison fails closed unless both reports have the
same topology: both serial, or both sharded with the same algorithm, shard
count, and jobs. Add `--sequential` only when the reports were produced
sequentially; that mode may compare metrics across different topologies but
explicitly discloses the mismatch. Any metric outside its tolerance in either
direction, any comparable metric present on only one side, or any differing
result/run verdict exits 1. `--halves`
retains the narrower contract-only comparison because its reports are computed
in memory rather than stored as two complete bench bundles.
The two-report output's `comparisonPassed` means only that those A/B metric and
verdict comparisons agree. It is not overall Week 1 acceptance: partial or
unmeasured exit criteria remain visible and require their separate named proof.
It fails closed when a tolerance-bearing metric is measured by only one report.
A rate with no population in either report is explicitly `not-applicable` and
does not fail agreement; p50/evidence rows with no plan tolerance are disclosure
rows and likewise do not prevent criterion 5 from being measured.
The command rejects a bundle unless `runs.json` supplies the same result groups
as `report.json` and exactly the report's repeat count of validated evaluations
for each group, so partial run data cannot produce closeout figures.
The deterministic-fallback figure uses only Flow-lane W20-W23 variants and the
unarmed contextual W26 result; recording-lane observations and W26's negative
variant do not count as recovery proof.

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
id from the MV3 service-worker URL, and opens the side-panel page directly. The
finite runner treats extension discovery as its own readiness gate: it checks
already-running workers, subscribes and immediately rechecks to close the
observation race, accepts only `chrome-extension:` workers, and waits at most
30 seconds before producing bounded counts and connection state. It removes
its listener and timer on every outcome and never records worker URLs.
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

These specs do not use the Scenario Lab registry or the FluxIQ gateway; they
share only Scenario Lab's network guard. The isolated facility runner's
recording lane proves pairing, recording persistence, and production
client-action dispatch, as the verified `basic-form` run showed, and its
[Flow lane](#the-flow-lane) executes a persisted Flow built from the run's own
recording. The existing target executes a pre-existing persisted Flow but still
awaits a live validation run. The facility does not yet prove full
reconnect/replay, Firefox behavior, or installed Chrome/Edge behavior. Neither
Playwright suite proves a command's delivery to a child frame through the
background worker, including addressing a frame by its path: the
[content-script harness](#content-script-harness) proves only the receiving
frame's half, and the sending half is covered by unit tests in
`apps/extension/src/runtime/tests/`. The verified Windows E2E and isolated
facility runs used bundled `Chrome/134.0.6998.35`. Chromium is launched headed,
so CI requires a display-capable runner or suitable virtual display.

The finite facility runner installs a context-wide request and WebSocket guard
before it opens the extension control or scenario pages. It allows only
`chrome-extension:`, `data:`, `about:`, and `blob:` resources, the exact
`127.0.0.1` and `localhost` Scenario Lab origins for the selected port, the
exact FluxIQ HTTP(S) origin, and the configured gateway WS(S) origin. Other
destinations are blocked, recorded without query strings or credentials, and
make the run fail. Because the guard is attached to `BrowserContext`, it also
applies to pages subsequently created by extension actions.

### Content-script harness

A second, larger Playwright suite, the content-script harness, runs the real
content-script bundle in a headless Chromium page on a Scenario Lab fixture
(`apps/extension/e2e/playwright.content.config.ts`). Its global setup builds the
content-script and page-world bundles once per run, with the extension's own
esbuild settings, into a directory that run owns, so a parallel harness run or a
concurrent `pnpm build` cannot change a bundle under a running test. The
page-world bundle and then the content script are injected at document start in
every frame, and each frame's `chrome.runtime` is replaced by a stub
(`e2e/content/harness.ts`, `runtime-stub.ts`). A spec talks to the content script
as the background worker does, and reads back every message it sent. The
harness imports the Scenario Lab registry and server directly.

Its specs live under `apps/extension/e2e/content/tests/`. Directly in that
directory are actions, clicks, keyboard, select, scroll and waits, checks and
asserts, failures (among them a target behind `auth-gate`'s sign-in form), child
frames, the `identity-*` resolution family, target resolution, large-page
resolution, modal intervention, recorder trust, redaction and selection
redaction, and the upload dialog. Two families have outgrown that directory and
have their own: `extraction/tests/` holds list extraction split by what it
exercises — the catalog fields, pagination, tables, sensitive controls, the
picker, and inference — and `evidence/tests/` holds the page-evidence and
snapshot specs.

The harness loads no extension, starts no background worker and no FluxIQ Core,
and does no tab or frame routing; the content script runs in the page's main
world rather than an isolated one. It proves the content script's own behavior
against a live DOM, and nothing about delivery between extension contexts.
`frames.spec.ts` proves that a child frame performs a command addressed to it
and that the top frame refuses it.

Run it from `apps/extension`:

```powershell
pnpm exec playwright test -c e2e/playwright.content.config.ts --workers=2 <spec>
```

The config runs four workers when `--workers` is not given, on Chromium's full
headless build (`channel: "chromium"`). The Scenario Lab source it imports
resolves `@fluxiq-web-extension/test-contracts` to that package's built `dist/`,
so build the package first (`pnpm --dir packages/test-contracts build`). The
extension package's `test:content` script runs that build and then the same
config.

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
A transient visual-adapter failure is recorded as `capture-unavailable` without persisting exception text; the correlated event remains durable and the tested action is not prevented from running solely because review pixels were unavailable.

Each bundle owns one exclusive append journal for its full staging lifetime. Event writes are serialized, synced before acknowledgement, and the handle is closed before artifact indexing and atomic publication. Journal acquisition retries only Windows transient-lock codes (`EBUSY`, `EPERM`, and `EACCES`) on a fixed 10/25/50 ms schedule; validation, redaction, path, quota, and secret failures are never retried, and writes/syncs are not replayed because a partial append cannot be proven safe to duplicate.

The deterministic LLM preparation command also maintains a separate protected `demo-llm-prepare-status.json` channel outside the evidence bundle. A fixed phase enum is advanced synchronously around browser-operation entry, Flow-open return, the connect diagnostic, extension connection, and evidence finalization. On failure it stores only schema-validated phase/index, allowlisted failure class/code, and an optional allowlisted module/line/column token; raw messages, stacks, paths, DOM text, credentials, and provider values are structurally unsupported. The launcher reads the same bounded schema and can print only those parsed fields.

Callers can designate a credential-entry or credential-bearing submit boundary as `sensitive-action`. The capture controller then does not invoke its visual adapter, but still publishes the correlated before/after event and the suppression reason. Structured redaction remains mandatory because screenshot suppression does not replace textual artifact redaction.

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

### Interactive development session

`pnpm lab:interactive <scenario> --target persistent-isolated --workspace <name>` launches the topology, headed Chromium, current E2E extension, panel, and scenario once, then accepts newline-delimited JSON commands until `stop` or interruption. It is the default development loop for isolated UI/action checks; finite scenario and live LLM certification remain checkpoint tools.

Allowlisted commands cover panel/scenario/extension navigation, click, fill, select, check, bounded wait, structure-only inspect, requested screenshot, and direct `extension-action` dispatch for registered `web.dom.*` actions. There is no caller-supplied JavaScript/eval. Navigation and network traffic stay on exact facility origins. Sensitive fields accept only strict `secretEnv` names and never echo their values; screenshots fail closed while a sensitive control contains a value. Direct extension results discard messages, extracted content, and snapshots, retaining only bounded action identity and status.

Interactive screenshots are retained under ignored `test-runs/interactive-sessions/<run-id>/`; disposable topology state is still cleaned on stop. Explicit local interactive targets may ignore unrelated existing-target configuration, but finite-run target conflict rules are unchanged.

Example input:

```json
{"id":"type","action":"extension-action","actionType":"web.dom.type","selector":"[data-testid=name]","text":"Development check"}
{"id":"click","action":"extension-action","actionType":"web.dom.click","selector":"[data-testid=submit]"}
{"id":"stop","action":"stop"}
```

Install from the repository root with Node 22 and the pinned pnpm 9.15.0:

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

Keep the Core checkout as a compatible sibling of this repository, or set the
documented repository-root environment overrides. Then run one of the finite
commands:

```powershell
pnpm lab run basic-form --seed 1 --evidence events
pnpm lab run basic-form --flow
pnpm lab matrix --all --repeat 1 --evidence failure
pnpm lab inspect <run-id>
pnpm lab bench --corpus smoke --repeat 2 --target isolated
pnpm lab bench --corpus week1 --repeat 3 --target isolated --shards 2 --jobs 2
pnpm lab bench --resume <bench-id>
pnpm lab compare <baseline-report> <candidate-report>
pnpm lab compare <baseline-report> <candidate-report> --sequential
pnpm lab compare <report> --halves
```

`compare` takes benchmark reports, not run ids: two reports, or one report's
repeats split into halves, each metric judged `improved`, `regressed`, or
`equivalent` within the report contract's tolerances. A rate is equivalent
within one workflow of its lane's population, an extraction accuracy or
completeness within one unit of its own — one record, one field, one step — and
a p95 latency within 25% of the baseline's; evidence sizes are reported, not
compared. A metric one report did not measure, including an extraction rate
whose population was empty, is disclosed rather than compared. On a machine whose
`.env.local` configures an existing installation, prefix an isolated command
with `FLUXIQ_TEST_ENV_FILES=none` (in PowerShell,
`$env:FLUXIQ_TEST_ENV_FILES = "none"`).

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
| `apps/extension/build/` | Ignored intermediate extension bundles. Regenerate with `pnpm --filter @fluxiq-web-extension/extension build`; do not hand-edit. |
| `domain/.test-build/` | Ignored generated domain-test artifacts. Regenerate with an unlabelled `pnpm --filter @fluxiq-web-extension/domain test`; do not hand-edit. |

The last two were committed until 2026-09-17, and nothing read the committed
copies. `apps/extension/build/` carries bundled scripts without a manifest,
icons or HTML, so it is not a loadable extension: the Lab and every browser
load `apps/extension/dist/<target>/`, which was already ignored.
`domain/.test-build/` is written and imported inside a single
`node scripts/test-domain.mjs` process, and both domain `tsconfig` files
exclude it. Committing them put generated output in 55 of every 100 commits
and made 40% of all committed bytes build output, and because a sourcemap
keeps its whole payload on one line — over 400KB, and nearly 1MB for the
content script — any two branches that had both run a build conflicted on a
line no merge tool can resolve. The Lab loses
nothing: `scripts/lab/run-lab.mjs` rebuilds what it is about to load before
every run, into `.lab-instances/` when an instance label is set and into the
shared directories otherwise.

`.gitattributes` normalizes the working tree with `* text=auto eol=lf` for a
related reason. With `core.autocrlf=true` and no attributes, `git checkout`
wrote some sources with CRLF while tool-written files kept LF — both clean to
git — and esbuild copies those bytes verbatim into a sourcemap's
`sourcesContent`, so one commit produced different build output in different
checkouts. A build's output is now a function of the commit rather than of the
checkout it was built in, which is what lets evidence from two machines be
compared at all.

Run artifacts may contain page evidence even when synthetic. Keep all captures,
profiles, credentials, cookies, authorization headers, pairing tokens, and
recorded page data out of source control and user-facing logs.
## Live LLM Safety Envelope

Live-provider testing is an explicit opt-in lane and is not part of ordinary deterministic runs or CI. The Testing Lab driver is the sole process allowed to read provider credential environment variables. A case-insensitive explicit provider-secret denylist is removed at the final managed-process boundary and from both direct Chromium launch paths, so Core, Scenario Lab, setup/build commands, the browser, and the loaded extension cannot inherit the source key. Repository-local schema 0.1 contracts describe the LLM task, a non-secret execution profile, sanitized invocation provenance, and review/replay evaluation.

The default Lab allowance is 8,000 input tokens, 2,000 output tokens and 10,000 total tokens per request, a 30-second timeout, a $0.25 per-call estimated-cost ceiling that may only be lowered, and one live run at a time. Validation rejects any request total above the non-overridable 50,000-token ceiling. A live run permits no retries.

Calls per run follow Core's model, not a fixed count. A diagnosis (`--llm-task diagnose`, Core purpose `diagnosis_only`) makes exactly one call. An adaptation (`--llm-task adapt`, Core purpose `diagnose_and_adapt`; `explore_and_adapt` and `build_and_adapt` behave the same way) makes as many calls as it needs, for example to gather evidence between its diagnosis and its patch. Core stops it on the run's estimated-cost ceiling, its token budget, the recovery deadline, or its no-progress guard. `--llm-max-calls` defaults to Core's default of 26 and is only a backstop against a runaway loop: it is refused below 1 or above 64, Core's absolute ceiling. The run's token budget defaults to Core's `max(per-request total, min(per-request total × calls, 100,000))`, and `--llm-max-run-tokens` can lower or raise it. Until Core forwards that field, a lower typed budget is enforced by the Lab's post-run check rather than by the grant. The run's total estimated cost is held to the smaller of $2 and the per-call ceiling times the authorized calls. The Lab sends Core's high-token confirmation only when the run token budget is above 100,000, and records whether it did in `snapshots/live-llm.json`.

The panel-driven adaptation demos type no call count: the panel sends Core none for an adapting run, so Core authorizes its default. Those demos accept a source run that made at least one call per recorded intervention and no more than that default. `pnpm demo:llm:adapt` is narrower for now. Its certificate records exactly one diagnosis invocation and one patch invocation, so it refuses, with a message that says why, a run that spent calls between them.

Scenario/browser traffic remains loopback-only and external side effects remain disabled. Provider control-plane traffic is separately restricted to a trusted Core-owned provider adapter; a Flow, scenario, extension, or CLI caller cannot choose an arbitrary endpoint. Raw prompts and responses are excluded from Lab artifacts. Successful invocations must record sanitized usage, while locally rejected, failed, or cancelled invocations may explicitly record usage as unavailable instead of fabricating counts. A passing evaluation requires a completed, passing zero-LLM replay and cannot attest more invocations than its declared allowance.

The general Lab CLI reaches the real provider through Core's grant when `pnpm lab run ... --flow --live-llm` is given with the `--llm-*` options above. Panel-driven paid certification uses the narrower `pnpm demo:llm:diagnose` command after `demo:llm:setup` and `demo:llm:prepare`. The command drives the real panel UI in the persistent isolated workspace. It selects the stored opaque Testing Lab key summary and saves stricter first-live limits: 2,000 input tokens, 512 output tokens, 3,000 total tokens, exactly one call, zero retries, 20 seconds, and at most $0.25.

The diagnosis command waits for Core's Flow readiness check and requires the
real Runtime Debug Run control to be enabled before and after selecting
diagnosis-only mode. If the prepared Flow has no active instruction, it records
only bounded boolean readiness facts and exits before opening authorization,
creating a runtime run, or contacting the provider.

The setup helper navigates the real Secret Keys Program, reads only its metadata-only snapshot response, reuses one exact compatible global DeepSeek key, or drives Add Key and authorization through accessible UI labels. It never invokes Reveal. The diagnosis command never reads the provider environment variable or secret value. After login, normal LLM grants use the authenticated session's in-memory secret unlock and do not ask for the account password or PIN again. The panel shows a confirmation warning only when preflight total-token exposure is strictly greater than 100,000. Exposure is judged on the run's token budget, and that budget defaults to at most 100,000, so the warning appears only for a run that asks for a larger budget. Secret-key setup and other genuinely privileged credential actions remain screenshot-suppressed.

Runtime target adaptations remain opaque in Core. When Core applies an `edit_action_target`, the web domain consumes the resulting `parameters.target` object as an override and maps its selector, element, or visual target through the existing client-gateway boundary; the generated top-level parameters remain the fallback.

The certification run removes the recorded target on the loopback Scenario Lab, requires that deterministic action failure to precede exactly one `diagnosis` intervention, and validates the trusted Core budget ledger reports exactly one provider call. It rejects any patch/suggestion/proposal kind, adaptation or change-proposal ID, unexpected provider/model/prompt version, invalid or excessive usage, or nonterminal outcome. It then restores the fixture and runs the same Flow through the real UI in No LLM mode; that replay must succeed with zero interventions and zero Core-accounted provider calls. The fixed retained schema contains only run IDs/statuses, bounded invocation provenance/usage, evaluation, call counts, and aggregate leak-attestation totals. It excludes prompt/response bodies, key references, passwords, PINs, action messages, and raw metadata.
Post-run provider-secret attestation is a separate bounded gate. A caller supplies one in-memory literal and exact approved relative paths beneath a canonical workspace. The scanner never follows reparse points or path escapes, reads SQLite databases with their `-wal`, `-shm` and `-journal` files byte for byte and cell by cell, skips only other known binary formats, limits files and bytes, and fails closed when approved text or a store is unreadable or oversized. Reports contain counts, categories, and sanitized relative paths only; they never include matching content or the literal. Live-lane composition must explicitly select run evidence, logs, manifests, workspace metadata, and cache metadata after UI provisioning and every provider-backed test.
