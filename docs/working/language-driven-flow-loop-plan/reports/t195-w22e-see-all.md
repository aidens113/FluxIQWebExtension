# t195-w22e: a list whose section links to more says so

Worker report for brief t195-w22e. Repository: `C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQWebExtension`, branch `task/t195-live-control-flow`. Nothing committed.

## Outcome

Done. Structure detection now reports `continues: { label, path? }` beside a run when the run's own section has a link or button outside every item, and apart from the run's pagination control, whose whole label is a closed "see/view/show all/more" phrase. The domain wire reader validates the field, and the structure packet carries it with one fixed sentence. Nothing follows the link: the handle's binding keeps no pagination for it.

## What changed and why

- **`apps/extension/src/content/extraction/section-link/`** is a new directory holding `section-link.ts`, the barrel `index.ts`, and `tests/section-link.test.ts`. It exports `sectionContinuation(items, container, paginationControls)`. It is a directory rather than a single file because `extraction/` and `extraction/tests/` already held 25 files each, and the audit's `directory-files` rule failed at 26.
  - **The rule.** The walk starts at the element holding the items and goes outward, at most 6 levels. At each level the "band" is the current element plus some of its siblings:
    - backwards, up to and including the nearest sibling holding a heading (`h1`-`h6` or `role=heading`);
    - forwards, up to the next sibling holding a heading;
    - a sibling holding another run (3 or more children of one `itemTemplateSignature`) ends the band on its side.
  - The walk goes up a level only while the band is the whole of its parent. A band cut by a heading or another run, or one that holds the section's own heading, is the section. On the Friends home, the main column is header, grid, header, grid, so the requests grid gets the first header's "See all" and the suggestions grid gets the second's.
  - **What qualifies.** A control is `a`, `button`, `role=button` or `role=link`. It must sit outside every item and must not be, contain, or sit inside what the run's pagination selector names. Its `aria-label`, or else its text (read through `textOutsideSensitiveControls`), must be wholly a closed phrase.
  - **The path.** A link carries its same-origin `pathname`, at most 256 characters, parsed through `shared/parsed-url.ts` with no `try/catch` (the audit's `failure-as-empty` rule). A button, or a link to another origin, carries no path.
- **`apps/extension/src/content/extraction/detect-structure.ts`**:
  - `detected()` computes `continues` from the items' parent, and passes the run's own pagination control as the exclusion. That control is resolved by mode: `next` uses `next`, `loadMore` uses `control`, `numbered` uses `pages`, and `scroll` has none.
  - `withRecord` now spreads the run, so `continues` (and `infiniteScroll`) survive when a record is attached.
  - Header comment updated.
  - I did not touch `pagination.ts` or `detect-pagination.ts`. Runs get their pagination in `infer-list.ts` through `detect-pagination.ts`, and the hint is deliberately not pagination.
- **`domain/src/extraction/structure-detection.ts`**:
  - New type `WebAutomationSectionContinuation = { label; path? }` and the optional field `continues` on the ok branch.
  - New `webAutomationSectionLinkLabel(label)`. It holds the closed-phrase rule in one place, `^(see|view|show)\s+(all|more)[^\p{L}\p{N}]*$` (case-insensitive), collapses whitespace, and caps the label at 16 characters (`WEB_AUTOMATION_SECTION_LINK_LABEL_MAX_LENGTH`). The extension imports it through `domain/client`, so the producer and the reader cannot disagree about the phrases.
  - The copy keeps only `label` and `path`. The label must equal its normalized closed-phrase form. The path must start with `/`, be at most 256 characters, and contain no whitespace or control characters. A malformed `continues` refuses the whole detection, as a malformed `record` or `infiniteScroll` already does.
- **`domain/src/runtime/llm-evidence/structure/packet.ts`**:
  - New `WebLlmStructureContinues = { label; path?; note }` and `continues?` on `WebLlmRepeatingStructure`.
  - The label passes through `screenedPageText`. The note is the fixed sentence: `this section links to more items ("<label>"); the list here may be partial -- open it to read every item`.
  - The binding is unchanged. I did not add the type to `structure/index.ts`, which I do not own; `WebLlmStructureRecord` is not exported there either.

## Tests added

- **Extension, `section-link/tests/section-link.test.ts`.** Six cases on `FakeElement` stub trees shaped like `renderFriendsHome`:
  - "See all" in the requests header gives `{ label: "See all", path: "/circleway/friends/requests/" }`.
  - Each grid gets its own header's link, and never the next section's.
  - "See all" inside each card gives nothing.
  - "View sent requests" or "See all 8 requests" gives nothing.
  - The run's own "Show more" pagination is not reported. The same button, when it is not the run's pagination, gives `{ label: "Show more" }` with no path.
  - A `<section>` wrapping a heading and a list nested two levels deep is found, and an off-origin "View all ›" carries no path.
- **Domain, `extraction/tests/structure-detection.test.ts`.** Three cases:
  - copy of a valid field, with stray keys dropped;
  - 13 malformed shapes, each refusing the whole detection;
  - the closed-phrase table.
- **Domain, `runtime/llm-evidence/structure/tests/continues.test.ts`** (new). Two cases on `splitDetectedStructure`:
  - the packet carries label, path and note; `pagination` stays `none`; the binding has no `paginate` and no path;
  - a button carries no path, and a detection without `continues` shows none.

## Commands run and observed results

- `node .../scratchpad/run-dir-tests.mjs apps/extension w22e content/extraction/tests content/extraction/single-record/tests content/extraction/section-link/tests` -> exit 0, `tests 225, pass 225, fail 0`. I added the `section-link/tests` path to the brief's command because the test moved there.
- `node .../scratchpad/run-dir-tests.mjs domain w22e extraction/tests runtime/llm-evidence/structure/tests` -> exit 0, `tests 52, pass 52, fail 0`.
- **Revert check**, done once before the directory move. I backed up my files, put back HEAD's `detect-structure.ts` and `packet.ts`, stubbed `sectionContinuation` to return `undefined`, and stubbed `webAutomationSectionLinkLabel` to return `undefined` with the `continues` copy removed. Then I ran the new files:
  - Extension: `pass 2, fail 4`. The 4 positive cases failed. The 2 "nothing to report" cases (link inside an item, no qualifying link) passed, as they must under any rule that reports nothing.
  - Domain: all 5 new cases failed; the 6 existing cases passed.
  - I restored from the backup and confirmed no stub line remains (`grep -c` gave 0 in both files).
- `bash .../heavy.sh "t195-w22e extension check" pnpm --filter @fluxiq-web-extension/extension check` -> exit 0.
- `bash .../heavy.sh "t195-w22e domain check" pnpm --filter @fluxiq-web-extension/domain check` -> exit 2, with one error, not in my files:
  `src/runtime/llm-evidence/node-run/tests/covered-press.test.ts(51,9): error TS2322: Type '{} | { overlays: ... kind: string | undefined; ... }' is not assignable to type 'JsonObject'.` The source `tsc` pass succeeded, since the error comes from the test project. No error names a file I touched.
- `node scripts/structure-audit.mjs`:
  - First run: 4 violations, all mine — a `contract-spread` in `continues.test.ts`, `directory-files` 26/25 on both `extraction/` and `extraction/tests/`, and `failure-as-empty` on the URL `try/catch`.
  - After fixing all four: `structure-audit: passed (154 warning(s), 118 baselined)`, exit 0.

## Not verified

- No browser, Lab or live run, per the brief. The rule ran only on stub trees, not on the real Circleway DOM or real `getClientRects`. I did not check visibility, so a hidden "See all" would still be reported.
- I did not exercise `detect-structure.ts`'s wiring of `continues`: which elements the pagination selectors resolve to, and the items' parent as the section's start. No existing test drives `detectStructure` in a document, so the wiring has only type-checking.
- The heuristic's limits:
  - A header that holds the section heading plus a filter row of 3 or more same-template buttons counts as "holding a run". The band is then cut before the header, and its "See all" is missed.
  - With no headings, a "See all" between two runs is reported for both.
- Full suites were not run, per the brief.

## Open questions or contradictions found

- `domain check` fails on `node-run/tests/covered-press.test.ts:51`, which belongs to another worker or to a Core change in flight. During both extension checks the build cache logged that `core:packages/fluxiq/src` inputs changed while it ran. I did not fix it.
- The brief's command lists `content/extraction/tests`, but the new extension test lives in `content/extraction/section-link/tests` because of the 25-file limit. Add that path when re-running.
