# P3 professional-network fixture paginator

Status: Proposed ? awaiting supervisor task/owner authorization
Worker: p0_build_identity
Date: 2026-10-07
Scope: source inspection and written proposal only; no source/build/browser/provider/panel/git changes.

## Current State

Backlog row16 is confirmed by source, with real dispatch reproduction pending. Fixture people-client sets initialPage from QUERY.page once, tracks current after each successful fragment, but Next calls load(initialPage + 1, true). Starting at page1 therefore asks page2 on every Next. This behavior is explicitly documented as a fixture defect and pinned in one existing browser test; it is not a hypothesis of browser runtime failure.

## Exact proposed owners

- apps/scenario-lab/src/scenarios/professional-network/search/people-client.ts: Next uses current + 1; remove unused initialPage binding and update owning behavior comment. Preserve 700ms skeleton, attempt guard, challenge self-retry, history, Previous, numbered page and filter reset semantics.
- apps/scenario-lab/src/scenarios/professional-network/tests/honest-and-naive-paths.test.ts: existing professional-feature browser tests are the nearest owning tests spanning client/data/oracle. No separate generic runtime or extension change.
- This report only; no authored shared-plan edit.

The honest browser path currently reaches page2/page3 by numbered buttons, so it never catches Next. Change those two transitions to Next, retaining page status1?2?3 and the exact dataset comparison. The naive reader currently expects Page2 twice and missing Yara; update to Page2?Page3 and affirm later-page person appears, retaining rejection of promoted profiles/all-card extraction against the unchanged oracle. Advertisements, promoted entries and repeated boundary row remain fixture behavior.

## Fail-first plan and checks

1. Supervisor assigns isolated task worktree and approves owners before any edits/builds. Write owning test changes first.
2. Build only scenario-lab through its owning script (test-contracts dependency must already be provisioned); run the two real Chromium Node tests against the built fixture. Honest Next1?2?3 fails before fix on the second transition, since page3 status never arrives. No fake client string assertion as browser proof.
3. Fix client one-page transition owner, rerun same two tests. Keep existing exact organic data fields and firstSeen identity handling. Honest collection still sees24 records including boundary duplicate and exactly23 unique expected records. Naive all-card extraction still rejects promoted/irrelevant rows; fixing Next does not justify a smaller oracle.
4. Package source typecheck and e2e typecheck (configuration below), narrow professional-network scenario tests and repository structure audit; no whole package/full suite. Report exact browser, requested/landed pages and failures. No extension/Core product build needed for this fixture-only slice.

Commands from assigned task:
- From apps/scenario-lab: node scripts/build-scenario-lab.mjs
- From apps/scenario-lab: node --test --test-name-pattern="honest person|naive reader" dist/scenarios/professional-network/tests/honest-and-naive-paths.test.js
- From apps/scenario-lab: pnpm.cmd exec tsc -p tsconfig.json --noEmit
- From apps/scenario-lab: pnpm.cmd exec tsc -p tsconfig.e2e.json --noEmit
- From apps/scenario-lab: node --test dist/scenarios/professional-network/tests/scenario.test.js
- From repository root: node scripts/structure-audit.mjs

Browser helper launches real headless full Chromium channel chromium, isolated local Scenario Lab, seed42 and offsite route guard; each session closes only its owned context/server. Existing trusted page controls, results fragments, status and extraction fields provide the regression. No provider, user panel, debugger or external website request.

## Findings and limits

people-client updates current only after a successful fragment; security-check response deliberately returns before that assignment and retries the same requested page. Next uses current, not URL's mutable page field, after completed render. This preserves attempt cancellation and challenge retry; source inspection alone does not prove timing behavior. Rapid presses/security challenges/Previous/popstate are not expanded in this unit.

Existing full-results workflow lives in professionalNetworkManifest resolved workflow people-search; extract-rotterdam-engineers target/fields/expected records are used by the existing honest/naive tests. Do not modify manifest/live-task instruction, expected dataset, member catalogue, search filters, pagination page size, repeated row policy or runtime extraction guard. Backlog repeated-page runtime detection remains separate from this narrow fixture correction.

Inspected: main MVP Current State; backlog row16 and relevant reading repeat/Next finding (navigation report has no professional paginator owner); people-client.ts; search/results.ts; professional tests honest-and-naive-paths.test.ts and browser-session.ts; live-tasks.ts; package.json, tsconfig.json and scripts/build-scenario-lab.mjs. Test configuration e2e command is proposed from package script; compilation and browser checks have not run. Search/pager.ts does not exist and was not treated as an owner. Await task assignment.
