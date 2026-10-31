# t827 legacy permission/refusal fixtures — source frozen

Outcome: Done. The seven remaining failures in the two owned files were corrected without changing production behavior; both authorized selectors pass.

## Cause and changes

- `domain/src/runtime/llm-evidence/tests/press.test.ts`: five parameterized permission cases plus the empty-declaration case compared the entire request against pre-t824 expectations. The actual requests correctly included the existing canonical `actionEffect: { effectClass: "commit", permissionConsequences: [] }`. Added that field to the strict deep comparisons and corrected comments that treated the semantic declaration as the complete effect floor. Existing denied-authority/no-act, granted-authority/actual-press, and malformed-declaration/no-act assertions remain.
- `domain/src/runtime/llm-evidence/tests/page-refusal.test.ts`: the modal fixture really returns before performing a click, but its failure omitted positive effect evidence. Its refusal branch now explicitly reports `effect: "unacted"`. Attempted and performed clicks are recorded separately, and the existing uncapturable-page case keeps its exact bare-code expectation and proves no click was performed.
- Added one regression covering both absent and covered actionability. It deliberately omits the fixture's positive unacted report, then makes recapture fail. Both variants assert the exact canonical commit permission request, `outcome_uncertain`, one actual dispatch, zero performed clicks, failed recapture, no captured page, and retained current actionability only when measured. The dialog code, execution stage and covered measurement cannot stand in for positive unacted evidence.

## Observed validation

```powershell
$env:DOMAIN_TEST_BUILD_LABEL = 't827-legacy-fix'
pnpm.cmd --filter @fluxiq-web-extension/domain test runtime/llm-evidence/tests/press.test.ts runtime/llm-evidence/tests/page-refusal.test.ts
```

Exit 0. Core freshness gate reported its build current. TAP: 20 tests, 20 pass, 0 fail, 0 cancelled, 0 skipped, 0 todo; test runtime 3482.3077 ms. The selectors contain 12 press tests and eight page-refusal tests, including the new regression's two variants.

Not verified: the remaining broader selected test set, package typecheck, structure audit, separate builds, browser/live behavior, or full suites. No provider/API/browser/panel, agents, mutating git, secrets, or runtime-state operation was performed. The lead owns broader acceptance and its separate harness fixture/effect-check-builder corrections.

Report: `docs/working/framework-heavy-lifting-plan/reports/codex-1031/p8-actionability/legacy-fix.md`

Notes: Final source freeze covers exactly `domain/src/runtime/llm-evidence/tests/{press,page-refusal}.test.ts`. No production files, other tests, versions, rules, baselines, shared documents, or other reports were edited. No remaining failures were observed in these two selectors.
