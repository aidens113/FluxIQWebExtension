# Automatic processing reads a captured-but-absent cell as "not shown", not missing evidence (t993)

Lead: Claude Code session, 2026-11-23. Tier: worker-heavy.
Workspace: `C:/Users/osrs_/FluxStuff/fxwork/t993/!FluxIQ` (Core, task branch) and `t993/!FluxIQWebExtension` (downstream, for the proof only).
Read: this brief; the "Contract and review decisions" paragraph and the U1-U4 rules in the Current State of `docs/working/data-first-simplification-plan.md`; and in Core, `packages/contracts/src/record-sets/process/` (process-rows.ts, cell-text.ts, condition/holds.ts, readiness/*) plus their tests.

Defect, found by t990. In automatic mode, a text, number or date test over an absent or blank cell returns missing evidence, which withholds the whole answer ("Read the named fields…"). This holds even when the row's own read captured that field: the column is part of what the read collected, and this item simply does not show it. Examples are a list where only some items carry an "Easily apply" or "promoted" tag, or some items show no salary. Re-reading cannot produce a value the page does not show, so a natural declaration such as `easilyApply contains "Easily apply"` stalls the task. Meanwhile `is: present` already treats the same absence as a definite no, so the engine is inconsistent.

Lead's decision (the user's rule U2 is "dedupe and clean from upstream data, simply"):
- In automatic mode, an absent or blank cell in a field that the row's own read captured is a definite "not shown":
  - `is: present` → false and `is: absent` → true;
  - every text, number and date test → false;
  - `not` inverts the verdict as it already does;
  - a sort key or output column → an empty value, sorted last.
- Missing evidence stays for:
  - a field the row's read never captured, for example a batch read before the schema grew, or a source whose schema lacks the field;
  - the existing "unreadable" reason (a present value that does not parse). Leave that unchanged.
- Saved (non-automatic) processing semantics are unchanged.

Steps:
1. Find how a row's source batch and its captured fields reach `processAutomationStudioRecordRows`: the `sources` map, the batch's schema, and the feed ledger in `fluxiq/src/framework/automation-service/service/answer-first/result-feed/`. Find how the retained reader writes an absent cell (key omitted, null, or blank). Decide "captured" from data the stage already holds. If it does not hold enough, carry the batch's field list through explicitly. Never infer it from other rows' values.
2. Implement it in the owning module, one exported thing per file.
3. Write tests in the owners' `tests/` folders covering:
   - a captured tag absent on some rows: contains, equals and present each give a definite result, and the answer is ready;
   - a field never captured by one batch: still missing evidence, naming that batch;
   - an unreadable present value: still unreadable;
   - sort and columns over a captured-but-absent value;
   - saved mode unchanged.
   Update any existing test that pinned the old behaviour, citing this brief.
4. Bump `@fluxiq/contracts` and `fluxiq` patch versions if they are published (check `publishConfig`), and say which you bumped.
5. Proof: in the downstream tree, rerun t990's job-board recorded read with a declaration that tests `easilyApply contains "Easily apply"` without `present`. The command and input are in `docs/working/data-first-simplification-plan/reports/t990-recorded-oracle.md`; copy its `test-runs/t990-*` inputs from `C:/Users/osrs_/FluxStuff/fxwork/t990/!FluxIQWebExtension` into this tree's ignored `test-runs/`. Report the verdict. Do not edit t990's tree.

Checks, run through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- <cmd>`, one at a time:
- the touched packages' vitest files with `--maxWorkers=1 --minWorkers=1 --fileParallelism=false`;
- `pnpm --filter @fluxiq/contracts check` and `pnpm --filter fluxiq check`;
- Core `node scripts/structure-audit.mjs`, after `pnpm structure:baseline` only if you removed a violation.
No full suites, no git mutations, no `node -e`, no provider or paid calls. Model guidance never mirrors a realistic scenario.

Owned: the two t993 trees, except `docs/working/data-first-simplification-plan.md` and `docs/working/README.md` in either. Must not touch other worktrees or the shared `fxwork/!FluxIQ`.
Report: `t993/!FluxIQWebExtension/docs/working/data-first-simplification-plan/reports/t993-absent-cell-semantics.md`. End with the return contract.
