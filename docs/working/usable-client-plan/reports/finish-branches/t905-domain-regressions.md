# t905 domain regressions (finish-branches)

## Outcome
Done. Both tests pass on t905, and the brief's suite is fully green. One thing needs the lead: t905's D3 cannot be kept as built (see Open questions).

## Cause (one change breaks both tests)
- Commit c715a1396 (t905 phase 1, "D3") changed `webNodeDispatchParameters` in `domain/src/runtime/llm-evidence/node-run/rejected-rows.ts`. Every exploring list read now sent `extractList.answer: "kept"`.
- element-record.test.ts failed at `assert.deepEqual(dispatched, { item: LINE, fields: {...}, maxItems: 1 })`. The actual value had an extra `answer: 'kept'`.
- reauthor-reruns-own-extraction.test.ts failed at `assert.deepEqual(reads.at(-1)?.extractList, { item, fields, where, minItems: 0 })`. The actual value again had an extra `answer: 'kept'`.
- These failures were captured in the heavy slot with `DOMAIN_TEST_BUILD_LABEL=t905dom node scripts/test-domain.mjs <both files>`: exit 1, 2 failing, 1 passing.
- The merge from dev did not cause this. The reauthor test is older than t905. t905's own validation ran only the tests beside its change, so it never ran this test.

## Fix
- Exploring dispatch is back to dev's contract. A read goes to the page exactly as it resolved, plus `rejectedSamples: true` when it proposes, and with no `answer`. Only the Flow's own dispatch and the draft's replay add `answer: "kept"` (`output-nodes/extract-list/dispatch.ts`, unchanged).
- I removed the now-unused import and added a doc comment explaining why exploring reads send no `answer`.
- `node-run/tests/rejected-rows.test.ts`: c715a1396 had flipped one assertion so the dispatch must carry `answer === "kept"`. I restored dev's assertion that an exploring dispatch has no `answer`. t905's other new assertion is kept: the kept Flow call has no `answer`.
- What still holds from t905's intent:
  - The account wording (I4, `shown-rows/account.ts`): when an answer's rows are ones the conditions rejected, the model is told they are rejected and no result row.
  - Core's guard (`answer-first/rows/found-rows.ts`) counts an unfiltered answer as no rows found.
  - Flow and replay reads still answer kept rows only.
  - `listKey`, `place` and the rest of t905 are untouched.
- No caps, no special cases, Core not edited, and the two spec tests not edited.

## Commands run and observed results
All commands ran in the t905 tree.
- From domain/: `heavy-slot run t905dom-tests -- node scripts/test-domain.mjs src/actions/extraction src/runtime/llm-evidence src/output-nodes/extract-list` with `DOMAIN_TEST_BUILD_LABEL=t905dom`. Exit 0: tests 1916, pass 1916, fail 0 (before the fix: 1914 of 1916).
- From the tree root: `heavy-slot run t905dom-check -- pnpm.cmd --filter @fluxiq-web-extension/domain check`. Exit 0. core-build reported "current with its source", and both tsc passes completed.
- From the tree root: `node scripts/structure-audit.mjs`. Exit 0: "structure-audit: passed (255 warning(s), 551 baselined)". This light script ran outside a heavy slot, by mistake. No rebaseline.
- I changed no extension source, so I ran no extension tests or check.

## Not verified
- I did not look at live or browser behaviour of exploring reads with the page's floor back. There is no Lab run.
- I did not run Core's tests, and I did not read Core's unwired phase-2 ledger beyond a grep for `unfiltered`.

## Open questions and contradictions
- D3 ("exploring reads send `answer: "kept"` and drop the floor") contradicts dev's spec in three places:
  - the two named tests (each deep-equals the dispatched `extractList`);
  - dev's `rejected-rows.test.ts`: "an exploration read asks for every row, never the kept rows alone";
  - dev's `shown-rows.test.ts`: an unfiltered answer keeps its rows in `extracted`.
  - t905 also left `actions/extraction/request.ts` and `content/extraction/filtered-answer.ts` saying exploration keeps the floor.
- There are two other ways to keep D3, and I rejected both:
  - Filtering the rows in the domain would re-implement the page's answer summary (truncated, order, gaps) and break dev's shown-rows spec.
  - Sending the request outside `extractList` would need a second channel for one setting, plus an extension change.
- If the lead still wants exploring reads to be kept-only, that is a change to dev's spec tests and needs the lead's decision. The t905 ledger line saying "exploring reads send answer: kept (D3)" is now inaccurate and should be updated by the lead.
