# MVP Week 1 — Web Automation Reliability Plan

Status: Active
Status detail: Wave 1 complete and pushed in one paired work unit (this repository f8885b8, Core 4867c5c). Wave 2 open: w2-foundation runs first and twelve briefs code against its contract.
Created: 2026-09-11
Last updated: 2026-09-11
Owner: Senior supervisor agent
Scope: Week 1 of the 30-day MVP (Phases 1.1–1.6): browser action vocabulary, element identity, browser state/evidence, failure taxonomy, and FluxBench, with automated verification through the Testing Lab as the primary proof for every phase. Weeks 2–4 are out of scope except where Week 1 must leave a seam for them.
Paired document: `F:\!FluxIQ\docs\working\mvp-week1-web-automation-reliability-plan.md` — Core owns the failure-taxonomy contracts (C1, C2, pulled ahead of Wave 2 by D11) and the expectation-evaluator seam (C3)
Related: [30-Day MVP plan](../../FluxIQ%20Web%20Extension%20%E2%80%94%2030-Day%20MVP%20Implementation%20Plan.md), [MVP agent instructions](../../MVP_AGENT_INSTRUCTIONS.md), [testing facility](../architecture/testing-facility.md), [extension client](../architecture/extension-client.md), [automated-testing-facility-plan](./automated-testing-facility-plan.md), [llm-production-automation-plan](./llm-production-automation-plan.md), audit reports under [reports/](./mvp-week1-web-automation-reliability-plan/reports/)

---

## Current State

**Phase: Wave 1 complete and pushed; Wave 2 in progress.** Twenty workers dispatched in batches A–C;
briefs in [briefs/wave-1.md](./mvp-week1-web-automation-reliability-plan/briefs/wave-1.md).
Planning is complete; its ledger is archived at
[archive/2026-09-11-planning-ledger.md](./mvp-week1-web-automation-reliability-plan/archive/2026-09-11-planning-ledger.md).

**Headline numbers from the audit** (detail in
[reports/README.md](./mvp-week1-web-automation-reliability-plan/reports/README.md)):
actions 1/10/3/10 of 24 (fully/partial/unreliable/unsupported), **outcome
validation 0/24**; Core's element matcher never receives candidates and
its top signals are zero for web targets; evidence 8/16 present with **no
expected-vs-actual comparison anywhere** and sensitive values captured by
default; no failure taxonomy on the browser path, 5 of 11 categories
unproduced; the Testing Lab covers 4 of 18 FluxBench categories, has no
metrics, and cannot run a Flow on `isolated`.

**Done** (evidence in the ledger)

- Domain tests run every `domain/src/**/tests/*.test.ts` (24 runtime tests
  had never run; all pass); `DOMAIN_TEST_BUILD_LABEL` isolates parallel runs.
- Scenario contract: `workflows`, `variants`, `extract` steps,
  `expected.extracted`, `expected.failure`, seven step operations,
  `resolveScenarioWorkflow`. Scenario Lab: a scenario-owned `route` hook
  and ten registered placeholder fixtures.
- Batch A and w1-content-aliases verified (ledger); an unknown action
  type now reaches the wire as `ACTION_REJECTED`.
- Domain tests are type-checked (22 errors fixed). All ten new fixtures
  verified; capability docs written; the content-script harness (31
  specs), evaluation and benchmark contracts, and the registry-derived
  test-matrix catalog verified.
- Scenario Lab consolidated (fixture barrels, one shared e2e lab fixture,
  22-fixture docs) and extension unit tests (64) verified; the sensitivity
  rule is one shared token-based function (`billing cc-number` leaked).
- FluxBench: `pnpm lab bench` with `week1` and `smoke` corpora; the panel host
  is an ES module on Core's public exports; isolated runs here use
  `FLUXIQ_TEST_ENV_FILES=none`.

**Running:** Wave 3, all ten parallel briefs, dispatched 2026-09-12. The serial
prerequisite is finished: `w3-failure-codes` landed the closed code set, and its
export seam — two barrel lines the brief had not granted anyone — is in, so the
set is reachable from `@fluxiq-web-extension/domain`'s public entry. Wave 2 is
complete, integrated and pushed, and its follow-up landed: the run-manifest
action-type join is wired through and tested, where it had been inert.

**The Core half of Week 1 is finished.** The expectation-evaluator seam (C3) was
recovered from an interrupted worker on 2026-09-12, verified by the supervisor
rather than taken on the worker's word, and pushed. Every Core contract this plan
depends on now exists. The seam landed in a different shape than planned — the
evaluator is a method on `AutomationStudioHostRuntimeBoundary`, not a separate
service binding — so the downstream binding was folded into `w3-host-runtime`
instead of getting a brief of its own, which would have collided on
`host-runtime.ts`.

**Findings that change later work**

- The Playwright headless shell crashes on launch here; both Playwright
  configs now use `channel: "chromium"` (network-policy spec: 3 passed).
- Playwright `selectOption` fires untrusted events, which the recorder now
  ignores: recorded lanes select by keyboard.
