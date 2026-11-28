# t1096-pager: a press on a list's Next is a page turn

## Outcome

Done, for both pieces, on the exploring path (`node-run/run.ts`). Test replays (`replay.ts`) are unchanged, as the brief required.

## What changed and why

- **The lookup** is in `structure/handles.ts`: `WebLlmExtractionHandles.pagedBy(scope, selector, frameId)`.
  - It returns the item selectors of the lists retained for this project and Flow whose detected pagination is a `next` control equal to `selector`, in the same frame.
  - It only matches a `next` control. Load more, scrolling and numbered pages are not counted.
  - Each item appears once, most recent detection first.
  - It works because the detection's `paginate.next` and a capture element's `selector` both come from the extension's `selectorFor`, so a click resolved from the page-view handle carries the same string.
- **`node-run/list-pages/turned-lists.ts`** (new): `webNodeTurnedLists(run, actionType, parameters)` gives the lists a command turns.
  - For `web.dom.next_page`, it is `nextPage.item`.
  - For `web.dom.click`, it is `pagedBy(selector, browserFrameId)`.
  - For anything else, it is nothing.
- **`run.ts`** sets `record.turns` from the dispatched parameters just before the command goes out. The record is already the dispatch's `noted`.
- **`retries/dispatch.ts`**: `noted.turns` is passed to the page check as `pager`.
- **`retries/page-effect.ts`**: the second parameter is now `{ actionType, pager? }`.
  - A page turn is `next_page` or `pager: true`. Only a page turn can be judged `not_landed`, and only under the same rule as before (page answered, same address, same current marks, same non-empty rows).
  - Every other press keeps today's rule: a change proves it landed, and no change proves nothing.
- **`retries/page-move.ts`** (new): the comparison moved here unchanged from page-effect.ts, as `webNodePageMove(found, after, pageTurn)`, so run.ts can reuse it.
- **Piece B**: `list-pages/list-pages.ts` gains `turned(items)`, which feeds the same memory `pagerAnswered` writes and `wasMoved` (t1022) reads. `list-pages/turn-landed.ts` (new) calls it. `run.ts` calls that module once, after the look after the act. A list is recorded as moved when:
  - the act's lost answer was settled `lastingAct: "landed"` by the page check (next_page or pager press); or
  - (beyond the brief, same defect) a pager press answered `succeeded` whose page moved by the page-move rule. Without this, a click on Next that answered normally on a site paged by path had its next read refused just the same.
- **`node-run/call-record/`** (new): the `WebNodeCallRecord` type, moved out of run.ts unchanged except for the new `turns` field.
  - My lines took run.ts to 811, past the audit's 800-line limit. The audit forbids packing lines to fit, and node-run's root already holds 25 files, so the type went into a subfolder. run.ts is now 758 lines.
- **Tests**:
  - `structure/tests/handles.test.ts`: one test covering scope, frame, `next` only, order and dedupe.
  - `retries/tests/page-effect.test.ts`: 2 new tests, and the existing calls updated to the object form.
  - `node-run/tests/pager-press/tests/pager-press.test.ts` (new, 5 end-to-end tests). It uses a synthetic shelf: the captured `product-catalog-largest` detection, page 1 at `/catalog`, page 2 at `/catalog/page/2`. No recording text is used.
    - A press on Next with a lost answer whose page turned: sent once, then the read on /page/2 succeeds.
    - The same press with the page unchanged: `not_landed`, so it is pressed again. The second press lands, and the read succeeds.
    - A lost press on an unrelated control with the page unchanged: uncertain, sent once.
    - A next_page with a lost answer whose page turned: the read on /page/2 succeeds.
    - Control: the list reached on /page/2 with no recorded turn is still refused `list_not_on_page`.

## Commands run and observed results

All commands ran through `heavy-slot.mjs run t1096-pager`, from `domain/`, with `DOMAIN_TEST_BUILD_LABEL=t1096-pager`.

- `node scripts/test-domain.mjs node-run/retries/tests/page-effect node-run/tests/pager-press structure/tests/handles`: `# tests 25 / # pass 25 / # fail 0`.
- Mutation checks on run.ts (restored afterwards, and `diff -q` against the backup was clean):
  - With the `turned` call disabled, 3 of the 5 pager-press tests failed: both reads after a Next press and the next_page read.
  - With pager turns blanked for clicks, 2 of the 5 failed: the read after the lost press, and the "pressed again" test.
- Before the call-record and turn-landed refactor:
  - `node scripts/test-domain.mjs node-run/retries node-run/list-pages`: `# tests 98 / # pass 98 / # fail 0`.
  - `structure/tests node-run/tests plan-resolution/extraction/tests/list-stands plan-resolution/tests/next-page output-nodes/next-page llm-evidence/tests/page-refusal frozen-execution/tests`: `# tests 457 / # pass 457 / # fail 0`.
- On the final code:
  - `node scripts/test-domain.mjs node-run/retries node-run/list-pages node-run/tests/pager-press structure/tests/handles`: `# tests 109 / # pass 109 / # fail 0`.
  - `node scripts/test-domain.mjs node-run/tests plan-resolution/extraction/tests/list-stands frozen-execution/tests`: `# tests 350 / # pass 350 / # fail 0`.
  - `npx tsc -p tsconfig.json --noEmit`: exit 0.
  - `npx tsc -p tsconfig.test.json --noEmit`: exit 0.
  - `node scripts/structure-audit.mjs`: `structure-audit: passed (265 warning(s), 550 baselined)`. The only warning on my files is run.ts at 758 lines, past the 400-line advisory threshold.
  - `node scripts/check/model-text.mjs`: `model-text: ok (202 scenario tokens, 577 model-facing Core files, 14403 string literals)`.

## Not verified

- No live or browser run.
- The recording does not show whether the eldorado detection's `next` selector equals `t2770`'s capture selector. The packets carry no selectors, so the 0047 case is proven on synthetic pages only.
  - If a site's detected Next selector differs from the capture's (for example, the detection chose a `rel=next` link while the model pressed a different Next button), the press keeps today's rule: landed on a change, uncertain otherwise.
- The remaining risk is the same one the effect report names. A slow single-page list that re-renders only after the act's timeout and one capture would read as `not_landed` and be pressed again. For a click this is more exposed than for next_page, because a click does not wait for the list to move.
  - In practice, a lost answer means a reload, which captureAfterAction waits out, or a timeout, by which time a long interval has passed.
- Replay (test runs) does not pass `turns`, so a pager press there keeps the generic rule and records no move.

## Open questions or contradictions found

1. Replay: `replay.ts` would need `turns: webNodeTurnedLists(run, node.actionType, ran)` beside its `{ found: before }`, and a `webNodeListsTurned` call, to match the exploring path. replay.ts is outside my paths.
2. The answered-press recording in Piece B goes beyond the brief's wording. It is in `list-pages/turn-landed.ts` (`answeredPress`) and is one argument to drop if the supervisor wants it out.
