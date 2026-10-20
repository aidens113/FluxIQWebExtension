# t743-d2b-read-value: worker report

## Outcome

Partial. Both ends are done and tested inside my Owns list:

- The domain marks a read target's words.
- The extension stops vetoing a marked target on its words.

One link between them is outside my Owns, and I stopped there, as the brief says to. The type of the saved identity is not Core's and not in `element-fingerprint/`. It is the domain's `WebAutomationElementFingerprint` in `domain/src/actions/types.ts`. Its one producer, `elementFingerprint` in `domain/src/output-nodes/targets/targets.ts`, copies an explicit list of keys. The gateway sends what that function returns to the extension as `action.element`, so the mark is dropped on the wire until those two files carry it. See "Edit needed outside my Owns" below.

## What changed and why

1. **Domain: the words stay, marked.** `domain/src/runtime/llm-evidence/plan-resolution/read-identity.ts`:
   - `webPlanReadIdentity` no longer strips words. For a node that reads text it returns `{ ...identity, readsWords: true }`.
   - It recognises the same nodes as d2: `web.dom.extract` in text, value or html mode (structured or legacy), and `web.dom.assert` with `kind: "text"`. An attribute read, an `exists` assertion and a press are not marked.
   - The header is rewritten to the new rule. The aria-label rule now lives on the page side (point 2).
   - The save-time guard sees the words and counts them as before. `elementFingerprint` ignores the unknown key, so `signals.ts` and `shortfall.ts` are unchanged.
   - `resolve-plan-node.ts`: only the comment at the call site changed; the call sites are d2's. `element-identity.ts`: its header bullet was reworded.
   - Tests: `plan-resolution/tests/read-identity.test.ts` was rewritten. The bare `<span>` read target with only tag, selector and words now **resolves** with its words and `readsWords: true`. d2's version refused it.
2. **Extension: words are not a veto for a marked target.** New file `apps/extension/src/content/identity/read-words.ts`, with one export, `readWordsOf(target)`. For a target marked `readsWords` it returns three things:
   - `unworded`: the identity without the visible text, and without an accessible name that is only the words again or that arrives with no text beside it. This is d2's aria-label rule, moved here. A name beside different words stays and still has to agree.
   - `words`: the words the step reads.
   - `agrees(candidate)`: an exact comparison that ignores case and spacing.
   - For an unmarked target it returns `undefined`, so every press keeps today's code path exactly.
   - `RecordedIdentity` in `score.ts` gains `readsWords?: boolean | undefined`.
3. **Veto (`veto.ts`).** `vetoCandidate` and `vetoExactMatch` judge `judgedIdentity(recorded)`, which is `unworded` for a marked target.
   - The record and dialog gates, label, ids, a distinct name, kind and selector still decide.
   - A bare paragraph read (tag, selector, words) asks no distinguishing question, so the selector's lone match is acted on.
4. **Scorer (`score.ts`).** A marked target goes through `scoreReadTarget`:
   - It is ranked on `unworded` first.
   - If that does not resolve, the words settle it only when exactly one of the candidates level at the top agrees. Level means the same score, not within the margin. I measured this: within the margin, the read's own paragraph scored 1 and a neighbour showing the old words scored 0.86, and the words chose the neighbour.
   - If that settles nothing, the target is scored with its words as before. That answer is taken only when it resolves to the element the unworded ranking put first, so words that still agree can lift the read over the floor, and old words never choose a different element.
   - If `unworded` ranks nothing (nothing but the family is left), the scoring with words is returned as is.
   - Headers on `veto.ts` and `score.ts`, and a paragraph in the `identity/index.ts` header, say this. `readWordsOf` is internal and not exported from the barrel.
5. **Tests.**
   - `identity/tests/veto-read-target.test.ts` (d2's file), rewritten:
     - An unmarked bare paragraph whose words changed is still refused, as today.
     - The marked one is acted on through `vetoCandidate` and `vetoExactMatch`.
     - A distinct name still has to agree.
     - A name equal to the words, or arriving alone, does not veto.
   - New `identity/tests/read-words.test.ts`:
     - How a marked target splits into `unworded` and `words`.
     - Two equally matching candidates are told apart by the words.
     - Neither candidate agreeing stays unresolved.
     - Old words on a neighbour never beat the selector's paragraph.
     - A label resolves a read whose words changed.
   - `element-finder.ts` needed no change: its lookups only add candidates.

## Edit needed outside my Owns (for the lead)

- `domain/src/actions/types.ts`, in `WebAutomationElementFingerprint`, add:
  `/** The step reads this element's words: its value, not a veto (plan-resolution/read-identity.ts). */ readsWords?: boolean | undefined;`
- `domain/src/output-nodes/targets/targets.ts`, in `elementFingerprint`'s object, add:
  `readsWords: booleanValue(element.readsWords) === true ? true : undefined,`
  This is required anyway: once the type has the field, the `satisfies ElementFingerprintFields` check fails to compile until the key is listed.
- Then check that the mark survives `client/gateway-mapping.ts` `commandElementFingerprint`, and that it survives when the chosen source is the target Core's `prepareElementTargetAction` normalized. If Core's normalizer is chosen, it would drop the key too.
- The guard is unaffected: `signals.ts` never reads the field.

## Commands run and observed results

- `cd domain && DOMAIN_TEST_BUILD_LABEL=t743-d2b node scripts/test-domain.mjs plan-resolution/tests/read-identity` -> `# tests 5 # pass 5 # fail 0`.
- `... test-domain.mjs plan-resolution/tests element-fingerprint` -> `# tests 191 # pass 191 # fail 0`.
- `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=t743-d2b node scripts/test-extension.mjs content/identity/tests/read-words content/identity/tests/veto-read-target`:
  - First run: 7 pass, 1 fail. The margin tie-break chose the neighbour showing the old words.
  - I changed "level" to equal score. Rerun: `# tests 8 # pass 8 # fail 0`.
- `... test-extension.mjs content/identity/tests content/tests/element-finder` -> `# tests 199 # pass 199 # fail 0`.
- `... test-extension.mjs content/action-runtime/tests/resolve-target` -> `# tests 17 # pass 17 # fail 0`. This was a regression check only; I edited nothing there.

## Not verified

- **End to end the mark does not reach the page yet**, because of the two files above. No test spans the domain-to-extension wire.
- No typecheck, build, structure audit or full suite (barred by the brief).
  - I believe the unused `_marked` / `_firstWords` names next to a rest element are accepted by TypeScript, but did not check.
  - `read-words.ts` exports one function; its return type is inline.
- The whole extension resolve path (`action-runtime/resolve-target.ts`, outside Owns) was not run with a marked target in a DOM. The veto and the scorer were tested directly.
- No live or browser run.

## Open questions or contradictions found

1. The brief guessed the type was in `element-fingerprint/` or Core's `model/action-element-target.ts`. It is the domain's `actions/types.ts`, plus its normalizer in `output-nodes/targets/targets.ts`. Both are outside my Owns.
2. `resolve-target.ts` `fingerprintMatches` still looks elements up by the recorded words once the selector misses.
   - Suppose a lone element elsewhere now shows a read's old words, and the read names nothing else distinguishing.
   - The veto accepts that element, as it would have before d2. The selector attempt runs first, so this only matters once the selector has drifted.
   - Fixing it is a `resolve-target.ts` change and needs the lead's decision.
3. `stableNameMatch` in `resolve-target.ts` still reads the full recorded identity on a refusal path. Not mine; probably harmless.
