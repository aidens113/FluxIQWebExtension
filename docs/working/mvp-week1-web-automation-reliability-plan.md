# MVP Week 1 — Web Automation Reliability Plan

Status: Active
Status detail: Audit complete and verified; executable plan written; Wave 1 (Phase 1.1 fixes, Phase 1.6a FluxBench foundation, decomposition) is next to dispatch.
Created: 2026-09-11
Last updated: 2026-09-11
Owner: Senior supervisor agent
Scope: Week 1 of the 30-day MVP (Phases 1.1–1.6): browser action vocabulary, element identity, browser state/evidence, failure taxonomy, and FluxBench, with automated verification through the Testing Lab as the primary proof for every phase. Weeks 2–4 are out of scope except where Week 1 must leave a seam for them.
Paired document: `F:\!FluxIQ\docs\working\mvp-week1-web-automation-reliability-plan.md` — to be created at Wave 3 dispatch, before the first Core edit; Core owns the failure-taxonomy contracts (C1, C2) and the expectation-evaluator seam (C3)
Related: [30-Day MVP plan](../../FluxIQ%20Web%20Extension%20%E2%80%94%2030-Day%20MVP%20Implementation%20Plan.md), [MVP agent instructions](../../MVP_AGENT_INSTRUCTIONS.md), [testing facility](../architecture/testing-facility.md), [extension client](../architecture/extension-client.md), [automated-testing-facility-plan](./automated-testing-facility-plan.md), [llm-production-automation-plan](./llm-production-automation-plan.md), audit reports under [reports/](./mvp-week1-web-automation-reliability-plan/reports/)

---

## Current State

