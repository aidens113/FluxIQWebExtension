# Fix F8: a one-page list read says when its list continues

Worker report, 2026-10-19. Downstream tree `fxwork/t566/!FluxIQWebExtension` (task/t566-a8-lane-4) and its Core pair
`fxwork/t566/!FluxIQ` (same branch). Nothing committed.

## Outcome

Done, with one ownership caveat. A list read that was not asked to page now reports `listContinues: { kind, evidence }`
when its list visibly goes on past what it read: an enabled Next or following page number, an enabled Load more, or a
list the page declares to be a feed or longer than it shows. The fact travels page to wire to run record to read account.
Core says it in plain words that name the read's step, on the trial feedback's read entry under every verdict, and as a
new finding `result.read_list_continues`. That finding replaces `result.counts_look_right` and comes with a fix line.
Reads whose list ended, and reads that page, are unchanged.

**The caveat.** Carrying the fact end to end took four pass-through or type files beyond the named owners. They are
listed under "What changed". Each is a minimal, additive member of the mapping that carries list-read results.

## What changed and why

Downstream (extension and domain):
- `apps/extension/src/content/extraction/read-coverage/list-continues.ts` (new) and `read-coverage/index.ts` (barrel).
  `listContinuesPast(run)` reuses only the existing detection, in this order:
  1. `nextControlOnPage(null, run)` finds the control a Next read would follow: the pager's Next, or the page number
     after the current one. A disabled one means the list ended.
  2. `detectPagination` finds a Load more.
  3. `isDeclaredFeed` covers a feed role, `aria-setsize=-1`, or `aria-rowcount` above the rows shown. As in
     `detect-structure.ts`, this applies only when there is no pager.

  The result is two closed words, never page text. Next is checked first so that a page with a labelled Next never
  reaches `selectorFor`. That keeps the store-pager unit fake, which lacks `getRootNode`, working.
- `apps/extension/src/content/extraction/list-reader.ts`: adds the `listContinues` outcome member. It is computed once
  at the end of any read with no `paginate` (791 lines, under the 800 limit).
- `apps/extension/src/content/actions/extract-list.ts` (**not named in the brief**; it is the extension half of the
  result mapping): `summaryOf` copies the two words onto the summary.
- `domain/src/actions/extraction/list-continues.ts` (new): the wire type `WebAutomationExtractionListContinues` and its
  word-by-word validator, plus a barrel line in `domain/src/actions/extraction/index.ts`. **This is the protocol
  type/mapping file the brief asked me to name.**
- `domain/src/actions/extraction/summary.ts`: declares the optional member and copies it. An unknown word drops the
  summary, the same rule every other member follows. Without this the domain wire copy (`gateway-mapping.ts`) drops the
  field.

Core:
- `runtime/service/summaries/extraction-summary.ts` (**not named in the brief**): admits `listContinues` onto
  `metadata.extraction`. An unknown word becomes `"unknown"`, the same tolerance rule `paginationStop` uses. A fact
  that is not two strings drops the summary. Without this Core discards the field.
- `runtime/result-verification/contracts/read-account.ts` (**not named in the brief**): adds the optional
  `listContinues?: { kind: string; evidence: string }`.
- `runtime/result-verification/read-account/accounts.ts`: carries the fact from the attempt's extraction, held to the
  closed-word regex. Looped accounts do not carry it.
- `runtime/result-verification/read-account/list-continues.ts` (new) and a barrel line in `read-account/index.ts`:
  `automationStudioResultReadListContinues(read)` returns `{ said, fix }`. It is the one sentence both the finding and
  the feedback use. It applies only to a read with the fact, `paginates !== true`, no `keptPerPage`, `pagesRead <= 1`
  and no stop word. All words are generic.
  - Example: "Step X read one part of a list that goes on past it (the page marks it as a list that loads more as it is
    scrolled): it saw 5 items and kept 1, and no item after those was read."
  - The fix line: move the same list on to its next part (its next page, its load-more control, or a scroll down it)
    and repeat the read in a loop until the list ends. It also says to leave the read alone when the request asks only
    for the first part.
- `runtime/result-verification/repair-directive.ts`: new code `readListContinues: "result.read_list_continues"`, one
  finding per continuing read, and its fix line. Because the finding is not `summaryWithheld`, `counts_look_right` is no
  longer emitted in that case.
- `runtime/service/candidate-trial/feedback.ts`:
  - Each read entry gets `listContinues: <sentence>`, under both `executionFailed` and `judged`.
  - On a no, `continuedNo()` puts `result.read_list_continues` in place of `result.counts_look_right`, once.
  - It also appends each continuing read's fix line, which names the step, to `fix`.

