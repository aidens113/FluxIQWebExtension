# t797-w4 place token per act

## Outcome
Done. No source change was needed; added a regression-guard test.

## Where each token comes from
All four are the one function `webControlPlace(page, handle)` in `domain/src/runtime/llm-evidence/control-spot/place.ts`, which hashes resetResource + evidence.location + control role + record, off the page binding it is given:
- spot.place: `webTargetSpot` (control-spot/target.ts) on the BEFORE page of the step (`state-diff/places/diff.ts` `spotOf`).
- controls before/after: `controlsAt` (diff.ts) is keyed by `spot.place` and looks it up in `webControlStates(before|after)` (states.ts), which calls `webControlPlace` for every element of each capture.
- replaced values: `valuesAt` (diff.ts) / `value-replacements.ts`; value places are a separate token kind (`...\0value\0frame\0selector`, values.ts) by design, but `values.page`/`location` are built from the same before.resetResource + before.evidence.location as `controls.page`/`location` and `spot.scope`.
- receipt: `observeWebStartState` (start-state/observe.ts) uses `webControlStates(captured)`, same function.

## Could they disagree before?
Not for an act that stays on its page (the tested case): one function, same address inputs. Residual, not fixed: `controls.after` is looked up under the BEFORE page's place, so an in-document location change (pushState to another page) yields `after: {}`; that is correct (the control is not at that place there) and outside this brief.

## Changed
Only `domain/src/runtime/llm-evidence/control-spot/tests/place-per-act.test.ts` (library catalogue, entries 1 and 2, Reserve toggle in no row plus a copies count; two tests). It passed on unchanged source, so it is a regression guard (no source fix, nothing to fail first).

## Commands
- `DOMAIN_TEST_BUILD_LABEL=t797-w4 node scripts/test-domain.mjs control-spot state-diff` (under the lock): both new tests `ok` (20, 21); run summary showed all pass, 0 fail.
- `npx tsc -p tsconfig.json --noEmit` in domain: exit 0.
- `node scripts/check/model-text.mjs`: ok. `node scripts/structure-audit.mjs`: passed (232 warnings, 616 baselined; none new from my file that I saw).

## Not verified
Real browser/Lab behaviour; the test uses sanitized fixtures only.

## Open questions
None.
