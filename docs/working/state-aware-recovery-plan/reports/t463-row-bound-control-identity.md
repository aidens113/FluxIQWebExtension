# t463: row-bound control identity

## Outcome

Done. A control repeated on every row of a list drawn as plain `<div>`s, such as bigbox's cart "Qty" select, is now saved with its row's title. The page accepts only a candidate in the row that title names. When no row matches, the step is refused; the resolver never falls back to the first match. Only extension files changed. The domain already carried `context.record.text` from the snapshot to the saved fingerprint, through `within` in `look-alikes.ts`, `packet-fingerprint/from-packet.ts` and `plan-resolution/element-identity.ts`, so the domain needed no change. The headed bigbox spec shows the domain path working.

## What the evidence showed

- The step log is `run-mv5jnc62-01c3609a/steps/0052-tool-core.test_candidate/result.json`. Steps 1 to 26 succeeded. Step 27, "set the dinner napkins quantity to 1", failed with `web.target.ambiguous`.
- I copied the saved candidate draft out of `global.sqlite` (row `projects/7ec72b10-.../flows/flow.4fa71233-.../candidate-draft`) and read the copy. Both Qty steps were saved as `{tagName: select, accessibleName: "Qty", classNames: ["css-12smum0"], implicitRole: combobox, context: {landmark: main}, selector: "main > div:nth-of-type(1) > div > section > div:nth-of-type(3|4) > div > div > label > select"}`. Neither step carried any row information.
- Root cause: `content/identity/record.ts` names a record only for `tr`, `li`, `article`, matching ARIA roles, or keyed elements. bigbox cart lines are `<div>`s, so `context.record` was never captured. The existing row-of-one-control rule (t195-w20e) ran only for a For Each pass that carried row values.
- Reproduced in the headed spec. With the new gate disabled (made to always accept), the fresh-load select failed with "2 elements matched: select (0.73), select (0.73)". That is the live ambiguity.
- The positional selector is a wrong-row risk. After a reorder, the saved selector reaches the other line's select, and the spec asserts this directly. Before this change, such a single selector match was accepted by the veto.

## What changed and why

- New `apps/extension/src/content/identity/control-row.ts`. The row-of-one-control walk moved here out of `record.ts`; it is the largest ancestor that holds the control and no other control alike to it. It now has three callers: the For Each values gate (unchanged behaviour), capture of a row's words, and the replay check. It exports `controlRow` (returns the row, the twin and the twin's row) and `soleAncestors`.
- `apps/extension/src/content/identity/record.ts`:
  - `recordIdentity`: when no keyed or repeated record applies, `controlRowIdentity` runs.
    - It runs only for controls: button, select, textarea, a non-hidden input, summary, a link with `href`, or a widget role.
    - It runs only when the twin's row is a sibling with the same tag and class, i.e. a repeated structure. A header "Sign in" and a footer "Sign in" are not treated as rows.
    - It records `{text: <row title>}`. The title is the row's first heading, or failing that its first link with words. If the neighbouring row has the same title, it records the row's whole words instead. If those are identical too, it records nothing.
  - `agreesWithRecordedRecord`: the key path is unchanged. For a recorded `text`, a matching record text still accepts. Otherwise `inNamedRow` checks whether any ancestor that holds the control and no other alike control reads exactly as the recorded words. That can be its title, through `titleInAnotherRow` (the title must not come from a sibling row of the same shape), or its whole text. No match means refusal (fail closed).
  - The header comment documents the new section.
- `apps/extension/src/content/identity/index.ts`: the header comment now mentions `control-row.ts`.
- Unchanged:
  - The t436 shared-class multi-match and word scoring.
  - The t442 identity at the act and the F5 signal floor. Record context is not counted as a signal.
  - The li, tr and keyed record rules.
  - The For Each values rule.

## Tests added

- `apps/extension/src/content/identity/tests/record.test.ts`, 7 new unit tests on a stub DOM:
  - each line's Qty is recorded by its own title, and Remove names the same line;
  - the recorded line is accepted and the other line refused, in either order, even after the line total changes;
  - when the line's words are gone, every line is refused, including a line left alone in the cart;
  - the named line left alone is still accepted;
  - a unique "Sort by" select records no row, and neither does a header/footer "Sign in" pair;
  - lines that share a title fall back to whole words, and identical lines record nothing;
  - the only Qty left, beside the named line that lost its select, is refused.