- Password values leave the recorder unredacted (pre-existing,
  `describe-element.ts`); Phase 1.4 fixes it at the source.
- The recording lane asserts only unpaginated extract steps; paginated
  extraction is proven by the Wave 2 Flow lane.
- The structure audit reads only tracked files: stage new files first.
- Core accepts `client.start_recording` only while the approving Automation
  Studio context is under 10 s old. The runner now restamps it immediately
  before the start. The `clone` lane still carries the original defect and
  needs an existing or clone target to exercise it.
- Fixed in Core and mirrored: `pnpm structure:baseline` only lowers or removes
  entries, and refuses a new or grown violation.
- `.env.local` configures the existing install (target, base and gateway URLs,
  credentials), and a process variable cannot clear those keys; isolated runs
  therefore set `FLUXIQ_TEST_ENV_FILES=none`, which skips both env files for
  one run. Never edit `.env.local`.
- **A worker's crash is usually the machine, not the change.** Verifying the
  Core seam produced a `tsc` segmentation fault here and three separate vitest
  runs that each lost a test file to `Error: Worker exited unexpectedly`. None
  of it was the code. In Core the root cause is a native SQLite module
  corrupting under parallel load (`SQLITE_CORRUPT: malformed database schema`),
  which kills the worker process outright instead of failing a test; Core
  verifies cleanly with `--no-file-parallelism`. Downstream, running both
  repositories' checks at once was enough to segfault `tsc`, and running the
  downstream check alone passed. Run heavy gates one at a time.
- **One clean baseline run does not clear a change.** Chasing the above, the
  supervisor stashed the Core seam, saw a green parallel baseline, and briefly
  concluded the seam caused the crashes. It did not — the baseline run was
  lucky. Against an intermittent failure, compare like for like (here, the
  sequential run) rather than trusting a single green.

**Not done:** the ten parallel Wave 3 briefs are running, none verified yet;
Waves 4 and 5.

**Next steps**

1. Integrate the ten Wave 3 reports as they land, resolving conflicts where two
   briefs touched the same contract from opposite sides — `browserFrameId`
   (`w3-domain-contracts` and `w3-frame-plumbing`), the new evidence items
   (`w3-evidence` and `w3-llm-packet`), and `expectedState`
   (`w3-domain-contracts` and `w3-host-runtime`).
2. Verify the integrated tree with `pnpm check`, `pnpm test` and `pnpm build`,
   run one at a time, then a Lab run for the browser behaviour the unit tests
   cannot prove.
3. Close the two open questions this wave should settle: narrowing
   `WebAutomationRuntimeError["code"]` to the closed set, and whether the
   runner's allowlist and the test-rig `failureCategories` stay separate axes.
4. Keep Lab runs serialized: only one may execute on this machine at a time.

**Core unit (D11):** complete. The baseline ratchet (mirrored here),
domain-host loading, the failure taxonomy and carriers, the web and runtime test
suites, and now the expectation-evaluator seam are all verified and pushed, as
recorded in the paired Core document. Week 1 asks nothing further of Core.

**Blockers:** none. The user was alerted before the first Core edit.

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
- **D11 — Changes that belong in Core are made in Core.** Directed by the
  user 2026-09-11. The Core unit for D3 and D9 (failure enum, record,
  parser, and carriers; C1 and C2) moves ahead of Wave 2, joined by Core's
  domain-host loading through public exports and the structure-baseline
  ratchet fix. Downstream stand-ins are replaced by Core exports: the
  extension's `ACTION_REJECTED` in result `metadata`, the copied category
  names in `packages/test-contracts`, the Wave 2 draft's local category
  list, and the panel host's deep import of Core's `dist`.

- **D12 — Three Wave 2 worker judgments, ratified by the supervisor.** Each was
  raised by its worker as needing ratification, and each stands. Tripping the
  scroll cap while the document is still growing is a failed validation reporting
  `output_not_observed`, not a success, because the contract defines that category
  as an action that ran whose post-condition did not hold. The parameter readers
  live in a sibling module rather than inline, because inlining would have pushed
  `gateway-mapping.ts` past the size threshold, and the alternatives were a new
  audit warning or deleting the explanatory comments. A disabled `<option>` is
  refused inside the select verb rather than through the actionability capability,
  because an option in a closed select has no box and the capability would
  mis-report it as hidden.

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

Steps 1–4 landed in Wave 1; the step plan is archived at
[archive/2026-09-11-phase-1-1-plan.md](./mvp-week1-web-automation-reliability-plan/archive/2026-09-11-phase-1-1-plan.md).
Landed: the content script's `actions.ts` and `action-runtime.ts` split
into directories (44 of 44 moved bodies identical); mapping fixes (scroll
key, top-level `domainId`, unknown types rejected with `ACTION_REJECTED`,
one input→output mapper that keeps fingerprints); recorder hygiene; one
safety registry; dead exports removed; legacy aliases and the looser
content types gone. Step 5 (capability matrix, `extension-client.md`) is
with w1-capability-docs.

