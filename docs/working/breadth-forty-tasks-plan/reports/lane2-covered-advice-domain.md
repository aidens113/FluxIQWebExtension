# Report: lane2-covered-advice-domain

## Outcome

Done.

## What changed and why

- `domain/src/runtime/llm-evidence/repeated-refusal.ts`: `repeatedRejectionDetail` now restates `closeWith`. Before this, a repeat of a covered press (`answered_the_same_again`) dropped the closers, so its `next` fell back to the no-closer wording (run-mvcwem7d-34689f55, step 0013). There is a comment on the line citing the run.
- `domain/src/runtime/llm-evidence/rejection-next/next-sentence.ts`: `webLlmRejectionNext` takes an optional `target`. The two fixed covered sentences are replaced by `coveredNext(cover, target, closeWith)`:
  - With closers: "Nothing was done: layer t476 covers t474. Press t478 or t488 first; it closes that layer. Do not press t474 again while t476 covers it: that press is refused the same way. Once the layer is gone, press t474 again." Three or more closers read "t6, t7 or t8".
  - Without closers: "... Close or answer that layer first with a control inside it (the page view lists those after the layer's own line), never a control marked covered-by t476: those lie under the layer. Do not press ... refused the same way. Once the layer is gone, press t474 again."
  - A value is inlined only if it matches `/^t[1-9][0-9]*$/`. Otherwise the sentence falls back to "the layer in instead", "the target", "the layer" or "one of closeWith". The closers are all inlined or none are.
  - The sentence never says "make this same call again, unchanged".
  - The header now says a sentence may hold this domain's handles. A doc block cites run-mvcwem7d-34689f55. `staleHandleNamed` reuses the shared `isHandle`.
- `domain/src/runtime/llm-evidence/tool-rejection.ts`: `rejectionDetail` passes `fields.target` into `webLlmRejectionNext`. A repeat goes back through `rejectionDetail`, so it says the same sentence again.
- Tests:
  - New file `domain/src/runtime/llm-evidence/rejection-next/tests/next-sentence.test.ts` with 4 tests: the exact with-closer sentence and the order of handles in it; the no-closer wording; the fallback for values that are not handles; that no covered `next` contains "unchanged".
  - `domain/src/runtime/llm-evidence/node-run/tests/covered-press.test.ts`: the line that pinned the old wording now checks the exact new sentence.
  - Same file: one new end-to-end test. Pressing the same covered control twice through the runtime gives `answered_the_same_again` with `repeatedAnswer` 2, the same `closeWith`, and the same closer-naming `next`. Nothing is sent to the page.
  - I first put the repeat test in a new `llm-evidence/tests/repeated-refusal.test.ts`. The structure audit failed it: that directory would then hold 26 files, over its 25-file limit. So the test moved into covered-press, which also exercises the real path.

## Commands run and observed results

- `cd domain && DOMAIN_TEST_BUILD_LABEL=lane2-covered-advice node scripts/test-domain.mjs rejection-next/tests node-run/tests/covered-press llm-evidence/tests/repeat-across-explorations llm-evidence/tests/tool-rejection-detail action-failure/tests/refusal` -> `# tests 42 # pass 42 # fail 0`.
- `cd domain && npx tsc -p tsconfig.test.json --noEmit` -> exit 0, no output.
- `node scripts/structure-audit.mjs` (lane tree root) -> `structure-audit: passed (204 warning(s), 638 baselined)`. Two earlier runs failed and were fixed: the 26-file directory limit, then a `regexp-template-escapes` error in my new test.

## Not verified

- No live run and no full domain suite. `pnpm build` and the Lab were not run, per the brief.
- Other domain tests that assert on covered wording outside the directories above. I searched for "make this same call again" and the only hit was covered-press.

## Open questions or contradictions found

- Task 3, whether anything strips or rejects a `next` that holds handles: I found nothing that does.
  - The domain checks `WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS` (`capture.ts`) against the result's top-level members, not the detail's strings.
  - `packages/test-contracts/src` mentions `next` only as a pagination mode.
  - Core (`fxwork/t565/!FluxIQ/packages/fluxiq/src`): no handle-pattern screen and no reader of `detail.next`. The refusal evidence is passed to the model as is.
  - The test "no refusal carries a word of the page" (`tool-rejection-detail.test.ts`) still passes. Handles are not page words.
  - `STALE_NEXT_INSTEAD` already relied on handles reaching the model through `instead`.
- Not owned, so left unchanged: `system-instructions/instructions.ts` line 61 still tells the model "press one, then make the same press again". That matches the new order but not the new emphasis. The supervisor may want it aligned. If so, it must stay free of scenario words.
