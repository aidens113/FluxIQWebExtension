# t743-w-read-mark: worker report

## Outcome

Done. The `readsWords` mark now gets all the way to the page. Once a marked target's selector misses, the page no longer looks it up by its recorded words. Core needed no edit, so Core does not need a rebuild.

I created one directory I was not given: `apps/extension/src/content/action-runtime/read-lookup/`. My additions pushed `resolve-target.ts` to 892 lines, and the structure audit fails anything over 800. Moving the read lookup into that directory brought it back to 798 (see the fourth open question).

## What changed and why

1. **The mark has a type and a normalizer field.**
   - `domain/src/actions/types.ts`: `WebAutomationElementFingerprint` gains an optional `readsWords`, with a doc comment pointing at `plan-resolution/read-identity.ts` and `identity/read-words.ts`.
   - `domain/src/output-nodes/targets/targets.ts`: `elementFingerprint` now copies it as `readsWords: booleanValue(element.readsWords) === true ? true : undefined`. Only `true` counts as a mark.
2. **The mark survives every hop.**
   - `targets.ts`: `withRecordedPlace` now also runs a new internal `withRecordedReadMark`. When the recording (`payload.element`) is marked, the wire target's element carries the mark whichever source won the identity.
   - The reason is Core. `prepareElementTargetAction` is in `programs/automation-studio/runtime/io-policy.ts`, and its normalizer, `normalizeFingerprint` in `model/action-element-target.ts`, has no field for the mark. On a repair, the adapted target supersedes the recording, and the mark was lost there.
   - I chose not to add the field to Core. The mark describes what the step does with the element, not what the element is, so carrying it from the recording is the same rule this file already uses for `record` and `dialog`. It also keeps Core unchanged.
   - `domain/src/client/gateway-mapping.ts`: `commandElementFingerprint` gets the same treatment through a new internal `withReadMark`. This covers a command whose wire target carried no element. I also dropped a no-longer-needed `as unknown as` cast on that return.
3. **The page no longer finds a marked read by its words** (`apps/extension/src/content/action-runtime/resolve-target.ts` and the new `read-lookup/`).
   - `RecordedTarget` gains `readsWords`.
   - **Fingerprint lookup.** `fingerprintMatches` hands a marked target to `readFingerprintMatches`. That function uses only the stable signals (selector, xpath, id, test id, authored name, class set, drawing). It uses a role-less accessible name only when the name is not the words being read, which is the same rule as `read-words.ts`. It never uses the words, and it keeps only matches inside the recorded landmark (role, plus name when one was recorded).
   - **Stable-name rescue.** `stableNameMatch` is skipped for a marked target, so a stable part of the old words cannot rescue a refused match.
   - **Level 2.** `scoreFamily` adds the recorded tag's elements to the family pool, gated by recorded record and landmark, capped at 60 candidates and 2,000 elements scanned, and reports truncation. The family enumeration offers only controls, so before this a paragraph read had no Level 2 at all. d2b's read-aware scorer then ranks the pool by label, kind and classes, and the words only break a tie.
   - **Unmarked targets** go through exactly the code path they did before. The only refactor is that `scanMatches` moved to `read-lookup/scan-tag-matches.ts` as `scanTagMatches(tagName, ...)`, with the same body.
   - **New files** in `read-lookup/`, one export each: `index.ts`, `reads-its-words.ts`, `in-recorded-landmark.ts`, `read-fingerprint-matches.ts`, `read-elements.ts`, `scan-tag-matches.ts` (the last exports the function and `MAX_TEXT_SCAN`).
