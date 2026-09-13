# MVP Week 1 — Web Automation Reliability Plan

Status: Active
Status detail: Waves 1-3 and the 2026-09-12 live-validation work committed and pushed; four of six exit criteria have never had a valid proof and Phase 1.6b has not started. Session objective, set by the user: completely finish Week 1, with everything tested.
Created: 2026-09-11
Last updated: 2026-09-12
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

**Phase: Waves 1-3 and the 2026-09-12 live-validation work are committed and
pushed. Four of the six exit criteria have never had a valid proof, and Phase
1.6b has not started.** Reports named in backticks are under
[reports/](./mvp-week1-web-automation-reliability-plan/reports/).

**True at handoff.** This repository: `HEAD 498b6f0`, even with `origin/dev`,
clean tree; root `pnpm check` exit 0 with the structure audit passing, root
`pnpm test` exit 0 (extension 294/294, domain 343/343, test-runner 439/439,
scenario-lab 197/197). The content harness, the Lab and Core were not re-run at
handoff. Core: `368b3c9` on `origin/dev`, `fluxiq` 0.3.0.

**Uncommitted in Core, unverified, and recorded nowhere.** Eight files in
`F:\!FluxIQ` withhold state-bound values from the run trace:
`runtime/executor/graph-run.ts`, `executor/index.ts`, `executor/node-execution.ts`,
`flow-bootstrap/plan/validation.ts` and its test, a new
`executor/tests/trace-withholding.test.ts`, and two architecture pages. This is
the Core leg `p-secret-binding` named and did not own; no ledger entry in either
repository describes it, and it was most likely written by session `fluxiq-df`.
Settle it before anything else touches Core: verify and commit it with a Core
ledger entry, or ask the user before discarding it.

**What live validation established.**
- **Confirmed:** the smoke corpus is clean against eight baselines (`L-smoke`);
  the real unpacked extension loads and is driven, MV3 worker restart included;
  the Lab runs concurrent instances.
- **Corrected and fixed:** FluxBench scored runs that executed nothing, reading
  100% where the honest figure was 30% (`v-bench-honesty`); the five Phase 1.3
  identity signals never crossed the wire (`x-identity-wire`, `x-identity-chain`);
  a serialiser deleted every structured failure from run history
  (`x-evidence-crash`); fixtures handed the matcher its margins, so three
  realistic ones now exist (`admin-console`, `storefront-checkout`,
  `member-directory`). Seven redaction leaks are closed.
- **Still open:** on production-shaped recordings the resolver picks a different
  action and reports success, 0.633 against a 0.35 floor (`L-review` finding 1,
  `L-veto-recordings`); live, `reworded-aria` refuses at confidence 0.173 and the
  element-target floor sees `unresolved_no_candidates`, `candidateCount 0`, on
  every dispatch (`L-replay`); Firefox installs but cannot reach the gateway
  (its background may not open `ws://`) and has no side panel (`p-firefox`).

**Exit criteria as they stand**

| Criterion | State | Proof still to observe |
| --- | --- | --- |
| Actions reliable | Harness green; replays never run | week1 W01-W19 through the bench, 3 of 3 |
| Evidence useful | Harness and unit only | Lab run: the 16 items, packet budget, leak rows |
| Deterministic fallback | Refusal proven on fixtures; wrong action on production-shaped recordings | W20-W23 recover and W26 disambiguates, realistic fixtures included |
| Failures classified | Never measured | Negative variants (W14, W19, W27) report the expected category, at least 90% |
| Bench repeatable | Honesty fixed; week1 x3 never run | `--repeat 3` twice, agreeing within tolerance |
| Blockers ranked | Not started | Phase 1.6b ledger entry |

The bench now declares both lanes (`bench/corpus/week1.ts:19`), so variants arm
and 43 results run. `v-bench-honesty` predicts `--corpus week1 --repeat 3` exits
1, because ten Flow-lane variants expect failures that lane has never been seen
to report, and takes 130-205 minutes headed. That exit is a measurement to
diagnose, not a reason to revert the lanes.

**Open work, ranked by the criterion it blocks.** Each item is as of its report;
re-verify at HEAD before briefing, because settled items were briefed twice on
2026-09-12.
1. **Flow-lane correctness (blocks 1, 3, 4, 5).** A recorded action went missing
   in 12 of 24 runs; the fix is unit-proven, the 24-run reproduction not repeated
   (`L-dropped-action`, `L-race-fix`). Core logs a late event but does not tell
   the client, a contract decision handed back (`L-core-discard`). A failing
   Flow-lane run became an unexplained runner error (`L-replay` defects).
