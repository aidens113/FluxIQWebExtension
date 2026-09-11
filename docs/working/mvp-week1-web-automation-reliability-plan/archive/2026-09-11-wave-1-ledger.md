# Wave 1 ledger, part 1 — 2026-09-11

Ledger entries from the first half of Wave 1 of the
[MVP Week 1 plan](../../mvp-week1-web-automation-reliability-plan.md),
moved here verbatim to keep the plan under the 800-line threshold. Their
outcomes are folded into the plan's `Current State`.

### 2026-09-11 — Wave 1 dispatched; Batch B pre-step
- Agent: supervisor, with the Wave 1 workers named in `briefs/wave-1.md`
- Changed: `domain/scripts/test-domain.mjs`; `.gitignore`;
  `packages/test-contracts/src/{scenario,validation,scenario-workflow,failure-category,index}.ts`
  and its scenario test; Scenario Lab `types`, `server`, `registry`, the
  navigation and iframe scenarios, ten placeholders, two tests, e2e config.
- Why: fixtures cannot compile or be served until the contract and the
  registry know them; placeholders keep the parity tests green meanwhile.
- Validation: domain test (label `supervisor`) -> `# tests 24 # pass 24`
  and the smoke script passed; test-contracts -> `# tests 30 # pass 30 #
  fail 0`; scenario-lab -> `# tests 23 # pass 23 # fail 0`; scenario-lab
  page specs -> `11 passed (4.3s)`; structure audit -> `passed (27
  warning(s), 19 baselined)`; headless shell -> `Target page, context or
  browser has been closed`, `channel: "chromium"` -> `ok 134.0.6998.35`.
- Outcome: Accepted (pre-step); Wave 1 in progress.
- Follow-up: integrate Wave 1.

### 2026-09-11 — Batch A verified; ACTION_REJECTED reaches the wire
- Agent: supervisor, with w1-decompose-content, w1-domain-mappings,
  w1-domain-registry, w1-recorder-hygiene, w1-content-aliases
- Changed (supervisor): `apps/extension/src/runtime/result-mapping.ts`
  and `background/connection/gateway-session.ts` — an unknown action type
  is answered at once as `failed` with `metadata.code: "ACTION_REJECTED"`
  and never reaches the page (the wire has no `rejected` status until
  D3); `apps/extension/e2e/playwright.config.ts` uses full Chromium;
  the Phase 1.1 step plan archived.
- Decision: the live input path uses the proposal path's completeness
  gate. An event whose output lacks its schema's required parameters
  (selectorless click, keyless keypress, coordinate-less scroll) is
  evidence, not executable, per the input/output rule in `AGENTS.md`.
- Validation: domain `check` -> clean; domain test (label `supervisor`)
  -> `# tests 26 # pass 26 # fail 0`, smoke passed; extension `check` ->
  exit 0, `build` -> done, `test` -> "Extension smoke test passed.";
  `e2e/action.spec.ts` -> `1 passed (1.9s)`; `network-policy.spec.ts` ->
  `3 passed (1.7s)`; alias grep -> no matches; a scratch bundle of
  `result-mapping.ts` turns `web.dom.teleport` into `status: "failed"`
  with `metadata.code: "ACTION_REJECTED"` and passes a click through;
  zero references to each deleted symbol.
- Outcome: Accepted.
- Follow-up: w1-domain-test-typecheck (tests were never type-checked;
  15 existing errors); an extension unit-test runner once
  w1-content-harness frees `apps/extension/package.json`.

### 2026-09-11 — Domain tests type-checked; three fixtures verified
- Agent: supervisor, with w1-domain-test-typecheck,
  w1-fixture-intermediate-state, w1-fixture-multi-tab,
  w1-fixture-infinite-feed
- Changed (supervisor): the `ScenarioVariant` comment now says a variant
  never changes the recording — the recording lane runs unarmed and the
  variant governs the armed run; `packages/test-contracts/dist` rebuilt
  after its barrel briefly exported an unbuilt module.
- Decisions: `multi-tab` variant `popup-blocked` expects
  `OUTPUT_NOT_OBSERVED` (the click lands; the new tab never appears);
  Wave 4 may revise corpus categories. Fixture directories get barrels at
  integration, with the registry importing them.
