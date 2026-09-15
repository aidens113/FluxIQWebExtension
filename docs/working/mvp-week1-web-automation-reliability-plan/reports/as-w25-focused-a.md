# `as-w25-focused-a` — isolated W25 reproduction

## Outcome

W25 `delayed-ui` / `too-slow` / Flow passed its contract in three sequential
isolated attempts. Every run created the Flow, executed the first click, failed
the inserted wait as `timeout` / `web.action.timeout`, passed the independent
final-state oracle, and used no harness. No attempt produced
`environment.missing`, a readiness failure, or an unexplained runner failure.

| Attempt | Run | Total | Startup to first bounded event | Recording script | Checkpoint to gateway action | Flow dispatch to final | Runtime actions |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | `run-mu1w17p1-e4fa8dd0` | 55,502 ms | 25,129 ms | 620 ms | 4,447 ms | 22,587 ms | click succeeded in 2,340 ms; wait failed in 7,045 ms |
| 2 | `run-mu1w30wa-c061b7b8` | 60,166 ms | 32,006 ms | 668 ms | 3,603 ms | 21,180 ms | click succeeded in 2,355 ms; wait failed in 7,028 ms |
| 3 | `run-mu1w4y0s-521c437b` | 59,234 ms | 29,647 ms | 1,171 ms | 4,430 ms | 21,358 ms | click succeeded in 2,343 ms; wait failed in 7,023 ms |

All three evaluations were `passed`, with `reportedVerdict: failed` matching the
declared negative expectation, `flowCreated: true`, `oracleVerdict: passed`,
zero harness activations, four sanitized evidence packets, zero truncations,
and a largest packet of 557 bytes. The scripted unarmed recording completed all
four fixture steps before each armed Flow replay. Each run retained a complete
bundle, `.work` was empty afterwards, and no matching Lab process remained.

## Execution boundary

The command was run exactly three times, sequentially:

`pnpm lab run delayed-ui --flow --variant too-slow --target isolated`

All attempts used only `F:\fxlab-runs\w25-focused\a`, instance/build label
`as-w25-focused-a`, and `FLUXIQ_TEST_ENV_FILES=none`. Optional panel credentials
were absent. The fixture-only auth value was resolved directly into each process
with a non-outputting expression and removed afterwards; it was not displayed,
hashed, persisted, or reported.

The artifacts pin downstream
`4d5c8a60be5b66778d2a3b5b3fb0b56e4a70cfde` and Core
`19468b72c4472fd5cc58940737702d5e4d72c985`, with zero compatibility issues.
Core was clean. The downstream run manifests report dirty because the supervisor
had already updated the working plan and dispatch brief after pausing the full
campaign; this worker made no production or shared-document change.

## Conclusion and limits

This focused A-side sample is 3/3 and does not reproduce B's single pre-Flow
`environment.missing` observation. It supports classifying that observation as
intermittent facility/readiness behavior rather than the W25 timeout contract,
but it does not alone identify the missing path/module or prove the issue cannot
recur under concurrent full-corpus load.

Inspection was limited to run/evaluation projections, trigger timestamps,
bounded failure category/code, action/step outcomes, packet sizes, repository
pins, compatibility count, and completion/process state. I did not inspect raw
page data, arbitrary event summaries/details, browser state, credentials, or
recorded content. I changed only this report and did not commit or push.
