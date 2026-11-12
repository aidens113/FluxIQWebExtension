# secret-activity (t899 W3)

## Outcome
Done.

## The seam
`AutomationStudioActivityHub.publish` in packages/fluxiq/src/runtime/activity/hub.ts (the `publish` method, first statement building `event`): input is passed through `automationStudioWithoutRunSecrets(input)` (run-secrets, deep, keys and strings) before `boundedAutomationStudioActivity`, so a secret cannot be cut in half by a clip.

## Why it covers every event
`publish` is the only path to storage (`byProject`) and to every subscriber (the chat bridge, FluxNode step events, build counters). Its only caller in the package is `emitAutomationStudioActivity` (activity/emit.ts:26); every emit helper (step/**, text/**, automation-activity/**) goes through it. Emit is synchronous and runs in the run's AsyncLocalStorage context, which propagates through awaits, callbacks and timers (tested). An event emitted outside any run context carries no run secret to withhold (nothing can know it). No secrets in context => `automationStudioWithoutRunSecrets` returns the same object, so events are byte-identical.

## Changed
- activity/hub.ts (import + withhold in publish, doc comment)
- activity/tests/hub-secrets.test.ts (new): marker in text, nested step/detail fields, subscribers and snapshot; concurrent runs withhold only their own (with awaits and timers); unchanged with no secrets.

## Commands
- `pnpm exec vitest run src/runtime/activity src/runtime/automation-activity src/runtime/run-secrets` -> 66 files, 533 tests passed (before a test reformat); rerun of activity/tests -> 3 passed.
- `node scripts/structure-audit.mjs` -> one FAIL left, statement-packing in service/fluxnode/tests/secret-invariant.test.ts line 25 (another worker's file, not mine). My file's own violation was fixed.

## Not verified
Live run; typecheck (lead runs it).
