# w2-w1-repair-precedence: a persisted repair beats the recorded element (defect D-1)

Brief: W-1 in `w2-back-half-design.md` (section 5 D-1, section 3 Phase 2.7
item 1, section 8 row W-1).

## Outcome

**Done.** D-1 is real. It is now reproduced in Chromium and fixed in the
domain.

- **Before the fix.** A recorded Save node carrying the repair the domain
  produces for `identity-drift --variant renamed-redesign` was dispatched
  through Core's real dispatch normalizer and the domain's real mapping. The
  page answered:
  `No target resolved from selector main > form > section:nth-of-type(1) > div > button:nth-of-type(1) (refused button "Apply changes" scoring -0.10), element fingerprint.`
  So the repaired selector found the right control, and the veto refused it by
  the stale recorded Save identity.
- **After the fix.** The same dispatch clicks "Apply changes":
  `resolution {strategy: selector, candidateCount: 1}`, `saveCount: 1`,
  `discardCount: 0`. This holds both with and without the Flow lane's
  recorded point.
- **The veto still refuses a wrong element.** Remove Apply changes so the
  repaired selector lands on Discard. The veto refuses Discard at -0.13 on the
  selector, the point and the fingerprint (rule 1, contradicted). Nothing is
  pressed.

**The design's proposed fix would not have worked on the live path.** The
design says: treat a target carrying `handles` and `handleResolution` like a
selected candidate. But Core's `prepareElementTargetAction`
(`AS/runtime/io-policy.ts:199-230`) rewrites `parameters.target` on every
dispatch through `normalizeAutomationStudioElementTarget`, and that rewrite
drops both keys. Observed by running Core's built normalizer on the repair:
`{"kind":"element","fingerprint":{"accessibleName":"Apply changes","tagName":"button","selector":"main > form > …","metadata":{"controlType":"submit","formId":"settings-form"}},"source":"runtime"}`.
Mutation M2 below keeps only the marker rule, and the Chromium row still fails
with the D-1 message. So the fix also recognises a repair by its content.

## What changed and why

- **`domain/src/output-nodes/targets/targets.ts`**
  - **New export `adaptedTargetSupersedesRecording(parameters)`.** It decides
    whether the node's `target` names the element to act on in place of
    `element`. It answers yes in three cases:
    1. Core matched a runtime candidate (`selectedCandidate`). This is the old
       rule, unchanged.
    2. The target is the domain's repair resolution as stored: an object
       `handles` plus `handleResolution` of `named` or `inferred`. This is the
       design's rule.
    3. The target's identity names a descriptive value that the node's own
       parameters do not hold. Descriptive values are `visibleText`, `text`,
       `accessibleName`, `label`, `id`, `testId`, `tagName`, `role` and
       `implicitRole`. Case 3 is what fixes the live path.
  - **Why case 3 is safe.** When Core rewrites an unrepaired node, it reads
    only the parameters and their `element`, each with its `metadata`,
    `visualTarget` and `attributes`. It trims each value and cuts it at 1,000
    characters. So every value it emits is one of those strings.
    - The comparison ignores keys and case. Core folds `text` into
      `visibleText` and `implicitRole` into `role`, and those folds cannot
      cause a false yes.
    - `selector` and `xpath` are not compared. A target that only relocates
      the recorded control keeps the recorded identity, and the page checks
      the new location against it. The selector itself still comes from the
      adapted target, as before.
  - **`elementFingerprintSources`** now asks the predicate. It also reads a
    flat target as its own identity, because that is how the repair is stored
    before Core rewrites it. A Core-shaped target normalizes to `{}` and is
    skipped.
- **`domain/src/client/gateway-mapping.ts`.** `elementFingerprintSources` now
  asks the same predicate, so the declared `command.element` and the wire
  `target.element` name the same element.
  - When the answer is yes, the order is: wire `target.element`, wire
    `target.fingerprint`, then the adapted target on the parameters (its
    `element`, its `fingerprint`, or the flat target), then
    `parameters.element`.
  - The adapted target on the parameters covers a command whose wire target
    carried no element.
  - When the answer is no, the order is unchanged.
- **`domain/src/output-nodes/targets/tests/targets.test.ts`**
  - One existing row changed. It asserted that an unmatched target naming
    another test id loses to the recording, which is D-1's premise. It now
    asserts that such a target wins, and that a pass-through of the
    recording's own element (re-spaced, upper-case tag) still keeps all 12
    recorded signals.
  - Six new rows run Core's real `normalizeAutomationStudioElementTarget`:
    - the repair as stored;
    - the repair after Core's rewrite (and the rewrite contains no `handles`);
    - seven recording shapes that must be recognised as the recording after
      Core's rewrite: the identity-drift Save with `role: ""`, a typed field,
      signals only in attributes, padded text with an upper-case tag,
      `text` and `implicitRole` only, text past Core's 1,000-character
      bound, and a visual target with an entity id;
    - a target that only moves the recorded control;
    - a repair with no selector;
    - `handles` without a valid `handleResolution`.
