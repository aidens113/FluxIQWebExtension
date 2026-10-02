# t195-w24a: the dry run's check tells "already done" from "hidden behind a closed panel"

## Outcome

Done, with one contradiction for the supervisor (see the last section). Under the brief's own rules, run 40's dry-run page most likely still answers `present`.

## What changed and why

**What the cause actually was.** The check did not mistake a hidden button for a missing one. It never found the button at all. `web.dom.assert` asked the step's selector of the light document (`document.querySelector`). Bigbox's store chooser lives in an open shadow root, and its recorded selector `div > ul > li:nth-of-type(3) > button` was written inside that root, so in the light document it matched nothing. The `visible` check therefore always timed out on that button, whether the flyout was open or closed. `verify.ts` reads a timeout as "not on the page", so the step answered `present` on its own page. For a target that the page does find, the extension already told absent (TIMEOUT) apart from hidden (STATE_MISMATCH). It did not tell hidden by a closed ancestor apart from hidden itself.

Files changed:

- `apps/extension/src/content/action-runtime/assertion-evaluation.ts`
  - `AssertionTarget` gains `shadowHosts`. A selector that comes with a recorded host chain is now queried in the roots that `resolveShadowScope` reaches, the same scope the resolver presses in. The chain is resolved again on each poll.
  - A failed `visible` claim on an element that was found now says what hid it:
    - Hidden by a closed container: an ancestor across shadow boundaries with `display:none` (or the `hidden` attribute), a closed `<details>` where the element is not its summary, or an inherited `visibility:hidden`. `actual` = `"enclosed: it is present inside a closed container, so it is not visible"`.
    - Hidden itself: `actual` stays exactly `"it is present but not visible"`, because `e2e/content/tests/check-assert.spec.ts:279` pins that sentence word for word.
  - `isVisible` reads style from the element's own window rather than the global one (needed for the stub page).
  - The ancestor walk (`isInsideClosedContainer`) is module-private. A separate file would have pushed `action-runtime/` to 26 files, and the structure audit fails above 25.
- `apps/extension/src/content/actions/assert.ts`: `assertionTarget` passes `shadowHosts` from `action.element.context` or `action.options.element.context`, the two places the resolver reads a recorded target from.
- `domain/src/runtime/llm-evidence/node-run/hidden-target.ts` (new): `webNodeHiddenTarget(result)` reads the failure record's `actual`.
  - `enclosed:` prefix gives `"enclosed"`; the exact pinned sentence gives `"itself"`; anything else gives `undefined`.
  - This follows the existing `covered:` precedent in `action-failure/refusal.ts`. No new failure code or wire field was added, because `domain/client` and `codes.ts` are not mine.
- `domain/src/runtime/llm-evidence/node-run/verify.ts`: on a STATE_MISMATCH from the `visible` check, there are three outcomes:
  - **enclosed**: `core.replay.failed`, `found: "hidden"`, reason `state_not_as_asserted`, said "...inside a closed container that no step before it opens...".
  - **itself**: goes through `webNodeReplayMissingTarget(..., "withdrawn")`. That gives `present` on the step's own page and `unreproducible` elsewhere, with `found: "hidden"`.
  - **unknown** (older client, or withheld text): `failed`/`hidden` as before, which is fail-safe.
  - The header was rewritten to describe what each answer means.
- `domain/src/runtime/llm-evidence/node-run/missing-target.ts`: new optional parameter `shown: "gone" | "withdrawn"` (default `"gone"`), which changes the wording and `found` for a checked step. The header was updated. The `replay.ts` caller is unchanged.
- **No Core change.** Core reads only the codes, and `core.replay.failed` already fails a verify step (`verify-only.ts:152`). `found` and `said` are evidence for the model. `run.ts` is untouched.
- **Tests:**
  - `node-run/tests/replay-verify.test.ts`: 5 new rows. The type `AssertAnswer` now allows `actual`.
  - `content/action-runtime/tests/assertion-visibility.test.ts` (new): 5 rows on the stub store-chooser page.
  - `content/actions/tests/assert.test.ts`: 1 new row.

