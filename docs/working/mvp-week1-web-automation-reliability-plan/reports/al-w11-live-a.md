# `al-w11-live-a` — repaired W11 live proof, side A

**Status:** complete; all three isolated Flow runs passed.

## Outcome

Side A produced 3/3 complete W11 recordings and successful Flow replays under
the synchronized A/B load. Every run recorded exactly three
`web.scroll.changed` events, proposed three candidates, executed three
successful `web.dom.scroll` actions, passed the runtime and final-state oracle,
and used the harness zero times. The earlier two-scroll repeat-2 failure did not
recur.

## Runs

All commands used `FLUXIQ_TEST_ENV_FILES=none`, `FLUXIQ_LAB_INSTANCE` and
`EXTENSION_TEST_BUILD_LABEL` set to `al-w11-live-a`, and
`FLUXIQ_TEST_RUNS_DIR=F:\fxlab-runs\w11-repaired\a`:

`pnpm lab run infinite-feed --flow --target isolated`

The three commands ran sequentially. Side B ran concurrently to recreate the
shared-load condition; side A's first launch also observed the Lab build lock
already held by the other process.

| Run | Recorded scrolls | Proposal candidates | Successful runtime scrolls | Runtime | Oracle | Harness | Duration |
| --- | ---: | ---: | ---: | --- | --- | ---: | ---: |
| `run-mu1pzpg6-5a707cd7` | 3 | 3 | 3 | succeeded | passed | 0 | 74,300 ms |
| `run-mu1q1z3g-a9250c45` | 3 | 3 | 3 | succeeded | passed | 0 | 81,683 ms |
| `run-mu1q4edy-ab42c8c5` | 3 | 3 | 3 | succeeded | passed | 0 | 79,866 ms |

All three evaluations and reported verdicts were `passed`; Flow creation was
true. Each evaluation's sanitized evidence-packet maximum was 5,952 bytes,
within the 6,000-byte invariant.

## Inspection boundary

I inspected only the bounded evaluation fields, the Flow-lane candidate/action
projection, and the count-only recorded-event summary. I did not inspect raw
page payloads, screenshots, process logs, or arbitrary event details. Artifacts
remain under the assigned ignored run root. I changed no product code and did
not commit or push.
