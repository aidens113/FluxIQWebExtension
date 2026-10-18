# Positive scraping corpus — worker report

## Status

2026-10-18: worker implementation and bounded verification complete; supervisor independent review/audit/integration pending. Supervisor approved all28 listed source/test paths in main plan commit7abd7bfa, then released edits after preparation15606 actually exited0. All28 assigned files changed; no additional source paths, commits, merges, pushes, Core edits, or paid runs. Source is frozen and all worker processes exited.

The corpus has108 tasks,87 dataset tasks, and five empty dataset expectations: both quiet-market Rust tasks, Halvard Labs office jobs, August posts over1300 likes, and Saturday certificate availability. These retain their task IDs and coverage. Proposed fixes below require supervisor path assignment before implementation. Every revised instruction will state columns, order, and the actual site's value formats; every final dataset will contain named fields and positive records.

## Discovery and proposed behavior

### Job board

- Quiet mode currently removes every remote Rust posting. Retain existing qualifying posting m7 (Rust Platform Engineer, Verity Legal Tech), while continuing to remove the other matching postings. The existing recording already waits for m7; the same actual recording can then reach one positive record in both early-armed and after-creation variants. Derive the manifest expectation from the real catalogue and independently assert its literal positive identity/values in owning tests. Keep variant IDs stable, but remove stale empty-market descriptions and empty-answer instruction allowances.
- Halvard Labs currently has only hl1, a remote role. Add one realistic non-Rust hybrid role hl2, retaining hl1 and the separate Halvard Systems catalogue. A hybrid addition avoids altering the existing28-remote-role dataset and the seven remote Rust matches. Record the actual hybrid/office search, save the hybrid role through the site's first-failure/retry controls, then read only the newly saved matching role while preserving the two baseline saved jobs. Assert final saved-account state, with no follows, alerts, or applications. Office search may legitimately be empty as an intermediate state; the final dataset must be positive.
- The original57-task instruction golden file includes the shared Rust wording; update its affected task texts together rather than bypassing preservation checks.

### Photo social

- Raise the existing verified studio's August21 post from1249 to1349 likes. This preserves the identities/order of the three most-liked August posts and the other collection/account fixtures, while making the existing over1300 task positive.
- Read the opened post's actual date footer and exact like count, rather than the grid's descriptive image alt text and rounded hover count. Proposed explicit formats are the displayed date (August21 rendered as `August 21`) and grouped exact likes (`1,349`), newest first. The grid remains candidate discovery; the opened post supplies the strict threshold evidence. No article renderer changes are proposed.
- Keep negative coverage for reel plays, the pinned2025 post, and other accounts, adjusted to reject wrong positive datasets rather than relying on an empty oracle. Update top-like literal/count assertions affected by1349.

### Company website

- Keep the CP12/free-Saturday/all-three-weeks intent but choose the existing open-Saturday branch Wrenfield instead of closed-Saturday Corve Bridge. Read-only inspection of the deterministic source availability yields two proposed rows:2026-10-03 at11:30 and2026-10-17 at09:00; the middle week has no free Saturday slots. These values still require actual module/browser verification, not acceptance from the inspection calculation.
- Explicit columns date/time, chronological ascending order, ISO date YYYY-MM-DD and24-hour HH:mm. Preserve unchanged booking/payment/account state.
- Current slot controls expose only combined `data-slot=date|time` and CSS differences for unavailable slots. Propose ordinary semantic `role=button`, `aria-disabled` and separate `data-date` attributes, preserving existing controls and visuals. This supports truthful availability selection and exact date extraction without an oracle-specific test ID.
- The company's local browser recording driver currently ignores the existing ScenarioStep `pagination` and selector@attribute contracts. Implement those existing contracts in that owning test helper, then prove actual Later-week control traversal through the empty middle week and collect the two positive rows. No Core/product protocol change or package/test-runner edit is proposed.

## Exact proposed source ownership

All paths are relative to the t721 downstream worktree. The corpus regression file is already preapproved; the remaining files are requested assignments, not edits made.

Shared:

- `apps/scenario-lab/src/scenarios/tests/realistic-site-live-tasks.test.ts` — require records.length>0 and at least one named field per row; keep108/87 counts.
- `apps/scenario-lab/src/scenarios/tests/fixtures/realistic-task-baseline.ts` — synchronize existing original Rust task instruction texts.
- `apps/scenario-lab/src/scenarios/tests/live-instructions.test.ts` — remove stale Labs-none description if touched by revised wording assertions.

Job board:

