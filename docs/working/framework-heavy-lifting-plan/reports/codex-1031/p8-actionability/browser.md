# t827 measured browser producer

Outcome: Partial. Source complete and FROZEN for lead review; executable acceptance remains held for the lead's Core 0.19 SDK release.

Inspected actual measuring owners: `action-runtime/actionability.ts`, `actions/click.ts`, `actions/check.ts`, `action-runtime/checkable-state/checkable-state.ts` and `action-runtime/ignored-press/press-again.ts`. The click's initial gate and existing later gates are actual measurements. The check setter's only disabled outcome writers read `isDisabled`/`refusesPress` against the actual input/control before activation. Its closed disabled code can report that newer measurement without asserting an unacted effect.

Click keeps its latest measured report per call and projects only actionable/cause into evidence. Its ensureState early return remains unmeasured. Check projects the effective reachable target's report, including its associated label fallback, and replaces the earlier positive when the actual setter reports measured disabled. No additional hit tests, dispatches, retry opportunities or pre/post-effect flags were added.

Result construction uses the frozen shared `webActionabilityProperty` export from `@fluxiq-web-extension/domain/client` and explicitly assigns its fresh parsed control. The lead approved this shared reader instead of a duplicate browser property helper. Getter/proxy/private-extra controls drop alone; the actual result, person/failure authority and existing evidence remain independent.

Recovery's typed reading is restricted to existing ACTION_REJECTED/TARGET_NOT_ACTIONABLE reason distinctions. The disabled path still requires existing `effect: unacted`; dialog/hidden-code authority and all other code, person, permission and retry gates stay in place. Missing/malformed controls retain legacy behavior.

Changed source (six files, relative to repository root):

- `apps/extension/src/content/action-runtime/results.ts`
- `apps/extension/src/content/action-runtime/recovery/fault.ts`
- `apps/extension/src/content/action-runtime/actionability/portable.ts` (new)
- `apps/extension/src/content/action-runtime/actionability/index.ts` (new)
- `apps/extension/src/content/actions/click.ts`
- `apps/extension/src/content/actions/check.ts`

Changed tests/helpers (seven files, relative to repository root):

- `apps/extension/src/content/action-runtime/tests/results.test.ts`
- `apps/extension/src/content/action-runtime/recovery/tests/fault.test.ts`
- `apps/extension/src/content/action-runtime/actionability/tests/portable.test.ts` (new)
- `apps/extension/src/content/actions/tests/check.test.ts` (new; extra ownership approved by lead)
- `apps/extension/src/content/actions/tests/click.test.ts`
- `apps/extension/src/content/actions/tests/click/dependencies.ts` (extra ownership approved by lead)
- `apps/extension/src/content/actions/tests/click/tests/ensure-state.test.ts`

Added assertions cover positive/all three negative measurements, hidden-input label fallback, measured setter-disabled replacement, original report immutability, ensureState absence, no factory inference or unmeasured-success fact, newest post-press measurement with one existing press, independent person authority, strict optional projection/getter/proxy/private-extra isolation, typed cause versus legacy prefix, disabled's unacted gate, and stronger auth/person/permission codes.

Validation: `git diff --check -- apps/extension/src/content/action-runtime apps/extension/src/content/actions` -> exit 0, no whitespace errors (Git CRLF normalization warnings only). Generated extension tests/types/build/browser NOT RUN: lead explicitly holds them until Core 0.19 SDK release. Source is frozen pending that release and lead verification.

Exact proposed narrow test command, from `apps/extension`, NOT RUN:

```powershell
$env:EXTENSION_TEST_BUILD_LABEL='t827-browser-actionability'; node scripts/test-extension.mjs content/action-runtime/actionability/tests content/action-runtime/tests/results.test content/action-runtime/recovery/tests/fault.test content/actions/tests/click content/actions/tests/check.test
```

The lead must separately release source/test type checks and any provider-free browser proof. This worker has launched no generated checks, full suite, browser, panel or provider call.

Not verified: executable tests/types, SDK linkage, actual browser production, old/new executable compatibility and storage reload acceptance. All test assertions above are authored coverage, not observed passing results.

Report: `docs/working/framework-heavy-lifting-plan/reports/codex-1031/p8-actionability/browser.md`

Notes: Browser source FROZEN. No Domain/shared alias/Core/wire/policy/version/guidance changes made by this worker. No mutating git operations performed.
