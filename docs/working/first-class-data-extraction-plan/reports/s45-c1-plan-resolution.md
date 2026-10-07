# Report: s45-c1-plan-resolution (W-C1, wave 2 of s45-next-page)

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t284/!FluxIQWebExtension` (branch `task/t284-read-list-s45-next-page`). No commits.

## Outcome

Done. The handle-form read refuses `paginate`, `maxPages` and `maxScrolls` with the Next page hint, and a resolved read
never carries `paginate`. A `web.output.dom-next_page` node's `nextPage` resolves to a `WebAutomationNextPageRequest`
from the detected binding, or from a named control. The detection packet tells the model to use Next page on the same
handle. It no longer shows a mode bound.

## What changed and why

- `plan-resolution/extraction/slot.ts` (C3, 6.1):
  - `paginate`, `maxPages` and `maxScrolls` are refused `web.handle.malformed` at that key, with
    `expected: "web.handle.expected.extract_list.next_page"`. This includes `paginate: false`, because the contract
    refuses the key whatever its value. The check runs before the unknown-key check.
  - The resolved request never has `paginate`. The binding keeps it.
  - Deleted as unused: `keptPagination`, `everyPage`, `liftedBounds`, `BOUND_INSIDE_PAGINATE`, `NO_PAGER_DETECTED` and
    the refusal's `also` member (`liftedBounds` was its only producer).
  - Updated the header comment.
- `plan-resolution/next-page-slot.ts` (new, C2): `resolveWebNextPageSlot(value, scope, targets, extractions)`.
  - **Handle form:** `{list, control?}`. Each handle may be a bare token or `{handle, location?}`.
    - `list` resolves through the binding to `item` and `itemElement`, which the packet leaves unset today.
    - `pagination` is the detected `paginate` without its bound: `{next}` (or `{mode:"next",next}`),
      `{mode:"loadMore",control}`, `{mode:"scroll"}` or `{mode:"numbered",pages}`. It is absent when nothing was
      detected.
    - `control` replaces the detected way with `{next: <tN's selector>}`.
    - The result is held to `webAutomationNextPageRequestValue`.
    - The frame comes from the binding (`frameId`, `frameUrlPath`).
    - A control in another frame is refused `web.handle.frame_mismatch` at `nextPage.control`.
  - **Literal form:**
    - `{item, next}` (with optional `itemElement`) becomes `{item, pagination:{next}}`, in the node's own frame.
    - A whole valid request (`item`, `itemElement`, `pagination`) is left unchanged.
    - An invalid literal is refused `malformed`.
  - **Refusals:**
    - Unknown or foreign handles are `web.handle.unknown` at `nextPage.list`.
    - Let-go handles are `web.handle.stale`.
    - A target handle in `list`, or an extraction handle in `control`, is `misplaced`.
    - Other keys are `malformed` at that key.
- `plan-resolution/resolve-plan-node.ts`:
  - New branch for the Next page node's `nextPage`. Run Output payloads go through it as well.
  - On that node, malformed or misplaced refusals carry the new hint `web.handle.expected.next_page.list_control`, and
    a handle anywhere else on the node is misplaced with the same hint.
  - `WEB_PLAN_HANDLE_ISSUE_CODES`:
    - Added `web.handle.expected.extract_list.next_page`, with a comment naming the loop: read, Next page on the same
      handle as `{list}`, then a repeat while it succeeds.
    - Added `web.handle.expected.next_page.list_control`.
    - Removed the three retired paging hints.
    - **Renamed** `web.handle.expected.extract_list.handle_fields_paginate` to
      `web.handle.expected.extract_list.handle_fields`. Without the rename, the `paginate` refusal would also carry a
      hint naming `paginate` as part of the shape. `git grep` (excluding docs) finds the old code only in my owned files
      and their tests. It does not appear in Core.
- `plan-resolution/issue-position.ts`: added `nextPage`, `list` and `pagination` as grammar keys, so positions read
  `nextPage.list` and not `nextPage.0`.
- `plan-resolution/index.ts`: comment only. The new module is internal and is reached through `resolveWebPlanNode`.
- `structure/packet.ts`:
  - `paginationBound` is gone from the packet.
  - `pagination` (the mode word) stays and says how the list continues.
  - New `nextPageNote?: string`, present unless `pagination` is `none`: `this list goes on past this page, and a read reads this page only; for every page, add Next page with nextPage: {list: "<handle>"} after the read, then repeat the read through Next page while it succeeds`.
  - The binding still keeps the detected pagination, including the inferred scroll.
- `structure/handles.ts`: comments only. They say the binding's `paginate` is kept for Next page, not for the read.
- Tests (fail-first, observed failing before the change):
  - New `plan-resolution/tests/next-page.test.ts`:
    - pager resolution, for each detected way and for no pager;
    - `control`;
    - the literal forms;
    - unknown, foreign and stale handles;
    - malformed and misplaced handles;
    - Run Output.
  - Extended `plan-resolution/tests/frame-path.test.ts` with a Next page step over a list in a child frame, a control in
    another frame, and a declared frame that differs.
  - `extraction/tests/slot.test.ts`: the old paging tests were replaced by two tests:
    - "read never carries paginate; binding keeps it" (catalog and feed);
    - `paginate`, `maxPages` and `maxScrolls` refused with the next-page hint, including over an unpaged list and in a
      Run Output.
  - `structure/tests/detect.test.ts`: the `paginationBound` tests were replaced by `nextPageNote` tests, and the packet
    key allowlist was updated.
  - Pure pins updated in my folders:
    - `paginate: false` was removed from inputs in `slot.test.ts` and `conditions.test.ts`;
    - the hint rename in `conditions.test.ts`, `own-extraction-list.test.ts` and `resolve-plan-node.test.ts`;
    - the code-list pin, and the stale-handle scroll pin, in `resolve-plan-node.test.ts`.
  - No test outside my folders was edited.

## Commands run and observed results

- Fail-first: `run-subset.mjs <domain> s45-c1` over next-page, frame-path, resolve-plan-node, slot, conditions and
  detect tests, then `node --test`. Before the source change, 39 of 70 failed: the hint rename, `paginate`,
  `paginationBound`, and the absent next-page resolution.
- After the change, same subset -> `# tests 70 # pass 70 # fail 0`.
- `run-subset.mjs <domain> s45-c1` over `plan-resolution/tests/*`, `plan-resolution/extraction/tests/*`,
  `structure/tests/*` and `runtime/llm-evidence/tests/*` (48 files) -> `# tests 332 # pass 332 # fail 0`. This includes
  `tool-rejection-detail.test.ts`, which checks that every `web.handle.expected.*` code is a hint and not a reason.
- `run-subset.mjs <domain> s45-c1b` over every other `runtime/llm-evidence/*/tests/*` folder (55 files: action-failure,
  node-run, system-instructions and the rest) -> `# tests 413 # pass 413 # fail 0`. This was run while W-C2 may still
  have been editing.
- `pnpm.cmd --filter @fluxiq-web-extension/domain check` -> exit 0. Its build-cache step answered `reuse`, so I also ran
  `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit` in `domain/`. Both exited 0.
- `node scripts/structure-audit.mjs` -> exit 1, with exactly one violation, outside my paths:
  `FAIL [naming] apps/extension/src/content/extraction/page-advance/: 3 files share the prefix "page-"` (W-D's
  directory). My paths have advisory line-count warnings only: `resolve-plan-node.ts` is 671 lines (limit 800), and
  `slot.test.ts`, `resolve-plan-node.test.ts` and `detect.test.ts` are over 400.

## Not verified

- No full domain suite, Lab, browser or provider run. The resolved `nextPage` was checked against
  `webAutomationNextPageRequestValue`, but not dispatched through the node.
- The packet's `itemElement` is never set by detection today, so a binding that carries `itemElement` is untested.
- `system-instructions` and `tools.ts` text are W-C2's and were not touched.

## Open questions or contradictions found

- **For W-C2:**
  - `tools.ts:380` still says the detect tool "Returns ... pagination and paginationBound" and teaches `paginate`.
    `paginationBound` no longer exists. The packet now has `nextPageNote`.
  - `tests/tools.test.ts:163-167` pin those words (`/paginationBound/`, `paginate: {maxPages: N}`) and will need
    changing with `tools.ts`.
- **The replay entry point:** W-C2's replay should resolve a next-page step through the same `resolveWebPlanNode`, or
  through `resolveWebPlanNodeParameters` or the runtime's `resolvePlanNodeParameters`. No separate export is needed.
  Use `nodeDefinitionId: "web.output.dom-next_page"` and parameters `{nextPage: {list, control?}}`.
- **The hint rename:** `handle_fields_paginate` is now `handle_fields`. It is a model-visible code, so the lead may
  want it in the S4 docs pass. Historical reports under `docs/working/` still quote the old code.
- **`paginate: false` is refused too,** per the contract. A model that habitually writes `paginate: false` is refused
  once and told the Next page shape. If the lead would rather drop a literal `false` silently, the change is one line
  in `slot.ts` (`RETIRED_PAGING_KEYS` check).
- **A literal `{item, next}` Next page is accepted** even after a detection, as C2 says. This differs from the read,
  which refuses a literal after a detection as `extraction_required`.
