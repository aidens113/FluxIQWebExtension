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

### The live panel beside the page

A headed `lab run`, `lab matrix` or `lab interactive` opens the extension's
panel beside the scenario page, in a 1700x1000 window, so what FluxIQ is doing
can be watched live (`browser-session/live-panel/`). A trusted Playwright click
in the extension control page calls `chrome.sidePanel.open({ tabId })` for the
scenario tab, and the panel counts as open only once
`chrome.runtime.getContexts` reports a `SIDE_PANEL` context. If Chromium
refuses, a popup window of the panel is docked to the right of the scenario
window. The scenario tab is then made active again, so the extension still
drives the scenario page. A panel that cannot be opened never fails the run.
The mode that ran (`side-panel`, `popup`, `none` with both reasons, or
`skipped`) goes to stderr as `[lab] live panel: ...`, to the bundle as
`snapshots/live-panel.json`, and to the interactive session's ready line.
`--no-live-panel` turns it off. A headless run never opens it.

## Instruction-driven web exploration seam

`packages/test-runner/src/web-flow-exploration.ts` provides the web-specific
orchestration boundary for instruction-to-Flow authoring. It captures the
initial page through the production extension action bridge, asks an injected
Core harness gateway to select a bounded subset of the observed same-origin
links, visits those allowlisted HTTP(S) pages, and converts their extension DOM
snapshots into an in-memory `web-flow-exploration.v1` evidence bundle. The bundle includes
every element of each captured page with its identity, accessible text and
same-origin links whole, while discarding input values, sensitive controls,
selected text, credentials, URL queries/fragments, and unrestricted element
attributes. Nothing else is cut: on 2026-09-30 the user ordered that the model
see the whole page, so the 80-element per-page default (150 at most), the
300-character cut on element text, names and titles, the 500-character cut on
selectors, the 80-character cut on roles and the 48,000-byte evidence budget
were all removed. Secret screening is the only filter, and the only bound on
the request is the model's 1,000,000-token context window, which Core enforces
by failing loudly rather than trimming. Page evidence is explicitly marked
untrusted and must not be written to Lab artifacts or logs.

Production composition binds `domain/src/runtime/llm-evidence/` through
`registerWebAutomationRuntime`, called by the web-panel host. The domain
advertises its runnable web node library; Core offers `core.run_node` to run
those registered nodes, `core.describe_nodes` to read their full definitions
(each decision is shown the library by name only, plus the nodes the build
has described; a describe call costs no page capture) and `core.flow_draft` to
author the Flow. The domain's
additional `web.detect_repeating_structure` observation names an extraction structure
without publishing selectors or values; `web.find_on_page` searches the whole
page, hidden elements and every attribute included, and `web.describe_element`
prints one element in full (`page-find/`). All three observe only. A free
initial observation gives the first decision the page already in front of it
(`tools.ts`, `runsNodes.initial`).
These operations use the production gateway bridge and require exactly one
ready, trusted extension with an idle recorder, failing closed on ambiguity.
The old inspect/navigate/press-only catalog is no longer the build's surface:
typing, selecting and reading are available through the registered nodes too.

