# `o-w19-recorder-flush` — live W19 recorder-drain validation

## Scope and setup

- Scenario: `auth-gate`, Flow lane, `expired` variant, isolated target.
- Requested repetitions: six independent `lab run` invocations with failure evidence.
- Environment loading is disabled. The fixture-only declared secret is resolved
  directly from the fixture source into the process environment and is never
  recorded here.
- Instance/build label: `postfix-w19`.
- Run root: `F:\fxlab-runs\postfix\w19`.
- Product code and shared documents are not edited by this worker.

## Progressive results

| Invocation | Run ID | Process exit | Evaluation | Reported automation result | Oracle |
| --- | --- | ---: | --- | --- | --- |
| 1 | `run-mu1b66qn-8b68746c` | 0 | passed | failed as `auth_required` (`web.auth.required`) | passed |
| 2 | `run-mu1b8i5l-ecb52d6d` | 0 | passed | failed as `auth_required` (`web.auth.required`) | passed |
| 3 | `run-mu1baynd-aef7536d` | 0 | passed | failed as `auth_required` (`web.auth.required`) | passed |
| 4 | `run-mu1bd1kn-c28e1ab5` | 0 | passed | failed as `auth_required` (`web.auth.required`) | passed |
| 5 | `run-mu1bijac-0634f932` | 0 | passed | failed as `auth_required` (`web.auth.required`) | passed |
| 6 | `run-mu1bkpbk-e81bd410` | 0 | passed | failed as `auth_required` (`web.auth.required`) | passed |

All six runs carried the expected structured failure, with no harness activation.
Each run's six sanitized evidence packets were within budget and reported no
truncation.

After run 4, one launcher invocation exited 1 during its prerequisite TypeScript
build because a concurrently changing test file did not compile. It produced no
run ID and did not begin browser execution, so it is not counted among the six
requested W19 runs. The supervisor was notified; live execution remains serialized
and will resume only after the shared source is stable.

## Outcome

Passed: 6/6 actual browser runs exited 0 and their evaluations passed. Every
armed replay reported exactly the expected `auth_required` category with the
fixed `web.auth.required` code; category counts were `auth_required: 6`, all
others: 0. Oracle counts were `passed: 6`, and harness activation counts were
zero in every run.

The safe stage projection is also consistent across all six runs: recording and
Flow creation completed, the two type actions succeeded, and the third action
(the sign-in click) returned the expected structured auth failure. There were no
readiness, startup, transport, or pre-run failures among the six counted runs.
This is the live behavior the recorder-drain repair was intended to restore.

The six run bundles and their failure-policy artifacts remain preserved below
`F:\fxlab-runs\postfix\w19`. I did not inspect raw event payloads, recorded page
data, fixture-secret values, or credentials. I made no product-code or shared-doc
changes and did not commit or push.

Process note: a fixture-only source literal was exposed in initial tool output.
No value or hash is repeated here, and it was not persisted to this tracked
report or to run artifacts.