- Validation: domain `check` -> `tsc -p tsconfig.json --noEmit && tsc -p
  tsconfig.test.json`, exit 0; domain test -> `# tests 26 # pass 26 #
  fail 0`, smoke passed; scenario-lab `build` -> exit 0; unit tests:
  intermediate-state 9/9, multi-tab 7/7, infinite-feed 7/7; their page
  specs with `--repeat-each=2` -> `20 passed (15.7s)`.
- Outcome: Accepted.
- Follow-up: the remaining seven fixtures and Batch B workers.

### 2026-09-11 — Six more fixtures verified; contract and docs corrected
- Agent: supervisor, with w1-fixture-file-transfer, w1-fixture-identity-drift,
  w1-fixture-auth-gate, w1-fixture-data-table, w1-fixture-modal-flows,
  w1-fixture-keyboard-forms, w1-capability-docs
- Changed (supervisor): the `ExpectedExtraction` comment (records are the
  complete list, matched exactly and in order; count is exact);
  `web-capabilities.md` and `extension-client.md` updated for the landed
  rejection reply and alias removal; the false sensitivity comment in
  `apps/extension/src/content/describe-element.ts` corrected; the briefs
  now warn that the Bash tool collapses `\\` in heredocs, which broke the
  data-table build.
- Validation: scenario-lab `build` -> exit 0; unit tests: file-transfer
  11/11, identity-drift 9/9, auth-gate 10/10, data-table 9/9, modal-flows
  14/14, keyboard-forms 10/10; page specs with `--repeat-each=2`: first
  three -> `34 passed (9.2s)`, data-table -> `6 passed (3.0s)`,
  modal-flows -> `14 passed (7.8s)`, keyboard-forms -> `14 passed
  (6.1s)`; capability-docs link check -> 22 relative links, 0 failing.