- `apps/extension/e2e/content/tests/created-identity/tests/row-bound-control.spec.ts`, a headed Playwright test on bigbox-retail's cart:
  - setup: consent and promo are dismissed and the paper towels are added through the fixture API, so the cart holds the soap and the towels;
  - the snapshot records each select's row as its title;
  - the step built from the second select's handle is saved with `context.record.text` = the towels' title and a positional selector;
  - on a fresh load it sets the towels to 2 and leaves the soap at 1;
  - after the lines are reordered (the saved selector now reaches the soap's select) it sets the towels to 3 and leaves the soap at 1;
  - once the towels' title is renamed it fails with not_found or ambiguous and changes no quantity;
  - the search box's saved element carries no record.

## Commands run and observed results

- Unit tests: `EXTENSION_TEST_BUILD_LABEL=t463 node scripts/test-extension.mjs content/identity/tests content/action-runtime/tests` printed `# tests 238`, `# pass 238`, `# fail 0`.
  - The first run, before `titleInAnotherRow`, failed 1 existing test: "a keyless record falls back to its own words…". A lone candidate's climb reached the `ul`, whose first link named the other row. I fixed the code, not the test.
- Headed bigbox spec: `pnpm --filter @fluxiq-web-extension/extension test:content -- created-identity/tests/row-bound-control --headed --workers=1` printed `ok 1 … (10.5s)` and `1 passed (41.1s)`.
- Mutation check: I temporarily made the new gate always accept. The same spec then failed at the fresh load with `2 elements matched: select (0.73), select (0.73)`. I restored the file and confirmed the edit was gone (`grep -c "|| true"` printed 0).
- Related specs, all on realistic scenarios only: `pnpm --filter @fluxiq-web-extension/extension test:content -- created-identity check-chosen-option press-answers evidence/tests/controls evidence/tests/page-view-controls live-tasks selectors/tests/volatile-selector-replay shadow-roots/tests/shadow-root-targets type-over-value` printed `72 passed (5.8m)`.
- Typechecks, each printed nothing and `exit 0`:
  - `npx tsc -p tsconfig.json --noEmit` in `apps/extension`;
  - `npx tsc -p tsconfig.test.json --noEmit` in `apps/extension`, which includes the e2e;
  - `npx tsc -p tsconfig.json --noEmit` in `domain`.
- Structure audit: `node scripts/structure-audit.mjs` printed `structure-audit: passed (186 warning(s), 646 baselined).` The warnings on my files are advisory only:
  - `identity/` has 16 files, past the 15 advisory;
  - `record.ts` is 592 lines (it was 508, already past the 400 advisory);
  - `record.test.ts` is 486 lines.
- Capture cost: a temporary spec (deleted afterwards) timed `harness.capture()` 6 times per page, with the row capture on and then off.

  | Page | Row capture on (ms) | Row capture off (ms) |
  | --- | --- | --- |
  | everything-store home | 112–179 | 89–135 |
  | bigbox home | 299–323 (first run 561) | 269–292 |
  | bigbox cart (1 line) | 164–188 | 141–180 |
  | job-board | 47–77 | 39–97 |

  That is roughly 10–30 ms more per capture. On bigbox home the only new records are the two section "View all" links, titled "Pickup today at Carden Falls Supercenter" and "Rollbacks".
- No Lab or paid run.

## Not verified

- No live Lab or extension-loaded browser run. The content harness loads the content bundle into Chromium with no extension.
- Firefox was not run.
- Domain unit tests were not run, because no domain file changed.
- Full suites were not run, per the twice-a-day rule.
- Capture happens before the act. A step whose row had no twin when its handle was captured (a cart with one line) records no row, so replaying it on a cart with two lines keeps the old behaviour: ambiguous, or a positional single match.
- A row whose title is a link with changing words (for example a count) would be refused after the change. That is a refusal, not a wrong row.
- A row laid out in same-class columns, where the control's column also holds a different link, could be refused (`titleInAnotherRow`).
- Architecture docs under `docs/architecture/` were not updated. The module header comments carry the design.

## Open questions or contradictions found

- The old `record.ts` header said a widened row rule would be wrong for recording ("this question is asked only here, only with a pass's values in hand"). This brief asks for exactly that widening. I did not change `isRecordElement`, so the repeat-exemplar folding and snapshot runs are unaffected. Only the capture and gate paths changed, and the header was rewritten to match.
- The trial's step 26 likely acted on the wrong line, but I could not confirm it from the logs. The saved selectors named positions 3 and 4, and a reset cart has the lines at 2 and 3. The exploration cart may have held a third line. No change is needed for this; the new gate refuses a selector match in another line.