2. **Resolver safety and calibration (blocks 3).** The veto margin belongs to the
   fixture's recording and D14 overstates it (`L-review` 1, `p-openq-triage`
   Group 1); calibration does not transfer live and the floor receives no
   candidates (`L-replay` 3-4). Scoring changes belong in Core
   (`v-matcher-calibration`, D13).
3. **W18 auth-gate replay (blocks 1, 4).** The secret binding's last leg
   (`p-secret-binding`, `p-declared-secrets`) and Core's uncommitted change above.
4. **Failure evidence integrity (blocks 4).** The runtime adapter's failure-record
   guard is disarmed for every extension result, one-line fix measured
   (`v-redaction-producer` item 5); a second evidence producer keeps the
   conditional-spread hole (`v-producer-safety`); one merge-safety gate is a line
   outside its owner's files (`v-merge-safety`).
5. **Gate hygiene.** `connection.ts` is 764 of 800 lines and its split was blocked
   on a collision that has since cleared (`p-connection-split`); recording-latch
   work waits on it. The `packages/test-runner/src/tests/` ratchet has no headroom
   for `p-test-split`. `p-openq-triage` Band A: the domain runner aborts on the
   first throw, two test-command traps, stale tracked `domain/.test-build/`.
6. **Scope, to settle from the 30-day plan's text rather than by asking:** whether
   Week 1 requires Firefox, and whether a late recording event reaches the client
   as an error frame.
7. **Doc truth.** `L-review` findings 2-9 and `p-openq-triage` Parts 3-4; the three
   architecture pages Phase 1.6b step 4 names must match the finished state.

**Next steps, in order**
1. `/resume` this document; declare `Mode: Execute Plan With Workers`, then
   `Testing And Live Validation`. Confirm both trees against `origin/dev` and
   settle Core's uncommitted change.
2. Dispatch together: one read-only inventory worker writing
   `reports/c-remaining.md` (every item above, `L-review` 1-9, `p-openq-triage`
   Part 3, every Partial or Blocked report, each marked settled or open at HEAD
   with file:line), plus the fixes that need no inventory: the adapter guard, the
   second producer, the `connection.ts` split, the test-runner ratchet, and the
   W18 binding's last leg.
3. From the inventory, brief the rest partitioned by file: resolver calibration
   (Core, user alerted first), the Flow-lane error path, drift rows on realistic
   fixtures, doc truth.
4. Live campaign from
   [live-validation-plan.md](./mvp-week1-web-automation-reliability-plan/live-validation-plan.md),
   one Lab instance per worker: step 4, step 4b (24 runs against the race fix),
   steps 5, 6 and 8, then step 7
   (`FLUXIQ_TEST_ENV_FILES=none pnpm lab bench --corpus week1 --repeat 3 --target isolated`)
   twice.
5. Phase 1.6b: rank blockers from both bench reports, confirm `demo:record` then
   `demo:run` provider-free, update the architecture pages, record Week 2 entry
   points.
6. Close: an observation quoted for every criterion row; root `pnpm check`,
   `pnpm test`, `pnpm build`, the content harness and Core run one at a time;
   push both `dev` branches.

**Everything is tested: the operating rules.**
- Three tiers per change: unit (`tests/` beside the subject), content harness,
  Lab. A guard is done only when a mutation shows its test failing.
- Commands that work here: content harness
  `pnpm exec playwright test -c e2e/playwright.content.config.ts --workers=4` from
  `apps/extension` (the `pnpm --filter ... test:content --` form finds no tests);
  Core tests `npx vitest run --no-file-parallelism`; isolated Lab commands need
  `FLUXIQ_TEST_ENV_FILES=none`.
- Faulty RAM: a rare, uniform or impossible failure is rerun once, alone, before
  it is chased; heavy gates run one at a time; the false-failure shapes are in
  `live-validation-plan.md`.
- One supervisor session per repository. On 2026-09-12 two sessions committed
  each other's in-flight work, once capturing a tree mid-mutation. Workers never
  commit.

**Blockers:** none needing the user. The first action is Core's uncommitted change.

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

