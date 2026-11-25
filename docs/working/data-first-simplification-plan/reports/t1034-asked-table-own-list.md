# t1034 report: the asked table is read from its own list; the remaining unreadable replies; judge cost

Worker: t1034-asked-table-own-list (Opus). The work was offline only, on the recording `run-mwveg5ls-0266dfe0`. No Lab run, no paid run, and no git command that changes anything.

## Outcome

Done. The cause of each of the three items is traced and fixed at its source, and each fix is proven offline by tests that fail without it. The run's debug is `docs/working/language-driven-flow-loop-plan/debugs/run-mwveg5ls-0266dfe0.md`. That file has the step-by-step account.

## What changed and why

**1. Why the cart's list was never detected.** The model was on the cart page at steps 0107 to 0134, and that is where it was first told t1032's words: "read it where the site shows it, naming its columns as the request names them, in a call with add: true". Nothing said that a list is read through a handle its own detection issued on the page where the list stands. It ran finds and recalls and took the search read. After a replay put it back on search page 3, it did three kinds of things:

- It read the search list's own handle (`extraction.3`) under call ids such as `read.cart.table`.
- It read `t2892` as a list. That handle belongs to a "Qty" label printed by a find on the cart page. The read was refused `column_not_in_detected_list`, and its `next` sent it to "keys from this list's own fields" of a list that did not exist.
- It asked twice to detect a list at `t2892`. Both were refused `handle_not_in_packet` with no `next`.

All of its detections ran at a search-results row on the search page. The fixes:

- Core `answer-first/completion/result-columns.ts`: the words now say that the table asked for is a list of its own. A list is detected where it stands, on the page that shows it, and read through the handle that detection issues. A handle from another page or another list returns that list, or nothing, and never the asked table. The words then tell the model to go to that page, detect its list there and read it through that handle.
- Domain `rejection-next/unknown-column.ts`, `next-sentence.ts`: a read through an element's own handle (`tN`) is told that the handle names one element, not a list, whose only columns are text, value and link, and is given the same detection sentence. A `handle_not_in_packet` refusal now has a `next`: a handle names an element of the view that printed it, and a list another page shows is detected and read there.

**2. The six unreadable replies.** These are 3 decisions plus their 3 `answer-unusable` rows. The judge re-ask at 0235 is a fourth reply of another kind.

- **0073:** `add` and `act` were written inside `input`. A new reading lifts them out: `runtime/llm/decision-reading/own-keys-lifted.ts`, wired into `read.ts` and `reading.ts`, with the diagnostic `llm_output.own_key_lifted_from_input` in `harness/provider-result.ts`. It is the mirror of `tool-call-keys/folded.ts`. It applies only to an offered tool whose input schema does not declare the key, and never overwrites a key already written beside `input`.
- **0192, 0215:** these named the snapshot node while looks were withdrawn. The Anthropic adapter held them to the narrowed enum and refused them unread, although the loop has its own named refusal for this case. Now:
  - `decision-handlers/withdrawn-actions.ts` is a new module with no imports. It owns the note that narrowing writes and reads the withdrawn names back from it.
  - `anthropic/decision-check.ts` allows such an action at its key, while every other key is still held to the variant.
  - The loop's backstop then refuses it as `llm_evidence_loop.look_withdrawn`.
  - `look-withdrawal.ts` uses the shared note.
  - A node that was never offered is still refused unread.
- **0234 (judge):** the judge's `act_wrong` defect wrote `column: ""` beside a value. That made the whole current no malformed, and the $0.074 re-ask followed. In `verification-defects/well-formed.ts`, a blank `column`, `value` or `step` now counts as not written, and an act's defect may carry a value with no column. A row's value still needs its column.

