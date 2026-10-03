# t195-w34: a left-out row carries the value its condition tested

Lane D, round 1002-M, run `run-murwcaj0-40e56557`, cause R6.

## Outcome

**Partial.** Both sides are implemented and tested: the domain sender, the Core screen, the playback path, the judge-prompt wording, and the failing-first tests on each side. The domain function needs one argument it cannot get on its own: the `where` the page actually ran, after resolution. Only the call site in `domain/src/runtime/llm-evidence/node-run/replay.ts` has that `where`, and that file is outside my ownership. Until the line below is applied, the build-test replay keeps sending labels only, exactly as before. No column is guessed in the meantime.

The one line needed (`replay.ts`, the last `return` of `replayWebOutputNode`, currently line 360):

```ts
return answer(REPLAY_RESULT_CODES.replayed, said, true, { resultReason: undefined, nodeId: undefined, assumed }, true,
  readRows(payload, where, isJsonRecord(resolvedParameters.extractList) ? resolvedParameters.extractList.where : undefined));
```

`resolvedParameters` is already in scope a few lines above. `resolve-plan-node.ts:419` puts the slot's resolved `request` under the `extractList` key, and in that request `where[i].field` is the kept column key (`mutualFriends`), not the detection key the plan wrote (`div_x0531...`) (`plan-resolution/extraction/conditions.ts`, `keptKeyOf`).

## What changed and why

### The one shape

- **On the wire (domain to Core), and for a playback after `accounts.ts` cuts it:** a left-out row is a record whose first cell is the label and whose optional second cell is the tested column and that row's value. Example: `{ name: "Jonas Weber", mutualFriends: "Aisha Khan and 4 other mutual friends" }`.
  - Older senders and older run records send one cell, so the change is additive. Old Core readers take the first cell as the label, so they keep working with a new domain.
  - The second cell is left out when the tested column is the label's own column, when the condition reads a value of its own (`read`, no matching column), when the column is not kept, or when the column is denied.
  - It is also left out when the key is all digits, because JavaScript orders such a key before the label.
  - An unreadable or empty value is sent as `""`.
- **What the judge is shown (both judges):** `"Jonas Weber — mutualFriends: Aisha Khan and 4 other mutual friends"`.
  - An empty value reads `label — column: (no value)`.
  - A secret-shaped value reads `label — column: (withheld)`.
  - A denied or secret-shaped column name reads `label — (withheld)`.
  - The label keeps its own rule: from a denied column, or secret-shaped, it reads `(withheld)`.
  - `leftOutOnlyByThis` stays `string[]`, so the contract type is unchanged.
- **Bound:** the value is sent whole and screened, with no character cut. See the open questions for why I did not apply the brief's 60-character limit.
- **No caps among rows:** unchanged.

### Domain: `domain/src/runtime/llm-evidence/node-run/replay-answer.ts`