- **`domain/src/client/tests/gateway-mapping-identity.test.ts`**: three new
  rows.
  - The repaired node gives `command.selector` = the repaired selector and
    `command.element` = `{selector, tagName: button, accessibleName: Apply changes}`,
    equal to the wire target's element. This holds for the stored shape and
    after Core's rewrite.
  - An unrepaired node keeps the whole recorded element after Core's rewrite.
  - A bare wire target (a selector only) still yields the repaired identity.
- **`apps/extension/e2e/content/tests/identity-resolution.spec.ts`**: one row
  after its counterpart, "a persisted repair of the recorded Save resolves
  Apply changes on renamed-redesign, and the veto still refuses Discard".
  - The node is built by `webAutomationOutputPayload`, the repair is written
    onto it, and Core's normalizer is called.
  - The wire target and command come from `outputTargetFromPayload` and
    `webAutomationActionFromGatewayCommand`.
  - The one step restated is `prepareElementTargetAction`'s private
    `{...parameters, target: normalized}`, which applies when there are no
    candidates.
  - The repair literal is the output `renamed-save-override.test.ts` pins. The
    row checks on the page that the selector really names Apply changes.

**No change to the content-script source was needed.** `resolve-target.ts`
already prefers the declared `action.element` over `options.element`, and
nothing else in `apps/extension/src` reads `options.element`.

## Commands run and observed results

- **Before the fix**, in `apps/extension`:
  `pnpm exec playwright test -c e2e/playwright.content.config.ts identity-resolution -g "persisted repair" --workers=1`
  gave `1 failed`: `replay: No target resolved from selector main > form > section:nth-of-type(1) > div > button:nth-of-type(1) (refused button "Apply changes" scoring -0.10), element fingerprint.`
  The received value was `status: failed`, `resolution {strategy: fingerprint, candidateCount: 2}`.
- **The same command after the fix**, first run: the positive half passed on
  both shapes. The negative assertion failed only on my expected label; the
  page printed `refused button[data-testid="discard-changes"] "Discard changes" scoring -0.13`
  three times. I corrected the assertion, and the rerun gave `1 passed (6.5s)`.
- **Core's normalizer, run from `apps/extension` with plain Node:** it output
  the rewritten shape quoted under Outcome, with no `handles` and no
  `handleResolution`.
- **`pnpm check` in `domain`:** exit 0.
- **`pnpm check` at the repository root, run alone:** exit 0.
  - `structure-audit: passed (61 warning(s), 17 baselined)`.
  - Of my files, only three appear, each with the pre-existing 400-line
    advisory: `identity-resolution.spec.ts` (now 629 lines),
    `gateway-mapping.ts` (522) and `gateway-mapping.test.ts` (721, untouched).
  - Line counts of the rest: `targets.ts` 361, `targets.test.ts` 390,
    `gateway-mapping-identity.test.ts` 179.
