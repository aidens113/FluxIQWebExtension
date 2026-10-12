# t476: a press the page only woke on is pressed again; an unseen effect is not "done"

Worker report for brief t476 (Core-paired). Both trees are on `task/t476-wake-press-cover-and-unseen-effect`. Nothing is committed.

## Outcome

Done. Both parts are implemented and tested. A headed Playwright row reproduces the debug's exact failure on the real
bigbox-retail product page, at point 1129,668. The row fails on the pre-fix `click.ts` and passes with the fix. No paid
run was made.

## What changed and why

### (1) Extension: a layer that covers the control after an unanswered press is not the press's answer

Cause confirmed. `click.ts` (old lines 183-185) returned success whenever the control could not be pressed again after
an unanswered first press, and that included a control that was now covered. With the old click, the new Playwright row
returns exactly the debug's `"the point 1129,668 landed on the target"` success, with nothing added.

- `apps/extension/src/content/actions/click.ts`:
  - When a press gets no answer at all (no request, no change in the control or its section, no navigation, no focus
    move) and a layer then covers the control, the click returns `deps.rejected(... "covered" ...)`. The record is
    TARGET_NOT_ACTIONABLE, or BLOCKED_BY_DIALOG when the layer is a dialog. Its actual is the gate's own detail, which
    names the covering layer, followed by `the page ignored the press, and this layer covered the control during the
    wait, so the press is made once more once the layer is closed`.
  - The record does not state `effect: "unacted"`, because a press was made.
  - The in-page recovery (`recovery/fault.ts`, `obstructed_target`/`blocking_dialog`) already closes the layer through
    its way out and runs the click again. No new runtime path was needed.
  - The extra press is counted per command, so the press made after the layer is closed is never followed by a third.
    - If the page ignores that press too, it fails `output_not_observed`.
    - If the control is covered again, the cover reads as answered. That is the old reading: a layer the press opens
      itself is left open.
  - A control that is disabled or gone after the wait still reads as answered, as before.
  - A press that showed any sign, above all a request (t465), is never pressed again, covered or not. The click does not
    even look for a cover in that case.
  - New closed phrases: `PRESSED_AFTER_COVER` and `IGNORED_AFTER_COVER`. `hitTestValidation` now takes the phrase rather
    than a boolean.
- `apps/extension/src/content/action-runtime/ignored-press/command-presses.ts` (new): a `WeakMap` keyed by the command
  object, which every recovery attempt shares (`actions/execute.ts`). It provides `extraPressesMade` and
  `noteExtraPress`, so `pressAgain`'s one-extra-press bound holds across attempts. It is exported from
  `ignored-press/index.ts` and `action-runtime/index.ts`.
- `apps/extension/src/content/action-runtime/recovery/fault.ts`: comment only. The file said `covered` is produced only
  before dispatch; the comment now names the click's one exception and why it is still safe.

### (2) Domain and Core: a lasting step whose recorded effect never appeared is not done

Where the declared effect was checked:
- A step's `done when:` facts were already checked after success in graph runs (`transition-comparison.ts`,
  `core.step.done_when_false`).
