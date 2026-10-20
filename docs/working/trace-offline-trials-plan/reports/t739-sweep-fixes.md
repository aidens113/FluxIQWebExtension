# t739 sweep-1020 fixes (lead report)

Trees: `fxwork/t739/!FluxIQWebExtension` and `fxwork/t739/!FluxIQ`, both on
`task/t739-sweep-1020-fixes` (downstream 89cadfd8, Core f8c98710).
Source: `reports/sweep-1020.md`, logs in `fxwork/sweep-1020/logs/`.

## Plan

1. photo-social scenario-lab (gates a live rerun): newest-likes assertion and
   Glaze close-dialog timeout. One worker-high, run alone so browser timing is
   not confounded by other load from this lane. Owns
   `apps/scenario-lab/src/scenarios/photo-social/**`.
2. Core packages/fluxiq timeouts: rerun alone and in directory (lead).
3. `scripts/build-cache/tests/registry.test.mjs` pathspec (lead).
4. Extension package tests: one worker after unit 1, owns failing extension
   files only.

Avoid: t736 (trace capture) and t738 (Core site-reset, candidate-trial,
authoring, repeat-guard, subflow-candidate; downstream rejection-next and
output-node definitions).

## Log

### 2026-10-20 unit 2: Core 15 s timeouts are environmental

Alone, in the t739 Core tree, `npx vitest run` on the four files: 4 files,
12 tests passed; the four named tests took 1292 ms (controller), 1524 ms
(command-execution runtime), 441 ms (provider-unavailable carries on),
1185 ms (flow-index-read). Duration 51 s.

In their directories (`service/command-context/tests`,
`service/command-execution/tests`, `tests/service-bootstrap/tests`,
`tests/service-flows/tests`): 44 files, 218 tests passed, 140 s.

Evidence of load in the full suite: in sweep-1020 the files took
service.test.ts 45.8 s, controller.test.ts 40.5 s, provider-unavailable 28.5 s,
flow-index-read 15.8 s (a one-test file that takes 1.2 s alone). In sweep-1019b
the same files passed at 36.9 s, 21.7 s, 8.9 s and 9.9 s, and a different set of
real-SQL/file integration tests timed out instead (whole-operation, creation,
cancel-parked-run, promotion-tier). The package run took 1845 s (1020) and
2009 s (1019b). The failing set rotates among heavy real-SQL integration tests
under full-suite worker contention, 8 to 15 times slower than alone. No code
change: no timeout raised, no assertion touched.

### 2026-10-20 unit 3: registry test, real in every checkout

Reproduced in the t739 worktree (a normal branch checkout, not detached):
`node --test scripts/build-cache/tests/registry.test.mjs` -> `# pass 8 # fail 1`,
`fatal: empty string is not a valid pathspec`.

Cause: t730 (4441cde5) set `apps/scenario-lab/tsconfig.e2e.json` `rootDir` to
`"../.."`, the repository root, so the e2e specs could import
`packages/test-runner/src/realistic-scenarios`. The test relativises that to
`""` and hands it to `git check-ignore`. Mapping it to `"."` exposed the real
finding: `scenario-lab:check: apps/scenario-lab/tsconfig.e2e.json rootDir
"../.." -> <repo root>` is outside the step's fingerprint. The expensive proof
agreed: `node scripts/build-cache/prove-inputs.mjs scenario-lab:check` ->
`FAIL ... tsconfig.e2e.json ... outside every input root:
packages/test-runner/src/realistic-scenarios/index.ts`. So the cached e2e check
would not rerun when the realistic-scenarios list changed.

Fix:
- `scripts/build-cache/steps.mjs`: `scenario-lab:check` declares
  `reads: ["packages/test-runner"]`.
- `apps/scenario-lab/tsconfig.e2e.json`: a noEmit project; unsets the inherited
  emit layout (`rootDir: null`, `outDir: null`) instead of widening rootDir to
  the repository root. TypeScript parses both as unset (checked with
  `ts.parseJsonConfigFileContent`: rootDir undefined, outDir undefined, 0 errors).
- `scripts/build-cache/tests/registry.test.mjs`: asks git about the repository
  root as `"."`, so a root reference reports a finding instead of crashing.

Checks:
- `npx tsc -p tsconfig.e2e.json` (apps/scenario-lab) -> exit 0.
- `node --test scripts/build-cache/tests/*.test.mjs` -> `# pass 25 # fail 0`.
- `node scripts/build-cache/prove-inputs.mjs scenario-lab:check` -> both
  listings `ok`, `inputs proved complete for 2 listing(s)`.
- `pnpm --filter @fluxiq-web-extension/scenario-lab check` -> exit 0 (ran, no stamp).

UNIT READY: scripts/build-cache/steps.mjs scripts/build-cache/tests/registry.test.mjs apps/scenario-lab/tsconfig.e2e.json

### 2026-10-20 unit 1: photo-social (worker-high, verified by the lead)

Worker report: `reports/t739-u1-photo-social.md`.