4. **Tests.**
   - `domain/src/client/tests/gateway-mapping-read-mark.test.ts` (5 rows, invoice fixture). These run through the real Core normalizer, `outputTargetFromPayload` and `webAutomationActionFromGatewayCommand`:
     - The normalizer keeps the mark, and only `true` counts.
     - A saved read stays marked after Core's rewrite, on the wire target and on the declared `command.element`.
     - A bare wire target is still marked.
     - A repair that renamed the element keeps the mark, both as stored and as Core dispatches it.
     - An unmarked target stays unmarked.
   - `apps/extension/src/content/action-runtime/tests/resolve-target-read-words.test.ts` (4 rows, library account page). The current loan line is in `main`; a "previous loans" line in `aside` shows the old words; the selector has drifted.
     - A bare marked read is not resolved to the neighbour. It is reported not found.
     - A marked read whose class every line shares resolves to the summary line in its own landmark.
     - The same target unmarked still resolves to the neighbour, as it does today.
     - An unmarked press is still found by its words.
   - I checked that the tests catch the bug: with HEAD's `resolve-target.ts` put back temporarily, rows 1 and 2 fail and rows 3 and 4 pass. Then I restored my version.

## Commands run and observed results

- `cd domain && DOMAIN_TEST_BUILD_LABEL=t743-rm node scripts/test-domain.mjs client/tests/gateway-mapping-read-mark` -> `# tests 5 # pass 5 # fail 0`.
- `... test-domain.mjs client/tests output-nodes/targets plan-resolution/tests/read-identity element-fingerprint` -> `# tests 116 # pass 116 # fail 0`.
- `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=t743-rm node scripts/test-extension.mjs content/action-runtime/tests/resolve-target-read-words`:
  - First run: 2 of 3 passed. My planned contrast row was wrong: the shared-class unmarked target is reported ambiguous today (0.73 against 0.54), not resolved to the neighbour.
  - I rewrote that contrast on the unclassed page and added the press row. Rerun: `# pass 4 # fail 0`.
- Same command with HEAD's `resolve-target.ts` -> `# pass 2 # fail 2`, rows 1 and 2 failing as expected. File restored afterwards.
- `... test-extension.mjs content/action-runtime/tests content/identity/tests content/tests/element-finder`, run again after the split -> `# tests 354 # pass 354 # fail 0`.
- `node scripts/structure-audit.mjs` (read-only, no `--update`):
  - Before the split: `FAIL [file-lines] resolve-target.ts: 892 lines`.
  - After the split: `resolve-target.ts` is at 798 lines, advisory warning only.
  - The audit still fails on five things that are not mine: `plan-resolution/tests/read-identity.test.ts` contract-spread, `plan-resolution/tests/` with 26 files, `list-reader.ts` 826 lines, `list-reader.test.ts` 834 lines, `resolve-plan-node.ts` 803 lines.

## Not verified

- No typecheck, build or full suite, as the brief bars them. I assume the test runners compile the TypeScript, but I did not confirm that they type-check.
- No Core tests: Core was not edited.
- No live or browser run. The extension tests use the stub DOM.
- The domain test starts from a literal saved identity shaped like the output of `webPlanReadIdentity`, not from a full `resolveWebPlanNodeParameters` run. `read-identity.test.ts` already proves that output, and building one here would have meant importing the plan-resolution internals.
- The cost of `elementContext` per scanned element in the read pool. It runs only for marked reads after the selector missed, and within the caps above.

## Open questions or contradictions found

1. A bare paragraph read whose selector drifted, recorded with only its tag, landmark and words, is now reported **not found** rather than resolved. Nothing other than the words separates it from other paragraphs in its landmark. That is honest, but such a read now fails `web.target.not_found` instead of risking the wrong line. Whether the save-time guard should demand more for a read target is for the lead to decide.
2. Landmark is a gate only for marked reads. Elsewhere it is still neither scored nor gated.
3. With equal non-word scores, the words still break a tie (d2b's `settledByWords`). If a neighbour that shows the old words ties a drifted read on every other signal and sits in the same record and landmark, it can still be chosen. That follows from "words only breaking a tie".
4. `read-lookup/` is a new directory I was not given. The 800-line limit made the split necessary, and no other worker touches it.
