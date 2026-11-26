# t1037 (W3), worker `docs`: architecture docs follow framework drafting

## Outcome
Done. Core's authored architecture docs now describe the framework-drafted Flow and the seven edits. Docs only; no source, test, working-doc or AGENTS.md file was touched.

## What changed and why
Core `docs/architecture/automation-studio/flow-authoring.md`:
- New section "The framework drafts the Flow": the `out` reasons table, composition order, the model's word standing (`isRuled`, `drafted`), the result's reads, the seven edits, deleted words, no look command, `core.full_page`, and `core.run_flow` with `run_flow.nothing_to_run`. Cited from `compose/compose.ts`, `compose/framework-step.ts`, `amendment/edits/schema.ts`, `entry.ts`, `node-tools/run/flow.ts`.
- "Recorded" step bullet no longer says `add`; `write implies add` replaced.
- Draft-entry instruction paragraph rewritten to match `FRAMEWORK_INSTRUCTION`.
- Cancelling choices: `exploratory` removed; undone pairs described via `compose/undone.ts`.
- "A Second Copy Of A Step Is Not Added" became "...Is Left Out" (`out: repeat`; later read stays; `keep` of a copy still refused `second_copy`).
- "How one decision's step numbers are read" rewritten: no `to`, `check`, `reorder` or `repeat_taken_off`. Other `reorder` or `add`-with-`to` mentions removed.
- `amend_draft place` and nonexistent-step feedback text corrected.

Core `llm-flow-bootstrap.md`:
- "The model authors the draft" paragraph replaced by "The framework drafts the Flow and the model edits it", with the "history" caveat removed.
- Way-to-a-page paragraph now says `keep` brings the openers (`apply.ts` still calls `automationStudioFlowDraftKeepOpeners`).
- The dry-run `notInFlow` quote now matches `dry-run.ts` line 442.
- Result-group paragraph: "a read outside the draft is a look ... adopted with `take`" replaced by the `result` and `keep` edits and `result-reads.ts`.
- Route `place`, lasting-act `keep or add`, exempt-step lists (`exploratory`, `optional`, `only_if` marks), and the decision-schema `add` property text corrected. Optional is now only the replay's own (`sometimes-present.ts`).

Downstream `docs/architecture/build-loop.md`:
- Repeat form is no longer "legacy".
- `settings` wording removed.
- Second-copy rule now says the later read stays and `out: repeat`.

## Commands run and observed results
- Core `node scripts/structure-audit.mjs` -> `structure-audit: passed (576 warning(s), 902 baselined).`
- Core `node scripts/structure-audit.mjs --rule docs-links` -> passed (0 warnings).
- Core `node scripts/docs-reference.mjs --check` -> `Deterministic framework reference is current.`
- Downstream `node scripts/structure-audit.mjs` -> `passed (264 warning(s), 550 baselined).`
- Downstream `--rule docs-links` -> passed.
- Grep of the old terms (`amend_draft`, `add: true`, `take`, `taken`, `reorder`, `exploratory`, `only_if`, `on_failed`, `transcript`, `find_on_page`, `look`) over both `docs/architecture` trees after the edits.

## Remaining old terms and why (not edited)
- `taken` in `flow-authoring.md` and `llm-flow-bootstrap.md` is the live disposition word (`kept` or `taken` plus `drafted`). `taken` elsewhere is plain English ("is not taken").
- `optional`, `only_if`, `only after:` in script-statement sections (`llm-flow-bootstrap.md` about lines 1505-1540, `flow-authoring.md` "Terminal coverage after optional steps"). They describe the written Flow script, which still has them; only the draft edits were removed.
- `reorder` in unrelated contexts: undo-witness "unexplained reorder" (line 754), choice-order advice (2846), declaration reordering, and the web UI docs.
- `look` in `llm-flow-bootstrap.md` (lines 556-702, 799-871, 1271) and in `failure-control.md`, `client-gateway.md`, `evidence-window.md`. These mean a witness state, a read call, or a loop's "look" in the loop-detection record. Not the deleted command. `llm-flow-bootstrap.md` line 3911 already says there is no look command. I did not rewrite the wording of the loop-detection history in `failure-control.md`.
- `amend_draft` remains correct (the decision kind still exists).
- Downstream `build-loop.md` still describes `legacy` authoring mode. That is a separate setting, not the draft grammar.

## Not verified
- Behaviour was not re-run; every claim was read from source and the `wiring` and `delete-grammar` reports.
- `amendedParameters` (source comment mentions `settings`): I removed the word `settings` from the downstream doc without confirming which edits now feed it.
- Older dated blocks in `llm-flow-bootstrap.md` (4500 lines) may still carry history that mentions deleted edits in passing. I searched by term, not by reading every line.

## Open questions
- `amended-plan-parameters.ts` still says amendments carry `settings`. The comment is stale if `settings` is gone; that is a source file, which I may not touch.