- A lasting step without `done when:` was checked by nothing after success. The build's recorded effect
  (`metadata.routeSignatures.effect`, which rev 2's s9 carried) was read only by state routing. That gap is fixed here.
- Domain `domain/src/runtime/route-state/effect/seen.ts` (new): `webAutomationRouteEffectSeen(effect, observed)` answers
  one of three values.
  - `seen` when `holds` is true.
  - `not_seen` only on strong evidence. All of these must be true:
    - the effect is v1;
    - it has at least 3 added control names (`MIN_ADDED_FOR_ABSENCE`);
    - none of them is on the observed page;
    - the page is not on the path the step moved to.
  - `unknown` otherwise. For example, a second add whose panel reads "Qty 2" still shows part of the effect.
  - It is exported from `effect/index.ts` and bound as `routeEffectSeen` in `domain/src/runtime/host-runtime.ts`.
- Core `runtime/host-runtime.ts`: an optional boundary method `routeEffectSeen?(effect, observed)`, with a new type
  `AutomationStudioRouteEffectSighting`. The change is compatible, because a host without the method is never asked.
- Core `runtime/route-state/signatures/effect.ts`: `automationStudioRouteEffectSeen`. With no host, a host that throws,
  or a malformed answer, it returns `unknown`. It is exported from the `signatures/` and `route-state/` barrels.
- Core `runtime/executor/node-execution/recorded-effect.ts` (new): `automationStudioAttemptWithRecordedEffect`, called
  from `attempt.ts` `finishAttempt` after the host expectation evaluation. `finishAttempt` now also takes `flow`, for the
  observe call's project and flow ids.
  - It applies only to a step that meets all of these:
    - the attempt `succeeded`, and was not skipped or `stateHeld`;
    - it has no expected state of its own (`done when:` still owns those);
    - `automationStudioNodeActLasts`;
    - it has a recorded effect;
    - the host has both `observeRouteState` and `routeEffectSeen`.
  - It observes the page and asks the host again every 500 ms until the node's readiness ceiling. If the answer is still
    `not_seen` at the end, the attempt fails as `core.step.effect_not_seen`: category `output_not_observed`, stage
    `verification`, not retryable.
  - The comparison is marked `hostEvaluated`, so `assess.ts` treats the failure as found after acting. A lasting act is
    therefore never made again on the page's silence, which matches the t413 rule.
  - A failed attempt is excluded by `service/candidate-trial/landed-acts.ts`, which counts only `succeeded`. The ledger
    (t475) therefore never receives the step, and playback does not go on as if it were done. I did not edit `landed-acts.ts`.
- Docs updated:
  - Core `docs/architecture/automation-studio.md` (the effect-check paragraph);
  - extension `docs/architecture/web-capabilities.md` (Click row);
  - extension `docs/architecture/page-evidence.md` (route effect paragraph).

## Commands run and observed results

- `EXTENSION_TEST_BUILD_LABEL=t476 node scripts/test-extension.mjs src/content/actions/tests/click.test.ts
  src/content/action-runtime/ignored-press/tests src/content/action-runtime/recovery/tests` (in `apps/extension`) printed
  `# tests 159 / # pass 159 / # fail 0`.
  - New rows: timed cover after a waking press (pressed again, once, after one `obstructed_target` clear); a press made
    once more and ignored too (fails, never a third press); a request-starting press with a later cover (one press, no
    clear, no cover look); a second cover read as answered; disabled or gone not pressed again; the cover refusal's
    record and that it states no `unacted`.
- `command-presses.test.ts` (3 rows) printed `# pass 3`.
- `node scripts/test-content.mjs -- e2e/content/tests/press-answers/tests/wake-press-cover.spec.ts --headed` printed
  `1 passed`.
  - Real bigbox product page. The card's own timer is held and started 150 ms after the first press.
  - The reply was `"the point 1129,668 landed on the target; the page ignored the first press and a layer then covered
    the control, so the layer was closed and it was pressed once more; the execution recovered on attempt 2 after
    absorbing blocking_dialog, closing 1 dialog ..."`.
  - Two presses were counted, and the cart line has qty 1.
- The same row with the HEAD `click.ts` swapped in printed `1 failed`, Received `"the point 1129,668 landed on the
  target"`. I then restored the fixed `click.ts`; `git diff --stat` confirms it.
- `node scripts/test-content.mjs -- e2e/content/tests/press-answers e2e/content/tests/click.spec.ts --headed` printed
  `23 passed`.
- `pnpm run check` in `apps/extension` printed exit 0. The first run failed TS2554 in my spec (`addInitScript` takes one
  argument); I fixed that before the passing run.
- Core libraries rebuilt with `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket
  build`. Core's own `pnpm run check` in `packages/fluxiq` printed exit 0.
- `pnpm run check` in `domain` printed `core-build: ... current with its source`, exit 0.
- `DOMAIN_TEST_BUILD_LABEL=t476 node scripts/test-domain.mjs src/runtime/route-state` printed `# pass 25 / # fail 0`.
- `... seen.test.ts src/runtime/tests/host-runtime` printed `# pass 23 / # fail 0` (6 new rows).
- `... src/runtime/tests/state-routing-run.test.ts .../plan-resolution/tests/act-effect.test.ts src/runtime/act-landing`
  printed `# pass 18 / # fail 0`.
- Core `npx vitest run .../executor/node-execution/tests/recorded-effect.test.ts` printed `6 passed`.
- Core `npx vitest run src/programs/automation-studio/runtime/executor src/programs/automation-studio/runtime/route-state`
  printed `101 files, 875 tests passed`.
- Core `vitest .../route-state/signatures` printed `12 passed`, including the new wrapper row.
- Core structure audit: `node scripts/structure-audit.mjs` printed `passed (334 warning(s), 1159 baselined)` and "2
  baseline entries can be lowered". I did not run `structure:baseline`, because it is a shared file.
- Extension structure audit: `node scripts/structure-audit.mjs` printed `passed (187 warning(s), 646 baselined)`.

## Not verified

- No live Lab run (none was authorised): the round-11 behaviour end to end, through Core, the trial ledger and judges.
- (2) on real pages:
  - I have not measured a live false `not_seen` rate on the ten scenarios.
  - The highest-risk case is a row-bound or looped lasting step whose 3 or more sampled added names are all specific to
    the recorded row. Every one of those names could be missing on a later row, which would fail a working step and not
    retry it.
  - A step whose answer is a transient toast that disappears before the first observation has the same risk.
- Firefox content build, and the full `pnpm check` and `pnpm test` suites (the twice-daily rule).
- The trial feedback text does not yet say "s9's effect did not appear". It carries the step's failure code and message
  through the existing feedback path. I did not inspect how judges render it.

## Open questions or contradictions found

1. **Retry versus refuse for `effect_not_seen`.** The brief cites "every node retries automatically". The debug's fix 2
   suggests the step "retry under every node retries". I made it a verification failure that is not retried, because
   Core's standing rule (t413, `assess.ts`) never repeats a lasting act on the page's silence: the page not showing the
   effect is no proof the act did not happen. With (1) in place, the bigbox case is retried in-page instead. If the
   supervisor wants Core to retry on `not_seen`, change it in `recorded-effect.ts` by returning `effect: "unacted"` with
   `retryable`. That is a double-act risk.
2. **t475 coordination.** I did not edit `site-reset/`, `result-summary.ts` or `landed-acts.ts`. A failed attempt already
   drops out of `automationStudioCandidateTrialLandedActs` (status `succeeded` only). If t475 builds trial acts some other
   way, it should read the attempt's status or the failure code `core.step.effect_not_seen`.
3. **Inside the press's own window.** A client-only answer with no request, no change in the section and no focus move,
   followed by the press opening its own layer, now costs one close-and-press cycle, bounded to one extra press. A
   client-side cart drawer that adds with no request and moves no focus could add twice. The existing ignored-press
   design already accepts this risk for an uncovered control (`press-scope.ts`, "the cost"). Covered or not, a request
   still forbids a second press.
