# Report: audit-testing-facility

Worker: audit-testing-facility. Read-only investigation, 2026-09-11.
Scope: the Testing Lab (Scenario Lab fixtures, `test-contracts`, `test-runner`,
`test-matrix`, `test-evidence`, `apps/extension/e2e`) described precisely
enough that a later worker can add a scenario and a benchmark lane from this
report alone.

## Outcome

Done. Sections (a)-(f) below, with the FluxBench coverage matrix, the
uncovered list, and a closing "what FluxBench needs that the facility lacks".
No source file, working document, or generated artifact was modified. No
build, Testing Lab run, browser, or panel was started; the three commands run
were read-only (`node dist/cli.js` usage, the pure `test-matrix` selector, and
one in-process import of the already-built Scenario Lab registry).

Three findings the supervisor should treat as decisions, not detail:

1. **The isolated `lab run` lane asserts only `expected.finalState`.**
   `expected.pageFacts`, `expected.recordingEvents`, `playbackGoal`,
   `allowedConsoleErrors`, and the per-scenario `evidencePolicy` are declared
   in every manifest and are never read by the runner
   (`packages/test-runner/src/run-scenario.ts:216`, `:358`;
   `packages/test-runner/src/scenarios.ts:25` is the only consumer of
   `recordingEvents`/`playbackGoal`, and it only asks "is this truthy").
   `expected.actions` is asserted only on the `existing` and `clone` targets
   (`run-scenario.ts:173`, `:197` into
   `packages/test-runner/src/existing-flow-run.ts:95-99`).
2. **Five of the twelve scenarios cannot execute their own recording script**
   in the isolated lane, because `selector()` understands only `testid:`
   (`run-scenario.ts:356`) while manifests also use `role:` and `frame:`
   prefixes; and `failure-surfaces` scripts a click on a `disabled` button
   that Playwright will never perform. Only `basic-form` is documented as
   actually verified end to end (`docs/architecture/testing-facility.md:161`,
   `:714`).
3. **There is no repeat-run aggregation and no `RunEvaluation` producer.**
   `matrix --repeat N` runs N independent runs and prints them as a list
   (`packages/test-runner/src/cli.ts:50-55`); the only metric any run emits is
   `steps` (`run-scenario.ts:282`); `compare` diffs exactly two
   `summary.json` files and hardcodes two of its three gates
   (`cli.ts:62-68`). `RunEvaluation`/`InvariantResult`
   (`packages/test-contracts/src/evaluation.ts:9-17`) are defined and
   validated but never constructed by any run path.

## What changed and why

Nothing. This brief is read-only investigation; the only file written is this
report.

## Commands run and observed results

1. `node packages/test-runner/dist/cli.js` (no arguments, from the repository
   root) printed the usage line to stderr:
   `{"status":"failed","category":"unknown","message":"Usage: lab interactive <scenario> [--target isolated|persistent-isolated|existing] [--workspace NAME] [--fresh-login] | run <scenario> [--target isolated|persistent-isolated|existing|clone] [--workspace NAME] [--flow ID] [--fresh-login] [--seed N] [--evidence MODE] | matrix (--all|--scenarios-json JSON) [--target ...] [--repeat N] [--evidence MODE] | auth status|clear | clone-cache status|refresh|clear | inspect <run-id> | compare <baseline> <candidate>"}`
   This is the authoritative verb list used in section (c).
2. `node -e "import('./apps/scenario-lab/dist/registry.js').then(m => ...)"`
   over the already-built `dist` listed **12** manifests with their tags,
   capabilities, recording-step counts, `playbackGoal` presence, and expected
   action/final-state counts. Observed ids, in registry order: `basic-form`,
   `dynamic-list`, `navigation`, `long-document`, `iframe-checkout`,
   `ambiguous-targets`, `delayed-ui`, `failure-surfaces`, `reconnect`,
   `sensitive-input`, `llm-target-drift`, `instruction-only-form`
   (`count=12`). Only `llm-target-drift` and `instruction-only-form` carry a
   `playbackGoal`; `instruction-only-form` is the only one with an empty
   recording script.
3. `node packages/test-matrix/dist/cli.js apps/scenario-lab/src/scenarios/llm-target-drift/scenario.ts domain/src/actions/x.ts`
   returned `"scenarioIds"` containing exactly the ten catalog ids and **not**
   `llm-target-drift`, with `"reasons"` showing the `scenario-fixture` rule
   matched the changed fixture path. Observed gates:
   `["browser-smoke","changed-scenarios","static"]`. This is the observed
   proof of the `test-matrix` drift described in section (d).

Not run: `pnpm check`, `pnpm test`, `pnpm build`, any `pnpm lab ...`
execution, Playwright, the panel. The brief forbids them.

## (a) The twelve scenarios, and what each covers

All twelve live under `apps/scenario-lab/src/scenarios/<id>/scenario.ts`, are
registered in `apps/scenario-lab/src/registry.ts:16-29`, and have their id
listed in `apps/scenario-lab/src/types.ts:1-5`. Every fixture is built by
`defineScenario`, which validates the manifest and fails if `id`, `title`,
`startPath`, or `seed` disagree between definition and manifest
(`apps/scenario-lab/src/types.ts:42-47`).

Shared state-store behaviour (identical for all twelve):
`ScenarioStateStore` holds one in-memory state object per scenario id, built
by `createState(seed)` at construction and on `reset()`
(`apps/scenario-lab/src/state-store.ts:20-23`); `mutate(id, operation,
payload)` replaces that state with `scenario.mutate(...)` and returns a
`structuredClone` snapshot (`state-store.ts:33-40`); `reseed` re-runs every
`createState` with a new safe-integer seed (`state-store.ts:15-18`, `:47-49`).
The browser reaches the store only through
`POST /api/<scenarioId>/<operation>` with `authorization: Bearer <runToken>`,
generated into every page by `fixtureClient`
(`apps/scenario-lab/src/html.ts:30-42`, served at
`apps/scenario-lab/src/server.ts:78-85`).

