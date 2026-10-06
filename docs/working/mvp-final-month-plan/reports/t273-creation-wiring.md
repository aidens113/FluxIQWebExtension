# t273-creation-wiring: creation blockers that needed t264's files

Lead: t273-creation-wiring (lead). Date: 2026-10-05. Trees: `fxwork/t273/!FluxIQ` (Core, branch `task/t273-creation-wiring`) and `fxwork/t273/!FluxIQWebExtension` (downstream; only this report changed). S1 was committed by the supervisor (Core f83eeb5a). Stages: S1 B7 binding affordances (done); S2 D phase 2 (done, below); S3 P5 wiring not started.

## Current State

S1 is committed. S2 is done and validated in Core and waits for the supervisor to commit it and apply the two-line service.ts seam (see S2 outcome). S3 is waiting.

## S1 — B7 binding affordances

### What dev already had, and what was missing

- Dev (t262 `run-musp4h2f`, then t264 S4) already answers a bind of a press's shown `target` with `bind_new_key` + `control: true` ("a press has no value to vary ... leave that step as it is"). That covers the B7 cause for presses.
- Still missing (the t269 S1 brief and `b7-binding-feedback-causality.md`): a screened list of what a step does offer `bind`. The draft showed only `input`, and the refusal reason still ended with "or rerun the step with the new parameter first".
- Codex's WIP (`wip/t262-uncommitted`, Core `c5521e86`) did not apply mechanically. `amendment.ts` is now the `amendment/` directory, `entry.ts` and the feedback text changed, and the WIP's feedback hunk lacked its import. The WIP's projection was reused and reworked. Its feedback position lookup was not reused (see decision 3).

### Decisions

1. **The projection**, `automationStudioFlowDraftBindablePaths` (new `R/flow-draft/bindable/{paths,index}.ts`), lists the dotted parameter paths at which the shown `input` and `ranWith ?? input` hold the same value:
   - It is read from the shown input only, so no private resolved key or value is ever named.
   - It never maps a shown alias to what it resolved to.
   - A stored binding counts as one path. Nothing inside a binding, an array or a null is listed.
   - It is an affordance, not a rule: `bind` still checks `ranWith` and may accept more.
2. **The draft shows `bindable` only where the shown input misleads.** It appears on a step in the Flow only when its list is shorter than the paths its own input shows:
   - a Web press therefore shows `bindable: []`;
   - a step that ran as shown pays nothing;
   - one 165-byte instruction sentence is added only when any step shows the field.

   Measured reason: listing it on every kept step pushed the seven-step build in `tests/deepseek-bootstrap/tests/answerability.test.ts` from 4,928 to 5,302 bytes against its 5,000 budget. The generic fixture has no `ranWith`, so every list repeated the input.
3. **The refusal carries `bindable` from its source.** `amendment/bind.ts` computes it from the step it examined, and `amendment/apply.ts` copies it onto the `bind_new_key` refusal (new optional `bindable` on `AutomationStudioFlowDraftAmendmentRefusal`). The feedback passes it on.
   - Why: refusal `step` numbers use the numbering the model was shown, while `context.draftSteps` positions are current after moves. A lookup by position after a decision that reorders or drops steps could describe the wrong step.
   - The existing `nextStep` lookup in `llm/draft-amendment-feedback.ts` has the same latent mismatch. It is not changed here.
4. **New `bind_new_key` reason text:** "... Otherwise bind only a parameter bindable lists beside the refusal: the values of its input the step ran with as shown. An empty bindable means the step has no value to bind." The press (`control`) sentence is kept, and the "rerun the step with the new parameter" advice is removed.

### Changed (Core only)