(a) newest-likes, missing `DPIEH3I491a`: a fixture defect, not a recent
change. The post's heart drew "Unlike" before `act('like')` returned, so the
recording (which waits for the turned heart, then opens the next post) could
navigate while the request was in flight; the navigation aborted it and the
server never had the like. The heart has worked this way since 3a62305e; the
sweep's load made the server answer late enough to expose it. Fix in
`client/post-script.ts`: the heart turns once the server has the like, as the
bookmark, follow, notifications, session and consent controls already did.
New test in `tests/breadth-paths.test.ts` runs the newest-likes recording with
every photo-social API answer delayed 400 ms; the worker saw it fail on the old
heart (`liked: []`) and pass with the fix.

The dock had the same flaw (the worker reported it and left it). The lead
applied the same rule in `client/overlay-script.ts` (collapse drawn after
`act('dock')` returns) with a test first in `tests/honest-and-naive-paths.test.ts`
("lasting controls show done only once the server has it": collapse with a
400 ms server, leave as soon as the pill shows, the dock must stay collapsed on
the next page). Observed on the old dock: `not ok 1 ... the dock expanded again:
the collapse never reached the server`; with the fix: `ok 1`, `# pass 1`.

(b) Glaze collection, close-dialog click timeout: did not recur in any run,
idle or with 6 parallel sessions under 4x CPU throttling; the worker found it
only under deliberate overload, where every step times out somewhere (save-first,
collapse-dock, dock-expanded, offer-collection). Recorded as renderer starvation
during the whole-package sweep (the failing test took 20.4 s against about 10 s
idle). Not proven on the sweep run because the driver kept only the first line
of Playwright's error; `tests/recording-driver.ts` now keeps the last lines of
Playwright's call log in a step failure, so a repeat says what the click waited
on. No timeout raised.

Oracle: `breadth/newest-likes/expected.ts` unchanged: 3 records, record by
record, matching `data/studio-posts.ts`; final state `liked` exactly those 3.
Instruction unchanged ("address" follows the realistic-task convention; a test
forbids URL paths in instructions). Honest path proven provider-free by the
breadth test and its slow-server twin.

Checks (lead, t739 tree):
- `pnpm --filter @fluxiq-web-extension/scenario-lab build` -> built.
- `node --test dist/scenarios/photo-social/tests/*.test.js dist/scenarios/photo-social/breadth/tests/*.test.js`
  -> `# tests 46 # pass 46 # fail 0` (5 files).
- `node --test dist/scenarios/tests/realistic-site-live-tasks.test.js dist/scenarios/tests/live-instructions.test.js`
  -> `# tests 17 # pass 17 # fail 0`.
- `pnpm run test:e2e:build` then `playwright test -c e2e/playwright.config.ts e2e/site-reset/tests/photo-toggle.spec.ts --output <scratch>`
  (apps/extension, headed per the fixture) -> `1 passed (1.9m)`; it likes and
  unlikes on photo-social through the installed build.
- `node scripts/structure-audit.mjs` -> `passed (212 warning(s), 618 baselined)`.
- `pnpm --filter @fluxiq-web-extension/scenario-lab check` -> ran, exit 0.

Not verified: the scenario-lab photo-social test files hard-code
`headless: true` (unchanged, pre-existing), so those runs were headless; the
extension spec ran headed. (b)'s cause is inferred, not shown on the sweep run.

UNIT READY: apps/scenario-lab/src/scenarios/photo-social/client/post-script.ts apps/scenario-lab/src/scenarios/photo-social/client/overlay-script.ts apps/scenario-lab/src/scenarios/photo-social/breadth/newest-likes/workflow.ts apps/scenario-lab/src/scenarios/photo-social/tests/breadth-paths.test.ts apps/scenario-lab/src/scenarios/photo-social/tests/honest-and-naive-paths.test.ts apps/scenario-lab/src/scenarios/photo-social/tests/recording-driver.ts docs/working/trace-offline-trials-plan/reports/t739-u1-photo-social.md

### 2026-10-20 unit 4: extension package tests pass in full

Worker report: `reports/t739-u4-extension-tests.md`. Run alone in apps/extension:
`EXTENSION_TEST_BUILD_LABEL=t739-u4 pnpm test` -> exit 0; the lead read the
saved log: `# tests 3220 # pass 3220 # fail 0 # cancelled 0 # skipped 0`, no
`not ok` line, about 4.8 min. The sweep's extension run was cut off only
because pnpm stopped the parallel package runs when scenario-lab failed.
agent-orchestrator does not appear (deleted in t727, expected). No code change.

## Summary

- Units 1 and 3 fixed (committed by the supervisor as 0d46c0b7 and 28a6e142).
- Unit 2: environmental, no change; evidence above. A structural option for
  the supervisor, not done here: the rotating real-SQL timeouts come from
  full-suite worker contention, so a separate low-concurrency vitest pool for
  Core's real-SQL integration tests would stop them; that is a Core config
  decision.
- Unit 4: nothing failing.
- The Core t739 tree has no changes.

UNIT READY: docs/working/trace-offline-trials-plan/reports/t739-sweep-fixes.md docs/working/trace-offline-trials-plan/reports/t739-u4-extension-tests.md
