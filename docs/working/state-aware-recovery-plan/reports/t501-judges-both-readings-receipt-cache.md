# t501 judges-both-readings-receipt-cache: worker report

Tree: Core `C:/Users/osrs_/FluxStuff/fxwork/t501/!FluxIQ`, branch `task/t501-judges-both-readings-receipt-cache`. Nothing committed.
All paths below are under `packages/fluxiq/src/programs/automation-studio/runtime/`.

## Outcome

Done, after the continuation. The first pass was Partial: the verify.ts wiring line and two non-owned test files were outstanding. The coordinator then granted ownership of them and of `flow-bootstrap/candidate/authoring-loop.ts` (comments only).

The typecheck, every named test directory (1568 of 1568) and the structure audit now pass.

## Continuation changes

- **`result-verification/verify.ts:182`** now passes `reads: request.summary.reads` into `automationStudioResultVerificationAgreement`. A reading that contradicts Core's paging record is therefore marked in real runs.
- **`result-verification/build-test/tests/judge.test.ts`:**
  - **The murwcmx2 test** now asserts both readings:
    - `expected` is said once, because both calls worded it alike;
    - `observed` is `Judge call 1: ...`;
    - `advice` starts with `Judge call 1: <first advice> Judge call 2: ` and carries the second call's clipped advice;
    - neither reading is marked contradicted.
  - **A new end-to-end test** runs through the real verify path, with a read that followed 5 pages and stopped on `control_disabled`. The first call claims more pages, and the second names the rows. The forwarded `observed` starts with `Judge call 2: <rows reading> Judge call 1 (contradicted by Core's record...`.
  - **Mutation check:** with the verify.ts change reverted, this test failed ("1 failed | 11 passed"). With the change restored, it passed.
- **`flow-bootstrap/candidate/tests/accepted-script-context.test.ts`** now asserts append-only supersession:
  - Earlier submissions stay whole and carry no `supersededBy`.
  - Revision 2 carries `supersedes.calls ["submit.1"]` as its last key, and its note.
  - Exactly one accepted call is left that no later accepted submission names: the current one.
  - Revision 4 carries `supersedes.calls ["submit.1","submit.2","submit.3"]`. The earlier submissions are equal to what the decision before it was shown.
  - A refused script sent before any accepted revision stays as sent, with its `previous` intact.
  - A new test checks that each decision's evidence is a byte prefix (`JSON.stringify`) of the next across the whole run, including the newly accepted revision 4.
- **`flow-bootstrap/candidate/authoring-loop.ts`:** the JSDoc of `acceptedScript` and `refusedLabel` no longer says older entries are replaced by `supersededBy`. It now says a newer accepted revision names them under `supersedes`, and they stay as sent. Comments only.

Continuation commands, run in `packages/fluxiq`:
- `npx tsc --noEmit -p .` gave `TSC_EXIT=0`.
- `npx vitest run $P/result-verification $P/llm/tests $P/llm/candidate-receipt $P/flow-bootstrap/candidate $P/llm/evidence-loop/tests $P/service/candidate-trial` gave "Test Files 140 passed (140)" and "Tests 1568 passed (1568)".
- `node scripts/structure-audit.mjs` (Core root) gave "structure-audit: passed (340 warning(s), 1159 baselined)", with exit 0.

Open questions 1 to 4 below are resolved by the continuation. Question 5 (the "its trial answered no" wording) remains out of scope.

## First-pass outcome (superseded)

Partial. The three fixes were made in the owned files, but the verify.ts wiring and two non-owned test files were outstanding (see below).

## What changed and why

### D1: `result-verification/agreement.ts`

- On a double no, `bothReadings` now carries both calls' readings in `repair.judgement`. Before, only the first call's `repair` stood.
  - Each field (`expected`, `observed`, `advice`) is made of parts labelled `Judge call N: ...`, each one call's own words, so nothing is spliced.
  - A field both calls worded alike is said once, without a label.
  - The reading the record does not contradict comes first.
  - A contradicted reading is labelled `Judge call N (contradicted by Core's record: every read's own account says its list ended with no further page, so what this reading says about more pages is mistaken): ...`.
