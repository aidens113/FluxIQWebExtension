# MVP Week 1 — Web Automation Reliability Plan

Status: Active
Status detail: Lab Stage 1 ran against a pinned Core; its recording loss and its W18 and W25 failures are explained and their fixes are in flight, and no exit criterion yet has a quoted Lab observation. Session objective, set by the user: completely finish Week 1, with everything tested.
Created: 2026-09-11
Last updated: 2026-09-13
Owner: Senior supervisor agent
Scope: Week 1 of the 30-day MVP (Phases 1.1–1.6): browser action vocabulary, element identity, browser state/evidence, failure taxonomy, and FluxBench, with automated verification through the Testing Lab as the primary proof for every phase. Weeks 2–4 are out of scope except where Week 1 must leave a seam for them.
Paired document: `F:\!FluxIQ\docs\working\mvp-week1-web-automation-reliability-plan.md` — Core owns the failure-taxonomy contracts (C1, C2, pulled ahead of Wave 2 by D11) and the expectation-evaluator seam (C3)
Related: [30-Day MVP plan](../../FluxIQ%20Web%20Extension%20%E2%80%94%2030-Day%20MVP%20Implementation%20Plan.md), [MVP agent instructions](../../MVP_AGENT_INSTRUCTIONS.md), [testing facility](../architecture/testing-facility.md), [extension client](../architecture/extension-client.md), [automated-testing-facility-plan](./automated-testing-facility-plan.md), [llm-production-automation-plan](./llm-production-automation-plan.md), audit reports under [reports/](./mvp-week1-web-automation-reliability-plan/reports/)

---

## Current State

**Session objective, set by the user on 2026-09-12: COMPLETELY FINISH every
Week 1 item, using as many subagents as needed to do it quickly AND properly,
with EVERYTHING tested.** This is the objective of the session that resumes this
document. Read it literally:

