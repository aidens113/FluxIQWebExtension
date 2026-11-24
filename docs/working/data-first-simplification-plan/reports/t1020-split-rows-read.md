# t1020 report: split-rows read (run-mwuuo3zk-75b482b3)

Worker: Claude Code worker-heavy (Opus 5.5). Trees: downstream `fxwork/t1020/!FluxIQWebExtension` and Core `fxwork/t1020/!FluxIQ`. **Core was not edited**: none of the causes is in Core. No git, no live or paid run.

## Outcome

Done. Three causes traced from the recorded steps and fixed downstream, each with a test that fails without the fix. One of the lead's premises was a misreading, and it is corrected below. The run's debug is written.

## The premise, corrected

- **The rows were not split.** The step 235 `readRows.rows` that show one field per row are Core's labels for the judge: one naming column per row (`packages/fluxiq/src/runtime/result-verification/build-test/read-rows.ts`). The same read at step 70 returned 16 rows, each with name, url and price. One row, the card's second link, had a blank name.
- **`extraction.18` was not the list.** It was made at step 68 (target `t1446`, the results page with Pickup applied) as the detection's `cells`, offered beside the card list `extraction.17`. All 17 answered detections in the run offered that pair, and the card list always had the rating and fulfilment columns. Step 174's `extraction.27` was the same card list again, not a new finding.
- The read was accepted because as a read it was valid. Its unit of item was wrong (one row per link) and it lacked columns, because the model picked the cells handle.

## What changed and why

1. **Content script: no cells for a card list's own links** (`apps/extension/src/content/extraction/cell-run/grid-cells.ts`).
   - Cause: a control kind counted as a grid if any one group held two of it side by side. Each card has its title link as a direct child. The one card with an Options link (the other cards have an Add button) holds two links side by side. So 15 title links plus 1 Options link became a 16-row "grid".
   - Side effect of that cause: the cells' heading column became the card's first full text column outside the links, which was the price (`cell-fields.ts`, unchanged).
   - Fix: a kind is a grid only when at least half of the groups that hold it hold two or more side by side.
   - Test: `cell-run/tests/cell-run.test.ts` (+3 tests). A rental-card grid built like the recorded page is no grid, and still reads one row per card with link, name, price, rating and pickup columns. Days with one showing each except one are no grid. Days that mostly repeat still are. The existing cinema grid is unchanged.
2. **A read refused for a column is told which name and where such keys belong** (`domain/src/runtime/llm-evidence/node-run/refusal-detail/refusal-detail.ts`, `node-run/run.ts`, one argument, `rejection-next/unknown-column.ts` new, `rejection-next/next-sentence.ts`, `rejection-next/index.ts`).
   - Cause: step 15 read the list `extraction.1` with two of the cells' keys (`span_css-0ek4plr`, `item_url`). It was refused `column_not_in_detected_list` with codes alone (`web.handle.unknown_field:extractList.fields.1` and the handle shapes) and no `next`. Step 63 repeated the mistake.
   - The resolver's `issues: [{code, field, valid}]` held the name it could not find, and `run.ts` dropped them.
   - After that the model moved to the cells handle, where those keys were accepted (step 23 `extraction.6`, step 69 `extraction.18`), and kept that read for the rest of the run.
   - Fix: each refused name that is a key rides in `instead` as `web.handle.unknown_column.<name>`, so a repeat re-derives the same `next`. The `next` names the key and says it is not a column of the list this read's handle names. It also says a read takes only the keys under its own handle's fields, and that a key under cells or record belongs to their own handle.
   - The list's columns are not repeated in the refusal, because a detail carries no page-derived words (`tool-rejection.ts` header).
3. **Every detection packet says how its handle is read** (`domain/src/runtime/llm-evidence/structure/packet.ts`, `readNote`).
   - Cause: the packet had notes for next page, cells, `at` and marks, and nothing on which keys go with which handle, or on how a new read takes the place of a draft's read.
   - Fix: `readNote` is built around the handle. It says to name the handle in `extractList` with `{your name: key}` and keys from its own fields, that a key under cells or record needs their handle, and that a read the draft holds is replaced by running the new read as a step and dropping the old read step.
   - `detect.test.ts`'s allowed packet keys gained `readNote`.
   - Test: `domain/src/runtime/llm-evidence/tests/read-columns/tests/split-rows-read.test.ts`.
     - It builds a synthetic structure in the recorded shape: a rental catalog, no recorded page data.
     - The packet's `readNote` names the handle and contains no page word.
     - Step 15's call shape is refused with `next` naming `` `item_url` ``, and the repeat (`repeatedAnswer: 2`) says the same.
     - The list's own keys read `div.grid > div.tile` as the row with all five columns.
   - With the old `run.ts` argument, the same test gets the recording's exact codes-only refusal: `["web.handle.unknown_field","web.handle.expected.extract_list.handle_fields","web.handle.unknown_field:extractList.fields.0", <shapes>]`.

