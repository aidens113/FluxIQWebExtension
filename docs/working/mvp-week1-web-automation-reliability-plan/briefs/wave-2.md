# Wave 2 worker briefs

Briefs for Wave 2 of the
[MVP Week 1 plan](../../mvp-week1-web-automation-reliability-plan.md)
(Sequencing: Phase 1.2 steps 1–5, Phase 1.3 steps 1–2, Phase 1.6a step 4),
written by the senior supervisor agent. Wave 2 is dispatched after Wave 1 is
integrated and pushed. `w2-foundation` runs alone first; the other briefs run
in parallel once its contract is verified. Workers read only their own brief.

Every worker also reads the plan's `Current State`. Paths are relative to
`F:\!FluxIQWebExtension`; report paths are under
`docs/working/mvp-week1-web-automation-reliability-plan/reports/`.

Concurrency notes for every worker: other workers build and test in the same
working tree; a failure in a file you do not own is most likely a parallel
edit, so rerun once before reporting it. Write file content with the Write or
Edit tool, never a Bash heredoc (the Bash tool collapses `\\` to `\`, and a
command over about 8 KB fails with a misleading quote error). The structure
audit reads only git-tracked files; audit new files through a scratch git
index and never run `pnpm structure:baseline`. Domain tests take
`DOMAIN_TEST_BUILD_LABEL=<your label>`. Content-script behaviour is proven in
`apps/extension/e2e/content/tests/` (`pnpm --filter
@fluxiq-web-extension/extension test:content`); pure extension logic in the
extension unit tests. Headless Chromium here needs `channel: "chromium"`.

Failure categories are Core's enum values (the mapping from the plan's names
is in the Core report `core-failure-taxonomy.md`), used exactly — named here
by the plan's names: a disabled, hidden, or covered target is
`ACTION_REJECTED`; a target that cannot be found is `TARGET_NOT_FOUND`; an
action that ran but whose post-condition did not hold is `OUTPUT_NOT_OBSERVED`
(with `expected` and `actual`); an authored assertion that does not hold is
`STATE_MISMATCH`; a landed URL other than the requested one is
`NAVIGATION_UNEXPECTED`; a wait or action timeout is status `timed_out` with
`TIMEOUT`.

Learned during Wave 1, on 2026-09-11, and binding for every Wave 2 worker.

- Set `FLUXIQ_TEST_ENV_FILES=none` on every Lab command. `.env.local` configures
  the existing install, and a process variable cannot clear its keys, so an
  isolated run needs the explicit opt-out. Never edit `.env.local`.
- Capture a command exit status by redirecting to a file and echoing `$?`, never
  through a pipe. A pipe reports the status of the last command in it, which hid
  a real failing test suite for part of a day.
- Stage new files before running the structure audit. It reads only tracked
  files, so an unstaged new file is never inspected and its violations surface
  later, at the worst moment.
- The baseline only lowers or removes entries and refuses growth. Do not grow a
  baselined file, explanatory comments included; put the reasoning in the working
  document or your report instead.
- Only one Lab run may execute on this machine at a time. Two overlapping runs
  crashed a build with an access violation. Serialize them.

## Wave 2 contract

`w2-foundation` implements this section; every other Wave 2 brief codes against it.

- **Action types** (`WebAutomationActionType`, decision D6): add `web.dom.check`,
  `web.dom.assert`, `web.dom.extract_list`, `web.dom.upload`, `web.dom.dialog`,
  `web.browser.tab`, `web.browser.download`; list them in `WEB_AUTOMATION_ACTION_TYPES`;
  classify them in `domain/src/actions/safety.ts` (assert and extract_list safe, the rest review).
- **Command parameters** (`WebAutomationActionCommand`): select by value, label, or index;
  scroll modes `by`, `toElement`, `untilStable` with `maxScrolls`; wait conditions visible,
  enabled, absent, url, stable; navigate `newTab`; keypress modifiers; extract_list
  mirroring the scenario contract's extract step (item selector; field map with
  `@attribute` and `column:<header>`; `paginate { next, maxPages }`; `maxItems`); assert
  kinds exists, absent, text, url, visible, enabled, with a timeout; upload files as name,
  MIME type, and bounded base64 content; dialog accept, dismiss, or prompt text; tab open,
  switch, close; download filename and timeout; check `checked`.
- **Element descriptor**: optional `testId`, `accessibleName`, `label`, `implicitRole`,
  `context` (Phase 1.3).
- **Result**: one type in `domain/src/actions/types.ts`, re-exported by the extension's
  `shared/protocol.ts` and `content/types.ts` instead of three copies. Its status union
  equals Core's, `succeeded | failed | timed_out | cancelled | unknown` (Core
  `packages/contracts/src/client-gateway.ts:100`). `validation` is `passed` or `failed`
  with `expected` and `actual`, or `none` with reason `evidence-only` or
  `not-yet-validated`. Optional `resolution`: strategy, candidate count, best and
  runner-up score, confidence. Optional `failure`: Core's structured failure record and
  categories, imported from Core (`core-failure-taxonomy` in the paired Core document) —
  no downstream category list.
- **Capabilities** on `ContentActionDependencies`, each in its own `content/action-runtime/`
  module: actionability, keyboard, checkable state, list extraction, file input, dialog
  control, assertion evaluation, wait conditions.
- **Stubs**: verbs `content/actions/{check,assert,extract-list,upload,dialog}.ts`;
  background `apps/extension/src/runtime/{browser-tab,browser-download}.ts`, routed from
  `action-runner.ts`.

## Serial first

### Brief: w2-foundation
- Repository: this repository
- Task: implement `## Wave 2 contract`, so twelve workers can then edit disjoint files.
  1. The types, contract-first in `domain/src/actions/types.ts` and re-exported by the
     extension, plus the seven actions' list entries and safety classes.
  2. `content/action-runtime/results.ts`: `success()` requires a validation; a failed one
     yields `failed` with `OUTPUT_NOT_OBSERVED`; wait timeouts yield `timed_out`. The
     eleven existing verbs pass `not-yet-validated` (capture_snapshot and extract:
     `evidence-only`).
  3. Each capability declared on `ContentActionDependencies` and wired in
     `content/action-runtime/execute-action.ts` to its own new module that throws "not
     implemented yet".
  4. The verb stubs registered in `content/actions/execute.ts`, returning a failed result;
     `runtime/action-runner.ts` routing tab and download to the background stubs.
- Required reads: the plan's Decisions D4–D6 and Phase 1.2; the files you own;
  `packages/test-contracts/src/scenario.ts` (extract step); `docs/architecture/web-capabilities.md`.
- Owns (may edit): `domain/src/actions/{types,safety}.ts`; `apps/extension/src/shared/protocol.ts`;
  `apps/extension/src/content/types.ts`; `apps/extension/src/content/actions/`;
  `results.ts`, `execute-action.ts`, and the new stub modules in `content/action-runtime/`;
  `apps/extension/src/runtime/action-runner.ts` and the two new stubs; tests for the result model.
- Must not touch: `domain/src/actions/schemas.ts`, `domain/src/output-nodes/`, `domain/src/io/`,
  everything else.
- Definition of done: domain `check` and `test`; extension `check`, `build`, `test`, and
  `test:content` pass (update the harness action specs only for the new `validation`
  field); `pnpm lab run basic-form --target isolated` passes; structure audit clean. The
  report lists every capability and stub with its signature — the Wave 2 briefs cite it.
- Report to: `reports/w2-foundation.md`

## Parallel after w2-foundation

Every brief below: read `reports/w2-foundation.md` for the capability and stub
signatures you implement; replace only your stub; add your T2 spec as a new file
in `apps/extension/e2e/content/tests/`; Definition of done also includes extension
`check`, `build`, `test`, `test:content` and a clean structure audit.

### Brief: w2-domain-vocabulary
- Task: domain registration for the seven new actions and the upgraded parameters
  w2-foundation typed. Changed after w2-foundation ran: the seven entries in
  `domain/src/actions/schemas.ts` already exist as minimum definitions. Listing an
  action type without a definition makes `createWebAutomationDomainIo` throw, since
  manifest outputs, output nodes, and registered domain outputs all derive from that
  one table, so the list and the schemas could not land in separate work units.
  Refine those seven definitions rather than create them, and keep the registry
  total intact. Everything else is unchanged: parameter schemas
  (`domain/src/actions/schemas.ts`), output nodes,
  payload mapping, and targets (`domain/src/output-nodes/{definitions,payloads,targets}.ts`;
  targets carry `testId`, `accessibleName`, `label`, matching Core's fingerprint
  normalizer), manifest outputs (`domain/src/io/manifest-definitions.ts`), client
  capabilities (`domain/src/actions/capabilities.ts`), and recorded checkbox/radio changes
  mapping to `web.dom.check` instead of `web.dom.type` (`domain/src/io/input-model.ts`).
  Also there: a keydown on a `<select>` whose only effect is the value change the
  recorder also reports is evidence, not a key press action, so a keyboard selection
  does not replay an extra key (found by w1-runner-asserts).
  Each new action derives its schema, node, and manifest output the same way as the
  existing eleven. T1 tests per new action and for the checkbox/radio mapping row.
- Owns (may edit): those files and new tests under their directories' `tests/`.
- Must not touch: `domain/src/actions/{types,safety}.ts`, `domain/src/runtime/`, `apps/`.
- Definition of done: domain `check` and `test` (label `w2-domain-vocabulary`); extension `check`.
- Report to: `reports/w2-domain-vocabulary.md`

### Brief: w2-domain-status
- Task: Phase 1.2 step 5. `domain/src/runtime/adapter.ts` stops flattening `timed_out` and
  `cancelled` to `failed` (the `ACTION_REJECTED` path stays);
  `domain/src/io/gateway-output-dispatcher.ts` and
  `domain/src/output-nodes/native-runtime.ts` promote the message from the payload when
  there is no `error`. T1 tests for each status and the message fallback.
- Owns (may edit): those three files and new tests beside them.
- Must not touch: other domain files, `apps/`.
- Definition of done: domain `check` and `test` (label `w2-domain-status`).
- Report to: `reports/w2-domain-status.md`

### Brief: w2-click
- Task: `content/actions/click.ts` and the actionability capability: visible (non-zero
  box, not hidden, not inert), enabled (no `disabled`/`aria-disabled`), scrolled into view
  before a centre hit-test (the point must land on the target or a descendant), then a
  pointer and mouse event sequence at that point instead of a bare `HTMLElement.click()`;
  a link click observes that navigation began. Gate failures are `ACTION_REJECTED` with a
  code (`disabled`, `hidden`, `covered`); the validation records the hit-test.
- T2 spec: `click.spec.ts` on `basic-form` and `failure-surfaces` (disabled, covered).
- Owns (may edit): `click.ts`, the actionability module, `scroll-element-into-view.ts`.
- Report to: `reports/w2-click.md`

### Brief: w2-keyboard-input
- Task: trusted-input emulation (decision D5) in `content/actions/{type,clear,keypress}.ts`,
  `content/action-runtime/{set-element-value,input-events}.ts`, and the keyboard
  capability: per-character `keydown`/`beforeinput`/`input`/`keyup`; `contenteditable`
  through `InputEvent`; value read-back as the validation; Enter on a form control calls
  `requestSubmit` with the form's default button (a real Enter reports it as submitter);
  Tab moves focus in tabbable order; modifiers. Radio-group arrow keys need trusted input:
  report them as unsupported rather than faking them.
- T2 spec: `keyboard.spec.ts` on `keyboard-forms` (W02 Enter submits; W03 combobox opens
  and filters per keystroke; Enter in the combobox does not submit) and `basic-form`.
- Owns (may edit): those files and the keyboard module.
- Report to: `reports/w2-keyboard-input.md`

### Brief: w2-select
- Task: `content/actions/select.ts`: select by value, label, or index; the option must
  exist, and the validation compares the selected value with the request (a missing
  option is `OUTPUT_NOT_OBSERVED` and changes nothing).
- T2 spec: `select.spec.ts` on `basic-form`, including a missing option.
- Owns (may edit): `select.ts`.
- Report to: `reports/w2-select.md`

### Brief: w2-scroll
- Task: `content/actions/scroll.ts`: modes `by` (delta), `toElement` (target into view),
  and `untilStable` (repeat until the document stops growing or `maxScrolls`); the
  validation records the position change or the target in view and, for `untilStable`,
  the scrolls performed.
- T2 spec: `scroll.spec.ts` on `infinite-feed` (all items; `end-early`) and `long-document`.
- Owns (may edit): `scroll.ts`.
- Report to: `reports/w2-scroll.md`

### Brief: w2-waits
- Task: `content/actions/{wait-for-selector,wait-for-text}.ts`,
  `content/action-runtime/waits.ts`, and the wait-conditions capability: visible, enabled,
  absent, url, stable; a timeout is `timed_out` with `TIMEOUT`.
- T2 spec: `waits.spec.ts` on `delayed-ui` (late target; `too-slow`) and `intermediate-state`.
- Owns (may edit): those files and the wait-conditions module.
- Report to: `reports/w2-waits.md`

### Brief: w2-check-assert
- Task: `content/actions/check.ts` with the checkable-state capability (set a checkbox or
  radio to the requested state; validation compares `checked`), and
  `content/actions/assert.ts` with the assertion capability (exists, absent, text, url,
  visible, enabled, with timeout; a failed assertion is `STATE_MISMATCH` with expected and
  actual).
- T2 spec: `check-assert.spec.ts` on `keyboard-forms` and `failure-surfaces`.
- Owns (may edit): those two verbs and their two capability modules.
- Report to: `reports/w2-check-assert.md`

### Brief: w2-extract-list
- Task: `content/actions/extract-list.ts` with the list-extraction capability: items by
  selector; fields by the scenario contract's selector forms, `@attribute`, and
  `column:<header>` resolved through the table header row; pagination by the `next`
  control up to `maxPages`, waiting for the list to change after each page; `maxItems`;
  the result's `extracted` is the record array, and the validation fails when a record
  lacks a declared field.
- T2 spec: `extract-list.spec.ts` on `product-catalog` (page 1, every page, `text-variant`)
  and `data-table` (`column-reorder`).
- Owns (may edit): `extract-list.ts` and the list-extraction module.
- Report to: `reports/w2-extract-list.md`

### Brief: w2-upload-dialog
- Task: `content/actions/upload.ts` with the file-input capability (`DataTransfer` files
  from the parameters, then `input` and `change`; the validation compares the file names)
  and `content/actions/dialog.ts` with the dialog-control capability, backed by a
  page-world override of `alert`, `confirm`, and `prompt` installed at `document_start`
  (a MAIN-world content script in all three manifests, built by
  `apps/extension/scripts/build-extension.mjs`); the dialog verb arms the next response.
  Add the `downloads` permission to all three manifests for w2-browser-actions. Extend the
  content harness to inject the page-world script.
- T2 spec: `upload-dialog.spec.ts` on `file-transfer` (W17) and `modal-flows` (native confirm).
- Owns (may edit): those two verbs and modules, the page-world script,
  `apps/extension/manifest.{chrome,firefox,e2e}.json`, `build-extension.mjs`, the harness
  modules in `apps/extension/e2e/content/` (not other workers' specs).
- Report to: `reports/w2-upload-dialog.md`

### Brief: w2-browser-actions
- Task: Phase 1.2 step 4 in `apps/extension/src/runtime/`: navigate reuses the automation
  tab by default with a `newTab` option and compares the landed URL
  (`NAVIGATION_UNEXPECTED` on mismatch); `browserFrameId` honoured; the unsupported-page
  guard applies to every action; `timed_out` and `cancelled` preserved on the wire
  (`result-mapping.ts`); `web.browser.tab` (open, switch, close) and
  `web.browser.download` (wait for completion through `chrome.downloads`; the permission
  arrives from w2-upload-dialog). Found by w1-extension-unit-tests: a `timed_out` or
  `cancelled` result reaches the gateway without an `error` although the panel shows it
  failed with one — carry the message; and `about:`, `view-source:`, `data:` pages and the
  extension-store hosts count as recordable — the unsupported-page guard excludes them.
  Unit tests for the pure parts.
  Also, found by w2-foundation on 2026-09-11:
  `gatewayActionResultFromBrowserResult` drops `result.failure`, so the structured
  failure records the content side now builds never reach the gateway. The
  rejection path already forwards it; make the browser-result path do the same and
  cover it with a test.
- Owns (may edit): `action-runner.ts`, `automation-tab.ts`, `result-mapping.ts`,
  `browser-tab.ts`, `browser-download.ts`, their unit tests.
- Report to: `reports/w2-browser-actions.md`

### Brief: w2-identity-capture
- Task: Phase 1.3 steps 1–2, capture side, in `content/describe-element.ts`,
  `content/element-traits.ts`, and new `content/identity/{accessible-name,implicit-role,label,context}.ts`:
  emit `testId`, `accessibleName`, and `label` matching Core's fingerprint normalizer
  (read it in `F:\!FluxIQ`, do not edit it); implicit ARIA role; accessible name from
  `aria-labelledby`, an associated `<label>`, `placeholder`, then text; nearby label; form
  context (form id, name, action; fieldset legend); ancestor summary (landmark, heading,
  list or table position); attribute allowlist gains `aria-labelledby`,
  `aria-describedby`, `for`, and value presence. Redaction is Phase 1.4, not yours.
- T2 spec: `identity.spec.ts` on `identity-drift` (every mode) and `ambiguous-targets`.
- Owns (may edit): those files.
- Report to: `reports/w2-identity-capture.md`

### Brief: w2-flow-lane
- Repository: this repository
- Task: Phase 1.6a step 4, a provider-free Flow lane on the `isolated` target behind
  `--flow` (with `--workflow` and `--variant`) on `pnpm lab run`.
  1. After the recording lane, reset the Scenario Lab (`/__control/reset`), so a run
     cannot pass on the recording's own effects.
  2. Turn the recording into a Flow only through Core's public API
     (`createRecordingFlowProposals`, then `reviewRecordingFlowProposal` to approve; see
     the proposal section of `reports/audit-recording.md`). If Core cannot do this
     provider-free, stop and report the Core gap (decision D11); never build or compile
     a Flow downstream.
  3. Arm the requested variant with `armScenarioVariant`
     (`packages/test-runner/src/lab-control/`), after the reset.
  4. Run the persisted Flow provider-free, as `existing-flow-run.ts` does, and assert the
     resolved workflow (`resolveScenarioWorkflow`): `expected.actions`, `finalState`,
     `extracted` — paginated extraction is proven only here — and `expected.failure`
     against the run's structured failure from Core's `failure` field, never by parsing
     a message.
  5. Fill the `RunEvaluation` fields in both lanes through hooks in `run-scenario.ts`:
     `lane`, `flowCreated`, the oracle verdict from the lane's own assertions (w1-bench
     had to infer it), the reported verdict, harness activations from Core's run detail,
     the automation failure reported and expected, and per-action durations.
  6. A fixture that needs a secret at replay (auth-gate W18) declares it, and the lane
     supplies it to the Flow run as a declared secret, never from the recording. Add the
     smallest declaration field to the scenario contract if it has none, and say so.
- Required reads: `reports/w1-runner-asserts.md`, `reports/w1-bench.md`;
  `packages/test-runner/src/{existing-flow-run,run-scenario}.ts` and `lab-control/`;
  `packages/test-contracts/src/scenario-workflow.ts`; Core's recording-proposal API in
  `F:\!FluxIQ` (read-only).
- Owns (may edit): new `packages/test-runner/src/flow-lane/`; the flag wiring in
  `commands.ts`, `cli.ts`, and `run-scenario.ts`; a declared-secret field in
  `packages/test-contracts/src/{scenario,validation}.ts`; new tests.
- Must not touch: `apps/`, `domain/`, Core.
- Definition of done: with `FLUXIQ_TEST_TARGET=isolated`, `pnpm lab run basic-form --flow
  --target isolated` generates and runs the Flow provider-free and passes;
  `identity-drift --flow --variant selector-only` reaches a verdict; `auth-gate --flow
  --variant expired` reports the structured failure; test-runner and test-contracts
  suites pass; structure audit clean.
- Report to: `reports/w2-flow-lane.md`
