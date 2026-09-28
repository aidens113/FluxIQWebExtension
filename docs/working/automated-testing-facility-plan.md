# Automated FluxIQ Web Testing Facility Plan

Status: Active
Status detail: The facility is structurally intact and is the live substrate every MVP lane runs on, and the repository gates pass today (3,928 tests, 0 failures). The 2026-09-28 audit found the document badly stale rather than the code rotted, plus seven open defects: CI has been red on every run since it began firing and would not pass even once configured, the extension e2e suite runs in no automated gate at all, the evidence policy the document states is no longer what the code does, the Phase 8 safeguard enforces nothing at runtime, two lanes launch a browser with no network guard, the Phase 7 gate is unsatisfiable as written, and the `existing` and `clone` lanes have still never run.
Created: 2026-09-04
Last updated: 2026-09-28
Owner: Senior supervisor agent (the original `Execute Plan With Subagents` mode and its rotated phase subagents are retired; the 2026-09-28 audit was run by six workers whose reports are under `automated-testing-facility-plan/reports/`)
Scope: Automated Playwright testing facility for the FluxIQ web extension in `F:\!FluxIQWebExtension`: Scenario Lab fixtures, real-extension fixture, isolated/existing/clone/persistent-isolated FluxIQ topologies, evidence bundles, matrix/CI, bounded improvement agents, persisted-Flow execution, and the persistent self-recording demo scripts.
Paired document: none authored, though the document records Core-side changes (Flow representation metadata, the PIN-authorized legacy migration endpoint, Router/Subflow runtime entry) at lines 67-75 of the archived design record and at 455-464 here, and the audit found two open Core defects; a Core-side document is owed if that work continues.
Related: [repository layout and commands](../architecture/repository-layout.md), [testing facility architecture](../architecture/testing-facility.md), and the Documentation Sources section at the end of this document.

---

## Current State

Audited end to end on 2026-09-28 by six workers, with the repository gates run
directly. **The facility is sound; the document was stale.** Nothing rotted —
what the plan describes was built, still stands, and is the substrate every MVP
lane has run on since. Seven defects are open. Full evidence, with citations,
is in `automated-testing-facility-plan/reports/` (six reports).

**Verified working (measured, not claimed)**

- `pnpm test`: **3,928 tests, 0 failures** across ten packages (test-runner
  1,470, domain 847, extension 832, scenario-lab 571, test-contracts 145,
  test-evidence 17, test-matrix 17, agent-orchestrator 16, real-site-policy 7,
  boundary-audit 6). `tsc --noEmit` clean.
- Structurally intact: of 285 files the 2026-09-04..09 build touched, 204
  remain; every "missing" source file became a *directory* under the later
  decomposition policy, and 71 more were tests relocated into `tests/`.
  Almost nothing was deleted.
- Live infrastructure, not scaffolding: **170 commits touched
  `packages/test-runner` since 2026-09-11**, through 2026-09-27.
- No stubs, no rot: one unresolved import in 1,525 files (a deliberate fixture
  at `tests/prerequisites.test.ts:56`); zero TODO/FIXME; zero skipped tests.
- All four targets exist and are doubly validated (`target-config.ts:4,66`,
  `commands.ts:278`). The Phase 12 lock is a genuine `O_EXCL` mutex that
  refuses a live PID and fails closed on a stale one
  (`workspace-lock.ts:57,78,134`).
- The toolchain pin never drifted: `@playwright/test` 1.51.1 exact, Chromium
  134.0.6998.35, unchanged since `5e9d97e7`. All six Phase 2 behaviours still
  have live specs; the recorded "8/8" is now 12 tests in 5 files.
- Boundary holds: `test-contracts` is `private: true`, five in-repo consumers,
  **zero** outside. Hygiene clean; no generated artifact tracked.
- Phases 6, 7 and 8 pass at exactly their 2026-09 counts (16/16, 6/6, 7/7):
  those packages never changed, while everything in use grew ~10x.

**Corrections — claims here that are no longer true**

- *Scale.* The corpus is **41 scenarios, not ten** (`registry.ts:45-87`);
  test-runner is **228 files / 1,428 cases, not 116**. No scenario is dead; the
  selector reads the registry, not a hardcoded list.
- *Evidence policy.* The event-only claim is wrong three ways:
  `run-scenario.ts:178` sets `screenshotAdapter = undefined`, so **the Lab
  runner has taken no screenshots since `de790249` (2026-09-25)**;
  `effective-evidence-policy.ts:41` omits `deduplicateScreenshots: false`, so
  **dedup defaults on**; and `sampleFps` is never read by `capture.ts`, so it
  is unimplemented, not disabled. Event-only survives only on the demo path
  (`browser-evidence.ts:34-44`). The body still specifies dedup *and* a
  0.5-1 FPS sampler as the design.