- **D13 — Core charges a missing stable identifier less than a contradicted
  one.** Accepted by the supervisor 2026-09-12 on measured evidence, and it is a
  change to Core's published element matcher, not a downstream tweak.
  Level 2 scoring could not succeed: reaching it requires the recorded
  identifiers to be gone, and Core charged their *absence* nearly as heavily as
  a *contradiction*. Proved exhaustively — of 9,720 candidate profiles that can
  reach Level 2 against the test descriptor, none cleared the 0.35 floor; the
  maximum was 0.233. `MISSING_STABLE_IDENTIFIER_SIMILARITY` is now −0.1 against
  `CONTRADICTED_STABLE_IDENTIFIER_SIMILARITY` at −0.8.
  Two alternatives were rejected **by measurement**, not preference. Lowering the
  floor admits a genuinely different action: a lone "Save changes and exit"
  button scores 0.088 and resolves with no runner-up and therefore no margin,
  0.130 from the case we want, so any floor between them is fitted to a hair.
  Normalizing over answerable weight inverts the scale — the less a candidate can
  answer the higher it scores, and a bare `<button></button>` reaches 1.000 and
  gets clicked.
  Result, every figure measured before and after: the drift case rises 0.218 →
  **0.389** and resolves; the near-miss stays **0.088** and is refused;
  separation widens from 0.130 to 0.301. The safety cases are unchanged and
  still refused — Discard at −0.360 against the real Save at −0.375, and the
  nameless buttons. `ambiguous-targets` still resolves the recorded twin at
  1.000 against 0.382, confirmed by measurement rather than by argument.
  **The accepted cost.** Core's matcher is published, and one seam loosened: a
  candidate matching visible text and accessible name exactly but carrying no
  ID rises from confidence 0.428 to 0.577, crossing the `safe` (0.45) and
  default (0.5) rungs of Core's ladder. `review`, `privileged` and `destructive`
  still refuse it. The supervisor accepts this: such a candidate answers
  everything it can be asked and differs only by lacking an identifier, which is
  precisely the distinction the change exists to draw, and the tiers guarding
  destructive work are unmoved. One profile also crosses zero, so
  `element_target.no_match` becomes `element_target.below_confidence` — the same
  category, a more accurate code.
  **This change and the downstream `reworded-aria` spec row must ship together.**
  Flipping the constant back was measured to turn that row red. Push both `dev`
  branches in one unit.

