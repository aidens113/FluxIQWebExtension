# `r-recorder-start-stop-crossing` — serialize new recordings after stop

## Design and progress

In progress. New UI starts and server acceptances will capture and await the
current stop settlement, treating either fulfillment or rejection as a completed
teardown. UI starts will also be single-flight across that wait. Refusals arriving
inside the stop boundary will be ignored so they cannot tear down or block a
recording independently of the stop owner.

The stop token will be cleared before its public promise is resolved or rejected,
while preserving the existing first-caller notification policy.

## Outcome

Complete. `start()` is now synchronously single-flight across its pre-handshake
work and first awaits the stop operation it captured. `beginAccepted()` also
awaits the captured stop. Both paths treat a rejected stop as completed teardown
and only then evaluate handshake, state, and recording identity. A stop clears
its token before resolving or rejecting the public promise, so a newly released
recording admits its initial event immediately.

A start refusal received while a stop owns lifecycle state is ignored. It cannot
cancel the stop, install a block, clear the recording identity, or issue an
independent teardown. The first stop caller's server-notification decision is
unchanged.

## Files changed

- `apps/extension/src/background/connection/active-recording.ts`
- `apps/extension/src/background/connection/tests/active-recording.test.ts`
- regenerated `apps/extension/build/background/index.js` and source map
- this report

## Crossing proof

- A held old-generation navigation drain blocks two simultaneous UI starts. The
  UI callers receive one shared promise, send one start request after teardown,
  and begin one new recording after acceptance.
- The old navigation callback observes only the old recording identity before
  the new generation exists.
- The old and new recordings each retain exactly one initial `browser.tab`
  event, with their respective recording IDs.
- A server acceptance held behind an old notifying send proceeds after that send
  rejects. The new identity is absent before settlement and its initial tab event
  is present afterwards.
- A refusal crossing a held drain leaves the stop-owned state unchanged and
  installs no recording block.
- An idle stop called directly from the public stop promise's continuation gets
  a fresh resolved promise, proving the completed stop token was already cleared.

Simultaneous UI starts are covered before the handshake exists, which is the new
window introduced by waiting behind stop. They share `uiStart`; after it settles,
the existing handshake pending guard continues to handle later button presses.

## Mutation proof

Five crossing guards were removed independently and restored:

1. Moving stop-token cleanup back behind public settlement failed 1 of 501 tests.
2. Replacing `beginAccepted()`'s stop wait failed 1 of 501 after the held-send
   assertion was strengthened to settle the competing continuation. The first
   version of that assertion was too early and did not detect the mutation; it
   was corrected before acceptance.
3. Replacing the UI start's stop wait failed 1 of 501 tests.
4. Disabling UI-start single-flight failed 1 of 501 tests.
5. Disabling refusal suppression during stop failed 1 of 501 tests.

The source was restored after every mutation. Its SHA-256 before mutation and
after all restorations was identical:
`A73113E2766B218235A6B083E2C8833E81B98CB683B07BFA3155E13D49470029`.

## Validation

- Extension check under `r-recorder-start-stop-crossing`: passed.
- Initial extension smoke/unit suite: 500/500 passed.
- Final restored-source check: passed.
- Final restored-source smoke/unit suite: 501/501 passed.
- Final focused `active-recording` rerun: 22/22 passed.
- Tracked extension build regenerated successfully.
- Scoped `git diff --check`: exited zero with only existing line-ending warnings.

No Lab command was run, no Core or shared document was edited, and I did not
commit or push.
