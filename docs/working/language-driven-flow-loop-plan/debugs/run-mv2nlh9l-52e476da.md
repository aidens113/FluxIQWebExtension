# run-mv2nlh9l-52e476da: paid proof R4a, crossborder hub-to-cart with the flash deal (failed)

Full debug: [r4a-debug-run-mv2nlh9l.md](../../state-aware-recovery-plan/reports/r4a-debug-run-mv2nlh9l.md)
(every one of the 68 step folders, core.log, the UI review JSON and its screenshots).

## What it did

Candidate-mode creation started from the extension chat, task
`crossborder-marketplace-hub-to-cart-flash-deal-during-build`, variant `flash-deal` armed during the build, flash
model, $0.10 ceiling. Exploration reached every control and the model closed the flash deal itself. Revision 3 of the
script passed the static checks after three handle refusals. In the one trial, nodes 1-8 succeeded (the coupon's
"Network busy" was absorbed on its second attempt); node 9, typing the quantity into t964, failed
`web.target.not_found` with a best score of 0.27 over four attempts.

## Why it failed

Decisive: the step was addressed as `#fb1l6ufkg`, an id crossborder mints again on every page load. The extension's
shape rule (`apps/extension/src/content/selector/volatile-identifier.ts:139-144`) does not judge it generated, so it
was used as the step's anchor and, after the trial's reset, counted against the right element
(`content/identity/score.ts:264-273`). Then the model never re-tested: the trial feedback called the failure retryable
but did not say the box was still on the page; it looped clearing the box (the site sets it back to 1), and three
repeat refusals ended the build at $0.0525. No judge, no promotion. None of the state-aware features failed.

## What changed next

- t419: an id or selector token that no element on the page carries no longer counts for or against a candidate.
- t420: trial feedback says when a step's control is still on the page and asks for a re-test (`retry_allowed`).
- t421: the chat and overlay wording the UI review found (not found where saved, the box set back, no handle jargon,
  the false missing-key card, Choose for swatches, a reason on "Build failed").
All three merged to both `dev`s; the proofs worktree was fast-forwarded and rebuilt before the relaunch.