- **Finished** means all six exit criteria in [Objective](#objective) carry a
  quoted observation from a real Testing Lab run in the Work Ledger, and every
  open item below is closed, or ruled out of Week 1 with the reason recorded.
  Nothing closes on a unit test, a compile, a harness row, or a worker's report.
- **Quickly** means wide parallelism partitioned by file from the first dispatch.
  Lab runs may run concurrently, one instance per worker (`L-lab-concurrency`),
  bounded by this machine's RAM. Do not stop at phase boundaries to ask.
- **Properly** means a mutation proof for every guard, the supervisor re-running
  every fix before its ledger entry, and single observations labelled as such,
  because this machine has faulty RAM.

**Phase, as of 2026-09-13: building the fixes Lab Stage 1 exposed.** Stage 1 ran
against a pinned Core and found that recording entries go missing under load, and
that W18, W24 and W25 fail. Both findings are explained and their fixes are in
flight. No exit criterion yet carries a quoted Lab observation. Reports named in
backticks are under [reports/](./mvp-week1-web-automation-reliability-plan/reports/);
every dispatch and amendment is in
[briefs/finish-week1.md](./mvp-week1-web-automation-reliability-plan/briefs/finish-week1.md);
settled ledger entries are in parts one to thirty-four of
[archive/2026-09-12-finish-week1-ledger.md](./mvp-week1-web-automation-reliability-plan/archive/2026-09-12-finish-week1-ledger.md).

**True on 2026-09-13, while workers run.**
- **This repository:** `dd9b9f9`, 89 commits ahead of `origin/dev`, not pushed.
- **Core:** `240c73e`, 10 commits ahead of `origin/dev`, `fluxiq` **0.4.0**, built at
  `187f40d`; the tenth is a plan-only commit. The nine code commits:
  - `5d495eb`, trace withholding;
  - `267a2ca`, the late-message discard;
  - `6f172b9`, a rejected expected state fails the attempt;
  - `0e6d3ac`, the target gate and late domain events;
  - `c0e0ce9`, a mapper candidate's `expectedState` and the context `following`;
  - `5ca9981`, one expectation-rejected record, and an empty expectation is none;
  - `73a81e9`, a client's recording start is ordered and acknowledged;
  - `187f40d`, a recorded entry keeps its source event id and source;
  - `5845f5d`, `fluxiq` 0.4.0, with a migration note for every change above.
- **Gates:** the supervisor reran per-package gates for every commit. Root gates,
  the content harness and Core's full suite have not run since this session began.

**Settled this session** (ledger and archive):
- **Core:** trace withholding; the late-message discard; W19 C1 and C2; the shared
  expectation record; the ordered, acknowledged client start; a recorded entry's
  event identity.
- **Evidence integrity:** the adapter guard; the second evidence producer;
  snapshot evidence (LR7, LR8); redaction attestation in every Lab run; windowed
  discard audits; single-run evidence sizes, through one reader.
- **Structure and hygiene:** the `connection.ts` split; the test-runner ratchet;
  stale comments, casts and the `test:content` script; the Flow lane imports
  Core's target-resolution type.
- **Matching and recording:** resolver corroboration (CS1d, W26); recorder signals
  (B5); `invalid_parameter` (B3); a recording begins locally only after its start
  was sent, and starts once however Core's acknowledgement arrives; a page change
  is recorded before the action after it, and a wait is proposed before a click
  whose target it produced (W25); a run whose recording Core holds short fails on
  both lanes.
- **W18:** the secret leg; every Flow run starts on the start page.
- **The bench:** runs both lanes, with W29 and evidence sizes; three negative
  variants whose click must fail; delayed-ui pins both clicks; W24's unreachable
  unarmed wait is dropped.
- **W19:**
  - E1, the recorder links a click to its landing;
  - E2, a URL claim on a sign-in gate reports `auth_required`;
  - E3, an assert is resent once to a navigating tab;
  - E4, a click landing on a refused page fails as `navigation_unexpected`;
  - D1, the domain builds a click's landing claim, and a live click's action
    entry now carries it (`32b4324`);
  - the architecture pages for E1-E3, D1 and D1b (`d775b5e`).

**Ruled out of Week 1, reasons in the ledger:**
- Firefox; CS1b, a late recording event sent to the client as an error frame;
- B4, B7, C5, C7 and D4; raw snapshot bytes; per-lane distributions;
- the landing marker for a wrong landing served 200; honouring `failureRoute` (Core);
- approving a recording proposal as a node definition, which drops `expectedState`;
- W24 `unannounced` (a recorded-payload contract change) and W13 `banner-absent`
  (P7, a new Core node outcome); both rows stay in the corpus.

**In flight:**
- **The auth-gate leak:** `g-attestation-sqlite`, to be committed with its follow-up
  `g-attestation-sqlite-reader`; `f-authgate-followups`; in Core,
  `g-core-attempt-withholding`, redispatched to own the whole chain.
- **From the bench triage:** `g-runner-harness-fixes` (H1-H3, H5) and
  `g-expected-action-guard`. P1-P3 are committed.
- **Recording gaps P4-P6:** `f-domain-capability-gaps`, `f-tab-recording`,
  `f-frame-address` and `f-capability-confirmations`; then the runner's upload input.
- **W25's storage order:** `g-core-bridge-order` in Core; `f-w25-core-order-row` waits for its build.

**Queued, in dependency order**
1. **After the three dispatches:** a Core build, then W18, W19, W25 and the rows the
   fixes touch again in the Lab, with the auth-gate leak check reading 0.
2. **Integration:**
   - Core `package:lint` and `pnpm build` on the 0.4.0 tree (the bump and its
     migration note landed in `5845f5d`);
   - root `pnpm check`, `pnpm test`, `pnpm build` and the content harness, one at
     a time;
   - regenerate `domain/.test-build`;
   - push both `dev` branches together.
3. **Lab Stage 3:** run
   `FLUXIQ_TEST_ENV_FILES=none pnpm lab bench --corpus week1 --repeat 3 --target isolated`
   twice, then `demo:record` and `demo:run` provider-free.
4. **Phase 1.6b:**
   - rank blockers from both bench reports;
   - bring the architecture pages to the finished state;
   - record Week 2 entry points;
   - quote an observation for every criterion row.

**Exit criteria as they stand**

| Criterion | State | Proof still to observe |
| --- | --- | --- |
| Actions reliable | Stage 2, single runs: step 4b 23 of 24 under load; W18, W19 and W25 0 of 3 each, under investigation | week1 W01-W19 through the bench, 3 of 3 |
| Evidence useful | Stage 2: `sensitive-input` leak check 3 of 3, but the auth-gate declared secret reached 13 Core workspace objects | Lab run: the 16 items, packet budget, leak rows |
| Deterministic fallback | Corroboration refuses an uncorroborated match (unit and harness) | W20-W23 recover and W26 disambiguates in the Lab |
| Failures classified | Stage 2: W10 and W27 `navigation_unexpected` 3 of 3; W19 `auth_required` 3 of 3; W25 `too-slow` still `target_not_found`; W24 ruled out | Negative variants report the expected category, at least 90% |
| Bench repeatable | Stage 2: week1 `--repeat 1` passed 37 of 67; `--repeat 3` never run | `--repeat 3` twice, agreeing within tolerance |
| Blockers ranked | Not started | Phase 1.6b ledger entry |

**Everything is tested: the operating rules.**
- **Three tiers per change:** unit tests in `tests/` beside the subject, the
  content harness, and the Lab. A guard is done only when a mutation shows its
  test failing.
- **Before any ledger entry, the supervisor reruns the gates:**
  - each package's gates under a private label (`EXTENSION_TEST_BUILD_LABEL`,
    `DOMAIN_TEST_BUILD_LABEL`);
  - the test-runner built into a private `--outDir` at `dist`'s depth.
