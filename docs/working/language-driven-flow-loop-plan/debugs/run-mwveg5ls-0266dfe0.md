# run-mwveg5ls-0266dfe0: bigbox new-store cheapest towels, stopped (never detected the cart's list; every judge was over rows that could not be the cart table)

Lane: t1015 `paid-bigbox`, on dev 63ba8dc13 / Core af7bfe2da (fluxiq 0.54.18, with t1029-t1033).
Task: `bigbox-retail/bigbox-retail-new-store-cheapest-towels`, answer-first, attempt 1, visible Chrome, run watcher on.
Provider: Anthropic `claude-haiku-5-5` for build and judge.
Evidence copy: `C:/Users/osrs_/FluxStuff/fxwork/recorded-evidence/t1015-bigbox/run-mwveg5ls-0266dfe0/` (steps only). Debugged offline by t1034; no live or paid run.

## Attempt 1

- Verdict: **stopped by the lead** at step 291, not accepted. $3.15 by the watcher (the step files add up to $3.30 with the decision at 0292): 127 decisions ($2.64), 11 judge calls ($0.66), 21 acts, 3 unreadable decisions and 1 unreadable judge reply.
- Path: the store was set; the cheapest qualifying item was added to the cart; the dish soap was kept. The model went to the cart page at 0107 (a press on the cart link) and stayed there to 0134, using `find_on_page` ("Qty", the item's name), `core.recall_result` and an `amend_draft take` of the search read. A `run_flow` at 0135 replayed the Flow back onto the search results, page 3, and every call from then to the end ran there.
- The result was the search read (name, price, rating, pickup, 1 row) from the first completion to the last. No read of the cart ever ran.
- After 0198 the model kept trying to "read the cart table" from the search page:
  - **0209, 0211, 0219, 0222, 0224, 0229, 0231, 0238, 0248:** `dom-extract_list` with `extraction.3`, the search results' own handle, under call ids such as `read.cart.table.23`. They returned the search rows, or were refused `repeat_refused` (changed nothing).
  - **0240, 0242:** `dom-extract_list` with handle `t2892`, the cart page's "Qty" label that the 0109/0128 finds had printed. Both were refused `column_not_in_detected_list` (`name` / `span_css-…`).
  - **0275, 0286:** `detect_repeating_structure` at `t2892`, refused `handle_not_in_packet` with no `next`.
  - **0273, 0282, 0284, 0290:** `detect_repeating_structure` at `t2330`, the search results' row, on the search page (callId `cart.table.fresh.71`).

  Then came finish_with_best at 0255 and 0263, and 40 decisions without an act. Loop handling steered seven times without effect.

## Why the model never detected the cart's list

What it was told, and where each sentence led:

1. **The completion refusals (0068 through 0281), t1032's words:** "To make the table asked for the result, read it where the site shows it, naming its columns as the request names them, in a call with add: true". The model was on the cart page when it was first told this (0114, 0119). It never read a list there: nothing said that a list is read through a handle its own detection issued on the page where the list stands. "Naming its columns" led it to rename the search read's fields (`item`, `quantity`) on the search list's handle.
2. **`repeat_refused` (0212, 0225, 0230, 0249):** this is Core's generic sentence ("look at or search the page ... use a different control or a different input"). It says nothing about which list a read's handle names.
3. **`column_not_in_detected_list` at 0241 and 0243:** a read with `extractList.handle: "t2892"` is a read of that one element as a one-row table (`plan-resolution/extraction/element-record.ts`, t903), whose only columns are `text`, `value` and `link`. The `next` said "`name` is not a column of the list this read's handle names ... Write the read again with keys from this list's own fields". No list and no detection existed, so the model tried the same handle again.
4. **`handle_not_in_packet` at 0276 and 0287:** the refusal had no `next` at all.
5. **The judges' nos** named "the cart table was not produced" among other defects, behind the t1032 words above.

Its detections: 0004 (`t45`, home page) and 0010 (`t440`, search page), then 0172, 0183, 0274, 0283 (and 0184, 0189, 0284, 0290, answered `already_answered`), all at `t2330`, a search-results row, on search page 3. 0154 at `t440` (after the page moved), and 0276 and 0287 at `t2892`, were refused `handle_not_in_packet`. None ran on the cart page.

## The unreadable replies

The lead counted six `llm.provider_output_invalid`: the three decisions and their three `answer-unusable` rows. The judge's re-ask (0235) is a fourth unreadable reply, of another kind.

| Step | Reply | Misses | Class | Now |
| --- | --- | --- | --- | --- |
| 0073 | a press with `add: true, act: "a1"` written inside `input` | `input.add`, `input.act` "is not a key this object takes" | a call's own keys one level too deep: it can only mean one decision | read as that call (`decision-reading/own-keys-lifted.ts`), then checked as one written in place |
| 0192, 0215 | `core.run_node` with node `web.output.dom-capture_snapshot` while looks were withdrawn | `input.node` "must be one of ..." (the narrowed list) | a decision naming a withdrawn look | the adapter allows that one action at that key and holds every other key to the variant (`anthropic/decision-check.ts`). The loop refuses it by name, `llm_evidence_loop.look_withdrawn`, as it refused 0202's look |
| 0234 (judge) | a no with eight defects; its `act_wrong` wrote `column: ""` beside `value: "added to cart"` | `llm_output.verification_defects_required` | a blank optional text on an act's defect | read: a blank `column`/`value`/`step` is not written, and an act's defect may carry a value with no column (`verification-defects/well-formed.ts`). 0236's $0.074 re-ask is no longer needed |

At 0192 and 0215 the model was also told nothing about what was wrong. The miss's rule names the first eight offered node ids and is 246 characters long. The reply account drops any miss whose rule is over 200 characters (`runtime/models/failures/reply-account.ts`, `MISS_RULE`), so the feedback said only "it did not fit the answer asked for". With the fix this miss is not raised for a withdrawn look. It can still happen for a node id that is wholly unknown. See "Not fixed".

## Judge cost

The 11 judge calls were 0067, 0101, 0113, 0149, 0198, 0205, 0227, 0234, 0236 (a re-ask of 0234), 0256 and 0280. They cost $0.66, a fifth of the run. Every one was over a result whose rows held `name, price, rating, pickup`. The request names `item, quantity, price`. Since t1032 a judge's yes over rows with nothing for a named column is refused (`cited-yes/records-yes.ts`). **None could have passed, so none was needed.** Their nos added the cheapest-item doubts, which a judge would still find once the rows are the cart table.

Fix: the completion check refuses such rows itself before any judge, as `answer_first.not_asked_table`, using the same predicate (`asked-words/table-lacks.ts`, shared with `records-yes.ts`). It counts as a refusal of that evidence, so the same rows again are `same_evidence`. A judge is asked once the rows may be the table: a held column that shares a word with a named one is left to the judge, as `records-yes.ts` leaves it. A result with no rows also goes to the judge.

## Fix, t1034

Core:

- **`framework/.../answer-first/completion/asked-table.ts` (new), `check.ts`, `refused-words.ts`:** rows that cannot be the table the request names are refused with no judge call. The refusal says which named columns they lack and how the asked table becomes the result.
- **`completion/result-columns.ts`:** the words now say where that read is made: "The table asked for is a list of its own: a list is detected where it stands, on the page that shows it, and read through the handle that detection issues, so a read through a handle from another page or another list returns that other list, or nothing, and never the table asked for ... go to the page that shows it, detect its list there, and read it through the handle that detection issues".
- **`runtime/result-verification/asked-words/table-lacks.ts` (new), `cited-yes/records-yes.ts`:** this is the one predicate for "the rows hold nothing for a named column".
- **`runtime/llm/decision-reading/own-keys-lifted.ts` (new), `read.ts`, `reading.ts`, `harness/provider-result.ts`:** the sixth reading, the mirror of `tool-call-keys/folded.ts`. It is said in the step log as `llm_output.own_key_lifted_from_input`.
- **`runtime/llm/decision-handlers/look-withdrawal.ts`, `anthropic/decision-check.ts`:** `automationStudioLlmEvidenceWithdrawnActions` reads back the withdrawn actions from the note that `narrow` writes. The adapter allows such an action at its key and holds every other key to the variant.
- **`runtime/llm/verification-defects/well-formed.ts`:** a blank optional text is not written, and an act's defect may carry a value with no column.

Downstream (`domain/src/runtime/llm-evidence/rejection-next/`):

- **`unknown-column.ts`, `next-sentence.ts`:** a read through an element's own handle (`tN`) refused for a column is told that the handle "names one element, not a list", that its only columns are `text`, `value` and `link`, and that a list is detected where it stands and read through its detection's handle. A read of a detected list is told what it was told before.
- **`next-sentence.ts`:** `handle_not_in_packet` now carries a `next`. It says that a handle names an element of the view that printed it, and that a list another page shows is detected and read there, by a handle that page's own view prints.

## Offline proof

Each test uses a synthetic site and fails before its fix:

- Core `answer-first/completion/tests/asked-table.test.ts`: the recorded shape (a request for a basket table with three named columns, two acts, a one-row search read) is refused with no judge and with the new words, and the same rows again are `same_evidence`. The basket's own rows are judged.
- Core `anthropic/tests/asked-table-replies.test.ts`: 0073's shape is read through the adapter and the harness. 0192's shape, with looks withdrawn by the real `automationStudioLlmEvidenceLookWithdrawal`, is passed on and refused by the loop's own check as `llm_evidence_loop.look_withdrawn`. Other keys are still held, and an unknown node is still refused.
- Core `verification-defects/tests/blank-optional.test.ts`: 0234's defect shape is read, and a current no carrying it parses.
- Domain `rejection-next/tests/list-handle-elsewhere.test.ts`: through the real runtime, a label's handle printed by a search is read with three table columns, and a detection is asked at a handle another page printed. The tests check what each refusal now says.

## Not fixed

- **A miss's rule over 200 characters is dropped from the feedback** (`runtime/models/failures/reply-account.ts`, `MISS_RULE`; the rule comes from `runtime/models/providers/anthropic/schema-misses.ts`, which lists up to eight enum values). A reply naming a node id the catalog does not hold is still told only "it did not fit". Both files are outside t1034's paths. The fix belongs at the source: say an enum miss within the bound (for example "must be one of the N values the schema lists at this path"). Raising the bound is not the fix.
- **Why 0240's `t2892` was bound on the search page at all.** It had been printed on the cart page; in a synthetic run the same read from another page is refused `page_moved_since_packet` (`list-handle-elsewhere.test.ts`). The recorded run instead bound it and refused for a column. The page between was reached by a `run_flow` replay. The target store's view history after a replay is in `plan-resolution/`, outside t1034's paths. This was not traced.
- **Decision cost grew with context:** about 25k input tokens per decision early, about 220k late, which is $0.003 to $0.027 a decision. Most of the spend was decisions, not judges. This was not in the brief.