- New: `R/flow-draft/bindable/paths.ts`, `R/flow-draft/bindable/index.ts`, `R/flow-draft/bindable/tests/paths.test.ts`.
- `R/flow-draft/index.ts` (barrel), `R/flow-draft/entry.ts` (`shownBindable`, `BINDABLE_INSTRUCTION`), `R/flow-draft/amendment/{bind,apply,types}.ts`, `R/llm/draft-amendment-feedback.ts`.
- Tests: `R/flow-draft/tests/entry.test.ts` (4 B7 cases), `R/flow-draft/amendment/tests/apply.test.ts` (whole-object bind regression, design assertion 3; `bindable` on 5 existing `bind_new_key` expectations), `R/llm/tests/draft-amendment-feedback.test.ts` (3 B7 cases).
- Docs: `docs/architecture/automation-studio/flow-authoring.md` (bind section); `docs/reference/framework-reference.md` and `packages/fluxiq/docs/reference/framework-reference.md` regenerated. The only drift is the new export and shifted `entry.ts` line numbers.

### Validation (observed, `fxwork/t273`)

- Fail-first:
  - `npx vitest run .../bindable/tests/paths.test.ts`: "Failed to load url ../index.ts" (module absent).
  - The entry, feedback and apply tests before the source change: 4 failed / 111 passed. These were the 2 entry and 2 feedback projection cases. The whole-object bind regression passed before the fix, as the design predicted.
- `npx vitest run src/programs/automation-studio/runtime/flow-draft src/programs/automation-studio/runtime/llm .../tests/deepseek-bootstrap/tests/answerability.test.ts` (in `packages/fluxiq`): Test Files 177 passed (177), Tests 1749 passed (1749).
- `node scripts/build-cache/cli.mjs fluxiq:check`: exit 0.
- `node scripts/structure-audit.mjs` (Core): "passed (252 warning(s), 349 baselined)". Line-count warnings on `apply.test.ts`, `draft-amendment-feedback.ts` and its test are advisory, and those files were already past 400 lines.
- `node scripts/docs-reference.mjs --check`: exit 0 after regeneration.
- `pnpm.cmd build` (Core): exit 0.
- Downstream:
  - `pnpm.cmd --filter @fluxiq-web-extension/domain check`: exit 0 ("Core's build ... is current with its source").
  - `node scripts/structure-audit.mjs`: "passed (170 warning(s), 118 baselined)".
  - `run-subset.mjs domain t273-s1` + `node --test` on `runtime/tests/carried-row-service-repair`, `runtime/tests/carried-service-repair` and `runtime/llm-evidence/node-run/tests/draft-control`: tests 18, pass 18, fail 0.

### Not verified

- No live run.
- Whether the model now authors the missing cart action on B: the design report says better guidance does not guarantee a B pass.
- The real Web draft byte cost, estimated at about 165 bytes plus about 16 per press and 20 per typed step.

### Live run that proves S1

The B lane, `bigbox-retail-pickup-cart-store-remembered-after-creation` (B7 failed as `run-muteqswo-eb98d55a`), built from the extension chat.

It proves S1 when:

- the draft shows `bindable` beside the cart and size presses (`[]`) and beside typed steps;
- no repeated `bind_new_key` on a press `target` appears in the step log;
- the build either binds only listed paths or leaves the presses as they are.

## S2 — D phase 2: named-route display, wording and enforcement

### Scope decisions (lead)

- **The read stays lazy, as the contract specifies.** The reader is an ordinary `evidence_tool_decision` call, so an eager read would add one call to every build and shift every scripted service test.
  - The route is shown and enforced once the permission gate's shared read has settled; D's confirm press triggers it.
  - The only new trigger is a completion whose first step in the Flow goes deeper than `startLocation`: `open` accepts it, while `named` or `unavailable` refuses it.
  - With no route accessor wired, behaviour is exactly today's.
- **Enforcement surface: completion.** The contract allows "missing coverage reported at the chosen enforcement surface". The model says which steps are on each place with a new `place` claim (`r1`, `"r1,r2"`, `none`), stored as `step.places`.
  - A claim never moves off another step; this differs from `acts`.
  - Completion is refused while a place has no step in the Flow on it, or while places are claimed out of order.
  - No new amendment refusal reason is added, so the activity and UI refusal-word maps stay untouched.
