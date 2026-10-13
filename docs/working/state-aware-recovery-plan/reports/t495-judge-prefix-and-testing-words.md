# t495 judge-prefix-and-testing-words: worker report

## Outcome

Done. Both Core fixes are made in `C:/Users/osrs_/FluxStuff/fxwork/t495/!FluxIQ` on the branch
`task/t495-judge-prefix-and-testing-words`. Nothing was committed.

## What changed and why

1. **Judge cache (B3 of `run-mv6eq215-a986f1f3`, W3 of `run-mv6eq0m8-3fe9dc47`).**
   - File: `packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/context-packet.ts`.
   - The `resultSummary` spread now comes right after `policyGates`, before `runId`, `subflowId`, `nodeId`,
     `stateDiffs`, `routeHistory`, `recentActions`, `failureEvidence` and the rest.
   - `resultSummary` opens with `schemaVersion` and then `startView` (t493). So a judge's request now matches the
     previous trial's request through the end of `startView`. Everything that varies per trial comes after it: the
     run id, the part and node ids, the actions, and the summary's own counts.
   - This is placement only. No wording changed, and the same task-kind gate applies
     (`AUTOMATION_STUDIO_FINISHED_RUN_TASK_KINDS`).
   - A comment there explains the order.
   - Side effect: for `runtime_diagnosis` and `runtime_patch` packets that carry a `resultSummary`, the summary now
     comes before `stateDiffs`, `recentActions` and `failureEvidence`. Ids are read by key, so the meaning is the same.
   - Test: `llm/harness/tests/judge-request-prefix.test.ts`.
     - The judge fixture now has a shared `startView`.
     - Trial judges also vary `subflowId` and `nodeId`.
     - `expectStableHead` checks that two requests share their bytes through the end of `startView`.
     - It also checks that `runId`, `subflowId`, `nodeId`, `recentActions` and `totalRecordCount` all come after
       `startView`.
     - The key-order test checks that the ids and `recentActions` come after `resultSummary`.
   - Fail-first: all 3 tests fail against the original `context-packet.ts`. For example, `"resultSummary": expected
     2366 to be less than 1854` (where the two requests parted), and `runId: expected 7 to be greater than 11`.
     All 3 pass with the fix.
2. **Chat wording (C1 and C2 of `run-mv6eq0m8-3fe9dc47`).**
   - File: `runtime/activity/wording/person-words.ts`.
   - **C1.** A numbered revision is now dropped only right after the noun it numbers. The new `REVISION_NOUN`
     covers flow, plan, script, draft, candidate and version, and handles "candidate (revision 3)".
     - At the start of a sentence it is still "This version".
     - After a word that already says which one, it is "version": "the latest revision 4" becomes "the latest
       version".
     - Anywhere else, such as a verb's object or after a preposition, it is "this version".
     - So "Testing revision 3, which keeps …" now reads "Testing this version, which keeps …".
     - The separate preposition branch is now covered by the "this version" default.
   - **C2.** An unnumbered "revision(s)" now reads "version(s)", so "test the new revision" becomes "test the new
     version".
   - Tests: a new describe block in `activity/wording/tests/person-words.test.ts` with 5 tests. 4 of them fail against
     the original `person-words.ts` (for example, `Received: "Testing, which keeps earbuds …"`), and all pass with the
     fix. The existing `candidate-words.test.ts` expectations still pass unchanged.
3. **C3 and C4 are not fixed, because their code is outside the files I own.**
   - C3 is the trial-no card ("Didn't pass: 15 rows came back …" without the judge's reason). It is built in
     `runtime/result-verification/check-words.ts` and `check-activity.ts`, and the UI's
     `ui/activity-action/check-why.ts`. It is not in the wording directory.
   - C4 has two parts.
     - The refused-repeat sentence "This is exactly the step it had already tried…" is in
       `runtime/activity/decision-answer/narration.ts:40`, outside `wording/`.
     - The header "Looking for the repeating list around '<first item>'" comes from `wording/action.ts:80`. It names
       the element the model asked to detect around, which is true. Making it name the list instead (the sponsored
       first item) needs a decision about what to name, so I left it alone.

## Commands run and observed results

All commands ran in `C:/Users/osrs_/FluxStuff/fxwork/t495/!FluxIQ`.

- `npx vitest run <judge-request-prefix.test.ts>` with the original `context-packet.ts` checked out: 3 failed (3).
  With the fix: 3 passed (3).
- `npx vitest run <person-words.test.ts>` with the original `person-words.ts` checked out: 4 failed | 5 passed (9).
  With the fix: 9 passed (9).
- `npx vitest run runtime/llm/harness runtime/llm/tests runtime/llm/deepseek runtime/activity` (from
  `packages/fluxiq`): Test Files 118 passed (118), Tests 1254 passed (1254).
- `npx tsc --noEmit -p .` in `packages/fluxiq`: no output, exit 0.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (338 warning(s), 1159 baselined)`, exit 0.
  - The only touched file it names is `context-packet.ts`, with an advisory "751 lines is past the 400-line advisory
    threshold" warning. The file was already 743 lines.
  - It also reports "2 baseline entries can be lowered". These are not from this change, and I did not run
    `structure:baseline`.
- `system-prompt-pins.json` is unchanged, and the deepseek tests pass with it.

## Not verified

- No live, Lab or provider run. I did not measure the cache gain on a real DeepSeek request; it is inferred from the
  byte-prefix test and from W3's character counts.
- No full suites, by brief.
- I did not check for other callers or tests outside the four directories that might assert where `resultSummary`
  sits relative to `recentActions` or `failureEvidence`.

## Open questions or contradictions found

- The brief says "C1 in the C note above" without a path. I took the note to be the lane C note,
  `fxwork/t451/!FluxIQWebExtension/docs/working/language-driven-flow-loop-plan/debugs/run-mv6eq0m8-3fe9dc47.md`
  (rows C1-C4 at lines 110-113).
- C3 and C4 need files outside this brief: `result-verification/check-words.ts`, `check-activity.ts`, the UI's
  `check-why.ts`, and `activity/decision-answer/narration.ts`.
