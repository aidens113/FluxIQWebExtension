# t194-w86: a page bound beside `paginate` is read inside it

## Outcome

Done. A handle-form `extractList` with `maxPages` (or `maxScrolls`) written beside `paginate` now resolves with the bound inside `paginate` when the read pages. When the two places hold different values it is refused, and the refusal names both positions. When the read does not page it is refused with a new hint code saying the bound belongs inside `paginate`.

## What changed and why

- `domain/src/runtime/llm-evidence/plan-resolution/extraction/slot.ts`
  - New `liftedBounds(value, binding)`, which runs before `keptPagination`. The top-level paging bounds are `maxPages` and `maxScrolls`. These are the only keys of the expected `paginate` shape that say how far to read. The others (`mode`, `next`, `control`, `pages`) name controls or a mode, so they still count as unknown keys.
  - "The read pages" means one of two things:
    - `paginate` is written as an object; or
    - `paginate` is absent or `true` and a pagination was detected.
    This goes slightly beyond the brief's wording ("paginate present and not false"). An absent `paginate` already reads the detected pagination (`keptPagination`), so a bound there can mean only one thing.
  - The bound is copied into `paginate`. The same value in both places is accepted once. Different values are refused `web.handle.malformed` at `[key]`, and the second position `["paginate", key]` is carried on a new optional `also` field.
  - A read that does not page (`paginate: false`, or nothing detected) is refused at `[key]`, with `expected` set to `web.handle.expected.extract_list.paginate.maxPages` or `.maxScrolls`.
  - `unknownKey` no longer treats `maxPages` or `maxScrolls` as unknown. The resolved request is built from the lifted `paginate`, so the Flow stores `paginate.maxPages` and no top-level key. That is the shape `stores.extractions.wrote` keeps and a draft reads back.
- `resolve-plan-node.ts`
  - `WEB_PLAN_HANDLE_ISSUE_CODES` gains the two hint codes, after `extract_list.handle_fields_paginate`.
  - A refused slot now passes `expected` as the refusal's `fits` code. When `also` is set, it pushes a second refusal at that position. The `Refusal` doc comment is updated to match.
- Tests:
  - `extraction/tests/slot.test.ts` has one new test:
    - mustvzvg's exact `extractList` resolves to `paginate {…NEXT, maxPages: 10}` with `minItems: 0` and no top-level key;
    - equal values, `paginate: true` and absent `paginate` all resolve;
    - disagreeing values give `[malformed, handle_fields_paginate hint, malformed:extractList.maxPages, malformed:extractList.paginate.maxPages]`;
    - `paginate: false` gives `[malformed, handle_fields_paginate hint, paginate.maxPages hint, malformed:extractList.maxPages]`;
    - feed `maxScrolls: 4` beside `paginate {mode: "scroll"}` resolves to `{mode: "scroll", maxScrolls: 4}`.
  - `tests/resolve-plan-node.test.ts` now lists the two new codes in the published code list.

## Commands run and observed results

- Before implementing: `node .../t194/narrow-tests.mjs <domain> w86 runtime/llm-evidence/plan-resolution/extraction` printed `not ok 26 - a page bound written beside paginate instead of inside it ...`. The diff showed the hint code where a resolution was expected.
- After implementing: `node C:/Users/osrs_/AppData/Local/Temp/claude/.../scratchpad/t194/narrow-tests.mjs C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQWebExtension/domain w86 runtime/llm-evidence` printed `# tests 735`, `# pass 735`, `# fail 0`. This includes `tool-rejection-detail.test.ts`, which accepts the new `web.handle.expected.*` codes as shape hints rather than reasons.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194 w86 domain check" pnpm run check` (in domain) ran `core-build` ("current with its source") and the build-cache step `domain:check` (src and test tsc, 15850 ms). It printed no errors and a rerun exited 0.

## Not verified

- No live run. The model-facing text of the new hint code depends on how Core and `tool-rejection.ts` relay `instead` codes. That relay was not changed here, and other workers are editing it concurrently.
- I did not test the case where no pagination was detected and `paginate` is absent (the table fixture). The code path is the same as `paginate: false`.
- The literal (non-handle) `extractList` path (`own-extraction-list.ts`) was not changed.

## Open questions or contradictions found

- The brief defines "pages" as "paginate present and not false". I also count absent `paginate` over a detected pagination as paging, because that read does page.
- Top-level `mode`, `next`, `control` and `pages` are still refused as unknown keys. I judged them not unambiguous.