"Oracle" below means the manifest's `expected.finalState`, because that is the
only expectation set the isolated runner actually asserts
(`packages/test-runner/src/run-scenario.ts:216`, `:358`).

| # | Scenario (seed) | Purpose | Fixture pages | State-store behaviour | Oracle / final-state predicate | FluxBench categories touched |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `basic-form` (101) | Text entry, select, submit, result text | `/scenarios/basic-form/` | `submit` validates a non-empty name and a plan in `starter\|team\|enterprise`, then sets `submitted`, increments `submissionCount`, stores values (`basic-form/scenario.ts:37-48`) | `result` text `Submitted` | forms |
| 2 | `dynamic-list` (102) | Seeded stable item identities, add/remove/reorder | `/scenarios/dynamic-list/` | `add` appends `item-<nextId>`; `reverse` reverses; `remove` filters by id; ids derive from the seed (`dynamic-list/scenario.ts:29-46`) | `item-count` text `4 items` | dynamic interfaces; moved elements |
| 3 | `navigation` (103) | Full navigation, pushState history, reload, 302 redirect | `/scenarios/navigation/{start,second,history,redirected}` plus `/redirect` (302 at `server.ts:88-92`), all rendered by `navigationPage` (`navigation/scenario.ts:40-56`, routed at `server.ts:132-135`) | `visit` appends a bounded visit list and counts redirects (`navigation/scenario.ts:27-34`) | `document` `path` == `/scenarios/navigation/history` | multi-page navigation |
| 4 | `long-document` (104) | Below-fold targeting, sticky header, scroll | `/scenarios/long-document/` (24 sections; target index seed-derived) | `reach` flips `reached` (`long-document/scenario.ts:24`) | `result` text `Reached` | (scrolling only; not infinite scroll) |
| 5 | `iframe-checkout` (105) | Same-origin and distinct-loopback-origin frames | `/scenarios/iframe-checkout/` plus `/same-frame` and `/cross-frame` (`iframe-checkout/scenario.ts:36-39`, routed at `server.ts:136-137`); the cross frame is served from a **second** HTTP server on its own random port (`server.ts:32-42`) with a relaxed CSP (`server.ts:93-95`) | `same`/`cross` increment per-frame click counters (`iframe-checkout/scenario.ts:25-29`) | `same-frame` and `cross-frame` text `Confirmed`, resolved through the frame-aware probe (`scenario-assertions.ts:39-47`, `:70-76`) | (cross-frame; no FluxBench category) |
| 6 | `ambiguous-targets` (106) | Two identical `Continue` buttons and two `Email` labels | `/scenarios/ambiguous-targets/` | `choose` stores the selected `data-choice` (`ambiguous-targets/scenario.ts:24`) | `result` text `primary` | (ambiguity; no FluxBench category) |
| 7 | `delayed-ui` (107) | Late-inserted target after a seed-derived 75-150 ms delay | `/scenarios/delayed-ui/` | `reveal` flips `revealed`; `delayMs = 75 + abs(seed%4)*25` (`delayed-ui/scenario.ts:23-24`) | `late-action` `visible` == `true` | dynamic interfaces; unexpected intermediate state (partial) |
| 8 | `failure-surfaces` (108) | Disabled control, detaching control, blocked external URL, page-closure marker | `/scenarios/failure-surfaces/` | `attempt` records `lastFailure` kind and counts attempts (`failure-surfaces/scenario.ts:26`) | `detach-target` `exists` == `false`; declares `actions: [{web.dom.click, rejected}]` and `allowedConsoleErrors: []`, neither of which the isolated runner reads | (failure taxonomy; no FluxBench category) |
| 9 | `reconnect` (109) | Disconnect / queue / reconnect / replay event ordering | `/scenarios/reconnect/` | three operations append to an event list and bump a seeded sequence (`reconnect/scenario.ts:26-31`) | `events` `contains` `replayed` | (gateway resilience; no FluxBench category) |
| 10 | `sensitive-input` (110) | Synthetic password/payment fields whose server state discards values | `/scenarios/sensitive-input/` | `submit` accepts only `{synthetic:true}` and always stores `passwordStored:false,paymentStored:false` (`sensitive-input/scenario.ts:26-29`) | `result` text `Submitted with secrets discarded` | authentication-compatible (partial: sensitive controls only, no login gate) |
| 11 | `llm-target-drift` (111) | Seeded baseline click, then operator-armed missing/renamed target drift with an explicit oracle object in state | `/scenarios/llm-target-drift/` | `activate` (baseline only) increments `activationCount`; `set-mode` arms `missing`/`renamed` and resets the count; `restore` returns to baseline; each transition recomputes `state.oracle` (`llm-target-drift/scenario.ts:51-62`, `:99-119`) | `result` text `Completed: 1`; `playbackGoal.successFacts` repeats it (never asserted by the runner) | changed selectors; changed text (conflated, see below) |
| 12 | `instruction-only-form` (113) | Instruction-driven authoring target with a baseline/drifted control shape | `/scenarios/instruction-only-form/` | `introduce-target-drift` swaps the name `input` for a `textarea` with testid `instruction-name-adapted`; `reset-target-drift` reverses; `submit` validates name/plan (`instruction-only-form/scenario.ts:43-57`) | `result` text `Submitted: Ada / team`; **empty** `recordingScript`, so the JSON schema requires `playbackGoal` (`packages/test-contracts/src/scenario.ts:69-72`) | forms; changed selectors |

Fixture-level tests exist for only two scenarios
(`apps/scenario-lab/src/scenarios/llm-target-drift/tests/scenario.test.ts`,
`.../instruction-only-form/tests/scenario.test.ts`) plus the shared registry,
server, and state-store tests in `apps/scenario-lab/src/tests/`. A separate
headless Playwright page suite covers eleven of the twelve fixtures with no
extension and no Core (`apps/scenario-lab/e2e/scenario-pages.spec.ts:24-104`,
`headless: true` at `apps/scenario-lab/e2e/playwright.config.ts:14`);
`instruction-only-form` has no page spec there.

