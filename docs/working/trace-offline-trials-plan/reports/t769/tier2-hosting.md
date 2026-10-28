# Report: t769 tier2-hosting (where production hosts the tier-2 snapshot page)

Worker: tier2-hosting (worker-high, read-only design). Trees: `fxwork/t769/{!FluxIQWebExtension,!FluxIQ}`, branch
`task/t769-p6-offline-trials-in-builds` (not switched). Edited nothing but this report.

## Outcome

Done. The recommendation is option (b): a sandbox browser launched from the host process, using the P5 code that has
already been proven. The P6 default stays tier 1 only, with no reevaluator. Tier 2 sits behind a host-runtime capability
that the host declares only when a flag is on and the sandbox can actually start. Option (a), which would run the
sandbox in the extension, cannot reproduce "the page at its own address, scripts and network off" in Chrome/Edge
without the `debugger` permission. Every alternative inside the extension changes the page's origin, and none of P5's
equality evidence would carry over to it.

## 1. Production topology (read from source)

- **Core runs as a Node process.** It is the Next.js panel (`!FluxIQ/apps/web`), started by `pnpm dev`
  (`scripts/run-fluxiq-web.mjs`) or by the Lab (`packages/test-runner/src/environment.ts:173`). At startup it loads
  `FLUXIQ_HOST_MODULE` with a native `import()` (`apps/web/src/lib/fluxiq.ts:246`). That module is
  `domain/dist/host/web-panel-host.mjs`, which esbuild bundles for `platform: "node"` with FluxIQ external
  (`domain/scripts/build-web-panel-host.mjs`).
- **The host wires the domain into Core.** `registerFluxIQHost` registers the domain, its IO, its recording domain and
  its runtime. `registerWebAutomationRuntime` then binds the host runtime boundary (`domain/src/runtime/host-runtime.ts`)
  through `bindHostRuntime` (Core `runtime/service.ts:522`).
- **The extension talks to Core over the client gateway.** It connects over Core's own WebSocket server
  (`apps/web/src/server/client-gateway-websocket.ts`). Commands go out as `execute_action`. Trace artifacts come back as
  an HTTP `PUT /api/client-gateway/trace-artifacts/<sha256>` (`apps/web/.../trace-artifacts/[sha256]/route.ts`, at most
  20 MB each, PUT only). The extension declares its capabilities in its hello. The hello carries only the manifest
  version (`gateway-session.ts:162`), not a content-code identity.
- **The build's offline trial runs in that same Node process.** It runs inside the Automation Studio service.
  `runtime/service/offline-trial/contracts.ts:60` already takes `reevaluator?: ClientGatewayTraceReevaluator`. No
  production caller passes one yet: the only caller is `gateway-trace/replay-sources.ts`. The reevaluator reads snapshot
  bytes through the request's `readArtifact`, which is Core's own trace store. So the trace data is already on the host
  side.
- **The host process has no page today.** Domain depends only on `fluxiq` and `@fluxiq/client-gateway-websocket`. Any
  `WebSnapshotPage` (`domain/src/runtime/offline-reads/snapshot-page.ts`, browser-agnostic by design) needs either a
  browser the host launches, or a round trip to the extension's browser.

## 2. Options

### (a) A gateway command that has the extension evaluate a read over a snapshot

The wire shape has a precedent. `web.page.facts` is a host query that travels `execute_action` under its own action
type and is never a Flow output (`domain/src/actions/fact-check/request.ts:1-21`). It is intercepted in
`gateway-session.ts:125-136`, routed through `server-command-channel.ts` (`evaluate_facts`), `runtime/command-router.ts`
and `runtime/fact-check-runner.ts`, and declared as capability `web.facts` (`domain/src/runtime/capabilities.ts`).

A new `web.snapshot.evaluate` would touch:

- domain: request type, mapping, capability;
- extension: `shared/protocol.ts` (`ServerCommandPayload`), `gateway-session.ts`, `server-command-channel.ts`,
  `command-router.ts`, a new runner and the sandbox;
