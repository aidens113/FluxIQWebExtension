# Report: w2-repairable-drift-scenario

Worker report, 2026-09-16. Nothing committed.

## Outcome

Done. The brief's deliverables are in place and its checks pass. Two things
the brief assumed turned out to be false. Neither can be fixed inside this
brief's ownership, and the supervisor needs both:

1. **The web domain's override check does not reject a wrong control a click
   can use.** It accepts an override that names the renamed Save. It also
   accepts one that names Discard, or the text field, and resolves each to its
   own fingerprint. The check only refuses handles the model was never shown,
   or controls a click cannot use. What fails a run that presses Discard is the
   scenario's oracle ("Changes discarded" is not "Saved: ..."), not this check.
2. **No current Lab live run can meet this variant's expectations, even with a
   perfect model.** `--llm-task adapt` issues a `diagnose_and_adapt` grant.
   Under that grant Core only *proposes* a target override
   (`AS/runtime/recovery/annotation/patches.ts:98-101`, with
   `explicitProposalGrant` set at `annotate.ts:321`). The attempt is therefore
   `proposalOnly: true, executed: false, retryOriginalAction: false`, and the
   run still ends with `target_not_found` and nothing saved. The Lab's Flow
   lane has no approve-then-rerun step. So a live `adapt` run can show a
   *correct* repair, but it cannot show the *task succeeding*.

**Variant id: `renamed-redesign`.** Run it with
`pnpm lab run identity-drift --variant renamed-redesign --flow`.
**Measured matcher score:** the renamed Save ranks first at **-0.104**, Discard
second at **-0.360**, confidence **0**. That is 0.454 under the 0.35 floor.
Strategy `fingerprint`, 2 candidates, and the same numbers on the replay path
and on the Flow path's recorded point (real Chromium).

## What changed and why

- `apps/scenario-lab/src/scenarios/identity-drift/modes.ts`: new mode
  `renamed-redesign`, placed between `reworded-aria` and `save-and-exit`. The
  comment gives the measured numbers and explains why the mode exists.
- `.../identity-drift/save-action.ts`: the new rendering is
  `<button type="submit" class="ui-button ui-button--accent">Apply changes</button>`.
  It is `reworded-aria`'s component with the aria-label removed and the label
  renamed to `text-only`'s "Apply changes". Nothing the recording knew Save by
  survives: not the id, test id, class, text or accessible name. It still sits
  in Save's slot beside Discard, and it still submits through `save`.
  `render.ts` and `state.ts` needed no change.
- `.../identity-drift/manifest.ts`: new `repairableVariant`.
  - **Its `expected` is the repaired run:** type and click succeeded, final
    state `Saved: Aurora Field Team`, no `failure`.
  - **Its `pageFacts`:** the form is visible, `save-changes` is gone, and
    `discard-changes` is kept.
  - **Its description says plainly** that "Only a repair can pass this row"
    and that "a provider-free run fails with target_not_found".
  - **Why the expected outcome is the save and not a refusal:** the variant
    contract has one `expected` block and no provider-dependent branch
    (`test-contracts/src/scenario.ts`). If the variant declared
    `target_not_found`, a run with no repair and a run with a correct repair
    would get the same verdict. The row would then turn red the day a repair
    starts to work.
  - **The doc comment above the variant** describes what a correct repair
    looks like in `harnessRecovery` today (a proposal) and what a run that
    applies the repair looks like.
- `.../identity-drift/tests/scenario.test.ts`: two new tests.
  - The rendering takes every recorded signal away and leaves exactly one
    submit control.
  - The variant expects the save, its description states the provider-free
    failure, and the oracle is met by a save through the renamed control but
    by neither the armed page nor a Discard press.
