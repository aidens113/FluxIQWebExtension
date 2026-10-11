# t446: in-run repair accepts a control the site renamed

## Outcome

Done. The domain's equivalence check now accepts a renamed control when it keeps the recorded control's kind and
place and keeps the recorded action words, with only the last word (the thing acted on) renamed. It must also be the
only such control in that place. Controls of another purpose in the same place are still refused. Same-named and
renamed-looking controls elsewhere (another landmark, another form, a repeated list row) are refused. The existing
equivalence tests pass unchanged. Uncommitted on `task/t446-renamed-control-equivalence`.

## Why R4b's rename was refused

From `~/FluxStuff/lab-runs/2026-10-11/run-mv4dgmki-2b13db91/steps/0048-repair` (request.txt) and `0053`
(describe_element):

- **What the step had saved.** A `<div>` with `data-testid="add-to-cart"`, one class `css-0dtygkz`, context
  `{ landmark: "main" }`, visibleText "Add to cart". It had no role, no form, no list position and no heading.
- **What the model named.** t143 (t1140 when re-described): a `<div>` with "Add to basket", class `css-0hem165`, no
  test id, `hasClickHandler`, `cursor: pointer`, landmark `main`, no form, no list position. Its heading was the
  product title. "Buy now" (t144) sat beside it, after "Total:" and the price.
- **What the old check required.** `equivalence.ts` accepted a non-twin, non-conflicting proposal only through two
  anchors, and R4b met neither:
  - `namesAgree`: the recorded name kept whole or shortened from the front. "add to basket" is not a front of
    "add to cart".
  - `soleControlOfItsKindInRecordedForm`: the page had no form.
- **Signals that weren't used.** Kinds did not conflict (both `div`, both unknown kind). The page's test id and class
  were both gone. Nothing compared the landmark.
- **Result:** `target_unanchored`.
- **Signals a recording doesn't keep.** Sibling position, neighbouring price or quantity text, and the form's action
  are not in a saved fingerprint (`WebAutomationElementContext` holds the form, landmark, heading, and list, table and
  record position). So the check cannot use them.

## What changed and why

All files are in `domain/src/runtime/llm-evidence/target/`.

- **`renamed-control.ts`** (new): `webRenamedControlVerdict` returns `same`, `different` or `unrelated`. A proposal is
  the recorded control renamed only when all of these hold:
  1. **Same place.** `webControlPlace(...).kept`; see `control-place.ts` below.
  2. **Same kind.** The same tag, the same authored role (or both absent) and the same input type. The recorded tag
     must have been stated.
  3. **Keeps the recorded action.** The name has the same number of words as a recorded name, at least two. Every
     word but the last is kept in order, and the last is a different word that is not a conjunction. For example,
     "Add to cart" becomes "Add to basket". "Buy now", "Place order" and "Sign out" keep nothing and are refused. A
     one-word name never qualifies.
  4. **No conflicting test id.** If both the recording and the proposal have an authored test id and the ids differ,
     the verdict is `different` (`target_not_equivalent`). The proposal's test id is read with
     `webPacketElementFingerprint`, so the attribute list is not duplicated.
  5. **The recorded name is gone from the place.** No usable control in the recorded place still answers to the
     recorded name, whole or shortened.
  6. **It is the only one.** No other usable control of the same kind in the place also keeps the recorded action.
     With "Save to collection" and "Save to planner" both present, both are refused.

  No word lists, and nothing specific to any site.
- **`control-place.ts`** (new): `webControlPlace` returns `{ conflicting, kept }` from the recorded context (landmark,
  form, list, table and record position) and the packet element (`landmark`, `form`, `item`, `cell`, `repeats`).
  - `conflicting`: both sides state a landmark and they differ, or both state a form and they differ, or one side is
    in a repeated list or table and the other is not.
  - `kept`: every landmark and form the recording stated holds, at least one was stated, and neither side is in a
    repeated list or table.
  - The heading is deliberately excluded. On a detail page it is the record's own title, which changes from record
    to record.
- **`control-names.ts`** (new): `recordedNames`, `evidenceNames`, `namesAgree`, `nameWords` and `NAME_CONJUNCTIONS`
  moved here unchanged from `equivalence.ts`. Both the equivalence check and the rename rung read names, so keeping
  them in one module avoids an import cycle.
- **`equivalence.ts`**:
  - The recorded control now carries `context`.
  - On the name path, a proposal whose name agrees but whose place is `conflicting` is refused as
    `target_not_equivalent`. This catches the same-named control elsewhere, such as a one-row related-items list's
    button or a sidebar copy. Before, it was accepted.
  - After the form anchor, the rename rung runs: `same` means accepted, `different` gives `target_not_equivalent`, and
    `unrelated` gives `target_unanchored` (as before).
  - The header comment now describes both additions.
