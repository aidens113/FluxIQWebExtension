# t941 test-exit-code report

## Outcome
Done.

## Cause
`apps/extension/src/content/tests/install-when-ordinary.test.ts` (added by t934) statically imported `../lifecycle`. The barrel also exports `suspend-content`, which imports `../recorder` and `./instance`. Those modules touch `window` and run `new MutationObserver(...)` at load (`recorder.ts:41`, `instance.ts:13`), with no page stubbed. The import throws while `test-extension.mjs` loads the bundles, outside any test, so node:test prints one line, `# Error: A resource generated asynchronous activity after the test ended ... MutationObserver is not defined`, and exits 1. The tally stays 1910/1910/0 because no test failed.

It only surfaced in the combined run because another file had leaked a `window` global, so the import got as far as `MutationObserver`. Run alone, the file died earlier with `ReferenceError: window is not defined` (exit 7). Evidence:
- Run 1 (the exact command, with `--trace-warnings`): EXIT=1, tests 1910, pass 1910.
- Run 2 (a preload with `process.on("uncaughtException")` printing the stack): `ReferenceError: MutationObserver is not defined at recorder.ts:41 <- picker/recorded-event.ts:24 <- install-when-ordinary.test.mjs`.
- Each of the 260 test files under `src/content` was run alone. Only `install-when-ordinary.test.ts` (window not defined) and `identity/tests/dialog.test.ts` (an unrelated ReferenceError) exit non-zero alone.

## Fix
1. `src/content/tests/install-when-ordinary.test.ts`: the barrel is now loaded dynamically by `loadInstallWhenOrdinary()`, under a stub `window` and `MutationObserver`, which are restored afterwards. Each test calls it first. A direct import of `../lifecycle/install-when-ordinary` was tried and rejected by the structure audit (barrel rule), so the barrel is kept.
2. `scripts/test-extension.mjs`: added a `process.on("uncaughtException")` listener that prints the stack and says the run will exit 1. The next occurrence names its file instead of a one-line message. It does not change the exit code.

No regression test was added. The guard is the script's stack output, and the test is now self-contained: it passes alone (3/3, exit 0).

## Commands run
- `heavy-slot.mjs run t941 -- pnpm build` -> exit 0.
- Original command, before the fix -> `EXIT=1`, tests 1910, pass 1910, fail 0, `# Error ... MutationObserver is not defined`.
- Same command, after the fix -> `FULL_EXIT=0`, tests 1981, pass 1981, fail 0, cancelled 0.
- `pnpm --filter @fluxiq-web-extension/extension check` -> `CHECK_EXIT=0`.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (253 warning(s), 551 baselined)`.
- `install-when-ordinary` alone -> exit 0, 3 passing.

## Not verified
- `src/background` and `src/runtime` directories were not re-run.
- `src/content/identity/tests/dialog.test.ts` still exits 1 when run alone. It was not examined, and it passes in the grouped run.

## Open questions
Several content tests only pass because earlier files leak `window`. Making each file self-contained, starting with `dialog.test.ts`, is a possible follow-up.

## Addendum: dialog.test.ts made self-contained
`src/content/identity/tests/dialog.test.ts` failed alone ("HTMLInputElement is not defined" in test 2, exit 1) because it relied on page globals leaked by other files. It now wraps every test in `withPage`, which installs empty `HTMLElement`/`HTMLInputElement`/`HTMLSelectElement`/`HTMLTextAreaElement` classes and a `document` with `getElementById`, then restores what was there.

Results:
- File alone: exit 0, 15 pass, 0 fail.
- Original grouped command: exit 0, tests 1981, pass 1981, fail 0.
- `pnpm --filter @fluxiq-web-extension/extension check`: exit 0.
- `node scripts/structure-audit.mjs`: passed (253 warnings, 551 baselined).

Every one of the 260 content test files was run alone; before this fix only `install-when-ordinary.test.ts` and `dialog.test.ts` failed alone. Both are fixed, so every content test file is order-independent. That claim rests on the per-file loop made before the fix and the single re-run of the fixed file; the loop was not repeated after the fixes.