### FluxBench coverage matrix (18 plan categories)

Legend: Covered = a fixture exercises the behaviour today; Partial = the
behaviour is approximated or conflated with another; None = no fixture markup
or route exists. "None" rows were confirmed by grepping every fixture and the
server for `<table`, `<dialog`, `aria-modal`, `window.open`, `download`,
`IntersectionObserver`, `type="checkbox"`, `target="_blank"`, and
`<input type="file"` — all returned no match.

| FluxBench category | Status | Fixture / evidence |
| --- | --- | --- |
| Simple extraction | None | No manifest step or expectation extracts data; `web.dom.extract` exists only in the interactive allowlist (`interactive-session.ts:44`), never in a scenario |
| Paginated extraction | None | No pagination markup or route |
| Table extraction | None | No `<table>` anywhere in the fixtures |
| Search | None | No search/filter fixture |
| Multi-page navigation | Covered | `navigation` (4 routes plus a 302) |
| Forms | Covered | `basic-form`, `instruction-only-form`, `dynamic-list` add-form, `sensitive-input` |
| Dynamic interfaces | Covered | `dynamic-list` (add/remove/reorder), `delayed-ui` (late insert) |
| Modals | None | No `<dialog>` / `aria-modal` fixture |
| Infinite scrolling | Partial | `long-document` is a static 24-section page with a seeded below-fold target; nothing appends on scroll |
| Downloads | None | `download` is a declared capability (`test-contracts/src/scenario.ts:10`) but no fixture declares or serves one |
| Multiple tabs | None | `popup` capability is likewise unused; the only extra tab is the runner's own automation tab (`run-scenario.ts:309-316`) |
| Conditional behavior | None | No fixture branches on observed page state within a run; `llm-target-drift` modes are operator-armed between runs |
| Authentication-compatible | Partial | `sensitive-input` has password/payment controls and redaction policy, but there is no login gate or session-protected page |
| Changed selectors | Covered | `llm-target-drift` renamed mode (`diagnosis-target` -> `diagnosis-target-v2`), `instruction-only-form` drifted mode (`input` -> `textarea[data-testid=instruction-name-adapted]`) |
| Changed text | Partial | `llm-target-drift`'s renamed control changes its text *and* its testid together (`llm-target-drift/scenario.ts:64-68`), so text-only drift cannot be isolated |
| Moved elements | Partial | `dynamic-list` `reverse` reorders the list; no fixture moves a control between containers or across the fold |
| Unexpected popup | None | No popup, banner, consent, or interstitial fixture |
| Unexpected intermediate state | Partial | `delayed-ui` (declared, expected delay) and `failure-surfaces` (detach) approximate it; nothing injects an unannounced interstitial mid-run |

**Uncovered (no fixture at all, 9):** simple extraction, paginated
extraction, table extraction, search, modals, downloads, multiple tabs,
conditional behavior, unexpected popup — of which "conditional behavior" and
"unexpected popup" also need runner support, not just markup.
**Partial (5):** infinite scrolling, authentication-compatible, changed text,
moved elements, unexpected intermediate state.
**Covered (4):** multi-page navigation, forms, dynamic interfaces, changed
selectors.

## (b) Exactly what a new scenario touches, and the manifest contract

Required edits, all mechanical:

1. `apps/scenario-lab/src/types.ts:1-5` — add the new id to the
   `scenarioIds` tuple. `ScenarioId` is derived from it, so nothing compiles
   until this is done.
2. `apps/scenario-lab/src/scenarios/<id>/scenario.ts` — new file exporting one
   `defineScenario<State>({...})` value. It must supply `id`, `title`,
   `startPath`, `seed`, `manifest` (built by `createScenarioManifest`),
   `createState(seed)`, `mutate(state, operation, payload)`, and
   `render(state, context)`. `defineScenario` throws if definition and
   manifest disagree on id/title/startPath/seed
   (`apps/scenario-lab/src/types.ts:42-47`). Render with `page(title, body,
   script)` and prefix the script with `fixtureClient(context.runToken, id)`
   so `mutate()` is available in the page (`apps/scenario-lab/src/html.ts:10-42`).
3. `apps/scenario-lab/src/registry.ts:1-29` — import the export and add the
   `[scenario.id, scenario]` pair.
4. `apps/scenario-lab/src/server.ts:127-148` — only if the fixture needs more
   than the single `^/scenarios/<id>/?$` route (extra pages, a redirect, an
   iframe document, or a custom header, as `navigation` and `iframe-checkout`
   do).
5. `packages/test-matrix/src/selector.ts:1-12` — add
   `{ id, tags }` to `scenarioCatalog`. **This is currently missed**: the two
   newest scenarios are absent, so CI never selects them (observed in command
   3 above).
6. `apps/scenario-lab/src/scenarios/<id>/tests/scenario.test.ts` — optional
   but conventional; AGENTS.md requires tests to live in a `tests/` subfolder
   of the owning directory, which is where the two existing fixture tests sit.
7. `apps/scenario-lab/e2e/scenario-pages.spec.ts` — optional page-only
   Playwright coverage (headless, no extension, no Core).
8. `docs/architecture/testing-facility.md:652-666` — the fixture table. It
   currently says "eleven deterministic fixtures" and elsewhere "ten-scenario
   registry" (`:710`) against an actual twelve.

Nothing in `packages/test-runner` needs editing to add a scenario: manifests
are loaded dynamically from the built registry at
`apps/scenario-lab/dist/registry.js` via `listScenarioManifests()`
(`packages/test-runner/src/scenarios.ts:7-16`). A missing Scenario Lab build
is reported as `environment.missing` (`scenarios.ts:9`).

### The contract in `packages/test-contracts/src/scenario.ts`

`WebScenario` (`scenario.ts:38-57`):

- `schemaVersion: "0.1"`, `id` (lowercase kebab, `scenario.ts:75`), `title`,
  `tags[]` (unique), `seed` (integer 0..2^32-1), `startPath` (must start `/`).
