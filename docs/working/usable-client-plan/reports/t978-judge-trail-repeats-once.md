# t978 report: the judge's trail carries each page view once

## Outcome
Done. Tests, targeted tsc and structure audit pass (observed below).

## What changed and why
Under `C:/Users/osrs_/FluxStuff/fxwork/t978/!FluxIQ/packages/fluxiq/src/runtime/result-verification/`:
- `run-trail/repeats.ts` (new): `automationStudioResultTrailRepeatsOnce`. A member of an entry's `found` object that is >= 120 chars and byte-identical to the same-named member of an earlier entry becomes `{ "sameAs": "<callId of first holder>" }` (`n:<n>` where the holder has no callId). First holder never stubbed; order and other members unchanged; entries without repeats returned as is. Not limited to fields/page/view.
- `run-trail/trail.ts`: applied to the screened entries when the trail is built, so `fitting.ts`/`window.ts` (unedited) measure the smaller trail.
- `run-trail/note.ts`: one generic sentence on sameAs (also says a target not repeated here is in the evidence above under that callId). `run-trail/index.ts`: export.
- Continuation: `continuation.ts` NOT edited. A stub whose target the continuation drops keeps the decider-held callId as its reference; its `shownAbove` already says dropped calls are above by callId.
- Two existing tests assumed identical pages repeat in full: `build-test/tests/request-size.test.ts` (resolve `n:N` stubs; count distinct pages) and `flow-less/tests/judge-size.test.ts` (three distinct pages; an identical repeat now shrinks the request under the fitting threshold, the intended effect).
- `run-trail/tests/repeats.test.ts` (new, 5 tests): stubs to first holder; first holder never stubbed; distinct untouched, n:N naming; no-repeat trail byte-identical apart from the note; size (entries of 12 reads of one repeated page under half of 12 distinct); continuation case.

## Commands run and observed results (gated, from packages/fluxiq)
- `vitest run src/runtime/result-verification src/runtime/models/providers/anthropic/tests src/runtime/llm/anthropic/tests` -> 3 failed | 240 passed files (repeats size fixture, request-size, judge-size; fixed).
- `vitest run src/runtime/result-verification` -> 2 failed, 227 passed (repeats ratio counted the shared note; request-size string escape; fixed).
- `vitest run src/runtime/result-verification/run-trail` -> 5 files, 28 tests passed (run-mwo3dp11-trail 11, trail-sources 6, repeats 5).
- `vitest run .../build-test .../flow-less` -> 36 passed, 1 failed (request-size); then `request-size.test.ts` alone -> 6 passed.
- targeted tsc (repeats.ts, trail.ts, repeats.test.ts) -> exit 0, no output.
- `node scripts/structure-audit.mjs` -> first failed on a deep import in my test (fixed to the anthropic barrel); then "structure-audit: passed (562 warning(s), 909 baselined)", exit 0.

## Not verified
Anthropic provider and llm/anthropic folders ran only in the first sweep (no failures there), not after the later test-only edits. No live judge run: real cache share and cost saving unmeasured. The final state of result-verification as a whole was not re-run in one go.
