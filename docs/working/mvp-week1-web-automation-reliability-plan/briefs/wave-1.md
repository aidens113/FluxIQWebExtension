# Wave 1 worker briefs

Briefs for Wave 1 of the
[MVP Week 1 plan](../../mvp-week1-web-automation-reliability-plan.md),
written by the senior supervisor agent before dispatch. They live here
rather than in the plan's `Worker Briefs` section because the plan sits at
the 800-line compaction threshold. Workers read only their own brief.

Every worker also reads the plan's `Current State`. Paths are relative to
`F:\!FluxIQWebExtension`. Report paths are under
`docs/working/mvp-week1-web-automation-reliability-plan/reports/`.

Concurrency notes for every worker: other workers build the extension, the
domain, and the test packages in the same working tree. A failure that
names a file you do not own, or a missing `dist/` file, is most likely a
parallel edit or rebuild; rerun once before reporting it. Never run
`pnpm structure:baseline`; run `node scripts/structure-audit.mjs` and report
any "can be lowered" line for the supervisor. Write file content with the
Write or Edit tool, never a Bash heredoc: the Bash tool collapses `\\` to
`\` even inside a quoted heredoc, which silently corrupts escapes, and on
this host a Bash command over about 8 KB fails with a misleading
"unexpected EOF" quote error.

## Batch A

### Brief: w1-decompose-content
- Repository: this repository
- Task: Phase 1.1 step 1, behaviour-preserving. Split
  `apps/extension/src/content/actions.ts` into `apps/extension/src/content/actions/`
  (one file per action verb, an `execute.ts` dispatcher, an `index.ts` barrel) and
  `apps/extension/src/content/action-runtime.ts` into
  `apps/extension/src/content/action-runtime/` (`resolve-target.ts`, `waits.ts`,
  `results.ts`, `input-events.ts`, `extract.ts` — adjust names to what the code
  actually contains, add files where one-exported-thing-per-file requires, and an
  `index.ts` barrel). Move code verbatim: no logic, signature, or export-name
  change. Leave the legacy dotted alias matching exactly as it is; a later brief
  removes it. Importers keep importing `./actions` and `./action-runtime`, which
  now resolve to the barrels; change an import line only if resolution requires it.
- Required reads: the two source files; every file importing them
  (search `apps/extension/src` for imports of `./actions` and `./action-runtime`);
  `F:\!FluxIQ\docs\architecture\code-structure.md`.
- Owns (may edit): `apps/extension/src/content/actions.ts` and
  `apps/extension/src/content/action-runtime.ts` (both deleted); everything under the
  new `apps/extension/src/content/actions/` and `apps/extension/src/content/action-runtime/`;
  import lines in `apps/extension/src/content/message-handler.ts`.
- Must not touch: any other file in `apps/extension/src/content/` (`dom-events.ts`
  and `types.ts` are edited by others); anything outside `apps/extension/src/content/`.
- Definition of done: `pnpm --filter @fluxiq-web-extension/extension check`, `build`,
  and `test` pass; `node scripts/structure-audit.mjs` shows no new finding for your
  files; the report shows how you confirmed every moved body is unchanged (for
  example a whitespace-normalized diff of the old file against the new bodies).
- Report to: `reports/w1-decompose-content.md`

### Brief: w1-domain-mappings
- Repository: this repository
- Task: Phase 1.1 step 2. Fix the recording → input → output mapping defects in
  `reports/audit-recording.md` (mapping table at line 17 and its defect list):
  1. the scroll input is keyed on the event the recorder emits, not the unemitted `dom.wheel`;
  2. `GatewayInputHub` accepts a top-level `domainId`, as Core's bridge does, as well as `metadata.domainId`;
  3. `normalizeWebAutomationActionType` (`domain/src/client/gateway-mapping.ts:152`) rejects
     unknown action types with an `ACTION_REJECTED` result instead of rewriting them to
     `web.dom.extract`, and is the one place legacy dotted aliases are normalized;
  4. `domain/src/web-panel-host.ts` imports `GatewayInputHub` and the output dispatcher
     from `domain/src/io/` instead of keeping its own copies;
  5. one input → output mapper serves both the live path and `mapWebRecordingObservation`
     (`web-panel-host.ts:161`), and the proposal path keeps the element fingerprint;
  6. `web-panel-host.ts:2` imports `AutomationStudioNativeNodeRuntime` from
     `fluxiq/automation-studio` if the CJS host resolves it under Node 22 (prove it with
     `pnpm --filter @fluxiq-web-extension/domain host:build` and by loading the built host);
     otherwise keep the deep import with a comment naming the reason;
  7. delete the dead exports `legacyBrowserActionType` and `createWebAutomationStructuredSnapshot`.
  Checkbox/radio → `web.dom.type` stays as is (Phase 1.2 adds `web.dom.check`). Add T1
  tests for every row of the mapping table in new files under `domain/src/io/tests/`
  and `domain/src/client/tests/`.
- Required reads: `reports/audit-recording.md` (table, defects, line 449); the files
  you own; `domain/src/actions/types.ts` read-only.
- Owns (may edit): `domain/src/io/` except `manifest-definitions.ts`;
  `domain/src/client/gateway-mapping.ts`; `domain/src/web-panel-host.ts`;
  `domain/src/web-panel/`; `domain/src/recording/`; `domain/src/tests/domain.test.ts`;
  new tests under `domain/src/io/tests/` and `domain/src/client/tests/`.
- Must not touch: `domain/src/io/manifest-definitions.ts`, `domain/src/actions/`,
  `domain/src/output-nodes/`, `domain/src/runtime/`, `domain/src/client/index.ts`,
  `apps/`, `packages/`. Another worker edits `domain/src/actions/types.ts` and keeps
  the exported legacy reverse map's name and values unchanged.
- Definition of done: `pnpm --filter @fluxiq-web-extension/domain check` passes;
  `DOMAIN_TEST_BUILD_LABEL=w1-domain-mappings pnpm --filter @fluxiq-web-extension/domain test`
  passes; `pnpm --filter @fluxiq-web-extension/extension check` passes; structure audit
  shows no new finding; the report maps each table row to its test.
- Report to: `reports/w1-domain-mappings.md`

### Brief: w1-domain-registry
- Repository: this repository
- Task: Phase 1.1 step 4, domain and shared-extension part.
  1. One safety registry. `domain/src/io/manifest-definitions.ts:117` and `isSafeOutput`
     (`domain/src/output-nodes/definitions.ts:93-95`) disagree (audit-actions item 17).
     Make one the single source and derive the other from it. The two waits and
     `web.dom.capture_snapshot` are safe and unprivileged, so provider-free runs never
     prompt. Add a T1 test asserting one consistent classification per output.
  2. Delete these dead exports: `getWebAutomationOutputNodeDefinition`,
     `webAutomationRuntimeCommandFromOutput`, `webAutomationOutputResultFromRuntimeResult`,
     `runWebAutomationFlow`, `webAutomationRuntimeTracePayload`, `runStateReadViaSnapshot`,
     `isProbablySecureGateway`, `EXTENSION_NAME`, `PROTOCOL_VERSION`, and the forward
     `LEGACY_BROWSER_ACTION_TO_WEB_AUTOMATION` map (keep the reverse map's exported name
     and values; `gateway-mapping.ts` reads it). Keep `WebAutomationRuntimeError` for
     Phase 1.5. Re-grep each symbol repo-wide (excluding `node_modules`, `dist`, `build`,
     `.test-build`, `.script-build`, `test-runs`) just before deleting; delete a file that
     becomes empty together with its barrel line.
  3. `domain/src/runtime/llm-evidence.ts`: import
     `AutomationStudioRuntimeTargetOverrideEvidenceValidation` and the failed-action type
     from `fluxiq/automation-studio` instead of structural copies; remove the duck-typed
     `bindLlmEvidenceRuntime` shim (`:252-256`) and call the public method directly.
- Required reads: `reports/audit-core-runtime.md` lines 445-510;
  `reports/audit-actions.md` lines 228-240; the files you own.
- Owns (may edit): `domain/src/io/manifest-definitions.ts`; `domain/src/output-nodes/`;
  `domain/src/actions/`; `domain/src/runtime/` including its `tests/`;
  `domain/src/client/index.ts` (barrel lines only); `apps/extension/src/runtime/state-reader.ts`;
  `apps/extension/src/shared/constants.ts`; `apps/extension/src/shared/browser.ts`.
- Must not touch: the rest of `domain/src/io/`, `domain/src/client/gateway-mapping.ts`,
  `domain/src/web-panel-host.ts`, `domain/src/web-panel/`, `domain/src/recording/`,
  `domain/src/tests/domain.test.ts`, `apps/extension/src/content/`,
  `apps/extension/src/background/`, `apps/extension/src/shared/protocol.ts`, `packages/`.
  If a needed change falls in one of these, stop that item and report it.
- Definition of done: `pnpm --filter @fluxiq-web-extension/domain check`;
  `DOMAIN_TEST_BUILD_LABEL=w1-domain-registry pnpm --filter @fluxiq-web-extension/domain test`
  passes — the script now also runs `domain/src/runtime/tests/*.test.ts`, which never
  ran before, so fix failures there in scope and report any pre-existing one you
  cannot; `pnpm --filter @fluxiq-web-extension/extension check`; structure audit shows
  no new finding; the report quotes a zero-hit grep per deleted symbol.
- Report to: `reports/w1-domain-registry.md`

### Brief: w1-recorder-hygiene
- Repository: this repository
- Task: Phase 1.1 step 3.
  1. `apps/extension/src/content/dom-events.ts`: the `input` and `change` listeners
     ignore events whose `isTrusted` is false, as the click path does, so replay no
     longer double-records.
  2. `apps/extension/src/background/connection/runtime-status.ts`: runtime
     confirmations for `type` and `select` carry the value, under the same
     sensitive-field redaction the recorder applies — a password or sensitive-marked
     field never carries its value.
- Required reads: `reports/audit-recording.md` (search `isTrusted` and
  `confirmation`); the two files and the types they import.
- Owns (may edit): those two files only.
- Must not touch: everything else. The extension has no unit-test runner (`test` runs
  `scripts/smoke-test.mjs`); do not add one. The supervisor adds content-harness
  regression specs for both changes once the harness lands.
- Definition of done: `pnpm --filter @fluxiq-web-extension/extension check`, `build`,
  and `test` pass; `pnpm --filter @fluxiq-web-extension/extension test:e2e` run (headed
  Chromium) with its result quoted; structure audit shows no new finding; the report
  names the redaction rule applied and the file that defines it.
- Report to: `reports/w1-recorder-hygiene.md`

## Batch B

Dispatched after the supervisor's pre-step: the scenario contract gained
`workflows`, `variants`, `extract` steps, `expected.extracted`,
`expected.failure`, and seven step operations
(`packages/test-contracts/src/{scenario,validation,scenario-workflow,failure-category}.ts`);
the Scenario Lab gained a scenario-owned `route` hook and ten registered
placeholder fixtures. Headless Chromium on this machine must use
`channel: "chromium"`: the default headless shell crashes on launch.

### Brief: w1-content-harness
- Repository: this repository
- Task: Phase 1.6a step 1, the T2 content-script harness.
  1. `apps/extension/e2e/content/harness.ts`: start the Scenario Lab in-process
     (`startScenarioLab`), open a fixture page, inject the content-script bundle, and
     install a `chrome.runtime` stub that records every outgoing message and lets a spec
     deliver incoming ones. Expose `runAction(command)` (delivers the message the
     background sends for an action; returns the content script's reply), `capture()`
     (the snapshot request), and the recorded messages.
  2. Build the harness bundle from `apps/extension/src/content/index.ts` with the
     extension's own esbuild settings — export a build function from
     `apps/extension/scripts/build-extension.mjs` rather than copying options — into an
     ignored directory the harness owns, so a concurrent `pnpm build` (which deletes
     `dist/`) cannot break a run.
  3. `apps/extension/e2e/playwright.content.config.ts` (headless, `channel: "chromium"`)
     and a `test:content` script in `apps/extension/package.json`.
  4. Specs: `resolve-target.spec.ts` covers the four resolution strategies on
     `ambiguous-targets` and `long-document`, asserting today's behaviour (first match on
     ambiguity; Phase 1.3 changes it); `actions.spec.ts` executes every existing action
     type once on `basic-form` and asserts the reply and the page effect;
     `recorder-trust.spec.ts` asserts untrusted `input`/`change` events are not recorded
     and real keyboard input is.
- Required reads: `apps/extension/src/content/index.ts`, `message-handler.ts`,
  `messages.ts`, `types.ts` (another worker is splitting `actions.ts` and
  `action-runtime.ts` into directories; read the barrels once they exist);
  `apps/extension/scripts/build-extension.mjs`; `apps/extension/e2e/playwright.config.ts`;
  `apps/scenario-lab/src/server.ts`; `reports/audit-targeting.md` (resolution
  strategies); `reports/audit-actions.md` (action list).
- Owns (may edit): `apps/extension/e2e/content/` (new);
  `apps/extension/e2e/playwright.content.config.ts` (new); `apps/extension/package.json`
  (the `test:content` script only); `apps/extension/scripts/build-extension.mjs` (export
  a reusable build function, output unchanged); `.gitignore` (one line for your build dir).
- Must not touch: `apps/extension/src/`, the existing e2e specs and config, `apps/scenario-lab/`.
- Definition of done: `pnpm --filter @fluxiq-web-extension/extension test:content`
  passes headless (spec count and duration quoted); extension `build` output is
  byte-identical before and after your build-script change (hashes quoted); structure
  audit shows no new finding.
- Report to: `reports/w1-content-harness.md`

### Brief: w1-eval-contracts
- Repository: this repository
- Task: Phase 1.6a step 3, evaluation and benchmark contracts in `packages/test-contracts`.
  1. `RunEvaluation` (`src/evaluation.ts`, `src/evaluation-validation.ts`) gains what the
     plan's Metrics table needs per run: scenario, workflow, and variant ids; repeat index;
     lane; Flow creation success; oracle verdict and FluxIQ-reported verdict (false
     failure and false success derivable); the automation failure reported
     (`{ category: ScenarioFailureCategory; code? } | null`) and the expected one; harness
     activation count; per-action latency (action type, `durationMs`); evidence sizes
     (sanitized packet bytes, raw snapshot bytes, truncation count); `llm`; Week 2 fields
     (harness recovery, adaptation cost, validation, persistence, reuse) present as
     `null`. The existing test-rig failure taxonomy (`evaluation.ts:2-8`) stays; name the
     new field so the two cannot be confused, and say so in the type comment.
  2. A `BenchReport` contract in new files (`src/bench-report.ts`,
     `src/bench-report-validation.ts`): corpus id, repeat count, target, per-workflow
     results (corpus id such as `W05`, scenario, workflow, variant, runs, pass rate,
     flake class `stable-pass | stable-fail | flaky`), corpus metrics (every Metrics row:
     rates, p50/p95 latency per action type, run duration, evidence p50/p95, truncation
     count), `llm`, and a `BenchComparison`: per metric `improved | regressed |
     equivalent` with the tolerance applied (rates ±1 workflow; latency p95 ±25%).
  3. Barrel lines in `src/index.ts`; tests as new files in `packages/test-contracts/tests/`.
- Required reads: the plan's `## Metrics` and `## FluxBench Week 1 Corpus` sections;
  `reports/audit-testing-facility.md` lines 394-440; `packages/test-contracts/src/`
  (`scenario.ts`, `failure-category.ts`, `scenario-workflow.ts`, `evaluation*.ts`, `index.ts`).
- Owns (may edit): `src/evaluation.ts`, `src/evaluation-validation.ts`, new
  `src/bench-report*.ts`, your lines in `src/index.ts`, new files in `tests/`.
- Must not touch: `scenario.ts`, `validation.ts`, `failure-category.ts`,
  `scenario-workflow.ts` (supervisor); `run.ts`, `run-validation.ts` (runner worker);
  `packages/test-runner/`.
- Definition of done: `pnpm --filter @fluxiq-web-extension/test-contracts test` passes;
  `pnpm --filter @fluxiq-web-extension/test-runner check` still passes (report a broken
  consumer rather than editing the runner); structure audit shows no new finding.
- Report to: `reports/w1-eval-contracts.md`

### Brief: w1-runner-asserts
- Repository: this repository
- Task: Phase 1.6a step 2, the Testing Lab recording lane.
  1. Execute every `scenarioStepOperations` entry (contract in the `ScenarioStep` comment,
     `packages/test-contracts/src/scenario.ts`), moving step execution out of
     `run-scenario.ts` into a focused module directory. `select` must produce trusted
     events: the recorder now ignores untrusted `input`/`change`, and Playwright's
     `selectOption` dispatches untrusted ones. Select by keyboard on the focused control,
     verify the value, keep it in one helper, and use it also at
     `demo-workspace/workspace-lanes.ts:51` and `interactive-session.ts:136`. `upload`
     sets a deterministic in-memory file named by `value`; `switchTab`/`closeTab` move the
     active page; `waitForDownload` waits for a completed download with that name;
     `extract` never clicks (a click would be recorded): it reads the current page, and
     only an extract step without `pagination` is asserted against `expected.extracted`
     here. Support the `column:<header>` field form.
  2. Resolve the run with `resolveScenarioWorkflow` and accept `--workflow <id>`. Assert
     `pageFacts` (before the script), `recordingEvents` (type and count, against what the
     extension recorded), `expected.actions` on every lane that runs actions,
     `allowedConsoleErrors` (any other console error fails the run), and
     `playbackGoal.successFacts`. Drive capture from the manifest's `evidencePolicy` unless
     `--evidence` overrides, and publish the effective policy in the bundle.
  3. `selector()` (`run-scenario.ts:356`) understands `role:<role>[:<name>]` (`getByRole`)
     and `frame:<title>/<inner>` (`frameLocator`), across the cross-origin frame;
     allowlist the Scenario Lab's second loopback port in `network-guard.ts`.
  4. `run.json` records the automation failure the run reported (category, code), the
     workflow and variant ids, and per-step and per-action `startedAt`/`durationMs`, with
     the fields added to `packages/test-contracts/src/run.ts` and `run-validation.ts`.
- Required reads: `reports/audit-testing-facility.md` lines 166-530; in
  `packages/test-runner/src/`: `run-scenario.ts`, `scenario-assertions.ts`,
  `network-guard.ts`, `scenarios.ts`, `target-config.ts`, `commands.ts`; in
  `packages/test-contracts/src/`: `scenario.ts`, `scenario-workflow.ts`, `run.ts`,
  `run-validation.ts`.
- Owns (may edit): `packages/test-runner/src/run-scenario.ts`, `scenario-assertions.ts`,
  `network-guard.ts`, `commands.ts` (the `--workflow` flag only), the select calls in
  `interactive-session.ts` and `demo-workspace/workspace-lanes.ts`, new module
  directories under `packages/test-runner/src/`, new tests in `packages/test-runner/src/tests/`;
  `packages/test-contracts/src/run.ts`, `run-validation.ts`, a new run test file in
  `packages/test-contracts/tests/`.
- Must not touch: other `packages/test-contracts` files, `packages/test-runner/src/cli.ts`, `apps/`.
- Definition of done: `pnpm --filter @fluxiq-web-extension/test-contracts test` and
  `pnpm --filter @fluxiq-web-extension/test-runner test` pass; `pnpm lab run basic-form
  --target isolated` (with its select recorded) and `pnpm lab run iframe-checkout --target
  isolated` pass on this machine, outputs quoted; structure audit shows no new finding.
- Report to: `reports/w1-runner-asserts.md`

### Brief: w1-matrix-parity
- Repository: this repository
- Task: Phase 1.6a step 6. `packages/test-matrix/src/selector.ts` keeps a hand-maintained
  `scenarioCatalog` that has already drifted from the Scenario Lab registry. Derive it
  from the registry instead (read the built registry at runtime as
  `packages/test-runner/src/scenarios.ts` does, or generate it at build), with each
  scenario's tags from its manifest, and add a test that fails if catalog and registry disagree.
- Required reads: `packages/test-matrix/` (source, tests, `package.json`);
  `packages/test-runner/src/scenarios.ts`; `apps/scenario-lab/src/registry.ts`;
  `reports/audit-testing-facility.md` lines 166-205.
- Owns (may edit): `packages/test-matrix/`.
- Must not touch: `apps/scenario-lab/`, `packages/test-runner/`, documentation.
- Definition of done: `pnpm --filter @fluxiq-web-extension/test-matrix test` passes; the
  report shows the derived catalog listing all 22 registered scenarios (ten are
  placeholders replaced in parallel, so their tags change; the derivation must follow
  without edits); structure audit shows no new finding.
- Report to: `reports/w1-matrix-parity.md`

### Fixture briefs: common terms

Every `w1-fixture-<id>` brief below includes these terms.

- Repository: this repository. Report to `reports/w1-fixture-<id>.md`.
- The fixture is registered as a placeholder at
  `apps/scenario-lab/src/scenarios/<id>/scenario.ts`. Replace it, keeping the export
  name, id, seed, and start path (the title may change).
- Owns (may edit): `apps/scenario-lab/src/scenarios/<id>/` (any files, including
  `tests/scenario.test.ts`) and `apps/scenario-lab/e2e/<id>.spec.ts`.
- Must not touch: `apps/scenario-lab/src/{types,registry,server,html,state-store}.ts`,
  `apps/scenario-lab/src/tests/`, other scenario directories,
  `apps/scenario-lab/e2e/scenario-pages.spec.ts`, `apps/scenario-lab/e2e/playwright.config.ts`,
  `packages/`. If the contract lacks something you need, stop and report it.
- Contract: `defineScenario` and its optional `route` hook for documents, redirects, and
  downloads under `/scenarios/<id>/<subpath>` (`apps/scenario-lab/src/types.ts`); `page()`
  and `fixtureClient()` (`apps/scenario-lab/src/html.ts`); the manifest
  (`packages/test-contracts/src/scenario.ts`): step operations and the `ScenarioStep`
  comment, `extract`, `expected.extracted`, `expected.failure`, `variants`, `workflows`.
  The manifest's own script and expectations are the primary workflow; each further
  corpus row on the fixture is a `workflows[]` entry with its own variants.
- Required reads: the files above; `packages/test-contracts/src/scenario-workflow.ts`
  and `failure-category.ts`; `apps/scenario-lab/src/scenarios/llm-target-drift/` with its
  `tests/` (a moded fixture); `apps/scenario-lab/src/scenarios/navigation/scenario.ts`
  (`route`); `apps/scenario-lab/e2e/scenario-pages.spec.ts` (page-spec pattern).
- Design rules: deterministic from the seed (no `Math.random`; content never depends on
  the clock; delays are fixed constants); realistic semantic markup (labels, roles,
  headings), because FluxIQ's element identity reads it; a stable `data-testid` on
  everything a workflow touches unless the absence is the point; state changes go
  through `mutate`, so `/__control/final-state` is the oracle; loopback only; each variant
  is armed by one `mutate` operation and changes only what its corpus row describes.
- Tests: `tests/scenario.test.ts` (node:test) covers manifest validity, deterministic
  state, every `mutate` operation including each variant arm, and every `route`
  response. `e2e/<id>.spec.ts` drives each workflow with plain Playwright, asserts the
  final state, then arms each variant and asserts the behaviour its row describes.
- Definition of done: `pnpm --filter @fluxiq-web-extension/scenario-lab build` (fixture
  workers compile in parallel; if the only errors are in another fixture's directory,
  rerun), then `node --test apps/scenario-lab/dist/scenarios/<id>/tests/scenario.test.js`
  and `pnpm --filter @fluxiq-web-extension/scenario-lab exec playwright test -c
  e2e/playwright.config.ts e2e/<id>.spec.ts` pass; structure audit shows no new finding
  in your files. The report lists every workflow and variant with its expected outcome
  and any corpus decision you had to make.

### Brief: w1-fixture-product-catalog
- Fixture `product-catalog`, export `productCatalogScenario`; corpus rows W04–W07.
- Build: a seeded catalog of about 23 products (name, price, rating, product link served
  by `route`, in-stock flag shown as a badge), 8 per page, numbered pages and a Next
  control absent on the last page; a search box that filters on submit (Enter or button)
  and shows a result count; an "In stock only" filter.
- Workflows: primary W04 extracts name, price, rating, and URL from page 1;
  `paginated-extraction` W05 extracts every page via Next; `search` W06 types a term,
  submits, and extracts the results; `in-stock-only` W07 extracts only in-stock items.
- Variants: primary `text-variant` (price format changes; extraction still succeeds with
  the new text); `paginated-extraction` → `short-catalog` (one page); `search` →
  `no-results` (empty list, success, count 0).

### Brief: w1-fixture-data-table
- Fixture `data-table`, export `dataTableScenario`; corpus rows W08–W09.
- Build: a `<table>` with `<caption>`, header row (Product, Category, Price, Stock), about
  12 seeded rows, sortable headers (buttons with `aria-sort`). Cells carry no
  column-identifying attributes: headers are the only mapping, as on real sites.
- Workflows: primary W08 extracts every row with `column:<header>` fields;
  `sort-by-price` W09 clicks the Price header and extracts the first row.
- Variants: primary `column-reorder` (columns render in another order; the expected
  records are identical).

### Brief: w1-fixture-infinite-feed
- Fixture `infinite-feed`, export `infiniteFeedScenario`; corpus row W11.
- Build: a feed rendering 10 items and appending 10 more when a sentinel scrolls into
  view (IntersectionObserver), with a loading indicator and an end-of-feed marker; 60
  items by default.
- Workflow: primary W11 scrolls until 40 items are loaded (fixed `scroll` steps sized
  for 40), then extracts them (count 40).
- Variants: `end-early` (the feed ends at 25; success with count 25).

### Brief: w1-fixture-modal-flows
- Fixture `modal-flows`, export `modalFlowsScenario`; corpus rows W12–W14.
- Build: an accessible modal (`role="dialog"`, `aria-modal`, labelled, focus trapped)
  opened by a button, holding a small form with Confirm and Cancel; a cookie-consent
  banner covering the primary action until dismissed; an interstitial offer that, when
  armed, appears after the first click and blocks the page until closed; a "Delete
  draft" button guarded by a native `confirm()` (for the Phase 1.2 dialog action).
- Workflows: primary W12 opens the modal, fills it, confirms; `consent-then-click` W13
  dismisses the banner, then clicks the primary action; `interstitial` W14 clicks twice.
- Variants: `consent-then-click` → `banner-absent` (no banner; expected success);
  `interstitial` → `armed` (expected failure `USER_INTERVENTION_REQUIRED`).

### Brief: w1-fixture-multi-tab
- Fixture `multi-tab`, export `multiTabScenario`; corpus row W15.
- Build: a list page whose "Open details" links use `target="_blank"`, plus one
  `window.open` button; a details page served by `route` with extractable fields,
  recording the visit through its `mutation`.
- Workflow: primary W15 opens details in a new tab, `switchTab` to it, extracts the
  details, `closeTab`, and confirms the list page.
- Variants: `popup-blocked` (the page's open path is blocked and it shows an inline
  notice instead). Choose the expected outcome and justify it in the report.

### Brief: w1-fixture-file-transfer
- Fixture `file-transfer`, export `fileTransferScenario`; corpus rows W16–W17.
- Build: a "Download report" link to a `route`-served CSV with
  `content-disposition: attachment; filename="report-<seed>.csv"` whose GET records the
  download through `mutation`; an upload form (labelled `<input type="file">`, Upload
  button) whose script reads the chosen file's name and size, records them through
  `mutate`, and echoes "Uploaded <name>".
- Workflows: primary W16 clicks the download link and `waitForDownload`s the file;
  `upload` W17 uploads a file (`upload` step), submits, and sees the echoed name.
- Variants: none.

### Brief: w1-fixture-auth-gate
- Fixture `auth-gate`, export `authGateScenario`; corpus rows W18–W19.
- Build: the start page is a sign-in form (username; password with
  `autocomplete="current-password"`; submit) with fixture-only demo credentials stated on
  the page; sign-in records a session through `mutate`; an account page served by
  `route` (`/scenarios/auth-gate/account`) renders protected content while the session is
  valid and otherwise answers 302 to the sign-in page with `?expired=1`, which then says
  the session expired.
- Workflow: primary W18 signs in, navigates to the account page, and reads the protected
  content (final state and an extract step).
- Variants: `expired` W19 (arming expires the session; expected failure `AUTH_REQUIRED`).

### Brief: w1-fixture-identity-drift
- Fixture `identity-drift`, export `identityDriftScenario`; corpus rows W20–W23.
- Build: a settings page with a text field and a primary "Save changes" action whose
  identity drifts by mode: `selector-only` (id, class, and test id change; text, role,
  position unchanged); `text-only` (visible text and accessible name change; structure
  unchanged); `moved` (the action renders in another container, below the fold);
  `wrapped-aria` (extra wrappers, and the name comes from `aria-labelledby`). Here the
  drifted target deliberately does not keep its `data-testid`; the oracle is state.
- Workflow: primary types a value and saves; the save is recorded through `mutate`.
- Variants: `selector-only` W20, `text-only` W21, `moved` W22, `wrapped-aria` W23, each
  expected to succeed (recovered without the harness).

### Brief: w1-fixture-intermediate-state
- Fixture `intermediate-state`, export `intermediateStateScenario`; corpus row W24.
- Build: a form whose submission shows a "Processing" interstitial for a fixed short
  delay before the result; an `unannounced` mode inserts an extra confirmation step
  (a checkbox and Continue) between processing and result that the recording never saw.
- Workflow: primary submits, waits for the result, and verifies it.
- Variants: `unannounced` (expected failure `OUTPUT_NOT_OBSERVED`).

### Brief: w1-fixture-keyboard-forms
- Fixture `keyboard-forms`, export `keyboardFormsScenario`; corpus rows W02–W03.
- Build: a form submitted by Enter in a text field (and by a button), a checkbox, a
  labelled radio group, and an ARIA combobox (`role="combobox"`, listbox,
  `aria-activedescendant`) that opens on keydown and filters on each `input` event, as
  real autocomplete widgets do (it must not check `isTrusted`); an option is chosen with
  ArrowDown and Enter, or by click.
- Workflows: primary W02 types, presses Enter to submit, checks the checkbox, and picks a
  radio; `combobox` W03 types characters into the combobox and chooses an option.
- Variants: none. This fixture is the evidence for decision D5 (trusted-input emulation).

## Batch C

Dispatched once each brief's inputs were verified. The structure audit
reads only git-tracked files, so it cannot see files you create; the
supervisor audits new files at integration.

### Brief: w1-content-aliases
- Repository: this repository
- Task: Phase 1.1 step 4, content-script part, on the layout w1-decompose-content produced.
  1. Remove the legacy dotted action-type alias matching from the content script (now
     under `apps/extension/src/content/actions/`). Action types arrive normalized from
     `domain/src/client/gateway-mapping.ts`, the one place aliases are normalized. Exit
     check: `grep -rn '"dom\.' apps/extension/src/content/actions` prints nothing.
  2. `apps/extension/src/content/types.ts` imports the shared protocol types from
     `apps/extension/src/shared/protocol.ts` instead of keeping a looser copy. Where the
     copy was looser, adopt the protocol type and fix the content code that relied on it.
- Required reads: `reports/w1-decompose-content.md` (the new layout);
  `reports/audit-actions.md` (search `alias` and `content/types.ts`; open question 6 at
  lines 430-434); `apps/extension/src/content/types.ts`; `apps/extension/src/shared/protocol.ts`
  and `domain/src/client/gateway-mapping.ts` read-only.
- Owns (may edit): `apps/extension/src/content/`.
- Must not touch: `apps/extension/src/shared/protocol.ts` (report a needed change),
  `apps/extension/src/background/`, `apps/extension/e2e/`, `domain/`, `packages/`.
- Definition of done: `pnpm --filter @fluxiq-web-extension/extension check`, `build`, and
  `test` pass — `w1-domain-mappings` may still be editing `domain/src/client/gateway-mapping.ts`;
  if the only errors are there, say so and show a type check limited to
  `apps/extension/src/content` passing; the exit grep prints nothing.
- Report to: `reports/w1-content-aliases.md`

### Brief: w1-bench
- Repository: this repository
- Task: Phase 1.6a step 5, the `bench` verb and corpus metrics in `packages/test-runner`.
  1. `pnpm lab bench --corpus <id> --repeat N [--target isolated]` runs every corpus row
     N times, writes one `RunEvaluation` per run plus `report.json` and `report.md` (a
     `BenchReport`) under `test-runs/bench/<run id>/`, and aggregates per-row pass rate,
     flake class, and every corpus metric the contract defines.
  2. Corpora are data in `packages/test-runner/src/bench/corpus/`: `week1` maps W01–W28
     to scenario, workflow, and variant exactly as the plan's corpus table lists them;
     `smoke` is two or three fast rows (basic-form and one more). Variant rows need the
     Wave 2 Flow lane to arm them: record such a run as skipped with that reason, never
     as a pass. A test resolves every row through `resolveScenarioWorkflow` against the
     built registry and names any row that does not resolve.
  3. `compare <report> <report>` reports `improved | regressed | equivalent` per metric
     with the contract's tolerances, replacing the hard-coded two-gate comparison.
  4. Per-action latency from `run.json`'s per-action `durationMs`; evidence sizes from the
     bundle; `llm: "disabled"`; Week 2 metrics `null`; harness activations from Core's
     run detail where the lane exposes it, else `0` with the source recorded.
- Required reads: the plan's `## Metrics` and `## FluxBench Week 1 Corpus` sections;
  `reports/w1-eval-contracts.md`; `reports/w1-runner-asserts.md`;
  `packages/test-contracts/src/{bench-report,evaluation,run,scenario-workflow}.ts`;
  `packages/test-runner/src/{commands,cli,run-scenario}.ts` and the existing compare code.
- Owns (may edit): `packages/test-runner/src/bench/` (new), `commands.ts`, `cli.ts`, the
  existing compare module, new tests in `packages/test-runner/src/tests/`.
- Must not touch: `run-scenario.ts` and the recording-lane modules (report a hook you
  need), `packages/test-contracts/`, `apps/`.
- Also, both found by w1-runner-asserts: pass `workflowId` from the parsed command to
  `runScenario` at `packages/test-runner/src/cli.ts:46` (the `--workflow` flag stops there
  today), and leave `--evidence` unset by default in `commands.ts` so the manifest's
  `evidencePolicy` drives capture unless the flag is given. On this machine `.env.local`
  sets `FLUXIQ_TEST_TARGET=existing`, which the runner deliberately refuses to combine
  with `--target isolated`; never edit `.env.local` — override the variable in the
  command's environment, and report if that is not possible.
- Definition of done: `pnpm --filter @fluxiq-web-extension/test-runner test` passes apart
  from the 19 pre-existing failures owned by w1-runner-test-repair (report any other);
  `pnpm lab bench --corpus smoke --repeat 2 --target isolated` writes a report whose two
  repeats agree within tolerance, and `compare` on its two halves (or two such reports)
  says `equivalent` — outputs quoted; the report lists which `week1` rows resolve today.
- Report to: `reports/w1-bench.md`

### Brief: w1-runner-test-repair
- Repository: this repository
- Task: `pnpm --filter @fluxiq-web-extension/test-runner test` has 19 failures in files no
  Wave 1 worker touched (numbers from one run: 119, 147, 161, 162, 167, 168, 172, 175, 176,
  179, 182, 188–194, 214 — find them by title). Causes per `reports/w1-runner-asserts.md`
  item 4: twelve read repository-root paths (`scripts/run-demo-llm-*.mjs`,
  `apps/scenario-lab/dist/registry.js`, `package.json`) relative to the working directory,
  while pnpm runs them from `packages/test-runner`; six match regexes against
  `src/demo-workspace.ts`, whose code moved into `demo-workspace/` in commit `e800499`;
  one asserts the first creation profile's one-call live ceiling (`maxCallsPerRun` is 2).
  Make every test resolve repository paths from its own location, not the working
  directory; point the source-reading tests at where the code now lives, keeping what each
  asserts. For the ceiling, establish the intended value from `git log -p` of the constant
  and the LLM plan (`docs/working/llm-production-automation-plan.md`, search the constant)
  before touching anything: if the constant regressed, stop and report it — never loosen a
  safety or cost assertion to make it pass.
- Required reads: the failing test files; the modules they read; the report item above.
- Owns (may edit): the test files containing the 19 failing tests.
- Must not touch: source files, scripts, constants (report a needed change), other tests.
- Definition of done: the test-runner suite passes from `packages/test-runner` and from
  the repository root (both counts quoted); each fix is listed with its cause.
- Report to: `reports/w1-runner-test-repair.md`

### Brief: w1-host-esm
- Repository: this repository
- Task: Core now loads a domain's panel host with a native `import()`
  (`F:\!FluxIQ\apps\web\src\lib\fluxiq.ts`, `loadFluxIQHostModule`; report
  `F:\!FluxIQ\docs\working\mvp-week1-web-automation-reliability-plan\reports\core-host-loading.md`),
  so this repository's host uses Core's public exports (decision D11).
  1. `domain/src/web-panel-host.ts` imports from `fluxiq/automation-studio` (and other
     public entry points) instead of Core's `dist`; drop the comment explaining the deep import.
  2. `domain/scripts/build-web-panel-host.mjs` builds the host as an ES module
     (`format: "esm"`, a `.mjs` file), with FluxIQ packages external so the host reaches
     Core through its public entry points at runtime.
  3. The host path is hard-coded five times (`scripts/run-fluxiq-web.mjs:8`,
     `domain/scripts/build-web-panel-host.mjs:8`, `packages/test-runner/src/coordinator.ts:76`,
     `packages/test-runner/src/demo-workspace/core-process.ts:28`,
     `packages/test-runner/src/environment.ts:40`). Give it one source of truth that every
     consumer reads — for example a field the domain package declares — and repoint all five.
  4. Update `docs/architecture/repository-layout.md` and any authored doc naming the host file.
- Required reads: the Core report above; the files named; `domain/package.json`;
  `F:\!FluxIQ\apps\web\src\lib\fluxiq.ts` (read-only).
- Owns (may edit): those files, `domain/package.json`, and new tests for the path source.
- Must not touch: Core; `packages/test-runner/src/{commands,cli}.ts` and `bench/` (w1-bench);
  other domain source.
- Definition of done: `pnpm --filter @fluxiq-web-extension/domain host:build` writes the
  `.mjs` host, and loading it through Core's loader binds the native runtime (as the
  Core report's scratch proof did); domain `check` and `test`; test-runner `check` and
  `test`; `FLUXIQ_TEST_TARGET=isolated pnpm lab run basic-form --target isolated` passes,
  which starts Core's panel with the new host; structure audit clean. w1-bench runs Lab
  runs at the same time: rerun once if a run fails while your edits are half-applied.
- Report to: `reports/w1-host-esm.md`

### Brief: w1-core-failure-adoption
Dispatched after `core-failure-taxonomy` lands, once the supervisor has added the Core
link dependency and run `pnpm install` with no other worker running.
- Repository: this repository
- Task: adopt Core's failure taxonomy (decision D11). Core's enum, failure record, parser,
  and import paths are in
  `F:\!FluxIQ\docs\working\mvp-week1-web-automation-reliability-plan\reports\core-failure-taxonomy.md`.
  1. `packages/test-contracts/src/failure-category.ts` stops listing names: scenario
     expectations use Core's categories, and the contract, validator, JSON Schema, and
     tests follow.
  2. Fixture manifests, unit tests, and page specs use Core's values: `auth-gate`,
     `intermediate-state`, `modal-flows`, `multi-tab`.
  3. The rejection of an unknown action type carries Core's failure record — in the domain
     (`domain/src/client/gateway-mapping.ts`) and on the wire from the extension
     (`apps/extension/src/runtime/result-mapping.ts`, Core's `failure` field instead of
     `metadata.code`), with the category Core defines for a rejected action and a `code`
     naming the cause.
  4. The runner's automation-failure record
     (`packages/test-runner/src/run-manifest/automation-failure.ts`) and the evaluation
     types use Core's category type.
  5. `docs/architecture/web-capabilities.md` and `extension-client.md` describe the
     rejection reply on Core's `failure` field.
- Required reads: the Core report; the files above and their tests; the test-contracts
  tests that name categories (`evaluation-contracts`, `run-manifest`, `runtime-contracts`,
  `scenario-validation`).
- Owns (may edit): the files above, their tests, `evaluation.ts`, `run.ts`, and
  `bench-report.ts` in `packages/test-contracts/src/` where they name the category type.
- Must not touch: Core, `packages/test-runner/src/{commands,cli}.ts`, `bench/`.
- Definition of done: test-contracts, scenario-lab (unit and page specs), extension
  (`check`, `test`, `test:content`), domain (`check`, `test`), and test-runner (`check`,
  `test`) pass; a grep shows none of the plan's eleven upper-case names used as a category
  value downstream (list any that remain as domain `code` values); structure audit clean.
- Report to: `reports/w1-core-failure-adoption.md`

### Brief: w1-recording-start-flake
- Repository: this repository
- Task: the recording lane intermittently fails with "The extension recording did not
  start", which makes every corpus measurement unreliable. Evidence:
  `test-runs/run-mtxihk3k-b7583814` (bench `bench-mtxigc2s-2cbf19a0`, row W28 repeat 0,
  rig category `recording.persistence`, `summary.json` `firstFailure`) with repeat 1
  passing and no other Lab run active; `reports/w1-host-esm.md` (one failure, passed on
  rerun); `reports/w1-bench.md` (W01 failed twice during a parallel rebuild, then six
  passes).
  1. Reproduce: run `FLUXIQ_TEST_ENV_FILES=none pnpm lab run iframe-checkout --target
     isolated` at least six times, alone, and record how often it fails; if it never
     fails alone, reproduce it under a concurrent build.
  2. Name the race before changing anything: the runner's recording start and the wait
     `w1-runner-asserts` added (see `reports/w1-runner-asserts.md`), the extension's
     start handling in `apps/extension/src/background/`, and Core's acceptance of the
     recording. Use the run's `logs/core.log`, `events.ndjson`, and the extension logs.
  3. Fix it so the start is deterministic: wait on an observable signal (the extension's
     confirmation, or Core's persisted recording), never a fixed sleep. If a bounded
     retry is the right answer, say why. If the defect is in the extension or the domain
     rather than the runner, fix it there.
  4. Prove it: at least eight consecutive isolated runs across `iframe-checkout` and
     `basic-form` with no failure, and `FLUXIQ_TEST_ENV_FILES=none pnpm lab bench
     --corpus smoke --repeat 2 --target isolated` green.
- Required reads: `reports/w1-runner-asserts.md`; the recording-start path in
  `packages/test-runner/src/`; `apps/extension/src/background/` recording handling; the
  failing run directory above.
- Owns (may edit): the recording-start path in `packages/test-runner/src/` and, if the
  defect is there, `apps/extension/src/background/`, plus their tests.
- Must not touch: `packages/test-runner/src/bench/`, the Scenario Lab fixtures, Core
  (a Core worker is running there).
- Definition of done: the eight runs and the bench quoted; runner `check` and `test`
  pass; extension `check`, `test`, and `test:content` pass if you touched the extension;
  structure audit clean.
- Report to: `reports/w1-recording-start-flake.md`

### Brief: w1-capability-docs
- Repository: this repository
- Task: Phase 1.1 step 5, current-state documentation.
  1. Create `docs/architecture/web-capabilities.md`: the web capability matrix from
     `reports/audit-actions.md` (every action and capability row with its state —
     fully, partial, unreliable, unsupported — and whether its outcome is validated),
     brought up to the current working tree: unknown action types are rejected rather
     than rewritten (`domain/src/client/gateway-mapping.ts`, still being edited by
     another worker — describe what the file does when you read it); one safety
     registry (`domain/src/actions/safety.ts`); the recorder ignores untrusted
     `input`/`change` (`apps/extension/src/content/dom-events.ts`); `type`/`select`
     runtime confirmations carry redacted values
     (`apps/extension/src/background/connection/runtime-status.ts`). Each row names its
     owning files and the Week 1 phase that changes it. Open with one paragraph saying
     the page is current-state design, updated at every phase close.
  2. Correct the three stale claims in `docs/architecture/extension-client.md` that
     `reports/audit-recording.md` names (focus/blur events, `client.recording_entry`,
     and the sensitivity claim), each checked against source before you change it.
  3. Link the new page from the architecture index if one exists.
- Required reads: `reports/audit-actions.md`; `reports/audit-recording.md` (its section
  on `extension-client.md`); the source files named above; `docs/architecture/extension-client.md`.
- Owns (may edit): `docs/architecture/web-capabilities.md` (new),
  `docs/architecture/extension-client.md`, the architecture index (one link line).
- Must not touch: source code, `docs/working/`, other architecture pages.
- Definition of done: every relative link in the two pages resolves (show the check);
  every stale-claim correction cites the source line that proves it; the report lists
  matrix rows whose state you changed from the audit and why.
- Report to: `reports/w1-capability-docs.md`

### Brief: w1-domain-test-typecheck
- Repository: this repository
- Task: domain tests are bundled by esbuild and never type-checked (`domain/tsconfig.json`
  excludes `src/**/tests/**`), and w1-domain-mappings counted 15 existing type errors in
  them. Make `pnpm --filter @fluxiq-web-extension/domain check` type-check every
  `domain/src/**/tests/*.test.ts` as well as the source (a tests tsconfig with `noEmit`
  that the `check` script also runs is one way; reuse or replace the stale
  `domain/tsconfig.test.json`, whose `outDir` points at the tracked `.test-build/`), and
  fix every error it reports, in the tests or, where a test exposes a real type defect,
  in the source. Move `domain/src/actions/tests/safety.test.ts` to `domain/src/tests/`: it
  asserts three modules agree (`actions/safety.ts`, `io/manifest-definitions.ts`,
  `output-nodes/definitions.ts`), and a test with several subjects lives in the
  `tests/` folder of the nearest directory containing all of them.
- Required reads: `domain/tsconfig.json`, `domain/tsconfig.test.json`,
  `domain/package.json`, `domain/scripts/test-domain.mjs`, the test files the check
  reports, and the source types they use.
- Owns (may edit): `domain/tsconfig*.json`, `domain/package.json` (the `check` script),
  `domain/src/**/tests/`, and source files under `domain/src/` only where a test exposes a
  genuine type defect (list each in the report).
- Must not touch: `domain/.test-build/`, `apps/`, `packages/`, `domain/scripts/test-domain.mjs`.
- Definition of done: `pnpm --filter @fluxiq-web-extension/domain check` passes and
  demonstrably covers the tests (show that a deliberate type error in a test fails it,
  then revert); `DOMAIN_TEST_BUILD_LABEL=w1-domain-test-typecheck pnpm --filter
  @fluxiq-web-extension/domain test` passes with the same test count as before
  (26 plus the smoke script); the report lists each error fixed and how.
- Report to: `reports/w1-domain-test-typecheck.md`

### Brief: w1-extension-unit-tests
Dispatched after w1-content-harness (which edits `apps/extension/package.json`) and
w1-domain-test-typecheck (whose tests-tsconfig approach this mirrors) have finished.
- Repository: this repository
- Task: the extension has no unit-test runner — its `test` script only checks that five
  files exist. Add one on the domain's pattern (`domain/scripts/test-domain.mjs`): bundle
  every `apps/extension/src/**/tests/*.test.ts` with esbuild and run it under `node:test`,
  with a label variable for parallel runs and output in an ignored directory; the package
  `test` script runs it together with the smoke check, and `check` type-checks the tests.
  Then cover the pure logic:
  1. `src/runtime/tests/result-mapping.test.ts`: an unknown action type becomes a failed
     gateway result with `metadata.code: "ACTION_REJECTED"` and the requested type; a
     known type passes through; a browser result maps to the gateway result (status,
     target, `error` only on failure).
  2. `src/background/connection/tests/runtime-status.test.ts`:
     `runtimeConfirmationForActionResult` for every action type; `type` and `select`
     confirmations carry the value only when the result has one, and never for a
     sensitive descriptor (password input; autocomplete `current-password`,
     `new-password`, `one-time-code`, or `cc-*`; `data-sensitive="true"`).
  3. Further pure functions in `src/runtime/` or `src/background/connection/` that are
     cheap to cover; list them in the report.
- Required reads: `domain/scripts/test-domain.mjs`; `reports/w1-domain-test-typecheck.md`;
  `reports/w1-recorder-hygiene.md` (the sensitivity rule); `apps/extension/package.json`,
  `tsconfig.json`, `scripts/smoke-test.mjs`, `scripts/build-extension.mjs` (esbuild
  settings, read-only); `src/runtime/result-mapping.ts`;
  `src/background/connection/runtime-status.ts`.
- Owns (may edit): a new test script in `apps/extension/scripts/`;
  `apps/extension/package.json` (`test` and `check` scripts); `apps/extension/tsconfig*.json`;
  new `tests/` folders under `apps/extension/src/`; `.gitignore` (one line).
- Must not touch: source files under `apps/extension/src/` (report a defect a test
  exposes), `apps/extension/scripts/build-extension.mjs`, `apps/extension/e2e/`, `domain/`,
  `packages/`.
- Definition of done: `pnpm --filter @fluxiq-web-extension/extension test` runs the new
  tests and passes (counts quoted); `check` type-checks them (show a deliberate type
  error in a test failing it, then revert); structure audit shows no new finding.
- Report to: `reports/w1-extension-unit-tests.md`

### Brief: w1-lab-consolidation
Dispatched after all ten fixture workers finished.
- Repository: this repository
- Task: consolidate the Scenario Lab after ten parallel fixture workers.
  1. A barrel `index.ts` in every `apps/scenario-lab/src/scenarios/<id>/` directory (all
     22; `modal-flows` already has one) exporting that scenario's definition, and
     `apps/scenario-lab/src/registry.ts` importing each scenario from its directory
     barrel. Check every other importer of scenario internals (`grep` the package).
  2. One shared e2e fixture module exporting the `test` object with the `lab` and
     `networkGuard` fixtures and the final-state helper, replacing the copies in all
     eleven `apps/scenario-lab/e2e/*.spec.ts` files. Put it where the structure audit's
     test-placement rule allows a non-spec e2e file (see `e2e/network-policy.ts`). No
     behaviour change: every spec keeps its assertions.
  3. `docs/architecture/testing-facility.md`: the fixture table and every count reflect
     22 fixtures, with a one-line purpose and the corpus rows for each new fixture (from
     the fixture reports), and the stale "eleven"/"ten-scenario" statements corrected.
- Required reads: `apps/scenario-lab/src/{registry,types,server}.ts`;
  `apps/scenario-lab/e2e/` (all specs, `network-policy.ts`, `playwright.config.ts`);
  `scripts/structure-audit/rules/imports.mjs` and `test-placement.mjs`;
  `docs/architecture/testing-facility.md` (the fixture sections);
  `reports/w1-fixture-*.md` (Outcome and workflow tables only).
- Owns (may edit): new `apps/scenario-lab/src/scenarios/*/index.ts`;
  `apps/scenario-lab/src/registry.ts`; `apps/scenario-lab/e2e/` (spec files and the new
  fixture module, not `playwright.config.ts`); `docs/architecture/testing-facility.md`.
- Must not touch: other files under `apps/scenario-lab/src/scenarios/`, `packages/`,
  `apps/extension/`, `docs/working/`.
- Definition of done: `pnpm --filter @fluxiq-web-extension/scenario-lab test` passes;
  `npx playwright test -c e2e/playwright.config.ts --repeat-each=2` in
  `apps/scenario-lab` passes with an output directory of your own (counts quoted); a
  structure audit with your new files in a scratch git index shows no finding (say how
  you ran it); no spec file defines its own lab fixture any more (grep quoted).
- Report to: `reports/w1-lab-consolidation.md`

### Brief: w1-lab-arm-helper
- Repository: this repository
- Task: every fixture page spec in `apps/scenario-lab/e2e/` still carries its own copy of
  the helper that arms a variant (a `POST /api/<id>/<operation>` with the run token).
  Move one helper into the shared `apps/scenario-lab/e2e/lab-fixture.ts`, next to
  `readFinalState`, and make every spec use it; keep each spec's assertions unchanged.
  Also move any other helper that two or more specs copy verbatim.
- Required reads: `reports/w1-lab-consolidation.md`; `apps/scenario-lab/e2e/lab-fixture.ts`;
  every `apps/scenario-lab/e2e/*.spec.ts`.
- Owns (may edit): `apps/scenario-lab/e2e/lab-fixture.ts` and the spec files.
- Must not touch: `apps/scenario-lab/src/`, `playwright.config.ts`, `network-policy.ts`.
- Definition of done: `npx playwright test -c e2e/playwright.config.ts --repeat-each=2` in
  `apps/scenario-lab` passes with the same test titles as before (counts quoted, output
  directory of your own); a grep shows no spec defines its own arm helper.
- Report to: `reports/w1-lab-arm-helper.md`