- `capabilities: ScenarioCapability[]`, drawn from
  `navigation | forms | scroll | mutation | iframe | popup | download`
  (`scenario.ts:3-11`). `popup` and `download` are declared but unused by any
  fixture and unused by the runner.
- `networkPolicy`: forced to `loopback-only` by `createScenarioManifest`
  (`apps/scenario-lab/src/types.ts:28`); the other legal value
  `allowlisted-real-site` has no execution path.
- `recordingScript: ScenarioStep[]` where a step is
  `{ id, operation, target?, value?, path?, timeoutMs? }` and operation is one
  of `click | type | select | scroll | navigate | waitForState | checkpoint`
  (`scenario.ts:16-23`).
- `playbackGoal?: { id, description, successFacts }` — **required** when
  `recordingScript` is empty (`scenario.ts:69-72`). Never asserted by the
  runner.
- `expected: { pageFacts?, recordingEvents?, actions?, finalState?,
  allowedConsoleErrors? }` (`scenario.ts:49-55`). An `ExpectedFact` is
  `{ id, subject, predicate, value }`; an `ExpectedAction` is
  `{ action, outcome?: succeeded|failed|rejected }`.
- `evidencePolicy?`: `{ screenshots: none|checkpoints|events, trace:
  off|failure|always, video: off|failure|always, sampleFps: 0..1,
  reviewRequired }`, defaulted by `createScenarioManifest`
  (`apps/scenario-lab/src/types.ts:29-36`). **The runner never reads it** — it
  builds its capture controllers purely from the `--evidence` flag
  (`run-scenario.ts:51-55`, `:156-159`) and constructs `EvidenceBundle`
  without an `evidencePolicy` option (`run-scenario.ts:49`), so the bundle
  publishes `DEFAULT_EVIDENCE_POLICY`
  (`packages/test-evidence/src/bundle.ts:82`, `:189-191`).

Supported `finalState` predicates, implemented in
`packages/test-runner/src/scenario-assertions.ts:15-35`: `text` (trimmed
exact), `contains`, `visible`, `exists`, `enabled`, `path`, `iframe-count`,
and `label-count:<label>`. Any other predicate throws
`RunnerFailure("runtime.behavior", "Unsupported scenario fact predicate")`.
Subjects resolve as `[data-testid="<subject>"]` across all frames
(`scenario-assertions.ts:61-68`), with a frame-element special case for
iframe subjects (`:70-76`). A new predicate means editing
`scenario-assertions.ts` and its `ScenarioFactProbe` type.

## (c) How a run executes

### Verbs (parsed in `packages/test-runner/src/commands.ts:15-59`)

- `run <scenario> [--seed N] [--evidence none|failure|checkpoints|events] [--target isolated|persistent-isolated|existing|clone] [--workspace NAME] [--flow ID] [--fresh-login]`
  -> one `runScenario` call; exit 0 only if `verdict === "passed"`
  (`cli.ts:44-48`).
- `matrix (--all | --scenarios-json '["a","b"]') [--repeat 1..100] [same target flags]`
  -> `expandMatrix` produces `scenarioId x repeatIndex` jobs
  (`commands.ts:62-65`) which `cli.ts:50-55` runs **sequentially**, printing
  `{status, runs:[...]}`. `--repeat` produces independent runs; there is no
  aggregation, flake rate, or per-scenario roll-up.
- `inspect <run-id>` -> `inspectRun` (`packages/test-runner/src/inspect.ts:9-27`)
  re-reads `bundle.complete.json`, checks it against the SHA-256 of
  `artifact-index.json`, re-hashes and re-sizes **every** indexed artifact,
  and parses `run.json` through `parseRunManifestJson`. Any failure is
  reported as `security.redaction`.
- `compare <baseline> <candidate>` -> inspects both, then reads only
  `summary.json` from each and emits a `CandidateComparison`
  (`cli.ts:62-68`). `expectationSetEqual` and `evidenceComplete` are
  **hardcoded `true`**; `safetyPassed` is just `candidate.verdict ===
  "passed"`; the verdict can only be `equivalent` or `rejected` — `improved`
  and `regressed` are unreachable.
- `interactive <scenario> [--seed] [--target isolated|persistent-isolated|existing] [--workspace] [--fresh-login]`
  -> `runInteractiveSession` (see below). Clone targets and `--flow` are
  rejected (`commands.ts:21-22`, `cli.ts:25`).
- `auth status|clear` and `clone-cache status|refresh|clear` — session and
  clone-package cache maintenance (`cli.ts:29-40`).
- `--live-llm` on `run`/`matrix` is fail-closed: "Live LLM execution is
  fail-closed until the Phase 1 provider runner is enabled" (`cli.ts:43`).

### Topology targets (`packages/test-runner/src/target-config.ts:4`, `:64-136`)

Resolution order is CLI flag, then `FLUXIQ_TEST_TARGET`, with
`FLUXIQ_TEST_BASE_URL` / `FLUXIQ_TEST_GATEWAY_URL` / `FLUXIQ_TEST_PROJECT_ID`
/ `FLUXIQ_TEST_FLOW_ID` / `FLUXIQ_TEST_USERNAME` / `FLUXIQ_TEST_PASSWORD` /
`FLUXIQ_TEST_PIN` / `FLUXIQ_TEST_TOTP` /
`FLUXIQ_TEST_PERSISTENT_WORKSPACE` supplying the rest.

1. **`isolated` (default).** `startTopology`
   (`packages/test-runner/src/coordinator.ts:44-147`) allocates a run
   directory and three loopback ports (`allocation.ts:45-68`), optionally
   bootstraps a random Core identity, builds the domain web-panel host,
   starts `apps/scenario-lab/dist/server.js`, copies Core's `apps/web` into
   the run directory, starts Next.js dev on a loopback port, pokes
   `/api/client-gateway/snapshot` to force lazy gateway creation
   (`coordinator.ts:112-116`), waits for the gateway TCP port, logs in,
   creates a disposable project, and returns
   `gatewayUrl = ws://127.0.0.1:<port>/client`.
