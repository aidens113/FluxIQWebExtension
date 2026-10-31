# t799 / w6-headed: headed photo-social proof of P6/W6

## Outcome
Partial. (b) idempotent like is proved end to end. (a) is not: on photo-social the client always closes the layer
itself, so it never reports `obstruction` and Core's `clear_interference` rung is not reached. The spec proves the nearest
path and records one possible Core defect (a trial's close is not learned as a handler).

## What changed
- New `apps/extension/e2e/site-reset/tests/photo-obstruction-toggle.spec.ts` (headed, scripted provider, no model call).
- Additive `resetLab()` on `InstalledBuild` in `apps/extension/e2e/site-reset/installed-build.ts` (POST to the Lab's
  authenticated `/__control/reset`). No existing helper's behaviour changed.

## What the spec does
Explore: open the profile, open the liked post's dialog from its grid cell, press its Like. Submit a Flow: profile, press the
other post's cell (opens that post's dialog), press the liked post's cell (under that dialog), press Like. Trial 1; then
`resetLab()` (consent unanswered, nothing liked); trial 2 (a revision with one trailing look); trial 3 (another).

## Assertions observed (b), idempotent like
- All three trials answered `yes`.
- Trial 1, labelled steps all `succeeded`; the like step: `skipped: "Its control already showed the asked state, so it was
  not pressed."` Activity row: `Not pressed: like the post already showed the asked state`.
- The judge's site change for trial 1 lists the like act as `already_in_state` (one act).
- The page after trial 1 still shows the post's `Unlike` control (`article section > [role=button]:has(> svg[aria-label="Unlike"])`
  visible): left liked, never un-liked.
- Every judge request carries an `ensureState` for the like step (the explored press's toggle signature; the Flow's like step
  `parameters.ensureState` is `{via:"name", gains:["unlike"], loses:["like"]}`).
- Trial 3 (after trial 2 pressed the like on the reset site) skips the like again, `already in the asked state`.