- `apps/scenario-lab/src/scenarios/job-board/live-tasks.ts`
- `apps/scenario-lab/src/scenarios/job-board/catalog/search.ts`
- `apps/scenario-lab/src/scenarios/job-board/catalog/postings.ts`
- `apps/scenario-lab/src/scenarios/job-board/manifest.ts`
- `apps/scenario-lab/src/scenarios/job-board/breadth/halvard-labs-office-jobs/expected.ts`
- `apps/scenario-lab/src/scenarios/job-board/breadth/halvard-labs-office-jobs/workflow.ts`
- `apps/scenario-lab/src/scenarios/job-board/tests/scenario.test.ts`
- `apps/scenario-lab/src/scenarios/job-board/tests/task-wording.test.ts`
- `apps/scenario-lab/src/scenarios/job-board/tests/browser-paths.test.ts`
- `apps/scenario-lab/src/scenarios/job-board/tests/breadth-paths.test.ts`
- `apps/scenario-lab/src/scenarios/job-board/breadth/tests/expected.test.ts`

Photo social:

- `apps/scenario-lab/src/scenarios/photo-social/live-tasks.ts`
- `apps/scenario-lab/src/scenarios/photo-social/data/studio-posts.ts`
- `apps/scenario-lab/src/scenarios/photo-social/breadth/august-over-1300/expected.ts`
- `apps/scenario-lab/src/scenarios/photo-social/breadth/august-over-1300/workflow.ts`
- `apps/scenario-lab/src/scenarios/photo-social/breadth/tests/expected.test.ts`
- `apps/scenario-lab/src/scenarios/photo-social/tests/scenario.test.ts`
- `apps/scenario-lab/src/scenarios/photo-social/tests/breadth-paths.test.ts`

Company website:

- `apps/scenario-lab/src/scenarios/company-website/live-tasks.ts`
- `apps/scenario-lab/src/scenarios/company-website/client/widget-script.ts`
- `apps/scenario-lab/src/scenarios/company-website/qualification/saturday-certificate/expected.ts`
- `apps/scenario-lab/src/scenarios/company-website/qualification/saturday-certificate/workflow.ts`
- `apps/scenario-lab/src/scenarios/company-website/qualification/tests/breadth-expected.test.ts`
- `apps/scenario-lab/src/scenarios/company-website/tests/site-driver.ts`
- `apps/scenario-lab/src/scenarios/company-website/tests/breadth-paths.test.ts`

No changes proposed in extension, domain, Core, shared contract types, other reports, shared plans, structure baselines, or supervisor-owned launch guard/docs.

## Validation to perform after authorization/preparation

1. Run the positive corpus regression against current fixtures and observe the five known failures.
2. Implement the assigned fixtures/instructions/workflows/oracles together, preserving all task IDs and dataset task counts.
3. Run narrow owning source tests, affected other-oracle checks, scenario package typecheck, and structure audit.
4. Run provider-free Chromium paths for both quiet variants, saved hybrid Labs role, opened qualifying August post, and all three Wrenfield calendar weeks. Assert exact nonempty rows, formats/order, and required account state. Inspect each actual exit/result before claiming success.
5. Record final exact commands, counts, browser/build environment, and evidence log paths here. No paid launch.

## Execution and observed checks