**Phase: planned, not started.** Seven read-only audits of both repositories
ran on 2026-09-11; the supervisor verified every load-bearing claim against
source before recording it (see [Audit Summary](#audit-summary) and the full
reports). The plan below is executable: each phase names its steps, file
ownership, the automated proof, and the exit commands.

**Headline numbers from the audit**

- Action vocabulary vs the plan's 24 capabilities: 1 fully supported, 10
  partial, 3 unreliable, 10 unsupported. **Outcome validation: 0/24** —
  `succeeded` means only "nothing threw".
- Element identity: Core's weighted matcher is wired but never receives
  candidates; three of its four top-weighted signals are zero for web
  targets because of field-name mismatches; resolution is first-match with
  no ambiguity detection.
- Evidence: 8/16 items present, 5 partial, 3 absent; two divergent pipelines
  from one producer; **no expected-vs-actual state comparison exists in
  either repository**; sensitive input values are captured by default.
- Failures: no taxonomy on the browser-action path; Core classifies by regex
  over English messages; the failure-moment snapshot is discarded before the
  run record; 5 of 11 categories have no producer.
- Testing Lab: 12 fixtures cover 4 of 18 FluxBench categories; the isolated
  lane asserts one expectation set, has no metrics, no repeat aggregation,
  and cannot run a Flow.

**Done**

- Working document, index row, audit briefs (archived), seven reports.
- Decisions D1–D10 recorded; D9, D10, and the 28-workflow corpus were
  confirmed by the user on 2026-09-11. Phase plan, proof method, corpus,
  and sequencing written.

**Not done**

- All implementation. No worker has edited source.
- Paired Core document (created at Wave 3 dispatch, before the first Core
  edit).

**Next steps**

1. Dispatch Wave 1 (see [Sequencing](#sequencing)): decomposition of the two
   content-script hot spots, Phase 1.1 fixes, Phase 1.6a harness/runner/bench
   contracts, and the ten new fixtures.
2. Verify, ledger, push `dev`.
3. Dispatch Wave 2.

**Blockers:** none. Per `AGENTS.md`, the user is alerted before the first
Core edit (Wave 3: Phase 1.4 step 7 and Phase 1.5 step 2 form one Core
work unit).

---

## Objective

Week 1 produces a reliable browser-automation foundation: FluxIQ executes
real workflows, understands browser state, identifies failures precisely,
and hands the runtime harness high-quality evidence. Visual polish is
secondary.

Week 1 exit criteria, verbatim from the plan, each paired with its proof:

| Exit criterion | Proof (automated, provider-free) |
| --- | --- |
| Core browser actions are reliable | Content-script harness suite green; corpus workflows W01–W19 pass 3/3 replays |
| Browser evidence is useful | Evidence fixture assertions (16 items) green; sanitized packet ≤ budget with `truncated` visible; `sensitive-input` leak assertion green |
| Target matching has deterministic fallback | Drift workflows W20–W23 recover without harness; W26 resolves ambiguity by context |
| Failures are meaningfully classified | Negative workflows (W14, W19, W27 variants) report the manifest's expected category ≥ 90% |
| FluxBench exists and produces repeatable measurements | `pnpm lab bench --corpus week1 --repeat 3` emits a report with every metric in [Metrics](#metrics); two consecutive runs agree within tolerance |
| Major reliability blockers identified | The blocker list in the Phase 1.6b ledger entry, ranked by corpus impact |

The plan's own rule, adopted here: a phase is not closed on unit tests or
compilation alone — every exit criterion above is proven by an automated
Testing Lab run.

## Decisions

Each decision resolves a question an audit raised. Reversing one is a
ledger entry, not a silent edit.

- **D1 — Level 2 target scoring runs in the page.** The content script
  enumerates live-DOM candidates and scores them with Core's
  `createAutomationStudioElementMatcher`, which is public via
  `fluxiq/automation-studio`, has type-only imports, and bundles under the
  existing esbuild `platform: "browser"` build. Live signals (computed
  visibility, enabled, occlusion) and no per-action round trip outweigh the
  cost of bundling one Core module. The extension returns structured
  resolution diagnostics (strategy, candidate count, best and runner-up
  score, confidence) in every action result. Fallback if the bundle fails a
  browser-safety check: the content script returns candidates and Core's
  existing `prepareElementTargetAction` scores them.
- **D2 — Phase 1.4 improves the shared producer, and the sanitized packet
  is the behavioural target.** New evidence lands once in
  `describeElement`/`captureSnapshot` (`DomSnapshot`); the state pipeline
  inherits it; `sanitizeWebLlmSnapshot` exposes it to the harness;
  deterministic checks (Phase 1.2 assertions, Phase 1.5 failure evidence)
  read the `DomSnapshot` directly. No third pipeline.
- **D3 — Failure taxonomy: Core owns names and carriers; the domain
  produces.** Extend `AutomationStudioAdaptiveFailureClass` (no third enum);
  add a structured `failure` field to `ClientGatewayActionResult`,
  `FluxIQRuntimeCommandResult`, and the run attempt record; the classifier
  reads it, regex kept only as legacy fallback; the LLM packet carries it.
  Modelled on Core's flow-bootstrap taxonomy (closed codes, one stage per
  code, exact-field parser). Requires the paired Core document and a user
  alert before the first Core edit.
- **D4 — Outcome validation is per action, in the content script.** Every
  action gains a post-condition (type: value read-back; select:
  `selectedValue` equals request; click: target was visible, enabled, and
  hit-tested at its centre; navigate: committed URL compared to request;
  waits: the condition). A miss is `OUTPUT_NOT_OBSERVED` with expected and
  actual. Authored expectations use a new `web.dom.assert` action.
- **D5 — Trusted-input emulation, not `chrome.debugger`.** Enter on a form
  control calls `form.requestSubmit()`; Tab moves focus along the tabbable
  order; typing dispatches per-character `keydown`/`beforeinput`/`input`/
  `keyup` so autocomplete widgets react. CDP-trusted input via the
  `debugger` permission is deferred (banner, permission review) unless the
  corpus proves emulation insufficient.
- **D6 — Vocabulary grows only where FluxBench needs it.** Added:
  `web.dom.check` (set checkbox/radio state), `web.dom.extract_list`
  (repeating structures with a field map and bounded pagination),
  `web.dom.assert` (exists/absent/text/url/visible/enabled with timeout),
  `web.browser.tab` (open/switch/close), `web.dom.upload`
  (`DataTransfer`), `web.dom.dialog` (page-world override of
  `alert`/`confirm`/`prompt` installed at `document_start`), and
  `web.browser.download` (wait on `chrome.downloads`). Scroll gains modes
  (`by`, `toElement`, `untilStable` with `maxScrolls`). Navigate reuses the
  automation tab by default with an explicit `newTab` option.
- **D7 — Content-script tests run in headless Playwright against the
  Scenario Lab**, with the built content bundle injected and
  `chrome.runtime` stubbed — `apps/extension/e2e/content/*.spec.ts`. jsdom
  cannot emulate `elementFromPoint`, layout, or `isTrusted`; the Lab already
  runs headless in-process. Pure functions use `node --test` in `tests/`
  folders per the repository rule.
- **D8 — FluxBench is a layer on the Testing Lab, not a new framework.**
  New fixtures for the nine uncovered categories; a `bench` verb that runs a
  corpus N times on the `isolated` target with a provider-free Flow lane;
  a `RunEvaluation` per run and a corpus report with the plan's metrics;
  `compare` that can say `improved`/`regressed`. The Flow lane follows the
  product path — Playwright drives the recording script while the extension
  records, Core generates the deterministic Subflow from the recording via
  its public API, the run executes provider-free — with a manifest→Flow
  compiler as fallback if the API path proves unstable.
- **D9 — Week 1 takes the Core minor bump for the new comparison-status
  members** (`target_not_found`, `target_ambiguous` on
  `AutomationStudioTransitionComparisonStatus`), in the same Core work unit
  as the adaptive-failure enum extension of D3, with one migration note
  covering both. Confirmed by the user 2026-09-11. Downstream
  comparison-status mappings added in Phase 1.5 handle the new members.
- **D10 — The Core expectation-evaluator seam (C3) is built in Week 1,
  with Phase 1.4.** A `bindExpectationEvaluator` option on the Automation
  Studio service, mirroring `bindHostRuntime`, that Core calls from
  `builtin.policy.expectation` and from `compareAutomationStudioTransition`
  so `expectedState` is evaluated rather than counted. It lands with the
  evidence work so a scenario that starts failing has evidence explaining
  why. Confirmed by the user 2026-09-11.

## How Week 1 Is Proven

Three tiers, all provider-free, all runnable by a worker:

| Tier | What | Where | Runs |
| --- | --- | --- | --- |
| T1 unit | Pure functions: mappings, sanitizers, classifiers, scoring glue | `<dir>/tests/*.test.ts`, `node --test` (domain via `scripts/test-domain.mjs`) | seconds, headless |
| T2 content harness | Real DOM semantics without extension or Core: resolver, actions, evidence capture, redaction | `apps/extension/e2e/content/*.spec.ts` (new); Scenario Lab in-process; built `content/index.js` injected; `chrome.runtime` stub | ~1 min, headless |
| T3 Lab lanes | Extension + Core + gateway: `lab run --target isolated` (Playwright-scripted recording, Core round trip, Flow lane) and `lab bench --corpus week1` | `packages/test-runner`; Windows headed today, Xvfb in CI | minutes; corpus ×3 ≈ 45 min |

Rules:

- Every phase names the T2 spec and T3 workflow that proves its exit
  criterion; closing a phase quotes the observed output in the ledger.
- Gates at each phase close: `pnpm check` (includes `structure:check`),
  `pnpm test`, `pnpm build`, then `pnpm lab bench --corpus week1 --repeat 1`
  from Phase 1.2 onward, `--repeat 3` at 1.6b.
- No ordinary test or bench run makes a provider call; the bench records
  `llm: disabled` and Week 2 metric fields as `null`.
- Live headed validation with the persistent-isolated demo is a
  confirmation at 1.6b, never the only evidence.
- Worker completion reports are claims; the supervisor re-runs the named
  command before the ledger entry.

## Phase Plan

Phase order differs from the 30-day plan in one respect: the FluxBench
foundation (1.6a) runs **first**, in parallel with 1.1, because every later
phase is proven with it. The corpus run (1.6b) closes the week.

### Phase 1.1 — Consolidate the web domain

Objective: turn the audit into a capability matrix and remove the defects
that would otherwise be re-hit by every later phase.

Steps (each is one worker unless noted; ownership in parentheses):

1. **Decompose the two content-script hot spots** before anything parallel
   touches them, per the structure rule "a shared filename prefix becomes
   a directory": `apps/extension/src/content/actions.ts` →
   `content/actions/<verb>.ts` + barrel + `execute.ts` dispatcher;
   `apps/extension/src/content/action-runtime.ts` →
   `content/action-runtime/{resolve-target,waits,results,input-events,
   extract}.ts` + barrel. Behaviour-preserving; `pnpm --filter
   @fluxiq-web-extension/extension check` and `build` unchanged. Serial —
   everything in Wave 2 depends on it. (owns both files and their new dirs)
2. **Mapping fixes** (`domain/src/io/input-model.ts`,
   `domain/src/io/gateway-input-hub.ts`, `domain/src/web-panel-host.ts`,
   `domain/src/client/gateway-mapping.ts`): `dom.scroll` keyed correctly;
   hub accepts top-level `domainId` like Core's bridge (both copies);
   `normalizeWebAutomationActionType` rejects unknown types with
   `ACTION_REJECTED`; `web-panel-host.ts` imports `GatewayInputHub` and the
   dispatcher from `io/` instead of duplicating them; one input→output
   mapper shared by the live path and the proposal mapper, and the proposal
   mapper carries the element fingerprint. T1 tests for every row of the
   19-event mapping table.
3. **Recorder hygiene** (`apps/extension/src/content/dom-events.ts`,
   `background/connection/runtime-status.ts`): `isTrusted` guard on `input`
   and `change`; runtime confirmations for `type`/`select` carry the value.
4. **Registry agreement and dead code** (`domain/src/io/manifest-definitions.ts`,
   `domain/src/output-nodes/definitions.ts`, `domain/src/actions/types.ts`,
   `domain/src/runtime/commands.ts`, `domain/src/client/index.ts`,
   `apps/extension/src/runtime/state-reader.ts`,
   `apps/extension/src/shared/constants.ts`, `browser.ts`,
   `apps/extension/src/content/types.ts`): one safety registry (waits and
   `capture_snapshot` are safe and unprivileged, so bench runs never prompt);
   remove the seven dead exports and the legacy dotted alias matching in
   the content script (aliases normalized once, in `gateway-mapping`);
   content-script types import the shared protocol types instead of a
   looser copy; `domain/src/runtime/llm-evidence.ts` imports Core's
   `AutomationStudioRuntimeTargetOverrideEvidenceValidation`/`FailedAction`
   instead of structural copies, and its duck-typed `bindLlmEvidenceRuntime`
   shim is removed (the method is public). Further dead exports from
   `audit-core-runtime`: `runWebAutomationFlow`,
   `webAutomationRuntimeTracePayload`. `web-panel-host.ts:2` imports
   `AutomationStudioNativeNodeRuntime` from `fluxiq/automation-studio` (it
   is publicly exported) if Node 22 `require(esm)` resolves it from the CJS
   host; otherwise the deep import stays with a comment naming the reason.
   Run `pnpm structure:baseline` after removals.
5. **Capability matrix and architecture doc** (supervisor):
   `docs/architecture/web-capabilities.md` from the `audit-actions` matrix,
   updated at each phase close; `extension-client.md` corrected (no
   focus/blur events, no `client.recording_entry`, sensitivity claim).

Proof: T1 for steps 2–4; T2 smoke (`content/actions.spec.ts` executes each
existing action once on `basic-form`) proves the decomposition preserved
behaviour; `lab run basic-form --target isolated` passes.

Exit checks: `pnpm check`, `pnpm test`, `pnpm build` green;
`pnpm structure:check` zero new findings; `grep -rn '"dom\.' apps/extension/src/content/actions` empty.

Core: none.

### Phase 1.6a — FluxBench foundation

Objective: make the Testing Lab able to prove the rest of the week and to
measure the corpus.

Steps:

1. **Content-script harness** (`apps/extension/e2e/content/harness.ts`,
   `playwright.content.config.ts`, `package.json` script `test:content`):
   starts the Scenario Lab in-process, opens a fixture, injects the built
   `content/index.js` with a `chrome.runtime` stub that captures outgoing
   messages, and exposes `runAction(command)` and `capture()` to specs.
   First spec: `resolve-target.spec.ts` covering the four strategies on
   `ambiguous-targets` and `long-document`.
2. **Runner asserts what manifests declare**
   (`packages/test-runner/src/run-scenario.ts`, `scenario-assertions.ts`):
   `pageFacts`, `recordingEvents` (type and count), `expected.actions` on
   every lane, `allowedConsoleErrors`, `playbackGoal.successFacts`, and
   per-scenario `evidencePolicy`; `selector()` understands `role:` and
   `frame:` (Playwright `getByRole`, `frameLocator`); the cross-origin
   iframe port is allowlisted (`network-guard.ts`); failure category
   persisted into `run.json`.
3. **Manifest contract extension** (`packages/test-contracts/src/scenario.ts`,
   `evaluation.ts`, `run.ts` + validation files): `variants?: [{id, arm:
   {operation, payload}, expected}]` for drift/negative modes;
   `expected.failure?: {category, code?}`; `metrics` schema; `RunEvaluation`
   gains the [Metrics](#metrics) fields; `BenchReport` type.
4. **Provider-free Flow lane on `isolated`** (`packages/test-runner/src/
   flow-lane/{record,generate,run}.ts`, wired from `run-scenario.ts` behind
   `--flow`): after the scripted recording, call Core's public recording→
   proposal→approve API (`createRecordingFlowProposals`,
   `reviewRecordingFlowProposal` per `audit-recording`), then
   `startPersistedFlow`/`runPersistedFlow` as `existing-flow-run.ts` already
   does, assert `expected.actions` and the final-state oracle. If a
   variant is armed, arm it between recording and run. Fallback compiler
   `manifest-flow-compiler.ts` only if the API path is unstable.
5. **`bench` verb and metrics** (`packages/test-runner/src/bench/{cli,
   corpus,evaluate,report}.ts`, `commands.ts`, `cli.ts`): `pnpm lab bench
   --corpus week1 --repeat N [--target isolated]` runs every workflow and
   variant, writes one `RunEvaluation` per run and `report.json`/`report.md`
   under `test-runs/bench/<id>/`, aggregates per-workflow pass rate, flake
   classification, and corpus metrics; `compare` reports
   `improved`/`regressed` per metric with tolerances. Timing per action from
   the run's action records.
6. **Catalog parity** (`packages/test-matrix/src/selector.ts` generated from
   the Scenario Lab registry at build, with a test that fails on drift);
   `docs/architecture/testing-facility.md` fixture count corrected.
7. **Ten new fixtures**, one worker each, under
   `apps/scenario-lab/src/scenarios/<id>/` plus the seven-file edit list
   from the `audit-testing-facility` report: `product-catalog`,
   `data-table`, `infinite-feed`, `modal-flows`, `multi-tab`,
   `file-transfer`, `auth-gate`, `identity-drift`, `intermediate-state`,
   `keyboard-forms`. Each ships its `tests/scenario.test.ts`, a page spec,
   and its manifest with variants and expected failure categories per the
   [corpus](#fluxbench-week-1-corpus). Registry and `types.ts` edits are
   serialized by the supervisor after the fixture workers return.

Proof: `pnpm --filter @fluxiq-web-extension/scenario-lab test` green with 22
fixtures; `pnpm --filter @fluxiq-web-extension/extension test:content`
green; `pnpm lab run basic-form --flow --target isolated` executes the
generated Flow provider-free and passes; `pnpm lab bench --corpus smoke
--repeat 2` produces a report whose two runs agree.

Exit checks: the commands above with observed output in the ledger;
`pnpm test` green for `test-contracts`, `test-runner`, `test-matrix`,
`test-evidence`.

Core: none expected. If the proposal API needs an additive export, it is a
one-line Core change recorded in the paired document.

### Phase 1.2 — Action vocabulary and outcome validation

Objective: every capability in the plan's list can be represented,
executed, observed, and validated; no action can complete as a silent no-op.

Steps (parallel by action file after Phase 1.1 step 1):

1. **Result and validation model** (`content/action-runtime/results.ts`,
   `apps/extension/src/shared/protocol.ts`, `domain/src/actions/types.ts`):
   `BrowserActionResult` gains `validation: {expected, actual, passed}`,
   `resolution` diagnostics (from 1.3), `failure?` (structured, shape agreed
   with 1.5), and emits `timed_out` on wait timeouts. `success()` requires a
   passed validation or an explicit `validation: none` for evidence verbs.
   The three field-identical downstream result types
   (`domain/src/actions/types.ts`, `content/types.ts`, `shared/protocol.ts`)
   collapse to one, and its status union matches Core's runtime union
   (adds `rejected`, `unknown`).
2. **Per-action post-conditions and trusted-input emulation** (one worker
   per file in `content/actions/`): click (actionability gate: visible,
   enabled, centre hit-test, scroll-into-view before resolve; `href`
   navigation observed), type/clear (per-character key sequence,
   `contenteditable` via `execCommand`/`InputEvent`, value read-back),
   select (by value, label, or index; option existence), keypress (Enter →
   `requestSubmit`, Tab → focus traversal, modifiers), scroll (modes),
   waits (visible/enabled/absent/url/stable; `timed_out`).
3. **New actions** (new files in `content/actions/`, schema and node
   definitions in `domain/src/actions/schemas.ts`,
   `domain/src/output-nodes/definitions.ts`, `payloads.ts`, manifest
   definitions, `input-model.ts` for `check`): `web.dom.check`,
   `web.dom.assert`, `web.dom.extract_list` (field map, `paginate`,
   `maxItems`), `web.dom.upload`, `web.dom.dialog`, `web.browser.tab`,
   `web.browser.download` (`downloads` permission added to all three
   manifests; Firefox parity noted). Each action's schema, node, and
   dispatcher are generated by the same mechanism as the existing eleven.
4. **Runner-side fixes** (`apps/extension/src/runtime/action-runner.ts`,
   `automation-tab.ts`, `result-mapping.ts`): tab reuse by default,
   `newTab` option, landed-URL comparison, `browserFrameId` honoured,
   unsupported-page guard applied to every action, `timed_out`/`cancelled`
   preserved on the wire.
5. **Domain status fidelity** (`domain/src/runtime/adapter.ts`,
   `domain/src/io/gateway-output-dispatcher.ts`,
   `domain/src/output-nodes/native-runtime.ts`): no flattening of
   `timed_out`/`cancelled`; message promoted from payload when no `error`.
   No node-implementation change is needed for routing: Core's
   `dispatchPolicyOutput` returns `status: "failed", route: "failed"` on a
   non-ok dispatch and `dispatchAutomationStudioEffects` flips the node
   (`node-execution.ts:119`) — verified. What is lost today is the *status
   and message*, which Phase 1.5's Core seam C1 carries.
6. Update `docs/architecture/web-capabilities.md` and `extension-client.md`
   action surface.

Proof: T2 `content/actions/*.spec.ts` — one spec per action asserting the
post-condition passes on the happy path and fails with `OUTPUT_NOT_OBSERVED`
on the planted no-op (disabled button, missing option, unmatched value);
`keyboard-forms` Enter/Tab/combobox; `file-transfer` upload/download;
`multi-tab`; `modal-flows` native dialog. T3: corpus W01–W19 pass with
`--flow`.

Exit checks: `pnpm lab bench --corpus week1 --repeat 1` → all positive
workflows pass; matrix in `web-capabilities.md` shows represent/execute/
observe/validate 24/24 with any residual "partial" justified.

Core: possibly the dispatch-failure re-route (see 1.5).

### Phase 1.3 — Element identity

Objective: superficial DOM changes do not break workflows; ambiguity is
detected, not guessed; the harness is invoked only when Levels 1 and 2 fail.

Steps:

1. **Field-name bridge** (`apps/extension/src/content/describe-element.ts`,
   `domain/src/output-nodes/targets.ts`, `domain/src/actions/schemas.ts`):
   emit `testId`, `accessibleName`, `label` as first-class descriptor
   fields matching Core's `normalizeFingerprint`; carry `role`, `href`,
   `text`, `value`, `inputType` through to the extension's
   `ElementFingerprint` type and read them in resolution.
2. **Richer identity evidence** (`describe-element.ts`, `element-traits.ts`,
   new `content/identity/{accessible-name,implicit-role,label,context}.ts`):
   implicit ARIA role; accessible-name computation
   (`aria-labelledby`, associated `<label>`, `placeholder`, text fallback);
   nearby label; form context (`form` id/name/action, fieldset legend);
   ancestor summary (landmark, heading, list/table position); attribute
   allowlist extended (`aria-labelledby`, `aria-describedby`, `for`, `value`
   presence). Added on fingerprint and candidate sides together (Core
   penalizes declared-but-missing signals).
3. **Level 1 + Level 2 resolver** (`content/action-runtime/resolve-target.ts`,
   new `content/identity/{candidates,score}.ts`): exact strategies gate on
   visibility/enabled/tag agreement and count matches; on zero or multiple
   exact matches, enumerate candidates (same tag/role family within the
   frame, capped) and score with Core's matcher; return the best candidate
   when its score clears the floor and beats the runner-up by a margin,
   else fail `TARGET_AMBIGUOUS` (with the top candidates) or
   `TARGET_NOT_FOUND` (with attempted strategies). Confidence is the
   measured score. `wait_for_selector` uses the same resolver. Visual point
   prefers scroll-corrected `documentBounds`.
4. **Frame-scoped targets** (`domain/src/client/gateway-mapping.ts`,
   `domain/src/output-nodes/payloads.ts`, `apps/extension/src/runtime/
   action-runner.ts`, `content/message-handler.ts`): `browserFrameId`
   recorded from `sourceId` at capture, carried in the target payload,
   mapped to `action.frameId`; child frames accept addressed commands.
   Shadow DOM stays out of scope (recorded but not replayable; noted as a
   post-MVP item).
5. **Fingerprint survives adaptation** (`gateway-mapping.ts:112-128` reads
   `target.element`/`target.fingerprint`), and web output nodes declare
   `metadata.elementTarget: true` and `safety.level` so Core's floor
   applies (`domain/src/output-nodes/definitions.ts`).
6. **State identity for repeating structures**
   (`domain/src/recording/web-state.ts` `elementStateId`,
   `filterStateElements`): disambiguate shared `data-testid`/`id` with a
   positional suffix instead of collapsing; `elements.count` reports
   pre-filter total and a `truncated` flag.

Proof: T2 `content/identity/*.spec.ts` on `identity-drift` — each of its
modes (`selector-only`, `text-only`, `moved`, `wrapped`, `aria-variant`)
resolves to the intended control with confidence above the floor;
`ambiguous-targets` returns `TARGET_AMBIGUOUS` without context and resolves
with form/label context; `iframe-checkout` cross-frame click succeeds. T3:
W20–W23 replay after arming drift passes without harness; W26, W28 pass.

Exit checks: bench fuzzy recovery rate on drift variants ≥ 80% (target;
recorded as measured); `TARGET_AMBIGUOUS` produced on W26's ambiguous
variant.

Core: none — the matcher is consumed as a public export. If a signal needs a
new fingerprint weight, it is an additive Core change in the paired
document.

### Phase 1.4 — Browser state and evidence

Objective: the harness can form an accurate picture of the browser from
compact evidence; deterministic code can compare expected and observed
state; nothing sensitive leaks.

Steps:

1. **Sensitive-value redaction at capture** (`content/describe-element.ts`
   `readElementValue`, `content/dom-events.ts`, `capture-settings.ts`):
   sensitive controls never yield a value on any path; `inputValues`
   default documented; header comment made true. Proof first — this is a
   security fix.
2. **Absent evidence items** (new `content/evidence/{dialogs,overlays,
   loading,regions,repeating}.ts`, wired into `dom-snapshot.ts`):
   dialogs/modals (`<dialog>`, `role=dialog`, `aria-modal`, and the
   `web.dom.dialog` pending-native-dialog flag); blocking overlays
   (occlusion hit-test of interactive candidates, top-most blocker
   reported); loading state (`readyState`, `aria-busy`, spinner
   heuristics, pending navigation); landmarks/regions; repeating-structure
   detection (sibling-similarity clustering with an item count and a
   representative item).
3. **Partial items** (`dom-snapshot.ts`, `content/types.ts`, `runtime/
   result-mapping.ts`, `domain/src/recording/web-state.ts`): forms model
   (controls grouped by form); `recentlyInteracted` and `changed` flags as
   fields (runtime diff against the previous snapshot, not recording-only);
   navigation state in the snapshot; `truncated` and pre-filter totals.
4. **Sanitized packet parity** (`domain/src/runtime/llm-evidence.ts` — split
   per the 400-line advisory into `llm-evidence/{sanitize,elements,
   location,limits}.ts`): expose the new items compactly; default byte
   budget aligned with Core's 3,000-byte failure-evidence gate for the
   failure path and 6,000 for exploration, both under the 12,000 ceiling;
   frame coverage matches the state pipeline; `selectedText`/focus carried.
5. **Expected-state evidence** (`domain/src/output-nodes/definitions.ts`,
   `payloads.ts`, `domain/src/recording/domain.ts`): `web.dom.assert`
   conditions are written into `parameterValues.expectedState` so Core's
   transition comparison has something to count; declared-but-unproduced
   `elements.*.<field>` paths either produced or removed (decision: remove,
   since the JSON blob is what consumers read).
6. **Bind the host-runtime boundary** (new `domain/src/runtime/host-runtime.ts`,
   wired beside `bindRuntimeService`): Core's
   `AutomationStudioHostRuntimeBoundary` (`runtime/host-runtime.ts`) has
   capture points `before_action`, `after_action`, `after_wait_retry`,
   `after_patch_test` that populate `attempt.stateRefs` and enable
   `inspectStateDiff`; nothing downstream binds it, so no web attempt
   carries state refs. Binding it through `web.dom.capture_snapshot` →
   `StateSnapshot` gives "previous state" and "changed elements" a Core-side
   home and is the Week 2 `stateDiffs` input. Bounded by the same byte
   budget as the sanitized packet.
7. **Core seam C3 — expectation evaluator** (Core worker, after the
   paired document and user alert; files: `programs/automation-studio/
   nodes/policy/expectation.ts`, `runtime/executor/contracts.ts`,
   `runtime/executor/transition-comparison.ts`, `runtime/service.ts`
   (`bindExpectationEvaluator`, beside `bindHostRuntime`)): an optional
   `expectationEvaluator?(conditions, mode, timeoutMs, context)` that
   `builtin.policy.expectation` awaits and that
   `compareAutomationStudioTransition` uses to evaluate `expectedState`
   against the host's current snapshot instead of counting keys; unbound
   hosts keep today's behaviour. Downstream binds it in
   `domain/src/runtime/expectation-evaluator.ts` over the same
   `web.dom.assert` condition vocabulary. Tests in Core's `tests/` folders.

Proof: T2 `content/evidence/*.spec.ts` — a 16-row table test on
`modal-flows`, `infinite-feed`, `product-catalog`, `intermediate-state`
asserting each item; `sensitive-input` spec asserts no password value in
any captured message; byte-budget spec asserts `truncated` and element
count. T3: `lab run sensitive-input --target isolated` with a new
`security.redaction` assertion over persisted recording events.

Exit checks: evidence table 16/16 present; redaction assertion green in T2
and T3; `pnpm structure:check` shows `llm-evidence.ts` and `web-state.ts`
under threshold; a Core test proves an expectation node routes `failed`
when a bound evaluator rejects, and a Lab scenario proves
`web.dom.assert` conditions evaluated through the seam fail W24's
`unannounced` variant.

Core: yes — seam C3 (D10), in the same Core work unit as Phase 1.5.

### Phase 1.5 — Explicit failure taxonomy

Objective: every stopped execution carries a structured, stable category
and the context the harness needs, from the moment of failure.

Steps:

1. **Paired Core document and user alert** (supervisor): create
   `F:\!FluxIQ\docs\working\mvp-week1-web-automation-reliability-plan.md`
   owning contracts C1–C3; done at Wave 3 dispatch, since Phase 1.4 step 7
   is the first Core edit; alert the user that the task crosses into Core
   (`packages/contracts`, `packages/fluxiq` runtime and Automation Studio
   model), why, and the compatibility impact (additive fields, legacy
   regex fallback retained).
2. **Core seam C1 + C2** (Core worker; files: `packages/contracts/src/
   client-gateway.ts`, `packages/fluxiq/src/io/index.ts`
   (`OutputDispatchResult.status?`), `packages/fluxiq/src/runtime/
   contracts.ts`, `programs/automation-studio/nodes/contracts.ts`
   (`AutomationNodeExecutionResult.message?`/`failure?`),
   `runtime/io-policy.ts` (propagate status, message, and the existing
   `elementTargetResolution` diagnostics), `runtime/executor/attempt-trace.ts`
   (carry `message`, `failure`, `targetResolution`),
   `runtime/executor/contracts.ts` (`targetResolution?` beside `stateRefs`),
   `runtime/executor/transition-comparison.ts` and
   `runtime/adaptive-orchestrator.ts` (prefer the structured field; regex
   only as legacy fallback), `model/flow-adaptation.ts` (attempt record
   `failure?` and bounded `failureEvidence` reference),
   `runtime/service/summaries/conversions.ts`,
   `runtime/llm/harness/context-packet.ts` (category and retry history in
   the packet)): extend `AutomationStudioAdaptiveFailureClass` with
   `target_not_found`, `target_ambiguous`, `navigation_unexpected`,
   `output_not_observed`, `page_changed`, `auth_required`,
   `user_intervention_required`, and `AutomationStudioTransitionComparisonStatus`
   with `target_not_found`/`target_ambiguous` (a Core minor bump with a
   migration note, accepted by the user on 2026-09-11 — D9); add `failure?: {category, code,
   retryable, stage?, expected?, actual?, evidenceDigest?}` to every
   carrier. This also fixes the verified defect that a timed-out browser
   action can never classify as `timeout` (`transition-comparison.ts:64-65`
   matches text in `route`/`message`, and neither is ever set), which
   today sends the recovery ladder to the wrong candidate kind. Every
   addition is optional; a host that sets none keeps today's behaviour.
   Tests in Core's `tests/` folders; Core `pnpm check`/`test`/`build`.
3. **Downstream producers** (`content/action-runtime/results.ts`,
   `content/action-runtime/resolve-target.ts`, `apps/extension/src/runtime/
   action-runner.ts`, `domain/src/runtime/adapter.ts`, new
   `domain/src/runtime/failure/{codes,classify}.ts` using
   `WebAutomationRuntimeError`): every browser failure carries the
   structured field — `TARGET_NOT_FOUND`/`TARGET_AMBIGUOUS` from the
   resolver, `OUTPUT_NOT_OBSERVED`/`STATE_MISMATCH` from validation with
   expected/actual, `NAVIGATION_UNEXPECTED` (landed URL, redirect,
   error page), `PAGE_CHANGED` (document identity changed between dispatch
   and execution), `TIMEOUT`, `ACTION_REJECTED` (one shape), `AUTH_REQUIRED`
   (login-form-after-redirect heuristic, `auth-gate`),
   `USER_INTERVENTION_REQUIRED` (captcha markers, pending native dialog),
   `UNKNOWN`. Codes are a closed set in `codes.ts`; the test-runner's
   allowlist derives from it.
4. **Failure-moment evidence** (`content/action-runtime/results.ts`,
   `domain/src/client/gateway-mapping.ts`, `domain/src/runtime/llm-evidence/`):
   a failed result attaches a sanitized `web-llm-evidence.v1` packet
   captured at the instant of failure (bounded to Core's gate); the URL
   and target diagnostics ride with it; diagnosis-time re-capture becomes a
   supplement.
5. **Test-runner alignment** (`packages/test-runner/src/demo-llm-create-ui.ts`
   allowlist, `failure.ts` dead list, `evaluation.ts` categories): allowlist
   generated from domain codes; `runnerFailureCategories` removed.

Proof: T2 `content/failures.spec.ts` on `failure-surfaces`, `auth-gate`,
`intermediate-state`, `navigation` planting each category and asserting the
structured field; T1 for `classify.ts` and the Core classifier. T3: negative
workflows W14, W19, W27 and every armed variant report the manifest's
`expected.failure.category`; the bench's classification-accuracy metric.

Exit checks: classification accuracy ≥ 90% on the corpus; Core `pnpm check`,
`pnpm test`, `pnpm build` green; Core `dist` rebuilt before any downstream
live check.

Core: yes — the only scheduled Core change of the week. Both `dev` branches
pushed in the same work unit.

### Phase 1.6b — FluxBench corpus run and qualification

Objective: repeatable measurements and a ranked blocker list.

Steps:

1. Run `pnpm lab bench --corpus week1 --repeat 3 --evidence failure` twice;
   record both reports' metric tables in the ledger; agreement within
   tolerance is the repeatability proof.
2. Rank every failing or flaky workflow by frequency, MVP-loop impact,
   reproducibility; record the blocker list with owning phase.
3. Confirm the persistent-isolated demo (`demo:record` → `demo:run`) still
   passes provider-free after the week's changes.
4. Documentation: `testing-facility.md` (bench verb, Flow lane, fixture
   table), `web-capabilities.md` final matrix, `extension-client.md`
   evidence and failure sections, this document's Current State.
5. Handoff: Week 2 entry points recorded — the structured failure field,
   the failure-moment packet, the resolver diagnostics, and the bench
   fields that Week 2 fills.

Proof: the two bench reports. Exit checks: all six exit criteria in the
Objective table have a quoted observation.

## Metrics

Produced per run (`RunEvaluation`) and aggregated per corpus (`BenchReport`).

| Metric | Week 1 definition | Source |
| --- | --- | --- |
| Flow creation success | recording→proposal→approve produced a runnable Flow | Flow lane |
| Initial execution success | first run passed the fixture oracle and FluxIQ reported success | run + oracle |
| Deterministic replay success | runs 2..N passed, provider-free | run + oracle |
| Fuzzy recovery rate | armed drift variants that passed without harness activation | variants |
| False failure rate | oracle passed but FluxIQ reported failure (and the inverse, reported separately) | run vs oracle |
| Failure classification accuracy | negative runs whose reported category equals `expected.failure.category` | structured field |
| Harness activation rate | runs requesting an LLM intervention — must be 0 with provider disabled | Core run detail |
| Action latency | p50/p95 per action type; run duration | action records |
| Evidence size | p50/p95 sanitized packet bytes; raw snapshot bytes; truncation count | results |
| Harness recovery, adaptation cost/validation/persistence/reuse | `null` in Week 1; schema present for Week 2 | — |

Tolerance for repeatability: rates within ±1 workflow of each other;
latency p95 within 25%.

## FluxBench Week 1 Corpus

28 workflows over 22 fixtures (12 existing, 10 new), confirmed by the user
on 2026-09-11. Each row is a manifest
(`recordingScript`, `expected`, optional `variants`). Negative variants
carry `expected.failure.category`.

| ID | Fixture | Workflow | Categories | Variants (expected outcome) |
| --- | --- | --- | --- | --- |
| W01 | basic-form | fill, select, submit | forms | — |
| W02 | keyboard-forms | Enter submits; checkbox and radio group set | forms, keyboard | — |
| W03 | keyboard-forms | combobox opens on keystrokes, option chosen | dynamic interfaces | — |
| W04 | product-catalog | extract name/price/rating/url from page 1 | simple extraction | `text-variant` (price format changes → still extracts) |
| W05 | product-catalog | extract across pages via Next until last | paginated extraction | `short-catalog` (fewer pages) |
| W06 | product-catalog | search term, extract results | search | `no-results` (empty list, success) |
| W07 | product-catalog | extract only in-stock items | conditional behaviour | — |
| W08 | data-table | extract table with headers | table extraction | `column-reorder` |
| W09 | data-table | sort by price, extract first row | dynamic interfaces | — |
| W10 | navigation | multi-page with redirect and history | multi-page navigation | `broken-link` (NAVIGATION_UNEXPECTED) |
| W11 | infinite-feed | scroll until 40 items, extract | infinite scrolling | `end-early` (feed ends at 25, success) |
| W12 | modal-flows | open modal, fill, confirm | modals | — |
| W13 | modal-flows | dismiss consent banner, then click | blocking overlay | `banner-absent` |
| W14 | modal-flows | armed interstitial after first click | unexpected popup | `armed` (USER_INTERVENTION_REQUIRED or recovered by dismiss) |
| W15 | multi-tab | open in new tab, switch, extract, close | multiple tabs | `popup-blocked` |
| W16 | file-transfer | download report, observe completion | downloads | — |
| W17 | file-transfer | upload file, server echoes name | uploads, forms | — |
| W18 | auth-gate | log in, read protected content | auth-compatible | — |
| W19 | auth-gate | session expired mid-run | auth-compatible | `expired` (AUTH_REQUIRED) |
| W20 | identity-drift | replay after `selector-only` drift | changed selectors | recovered without harness |
| W21 | identity-drift | replay after `text-only` drift | changed text | recovered |
| W22 | identity-drift | replay after `moved` (other container, below fold) | moved elements | recovered |
| W23 | identity-drift | replay after `wrapped` + `aria-variant` | changed selectors | recovered |
| W24 | intermediate-state | submit → processing interstitial → result | unexpected intermediate state | `unannounced` (extra step; OUTPUT_NOT_OBSERVED vs wait) |
| W25 | delayed-ui | late target appears | dynamic interfaces | `too-slow` (TIMEOUT) |
| W26 | ambiguous-targets | two identical buttons, choose by context | targeting | `no-context` (TARGET_AMBIGUOUS) |
| W27 | failure-surfaces | disabled, detached, blocked URL | failure taxonomy | each surface (ACTION_REJECTED / TARGET_NOT_FOUND / NAVIGATION_UNEXPECTED) |
| W28 | iframe-checkout | click inside same- and cross-origin frames | frame targeting | — |

`llm-target-drift`, `instruction-only-form`, `reconnect`, `sensitive-input`,
and `long-document` remain in the Lab for their existing lanes;
`sensitive-input` is the Phase 1.4 redaction proof.

## Sequencing

Seven working days; waves are partitioned by file so workers run in
parallel; serial steps are marked.

| Wave | Days | Work | Workers |
| --- | --- | --- | --- |
| 1 | 1–2 | 1.1 step 1 (serial, first); 1.1 steps 2–4; 1.6a steps 1–3, 5, 6; 1.6a fixtures (10) | ~16 |
| 2 | 2–4 | 1.6a step 4 (Flow lane); 1.2 steps 1–5 (per action file); 1.3 steps 1–2 (capture side) | ~12 |
| 3 | 4–5 | paired Core document and user alert first; 1.3 steps 3–6; 1.4 steps 1–7 (step 7 Core); 1.5 steps 1–2 (Core) — C1–C3 form one Core work unit | ~9 |
| 4 | 5–6 | 1.5 steps 3–5; corpus manifests finalised with expected categories | ~5 |
| 5 | 6–7 | 1.6b | supervisor + 1 |

Supervisor-owned throughout: registry/type-tuple edits that every fixture
touches, verification of every claim, ledger, pushes, the architecture
docs.

## Risks

- **Trusted-input emulation** may not satisfy some widgets; the corpus
  (W02, W03) decides whether `chrome.debugger` is reconsidered — post-MVP
  unless it blocks a category.
- **Core coordination**: one Core work unit spanning C1–C3 (Phase 1.4
  step 7, Phase 1.5 step 2) including a minor bump; both `dev` branches
  move together; downstream
  live checks require a rebuilt Core `dist`.
- **Headed-only lanes** on the Windows host make the corpus ~45 min per
  three repeats; the content harness is headless and carries most of the
  per-phase proof. Xvfb remains a CI verification item.
- **Hot-spot files** (`actions.ts`, `action-runtime.ts`, `connection.ts`,
  `web-state.ts`, `llm-evidence.ts`) are decomposed before parallel edits;
  `structure:check` guards the result.
- **Scope**: shadow-DOM addressing, real sites, CDP input, and Core's
  `builtin.policy.expectation` stub are recorded, not fixed, this week.

## Audit Summary

Seven audits ran on 2026-09-11; the supervisor verified every load-bearing
claim against source. The verified digest is
[reports/README.md](./mvp-week1-web-automation-reliability-plan/reports/README.md);
the full reports with `file:line` citations sit beside it. The
[Current State](#current-state) headline numbers and the per-phase gap
statements above are drawn from that digest.

## Worker Briefs

The seven audit briefs dispatched 2026-09-11 are archived at
[archive/2026-09-11-audit-briefs.md](./mvp-week1-web-automation-reliability-plan/archive/2026-09-11-audit-briefs.md).
Implementation briefs are added here, one per worker, before each wave is
dispatched.

## Work Ledger

### 2026-09-11 — Document created; audit workers dispatched
- Agent: supervisor
- Changed: this document; `docs/working/README.md` (index row);
  `docs/working/mvp-week1-web-automation-reliability-plan/reports/` created.
- Why: The user asked for an in-depth Week 1 working document that improves
  on the 30-day plan, fills its gaps from both repositories, and emphasises
  automated testing through the Testing Lab. Discovery across seven areas is
  delegated so the supervisor reads conclusions, not files.
- Validation: not validated — documentation only.
- Outcome: Accepted
- Follow-up: verify reports, write the executable phase plan.

### 2026-09-11 — Audits verified; executable plan written
- Agent: supervisor, with workers audit-actions, audit-recording,
  audit-targeting, audit-evidence, audit-failures, audit-testing-facility,
  audit-core-runtime
- Changed: this document (rewritten: decisions, proof method, phase plan,
  metrics, corpus, sequencing, audit summary); audit briefs moved to
  `archive/2026-09-11-audit-briefs.md`; seven reports under `reports/`.
- Why: The plan must be concrete enough for workers to execute without
  rediscovering the architecture, and every claim it rests on must be
  verified, not reported.
- Validation: supervisor re-read the cited source for every load-bearing
  claim — e.g. `expectation.ts:31-36` returns `passed: true`
  unconditionally; `adapter.ts:54` flattens status; `readElementValue` has
  no sensitivity guard and `capture-settings.ts:8` defaults `inputValues`
  to `true`; `io-policy.ts` returns `unresolved_no_candidates` with no
  downstream producer of `candidates`; `run-scenario.ts:358` asserts only
  `finalState`; `selector.ts` catalog lists 10 of 12. `node
  scripts/structure-audit.mjs` -> `passed (27 warning(s), 19 baselined)`.
- Outcome: Accepted
- Follow-up: fold in `audit-core-runtime`; dispatch Wave 1.

### 2026-09-11 — User decisions on Core scope and corpus
- Agent: supervisor
- Changed: this document — D9 and D10 added; Phase 1.4 step 7 (Core seam
  C3) and its proof added; paired Core document moved to Wave 3 dispatch;
  Phase 1.5 step 2 marks the minor bump accepted; corpus marked confirmed;
  sequencing and risks updated; three open questions closed.
- Why: The user, asked the three open questions, chose the recommended
  option for each: take the Core minor bump this week alongside D3; build
  the expectation-evaluator seam in Week 1 with Phase 1.4; accept the
  28-workflow corpus as proposed.
- Validation: `node scripts/structure-audit.mjs` after the edits —
  observed output recorded in the commit; documentation only.
- Outcome: Accepted
- Follow-up: dispatch Wave 1.

## Open Questions

- **Selector-keyed patch lane vs fingerprint-first doctrine.** Core's
  `validateTargetOverrideEvidence` takes `{selector}`. Week 1 makes the
  extension accept fingerprint-shaped targets; whether the patch lane
  becomes fingerprint-shaped is a Week 2 contract decision. Owner: senior
  supervisor agent, recorded for the Week 2 document.
