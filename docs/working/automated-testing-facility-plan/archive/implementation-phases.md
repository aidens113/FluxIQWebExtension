> Archived 2026-09-28 from `automated-testing-facility-plan.md`: the full Phase 0-12 implementation phase plan, superseded by the Execution Log and Current State in the main document.

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

### Top-level graph compatibility escape audit (`primary`, 2026-09-05)

Status: implementation in progress.

Execution assignment (2026-09-05): Core service/model/runtime compatibility and
invariant work is assigned to `core_invariants`; Core Nodes-view scoping and
restored-tab recovery is assigned to `core_ui_scope`; downstream persistent-demo
Router/Subflow provisioning, migration, assertions, and tests are assigned to
`facility_router_subflow`. The primary agent owns cross-repository integration,
working-document reconciliation, and final automated/live validation.
After the first Core boundary tests exposed legacy direct-parent assumptions in
the wider service suite, `core_failure_audit` was assigned to classify each
remaining failure while `core_invariants` continues the required production and
fixture migration; the guard will not be weakened to preserve stale tests.

Downstream status (`facility_router_subflow`, 2026-09-05): completed and
automatically validated; cross-repository live validation is assigned to the
primary after integration of the two Core slices. The focused type check and
complete test-runner suite pass 114/114, and the
extension repository-wide `pnpm check` passes across all ten checked packages.

The persistent demo exposed a real boundary violation rather than a hidden
browser capability. The facility created a normal top-level Flow through the
panel, then used Core's public `save-flow` and `apply-graph-patch` endpoints with
that parent Flow ID. Its fixture builder put the Start, four web actions, End,
and five edges directly in the parent document. It subsequently opened the
globally addable Nodes tab while that parent was selected and ran the parent
from Runtime Debug. The facility did not create a Subflow, obtain a
`graphFlowId`, or configure a Router.

Read-only inspection of the persistent isolated project proves the resulting
shape. Project `08672748-82ca-4246-a2c1-1c2646760c42`, Flow
`flow.b48b9824-8103-4b11-a804-5311a65096c3` has six live `graph_nodes` rows,
zero live `subflows` rows whose `parent_flow_id` is that Flow, and zero
`routers` rows for it. Its SQL Flow metadata is an ordinary top-level
`user`/`visual` Flow with null `parent_flow_id` and null `owning_subflow_id`; it
is not marked as a legacy artifact or Subflow graph.

This succeeds because three Core seams currently agree on the old single-graph
model even though the current authoring architecture does not:

1. `AutomationStudioService.saveFlowInternal` validates a Flow document's
   graph but does not reject nodes/edges on a top-level Flow.
2. `AutomationStudioService.applyFlowGraphPatch` accepts any canonical Flow ID,
   imports its graph if necessary, applies the patch, and saves it without
   checking that the target is a Subflow-owned graph Flow.
3. `runRuntimeSession` consults routing only when `getFlowRouter` returns a
   Router. If no Router exists, it executes `runtimeCanonical` directly. No
   provenance, creation-version, or migration marker restricts that fallback
   to an actually legacy Flow.

This behavior is also locked in by a current Core service test that creates a
new canonical Flow, saves Start/constant nodes directly on it, and expects
`runRuntimeSession` to succeed without Router/Subflow setup. The correction is
therefore a model migration with compatibility consequences, not merely a
missing HTTP check.

The web panel exposes the same seam. The Nodes view registry requires merely
`hasFlow` and describes its scope as "Selected Flow or subflow". Its connected
view resolves the selected parent Flow ID directly. Consequently the tab picker
can attach a Nodes editor to a top-level Flow even though the accepted product
model states that a top-level Flow owns Router/Subflows and a Subflow owns its
Nodes editor.

Classification:

- **Core invariant bug:** compatibility for existing single-graph Flows is
  currently an unrestricted representation and execution path, not a bounded
  legacy migration path. A newly created Flow can therefore bypass both Router
  and Subflow ownership through public APIs.
- **Core UI bug:** the Nodes view is addable and bindable for a top-level Flow,
  contradicting the documented Flow-first hierarchy.
- **Facility implementation bug:** the deterministic demo deliberately seeds,
  patches, asserts, and runs the parent graph. It tests the compatibility escape
  instead of the intended Router-to-Subflow product workflow.
- **Not an extension privilege bug:** the browser extension did not reach into
  Core storage or traverse a private graph boundary. Core accepted and executed
  the malformed modern structure through supported endpoints.

