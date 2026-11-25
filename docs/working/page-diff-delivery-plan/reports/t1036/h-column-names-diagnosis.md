# h: why the answer heads its columns link_text, price, number_2 (diagnosis)

Read-only. Run: `test-runs/instances/t1036-lab/attempts/run-mww1qgyl-bf8909a0`.

## Outcome

Found the cause, and it is in the extension's domain, not in Core. When the model renames a detected column, `domain/src/runtime/llm-evidence/plan-resolution/extraction/retained-schema.ts` gives the stored record field the model's name as its `id` and the site's name as its `label`. Core treats `label` as the human column name ("Human-readable column name, used as the CSV header", `packages/contracts/src/record-sets/schema.ts`), and the answer turn heads each column with it. The asked names survive as ids and in `process.columns`, but they never reach the header. This did not start with t1038: it dates from t982 (2026-11-22) and was made deliberate in t997 (2026-11-23). t1038 only changed which site word appears.

## Trace of one row (rating)

1. **The read call** (`steps/0018-.../call.json`): `fields: {name: "link_text", price: "price", rating: "number_2", ...}`. The model's `recordOutput.schema` gives `{id: "rating", label: "rating"}`.
2. **The read result** (`0018/result.json`, `read.firstRows`): rows keyed `name`, `price`, `rating` ("4.9"). The asked names are correct here.
3. **Plan resolution** (domain):
   - `resolveWebExtractionSlot` (`slot.ts`) keeps `rating` with source `div_css-0bayf6v_span_css-06pchqu_number`.
   - `webPlanRetainedExtractionSchema` (`retained-schema.ts`) takes `metadata.label`. That is the detected key, so the t1038 line `readable = binding.names[source]` replaces it with `"number_2"`. Result: `{id: "rating", label: "number_2"}`.
   - `webPlanRetainedRecordOutput` (`retained-output.ts`) then rebuilds the schema from those labels and drops the model's own `label: "rating"`. It sets `process.columns` to `["name", "price", "rating"]`.
4. **The saved Flow step** (`0026-.../call.json`, `recordOutput`): `{id: "name", label: "link_text"}`, `{id: "rating", label: "number_2"}`, and `process.columns` is `["name", "price", "rating"]`. Other fields show the same rule. For example, `image_src` keeps its page label `div.css-037tdj9 > img.css-1lxw2mb src`.
5. **Core's result** carries `{id, label}` from the stored schema without changing it:
   - `answer-first/rows/processed-rows.ts` picks `process.columns` by id and keeps each field's `label`;
   - `rows/row-sink.ts` does the same;
   - `attempt/keep.ts` copies `rows.columns` into the task result.
6. **The answer view**: Core's `ui-components/src/chat/answer/model/rows-model.ts` maps `columns: rows.columns.map((column) => column.label)`, and `view/rows-table.ts` writes those as the `<th>` cells. The cells are read by `column.id`, which is why the values are correct. The Lab copies the `<th>` text into `answer-turn.json` (`packages/test-runner/src/attempt-lane/live/answer-turn-dom.ts`), giving `["link_text", "price", "number_2"]`.

The names are lost at step 3, in `retained-schema.ts`, and the lost authored labels in `retained-output.ts` add to it. Nothing after that point is wrong: Core shows the `label` it was given.

`answer-first/completion/result-columns.ts` plays no part. It only words a refusal, and it reads `column.id`.

## New with t1038? No, older

| When | Commit | What it did | What this run's header would have been |
| --- | --- | --- | --- |
| 2026-11-22 | `ba64bbf1c` (t982) | Introduced `webPlanRetainedExtractionSchema` and `webPlanRetainedRecordOutput`. The stored schema replaced the author's, with `label: metadata?.label ?? id` | The detection's stored label, which was then sample-built (a page value) |
| 2026-11-23 | `652be0bb4` (t997) | Decided that a renamed column's "label is still the site's", so that a Core declaration can bind the site key by label (`bind.ts`: exact id, then a unique label). `stored-label.ts` says outright that "an answer heads its column with it" | The class-path key, `a_css-0yntmso_span_css-0ek4plr` |
| 2026-11-25 | `21a36692e` (t1038) | Replaced a class-path label with the readable name | `link_text`, `number_2` |

