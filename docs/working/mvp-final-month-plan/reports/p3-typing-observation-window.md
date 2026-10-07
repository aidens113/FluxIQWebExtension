# Typing observation window - t321

Status: independently verified locally; integration pending. Root owns typed action/owning mock contract/existing production fixture/scoped architecture paragraph.

Current typeAction reads synchronously, even though execute already awaits it. Prepared actual page change handlers revert via microtask and10ms timer; another timer covers the typed control before requested Enter. Expect failed reverts and no Enter/form submit through the newly raised dialog. Existing original-control liveness/native typing/redaction cases remain in same production-built fixture. No Core/domain/wire change, provider/panel/user state.

Proposed50ms timer observation matches existing checkable-state bounded observation and works without rAF in background tabs. Revalidate actionability before Enter after the await; a post-typing rejection must not claim refusedBeforeDispatch. Finite observation does not certify arbitrary delayed/server acceptance or React behavior.

Root reproduction: initial browser launch correctly refused a stale type.ts artifact after checkout rewrote source bytes; this was an identity guard, not a behavior reproduction. Owning build then completed (11.568s, all three targets verified22 files). Actual Chromium reproduction failed at the two queued-revert cases: both reported succeeded rather than failed (fixture5.4s). Source now awaits50ms and rechecks reachability before Enter; verification pending.

Root verification: rebuilt actual extension11.363s, all targets22 files; actual unpacked Chromium1341/1 zero skips26.3s fixture/28.0s total. Both queued reverts failed; newly covered field refused Enter, coveredEnter0/formsubmits0. Original liveness/native/invalid/cancel/per-character/password redaction checks passed. Named owning units7/7 zero skips987.7ms; build includes source typecheck. E2E typecheck pending correct tsconfig.test.json (first attempted e2e/tsconfig.json does not exist). Initial audit failed only generated working index header drift, regeneration pending. No provider, panel management or paid qualification.

Correct owning e2e typecheck: pnpm.cmd exec tsc -p apps/extension/tsconfig.test.json --noEmit, exit0. Active t320 brief restored from accidental prior archive retirement; no worker implementation changed. Exact t321 brief retired to archive after verification.

Final structure audit reported passed176warnings/117baseline. PowerShell stderr merge pipeline surfaced exit1 despite that passed summary; task finish will independently enforce the audit gate. No baseline increase.
