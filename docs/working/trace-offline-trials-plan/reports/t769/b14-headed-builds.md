# t769 B14: headed, provider-free builds with offline repair trials

SR = `apps/extension/e2e/site-reset/` in the downstream t769 tree. Core = `fxwork/t769/!FluxIQ` (not edited).

## Outcome

Done. Both new specs pass headed and provider-free, on job-board and on photo-social. In each build, a repaired subflow's revision 2 is checked against revision 1's recording and its "no" is kept, with no reset. Revision 3 passes offline, then is reset and run live, and the judge says yes. The final judged run (the supervisor's whole test) runs live after a reset. All of it is asserted from Core's step log. The existing `repair-first.spec.ts` still passes.

One deviation from the brief's literal sequence (see "Open questions" 1): the plan has **two** subflows, not one. The revision-3 live yes is the repaired subflow's live trial. The final judged run is the supervisor's whole test (`core.test_candidate`) that follows it, and that test is also live.

UNIT READY: SR/tests/offline-first-job.spec.ts, SR/tests/offline-first-photo.spec.ts, SR/offline-first-build.ts, SR/step-log.ts, SR/offline-trial-environment.ts, SR/index.ts, SR/installed-build.ts, SR/gateway.ts

## What changed and why

- **New `SR/tests/offline-first-job.spec.ts` (job-board).**
  - Task: "Open the job board's saved jobs page and list the title of every job saved there."
  - The plan has two subflows: `open` (navigate to My jobs) and `titles` (read the saved list, `after: open`).
  - `titles` detects the list and reads it once. It then submits three revisions that differ only in the record output's `process` (tier 1). The read sent to the page is identical; the matcher compares only `actionType/target/parameters`, and `recordOutput` sits beside `parameters` in the domain dispatch.
  - rev 1 `where title contains <second saved job>`: live, judged no.
  - rev 2 `where title contains <first saved job>`: offline, kept no.
  - rev 3 no `process`: offline pass, then reset, then live yes.
  - Then `project.assemble` and `core.test_candidate`, live, yes, and the supervisor completes.
- **New `SR/tests/offline-first-photo.spec.ts` (photo-social, the studio's grid).**
  - Task: "Open the studio's profile and list the links of its three most recent posts."
  - rev 1 `where badge contains "Pinned"` (the three newest are missing): no.
  - rev 2 `not` (keeps every unpinned post, the fourth newest included): kept no offline.
  - rev 3 `not` + `limit: 3`: offline pass, then live yes.
  - Its yes words name each condition and each `[row ID]` that Core shows, as `photo-page-order-limit.spec.ts` does.
- **New `SR/offline-first-build.ts`**, shared by both specs:
  - `twoPartPlan`: the `project.write_plan` input.
  - `offlineFirstVerify`: a scripted judge that answers by what is under test, so it answers the offline judge calls too.
  - `offlineFirstProof`: step-log windows per test call, the listing, and `assertAcceptance`.
- **New `SR/step-log.ts`** `readStepLog`: completed `NNNN-*` folders with their `meta.json` and `result.json`.
- **New `SR/offline-trial-environment.ts`** `useOfflineTrialEnvironment(stepsDir)`:
  - sets `FLUXIQ_CLIENT_GATEWAY_TRACE=1` and `FLUXIQ_LLM_STEP_LOG_DIR` (= `testInfo.outputPath("steps")`) before `startInstalledBuild`;
  - clears `FLUXIQ_OFFLINE_TRIALS`;
  - restores all three in `finally`.
- **Additive harness edits:**
  - `SR/gateway.ts`: an optional third argument, `commanded(actionType)`, called for each `server.execute_action` sent.
  - `SR/installed-build.ts`: `actionResults()` and `siteCommands()`.
  - `SR/index.ts`: two new exports.
  - No existing behaviour changed: `repair-first.spec.ts` was re-run and passed.
- **What the acceptance asserts (`assertAcceptance`):**
  - The test windows are exactly 4 `tool-core.test_subflow` folders, then 1 `tool-core.test_candidate`.
  - The decided offline outcomes are `["kept_no","passed"]`.
  - The `open` window and the rev 1 window contain no decided offline check, and rev 1 has a reset.
  - The rev 2 window holds `["offline:kept_no"]` only. The answer has `checkedAgainst: "recorded_run"`, both in the builder's evidence and in `result.json`. Every command sent to the site during it is a `capture_snapshot`.
  - In the rev 3 window, `offline:passed` comes before `reset`. The answer is a yes carrying `offlineCheck`, both in the evidence and in `result.json`.
  - The whole window has a reset and no offline folder (D40).
  - The judge runs, in order, are `open:yes, <s>-1:no, <s>-2:no, <s>-3:yes, whole:yes`. Rev 3 had more judge calls than rev 2: offline plus live.
  - The completions, in order: `open` after `open.test`, the subflow after `test-3`, the supervisor after a whole `yes`.
  - The ending is `proposed` with no failure.

## Commands run and observed results (2026-10-27/28)

- **Core build.** In `fxwork/t769/!FluxIQ`, `pnpm --filter fluxiq build` took `real 1m43.5s`: build-cache `"reason":"inputs changed: packages/fluxiq"`, `"ms":101977`.
- **Core freshness.** From the downstream root, `node scripts/check/core-build.mjs` printed `core-build: FluxIQ Core's build at ...\!FluxIQ is current with its source.`
- **Typecheck.** From `apps/extension`, `node --max-old-space-size=6144 node_modules/typescript/bin/tsc -p tsconfig.test.json --noEmit` exited 0 on the final code. Earlier runs caught one JsonValue typing error and one narrowing error, both fixed.
- **Job spec runs.** Each was `pnpm test:e2e e2e/site-reset/tests/offline-first-job.spec.ts --workers=1`, run from `apps/extension`.
  - Run 1 (single-subflow plan): `1 failed`. No `NNNN-offline` folder existed. The rev 1 "no" came back `not_judged`, "the judge's reply could not be read".
  - Run 2: `1 failed`. Callable subflows must be written as a `part <key>:` block (`subflow.target_part_missing`).
  - Run 3: `1 failed`, but offline ran: `0021-offline outcome=inconclusive`, `0025-offline outcome=passed`. A scripted "no" with `defects: []` settles `unsure`, so the rev 2 offline check was inconclusive.
  - Run 4: `1 passed (2.8m)`, test `(1.0m)`.
  - Run 5: `1 failed` on a new assertion. 2 commands reached the site during the kept test.
  - Run 6, the final code: `ok 1 ... (51.0s)`, `1 passed (3.0m)`. `siteActs.test-2 = ["web.dom.capture_snapshot","web.dom.capture_snapshot"]`. Tests 1 and 3 each sent `navigate`, `extract_list` and 7 captures.
- **Photo spec.** `pnpm test:e2e e2e/site-reset/tests/offline-first-photo.spec.ts --workers=1` gave `ok 1 ... (2.0m)`, `1 passed (2.4m)` on the first run with the final code. The judge runs were `open:yes x2, posts-1:no x2, posts-2:no x2, posts-3:yes x4, whole:yes x2`.
- **Existing spec.** `pnpm test:e2e e2e/site-reset/tests/repair-first.spec.ts --workers=1` gave `ok 1 ... (1.2m)`, `1 passed (3.3m)`.
- **Structure audit.** From the downstream root, `node scripts/structure-audit.mjs` printed `structure-audit: passed (227 warning(s), 616 baselined).` The only new advisory is `site-reset/tests/: 17 source files is past the 15-file advisory threshold`.

### Step folders of the passing photo run (names and outcomes only)

```
0001-tool-project.read_task      0002-tool-project.write_plan      0003-tool-project.dispatch
0004-tool-core.run_node          0005-tool-core.run_node           0006-tool-core.submit_subflow
0007-tool-core.test_subflow      0008-offline outcome=refused:no_live_source   0009-reset site_check:admit
0010-tool-project.dispatch       0011-tool-core.run_node           0012-tool-core.run_node
0013-tool-web.detect_repeating_structure  0014-tool-core.run_node  0015-tool-core.submit_subflow
0016-tool-core.test_subflow      0017-offline outcome=refused:no_live_source   0018-reset site_check:admit
0019-tool-core.submit_subflow    0020-tool-core.test_subflow       0021-offline outcome=kept_no (matched 7/7, 9042 ms)
0022-tool-core.submit_subflow    0023-tool-core.test_subflow       0024-offline outcome=passed (matched 7/7, 7138 ms)
0025-reset site_check:admit      0026-tool-project.assemble        0027-tool-core.test_candidate   0028-reset site_check:admit
```

- In `0020-tool-core.test_subflow/result.json`: `verdict: "no"`, `checkedAgainst: "recorded_run"`.
- In `0023-.../result.json`: `verdict: "yes"`, with `offlineCheck` keys `outcome` (`"passed"`) and `said`.
- The job run's listing is identical, step for step.

## Not verified

- No Core code was changed, and no Core tests were run beyond the build. No full suites, no Lab runs, no model calls.
- The step log writes no folder for scripted judge calls, so the offline and live judge calls are told apart only by the spec's own judge log. No `NNNN-judge` folders exist with a scripted provider.
- Only tier 1 was exercised: computation-only changes. No gap path (a changed read or target) runs here; that is covered by B8's unit tests only.
- Firefox was not exercised; the e2e config runs Chromium only.

## Open questions or contradictions found

1. **Brief vs D40: offline-first is impossible on a single-subflow plan.**
   - On a one-subflow plan, the builder's `core.test_subflow` goes through `AutomationStudioProjectWholeTestPort` (Core `project-agents/single-subflow/whole-test-port.ts`). That port carries no `offlineFirst`, by D40.
   - Run 1 showed it: no `NNNN-offline` folder at all, and the answer's feedback said "This test ran the whole Flow ... as the build's judged run".
   - So the brief's "revision 3 live yes = the final judged run" can only hold if the plan has two subflows and the final judged run is the supervisor's whole test, which is what the specs do.
   - If D40 is meant to allow offline-first in a single-subflow plan's builder tests (before the final judged run), that is a Core change for the lead to decide.
2. **A kept offline answer still sends two `web.dom.capture_snapshot` commands to the live site.** This is probably the trial's start/end page views (`pageAfterTrial`). They are reads, not acts, and nothing is navigated, read or acted on. The spec allows captures only. If "nothing done on the site" should mean no command at all, the source is in Core's subflow gate / dispatch around the kept answer, not in this harness.
3. **Harness requirements Core enforces, which future scripted specs need:**
   - A scripted judge "no" must list `diagnosis.defects` (`llm/harness/provider-result.ts:53-55`).
   - A "no" none of whose defects Core can locate is re-asked and settles `unsure` (`result-verification/agreement/unsupported-no.ts`), and an offline `unsure` is `inconclusive`, never kept.
   - The specs name real missing or extra rows: by title on job-board, by post code on photo-social.
4. **B8's report wording vs observed output.** B8 wrote the not-tried note as `refused:no_source`. The observed outcome is `refused:no_live_source`.
5. **`apps/extension/e2e/site-reset/tests/` is past the 15-file advisory.** A later tidy could move the offline-first specs into their own subfolder.