Before t982 the author's schema labels reached the dispatch (`reconciled-record-output.ts` keeps them). I did not confirm that against a run from before 2026-11-22.

## Root cause

The domain uses one field, `label`, for two jobs: the person's column name (Core's contract), and an alias so that Core can bind site words. For a renamed column the alias wins, so the person sees the site's word instead of the name they asked for.

## Proposed fix (domain only; Core and `result-columns.ts` are untouched)

1. **`plan-resolution/extraction/retained-schema.ts`**: when `fields` gives a column a name of the plan's own, that differs from the detected key and the readable name, label the field by that name. Use the model's authored label for that id if it wrote one, otherwise the id.
   - A column that is not renamed keeps today's label: the page's words, or the readable name.
   - Keep `webLlmUniqueStoredLabels`, so no label folds to another field's id.
2. **`plan-resolution/extraction/retained-output.ts`**: stop discarding the authored `schema.fields[].label` for an id the author declared. Apply the same rule as step 1, so the two readers agree.
3. **Binding site words, the job t997 gave the label.** Move it to the domain, which already rewrites record-output names to the read's columns:
   - `output-nodes/extract-list/stored-columns.ts`, reached through `plan-resolution/extraction/stored-columns.ts` `webPlanStoredColumns`, at both submit and dispatch.
   - Add a strict reading, before any guess: a detected key or readable name (`extractionBinding.names`) of a column the read keeps under the plan's key resolves to that key.
   - Core then binds by id, and no Core change is needed.
   - Before adding this, check whether `column-match.ts` already resolves it. It is not certain.
4. **Docs**: update the t997 paragraph in `docs/architecture/retained-extraction.md` and the comment in `structure/stored-label.ts`.

A saved Flow re-resolves its read on replay (`heldByHost` through `resolveWebExtractionSlot`), so saved steps should pick up the new labels. A test below confirms this. Datasets Core has already stored keep their old labels.

## Tests that prove it

- **`plan-resolution/extraction/tests/retained-labels.test.ts`**:
  - Change "a renamed column keeps the site's label": `plus` for `brightaisle_plus` is now labelled `plus`.
  - Add this run's shape: detected names `link_text`, `price`, `number_2` with `fields {name: "link_text", price: "price", rating: "number_2"}`. Expect labels `name`, `price`, `rating` and `process.columns` `[name, price, rating]`.
  - A column that is not renamed keeps its page words.
  - Labels stay unique when a plan key matches another column's label.
- **`plan-resolution/extraction/tests/stored-columns.test.ts`** (or the `output-nodes/extract-list/tests` sibling): a `process` naming `number_2` (sort or where), after the rename to `rating`, resolves to `rating` and is accepted by Core's `bindAutomationStudioRecordProcessing`. This replaces t997's bind-by-label test.
- **`plan-resolution/extraction/tests/saved-list.test.ts`**: a saved step holding the old `label: "link_text"` re-resolves to `name`.
- **Proof on the real path, provider-free**: rerun the scripted bigbox check. `attempt-*/answer-turn.json` `columns` should be `["name", "price", "rating"]` in all four attempts, and the oracle should still pass.

## Commands run and observed results

Read-only: `ls`, `grep`, `head` and `sed` over the run folder and both trees, plus `git log` and `git show` (`-S` and `--follow` on `retained-schema.ts` and `resolve-plan-node.ts`). Each claim above quotes a file or a step folder I read. No tests, Lab runs or builds were run.

## Not verified

- I did not run anything, and the proposed tests do not exist yet.
- Whether `column-match.ts` already binds a site name to a renamed key.
- That runs from before t982 showed the author's labels.
- How the oracle passed despite the wrong headers. `oracle.json` holds only a digest, so I assume it compares rows by value or id.
- That a re-resolved saved step replaces its stored labels.

## Open questions or contradictions

- The t997 brief's decision, that a renamed column's label is the site key, conflicts with Core's contract that `label` is the human column name. The fix changes that decision. The lead should record the change and point to this report.
