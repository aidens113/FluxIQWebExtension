# Report: f-final-navigation-intent-structure

Worker implementation report, 2026-09-13.

## Outcome

Stage 4k's pure structural move is complete. `ScriptedNavigationIntent` now
lives in the cohesive `connection/scripted-navigation/` child directory, its
test moved with it, and the new child barrel is the parent barrel's export
seam. Every direct extension source/test import was updated. No runtime or test
behavior changed.

The parent `connection/` directory now has 25 tracked source files in the
scratch-index audit, at its existing hard limit rather than the 26 files that
triggered Stage 4k. No baseline file was changed.

## Changed files

Moved without implementation changes:

- `apps/extension/src/background/connection/scripted-navigation-intent.ts` to
  `apps/extension/src/background/connection/scripted-navigation/intent.ts`.
- `apps/extension/src/background/connection/tests/scripted-navigation-intent.test.ts`
  to
  `apps/extension/src/background/connection/scripted-navigation/tests/intent.test.ts`;
  only its subject import changed.

Added:

- `apps/extension/src/background/connection/scripted-navigation/index.ts`.

Import/export updates:

- `apps/extension/src/background/connection/index.ts`.
- `apps/extension/src/background/connection/active-recording.ts`.
- `apps/extension/src/background/connection/recorded-event-intake.ts`.
- `apps/extension/src/background/connection/tests/recorded-event-intake.test.ts`.

This report is the only documentation file I changed. I did not edit runner,
Core, shared working documents, generated build output, Lab files, commits, or
remote state. Pre-existing concurrent Stage 4j and supervisor changes were
preserved.

## Behavioral-diff proof

- A normalized comparison of the old implementation from `HEAD` with the new
  implementation reported equality after line-ending normalization.
- A normalized comparison of the old and moved test reported equality after
  replacing only `../scripted-navigation-intent` with `../intent` and
  normalizing line endings.
- Search found zero remaining `scripted-navigation-intent` references under
  `apps/extension/src`.
- `git diff --check` over tracked moved/import files plus `--no-index --check`
  for all three new paths passed. Git printed only its existing CRLF conversion
  notices.

## Validation

- `EXTENSION_TEST_BUILD_LABEL=f-final-navigation-intent-structure pnpm
  --filter @fluxiq-web-extension/extension check`: **passed**, exit 0.
- Focused moved intent test:
  `pnpm --filter @fluxiq-web-extension/extension exec tsx --test
  src/background/connection/scripted-navigation/tests/intent.test.ts`:
  **8 passed, 0 failed**, exit 0.
- Combined moved intent/intake regressions:
  `pnpm --filter @fluxiq-web-extension/extension exec tsx --test
  src/background/connection/scripted-navigation/tests/intent.test.ts
  src/background/connection/tests/recorded-event-intake.test.ts`:
  **23 passed, 0 failed**, exit 0.
- Scratch-index `node scripts/structure-audit.mjs`: it evaluated the move and
  reported `connection/` at 25 files with no new source violation. The command
  exited 1 solely for two concurrent shared-document failures outside this
  brief's ownership: Current State was 151 lines against 150, and
  `docs/working/README.md` was stale. All remaining output was advisory. I did
  not edit either shared document or the structure baseline.

## Not verified

No extension build, full extension suite, browser, or Lab run was authorized.
The supervisor must rerun the structure audit after reconciling its shared
working-document edits, regenerate tracked build output at integration, and
perform the planned W10 live acceptance. This worker did not commit or push.