- `build-test/judge.ts` and `service/candidate-trial/feedback.ts` already forward `repair.judgement` field by field, so the model receives both readings with no change to those files.
- **When a reading counts as contradicted.** The record must contradict it, and the reading must claim unread pages:
  - At least one read follows pages.
  - Every paging read has a stop word, is not truncated, and `automationStudioResultReadStop` gives `list_ended`.
  - The reading's text matches `MORE_PAGES`. These are generic paging words: "more / further / remaining / additional / unread / later / subsequent page(s)" (never after "no"), "not every / all page(s)", "stopped early", "did not read / follow / reach all", "raise the page limit".
  - The round-16 second reading ("stopped when no further page was found, which is correct") does not match.
- **When nothing changes.** If only one reading exists, or both readings are identical, and neither is contradicted, the first call's directive is returned unchanged. That is the old behaviour, and the tests cover it.
- **The other parts of the merged result:**
  - `stillAchievable`: the readings that are not contradicted give it where they agree; otherwise the first value that is not `no`. "Not doable" therefore needs every reading weighed to say no.
  - `checked`: Core's lines from both calls, deduplicated.
  - `withheld`: true if either call's was.
  - The failure record is the leading call's.
- New optional input: `reads?: readonly AutomationStudioResultReadAccount[]`.
- Test: `result-verification/tests/agreement-both-readings.test.ts` (new, 6 tests). The round-16 shape is a first reading blaming paging under `control_disabled`, and a second naming 2 stored rows and calling the paging correct. The tests check:
  - the lead reading is the second, and the first is marked contradicted;
  - with a page-bound read, neither reading is marked and they keep call order;
  - a lone contradicted reading is marked;
  - the first call's directive is unchanged where the second call said nothing or the same;
  - an identical field is said once;
  - the `stillAchievable` rule.

### D2: `llm/candidate-receipt/receipt.ts`

`automationStudioLlmEvidenceLatestCandidateReceipt` now skips any `core.submit_candidate` entry that is not `ok: true`, and returns the newest accepted receipt. A newer accepted entry with a malformed revision or digest still returns `undefined`: an older receipt is never walked back to past it.

The old test "does not reuse an older accepted receipt after a refused submission" asserted the bug. It is replaced by:
- accepted, then one or two refused, gives the accepted receipt;
- all refused gives none;
- a malformed newer accepted entry is not walked past.

### W5: `llm/context-window.ts`

- `candidateScripts` no longer rewrites any earlier entry.
- Each accepted submission that has earlier script-bearing submissions gets a `supersedes` key, last in its key order: `{ calls: [earlier callIds in order], note }`.
  - A submission counts as script-bearing when it has any of `script`, `plan`, `scriptIs` or `current`, or a `diagnostics.previous`.
  - The note says those results' scripts and plans are not the current Flow, whatever their own `scriptIs` or `current` says, must not be edited or sent again, and that this result's script is current until a newer accepted submission names it.
- The mark depends only on entries before it, and the request that first shows an accepted entry is also the first to show its mark. Every request is therefore a byte prefix of the next.
- `withoutScript` is removed. The header comment is rewritten (t498 to t501), with the live-run references.
- The note explains itself, so the system prompt is unchanged and `system-prompt-pins.json` is not touched.
- **Trade-off:** older scripts now stay in context whole, marked superseded by the newer entry, where before they were removed. This is the trade the brief chose.
- Tests in `llm/tests/context-window.test.ts`, replacing t498's three in-place tests:
  - the window before a new accepted entry is byte-identical (`JSON.stringify`) after it is appended, checked over two successive accepted revisions;
  - the newest accepted submission lists every earlier script-bearing call and leaves those entries whole;
  - each accepted submission names only earlier ones, with no `supersededBy` on submissions;
  - nothing changes when nothing was accepted.

## Commands run and observed results

Run from `C:/Users/osrs_/FluxStuff/fxwork/t501/!FluxIQ/packages/fluxiq`.

