# `ad-final-repaired-a` — repaired clean-pinned durable campaign A

**Status:** complete aggregate. The command exited 1 because ten evaluations
failed; it was not interrupted or partial.

**Pins:** downstream `8fb1331660de53da660d060ca2a32ef69372a902` and Core
`19468b72c4472fd5cc58940737702d5e4d72c985`. All 189 evaluated run manifests
record those exact commits with both repositories clean and no compatibility
issues. Both worktrees were still clean after the campaign.

**Campaign:** `bench-mu1esgvq-ea2bcc93`, under the assigned ignored root
`F:\fxlab-runs\final-repaired\a`. The command was `pnpm lab bench --corpus
week1 --repeat 3 --target isolated --evidence failure`, with
`FLUXIQ_TEST_ENV_FILES=none` and instance/build label `ad-final-repaired-a`.
Only the fixture-scoped auth-gate password was resolved directly into the
process environment; it was not printed, persisted, hashed, or reported.

## Durable completion

- The campaign ID was captured from `bench-campaign-created` before the first
  evaluation completed. The process ran continuously, so no resume was needed
  and no replacement campaign was created.
- There are 380 checkpoints, sequentially numbered 0–379. Every checkpoint has
  its digest and every link equals the preceding checkpoint's digest. Generation
  379 is `finished`, contains 189 completed executable cells, and has no active
  attempt.
- `runs.json` contains all 201 planned slots: 189 evaluated runs and 12 planned
  skips. There are 189 evaluation files, and both aggregate report formats exist.
- The terminal campaign has no lease, lease-history entry, or ignored checkpoint.

## Aggregate

| Scope | Evaluated | Passed | Failed | Actions | Not executed |
| --- | ---: | ---: | ---: | ---: | ---: |
| Recording lane | 69 | 69 | 0 | 30 | — |
| Flow lane | 120 | 110 | 10 | 308 | — |
| Both lanes | 189 | 179 | 10 | 338 | 54 |

The aggregate ran from `2026-09-14T15:39:49.240Z` through
`2026-09-14T20:30:57.538Z`. Flow creation passed 40/40 first-run workflows.
Flow initial execution passed 27/29 (93.1%), deterministic replay passed 53/58
(91.4%), and fuzzy recovery passed 18/24 (75.0%). Flow false failures were 3/83
and false successes 1/4. Failure classification was 30/33 (90.9%). The five
required deterministic-fallback rows passed every repeat without harness use
(5/5 rows; 15/15 evaluations). Required W14/W19/W27 categories matched 15/15.

The ten failed evaluations were:

| Row / variant | Count | Category | Bounded result |
| --- | ---: | --- | --- |
| W05 `short-catalog` | 3 | `runtime.behavior` | unexpected `target_not_found` |
| W13 `banner-absent` | 3 | `runtime.behavior` | unexpected `target_not_found` |
| W24 `unannounced` | 3 | `runtime.behavior` | no structured failure; expected `output_not_observed` |
| W11 primary, repeat 2 | 1 | `runtime.behavior` | Flow reported success, but the expected final state did not hold |

The first nine are the three stable misses already ruled out of Week 1. W11
passed in repeats 0 and 1, so its oracle miss is a single 1/3 observation. It is
the only A result that must be checked against repaired campaign B before the
repeatability criterion can close.

## Bounded diagnostics

- Evidence packet budget: 120/120 applicable invariants passed. There were 616
  sanitized-packet samples, maximum 5,992 bytes, p50 4,069 bytes, p95 5,934
  bytes, and 165 truncations. Raw snapshot size has zero samples.
- Redaction: every evaluated bundle contains an attestation. All nine applicable
  auth-gate attestations passed nine declared-literal checks across 18 bounded
  scopes with zero findings; the other 180 attestations are not applicable.
- Harness use: zero activations across all 189 evaluated runs.
- Persistence: zero `recording.persistence` failures. The count-only discard
  reader therefore inspected zero failure runs and found zero action discards,
  event discards, unreadable files, post-finalization entries, or recording-name
  entries. No action-bearing discard failure occurred.
- Run duration was p50 90,819 ms and p95 124,324 ms. Action latency p95 remained
  bounded by operation; `web.dom.wait_for_selector` was the largest at 7,039 ms.

## Validation and remaining assumption

I inspected the aggregate, runs projection, all checkpoint links, all 189 run
pin records, all evaluation projections, redaction attestations, terminal lease
state, and the facility's count-only persistence-discard projection. I did not
read raw page data, raw event payloads, or process logs. Campaign A proves an
uninterrupted complete durable publication at the repaired clean pin. The
supervisor must compare it with independent campaign B to decide whether the
single W11 oracle miss is repeatable or a load-sensitive divergence.