- **Committing acts.** These checks are unchanged. Equivalence never sees consequences. An accepted repair still goes
  through Core's permission gate and the domain's act-landing record after this check. This change only widens which
  control a repair may name. It does not change whether a lasting act may be pressed.
- **`tests/renamed-control.test.ts`** (new, six tests). The fixture is a recipe site's action bar of pressable `<div>`s
  in `main` with no form, shaped like R4b. The recorded step is "Save to cookbook", saved with a test id and a class.
  The tests cover:
  - **Rename accepted.** "Save to collection" beside "Servings" and "Print recipe" resolves.
  - **Different purpose in the same place refused.** "Print recipe", "Share now", "Delete recipe", a banner
    "Sign out", a one-word rename, and a trailing conjunction are all refused.
  - **Two action-keeping controls in the place, or the recorded name still there.** Both refused.
  - **Kind, test id and form must hold.** A `<button>` instead of the `<div>` is refused, a differing test id gives
    `target_not_equivalent`, and a lost recorded form is refused.
  - **Renamed words elsewhere** (a sidebar, a list row) are refused, and a list-row link with the same words does not
    block the one in `main`.
  - **The recorded words whole elsewhere** (sidebar, list row) give `target_not_equivalent`, while the same words in
    `main` still resolve.

## Commands run and observed results

All of these ran in `C:/Users/osrs_/FluxStuff/fxwork/t446-renamed-control-equivalence`.

- **Baseline before editing.** `cd domain && DOMAIN_TEST_BUILD_LABEL=t446-equiv node scripts/test-domain.mjs
  llm-evidence/target/tests` printed `# tests 42  # pass 42  # fail 0`.
- **First run with the new tests:** `# tests 48  # pass 46  # fail 2`. Both failures were my expectations, not the
  behaviour:
  - "Save to and" is refused `target_unanchored`, not `target_not_equivalent`.
  - Two off-place copies on one page are exact twins and are refused earlier as `target_indistinguishable`.

  I put each copy on its own page and fixed the expected reason. A third run then failed one assertion: a list-row
  `<div>` twin of the `main` control is refused as indistinguishable by the existing twin rule, which ignores place.
  I made that copy a link.
- **Final run, same command:** `# tests 48  # pass 48  # fail 0`. The 20 existing equivalence tests and the override,
  candidates and stability tests are all included.
- **Other tests that reach the check.** `DOMAIN_TEST_BUILD_LABEL=t446-equiv-callers node scripts/test-domain.mjs
  llm-evidence/tests/renamed-save-override llm-evidence/tests/repair-proposal output-nodes/targets/tests/targets
  client/tests/gateway-mapping-identity` printed `# tests 59  # pass 59  # fail 0`.
- **Domain typecheck (sources and tests).** `cd domain && pnpm check` printed `core-build: FluxIQ Core's build ... is
  current with its source.`, then the build-cache line for `domain:check` (`ms: 36058`). Exit 0, no tsc errors.
- **Structure audit.** `node scripts/structure-audit.mjs` printed `structure-audit: passed (184 warning(s), 651
  baselined).` Exit 0. `grep -i llm-evidence/target` over its output found nothing.

## Not verified

- **No Lab or provider run** (per the brief). R4b's real packet was not replayed through the check. The recipe
  fixture copies its shape: a `div` with a click handler and pointer cursor, landmark `main`, no form or list, the
  recorded test id and class gone, and a different-purpose sibling. From the step logs I expect t143 to pass every
  condition: same tag, no role, `main`, no `item`, no test id, the only "add to X" control in `main`, and no "Add to
  cart" left. That expectation is inferred, not executed.
- **Whether the saved repair fingerprint is strong enough for the save-time shortfall guard on the real page.** The
  fixture's `div` (words plus class) resolved, so it passed there.
- **Full domain suite.** Not run, per the twice-a-day rule.

## Open questions or contradictions found

1. **Residual risk, which the supervisor should judge.** Suppose a redesign removes the recorded control entirely and
   leaves exactly one same-kind control in the same place that keeps its leading words, such as "Add to wishlist"
   where "Add to cart" stood. That control would be accepted. Two such controls together are refused. A differing
   test id is refused. A lasting act still meets the permission gate and act landing. Tightening further would need
   either meaning (a word list, which the user's rules forbid) or more recorded context, such as sibling names saved
   in the fingerprint. That second option is outside these files and would need a recorder or fingerprint change.
2. **Behaviour change on the name path.** A proposal with the recorded name in a different landmark or form, or in or
   out of a list row where the recording was not, is now refused `target_not_equivalent`, where before it resolved.
   That is the safe direction and no existing test relied on it. But a redesign that moves the same-named button to
   another landmark now goes to re-authoring instead of in-run repair.
3. **Twin rule versus place.** Same-tag, same-word controls that differ only by place stay refused as
   `target_indistinguishable`, so a rename that also leaves an identical copy in a list row is refused. Safe, but
   possibly over-strict. The twin rule's own comment explains why place is not used there; I left it unchanged.