- Outcome: Accepted.
- Wave 2 inputs: the Flow lane resets Scenario Lab state between
  recording and playback (otherwise a primary workflow passes on the
  recording's own actions); Enter emulation passes the form's default
  button to `requestSubmit`; radio-group arrow keys need trusted input,
  outside D5; a replayed scroll is probably recorded twice (scroll events
  are trusted even when programmatic); Phase 1.2 has no step for
  extracting attributes although its exit check needs 24/24; W17 fails
  until `web.dom.upload` exists.

### 2026-09-11 — Harness, contracts, and catalog verified
- Agent: supervisor, with w1-content-harness, w1-eval-contracts,
  w1-matrix-parity, w1-fixture-product-catalog
- Changed (supervisor): the pre-existing `RunEvaluation` fixture in
  `packages/test-contracts/tests/runtime-contracts.test.mjs` completed with
  the new required fields; `apps/extension/e2e/playwright.config.ts`
  ignores `content/**` (the harness has its own config); the select row of
  `web-capabilities.md` corrected (a missing option leaves nothing selected).
- Decisions: the contract shapes are accepted — lanes `recording` and
  `flow`, `llm` as `{ mode, profileId, calls }`, per-row `corpusRowId`;
  product-catalog W07 extracts all 18 in-stock items across pages.
- Validation: `test:content` -> `31 passed (5.0s)`; test-contracts -> `#
  tests 47 # pass 47 # fail 0`; test-runner and agent-orchestrator `check`
  -> exit 0; test-matrix -> `# tests 17 # pass 17 # fail 0`; the old e2e
  config lists `Total: 8 tests in 4 files`; product-catalog unit 9/9, page
  specs `--repeat-each=2` -> `18 passed (7.5s)`.
- Outcome: Accepted.
- Follow-up: CI (pull requests, `main`, nightly; not `dev` pushes) now
  selects the two LLM scenarios and the ten new fixtures the old catalog
  missed; check those lanes before the first pull request to `main`.
  test-matrix's nested Scenario Lab build can race under `pnpm -r test`.

### 2026-09-11 — Decision D11: Core-owned changes go in Core
- Agent: supervisor
- Changed: this document (D11, Sequencing, header, Current State);
  `briefs/wave-2.md` (the result's `failure` is Core's record); the paired
  Core document created with three Core briefs.
- Why: the user, told that Wave 1 had worked around Core gaps downstream,
  directed: "just ensure that changes that should be going in core arent
  going in this repo."
- Validation: not validated — documentation only; the user was alerted
  to the Core areas and impact before the first Core edit.
- Outcome: Accepted
- Follow-up: dispatch the Core workers; downstream follow-through at
  Wave 1 integration.

### 2026-09-11 — Consolidation, extension unit tests, and a sensitivity fix
- Agent: supervisor, with w1-lab-consolidation, w1-extension-unit-tests
- Changed (supervisor): `apps/extension/src/shared/sensitive-field.ts` is
  the one sensitivity rule, used by `content/element-traits.ts` and
  `background/connection/runtime-status.ts` instead of two copies; it checks
  every `autocomplete` token, so `billing cc-number` is now sensitive (it
  leaked before); `apps/scenario-lab/src/tests/registry.test.ts` imports the
  basic-form barrel.
- Decisions: a failed `type` never confirms its value, because the caller
  (`background/connection.ts`) confirms succeeded results only; the missing
  `error` on `timed_out`/`cancelled` results and the recordable `about:`,
  `view-source:`, `data:`, and store pages go to w2-browser-actions.
- Validation: extension `check` -> exit 0; extension `test` -> `# tests 64 #
  pass 64 # fail 0`, smoke passed; `test:content` -> `31 passed (5.5s)`;
  scenario-lab `test` -> `# tests 118 # pass 118 # fail 0`; page specs
  `--repeat-each=2` -> `128 passed (24.7s)`; structure audit through a
  scratch index holding every new file -> `passed (28 warning(s), 19
  baselined)`.
- Outcome: Accepted.
- Follow-up: w1-lab-arm-helper removes the arm helper copied in ten specs.

### 2026-09-11 — Runner lane, Scenario Lab cleanup, and the baseline mirror
- Agent: supervisor, with w1-runner-asserts, w1-lab-arm-helper; Core's
  core-structure-baseline
- Changed (supervisor): `packages/test-runner/src/interactive-session.ts`
  passes the scenario-origin proof to its network guard, as the recording
  lane does; the shared e2e lab fixture owns the console-error check;
  `scripts/structure-audit.mjs`, `scripts/structure-audit/baseline.mjs`, and
  `scripts/structure-audit/tests/baseline.test.mjs` mirrored from Core, with
  `structure:test` covering the new tests.
- Found (w1-runner-asserts): the recording lane ran every scripted action
  before Core had accepted the recording, so nothing it did was recorded;
  it now waits for the recording to start.
- Validation: runner `check` -> exit 0; runner suite -> `# tests 333 # pass
  314 # fail 19`, the 19 predating this wave and owned by
  w1-runner-test-repair; basic-form and iframe-checkout isolated runs ->
  `"verdict":"passed"` (worker, through `runScenario`); page specs
  `--repeat-each=2` -> `128 passed (21.3s)`; `pnpm structure:test` -> `#
  tests 48 # pass 48 # fail 0`; structure audit -> passed.
- Outcome: Accepted; the runner lane stays Partial until w1-bench and
  w1-runner-test-repair land.
- Wave 2 inputs: keyboard selection also records a keystroke, which the
  Flow lane must not replay as a separate key press; a failed
  `executeExistingPersistedFlow` carries only a message, so the Flow lane
  reads Core's failure field; `expected.failure` is asserted on the Flow lane.

### 2026-09-11 — Runner suite repaired; the call ceiling holds
- Agent: supervisor, with w1-runner-test-repair
- Changed: nine runner test files resolve repository paths from their own
  location, and the demo-workspace tests read the modules the code moved into.
- Decision: `FIRST_LIVE_CREATION_PROFILE` has been a deprecated alias of the
  two-call production profile since commit `488bb66`, so its test now expects
  that profile; the one-call live ceiling stays asserted on
  `FIRST_LIVE_CREATION_LIMITS` (`maxCalls: 1`), with a new check that the
  evaluator refuses a second call. No constant changed.
- Validation: runner suite -> `# tests 333 # pass 333 # fail 0` (supervisor).
- Outcome: Accepted

### 2026-09-11 — Panel host is an ES module on Core public exports
- Agent: supervisor, with w1-host-esm
- Changed: `domain/src/web-panel-host.ts` imports `fluxiq/automation-studio`;
  `domain/scripts/build-web-panel-host.mjs` builds `web-panel-host.mjs`; the host
  path is declared once as `fluxiqHostModule` in `domain/package.json` and read by
  `scripts/run-fluxiq-web.mjs` and the runner (`environment.ts`).
- Validation: `host:build` -> the built host has exactly one Core import, `from
  "fluxiq/automation-studio"` (supervisor); domain `check` -> exit 0, `test` -> `#
  tests 26 # pass 26 # fail 0` (supervisor); worker: Core loader binds the native
  runtime (11 definitions), runner `test` 355/355, an isolated basic-form run
  passed on rerun with Core panel loading the new host.
- Found: `.env.local` configures the existing install, and a process variable
  cannot clear its keys, so isolated runs need an explicit env-file opt-out.
- Outcome: Accepted

### 2026-09-11 — FluxBench, the env-file opt-in, and the Core contracts link
- Agent: supervisor, with w1-bench; the host-switch entry (w1-host-esm) is
  archived with the others.
- Changed: `packages/test-runner/src/bench/` (the `bench` verb, the `week1` and
  `smoke` corpora, per-run evaluations, corpus metrics, report comparison);
  `commands.ts` and `cli.ts` (`--workflow` reaches the runner; `--evidence`
  defaults to the manifest's policy). Supervisor: `FLUXIQ_TEST_ENV_FILES=none`
  in `packages/test-runner/src/target-config.ts`, tested and documented;
  `packages/test-contracts` depends on Core's `@fluxiq/contracts` through a
  link; the unused `web-panel-host.cjs` build output deleted.
- Validation: runner `check` -> exit 0 and suite -> `# tests 356 # pass 356 #
  fail 0` (supervisor); worker: `FLUXIQ_TEST_ENV_FILES=none pnpm lab bench
  --corpus smoke --repeat 2 --target isolated` -> 4/4 passed, `compare
  --halves` -> `equivalent`.
- Found: `week1` resolves fully except the variants of W10, W25, W26, and
  W27, which their fixtures do not define yet (Wave 4); variant runs are
  skipped until the Flow lane arms them, and `BenchReport` has no field for
  skipped runs yet.
- Outcome: Accepted

### 2026-09-11 — Core categories adopted; gates run; a recording-start flake
- Agent: supervisor, with w1-core-failure-adoption
- Changed: `packages/test-contracts/src/failure-category.ts` re-exports Core's
  list, guard, record, and parser, and the six modules that named the old list
  follow; the unknown-action-type rejection carries Core's failure record
  (`blocked_by_capability_or_policy`, code `web.action.unsupported_type`) in the
  domain and on the wire; four fixtures with their tests and page specs, and both
  architecture pages. Supervisor: the four `bench/` files moved onto Core's values
  (13 replacements, one a live defect that wrote an invalid evaluation); the
  Testing Lab fixture table; `pnpm structure:baseline` recorded the one lowering.
- Validation: supervisor runs — `pnpm check` -> exit 0, ten packages Done; `pnpm test`
  -> exit 0 on a rerun (the first run exited 1 with its detail already filtered
  away, so it is recorded as an unexplained flake); `pnpm build` -> exit 0;
  `test:content` -> `31 passed`; `FLUXIQ_TEST_ENV_FILES=none pnpm lab run
  basic-form --target isolated` -> `"verdict":"passed"`; the structure audit with
  all 382 staged files -> `passed (28 warning(s), 19 baselined)`.
- Found: the smoke bench passed 3 of 4 runs. W28 repeat 0 failed
  `recording.persistence` with "The extension recording did not start", running
  alone with no other Lab run active, so concurrency does not explain it.
  w1-recording-start-flake owns it, and the push waits for it.
- Outcome: Accepted apart from the flake.
