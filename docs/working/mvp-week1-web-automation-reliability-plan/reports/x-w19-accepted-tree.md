# `x-w19-accepted-tree` — accepted-tree W19 browser proof

## Setup

- Scenario/lane: `auth-gate --flow --variant expired`.
- Target/evidence: isolated, failure evidence.
- Instance/build label: `x-w19-accepted`.
- Run root: `F:\fxlab-runs\postfix\w19-accepted`.
- Environment files are disabled. The fixture-only declared secret is resolved
  directly into the process environment without output.

## Progressive results

| Run | Run ID | Exit | Evaluation | Category | Oracle | Harness | Packet budget | Truncation |
| --- | --- | ---: | --- | --- | --- | ---: | --- | ---: |
| 1 | `run-mu1dfobh-b6be2187` | 1 | failed | `process.startup` | not reached | 0 | no packets emitted | 0 |
| 2 | `run-mu1di2yf-8a82c202` | 0 | passed | `auth_required` | passed | 0 | 6/6 within 6,000 bytes (max 3,079) | 0 |
| 3 | `run-mu1dkwt5-b9e2a016` | 0 | passed | `auth_required` | passed | 0 | 6/6 within 6,000 bytes (max 3,079) | 0 |
| 4 (confirmation) | `run-mu1dn4ky-5eb76675` | 0 | passed | `auth_required` | passed | 0 | 6/6 within 6,000 bytes (max 3,079) | 0 |

Run 1 created an actual run bundle but failed during process startup before Flow
creation (`flowCreated: false`). Its bundle is preserved for failure diagnosis.
Safe inspection of its durable error event reports `process.startup` and no
`failureDetails`; consequently no operation stage is available to report.

## Outcome

The planned three actual runs completed with two expected W19 passes and one
isolated `process.startup` failure. The additional confirmation run passed, so
the startup shape did not repeat in the next three invocations. Across the
three successful runs, evaluation and fixture oracle passed, the reported
automation category/code was `auth_required` / `web.auth.required`, harness
activation was zero, and all six sanitized packets per run stayed within the
6,000-byte budget (maximum 3,079) with zero truncation.

All four bundles are preserved under the assigned run root. I inspected the
startup failure only through its fixed failure category and presence/absence of
`failureDetails`; no raw error text, path, URL, page data, or secret was read or
recorded. I made no product/shared-document edits and did not commit or push.