**Fail-first runs, before each fix:**
- D2: `npx vitest run src/.../llm/candidate-receipt` gave "1 failed | 9 passed", with `Received: undefined`.
- W5: `npx vitest run src/.../llm/tests/context-window.test.ts` gave "3 failed | 20 passed". All three were the new append-only tests.
- D1: `npx vitest run src/.../result-verification/tests/agreement-both-readings.test.ts` gave "4 failed | 1 passed". The test that passed asserts the unchanged-directive case.

**After the fixes:**
- `npx tsc --noEmit -p .` gave `TSC_EXIT=0`.
- `npx vitest run $P/result-verification $P/llm/tests $P/llm/candidate-receipt $P/flow-bootstrap/candidate $P/llm/evidence-loop/tests $P/service/candidate-trial` gave "Test Files 2 failed | 138 passed (140)" and "Tests 4 failed | 1562 passed (1566)". The 4 failures:
  - `result-verification/build-test/tests/judge.test.ts`: "run murwcmx2 ... two noes refute although the second's advice ran past its bound: a no, with the first call's reading". The test expects `advice` equal to the first call's alone. It now receives `Judge call 1: ... Judge call 2: <clipped second advice>`. `expected` now equals the first call's (said once), and `observed` is `Judge call 1: ...`.
  - `flow-bootstrap/candidate/tests/accepted-script-context.test.ts`, 3 tests. They assert t498's in-place stripping: `rev1` has no `script`, `supersededBy: "submit.2"`, "the refused script's text is nowhere in the decision", and "only one script labelled current".
- `node scripts/structure-audit.mjs` (Core root) gave "structure-audit: passed (340 warning(s), 1159 baselined)" and "2 baseline entries can be lowered". The only warning on a touched file is the advisory line count of `llm/tests/context-window.test.ts`: 441 lines, already 421 at HEAD.

## Not verified

- Live or provider behaviour: no Lab run and no provider calls, per the brief.
- Whether the model reads `supersedes` as intended, and whether the labelled two-reading judgement improves repairs. Neither was exercised live.
- The D1 contradiction marking end to end through `verify.ts`, because the wiring line was not made.
- Full suites were not run, per the brief.

## Open questions or contradictions found

1. **`result-verification/verify.ts` (not owned).** At line 182, change `automationStudioResultVerificationAgreement({ first, second, confirmAnswer })` to `({ first, second, confirmAnswer, reads: request.summary.reads })`. A test through `verifyAutomationStudioRunResult` would then cover it end to end.
2. **`result-verification/build-test/tests/judge.test.ts:272-277` (not owned).** The test should expect both readings. For example: `expected: FIRST.expected`, `observed: "Judge call 1: " + FIRST.observed`, and `advice` starting with `"Judge call 1: " + FIRST.changed` and containing `"Judge call 2: "`. Its name should change from "with the first call's reading" to "with both calls' readings".
3. **`flow-bootstrap/candidate/tests/accepted-script-context.test.ts` (not owned).** The 3 failing tests should assert the append-only form instead:
   - rev1 and refused rev3 stay whole;
   - the newest accepted entry carries `supersedes.calls` naming them (for example `["submit.1"]`, then `["submit.1", "submit.2", "submit.3"]` for rev 4);
   - the earlier submissions are equal between consecutive decisions, including across a newly accepted revision.
   Its "refused script's text is nowhere in the decision" and "only one script labelled current" assertions no longer hold by design.
4. **Stale comment (not owned).** The JSDoc of `acceptedScript` and `refusedLabel` in `flow-bootstrap/candidate/authoring-loop.ts` still says a newer revision "replaces it with `supersededBy`".
5. **D2 wording follow-up (not in scope).** The debug's second D2 point is not done. When the current revision's trial answered no, the notes should say to change what the judge found instead of "test it" or "a route not yet tried". That needs `evidence-loop/answered-request.ts` and `evidence-progress/stall-redirect.ts`. With the receipt fix, `answered-request.ts` now says "The latest accepted candidate has receipt {...}. Use core.test_candidate ... if its trial has not answered yes". That is correct, but it says nothing about a trial that already answered no.