Tests (generic made-up recipe lists), written before the code on both sides:
- Downstream:
  - `read-coverage/tests/list-continues.test.ts`: 7 cases covering Next, a disabled Next, numbered first and last page,
    Load more enabled and disabled, feed role, row count, and an ordinary list.
  - `content/extraction/tests/list-reader.test.ts`: one appended case. A real `extractList` on `selector-page`
    continues while Load more is offered and reports nothing once it is spent. I merged it into this file because a new
    file would have taken that directory to 26 files, over the 25 limit.
  - `content/actions/tests/extract-list-list-continues.test.ts`: the verb carries the fact, and it survives
    `webAutomationActionResultPayload`.
  - `domain/src/actions/extraction/tests/summary-list-continues.test.ts`.
- Core:
  - `read-account/tests/list-continues.test.ts` and `service/summaries/tests/extraction-summary-list-continues.test.ts`.
  - Cases appended to `result-verification/tests/repair-directive.test.ts` and
    `service/candidate-trial/tests/paging-feedback.test.ts`. I merged these because separate files took both
    directories to 26 files.

## Commands run and observed results

- Downstream unit tests:
  - `EXTENSION_TEST_BUILD_LABEL=f8-ext node scripts/test-extension.mjs content/extraction/tests/list-reader read-coverage/tests content/actions/tests/extract-list content/extraction/tests/detect-pagination content/extraction/tests/feed-signal`
    (in `apps/extension`): `# tests 106 # pass 106 # fail 0`.
  - `DOMAIN_TEST_BUILD_LABEL=f8-domain node scripts/test-domain.mjs actions/extraction/tests` (in `domain`):
    `# tests 91 # pass 91 # fail 0`.
- Downstream typechecks, each `npx tsc -p <config> --noEmit` exiting 0 with no output:
  - `apps/extension`: `tsconfig.json` and `tsconfig.test.json`.
  - `domain`: `tsconfig.json` and `tsconfig.test.json`.
- Core typecheck: `npx tsc --noEmit` in `packages/fluxiq` exited 0 with no output.
- Core tests:
  - `npx vitest run <runtime>/result-verification/read-account/tests <runtime>/result-verification/tests/repair-directive <runtime>/service/candidate-trial/tests <runtime>/service/summaries/tests/extraction-summary`
    gave `Test Files 46 passed (46)`, `Tests 363 passed (363)`.
  - Before the change, the four new test files gave `4 failed`, `7 failed | 4 passed`: test-first confirmed.
- Core library rebuild: `node scripts/build-cache/cli.mjs fluxiq:build` in the t566 Core pair took 7m55s and exited 0.
  Downstream `node scripts/check/core-build.mjs` then reported "FluxIQ Core's build at ...t566\!FluxIQ is current with
  its source."
- Structure audits:
  - Downstream `node scripts/structure-audit.mjs`: `passed (212 warning(s), 638 baselined)`.
  - Core `node scripts/structure-audit.mjs`: `passed (407 warning(s), 1152 baselined)`.
  - New advisory warnings (over 400 lines, under the 800 limit): `accounts.ts` 407, `feedback.ts` 417,
    `extraction-summary.ts` 428.

## Not verified

- No browser or Lab run, so the result is unproven on the real social feed. That needs a provider-free browser read of
  the realistic feed showing the trial's read carries `listContinues: infinite_scroll/declared_feed`.
- Whether the judges' own read sentence (`read-account/sentence.ts`, `judge-paging.ts`) should also state the fact. Not
  changed and not owned. The judges see the account object, but not a sentence for it.
- The reveal-exhaustion signal the diagnosis suggested is not used. That is `list-wait.ts`'s bounded reveal stopping at
  `LIST_REVEALS` while the list was still growing. `awaitListComplete` returns `"complete"` in both cases, and
  `list-wait.ts` was outside my ownership. So a declared feed that has truly ended still reports `infinite_scroll` from
  the author's declaration; a declared row count does not have this problem.
- Whole suites were not run, per the brief.

## Open questions or contradictions found

- **Ownership.** The brief's owners (`list-reader.ts`, `accounts.ts`, `feedback.ts`, `repair-directive.ts`) cannot carry
  the fact on their own. These four files were also required, because each would otherwise drop or reject the new field:
  - `apps/extension/src/content/actions/extract-list.ts`
  - `domain/src/actions/extraction/summary.ts`
  - Core `service/summaries/extraction-summary.ts`
  - Core `result-verification/contracts/read-account.ts`

  I read them as "the mapping file that carries list-read results" and kept each edit additive. Please confirm.
- The judge path (`build-test/judge.ts`) still sends findings as bare codes. The plain words reach the model through
  the read entry's `listContinues` and the added `fix` line, not through the code.
