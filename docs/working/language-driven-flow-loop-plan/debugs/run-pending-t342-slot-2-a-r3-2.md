# Run debug — pending (lanes A-D round 3, lane A paid run 2, t342-slot-2)

Written before launch (2026-10-12 ~01:15 UTC); renamed to the run id when the Lab assigns it.

## Header

Qualifying run 2, right after the passing run 1 `run-mv4jihmm-af72a1e1` (oracle 4/4, $0.0304; debug exists). Same
product pair: no source change since (only untracked debug Markdown, which the fingerprint drops); expected guard
fingerprint `sha256:686f7f26...`. Same command, instance `t342-slot-2`, workspace `t342-a`, flash, 48 calls, $0.10,
one attempt.

## Expectations

Same instruction, command and oracle facts as run 1. Watch beyond run 1: A3-1 (the judge's end view reading "0 Cart"),
U1-U3 (card wording and ordering), the coupon's busy refusal and its retry, no invented confirmation wait. A pass
qualifies lane A (two consecutive passes on one pair).
