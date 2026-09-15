# MVP Week 1 — Web Automation Reliability Plan

Status: Active
Status detail: Week 1 closed on 2026-09-15 on the sharded-final-2 pair with two disclosed startup exceptions; a production-Core confirmation pair will supersede them.
Created: 2026-09-11
Last updated: 2026-09-15
Owner: Senior supervisor agent
Scope: Week 1 of the 30-day MVP (Phases 1.1–1.6): browser action vocabulary, element identity, browser state/evidence, failure taxonomy, and FluxBench, with automated verification through the Testing Lab as the primary proof for every phase. Weeks 2–4 are out of scope except where Week 1 must leave a seam for them.
Paired document: `F:\!FluxIQ\docs\working\mvp-week1-web-automation-reliability-plan.md` — Core owns the failure-taxonomy contracts (C1, C2, pulled ahead of Wave 2 by D11) and the expectation-evaluator seam (C3)
Related: [30-Day MVP plan](../../FluxIQ%20Web%20Extension%20%E2%80%94%2030-Day%20MVP%20Implementation%20Plan.md), [MVP agent instructions](../../MVP_AGENT_INSTRUCTIONS.md), [testing facility](../architecture/testing-facility.md), [extension client](../architecture/extension-client.md), [automated-testing-facility-plan](./automated-testing-facility-plan.md), [llm-production-automation-plan](./llm-production-automation-plan.md), audit reports under [reports/](./mvp-week1-web-automation-reliability-plan/reports/)

---

## Current State

**Session objective, set by the user on 2026-09-12: COMPLETELY FINISH every Week
1 item, using subagents to do it quickly AND properly, with EVERYTHING tested.**
On 2026-09-14 the user asked for Week 1 to be closed that night.

**Phase, as of 2026-09-15: Week 1 closed on the sharded-final-2 pair with two
disclosed startup exceptions; a production-Core confirmation pair supersedes
them.** Reports named in backticks are under
[reports/](./mvp-week1-web-automation-reliability-plan/reports/); every dispatch is
in [briefs/finish-week1.md](./mvp-week1-web-automation-reliability-plan/briefs/finish-week1.md);
settled ledger entries are in parts one to fifty-one of
[archive/2026-09-12-finish-week1-ledger.md](./mvp-week1-web-automation-reliability-plan/archive/2026-09-12-finish-week1-ledger.md).

**Repository state.** Downstream `dev` carries the acceptance pin `3d6ecd6`, the
fixes `3525938`, `878fbd5`, `83f54b3`, `b3278a4`, and this closeout's documentation commit, pushed to
`origin/dev`. Core `dev` carries one documentation commit after `19468b7`.

**Acceptance pair, clean pins downstream `3d6ecd6`, Core `19468b7`.** A
`bench-mu202a52-127f75c3` and B `bench-mu202snn-ec661de2`: Week 1 x3, isolated,
failure evidence, 3 shards, 2 jobs. Each has 189 evaluated runs plus 12 planned
skips and an authenticated merge seal (`bq`, `br`). A: 179 passed. B: 179 passed.
Both hold the nine ruled-out variant failures. Official comparison
(`bz-final-2-comparison`): exit 1, `outcome: equivalent`, `comparisonPassed:
false`, identical topology. All 23 tolerance-bearing metrics are equivalent,
with 0 outside tolerance and 0 absent. Persistence discards are 0 on both sides.
Exactly two runs differ, and both are the exceptions below.

**The user's closeout decisions (2026-09-14 and 2026-09-15, in the ledger).**
1. After B's first unexpected failure: "Both: close tonight + fix".
2. After A's second: "Two exceptions, close tonight".
3. After B's merge refused an orphaned temp file: "Quarantine file, resume B".
4. Then: act on recommendations without asking.

**The two disclosed exceptions, one classified class.**
- B W14 `modal-flows`/`interstitial`, Flow, repeat 2: `process.startup`,
  `http.timeout / project.select / 30000`. Focused `bu`: 3/3 passed
  (`run-mu2h3iwq-fc8c53cf`, `run-mu2h59v9-7417a490`, `run-mu2h6yxo-591c2cff`).
- A W28 `iframe-checkout`, recording, repeat 1: `gateway.connection`,
  `unclassified`, "Timed out waiting for client gateway". Focused `bv`: 3/3 passed (`run-mu2h8ku2-521f71ec`, `run-mu2h9u41-17c539d7`,
  `run-mu2hb2lg-cc6a1ed1`).
- Both failed inside topology startup, before any browser or step. Cause
  (`bs`, `bt`, supervisor-verified): each run served Core with `next dev
  --turbopack` from a fresh copy, so first requests compiled on demand under
  load. Slot waiters also spawned `powershell.exe` per owner on every 100 ms poll
  (at least about 518 per minute measured). Supervisor worktree tests overlapped
  the W28 window.

