# `ag-w11-final-oracle` — W11 shared repeat-2 oracle miss

**Status:** complete, read-only diagnosis.

## Outcome

This is a scenario/runner timing defect, not state pollution and not a defect in
Core's execution of the Flow it was given. In both campaigns, repeat 2 recorded
only two of W11's three scripted scrolls. Core therefore proposed and executed a
two-action Flow, correctly reported that Flow as succeeded, and the independent
fixture oracle correctly rejected the resulting page because it had not reached
the declared 40-post/page-4 final state.

The shared repeat index is not evidence of persisted state crossing runs. The
two campaigns ran the same ordered corpus concurrently, so their repeat-2 W11
cells reached the same narrow timing boundary under shared load. Each failing
cell used its own immutable run and its own just-finalized recording.

## Bounded artifact facts

I inspected only the six W11 primary Flow evaluation/event bundles: repeats 0,
1 and 2 from campaigns `bench-mu1esgvq-ea2bcc93` and
`bench-mu1es0uy-050c724f`. I did not inspect raw page payloads or process logs.

| Campaign/repeat | Recorded `web.scroll.changed` | Proposal candidates | Runtime actions | Runtime/oracle |
| --- | ---: | ---: | ---: | --- |
| A/0 | 3 | 3 | 3 | passed/passed |
| A/1 | 3 | 3 | 3 | passed/passed |
| A/2 | 2 | 2 | 2 | passed/failed |
| B/0 | 3 | 3 | 3 | passed/passed |
| B/1 | 3 | 3 | 3 | passed/passed |
| B/2 | 2 | 2 | 2 | passed/failed |

All six recording scripts completed all three scroll steps, all three page
waits, extraction, and checkpoint. The distinction appears before proposal
creation: the repeat-2 runner event already reports only two scroll events, and
the finalized recording has seven entries instead of the passing runs' 10 (A)
or 10/11 (B). Both repeat-2 Flow snapshots then contain exactly two scroll
candidates and two successful scroll actions. There was no reported automation
failure and no harness activation.

The step timestamps expose the boundary. Passing A repeats had successive
scroll-start gaps of 793/798 ms and 886/769 ms; passing B had 805/853 ms and
529/418 ms. Failing A repeat 2 had 475/401 ms gaps, while failing B repeat 2 had
401/431 ms gaps. The content recorder resets a 400 ms scroll debounce on each
wheel or scroll event (`apps/extension/src/content/dom-events.ts:142-166`), but
the runner regards `page.mouse.wheel` returning as completion and adds no
settlement (`packages/test-runner/src/scenario-steps/step-runner.ts:85`). The
fixture's next page becomes available after only 300 ms
(`apps/scenario-lab/src/scenarios/infinite-feed/feed-markup.ts:9,82`). A page
wait can therefore release the next scripted wheel at the recorder's debounce
edge; that wheel cancels the preceding pending scroll record. Command-start
gaps near 400 ms do not guarantee 400 ms after the browser's last scroll event.

## Why the two verdicts differ

W11 deliberately declares three scrolls and final facts requiring 40 posts and
page 4 (`apps/scenario-lab/src/scenarios/infinite-feed/scenario.ts:36-54`). The
Flow lane generates from exactly the finalized recording and checks the fixture
oracle only after Core runs it (`packages/test-runner/src/flow-lane/run-flow-lane.ts:100-108,161-181`).
Core's `succeeded` status answers whether its two-node Flow ran successfully; it
does not assert that an omitted third recording action somehow occurred. The
runner retains that status, publishes `oracleVerdict: failed`, and classifies the
final-state mismatch as `runtime.behavior`
(`packages/test-runner/src/run-scenario.ts:362-367`). That is the correct oracle
behavior.

The manifest currently pins only the presence of a scroll event, not three of
them (`apps/scenario-lab/src/scenarios/infinite-feed/scenario.ts:49`). Therefore
the generic proposal-shortfall guard has an expected executable count of zero
for W11: it counts only explicitly counted executable events
(`packages/test-runner/src/flow-lane/recording-flow-proposal.ts:91-98`). The
incomplete proposal is allowed through and is diagnosed later by final state.
That is a second scenario-contract weakness, not the cause of the lost event.

## Recommended ownership and proof

1. **Runner timing — primary fix.** In
   `packages/test-runner/src/scenario-steps/step-runner.ts`, make a scripted
   trusted `scroll` wait for a documented recorder-settlement interval safely
   beyond 400 ms after `page.mouse.wheel`. Cover the ordering and wait duration
   in `packages/test-runner/src/scenario-steps/tests/step-runner.test.ts`. This
   belongs to the runner because every recording script treats separate scroll
   steps as separate replayable actions; coupling W11's fixture latency to an
   extension implementation delay would merely hide the race.
2. **W11 fail-closed contract.** Change W11's declaration in
   `apps/scenario-lab/src/scenarios/infinite-feed/scenario.ts` to require exactly
   three `web.scroll.changed` events, and assert that count in
   `apps/scenario-lab/src/scenarios/infinite-feed/tests/scenario.test.ts`. Then a
   future loss fails as `recording.contract` before approval instead of creating
   a short Flow.
3. **Exact live proof.** After those changes and unit gates, run
   `FLUXIQ_TEST_ENV_FILES=none pnpm lab run infinite-feed --flow --target isolated`
   six times sequentially under unique run roots/instance labels. Require 6/6
   recordings with three scroll events, three proposal candidates, three
   successful Flow scroll actions, and passing final-state oracles. Then run two
   three-repeat W11-only campaigns concurrently (or the next full A/B pair) to
   reproduce the synchronized-load condition; require equal 3/3 passing
   verdicts in both.

## Not verified

No code was changed and no Lab command was run under this read-only brief. The
recommended settlement interval and W11 count guard still require unit,
mutation, and live browser proof. The artifacts establish the debounce race's
shape and location; they do not prove that no additional scroll-loss mechanism
exists outside these six runs.
