# w2x-t027-gate-triage

Worker report for `### Brief: w2x-t027-gate-triage`. Worktrees:
`F:\fxwork\t027\!FluxIQWebExtension` and `F:\fxwork\t027\!FluxIQ`, branch
`task/t027-multi-action-exploration` in both. Nothing is committed.

## Outcome

**Partial.**

- The downstream gate is green. `pnpm -r --no-bail test` exited 0 with every package passing, and `pnpm build` exited 0.
- All 8 failures named in the brief are fixed at their cause, along with the stale-`dist` item: 3 downstream, 5 in Core web.
- Core `pnpm build` exited 0. Core `apps/web` passed 1245 of 1245 in three full runs in a row.
- Core `packages/fluxiq` never reached "only the t035 failure" in a full run. Every other failure in it is a load-induced timeout, or damage a timed-out test did to the tests after it. Each such test I timed alone passed, most in 3 to 8 s against a 15 s budget. Other agents' Chrome and Node processes were loading the machine to 80-100% CPU during most of the runs. The best run had 4 failures: t035's, plus 3 load-induced ones.

## What changed and why

### Open item 9: test-runner `dist` is cleared before each build

`packages/test-runner/package.json`:

- New script: `"clean": "node -e \"require('node:fs').rmSync('dist',{recursive:true,force:true})\""`.
- `build` is now `pnpm domain:dist && pnpm clean && tsc -p tsconfig.json`. The `domain:dist` guard is unchanged and still runs first.
- Proof that a deleted test no longer runs:
  1. I added `src/tests/zz-w2x-stale-probe.test.ts` and ran `pnpm build`. `dist/tests/zz-w2x-stale-probe.test.js` existed.
  2. I deleted the source and ran `pnpm build` again. `ls` then said `No such file or directory`, and `node --test "dist/tests/zz-*.test.js"` reported `# tests 0`.
- Each build took about 10 s.
- `test` is `pnpm build && node --test "dist/**/*.test.js"`, so it gets the clean too.

### 1. `generation failures retain only Core-validated bounded diagnostics` (downstream)

- **Cause: a Core bug that t027 introduced**, in commit `949735d` ("Expose panel bootstrap preflight diagnostics"). That commit is not on `dev`.
- In `generation-failure.ts`, `phaseFailureStateMatches` requires accounting for any pre-provider code that starts with `flow_bootstrap.pre_provider_`.
- That prefix also matches the phase's default code, `flow_bootstrap.pre_provider_validation_failed`. `flowBootstrapPhaseFailure` produces that code without accounting.
- So Core refused a diagnostic it had produced itself, and it would also refuse any stored diagnostic from before t027. The downstream sanitizer then fell back to `generation.http-400`.

Fix, in Core `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure.ts`:

- The prefix test is replaced by an exact list, `FLOW_BOOTSTRAP_HARNESS_PREFLIGHT_CODES`. It holds the 12 codes that `preProviderHarnessFailureCode` can return, declared `as const satisfies readonly AutomationStudioFlowBootstrapPhaseFailureCode[]`.
- `preProviderHarnessFailureCode` is now typed to return a member of that list. The compiler therefore keeps the two in step.
- The file is now 771 lines, under the 800 limit.

Core test added to `.../flow-bootstrap/tests/generation-failure.test.ts`: "parses back every pre-provider failure Core produces, with accounting only where the harness keeps it". It checks:

- The fallback failure parses.
- The fallback failure is refused when accounting is added.
- Three harness codes parse with their accounting, and are refused without it.

Against the source as committed at HEAD, the new test fails (`1 failed | 44 passed`). With the fix, the file passes 45 of 45. After rebuilding Core `dist`, the downstream test passes 4 of 4 with no edit.

### 2. `a dataset task is built, settled, applied, run ...` (`flow-lane/creation/tests/lane.test.ts`)

- **Cause: already on `dev`.** Commit `4a39262` (t011) added `instructedConsequencesOf` to `build-proposal.ts`. It reads the stored proposal through `get-flow-adaptation` after the build.
- That commit taught the fake Core the endpoint, and `build-proposal.test.ts` already expects the call. `lane.test.ts` kept its old expected call order.
- Fix: `"get-flow-adaptation"` is inserted after `"get-adaptation"` in the expected order. No other assertion changed.

### 3. `rejects reused, applied, cross-scope, and over-budget proposals` (`tests/demo-llm-exploration-adaptation.test.ts`)