- **Commands that work here:**
  - the content harness:
    `pnpm exec playwright test -c e2e/playwright.content.config.ts --workers=2 <spec>`,
    run from `apps/extension`;
  - Core tests: `npx vitest run <files> --no-file-parallelism`;
  - isolated Lab commands need `FLUXIQ_TEST_ENV_FILES=none`;
  - a Lab worktree pins Core only when it sits beside a Core worktree under
    `F:\fxlab\`.
- **Faulty RAM:** rerun a rare, uniform or impossible failure once, alone, before
  chasing it, and run heavy gates one at a time. The false-failure shapes are in
  `live-validation-plan.md`.
- **Commits:** one supervisor session per repository, and workers never commit.
  A descriptor or context change is verified against the whole `identity-`
  content-harness family.
- **Plan size:** the plan stays at or under 800 lines. Settled entries move
  verbatim to the archive, and the index is regenerated with the structure
  baseline backed up.

**Blockers:** none needing the user.

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

Decisions **D1-D12** are settled and archived in full at
[archive/2026-09-12-decisions-d1-d12.md](./mvp-week1-web-automation-reliability-plan/archive/2026-09-12-decisions-d1-d12.md).
Two are worth knowing before reading anything else here, because later work
falsified their premises: **D1** asserted that Core's element matcher bundles for
a browser (it did not, until a packaging change on 2026-09-12) and that Level 2
scoring would work (it could not, until D13); **D11** established that a change
belonging in Core is made in Core, which is why D13 exists rather than a
downstream approximation.

Decisions **D13** (Core charges a missing stable identifier less than a
contradicted one) and **D14** (Level 1 selects, the scorer vetoes), both accepted
2026-09-12, are archived verbatim at
[archive/2026-09-12-decisions-d13-d14.md](./mvp-week1-web-automation-reliability-plan/archive/2026-09-12-decisions-d13-d14.md).

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

Landed in Wave 1. Step plan:
[archive/2026-09-11-phase-1-1-plan.md](./mvp-week1-web-automation-reliability-plan/archive/2026-09-11-phase-1-1-plan.md);
landing narrative and exit checks:
[archive/2026-09-12-superseded-plan-sections.md](./mvp-week1-web-automation-reliability-plan/archive/2026-09-12-superseded-plan-sections.md).
Core: none.

### Phase 1.6a — FluxBench foundation

Landed across Waves 1 and 2: the content-script harness, the scenario contract,
`pnpm lab bench` with the `week1` and `smoke` corpora, and the Flow lane. Step
plan:
[archive/2026-09-11-phase-1-6a-plan.md](./mvp-week1-web-automation-reliability-plan/archive/2026-09-11-phase-1-6a-plan.md);
landing narrative in the superseded-sections archive above; the bench honesty
fixes of 2026-09-12 in `reports/v-bench-honesty.md`. Core: none.

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
| W14 | modal-flows | armed interstitial after first click | unexpected popup | `armed` (`user_intervention_required` only: the manifest declares one category, so a run that recovers by dismissing scores as a miss) |
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
| W27 | failure-surfaces | disabled, detached, blocked URL | failure taxonomy | each surface by category: `blocked_by_capability_or_policy` (`web.action.rejected`) / `target_not_found` / `navigation_unexpected` |
| W28 | iframe-checkout | click inside same- and cross-origin frames | frame targeting | — |
| W29 | identity-drift | Save's slot holds a lone, identifier-less "Save changes and exit" (R7, added 2026-09-13) | refusing a match no signal agrees with exactly | `save-and-exit` (`target_not_found`) |

`llm-target-drift`, `instruction-only-form`, `reconnect`, `sensitive-input`,
and `long-document` remain in the Lab for their existing lanes;
`sensitive-input` is the Phase 1.4 redaction proof.

## Sequencing and Risks

The seven-day wave table and the risk list are superseded and archived at
[archive/2026-09-12-superseded-plan-sections.md](./mvp-week1-web-automation-reliability-plan/archive/2026-09-12-superseded-plan-sections.md);
the remaining order of work is `Current State`'s Next steps.

## Audit Summary

Seven audits ran on 2026-09-11; the supervisor verified every load-bearing
claim against source. The verified digest, including the baseline figures the
work is measured against, is
[reports/README.md](./mvp-week1-web-automation-reliability-plan/reports/README.md).

## Worker Briefs

Briefs live under [briefs/](./mvp-week1-web-automation-reliability-plan/briefs/), one file per wave; the 2026-09-11
audit briefs are in [archive/2026-09-11-audit-briefs.md](./mvp-week1-web-automation-reliability-plan/archive/2026-09-11-audit-briefs.md).

## Work Ledger

Earlier entries are archived under [archive/](./mvp-week1-web-automation-reliability-plan/archive/): planning,
`2026-09-11-wave-1-ledger.md` through the Wave 2 integration, the
`2026-09-12-*` Wave 3 and live-validation files, and
`2026-09-12-handoff-ledger.md` (the compaction and handoff entries).

### 2026-09-13 — i-recording-capability-gaps: uploads, tabs and child frames are Week 1; an optional dismissal is Week 2

- Agent: worker `i-recording-capability-gaps` (read-only); decisions by supervisor.
- Changed: `reports/i-recording-capability-gaps.md` only.
- Found: every root cause below rests on code reading and one bench run per row.
  - **P5, W17.** The domain maps every change that is not a select or checkbox to
    typing (`domain/src/io/input-model.ts:122-130`). Nothing can build an upload
    from a recording, because `web.dom.upload` needs inline content.
  - **P4, W15.**
    - No tab-close listener exists (`background/index.ts:48-68`).
    - Activating a tab records nothing (`active-page.ts:90-112`).
    - No action input maps to `web.browser.tab`.
    - The switch verb matches a URL substring (`runtime/browser-tab.ts:81-89`).
  - **P6, W28.** Only the numeric frame id is carried (`payloads.ts:28-31`), and
    Chrome renumbers frames when the Flow lane reloads the start page.
  - **P7, W13 `banner-absent`.** Core follows a failure edge on any failure, and
    nothing can mark a node optional.
- Decisions (the twenty-eighth dispatch):
  - P5, P4 and P6 are built now: one serial domain worker and two extension
    workers, against wire names the brief fixes.
  - Confirmations and the runner's upload input are briefed once their files
    are free.
  - The recorder stops sending a file input's value.
  - **P7 is ruled out of Week 1.** It needs a new Core node outcome on the
    deferred `failureRoute` seam, and a loose rule would let W12 skip its invite
    and still report success.
- Validation: the supervisor read the report in full, and checked it against the
  code already verified for P2 (`runtime-status.ts:93-107`). Worker: a
  declared-value scan of the report found 0 hits.
- Not verified:
  - how a background-raised event reaches the path that counts actions;
  - whether Chrome fires `tabs.onActivated` for Playwright's pages;
  - Core's handling of a large run input;
  - every design, which is unbuilt.
- Outcome: Revised

### 2026-09-13 — f-recorder-key-order-and-check-confirmation and f-pointer-click-pairing: typed text precedes the key that acts on it, a check confirms, and a quick second click is kept

- Agents: workers `f-recorder-key-order-and-check-confirmation` (P1, P2) and
  `f-pointer-click-pairing` (P3); verified by supervisor.
- Changed:
  - **P1, `apps/extension/src/content/dom-events.ts`.** A key that acts on the
    text sends the pending debounced `dom.input` first: Enter, Tab, Escape or an
    arrow. A key that continues typing does not: a character, a deletion, a bare
    modifier, or a key an input method reports while composing. The brief said
    "before any keydown". The worker narrowed it, because every keystroke is a
    keydown and one pending input would split per key.
  - **P2, `background/connection/runtime-status.ts`.** A succeeded `web.dom.check`
    confirms as `dom.change` with `checkboxToggled`, carrying no value. An action
    that did not succeed confirms nothing.
  - **Task 3:** no other recorded verb waits for a confirmation it never gets.
  - **P3, `pointer-click-filter.ts` and `recorded-event-intake.ts`.** A `click` is
    paired with the last `pointerdown` in its tab and frame, with no time window.
    - A second press on the same unmoved control is a second action.
    - A keyboard click is always recorded.
    - A double-click records two clicks.
    - A long press is one action.
  - Tests, including `e2e/content/tests/recorder-trust.spec.ts`.
  - A stale comment in `recording-start/tests/handshake.test.ts`, by the
    supervisor.
  - `docs/architecture/extension-client.md` and `web-capabilities.md`.
- Validation:
  - **Supervisor,** extension `pnpm check` exit=0, and
    `EXTENSION_TEST_BUILD_LABEL=sup35 pnpm test` exit=0 with "# tests 413", "# pass
    413", "# fail 0". The run started as the P1/P2 worker reported.
  - **Supervisor,** content harness
    `pnpm exec playwright test -c e2e/playwright.content.config.ts --workers=2 keyboard.spec.ts recorder-trust.spec.ts`:
    exit=0, "19 passed".
  - Both diffs were frozen as patches and committed from them. The P3 diff was
    byte-identical to the one saved when it reported.
  - **Worker mutations:**
    - P1/P2: removing the key flush reproduced W02's and W03's orders; five
      mutations each failed their rows.
    - P3: three mutations each failed their rows.
- Not verified:
  - no Lab run: W02, W03 and W14 unarmed must pass on both lanes, and W14
    `armed` must stay `user_intervention_required`;
  - a live browser for double-click, touch cancel and input methods;
  - the content harness does not drive the background filter;
  - one residual drop: a press that never produces a click, then a keyboard click
    on the same selector, size and position in that tab and frame.
- Outcome: Accepted

## Open Questions

Open questions live in [open-questions.md](./mvp-week1-web-automation-reliability-plan/open-questions.md).