## Assertions observed (a), nearest path actually reachable
- Trial 1, step "open the post" (pressed under the first post's dialog): the client closed that dialog itself. Trial feedback
  `interruptions: [{kind:"other", said:"A dialog was over the page, and the run closed it by itself. ..."}]`; activity row
  `Recovered: Closed a dialog the page put in the way`.
- Trial 2 (consent pending again after the reset): `kind:"overlay"` named layer closed by the client; activity row
  `Recovered: Closed something the page put over itself`, then the dialog row as in trial 1.
- 4 interference activity rows in total, all `outcome: "succeeded"`; no activity event with status `failed` and none
  reading "didn't work".
- Wire, from the gateway's `executeAction` answers: 4 `clearedLayers` (kinds other, overlay, other, other), each with `id`
  and `controlRef`; the overlay also with `name`. **No `obstruction` object on any answer.**

## Why the rung is not reached on photo-social
`apps/extension/src/content/actions/execute.ts:150` runs `runWithRecovery`, whose intervention presses a way out
(`interference/press-ways-out.ts`) before Core sees the failure. Only a layer it spares survives to be reported as
`obstruction`: the one holding the step's target, or a layer the run opened and `interference/run-opened.ts:41-80` ties to
the pressed control by containment, shadow host, `aria-controls` or `aria-expanded`. photo-social's post dialog is appended
to `body` by a click handler in `grid-script.ts` with none of those, the consent overlay and upsell likewise, and the site has
no `aria-expanded` or `aria-controls` anywhere. The consent decline variant (`consent-redesign`) is also closed in page:
"Only allow essential cookies" matches `vocabulary.ts:110`. A Lab change (outside my paths) would be needed for a layer
that is run-opened. Not proved here: `obstruction` on a failed attempt, the rung's transient press, "Closed
something..." from the rung, `learnedFrom: "trial_close"` at runtime.

## Possible Core defect (not fixed; not asserted)
After trial 2 closed the named consent overlay (client sent `kind overlay`, `id`, `name`, `controlRef`), the next submission
(revision 3, `changedPaths: ["plan.subflows.0.edges.4","plan.subflows.0.nodes.5"]`, only the added look) carries no
`trial_close` handler, and trial 3's plan has no handler nodes ("7 steps" = arrival, 4 Flow steps, 2 looks). Cause not
determined. Candidates: `flow-bootstrap/layer-handlers/explored.ts` ends with `if (!validation.ok ...) return input.buildPlan`
(silent fallback when the lowered plan fails validation, e.g. the `controlRef` as a `target` parameter); or
`flow-bootstrap/explored-interruptions.ts:92-106` `trial()` dropping the layer (needs `wayOutDefinitionId` and a `controlRef`
after Core's parse in `executor/node-execution/cleared-layers.ts` `pressedBy`, which keeps both only beside a `wayOut` token).
The wire before the domain dispatcher had `id`, `name`, `wayOut`, `controlRef`; the post-dispatcher shape was not captured.
The diagnostic (`obstruction-toggle.json` `submissions[].changedPaths`, `layerReports`) holds the evidence.

## Commands run and results
All under `heavy-check.lock`.
- Core: `node scripts/build-cache/cli.mjs contracts:build fluxiq:build` -> `contracts:build reuse`, `fluxiq:build build ... 332523 ms`, exit 0.
- `pnpm --filter @fluxiq-web-extension/extension test:e2e -- site-reset/tests/photo-obstruction-toggle` (builds the extension first) ->
  `1 passed (3.2m)`, exit 0 (final run; two earlier runs failed on my own assertions: a judge-request count, fixed).
- `pnpm --filter @fluxiq-web-extension/extension test:e2e -- site-reset/tests/photo-` -> `9 passed (7.2m)`: photo-dialog-step (2),
  photo-dialog-destination, photo-act-ledger, photo-dialog-act, photo-page-order-limit, photo-looped-other-item,
  photo-obstruction-toggle, photo-toggle. Exit 0.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (233 warning(s), 616 baselined).`
- `node scripts/check/model-text.mjs` -> `model-text: ok (208 scenario tokens, 377 model-facing Core files, 11799 string literals)`.

## Not verified
- Core's `clear_interference` rung, `obstruction` from the web client against a real page, the rate-limit pace, and the
  `trial_close` handler at runtime: none reached. The headed browser was the e2e Chromium with the unpacked extension.
- `ensureState` from the look-time handle-view `control` (CC9): the like step's `ensureState` here comes from the explored
  press. No look-time `control` path was exercised.

## Open questions
- Should the Lab gain a photo-social layer that is run-opened (e.g. an `aria-expanded` menu) so the rung can be proved headed?
- Is a trial-closed named overlay meant to become a handler on the next submission here? If so see "Possible Core defect".

## Follow-up: after Core's `pressedBy` fix (Core rebuilt twice, `fluxiq:build` exit 0)
Result: the `trial_close` handler is still NOT on the submission after trial 2, so no handler assertion was added (the spec
passes without one). Trial 3 therefore shows only the defence's close (`Recovered: Closed a dialog the page put in the way`),
not a handler press; the consent overlay was not pending in trial 3 (trial 2 answered it).

What a temporary probe (wrapping `AutomationStudioExploredInterruptions.prototype.trial` and `.list`, loaded from Core's
dist; removed again) observed in the headed run:
- Post-dispatcher `clearedLayers` Core's `trial()` received: the overlay entry has keys `kind:"overlay", control, id, name,
  controlName, wayOut (string), wayOutDefinitionId:"web.output.dom-click", controlRef {selector, element}`, `skipped: null`.
  The unnamed dialog entries have the same keys without `name`.
- What the record kept after trial 2: `{kind:"trial_close", id:"layer:4e8ae4ae", name:"Allow the use of cookies from Framelight
  on this browser?", wayOutDefinitionId:"web.output.dom-click", controlRef:{selector, element}}`. So parse and `trial()` work now.
- `list()` read at the three submissions returned lengths 0, 0, 1: the third submission (after trial 2) saw the record.
- Yet that submission's `changedPaths` are only `plan.subflows.0.edges.4` and `nodes.5` (the added look) and trial 3 ran 7
  steps (arrival, 4 Flow steps, 2 looks): no handler nodes.

So the loss is inside `automationStudioCandidateExploredLayerHandlers`
(`flow-bootstrap/layer-handlers/explored.ts`), called from `flow-bootstrap/candidate/submission.ts:269`. Its silent exits for a
trial record: `:96-97` (`registry.get(layer.wayOutDefinitionId)` missing), `:99` (part `role==="recovery"`, node-size limit,
or `subflowWaitsForLayer`), `:104` (nothing added), `:113` (`!validation.ok` returns the original plan). I could not tell which
without editing Core; `:113` is my best guess (the handler step's parameters are `{ target: controlRef }`, the explored
path's are the flat `ranWith` parameters), `:97` second. A Core test that runs the lowering with the web click definition
and this `controlRef` shape, asserting `validation.ok`, would decide it.

Final runs: new spec `1 passed (2.3m)`; all photo specs `9 passed (6.9m)`; `structure-audit: passed (233 warning(s), 616
baselined).`; `model-text: ok (208 scenario tokens, 377 model-facing Core files, 11799 string literals)`.

## Follow-up 2: after Core's `controlRef`-as-parameters fix (Core rebuilt, `fluxiq:build` exit 0)
The `trial_close` handler is now on the submission after trial 2 and asserted.
- Revision 3 (submitted after trial 2) `changedPaths`: `plan.metadata`, `plan.subflows.0.metadata`, `nodes.5` to `nodes.8`,
  `edges.4` to `edges.6` (before the fix: only the added look). Trial 3 ran "10 steps" instead of 7.
- The Flow the judge was shown for trial 3 (read from the judge request, the only place the spec can see the plan) holds:
  `builtin.control.handler` "Something covered the page" with `event:"before"`, `scope:{kind:"subflow"}`,
  `when:[{fact:"obstruction", op:"visible", value:"Allow the use of cookies from Framelight on this browser?"}]`, `maxRuns:1`;
  then `web.output.dom-click` "Close what covered the page" whose parameters are the reported `element` (the decline control:
  `testId cookie-policy-manage-dialog-decline-button`, text "Decline optional cookies", dialog context; selector withheld in
  the view); then `builtin.control.handler-end` "Then carry on" (`disposition:"resume"`). The earlier four judge requests (trials 1 and 2)
  show no handler. The spec asserts all of this.
- Trial 3 did not meet the overlay (trial 2 had answered consent; I added no further reset). So neither the handler's press nor
  the defence closed the overlay in trial 3; only the dialog over the grid was closed, by the defence ("Recovered: Closed a dialog
  the page put in the way"), and no "Close what covered the page" row appears. The handler is therefore proved written, not proved to fire.
- Final runs: new spec `1 passed (2.9m)`; all photo specs `9 passed (6.8m)`; `model-text: ok (208 scenario tokens, 377
  model-facing Core files, 11799 string literals)`; `structure-audit: passed (233 warning(s), 616 baselined).` (a first
  audit flagged my one-line helper as statement packing; split, re-run passed).
- No dropped-handler advice appeared in the submissions.
