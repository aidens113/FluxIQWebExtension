# t447: a step a build created knows its own effect

Worker report for brief t447 (Core-paired). Branch `task/t447-step-effect-route-signature` in both worktrees
(`fxwork/t447/!FluxIQWebExtension`, `fxwork/t447/!FluxIQ`). Nothing is committed. `git mv` staged one rename
(below); nothing else is staged.

## Outcome

Done. A step the build acted on now carries what its act made true as `routeSignatures.effect` on its Flow
node. A run that cannot find the step's saved control, on a page that already shows that effect, passes the step
over as already done (`effect_holds`). A build test's check of such a step answers `present`. An effect only ever
skips a step: the repeated-act guard still refuses to send a run back to a completed lasting act.

## What changed and why

### Domain (extension repository)

- **`plan-resolution/act-effect.ts` (new).** `webPlanActEffect(before, after)` is the host's own
  `webAutomationRouteEffect` over the `routeState` of the capture the act was made from and the capture it left.
  These are the same route states `observeRouteState` reads (`snapshot-states.ts`). It returns nothing unless the
  act added at least one control name, because an effect that added nothing never holds. The effect is hashes
  only, never the control's identity.
- **`plan-resolution/target-packets.ts`.**
  - `acted(scope, handle, before, after?)` now keeps the effect beside t442's acted identity
    (`ActedTarget = PageTarget & { effect }`). The effect comes from the first act only, like the identity.
  - `actedAs` copies the effect onto the resolution (`effect?: JsonObject` on the ok resolution). This happens
    only under `view_history`, only where the acted identity applies, and only at the same address.
  - The header has a new t447 paragraph.
- **`node-run/run.ts`.** One token: `acted(..., current, after)`. The line count is unchanged at 798.
- **`plan-resolution/resolve-plan-node.ts`.**
  - The effect is threaded through `Resolved` (`$state` targets included) and the node outcome, and through Run
    Output payloads.
  - The answer carries `effect` only for a step (not a fact, and not `gatedByCaller`) and only under
    `view_history`.
  - `WebPlanNodeResolution` gains `effect?: JsonObject`.
  - I reflowed three header paragraphs to 118 columns to keep the file at 799 lines (budget 800). No wording
    changed.
- **`node-run/verify.ts`.** When Core sends `effect` with a `replay: "verify"` call, the check takes the page (not
  shown unless it answers). If `webAutomationRouteEffectHolds(effect, page.routeState)`, it answers
  `core.replay.present` before checking the control. Otherwise it goes on exactly as before. Nothing is run either
  way. The header has a new paragraph.
- **Required outside the named files: `fnv1a` moved to a leaf directory.**
  - Moves: `llm-evidence/state-digest/fnv1a.ts` to `runtime/hash/fnv1a.ts` (via `git mv`), plus a new
    `runtime/hash/index.ts`.
  - Import updates: `state-digest/state-digest.ts`, `state-digest/index.ts` (the `fnv1a` re-export is gone; only
    `route-state/page-features.ts` used it) and `route-state/page-features.ts`.
  - Why: the first version failed the import-cycles audit in 5 modules. `route-state/effect/*` reached the
    `state-digest` barrel through `page-features`, then `snapshot-states`, the route-state index, `project.ts`,
    the llm-evidence index and back to `plan-resolution`.
  - With the hash as a leaf, `route-state/effect` is cycle-free. The audit now passes, and reports one baseline
    entry that can be lowered.

### Core (`!FluxIQ`)

- **`llm/harness-options/plan-parameter-resolution.ts`.**
  - A resolved answer may now carry `effect` on any resolution, candidate or draft. `handleViews` is still
    accepted only with `handleReach`, and the new `keysWithin` keeps every other key refused.
  - The effect is read with `automationStudioReadRouteSignature`: a non-empty object within 2,048 characters. A
    malformed effect refuses the node as `bootstrap.parameter_resolution_invalid`.
  - The effect is written onto the plan node as `routeSignatures.effect` only where the node has no effect yet. An
    effect the build routing signed from the step's own pages stands.
  - A fact's answer keeps no effect.
  - The import is from the `route-state/signatures` leaf barrel. The header has a new t447 paragraph.
- **`llm/harness-options/binding.ts`.** `AutomationStudioPlanNodeResolution`'s resolved member documents
  `effect?: JsonObject`.
