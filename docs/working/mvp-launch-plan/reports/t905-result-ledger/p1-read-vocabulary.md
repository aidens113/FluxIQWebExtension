# p1 read vocabulary (invariant I7)

## Outcome
Partial by design: test written; 4 of 5 cases pass, the I7 case fails on five real gaps (no exemption added, no source edited).

## What changed and why
New `domain/src/runtime/llm-evidence/page-view/tests/read-vocabulary.test.ts`. It reads `state-tokens.ts` as text and requires every `tokens.push(` site to be claimed by a table row (or a named view-token row with a reason), so a new token fails. Each row's probe is driven through `webLlmStateTokens` and must print the token. Each row names the source the token is printed from and the read field that fills from it; the real `webAutomationExtractListRequestRead` must accept and keep that field. A row whose source no field kind reads has `read: undefined` and fails the last case. View tokens excluded with reasons: covered-by, focused, modal, layer kind, covers n.

## Commands run and observed results
- `DOMAIN_TEST_BUILD_LABEL=t905-w3 node scripts/test-domain.mjs page-view/tests/read-vocabulary` -> ok 1-4, `not ok 5 - every printed element token maps to a read field (I7)`; pass 4, fail 1.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (248 warning(s), 552 baselined)` (an earlier run flagged a deep import; fixed to the `../element` barrel).

## Gaps (the failing case; each needs a read field added)
Attribute-sourced tokens (placeholder, aria-checked, open/closed via aria-expanded, selected, pressed, current, disabled/aria-disabled attributes) are covered, since an `attribute` field reads any attribute. Not covered, all printed from a non-attribute source:
1. `disabled` from `cursor: not-allowed` (computed style). Read field would be a new mark or attribute-like read in `apps/extension/src/content/extraction/field-reader.ts` (`readElement`, new case) with its kind/mark added in `domain/src/actions/extraction/request.ts` (`WEB_AUTOMATION_EXTRACT_FIELD_MARKS`) and `schema.ts`; offered as a column by `item-mark/state-sources.ts` (`stateMarkSources`, STATES lacks disabled).
2. `marked` (capture `setApart`, a computed style). Same place: a new mark `field-reader.ts` readElement plus the marks list.
3. `checked/unchecked` for a native checkbox or radio (live `checked` property; only `aria-checked` is readable). `field-reader.ts` `controlValue` returns `.value` ("on"), not checked state; fix in `controlValue` or a `state` mark reading the property, and `stateMarkSources` (aria attributes only).
4. select selected-option label (`="Medium"`): `controlValue` returns the option value, not its label. Add in `field-reader.ts` `controlValue` (a label mode) and the field kind list in `request.ts`.
5. select option list (`[a|b]`): no field reads it; same files as 4.

## Not verified
Whether the page reader actually fills attribute fields on a real page (only the domain request reader was exercised); no tsc run output was captured for the new file beyond the test bundle compiling.

## Open questions
Decide whether select options (5) is wanted as a column or belongs in `VIEW_TOKENS`; I did not exempt it.
