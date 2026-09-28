> Archived 2026-09-28 from `automated-testing-facility-plan.md`: the original design rationale — executive decision, goals, non-goals, the 2026-09-04 repository audit findings, the proposed repository layout, and the Phase 0 defaults to confirm.

# Design Rationale, Audit Findings And Proposed Layout

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

## Recommended Defaults To Confirm In Phase 0

- GitHub Actions, matching core's current CI.
- Retention periods from this plan until measured costs exist.
- Vendor-neutral task/result JSON with the existing Codex workflow initially.
- Windows first for local path parity; Linux before treating E2E as a release gate.
- No real-site selection before Phase 5 is stable.
