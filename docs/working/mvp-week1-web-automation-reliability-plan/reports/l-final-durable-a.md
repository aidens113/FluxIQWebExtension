# `l-final-durable-a` — complete durable Week 1 bench A

**Status:** complete aggregate; the command exited 1 because the aggregate
contains failed evaluations. This is a complete bench, not an interrupted or
partial result.

**Pins:** downstream `003ea99218cfc0f7320b31b06bc553771eae967d`, equal
to pushed `origin/dev`; Core
`19468b72c4472fd5cc58940737702d5e4d72c985`, equal to pushed
`origin/dev`. Both repositories were clean before launch, all 189 run
manifests recorded those exact clean pins, and both repositories remained
clean after the aggregate completed.

**Campaign:** `bench-mu0zusso-f044675b`, under the assigned ignored run root
`F:\fxlab-runs\final3\a`. The command was `pnpm lab bench --corpus week1
--repeat 3 --target isolated --evidence failure`, with
`FLUXIQ_TEST_ENV_FILES=none`, Lab/build labels `l-final-durable-a`, and only
the fixture-scoped auth-gate password populated as a secret. The secret was
read directly into the process environment and was never printed, persisted,
hashed, or included in this report.

## Durable completion

- The campaign ID was captured from `bench-campaign-created` before the first
  result completed. The process ran continuously, so this campaign did not
  require the resume command.
- Final checkpoint generation 379 is `finished`, contains exactly 189
  completed executable cells, and has no active attempt.
- `runs.json` contains all 201 planned slots: 189 evaluated runs and 12
  planned skips (four skip definitions across three repeats).
- There are exactly 189 direct-child run directories, 189 completion markers,
  and 189 evaluations. `report.json` and `report.md` both exist.
- No replacement campaign was started. The sampled free-memory minimum during
  the concurrent A/B execution was 9,798 MiB.

## Aggregate

| Scope | Evaluated | Passed | Failed | Actions | Not executed |
| --- | ---: | ---: | ---: | ---: | ---: |
| Recording lane | 69 | 69 | 0 | 30 | 54 |
| Flow lane | 120 | 110 | 10 | 305 | 1 |
| Both lanes | 189 | 179 | 10 | 335 | 55 |

The aggregate ran from `2026-09-14T08:41:43.754Z` through
`2026-09-14T13:27:42.760Z`. Flow creation passed 40/40 first-run workflows.
Flow initial execution passed 27/29 (93.1%); deterministic replay passed
53/58 (91.4%); fuzzy recovery passed 18/24 (75.0%). Flow false failures were
3/83 and false successes 0/3. Failure classification was 30/33 (90.9%).

The 10 failed evaluations were bounded as follows:

| Row / variant | Count | Category | Bounded cause |
| --- | ---: | --- | --- |
| W05 `short-catalog` | 3 | `runtime.behavior` | unexpected `target_not_found` |
| W13 `banner-absent` | 3 | `runtime.behavior` | unexpected `target_not_found` |
| W24 `unannounced` | 3 | `runtime.behavior` | no structured failure; expected `output_not_observed` |
| W25 primary, repeat 1 | 1 | `unknown` | `fetch failed` |

The first three groups are the nine stable misses already ruled out of Week 1
in the shared plan. W25 passed in repeats 0 and 2, making its fetch failure a
single 1/3 observation rather than a stable failure.

## Bounded diagnostics

- Evidence packet budget: 119/119 applicable run invariants passed. There
  were 610 sanitized-packet samples, maximum 5,992 bytes, p50 4,084 bytes,
  p95 5,934 bytes, and 167 truncations. Raw snapshot size is not a Week 1
  producer and has zero samples.
- Redaction: all 189 bundles contain an attestation. The nine applicable
  auth-gate attestations passed nine declared-literal checks across 18 bounded
  scopes with zero findings; the other 180 attestations are not applicable.
- Harness use: zero activations across all 189 evaluated runs.
- Persistence: zero `recording.persistence` failures. The count-only discard
  diagnostic therefore reports zero inspected failure runs, zero action- or
  event-discard entries, zero unreadable event files, and zero maxima. In
  particular, no action-bearing discard failure occurred.
- Harness/persistence failures did not account for the single `unknown`
  failure; its bounded aggregate cause is only `fetch failed`.

## Validation and remaining assumptions

The completed report, projection, checkpoint, bundle markers, evaluations,
and manifest pins were inspected directly. No raw page data or raw event
payload was read for this report; discard diagnostics used the facility's
count-only reader. This campaign demonstrates uninterrupted durable
publication and exact final coverage. Crash/resume behavior is established by
the separate forced-death acceptance run in the shared state, not re-exercised
by A because A suffered no interruption. Final repeatability and row-change
judgment still require the tracked A/B comparison of this aggregate against
the independently completed B campaign.
