# t786-chat report

Outcome: Done

## What changed and why
- recovery-words.ts: new `reacquire` case. Succeeded: "Found it again after the page changed" / "The page changed, so it looked again and found the same one[ from “step”], then tried it there." Card "Found again", target the subject, Done. Failed (gone): title "It is no longer on the page", rendered as a refused ("Not done: it is no longer on the page") card so it never says "Didn't work". Refused: "Didn't look for it again", held-back reason. NAMES record extended (fixed the tsc break).
- tests/recovery-message.test.ts: one test covering succeeded, failed, refused, step-named text.
- docs/architecture/extension-client.md: one paragraph on the reacquire card.
- shared/activity needed no change (kind comes from Core's contract type).

## Commands run
- Rebuilt Core libs in the t786 Core worktree (generated dist only, no source edit) because the extension test gate and tsc read Core's compiled dist.
- `EXTENSION_TEST_BUILD_LABEL=t786-chat pnpm --filter @fluxiq-web-extension/extension test chat/stream/step` -> 100 tests, 100 pass, 0 fail.
- `npx tsc -p apps/extension/tsconfig.json --noEmit` -> no output (clean); before the edit it failed with 2 reacquire errors.
- `node scripts/structure-audit.mjs` -> passed (232 warnings, 616 baselined).

## Not verified
Live chat rendering; the exact Core subject strings (design's examples used in tests only).

## Open
The failed case uses the refused card style for "Not done"; this was my reading of "never didn't work".
