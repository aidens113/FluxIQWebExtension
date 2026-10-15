# t626 default-select-not-a-filter: worker report

## Outcome

Partial at first; complete after the follow-up below.
- **Part 1 is done.** A select's default choice is no longer counted as an applied filter, so Next is followed again on a search page whose form shows its category select on "All". t623's protection is kept.
- **Part 2 is not done.** I found where the page fault's reason is dropped: `domain/src/runtime/llm-evidence/action-failure/refusal.ts`, `webActionFailureRefusal`, lines 146-153. The fix cannot be made in that one line. It needs a new closed reason word and a count field in `domain/src/runtime/llm-evidence/tool-rejection.ts`, which this brief does not let me edit. I left the domain untouched. The details are under "Open questions" below.

## What changed and why

### The rule I chose: a single select's first option is not applied

In `apps/extension/src/content/extraction/page-advance/applied-controls.ts`, a selected `option` is now skipped when it is the first option of a select that takes one option (no `multiple` attribute). The new helper is `isUnchosenDefault`, and the header explains the rule.

Why this rule, stated generally:
- A single select always has an option selected. If no option is marked, the browser selects the first one. So a selected first option looks exactly like "nobody chose anything".
- Forms follow a convention that the first option is the one that narrows nothing ("All", "Any", "Best match").
- Any later option is a choice someone made, so it still counts.
- A select that takes several options has no such default, because nothing is selected until someone selects it. So every selected option counts, the first one included.

The rule names no site, parameter or scenario. It also fixes a hidden case: in a real DOM, an unmarked single select reports `.selected === true` on its first option, and before this change that alone counted as applied.

### Why I did not also exclude search forms

The brief also suggested excluding any select that is part of a search form. I chose not to:
- **It would lose real narrowing.** A header search with a category chosen (a later option) really does narrow the list, and a Next that drops it really does leave that list. t623 should still catch that.
- **It would break t623's own fixture.** That fixture's filter rail is itself a `<form role="search">`, so excluding search forms would undo t623's protection.
- **It adds nothing.** The first-option rule already covers the observed defect: the department select's first option was "all".

### Fixture and tests

The fixture is a library catalog, which is not one of the ten scenarios.
- `page-advance/tests/catalog-pager.ts`: a new `searchIn` style. It adds a "Search in" select (`in`: everything, titles, authors, subjects) to the search form. The selected option is marked even when it is the first, the way a server-drawn form marks it. The page's address carries `in`, Next never carries it, and the page numbers carry it only with `numbers: "keep"`. New exports: `withSearchIn` and `CATALOG_SEARCH_IN`.
- `page-advance/tests/applied-controls.test.ts`, 2 new tests:
  - The search select on its first option is not applied; on "titles" it is.
  - A multi-select counts its selected first option; a single select on its first option counts nothing.
- `page-advance/tests/next-keeps-scope.test.ts`, 4 new tests:
  - Next drops `in=everything`: the move is `moved by: "next"`. Tested with page numbers that drop the narrowing and with no page numbers.
  - Next drops `in=titles` and the page numbers keep it: the move follows the page number, `by: "following"`, to the page-2 address that carries `in=titles`.
  - Next drops `in=titles` and nothing keeps it: the move fails `page_fault` with the reason "leaves out 1 query parameter", no word of the address, and nothing pressed.

### Documentation

`docs/architecture/web-capabilities.md`, Pagination row: it now says that a single select on its first option is not counted, and that a later option, or any option of a multi-select, still is.

## Commands run and observed results

All commands were run in the t626 worktree.
- `EXTENSION_TEST_BUILD_LABEL=t626 node scripts/test-extension.mjs content/extraction/page-advance/tests` (apps/extension):
  - The first run gave 37 of 38. The failure was my own test: a pager with no numbers marks no page, so the answer has no `page`. I fixed the expectation.
  - After the fix: `# tests 38`, `# pass 38`, `# fail 0`.
- Reversion check: I disabled the new skip line (`if (false && ...)`) and ran the same command. It gave `# pass 34`, `# fail 4`: tests 2, 3, 35 and 36, which are the new default-option tests. I then restored the file from a scratch copy, and `grep -c "false &&"` returned 0.
- `EXTENSION_TEST_BUILD_LABEL=t626 node scripts/test-extension.mjs content/extraction` (apps/extension): `# tests 297`, `# pass 297`, `# fail 0`, `# cancelled 0`.
- `node scripts/check-extension.mjs` (apps/extension): exit 0.
- `pnpm structure:check` (repo root): `structure-audit: passed (195 warning(s), 639 baselined).`

## Not verified

- No live run and no real browser, as the brief says. The fake DOM has only attributes, so the live `.selected` path for an unmarked select, where the first option is selected by default, was not exercised.
- The everything-store page itself was not run against this code. That the fix covers it is inferred from its markup: `pages/header.ts:10`, where the department list starts with `["all", "All"]` and the `name="i"` select is single.
- Part 2: nothing in the domain was changed or tested.

