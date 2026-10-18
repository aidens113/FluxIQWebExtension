# install-core-p2 (t707, round 3) worker report

## Outcome

Done.

## What changed and why

Confirmed from code: the snapshot (`client-gateway/service/views.ts` -> `pairings.list()`) lists only live pairings. `withdrawForSession` deletes the pairing from that map (its reason goes to a separate `withdrawn` map that the snapshot does not expose). An approved pairing stays in the list with `consumedAt` set. An expired one has `expiresAt` in the past until pruning removes it. In the modal, `closedNotice` was set only on a failed approve, so a withdrawn request just disappeared.

The snapshot can tell three cases apart: approved elsewhere (`consumedAt`), expired (`expiresAt <= now`), and gone before expiry. It cannot tell a withdrawal from a dismiss in another window or a superseded request, so the gone-before-expiry wording is true for all of those.

`C:/Users/osrs_/FluxStuff/fxwork/t707/!FluxIQ/apps/web/src/app/GlobalClientGatewayPairing.tsx`:
- New export `vanishedPairingNotice(shown, pairings, nowMs)` returns a `PairingNotice` `{title, message, tone}`. This also adds the exported type `PairingNotice`.
  - approved elsewhere: "Paired elsewhere" / "This request was approved from another window, so the browser is already paired." (info)
  - expired: "Nothing was paired" / "The pairing request expired before you confirmed, so nothing was paired. Connect again from the browser to get a new code." (error)
  - otherwise: "Nothing was paired" / "The request closed before you confirmed, usually because the browser disconnected, so nothing was paired. Connect again from the browser to get a new code." (error)
- A `useRef` remembers the request the modal was showing. When that request leaves the modal and its code is not in `dismissedCodes`, an effect sets the notice. Approve, reject and dismiss all add the code to `dismissedCodes` through `removePairing`, which is how the effect knows this operator did not act on it.
- `closedNotice` is now `PairingNotice | null`. A failed approve wraps its existing gateway message as "Nothing was paired" (error), so behaviour there is unchanged. The standalone modal is now titled "Pairing request closed" and takes its inline title and tone from the notice. When a newer request is showing, the inline notice reads "Previous request: <title>".

`apps/web/src/app/tests/GlobalClientGatewayPairing.test.ts`: two new tests.
- One unit-tests the three wordings.
- One checks the source for the dismissed-code guard and the `setClosedNotice(vanishedPairingNotice(...))` call.

## Commands run and observed results

All run from the Core root.
- Before the fix: `pnpm.cmd --filter @fluxiq/web exec vitest run src/app/tests/GlobalClientGatewayPairing.test.ts` -> "Tests 2 failed | 7 passed (9)". The failures were the two new tests: `vanishedPairingNotice` did not exist, and the source check failed.
- After the fix, same command -> "Test Files 1 passed (1), Tests 9 passed (9)".
- `node scripts/structure-audit.mjs` -> "structure-audit: passed (397 warning(s), 1154 baselined)". None of the warnings name this file.

## Not verified

- The effect was not rendered in a DOM test. The test file is node-only, and the wiring is covered by source-text checks.
- No typecheck was run (the brief said not to), so the `PairingNotice` tone values and the `useRef` typing were not compiler-checked.
- No live browser check was done.

## Open questions or contradictions found

- The file now has two more exported things (`PairingNotice`, `vanishedPairingNotice`) on top of the several it already had. The audit passed, but this goes further against "one exported thing per file". Moving the helpers into their own files would need paths this brief did not give me.
- In a race, the effect may see a request leave at expiry before the next poll. It uses `Date.now()` for this, so the expiry case is worded correctly.
