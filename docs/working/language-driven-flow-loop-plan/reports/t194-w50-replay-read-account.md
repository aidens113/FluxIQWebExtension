# t194-w50: a replayed list read says what it read

## Outcome

Done. A replayed list read that passes now answers, in its own `said` line,
the read's account. For run 15's read it says:

`the step ran again: kept 10 rows from 5 pages, stopped on control_disabled; 94 items seen; per condition rejected (removed alone): ad 20 (4), plus 37 (6), rating 34 (12), price 40 (3), name 20 (5)`

Every other replayed step still says `the step ran again`. Core is unchanged.

## What changed and why

- **Where the sentence came from.** `replayStep` in
  `domain/src/runtime/llm-evidence/node-run/replay.ts`, in its last line,
  `answer(REPLAY_RESULT_CODES.replayed, "the step ran again", ...)`. The
  `{ok, code, said}` value it returns is what Core's build test sends the judge
  as the step's `observed`. Run 15's `0033-judge/request.txt` lines 311-315
  show step 8's `observed: {ok: true, code: core.replay.replayed, said: the step ran again}`.
- **Core does not trim or replace it.**
  `AS/runtime/result-verification/build-test/observation.ts` takes out only the
  view keys, `schemaVersion`, UUID ids and epoch `*At` keys, and denied or
  locator-shaped keys. It redacts locator-shaped text, and it replaces only a
  string of 40 or more characters that an earlier step's observation already
  sent, which it writes as `as step N`. I ran the new line through Core's
  `automationStudioLocatorShapedText`, and it returned `false`, so the line goes
  through unchanged. No Core file was touched.
- `node-run/replay-answer.ts`: new export `webNodeReplayReadSaid(payload, where)`
  (and a private `counted` helper). It parses `payload.extraction` with the owner's
  validator `webAutomationExtractionSummaryValue`, so a malformed account gives no
  line, and the caller falls back to "the step ran again". It writes:
  - the rows kept, or "answered with N rows its conditions rejected, as they kept
    none" when `conditions.unfiltered`;
  - the pages read, plus `stopped on <paginationStop>` and `cut short` when
    `truncated`;
  - the items seen;
  - per condition, the `rejected` count, with `(alone)` added when `conditions.alone`
    is present.

  Conditions are named by the request's `where[i].field` when it is a well-formed
  field key and the `where` list has the same length as the report. Otherwise they
  are named by position (`condition N`). The line holds only counts, field keys
  and closed words, never page text.
- `node-run/replay.ts`: `replayStep` computes the payload once. For the
  `replayed` answer it uses `readSaid(payload, parameters.extractList.where) ?? "the step ran again"`.
  The `changed` and `failed` paths and the produced comparison are unchanged.
  I also extended the header comment by one clause.
- `node-run/tests/replay-read-account.test.ts`: two new tests.
  - Run 15's account (10 kept, 5 pages, `control_disabled`, 94 seen, five
    conditions with rejected `[20,37,34,40,20]` and alone `[4,6,12,3,5]`) gives
    the exact line above. The same payload with no `where` names its
    conditions by position.
  - A replayed payload that carries no read account still says "the step ran again".
  - `replay()` now takes optional `parameters`.

## Commands run and observed results

- `heavy.sh "t194-w50 domain tsc" npx tsc -p domain/tsconfig.json --noEmit`: EXIT=0.
- `heavy.sh ... npx tsc -p domain/tsconfig.test.json --noEmit`: EXIT=0.
- `heavy.sh ... node .../t194s5/narrow-tests.mjs <domain> t194-w50 runtime/llm-evidence/node-run`:
  24 test files, `# tests 134`, `# pass 134`, `# fail 0`. The two new tests are
  `ok 74` and `ok 75`.
- Old source: I temporarily restored `replay.ts` and `replay-answer.ts` to `HEAD`
  with `git show HEAD:<path> > <path>` and ran the same narrow command. It printed
  `# pass 133`, `# fail 1`, and the failure was
  `not ok 74 - a replayed list read says what it read...`. I then put my versions
  back from the scratchpad copies. `git diff --stat` shows both files carrying my
  changes again (+46 and +14/-4).
- `node scripts/structure-audit.mjs` (downstream): `structure-audit: passed (155 warning(s), 118 baselined)`.
  `replay.ts` is 370 lines and `replay-answer.ts` is 212, both under the 400-line
  advisory threshold.
- `node --experimental-strip-types` on Core's `harness/locator-text.ts`: the
  run 15 line gives `automationStudioLocatorShapedText` `false`, and
  `automationStudioWithoutLocators(line) === line` is `true`.

## Not verified

- No Lab or live run (out of scope). I did not watch a judge read the new line.
- Core vitest and `pnpm check` were not run, because Core is untouched.
- I did not check what the judge's projection does when two reads have identical
  accounts. Core's repeat rule would write the second as `as step N`, which is
  still accurate.

## Open questions or contradictions found

- Another worker has uncommitted changes in `actions/extraction/summary.ts`
  (comment only) and `rejected-samples.ts`, and a Flow's playback now asks for
  `rejectedSamples`. This line reads counts only, so a replay payload that
  carries those rows adds no page text here. A malformed `rejectedSamples` would
  make the validator drop the whole summary, and the line would fall back to
  "the step ran again".
- `core.replay.changed` answers keep their existing `said` and do not carry the
  account. The brief scoped the change to passing replays. If the judge should
  also see counts on a changed read, that is a one-line follow-up in `replayStep`.
