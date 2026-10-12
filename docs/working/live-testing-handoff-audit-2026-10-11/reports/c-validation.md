# C validation — 2026-10-11

Status: Complete
Owner: c-validation worker
Scope: Surviving paired t274 fixes; no commits, merges or browser/provider calls.

## Findings

Reviewed all existing dirty source/test diffs and the three prior reports. The changes remain scoped to candidate completion feedback/endings, preservation of candidate finishing tools during look withdrawal, and domain pagination guidance. No source defect found and no original dirty source changed.

Core output at intake already contained all three implementation changes; cached library builds reported matching stamps. For independent evidence, subsequently ran the library owner's clean/build/declaration-rewrite/identity commands directly, bypassing cache reuse. That rebuild exited 0.

## Checks observed so far

- Focused Core candidate directory, conversation commands directory, loop-budget, look-withdrawal finishing tools and state-digest-cost: 20 files / 215 tests passed.
- Actual Core typecheck: `pnpm.cmd exec tsc --noEmit -p tsconfig.json --incremental false` in packages/fluxiq, exit 0.
- Input coverage proof: `node scripts/build-cache/prove-inputs.mjs fluxiq:check`, exit 0: 3324 compiler files, 2945 fingerprinted, 379 installed, none outside roots.
- Downstream instructions tests with own label c-validation-1011: 14 passed; includes Core seam acceptance against rebuilt output.
- Initial domain check and direct audits subsequently passed; final post-B-fix checks below supersede these intake checks.

## Limits

Unit/integration evidence does not show how a live model reacts to revised guidance. No browser/provider launch, panel management, full suite, commit or merge performed.

## B final-decision fix (supervisor brief expansion)

Confirmed saved B diagnosis against source: candidate wrap-up explicitly withdrew its submit/test tools at decisionsLeft=1. The trial gate then had no legal path to finish an untested accepted receipt.

- Added fail-first regression in loop-budget tests: final counted decision keeps finishing tools and accurate guidance. Before implementation, 2 assertions failed (tools=[] and completion-only instruction).
- Removed final-decision withdrawal for candidate finishing tools; draft wrap-up unchanged. Final candidate guidance now says to test an untested exact receipt, and completion still requires yes when a runner is available.
- Accepted submission evidence now names an exact core.test_candidate call with returned revision/digest, says not to complete until yes, and explains that resubmission requires a fresh trial.
- Added actual authoring-loop regression: submit with reported cost leaving count=1, observe trial tool and exact receipt guidance, test exact revision/digest, then complete after yes. This tests heuristic cost-count behavior using mocked usage, not real provider reservation. Existing purse authority tests and trial refusal/reset tests remain unchanged and pass.
- Focused post-fix checks: loop-budget, authoring-loop, trial-gate and look-withdrawal finishing tools: 4 files / 59 passed.
- Direct Core structure audit after fix: passed, 330 warnings / 1159 baselined.
- Core build and actual package typecheck currently completing; downstream final freshness/check to follow.

## Cache investigation

No defect reproduced. Coverage proof includes every compiler-loaded input. Fresh byte fingerprints agree with cached-stat fingerprints. In-memory substituted content hashes for authoring-loop, progress, look-withdrawal and the new finishing-tools test each change the check fingerprint, proving these files participate. After the independent rebuild, the registered check correctly detects packages/fluxiq input change and executes tsc rather than reusing the prior stamp. Initial compiled output already contained the prior dirty fixes; why the prior worker saw a stale gate cannot be reconstructed from the current tree alone.

### Final verification progress

Core package check initially found TS18048 in the new regression (optional outcome.trial). Corrected the test assertion to outcome.trial?.verdict; rerun of the actual registered Core package check executed and passed. The authoring-loop tests were rerun on this final source: 10 passed. Initial rebuild declined to stamp because comment inputs changed while it ran; stable-source rebuild is running, not claimed as complete yet. Both final structure audits include the supervisor-authored architecture documentation.

### Final results

- Stable-source `pnpm.cmd --filter fluxiq build`: passed, command executed; fresh outputs stored (7198 files), 99.2 seconds.
- Stable-source `pnpm.cmd --filter fluxiq check`: passed, command executed, 19.7 seconds.
- Final `pnpm.cmd --filter @fluxiq-web-extension/domain check`: passed against fresh Core gate; tsc command executed because Core dist/src changed, 33.3 seconds.
- Final labeled instructions rerun against new Core: 14 passed.
- Both git diff --check commands passed; original changes preserved. Added only bounded owned Core changes/tests and this report; supervisor separately owns architecture documentation.
- Final audits verified with native subprocess exit status: Core exit 0 (330 warnings / 1159 baselined); downstream exit 0 (184 warnings / 646 baselined). PowerShell filtering wrappers had returned exit 1 despite passed text; independent native statuses resolve that shell ambiguity.

