# t738-d1-downstream-hints

## Outcome

Partial. All three changes are made and tested. One gap is outside what I own: fix 3 (naming the scroll's bad keys) takes effect only once the callers pass the command they sent (see Open questions).

## What changed and why

1. `domain/src/runtime/llm-evidence/rejection-next/next-sentence.ts`. The `incomplete_text` sentence is now the constant `INCOMPLETE_TEXT_NEXT`. It drops "Repeat this ordering after each Next page move", which told the model to put a row loop inside a page loop, and Core's grammar refuses that. The new sentence says, in generic words: a repeat cannot hold another repeat; load every row first (a Scroll step with mode untilStable, or Next page in its own repeat-while span); then the row-context read; then, with repeat over that read (For Each), the optional registered row-bound click on each row's disclosure; then the full read.
   I also added a `parameter_not_readable` branch, `scrollKeysNext(instead)`. It reads codes of the form `web.scroll.key.<missing|unknown|invalid>[.<key>]` from `instead` and names the keys under "missing", "not taken" and "not readable". It also states the closed key list (mode, x, y, maxScrolls; the three modes; untilStable requires maxScrolls). When there are no scroll codes it returns undefined, as before. A repeated refusal passes `instead` back, so it says the same thing again.
2. `domain/src/output-nodes/definitions.ts`. The `scroll` parameter of `web.dom.scroll` now has a description, `SCROLL_REQUEST_DESCRIPTION`, and the example `{"mode":"untilStable","maxScrolls":20}`. The description names the keys and the three modes, says untilStable requires maxScrolls, and says to use untilStable to load a list that grows in place.
   I checked how Core shows this. `flow-bootstrap/plan/parameter-text.ts` `structuredText()` sends the description and example of an `object` parameter whole, so the text reaches the model. I put the constant above `webAutomationOutputNodeDefinitions`. That array is built when the module loads, so a constant declared after it reads as undefined in the bundled test build. I found this from a failing test.
3. `domain/src/runtime/llm-evidence/action-failure/refusal.ts`. `webActionFailureRefusal(result, sent?)` takes a new optional `sent: { actionType; parameters }`. When the failure is INVALID_PARAMETER and `sent` is a `web.dom.scroll` with a `scroll` request that `webAutomationScrollRequestIssues()` finds issues in, the refusal is `parameter_not_readable` with:
   - `instead` holding the key codes;
   - `missing` holding the missing key names.
   A key is named only if it is an identifier. Otherwise the code is left bare and the sentence says "a key that is no name". The keys come only from the request the domain sent, never from the client's sentence. `result.ts` is unchanged.
4. Tests:
   - `rejection-next/tests/next-sentence.test.ts`: the incomplete_text test now asserts the load-rows-first order and no "after each Next page".
   - New `output-nodes/tests/scroll-node-text.test.ts`: the scroll description names the modes and keys, and the example has no issues under `webAutomationScrollRequestIssues`. It is a new file because `definitions.test.ts` is at 399 lines.
   - `action-failure/tests/refusal.test.ts`: one new test covers missing and unknown keys, untilStable without maxScrolls, an invalid maxScrolls, a key that is not a name, the repeat giving the same sentence, no page words, and the old answer for no `sent`, another node, a valid request, no scroll key, or another failure code.

## Commands run and observed results

- `cd <domain> && DOMAIN_TEST_BUILD_LABEL=t738-d1 node scripts/test-domain.mjs rejection-next/tests action-failure/tests output-nodes/tests`
  - First run: 2 failures. My new regex had the clauses in the wrong order, and the description was undefined because of where the constant was declared. Fixed both.
  - Second run: 1 failure. A `\b` inside a template literal (also caught by the structure audit). Fixed it.
  - Final run: `# tests 132 # pass 132 # fail 0`.
- `node scripts/structure-audit.mjs` (downstream): `structure-audit: passed (211 warning(s), 618 baselined).`

## Not verified

- I did not run a typecheck, as the brief instructed. The lead typechecks.
- I did not run tests outside these three folders (for example node-run tests or `native-runtime.test.ts`). Their calls to `webActionFailureRefusal` pass no `sent`, so their behaviour should not change.
- Nothing ran live, so I have not seen a model read the new text.

## Open questions or contradictions found

- **Fix 3 is not connected yet.** No caller passes `sent`, so today no live refusal names scroll keys. The callers that need a one-line change are outside what I own:
  - `domain/src/runtime/llm-evidence/capture.ts:698`: pass `{ actionType, parameters }`, which are already local there.
  - `node-run/retries/uncertain-outcome.ts` `webNodeFailureRefusal`, reached from `node-run/run.ts:401` and `node-run/replay.ts:373` (another worker's area): forward the dispatched command.
  - `node-run/verify.ts:194` does not need it.
- The extension's own `actual` string in `apps/extension/src/content/extraction/text-disclosure/text-disclosure.ts:17` still says "repeat this order after each Next page move". The domain reads only its `incomplete_text:` prefix and never passes the sentence on. Still, if anything shows that string to the model, it contradicts the new hint. I did not touch it because it is not mine.