2. **`persistent-isolated`.** Same, but the allocation retains
   `fluxiq-root/.fluxiq` and the Chromium profile in
   `test-runs/persistent-isolated/<workspace>/` while each invocation gets a
   disposable `.sessions/<run-id>` (`allocation.ts:75-131`), guarded by an
   ownership-token workspace lock (`coordinator.ts:61-63`). The project is
   reused by name `Persistent E2E <workspace>` (`coordinator.ts:123-127`).
3. **`existing`.** No Core is started; only the Scenario Lab
   (`coordinator.ts:159-177`). The runner logs into the external
   installation, runs `preflightExistingFluxIQ` (session identity, project
   domain is `web-automation`, exactly one matching Flow, gateway enabled +
   listening + transport-policy-clean) (`existing-flow-run.ts:45-68`).
4. **`clone`.** Authenticates to the existing installation read-only, exports
   and hashes one Flow, classifies its dependencies, then starts an ordinary
   **isolated** topology and imports a deterministically remapped copy
   through Core's public APIs (`run-scenario.ts:76-141`). After the run it
   re-exports the source and fails if its content hash moved
   (`run-scenario.ts:241-254`).

### What each target asserts during a run (`run-scenario.ts:74-227`)

Always: the built E2E extension exists (`:75`, `:290`); a context-wide
deterministic network guard is installed **before** any page opens and is
asserted clean at the end (`:143-147`, `:225`), allowing only the scenario
origin (both `127.0.0.1` and `localhost` spellings,
`network-guard.ts:61-68`), the FluxIQ origin, and the gateway origin; the
extension side panel is opened from the MV3 worker URL (`:296`); if Core
control exists, the extension is paired through `fluxiq.connect` plus
`approvePairing` (`:297-303`).

- **isolated / persistent-isolated**: `proveCoreActionRoundTrip`
  (`:304-327`) sends a Core-issued `web.browser.navigate` and `web.dom.type`
  through the production client-action API and asserts the resulting
  automation-page input value; then `fluxiq.startRecording`, the manifest's
  `recordingScript` is replayed with **Playwright** (`:211-215`,
  `executeStep` at `:357`), then `assertFinalState`, then
  `fluxiq.stopRecording` and `assertCoreRoundTrip` (`:339-352`), which
  requires a ready gateway session and at least one persisted recording
  within 5 s. No Flow is created or executed.
- **existing**: opens and seeds the scenario page, starts recording, calls
  `executeExistingPersistedFlow` (`:167-173`), which starts and runs the
  persisted Flow, requires `status === "succeeded"`, requires at least one
  durable action attempt, requires every attempt to have succeeded, and
  requires each `expected.actions` entry to match a `definitionId` +
  `status` pair (`existing-flow-run.ts:85-99`); then locates the scenario
  page whose state satisfies `finalState` (`:359`), asserts a *new*
  recording, and requires `verifyAuthenticatedFluxIQPanel` to return
  `verified`, not `limited` (`:182-183`).
- **clone**: same as existing, against the isolated destination, plus
  clone-package hashing, id remapping, and post-run source-hash verification
  (`:185-207`, `:241-254`).

### Where results and evidence land

Root is `FLUXIQ_TEST_RUNS_DIR` or `<repo>/test-runs` (`cli.ts:21`).

- `test-runs/.work/<run-id>/` — disposable topology (isolated Core data,
  copied `apps/web`, Chromium profile, logs), removed after the run
  (`run-scenario.ts:88-90`, `:263-276`, `:285`).
- `test-runs/<run-id>/` — the finalized evidence bundle. Staged as
  `.staging-<run-id>` and published by a single rename
  (`packages/test-evidence/src/bundle.ts:78`, `:200`). Contents:
  `events.ndjson`, `evidence-policy.json`, `summary.json` (verdict, counts,
  first failure, `metrics`), `report.html`, `review/timeline.json`,
  `review/contact-sheet.html`, `screenshots/`, `artifact-index.json`,
  `bundle.complete.json` (`bundle.ts:166-202`;
  `packages/test-evidence/src/report.ts:34-52`). Existing/clone runs add
  `snapshots/existing-flow.json`, `snapshots/runtime-run.json`,
  `snapshots/runtime-actions.json`, `snapshots/runtime-events.json`,
  `snapshots/clone-package.json`, `snapshots/clone-import.json`
  (`run-scenario.ts:139-140`, `:174-177`, `:198-200`), and `run.json` carries
  the `fluxiqExecution` provenance block (`:362-373`).
- `test-runs/persistent-isolated/<workspace>/` — retained workspace state.
- `test-runs/interactive-sessions/<run-id>/` — interactive screenshots only
  (`interactive-session.ts:183`, `:152-154`).
- `test-runs/.clone-cache/` — cached clone packages.
- `apps/extension/e2e/test-results/` — the standalone Playwright suite's own
  report/artifacts (`apps/extension/e2e/playwright.config.ts:8-9`).

### Interactive verb

`runInteractiveSession` (`interactive-session.ts:175-262`) starts the chosen
topology with `prepareHost: false`, launches one headed Chromium with the E2E
extension, installs the same network guard, injects the FluxIQ session cookie,
opens three surfaces (`scenario`, `panel`, `extension`), prints a `ready`
line, and then reads newline-delimited JSON until `{"action":"stop"}` or 500
actions. Allowlisted actions: `navigate`, `click`, `fill` (with
`secretEnv` restricted to `FLUXIQ_TEST_PASSWORD|PIN|TOTP|DEEPSEEK_API_KEY`,
and only onto a control that *is* sensitive), `select`, `check`, `wait`,
`inspect` (bounded structure, no text or values, `:290-303`), `screenshot`
(refused while a sensitive control holds a value, `:148-150`), and
`extension-action` for ten `web.dom.*` action types dispatched straight into
the content script (`:44-45`, `:159-172`). There is no eval/JS command, and
failures are returned as one of six opaque codes (`:265-273`).

## (d) Evaluation and metric contracts, and what aggregation exists

