# i-final-w10-recheck — why the 5,250 ms settle cannot guarantee a navigation candidate

Read-only investigation, 2026-09-13. I read the current recording driver,
navigation intake/decision code, domain executable-input rule, and bounded
fields from the six W10 recheck bundles under
`F:\fxlab-runs\final\recheck-w10`. I did not read screenshots, raw page data,
or logs, and made no source, shared-document, Lab, build, commit, or remote
change.

## Conclusion

**High confidence (0.97): elapsed time cannot make a Playwright `page.goto`
an executable recorded navigation. Only browser origin `typed` does that.** The
5,250 ms barrier correctly takes the old click outside both the 5,000 ms
explanatory window and 250 ms debounce, but it does not control the browser's
`webNavigation.transitionType`. The recheck's 2/1 proposal split is the browser
sometimes classifying the scripted navigation as executable `typed`, and
sometimes classifying it as a passive/dropped origin.

The one-candidate proposal is **the click, not the navigation**. Both
one-candidate armed runs started at candidate index 0 and executed
`web.dom.click:failed`; that failure was the expected
`navigation_unexpected`. The Flow cannot execute a click node unless that node
is the proposal's sole candidate.

## What each browser origin becomes

`RecordedEventIntake.noteNavigationCommitted` reduces the browser's transition
to three origins (`apps/extension/src/background/connection/recorded-event-intake.ts:105-115`),
then `NavigationRecorder.shouldRecord` applies these rules
(`apps/extension/src/background/connection/navigation-recorder.ts:92-115`):

| Browser transition | Intake origin | After the 5,250 ms barrier | Executable candidate? |
| --- | --- | --- | --- |
| `typed` | `typed` | recorded as navigation | **Yes.** Intake preserves `metadata.transition="typed"`. |
| `link` / `form_submit` | `page` | dropped when no prior click still explains it | No. Inside the window it is only passive landing evidence. |
| every other accepted top-frame transition | `other` | recorded as navigation evidence once no click explains it | **No.** Intake attaches no `typed` metadata. |
| `reload` | ignored before origin selection | ignored | No. |

The last distinction is decisive. Even when `other` survives the recorder's
drop rule, `recordNavigation` adds `transition="typed"` only for origin
`typed` (`recorded-event-intake.ts:126-153`). The domain makes a
`web.page.navigated` event executable only when that metadata equals `typed`
and the event is not the recording start
(`domain/src/io/input-model.ts:113-121`). Thus a delay can turn an `other`
navigation from dropped into passive evidence, but can never turn it into
`web.browser.navigate`. A `page` navigation remains either a click landing or
dropped. There is no elapsed-time path from either origin to an executable
navigation candidate.

The current driver derives and observes the combined bound
(`packages/test-runner/src/scenario-steps/step-runner.ts:28-40,70-76,102-105,131-135`),
but `page.goto` itself remains the unlabelled browser operation whose transition
classification varies. The source has no feedback from the extension that a
typed navigation action was actually recorded.

## Recheck evidence

All six runs were at downstream pin `15974e7`. No run had a wrong start.

- Primary, 3/3: finalized entry counts 25/26/26; proposal candidates 2/2/2;
  extension/Core action counts 2/2 in every run; start index 0; Core attempts
  were `web.dom.click:succeeded` then `web.browser.navigate:succeeded`; reported
  and oracle verdicts both passed.
- `broken-link`, 3/3: finalized entry counts 26/24/24; proposal candidates
  2/1/1; extension/Core action counts 2/2, 1/1, 1/1; start index 0 in every
  run. Each Flow stopped on its first `web.dom.click:failed` with the expected
  `navigation_unexpected`, so all three verdicts passed even though the latter
  two recordings lacked the navigation candidate.
- Navigate-step durations were 4,826–5,008 ms across all six. They are less
  than 5,250 ms because the driver subtracts time already elapsed after the
  preceding click; this is expected and confirms that the barrier waited only
  the remaining bound. It does not explain the candidate split.
