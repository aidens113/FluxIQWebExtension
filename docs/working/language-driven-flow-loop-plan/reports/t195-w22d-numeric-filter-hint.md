# t195-w22d: a text filter that drops a numeric row says to use atLeast

## Outcome

Partial. The sentence is implemented and tested, but it **does not reach a live run yet**. `webNodeReadWithRejectedRows` only gets the payload, and the payload does not carry the `where` conditions. So the function now takes an optional second argument, the parameters the node ran with. The only production caller, `domain/src/runtime/llm-evidence/node-run/run.ts:414`, is outside this brief and does not pass them yet. The supervisor needs to make this one-line change:

```ts
const { read: shownRead, recorded } = webNodeReadWithRejectedRows(result.payload as JsonValue | undefined, ran);
```

`ran` is already in scope there (line 301) and has the shape `{ extractList: { ..., where } }`.

## What changed and why

- New `domain/src/runtime/llm-evidence/node-run/numeric-text-filter.ts`, which exports one function, `webNodeNumericTextFilterSentence(where, condition, rows)`. It returns a sentence only when all of these hold:
  - the condition tests a record column (`field`);
  - it has `matches` or `contains`;
  - it has no bound and no `equals`;
  - every non-null shown rejected value in that column reads as a number by `webAutomationExtractConditionNumber`.

  It returns no sentence when any value in the column does not read as a number, or when the value is the withheld marker. The fixed sentence is `where N tests the text of <column>, which reads as numbers (<label>: <n>, ...[, and K more]); for at least or at most use atLeast or atMost.`
  - Bounds: at most 5 rows are named, and each label and the column key are cut to 40 characters.
  - A row's label is its first other non-empty string value.
  - Labels and numbers come from the rows after the screen (`webNodeReadResult`). A label that holds the withheld marker is skipped and only the number is said, so the sentence never quotes a value the rows do not already show.
- `rejected-rows.ts`:
  - `webNodeReadWithRejectedRows(payload, parameters?)` reads `where` with `webAutomationExtractListRequestRead(parameters.extractList)`. If any `where.N` condition was dropped, no sentence is added, because a dropped condition would shift the positions the page reports.
  - `rejectedRowsNote` is now the existing alone sentence (when it applies) followed by the numeric sentences, joined by a space. When nothing applies it is still absent.
- Tests were appended to `node-run/tests/rejected-rows.test.ts`. The rejected rows are computed by the real `webAutomationExtractConditionHolds` over the 4 home cards:
  1. The run-36 regex names `Jonas Weber: 5`, plus Tom Becker: 1 and Priya Nair: 4, and does not name Amara.
  2. A non-numeric column (`name contains "a"`) gets no sentence.
  3. A numeric condition (`atLeast: 5`) gets no sentence, and neither does a read given no parameters.
  4. A label that looks like a card number is never quoted; only `(4)` is said.

## Commands run and observed results

- `node .../scratchpad/run-dir-tests.mjs domain w22d runtime/llm-evidence/node-run/tests` printed `tests 102, pass 102, fail 0`.
- Revert check: I temporarily set `numeric: []` in `rejected-rows.ts`, and the same command printed `pass 100, fail 2`. The two failures were the run-36 test and the withheld test. The two negative tests pass either way, as they should. I then restored the file from a copy.
- `bash .../heavy.sh "t195-w22d check" pnpm --filter @fluxiq-web-extension/domain check` printed exactly one error, `src/runtime/llm-evidence/node-run/tests/covered-press.test.ts(51,9): error TS2322` (`overlays` ... not assignable to `JsonObject`). That file is not mine and is unmodified in git status, so the error comes from another worker's change. My files report no errors.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (154 warning(s), 118 baselined)`, with no lines for my files.

## Not verified

- The live path, because `run.ts` does not pass `ran` yet.
- The `domain check` pass as a whole, which is blocked by the error in the other worker's `covered-press.test.ts`.
- No Lab, browser or model run, as the brief requires.

## Open questions or contradictions found

- The brief assumed the conditions could be reached from `rejected-rows.ts`, but they can only be reached from `run.ts`.
- The `covered-press.test.ts` type error belongs to another worker.