- the manifest, plus `scripts/release/permission-review.mjs`;
- tests and documentation on both sides, as AGENTS.md requires.

The bytes would have to ride the command over the socket: Core's route is PUT only. That is base64, up to 20 MB per
part.

The sandbox is where this option breaks down. These are the ways an extension could host it in Chrome/Edge:

- **`chrome.debugger` (CDP) on a tab.** This is the only faithful variant. `Fetch.fulfillRequest` serves the primary at
  its own URL with a `script-src 'none'` header, the network is set offline, and the service worker is bypassed. The
  extension's static content scripts (`<all_urls>`, `document_start`, isolated world plus a MAIN world script) would then
  inject themselves, so the installed content code runs with no version skew. That is its one real advantage.
  The costs:
  - A new `debugger` permission, which brings an install warning and store scrutiny.
  - A "FluxIQ started debugging this browser" bar on every tab while it is attached.
  - It conflicts with open DevTools.
  - A tab or window appears in the person's real profile during builds. The origin's existing service workers and
    storage live in that profile.
  - It collides with the extension's own tab tracking: the active and automation tab, host leases, and the
    `webNavigation` and tab events forwarded to Core as inputs.
  - Firefox has no `chrome.debugger` (it has no capture either).
- **An offscreen document (`chrome.offscreen`, `DOM_SCRAPING`).** It has no tab id, so `chrome.scripting` cannot
  inject into it. Static content scripts do not match a `chrome-extension:` parent. Its viewport and layout are
  unproven for visibility and geometry checks. Only one may exist at a time.
- **An extension page that parses the snapshot into its own document and loads the content bundle as a `'self'`
  script.** Its meta CSP can turn the network off. The drawbacks:
  - The origin becomes `chrome-extension://`, not the snapshot's.
  - The content code and the page-world code share one realm.
  - Declarative shadow roots need `setHTMLUnsafe` (Chrome 124), but `minimum_chrome_version` is 116.
  - The content code is no longer a content script, so its messaging changes.

  Fidelity would have to be proven again from scratch.
- **A hidden tab with `declarativeNetRequest`.** DNR cannot fulfill a body, and a redirect changes the document URL.

Summary for (a): it is a synchronized wire change across 8 or more files plus a permission, and its only faithful form
is `debugger`, with visible user-facing side effects. Risk: high.

### (b) A headless browser launched from the host process (recommended)

The host process drives an installed Chrome, or Edge as a fallback, through `playwright-core@1.51.1`. That version is
already in `pnpm-lock.yaml:344,491` under `@playwright/test@1.51.1`, so no browser download is needed. Edge ships with
Windows. The code is P5's `openWebSnapshotPage` (`packages/test-runner/src/offline-snapshot-page/`). It already does
everything the sandbox needs:

- a fresh offline context with a temporary profile;
- the primary served at its own address with `script-src 'none'`;
- 204 for held navigations, and an abort for every other request;
- content code in an isolated world;
- CDP counting of parsed scripts.

That is the code that measured offline equal to live on job-board (84/84 cells), photo-social (566/566) and
social-network-feed (906/906). It imports only the Playwright `Browser` API and domain types.

Changes it needs:

- Move it to production code.
- Switch `@playwright/test` to `playwright-core`.
- Default to headless. P5 ran headed only, so headless fidelity is a new gate.
- Keep one browser per host, launched lazily and closed when idle.
- Probe availability once.

Its own costs:

- A Chromium process while builds evaluate (one context per evaluation).
- 3.0-6.9 s per evaluation as measured in P5d (headed), about twice that with the D37 control.
- Hosted Core needs Chromium on its server, or it runs without tier 2.
- **Content-code skew.** The host runs the bundles from `apps/extension/dist/chrome/`
  (`extension-content-code.ts` refuses bundles older than the source), not necessarily the installed extension's. The
  D37 control turns a drift that changes the recorded read into a gap. A drift that affects only the changed read is
  still a residual risk (P5 open question 2), and W-D closes it.