- **`llm/node-tools/replay.ts`.** `automationStudioNodeReplayVerifyCall` adds `effect` when the step carries a
  valid `routeSignatures.effect`. Steps re-seeded from a Flow node carry one (`draft-from-flow.ts`). The step call
  is unchanged. The header vocabulary is updated.
- **`flow-draft/verify-only.ts`.** Header only: `present` may now also come from a recorded effect.
- `adaptation.ts`, `state-routing/decision.ts` and `repeated-act.ts` are unchanged; they already carry and read
  `routeSignatures.effect`.

### Docs

- **Core `docs/architecture/automation-studio/llm-flow-bootstrap.md`.** A new paragraph after the route-signature
  and effect paragraph covers:
  - the domain effect on resolution;
  - the bound and refusal;
  - the build's own effect standing;
  - facts;
  - skip-only;
  - the verify call's `effect`.
- **Extension `docs/architecture/page-evidence.md`.** A new paragraph after the `signRouteEffect` /
  `routeEffectHolds` paragraph covers:
  - the acted effect in the target store;
  - when it is kept;
  - candidate-only answers;
  - hashes only;
  - `present` from a recorded effect in `verify.ts`.

### Tests

- **Domain `plan-resolution/tests/act-effect.test.ts` (new, 3 rows, through the node runner):**
  1. After exploring look, press "Get coupons" (which becomes "Collected"), look:
     - a candidate's (`view_history`) resolution of the coupon carries `effect`;
     - the effect is `web-effect.v1`, holds no "Collected" and no selector, and is at most 2,048 characters;
     - it holds on the route state of a page that already holds the coupon, and does not hold on a fresh page.
  2. No effect where none applies:
     - exploration's own (`gatedByCaller`) resolution carries none;
     - a legacy (no reach) resolution carries none;
     - a press that left the same route state (Share) carries none.
  3. The build test's check of R4b's wordless saved step on a collected page:
     - with the effect it answers `core.replay.present`;
     - without the effect it answers `core.replay.verified` (R4b's wrong answer);
     - with the effect on a fresh page it answers `verified`;
     - no `web.dom.click` is ever dispatched.
- **Core `llm/harness-options/tests/plan-step-effect.test.ts` (new, 5 rows):**
  - a candidate node gets `routeSignatures.effect`, and a node with no effect gets nothing;
  - on the draft path, the effect is added beside the build's `before`, and the build's own effect is never
    replaced;
  - malformed effects (`{}`, `[]`, a string, `null`, oversized) are refused as `invalid`;
  - `handleViews` is still refused without `handleReach`, even when an effect is present;
  - a fact's answer keeps no effect.
- **Core `executor/state-routing/tests/created-step-effect.test.ts` (new, 4 rows, the whole path).** The path is
  model plan, then `resolveAutomationStudioFlowBootstrapPlanParameters` (`view_history`, `writtenByModel`), then
  `validateAutomationStudioFlowBootstrapPlan`, then `normalizeAutomationStudioFlowBuildPlan`, then
  `runAutomationStudioGraph` with a fake host:
  1. only the coupon node's metadata carries `{ effect }`;
  2. on a page showing "Collected", the coupon's control is not found and the attempt succeeds with
     `stateRouting.outcome: "effect_holds"`, with no failure and no recovery decision; the presses are
     `open, coupon (lookup), add`, and the host is asked once;
  3. on a fresh page the coupon runs (`route: success`, no `stateRouting`);
  4. with the coupon's draft-signed `before`/`after` plus the domain effect, a later step that cannot run on the
     coupon's starting page is refused `repeats_lasting_act`, both when the page shows the effect and when it does
     not; the coupon is pressed once.
- **Core `llm/node-tools/tests/replay.test.ts` (+1 row):**
  - the verify call sends the node's recorded effect;
  - the step call does not;
  - a missing or malformed record sends none.

## Commands run and observed results

- **Domain typecheck.** `npx tsc -p tsconfig.json --noEmit` gave `src_tsc=0`, and
  `npx tsc -p tsconfig.test.json --noEmit` gave `test_tsc=0`. This is the final run, after the `fnv1a` move.
- **Domain tests.**
  - `DOMAIN_TEST_BUILD_LABEL=t447 node scripts/test-domain.mjs llm-evidence/plan-resolution/tests llm-evidence/node-run/tests route-state llm-evidence/state-digest/tests ...`
    gave `# tests 439 # pass 439 # fail 0`.
  - `... tests/state-routing-run.test.ts tests/host-runtime.test.ts` gave `# tests 21 # pass 21 # fail 0`.
  - Earlier failing runs were test-code mistakes, now fixed:
    - a default parameter swallowed `undefined`;
    - t442's F5 floor refuses the wordless legacy resolution, so that row now asserts only that no effect is
      answered;
    - Share's press read as `pageChanged` because the evidence JSON differed, so that row now compares route
      states.
- **Domain mutation checks.**
  - With `actedAs`'s effect line removed, `act-effect.test.ts` failed rows 1 and 3.
  - With `verify.ts`'s `present` return disabled, only row 3 failed, with `expected: 'core.replay.present' actual:
    'core.replay.verified'`.
  - Both files were restored.
- **Core vitest (final).** Directories run:
  - `llm/harness-options/tests`, `llm/node-tools/tests`, `executor/state-routing/tests`;
  - `service/flow-bootstrap-commands`, `flow-draft/tests`, `flow-bootstrap/candidate/tests`;
  - `flow-bootstrap/tests/route-signatures.test.ts`, `executor/tests/state-routing-run.test.ts`,
    `executor/tests/safe-state-routing-run.test.ts`, `route-state`.

  The result was `Test Files 113 passed (113)  Tests 1035 passed (1035)`.
- **Core mutation check.** With the `routeSignatures.effect` write disabled, the two new Core files gave
  `Tests 6 failed | 3 passed (9)`. The file was restored.
- **Core typecheck.** `npx tsc --noEmit` in `packages/fluxiq` gave `core_tsc_exit=0`. An earlier run failed with
  TS2375 in the new test (`nativeNodeExecutor` optional type); that is fixed.
- **Core structure audit.** `node scripts/structure-audit.mjs` gave
  `structure-audit: passed (330 warning(s), 1159 baselined).` The first run failed 3 barrel-import violations,
  which are fixed.
- **Extension structure audit.** `node scripts/structure-audit.mjs` gave
  `structure-audit: 1 baseline entries can be lowered ... structure-audit: passed (184 warning(s), 646 baselined).`
  The first runs failed:
  - 5 import-cycle violations, fixed by the `fnv1a` move;
  - 1 contract-spread violation in the new test, rewritten without conditional spreads.
- **Core dist.** `pnpm --filter fluxiq build` was rebuilt after the final Core edit.
  `node scripts/check/core-build.mjs` then reported `FluxIQ Core's build at ...\t447\!FluxIQ is current with its
  source.`
- No Lab run, no provider call and no browser.

## Not verified

- **Live behaviour.** Nothing ran in a browser or the Lab. Two things are open:
  - whether real crossborder pages give the coupon press an effect whose `added` hashes survive to the replay
    page. The effect is whole-page: a toast or other transient control added by the press makes it not hold later,
    which falls back to the old behaviour (no skip). It never causes a wrong skip;
  - whether the extension's identity veto refuses "Collected" for the t442 identity. That is unchanged by this
    task; the `present` answer from the effect no longer depends on it.
- **The verify effect needs a step that carries `routeSignatures`.** These are re-seeded steps from a saved Flow,
  such as R4b's repair build test. A fresh draft step's check gets no effect, because Core's build routing
  effects are looked up only at assembly.
- **Whole package suites** (`pnpm check`, `pnpm test`, Core's full vitest) were not run, per the twice-a-day rule.
  The apps/extension typecheck was not run (no extension source changed).
- **`pnpm structure:baseline` was not run.** It would lower one import-cycle entry after the `fnv1a` move. I left
  `.structure-baseline.json` untouched to avoid colliding with other workers; the supervisor may run it.

## Open questions or contradictions found

1. **Effect scope.** I used the existing whole-page route effect (`added`/`removed` control hashes), the same form
   Core's build routing records on the draft path, rather than the acted control's own words alone. This is
   conservative: a narrower effect (only "Collected") could make another store's "Collected" coupon skip this
   store's step. The cost is that transient additions keep the effect from holding. The supervisor may want a
   control-scoped effect later; that would be a new `web-effect` version.
2. **Precedence.** Where a plan node already has a build-signed `routeSignatures.effect` (the draft path), the
   domain's effect does not replace it. In practice the domain answers an effect only under `view_history`
   (candidates), whose model-written signatures are stripped, so the two never meet today.
3. **Repair-written steps (t429 packet path) carry no effect.** They resolve without `view_history`, so `acted` is
   not consulted.