- **Cause: a contract t027 changed on purpose.** Commit `03c20a6` ("Surface bounded terminal repair outcomes") raised `FIRST_LIVE_ADAPTATION_PROFILE.budget` to the Lab's per-request budget of 48,000 input, 8,000 output and 56,000 total tokens. It updated the sibling `demo-llm-adaptation.test.ts`, but this test still hard-coded 9,000 input tokens as "over budget".
- Fix: the case now reads its limits from the profile. It asserts three things:
  - Exactly `maxInputTokens` is accepted.
  - `maxInputTokens + 1` input is refused.
  - `maxOutputTokens + 1` output is refused.
- Both refusals must carry `reasonCode === "exploration_adaptation_run.provider_accounting_invalid"`. Before, any refusal with "strict contract" in its message satisfied the case, so this is a stricter check.

### 4 and 5. Core web source contracts: `runs graph conversion only while a graph subscriber is mounted` and `connector domain scopes are destination-local`

- **Cause: already on `dev`, and specific to how the worktree is checked out.** No commit in `dev..HEAD` touches these files.
- Core has no `.gitattributes`, and `core.autocrlf=true`. So the t027 Core worktree writes CRLF: `git ls-files --eol` shows 2150 files `w/crlf`. In the main `F:\!FluxIQ` checkout, both sources are `w/lf`.
- Both tests compare the source against text containing LF newlines, such as `"subscribersActive\n  ]"`.
- Fix: both tests convert CRLF to LF when they read the source (`.replace(/\r\n/gu, "\n")`). The comparisons run against the committed text. No assertion changed.

### 6 to 8. Core web `login attempt bounds` (5 failures in my run, not 3)

- **Cause: already on `dev`.** No `dev..HEAD` commit touches `apps/web/src/app/api/auth`.
- Each login makes up to six locked read-modify-write cycles against the file-backed attempt store.
- In the full suite, three cases exceeded Vitest's default 5 s budget (5127, 5222 and 5140 ms).
- A timed-out case keeps running. It then calls `fixture.authenticate.mockResolvedValue(successfulLogin(...))` while the next case is running. That produced two more failures:
  - `keeps the lower per-username bound`: expected 401, got 200.
  - The whole-panel case (49.5 s): its status list did not match.
- Durations alone:
  - First run: 317-461 ms for the 25-login cases, 1.4-2.1 s for the 100-login cases.
  - Second run, with other agents loading the machine: 551-2637 ms and 2.6-6.2 s.
- Change: `describe("login attempt bounds", { timeout: 60_000 }, ...)`, with a comment explaining it. The file already gives its whole-panel cases this same 60 s budget.
- **This changes the time budget, not the code under test.** No assertion changed. In the next three full Core runs, `apps/web` passed 1245 of 1245.

### Extra budget change: Core `generates a TypeDoc-backed framework reference` (`packages/fluxiq/src/programs/tests/global-docs.test.ts`)

- It took 12.4 s and 13.7 s alone, against a 15 s budget, and 15.15 s in the suite.
- The budget is now 60 s, with a comment.
- **This is a budget change, not a fix.** Drop it if you would rather keep 15 s.

## Commands run and observed results

Downstream (`F:\fxwork\t027\!FluxIQWebExtension`, `FLUXIQ_TEST_ENV_FILES=none`):

- `pnpm -r --no-bail test`, first run, at 2m49s, before the load dropped:
  - All packages passed except `packages/test-runner`: 1194 of 1195.
  - The failure was `serializes simultaneous independent-run writes with one complete valid winner`, "Timed out waiting for the scoped clone cache lock", after 12,317 ms. This is the product's `LOCK_TIMEOUT_MS = 10_000` in `clone-cache.ts`, which t027 does not touch.
  - Alone, that test passed three times, in 7290, 4925 and 5690 ms.
- `pnpm test` inside `packages/test-runner`: 1195 of 1195, fail 0, in 1m50s.
- `pnpm -r --no-bail test`, second run, 1m13s, **exit 0**:

| Package | Passed |
| --- | --- |
| test-contracts | 119/119 |
| boundary-audit | 6/6 |
| real-site-policy | 7/7 |
| test-matrix | 17/17 |
| domain | 695/695 |
| agent-orchestrator | 16/16 |
| test-evidence | 17/17 |
| scenario-lab | 331/331 |
| extension | 690/690 |
| test-runner | 1195/1195 |

- `pnpm build`: exit 0.
- `node scripts/structure-audit.mjs`: passed, 83 warnings, 122 baselined.

Core (`F:\fxwork\t027\!FluxIQ`, `FLUXIQ_TEST_ENV_FILES=none`). I rebuilt the `fluxiq` package with `pnpm build` after the fix, because downstream imports Core's `dist`. Five full runs of `pnpm -r --no-bail test`:

| Run | contracts | gateway | fluxiq | web |
| --- | --- | --- | --- | --- |
| 1, before the web and TypeDoc changes | 53/53 | 3/3 | 2 failed, 2686 passed, 1 skipped: t035, and TypeDoc timed out at 15,153 ms | 5 failed, 1240 passed: login |
| 2 | 53/53 | 3/3 | Vitest's worker pool crashed partway ("Maximum call stack size exceeded" in `PromiseRejectCallback`, then a worker pool TypeError); 5 timeouts and 4 EBUSY failures before it stopped | 1245/1245 |
| 3, `pnpm test` inside `packages/fluxiq` at 100% CPU | n/a | n/a | 51 failed, 2637 passed; 47 of the 51 timed out | n/a |
| 4, lower load | 53/53 | 3/3 | 4 failed, 2684 passed, 1 skipped | 1245/1245 |
| 5, 80% CPU at start | 53/53 | 3/3 | 14 failed, 2674 passed | 1245/1245 |

The 4 fluxiq failures in run 4:

- t035's `fails a run that stored nothing`.
- `bridges a generated proposal ID ...` timed out at 15,077 ms. Alone: 3886 and 4120 ms.
- `keeps a repaired run's recovery annotation ...` timed out at 15,039 ms. Alone: 3215 and 3446 ms.
- `asks again after a decision that runs past its deadline` failed after 13,378 ms with `expected {...} to be undefined`. Alone it passed in 6539 and 5854 ms. Its own comment says a heavily loaded machine can make its 3 s decision deadline cut into the grant's authorization. t027 touched this file (`949735d`, `f40f78e`).

Other load-induced fluxiq failures I measured alone:

- `turns mapped observations ...` (`service-recordings/tests/proposals.test.ts`): 7943, 6610 and 8270 ms. One solo run during heavy load hit 15.1 s.
- `applies and reverts a parent-scoped adaptation`: 4311 ms.
- `writes a typed owned-graph adaptation`: 5162 ms.
- `tails and reconnects runtime streams ... at a million events`: 57,958 ms against its 60 s budget, run in a batch of five files. When it times out, it leaves the SQLite file open, and the next four tests in `runtime-stream-store.test.ts` fail with `EBUSY ... project.sqlite`.

Other checks:

- Core `pnpm build`: exit 0. It ran `next build` through "Compiled successfully" and "Generating static pages (16/16)".
- `apps/web`: `npx tsc --noEmit` exit 0.
- `packages/fluxiq`: `npx tsc --noEmit` exit 0.
- `node scripts/structure-audit.mjs`: passed, 170 warnings, 361 baselined.

## Not verified

- A full Core run whose only failure is t035's. None of the five runs achieved it.
- Solo durations for these fluxiq timeouts, which appeared only in runs 3 and 5:
  - `persists Flow expansion summaries` (one solo run with the default budget hit 15,093 ms under load).
  - `requires an explicit per-run grant for global-to-domain Call Flow execution`.
  - `binds domain grants to external global publications`.
  - `finds one active applicable instruction beyond an unfiltered 100-item page`.
  - `pages and filters 10,000 Subflow summaries` (536 ms against its 500 ms performance budget, in the 100% CPU run).
- Whether `dev` has the same fluxiq timeouts. Measuring that would have meant running tests in another worktree, which the brief rules out.
- `pnpm check` in either repository. Only the type checks and structure audits above ran.
- No live, browser or provider run. None was needed: every change here is a test, a test budget, a build script, or the Core diagnostic parser.

## Open questions or contradictions found

1. The validation bar "only the t035 failure may remain" in Core cannot be judged on this machine while other workers load it. In the suite, fluxiq's service tests go from 3-8 s alone to over 15 s. Some suites also have a timed-out test that breaks the tests after it: the login test's shared mocks, and the runtime-stream-store's open SQLite file. I did not raise any fluxiq budgets beyond TypeDoc's. The Core gate needs either a run on a quiet machine or a decision about budgets.
2. Core has no `.gitattributes`, so every Core worktree under `F:\fxwork` is checked out with CRLF. The downstream repository sets `text=auto eol=lf`. Doing the same in Core would remove this whole class of source-contract failure. That is a repository-wide decision, so I only made the two tests tolerate CRLF.
3. The brief listed three `login attempt bounds` failures. My first run had five: the three timeouts plus the two failures they caused.
4. `clone-cache.ts`'s 10 s lock wait is a product timeout that load can trip. It failed once in the downstream suite. I did not change it.