It needs no wire change and no extension permission. Page data stays where the trace store already holds it. It does
not compete with the person's tabs. Risk: medium, bounded by a flag.

### (c) Other options

- **(c1) Tier 1 only, with the reevaluator absent.** It costs nothing and is honest: every changed read is a gap and is
  tried live. It gives up the main savings. Social alone had 233 changed-read pairs in round 4 (P5s).
- **(c2) jsdom or linkedom in Node.** These have no layout engine. The content code's visibility, geometry and scroll
  rules would all break. Rejected.
- **(c3) Lab-only tier 2.** Already exists (P5). It does nothing for production builds.

## 3. Recommendation

**P6 default: (c1)**, so that P6's trial-gate work (which shares gates with t751) never waits on browser hosting.
**Tier 2: (b), behind a flag**, so that P6's build can test that a whole read change is detected offline.

Core sees tier 2 only through a host-runtime capability, `trace-reevaluation`. The host declares it only when all of
these hold:

- `FLUXIQ_OFFLINE_READS_TIER2=1`;
- the sandbox launched once;
- the content bundles were found and are current.

When any of these is missing, the field is absent, so every changed read is a gap. This answers the brief's last
question: yes, tier 1 with the reevaluator absent should be P6's default, with tier 2 behind that flag. The plan is to
turn it on in Lab runs first, after the headless gate below passes. The default for the person's own builds should flip
only after W-D lands, because before that the content code can drift unseen.

Placement follows existing patterns:

- The Core seam is a field on the boundary, like `factEvaluator` and its `fact-evaluation` capability
  (`host-runtime.ts:7-16,192`).
- The sandbox lives in a Node-only domain subtree with its own subpath export. It must not appear in `domain/src/index.ts`.
  The audit's `browser-imports` rule already fails if it ever becomes reachable from the five extension bundle entries;
  the extension value-imports only `domain/client`.
- Launchers pass the content directory as an environment variable, as they already do for `FLUXIQ_HOST_MODULE`, so
  domain code holds no repository paths.

### Worker briefs, partitioned by file

| Brief | Agent | Owns (exact files) | Depends on |
| --- | --- | --- | --- |
| W-A Core seam | worker | Core `packages/fluxiq/src/programs/automation-studio/runtime/host-runtime.ts` (`"trace-reevaluation"` in `AutomationStudioHostRuntimeCapability`; `traceReevaluator?: ClientGatewayTraceReevaluator` on the boundary), new `runtime/tests/trace-reevaluator-boundary.test.ts`, `docs/architecture/automation-studio/client-gateway.md` ("Gateway traces and offline trials"), framework reference via `pnpm docs:reference` | none |
| W-B sandbox move | worker-high | `packages/test-runner/src/offline-snapshot-page/**` moved to `domain/src/snapshot-sandbox/**` (move, never copy; switch to `playwright-core`; `headless` option defaulting to true; lazy shared browser with idle close; `chrome` then `msedge` fallback; `available()` probe); `domain/package.json` (dependency `playwright-core: 1.51.1`, export `./snapshot-sandbox` to dist); `domain/scripts/build-web-panel-host.mjs` (`playwright-core` external); callers `packages/test-runner/src/offline-trial-experiment/tier2/open-tier2-reevaluation.ts`, `apps/extension/e2e/content/tests/offline-reads/tests/{harness-content-code,offline-reads.spec}.ts`, `packages/test-runner/src/guarded-browser/tests/launch-containment.test.ts` (drop its entry), `scripts/structure-audit/config.mjs` (`reachBoundaries.to` path), `pnpm-lock.yaml` | none (runs parallel to W-A) |
| W-C host wiring and docs | worker | `domain/src/runtime/host-runtime.ts` (optional `traceReevaluator` and capability), `domain/src/runtime/service.ts` (passes it through), `domain/src/web-panel-host.ts` (dynamic import of `./snapshot-sandbox` under the flag), new `domain/src/snapshot-sandbox/host-reevaluator.ts` and test, `scripts/run-fluxiq-web.mjs` and `packages/test-runner/src/environment.ts` (`FLUXIQ_OFFLINE_READS_TIER2`, `FLUXIQ_EXTENSION_CONTENT_DIR`, `FLUXIQ_SNAPSHOT_SANDBOX_HEADED=1` in the Lab), `docs/architecture/{extension-client,testing-facility,repository-layout}.md` (replace "today only the test runner does") | W-A, W-B |
| W-D content identity (wire change) | worker-high | `apps/extension/scripts/build-extension.mjs` (digest of the content and page-world bundles, defined into the background), the extension's capability declaration site (`browserExtensionCapabilities`), `domain/src/runtime/capabilities.ts` (`contentCodeDigest` metadata), `domain/src/snapshot-sandbox/` content-code loader (same digest; refuse on mismatch), their tests, `docs/architecture/web-capabilities.md` | W-B; it may follow P6 |