- `webNodeReplayReadRows(payload, where, ranWhere?)` takes a new optional third argument, `ranWhere`, which is the resolved `where`.
- `testedColumns` picks each condition's `field` from `ranWhere` when that field is one of the read's own `fieldNames`, is not denied, and is not all digits. If `ranWhere` is not one entry per condition, no column is picked.
- `labelled(rows, fields, tested?)` adds the second cell, passed through `screenedText` (domain's secret and card screen), or `""` when the row has no value.
- The kept `rows` are unchanged and stay labels only.

### Core

- `result-verification/read-account/alone-rows.ts`
  - `automationStudioResultReadAloneRows` renders the second cell as above, screening the column and the value on their own.
  - It takes an optional `onWithheld` callback, so the build-test path still knows when something was withheld. The old way compared rendered labels with sent labels, and that comparison breaks once a row renders as more than its label.
- `result-verification/build-test/read-rows.ts`: uses `onWithheld` and drops `labelSent`. Header comment updated.
- `result-verification/read-account/condition.ts`: new export `automationStudioResultReadConditionColumn(condition, columns)`. It returns a condition's `field`, or the declared column whose read equals the condition's `read`, using the same `sameRead` comparison the wording already uses.
- `result-verification/read-account/accounts.ts`: `withTestedValue` cuts each stored playback row to its label plus the cell of the column the authored condition tests, which is the same two-cell shape the build-test receives. It then screens the rows through `alone-rows.ts`.
- `service/summaries/extraction-summary.ts`, the playback path. A playback's alone rows come from the same domain record, `extraction.rejectedSamples` with `rejectedSamplesAlone`.
  - This projection does not know which column each condition tested, so it now stores each alone row whole, label first. The other declared columns follow in field order, trimmed, with `""` for `null`. Digit-only keys are skipped so the label stays first.
  - It is screened only where it is said (`accounts.ts` and `alone-rows.ts`).
  - Consequence: the run record's `metadata.extraction.conditions.aloneRows` now persists the whole of each alone row, not just its label. Those rows are few by nature.
- `result-verification/contracts.ts`: doc comments only.
- `llm/diagnosis-instructions.ts`: only the `leftOutOnlyByThis` text changed.
  - The runtime judge is told that each row is written `label — column: value`, with the value its condition tested. It is also told: "Read each row's tested value against the request yourself rather than trusting what the condition was meant to do: a pattern or comparison can leave out a row the request wants, and the value is the only way to see it."
  - The build-test judge's `readRows.leftOutOnlyByThis` sentence now says each row is written `label — column: value` where the test knows the value.
  - There is no scenario-specific example in the prompt.

### What each judge now gets

- **Build-test judge:** the full chain is built (domain to `read-rows.ts` to `alone-rows.ts`), but it only takes effect once the `replay.ts` line above is applied.
- **Playback judge:** takes effect now. Domain dispatch sends `rejectedSamples`, `extraction-summary.ts` stores the whole alone rows, `accounts.ts` cuts each row to label plus the tested value using the stored Flow's `where`, `alone-rows.ts` screens and renders it, and `sentence.ts` quotes the result unchanged. A `field` condition is matched by its key. An older stored Flow's `read` condition is matched by the column with the identical read. Run records written before this change still show labels only.

### Tests

- Domain, `node-run/tests/replay-read-account.test.ts`, 3 new tests:
  - The live shape (detection key in `where`, `mutualFriends` in `ranWhere`, Jonas Weber's value, an empty value).
  - No value when the condition tests the label, uses `read`, gives no `ranWhere`, gives a misaligned `ranWhere`, or names an unkept column.
  - A secret-shaped tested value is withheld.
- Core, `build-test/tests/read-rows.test.ts`, 2 new tests: rendering, including an old one-cell row; and withholding by secret value, denied column and denied label.
- Core, `read-account/tests/alone-rows.test.ts`, 2 new tests: the playback by `read` match (earbuds fixture: price condition, and the name condition as label); and by `field` key, covering empty, a missing column and a withheld value.
- Core, `service/summaries/tests/extraction-summary.test.ts`: expectations updated to whole label-first rows, plus a check that the label is the first key.
- Core, `llm/tests/diagnosis-channel.test.ts`: one new test asserting the new instruction text.

## Commands run and observed results

Domain failing-first. I swapped `replay-answer.ts` back to HEAD temporarily, then restored my version:

```
node ".../scratchpad/run-domain-tests.mjs" t195-w34 src/runtime/llm-evidence/node-run/tests/replay-read-account.test.ts
not ok 11 - a left-out row carries the value its condition tested, from the column the page ran the condition on
not ok 13 - a tested value shaped like a secret is written withheld, as a label is
# tests 13  # pass 11  # fail 2
```

Test 12 passed on HEAD as well, because it asserts the labels-only behaviour.

Domain with the change:

```
node ".../scratchpad/run-domain-tests.mjs" t195-w34 src/runtime/llm-evidence/node-run/tests/replay-read-account.test.ts src/runtime/llm-evidence/node-run/tests/replay.test.ts src/runtime/llm-evidence/node-run/tests/replay-verify.test.ts
# tests 32  # pass 32  # fail 0
```

Core failing-first. I swapped my 7 Core sources back to HEAD temporarily, then restored them. I excluded `.tmp/**`, because other workers' `.tmp/core-web-build/*` copies of these test files otherwise also match the path filter:

```
npx vitest run --exclude ".tmp/**" --exclude "**/node_modules/**" <R>/result-verification <R>/service/summaries/tests/extraction-summary.test.ts <R>/llm/tests/diagnosis-channel.test.ts
Test Files  4 failed | 20 passed (24)
     Tests  6 failed | 259 passed (265)
```

The 6 failures were exactly the new and updated tests.

Core with the change, same command:

```
Test Files  24 passed (24)
     Tests  265 passed (265)
```

The brief's exact Core command, from the Core root:

```
npx vitest run packages/fluxiq/src/programs/automation-studio/runtime/result-verification
Test Files  374 passed (374)
     Tests  3978 passed (3978)
```

These counts include the `.tmp/core-web-build/*` copies that other workers produced.

I also ran a scoped `tsc --noEmit`. Each run used a throwaway tsconfig that includes only my changed files and their tests (it follows their imports), and I deleted the tsconfig afterwards. This is not the whole-package typecheck.

- Domain, extending `tsconfig.test.json`: no output, so no errors.
- Core, extending `packages/fluxiq/tsconfig.json`: no output, so no errors.

## Not verified

- The `replay.ts` wiring is not applied, so no test covers a replay end to end with the tested value. The domain tests call `webNodeReplayReadRows` directly with `ranWhere`.
- No live run.
- No whole-package typecheck, full suites or structure audit, per the brief. `condition.ts` now exports 2 values, under the warn level of 8.
- `sentence.ts` is unchanged and quotes each rendered row with `JSON.stringify`. That is checked by one new assertion, not reviewed in the re-author prompt.

## Open questions or contradictions found

1. **The 60-character bound in the brief conflicts with the code and the user rule.** I found no "F14" bound in read-account. `read-account/condition.ts` (`foundText`) and `domain/src/actions/extraction/seen-values.ts` both say the condition's found value is sent whole, "no character cut, user 2026-09-30". Only a stale comment in `domain/src/actions/extraction/summary.ts:288` still says "cut to 60 characters". So I sent the tested value whole and screened, as the existing rule does. If a 60-character cut is still wanted, it is a one-line change in `alone-rows.ts` (`testedText`), but it would break the 2026-09-30 user rule. Separately, the stale comment in `summary.ts:288` should be corrected by whoever owns that file.
2. **The `replay.ts` line above is needed for the build-test half to take effect.**
3. **The build-test condition is still named by the field the plan wrote**, e.g. `div_x0531l50_x1r2vv8_x4q0id2_div_x1a4yqcp_xa73opb_xtlve1b`, through `conditionNames(where)`. Naming it by the resolved `ranWhere` field (`mutualFriends`) would read better. I left it alone because it is outside the brief, but it is the same one-argument change.
4. **Playback alone rows are now stored whole in the run record**, not as labels only. Say if only the labels should persist. The alternative is to pass the authored `where` into `extractionSummaryFromOutputs` from `service/summaries/conversions.ts`, which I do not own.
