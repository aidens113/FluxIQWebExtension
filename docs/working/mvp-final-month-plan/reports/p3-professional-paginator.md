# P3 professional-network fixture paginator

Status: Worker complete; source frozen, awaiting supervisor verification/integration.
Worker: p0_build_identity
Date: 2026-10-07
Scope: fixture-only t308 in fxwork/t308-professional-paginator; shared Core read-only. No provider, panel, git mutation or shared-plan changes.

## Current State

Backlog row 16 is confirmed by source and real Chromium failure. Next formerly called load(initialPage + 1, true), so both browser paths stopped at page 2 on their second Next press. Next now calls load(current + 1, true), using the page assigned after successful fragment rendering. The obsolete initialPage binding and defect comment are removed.

The two owning Chromium tests now pass. The honest path presses Next from 1 to 2 to 3, checks status and URL page values, and retains the exact full-field results oracle: 24 collected organic rows including the boundary repeat, 23 unique expected people. The naive path reaches the final-page person Yara Haddad while its all-card dataset still includes the promoted profile and fails the exact expected-name oracle. No dataset, manifest, member, page-size, filter, repeated-row or runtime extraction behavior changed.

## Exact owned files

- apps/scenario-lab/src/scenarios/professional-network/search/people-client.ts
- apps/scenario-lab/src/scenarios/professional-network/tests/honest-and-naive-paths.test.ts
- docs/working/mvp-final-month-plan/reports/p3-professional-paginator.md

The existing browser test owns the client/data/oracle interaction. No generic runtime or extension source was changed. The client retains the 700ms skeleton, attempt guard, challenge retry, history, Previous, numbered-page and filter-reset logic.

## Implementation and observed evidence

1. Supervisor approved the three owners and isolated t308 tree. Test edits came first: replace the honest numbered-page transitions with Next, assert page 1 initially and status/URL 2 then 3, retain the full oracle, and update the naive path from repeated page 2 to pages 2 then 3.
2. Provision57384 completed successfully; its build was not counted as task verification because it may have read in-progress test edits. Worker rebuilt the fixture with product Next unchanged.
3. Fail first: both actual Chromium tests failed waiting eight seconds for Page 3 of 3 after the second Next press. Honest 23,322.6185ms; naive 17,820.3532ms; total 28,031.1097ms, 0/2 passed. First Next reached page 2.
4. Applied the scoped client fix only after those failures completed. A build command initially used repository-root cwd and failed MODULE_NOT_FOUND for the package-owned script; rerunning in apps/scenario-lab succeeded. This was a command-location error.
5. Final owning fixture build passed. The same real Chromium command passed 2/2: honest 15,480.9513ms, naive 10,332.3376ms, total 18,378.9917ms. Both sessions used the existing isolated loopback fixture and cleanup.
6. Both scenario source and e2e no-emit typechecks passed. Narrow professional-network scenario tests passed 10/10 in 1,052.9849ms, including the unchanged 23-person oracle, ads/promoted/repeated-row fixture, filters, seed, security challenge and invitation oracle cases. Structure audit passed with 176 warnings, 117 baselined; no baseline edits. git diff --check passed.

## Reproduction commands

From apps/scenario-lab in the task tree:

```powershell
node scripts/build-scenario-lab.mjs
node --test --test-name-pattern="honest person|naive reader" dist/scenarios/professional-network/tests/honest-and-naive-paths.test.js
pnpm.cmd exec tsc -p tsconfig.json --noEmit
pnpm.cmd exec tsc -p tsconfig.e2e.json --noEmit
node --test dist/scenarios/professional-network/tests/scenario.test.js
```

From repository root:

```powershell
node scripts/structure-audit.mjs
git diff --check
```

Browser: Playwright 1.51.1, real headless full Chromium channel chromium; exact browser patch was not captured. Existing browser-session helper runs local Scenario Lab seed 42 with offsite route guard, then closes its owned context/server. No provider, external website, user panel or debugger was used. This is browser fixture proof, not a live extension/model workflow qualification.

## Tested source/artifact identity

- Downstream task base: f6d4360862709b0eb768c30b935f7103d0422bad, plus the three uncommitted worker-owned file changes above.
- Shared read-only Core: 04b51050dcf6dbdcb34255d99a1aa73cab89e63d.
- people-client.ts SHA256: 0DCC17D66E7A18873859304361EAEC5FBD8DC13932AB85C62DD929F3BE631D87.
- Ignored dist/scenarios/professional-network/search/people-client.js SHA256: 3D452533BC9D0648B0D88321960F9CAC7287F072B08A1AAD2CD3D6DD1610CBCC.

These are disk fingerprints of tested source/build output, not an embedded running Core or extension identity claim. Generated output is untracked. Supervisor owns merging current dev into the task and independent checks before integration.

## Read inventory and limits

Read main MVP Current State and bounded brief; backlog row 16 and relevant reading repeat/Next finding (navigation report has no professional paginator owner); people-client.ts; search/results.ts; professional tests honest-and-naive-paths.test.ts and browser-session.ts; live-tasks.ts; package.json; tsconfig.json; tsconfig.e2e.json; scripts/build-scenario-lab.mjs. Search/pager.ts does not exist and was not treated as an owner.

current changes only after successful rendering; the security-check response returns before that assignment and retries the same requested page. Source preserves those branches, and the existing narrow security unit test passes. Rapid presses, live security challenge timing, Previous, popstate, filter reset and extension execution were not newly exercised in a browser. No claim of runtime repeated-page detection is made; that remains separate backlog work. No full suite, Core source edit, provider run, panel management, commit or push occurred.