## Open questions or contradictions found

### Part 2: where the reason is dropped, and what the fix needs

**The chain:**
- `apps/extension/src/content/actions/next-page.ts` keeps the reason. It sends failure code `ACTION_FAILED` with `actual: "page_fault: <sentence with the count>"`, and `nextPage: {outcome: "failed", stop}` beside it.
- In the domain, `node-run/run.ts:388` calls `webNodeFailureRefusal` in `node-run/retries/uncertain-outcome.ts`. That calls `webActionFailureRefusal` in `action-failure/refusal.ts:143`.
- `BY_FAILURE_REASON` deliberately has no entry for `ACTION_FAILED`, so `detail` comes back `undefined`. The model then sees only `{ok: false, code: "action_failed", attempts: 4}`.

**Why one line is not enough.** A detail requires a `reason` from the closed list `WEB_LLM_TOOL_REJECTION_REASONS` in `tool-rejection.ts`, and no existing word fits. Using any of them would tell the model something false.

**The smallest truthful fix:**
1. In `tool-rejection.ts`:
   - add a reason, for example `next_leaves_narrowed_list`, with its doc line;
   - add a count field, for example `droppedApplied?: number`, to `WebLlmToolRejectionDetail` and to `rejectionDetail`, passed through `wholeCount`.
   - `repeated-refusal.ts` (line 139) copies detail fields one by one, so it needs the field as well.
2. In `refusal.ts`:
   - for `ACTION_FAILED` whose `actual` starts with the closed word `page_fault:` (the same pattern as `covered:`), give that reason with `paginationStop: "page_fault"`;
   - read the count from the record. Parsing a free sentence goes against the file's own rule, so the extension should write the count in a closed form. Either way is a change outside this brief: make the fault sentence's leading form `page_fault dropped=N: ...` (in `content/actions/next-page.ts`, not owned), or add `dropped` to the `nextPage` failed answer (a protocol change).

### Other points

- **Retries.** A `page_fault` decided before any press is still retried 4 times, about 12 seconds in all (debug item 3). This is unchanged, because retries are a user rule.
- **Radio groups.** A radio group whose first, match-everything radio is checked (for example "Any price") still counts as applied. The brief covered only selects. The same reasoning applies if a site draws its default that way. The follow-up below resolves this.

## Follow-up (coordinator): the fault's reason reaches the model; radio groups

### Outcome

Done. Both follow-up items are in:
- A Next page step that faults because its Next would drop filters the page shows applied now gives the model a reason, `next_leaves_filtered_list`, with `filtersDropped: N` and `paginationStop: "page_fault"`. The detail also carries a fixed `next` sentence that tells the model what to do.
- The extension writes the count as a field of its answer. Nothing reads it from a sentence.
- A named radio group on its first radio now counts as unchosen.

### What changed and why

How the count travels, from the page to the model:

1. **The fault.** `page-advance/pagination-fault.ts` gives `PaginationFault` an optional `filtersDropped`. `follow-next.ts` `keepingFollowing` throws it with the dropped count.
2. **The move's answer.** In `page-advance/move-outcome.ts`, the `failed` outcome gains `filtersDropped?`. `failedMove` and `stoppedMove` keep it, on `page_fault` only. `page-advance/move-page.ts` passes the fault's count through.
3. **The action result.** `content/actions/next-page.ts` puts it on the result's `nextPage` answer: `{outcome: "failed", stop: "page_fault", filtersDropped}`.
4. **The wire.** `domain/src/actions/next-page/answer.ts` declares the field on the `failed` answer. `answer-value.ts`, the field-by-field copy onto the wire, keeps it only beside `page_fault` and only as a positive whole number.
5. **The refusal.** `domain/src/runtime/llm-evidence/action-failure/refusal.ts` adds `droppedFilters(result)`. On `ACTION_FAILED` only, it reads `payload.nextPage` through that closed copy and returns the count. `webActionFailureRefusal` then gives the reason above with the count and the stop word.
   - Every other `ACTION_FAILED` stays bare `action_failed`, as the file's table intends. The existing test that asserts this still passes.
   - It is placed beside the table rather than added to `BY_FAILURE_REASON`, because that table maps a code to a reason. The code `ACTION_FAILED` alone cannot say which reason applies: only the answer's field can.
6. **The reason and the field.** In `domain/src/runtime/llm-evidence/tool-rejection.ts`, the new reason is added to `WEB_LLM_TOOL_REJECTION_REASONS` with its doc line. `filtersDropped?: number` is added to `WebLlmToolRejectionDetail` and to `rejectionDetail`, passed through `wholeCount`.
7. **The repeat.** `domain/src/runtime/llm-evidence/repeated-refusal.ts` copies `filtersDropped` through, so a repeated refusal says it again.