| Contract | Location | Produced by | Consumed by |
| --- | --- | --- | --- |
| `WebScenario` | `test-contracts/src/scenario.ts:38-57` | `createScenarioManifest` | `loadScenarioManifests` (`scenarios.ts:7-16`) |
| `RunManifest` (`run.json`) | `test-contracts/src/run.ts:61-90` | `createManifest` (`run-scenario.ts:362-373`) | `inspectRun` (`inspect.ts:23`) |
| `FluxIQExecutionMetadata` | `run.ts:44-60` | `cloneExecutionMetadata` / inline (`run-scenario.ts:364-371`, `:376-382`) | run manifest validation only |
| `EvidenceSummary` (`summary.json`) | `test-evidence/src/types.ts:70-82` | `EvidenceBundle.finalize` (`bundle.ts:173-192`) | `compare` (`cli.ts:64-66`) |
| `ArtifactIndex` | `test-evidence/src/types.ts:64-68` | `buildArtifactIndex` (`bundle.ts:232-242`) | `inspectRun` |
| `RunEvaluation` + `InvariantResult` | `test-contracts/src/evaluation.ts:9-17` | **nothing** | only `packages/agent-orchestrator/src/types.ts:104-105` as an input type |
| `CandidateComparison` | `evaluation.ts:18-27` | `compareRuns` (`cli.ts:62-68`) | printed to stdout |
| `ChangeSelection` | `test-matrix/src/selector.ts:16-22` | `selectChangedCapabilities` | `test-matrix` CLI -> GitHub outputs (`test-matrix/src/cli.ts:33-43`) |
| Evidence HTML report / contact sheet / timeline | `test-evidence/src/report.ts:18-52` | `finalize` | humans |

`failureCategories` (`evaluation.ts:2-7`) enumerates 17 categories
(`fixture.invalid`, `environment.missing`, `process.startup`,
`extension.install`, `extension.worker`, `gateway.connection`,
`gateway.pairing`, `recording.contract`, `recording.persistence`,
`action.dispatch`, `action.targeting`, `runtime.behavior`, `visual.mismatch`,
`performance.budget`, `security.redaction`, `test.flaky`, `unknown`). The
runner uses them through `RunnerFailure` / `classifyRunnerFailure`, and the
selected category reaches `RunScenarioResult.failureCategory` and the error
evidence event (`run-scenario.ts:229-231`) — but **not** `run.json` or
`summary.json`, so a finished bundle does not record why it failed in a
machine-readable, validated field.

**Metrics.** The only metric ever produced is
`metrics: { steps: scenario.recordingScript.length }`
(`run-scenario.ts:282`) — a constant per scenario, not a measurement. There
is no duration, action count, retry count, or success-rate metric.

**Repeat-run aggregation: none.** `--repeat` multiplies jobs
(`commands.ts:62-65`) and `cli.ts:53` reduces them to a single boolean
`passed`. Nightly CI runs `pnpm lab matrix --all --repeat 3 --evidence
failure` (`.github/workflows/testing-facility.yml:254`) and uploads the
bundles, but nothing computes a flake rate or compares the three passes.
**Cross-run comparison** exists only as the two-run `compare` verb described
above, and it can never report `improved` or `regressed`.

**`test-matrix` drift (observed).** `scenarioCatalog`
(`test-matrix/src/selector.ts:1-12`) lists **ten** scenarios;
`llm-target-drift` and `instruction-only-form` are absent. Because
`scenarioFromFixturePath` returns undefined for an unknown id, editing either
of those fixtures falls back to selecting *all ten others* and never selects
the fixture actually changed (`selector.ts:51-54`, `:72-76`) — reproduced in
command 3 above.

## (e) How a scenario drives the extension

There is no shared Playwright fixture between the facility runner and the
standalone extension suite; they are two separate launchers.

1. **Facility runner** (`run-scenario.ts:292-296`): `chromium.
   launchPersistentContext(topology.allocation.browserProfileDir, {headless:
   false, ... args: ["--disable-extensions-except=<dist/e2e-chromium>",
   "--load-extension=<dist/e2e-chromium>", "--no-first-run",
   "--disable-default-apps"]})`, provider secrets stripped from the child
   environment (`withoutProviderSecrets`), locale `en-US`, timezone `UTC`,
   viewport 1280x720. The extension id comes from the MV3 service-worker URL
   and the side panel is opened directly as a page. All extension control
   goes through `chrome.runtime.sendMessage` evaluated in that page
   (`runtimeMessage`, `:354`): `fluxiq.connect`, `fluxiq.getStatus`,
   `fluxiq.startRecording`, `fluxiq.stopRecording`. The scenario tab is made
   active through `chrome.tabs.update` and confirmed via the extension's own
   status (`activateScenarioTab`, `:329-338`).
2. **Standalone extension suite** (`apps/extension/e2e/fixtures/extension-context.ts:53-102`):
   the same launch shape plus `--disable-background-networking` and
   `--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE
   127.0.0.1`, against a tiny in-file loopback page
   (`fixtures/scenario-page.ts`), with no Scenario Lab, no Core, and no
   gateway. It sends actions straight into the content script and asserts
   `web.dom.capture_snapshot`, `web.dom.type`, and `web.dom.click`
   (`e2e/action.spec.ts:14-41`).

**Three distinct ways an action is issued:**

- **Core client-action bridge** — `topology.control.executeClientAction(
  sessionId, {actionType, parameters, metadata:{correlationId}},
  authorizationPin)` through the production Automation Studio client API and
  gateway (`run-scenario.ts:311`, `:318`). Used only by
  `proveCoreActionRoundTrip`, and only for `web.browser.navigate` +
  `web.dom.type`, derived from the first `type` step of the manifest
  (`:305-306`). If a scenario has no `type` step, the probe silently returns
  and the isolated run proves no Core-driven action at all.
- **Persisted Flow** — `executeExistingPersistedFlow` (`existing-flow-run.ts:70-108`)
  calls `startPersistedFlow` then `runPersistedFlow` with
  `authorizedDomainIds: ["web-automation"]` and an idempotency key, then
  reads run detail, actions, and events, and matches them against
  `expected.actions`. This is the only path where the Flow (not Playwright)
  drives the browser.
