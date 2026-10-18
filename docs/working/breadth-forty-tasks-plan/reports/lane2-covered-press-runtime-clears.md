# Report: lane2-covered-press-runtime-clears

Lane tree `fxwork/t565` (branch `task/t565-a8-lane-2`). Fix 4 of `run-mvcxf4uz-64cd322c`. Nothing committed.

## Outcome

Done, with one finding outside my file set (the model sees part of each cleared layer's `wayOut`; see Open questions 1).

- In exploration, a press on a control covered by a layer is now sent when the extension's own defence would clear every layer over it. That means a close glyph, a dismissal word, a consent layer's least-consent answer, or a rate-limit notice's OK.
- The press is still refused (C4) in these cases:
  - the cover has no such closer (confirm-only words such as Apply/Done, or none);
  - the layer is person-only (robot check, sign-in, one-time code, payment);
  - a press of this build opened the layer;
  - more than 3 layers cover the control.
- The cleared layers reach the model on the press's `read.clearedLayers`.
- An extension test proves the run's exact shape.
- The "Popups" instruction is rewritten (`web-10`).

## What changed and why

- `domain/src/runtime/llm-evidence/node-run/layer/runtime-clears.ts` (new). It exports `webRuntimeClearsLayers(page, covers, own)`.
  - It copies the extension's `interference/vocabulary.ts` lists: dismissal allow-list, close glyph, 48-character bound, consent decline only on a consent layer, rate-limit OK only on a rate-limit notice. It also copies the deny-list in `consequential-word.ts` and the person words in `challenge-evidence.ts`, plus the `MAX_DISMISSALS_PER_ATTEMPT` bound of 3. The header says it is a copy and must change together with the extension.
  - Sign-in is recognised by its words ("sign in", "log in", "password"), not by its field. The packet never describes a secret field (`elements.ts`), so a password field is invisible to the domain; I found this when my first version, which looked for the field, failed its test. This is stricter than the extension, which would clear a sign-in offer that has no password field. Refusing is the safe direction.
  - It lives in `node-run/layer/` because `node-run/` and `node-run/tests/` were each at the 25-file limit (the structure audit failed at 26). It is exported from `layer/index.ts`, which I edited (one barrel line plus the barrel comment) although that file was not in my list.
- `node-run/run.ts`, covered pre-check only. The refusal now runs only when `!webRuntimeClearsLayers(current.evidence, covered.covers, (layer) => run.layers.owns(buildOf(run), layer))`. The comment cites the run.
- `node-run/covered-target.ts`: one header paragraph, so the header stays true. The predicate is unchanged.
- `node-run/tests/covered-press.test.ts` builds on lane 2's uncommitted fix 1-2 edits that were already in the tree.
  - The fixture's layer control is now per test (`open(layer, closer)`). The fake click acts like the extension: a press under a "No thanks" popup closes it and returns `clearedLayers` shaped as `client/gateway-mapping.ts` produces it, `wayOut` included.
  - The C4 refusal test, the `blocked_by_dialog` test and the repeat test now use confirm-only closers ("Apply", "Done"). They still assert the fix-2 next sentence and that closers are kept on a repeat.
  - New tests: a sent press whose `read.clearedLayers` names the kind, word, layer name and control name, with a page that has no COVERING line left; a robot check carrying "×" is refused; a sign-in dialog carrying "Not now" is refused (`blocked_by_dialog`).
- `node-run/layer/tests/runtime-clears.test.ts` (new, 7 tests) covers the predicate on the run's shape, the C4 cases, person-only layers, consent and rate-limit layers, the build's own layer, and the 3-layer bound.
- `system-instructions/instructions.ts`: the "Popups" sentence is rewritten, version `web-9` becomes `web-10`, and a web-10 note goes in the header. New wording: "Press the control you want even when it is covered-by: a layer that can be dismissed is closed by the runtime first, and the press's read names it. Only a refusal with closeWith needs a closer from you: press one, then make the same press again." Its test is updated: version, the new patterns, and the old refusal wording asserted absent. A first draft was 3,642 characters against the test's 3,600 limit, so I shortened it.
- `apps/extension/src/content/actions/tests/covered-press-clears.test.ts` (new, test only). It drives the real `executeContentAction`, the click verb, recovery, `overlaysOverPage` and `pressWaysOut` on the fake DOM.
  - The page: the target "Reject non-essential" sits in a non-modal consent bar. A separate full-viewport promo modal with "x", "Collect all" and "No thanks" covers it.
  - Only the gate and the rejection builder are faked, as in `execute.test.ts`. The gate hit-tests through the same fake view the probes read.

## Step 2 trace (cleared layers to the model)

1. Exploration sends the press through Core's `automationStudioClientGateway.executeAction` (`tools.ts:708`).
2. Its payload is the client mapping `webAutomationActionResultPayload`, which includes `clearedLayers` (`client/gateway-mapping.ts:342`).
3. In `run.ts` a press has `node.proposes === true`, so `read = webNodeReadWithRejectedRows(result.payload).read`.
4. `page-record.ts` does not strip `clearedLayers`, and `read-result.ts` only screens denied keys.
5. So `clearedLayers` reaches the tool answer as `read.clearedLayers`, next to the page after the press. Test 8 of covered-press proves this.
6. It is not on the outcome's own fields (`WebNodeRanOutcome` has no member for it), and not on a failed press.

## Commands run and observed results

- `cd domain && DOMAIN_TEST_BUILD_LABEL=lane2-crc node scripts/test-domain.mjs runtime/llm-evidence/node-run/tests runtime/llm-evidence/node-run/layer/tests system-instructions/tests` -> `# tests 269 # pass 269 # fail 0 # cancelled 0`.
- `cd domain && npx tsc -p tsconfig.test.json --noEmit` -> no output, `tsc exit: 0`.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (204 warning(s), 638 baselined).`, exit 0. Before the move it failed: 3 violations (two directory-files 26/25, one statement-packing line in my test). All three are fixed.
- `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=lane2-crc node scripts/test-extension.mjs actions/tests/covered-press-clears` -> `ok 1 - a press under a separate promotion modal clears the modal by its way out, never its offer, spares the consent bar holding the target, and presses once (run-mvcxf4uz-64cd322c)`, `# tests 1 # pass 1 # fail 0`.
- `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=lane2-crc node scripts/test-extension.mjs src/content/actions/tests src/content/action-runtime/interference/tests` -> `# tests 245 # pass 245 # fail 0`.
- Mutation check: a throwaway copy of the extension test with "x" and "No thanks" renamed "Join" and "Sign up" -> `not ok 1`, `# fail 1`. The copy and its build directory were deleted.

## Not verified

- No live browser and no Lab run, as the brief said. The real `checkActionability` and `actionRejected` are not exercised; they are faked as in `execute.test.ts`.
- Whether the extension's viewport probes find the covering modal on the real page. If they don't, the press comes back failed as covered (`webNodeFailureRefusal`). That refusal goes through `action-failure/refusal.ts`, which I did not check for `closeWith`. If it carries none, the model gets a covered refusal without closers, and the new instruction only asks for a closer when `closeWith` is present.
- Which way out the extension picks in the test. It is asserted to be "x" or "No thanks"; document order makes it the glyph, recorded as "Close".

## Open questions or contradictions found

1. **The model sees part of the way out.** Seen in the probe: `read.clearedLayers[0].wayOut = {"url":"https://shop.example/store","element":{"tagName":"button","xpath":"/html/body/div[1]/button","visibleText":"No thanks"}}`. Only `selector` is screened out; `xpath` is not a denied key.
   - This contradicts `domain/src/actions/cleared-layers.ts`, which says `wayOut` "travels ... to this domain's server half and stops there".
   - It drops through `node-run/page-record.ts` (`PAGE_RECORD_KEYS` does not cover `clearedLayers[].wayOut`) and `read-result.ts` / `denied-keys.ts` (no `xpath`).
   - It is not in my file set, so I did not fix it. My test asserts only the four named fields, so it does not lock the leak in.
   - Fix 4 makes this path common in exploration. It could already happen before, when the extension cleared a layer during a press the domain sent.
2. `layer/index.ts` was edited (one barrel line) although it was not in my owned list. The 25-file limit forced the move into `layer/`, and the brief asked for a barrel.
3. The sign-in-by-words rule refuses sign-in offers that the extension would have cleared, which keeps the old two-step for them. If live runs show sign-in promos blocking builds, that line is the one to relax.
