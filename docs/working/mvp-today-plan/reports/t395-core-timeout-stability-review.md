# t395 — Core timeout stability review

## Verdict

**GO.** The exact three test-local 60,000 ms budgets are implemented, the complete three-file run
passed, and the authorized idle-lane Core root `pnpm test` rerun passed all four participating
workspace packages. The global 15,000 ms timeout, concurrency, and production code are unchanged.

This closes the timeout-stability blocker for root test. The supervisor still owns integration
with the other Core closure gates and any commit/finish/push decision.

The failures remain inconsistent with deterministic product regressions. All three failed at the
shared 15,000 ms Vitest ceiling in t388 without assertion failures, then passed in t388 as
exact-name isolated tests. In this review, all nine additional serial isolated repetitions passed,
and all three also passed when launched concurrently in separate Vitest processes. The authorized
root rerun nevertheless reproduced two timeouts and pushed the third to 14,670 ms. The supported
classification is **known full-suite load / shared machine and filesystem pressure with an
undersized local budget**, not a shared-path collision and not a functional assertion failure.

Only the three assigned Core test files and this worker report were edited. No production source,
global config, concurrency, generated data, or shared working document changed. No build, docs,
downstream, provider, live, panel, browser, Lab, stage, commit, or push command ran.

## Authorized root rerun

From `F:\!FluxIQ`, with t385 held and no concurrent build/test/live work, I ran `pnpm test`
exactly once. It exited 1.

| Workspace package | Result |
| --- | --- |
| `@fluxiq/contracts` | 9 files passed; 53 tests passed |
| `@fluxiq/client-gateway-websocket` | 1 file passed; 3 tests passed |
| `fluxiq` | 2 files failed, 412 passed (414); 2 tests failed, 4,033 passed, 1 skipped (4,036) |

FluxIQ duration was 214.89 s. It reported no warning lines. The TypeDoc test emitted normal
informational stdout for generated HTML and JSON in its unique OS temp directory. The one skip was
the already intentional skip in `runtime/service/tests/bootstrap-adaptations.test.ts`.

The three reviewed cases under the full suite were:

| Case | Root rerun result | Full-suite time |
| --- | --- | ---: |
| diagnosis-only execution grant | **FAIL**, 15,000 ms timeout | 18,845 ms reported |
| global-to-domain Call Flow grant | PASS | 14,670 ms |
| Flow expansion summary pages | **FAIL**, 15,000 ms timeout | 15,075 ms reported |

No assertion failed. Both failures were solely `Test timed out in 15000ms`. The canonical case's
14,670 ms pass leaves 2.2% headroom and corroborates the same full-suite sensitivity.

## Implemented correction

The following three `it(...)` calls now have a third-argument `60_000` timeout and no functional
assertion changes:

- `runtime/tests/service-adaptation/tests/llm-grants.test.ts`: diagnosis-only execution grant;
- `runtime/tests/service-flows/tests/canonical-persistence.test.ts`: global-to-domain Call Flow
  grant; and
- `runtime/tests/service-flows/tests/scale-pages.test.ts`: Flow expansion summary pages.

The opening `scale-pages.test.ts` comment now describes its three fixture-heavy locally budgeted
cases and records that the local budget preserves the global 15-second hang guard and explicit
query-speed assertions. No other comment or behavior changed for this correction.

Path-scoped `git diff --check` over the three files passed with no whitespace errors. Git emitted
only its Windows line-ending advisory that LF will become CRLF when it next touches the files.
The scoped diff also showed pre-existing t166 edits in `llm-grants.test.ts`; this worker did not
alter or claim those changes.

## Post-fix validation

The three complete files ran together from `packages/fluxiq` rather than through name filters:

`pnpm exec vitest run <llm-grants> <canonical-persistence> <scale-pages> --reporter=verbose`

Result: **PASS**, 3/3 files and 17/17 tests, 18.58 s command duration. The corrected cases measured
4,584 ms, 3,599 ms, and 4,929 ms respectively. Both previously budgeted scale cases also passed.

The single authorized post-fix root `pnpm test` then passed:

| Workspace package | Result |
| --- | --- |
| `@fluxiq/contracts` | 9 files; 53 tests passed |
| `@fluxiq/client-gateway-websocket` | 1 file; 3 tests passed |
| `fluxiq` | 414 files passed; 4,035 tests passed, 1 intentional skip; 202.13 s |
| `apps/web` | 246 files; 1,346 tests passed; 36.06 s |

Aggregate: **670 files passed; 5,437 tests passed; 1 intentional skip; 0 failures**. Under the full
suite, the corrected cases passed at 17,954 ms, 12,408 ms, and 20,587 ms respectively. Those
measurements directly confirm that the test-local budgets cover observed suite pressure while the
global guard remains intact.