- `apps/scenario-lab/e2e/identity-drift.spec.ts`: a drift case for
  `renamed-redesign` (attributes are exactly `type` and `class`, and the
  control sits at Save's recorded x and y). Also a new row showing that
  pressing Discard on that page writes "Changes discarded" and fails Save's
  oracle.
- `apps/extension/e2e/content/tests/identity-resolution.spec.ts`: one
  measurement row beside the existing "every recorded signal has drifted" row.
  It arms the real mode, replays the recorded descriptor both as a replay and
  with the Flow lane's point, and pins `status: failed`, `TARGET_NOT_FOUND`,
  `strategy: fingerprint`, `candidateCount: 2`, `confidence: 0`,
  `bestScore ≈ -0.104` and `runnerUpScore ≈ -0.36`. On the Flow path it also
  checks the message `refused button "Apply changes" scoring -0.10`, and it
  checks that no click reached the page and nothing was saved or discarded.
  The row went into this existing file because `e2e/content/tests/` is at its
  25-entry limit.
- `domain/src/runtime/llm-evidence/tests/renamed-save-override.test.ts` (new):
  the acceptance test.
  - **The fixture** is the snapshot the content script actually captured for
    this page in Chromium (`harness.capture()`), with the layout fields the
    sanitizer never reads removed and the port fixed. It is sanitized exactly
    as `captureSanitizedFailureEvidence` does it: `budget: "failure"` and
    `failedAction: {}`.
  - **Test 1:** the packet shows exactly one submit control, `target.2`
    (`button`, text "Apply changes", `controlType: submit`). Nothing on the
    page says "Save changes", and no selector or value is in the packet.
  - **Test 2:** the check **accepts** `{element: "target.2"}` as `resolved`,
    `handleResolution: named`, `tagName: button`,
    `visibleText: Apply changes`, the selector from the binding, and
    `metadata {controlType: submit, formId: settings-form}`.
  - **Test 3:** the check **refuses** (`ambiguous`) invented handles
    (`save-changes`, `#save-settings`, `Save changes`, `target.0`,
    `target.99`) and every packet element a click cannot use. It refuses
    (`absent`) an invented parameter.
  - **Test 4:** records finding 1. `target.1` (Discard) resolves to Discard's
    own fingerprint, and `target.3` (the text field) resolves to the input.

## Commands run and observed results

- `pnpm exec playwright test -c e2e/playwright.content.config.ts identity-resolution --workers=2`
  (in `apps/extension`): `23 passed (5.6s)`, including `renamed-redesign: ...
  refused on both paths, and nothing is pressed`. The first measuring pass
  printed
  `"resolution":{"strategy":"fingerprint","candidateCount":2,"bestScore":-0.104,"confidence":0,"runnerUpScore":-0.36}`
  for both `replay` and `flow`. The final state was `saveCount 0`,
  `discardCount 0`, `status ""`.
- `DOMAIN_TEST_BUILD_LABEL=w2-repairable-drift node scripts/test-domain.mjs`
  (in `domain`): `# tests 526 # pass 526 # fail 0`. The new file alone gave
  `# pass 4 # fail 0`. I used the scratch label on purpose, so the tracked
  `domain/.test-build/` was not written (see Open questions).
- **Negative probe:** I temporarily changed the acceptance test's handle to
  `target.1` (Discard). Result: `not ok 2 - accepts an override naming the
  renamed Save ...`, `# pass 3 # fail 1`. I then restored the file, and
  `cmp` reports it identical to the saved copy.
- `pnpm check` (in `domain`): exit 0.
- `pnpm check` (in `apps/scenario-lab`): exit 0.
- `pnpm test` (in `apps/scenario-lab`): `# tests 227 # pass 227 # fail 0`.
  The identity-drift file alone gave 14 of 14 ok, including both new tests.
- `pnpm exec playwright test -c e2e/playwright.config.ts identity-drift --workers=2`
  (in `apps/scenario-lab`): `11 passed (4.1s)`. That includes
  `renamed-redesign variant: ... the save succeeds` and the new Discard row.
- `pnpm lab run identity-drift --variant renamed-redesign --flow`, first
  attempt: refused before running, with
  `FLUXIQ_TEST_PROJECT_ID is required for an existing or clone target`.
  `.env.local` sets `FLUXIQ_TEST_TARGET`. I did not print its value.
- `FLUXIQ_TEST_ENV_FILES=none pnpm lab run identity-drift --variant renamed-redesign --flow`
  (isolated target, provider-free, no key loaded): run
  `run-mu4pflmj-e88c86d3`.
  - **Result:** `verdict: failed`, `flowCreated: true`,
    `oracleVerdict: failed`, `automationFailureReported:
    {category: target_not_found, code: web.target.not_found}`,
    `automationFailureExpected: null`.
  - **Recovery and LLM:** `harnessActivations: 0`,
    `harnessRecovery.attempted: false`, `llm: {mode: disabled, calls: 0}`.
  - **Runner summary:** `firstFailure.summary: "The Flow reported an
    unexpected target_not_found failure"`.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (57
  warning(s), 17 baselined)`. That is the same warning count as before my
  change; `identity-resolution.spec.ts` was already past the 400-line advisory
  and is now 541 lines.
- `pnpm check` (repository root), run alone: `exit=0`. structure tests
  `# pass 96 # fail 0`, lab tests `# pass 15 # fail 0`,
  `structure-audit: passed`, and all ten `pnpm -r check` packages `Done`.
- **Sanitized packet probe** (a scratch bundle of the same fixture): 21 of the
  27 elements survive the 3,000-byte failure budget (2,939 bytes,
  `budgetTruncated: true`). The trim takes the tail, and the three clickable
  controls are `target.1`-`target.3`.
- `git status` after all runs: only the six modified files above plus the new
  test file, next to the supervisor's pre-existing `docs/working` changes. The
  Lab rebuild left `apps/extension/build/` unchanged in content.

## What a successful live repair should look like

**Today, under `--live-llm ... --llm-task adapt`**, a correct repair looks
like this:

- `harnessRecovery.attempted: true`.
- `interventions` include a `runtime_patch` intervention with
  `validationOk: true`, plus whatever diagnosis and evidence calls preceded it.
- **`runtimePatchAttempts` holds one entry:**
  `{kind: "temporary_target_override", proposalOnly: true, executed: false,
  preflightOk: true, issueCodes: [], adaptationCreated: true,
  changeProposalCreated: true}`.
- **The run's lists:** one id each in `adaptationIds` and `changeProposalIds`.
- **The adaptation's target** (not visible in `harnessRecovery`) should be the
  domain's resolution:
  `{handles: {element: <the Apply changes handle>}, handleResolution: "named",
  tagName: "button", visibleText: "Apply changes", selector: <the button's
  selector>, metadata: {controlType: "submit", formId: "settings-form"}}`.
- **The run itself still ends** with `automationFailureReported:
  target_not_found`, `oracleVerdict: failed`, and a save status of `""`. So
  its verdict is `failed`, and it has to be read from `harnessRecovery`.

**Wrong repairs** look like this:

- A handle that was invented or can't be clicked gives `preflightOk: false`
  and `runtime_patch.target_override_rejected`.
- A repair that names Discard or the text field gives `preflightOk: true`, but
  the proposal points at the wrong control. It only fails once the proposal is
  applied, through the oracle.

**Once a run can apply the repair** (an executed override, or the approved
adaptation replayed), the run should look like this:

- `actions` contains a failed `web.dom.click` and a succeeded one.
- `automationFailureReported: null`.
- The final state is `Saved: Aurora Field Team` with
  `savedInMode: "renamed-redesign"`, `saveCount: 1`, `discardCount: 0`.
- The verdict is `passed`.

## Not verified

- **No live run** was made (no `--live-llm`, as briefed). The proposal-only
  shape above comes from reading Core's code, not from a live run: the field
  values come from `patches.ts:102-116` and `live-patch.ts:168-190`, and
  `adaptationCreated: true` comes from `targetOverrideProposalAdaptation`
  always returning an adaptation once preflight passes.
- **Whether a run that does execute the override reports
  `automationFailureReported: null`** (that is, whether Core clears the failed
  click's failure once the retry succeeds). Not exercised.
- **Whether DeepSeek actually names `target.2`** given this packet.
- **The fixture is the content script's capture, not the background worker's
  merged tab snapshot.** For a single top frame the merge passes the elements
  through (`dom-snapshot.ts`), but I did not capture through the service
  worker.
- **Firefox** was not exercised.

## Open questions or contradictions found

1. **The brief says the check should reject an override naming anything but
   the genuine control.** It does not, by design: it checks that the model was
   shown the control and that a click can use it, not that it is the right
   one (see Outcome, finding 1). Test 4 records the current behaviour. Making
   the check reject a pressable decoy would mean changing
   `domain/src/runtime/llm-evidence/target-override.ts` (off-limits here), and
   it is not clear the domain can know which control is right. The recorded
   fingerprint is not passed to it; `failedAction` carries only node and
   definition ids.
2. **The Lab cannot show "repair, then the task succeeds" in one run** (see
   Outcome, finding 2). It needs either an approve-then-rerun step in
   `packages/test-runner` or a grant under which Core executes target
   overrides. Both are outside this brief.
3. **Side finding: the packet drops accessible names.**
   - **What happens:** `elements.ts:106` reads `raw.name` and `raw.role`, but
     the content script's descriptors carry the accessible name as
     `accessibleName` (and `label`, `implicitRole`). Only elements with an
     explicit aria-label/role (the form, the group div) set `name`.
   - **On this page:** the text field reaches the model as
     `{tag: "input", hasValue: true, form, landmark, heading}`, with no name at
     all. Buttons are readable only because their visible text is carried.
   - **Why it matters:** for an aria-label-only control, such as
     `reworded-aria`'s visible "Save" labelled "Save changes", the packet would
     show "Save" and never "Save changes". This does not block
     `renamed-redesign`, but it weakens every repair packet.
   - **Status:** not changed, because it is source I don't own.
4. **The tracked `domain/.test-build/`** does not yet contain
   `runtime/llm-evidence/tests/renamed-save-override.test.mjs`, because I
   built into the ignored scratch label. Run `pnpm --filter
   @fluxiq-web-extension/domain test` to regenerate it before committing.
5. **The `.env.local` target** makes a plain `pnpm lab run ... --flow` refuse
   with `FLUXIQ_TEST_PROJECT_ID is required ...`. The provider-free run needs
   `FLUXIQ_TEST_ENV_FILES=none`, or a matching target configuration.