- **Recording** — `fluxiq.startRecording` / `fluxiq.stopRecording` bracket
  every lane that has Core control; the assertion is only that Core persisted
  at least one new recording within 5 s (`assertCoreRoundTrip`, `:339-352`).
  Recording *content* is never checked against `expected.recordingEvents`.
- **Direct content-script dispatch** — interactive `extension-action`
  (`interactive-session.ts:159-172`) and the standalone e2e suite.

**Can a scenario run a Flow provider-free end to end?** Yes, on three paths,
none of which is the default:

- `pnpm lab run <scenario> --target existing` executes a pre-existing
  persisted Flow with no provider involvement. Implemented and unit/mock
  tested, but `docs/architecture/testing-facility.md:164-168` records that it
  "has not yet been reported as validated against a live existing
  installation".
- `pnpm lab run <scenario> --target clone --flow <id>` imports that Flow into
  isolation and executes the copy (`run-scenario.ts:185-207`).
- `pnpm demo:record` then `pnpm demo:run` author a Flow through the real
  panel and extension UI in the persistent isolated workspace and then run it
  provider-free; `pnpm demo:llm:prepare` is explicitly a "provider-free
  preparation lane" that ends in a Runtime Debug run with **No LLM
  intervention** (`docs/architecture/testing-facility.md:413-470`). These are
  driven by `recordDemoWorkspace` / `runDemoWorkspaceFlow`, exported from
  `packages/test-runner/src/demo-workspace/index.ts:16`.

The default `isolated` target **cannot** run a Flow: it replays the manifest
with Playwright and never creates a Flow
(`docs/architecture/testing-facility.md:180-182`).

**Executable-target gap.** `selector()` maps only `testid:` and passes
anything else through as a raw Playwright selector
(`run-scenario.ts:356`). Manifest targets today:

- `role:...` — `dynamic-list` (`role:button[name=Add]`), `reconnect` (three),
  `sensitive-input` (two). Not a Playwright selector in that spelling.
- `frame:Same-origin checkout/testid:same-frame-action` and the cross-origin
  twin — `iframe-checkout`. No frame resolution exists in `executeStep`, and
  the cross-origin frame is served from a second random port that
  `scenarioNetworkOrigins` does not allowlist (`network-guard.ts:61-68` takes
  exactly one origin), so the guard would also record a violation.
- `failure-surfaces` scripts `click` on a `disabled` button, which Playwright
  will never perform; its declared `rejected` outcome is only meaningful on
  the existing/clone path.

So of twelve scenarios, seven have fully executable isolated recording
scripts (`basic-form`, `navigation`, `long-document`, `ambiguous-targets`,
`delayed-ui`, `llm-target-drift`, plus `instruction-only-form` trivially
because its script is empty), and five do not.

## (f) Commands, prerequisites, and headless capability

**Prerequisites.** Node 22 and pnpm 9.15.0 (`package.json:6`);
`pnpm install --frozen-lockfile`; a compatible sibling Core checkout at
`F:\!FluxIQ` or `FLUXIQ_CORE_ROOT` (`cli.ts:20`) with its web dependencies
installed (the runner copies `apps/web` and runs `next dev --turbopack`,
`coordinator.ts:99-106`); Playwright's bundled Chromium installed; the built
Scenario Lab (`apps/scenario-lab/dist/registry.js`), the built domain web-panel
host (`domain/dist/host/web-panel-host.cjs`, built by the runner unless
`prepareHost: false`), and the built E2E extension
(`apps/extension/dist/e2e-chromium`).

**Commands** (root `package.json:8-62`):

| Command | What it builds first | Lane |
| --- | --- | --- |
| `pnpm lab <verb> ...` | scenario-lab, `extension test:e2e:build`, `test-runner...` | full facility |
| `node packages/test-runner/dist/cli.js <verb> ...` | nothing | fast relaunch after one `pnpm lab` |
| `pnpm lab:interactive <scenario> --target persistent-isolated --workspace <name>` | adds `domain host:build` | headed dev loop |
| `pnpm --filter @fluxiq-web-extension/scenario-lab test` | own build | fixture unit tests, no browser |
| `pnpm --filter @fluxiq-web-extension/scenario-lab test:e2e` | test-contracts | **headless** page suite |
| `pnpm --filter @fluxiq-web-extension/extension test:e2e` | extension build | **headed** extension suite |
| `pnpm --dir packages/{test-contracts,test-runner,test-evidence,test-matrix} test` | own build | node unit tests |
| `pnpm demo:record` / `pnpm demo:run` | scenario-lab, extension, test-runner | persistent demo workspace, headless by default |
| `pnpm check` / `pnpm test` / `pnpm build` | — | structure audit + type/unit gates |

Representative finite invocations (from
`docs/architecture/testing-facility.md:910-916`):
`pnpm lab run basic-form --seed 1 --evidence events`,
`pnpm lab matrix --all --repeat 1 --evidence failure`,
`pnpm lab inspect <run-id>`, `pnpm lab compare <baseline> <candidate>`.

**Headless capability, by lane:**

| Lane | Headless? | Evidence |
| --- | --- | --- |
| Scenario Lab page suite | Yes, `headless: true` | `apps/scenario-lab/e2e/playwright.config.ts:14` |
| Fixture node tests | N/A (no browser) | `apps/scenario-lab/package.json` `test` |
| Extension E2E suite | **No** — `headless: false` | `apps/extension/e2e/fixtures/extension-context.ts:63` |
| `lab run` / `lab matrix` | **No** — `headless: false` | `packages/test-runner/src/run-scenario.ts:293` |
| `lab interactive` | **No** — `headless: false` | `packages/test-runner/src/interactive-session.ts:206` |
| `demo:*` lanes | Yes by default; `FLUXIQ_DEMO_HEADLESS=false` to show | `packages/test-runner/src/demo-workspace/configuration.ts:60` |