- **The `service.ts` seam (t267's file, specified rather than edited).** At `service.ts:1594`, the `automationStudioFlowBootstrapDraftActs({...})` call gains `route: authority.route, activeInstructions: resolvedInstructions.instructions`.
- **Foundation written by the lead.** Fail-first: "Failed to load url ../index.ts", then 8/8 passing.
  - New `R/flow-draft/route-places/{place-value,set,coverage,route,index}.ts` and `tests/{set,coverage}.test.ts`.
  - The `R/flow-draft/step.ts` `places` field and the barrel export.
  - The shared interface lines: `place?` on `AutomationStudioFlowDraftAmendment`, on the `tool_call` decision type and on the structured response; `route?` on the `automationStudioFlowDraftEntry` input, accepted but not yet rendered.
  - `fluxiq:check` exit 0.

### Brief: t273-s2-w1-draft-grammar
- Repository: Core `fxwork/t273/!FluxIQ` (R = `packages/fluxiq/src/programs/automation-studio/runtime`).
- Task:
  - (1) The amendment grammar takes `place` wherever it takes `act`. The schema in `amendment/schema.ts` uses `AUTOMATION_STUDIO_FLOW_DRAFT_ROUTE_PLACE_VALUE`. `amendment/apply.ts` applies it with `automationStudioFlowDraftSetRoutePlaces`, which counts as applied when it changed something.
    - A `place` that changes nothing, with nothing else changed, is refused as the existing `already_so`.
    - It is valid on a read step too.
    - It adds no new refusal reason.
  - (2) `entry.ts` renders `input.route` (`AutomationStudioFlowDraftRoute`):
    - `named` → `route: {named: <quote>, places: {r1: <words>, ...}}` plus a conditional sentence;
    - `open` → `route: "open"` plus a conditional sentence;
    - per step, `place: step.places.join(",")` after `act`.
    - Write the sentences in the grammar the model really sends, as the existing `act` wording does. The named sentence says: the Flow goes through every place in order; its first step never goes deeper than the first place; say with `place` which steps are on each (`"r1,r2"` for two, `none` to clear); completion is refused while a place has no step in the Flow, or places are out of order. The open sentence says the person named no route, so the first step may go straight to where the work begins.
  - Nothing is added when `route` is absent: the 5,000-byte draft budget in `R/tests/deepseek-bootstrap/tests/answerability.test.ts` must still hold.
- Owns: `R/flow-draft/amendment/{schema,types,apply}.ts`, `R/flow-draft/amendment/tests/apply.test.ts`, `R/flow-draft/entry.ts`, `R/flow-draft/tests/entry.test.ts`.
- Must not touch: every other file, including `R/flow-draft/route-places/**` and `R/llm/**`.
- Definition of done:
  - Fail-first tests are recorded: place applied, replaced and cleared; `already_so`; and entry named, open and absent.
  - `npx vitest run` on `R/flow-draft` passes, plus the answerability test.
  - `node scripts/build-cache/cli.mjs fluxiq:check` exits 0.
- Report to: `docs/working/mvp-final-month-plan/reports/t273-s2-w1-draft-grammar.md` (downstream t273 tree).

### Brief: t273-s2-w2-decision-grammar-and-wording
- Repository: as above.
- Task:
  - (1) The decision schema and parser in `R/llm/evidence-loop-decision.ts` take `place` beside `act`:
    - on an authoring `tool_call`, where `place` implies `add`, as `act` does;
    - on `amend_draft` amendments;
    - in the exact-key lists;
    - with the value tested by `AUTOMATION_STUDIO_FLOW_DRAFT_ROUTE_PLACE_VALUE`. A bad value is treated exactly as a bad `act` id is.
  - (2) `R/llm/evidence-loop/rerun-replacement.ts` carries `places` to the replacement step, as it carries `acts`.
  - (3) `R/flow-bootstrap/incomplete-draft/parse.ts` keeps a stored step's valid `places`, as it keeps `acts`.
  - (4) `R/llm/deepseek/request-body.ts` `FLOW_START_LOCATION_NOTE`, second sentence: replace "Unless the person's instruction says how to get there (pages, menus or links to go through: then follow that route and keep its steps)," with "Unless the person's instruction names a route to follow (pages, menus or links to go through: then follow it in that order and keep a step in the Flow on each place on it, and once the draft shows route, say with place which steps are on each),". Then end that sentence with "; the completion accepts that only once Core has read that the person named no route." Update the header comment.
  - (5) Append to the build-test verification instruction in `R/llm/diagnosis-instructions.ts`: "When the person's instructions name a route to follow -- pages, menus or links to go through in order -- a Flow that starts deeper than the route's first place, or skips a place on it, does not do what was asked."
  - Respect any length bound a test holds on either text.
- Owns: those five files and their nearest tests only.
- Must not touch: `R/llm/evidence-loop.ts`, `R/llm/loop-configuration.ts`, `R/llm/decision-context/**`, `R/llm/decision-handlers/**`, `R/llm/harness-options/**`, `R/flow-draft/**`.
- Definition of done: fail-first tests for (1)-(3) are recorded; the touched test files pass; `fluxiq:check` exits 0.
- Report to: `docs/working/mvp-final-month-plan/reports/t273-s2-w2-decision-grammar-and-wording.md`.

### Brief: t273-s2-w3-route-wiring-and-completion
- Repository: as above.
- Task:
  - (1) Add a new focused `R/llm/harness-options/draft-route.ts` with `automationStudioFlowBootstrapDraftRoute({route?, activeInstructions?, startLocation?, arrival?})`. Its `route` is `AutomationStudioInstructionAuthorityRoute` from `R/service/instruction-authority.ts`. Import it as a type only; if that import breaks the layering audit, declare the same `{read, peek}` shape locally. With no `route` it returns `{}`. Otherwise it returns:
    - `route()`: `currentAutomationStudioInstructionRoute({reading: route.peek(), activeInstructions})` → `named` gives `{state:"named", quote, places: waypoints by order → quote}`; `open` gives `{state:"open"}`; anything else gives `undefined`.
    - `routeCheck(steps)`: a refused completion check, or `undefined`.
      - Let `first` be the first step in the Flow (`automationStudioFlowDraftStepIsProposed`).
      - A shortcut means `first` goes to `startLocation` by `automationStudioFlowBootstrapDraftStepGoesToLocation`, but its declared arrival value is not `startLocation` itself (trailing `/` ignored). It is not a shortcut when the route is named and `first` claims `r1`.
      - The read is triggered (`await route.read()`) only on a shortcut while the reading is `unread`.
      - A `named` reading refuses a shortcut, and refuses any missing or out-of-order place (`automationStudioFlowDraftRouteCoverage`).
      - A shortcut that is neither `named` nor `open` is refused.
      - Use the exact texts below.
  - (2) `R/llm/harness-options/draft-acts.ts` takes `route?` and `activeInstructions?` and spreads that result.
  - (3) `R/llm/loop-configuration.ts`: `draft.route?()` and `draft.routeCheck?(steps)`.
  - (4) `R/llm/evidence-loop.ts` and `R/llm/decision-context/shown.ts`:
    - pass `route: input.draft.route?.()` to `automationStudioFlowDraftEntry`;
    - apply a `tool_call`'s `place` to the recorded step, beside `act` (~:202-211, :477), with `automationStudioFlowDraftSetRoutePlaces`.
  - (5) On complete, run `draft.routeCheck` before the build's `checkCompletion`. A refusal is fed back and counted exactly like a refused completion check (same evidence entry and no-progress handling).
  - (6) Fail-first tests:
    - (a) a named three-place route with the only middle step dropped refuses completion, naming r2;
    - (b) places out of order refuse;
    - (c) an explicit `open` reading plus a deeper first step is accepted;
    - (d) `unavailable`, and `unread`→`unavailable`, plus a deeper first step refuse;
    - (e) the read is called at most once, and never without a shortcut;
    - (f) with no accessor nothing changes;
    - (g) a loop-level test where the refusal reaches the model as `core.completion_check`.
- Owns: the files named in (1)-(5) and their nearest tests (new test files allowed).
- Must not touch: `R/service.ts`, `R/service/**`, `R/flow-draft/**`, `R/llm/evidence-loop-decision.ts`, `R/llm/evidence-loop/rerun-replacement.ts`, `R/llm/deepseek/**`, `R/llm/diagnosis-instructions.ts`.
- Definition of done: fail-first tests are recorded and then pass; `R/llm` tests pass; `fluxiq:check` exits 0; the structure audit passes.
- Report to: `docs/working/mvp-final-month-plan/reports/t273-s2-w3-route-wiring-and-completion.md`.

#### Exact refusal texts for w3

- Named route plus shortcut: `The person named the route "<quote>": the Flow goes through <words r1>, then <words r2>, ... in that order, so its first step cannot go straight to a deeper address. Rerun step 1 with startLocation, keep a step in the Flow on each place, and say which with place.`
- Missing places: `The person named the route "<quote>". No step in the Flow is on <rK> (<words>)[, ...]: keep or add the steps that go through it, in order, and say which with place (place "<rK>").`
- Out of order: `The person named the route "<quote>". <rK> (<words>) is reached before a place that comes earlier on it: the Flow goes through the places in order, so reorder the steps or correct their place.`
- Shortcut with no confirmed route: `Whether the person named a route could not be confirmed, so the Flow's first step cannot go straight to a deeper address: rerun step 1 with startLocation and keep the steps that travel from there.`

### S2 outcome (lead, after integrating w1-w3)

**Done in Core and validated. Not active until the supervisor applies the `service.ts` seam below.**

Worker reports:

- `t273-s2-w1-draft-grammar.md`: amendment `place`; draft `route` and per-step `place`.
- `t273-s2-w2-decision-grammar-and-wording.md`: decision grammar and parse; rerun carry; stopped-draft parse; start note; judge sentence.
- `t273-s2-w3-route-wiring-and-completion.md`: `draft-route.ts`; draft option; loop shows the route; the call's `place`; the composition helper.

The lead re-ran every claim below.

**Fixes the lead made while integrating:**

1. **The chat never saw a route refusal.**
   - Cause: w3 composed the route check inside the loop (`evidence-loop.ts`), but `service.ts` hands the loop an input the activity observer has already wrapped (`activity/observer.ts` wraps `checkCompletion`). A route refusal returned early, outside that wrapper: the model was told, but no "sent back" card reached the chat.
   - Fix: the loop no longer composes. The caller composes `automationStudioLlmEvidenceLoopRouteChecked` before `observeAutomationStudioEvidenceLoop`, and the helper is exported through the `llm` barrel for that.
   - The loop test now composes, observes, and asserts "The proposed Flow was sent back to be fixed". A guard test asserts the bare loop never asks `routeCheck`.
2. **A real provider reply with `place` was rejected.** `llm/harness/provider-result.ts` allowed only `add` and `act` on a `tool_call`, which w2 found by reading the code.
   - Fail-first: the new `llm/harness/tests/provider-result.test.ts` failed 1/2.
   - After adding `place`, it passes 2/2, and an unknown field is still refused.
3. **`llm` depended on `service`.** `draft-route.ts` imported `AutomationStudioInstructionAuthorityRoute` from `service/`. The shape now lives in `action-permissions/instruction-route/accessor.ts` (`AutomationStudioInstructionRouteAccessor`), and the authority's type is an alias of it.
4. **Pattern style.** The `place` pattern uses plain groups like the `act` pattern, with the same JS meaning. w1's pinned schema test was updated to match.
5. **Docs and headers.**
   - Core `docs/architecture/automation-studio/llm-flow-bootstrap.md`: the stale "Core does not detect a named route" is gone; a new D phase 2 paragraph is added.
   - `flow-authoring.md`: new section "The route the person named".
   - Barrel headers: `flow-draft/index.ts`, `flow-draft/amendment/index.ts`.
   - Both framework references regenerated.

**The `service.ts` seam (t267's file; specified, not landed).** Two edits plus one import. A probe applied them in the t273 tree and then restored the file; `git diff --quiet` is clean.

1. Import `automationStudioLlmEvidenceLoopRouteChecked` from `./llm/index.ts`.
2. Line ~1576: `runAutomationStudioLlmEvidenceLoop(observeAutomationStudioEvidenceLoop(automationStudioLlmEvidenceLoopRouteChecked({ ...the round's loop input... }))))` (one more closing paren at ~1621).
3. Line ~1594: the `automationStudioFlowBootstrapDraftActs({...})` call gains `route: authority.route, activeInstructions: resolvedInstructions.instructions`.

Results with the probe applied:

- `fluxiq:check` exit 0.
- `npx vitest run` on `R/tests/service-bootstrap R/tests/service-authoring R/tests/service-flows R/service/tests R/activity`: Test Files 66 passed (66), Tests 428 passed | 1 skipped.

**Validation (final source, without the probe):**

- Fail-first:
  - lead foundation: suites failed to load, then 8/8;
  - w1: 9 failed | 68 passed;
  - w2: 12 failed | 45 passed, and 2 failed | 17 passed;
  - w3: 2 suites failed to load, then 17/17;
  - provider-result: 1 failed | 1 passed.
- `npx vitest run` over `R/flow-draft R/llm R/flow-bootstrap R/action-permissions R/activity R/service/tests/instruction-authority.test.ts R/tests/deepseek-bootstrap R/tests/service-bootstrap R/tests/service-authoring`: 3524 passed, 1 failed (324 files). The one failure was the pinned pattern, which was then fixed: `apply.test.ts` 46/46.
- Final re-run over `R/flow-draft R/llm R/flow-bootstrap/incomplete-draft R/action-permissions R/service/tests/instruction-authority.test.ts`, plus answerability: Test Files 192 passed (192), Tests 1985 passed (1985).
- Core:
  - `fluxiq:check` exit 0;
  - `structure-audit` "passed (253 warning(s), 349 baselined)";
  - `docs-reference --check` exit 0 after regeneration;
  - `pnpm.cmd build` exit 0.
- Downstream:
  - domain check exit 0 ("Core's build ... is current");
  - audit "passed (170 warning(s), 118 baselined)";
  - `run-subset.mjs domain t273-s2` carried-row, carried-service and draft-control tests: 18/18.

**What it enforces, and what it does not:**

- A named route is enforced at completion through the model's `place` claims:
  - each place has a step in the Flow;
  - the places are in order;
  - there is no first step deeper than the start unless it claims `r1`.
- A deeper first step is refused unless the reading is `open`.
- Claims are not proof: the judge sentence carries the semantic check.
- The read stays lazy, so a build with no permission read and no deeper first step has no reading. Its named route is then held only by the note and the judge (the contract's honest boundary).
- Not built:
  - route intent on a saved Flow and its repair re-seed (contract phase 5);
  - route-aware feedback at edit time (phase 3; completion is the chosen surface);
  - an end-to-end scripted service fixture with a `named` reading.

**Costs:**

- The decision schema grows about 330 B (`authored-draft.test.ts` bound raised from 948 to 1,348, measured 1,235). It sits in the cached head.
- The draft grows about 430 B (named) or about 120 B (open), and only once a route is read.
- The amendment schema description grows about 300 B.

**Live run that proves S2:** the D lane named-route scenario (home, then Friends, then Friend requests, confirm the qualifying requests), from the extension chat, after the seam lands. Its step log must show:

- one `read`-phase call with `route` in its schema;
- the draft showing `route.named` with r1-r3 and `place` on the steps;
- no deeper first step;
- either a completion refused naming the missing place, or one accepted with all three places covered in order;
- the chat showing any route refusal as "sent back".
