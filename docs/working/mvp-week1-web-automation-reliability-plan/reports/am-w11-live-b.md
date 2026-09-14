# `am-w11-live-b` — repaired W11 Flow proof, side B

**Status:** B lane passed 3/3; the requested fully synchronized A/B load shape
was only partially achieved.

## Outcome

Three sequential W11 primary Flow validations passed at downstream
`8fb1331660de53da660d060ca2a32ef69372a902` and Core
`19468b72c4472fd5cc58940737702d5e4d72c985`. Every accepted run recorded
exactly three `web.scroll.changed` events, created three proposal candidates,
executed three successful `web.dom.scroll` actions, reported runtime success,
passed the independent final-state oracle, and had zero harness activations.

| Run | UTC interval | Recorded scrolls | Candidates/actions | Runtime/oracle | Harness |
| --- | --- | ---: | ---: | --- | ---: |
| `run-mu1q3v6t-eb533aaa` | 20:56:36–20:58:13 | 3 | 3/3 | succeeded/passed | 0 |
| `run-mu1q6ji6-2b9baf46` | 20:58:41–20:59:52 | 3 | 3/3 | succeeded/passed | 0 |
| `run-mu1q8mnu-4443980e` | 21:00:19–21:01:14 | 3 | 3/3 | succeeded/passed | 0 |

All three runner verdicts passed. Their durations were 96,516 ms, 70,781 ms,
and 55,806 ms. Each retained six sanitized evidence packets, with a maximum of
5,952 bytes, below the 6,000-byte invariant. Raw snapshot byte arrays were
empty.

## Execution boundary

Every accepted invocation used `infinite-feed --flow --target isolated`,
`FLUXIQ_TEST_ENV_FILES=none`, instance/build label `am-w11-live-b`, and only
`F:\fxlab-runs\w11-repaired\b`. Optional web-panel username, password, PIN,
and TOTP variables were absent, allowing disposable isolation to create its
own identity. No environment file or credential value was read or reported.

The B root contains two earlier, rejected launch attempts in addition to the
three accepted runs. Those attempts mistakenly supplied the auth-gate fixture
credentials as optional web-panel credentials and each failed before Flow
creation as `environment.missing`, with the closed summary `FluxIQ
authentication failed (401)`. They are not counted as W11 observations. The
mistake was corrected by restoring the established disposable-isolated launch
shape; no source was changed.

## Concurrency qualification

Side A completed three passing runs from 20:53:22 through 20:58:21 UTC. B's
first accepted run overlapped A's third accepted run from 20:57:01 through
20:58:13, so that complete B observation did execute under synchronized load.
B's second and third accepted runs began after A had finished. Consequently
this report proves B sequential stability at 3/3 and one complete concurrent
A/B overlap, but it does **not** claim the brief's intended fully synchronized
three-by-three load proof. Strict closure of that condition requires relaunching
side A concurrently with another B trio.

## Scope and verification

Inspection was limited to closed run/evaluation fields, the persisted recording
event-type counts, Flow candidate/action status, packet-size counts, and the A
run timestamps needed to qualify concurrency. No raw page data, logs, payloads,
tokens, credentials, screenshots, or recorded element content was inspected.
This report is the only authored file changed by this worker. I did not edit
code, commit, or push.
