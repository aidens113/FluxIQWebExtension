# `m-auth-expired-diagnosis` — W19 expired-classification drift

## Outcome

The W19 drift is a downstream extension recording-boundary race, not an
auth-gate fixture defect and not an aggregate/evaluator misclassification.
The unarmed recording sometimes finalizes before its debounced click-landing
navigation has been published. The mapper then still proposes the three
executable actions, but the click has no recorded landing from which to build
its `/scenarios/auth-gate/account` `expectedState`. On the armed replay the
fixture correctly returns to the sign-in gate, but a click with no landing
claim is a successful click, so Core has no structured `auth_required` failure
to report.

This is timing-sensitive product behavior in the extension recorder. The
fixture, domain landing mapper, Core transition evaluator, and bench evaluator
behave consistently with the incomplete recording they receive.

## Bounded evidence

- Bench A's three W19 runs all had 22 finalized recording entries, a mapper
  diagnostic saying seven high-frequency state entries were compacted, and a
  failed click with comparison `blocked` and structured
  `auth_required`/`web.auth.required`. Their fixture oracle verdict was
  `passed`.
- Bench B repeat 0 has the same 22 / seven shape and the same correct
  structured failure. Repeats 1 and 2 each have only 17 finalized recording
  entries and five compacted state entries. Both still have three proposal
  candidates and begin at candidate zero, but all three actions—including the
  click—are `succeeded`/`matched`; Core's run status is `succeeded`, the
  reported verdict is `passed`, and no failure record exists. Their fixture
  oracle verdict is nevertheless `passed`, proving the expired server state
  and final sign-in rendering both held.
- B's W18 Flow repeat 2 has the same 17 / five recording shape. It remains
  green because W18 expects success, so the missing click-landing claim is
  silent on the unarmed row. This rules out variant arming as the source of
  the recording difference: W18 and W19 record the same unarmed workflow.
- `RecordedEventIntake.noteNavigationCommitted` schedules a landing through
  `NavigationRecorder.schedule`, whose callback is delayed 250 ms.
  `ActiveRecording.stop` changes state to `idle` immediately and neither
  flushes nor awaits pending navigation callbacks. When a delayed callback
  subsequently enters `recordNavigation`, its first state check drops it.
- The domain mapper in
  `domain/src/runtime/expectation/click-landing.ts` deliberately creates a
  click `expectedState` only when a later `browser.navigation` event names the
  click. This explains why the executable candidate count stays three while
  only the landing guard disappears.
- The W19 fixture contract is deterministic: arming sets
  `expire-before-account`; a later valid sign-in still redirects the account
  request to the expired sign-in page; and the expected failure is
  `auth_required`. Its final-state oracle passed in all six A/B runs.

No raw event payload, page capture, recording contents, or fixture secret was
read. The comparison used only run/evaluation projections, bounded Flow-lane
snapshots, entry counts, statuses, categories, and source contracts.

## Smallest safe fix and ownership

Flush and await navigation work before a recording becomes idle and before
`client.stop_recording` is sent. A timer-only sleep in the runner would merely
move the race and would leave real recordings lossy.

The owned implementation surface is:

- `apps/extension/src/background/connection/navigation-recorder.ts`: retain
  each pending callback, expose an awaited flush, and account for a callback
  already in flight so flush cannot return between timer removal and send
  completion.
- `apps/extension/src/background/connection/recorded-event-intake.ts`: make the
  scheduled navigation callback's promise observable to that flush.
- `apps/extension/src/background/connection/active-recording.ts`: await the
  flush while state is still `recording`, then transition to `idle` and send
  the stop.
- Add unit coverage under
  `apps/extension/src/background/connection/tests/` for stop-before-debounce,
  redirect replacement, an already-running callback, send rejection, and no
  carry-over into the next recording. Keep the existing debounce semantics for
  ordinary live recording.

The domain evaluator's existing fail-open rule for an unevaluable condition is
a separate defense-in-depth concern, but it is not needed to explain the 17-
entry runs: those recordings never supplied the click landing claim in the
first place. Changing that generic rule is broader than the smallest W19 fix.

## Narrow validation plan

1. Mutation proof: remove the awaited flush from `ActiveRecording.stop`; the
   new stop-before-debounce test must fail because no explained landing is
   sent. Restore it and rerun the connection/navigation tests.
2. `EXTENSION_TEST_BUILD_LABEL=m-auth-expired-fix pnpm --filter
   @fluxiq-web-extension/extension test`.
3. Run the auth-gate fixture tests with `pnpm --filter
   @fluxiq-web-extension/scenario-lab test`.
4. With the fixture-only declared secret supplied without printing it, run
   `FLUXIQ_TEST_ENV_FILES=none pnpm lab bench --corpus week1 --repeat 3
   --target isolated --evidence failure` or, for the narrowest live loop, the
   W19 `auth-gate`/`expired` Flow scenario repeatedly. Require every recording
   to retain the landing-bearing shape and every armed replay to report
   `auth_required`; inspect only bounded projections.
5. Because the observed defect appeared only in one member of concurrent A/B,
   repeat the final A/B bench under the same concurrency before accepting the
   classification criterion.

## Verification performed

- Inspected all six A/B W19 evaluation projections and bounded Flow-lane
  snapshots, plus B's neighboring W18 Flow records.
- Ran the extension smoke/unit suite: 484/484 passed. This confirms current
  contracts but also confirms there is no stop/flush regression test covering
  this race.
- Ran the Scenario Lab suite: 204/204 passed, including the W19 manifest,
  arming, redirect, final-state, and secret-withholding tests.

I did not modify product code, run a fresh live W19, perform the proposed
mutation, or validate a fix. The exact missing event was inferred from the
bounded 22-versus-17 recording shapes and the source-controlled mapper/recorder
path; raw recording entries were intentionally not opened.
