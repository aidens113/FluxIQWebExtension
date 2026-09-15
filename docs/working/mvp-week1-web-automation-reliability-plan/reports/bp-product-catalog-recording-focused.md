# `bp-product-catalog-recording-focused` — three isolated W05 reruns

## Result

The exact W05 `product-catalog` / `paginated-extraction` recording-lane cell
passed three times sequentially on isolated topology. All three runs reached
the recording script and oracle normally; none reproduced B's classified
`core.health` readiness timeout.

| Attempt | Run ID | Verdict | Oracle | Duration | Harness | Facility failure |
| ---: | --- | --- | --- | ---: | ---: | --- |
| 1 | `run-mu1zvbjt-f607660f` | passed | passed | 21,558 ms | 0 | null |
| 2 | `run-mu1zwd9k-e3c4c200` | passed | passed | 20,404 ms | 0 | null |
| 3 | `run-mu1zxefs-9970a3a0` | passed | passed | 28,970 ms | 0 | null |

Each evaluation used schema 0.2, the baseline variant, repeat index 0, and the
recording lane. Each recorded two completed scenario steps: the
`extract-all-pages` operation followed by `all-pages-extracted`. Each event
chain was contiguous at sequences 1–5 and ended in `final`. No flow creation,
reported automation failure, action, recovery, or LLM call was involved.

## Bundle and cleanup checks

- Each run directory contains `bundle.complete.json`; its run manifest,
  summary, and evaluation all report `passed` and have a finished timestamp.
- Each artifact index contains 11 finalized entries. Failure-only evidence
  retained zero screenshots and zero duplicate screenshots; no trace/video or
  failure capture was present.
- Each redaction attestation is `not-applicable`, with zero literals, findings,
  and advisories.
- `F:\fxlab-runs\product-catalog-focused\a\.work` contains zero files after
  the three runs, and no Node/browser process bearing the focused label remains.

## Classification

The companion B diagnosis classified the failed campaign cell as
`finalized-bundle / scenario.execute / readiness.timeout / core.health /
60000 ms`, before any product step or oracle ran. These three post-stop focused
passes provide no evidence of a deterministic product-catalog, pagination,
recording, or oracle defect. They support retaining the B observation as a
facility failure rather than changing product or fixture code.

## Invocation and scope

All attempts used:

```text
pnpm lab run product-catalog --workflow paginated-extraction --target isolated --evidence failure
```

The runs root was only `F:\fxlab-runs\product-catalog-focused\a`, the build
label was `bp-product-catalog-recording-focused`, and environment-file loading
was disabled. No fixture secret was needed or inspected. No code was changed,
and no commit or push was performed.