- *Gate comparability.* Every "`pnpm check` passes" claim predates today's
  `check`, which was then only `pnpm -r check`. The old claims are not
  comparable to today's result.
- *Cited evidence is unreproducible.* All five run ids offered as proof, and
  the Phase 11 workspace `test-runs/web-extension-demo`, are gone from disk.
  `test-runs/` is disposable by design, so those claims now rest on this
  document's assertion alone.

**Open defects**

1. **CI has been red on every run since it started firing.** Five runs,
   2026-09-24 to 2026-09-28, each failing in 6-9s at `Verify CI prerequisites`
   because `FLUXIQ_CORE_REPOSITORY`, `FLUXIQ_CORE_REF` and
   `FLUXIQ_CORE_TOKEN` were never configured. Every downstream job is skipped,
   so **no Linux run and no three-repeat baseline has ever executed.** The
   workflow was written in the facility's first commit and never touched.
   Setting the three values is a repository-settings action only the owner can
   take.
2. **CI would still fail once they are set.** `nightly-full-matrix` checks Core
   out but never builds it, and nothing asserts Core was built: the staleness
   guard deliberately passes when `dist` is absent (`stale.mjs:17`, pinned by
   `stale.test.mjs:26`). A fresh checkout passes all three guards and dies on
   missing modules — reported as a product failure, not a setup failure.
3. **The extension e2e suite runs in no automated gate.** `test:e2e` is absent
   from `check`, `test` and `build`; only CI invokes it
   (`testing-facility.yml:134,137`), and CI has never run. Its fixture detects
   a *missing* artifact but never a *stale* one
   (`extension-context.ts:166-172`), so a hand-run suite can certify an old
   build.
4. **The nightly lane's cost was never re-estimated.**
   `testing-facility.yml:254` runs `lab matrix --all --repeat 3`, sized for ten
   scenarios and now expanding to 41.
5. **The Phase 8 safeguard enforces nothing at runtime.**
   `packages/real-site-policy` has zero runtime consumers;
   `docs/architecture/testing-facility.md:246` admits it "does not browse or
   execute probes". Real enforcement is the fail-closed guard at
   `network-guard.ts:54`, whose gaps are: `chrome-extension:`, `data:`,
   `about:` and `blob:` pass unconditionally, and Playwright's route layer does
   not intercept service-worker traffic while `serviceWorkers: 'block'` is
   never set (`launch-browser.ts:17`) — and the subject is an MV3 extension
   whose background *is* a service worker. `--host-resolver-rules`
   (`extension-context.ts:74`) still covers it, but nothing asserts that.
6. **Two lanes launch a browser with no guard at all.**
   `demo-workspace/browser-session.ts:51,60,135` and `ui-e2e/topology.ts:323`
   call `launchPersistentContext` without it, so the `demo:*` and `demo:llm:*`
   lanes the live campaign drives are uncontained.
7. **The Phase 7 gate is unsatisfiable as written.** `boundary-audit` requires
   two *distinct repositories* (`audit.ts:52`, pinned by `audit.test.ts:37`),
   while `AGENTS.md` forbids Core importing this private package. Close it by
   design or change the candidate.

**Still not done, now confirmed by measurement**

- The `existing` and `clone` lanes have never run: of **342 `run.json`
  manifests**, 330 are `isolated`, 3 `persistent-isolated`, 9 legacy, and
  **zero** `existing` or `clone`. Unchanged since 2026-09-10.
- Both Core items remain open. `/api/auth/session` is still absent, and
  `cancelRuntimeSession` is declared (`endpoints.ts:146`) and implemented
  (`runtime/service.ts:2865`) but **no handler registers it, so it 404s** —
  Core's own UI calls it (`run-commands.ts:21`) and hits the same 404. Raise
  that in Core.
- Only the Chrome side panel is opened by any e2e test
  (`extension-context.ts:81`); the Firefox popup build is never loaded, so the
  `AGENTS.md` side-panel/popup alignment contract has no mechanical
  enforcement. The Firefox lane also cannot launch here (1.51.1 pins firefox
  rev 1475; only firefox-1538 is installed).
- Phase 8 execution and Phase 7 promotion stay deferred; the Phase 6
  orchestrator is primitives-only and provably cannot dispatch or mutate a
  worktree (`worktree.ts:90-92` returns git argv it never runs).

**Smaller items for whoever next touches the area**

