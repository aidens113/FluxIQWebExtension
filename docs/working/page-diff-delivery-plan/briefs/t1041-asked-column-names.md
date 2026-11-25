# Brief t1041: the answer's columns carry the asked names

**Goal.** In the scripted bigbox run `run-mww1qgyl-bf8909a0` the task asked for "columns name, price and
rating". The model read `fields {name: "link_text", price: "price", rating: "number_2"}`, and the rows were
right, but the table shown to the person and the CSV export are headed `link_text | price | number_2`. Core
defines a field's `label` as the "Human-readable column name, used as the CSV header". The person must see
the names the model gave.

**Cause (diagnosed; read it first):** `docs/working/page-diff-delivery-plan/reports/t1036/h-column-names-diagnosis.md`
(in the t1036 tree until t1036 merges; on `dev` after). In short:
- `domain/src/runtime/llm-evidence/plan-resolution/extraction/retained-schema.ts` gives a renamed column the
  detected column's stored label, the site's word, as its `label`, and the model's name as its `id`.
- `retained-output.ts` drops the model's own `label`.
- Core and the answer view only pass `{id, label}` through.
- The behaviour dates from t982 (2026-11-22) and t997 (2026-11-23). t997 kept the site word in the label so
  Core could match a site key by label.

**Do.**
1. `retained-schema.ts`: a column that `fields` renames takes the plan's own name as its label (the model's
   label if it wrote one, else the id). An unrenamed column keeps its page words or readable name. Labels stay
   unique.
2. `retained-output.ts`: keep the model's label for an id it declared, by the same rule.
3. Move t997's site-name matching out of the label and into the domain's existing name rewrite
   (`output-nodes/extract-list/stored-columns.ts` via `webPlanStoredColumns`). A detected key or readable name of
   a renamed column then resolves to the plan's key before Core sees it. Check `column-match.ts` first, since it
   may already do this; never keep two copies of the matching.
4. A saved Flow step holding the old labels re-resolves to the new ones when it is read
   (`saved-list` path), so already-saved Flows show the asked names too.
5. Update the t997 paragraph in `docs/architecture/retained-extraction.md` and the comment in
   `structure/stored-label.ts`: the label is the human column name; site-word matching lives in the name
   rewrite. Record it as the lead's decision (2026-11-25), which reverses t997 to match Core's `label` contract.

**Tests (beside their subjects):**
- `retained-labels.test.ts`: this run's shape gives labels `name`, `price`, `rating`, and the existing
  `plus` test expects label `plus`.
- `stored-columns.test.ts`: a `process` naming `number_2` resolves to `rating`, and Core's
  `bindAutomationStudioRecordProcessing` accepts it.
- `saved-list.test.ts`: a saved step with the old labels re-resolves.
- Then one provider-free scripted bigbox run (lab slot 4, headed, with the watcher, `--attempts 4`). Every
  `attempt-N/answer-turn.json` must have columns `["name", "price", "rating"]` and the oracle must still pass. Open
  `attempt-1/flow.png` and confirm the OUTPUT headers.

**Owned paths.** The domain files above and their tests; `docs/architecture/retained-extraction.md`.
**Must not touch.** FluxIQ Core; `domain/src/runtime/llm-evidence/structure/detect.ts`, `rejection-next/**`,
`node-run/press*` (another lane); the scripted model (`packages/test-runner/src/attempt-lane/scripted-model/**`),
unless the run proves the script itself must change, and then say why. No git, no paid runs, no `node -e`.

**Checks.** In `domain/`: `DOMAIN_TEST_BUILD_LABEL=t1041 node scripts/test-domain.mjs llm-evidence output-nodes
actions/extraction extraction runtime/tests`; then `pnpm --filter @fluxiq-web-extension/domain check`,
`node scripts/structure-audit.mjs` and `node scripts/check/model-text.mjs`. Heavy steps go through
`node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t1041 -- <cmd>`.

**Report.** `docs/working/page-diff-delivery-plan/reports/t1041.md`, ending with the return contract.
