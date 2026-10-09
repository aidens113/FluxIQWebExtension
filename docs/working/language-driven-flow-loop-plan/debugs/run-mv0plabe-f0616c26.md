# Run debug — run-mv0plabe-f0616c26 (lane A round 9, qualifying run 2 of the streak in candidate mode, t342-slot-2)

Written before launch (2026-10-09 ~08:40 UTC); renamed to the run id when the Lab assigns it.

## Header

Same product pair as qualifying run 1 `run-mv0pb9sm-248ba49f` (passed: oracle held, product accepted; zero-call replay
`replay-mv0pfvkz-f8815de0` passed). Downstream `fxwork/t342` at 50cfd17b (source unchanged since run 1; only
untracked debug Markdown, which the fingerprint drops), Core at dcaf8f9f. Expected guard fingerprint
`sha256:bd4924d1...` (run 1's). Same command, instance, workspace `t342-a`, flash, 48 calls, $0.10, one attempt.

## Expectations (written before launch)

Same instruction, command and oracle facts as run 1 (see `run-mv0pb9sm-248ba49f.md`).

To check, beyond run 1's list:

- R1 (run 1's defect): does the model again name a dismissal by a handle that is plain text (run 1: `t1034`, the
  consent paragraph, saved as the "Open chat" launcher)? Is it refused, or saved as some other element?
- R2: is the coupon step again `optional: yes` although the instruction requires it?
- R3: repeated `web.describe_element` on the same handle (run 1: 3 times on `t934`).
- Trials, judges against the oracle, promotion, apply, the Lab's playback and oracle, cost and calls; the UI moments.

On a pass with product acceptance: its zero-call replay; lane A then has two consecutive passes. On failure: the
early-cause message to the supervisor, full debug, stop.
