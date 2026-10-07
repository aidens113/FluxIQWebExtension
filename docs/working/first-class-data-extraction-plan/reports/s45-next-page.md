# Report: s45-next-page (lead, stages S4 and S5 of the read-list redesign)

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t284/!FluxIQWebExtension` (branch `task/t284-read-list-s45-next-page`); Core
sibling `fxwork/t284/!FluxIQ` used for builds only, never edited. Design:
`read-list-collect-design.md` (summary, 1.1-1.3, 4.2, 6, rows S4 and S5 of section 7).

## Current State

- 2026-10-06: S4 and S5 are done and verified in the tree (uncommitted). Two supervisor add-ons are done too: W8, a
  handle renumbered by a reload (W-F plus lead wiring), and U-B3-3, a control's text glued together (W-G; the page
  view is fixed, the overlay fallback is still open).
- **Merge order: S4/S5 must merge after Core S1+S2.** Current Core refuses `recordOutput.process` (`unknown_key`) and
  does not route `ended`. After S1 lands, replace the stub `WebAutomationRecordOutputProcess` with Core's
  `AutomationStudioRecordProcessing` (S1's type is a superset of the stub: it adds `where` and `columns`), and drop
  the parse-without-`process` split in `extract-list/dispatch.ts`.
- S2 contract as built here:
  - Flow runs: `payload.route === "ended"` at the top of the dispatch payload, lifted by
    `io/gateway-output-dispatcher.ts`; `runtime/adapter.ts` passes it through.
  - Build test: the replay answers `resultCode: "core.replay.ended"`, and `evidence.route: "ended"` is also kept.
  - Node outputs: `success`, `failed`, `ended` (role `branch`).

## The contract every S4/S5 worker builds against (lead, 2026-10-06)

D = `domain/src`, E = `apps/extension/src`.

### C1. The action `web.dom.next_page` (node `web.output.dom-next_page`, label "Next page")

- Added to `WebAutomationActionType`, `WEB_AUTOMATION_ACTION_TYPES` and every total record over it (legacy alias
  `dom.next_page`; effect `mutate`, since pressing twice moves two pages; not an element target, no `item` input port).
- Command member (`WebAutomationActionCommand.nextPage`), declared in new `D/actions/next-page/`:

  ```ts
  export type WebAutomationNextPageWay =
    | { mode?: "next" | undefined; next: string }
    | { mode: "loadMore"; control: string }
    | { mode: "scroll" }
    | { mode: "numbered"; pages: string };
  export type WebAutomationNextPageRequest = {
    item: string;                                   // the list's item selector
    itemElement?: WebAutomationElementFingerprint | undefined;
    pagination?: WebAutomationNextPageWay | undefined; // as detected or named; absent = found live from the list
  };
  ```

  Parsed by `webAutomationNextPageRequestValue(value): WebAutomationNextPageRequest | undefined` (refuses unknown
  keys, empty selectors, a `maxPages`/bound of any kind: one step moves one page).
- Result member (`WebAutomationActionResult.nextPage`) and route:

  ```ts
  export type WebAutomationNextPageBy = "next" | "following" | "numbered" | "loadMore" | "scroll";
  export type WebAutomationNextPageEnd = "control_absent" | "control_disabled" | "no_following_page" | "scrolled_to_end";
  export type WebAutomationNextPageFault = "list_unchanged" | "rate_limited" | "list_vanished" | "control_not_clickable" | "page_fault";
  export type WebAutomationNextPageAnswer =
    | { outcome: "moved"; by: WebAutomationNextPageBy; page?: number | undefined }
    | { outcome: "ended"; stop: WebAutomationNextPageEnd }
    | { outcome: "failed"; stop: WebAutomationNextPageFault };
  // on WebAutomationActionResult:
  nextPage?: WebAutomationNextPageAnswer | undefined;
  route?: "ended" | undefined;                      // set exactly when nextPage.outcome === "ended"
  ```

  `moved` and `ended` are `status: "succeeded"`; `failed` is `status: "failed"` with an existing failure code:
  `list_unchanged`/`list_vanished` -> `OUTPUT_NOT_OBSERVED`, `rate_limited` -> `RATE_LIMITED`,
  `control_not_clickable` -> `TARGET_NOT_ACTIONABLE`, `page_fault` -> `ACTION_FAILED`. `page` is the number the
  pager marks current after the move, when it marks one. Value parser `webAutomationNextPageAnswerValue`.
- **Route to Core (S2's contract, stubbed here).** The node declares outputs `success`, `failed` and `ended`
  (role `branch`). The client result payload (`webAutomationActionResultPayload`) carries `nextPage` field by field
  and `route: "ended"` only as that literal. The domain's two exits to Core (`D/io/gateway-output-dispatcher.ts`,
  `D/runtime/adapter.ts`) lift it to the **top level of the dispatch payload**: `payload.route === "ended"`.
  S2 must take a dispatched action's route from `result.payload.route` when the node declares an output with that id.
- Dispatch timeout: the node's default `timeoutMs` 30 000, sent as the dispatch's own (as extract-list does).

### C2. The model's form and its resolution

- The model writes `{"nextPage": {"list": "extraction.N"}}`, optionally `"control": "tN"` (a page-view handle for a
  site's own Next control), or a literal `{"item": "<selector>", "next"?: "<selector>"}`.
- Resolution (plan-resolution) writes the Flow's parameters as `nextPage: WebAutomationNextPageRequest`: `item` and
  `itemElement` from the binding's `extractList`, `pagination` from the binding's `extractList.paginate` without its
  bound (`maxPages`/`maxScrolls` dropped), or `{next: <tN's selector>}` when `control` is named.

### C3. The read reads one page

- `WebAutomationExtractListRequest.answer?: "kept"`. With it the page answers only the rows it kept, possibly none,
  never the rejected rows (`filtered-answer.ts`'s floor is exploration-only), and `minItems` counts items **seen**
  (the list is present), not rows kept. The domain sends it on Flow dispatch and replay
  (`webAutomationExtractListAloneRowsAsked`, used by both); exploration (`core.run_node`) does not.
- Flow dispatch (`extract-list/dispatch.ts`) moves `dedupe`, `sort`, `maxItems` and `minItems` off the page request
  into `recordOutput.process`:

  ```ts
  // stub of S1's AutomationStudioRecordOutput["process"]; D/output-nodes/extract-list/record-output-process.ts
  export type WebAutomationRecordOutputProcess = {
    dedupe?: { by: string[] } | false;              // absent = Core's default whole-row key
    sort?: { field: string; order: "asc" | "desc"; as?: "auto" | "number" | "date" | "text" }[];
    limit?: number;                                 // from maxItems
    minRows?: number;                               // from minItems
  };
  ```

  A `minItems: 0` also stays on the page request (an absent list is acceptable). `maxRecords` is no longer set from
  `maxItems`. Core's current `parseAutomationStudioRecordOutput` refuses unknown keys, so dispatch parses the output
  without `process` and re-attaches the domain-validated `process`; when S1 lands the split goes and the type becomes
  Core's. **S4 must merge after S1**: current Core's capture would refuse a `process` member.
- `paginate` on a stored or literal read: a bound above one page (or any `scroll`) is refused at dispatch with code
  `web.extract_list.paginate_retired` and the sentence "This step used to go through pages by itself; the Flow now
  needs a Next page step and a repeat"; a one-page `paginate` (`maxPages: 1`, what the picker records) is dropped, as
  it reads the same one page. In the handle form `paginate`, `maxPages` and `maxScrolls` are refused
  `web.handle.malformed` with expected hint `web.handle.expected.extract_list.next_page`.

## Waves and partition

| Worker | Wave | Owns |
|---|---|---|
| W-A next-page action and node (worker-high) | 1 | `D/actions/types.ts`, new `D/actions/next-page/**`, `D/actions/{schemas,safety}.ts`, `D/output-nodes/{definitions,native-runtime,parameter-contracts}.ts`, new `D/output-nodes/next-page/**`, `D/client/{gateway-mapping,gateway-action-parameters}.ts`, `D/io/gateway-output-dispatcher.ts`, `D/runtime/adapter.ts`, and one-line total-record additions anywhere else in `D/` the compiler names |
| W-B the read reads one page (worker-high) | 1 | `D/actions/extraction/**`, `D/output-nodes/extract-list/**`, `D/output-nodes/payloads.ts` |
| W-C1 plan resolution and handles | 2 | `D/runtime/llm-evidence/plan-resolution/**`, `D/runtime/llm-evidence/structure/**` |
| W-C2 model words and node runs | 2 | `D/runtime/llm-evidence/{tools.ts,system-instructions/**}`, `D/runtime/llm-evidence/node-run/**` |
| W-D extension Next page | 2 | new `E/content/actions/next-page.ts`, a page-advance module split from `E/content/extraction/pagination.ts`, `E/content/extraction/{pagination,detect-pagination}.ts`, `pager-reading/**`, `E/content/actions/{execute,types}.ts`, `E/runtime/{action-runner,extract-list-continuation}.ts`, `E/shared/{protocol,extraction-continuation}.ts`, total records the compiler names |
| W-E extension one-page read | 2 | `E/content/extraction/{list-reader,filtered-answer}.ts`, `E/content/actions/extract-list.ts`, `E/panel/extraction/**`, `E/background/extraction/definition.ts`, `E/shared/extraction-messages.ts` |

Never edited: `E/content/action-runtime/resolve-target.ts` (lane A); `node-run/replay.ts` only as S4 needs.

## Work Ledger

### 2026-10-06 - wave 1 landed (W-A, W-B), verified by the lead
- W-A (`s45-a-next-page-node.md`): `web.dom.next_page` action, node `web.output.dom-next_page` (outputs success/failed/ended), gateway lift, `payload.route` lift in `io/gateway-output-dispatcher.ts`. No plan-time parameter contract (the `{list}` handle form would be refused before resolution); the node refuses an unresolved handle at run time.
- W-B (`s45-b-one-page-read.md`): `answer: "kept"`, `recordOutput.process` stub, `paginate_retired` (multi-page or scroll), one-page `paginate` dropped. Decisions: an ordering helper column is now stored (sort/dedupe run over stored rows); `dedupe: false` gives no `process.dedupe` (Core's whole-row default); `dedupe: true` still resolves to the link column through `order-request.ts`; the read description's first sentence shortened to 79 characters (Core keeps 80).
- Lead closed the seam both reported: `answer: undefined` in `runtime/llm-evidence/structure/packet.ts` binding; updated `output-nodes/tests/definitions.test.ts` (no paging tags or `paginate` in the read's grammar) and `native-runtime.test.ts` (Flow read carries `answer: "kept"`; multi-page and scroll refused `paginate_retired`).
- Validation: `run-subset.mjs <domain> s45-lead` over `output-nodes/{tests,extract-list/tests,next-page/tests}`, `actions/{tests,extraction/tests,next-page/tests}`, `client/tests`, `io/tests`, `runtime/llm-evidence/structure/tests` then `node --test` -> `# tests 352 # pass 352 # fail 0`. `pnpm.cmd --filter @fluxiq-web-extension/domain check` -> exit 0. Extension not yet compiling against the new action type (wave 2).
- Supervisor add-on (W8, run `musq0b1m` cause 4): queued as wave 3 (W-F), files `runtime/llm-evidence/{press,tool-rejection,stable-handles}.ts`, `plan-resolution/target-packets.ts`.

### 2026-10-06 - wave 2 (W-C1, W-C2, W-D, W-E), add-ons (W-F, W-G), verified by the lead
- W-C1 (`s45-c1-plan-resolution.md`):
  - handle-form `paginate`, `maxPages` and `maxScrolls` are refused with hint `web.handle.expected.extract_list.next_page`;
  - `paginate: false` is refused too;
  - the resolved read carries no `paginate`;
  - `nextPage: {list, control?}` resolves to the request (new `plan-resolution/next-page-slot.ts`);
  - the packet's `paginationBound` became `nextPageNote`.
- W-C2 (`s45-c2-words-node-run.md`):
  - instructions are `web-5`; the lists sentence was appended to the existing Lists line, which keeps the t252 rule;
    the text bound went to 3,000;
  - the detect tool's words drop `paginate`;
  - call words and catalog cover next page;
  - the replay of next page says moved or ended.
  - Lead change: an ended replay now answers `core.replay.ended` (S2's code; W-C2 had `core.replay.replayed`), in
    `node-run/replay-answer.ts` (`WEB_NODE_REPLAY_RESULT_CODES.ended`) and `node-run/replay.ts`, with the test updated.
- W-D (`s45-d-extension-next-page.md`):
  - `content/actions/next-page.ts`; `content/extraction/page-advance/**`, split from `pagination.ts`, whose exports
    are kept;
  - the cross-document resend is generalised in `runtime/extract-list-continuation.ts`;
  - total-record lines in `panel/copy/step-copy.ts`, `background/connection/runtime-status.ts` and
    `content/action-runtime/execute-action.ts`;
  - e2e spec `e2e/content/tests/extraction/tests/everything-store-next-page.spec.ts` is written and typechecked,
    not run.
- W-E (`s45-e-extension-one-page-read.md`):
  - `answer: "kept"` answers kept rows only, possibly `[]`, with `minItems` counting items seen; exploration keeps
    its fallback;
  - the picker's "Read every page" box and its confirm member are removed;
  - the new tests are in `content/actions/tests/extract-list-kept-answer.test.ts`, because `extract-list.test.ts`
    would pass the 800-line limit.
- W-F (`s45-f-renumbered-handle.md`): the packet store marks a handle that a reload renumbered
  (`renumberedByReload`). The resolver code `web.handle.renumbered_by_reload` reads as the reason
  `handle_not_in_packet`, because Core reads that word; `detail.next` says the page was reloaded and its handles
  renumbered, and to look again.
  - Lead change: wired it in `plan-resolution/resolve-plan-node.ts` (`WEB_PLAN_HANDLE_ISSUE_CODES`, `resolveTarget`).
  - Lead change: an end-to-end test in `plan-resolution/tests/target-packets.test.ts`. It was fail-first: with the
    wiring reverted, `# pass 29 # fail 1`; with it, `# pass 30 # fail 0`.
  - Lead change: the pinned code list in `resolve-plan-node.test.ts`.
- W-G (`s45-g-glued-control-text.md`):
  - Root cause: `runtime/route-state/project.ts:35` named controls `name ?? text` and ignored `readable`. The capture
    was correct.
  - Fix: the page view and route state now share `page-view/element/readable-words.ts`.
  - Open: the overlay and the step result's `control` still fall back to the identity's glued `visibleText` when the
    handle is not in the look (`node-run/observed-control.ts:50`); that text cannot be re-spaced.
  - Open: route-signature hashes change for names that were glued.
- Validation (lead, after all edits):
  - every `tests/` folder beside a changed or new file, through `run-subset.mjs` then `node --test`: domain 145 files,
    `# tests 1029 # pass 1028 # fail 1` (the pinned code list), fixed, then that file `# pass 21 # fail 0`;
    extension 140 files, `# tests 1291 # pass 1291 # fail 0`;
  - `pnpm.cmd --filter @fluxiq-web-extension/domain check` exit 0;
  - `pnpm.cmd --filter @fluxiq-web-extension/extension check` exit 0;
  - `node scripts/structure-audit.mjs`: `passed (172 warning(s), 118 baselined)`. This came after the lead changed
    a test import to the `structure` barrel.
- Not verified:
  - no Lab, browser or provider run; the e2e next-page spec has not been run;
  - the real cross-document press;
  - the build against Core S1+S2;
  - full suites.

## What the next stages need

- **S3** (Core judges and build test):
  - an ended replay is `core.replay.ended`;
  - a Flow read sends `answer: "kept"` and its declared ordering as `recordOutput.process`;
  - the build-test replay of a multi-page read is now refused `web.extract_list.paginate_retired` (via
    `replay-answer.ts` -> `webAutomationExtractListDispatch`).
- **S6** (migration, Lab, docs):
  - the docs in design 6.6, none of them updated here;
  - the recording-lane exclusion;
  - `results.ts` `soughtSelector` does not know `nextPage.item`;
  - `domain/src/web-panel-host.ts:198` still proposes a scaled timeout for a recorded multi-page definition;
  - `dedupe: true` still resolves to the link column (`order-request.ts` `defaultKey`), not P4's whole row;
  - run the new e2e spec.
- **S7**: retire the read's paged loop. `pagination.ts` keeps re-exports for it.

### 2026-10-06 - supervisor follow-up after Core S1+S2 landed (Core c7094301), verified by the lead
- Core sibling fast-forwarded to `c7094301` and rebuilt: `pnpm.cmd build` exit 0.
- W-H (`s45-h-core-process.md`):
  - the stub is gone; the domain uses `NonNullable<AutomationStudioRecordOutput["process"]>` (Core's nodes entry does
    not export `AutomationStudioRecordProcessing` by name);
  - `dispatch.ts` parses the whole output, `process` included, through Core's parser; a refused `process` fails the
    node with `record_output.invalid`;
  - `dedupe: true` now means the whole row: `order-request.ts` `defaultKey` returns every readable column, and the
    Flow dispatch then writes no `process.dedupe`, so Core's whole-row identity applies;
  - `declared-columns.ts` was adjusted so a whole-row dedupe does not keep the helper columns.
  - Lead change: updated `plan-resolution/extraction/tests/slot.test.ts`, which pinned the link-column default.
- W-I (`s45-i-overlay-label.md`): two paths were glued, `call-words.ts` naming from the identity and the fallback at
  `observed-control.ts:50`. The resolution now carries a display-only `words` beside the identity, so `visibleText` is
  unchanged and a secret control gets no name.
  - Still glued: identity-only steps (test runs, dry runs, recorded nodes) and the step target.
- W-J (`s45-j-next-page-e2e.md`): `pnpm.cmd --filter @fluxiq-web-extension/extension test:content --
  everything-store-next-page.spec.ts everything-store-extraction.spec.ts --reporter=list` (headless Chromium) ->
  `4 passed (60.0s)`, then `4 passed (1.0m)`. No code change was needed. The store-pager unit walk:
  `# tests 94 # pass 94 # fail 0`.
- Lead validation, after all edits:
  - every `tests/` folder beside a changed or new file: domain 145 files, `# tests 1036 # pass 1036 # fail 0`;
    extension 140 files, `# tests 1291 # pass 1291 # fail 0`;
  - domain check exit 0; extension check exit 0; extension build exit 0 ("e2e-chromium: verified 22 files");
  - structure audit `passed (172 warning(s), 118 baselined)`.
- Not verified:
  - Firefox;
  - the real background worker's resend across documents (the e2e spec plays the worker's part);
  - no Lab or provider run; no full suites.