- The split cannot be attributed to Core's mapper: in every run the extension
  and Core action counts agree, and the domain's mapper maps an executable
  observation through the same input rule. The action is absent at extension
  intake in the 1/1 runs.

The bundles intentionally do not retain raw `webNavigation.transitionType`, so
they cannot distinguish whether each missing row arrived as `page`, `other`,
or was ignored. Source proves that all non-`typed` outcomes produce no action;
the 3/3 primary versus 1/3 armed difference is therefore a browser scheduling
classification flake, not evidence that the variant changes the recording
contract.

## Smallest deterministic, cross-browser-safe seam

Use an **explicit test-control navigation intent with an acknowledgement** in
the shared extension background path. Do not try to coerce or infer
`webNavigation.transitionType`.

The minimal robust protocol is:

1. Before `page.goto`, the runner sends an internal test-control message that
   arms one scripted-navigation intent for the extension's current automation
   tab and returns an opaque intent id immediately.
2. The next top-frame commit for that tab is owned by the intent regardless of
   Chrome/Edge/Firefox transition label. Redirect commits remain under the
   existing debounce so only the settled destination is recorded.
3. For that owned commit, intake records exactly one existing
   `browser.navigation` event with `transition="typed"`; this reuses the current
   domain input/output contract rather than adding a Core wire concept.
4. After `page.goto`, the runner awaits the opaque intent id. The acknowledgement
   resolves only after the gateway send of that executable recording event has
   completed. Failure, timeout, recording stop, or `goto` failure cancels the
   intent and fails the step; it must never silently fall back to browser origin.
5. While an intent owns the commit, the ordinary webNavigation path is consumed
   rather than also scheduled. This exactly-once rule prevents the naturally
   `typed` cases from becoming duplicate navigation candidates.

Match destinations by origin plus pathname and keep query/fragment out of the
intent, diagnostics, and acknowledgement. Restrict the messages to the
extension's internal control page/test path, as with the existing
`fluxiq.test.setActiveTab`; normal recorded browsing must never arm this seam.

This is cross-browser safe because the runner supplies the intent and the
common background recorder observes the actual committed destination. It does
not depend on Chromium CDP or any browser's transition taxonomy.

### CDP `Page.navigate({ transitionType: "typed" })`

Local Playwright 1.51.1's bundled Chromium protocol does expose exactly this
parameter: `Page.navigate` accepts optional `transitionType`, whose closed
vocabulary includes `typed`
(`node_modules/.pnpm/playwright-core@1.51.1/node_modules/playwright-core/types/protocol.d.ts:11830,13034-13057`).
For the current Chromium Lab, sending `Page.navigate` with
`transitionType:"typed"` is the **narrowest deterministic browser-side fix**:
the extension's existing `webNavigation.onCommitted` path should receive
`typed`, which already maps to the desired executable action. It could be
localized to the step runner and its test.

It is not, however, the smallest **cross-browser-safe** seam. Playwright's own
type documentation says `newCDPSession` is supported only on Chromium-based
browsers (`playwright-core/types/types.d.ts:8997-9004`). Chrome and Edge can
share it; Firefox cannot. Falling back to `page.goto` on Firefox preserves the
exact nondeterminism under investigation, while rejecting Firefox breaks the
repository's shared-browser contract.

CDP also does not preserve `page.goto`'s waiting contract by itself.
`Page.navigate` returns a frame/loader id (and optional error text), not a
Playwright response after the requested load state. A correct Chromium adapter
would have to register the Playwright navigation/load waiter **before** sending
the CDP command, send `Page.navigate` with `transitionType:"typed"`, reject its
`errorText`, await the committed destination and intended load state, and
detach the session in `finally`. Starting the waiter after `send` risks missing
a fast commit; treating the command response as completion lets the next
recording step race the page load. Redirect behavior and same-document
navigation would need explicit tests.

Therefore:

- if the immediate scope were explicitly Chromium-only, CDP typed navigation
  is the smallest sound fix, provided the Playwright load wait above is part of
  it;
