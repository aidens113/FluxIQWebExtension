# `ao-w11-synchronized-b` — corrected synchronized W11 trio B

**Status:** complete; B passed 3/3 and every run overlapped its corresponding
passing side-A run.

## Outcome

Three accepted sequential W11 primary Flow validations passed at downstream
`8fb1331660de53da660d060ca2a32ef69372a902` and Core
`19468b72c4472fd5cc58940737702d5e4d72c985`. Every run recorded exactly three
`web.scroll.changed` events, created three proposal candidates, executed three
successful `web.dom.scroll` actions, reported runtime success, passed the
independent final-state oracle, and had zero harness activations.

| B run | UTC interval | B duration | Corresponding A overlap | Exact result |
| --- | --- | ---: | ---: | --- |
| `run-mu1qidd7-c9b84fa6` | 21:07:53–21:09:23 | 89,970 ms | 86,234 ms | 3 scrolls / 3 candidates / 3 succeeded actions; runtime and oracle pass; harness 0 |
| `run-mu1ql5x5-9d7b0dd0` | 21:10:03–21:11:37 | 93,078 ms | 88,277 ms | 3 scrolls / 3 candidates / 3 succeeded actions; runtime and oracle pass; harness 0 |
| `run-mu1qp16u-35c5f629` | 21:13:04–21:14:31 | 86,465 ms | 82,037 ms | 3 scrolls / 3 candidates / 3 succeeded actions; runtime and oracle pass; harness 0 |

The corresponding A runs were `run-mu1qhxrz-f75b1af5`,
`run-mu1qkryp-27842655`, and `run-mu1qongk-ef5f1d61`. Their preserved UTC
intervals overlap the matching B intervals above, proving concurrent browser,
extension, topology, recording, proposal, and replay activity for all three
pairs rather than launch-only concurrency.

Every accepted B evaluation and reported verdict was `passed`, and Flow creation
was true. Each run retained six sanitized evidence packets with a maximum size of
5,952 bytes, below the 6,000-byte invariant. Raw snapshot byte arrays were
empty.

## Execution boundary

The first B command was launched after the supervisor's
`2026-09-14T21:05:39Z` barrier. Its corresponding A run had started 1.205 seconds
before that barrier, so the otherwise passing B observation
`run-mu1qg7fj-32e080ba` was conservatively excluded from the accepted
synchronized trio and replaced under concurrent load. Thus the root contains
four passing B observations while the table reports the three strict post-barrier
pairs. All four invocations used
`infinite-feed --flow --target isolated`, `FLUXIQ_TEST_ENV_FILES=none`,
instance/build label `ao-w11-synchronized-b`, and only
`F:\fxlab-runs\w11-synchronized\b`. Optional panel username, password, PIN,
and TOTP variables were explicitly absent. No environment file or credential
value was loaded, printed, persisted, or inspected.

Inspection was limited to closed run timestamps, evaluation verdicts, count-only
recorded-event summaries, Flow candidate/action statuses, harness count, and
packet sizes. I did not inspect raw page data, logs, payloads, tokens,
credentials, screenshots, or recorded element content. This report is the only
authored file changed for this dispatch. I did not edit code, commit, or push.
