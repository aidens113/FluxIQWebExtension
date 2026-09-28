> Archived 2026-09-28 from `automated-testing-facility-plan.md`: superseded design specifications — runner topology and FluxIQ target modes, the evidence and human-review policy (whose dedup and 0.5-1 FPS sampler no longer match the code), and the agent/subagent workflow for the retired rotated phase subagents.

# Superseded Design Specifications

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