- for Chrome/Edge **and Firefox**, the explicit recorder intent/ack remains the
  smallest deterministic seam. CDP may be an implementation optimization for
  Chromium later, but it cannot be the shared correctness mechanism.

### Exact implementation scope

The likely narrow file partition is:

- `packages/test-runner/src/scenario-steps/step-runner.ts` and
  `scenario-steps/tests/step-runner.test.ts`: replace the time-only barrier with
  injected begin/ack/cancel hooks around `page.goto`, retaining honest step
  timing;
- `packages/test-runner/src/run-scenario.ts` and
  `run-evaluation/tests/runner-wiring.test.ts`: wire those hooks to the extension
  control page and fail closed on a missing/negative acknowledgement;
- `apps/extension/src/shared/constants.ts` and
  `apps/extension/src/background/index.ts`: add the internal arm/await/cancel
  runtime messages and validate opaque ids/arguments;
- `apps/extension/src/background/connection.ts` plus a focused new
  `apps/extension/src/background/connection/scripted-navigation-intent.ts` and
  colocated test: own the one-active-intent state, exact-tab consumption,
  redirect/debounce completion, timeout, cancellation, and exactly-once ack;
- `apps/extension/src/background/connection/recorded-event-intake.ts` and its
  colocated test: let an armed intent override browser origin for its owned
  top-frame commit and resolve only after the existing recording-event send.

`domain/src`, Core, scenario manifests, and runtime action execution need no
change. If project structure prefers folding the small state machine into
`recorded-event-intake.ts`, the new file can be omitted, but the same tests and
ownership rules remain necessary.

### Compatibility impact

- Additive, test-control-only extension runtime messages and internal runner
  hooks; no Core protocol, persisted Flow, recording schema, domain action, or
  public product behavior changes.
- Chrome, Edge, and Firefox share the same explicit-intent path. Browser-native
  recording behavior remains unchanged when no test intent is armed.
- The current 5.25-second delay can be removed once acknowledgement is the gate,
  reducing W10 recording time while increasing determinism.

## Rejected alternatives

- **More delay:** cannot change `page` or `other` into `typed`; it only makes an
  `other` event survive as passive evidence.
- **CDP as the shared fix:** deterministic and narrow on Chromium when sent as
  `transitionType:"typed"`, but unavailable on Firefox and incomplete without a
  separately armed Playwright navigation/load waiter. It is viable only under
  an explicit Chromium-only scope.
- **Scenario restructuring:** another link/button would record a click, and
  history/script navigation is `other` evidence. Either stops W10 from proving
  `web.browser.navigate`, so it weakens the corpus instead of fixing recording.
- **Post-`goto` synthetic event without arming:** races the natural 250 ms
  callback and can duplicate candidates when the browser reports `typed`.

## Required mutation and live proof

1. Unit-test the intent state machine with browser transitions `typed`, `link`,
   and representative `other`: each armed case yields exactly one executable
   navigation and one acknowledgement; each unarmed case retains today's rule.
2. Test redirect bursts: the intent acknowledges one settled navigation, not
   one per commit. Test wrong tab, subframe, timeout, cancel, recording stop, and
   gateway-send rejection; none may acknowledge success or leak an armed intent
   into the next step.
3. Runner tests: arm precedes `goto`, acknowledgement follows it and is included
   in navigate timing, `goto` failure cancels, and missing/negative ack fails the
   step. Mutation removing arm, consumption, or ack must fail its respective row
   after a private rebuild, with exact restoration.
4. Live targeted proof at the new pushed pin: W10 primary and `broken-link`,
   each at least 3/3. Every recording must show extension/Core action counts
   2/2 and proposal candidate count 2. Primary must execute click then navigate
   with reported/oracle pass; `broken-link` must start at candidate 0 and report
   the expected first-click `navigation_unexpected` failure.
5. Because this changes the downstream pin and the existing final benches
   contain known one-candidate W10 recordings, both final benches must restart
   from repeat 0 after the targeted proof.