`existingFlowCancellationReport` (`existing-flow-run.ts:45`) is dead outside
its test, so the cancellation verdict is computed then discarded; the bounded
request ceiling drifted to 300s (`http-control/index.ts:35`) and a 401/403
silently re-logins once (`:176`); `existing-fluxiq-control.ts:659` embeds raw
control bytes in a regex, so `file` calls the largest source file binary and
`grep` skips it; `run-lab.mjs` gates read-only `--help` behind the Core
staleness check; `agent-orchestrator`'s tests sit at package-root `tests/`,
against the `AGENTS.md` placement rule; and redaction covers neither recorded
page data nor the browser profile (`run-redaction-scopes.ts:34-36`), with
credential-syntax findings advisory only.

**Where to look**

`reports/` for the six audit reports; `archive/` for the superseded design
narrative, phase step lists and 2026-09 validation transcripts; the Execution
Log below for the original per-phase record, which remains accurate for what
was built in 2026-09.

---

## Status (2026-09-06, superseded by Current State above)

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
| 11. Persistent self-recording demo | implemented and live validated in persistent isolation | primary | Both scripts own a copied Core process while retaining `test-runs/web-extension-demo/fluxiq-root/.fluxiq`, browser identities, authentication, project, Flow, recordings, and runtime history. Real headless record and No-LLM playback passes are recorded below. |
| 12. Persistent isolated topology | implemented and live validated | primary, `phase12_target_cli`, `phase12_allocation_lock`, `phase12_manifest_docs` | Named local topology retains `.fluxiq`, browser profile, generated identity, projects, recordings, and trusted-client state while using fresh processes, ports, session workspaces, and evidence per invocation. Two sequential live runs passed and all workspace gates pass. |

The per-phase step records that followed this table — the Phase 9 through 12
contract, clone, demo-workspace and topology detail written as each step
landed — are archived in
`automated-testing-facility-plan/archive/phase-step-records-2026-09.md`.

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

## Design Rationale (archived)

The executive decision, goals, non-goals for the first facility, and the
2026-09-04 audit findings for both repositories are archived in
`automated-testing-facility-plan/archive/design-rationale-and-boundary-audit.md`.

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

## Proposed Repository Layout (archived)

The originally proposed directory tree and its notes are archived in
`automated-testing-facility-plan/archive/design-rationale-and-boundary-audit.md`;
the layout as built is in [repository layout and commands](../architecture/repository-layout.md).

## Runner Topology (archived)

The runner topology diagram, the `isolated`/`existing` FluxIQ target-mode
contract, existing persisted-Flow execution, and the web-panel API login and
reusable session-cookie design are archived in
`automated-testing-facility-plan/archive/superseded-design-specifications.md`.

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

## Evidence And Human Review (archived)

The three evidence channels, capture triggers, run-bundle layout and retention
defaults are archived in
`automated-testing-facility-plan/archive/superseded-design-specifications.md`;
Current State records where that policy no longer matches the code.

## Test-control Seams

- `FLUXIQ_TEST_MODE=1` enables loopback-only test endpoints.
- A random per-run bearer secret authenticates the controller.
- Endpoints create/select the project, approve the expected client, expose readiness, and request clean shutdown.
- Test mode refuses non-loopback binds; production configurations do not register these routes.
- The extension test build may expose typed status/checkpoint messages; the production manifest/build excludes them.
- After bootstrap, scenarios use the real production gateway messages and action paths.

Do not UI-automate pairing in every correctness test. Give pairing UI one focused spec; repeated UI pairing adds timing noise and obscures fault ownership.

## Agent And Subagent Workflow (archived)

The machine-readable runner surface, agent roles, dispatch packet, safe
improvement loop and promotion gates are archived in
`automated-testing-facility-plan/archive/superseded-design-specifications.md`.

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

## Implementation Phases (archived)

The full Phase 0 through Phase 12 step plan is archived in
`automated-testing-facility-plan/archive/implementation-phases.md`; the
Execution Log above records what each phase actually delivered.

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

The persistent-isolated workspace schema, the live run ids, the clean-start and
regression follow-ups, and the final run-path audit that produced this result
are archived in
`automated-testing-facility-plan/archive/phase-step-records-2026-09.md`.

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

## Recommended Defaults To Confirm In Phase 0 (archived)

The five defaults proposed for Phase 0 confirmation are archived in
`automated-testing-facility-plan/archive/design-rationale-and-boundary-audit.md`.

## Documentation Sources

- Playwright extension testing: <https://playwright.dev/docs/next/chrome-extensions>
- Playwright screenshot, trace, and video options: <https://playwright.dev/docs/test-use-options>
- Puppeteer extension alternative: <https://pptr.dev/guides/chrome-extensions>
