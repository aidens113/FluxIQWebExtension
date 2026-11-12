# t904 round 3: double-act-on-run made independent of load

Worker report for lane t904, round 3: item 5 of round 2, under the coordinator's decision. Option 1 is for the
deadline-named cases and option 2 for the cause-agnostic ones. Core tree: `fxwork/t904/!FluxIQ` (dev merged).
Nothing is committed. Heavy jobs ran through `heavy-slot.mjs run t904`.

## Outcome

**Done.** double-act-on-run passes alone and in both rounds under the six-burner load that failed it before. fluxiq tsc is clean, the suites beside each changed file pass, and Core's structure audit passes.

## Cause (from round 2)

`shortRuns` gave the Flow `executionDefaults.timeoutMs: 400`. That became the run's own deadline from its start
(`composite-execution/owner.ts`), on a real `setTimeout` (`engine/automation/composite/child-bounds.ts`). It was meant
to cut one press that never answers, but it also had to cover everything before that press. Under six CPU burners
it cut the run first: Birds was never pressed, so it was never held, and the forward run pressed it.

## What changed and why

**Core product (the seam; every default unchanged):**

| File | Change | Why |
|---|---|---|
| `engine/automation/contracts/graph-execution-options.ts` | `startTimer`'s wait kind is `"region_timeout" \| "run_deadline"`; doc says it also carries the run's deadline. | The run already had a timer seam for region timeouts and virtual clocks; the deadline joins it rather than adding a second one. |
| `engine/automation/composite/child-bounds.ts` | The deadline runs on a `startTimer` parameter, defaulting to `startRealDeadlineTimer` (real `setTimeout`, as before); cancelled through the timer's `cancel()`. | The deadline is the one timer here, and a run's own timer source now decides it. |
| `engine/automation/composite/boundary.ts`, `framework/automation-service/composite-execution/owner.ts` | Pass the run's `startTimer` to `runAutomationStudioChildWithBounds`. | The wiring: a root run's deadline and a Call Flow child's bound both use the run's timer. |
| `engine/automation/regions/execution.ts` | The real region timer's parameter type widened to the new kind union. | Type only: it must still be assignable to the widened `startTimer`. |
| `framework/automation-service/environment/executor-options.ts` | An environment's `startTimer` is placed for every environment kind, not only offline. | The real live environment has no `startTimer`, so a live run is unchanged (the graph-options and virtual-timer tests that pin this still pass). A live environment a test stands in can now name its own. |

One behaviour change, by contract: an offline environment's virtual timers (`scoped.ts`, `virtual-clock.ts`) now also
carry a Flow's deadline in those offline runs, as `AutomationStudioRunEnvironment.startTimer`'s own doc says ("the timer
source this environment's deadlines run on"). Before, offline runs' Flow deadlines stayed on the real clock.

**Core test (`answer-first/tests/double-act-on-run.test.ts`):**

- Option 1, for the deadline-named cases ((c) x2 and (e) "the run's deadline"):
  - The live environment module is mocked with the real environment plus a `startTimer` that holds `run_deadline` waits. Every other wait goes to the real clock.
  - A press that never answers now returns `deadlinePasses()`. That lets the held deadline go on the next tick after the press was sent, so "the answer is lost to the run's deadline" happens exactly there, whatever the load.
  - The 400 ms value stays as the Flow's setting, but no case waits on it.
- Option 2, for the cause-agnostic cases ("what a look can and cannot do" via `landedAndLost`, and "a held row stays out of a forward run whatever was looked at"):
  - The answer is lost to `failed({ retryable: true })` after the press, which case (b) proves holds the act as `may_have_landed` without a second call.
  - `shortRuns` is no longer used there, so no clock is involved.
- No timeout was lengthened and no assertion changed.

## Commands run and observed results

All through the slot, in `packages/fluxiq` (log: `.../scratchpad/t904c-verify.log`):

- `node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit` -> exit 0, no errors.
- `npx vitest run` over the environment tests, region-timeout, graph-options, composite-executor, answer-first flow-run, later-attempt and second-attempt-proof (the suites beside each changed file) -> Test Files 12 passed (12), Tests 103 passed (103).
- `npx vitest run .../answer-first/tests/double-act-on-run.test.ts`, alone -> 35 passed (35).
- The same under six `t904-burn.mjs` CPU burners, the round-2 reproduction:
  - Round 1: 35 passed (35), 528.7 s.
  - Round 2: 35 passed (35), 340.5 s.
  - Before the fix, the same reproduction failed round 1 on "a held row stays out...". The burners were confirmed gone afterwards.
- `node scripts/structure-audit.mjs` (Core) -> "passed (532 warning(s), 969 baselined)". The one warning on a changed file is advisory: double-act-on-run.test.ts is at 679 lines, past the 400-line threshold (it was 645).

## Not verified

- Core's whole fluxiq suite and Core `pnpm check` were not re-run; only tsc, the audit and the suites beside the change ran.
- No offline-trial suite beyond the environment tests ran against the offline deadline change.

## Open questions

- The offline-environment behaviour change above: offline runs with a Flow deadline now time out in virtual time. I
  believe this is the intended contract; say if offline trials should keep real-time deadlines.
