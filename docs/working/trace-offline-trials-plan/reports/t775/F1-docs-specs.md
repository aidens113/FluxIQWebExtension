# t775-F1: docs, spec inventory, and draft headed proofs

## Outcome
Done. Docs written, inventory below, four draft specs plus one helper typecheck clean. Specs were not run (brief).
Nothing committed. The drafts are expected to fail until phase D wires the trial gates.

## What changed and why
Docs (current-state design, with one line saying the trial-gate wiring is pending):
- Core `docs/architecture/automation-studio/llm-flow-bootstrap.md`: new section "A trial is judged by the change, not by a clean start (t775)" before "The site is put back before each trial". It covers before/after per witness and the `siteChange` packet, the typed effect (`change`, `end_state`, `unchanged`), the five proofs, targeted resets (`candidate.trial_starts_in_end_state`), idempotent toggles (`web.dom.check`, `ensureState`, `candidate.toggle_not_idempotent`), no automatic cleanup and "Put it back" on request, what retires and what stays. A supersession note was added under the old heading.
- Downstream `docs/architecture/testing-facility.md`: the candidate-mode bullet no longer says the model must put the site back before every trial; a new paragraph "Acceptance keeps its own fixture reset (t775)" names `flow-lane/creation/lane.ts` and `saved-flow-replay/replay-saved-flow.ts`, oracles unchanged.
- Downstream `docs/architecture/web-capabilities.md`: new bullet for the press answer `toggle` and the click node's `ensureState` / `skipped: "already_in_state"`.

