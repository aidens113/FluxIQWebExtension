# `bv-w28-focused` — three isolated W28 recording reruns

## Result

The exact cell behind campaign A's second disclosed exception, W28
`iframe-checkout` primary workflow on the recording lane, passed three times in
a row on isolated topology at the acceptance pins. No run reproduced A's startup
failure (`gateway.connection`, `finalized-bundle / scenario.execute /
unclassified`, "Timed out waiting for client gateway").

| Attempt | Run ID | Verdict | Oracle | Harness | Facility failure | Duration |
| ---: | --- | --- | --- | ---: | --- | ---: |
| 1 | `run-mu2h8ku2-521f71ec` | passed | passed | 0 | null | 38,535 ms |
| 2 | `run-mu2h9u41-17c539d7` | passed | passed | 0 | null | 37,416 ms |
| 3 | `run-mu2hb2lg-cc6a1ed1` | passed | passed | 0 | null | 42,698 ms |

Each evaluation was on lane `recording`, so it carried no Flow actions, as on
that lane in the campaigns. Wall time per invocation, including the Lab instance
build, was 59, 57 and 63 seconds.

## Invocation and scope

Run by the supervisor from `F:\!FluxIQWebExtension` at `3d6ecd6` with a clean
tree and Core at `19468b7`, sequentially, immediately after `bu-w14-focused`,
with no other Lab work running:

```text
pnpm lab run iframe-checkout --target isolated --evidence failure
```

Corpus row `row("W28", "iframe-checkout", null)` (`bench/corpus/week1.ts:60`)
confirms the primary workflow with no variant. Environment:
`FLUXIQ_TEST_ENV_FILES=none`; label `bv-w28-focused`; runs root
`F:\fxlab-runs\w28-focused\a`. No fixture secret was needed. The figures come
from the evaluation each run printed.

## Classification

A's failure happened inside topology startup: `GET /` readiness passed, but the
lazily created Core gateway never listened within the 60 s TCP wait, on a fresh
`next dev` Core under shared load. Supervisor worktree test runs overlapped that
window and are disclosed as a likely contributor. Three clean passes in
isolation give no evidence of a W28 product, fixture, or oracle defect.
