# `bu-w14-focused` — three isolated W14 Flow reruns

## Result

The exact cell behind campaign B's first disclosed exception, W14
`modal-flows` / `interstitial` on the Flow lane, passed three times in a row on
isolated topology at the acceptance pins. No run reproduced B's startup
failure (`process.startup`, `finalized-bundle / scenario.execute / http.timeout
/ project.select / 30000 ms`).

| Attempt | Run ID | Verdict | Oracle | Flow created | Actions | Harness | Facility failure | Duration |
| ---: | --- | --- | --- | --- | --- | ---: | --- | ---: |
| 1 | `run-mu2h3iwq-fc8c53cf` | passed | passed | yes | click, wait_for_selector, click | 0 | null | 56,939 ms |
| 2 | `run-mu2h59v9-7417a490` | passed | passed | yes | click, wait_for_selector, click | 0 | null | 58,772 ms |
| 3 | `run-mu2h6yxo-591c2cff` | passed | passed | yes | click, wait_for_selector, click | 0 | null | 54,866 ms |

Each evaluation had schema 0.2, lane `flow`, reported verdict `passed`, no
reported or expected automation failure, both invariants passing
(`runner-verdict`; `evidence-packet-budget` with 6 packets, the largest 4,467
bytes), zero truncations, and LLM disabled. Wall time per invocation, including
the Lab instance build, was 78, 83 and 75 seconds.

## Invocation and scope

Run by the supervisor from `F:\!FluxIQWebExtension` at `3d6ecd6` with a clean
tree (`head=3d6ecd6 status=0`) and Core at `19468b7`, sequentially, with no other
Lab work running:

```text
pnpm lab run modal-flows --workflow interstitial --target isolated --evidence failure --flow
```

Environment: `FLUXIQ_TEST_ENV_FILES=none`; label `bu-w14-focused` for
`FLUXIQ_LAB_INSTANCE`, `EXTENSION_TEST_BUILD_LABEL` and `DOMAIN_TEST_BUILD_LABEL`;
runs root `F:\fxlab-runs\w14-focused\a`. No fixture secret was needed. The
figures come from the evaluation each run printed.

An earlier launch at 00:09 local was a supervisor script defect: PowerShell
passed the arguments to `pnpm` as a single string, so all attempts were refused
as `fixture.invalid` before any runs folder existed. Those attempts exercised
nothing and are not counted.

## Classification

B's failure happened inside topology startup, the first request to a route on a
fresh `next dev` Core under shared load, before any browser or step. Three clean
passes in isolation give no evidence of a W14 product, fixture, or oracle
defect. They support keeping the B observation as the disclosed startup
exception that the production-Core fix addresses.