- **D14 — Level 1 selects, the scorer vetoes.** Accepted 2026-09-12. The
  largest safety exposure found in this plan: Level 1's class-set query resolved
  and **clicked** `<button class="btn btn-primary">Delete workspace</button>` on
  a page whose Save button had been replaced, with no score and no floor, while
  Level 2 refused a 0.218 near-certainty. Every safety property built this week
  guarded only the path that was already cautious.
  A Level 1 match is now scored and refused if the candidate contradicts the
  recording, **and refused again if nothing the recording named agrees on it**.
  Two rules, because one was not enough; the second was added on 2026-09-12
  after the first proof was found to cover only half the question.
  **Rule 1, the threshold, is 0 and not the 0.35 selection floor.** The two
  answer different questions: the floor asks "is this good enough to choose
  among several", the veto asks "is this so wrong that acting is dangerous".
  Zero is a statement rather than a fitted value — `normalizedScore` is agreeing
  weight minus disagreeing weight, so below zero the page contradicts more than
  it confirms.
  **What rule 1 was actually proved over, and what it was not.** The original
  enumeration varied the *candidate* — every profile a weak Level 1 query can
  land on, 1,488 class-reachable and 240 text-reachable — and found none whose
  label contradicts the recording reaching 0, on either scoring scale. That is
  exhaustive over the candidate axis and it holds. It is **not** exhaustive over
  the *recording* axis, which it held fixed at a descriptor carrying both an id
  and a test id; those two supply most of an impostor's negative weight, and
  `normalizedScore` divides by the weight of the signals the recording carried,
  so a thinner recording loses that weight from numerator and denominator at
  once. Re-run across 16 recording classes (id, test id, visible text and
  accessible name each present or absent), rule 1 alone separates for **3** —
  the three carrying a stable identifier *and* both text signals. In the other
  13 an impostor is acted on, the worst at **+0.563**. The ordinary case is the
  plain one: a control with no id and no test id, recorded with its text and its
  name, is landed on by a nameless icon button wearing the recorded class set at
  **+0.010**, and clicked.
  **Rule 2, corroboration, closes 12 of those 13.** If the recording named
  anything distinguishing — visible text, accessible name, label, id, test id —
  at least one of them must agree on the candidate at any of Core's positive
  rungs. Measured over the same enumeration it refuses 240 impostor profiles,
  **none** of which Level 2 then re-resolves (the highest scores 0.302 against a
  floor of 0.35), and **not one** profile whose label agrees or partly agrees —
  free by construction, since an agreeing label is itself the corroboration.
  All four `identity-drift` modes still resolve; the tightest, `selector-only`
  at 0.149, is precisely what a veto set at the floor would have destroyed. No
  strategy is exempt, and that was measured rather than conceded — an id
  exemption saves nothing and would admit 339 profiles where an identifier
  survived onto a relabelled control.
  **The alternative was measured and rejected.** Refusing a class-set or
  bare-text match outright whenever the recording carries no stable identifier
  costs 306 legitimate resolutions across the four identifier-less recording
  classes — 115 whose label agrees exactly — to stop 84 impostors, 16 of which
  return through Level 2 anyway. A common failure traded for a rare wrong click.
  **An interaction with D13 to watch.** The Core weighting change moved the worst
  impostor from −0.203 to −0.032, so headroom below the veto line is now 0.032
  rather than 0.203 — the safety margin shrank sixfold as a side effect of a
  change made for a different reason. It is still on the right side, and
  `veto.test.ts` asserts the *separation* rather than any absolute value, on
  both axes, so a further weight change in either repository fails the build
  rather than silently eroding it. Treat that test as the guard on D13, not only
  on D14.
  **Two limits remain open**, both measured, and one of them is the 13th
  recording class. A recording that names **nothing** — no text, no accessible
  name, no id, no test id, only a class set and a structural path — cannot be
  protected: it asked no question a candidate could answer, so refusing would
  only be the class-set strategy disagreeing with itself. An impostor reaches
  **+0.563** there and Level 2 would resolve it too. And an impostor that
  carries the recorded label passes by construction, because the label is
  exactly what corroborates.
  **The wider precondition was queried and measured, and it stands.** An
  identifier counts and not only a label, so the veto also runs on the
  `coordinates` and `visual-target` strategies. Over those, narrowing it back
  would act on **120 more profiles and not one carrying any signal the
  recording named**: a point runs only after the recorded selector missed, and
  for a single-identifier recording that selector *is* the identifier. The
  feared fresh-point-beside-stale-descriptor case has no producer: `coordinates`
  is declared by no web action, and a `visual-target` is derived from the
  recorded element, so its point is as stale as the descriptor. The cost is
  narrow and real: **29 of 587** live fixture descriptors (4.9%) carry an
  identifier and no text, name or label, and for those a changed identifier
  fails `TARGET_NOT_FOUND` rather than clicking whatever holds the recorded
  position — buying 96 class- and 120 point-reachable impostors, worst +0.302.
  Measurements: `reports/v-level1-veto.md`, `reports/L-veto-recordings.md` and
  `reports/p-veto-coords.md` (point strategies, and the descriptor census).

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
`2026-09-11-wave-1-ledger.md` through the Wave 2 integration, and the
`2026-09-12-*` Wave 3 and live-validation files.

### 2026-09-12 — Compaction at handoff

- Agent: supervisor
- Changed: this document; `archive/2026-09-12-decisions-d1-d12.md` (D12
  appended); new `archive/2026-09-12-superseded-plan-sections.md`.
- Why: The handoff rewrite took the document to 851 lines. D12 was still in the
  plan although the Decisions intro said D1-D12 were archived, and the archive
  held only its title, so D12 was moved there verbatim rather than deleted. The
  wave table, the risk list, and the Phase 1.1 and 1.6a landing narratives are
  superseded and moved whole, each leaving a pointer.
- Validation: `grep -n "D12"` on the decisions archive before the move -> the
  title line only; `wc -l` on this document after compaction -> 796.
- Outcome: Accepted
- Follow-up: none.

### 2026-09-12 — Handoff: the next session's objective is finishing Week 1

- Agent: supervisor
- Changed: this document (header, Current State, Worker Briefs, Work Ledger,
  Open Questions); `docs/working/README.md` regenerated.
- Why: The user set the objective of the resuming session: completely finish
  every Week 1 item, using as many subagents as needed, with everything tested.
  Current State had also drifted: it said live validation both ran and was not
  done, and its next steps were the already-finished Wave 3 integration.
- Validation: `pnpm check` -> `check exit=0`,
  `structure-audit: passed (35 warning(s), 17 baselined)`; `pnpm test` ->
  `test exit=0`, extension `# pass 294`, domain `# pass 343`, test-runner
  `# pass 439`, scenario-lab `# pass 197`, every package `# fail 0`. Not run: the
  content harness, any Lab command, Core. Core's eight uncommitted files were
  read, not verified.
- Outcome: Accepted
- Follow-up: the resuming session settles Core's uncommitted trace withholding,
  then runs Next steps.

## Open Questions

Open questions live in [open-questions.md](./mvp-week1-web-automation-reliability-plan/open-questions.md).