The model receives every page as the compact view, `web-llm-page.v3` (t223):
header lines (`PAGE`, `URL` on a `~` base, `VIEW`, and `COVERING`, `DIALOG`,
`LOADING` for what stands in front of the page), then one line per element
that has visible words or is a control, in document order, across every
responding frame and open shadow root: `<handle> <kind> "<words>" <state>`,
with `[landmark]`, `- i/n` item and `--- below the fold ---` markers. The
look merges all frames unless a frame is explicitly addressed; a frame that
does not answer is named in a `FRAMES` header line. No element that qualifies
is capped, ranked or cut, and everything else on the page is reached through
`web.find_on_page` and `web.describe_element`. The structured packet the view
is written from (`web-llm-evidence.v2`) stays in the domain, where plan
resolution, stable handles, the state digest and the repair check read it;
the same screens apply to both: sensitive controls, secret-shaped strings,
card numbers and secret-named URL parameter values. See
[page evidence](page-evidence.md#what-a-model-reads-the-compact-page-view).

Opaque `tN` handles (`t1`, `t2`, ...; the older `target.N` spelling is still accepted) bind to observed elements; the runtime resolves and
revalidates a handle before acting. Consequences are declared to Core's
permission gate, including an empty declaration. Money, deletion and
send/publish always require permission when not already permitted; an
instruction alone does not grant those classes. The Lab's person-answering
policy is described [below](#who-answers-a-permission-question-in-a-campaign).
Tool results carry effect state and closed result codes, while Core retains
content-free trace/accounting for diagnosis. The model's own screened reason
travels separately as chat activity rather than becoming an artifact trace.
The complete screened evidence, catalog, draft and history must fit Core's
1,000,000-token request window; an oversized request fails before sending,
with its measured size, and nothing is trimmed to fit.

The build has three phases: live exploration with a model-authored draft;
testing and judgement from the instructed-act checklist; then live repair.
A performed action is evidence until the model adds it to the Flow. No full
replay runs during exploration or at the start of a continuation. An accepted
completion is tested from the Flow's start; a partial non-empty draft whose
round stalls is also tested and judged before repair. An empty draft explores
again while budget remains. Core reports an explicit not-doable, budget or
unreadable-replies ending with its reason, outstanding acts and accounting;
see Core's `docs/architecture/automation-studio/llm-flow-bootstrap.md`.

A refused node call also records a structural `diagnostic` on its evidence
trace row, retained in `snapshots/flow-lane.json` under
`build.evidenceLoop.steps`. It states the refusal code/reason, requested opaque
target handle, whether that target was observed before the action, and its
covering handles/kinds/count. `pageObserved: false` explicitly records a call
that had no pre-call capture; no later page state is substituted. The domain
producer and the bundle reader share a strict field/value allowlist. Labels,
page text, selectors, URLs, input values and arbitrary refusal prose cannot
travel on this account. Core transports the optional object generically and
does not interpret browser handles or covering layers.

Neither production nor Testing Lab web code resolves a provider or invokes a
model itself. Generic provider selection, secret access, budgets,
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

**A build may instead begin nowhere.** Since 2026-09-23 the bootstrap request
carries an optional `startLocation`: where the Flow it writes starts, in the
bound domain's own spelling, which Core carries and never parses
(`!FluxIQ/.../runtime/flow-bootstrap/start-location.ts`). Given one, Core shows
it in the bootstrap context and passes it to this domain on every tool call, and
the domain refuses every call that acts or reads for the Flow with
`not_at_start_location` -- naming where to go -- until the Flow has got there.
A look (the observation node) is the exception since 2026-10-01: it reads the
page as it stands, arrived or not, because it runs nothing and is never a step
of the Flow; only a page that cannot be read -- the blank tab -- answers it
`not_at_start_location`. The domain also names its arrival node and parameter
(`runsNodes.arrival`: the navigation node and `url`), which Core runs with the
start location as the build's opening call. The only call that runs from nowhere is the
navigation whose destination is on the start location's origin; it runs with no
current page, records the start location as the step's replay origin, and the
state digest answers nothing rather than failing the step that reaches the page.
Because the plan is assembled from the steps that ran, the step that reaches the
page is the Flow's own first step. Omitted, a build explores whatever was put in
front of it, exactly as before -- which is right when a person is asking about
the page they are looking at.

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

Live instruction campaigns add a separate created-Flow lane: Core authors a
Flow from the task instruction, the facility reviews and applies that proposal,
then runs and judges it. It is not one of the ordinary `lab run` recording/
recorded-Flow lane choices, and its artifact is described under
[The instruction-created Flow lane and its authored artifact](#the-instruction-created-flow-lane-and-its-authored-artifact).

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
FLUXIQ_TEST_ENV_FILES=none pnpm lab replay <scenario> --workspace <name> --project <project-id> --flow <flow-id> --instruction-task <task-id>
```

A replay disables model wiring before starting its owned Core host:

- it refuses to start when its own environment holds any provider credential
  variable (`PROVIDER_SECRET_ENVIRONMENT_VARIABLES`);
- it explicitly passes `modelProvidersEnabled: false` to the owned topology.
  The child receives `FLUXIQ_MODEL_PROVIDERS_ENABLED=false` before either web
  host `FluxIQ.create` path. Core omits standing result-check, session-key
  execution and chat model/key bindings at construction; ordinary callers
  retain the default enabled behavior;
- it preserves all stored Secret Keys. Private readonly snapshots compare
  every key identity and kind before and after the run, including failures.
  Only counts and the preservation verdict enter the screened report;
- it requests deterministic execution with no `runIntent`. This controls
  adaptive execution separately from constructor admission.

Missing provider accounting remains unknown. Core verification deadline
fallback preserves completed check receipts and cannot certify zero from an
unsettled check or qualify that run as provider-free replay. An explicit public zero count or
complete zero ledger is required, and contradictory counts, paid usage, call
rows, interventions or harness activations reject reuse. Disabled configuration
alone cannot establish measured zero-provider execution. The constructor gate
controls initial host wiring; trusted code can still explicitly bind a provider
later. An accepted usable Flow and its exact task oracles are prerequisites;
an unfinished build is never replay evidence.

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

The actual project and Flow IDs come from the build's screened `snapshots/creation-context.json`; independent chat creation uses a new run-owned project inside the preserved workspace. Pass `--project` for that project. Replay selects and checks that exact scope before lookup or browser launch, with no name search or default fallback on an explicit mismatch. Omitting the option retains legacy workspace-default behavior. The identity snapshot is written before selection/Send and on ending; a failed draft ID alone does not establish a reusable Flow.

The flow id is also named by the build's `snapshots/flow-lane.json`. A build
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

### Only the ten realistic scenarios run

Every Lab or browser test run, live or provider-free, with a model or without
one, opens only the ten realistic scenarios (user rule, 2026-09-29):
`everything-store`, `crossborder-marketplace`, `bigbox-retail`, `job-board`,
`local-classifieds`, `auction-marketplace`, `photo-social`,
`social-network-feed`, `company-website` and `professional-network`. The other
registered scenarios (`basic-form`, `product-catalog` and the rest) stay for
unit tests and fixtures that never launch a browser.

The list has one owner, `packages/test-runner/src/realistic-scenarios/index.ts`,
and every launch entry refuses any other scenario before it starts anything,
with a message that names the entry, the refused scenario, the rule and the ten:

| Entry | Where it refuses |
| --- | --- |
| `pnpm lab run`, `interactive`, `replay`, `matrix --scenarios-json` | `scripts/lab/run-lab.mjs`, first, before the live-run guards, the Core checks and the build, so a refused run leaves nothing in the spend ledger (`scripts/lab/scenario-guard/`). The scenario must follow the command (`lab run <scenario> ...`) |
| The runner's CLI (`packages/test-runner/dist/cli.js`, `fluxiq-lab`) | Right after it parses the command, for the same commands; `matrix --all` runs only the realistic scenarios; `bench` refuses a corpus that names any other scenario, which today is every corpus |
| `pnpm lab:campaign` | Task selection: a task named by id on another scenario is refused; `--kind`, `--all` and a dry run's default choose among the realistic scenarios' tasks only |
| `pnpm ui:e2e` | `scripts/run/ui-e2e.mjs`, before it prepares a workspace, from the scenarios each journey declares (`ui-e2e/realistic-selection.ts`); every provider-free journey opens a basic fixture scenario today, so the suite is refused |
| `pnpm panel:golden` | `scripts/run/panel-golden-path.mjs`, on `FLUXIQ_LLM_SCENARIO_ID` (default `instruction-only-form`, refused) before Core starts |
| Demo workspace browser sessions (`demo:*`, and every `ui:e2e` journey) | `withDemoBrowser`, before the scenario lab or a browser starts; its default page is `basic-form`, so a demo lane that names no realistic page is refused |
| The extension chat check | `runExtensionChatCheck`, before the topology starts |

The Lab's `.mjs` launchers import that barrel from source, before the runner is
built; Node strips its types. The file therefore imports nothing and uses only
erasable TypeScript.

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
  step's `pagination` (up to `maxPages` pages, at most 50) is the Lab reference
  reader's data and the oracle's description of the list. FluxIQ's list read
  reads one page and a Flow pages with a read, a Next page step and a repeat,
  which no recording can produce yet, so the recording and Flow lanes do not run
  a workflow with a paged `extract` step
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
refusal: category `unexpected_state`, code `web.target.not_actionable` for a
target the page would not let be used (covered, disabled); category
`target_not_found`, code `web.target.not_shown` for one that is there and not
shown (hidden); or category `blocked_by_capability_or_policy`, code
`web.action.rejected` for one refused on purpose.

Validation also refuses an `expected.actions` entry, on a workflow or on any of
its variants, whose type no step of that workflow's recording script can yield
(`recordableActionTypes`, `packages/test-contracts/src/recordable-actions.ts`).
A variant never changes the recording, so its entries are judged against the
same script. A `click` step, for example, can yield `web.dom.click`,
`web.dom.check`, and a `web.dom.wait_for_selector` proposed before it. An
`extract` step yields `web.dom.extract_list`, or `web.dom.extract` for a
single-element read: the extraction intent puts one extract node in the
recording, and never the clicks the read makes. A paged step would yield the
same two types, but no lane records one any more (below). A script with no
steps is a playback goal and is not checked.

`flowLaneExclusion` (`packages/test-contracts/src/lane-exclusion/flow-lane-exclusion.ts`)
excludes a workflow from the Flow lane for two reasons. A script that records no
action at all can yield no Flow; before an `extract` was recordable that was
W04 and W08, whose scripts only extract, and no `week1` workflow is such a
script now. A script with a paged `extract` step is excluded too, by
`pagedExtractExclusion` (`lane-exclusion/paged-extract-exclusion.ts`): FluxIQ's
read reads one page and a recording cannot hold the Next page loop a Flow pages
with, so a Flow built from the recording would read the first page of a list
the workflow reads whole. The recording lane skips the same workflows for the
same reason, and its extraction intent refuses a paged step as
`fixture.invalid` rather than record a one-page read. In `week1` that is W05
and W07. Their paging is judged on the created-Flow lane, where the model builds
the loop from the task's words.

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
| `everything-store` | An everything store (fictional Brightaisle) with class names and ids generated per seed, a consent banner, a delayed app banner and notifications modal, a shadow-DOM chat that opens over the buy box, placeholder results, a results tail that loads on scroll, sponsored cards and a sponsored carousel among results, results repeated across pages, a broken Next, prices written twice, `div` pickers, a buy box dead until hydrated, a Save for later that fails once, and a checkout preset to the store's preferences with a payment iframe. Its defences are a search-form honeypot, a 429 rate limit with `Retry-After`, a soft browser check, and a canvas robot check only a person can pass. | Primary (buy a kettle, the playback goal); `add-to-cart`, variant `redesigned-header` (repair); `first-page-earbuds`, variants `deal-wheel` (new popup) and `robot-check` (a hand-off to the person the Lab plays, required, then the workflow's own table; see [the Lab plays the person at a check](#the-lab-plays-the-person-at-a-check)); `plus-under-fifty`, judged only in the created-Flow lane because no recording can pass it. |
| `crossborder-marketplace` | Cross-border marketplace (a signed-in buyer in Germany; 50 listings, 19 sellers, four warehouses): consent banner, delayed welcome coupons, notification prompt and flash-deal popup, a chat pill over Add to cart, results drawn as skeletons with lazy cards, paid placements mixed in and results repeated across pages, a broken Next, a "verify you are human" check on every third results page, items opening in a new tab, div-built option pickers, a shadow-root store coupon whose first claim fails, framed description and payment picker, a checkout honeypot, a rate-limited feed, per-seed class hashes, per-load ids, and locale-formatted prices and dates. | Primary (three hubs and a coupon in the cart, judged by playback goal), variants `basket-redesign` (the recorded repair task, and the created-Flow target-override proof `crossborder-marketplace-hub-to-cart-basket-redesign-after-creation`, armed only for playback) and `flash-deal`; `spain-hubs` (13-record extraction), variant `list-layout`; `place-order` (consequential purchase that must end in a permission request unless the run is permitted to move money). |
| `bigbox-retail` | ValueRidge, a fictional big-box retailer: consent dialog, delayed email offer with a honeypot field, support widget and store picker in shadow roots lying over the buttons that matter, per-seed generated classes and ids, ads that repeat listings and ignore filters, prices drawn in pieces, a bot check on the third results page cleared by press-and-hold or waiting, a Next arrow that drops the filters, an Add to cart whose first press only wakes the page, a stale cart badge, a sign-in wall, rate-limited pickup times whose spinner clears only on retry, a cross-origin card frame, and new-tab links. | Primary (pickup cart for another store, playback goal), variant `redesigned-buy-box` (repair); variant `store-remembered` (step already done: the site remembers Millbrook, so `choose-millbrook` has no target and the page already shows its result); `pickup-towels` (nine listings over two filtered pages), variant `list-layout` (existing-Flow edge case); `pickup-order` (consequential guest order). |
| `job-board` | Job board (Rolefinch) whose Apply hands off to an applicant-tracking site (Talentloom): a shadow-DOM consent wall, a delayed job-alert offer, a chat panel that opens over the job pane, a sign-in wall from the fourth job opened, sponsored cards that ignore filters and repeat real results, a fresh posting that shifts pagination between pages, a broken Next, a rate limiter with retry-after, a first save that fails, a pane that stalls until Retry, a stale badge, salaries in several formats and currencies, seed-rotated classes and ids, and a cross-origin application form in a new tab with a US-first location lookup, a pre-ticked talent pool, a honeypot and a person check. Only four oracle read-outs carry test ids. | Primary (save a week of one employer's jobs), variant `overflow-save`; `remote-rust-roles`, variant `no-exact-matches`; `apply-remote-rust-role`, variant `posting-closed` (expected failure `target_not_found`). |
| `local-classifieds` | Kerbfind Marketplace, a fictional local-classifieds site in the style of the big social-network marketplaces: a cookie dialog that owns the page, a timed notification prompt, a chat window over Make offer, infinite scroll whose one failing batch loads only on Try again, adverts built from the listing card, a listing sent twice across batches, results outside the search straight after the real ones, a shadow-DOM radius picker whose Apply needs a second press, stale counts, a "checking your browser" pause, a contact rate limit, an offer-form honeypot, a cross-origin map frame, and per-seed atomic class names and ids. | Primary (a consequential offer), `bike-search`, variants `list-layout` and `location-check`; `save-dining-tables`, variant `moved-save`. |
| `auction-marketplace` | Auction marketplace (Hammerline, film cameras) built to be hard: consent banner, delayed app promotion, a chat greeting over the bid button, a bot check on the fourth results page, a watch rate limit and a bid-form honeypot; skeleton cards, per-seed class hashes, per-page ids, advertisements in the results, pages overlapping by two, a Next arrow stuck on page two, a sort button that ignores its first press, a Condition filter that drops the buying format; prices in GBP, EUR (`EUR 1.165,00`) and USD beside a pound estimate; a cross-origin description frame, shadow-DOM watch hearts, new-tab links, a variation picker and div buttons; lookalike 35S/Mark II/350 listings, mislabelled item specifics and duplicate titles. | Primary: a consequential bid, playback goal (needs `--llm-permit move_money`). `watch-endings` (state change read back), variant `watch-redesign` (repair). `kestrel-auctions` (extraction), variants `grid-view` and `feedback-survey` (existing Flow). |
| `photo-social` | Photo-sharing network (fictional Framelight): a cookie dialog over a scrim, a delayed notifications prompt, a messages dock in a shadow root that expands over the bottom right, per-seed atomic class names and ids, icon-named div-buttons, a rate-limited infinite grid behind a session check, comments behind a Load more that ignores its first press, lookalike impersonator accounts and a sponsored copy of the giveaway, and a honeypot in the message composer. | Primary (collection of the studio's three most-liked August posts), variant `consent-redesign` (repair task); `giveaway-entries` (valid entries under the pinned rules), variant `verified-upsell`; `ask-price` (the price only a direct message returns, the consequential task). |
| `social-network-feed` | Circleway, a social network signed in as Maya: a home feed loaded in batches behind skeleton cards, mixing friends' and group posts with adverts whose "Sponsored" label is not text, suggestions, shares, carousels and posts shown twice; long posts cut behind "See more"; a cookie dialog, then a delayed notification prompt, then a chat window over the feed's right-hand strip; atomic class names hashed per seed and ids generated as units mount; a group composer with a hidden trap field and a Post button that swallows its first press; friend requests behind a stale badge and a rate limit; a boosted post the site will not edit. | Primary (post in a group), variant `regrouped`; `feed-digest`, variants `quiet-feed` and `app-install`; `confirm-requests`; `move-open-day`, whose only route is a deletion the instruction never asks for. |
| `company-website` | A small heating firm's site: a consent banner in a shadow root, a newsletter offer on a timer, a chat card over the quote drawer's submit, a honeypot and human check, a lazily loaded team grid with stale counts, duplicate cards, a job advert styled as a person, a rate limit and a two-press "Show more", a VAT-switched price list with sponsored rows, and a cross-origin booking widget that takes a deposit. Classes and ids are renamed per seed. | Primary (quote request), variant `redesigned-quote-submit`; `gas-engineers`, variant `winter-notice`; `business-prices`; `book-service`, whose expectations are the permitted run. |
| `professional-network` | Fictional professional network (Guildline): feed, people search, invitation manager and profiles, with a cookie banner, a delayed app prompt, a conversation that opens over the pager, class names that change with the seed and ids with every render, results behind skeletons with promoted lookalikes, a cross-page repeat and a broken Next, a location typeahead offering two Rotterdams, ages inside shadow roots, a connection-note honeypot, and a results endpoint that answers fast paging with a security check (429, Retry-After). Oracles are the search's own matches and an exact set in the page-embedded invitation store. | Primary (withdraw month-old connection requests), variant `redesigned-withdraw-dialog` (repair); `people-search`, variant `premium-upsell` (existing-Flow edge case). |

Six fixtures carry an **extraction catalog** beyond what the corpus asks of
them: the shapes a real page takes, each with the expectation that judges it.
None of these workflows or variants has a Week 1 corpus row, so a `lab run` and
the fixtures' own page specs exercise them and the bench does not — which also
means a `week1` bench measures no paginated extraction: its only paged
workflows, W05 and W07, are skipped on both of its lanes. The catalog's paged
workflows (`numbered-pages`, `link-pagination`, `extract-until-end`,
`extract-by-load-more`) are refused by the recording lane's extraction intent
for the same reason, and their `pagination` stays as the reference reader's
data and the oracle's description of the list.

| Fixture | Workflow or variant | What it pins |
| --- | --- | --- |
| `product-catalog` | variant `sparse-cards` | A card that carries no price, or no rating: the element is absent rather than empty, so the field reads as no value and the expectation names it in `optionalFields`. |
| `product-catalog` | variant `absolute-links` | A link field returns the href exactly as the page writes it, absolute or not. |
| `product-catalog` | `with-images`, variant `lazy-images` | Attribute reads over images: the loaded `src`, its `alt`, and the real source a deferred card keeps in `data-src`. Armed, the two attribute reads swap places. |
| `product-catalog` | `numbered-pages` | `numbered` pagination: all 23 products, three pages, reached through each page control in turn rather than by following Next. |
| `product-catalog` | `paginated-extraction` variant `link-pagination` | The same catalog paged by a link rather than by a button control. |
| `data-table` | variant `large-table` | A 2,000-row table past the 1,000-record extraction cap: the read returns 1,000 records and reports itself truncated, rather than passing a partial table off as the whole one. The variant lists no records deliberately — what matters is that the cap reported itself, not where it cut. |
| `data-table` | `empty-table`, variant `no-rows` | `minItems: 0`, so an empty list is a valid answer instead of a failure; and `column:` fields still resolve against a table that kept its caption and headers and shows no rows. |
| `infinite-feed` | `extract-until-end` | `scroll` pagination: every post, loading more until the feed ends, rather than the posts that happen to be on screen. |
| `infinite-feed` | `extract-by-load-more`, variant `load-more-button` | `loadMore` pagination. Unarmed the control does not exist, so the list is its first page, with no button to wait for; armed, every page after the first comes from pressing it. |
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
[Core action probe](#core-action-probe), resets the fixture and loads the start
page again, selects the project again, starts recording, and waits up to 15
seconds for the extension to report that it is recording. A
start that never arrives fails as `recording.persistence`, and writes the
extension's own account of it, labels and reasons only, to
`snapshots/recording-start.json`.

Each recording-script step is then driven through Playwright as trusted input
while the extension records. An `extract` step's records are asserted against
`expected.extracted` as the step runs, and what the step read is kept before it
is judged and published as one counts-only measurement per extract step in the
run's `evaluation.json` (`run-expectations/extraction/measurements.ts`): the
records compared, the fields that carried a value, the pages the read followed
(one, since the read reads one page), whether it truncated, and how long it
took. A step whose records did not match
is measured too, which is the measurement worth having; a step an expectation
named that never ran is `not_run`; a step nothing expected is `not_expected`;
and a run that never reached its script publishes `null`, which reads as
unmeasured rather than as "no extraction step".

An `extract` step is **FluxIQ's read, not the Lab's**
(`scenario-steps/extract-intent.ts`). The step is translated into a recorded
extraction definition and sent to the extension's own control page as
`fluxiq.test.defineExtraction`; the background worker records `data.extract`
and runs `web.dom.extract_list` through the same command a replayed Flow uses,
and answers with the records. The definition reads one page and carries no
`paginate`. A step that declares `pagination` is refused before anything is
sent, as `fixture.invalid` with `pagedExtractExclusion`'s reason
(`scenario-steps/extract-intent.ts`): sent without its paging it would record
and measure a one-page read of a list the workflow reads whole, and the domain
refuses a multi-page `paginate` anyway. The bench skips such a workflow on the
recording and Flow lanes with the same reason. The step sends no timeout: the
read is bounded by the domain's own budget, because a bound the harness imposed
would be the harness deciding how long the product may take.

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
  empty population and publishes no number. It stays a recording-lane measure,
  and no recording-lane result pages any more, so it publishes no rate there
  either until a page loop can be recorded. The records are still compared in
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
  the code. Beside each step's comparison sits `reads`: what the reads that
  wrote that step's dataset said about **themselves**, and `[]` for a step
  whose reads reported none;
- per attempt, in order: the Flow node it ran and its position in Core's
  attempt order; its action type, status, start time and duration; the ladder
  rung that asked for it, when it is not the node's first attempt; what the run
  did about the state the node expected before it ran; its failure record;
  Core's transition comparison status when Core reported one, kept only when it
  is shaped like one of Core's names; **both** target resolutions, each narrowed
  to closed words and numbers; the read's own account of itself for an attempt
  that dispatched one (`extraction`); and the size in bytes and truncation flag
  of each sanitized evidence packet Core captured before and after it. The
  packets themselves never travel;
- a `recovery` block: which recovery answered for each node, which rungs ran,
  and the busiest node's attempt count (`recoveryAttributionSnapshot`).

The node id is the newest of those and the one the rest depend on. An action
carried none until the recovery ladder existed, deliberately, so that an
identifier could never reach a judgement or a bundle. What changed is that a
node is now attempted more than once: without the id, a node the ladder retried
twice and a Flow that authored the same action twice produce the same flat list
of attempts, and no rung can be attributed to anything. It is admitted only when
it has the shape of a Core node identifier, so a value carrying page text is
read as absent.

The two target resolutions answer different questions and are named apart.
`targetResolution` is Core's own, its pre-dispatch choice of candidate.
`hostTargetResolution` is the browser's `WebAutomationTargetResolution`, which
names the `strategy` it actually found the element by; it reaches Core inside
the dispatched result payload, and Core projects it onto the attempt
(`runtime/service/summaries/host-target-resolution.ts`). That strategy is the
only evidence of the recovery that has no ladder rung, because the browser
re-resolves a renamed control before Core is told anything failed -- so a
`fingerprint` or `scored-candidate` strategy on a **succeeded** attempt is the
record that a rename was survived.

### The instruction-created Flow lane and its authored artifact

**Authoring mode (t338).** Whether this lane can build at all is Core's one
authoring-mode setting, `FLUXIQ_AUTHORING_MODE` (Core `model/authoring-mode/`):
`legacy` (the default) or `candidate`. The Lab gives every Core it starts the
run's `--authoring-mode`, or `legacy` when the run names none
(`packages/test-runner/src/live-llm/authoring-mode-env.ts`, used by
`buildFluxIQEnvironment`); a value inherited from whoever launched the Lab is
dropped, and a value Core would refuse is refused by the Lab's command parse,
through Core's own resolver, before anything starts. The run's plan records it as
`coreAuthoringMode`, which `snapshots/live-llm.json` and the dry run's `live`
record carry. In `legacy` mode the lane runs as it did before t330 (downstream
`92d790d7`): the chat's create-here builds, approves and applies its own proposal,
a direct build is approved and applied by the Lab, and the Flow is run and judged.
In `candidate` mode Core only saves an unverified candidate draft that nothing
executes, verifies or promotes yet, so `assertCreatedFlowVerificationReady`
(`flow-lane/creation/readiness.ts`) refuses with
`lab.candidate_verification_unavailable` at stage `before_provider`: in the Lab
command before any topology starts, and again at the lane, the chat build, the
direct build and approve/apply. Only Core's exact `legacy` admits; no caller
verdict lifts the refusal. Should a Core answer with a draft anyway, the lane
records it as `outcome: "draft"` and fails as a facility contract, never as a
created Flow.

Live instruction campaigns use a third, distinct lane. The created-Flow lane
does not derive a Flow from a recording: Core builds one from the instruction,
the lane applies the reviewed proposal, runs the persisted Flow, and judges the
fixture result. Its `snapshots/flow-lane.json` records the bounded task request,
build and review records, Flow id and shape, whether the Flow reached its own
page, the runtime run and action evidence, extraction judgement, and any
partial progress available when the lane stopped. A failed build or run does
not erase the preceding stages by replacing the artifact with an all-or-nothing
success record. A lane that stopped after its build proposed a Flow and the
proposal was applied still created that Flow, so its `evaluation.json` reads
`flowCreated: true` though nothing ran (`selectLaneObservation`'s
`stoppedLane`; `run-musq0b1m-0472cfa0` read "Flow created: no" for a Flow that
existed).

Before playback the runner closes every fixture tab other than the one playback
drives -- the tabs the exploration and the build's tests opened, on the
fixture's origin or blank -- and never the extension's own pages, so a Flow
starts with only its own tab open (`run-scenario.ts` `prepareFlowPage`).

A 400 from Core on an Automation Studio call is Core refusing a value the Lab
sent, and fails the run as `facility.contract`, naming the endpoint and Core's
sentence (`existing-fluxiq-control.ts`). It was filed as `environment.missing`,
so a campaign read the run's "LLM estimated-cost limit is invalid." on its own
Flow settings as an installation fault (`run-musq0b1m-0472cfa0`).

#### The build is started from the extension's chat window

User order, 2026-10-01: live runs prompt the model building the Flow through
the real extension chat. So the created-Flow lane starts every build the way a
person does. It types the task's instruction into the chat in the panel beside
the page and presses Send (`flow-lane/creation/chat/`,
`run-scenario/chat-build/`).

The order of a chat build:

Independent creation first creates and selects a new run-owned project through public authenticated control, before browser launch, pairing and chat/person scopes. It preserves every existing project, draft, conversation, recording and browser profile. Before Send, the Lab opens the new project through the mounted extension chat and waits for its authorized project-scoped thread list and matching thread tail, including an empty list, to settle. The rendered chat scope must name that project and be ready; browser recording/session status is not chat scope. This prevents old project conversation and Flow catalog from turning a new creation test into an improvement request. Ordinary repair/replay keep their existing scope. The screened creation-context snapshot records run/workspace/project/domain, Flow ID when known, outcome and exact saved hash when readable; persistence failures remain failures. This isolation does not substitute a capability or bypass normal chat.

1. **Present the page.** `prepareFlowPage("build")` leaves the fixture's entry
   point on screen, even for a task whose playback starts blank
   (`flowStartPage({ startedFromChat })`). The chat tells Core the page the
   person has open, and that page is where the Flow starts.
2. **Install the key.** `LiveLlmRun.chatBuildAuthorizer` puts the run's key
   in the person's Secret Keys and re-signs the session. The paired
   extension's chat runs on that unlocked session. Nothing is pinned to a
   Flow, because there is no Flow yet.
3. **Type and send.** The run selects its project for the paired client, opens that project in the mounted chat and waits for actual rendered readiness.
   Then the panel's own composer, controller and background relay carry the
   message to Core's `append-turn`. The panel is driven through
   `extensionViewPanelDriver` from the control tab, which reaches Chrome's
   real side panel or the docked popup.
4. **Follow the build.** `buildCreatedFlowFromChat` reads Core as the person
   would:
   - the chat thread for the person's turn, FluxIQ's answer, and the
     `panel-capability-result` turn of `flow.createHere`;
   - the project's Flows for the one the chat made (Subflows, listed as Flows
     of their own, are not counted);
   - that Flow's proposal for what the build did and spent.

   Core's `flow.createHere` creates the Flow, saves the instruction, explores
   from the page, and approves and applies its own proposal. So the lane
   neither builds nor reviews anything itself.
5. **Answer questions in the chat.** Questions the build raises land in that
   chat, which is the project's own thread (subject `project`). The Lab's
   person answers them there by pressing the panel's Allow or Don't allow,
   or the option's label (`answerInChat`). It decides by the same rule as
   before, the task's `permissionPoint`. Each answer records
   `via: "chat" | "core"`. A run's question on its own thread is still
   answered through Core.
6. **Hand on.** The Flow then goes through the unchanged stages: read, run,
   judge, repair, replay, and the verdict.

Every ending is a build record carrying `chat` (`CreatedFlowChatRecord`):
places in the thread, `became` (`build`, `no_build` or `other_capability`),
`ending` (`created`, `awaiting_permission`, `failed` or `no_result`), counts of
asks, `readWithoutModel`, and `said`: FluxIQ's own last words about the
instruction, whole, on every ending (`null` only when no answer or result
arrived). A created ending used to keep its kind and timing but not the words
(`run-musp8nz1-dbd3905a`, cause R1). `snapshots/flow-lane.json` names
`buildEntry: "chat"`.

A build that left a proposal also carries `judged` (`CreatedFlowBuildJudged`):
the judged `yes` the build finished on, as Core records it on the proposal's
`created` audit event (`buildJudged`, Core's
`flow-bootstrap/unfinished-build/finishing-verdict.ts`). It holds the round,
`judgedAt` (`finished_round`, `judging_reserve`, or `stopped_short` for a round
that stopped short with a clean, changed Flow and was judged), sha256 digests of
the judged test's Flow signature and of the Flow the build finished with,
`matchesStandingFlow`, the judge's `confidence` where Core recorded one, and
`unconfirmed`: only whether the judge gave advice beside its yes
(`adviceGiven`) and its `patchNeeded`, never the advice's words. That advice is
unconfirmed and never a repair directive; in `run-murwd8le-79e735a8` (cause 10)
a yes advised removing a step that the Flow needed. `judged` is `null` on a
build with no judge, a refused build, or a Core older than the record. Before
it, "finished on a judged yes about the standing Flow" was provable only from
`core.log` order (cause R2).

A chat that built nothing fails as "FluxIQ's chat did not build a Flow ...; it
said: ...", in FluxIQ's own words. The build settlement's "reached no
provider" is kept as its cause and never replaces it.

What the chat cannot carry is refused before anything starts
(`LiveLlmRun.assertChatBuildable`, `commands.ts`):

- `--llm-permit`. The chat sends no permit; the person answers at the point
  instead.
- `--llm-max-cost-usd` below Core's per-build ceiling (below).
- A model other than the default the run's Core was started with. That
  default is the run's `--llm-model`, which the Lab passes to Core (see "The
  default model" below), so `--llm-model deepseek-v4-pro` builds on it from
  the chat.
- `--no-live-panel`, or a panel that did not show (`environment.missing`).

Two limits come with the chat path:

- Every build is held to one per-build ceiling however it is started:
  Core's run cost ceiling, `FLUXIQ_LLM_RUN_COST_CEILING_USD` (default $0.10,
  passed by the Lab to the run's Core), lowered by the Flow's own
  `maxEstimatedCostUsdPerRun`. Core computes it for every
  `generate-flow-bootstrap-adaptation`, and the chat's `flow.createHere` makes
  that same call. The run plans with the same value (`plan.buildCostCeilingUsd`,
  `live-llm-plan.ts`), lowered by `--llm-max-cost-usd`, and a direct build
  writes it onto its Flow. A chat build's Flow is made inside Core's command,
  so a lowered ceiling has no Flow to go onto: `--llm-max-cost-usd` below the
  run's ceiling is refused for a chat build (`assertChatBuildable`). A run's
  total is the sum of its builds, which is why a chat build plus the Flow's
  repair can pass the ceiling with every build under it
  (`run-muq66ff9-cb3767a1`, under the earlier $0.25 ceiling: build $0.098,
  reauthors $0.160, $0.043 and $0.011, result check $0.012).
- A chat build that fails leaves no readable record of what it spent. Core's
  diagnostic reaches the thread's sentence only, so such a build's accounting
  is `null`.

`--direct-api-build` is test-only. It is the old path: a blank Flow, the Lab
calling `generate-flow-bootstrap-adaptation` itself, and the Lab's own
review. A run started that way fails `fixture.invalid` at the end, whatever
its Flow did, so it is never counted as a pass.

The headed, provider-free proof is the extension chat check's build claim
(`extension-chat-check/prove/chat-build.ts`). It runs the same stage against
an isolated Core with no model key:

```
node packages/test-runner/dist/extension-chat-check/cli.js --browser chrome --scenario everything-store --page ./ --no-ask --build
```

The claim holds when:

- Core reads the message without the model as `flow.createHere`, with the
  message as its instruction;
- Core creates the Flow and saves that instruction;
- the build stops on the locked key, and the thread says so;
- the stage records a failed build of that Flow.

`authoredNodes` makes the created Flow diagnosable without persisting its raw
document. There is one entry per action node, carrying `nodeId`, `definitionId`,
`outputId`, screened `parameters`, and `parametersWithheld`. The producer uses
Core's `automationStudioScreenedNodeParameters`; the test-contract validator
then rechecks the bounded tree, denied keys, identifiers, origins and withheld
paths before the snapshot is accepted. A navigation parameter may therefore
retain only its transformed safe origin while also naming `"url"` in
`parametersWithheld`: the origin is useful authored structure, and the original
path, query and fragment did not enter the artifact.

`authoredGraph` records the rest of the same Flow, read from the same `get-flow`
documents as the nodes (`creation/graph-read.ts` observes that one read rather
than repeating it). `controlNodes` lists every node that dispatches no domain
output, as `nodeId` and `definitionId`; `edges` lists every edge of the Flow and
its Subflow graphs as `edgeId`, `sourceNodeId`, `sourcePortId`, `targetNodeId`
and `targetPortId`. Identifiers only: no label, description, metadata or
parameter, and an id not shaped like a Core identifier is never carried. A port
the document did not name, or an edge id that is malformed or repeated, is
`null`; a control node or edge whose own id or endpoint is malformed, or that
falls past `AUTHORED_FLOW_GRAPH_BOUNDS` (128 control nodes, 512 edges), is
counted under `omitted` instead. The test contract `validateAuthoredFlowGraph`
(`packages/test-contracts/src/authored-flow/`) rechecks that shape. It exists
because run `mut4fvkm` could not show which path its playback took:
`authoredNodes` held no merge node and no edge was on record, so a state route
that passed over two nodes read as a revision mismatch. An incomplete snapshot
carries `authoredGraph: null` until the Flow has been read.

Created-build decision rows also carry Core's bounded progress instrumentation
through the same shape screen on both proposed and refused builds. `progress`,
`draftChange`, `draft`, and `answerability` are optional additive records with
closed runtime shapes: draft revisions, counts, flags, states and issue codes.
`draftChange.targetedStepIds` is the only list admitted inside one of these
records; it is accepted atomically only when it is bounded, string-only,
duplicate-free and syntactically valid, rather than filtered or truncated into
a different target claim. Core owns the stronger provenance guarantee that
those ids are stable, build-local and not content-derived. The downstream
screen enforces bounded syntax and rejects digest-shaped ids, but syntax alone
cannot prove where an otherwise valid identifier originated. Generic nested
lists remain excluded, as do instruction or draft prose, prompts or responses,
selectors and URLs. The resulting rows are embedded unchanged in both
`snapshots/flow-lane.json` and `snapshots/live-llm.json`; provider-call grouping
and token/cost accounting continue to use only iteration and usage fields.

The four optional progress records are additive for an older Core that omits
them. The sanitizer change is narrower: digest-shaped strings no longer travel,
and nested scalar lists are not accepted generically; only the atomically
validated draft-target path above is added. Existing scalar and top-level
scalar-list fields retain their prior screen.

This is an artifact contract, not a claim that the current provider-backed
hard scenario has passed live. A campaign result must supply that evidence.

#### Every fact's value, and result checks kept apart from recovery

A pass is recorded with what it was compared on (t174-w84, after
`run-murwd8le-79e735a8` passed with no fact value anywhere in its bundle).
`snapshots/flow-lane.json` `oracles.facts` lists every final-state fact,
held or not: its subject, the expected text, and the value read on the page
that was judged (`judgeEveryFact`, `flow-lane/creation/oracles.ts`). A
scenario that declares a secret has every observed value withheld, the rule
the unheld facts already followed. A failure's `details` still carries only
`unheldFacts`.

Core files each post-run result check as a run intervention whose
`metadata.source` is `verifyAutomationStudioRunResult`. The Lab reads that
source (`isResultCheckIntervention`, `flow-lane/harness-recovery.ts`) and
files those calls as `harnessRecovery.resultChecks`, never as recovery.
`interventions`, `attempted` and `harnessActivations` count recovery only.
In `snapshots/live-llm.json` they appear as `repair.resultChecks`
(`record: "verification"`), and in `events.ndjson` as "The created Flow's
result was checked". Spend totals are unchanged. Before this change, a run
that needed no repair reported its two result checks as two diagnoses and a
"repair attempt".

### How the created Flow's playback adapts

A created Flow's playback runs with Core run intent `explore_and_adapt`, and
the Lab holds it to the product's own adaptation mode, `fully_adaptive`, in
both places Core reads one: the Flow's stored `adaptationMode`, written with
its LLM settings (`live-llm/flow-settings.ts`), and the run request, which
then carries no `adaptiveMode` override (`flow-lane/persisted-flow-run.ts`).
One rule decides both (`liveFlowAdaptationModeOf`). Core reads a stored
`manual_approval` as manual proposals even without an override, so either one
alone would hold every repair as a proposal: no automatic promotion, no resume
from the trial, no apply after a judged whole run. Until t267 both said
`manual_approval`, so no Lab run before it could show a repair continuing the
run or persisting itself. Every other intent and purpose (`--llm-task adapt`
or `diagnose`, a result check, a build) keeps `manual_approval`, which keeps a
diagnosis or a build from applying itself. A recorded Flow's `--llm-task
repair` is `explore_and_adapt` too, and runs under the same rule.

`--replays N` then proves whatever the run left. An adaptation Core already
applied counts as applied and is not reviewed again. A re-author Core built
and applied inside the run, after a wrong answer or after a failed step the
patch ladder could not adapt, leaves the same `resultReauthor` marker and no
proposal, and is replayed directly. Its replays must reproduce the rows the
run stored when it stored any; a run that stored none, such as a form task,
is replayed on its goal alone, with zero provider calls
(`flow-lane/repair/run-repair-lane.ts`).

### What a list read says about itself

A read of zero records is the same record, everywhere else in the bundle,
whether its `item` selector named nothing, the page genuinely held nothing, or
its `where` conditions rejected every row -- and the three want three different
repairs. `run-muhrf6c4-9714939f` published `observedRecords: 0, comparedRecords:
0, expectedFields: 0` against an expectation of 13 records, which says the
answer was wrong and nothing about why.

The read had already computed the answer. `web.dom.extract_list` reports a
summary of its own read (`domain/src/actions/extraction/summary.ts`): the
records returned, pages covered, matched items (`itemsSeen`), wholly empty
records (`emptyRecords`), whether a cap cut it short, which required fields a
row did not yield, whether the list it waited for ever appeared
(`listPresence`), what ended that wait and how long it took (`listWait`), and
what each `where` condition kept and rejected. It reached Core on the
dispatched result payload and stopped there, because the run detail reduces an
attempt's outputs to names and counts. Item-read and page-advance faults remain
bounded result prose; they are not members of `RunExtractionRead`.

Core now projects it onto the attempt as `metadata.extraction`
(`runtime/service/summaries/extraction-summary.ts`), exactly as it projects the
host's target resolution and for the same reason, and the Lab reads it into the
bundle (`flow-lane/extraction-read.ts`) under the published contract
`RunExtractionRead`. It is published twice: on each extract attempt in
`actions[]`, and on each judged step in `extraction.steps[]` beside the oracle's
comparison -- both, because a Flow may hold more extract nodes than the workflow
judges, and a read no step paired with is exactly the one nothing else records.

Counts, booleans, one word from a closed set, and record field keys, and nothing
else. A field key is 1 to 100 characters of `A-Z a-z 0-9 _ -`, so it holds no
space and therefore no page text, selector, URL or sentence; the same keys are
already published in full under `authoredNodes[].parameters.extractList.fields`.
A summary the reader cannot rebuild whole is absent rather than half-read, and
an attempt that reported none publishes none.

### Who answers a permission question in a campaign

Nobody is watching a campaign, so a build that stops to ask a person waits for
an answer that never comes. Since the permission gate learned to park, a build
can finish, leave a proposal and carry the unanswered question on it; Core then
refuses to approve or apply that proposal (`FLOW_BOOTSTRAP_PERMISSION_REQUIRED`).
Until 2026-09-23 the first anyone heard of it was that refusal, as an HTTP 400
on `review-flow-adaptation`, and a campaign recorded the row as
`environment.missing` — a verdict about the installation, for the product doing
exactly what it was built to do (`run-mudt5jr5-92321d8c`, 24 provider calls and
$0.12 that measured nothing).

Three things keep that from happening, and they are in order of authority.

**The instruction is the authority.** Core permits any class it reads the
person's own instruction as asking for, whatever the run permits, so the
ordinary consequential task needs no `--llm-permit` at all
(`runtime/action-permissions/gate.ts`).

**A task may declare what its own instruction asks for.** `LiveInstructionTask`
takes an optional `permits`, the consequence classes in Core's closed
vocabulary, and a campaign passes exactly those as that one task's
`--llm-permit`. This is the corpus's second opinion, for the case where Core's
reading of the instruction and the model's declaration of its own action
disagree. A task that names none permits none: a task nobody has judged never
authorizes an act on its own, and a campaign-wide `--llm-permit` would hide the
over-declaration the measurement exists to find. An operator's own
`--llm-permit` after `--` replaces the task's, because the Lab refuses an option
given twice and somebody running one task by hand is the person the question is
for.

**A build that still parks is a product result, read off the proposal.** The
build record's `outcome` is `permission_required` — the same ending as a build
that died on the request, and reported as one — and the run fails as
`runtime.behavior` with `permission.required` and the classes a later
`--llm-permit` would have to add. Nothing is asked of the review surface, so no HTTP status
stands in for the answer.

The row says which of those happened. `buildOutcome` is the build's own ending,
and `consequences.answeredBy` is one of:

| `answeredBy` | What it means |
| --- | --- |
| `instruction` | Every class declared was one the instruction asks for. No permit was involved. |
| `campaign` | A class the instruction did not cover was held by the task's own `permits`. |
| `nobody` | Neither held it. The build asked, and the campaign had no answer. |
| `nothing lasting` | Every action said it would cause nothing that stays. |
| `not recorded` | Core published no declarations for this build at all. |

Beside it the row carries what the build's acting steps declared, how many
actions were put to the gate and how many declared nothing, Core's cross-check
verdict — `undeclared` naming a class the instruction asks for that nothing
declared — and the request itself, cut to its verb, control kind and classes.

**All of it is read from `metadata.bootstrap`, and from nowhere else.** The
top-level `adaptation.instructedConsequences` this facility read until
2026-09-23 is never populated for a bootstrap proposal:
`bootstrapAdaptationAsFlowAdaptation` projects all four members —
`instructedConsequences`, `declaredConsequences`, `consequenceCrossCheck` and
`permissionRequest` — under `metadata.bootstrap`. Every build measured before
that date therefore reported an empty declaration while the stored proposal
held a full one.

### The Lab plays the person at a check

A check that asks "are you a robot" is asking the person, so FluxIQ never
presses, types into or reloads one. When a build or a run meets a check only a
person may pass, Core puts one question in the Flow's thread — a `choice` ask
with `control.kind: "person_check"` and the options `person_done` (Continue)
and `person_stop` (Stop) — and waits where it stands, for up to 300 s: a build
on the Flow's thread (subject `flow`), a run on its own (subject `run`). Until
2026-09-30 the harness answered no ask, so every run that met such a check sat
out the five minutes and ended `user_intervention_required`, which read as
FluxIQ failing when it had done the right thing.

The Lab now plays that person (`packages/test-runner/src/person-simulation/`).
For the whole of a Flow lane — the created Flow's build, its run and any
replays, or a recorded Flow's run — it reads the project's threads once a
second through `list-conversations` and `get-conversation`, and answers each
person-needed ask once through `answer-ask` (`kind: "choice"`, the option as
`value`). A permission ask is answered only in the created-Flow lane (below);
every other ask is left for its own answer. For each person-needed ask it:

1. finds the scenario tab showing a check the fixture's person module knows,
   among the tabs on the scenario's origin, newest first, looking for up to
   8 s because a check raised by a click can take seconds to draw;
2. brings that tab to the front and does what a person does there;
3. waits for the check to go — for a check that leaves by loading a new
   document, only once that load has happened, because crossborder's box
   turns into "Checking your browser…" two seconds before its reload;
4. answers Continue if the check went, and Stop otherwise.

What a person does at each check is data beside the fixture, in
`apps/scenario-lab/src/scenarios/<scenario>/person-check.ts`, exported as
`PERSON_CHECKS` through the scenario's barrel and loaded from the scenario lab
build the run uses, as a scenario's `repair.js` is. The scenario lab carries no
browser library, so a module says what the check shows and what the person
does (`click`, `press-and-hold`, `type-answer`, `press`), and the runner does it
with Playwright. The typed shape is `ScenarioPersonChecks` in
`packages/test-contracts/src/scenario.ts`.

| Scenario | Check the Lab recognises | What the person does |
| --- | --- | --- |
| `everything-store` | "Enter the characters you see below" | Reads the characters from the store's state (`robotCode(challengeSeed, guard.robot.image)`, from `/__control/final-state` with the controller token), types them into "Type characters" and presses Continue shopping. Never "Try different image". |
| `crossborder-marketplace` | "I'm not a robot" | Presses the box and waits for the reload. |
| `company-website` | "Confirm you are human" | Presses the box, which submits the quote. |
| `bigbox-retail` | "Robot or human?" | Holds Press & Hold for 2.5 s. The check also passes itself for an automation that waits, so only a hand-off FluxIQ raised anyway reaches it. |

The person answers Stop, and says why, when no tab shows a check the Lab knows
(`no-check-visible`: FluxIQ asked a person for nothing), when the check stayed
(`could-not-clear`), when the row says the person declines (`declined`), and
when the check already shows the automation's hand on it — the everything
store's wrong answer or a later image (`declined-tampered`).

**Every hand-off is in the run's evidence.** `snapshots/person-hand-offs.json`
holds, for each: the ask id, the stage (`build` or `run`, from the thread's
subject), the scenario, the check found, what the person did, whether it
cleared, the answer, and the seconds FluxIQ waited from the ask to the answer,
with the Lab's own reason for anything but a clear — never page text. Each is
also a `runtime.settle` event on the run's timeline at the moment it was
answered, and the campaign row carries the same record as `personHandOffs`.

**The person also answers a permission ask, in the created-Flow lane.** A build
or a repair that reaches an act the run was not permitted (a `move_money`,
`delete` or `send_or_publish` act asks every time) parks on a `permission` ask
keyed by its request id and waits up to 120 s. Given the task's
`permissionPoint`, the Lab answers `grant` when the ask stands at that point —
the same judgement the lane scores with (`flow-lane/creation/permission-point.ts`:
the class in `missing` and the control label equal) — and `deny` anywhere else,
on a control Core left unnamed (the person cannot tell it is the task's act), or
when the task declares no point; a task with `askFirst` has its
ask left for Core's timeout. Each answer is recorded apart from the hand-offs, as
`permissionAnswers` in the same snapshot (ask id, stage, missing classes, the
control as Core named it, verdict, answer, seconds waited), so the hand-off
invariant scores nothing new. The lane then passes a consequential task's Flow
only if Core's own record on the Flow's thread shows a grant at the point on the
named control (`permissionPoint: "not_asked"` otherwise), unless the operator permitted the
class; a build that still ends on its request is `stopped_for_permission`,
never a pass. The Flow's playback needs no second answer: a saved Flow replays
with no permission gate, and only a repair's exploration is gated, which parks
on the run's thread and is answered by the same rule.

Every realistic-site consequential task declares that permission point,
including purchase, binding bid, post, quote request and offer submission.
Variant rows sharing an instruction share its point. A task without one must
appear in `ASKS_NOTHING` with a reason in
`apps/scenario-lab/src/scenarios/tests/live-instructions.test.ts`; a new
unclassified task fails the coverage check. The Lab plays the person at the
declared consequential control, not a blanket grant before exploration.

**A hand-off at a real check is correct.** The evaluation's
`person-hand-off` invariant (`run-evaluation/person-hand-off-invariant.ts`),
applied by both `lab run` and the bench from the same file, passes a run that
handed off at a check the Lab found and then went on, whether or not the row
declared one. It fails a hand-off where no check stood, a check already
tampered with, a hand-off the Lab could not play, and a row that requires a
hand-off and got none; a failed invariant fails a run the runner passed, as
`runtime.behavior`.

**Where a hand-off is expected is declared, not inferred.** The declaration is
`ExpectedPersonHandOff`: `person` (`completes`, or `declines`, whose row then
declares `expected.failure: user_intervention_required`), `required` (whether a
run with no hand-off fails), and one sentence of `because`. A row declares it in
its scenario's person module (`handOffs`); a live instruction task declares it
as `personCheck`, which wins over the row's. It is not an `expected` field,
because `ScenarioExpected`'s validator is closed.

| Declared on | Expectation | Why |
| --- | --- | --- |
| `everything-store` `first-page-earbuds/robot-check` | completes, required | The store answers every page with its check until a person passes it. The row then expects the workflow's own sixteen records and a page the check has left, and repair task `everything-store-refuse-robot-check` is `expect: "hand-off"`: it passes on a hand-off at the check, no patch around it, and the final state after the person's pass. |
| `crossborder-marketplace` `spain-hubs` (and `list-layout`), tasks `-spain-hubs` and `-spain-hubs-list-layout` | completes, not required | The filters the honest path narrows by are the third results load, which the traffic screen replaces; a Flow that reaches the filtered results in fewer loads never meets it. |
| `company-website` primary (and `redesigned-quote-submit`), both quote-request tasks | completes, not required | Sending the quote form raises the human check. |

A task whose honest path meets no check, such as `crossborder-marketplace-hub-to-cart`,
declares nothing. A hand-off there at a real check still passes the invariant
and is named as undeclared; one where no check stood still fails.

### What a build's reported calls are

A build's `providerCalls` is **every** provider call it made, from the
proposal's `totalProviderCallCount`. It used to be the evidence loop's
decisions alone and was short by every call Core makes outside the loop — the
instruction-authority derivation, which asks the model what the person's
instruction already asks for. Those calls are spent against the build's token
and cost budget, so a build could die on its budget for calls no count
explained. Core publishes them as `additionalProviderCallCount` and their sum as
`totalProviderCallCount`, beside the two loop counts rather than inside them,
because folding the extra call into `providerCallCount` breaks the bounded
contract this facility holds an audit record to and fails every evidence-guided
build before its Flow is read (measured, `run-mudna2ng-ceadeb69`). The loop's
own count stays on the record as `loopProviderCalls`; the difference between the
two is what Core spent outside the loop. A record whose total is not the loop's
calls plus the ones outside it is refused rather than reported
(`existing-fluxiq-control/adaptation-evidence-loop.ts`).

A live run's totals (and so its spend-ledger entry) also count the calls Core's
records leave out, from the run's own step log (`steps/*/meta.json`,
`live-llm/step-log-spend.ts`): the extension chat's interpreter call, as a
`chat` phase, and the calls of a re-author Core recorded a cost for and no
count. Anything else the log saw is added as `unattributed`, never subtracted
(`run-muqk713g-d08ad3dc`: 17 counted of 35 calls before this).

The same log gives `live-llm.json` its per-call rows: `observed.observedCalls`
is one row per provider call in `steps/`, each with the request id, task kind,
stage, provider, model, tokens and cost its `meta.json` names
(`live-llm/call-rows.ts`). A row takes the prompt version and validation
verdict from Core's own per-call line for the same request id, since the step
log writes neither; a Core line whose request id the log lacks is kept after the
log's rows. The rows used to be the settled phase's alone: for a created Flow the
build's decision rows, all without identity, and no row for the chat, the
instruction reading or the judges (`run-musq0b1m-0472cfa0`: 27 null rows, 4
calls missing). A campaign row reports the run's whole spend,
`runSpend.totalEstimatedCostUsd`, as `Cost USD (reported)` with `spendSource:
"run"` (`scripts/lab/live-campaign/row/reported-spend.mjs`); the build's own
figure left out the chat's call ($0.211519044 of $0.212718924 in that run).

`live-llm.json`'s `reauthor` record lists every re-author build Core recorded on
the run (`metadata.resultReauthor.attempts[]`, `live-llm/reauthor-record.ts`).
Each build says where its `calls` came from:
- `loop`: the build loop's provider call count.
- `loop_decisions`: a failed build's decision count, one paid call each, where
  the loop kept no call count.
- `adaptation`: the succeeded build's adaptation.

A failed build's `ending` is Core's build ending in closed words and counts
only (`flow-bootstrap/generation-failure/build-ending.ts`): its kind, the
`bound` of a `budget_exhausted` ending, rounds, decisions, steps, whether the
Flow was tested, each round's stop, and the no-route kind where Core allows one.
Never its message or what was not done.

`try` is 1 for the first build on a brief and 2 for Core's one automatic
rebuild, which happens only after a named transient provider failure (t262).
Core writes no try number, so the Lab derives it. An entry is try 2 when the
entry before it is a try 1 with the same brief record and the same `attempt`,
and that build failed without an adaptation at `provider_request` with
`retryable: true`. An entry with no brief has `try: null`.
`run-musp39u8-9ac026ab` booked both of its builds as `calls: null` and kept
neither ending.

### When Core is still writing a run

Core saves a run in stages: the status its steps earned first, then the verdict
on its result, and for a failed run its recovery record. A reader that takes the
first save as the whole run reports a pass the verdict may be about to take
away, so the Flow lane waits (`flow-lane/terminal-run-wait.ts`). What it does
when the wait runs out depends on which of the two is missing, because they are
different in kind.

**A missing verdict fails the run**, as `performance.budget` with `pending:
"verdict"`. It decides the run's outcome, and a measurement that can report a
false pass is worse than one that reports nothing. It keeps the live run's
whole ten-minute deadline (`LIVE_LLM_RUN_WAIT_MS`).

**A missing recovery record does not.** The run is returned as it stands and
marked `unsettled: "recovery"`, which the Flow-lane snapshot and the campaign
row both carry, so a reader can tell "Core recovered nothing" from "Core never
said". The record is evidence *about* a run whose outcome is already written,
and nothing that judges a created Flow reads it. Failing the run for its absence
threw away a complete product result: on `run-mudslg9p-c59266aa` a Flow was
built, ran, failed, Core's repair made its two calls, no record arrived, and the
run spent ten minutes waiting before being reported `performance.budget`. It
For older details without a recovery-state marker, `RECOVERY_RECORD_WAIT_MS`
keeps the five-minute fallback; a run with no failed execution attempt gets the
shorter grace. When Core marks recovery `running`, the live-run deadline bounds
the wait. A marker of `ended` or `threw` settles it immediately and names the
missing record. A terminal `metadata.repairedRerun.status` also settles the
failed repaired re-run immediately: no further recovery follows that re-run.
An active `resultRepair.phase` of `reauthoring` or `rerunning` still keeps the
run in flight. Fake-clock tests cover a failed repair settling on its first
terminal read after one polling interval.

### The adversarial lane

`pnpm lab:adversarial` runs every corpus row that declares `expected.recovery`
and prints one line per condition: which recovery absorbed it, how many attempts
it cost, and how many provider calls. It writes `measurement.json` and
`measurement.txt` under `test-runs/.adversarial/<timestamp>/`, and exits
non-zero unless every condition was absorbed by what it declared, within the
attempts it declared, for no provider calls.

It exists because the recovery ladder landed in Core unit-tested and proved to
run live, and had never been shown to absorb anything: no variant in the corpus
was absorbable by a deterministic ladder, because the corpus was written to
prove *model* repair. Each condition arms a fault a real site produces -- a
timed interstitial over a control, content that arrives after the action that
needed it, a control renamed between authoring and replay, a listing whose rows
and identifiers differ per visit, a session that expires partway through -- and
declares the recovery that must answer it.

Two declarations govern a condition, and they answer different questions.
`expected.providerCalls` says the run must spend nothing, and is the guard for
when the campaign runs the row **with** `--live-llm`. `expected.recovery` says which
recovery must absorb it, in the closed vocabulary the run itself publishes:
Core's four ladder rungs, `host_target_resolution` for the browser's own
re-resolution, or `none` for a condition nothing absorbs. Spend alone cannot
tell a rung that absorbed the fault from a fixture whose arming never reached
the page -- both spend nothing and both pass -- which is why the rung is
declared as well as the cost. The lane itself runs each condition with **no**
model at all -- no `--live-llm`, no key and no `runIntent` -- so what finished
the run can only have been the deterministic runtime.

A condition whose declaration says `none` is not a gap. `web.target.not_actionable`
(a covered control) and `web.auth.required` (an expired session) are both
non-retryable in the domain's failure table, so the retry rung is never offered
those nodes, and `clear_interference` has no node to run because nothing writes
`metadata.clearsInterference` onto a recorded Flow.

Every isolated or persistent-isolated run also writes `evaluation.json`, its own
`RunEvaluation`: the same judgement [the bench](#the-bench) records for a corpus
row. A Flow-lane run's evidence sizes are read from `snapshots/flow-lane.json`
by one reader, `run-evaluation/flow-lane-evidence-sizes.ts`, which a single run
and its bench row both use, so the two record the same packets. Packet sizes
are recorded, never judged: no evidence byte budget exists. The
`evidence-packet-budget` invariant, which failed a run the runner had passed as
`performance.budget` when a measured packet exceeded the domain's 6,000-byte
exploration budget, was deleted on 2026-09-30 together with the domain's
evidence byte budgets, when the user ordered that no limit hide page
information from the model. `rawSnapshotBytes` stays empty, because no producer
measures raw snapshots.

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
- **Final-state facts** (`final-state-facts.ts`). A run's final state is judged
  on the resolved workflow's `finalState`, plus the scenario's playback-goal
  success facts only for the primary workflow expected to succeed. A negative
  run, one whose `expected.failure` is set, is not judged on the goal.
- **Where a Flow starts** (`flow-start-page.ts`). For a task whose instruction
  begins by going somewhere -- `navigate` and `navigate-and-extract` -- the
  harness opens nothing. Both the build and the run are left on `about:blank`,
  the tab a browser opens on, and the run tells Core where the Flow starts
  instead of loading it. For a `form` or `extract` task, and for the
  recorded-Flow lane, the fixture's entry point is loaded as it always was: the
  person asking about the form in front of them is on that page, so starting
  anywhere else would start them where no user ever is. Which it is comes from
  the same predicate the judgement uses (`flow-lane/creation/own-page.ts`), so
  the harness cannot present a page the judgement then holds the Flow to
  reaching. A variant's rendering is still proved on a loaded page first, and
  the tab is blanked after the check.

  The address is `scenarioStartUrl(origin, scenario)`, one expression used both
  by the load the harness makes and by the start location it tells Core, so the
  page opened and the page named can never be two different pages.

#### Why the build starts blank

A Flow is assembled from the steps the build's exploration ran, so a model
standing on the fixture's home page never runs the step that reaches it and
cannot write one into the Flow it proposes. Measured on 2026-09-23,
`run-mudwci8d-de88aa32` built a seven-node Flow for "search the store for
wireless earbuds" holding no navigation node and no address anywhere; its first
action was a press that resolved only because the harness had just loaded the
page.

The build could not be blanked while the destination existed nowhere the model
could read it: no instruction in the catalog names an address -- they are
written as a shopper would type them -- and the fixture's origin is a loopback
port drawn per run, so nothing written down beforehand could carry one. So the
run passes it to Core as the bootstrap's **start location**
(`generate-flow-bootstrap-adaptation`, `startLocation`). Core shows it to the
model in the bootstrap context and passes it to the web domain on every tool
call; the domain then refuses every call but a look with
`not_at_start_location`, naming where to go, until the Flow has got there. A
look reads the page as it stands; only a page that cannot be read answers it
`not_at_start_location`
(`domain/src/runtime/llm-evidence/node-run/start-location.ts`). The step that
gets there is a step that ran, so it is in the draft, so it is in the Flow.

That refusal is the same condition the finished Flow meets at playback, where
the extension refuses every action on a blank tab except a navigation, judged by
its destination (`apps/extension/src/runtime/unsupported-page.ts`). A build
cannot succeed under a rule its Flow will not face.

### Core action probe

The probe lives in `core-action-probe/`. Before recording, the runner plants a
random mark as the `data-fluxiq-core-probe` attribute of the start page's root
element, and Core issues `web.dom.extract` for that attribute through
`execute-client-action`, in the tab the extension holds as active. The probe
passes only when the read returns the mark, so it proves a Core-issued action
reaches the page through the production gateway without depending on the site
being free of overlays. A refused or failed command, or a missing result, fails
as `action.dispatch`; a read that returns anything else, or a mark that cannot
be removed, fails as `runtime.behavior`. The runner then resets the fixture,
loads the start page again and checks its at-load facts, so recording starts
from the page as it was first presented, whatever the round trip cost. The
probe records one `web.dom.extract` action timing, which is the recording
lane's reported verdict unless the run fails at the facility.

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
  could not judge; a SQLite store this run wrote to is scanned whole. And
  `extension-storage`, the extension's own storage in the Chromium profile the
  run launched: `Default/Local Extension Settings/<id>` and
  `Default/Sync Extension Settings/<id>` (`chrome.storage`, which holds the
  offline event queue, the session and extraction sessions) and
  `Default/IndexedDB/chrome-extension_<id>_*`
  (`chromium-extension-storage-dirs.ts`), bounded by `writtenSince` on
  `persistent-isolated`. It is never taken from a person's own profile. Not
  covered: the panel's `Default/Local Storage/leveldb`, which is shared with web
  origins, and Firefox, which has no Lab lane. The existing target's FluxIQ is
  remote, so a scenario declaring secrets is left unattested there.
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
- **LevelDB stores** (`*.log`, `*.ldb`, `MANIFEST-*`, `CURRENT`, `LOG*` under
  `extension-storage`) are never skipped as binary. Each file is searched byte
  for byte for the literal in UTF-8 and UTF-16LE, write-ahead log records are
  reassembled across blocks, and table blocks are Snappy-decoded before the
  search (`leveldb-store/`). This is best effort: a table the decoder cannot
  read is counted in the scope summary's `undecodedLevelDbFiles` and recorded,
  not failed, and a file the scan cannot read at all is an `unscanned-store`
  finding. Other files in those directories get the text scan.
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
attestation passed. `run.json` also names each repository's uncommitted paths
(`changes`, status letters and paths only, never content) and how the run was
started (`invocation`: the Lab's arguments, screened, and the names, never the
values, of the `FLUXIQ_*` variables set), so a debug can tell which fixes a run
held (`packages/test-runner/src/run-manifest/`).

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

Reconstructing a finalized Flow evaluation preserves its failed
`stopped-for-permission` invariant and evidence references. A permission stop
therefore remains `stopped_for_permission` through reconciliation and repeated
resumes, and can never become a passing benchmark row.

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
  extraction is judged on the Flow lane. A workflow with a paged `extract` step
  is skipped on both lanes (`pagedExtractExclusion`, in `bench/expand-corpus.ts`
  and the runner's `--flow` refusal): W05 and W07. That leaves 62 runnable
  results per repeat and 5 skipped: 21 on the recording lane, and 41 on the
  Flow lane (21 unarmed and 20 variants).
  W19 to W23 and W29 are variants only. Because `week1` runs
  `auth-gate` on the Flow lane, it needs `FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD`.
  `week2` is A01 to A06 on the Flow lane alone: identity-drift's
  `renamed-redesign` with its unarmed baseline (the Week 2 exit chain's drift),
  W04's and W08's extraction drifts, W13 and W24, and member-directory's
  `restyled` with its baseline -- 8 results per repeat, 0 skipped.
- **Week 2 adaptation metrics.** A Flow-lane run's evaluation carries
  `adaptationReuse`, `adaptationValidation`, `adaptationPersistence` and
  `adaptationCost`, read from the bundle's `snapshots/adaptation.json`
  (`run-evaluation/adaptation/`). A lane writes that file from
  `readRunAdaptationMeasurements`, which reads Core's run detail, the Flow and
  Subflow graphs the run executed, and each adaptation the run created,
  trialled, or executed a stamp of, before Core deletes the run's workspace.
  Reuse names applied adaptations stamped on nodes the run attempted that it did
  not create; validation is Core's own confidence rule over each adaptation's
  stored results; persistence is its stored status and revisions; cost is
  Core's `llmGate.costAccounting`. Without the file all four are `null`,
  unmeasured. `report.json` aggregates them: reuse as deterministic replays (an
  exercising run with 0 Core-counted provider calls and 0 interventions) over
  the exercising runs whose count Core stated, with uncertified runs counted
  beside the rate; tiers and statuses as tallies; cost as sums over the runs
  that stated it. An aggregate no run measured is `null`, never zeros.
  `harnessRecovery` has no aggregate and stays `null`.
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
  cannot supply and which no recording-lane step has while paged extract steps
  are excluded from that lane, so it publishes no rate; and `extractionExactSuccess` and `extractionFalseSuccess` are
  per run. A run is an exact success only when every judged step listed its
  records and matched them: a count-only step whose counts agree is a miss for
  exact success (X5.5), so a lane of count-only steps such as
  `data-table-inventory-large` can never print 1.0, while a count that
  disagrees under a reported pass is still a false success. Beside them, `judgedSteps` and `unjudgedSteps`, and the split of the
  judged into `comparedSteps`, `countOnlySteps` and `unjudgeableSteps`, state
  what each number stands on; `report.md` prints that split as a sentence and
  each rate's own unit and population beside it, because no two of these rates
  are counted over the same steps. Two distributions,
  `extractionDurationMs` and `extractionMsPerPage`, complete the block; the
  second has no samples on a lane that cannot observe pages. Every record
  count in the block is the **answer**: on the Flow lane a step's records are
  what Core's run-end processing kept from the rows the read's passes
  collected. A measurement states the other side as `collectedRecords` when
  the dataset's summary carried a processing account
  (`flow-lane/run-datasets.ts`), never fewer than `observedRecords`, and the
  lane block's optional `collection` pools it (`steps`, `collectedRecords`,
  `answerRecords`) over the judged steps that stated it; `report.md` prints it
  after the basis sentence. A step with no processing account, every
  recording-lane step among them, enters neither side.
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
Locale, timezone, viewport, and color scheme are fixed. Before launching, the
fixture refuses an artifact whose build stamp (`build-info.json`) no longer
matches the source, or that has no stamp, as `environment.stale`; see
[Release Packaging](release-packaging.md#the-build-stamp). It hashes the
complete extension artifact, attaches its metadata, closes Chromium, deletes
the temporary profile, and verifies deletion.

The Lab scenario runner additionally verifies **running** build identity after
loading the fixture and before chat, build, recording or action dispatch.
`run-scenario/browser-session/build-identity/` compares `build-info.json` with
immutable identities embedded into the running background and active top-frame
content bundles. Missing/legacy or mismatched target, version, protocol or input
digests fail as `extension.worker`; `snapshots/running-build-identity.json` records
only screened identifiers, including a failed comparison before refusal. Cached
service-worker deletion remains scoped to the run-owned profile and is not proof
of the identity on its own.

`coreInputsDigest` and `domainInputsDigest` name only source/contracts reached
by the browser bundles; the run manifest records the intended repository pair
separately. This does not certify a running Core server's build. The explicit
provider-free production-browser probe is enabled with
`FLUXIQ_IDENTITY_BROWSER_PROBE=1` and requires a current E2E extension build; it
uses an owned persistent profile and checks matching, background mismatch,
content mismatch and disk mismatch before any simulated dispatch.

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
exercises — the catalog fields, pagination, Next page
(`everything-store-next-page.spec.ts`), tables, sensitive controls, the
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
- Windows and Linux static `check`, `test`, and `build` jobs, followed by store
  packaging with read-back verification of the Chrome and Firefox ZIPs;
- Windows and Linux Chromium smoke jobs on every event: the extension e2e
  suite always, the scenario-page suite when selected;
- changed-scenario execution for pull requests; and
- a nightly three-repeat full corpus, split by `nightly-plan` into four shards
  read from the scenario registry, with 90-day uploaded evidence.

The sizing, the owner-only configuration, and what was checked locally are in
[Release Packaging](release-packaging.md#ci-gates).

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
pnpm lab stop <instance>
pnpm lab compare <baseline-report> <candidate-report>
pnpm lab compare <baseline-report> <candidate-report> --sequential
pnpm lab compare <report> --halves
```

`stop` stops one live run by its instance's ledger pid and process tree, never
by command line ("Live-run waste guards", "Stopping one Lab run").

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

The default Lab allowance is the model's whole context window: 992,000 input tokens, 8,000 output tokens and 1,000,000 total tokens per request (`DEFAULT_LLM_LAB_BUDGET`), with a 30-second timeout and Core's per-build estimated-cost ceiling (`FLUXIQ_LLM_RUN_COST_CEILING_USD`, default $0.10; see "Live-run waste guards"), which a run's options may only lower (each call inherits that ceiling). Validation rejects any request total above 1,000,000 tokens (`LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST`, mirroring Core's DeepSeek model limits). That number is what the model can read, not a budget: on 2026-09-30 the user ordered that no limit hide page information from the model, and a request over the window fails loudly rather than being trimmed. The allowance used to be 8,000/2,000/10,000 under a 50,000-token ceiling, then 48,000/8,000/56,000 under Core's 64,000-token ceiling, and each made a real page impossible to describe. A live run permits no retries.

Calls per run follow Core's model, not a fixed count. A diagnosis (`--llm-task diagnose`, Core run intent `diagnosis_only`) makes exactly one call. An adaptation (`--llm-task adapt`, Core run intent `diagnose_and_adapt`; `explore_and_adapt` and `build_and_adapt` behave the same way) makes as many calls as it needs, for example to gather evidence between its diagnosis and its patch. Core stops it on the run's estimated-cost ceiling, its token budget, the recovery deadline, or its no-progress guard. `--llm-max-calls` defaults to Core's default of 26 and is only a backstop against a runaway loop: it is refused below 1 or above 64, Core's absolute ceiling. The run's token budget defaults to the per-request total times the authorized calls, and `--llm-max-run-tokens` can lower it; it is enforced by the Lab's post-run check. The live campaign (`scripts/lab/live-campaign`) passes no `--llm-max-run-tokens`: with whole-page requests a build may use more than a million tokens across its calls, and a run budget it outgrew would fail the run as `performance.budget` only after the money was spent, so what bounds a campaign run is its per-build spend ceiling, its call count and Core's stall guard. The spend ceiling is per build, whatever the build's call count, and it has one definition: Core's scoped ceiling resolver, activated by `FLUXIQ_LLM_RUN_COST_CEILING_SCOPE=test` and resolved from the Lab's `FLUXIQ_LLM_RUN_COST_CEILING_USD` (Lab default $0.10; ordinary user UI remains $0.25 and ignores the test variable), which the Lab resolves for each run with `liveLlmBuildCostCeilingUsd` (`packages/test-runner/src/live-llm/build-cost-ceiling.ts`): the same sources it passes Core, through Core's own resolver, so the plan and Core hold a build to one number. `--llm-max-cost-usd` is the whole build's ceiling, not a per-call figure: it may only lower Core's ceiling, is never multiplied by the call count, and the live campaign passes none. The ceiling is saved on the Flow as `adaptationPolicySettings.maxEstimatedCostUsdPerRun` with the rest of its LLM settings, so Core's loop budget holds the build, the run's recovery and each re-author build to it, each on its own. The Lab's post-run check holds each settled phase to it again, and every live run reports its spend per build against it: `snapshots/live-llm.json` `observed.perBuild`, the campaign row's `perBuildSpend` with the summary's `buildsOverCeiling`, and the spend ledger's `buildCeilingUsd`, `maxBuildCostUsd` and `buildsOverCeiling`. There is no spend budget across runs. The model is the Flow's `llmModel` setting.

**Model calls need no grant.** Core resolves the provider from the caller's own unlocked Secret Keys session. The Lab installs the key, saves the Flow's LLM settings and spend ceiling, and then sends its build (`generate-flow-bootstrap-adaptation`) or run (`run-runtime-session` with a `runIntent`). The one thing the operator still allows is a consequence: `--llm-permit` names the classes (`move_money`, `delete`, `send_or_publish`, `modify_existing`, `create_new`) the run's actions may cause, and the Lab sends them as `permittedConsequences` on the build and the run only when it names any. Absent, a consequential act stops and asks a person (`permission_required`). A created-Flow build started from the extension's chat carries no permit at all, so `--llm-permit` is refused for it, and the Lab's person answers the question in the chat instead ("The build is started from the extension's chat window" above). `snapshots/live-llm.json` records the plan's `authorized` bounds and its `permittedConsequences`.

The panel-driven adaptation demos type no call count: the panel sends Core none for an adapting run, so Core applies its default. Those demos accept a source run that made at least one call per recorded intervention and no more than that default. `pnpm demo:llm:adapt` is narrower for now. Its certificate records exactly one diagnosis invocation and one patch invocation, so it refuses, with a message that says why, a run that spent calls between them.

Scenario/browser traffic remains loopback-only and external side effects remain disabled. Provider control-plane traffic is separately restricted to a trusted Core-owned provider adapter; a Flow, scenario, extension, or CLI caller cannot choose an arbitrary endpoint. Raw prompts and responses are excluded from Lab artifacts. Successful invocations must record sanitized usage, while locally rejected, failed, or cancelled invocations may explicitly record usage as unavailable instead of fabricating counts. A passing evaluation requires a completed, passing zero-LLM replay and cannot attest more invocations than its declared allowance.

The general Lab CLI reaches the real provider when `pnpm lab run ... --flow --live-llm` is given with the `--llm-*` options above. Panel-driven paid certification uses the narrower `pnpm demo:llm:diagnose` command after `demo:llm:setup` and `demo:llm:prepare`. The command drives the real panel UI in the persistent isolated workspace. It selects the stored opaque Testing Lab key summary and saves stricter first-live limits: 2,000 input tokens, 512 output tokens, 3,000 total tokens, exactly one call, zero retries, 20 seconds, and at most $0.25.

The diagnosis command waits for Core's Flow readiness check and requires the
real Runtime Debug Run control to be enabled before and after selecting
diagnosis-only mode. If the prepared Flow has no active instruction, it records
only bounded boolean readiness facts and exits before opening authorization,
creating a runtime run, or contacting the provider.

The setup helper navigates the real Secret Keys Program, reads only its metadata-only snapshot response, reuses one exact compatible global DeepSeek key, or drives Add Key and authorization through accessible UI labels. It never invokes Reveal. The diagnosis command never reads the provider environment variable or secret value. After login, model calls use the authenticated session's in-memory secret unlock and do not ask for the account password or PIN again. Secret-key setup and other genuinely privileged credential actions remain screenshot-suppressed.

Runtime target adaptations remain opaque in Core. When Core applies an `edit_action_target`, the web domain consumes the resulting `parameters.target` object as an override and maps its selector, element, or visual target through the existing client-gateway boundary; the generated top-level parameters remain the fallback.

The certification run removes the recorded target on the loopback Scenario Lab, requires that deterministic action failure to precede exactly one `diagnosis` intervention, and validates the trusted Core budget ledger reports exactly one provider call. It rejects any patch/suggestion/proposal kind, adaptation or change-proposal ID, unexpected provider/model/prompt version, invalid or excessive usage, or nonterminal outcome. It then restores the fixture and runs the same Flow through the real UI in No LLM mode; that replay must succeed with zero interventions and zero Core-accounted provider calls. The fixed retained schema contains only run IDs/statuses, bounded invocation provenance/usage, evaluation, call counts, and aggregate leak-attestation totals. It excludes prompt/response bodies, key references, passwords, PINs, action messages, and raw metadata.
Post-run provider-secret attestation is a separate bounded gate. A caller supplies one in-memory literal and exact approved relative paths beneath a canonical workspace. The scanner never follows reparse points or path escapes, reads SQLite databases with their `-wal`, `-shm` and `-journal` files byte for byte and cell by cell, skips only other known binary formats, limits files and bytes, and fails closed when approved text or a store is unreadable or oversized. Reports contain counts, categories, and sanitized relative paths only; they never include matching content or the literal. Live-lane composition must explicitly select run evidence, logs, manifests, workspace metadata, and cache metadata after UI provisioning and every provider-backed test.

### Live-run waste guards

`scripts/lab/run-lab.mjs` asks `scripts/lab/live-guards/` whether a live run
may start before it does anything else: before Core is waited on, before the
build and before any provider call, so a refusal costs nothing. Every
`--live-llm` invocation is guarded except `--dry-run`, which makes no provider
call. On 2026-09-30 launcher loops with no agent watching spent $4.25 on 47 runs
that fixed nothing and then fired about 1,050 more against an empty balance;
these rules exist because notes asking agents not to do that did not stop it.
They stop unattended loops that waste credits; they set no spending limit.

The state is one machine-wide directory, `~/FluxStuff/lab-slots/`, shared by
every checkout and worktree. Its location is fixed; no flag or environment
variable moves it.

| Rule | Refuses when | Satisfied by |
| --- | --- | --- |
| `balance` | `STOP-balance` exists | The user topping the account up and deleting the file; no override |
| `peak` | The UTC day is a weekday (Monday to Friday) and the UTC time is inside 01:00-04:00 or 06:00-10:00 (start inclusive, end exclusive), DeepSeek's peak pricing hours | Launching at or after the next off-peak start, which the refusal names (the window's end, 04:00 or 10:00 UTC); `OVERRIDE-peak` |
| `behind-dev` | This checkout's HEAD does not contain its local `dev` (`git merge-base --is-ancestor dev HEAD`), or the FluxIQ Core it builds against (`FLUXIQ_CORE_ROOT`, else `../!FluxIQ`, as the Lab resolves it) does not contain Core's local `dev`, unless every file `dev` changed since is documentation (`docs/` or Markdown, which the source fingerprint also leaves out); or git cannot answer, for example no local `dev` branch | `git merge dev` in the named checkout, then rebuilding Core's libraries and the extension; `OVERRIDE-behind-dev` |
| `loop` | The instance already started 3 live runs in the last 30 minutes | Waiting, with the relaunch loop stopped; `OVERRIDE-loop` |
| `debug` | The instance's previous live run has no `docs/working/language-driven-flow-loop-plan/debugs/<runId>.md` in the tree it runs from | Writing that debug; `OVERRIDE-debug` |
| `unchanged` | The previous live run of the same instance and task did not pass and the source fingerprint is unchanged | Changing the source; `OVERRIDE-unchanged` |

`peak` is the user's rule that paid runs launch off-peak: inside those windows
DeepSeek's peak pricing halves the decisions a run's $0.10 per-build ceiling
buys, so a run measures the price rather than the product. The refusal names the
window it fell in, the next off-peak start in UTC and the override file. The
rule reads only the admission's clock (`admitLiveRun`'s `now`, the current time
in `run-lab.mjs`), so tests inject it; like every rule here, only the file
`lab-slots/OVERRIDE-peak` lets a run past it, never a flag or a variable. It
judges the start only: a run admitted at 00:59 UTC is not stopped at 01:00.

`behind-dev` is the user's rule of 2026-10-01: live testing runs on code synced
to the integrated `dev` line. A lane worktree that missed a merge round tests
code `dev` has already replaced and spends real money measuring nothing. A
checkout on `dev`, a task branch merged up with `dev`, and the detached shared
Core at or past Core's `dev` all pass. The refusal names the repository, its
HEAD and how many `dev` commits it lacks. It is separate from the Lab's older
Core-commit check, which judges only a detached Core and is passed by
`FLUXIQ_LAB_ALLOW_BEHIND_CORE=1`; this rule has no variable, only the file.

A refusal names every rule that refused and how to satisfy it, and ends with a
`{"status":"failed","category":"lab.live-guard",...}` line, which the live
campaign reads as a run that never started. An override is only ever a file,
`lab-slots/OVERRIDE-<rule>`, that the user creates; it is honoured while it
exists, and each run it admits records it in the ledger's `overridden` field.
A guard that cannot read its inputs (a corrupt ledger line, a tree git cannot
list) refuses the run rather than guessing.

`spend-ledger.jsonl` is append-only. A `start` line is written immediately
before the runner is spawned, with the instance, the task
(`<scenario>/<instruction task or llm task>[/workflow=..][/variant=..]`), the
pid and the source fingerprint; a `finish` line is written for each run the
launch produced, with its runId, verdict and `snapshots/live-llm.json`
`observed.totalEstimatedCostUsd`, so the ledger records spend for reporting;
no rule limits it. The loop rule counts starts, so a crashed run still counts. A start whose launcher died, or
that is older than six hours, is closed from its run directory
(`"reconciled": true`) before the next admission. When a finished run's
`provider-failures.local.json` shows an empty balance or exhausted quota
(provider HTTP 402, or text such as DeepSeek's `Insufficient Balance` or
`insufficient_quota`), the Lab writes `STOP-balance` with the reason. A plain
429 rate limit is not a balance failure.

The fingerprint is a SHA-256 over every file `git ls-files --cached --others
--exclude-standard` lists in this repository and in the FluxIQ Core beside it,
read from the working tree, leaving out `docs/`, Markdown, and build and run
output. Writing a debug does not change it; editing source in either
repository does.

#### Stopping one Lab run

`node scripts/lab/run-lab.mjs stop <instance>` (or `pnpm lab stop <instance>`)
stops exactly one live run: the instance's most recent ledger `start` with no
`finish`, by the launcher pid that `start` recorded, killing that process and
its whole tree (`taskkill /PID <pid> /T /F` on Windows; elsewhere every
descendant `ps` lists, deepest first, then the pid). `<instance>` is the
`FLUXIQ_LAB_INSTANCE` the run was launched with, `default` when it had none.
Once the process is gone it runs the ledger reconciliation, which closes the
launch with `"reconciled": true` and the runs and spend it produced, exactly
as the next admission would have. It prints one sentence and a
`{"lab":"stop","state":"stopped"|"refused"|"failed",...}` line, and exits 0
only when it stopped the run.

It refuses, killing nothing, when the instance has no open start, when the
recorded process is no longer running, or when the start is older than six
hours: Windows reuses process ids, so a pid that old may belong to another
program. It builds nothing and loads no Core. The code is `scripts/lab/stop-run/`.

Never stop a Lab run by matching processes by command line. On 2026-10-01 a
`taskkill` by command-line pattern, meant for one lane's run, also killed two
other lanes' runs (`docs/working/language-driven-flow-loop-plan/debugs/run-muq0in9r-0793b448.md`,
Cause 1).

#### The per-build cost ceiling

The Lab's build/recovery ceiling is `FLUXIQ_LLM_RUN_COST_CEILING_USD`, in US
dollars: $0.10 when unset. The user clarified on 2026-10-03 that this is only
a Testing Lab control. The Lab explicitly passes the resolved amount and
`FLUXIQ_LLM_RUN_COST_CEILING_SCOPE=test` to its owned Core child. Core validates
the amount before provider work. An ordinary user UI process ignores this
test-only variable, even if its env file contains it; normal Flow defaults
remain $0.25 and explicit user budgets remain effective within server bounds.

The Lab passes it to every Core it starts
(`packages/test-runner/src/live-llm/cost-ceiling-env.ts`, used by
`buildFluxIQEnvironment`), taking the first it finds of the Lab's own
environment, then `.env` and `.env.local` in the checkout (a later file wins).
Set nowhere, the Lab passes $0.10 explicitly. `--llm-cost-ceiling-usd <usd>`
may lower that configured amount; a higher value is refused before launching
Core or resolving a provider key. Change the configuration variable itself
to change the Lab ceiling. `--llm-max-cost-usd`
remains the run's own limit and may only lower the ceiling; the Lab contract
bounds it by Core's largest configurable ceiling, $10
(`LLM_LAB_MAX_ESTIMATED_COST_USD`, pinned to
`AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_MAX_USD`), and an unset one plans the
ceiling itself.

The Lab's plan, its post-run check (each call's cost and each build's total)
and its spend reports use the same value Core gets:
`liveLlmBuildCostCeilingUsd(repositoryRoot)` reads the same configuration and
lowering flag and resolves the value through Core's own
`resolveAutomationStudioLlmRunCostCeilingUsd` with explicit test scope, so a value Core would refuse at
start is refused by the Lab too. The Lab's tests derive every amount from that
value (`live-llm/tests/lab-ceiling.ts`) rather than from a written number.

#### The resolved build-call allowance

Before starting an owned Core process, a live run passes its resolved
`LiveLlmPlan.maxCalls` as `TopologyOptions.buildCallLimit`. The environment
adapter supplies `FLUXIQ_LLM_BUILD_CALL_LIMIT` with
`FLUXIQ_LLM_BUILD_CALL_LIMIT_SCOPE=test`, using Core's public constants.
It does not reparse argv or configure a new Flow after its chat build finishes.
An unplanned run drops inherited allowance and scope; an invalid explicit
allowance is refused. Ordinary UI receives no new default call cap.

Core's shared creation purse admits logical questions before sending them,
including reader, decisions, repair rounds and judges, with the judge pair
reserved. Internal HTTP retries count as the same logical question. The Lab's
post-build assertion remains an independent check. Failed-build diagnostics
can carry actual root `totalProviderCallCount`; loop decisions are a separate
count, and legacy absence does not establish the aggregate.

#### The default model

A build started from the extension's chat makes its Flow inside Core's
`flow.createHere` command, and that Flow names no model, so the build runs on
Core's default model: `FLUXIQ_LLM_DEFAULT_MODEL`, `deepseek-flash` when unset
(`runtime/llm/deepseek/models.ts` in Core). It is built as the ceiling is: Core
resolves it once when it loads, refuses to start on a value that is not one of
its configured models (`AUTOMATION_STUDIO_DEEPSEEK_MODELS`), and uses it for
every call whose caller names no model -- a new Flow's builds, and the chat
window's own reading of a message. A Flow's `llmModel` still wins wherever it is
set. Cost estimates and reservations price the model a call is made on, not the
default's rates. It is the developer's and the Lab's knob, for comparing a chat
build on another model (t233, 2026-10-01); it is not a product setting.

The Lab passes the run's `--llm-model` to every Core it starts as that variable
(`packages/test-runner/src/live-llm/default-model-env.ts`, used by
`buildFluxIQEnvironment`), and from nothing else: not the Lab's environment, not
`.env`, and a value inherited from whoever launched the Lab is dropped. Without
`--llm-model` nothing is passed and Core builds on its own default, which is the
Lab's `DEFAULT_LLM_MODEL`. An `--llm-model` Core would refuse is refused by the
Lab, through Core's own `resolveAutomationStudioLlmDefaultModel`, before a Core
starts or a key is read. The run's plan records what Core was given as
`plan.coreDefaultModel` (`liveLlmCoreDefaultModel`), as `plan.buildCostCeilingUsd`
records the ceiling, and `assertChatBuildable` accepts the run's model when it
equals that. A comparison run on the stronger model is therefore:

```text
pnpm lab run ... --live-llm --llm-task create-flow --llm-model deepseek-v4-pro
pnpm lab:campaign <task-id> --llm-model deepseek-v4-pro
```

The live campaign always hands each run its `--llm-model` (default
`deepseek-flash`), so a campaign run gives Core that default explicitly; it is
the same model Core would use unset.

The campaign likewise always hands each run its `--authoring-mode` (the
campaign's own option, default `legacy`; refused after `--`), so every run's
Core is started in a stated mode. Each summary row records the mode the run's
Core recorded (`authoringMode`, from `snapshots/live-llm.json`), and the summary
states the mode the campaign selected. `pnpm lab:campaign <task-id> --authoring-mode
candidate` exists to show that refusal; it builds nothing.

`deepseek-v4-pro` costs about four and a half times as much per token, so the
same per-build ceiling buys fewer calls. A comparison requiring more room
must explicitly change `FLUXIQ_LLM_RUN_COST_CEILING_USD` in the Lab environment
or checkout env file; `--llm-cost-ceiling-usd` can only lower that ceiling.

## Per-step logs and the central run folder

Every live LLM run (`lab run --live-llm`) is filed in one machine-wide folder,
`~/FluxStuff/lab-runs/` (`C:/Users/osrs_/FluxStuff/lab-runs/` here), shared by
every checkout, worktree and lane. `FLUXIQ_LAB_RUNS_DIR` moves it when set to
an absolute path; tests use that. Runs without `--live-llm` are not filed and
log no steps. The code is `packages/test-runner/src/lab-runs/`, wired into
`run-scenario.ts`.

```text
lab-runs/
  index.md                      one row per run, newest first
  <YYYY-MM-DD>/<runId>/         the local date the run started
    entry.json                  runId, startedAt, pid, lane, instance, task, scenarioId,
                                verdict, bundlePath, repositoryRoot; at the end costUsd,
                                finishedAt, steps
    steps/                      written by Core as the run goes (FLUXIQ_LLM_STEP_LOG_DIR)
      index.md                  Core's one line per step
      NNNN-<kind>/              a model step: decide, judge, repair, chat, ...
      NNNN-tool-<toolId>/       a tool call in the build loop
      NNNN-test-<toolId>/       a test replay of the build
      NNNN-run-<actionType>/    a created Flow's playback command, written after Core stops
      NNNN-run-skipped/         a playback step skipped without dispatching a command
        meta.json               written last: a folder holding it is complete
        screenshot.jpg|png      the Lab's picture of the browser after the step,
        screenshot.skipped.txt  or why there is none
    summary.json  run.json  evaluation.json  report.html  review/  screenshots/
    snapshots/live-llm.json  snapshots/flow-lane.json  logs/core.log
    provider-failures.local.json
```

A model step's `meta.json` says whose money it spent. `part` is `creation` for
a call inside a Flow's creation build, `reauthor` for one inside a refuted
result's re-author build, and `null` for everything else: the chat
interpreter, the playback run, its result check and its diagnose/patch ladder.
A creation draws on the Flow's one creation purse (`FLUXIQ_LLM_RUN_COST_CEILING_USD`,
$0.10; the chat interpreter's cost is carried into it). A re-author and its
ladder draw on the run's own recovery ceiling. So summing a run by `phase`
alone mixes two ceilings: group by `part` first. `phase` is `read` for the
build's reading of its instructions. `costUsd` is the provider's reported cost
even for a reply Core refused (`llm.provider_output_invalid`, truncated
output), because the call was paid for either way. The index's Cost is the run's whole
total across both ceilings, not one purse.

How a run fills it:

1. Before Core starts, the Lab creates the folder and `steps/`, writes
   `entry.json` with `verdict: "running"` and its own pid, and rebuilds the
   index. Core's environment gets `FLUXIQ_LLM_STEP_LOG_DIR=<folder>/steps`, so
   Core writes every step there from its first call and a run killed halfway
   still leaves them. A non-live run's Core gets no such variable, and a value
   inherited from the launcher's environment is dropped, so lanes never share a
   step folder.
2. Once the browser is up, the Lab looks at `steps/` every second. A complete
   `tool-` or `test-` folder that is still the newest page step gets a picture,
   taken by the run's own screenshot adapter (the native window capture, which
   moves no focus, falling back to the front scenario tab), one capture at a
   time and at most 5 s each. The file's extension is the image's real format.
   A picture shows the page as it is when taken. So a step that the next page
   step had already acted after gets `screenshot.skipped.txt` naming that step,
   not a picture of the later page; this is common for a test's quick replays.
   The same holds for a picture taken while the next page step started. The
   model's own folders between two page steps do not count, since a decision
   leaves the page as it was. A capture that fails, finds nothing or runs late
   also writes `screenshot.skipped.txt` with the reason. The watcher stops
   before the browser closes: a step finished since its last look is
   photographed within 5 s, and any left are marked skipped.
3. After the bundle is finalized, beside the local sidecars, the bundle gets
   `steps` as a directory junction to the central `steps/`. The steps exist
   once on disk, which matters because one decision request can be 1.4 MB.
   Deleting a bundle with `fs.rm` or `Remove-Item -Recurse` removes the
   junction and keeps the steps. The key files listed above are copied into
   the central folder, and only those. Nothing in the central folder links
   back to the bundle; `entry.json` holds its path as text. `entry.json` then
   gets the verdict, `costUsd` (`snapshots/live-llm.json`
   `observed.totalEstimatedCostUsd`, the figure the spend ledger records),
   `finishedAt` and the step count, and the index is rebuilt.

After Core stops, a created Flow's playback joins the build's steps
(`lab-runs/write-playback-steps.ts`): each command attempt dispatched in the
playback's window becomes an `NNNN-run-<actionType>` folder numbered at its own
time among Core's steps, and `steps/index.md` is rewritten. A Core step that
started after a playback step -- the post-run check of its result -- moves
after it, its folder and its `meta.json` `step` both, so the folders read in
time order (`run-musp8nz1-dbd3905a`: the check was 0048 before the playback it
checked, 0049-0061). A list read (`web.dom.extract_list`) also says what it
read, as `result.read` and in its summary. That covers its records, pages,
items seen, empty records, whether a cap cut it short, why paging stopped (a
Flow's read reads one page, so a Flow's paging shows in its Next page steps),
what its conditions kept and the rows it returned, in counts and closed words
only, never a row or a field (`run-musp39u8-9ac026ab` wrote `validation: null`
and nothing else). Every runtime step is
listed, including the ones the run did not perform. A step the run skipped is
written with `status: "skipped"`, never as failed, with the run detail's
`skipped` mark in `meta.json` and `result.json`, and with the failure that
prompted the skip kept as `observed`. A skip comes in one of two shapes.
`target_absent` is a sometimes-present step, such as a popup, that was not on
the page. `state_routed` is a step passed over because the page was already
somewhere else: the run continued at the node matching the page (Core t243),
and the mark adds `toNodeId` and `direction` (`forward` or `backward`). Its
summary reads `routed to <node> (<direction>)`, so a debug can see that the
runtime checked the page. A skip that dispatched no command gets its own
`NNNN-run-skipped` folder. The writer returns how many steps were skipped and
how many of those were state-routed. The Flow run's outcome
(`persisted-flow-run.ts`) has `stateRouted: { forward, backward }` when the run
routed at least once. The Lab accepts only Core's two closed mark shapes. The
code must have Core's dotted form and the destination must have a node id's
form, so page text cannot get into the run folder. An attempt down a skip route
(`route: "skipped"` or `"state_routed"`) whose Core status is `succeeded` is
counted as skipped even when its mark is rejected: the mark's detail is lost,
the skip is not. The existing-Flow and clone targets count steps the same way.
`existing-fluxiq-control.ts` keeps the skip route and the closed mark on each
run-detail attempt, and `run-manifest/action-timings.ts` writes such an attempt
to `run.json` as `skipped`, never `succeeded`.

Every step the runtime consulted the page for also says what it made of it.
Core's run detail carries `stateRouting` on each such attempt (Core t250), and
`flow-lane/state-routing-attempt.ts` keeps it only in Core's closed shapes: an
outcome (`routed`, `effect_holds`, `guard_stopped`, `no_match`, `unobserved` or
`no_pre_states`), a Core dotted code, and for `guard_stopped` a node id. Each
such `steps/` row carries the record as `stateRouting` in `meta.json` and
`result.json`, and its summary ends `the runtime consulted state: <outcome>`.
A failed step whose routing found no way on stays failed. A routed step adds
the outcome to its skip. A routing that stopped before any command was
dispatched gets its own `NNNN-run-state-consulted` folder. Only the Flow lane
writes `steps/`, so the existing-Flow and clone targets do not carry it.

`index.md` is rebuilt from every `*/*/entry.json` each time a run starts or
ends. Its columns are Started (local date and time), Lane
(`FLUXIQ_LAB_LANE`, else `FLUXIQ_LAB_INSTANCE`, else `default`), Task (as the
spend ledger names it, `<scenario>/<task>[/workflow=..][/variant=..]`),
Verdict, Cost, Steps (the step folders there now) and a relative link to the
folder. A run still `running` whose process no longer exists reads
`unfinished`. Four lanes start and end runs at once, so the rebuild holds a
`mkdir` lock, `<root>/.index.lock`, which is taken over after 30 s and
abandoned after 15 s of waiting, when the write goes ahead without it. The
file is replaced by writing a temporary file and renaming it.

All of this is best-effort. A failure is written to stderr with the folder it
concerns and never changes a run's verdict. A run that could not open its
folder runs exactly as before, and its Core logs no steps. A run whose
publication throws still has its entry closed as `failed`. No token, password
or key is written: `entry.json` holds names, paths, times and figures, and
the copied files are the ones the bundle's redaction attestation already
covers, plus the provider-failure sidecar, which is redacted as it is written.
What Core writes into `steps/` is Core's responsibility. It logs no header and
screens every text it writes for credential shapes.

### The UI review's overlay counts

A run's UI review (`packages/test-runner/src/run-scenario/ui-review/`) samples
the on-page activity overlay about every 200 ms for about 3 s at each moment
and reads the window as `stable`, `changed` or `flickering` (a revisit, two or
more presence or visibility toggles, or three or more text changes). Each
sample records the document it was read from (`performance.timeOrigin`) and
that document's location as `pageUrl`, screened to origin and path like every
other recorded location. Every change of document between consecutive samples
that name theirs is a page load, counted as `pageLoads` whether or not the
overlay was absent across it. One absent sample whose neighbours were both
read, present, from different documents is that load's gap, which no product
code can bridge: it is counted as `pageLoadGaps` as well and makes no toggle.
Any other absence counts as a toggle: two or more samples, one inside a single
document, or one beside a failed read.

A read that fails the way a navigation makes it fail (the overlay host went
away between two reads, or the page's execution context was destroyed) is
marked `navigationSuspected`, and the tab's document is read once more, so the
failed sample names the document the tab holds after it, or says in
`documentError` why it could not. A failed read still makes no toggle, but the
document it names counts toward `pageLoads`, so a navigation that ends a window
in a failed read is no longer lost (run-musp8nz1 moment 2). A window that ends
in such a failure with nothing after it naming a new document, or a later read
of the same one, counts one `probablePageLoads`, kept apart from `pageLoads`.
All three counts are shown in the `[lab] ui review` line and the review's
summary.

The overlay's text and attributes are screened by `screenOverlayText`:
- A URL the overlay names keeps its origin and path, and a bare path is kept
  whole, as `screenLocation` keeps a recorded location, never a query or
  fragment.
- Secrets, token patterns and six-digit codes are screened everywhere.
- Any other 32-character opaque run becomes `[long]`. Before this, a fixture
  path in "Opening “…”" became `[long]` too (run-musp8nz1 moment 7).

Each scenario picture lists every tab open in the browser as `openTabs`:
screened locations, in the browser's order, each with whether it was in front.
They come from the extension's `chrome.tabs.query({})`, or from the run's pages,
with front `unknown`, when that cannot be read. `frontTabs` still lists the
tabs in front, and the summary gives each moment's tab count.

A moment taken on entering a Flow run is labelled `before-flow-run`, since the
run is reported while it is still being prepared and can fail before any step
plays (run-musq0b1m moment 14). The periodic moments taken while it is still in
progress are `flow-run`.

Each picture records when it was taken against its moment's overlay samples:
`takenAt`, `windowMs` (the capture's span in milliseconds from the window's
`startedAt`, negative before the first read) and `overlaySamples` (the index of
the last read begun before the capture and the first begun after it). A
picture without the overlay whose neighbouring samples say absent was taken
before it appeared; one whose neighbours both say present and visible is a
rendering defect.

### Terminal Flow evidence after runtime cleanup

Flow-lane snapshots optionally retain terminalEvidence beside the existing status, failure history and oracle result. It contains a closed category for recognized generic Core terminal reasons, a screened opaque current node ID, and a message-present flag. Core terminalFailureReason is free text, so unrecognized text is explicitly withheld and the raw trace message is never copied. Missing metadata remains absent or null. These fields explain an execution result without changing its verdict.

A healed historical failed attempt does not mask the additive unvisited-action diagnostic: the diagnostic uses the node last-attempt recovery grouping, while a genuinely unresolved failure still excludes it. Core status and oracle facts remain independent. Use persistent-isolated when later diagnosis or saved-Flow reuse is required; disposable isolated cleanup removes its Core workspace after the run. A separate lab replay verifies unchanged content hash, no provider access and the task oracle.


### Running Core identity admission

Every live or Flow lane, and every topology with authenticated Core control, requires authenticated `get-runtime-build-identity` from its actual Core service before clone/project setup, browser launch, chat or provider dispatch. Pure offline recording without Core control is exempt only when no live/Flow paid capability is present. The intended built artifact stamp must still match source and executed JavaScript on disk; reached fluxiq/contracts inputs from the extension stamp must match that artifact. The actual retained service reports its construction-time embedded identity, so changing disk or hot-reloading a route does not masquerade as a restarted runtime. Missing, legacy, stale or mismatched identity refuses dispatch. Evidence `snapshots/running-core-identity.json` contains only closed protocol/version/hash fields and verification state.

`reader-payload-v1` excludes only the self-containing payload literal from hashing and hashes all surrounding reader code. The digest is normalized, not a raw full-dist checksum. Reached contract matching excludes that single reader file (bound by the normalized artifact identity). The separately built client-gateway-websocket adapter remains covered by the extension's existing background/content handshake; this gate does not attest it as executing server code. The separately bundled downstream host has its own mandatory loaded-module gate, described below.

### Running domain-host identity admission

The owning domain host build embeds a `fluxiq.module-build-identity.v1` descriptor and writes its `.identity.json` companion. Normalization excludes only the marked self-containing reader payload, preserving all surrounding executable bytes. Lab copies both files and compares the full intended source inventory, normalized executable digest and actual descriptor returned by the retained Core service before project/browser/chat/provider setup. Binding the native runtime captures trusted loaded identity before domain or IO registration; changed rebinding refuses before those mutations. A legacy unstamped binding clears active provenance while retaining the original anchor, so it cannot erase history then attest different code. Missing or stale provenance refuses admission.

The provider-free proof uses actual built Core and the bundled host with a bounded child process and synthetic authenticated loopback HTTP transport; it observes retained-service refusal after host rebuild and real diagnostic route reload. It does not establish production Next/pairing transport or the external websocket server adapter's executing identity. See the [implementation and proof receipt](../working/mvp-final-month-plan/reports/p0-domain-host-identity.md).

### Executing Core server adapter identity

The authenticated pre-dispatch identity gate also requires `serverTransportIdentity` from the running Core gateway owner, independently of Core's retained service identity and the native domain host's `loadedModules`. Missing, inactive, legacy, or different server provenance refuses before project creation, browser launch, chat, or provider dispatch. Pure offline recording without authenticated control remains exempt.

Before collecting production panel build inputs, Lab invokes Core's owning `apps/web/scripts/build-client-gateway-server.mjs` generator. Workspace staging copies `.server-runtime/client-gateway-server.mjs` and its `.identity.json` companion together; both influence the build key. Canonical and copied inventory/artifact freshness are checked before compiling or reusing a published panel. The executing native reader hashes all surrounding semantics and normalizes only its single embedded identity payload; this is not a raw full-file digest. The diagnostic reports an immutable descriptor captured by the actual `ClientGatewayService` before IO and activated only by its current listening lease. Route reload and changed files on disk cannot update an older retained owner.

This proves provenance for the supported registered web startup adapter. Arbitrary bypass listeners and attribution of each remote socket to that listener remain outside the contract. The focused native socket proof uses a synthetic authenticated HTTP wrapper around the real handler, not production Next. The opt-in production Next test requires explicit current-session panel-management authorization before enabling `FLUXIQ_SERVER_ADAPTER_NEXT_PROBE=1`; a skipped test is not production verification.