The brief also asked whether any refusal blocked a correct replacement. None did, because no replacement was ever tried. A same-round rerun that changes a read's handle merges over the step's shown `input`, which holds no `extractionBinding`, and it runs. I checked this with a scratch domain probe, `t1020-probe.test.ts`, and deleted it afterwards.

Debug written: `docs/working/language-driven-flow-loop-plan/debugs/run-mwuuo3zk-75b482b3.md`.

## Commands run and observed results

- `DOMAIN_TEST_BUILD_LABEL=t1020 pnpm test llm-evidence/tests/split-rows-read` -> `# pass 3 # fail 0`. With the `run.ts` fix reverted temporarily -> `not ok 2`, error showing the codes-only `instead` above. Restored, and grep confirmed the line.
- `EXTENSION_TEST_BUILD_LABEL=t1020 node scripts/test-extension.mjs cell-run` -> `# pass 7 # fail 0`. With the old `isGrid` rule restored temporarily -> `not ok 3` (tool cards) and `not ok 5` (sparse days), `# pass 5 # fail 2`. Restored.
- `EXTENSION_TEST_BUILD_LABEL=t1020 node scripts/test-extension.mjs content/extraction` -> `# tests 553 # pass 553 # fail 0`.
- First run of `DOMAIN_TEST_BUILD_LABEL=t1020 pnpm test llm-evidence/structure/ llm-evidence/rejection-next/ llm-evidence/tests/ llm-evidence/node-run/ llm-evidence/plan-resolution/extraction/ llm-evidence/harness-options/` -> `# tests 1049 # pass 1044 # fail 5`. All five were in `structure/tests/detect.test.ts`, whose allowed packet keys lacked `readNote`. After adding it, `pnpm test structure/tests/detect.test read-columns` -> `# tests 19 # pass 19 # fail 0`. The rerun of the whole set is in the next bullet.
- Re-run of the same set, test moved: `# tests 1049 # pass 1049 # fail 0`; then `pnpm --filter @fluxiq-web-extension/domain check` -> `check exit 0`.
- `pnpm --filter @fluxiq-web-extension/extension check` -> `ext exit 0` (domain:build built, browser-host:build restored, extension:check built).
- `pnpm --filter @fluxiq-web-extension/domain check` -> first run `exit 0`, with "inputs changed while it ran" because I moved the test file during it. The rerun after the move is in the bullet above.
- `node scripts/structure-audit.mjs` (downstream) -> first `FAIL [directory-files] domain/src/runtime/llm-evidence/tests/: 26 source files exceeds the 25-file limit`. Moved the test to `tests/read-columns/tests/` -> `structure-audit: passed (259 warning(s), 551 baselined)`.
- `node scripts/structure-audit.mjs` (Core) -> `structure-audit: passed (571 warning(s), 903 baselined)`. Core has no changes.
- `pnpm --filter fluxiq check`: not run, because Core is unchanged.

## Not verified

- No Lab or browser run. Detection on the real bigbox page with the new grid rule was not exercised in a browser; the content-harness Playwright spec was not run. The proof is the unit test on markup built like the fixture's tile (`apps/scenario-lab/src/scenarios/bigbox-retail/listing/tile.ts`).
- `pnpm lab recorded-read` was not used. Its trace-store inputs were not assembled for this run, so the domain test stands in for it.
- Whether Haiku, given the clear refusal and `readNote`, reads the card list and goes on to add to the cart and read the cart. That needs the relaunch.

## Open questions or contradictions found

- The lead's finding 1 (rows each hold one field) is a misreading of Core's `readRows` labels; see above. A model could misread them the same way: the replay's model-facing answer gives `readRows.rows` without saying they are labels. This model did not misread them, so I left Core alone. If the lead wants it, the fix is a one-line note in Core's replay answer.
- A held Flow's rerun (attempt 2 onward) that changes a read's handle probably resolves against the step's saved `extractionBinding` (the old list) when the new handle reads the same item, or is refused `malformed` at `extractionBinding` when it reads another item (`plan-resolution/extraction/slot.ts`, `held-literals`). This run never reached that path and it was not tested. It is worth its own check before a re-author depends on replacing a read.
- `readNote` advises "run this read as a new step and drop the old read step" rather than a rerun with a new handle. A rerun's merge patch keeps the old step's field names that the model leaves out of `fields`, which would then be refused (now told clearly).