- **Mutations**, each applied to my two source files only. Each file was
  copied to the scratchpad first and restored after; `cmp` against the saved
  copies says identical, and no `MUTATION` marker remains.
  - **M1: the old precedence** (the predicate reduced to `selectedCandidate`,
    and gateway-mapping's old list). Scratch domain run: `# tests 600 # pass 593 # fail 7`.
    All 7 failures are my new or changed rows (35, 37, 112, 115, 116, 119,
    120). `domain.test.ts` still failed to load.
  - **M2: the `handles` marker only** (content rule removed).
    - Domain: `# pass 594 # fail 6`. Rows 35, 37, 112, 116, 119 and 120 fail.
      Row 115, the stored shape, passes.
    - Chromium row: `1 failed`, with the same D-1 message.
  - **M3: only `gateway-mapping.ts` reverted.** Chromium row: `1 failed`, D-1
    message.
  - **M4: only `targets.ts`'s ordering reverted.** Chromium row: `1 failed`,
    D-1 message.
- **`node scripts/test-domain.mjs` in `domain`, tracked build** (this
  regenerated `domain/.test-build`): exit 1, `# tests 600 # pass 600 # fail 0`,
  and `1 of 76 domain test entries failed to load: src/tests/domain.test.ts`.
  - The load failure is `missingRequiredTerms` `['end']` from the Flow
    Bootstrap catalog check at `domain.test.ts:189`. It is not caused by this
    change: M1 reproduces it. The coordinator has since assigned it to another
    worker.
  - My rows passed: 35-37 (`gateway-mapping-identity`), and 112 and 115-120
    (`targets`).
  - An earlier scratch run of the unmutated fix showed 3 failures in
    `runtime/llm-evidence/tests/target-override.test.ts`, another worker's
    in-flight file (its producer answers `action_not_repairable`). They were
    gone by the M1 run.
- **Full content suite**:
  `pnpm exec playwright test -c e2e/playwright.content.config.ts --workers=2`
  gave exit 0, `288 passed (1.6m)`. That is 287 before plus the new row, and
  it includes `identity-signals.spec.ts`, the other spec using
  `outputTargetFromPayload`.
- **`pnpm test` in `apps/extension`:** exit 0, `# tests 649 # pass 649 # fail 0`.

## Not verified

- **No live or Lab run.** The brief forbade live calls. The end-to-end proof
  is still the Lab one: `renamed-redesign` repaired, approved, applied and
  replayed with no model, ending `Saved: Aurora Field Team`, `saveCount: 1`.
  It needs L-2 and C-9 as well.
- **The tracked extension bundle is stale.** `apps/extension/build/background/index.js`
  bundles `gateway-mapping.ts` and still holds the old rule: it contains
  `selectedCandidate` once and `adaptedTargetSupersedesRecording` zero times.
  I did not rebuild it, because the path is not mine. `pnpm build` in
  `apps/extension` must run before any live proof that loads that bundle.
- The Firefox content config was not run.
- Core's dispatch step was exercised through its exported normalizer, not
  through `prepareElementTargetAction` itself, which is private. Only
  `prepareElementTargetAction`'s wrapper (`{...parameters, target}`) is
  restated, in both tests.
- Created-Flow nodes, whose identity comes from a plan, were not exercised.
  The compatibility argument is under the next heading.

## Open questions or contradictions found

1. **The design's D-1 fix does not survive Core.** See Outcome and M2. If a
   marker is wanted as well as the content rule, it must sit inside the
   repair's `metadata`: Core keeps non-promoted, non-sensitive metadata keys in
   `fingerprint.metadata`. That would be a change to
   `runtime/llm-evidence/target-override.ts`, which is not my file.
   `adaptedTargetSupersedesRecording` could then read
   `fingerprint.metadata.<marker>`. I did not add that reader, because nothing
   produces the marker yet.
2. **Residual cases, named in the code comment:**
   - A repair whose every descriptive value is already somewhere in the
     recording keeps the recorded identity. That is the pre-D-1 behaviour.
     Example: a nameless icon button repaired onto a recorded button, with
     only `tagName: button`.
   - A repair with no selector still dispatches the recorded selector as a
     hint, and the recorded `visualTarget` still rides with any repair. The
     page judges both against the repaired identity.
   - `options.element` still carries the stale recorded element raw. It is
     only a fallback behind the declared field.
3. **For w2-plan-handle-identity (created nodes): the shape a recorded node's
   identity uses.** `webAutomationOutputPayload` builds these parameters for a
   DOM action:
   - `selector`: a string, equal to `element.selector`;
   - `element`: `elementFingerprint(descriptor)`. Its keys are `selector`,
     `xpath`, `id`, `classNames`, `visibleText`, `tagName`, `text`, `value`,
     `role`, `implicitRole`, `name`, `href`, `inputType`, `checked`, `testId`,
     `accessibleName`, `label`, `attributes` (strings only), and `context`
     with `{formId, formName, formAction, fieldsetLegend, landmark,
     landmarkName, heading, listPosition {index, total},
     tablePosition {row, column, columnHeader?}}`;
   - `visualTarget`: optional;
   - `browserFrameId` and `browserFrameUrlPath`: for a child frame.

   How the precedence rule treats a created node:
   - **Its identity in `parameters.element`** is handled exactly like a
     recorded one. A later repair in `parameters.target` wins over it.
   - **If the planner also writes `parameters.target`**, keep its descriptive
     values identical to `parameters.element`. Otherwise it is read as an
     adaptation, and the leaner Core-normalized copy is dispatched instead:
     the same element, but without `context` and the rest.

   What the page's veto needs from that identity:
   - It declines entirely unless the identity has at least one of
     `visibleText`, `accessibleName`, `label`, `id`, `testId` or
     `attributes["data-testid"]`.
   - A match is refused unless one of those agrees with the page exactly
     (similarity of at least 0.92, or an equal id).
   - The live refusal the coordinator quoted ("scoring 0.17 with nothing the
     recording named agreeing") is that second rule.
4. **Tracked build contents.** The regenerated `domain/.test-build` was bundled
   from the tree as it stood. It therefore includes other workers' in-flight
   `runtime/llm-evidence/**` edits.
5. **The design's lab-proof order is unchanged.** Beyond this fix, the live
   proof also needs the tracked extension bundle rebuilt (see Not verified).