The Core build call site, `reevaluator: hostRuntime?.traceReevaluator` in the offline trial input, belongs to P6's
Core trial-gate brief and is deliberately not listed here, to keep one owner per file.

### Provider-free headed checks on the realistic scenarios

1. After W-B, `node scripts/test-content.mjs -- --headed --workers=2 offline-reads` should pass the same 5 cases as P5
   on job-board (Chrome and Edge), photo-social, social-network-feed and the photo-social dynamic gap. This proves the
   move kept the behaviour.
2. The new headless-fidelity gate goes in the same spec. The production factory runs with `headless: true` while the
   live half stays headed. Rows and cells must equal live and headed on job-board, photo-social and social-network-feed,
   and the dynamic photo case must stay a `dynamic_content` gap.
3. `trial --tier2` and the `reads` gate run on the production factory over the round-4 trace copies (in t749's ignored
   `test-runs/p5`; copy them again if they were pruned), headless. The target is P5 W8's table: job 2/0/8, social 22/4/0,
   and social revision 16 giving 0 rows with the oracle failing.
4. Unit tests:
   - Core W-A: the field passes through.
   - Domain W-C: the capability is declared only with flag, browser and bundles all present. Without them the
     reevaluator is absent and every changed read stays a gap.
5. Not provider-free: a real build whose model writes a changed read. That belongs to P6's breadth round.

## Commands run and observed results

Reads only (grep, sed, ls). No build, test or browser ran. The key observations are cited inline: no `debugger` or
`offscreen` permission in `manifest.chrome.json`; the trace route is PUT only; the offline-trial input has an optional
`reevaluator`; `playwright-core@1.51.1` is in the lockfile.

## Not verified

- Headless Chrome giving the same layout results as headed for these reads. This is the first gate check, and P5 ran
  headed only.
- The Chrome API behaviour cited for option (a): offscreen layout, content-script injection into sandboxed or
  extension-parent frames, and how a service worker interacts with `Fetch` interception. I reasoned about these and did
  not test them.
- Whether `playwright-core` imports cleanly from the Next.js panel's process when bundled external. Its resolution is
  from `domain/node_modules`, because the host `.mjs` lives in `domain/dist/host/`.
- Process memory and launch time of the host browser on this 12 GB machine.

## Open questions or contradictions found

1. **The headed rule versus a headless production sandbox.** The user's standing rule makes every Lab browser headed.
   W-C sets the sandbox headed in Lab runs. Whether the person's own builds may use a headless sandbox is a product
   choice the user has not stated. Headless is my recommendation, so that windows do not pop up during builds.
2. **Boundary judgement.** A Playwright-driven sandbox inside `domain/src/snapshot-sandbox/` reads AGENTS.md's
   "domain owns ... runtime adapters" as covering a host-side browser adapter. The extension still owns `chrome.*` and
   the content code, which the sandbox only loads as built bundles. A separate package was considered and rejected: it
   would create a domain-to-package-to-domain dependency cycle, because the host must import it and it needs domain
   types and `executeActionMessage`.
3. **Hosted Core.** If Core runs remotely, (b) needs Chromium on that server. The flag and the probe keep tier 2 absent
   rather than failing.
