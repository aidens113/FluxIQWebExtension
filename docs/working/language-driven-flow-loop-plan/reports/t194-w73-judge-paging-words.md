# t194-w73: the judge is told why a read's paging stopped in words

## Outcome

Done. Tree: Core `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ`. R/ = `packages/fluxiq/src/programs/automation-studio/runtime/`.

## What changed and why

- **New `R/result-verification/read-account/judge-paging.ts`.** It holds `automationStudioResultSummaryWithPagingWords(summary)` and `automationStudioResultReadForJudge(read)`. Every read on the judge's copy now carries `paging`, which is Core's own clause from `sentence.ts`, prefixed "Read ".
  - **List ended** (`stop.ts` says `list_ended`): `pageLimit` is removed. For run musp39u8 the field reads: `"Read every page (5) and the list ended: its next control was disabled on page 5. There is no further page."`
  - **Page bound** (`page_bound`): `pageLimit` is kept, and the existing page-bound sentence is appended ("...not the list, so the list may go on: raise its maxPages...").
  - **Other stop**: `pageLimit` is kept, and the clause gives the stop word "before its page bound of N".
  - `stop` and every other field are kept unchanged. A summary with no reads is returned as the same object.
- **`R/result-verification/read-account/sentence.ts`.** Two things are now exported so there is only one wording, and `sentence.ts` itself uses both:
  - `pagesClause` is exported as `automationStudioResultReadPagesClause`.
  - The page-bound line from `fullTail` is extracted as `automationStudioResultReadPageBoundSentence`.
  - Output of `sentence.ts` is unchanged, and its own tests still pass.
- **`R/result-verification/read-account/index.ts`:** exports the new file and adds it to the header comment.
- **`R/result-verification/verify.ts:194`:** `resultSummary` is now `automationStudioResultSummaryWithUnreadColumns(automationStudioResultSummaryWithPagingWords(request.summary), ...)`. `request.summary` itself, which the verdict, brief and repair directive read, is not touched.
- **`R/llm/diagnosis-instructions.ts`, in `AUTOMATION_STUDIO_RESULT_VERIFICATION_INSTRUCTION`:**
  - "the pages it read and the most it may read, why paging stopped," now reads "the pages it read, where paging says in words why paging stopped,".
  - A new sentence follows the leftOutOnlyByThis sentence: "A read whose list ended read every page there was: there was no further page, whatever count of results a page prints, and a higher page bound would read nothing more; only a read its page bound stopped carries pageLimit, and its list may go on."
  - A comment records the source run.
- **`R/llm/deepseek/tests/system-prompt-pins.json`:** both `loop_verification` pins are updated with the same two text replacements.
- **Tests:**
  - New `read-account/tests/judge-paging.test.ts` (4 tests):
    - run musp39u8's read (pagesRead 5, pageLimit 5, control_disabled, kept 13, itemsSeen 94) gets the ended-list words and no `pageLimit`, and the original account is left unchanged;
    - a page_limit read keeps 5 and says the list may go on;
    - a rate_limited read keeps its bound;
    - a summary with no reads passes through unchanged.
  - `result-verification/tests/judge-sees-the-read.test.ts`: the request the judge is sent carries `pageLimit: 5` and `paging` with "not the list, so the list may go on" (the earbuds read is page_limit).
  - `llm/tests/diagnosis-channel.test.ts`: new test for the prompt sentence.

## Commands run and observed results

- **Tests before the implementation:** `npx vitest run .../read-account/tests/judge-paging.test.ts` showed 1 failed file (module missing). `npx vitest run .../llm/tests/diagnosis-channel.test.ts .../result-verification/tests/judge-sees-the-read.test.ts` showed `2 failed | 16 passed`: the two new assertions.
- **The brief's validation, after the implementation:** in `packages/fluxiq`, `npx vitest run src/programs/automation-studio/runtime/result-verification src/programs/automation-studio/runtime/llm src/programs/automation-studio/runtime/tests/deepseek-bootstrap` printed `Test Files 175 passed (175)` and `Tests 1656 passed (1656)`.
  - That run started before I added the explanatory comment in `diagnosis-instructions.ts`. The comment changes no code or string.
- **Typecheck:** `npx tsc --noEmit -p tsconfig.json` reports errors only in `activity/tests/scope.test.ts` and `activity/wording/tests/run-ending.test.ts`. Both belong to other workers' in-progress files. None of the errors is in a file I changed.

## Not verified

- No live judge run, so whether the new words change the judge's answer is unproven.
- The `deepseek-bootstrap` tests pinned no read or request size, so nothing changed there.

## Open questions or contradictions found

- `paging` is not declared on `AutomationStudioResultReadAccount` in `contracts.ts`, which I do not own. It is typed in `judge-paging.ts` as `AutomationStudioResultReadForJudge`, which is still assignable to the contract. Consider declaring `paging?: string` in `contracts.ts` so the field is visible where the summary is defined.
- The pins JSON sits under `llm/deepseek/tests/`, and I edited it under "tests pinning the old prompt". The edit is the same two text replacements made in the instruction.
