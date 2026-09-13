# Report: r-wait-and-cleanup

## Outcome

Complete. The runner now waits up to 90 seconds for Core recording
finalization, publishes only the finalization wait's safe diagnostic shape,
identifies whether a pairing timeout occurred before or after approval, and
keeps the first scenario failure when later browser, topology, or clone
destination cleanup fails. No Lab run, browser session, Core change, commit, or
push was performed.

## What changed

- `packages/test-runner/src/flow-lane/finalized-recording.ts`
  - Raised the production finalization bound from 30,000 to 90,000 ms.
  - Recorded the measured basis beside the constant: a healthy loaded run took
    25,789 ms and the observed p90 per-entry rate projected 49-56 seconds.
  - Added a closed safe projection for finalization-wait failures: recording
    id, seen/finalized state, counts, polls, and elapsed/bound times only.
  - Corrected the first-finalized-read-at-the-bound message so it no longer
    claims the timeline kept growing without a confirming observation.
- `packages/test-runner/src/pairing-status-wait.ts`
  - Added the pairing-specific 15-second wait boundary.
  - Timeout details name `pre-approval` or `post-approval` and retain only a
    closed connection-state enum, presence booleans for the pairing reference
    and session id, queue size, and milliseconds since the last message. The
    reference code, session id, errors, URLs, and activity/page data do not
    travel.
- `packages/test-runner/src/cleanup-failure-precedence.ts`
  - Added the pure precedence rule: cleanup becomes primary only if no complete
    earlier failure exists; every cleanup failure still produces a labelled
    `process.startup` event with its cleanup stage.
- `packages/test-runner/src/run-scenario.ts`
  - Wired the safe finalization details into the original error event.
  - Routed the two pairing phases through the pairing-specific wait.
  - Applied the cleanup precedence rule to browser, topology, and clone
    destination cleanup and appended each cleanup failure as its own event.
- Tests changed or added:
  - `packages/test-runner/src/flow-lane/tests/finalized-recording.test.ts`
  - `packages/test-runner/src/tests/pairing-status-wait.test.ts`
  - `packages/test-runner/src/tests/cleanup-failure-precedence.test.ts`
  - `packages/test-runner/src/run-evaluation/tests/runner-wiring.test.ts`

## Validation

- `pnpm --filter @fluxiq-web-extension/test-runner check` -> exit 0 after the
  final restored sources.
- Private build:
  `pnpm exec tsc -p tsconfig.json --outDir dist-r-wait-and-cleanup` -> exit 0.
- Focused private-build tests: finalized-recording, pairing-status-wait,
  cleanup-failure-precedence, and runner-wiring -> 24 passed, 0 failed.
- `git diff --check` over every owned source/test file -> exit 0. Git emitted
  only its existing LF-to-CRLF checkout warnings.
- `pnpm structure:check` inspected all product changes and reported no new
  product-code violation. It exited 1 only because `docs/working/README.md` was
  temporarily stale against shared working-document edits made concurrently;
  regenerating that shared index belongs to the supervisor. The remaining
  output was advisory or baselined.
- The private `dist-r-wait-and-cleanup` directory was removed after testing.

## Mutation proofs

Each mutation failed the named focused test and was restored byte-identically,
confirmed by SHA-256 before and after.

| Guard mutated | Observed failure | Restored SHA-256 |
| --- | --- | --- |
| Finalization default `90_000` -> `30_000` | The 60-second healthy-latency row threw and the bound row observed 30,000 instead of 90,000; 2 failures | `824675DF3057414DB948A3F4859901B5FE9B926432E8D75A80595F0D0F959638` |
| Runner finalization detail selection -> `undefined` | `runner-wiring` failed the safe-projection call-site assertion; 1 failure | `2C3C823AC2E8504B479FAE177257E86046A6634881CA0D3FC65CFFA5DE2C2431` |
| Pairing-reference presence -> always `false` | The sanitized last-status row expected `true`; 1 failure | `FB76A86470BADB0638265A3F268DAFF54DEBB6E13E5B59BABA669CB852830BDC` |
| Existing primary failure -> cleanup failure | The cleanup-precedence row observed `process.startup` instead of `runtime.behavior`; 1 failure | `80816FC4F1FF22D8DD7CA97159176B20EE01D884A9DEA7F45611487BDB4E6279` |

## Not verified

- No live extension pairing timeout was forced, so the browser bundle's exact
  rendered event was not inspected.
- No live browser/topology/clone cleanup failure was injected. The pure rule
  and all three call sites are covered, but live process behavior remains for
  the final proof campaign.
- The 90-second bound was validated with an injected clock, not a concurrent
  Stage 4 bench. The final campaign must show W10 finalizing under actual load
  and forced timeout evidence carrying the new details.
- The repository-wide full test/build gates were left to the supervisor after
  integration with the parallel comparison-tool workstream.