**3. Judge cost.** All 11 judge calls ($0.66 of the step files' $3.30) were made over the search read, whose columns were name, price, rating and pickup. The request named item, quantity and price. Under t1032, a judge's yes over rows that lack a named column is refused, so none of the 11 was needed.

- `completion/asked-table.ts` is new. `completion/check.ts` and `refused-words.ts` now refuse such rows before any judge, as `answer_first.not_asked_table`, with the column words. The refusal is recorded as a refusal of that evidence, so the same rows again are `same_evidence`.
- The predicate is shared with `cited-yes/records-yes.ts` through the new `runtime/result-verification/asked-words/table-lacks.ts`. A held column that shares a word with a named column still goes to the judge, and so does a result with no rows.

Existing tests changed because the behaviour changed on purpose:

- Core `completion/tests/result-columns.test.ts` and `rows-not-read.test.ts`: rows that lack a named column are no longer judged.
- Domain `tool-rejection-detail.test.ts`, `structure/tests/detect.test.ts` and `harness-options/tests/detect-option.test.ts`: `handle_not_in_packet` now carries a `next`.

## Commands run and observed results

**New tests, failing before the fix.** I put the HEAD versions of the fixed sources in place, ran the new tests, then restored the fixed files.

- Core: `node ../../scripts/vitest-groups.mjs --groups=parallel <asked-table.test.ts> <asked-table-replies.test.ts> <blank-optional.test.ts>` -> "Tests 8 failed | 5 passed (13)". The 5 that passed are guard cases that should pass either way.
- Domain: `DOMAIN_TEST_BUILD_LABEL=t1034 node scripts/test-domain.mjs list-handle-elsewhere` -> "# pass 2 # fail 2" (tests 1 and 3).

**The same tests after the fix:**

- Core: all pass (see the next command).
- Domain: `... test-domain.mjs list-handle-elsewhere rejection-next` -> "# tests 12 # pass 12 # fail 0".

**Core acceptance.** `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql` over `answer-first/completion`, `answer-first/tests/endings`, `runtime/llm/{anthropic,decision-reading,decision-handlers,harness,verification-defects}` and `runtime/result-verification/{asked-words,cited-yes}`:

- parallel: "Test Files 115 passed (115), Tests 794 passed (794)"
- real-sql: "Test Files 18 passed (18), Tests 86 passed (86)"
- Summary line: "all groups passed: parallel, real-sql"

An earlier run of the same command had 1 real-sql failure (`judge-continues-decider`, status `setup_needed`). I had edited `decision-handlers` while that run was in progress. The test passed when rerun alone, and it passed in the clean final run above.

**Other checks:**

- `pnpm --filter fluxiq check` -> exit 0 (tsc).
- Domain: `DOMAIN_TEST_BUILD_LABEL=t1034 node scripts/test-domain.mjs llm-evidence` -> "# tests 1778 # pass 1778 # fail 0". This was the second run. The first had 5 failures, all expected-detail assertions for `handle_not_in_packet`, which I updated.
- Core `node scripts/structure-audit.mjs` -> "structure-audit: passed (574 warning(s), 903 baselined)". It first failed on an import cycle I had introduced (adapter -> decision-handlers barrel), which I fixed with the import-free `withdrawn-actions.ts`. `check.ts` was trimmed to 400 lines.
- Downstream `node scripts/structure-audit.mjs` -> "structure-audit: passed (261 warning(s), 551 baselined)". It first failed `regexp-template-escapes` in my new test, which I fixed.
- `node scripts/check/model-text.mjs` -> "model-text: ok".
- Domain check `pnpm --filter @fluxiq-web-extension/domain check`. It first refused: "FluxIQ Core's build ... is not current with its source". I rebuilt Core's libraries as it instructs (`pnpm --filter @fluxiq/contracts --filter @fluxiq/sdk --filter fluxiq --filter @fluxiq/client-gateway-websocket --filter @fluxiq/ui-components build` -> exit 0). The rerun printed "core-build: ... current with its source", then `domain:check` -> exit 0.

## Not verified

- No live or Lab run. The effect on the model's behaviour (whether it now goes to the cart page and detects the cart's list) is untested until a paid rerun.
- The recorded feedback was rebuilt through the real code for the decision shapes (the adapter, the harness and the real look withdrawal), the completion check and the domain runtime. The whole evidence loop with an Anthropic transport was not run end to end over 0192. The loop's refusal was shown through `looks.refuses` and `refusalCode`, the calls the loop's admission makes.
- Why `t2892` was bound on the search page at 0240 in the recording. In the synthetic case, the same read from another page is refused `page_moved_since_packet`. The page in between was reached by a `run_flow` replay. The resolver lives in `plan-resolution/`, outside this brief's paths.

## Open questions or contradictions found

- **Remaining cause of uninformative unreadable feedback.** An enum miss's rule (`runtime/models/providers/anthropic/schema-misses.ts`, eight node ids) can run past `MISS_RULE`'s 200 characters (`runtime/models/failures/reply-account.ts`). The miss is then dropped, and the model is told only "it did not fit". At 0192 and 0215 the rule was 246 characters. My fix removes those two cases, but a reply naming an unknown node id still gets no "At fault". Both files are outside the owned paths. The fix should be to word an enum miss within the bound, not to raise the bound.
- **The brief's "6 unreadable"** is 3 decisions counted twice: once on the decide row and once on the `answer-unusable` row.
- **The brief's step numbers.** Its "step 230", "241, 243" and "≈263" match the folders 0230, 0241, 0243 and 0263.