- Fail-first: after adding the positive-data assertion, scenario-only compile succeeded and `node --test --test-name-pattern='record by record' dist/scenarios/tests/realistic-site-live-tasks.test.js` exited1 on `job-board-remote-rust-roles-quiet-market: scraping requires actual matching rows`.
- Implemented the approved approaches. The company fixture only adds semantic slot availability/date attributes; actual capacity is unchanged. The original57-task instruction snapshot was updated in place for the shared Rust wording. Source contains no scenario-shaped product/model guidance.
- Final `node apps/scenario-lab/scripts/build-scenario-lab.mjs` exited0; log `apps/scenario-lab/node_modules/codex-positive-compile-final.log`. This compiles only the scenario package. Two earlier compile attempts exposed a missing test import, corrected before browser launch.
- Focused unit batch:70/70 passed, no skips/failures. Includes realistic-site-live-tasks/live-instructions, job-board scenario/task-wording/breadth expectations, photo-social scenario/breadth expectations, company qualification/breadth expectations. This verifies108 tasks,87 dataset tasks, all positive and with named fields, original57 preservation, independent fixture records, preserved other affected oracles/account conditions. Log `apps/scenario-lab/node_modules/codex-positive-unit.log`.
- `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab check` actually exited0, source and e2e types; log `apps/scenario-lab/node_modules/codex-positive-check.log`. Plain `pnpm` resolves to a blocked PowerShell script on this host; used the existing .cmd executable, without changing execution policy.
- Initial Chromium batch:6/8 passed, no skips. Both quiet variants, actual hybrid save, exact two-row Saturday/account proof, wrong closed branch and photo wrong-account/year/play-count cases passed. Two failures were honest test-path defects: extra-save negative waited for an already-minimized chat, and photo date selector read caption age6w while exact likes1,349 was correct. Corrected only those assigned paths. Initial log `apps/scenario-lab/node_modules/codex-positive-browser.log` preserves both failures.
- Final browser repair actually exited0:3/3 passed (photo exact positive footer/count, wrong-year/play-count/accounts, extra remote Labs save refusal). Log `apps/scenario-lab/node_modules/codex-positive-browser-repair.log`.
- Full owning company breadth-browser file actually exited0:12/12 passed, no skips/failures. Log `apps/scenario-lab/node_modules/codex-positive-company-browser.log`. Covers local driver's shared attribute/pagination support against four existing workflows, wrong branch, missed later-week match, unavailable-slot inclusion, and account-preservation oracles. Capacity remains unchanged.
- Final source/e2e package check actually exited0; log `apps/scenario-lab/node_modules/codex-positive-check-final.log`. Source remained frozen throughout final browser/static readers. No audit run by worker; supervisor coordinates the repository audit shared with the launch guard.
- All commands use process `FLUXIQ_BUILD_CACHE_DIR=off`. Browser environment: installed Playwright Chromium channel `chromium`, headless, isolated fresh contexts/sites, en-GB and site-own timezone. No extension, provider calls, personal browser profile, page captures, or private runtime data used.

## Final exact positive records and proof scope

- Quiet market, both early-arm and after-creation: one Rust Platform Engineer / Verity Legal Tech / `£75,000 – £88,000 a year` / own job href. Browser proves baseline seven-row recording before actual late variant arm, then replays the same honest recording and reaches the single positive row; baseline saved keys remain intact. Oracle helpers and literal owning tests independently constrain the m7 identity.
- Labs: one Workplace Systems Engineer / Halvard Labs / Hybrid (Manchester). Browser performs first save refusal/retry, checks On-site, opens My jobs, reads only this newly saved matching row, and proves saved keys exactly the two baseline keys plus864532f1fa5dbc8f. Remote Labs and Systems jobs remain excluded.
- Photo: one `date: August 21`, `likes: 1,349`. Browser loads the genuine profile grid through rate/session controls, opens the qualifying post, reads its actual footer/exact count, and proves consent/account state. Negative paths actually open the wrong reel/year/accounts and fail exact rows. No implicit product actions or new renderer API.
- Saturday: `2026-10-03 / 11:30`, then `2026-10-17 / 09:00`. Browser uses Wrenfield/CP12 controls and genuine Later controls through all three weeks, including the zero-match middle week. First-week-only output and all six Saturday slots including unavailable capacity fail the exact oracle. No booking/payment/quote/subscription/state mutation.

These are provider-free fixture/browser proofs, not new live model acceptance, extension execution, or judged/replay paid runs. No paid launch was attempted. Historical empty scraping acceptance is not revived.

## Reproduction commands

From t721 root, set `$env:FLUXIQ_BUILD_CACHE_DIR='off'`, then compile `node apps/scenario-lab/scripts/build-scenario-lab.mjs` and check `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab check`.

From `apps/scenario-lab`, with the same environment:

```powershell
node --test dist/scenarios/tests/realistic-site-live-tasks.test.js dist/scenarios/tests/live-instructions.test.js dist/scenarios/job-board/tests/scenario.test.js dist/scenarios/job-board/tests/task-wording.test.js dist/scenarios/job-board/breadth/tests/expected.test.js dist/scenarios/photo-social/tests/scenario.test.js dist/scenarios/photo-social/breadth/tests/expected.test.js dist/scenarios/company-website/qualification/tests/breadth-expected.test.js
node --test --test-name-pattern='quiet market|hybrid Halvard|remote Halvard|august-over-1300|saturday-certificate' dist/scenarios/job-board/tests/browser-paths.test.js dist/scenarios/job-board/tests/breadth-paths.test.js dist/scenarios/photo-social/tests/breadth-paths.test.js dist/scenarios/company-website/tests/breadth-paths.test.js
node --test dist/scenarios/company-website/tests/breadth-paths.test.js
```

The combined browser command above describes the final corrected source; the worker initially observed6/8, then reran only the affected photo/extra-save cases3/3 and the shared company helper's whole owning file12/12. No claim that the original failed batch log passed.
