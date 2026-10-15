# t642 report: stable handles and hidden ties

Worker report. Worktree `C:/Users/osrs_/FluxStuff/fxwork/t642/!FluxIQWebExtension`, branch
`task/t642-stable-handles-and-hidden-ties`. Nothing committed. No live run.

## Outcome

Done. Both product defects from the `run-mv9v3u68-6efbd7ae` debug are fixed, each with tests. I confirmed that
the new tests fail against the old source and pass against the new.

## What changed and why

### (1) Domain: a handle never moves to another control within one document

`domain/src/runtime/llm-evidence/stable-handles.ts`

- `Seen` now records `document`, the capture's `navigation.timeOrigin`, when the capture gives it.
  `reboundByPlace` (tier 4) skips any number last seen in the same document as the current capture. Tier 4 exists
  for a reload. Without a load, a control that vanished is gone, and one that appeared is new. When either capture
  has no `timeOrigin` (hand-built bindings, older producers), tier 4 behaves as before, so every existing
  reload test keeps passing unchanged.
- `placesOf` now includes the element's shadow-root depth (the length of its host chain), not the host selectors
  themselves. A reload can rewrite a host's selector (a minted id), but it never moves a control between the light
  document and a widget's shadow root. This blocks the exact shape of the run (a shadow close replaced by a
  light-DOM close) even when no document identity is available.
- The header comment, the tier list and the `Seen`/`placesOf` docs describe the new rule.

This uses both of the brief's options: the place key gets the depth part of the host chain, and tier 4 is limited
to captures after a load. The order of the tiers is unchanged. Tiers 1-3, which handle in-document moves and
relabels, are unchanged. No saved element's fingerprint is affected, because this only chooses which handle
number an element gets.

### (2) Extension: hidden-only ties are not found, visible ties stay ambiguous

`apps/extension/src/content/action-runtime/resolve-target.ts`

- In `resolveIn`, when a strategy has several matches (after the record filter) and none of them
  `isVisibleForResolution`, the strategy now counts as a miss (`(N matched, none of them visible)`). It no longer
  goes to `gatedPool` and on to an ambiguous tie.
- After every strategy misses, the family-scoring fallback now returns `not_found` when the scored tie is
  "hidden-only", meaning no candidate at or above `TARGET_SCORE_FLOOR` is visible. Both halves are needed. Without
  the second, the three hidden "×" divs went on to tie again in family scoring. I checked this by removing it: the
  two hidden-tie tests fail.
- A tie among visible elements is still `web.target.ambiguous`. A *lone* hidden match still resolves, which
  assertions need. The point-strategy family check is unchanged.
- `resolve-target.ts` went to 831 lines, past the 800-line structure limit. To fix that, I moved the resolution
  gate into a new focused module, `apps/extension/src/content/action-runtime/resolution-gate/`. It contains
  `visible.ts` (`isVisibleForResolution`, moved unchanged), `passes-gate.ts` (`passesResolutionGate`, the former
  private `passesGate` plus `isEnabledForResolution`, now taking the recorded tag), `hidden-tie.ts` (`isHiddenTie`)
  and an `index.ts` barrel. `resolve-target.ts` is now 791 lines. This directory is outside the brief's literal
  owned paths. It holds code split out of `resolve-target.ts`, and nothing else imports it.
- The header comment in `resolve-target.ts` has a new paragraph explaining the rule.

### Tests

- `domain/src/runtime/llm-evidence/tests/stable-handles.test.ts`: `runtimeOver` accepts an optional `document`
  (`timeOrigin`). There are three new rows on a recipe-site fixture:
  1. A shadow-root close `div "×"` is clicked away, and in the same document a light-DOM panel close `div "×"`
     appears. The panel gets a new number, and the old handle resolves to nothing.
  2. A light-DOM close at the same depth vanishes and a look-alike appears elsewhere in the same document. It gets
     a new number. This row fails on the depth change alone, so it proves the document guard.
  3. A reload that rewrites the selector, with both `timeOrigin`s known and different, still keeps the handle
     (tier 4 still works).
- `apps/extension/src/content/action-runtime/tests/resolve-target.test.ts`: the `TwinButton` stub takes a `shown`
  flag, and `installTwinPage` takes `{ shown, inShadowRoot }`. There are five new rows: hidden-only twins give
  `web.target.not_found` (in the document and in an open shadow root), visible twins give `web.target.ambiguous`
  (both places), and a lone hidden match still resolves.

### Docs

`docs/architecture/build-loop.md`: the stable-handles paragraph now names shadow-root depth and the same-document
rule. A new short paragraph covers hidden-only ties at replay.

## Commands run and observed results

- `node domain/scripts/test-domain.mjs runtime/llm-evidence` -> `# tests 1130 / # pass 1130 / # fail 0`.
- `node domain/scripts/test-domain.mjs runtime/llm-evidence/tests/stable-handles`: with the new source,
  `# tests 23 # pass 23 # fail 0`. With `stable-handles.ts` reverted to HEAD (and then restored),
  `not ok 21` (closed pop-up handle) and `not ok 22` (same-depth look-alike), `# fail 2`.
- `npx tsc -p tsconfig.json --noEmit` (domain) -> exit 0. `npx tsc -p tsconfig.test.json --noEmit` (domain) -> exit 0.
- `node scripts/test-extension.mjs content/action-runtime/tests/resolve-target` (apps/extension): with the new
  source, `# tests 17 # pass 17`. With `resolve-target.ts` at HEAD, `not ok 13` and `not ok 15` (the two hidden-only
  rows), `# fail 2`. With only the scoring half (`isHiddenTie`) removed, the same two fail.
- `node scripts/test-extension.mjs content/action-runtime content/identity` (after the split) -> `# tests 483 # pass 483 # fail 0`.
- `node scripts/check-extension.mjs` (apps/extension; tsc on src and tests) -> exit 0, no output.
- `pnpm structure:check` -> first run `FAIL [file-lines] resolve-target.ts: 831 lines`. After the split it exits 0,
  with only advisory warnings for files already over 400 lines (`resolve-target.ts` 791,
  `stable-handles.ts` 496, both test files).

## Not verified

- No live run and no browser or e2e run (`e2e/content/tests/identity-ambiguity.spec.ts`,
  `resolve-target.spec.ts`). I grepped them, and their ambiguous cases appear to be visible ties, but I did not
  run them.
- I did not run the whole extension or domain suites, only the directories named above.
- Iframe case: `navigation.timeOrigin` is the captured page's document identity. A child frame that reloads while
  the top document does not now gets new numbers at tier 4 instead of being rebound. That is safe (a new number,
  never a wrong one) but less helpful. Not exercised.
- That a live capture of the run's page gives the same `timeOrigin` across the click and the Add to cart. The
  debug says there was no load between them, and the extension stamps `performance.timeOrigin` in
  `content/evidence/navigation.ts`.

## Open questions or contradictions found

- The new `resolution-gate/` directory sits outside the brief's owned paths. The structure limit forced the split,
  and moving the code was the honest fix (not extract-and-drop).
- The debug's second hardening idea (do not widen into shadow roots on words alone for a target with a `body > ...`
  selector and no host chain) was not part of this brief and is not implemented.
- Lab fix 3 from the debug (a failed optional step counted as the run's failure) belongs to t643 and was not
  touched.