New files under `apps/extension/e2e/site-reset/` (no existing file edited; `index.ts` untouched, specs import the helper directly):
- `change-proof.ts`: `RETIRED_RESET_CODES`, `retiredCodesIn`, `siteChangeIn`, `judgeLog` (captures the judge requests through the scripted provider's existing `verify` hook), `actsWithOutcome`, `proofsOf`, `supervisorWithEffect` (default scripted supervisor with a typed `effect` and `unchanged`).
- `tests/judged-change-add-to-cart.spec.ts` (everything-store, two trials, cart line moves, no reset).
- `tests/judged-change-save-then-read.spec.ts` (job-board; second trial's save skipped `already_in_state`).
- `tests/judged-change-like-loop.spec.ts` (photo-social; `newest` variant proof `carried`, `pinned` variant `already_in_state` act with its row).
- `tests/judged-change-address-carried.spec.ts` (everything-store office; address already set by exploration, proof `carried`, no undo).
Each starts with the one-line DRAFT header and asserts `retiredCodesIn(...) == []` plus a `siteChange` on the judge request.

## Inventory of existing specs in `apps/extension/e2e/site-reset/tests/`
Retired codes asserted directly (must be rewritten):
| Spec | Retired code asserted | Assert instead |
| --- | --- | --- |
| installed-project.spec.ts:207 | `candidate.create_baseline_required` on an unnamed Add (exploration) | The exploration press is admitted with no list read first (`ok`, consequence declared); the ref is still issued by the domain answer. |
| installed-project.spec.ts:236 | `candidate.trial_reset_required` on `trial.dirty` | The trial with the added line in place runs (verdict `yes`), no reset code; judge request `siteChange` shows the cart change, the left act under `leftFromEarlier`. The later undo flow (line 265 `candidate.undo_unproved`) stays only if kept as a "Put it back" / targeted-reset proof. |
| job-failed-save.spec.ts:133 | `candidate.reset_witness_required` on a save with no ref | The unnamed save is admitted at exploration. `candidate.trial_step_unwitnessed` (stays) is asserted at submission if the step names no witness. The undo half (`undo_unproved`, `subject_there_before`) stays as targeted-reset coverage. |
| office-address-confirm.spec.ts:22,160 | `candidate.trial_reset_required` only in comment and message; asserts two `yes` trials | Keep the `yes` trials; drop the looksBefore/`startedWith` "settled unchanged" assertions; assert `siteChange` on both judge requests, no retired code in the log. |
| office-site-reverted-toggle.spec.ts:175 | `["candidate.trial_reset_required", "candidate.trial_reset_unproved"]` not trial code | Replace with `retiredCodesIn(log) == []`; the `undo_already_back` check (line 164) stays. |
| photo-dialog-destination.spec.ts:226 | same pair, not trial code | Same replacement. |
| photo-dialog-step.spec.ts:200,211 | `tests[1]` code is `candidate.trial_reset_required` listing the trial's act | The second trial is admitted and judged (`yes`), the first trial's act appears under `siteChange.leftFromEarlier`; drop the `actsToUndo` assertions on it. Line 211 pair replaced by `retiredCodesIn`. |
| photo-toggle.spec.ts:185,213,229 | `tests[0]` and `tests[2]` code `candidate.trial_reset_required` with a control `settle`; line 229 the pair not code | Trial 1 runs on the explored like in place with the like step carrying `ensureState` (skipped `already_in_state` or changed), verdict `yes`, `siteChange` present. The undo-other-post refusal (line 191, `undo_unproved`) stays as targeted-reset coverage. |

Retired mechanisms asserted indirectly (gate-driven flows that the gate no longer forces):
- photo-dialog-act.spec.ts and office-navigating-press.spec.ts: the builder loops `actsToUndo` -> `undoes`, `cannotUndo`, and asserts `actsUnsettleable` / `gate_unsatisfiable` (`acts_unsettleable`). Replace with: an act no call can settle never refuses a trial; it is reported under `leftFromEarlier` and the part is `unproven`. The `reread`/`done` branches on `actsToUndo` go away.
- job-unexplored-step.spec.ts: `actsToUndo` for `save.explored` and `undoes` presses. Keep `candidate.trial_step_unwitnessed` (stays); the undo-then-retest part becomes "trial runs with the save in place".
- office-buy-now, office-cross-brief, office-read-after-change, repair-first, photo-page-order-limit: assert only `yes` or `startedWith` acts (buy-now, cross-brief read `startedWithActs`). Rework `startedWith.cannotUndo` assertions to `siteChange.leftFromEarlier`; no retired code is asserted.
- `trial_start_differs`, `completion_reset_first`, `project.trial_reset_required`, `trial_reset_unproved`: asserted nowhere directly except the two pair assertions above. `completion_reset_first` appears in none; add `retiredCodesIn` to the supervisor-level specs (office-cross-brief, repair-first) so a returning code fails them.

## Commands run and observed results
- `npx tsc -p tsconfig.test.json --noEmit` in `apps/extension` (includes `e2e/**/*.ts`): no output, exit clean, after all four specs and the helper were written.
- Core `pnpm docs:check` and downstream `pnpm docs:check`: see the Acceptance lines below (run after the docs were written).

## Not verified
- None of the four specs has run headed; scenario details (the pinned post being likeable in the same dialog flow, the My jobs list detection field, the saved-list size threshold, the cart witness `change` shape) are inferred from the existing specs and the design, not observed.
- The `siteChange` JSON shape is read from the design and phase B's report (`witnesses[].change`, `acts[].outcome/row`, `proofs[].proof`, `leftFromEarlier`); phase C may differ, and `change-proof.ts` is the single place to adjust.
- `supervisorWithEffect` assumes `project.write_plan` accepts `part.effect` and `taskSpec.unchanged` as phase A defined.
- Structure audit of the new files: see below.

## Open questions or contradictions found
- Phase E-core: `toggle` is read from the execution result's `outputs`, the domain puts it on the node outcome; unresolved by this task but it decides whether the like-loop and save-then-read drafts can ever skip `already_in_state`.
- I did not add `change-proof.ts` to the directory barrel `index.ts` (existing file, not owned); the structure audit's barrel rule may ask for it. The lead can add one line.

## Acceptance results (observed, after the last edit)
- Downstream `pnpm docs:check` does not exist (`ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL ... "docs:check" not found`); the docs link check is `node scripts/structure-audit.mjs --rule docs-links` -> "structure-audit: passed (0 warning(s), 0 baselined)."
- Core `pnpm docs:check` -> FAILS at its second half: "docs/reference/framework-reference.md is stale: the public surface changed. Run `pnpm docs:reference`". Not caused by my docs (the first half, `--rule docs-links`, passes: "structure-audit: passed (0 warning(s), 0 baselined)"); the public surface changed because other t775 Core workers added exports (trial-change module, toggle code). Needs `pnpm docs:reference` once Core code settles (supervisor's step; it edits a generated file I do not own).
- `npx tsc -p tsconfig.test.json --noEmit` in apps/extension -> no output (clean), re-run after the statement-packing fixes.
- Downstream `node scripts/structure-audit.mjs` -> "structure-audit: passed (229 warning(s), 616 baselined)." (first run had 3 statement-packing FAILs in my new files; fixed.)