**Model-facing wording.** `domain/src/runtime/llm-evidence/rejection-next/next-sentence.ts` gains `FILTERED_LIST_NEXT`, the refusal's `next`. It is generic and names no site, control or filter:
- nothing was pressed;
- Next leads to the list without filters the page shows applied, and `filtersDropped` says how many;
- the same step is answered the same way here;
- find another control that reaches the next page of the same filtered list, or read this page and end the list.

I edited this file under the follow-up's "model-facing wording" clause. Other wording checks:
- **No pinned digest.** No system-instructions text, tool description or pinned digest lists the reason words. I grepped `domain/src` for an existing reason word: it appears only in `tool-rejection.ts`, `refusal.ts`, `next-sentence.ts` and `refusal.test.ts`.
- **Core's repeat guard.** The new reason word does not match the `RETRY_LATER` pattern in that guard, so the same step on the same page stays refused as a repeat, which is the intent.

**Radio groups.** In `page-advance/applied-controls.ts`, `isUnchosenFirstRadio` treats a checked radio as unchosen when it is the first radio of its name in its own form, or under the root when it has no form.

Why:
- A radio group is a select drawn as buttons, and filter rails follow the same convention: the first radio narrows nothing ("Any price"), and a page drawn from its address checks it when no filter is set.
- Counting it would fault every Next that drops the match-everything value, which is the same defect in another form.

What still counts: a later radio (a choice) and a radio with no name (no group). The price: a group whose first radio really narrows is not seen as applied when checked, so a Next that drops it is followed as it was before t623. The header explains this.

**Docs.** `docs/architecture/web-capabilities.md`, Pagination row: adds the radio rule, `filtersDropped`, and the reason.

**Tests:**
- `content/actions/tests/next-page.test.ts`: the count reaches `result.nextPage` and the wire copy.
- `page-advance/tests/applied-controls.test.ts`: a radio group on its first radio, on a later radio, unnamed radios, and two forms with the same group name.
- `page-advance/tests/next-keeps-scope.test.ts`: the two `page_fault` cases now assert `filtersDropped` 2 and 1.
- `domain/src/actions/next-page/tests/answer-value.test.ts`: the count is kept only on `page_fault` and only as a positive whole number.
- `domain/src/runtime/llm-evidence/action-failure/tests/refusal.test.ts`, 2 tests:
  - With the count present: the reason, the count, the stop word and a `next`, no page words, and the same again on a repeat.
  - Staying bare: no count, a count beside another word, a count of 0, the count only in the sentence, and the count beside another code.

### Commands run and observed results (follow-up)

All commands were run in the t626 worktree.
- `EXTENSION_TEST_BUILD_LABEL=t626 node scripts/test-extension.mjs content/extraction/page-advance/tests content/actions/tests/next-page` (apps/extension): `# tests 46`, `# pass 46`, `# fail 0`.
- `EXTENSION_TEST_BUILD_LABEL=t626 node scripts/test-extension.mjs content/extraction content/actions/tests/next-page` (apps/extension): `# tests 305`, `# pass 305`, `# fail 0`, `# cancelled 0`.
- `node domain/scripts/test-domain.mjs runtime/llm-evidence/action-failure actions/next-page`: `# tests 24`, `# pass 24`, `# fail 0`. This includes the 3 new t626 tests, which were seen as `ok 4`, `ok 23` and `ok 24`.
- `node domain/scripts/test-domain.mjs runtime/llm-evidence/tests/tool-rejection-detail runtime/llm-evidence/tests/repeat-across-explorations runtime/llm-evidence/node-run/tests/replay-read-account`: `# tests 37`, `# pass 37`, `# fail 0`.
- Domain type checks (in domain):
  - `npx tsc -p tsconfig.json --noEmit`: exit 0.
  - `npx tsc -p tsconfig.test.json --noEmit`: exit 0, run again after the last test edit.
- `node scripts/check-extension.mjs` (apps/extension): exit 0.
- `pnpm structure:check`:
  - The first run failed with `[contract-spread]` at `refusal.test.ts:269`, from a conditional spread in my new test. I rewrote that test without the spread.
  - After the rewrite: `structure-audit: passed (195 warning(s), 639 baselined).`
- Line endings: my first scripted edits wrote CRLF. I converted every changed file back to LF and confirmed 0 carriage returns in each.

### Not verified (follow-up)

- The full end-to-end chain, from a live extension result to Core's tool result to the step file the model reads, was not run. Each link was tested: the move answer, the action result, the wire copy, the domain refusal, and the repeat. `toolRejection` carries `detail` whole, which was read but not tested here.
- I did not revert `droppedFilters` to prove the new refusal tests depend on it. Before this change, `ACTION_FAILED` was bare by construction, and the existing test asserts that.
- `list-reader.ts`'s paged loop also catches `PaginationFault`. It ignores the new count, so its behaviour is unchanged.
- No live run.

### Open questions (follow-up)

- The `next` sentence offers "read this page and end the list here". Whether that is the right fallback for a build, rather than some other kind of step, is a product call.
- `tool-rejection.ts` is now 767 lines. It is past the 400-line advisory, with no hard failure.
