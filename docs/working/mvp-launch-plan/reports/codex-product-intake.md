# Intake: stopped MVP lanes t898–t901 (2026-11-11)

## Result

- **Resume t901 (W5) for validation and closeout.** W3/t899 and W4/t900 are already integrated on dev per the MVP ledger; their checkout tips are behind dev and clean.
- t898's extension and Core tips are ancestors of dev. Its only worktree residue is the explicitly private, untracked note `docs/working/mvp-launch-plan/reports/w2-humanness/private-run-context.md`; it was not opened and must remain uncommitted.
- t898's level-100 live rerun is not acceptance: its report says every replay needed repair and continuation proof failed. The identified authoring/repair issues were routed to E1/t905. Treat as a separate W1 acceptance item, not a t901 blocker.
- t901 is the only resumable open lane: Core is clean, 0 commits behind / 14 ahead of dev; extension is clean, 2 behind / 6 ahead. The newest Core commit is explicitly WIP/unvalidated; it changes 20 files across API route tests, sign-in/username case handling, IAM grants, workspace-key test, and architecture docs. The extension WIP commit adds only the round-8 report.

## Ready-to-resume unit

Validate the newest t901 Core WIP (11bd1c1a7), then sync the extension checkout with dev and run the narrow affected checks. The round-8 workspace-key test edit itself was reported passing, but it had no typecheck; that does not validate the other 19 files in the WIP commit.

Owned paths for this unit are the 20 files in Core commit 11bd1c1a7:
- `apps/web/src/app/api/programs/[programId]/[endpoint]/tests/route.test.ts`;
- `apps/web/src/features/security/sign-in/**`;
- `packages/fluxiq/src/platform/iam/predefined/**` plus generated IAM catalog files and `packages/contracts/src/iam/actions.generated.ts`;
- `packages/fluxiq/src/programs/automation-studio/api/panel-assistant/tests/workspace-key.test.ts`;
- `packages/fluxiq/src/programs/identity-access/**`;
- `docs/architecture/{package-boundaries,platform}.md`.

The Core WIP includes the mirrored route test that W5 had been waiting on from t898. t898 is now in dev, so that dependency is present. W4's shared humanness/UI work and W3's FluxNode changes are also recorded as landed; no new dependency on their lanes is visible.

## Suggested narrow checks

Run in t901 Core after confirming the checkout still matches the WIP:
- `pnpm --filter fluxiq exec vitest run src/programs/identity-access src/platform/iam/predefined src/programs/automation-studio/api/panel-assistant/tests/workspace-key.test.ts`
- `pnpm --filter @fluxiq/web exec vitest run src/features/security/sign-in src/app/api/programs`
- `pnpm --filter fluxiq check` and `pnpm --filter @fluxiq/web check`
- `pnpm structure:check`

The W5 round-8 report already records `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/api/panel-assistant src/runtime/conversations/assistant src/programs/secret-keys` passing 41 files / 328 tests, and `pnpm structure:check` passing. It explicitly says no typecheck was run. The WIP commit adds the checks above; no checks were run by this intake.

## Basis and limits

Read each lane tip's commit message and named report first, then `docs/working/mvp-launch-plan.md` Current State, statuses, and diff summaries. No code, tests, private-run-context note, or secret-bearing runtime data was read. No tests were run.