Every extension-loading lane is headed because MV3 extensions require it, so
Linux CI wraps them in `xvfb-run --auto-servernum`
(`.github/workflows/testing-facility.yml:134`, `:212`, `:254`) while Windows
runs them directly (`:137`). The documentation records that the Windows headed
configuration has been exercised locally and that the Linux/Xvfb path and the
nightly three-repeat run remain unverified
(`docs/architecture/testing-facility.md:805-811`).

## What FluxBench needs that the facility lacks

1. **Fixtures for nine absent categories** — extraction (simple, paginated,
   table), search, modals, downloads, multiple tabs, conditional behavior,
   unexpected popup — plus real versions of the five partial ones (infinite
   scroll that appends, an auth-gated page, text-only drift separated from
   selector drift, an element that moves container, and an unannounced
   interstitial). Each needs the seven-file edit in section (b).
2. **A benchmark result contract and a producer for it.** `RunEvaluation`
   exists and is validated but nothing builds one. FluxBench needs a per-run
   record of verdict, failure category, and real metrics written into the
   bundle, not just `{steps: N}`.
3. **Repeat-run aggregation.** `--repeat` must produce a pass rate per
   scenario, a flake classification, and a corpus-level score; today N
   repeats are N unrelated bundles.
4. **A comparison that can say "improved" or "regressed".** `compare`
   hardcodes two gates and can only emit `equivalent` or `rejected`.
5. **Assertion of the expectations already declared.** `pageFacts`,
   `recordingEvents` (type and count), `playbackGoal.successFacts`, and
   `allowedConsoleErrors` are dead data in the isolated lane; a benchmark
   cannot score what the runner does not check. The per-scenario
   `evidencePolicy` is likewise ignored in favour of the global `--evidence`
   flag.
6. **A target resolver that matches the manifest vocabulary.** `role:` and
   `frame:` prefixes are declared by four scenarios and understood by none;
   frame traversal and second-origin allowlisting are both missing.
7. **A provider-free Flow lane against loopback fixtures.** The only Flow
   execution paths need either an externally managed installation (`existing`,
   never live-validated) or the demo workspace. FluxBench wants
   `lab run <scenario> --target isolated` to author-or-load and execute a Flow
   inside the disposable topology.
8. **`test-matrix` parity.** Its catalog must be generated from, or checked
   against, the Scenario Lab registry; two scenarios are invisible to CI
   selection today.
9. **A headless or reliably virtualized lane for the corpus.** Every
   extension-bearing lane is headed; a benchmark that runs a full corpus
   repeatedly depends entirely on Xvfb, which the documentation records as
   never actually executed.
10. **Timing instrumentation.** Nothing measures step, action, or run
    duration, so no throughput or latency benchmark is possible from current
    artifacts.

## Not verified

- No Testing Lab run, browser, build, or panel was started, so every claim
  about *runtime* behaviour (pairing, recording persistence, Flow execution,
  network-guard violations, Xvfb) is read from source and from
  `docs/architecture/testing-facility.md`, not observed.
- The specific claim that `role:`/`frame:` targets and the `failure-surfaces`
  disabled click fail at runtime is inferred from
  `run-scenario.ts:356-357` plus Playwright semantics; it was not reproduced.
  The documentation's statement that only `basic-form` has a verified run is
  consistent with it but is not the same proof.
- Whether the cross-origin iframe port would trip the network guard was read
  from `network-guard.ts:61-68` and `server.ts:32-42`; not reproduced.
- FluxIQ Core behaviour (client-action API shape, Flow run endpoints, panel
  verification) was not inspected; the sibling repository was out of scope for
  this brief.
- `packages/test-runner/src/demo-*` were read only by filename and exported
  symbol, per the brief; their internal behaviour is taken from the
  architecture document.
- `packages/agent-orchestrator` and `packages/real-site-policy` were not
  audited beyond the one `RunEvaluation` reference.

## Open questions or contradictions found

1. **Documentation says eleven fixtures; the registry has twelve.**
   `docs/architecture/testing-facility.md:652` reads "The eleven deterministic
   fixtures are:" and its table omits `instruction-only-form`; `:710` says
   "the ten-scenario registry". Observed registry count: 12.
2. **`test-matrix` knows ten scenarios.** `selector.ts:1-12` omits
   `llm-target-drift` and `instruction-only-form`, so CI cannot select them
   and editing them selects the wrong ten (observed).
3. **Declared-but-unread manifest fields.** `pageFacts`, `recordingEvents`,
   `playbackGoal`, `allowedConsoleErrors`, and `evidencePolicy` are authored
   in every fixture and never consumed by the runner. Is the intent to make
   the runner assert them, or to delete them from the contract? FluxBench
   scoring depends on the answer.
4. **Unused capability values.** `popup` and `download`
   (`test-contracts/src/scenario.ts:9-10`) and the `allowlisted-real-site`
   network policy (`:14`) have no fixture and no execution path.
5. **`compare` hardcodes its gates.** `expectationSetEqual: true` and
   `evidenceComplete: true` in `cli.ts:67` make the contract's `improved` /
   `regressed` verdicts unreachable; is that a stub or a decision?
6. **Failure category is not persisted in the bundle.** It reaches stdout and
   the error evidence event but not `run.json` or `summary.json`, so
   `inspect` cannot report why a stored run failed.
7. **`proveCoreActionRoundTrip` is conditional on a `type` step.** Scenarios
   without one (`navigation`, `long-document`, `ambiguous-targets`,
   `delayed-ui`, `failure-surfaces`, `reconnect`, `iframe-checkout`,
   `llm-target-drift`) skip the Core action proof entirely
   (`run-scenario.ts:305-306`), which weakens "isolated run proves Core
   dispatch" for eight of twelve scenarios.
8. **`llm-target-drift` renamed mode conflates two drift kinds.** The
   replacement control changes both its `data-testid` and its visible text
   (`llm-target-drift/scenario.ts:64-68`), so "changed selectors" and
   "changed text" cannot be measured independently.
