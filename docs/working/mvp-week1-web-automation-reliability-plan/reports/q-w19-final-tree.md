# `q-w19-final-tree` — W19 proof after the stop fence

## Setup

- Scenario/lane: `auth-gate --flow --variant expired`.
- Target/evidence: isolated, failure evidence.
- Instance/build label: `postfix-w19-final`.
- Run root: `F:\fxlab-runs\postfix\w19-final`.
- Environment-file loading is disabled. The fixture-only declared secret is
  resolved directly into the process environment without output.

## Progressive results

| Run | Run ID | Exit | Evaluation | Category | Oracle | Harness | Packet budget | Truncation |
| --- | --- | ---: | --- | --- | --- | ---: | --- | ---: |
| 1 | `run-mu1bylid-4d77df3d` | 0 | passed | `auth_required` | passed | 0 | 6/6 within 6,000 bytes (max 3,079) | 0 |
| 2 | `run-mu1c0sfk-11f7936a` | 0 | passed | `auth_required` | passed | 0 | 6/6 within 6,000 bytes (max 3,079) | 0 |
| 3 | `run-mu1c2til-08208272` | 0 | passed | `auth_required` | passed | 0 | 6/6 within 6,000 bytes (max 3,079) | 0 |

## Outcome

Passed: 3/3 actual final-tree browser runs exited zero and evaluated passed.
Every run reported the expected `auth_required` automation category, every
fixture oracle passed, and every harness activation count was zero. Each run
measured six sanitized evidence packets; all were within the 6,000-byte budget,
the maximum was 3,079 bytes, and truncation was zero.

All three bundles are preserved under `F:\fxlab-runs\postfix\w19-final`. There
were no pre-launch failures to exclude. I did not edit product code or shared
documents and did not commit or push.
