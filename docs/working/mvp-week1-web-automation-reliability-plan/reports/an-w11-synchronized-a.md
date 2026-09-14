# `an-w11-synchronized-a` — corrected synchronized W11 trio A

**Status:** complete; three accepted post-barrier runs passed under concurrent
side-B load.

## Outcome

Side A produced 3/3 accepted W11 Flow runs after the start barrier. Every run
recorded exactly three `web.scroll.changed` events, proposed three candidates,
executed three successful `web.dom.scroll` actions, reported runtime success,
passed the independent final-state oracle, and had zero harness activations.
Each corresponding side-B run overlapped most of the accepted side-A run.

| Accepted pair | Side-A run and interval (UTC) | A/B overlap | Scrolls / candidates / succeeded actions | Runtime / oracle | Harness |
| --- | --- | ---: | ---: | --- | ---: |
| 1 | `run-mu1qhxrz-f75b1af5`, 21:07:33.426–21:09:19.887 | 86.234 s | 3 / 3 / 3 | succeeded / passed | 0 |
| 2 | `run-mu1qkryp-27842655`, 21:09:45.867–21:11:32.236 | 88.277 s | 3 / 3 / 3 | succeeded / passed | 0 |
| 3 | `run-mu1qongk-ef5f1d61`, 21:12:46.651–21:14:26.694 | 82.037 s | 3 / 3 / 3 | succeeded / passed | 0 |

The corresponding B runs were `run-mu1qidd7-c9b84fa6`,
`run-mu1ql5x5-9d7b0dd0`, and `run-mu1qp16u-35c5f629`. Side B reported the
same exact three-scroll/candidate/action checks, runtime/oracle pass, and zero
harness activations in all three.

## Execution boundary

All accepted commands used `FLUXIQ_TEST_ENV_FILES=none`, instance/build label
`an-w11-synchronized-a`, run root
`F:\fxlab-runs\w11-synchronized\a`, and:

`pnpm lab run infinite-feed --flow --target isolated`

Before every invocation I explicitly removed the optional web-panel username,
password, PIN, and TOTP environment variables. The bounded run projections
contain no optional credential fields. All three evaluations passed the
6,000-byte packet invariant; their observed maximum was 5,952 bytes.

One earlier otherwise-passing A run, `run-mu1qfgju-b7937d4e`, started at
21:05:37.795Z, 1.205 seconds before the required 21:05:39Z barrier. I excluded
it rather than weaken the timing condition, disclosed the mistake immediately,
and coordinated the replacement third pair shown above. It is not counted as
one of the three accepted observations.

## Inspection boundary

Inspection was limited to bounded run/evaluation timestamps and verdicts, the
count-only recording summary, Flow candidate/action statuses, credential-field
absence, and the paired B timestamps supplied by the B worker. I did not inspect
raw page data, screenshots, process logs, credentials, or arbitrary event
details. I changed only this report and did not commit or push.