The root run emitted expected web-test stderr: repeated React test renderer deprecation notices
and testing-environment `act(...)` notices. They did not represent test failures. Core's TypeDoc
test also emitted normal informational stdout for temp-directory HTML and JSON generation.

## Configuration and source evidence

- `packages/fluxiq/vitest.config.ts` sets both `hookTimeout` and `testTimeout` to 15,000 ms. It does
  not cap workers, disable file parallelism, or install shared test setup.
- Each affected file creates a unique directory with `mkdtemp` under the OS temp directory in
  `beforeEach`, tracks its own `AutomationStudioService` instances, closes them in `afterEach`, and
  recursively removes only its unique temp directory. The three files therefore do not share a
  database path or mutable fixture directory.
- The grant and canonical persistence cases perform multiple service/database operations, but
  have no sleeps, external provider calls, wall-clock waits, or test-local 15-second expectation.
- The expansion-pages case creates a 10,000-item in-memory fixture and serially persists 35 run
  details plus 13 adaptations before querying pages. It is intentionally storage/CPU intensive,
  but no assertion depends on the total test duration.
- `scale-pages.test.ts` already documents the established Core policy for genuinely heavy scale
  cases: keep the global 15-second hang detector, give only the two measured 10,000-item scale
  tests a 60-second local budget, and retain explicit sub-500 ms query assertions. The timed-out
  expansion-pages test is not one of those locally extended cases. Its repeated isolated and
  three-process concurrent measurements do not justify adding an override now.

## Measurements

The t388 exact-name reruns had already passed:

| Case | t388 test time | t388 command time |
| --- | ---: | ---: |
| diagnosis-only execution grant | 2,602 ms | 7.22 s |
| global-to-domain Call Flow grant | 2,487 ms | 6.97 s |
| Flow expansion summary pages | 2,844 ms | 7.32 s |

This review repeated each exact test three times serially:

| Case | Test-body times | Command durations |
| --- | --- | --- |
| diagnosis-only execution grant | 2,891 / 3,266 / 2,688 ms | 8.21 / 8.52 / 7.74 s |
| global-to-domain Call Flow grant | 2,891 / 2,733 / 2,564 ms | 7.92 / 7.91 / 7.32 s |
| Flow expansion summary pages | 3,045 / 2,885 / 3,041 ms | 7.91 / 7.96 / 7.83 s |

All nine passed. The slowest body was 3,266 ms, 21.8% of the 15-second ceiling.

A narrow contention probe then launched only these three exact-name tests concurrently in three
separate Vitest processes. All passed:

| Case | Concurrent test time | Concurrent command duration |
| --- | ---: | ---: |
| diagnosis-only execution grant | 3,747 ms | 9.59 s |
| global-to-domain Call Flow grant | 3,708 ms | 9.45 s |
| Flow expansion summary pages | 4,101 ms | 9.85 s |

The slowest concurrent body was 4,101 ms, 27.3% of the ceiling. Ordinary contention among these
three cases is therefore insufficient to reproduce the failure. The common shift from roughly
2.5–3.3 seconds to exactly 15 seconds during a 414-file / 4,036-test FluxIQ run is most consistent
with broader suite and machine pressure.

One attempted Vitest invocation supplying all three file paths as positional filters returned
`No test files found`; Vitest treated the combined positional input as one filter. It executed no
test and is not product evidence. The separate-process concurrent probe replaced it successfully.

## Exact narrow fix and validation rationale

The implemented correction did not change `packages/fluxiq/vitest.config.ts`, worker concurrency,
or production code. It added `60_000` as the third argument to exactly these three `it(...)` calls:

1. `service-adaptation/tests/llm-grants.test.ts` — `binds and revokes a diagnosis-only execution
   grant without persisting session identity`;
2. `service-flows/tests/canonical-persistence.test.ts` — `requires an explicit per-run grant for
   global-to-domain Call Flow execution`; and
3. `service-flows/tests/scale-pages.test.ts` — `persists Flow expansion summaries with paged run
   and adaptation detail reads`.

The existing opening comment in `scale-pages.test.ts` was updated to accurately distinguish its
three fixture-heavy locally budgeted cases from the global 15-second hang guard. No extra comments
were added to the other two files; the report retains the cross-file measurement rationale.

This is narrower than a global timeout increase and follows the file's existing 60-second local
budget convention. The tests' isolated behavior remains visible in Vitest timing, their functional
assertions remain unchanged, and the scale test's explicit sub-500 ms query performance assertions
remain intact. The required idle-lane root rerun is green; isolated passes were not used as closure.

## Scope and verification limits

I inspected and edited only the three named tests, their local lifecycle setup, the FluxIQ Vitest
config and package test script, plus t388's recorded root results. I ran the complete three-file
validation and one post-fix root suite after explicit authorization, and inspected their complete
results. I did not inspect or change production implementation. The supervisor must review the
diff and integrate it; this worker report is evidence, not independent supervisor verification.