The current persistent demo Flow must be treated as invalid test data under the
intended architecture. Do not migrate it in place silently: recreate it through
the real panel workflow, or perform an explicit, evidenced migration that moves
its graph to a newly created primary Subflow and installs a Router fallback.

Downstream execution revision (`facility_router_subflow`, 2026-09-05): the
primary approved a narrow deterministic-fixture exception after inspection of
the Nodes editor gesture surface. Parent Flow creation/reuse, primary Subflow
creation, Router fallback configuration, opening the Subflow Nodes editor,
rendered layout validation, pairing, recording, and run dispatch all use the
real panel UI. The six-node deterministic document and viewport index are
written through Core's public save/graph-patch seam only against the
UI-created Subflow `graphFlowId`, never against the parent Flow ID. Reproducing
six palette additions, inspector edits, five ReactFlow connection gestures,
and coordinate drags would turn this setup helper into fragile duplication of
Core's separate graph-editor interaction suite without improving the ownership
invariant under test. API reads verify every durable identity and relationship.

The retained malformed fixture migrates without an unsafe gap. The runner
recognizes only the exact fixture-owned direct-parent graph, creates/reuses and
fully verifies its dedicated Subflow graph, configures and reads back the
parent Router fallback, and only then clears and upgrades the parent graph.
An interruption therefore leaves either the original executable fixture or a
complete routed replacement. Schema `0.2` workspace state remains readable as
migration input; schema `0.3` adds `subflowId`, `graphFlowId`, and `routerId`.
Playback runs the parent and fails unless run detail contains the matching
Router decision, matching Subflow execution entry (including `graphFlowId` and
route-decision linkage), expected successful action attempts, and final
Scenario Lab result.

Remediation plan, in dependency order:

1. Define a Core-owned representation invariant that distinguishes top-level
   orchestration Flows from Subflow graph Flows. Preserve old single-graph
   artifacts only through an explicit legacy marker/version or a deterministic,
   idempotent migration to a generated primary Subflow. Creation time alone is
   not a safe discriminator.
2. In Core, reject non-empty graph writes to modern top-level Flows in both
   `save-flow` and `apply-graph-patch`. Permit graph mutations only for a Flow
   proven to be owned by a Subflow, plus any narrowly marked legacy transition
   case. Apply the invariant in the service rather than only in HTTP handlers so
   alternate callers cannot bypass it.
3. In Core runtime readiness/execution, fail closed when a modern top-level Flow
   has no executable Router/Subflow path. Legacy single-graph execution must be
   explicitly marked or migrated and must emit migration/compatibility
   diagnostics. Never infer legacy status solely because a Router is absent.
4. In the web panel, make Nodes require a selected Subflow graph, prevent a
   top-level Flow ID from binding to the Flow editor, and make stale/restored
   parent-bound Nodes tabs recover to Router or Subflows with a visible reason.
5. In the facility's first demo script, use the real panel to create/select the
   parent Flow, create a primary Subflow, open that Subflow's Nodes editor, and
   build or import the deterministic graph only through the Subflow's
   `graphFlowId`. Configure the parent Router through the real UI with a route or
   fallback targeting that Subflow. API reads may discover IDs and verify
   durable state, but API writes must not replace these UI operations in this
   product-level test.
6. In the second demo script, run the parent Flow through Runtime Debug and
   assert a persisted route decision, a Subflow entry containing the exact
   `graphFlowId`, the expected action attempts, and final Scenario Lab state.
   A successful run with zero route decisions or zero Subflow entries must fail.
7. Rework fixture identity and persistent reuse around parent Flow + Subflow +
   graph Flow + Router identities. Detect the current direct-parent fixture and
   require explicit migration/recreation rather than continuing to reseed it.
8. Add Core regression coverage for modern parent graph save rejection, graph
   patch rejection, routerless modern runtime rejection, correct routed Subflow
   execution, explicit legacy compatibility/migration, and Nodes-view scoping.
   Add facility unit and live-browser coverage proving that both scripts operate
   the intended hierarchy and cannot pass through the direct-parent fallback.

Validation required before closing this defect:

- a newly created top-level Flow cannot acquire nodes through either public
  mutation endpoint;
- the Nodes tab cannot open against a top-level Flow, including restored tabs;
- an explicitly supported legacy single-graph Flow remains readable and follows
  the selected migration/compatibility policy;
- the demo workspace contains one parent, at least one dedicated Subflow graph,
  and a Router targeting it, with no action nodes on the parent;
- a live headless run records a Router decision and matching Subflow boundary
  before the web action attempts; and
- the recording and playback scripts retain their before/after action evidence
  requirements after the hierarchy correction.