## Commands run and observed results

- `node .../run-dir-tests.mjs domain w24a runtime/llm-evidence/node-run/tests`: tests 107, pass 107, fail 0.
- `node .../run-dir-tests.mjs apps/extension w24a content/action-runtime/tests content/actions/tests`: tests 204, pass 204, fail 0. This was run before and after inlining the helper.
- **Revert check.** I restored the HEAD copies of `verify.ts`, `missing-target.ts`, `assertion-evaluation.ts` and `assert.ts`, ran the tests, then copied my versions back (`git status` confirmed the restore).
  - Domain: 3 of the new rows fail (enclosed gives failed/hidden; withdrawn on its own page gives present; withdrawn elsewhere gives unreproducible).
  - Extension: 4 rows fail (closed flyout says `enclosed:`; open flyout is visible; hidden itself; host chain carried).
  - The remaining new rows pass on the old code too. They are guards on behaviour that is meant to stay the same:
    - Unknown `actual` stays failed.
    - A disabled target reads disabled.
    - A selector asked of the light document matches nothing.
    - With Millbrook already chosen (flyout open or closed), nothing matches.
- `bash heavy.sh "t195-w24a domain check" pnpm --filter @fluxiq-web-extension/domain check`: exit 0, no errors. One earlier run exited 1 with no compiler output. It coincided with Core inputs changing during the run (another lane). The rerun was clean.
- `bash heavy.sh "t195-w24a extension check" pnpm --filter @fluxiq-web-extension/extension check`: exit 0. Build-cache: "not stamped, because inputs changed while it ran (core:packages/fluxiq/src)".
- `node scripts/structure-audit.mjs`: "passed (154 warning(s), 118 baselined)", exit 0. The first run failed `[directory-files] action-runtime/: 26 source files`; that was fixed by inlining the helper.

## Not verified

- No browser, Lab or live run, as the brief requires. In particular, these were not checked in a real browser:
  - computed `display`/`visibility` on real shadow DOM;
  - closed `<details>`;
  - the declarative-shadow-DOM host chain on bigbox.
- The e2e `check-assert.spec.ts` was not run. The sentence it pins was kept on purpose.
- No test covers a closed `<details>` or an inherited `visibility:hidden`. The stub page has no builder for them.

## Open questions or contradictions found

1. **Run 40 is probably not fixed by these rules.** The debug says Millbrook was already chosen from exploration. On bigbox (`store-picker.ts:13`), the chosen store's card holds `<span>Your store</span>` and no button. So on the dry-run page Millbrook's button was replaced, not hidden. Now that the selector is asked in the right root, it matches nothing and still answers `present`. That is also what the brief asks for in its third test ("the chip names the chosen store gives present"), and the new extension test pins it.
   - The hidden-in-closed-panel case this change catches is the fresh-site state: another store chosen and the flyout closed.
   - To fail run 40 as well, the check would have to find the step's place (its recorded `context.record`, the card) and see that it sits in a closed container even though the button inside it was replaced. That would contradict the brief's third test whenever the flyout is closed.
   - Supervisor's call.
2. **The step's effect is not recorded anywhere verify can read.**
   - For a click, `replay.produced` is only a record count for reads.
   - Core sends only `from` back on a verify (`AS/runtime/llm/node-tools/replay.ts:132`).
   - So "the recorded effect is visibly in place" cannot be implemented from recorded data. What the page can show stands in for it: hidden by a container versus withdrawn itself.
   - Carrying an effect description would need a `run.ts` statement field plus Core carrying it back.
3. **Older clients.** An extension built before this change reports an enclosed target as `"it is present but not visible"`. The domain then reads that as withdrawn, which gives `present` on the step's own page. Before this change the same target answered `failed`. This only matters if the extension lags the domain. They ship from one tree.
4. **Pre-existing gaps, not changed.**
   - The assertion still matches a positional selector without the record veto the resolver applies. With cards reordered, `li:nth-of-type(3) > button` could find another store's button.
   - A target with no recorded host chain is still not widened into shadow roots.