Exit checks at Wave 1 integration: T1 tests for steps 2–4;
`content/actions.spec.ts` on `basic-form`; `lab run basic-form --target
isolated`; `pnpm check`, `pnpm test`, `pnpm build`; structure audit with
no new finding. The alias grep is already empty.

Core: none.

### Phase 1.6a — FluxBench foundation

Steps 1–3 and 5–7 landed in Wave 1; the step plan is archived at
[archive/2026-09-11-phase-1-6a-plan.md](./mvp-week1-web-automation-reliability-plan/archive/2026-09-11-phase-1-6a-plan.md).
Landed: the T2 content-script harness (`test:content`); the runner asserting
what manifests declare; the scenario contract's workflows, variants,
extraction, and expected failures; the evaluation and benchmark contracts;
`pnpm lab bench` with the `week1` and `smoke` corpora and report comparison;
the registry-derived test-matrix catalog; ten new fixtures (22 in all). Step
4, the provider-free Flow lane, is Wave 2 (`w2-flow-lane` in
[briefs/wave-2.md](./mvp-week1-web-automation-reliability-plan/briefs/wave-2.md)).

Proof so far: the Scenario Lab suite green with 22 fixtures; `test:content`
31 passed; `FLUXIQ_TEST_ENV_FILES=none pnpm lab bench --corpus smoke --repeat
2 --target isolated` 4/4 passed with `compare --halves` `equivalent`. Still to
prove: `pnpm lab run basic-form --flow --target isolated` (Wave 2).

Core: none.

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
   penalizes declared-but-missing signals). **Steps 1 and 2 done 2026-09-11** by
   w2-identity-capture, verified at Wave 3 planning: the descriptor derives
   `testId`, `accessibleName`, `label`, `implicitRole`, `context`, `href` and
   `inputType`; the identity modules exist; and the attribute allowlist already
   carries `aria-labelledby`, `aria-describedby` and `for`. Wave 3 starts at step
   3, the resolver, which does not exist yet.
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
2. **Core seam C1 + C2** (Core worker; the file-by-file chain is section
   (c) of `reports/audit-core-runtime.md`: `OutputDispatchResult.status?`,
   `AutomationNodeExecutionResult.message?`/`failure?`, propagation in
   `io-policy.ts` and `attempt-trace.ts`, `targetResolution?` beside
   `stateRefs`, structured-first classification in
   `transition-comparison.ts` and `adaptive-orchestrator.ts`, the attempt
   record and `conversions.ts`, and the LLM context packet): extend
   `AutomationStudioAdaptiveFailureClass` with
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
   Tests in Core's `tests/` folders; Core `pnpm check`/`test`/`build`. **Done 2026-09-11**: pulled into Wave
   1 by D11, and verified by reading Core at Wave 3 planning. All seven failure
   classes and both target comparison statuses exist, and
   `classifyTransitionComparisonStatus` is structured-first, reading the failure
   record and keeping the text match only as a documented fallback, so the
   timeout-classification defect is fixed.
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
   allowlist, `failure.ts` dead list, `bench/evaluate-run.ts` categories; there is no `evaluation.ts`, corrected 2026-09-11): allowlist
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
Implementation briefs live beside the plan, one file per wave, written
before dispatch, because the plan sits at the 800-line threshold: Wave 1 is
[briefs/wave-1.md](./mvp-week1-web-automation-reliability-plan/briefs/wave-1.md).

## Work Ledger

The three planning entries of 2026-09-11 (document created; audits
verified; user decisions) are archived at
[archive/2026-09-11-planning-ledger.md](./mvp-week1-web-automation-reliability-plan/archive/2026-09-11-planning-ledger.md).

Wave 1 entries up to the first three verified fixtures are archived at
[archive/2026-09-11-wave-1-ledger.md](./mvp-week1-web-automation-reliability-plan/archive/2026-09-11-wave-1-ledger.md).

The next two Wave 1 entries (six more fixtures verified; harness,
contracts, and catalog verified) are appended to the same archive.

So are the entries for decision D11 (recorded under Decisions); the
consolidation, extension unit tests, and sensitivity fix; the runner lane,
Scenario Lab cleanup, and baseline mirror; and the runner-suite repair,
including the decision that the one-call live ceiling holds; and FluxBench
with the env-file opt-in and the Core contracts link.

So is the entry recording the Core failure categories being adopted here, the
gate run that followed, and the first sighting of the recording-start flake.

So is the entry for the Wave 1 gate run that traced the recording start to a
10 s context window and fixed it in the runner.

So is the entry recording the paired Wave 1 push and the opening of Wave 2.

So is the Wave 2 foundation entry, which recorded the contract the other thirteen
briefs were written against.

So is the Wave 2 entry itself, recording the vocabulary and its integration.

## Open Questions

Open questions live in
[open-questions.md](./mvp-week1-web-automation-reliability-plan/open-questions.md),
moved there on 2026-09-11 so a growing list does not push this document past its
800-line threshold.
