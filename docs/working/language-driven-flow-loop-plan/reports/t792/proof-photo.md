# t792 proof-photo

## Outcome
Done. Both proofs pass headed on photo-social, provider-free; every photo-*.spec.ts passes.

## What changed and why
Only `apps/extension/e2e/site-reset/tests/` specs, no product source, no new files.
- `judged-change-like-loop.spec.ts`: removed the stale "DRAFT ... expected to fail" header (the spec passes). Added t792 fix 1 assertions to both variants: the earlier-liked post is in the account's liked list before the trial and appears exactly once after it (so its press was skipped, not toggled off), and the list grew by exactly the number of `changed` acts. The `already_in_state` act assertions already existed. A build-click counter was tried and dropped: trial presses do not go through it (observed 0 vs 2); the account's own liked list is the witness.
- `photo-dialog-step.spec.ts`: new test "is told a covered press's layer has a collapse control of its own, before any link in it". Post page opened by address, messages dock left expanded (never collapsed), a look, then a press on the first control the view marks `covered-by` the dock (a comment author link). Asserts: refusal says the layer covers it; nothing clicked; dock still up; the sentence "own controls, header first: <list>" has a first entry that is a control with no words, no entry is a link, and the "links and rows inside the layer are its content" clause is present.

## Commands run and observed
All builds/e2e under the heavy-check lock, from `apps/extension` of `fxwork/t792/!FluxIQWebExtension`. Browser: full Chromium (`channel: chromium`), headed via the extension-context fixture, workers=1.
- Core libs were stale: `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` (in `../!FluxIQ`) -> rc 0. Then `pnpm test:e2e:build` -> rc 0.
- Run command: `node --no-experimental-strip-types node_modules/@playwright/test/cli.js test -c e2e/playwright.config.ts <spec> --workers=1`.
- Covered dock alone -> 1 passed. The domain's answer was: `t279 (a control with no words in the layer's header)` as the only own control, then "A close, collapse or minimise control may have no words; the links and rows inside the layer are its content, not its controls", for press target t111 (a comment-author link) covered by layer t275. The build then ended `failed` (`project.completion_nothing_assembled`), which is expected for a look-only script and not asserted.
- Full set `e2e/site-reset/tests/photo- e2e/site-reset/tests/judged-change-like-loop`: 7 passed, 2 failed (the click-counter assertion described above, a defect in my first draft). After removing it, `judged-change-like-loop` rerun: 2 passed (newest, pinned) in 2.3m. Passing in the full run: photo-dialog-act, photo-dialog-destination, photo-dialog-step (both tests), photo-looped-other-item, photo-page-order-limit, photo-toggle. Total: all 6 photo-*.spec.ts files (7 photo tests) + 2 like-loop variants green.
- `tsc --noEmit -p .` (apps/extension) -> clean; `tsc --noEmit -p tsconfig.test.json` (includes e2e) -> no errors in e2e/site-reset.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (232 warning(s), 616 baselined)`.

Artifacts: `apps/extension/e2e/test-results/artifacts/` (diagnostics `covered-dock.json` under `site-reset-tests-photo-dia-95a95-s-own-before-any-link-in-it`); logs `C:/Users/osrs_/AppData/Local/Temp/proof-photo-run{2,3,4}.log`.

## Not verified
- Proof 1 pins the skip by liked-list state and `already_in_state` acts, not by a click count. The fix-1 exploration re-press (`ensureState` on a re-press) is covered by Core unit tests only; this spec has no exploration re-press of a flipped control.
- The covered press targeted a comment link; the dock's icon-only handle was identified by the "no words" wording, not by pressing it.
- Full suites not run (per the twice-a-day rule).

## Open questions or contradictions found
- The fix4 report's concern about `repeated-refusal.ts` dropping `layerControls` on a repeated covered press was not exercised (single press).