**B's manual step.** B's children finished, but its merge failed closed: shard
002's `evaluations/` held a byte-identical temporary left by the durable writer's
link-then-remove. With the user's approval the one file was moved to
`F:\fxlab-runs\sharded-final-2\quarantine\`, and an exact-ID resume at the same
pin then sealed B.

**Exit criteria**

| Criterion | State at closeout | Evidence |
| --- | --- | --- |
| Actions reliable | Recording unarmed 18/18 both; Flow unarmed 16/16 A, 15/16 B (W14 exception, 3/3 in isolation) | `bz`, `bu` |
| Evidence useful | Packets 618/608, p95 5,934, max 5,992 bytes; 0 redaction findings; harness 0; content harness `evidence.spec.ts` 30 passed at `3d6ecd6` | `bq`, `br`, ledger |
| Deterministic fallback | 5/5 recovered without harness, both | `bz` |
| Failures classified | Required W14/W19/W27 15/15 both; all negatives 30/33 (W24 ruled out) | `bz` |
| Bench repeatable | 23/23 tolerance metrics equivalent; two differing runs, both the disclosed startup class | `bz` |
| Blockers ranked | `cb-blocker-ranking-final` | ledger entry 2026-09-15 |

**Fixed after the pair, not in the acceptance pins.**
- Production Core build for isolated and demo topologies, and startup-failure
  logs kept in the bundle (`bw`).
- Slot waiters no longer spawn PowerShell on every poll (`bx`).
- Durable writer retries removing its temporary and fails loudly instead of leaving an orphan (`ca`).
- Pushed `3d6ecd6` failed its own structure audit; restored (`by`), index
  regenerated.

**Next steps.**
1. Production-Core confirmation pair from a Lab worktree at the pushed fix pin,
   prebuilding each runs root; compare; replace the two exceptions.
2. Follow-ups recorded, not scheduled: retune the slot gate's 3 GiB per cell from
   a measured built-Core footprint; `isrFlushToDisk: false`; prune failed build
   attempts; `workspace-lock.ts` owner-before-link.

**Blockers:** none.

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
   `domain/src/runtime/failure/{codes,classify,carrier}.ts`, a producer attaching a
   failure record to what it throws): every browser failure carries the
   structured field — `TARGET_NOT_FOUND`/`TARGET_AMBIGUOUS` from the
   resolver, `OUTPUT_NOT_OBSERVED`/`STATE_MISMATCH` from validation with
   expected/actual, `NAVIGATION_UNEXPECTED` (landed URL, redirect,
   error page), `PAGE_CHANGED` (document identity changed between dispatch
   and execution), `TIMEOUT`, `ACTION_REJECTED` (one shape), `AUTH_REQUIRED`
   (login-form-after-redirect heuristic, `auth-gate`),
   `USER_INTERVENTION_REQUIRED` (captcha markers, pending native dialog),
   `UNKNOWN`. Codes are a closed set in `codes.ts`. The test-runner's allowlist
   derives from a different vocabulary, the domain's evidence-loop result codes and
   tool ids.
4. **Failure-moment evidence** (`content/action-runtime/results.ts`,
   `domain/src/client/gateway-mapping.ts`, `domain/src/runtime/llm-evidence/`):
   a failed result attaches a sanitized `web-llm-evidence.v1` packet
   captured at the instant of failure (bounded to Core's gate); the URL
   and target diagnostics ride with it; diagnosis-time re-capture becomes a
   supplement.
5. **Test-runner alignment** (`packages/test-runner/src/demo-llm-create-ui.ts`
   allowlist, `failure.ts` dead list, `bench/evaluate-run.ts` categories; there is no `evaluation.ts`, corrected 2026-09-11): allowlist
   derived from `WEB_LLM_EVIDENCE_RESULT_CODES` and `WEB_LLM_EVIDENCE_TOOL_IDS` through
   `@fluxiq-web-extension/domain/node`; `runnerFailureCategories` removed.

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

The first two 2026-09-13 entries are preserved in
[the pre-durability ledger archive](./mvp-week1-web-automation-reliability-plan/archive/2026-09-14-pre-durability-ledger.md).

The 2026-09-13 and 2026-09-14 entries through the durable-campaign work are in
part fifty-one of
[archive/2026-09-12-finish-week1-ledger.md](./mvp-week1-web-automation-reliability-plan/archive/2026-09-12-finish-week1-ledger.md).

### 2026-09-15 — Week 1 closed on sharded-final-2 with two disclosed startup exceptions

- Agents: workers `bs-w14-runner-sequence` and `bt-w14-core-handler` (read-only
  diagnosis); `bw-core-production-build`, `bx-slot-poll-probe`,
  `by-structure-violations`, `ca-durable-temp-cleanup` (worktree implementation);
  `bq-sharded-final-2-a`, `br-sharded-final-2-b` (terminal verification);
  `bz-final-2-comparison`, `cb-blocker-ranking-final` (reports). Supervisor ran
  every Lab command, resume, comparison, focused proof and gate below.
- Decisions (the user's, verbatim): "Both: close tonight + fix"; "Two
  exceptions, close tonight"; "Quarantine file, resume B"; "please dont ask me
  again for something, just do recommended. FINISH THIS".
- Found:
  - B W14 Flow rep 2 `process.startup` `http.timeout / project.select / 30000`
    and A W28 recording rep 1 `gateway.connection` `unclassified` both failed
    inside topology startup (`run.json` ports and process exits empty, zero
    steps). Cause: per-run `next dev --turbopack` compiled first requests on
    demand under load (`coordinator.ts:106`, `:113`, `:121-122`, `:137`,
    `:267`, `:281`).
  - Slot waiters spawned `powershell.exe` per owner per 100 ms poll
    (`acquire-machine-cell-slot.ts:84`, `:121`; `lease.ts:203-222`); a 20.0 s
    sample saw 173 distinct probe processes.
  - B's parent could not merge: shard 002 `evaluations/` held
    `.bench-shard2-fdae3012-c15-a1.json.<pid>.<hex>.tmp`, byte-identical to its
    published evaluation (`durable-file.ts:100-111`), and
    `shard-merge.ts:114-123` requires an exact listing.
  - Pushed `3d6ecd6` failed `scripts/structure-audit.mjs` with 5 violations.
  - The handoff's "18 skips" was wrong; the plan has 12.
- Changed: `3525938`, `878fbd5`, `83f54b3`, `b3278a4`: production Core build and startup-failure logs; slot probe
  cache; durable temporary cleanup; barrel imports and test relocation;
  regenerated working-docs index; reports `bq` to `cb`.
- Validation:
  - First resume of B at `3d6ecd6`: `bench-campaign-resumed`, then "Shard
    evaluation directory contains a missing or orphan receipt", exit 1. After
    moving the one temporary (SHA-256 identical to the published file, hash
    preserved): exact-ID resume published `"runs":189,"passed":179,
    "skipped":12`; supervisor observed `merge-seal=True`, parent `finished`,
    parent chain 0 gap/link errors, leases 0, evaluations 66/60/63, 0 dot files.
  - A: `merge-seal=True`, parent `finished`; supervisor verified shards 000/001
    chains (0 gap/link errors) and 126 evaluation byte hashes; `bq` observed
    merge seal 24/24 digests, 189/189 receipts, 0 residue.
  - `node packages/test-runner/dist/cli.js compare <A> <B>`: `compare exit=1`,
    `outcome=equivalent`, `comparisonPassed=False`, identical topology, 23
    tolerance metrics equivalent, `outsideTolerance 0`, `absentComparableMetrics
    0`, differing runs W14 Flow rep 2 and W28 recording rep 1 only, persistence
    discards 0.
  - W14 focused: `run-mu2h3iwq-fc8c53cf`, `run-mu2h59v9-7417a490`,
    `run-mu2h6yxo-591c2cff` each exit 0, verdict passed, `facilityFailure: null`,
    harness 0. W28 focused: `run-mu2h8ku2-521f71ec`,
    `run-mu2h9u41-17c539d7`, `run-mu2hb2lg-cc6a1ed1` each exit 0, verdict passed,
    `facilityFailure: null`, harness 0.
  - From `apps/extension` at `3d6ecd6`: `pnpm exec playwright test -c
    e2e/playwright.content.config.ts --workers=2 evidence.spec.ts` -> `30 passed
    (21.1s)`, exit 0, tree clean before and after.
  - Worktree before integration: `# tests 822`, `# pass 822`, `# fail 0`;
    slot-probe `tests 30, pass 30, fail 0` and mutation M2 `fail 5`.
  - Root gates on `b3278a4`: `pnpm -r --workspace-concurrency=1 test` exit 0
    (domain `# pass 404`, extension `# pass 513`, test-runner `# pass 845`, every
    other package passing, `# fail 0` throughout); `pnpm check` exit 0 (`# pass
    63`, `# pass 15`, "structure-audit: passed (53 warning(s), 17 baselined).");
    `pnpm build` exit 0 with no tracked changes.
  - Live production build at `83f54b3`: "Compiled successfully in 13.8s", Core
    "Ready in 635ms"; W14 Flow `run-mu2hl57s-867a8846` passed, and
    `run-mu2hmz8e-3839eafd` reused the cache and passed in 21,527 ms (54,866-58,772
    ms on `next dev`).
- Not verified: the production-Core pair itself; a built Core's measured memory
  footprint; the old probe loop's CPU cost beyond one sample; real Defender holds
  against the 2.5 s removal schedule.
- Outcome: Accepted with two disclosed exceptions; production-Core pair pending

## Open Questions

Open questions live in [open-questions.md](./mvp-week1-web-automation-reliability-plan/open-questions.md).
