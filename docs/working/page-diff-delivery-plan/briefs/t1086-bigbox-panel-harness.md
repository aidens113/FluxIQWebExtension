# Brief t1086: the bigbox harness reproduces the panel replay and a judge that reads evidence

**Goal.** Live bigbox run-mwz29d50 failed its replay in two ways the provider-free harness cannot see:
- the harness adds from the results card's "+ Add", which only shows a toast, so its replay never meets the product
  page's "Added to cart" panel and its "View cart";
- its scripted judge always says yes.

Add both, so the Core fixes in t1083 and t1084 can be proven without a paid run.

**Read first.**
- `docs/working/page-diff-delivery-plan/reports/run-mwz29d50-bigbox.md`, section "3. Why the harness did not catch it"
  and its subsection "How to extend the harness".
- `packages/test-runner/src/attempt-lane/scripted-model/scripts/bigbox-retail-new-store-cheapest-towels.ts`,
  `scripts/judgement.ts`, `scripts/evidence.ts` and `scripts/index.ts`.
- The crossborder script, as an example of a script with forms (`FLUXIQ_ATTEMPT_SCRIPT_FORM`).

**Change.**
1. **A `panel` form of the bigbox script.** Keep the current form unchanged.
   - After the sort, open the first qualifying listing by its words.
   - Press the product page's "Add to cart", then the "View cart" link that follows "✓ Added to cart" in the page.
   - Then read the cart as the current form does.
   - Every target is found by its words, as the script already does.
2. **An evidence-reading judge, used by the `panel` form.** It answers `unknown` unless the judge request it receives
   shows the conditions the script names on the chosen item: a rating line of at least 4.5 and a pickup-today line.
   - Keep it generic in `judgement.ts`: the script gives the words.
   - This is test data, never product guidance.
3. **In `scripts/index.ts`, change only the bigbox new-store line** so that it passes the form. t1082 is adding a
   kestrel line to the same file, and the lead merges the two.

**Owned.**
- `packages/test-runner/src/attempt-lane/scripted-model/scripts/bigbox-retail-new-store-cheapest-towels.ts`;
- `scripts/judgement.ts`;
- that one line of `scripts/index.ts`;
- their tests in `scripts/tests/`.

**Must not touch.**
- `scripts/processing-declarations.ts` and any kestrel or auction file (t1082).
- Core.
- `domain/src` (t1083).

**Checks** (in `C:/Users/osrs_/FluxStuff/fxwork/t1086-bigbox-panel-harness`; put heavy commands through
`node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t1086-<label> -- <cmd>`):
- `pnpm --filter @fluxiq-web-extension/test-runner test` (the scripted-model tests are enough if the whole suite is
  slow);
- `node scripts/structure-audit.mjs`;
- **Current form:** `FLUXIQ_LAB_INSTANCE=t1086 pnpm lab attempt bigbox-retail --task bigbox-retail-new-store-cheapest-towels --authoring-mode answer-first --scripted-model --attempts 4`.
  It must still pass 4 of 4.
- **Panel form:** the same command with `FLUXIQ_ATTEMPT_SCRIPT_FORM=panel` and `FLUXIQ_LAB_INSTANCE=t1086p`.
  - On today's Core, expect attempt 2 to show "View cart" `executor.state.not_arisen` and the read failing on the
    product page, and the replay's judge to answer `unknown`.
  - Report each attempt's verdict, calls, path and failure codes. That failure is the expected result here.

No `node -e`, no git, no live or paid runs.

**Report.** `docs/working/page-diff-delivery-plan/reports/t1086.md` in the worktree, ending with the return contract.
