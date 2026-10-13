# t530 completion and retained-learning projections

Status: implemented; worker checks passed; supervisor verification pending.
Owner: codex-t516
Last updated: 2026-10-13

## Change

Completion copy preserves the actual run ending and reports retention from the server's durable-behavior flag. Explicit false remains false; a missing flag remains unknown even when a referenced adaptation is currently applied. Exact historical counts are omitted because current adaptation IDs/statuses do not establish them.

Core chat names a kept patch or handler only when the durable flag is true and a readable applied adaptation carries an applied automatic approval decision for this same run. It reuses Core's existing decision helper rather than copying persistence policy. Proposed, validated, rejected, unfinished, inactive and unreadable changes have distinct current-status wording. Failed/cancelled endings retain their outcome and use generic retention wording without extra adaptation reads. Re-author copy describes only the rewritten steps, avoiding a claim that every other change was discarded.

Core web detail metrics and headline use the authoritative summary flag, preserving unknown instead of interpreting missing as false. Extension detail/reopen projections cannot override false or unknown using current statuses; copy gives generic kept/unkept/unknown wording rather than guessed page-variation counts or blanket ongoing validation. Running and empty projections retain their existing behavior. No endpoints, wire fields, execution controls, promotion policy or shared activity behavior changed.

## Owned files

- Core conversation `runtime/conversations/commands/run-flow.ts` and its owning test.
- Core web `runtime/RunDetailPanels.tsx`, `runtime/run-detail-model.ts`, and new `runtime/tests/retention-projection.test.tsx`.
- Extension `panel/automations/facts.ts`, `summary-copy.ts`, owning facts/copy/controller tests, and an authorized comment-only correction in `types.ts`.

## Observed validation

Fail-first regressions were observed: extension 3 failures, Core chat 3 failures, and Core web 3 failures. Final focused behavior checks passed:

- Core root: `pnpm.cmd exec vitest run packages/fluxiq/src/programs/automation-studio/runtime/conversations/commands/tests/run-flow.test.ts` — 22/22.
- Core `apps/web`: `pnpm.cmd exec vitest run src/features/automation-studio/runtime/tests/retention-projection.test.tsx src/features/automation-studio/runtime/tests/learning-summary.test.tsx src/features/automation-studio/runtime/tests/runtime-views.test.tsx` — 35/35 across three files.
- Extension `apps/extension`, with `EXTENSION_TEST_BUILD_LABEL=codex-t530-final`: `node scripts/test-extension.mjs panel/automations/tests/facts.test.ts panel/automations/tests/summary-copy.test.ts panel/automations/tests/controller.test.ts` — 37/37.
- Core root `pnpm.cmd exec tsc -p packages/fluxiq/tsconfig.json --noEmit`, Core web `pnpm.cmd exec tsc --noEmit`, and extension `node scripts/check-extension.mjs` — passed.
- Both repository `node scripts/structure-audit.mjs` checks and `git diff --check` — passed. Downstream audit receipt: external `lab-runs/2026-10-13/t530-downstream-audit.log`.

Fresh worktree prerequisites initially blocked web tests on stale compiled Core and the extension controller test on missing client-gateway output. Owning contracts/library/gateway builds corrected those prerequisites. One interim controller assertion incorrectly expected retention true from a fixture with no flag; corrected to unknown. The downstream audit found one newly packed test statement; splitting it restored the gate without behavior changes.

Source and report are frozen for supervisor review. No whole suite, browser, provider, user-panel or paid run was performed. These checks prove the projections and guarded attribution, not live browser completion or persisted UI rendering. No commits, merges or pushes were made.
