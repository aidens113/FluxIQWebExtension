# `l-final-durable-b` — durable final Week 1 bench B

## Outcome

The complete aggregate was published for campaign
`bench-mu0zuaod-8a35e3d7`. The campaign ran from
`2026-09-14T08:41:20.271Z` to `2026-09-14T13:29:16.105Z` at downstream
`003ea99218cfc0f7320b31b06bc553771eae967d` and Core
`19468b72c4472fd5cc58940737702d5e4d72c985`, both clean and equal to their
`origin/dev` pins before launch. It completed without interruption, so the
explicit resume path was not needed in this member of the A/B pair.

The command was `pnpm lab bench --corpus week1 --repeat 3 --target isolated
--evidence failure`, with `FLUXIQ_TEST_ENV_FILES=none`, both
`FLUXIQ_LAB_INSTANCE` and `EXTENSION_TEST_BUILD_LABEL` set to
`l-final-durable-b`, and
`FLUXIQ_TEST_RUNS_DIR=F:\fxlab-runs\final3\b`. The only populated test secret
was read from the fixture constant into the declared auth-gate environment
variable; its value was never printed, persisted separately, hashed, or
returned.

The CLI exited 1 because 12 measured runs failed their expectations. This was
not a campaign/infrastructure abort: `report.json` and `report.md` were
published after exact plan coverage.

## Durable completion

- Final checkpoint generation: 379, state `finished`.
- Plan cells completed: 189/189; active attempt: none.
- Projection: 201 records = 177 passed evaluations, 12 failed evaluations,
  and 12 planned skips. All 189 evaluated records had unique run IDs and 189
  finalized direct-child run directories.
- Final staging directories: 0; active lease: absent; other bench campaigns in
  the assigned root: 0.
- Aggregate result rows: 63; evaluated runs: 189; actions executed: 340;
  not-executed actions: 54.

## Bounded result summary

Five result rows were below 100%:

| Row | Variant / lane | Passes | Classification |
| --- | --- | ---: | --- |
| W05 | primary / recording | 2/3 | flaky |
| W05 | `short-catalog` / Flow | 0/3 | stable fail |
| W13 | `banner-absent` / Flow | 0/3 | stable fail |
| W19 | `expired` / Flow | 1/3 | flaky |
| W24 | `unannounced` / Flow | 0/3 | stable fail |

The 12 failures group exactly as follows:

- 6 `runtime.behavior`: W05 `short-catalog` and W13 `banner-absent`, all three
  repeats, reported unexpected `target_not_found`.
- 3 `runtime.behavior`: W24 `unannounced`, all repeats, reported no structured
  failure where `output_not_observed` was expected.
- 2 `runtime.behavior`: W19 `expired`, repeats 1 and 2, reported no structured
  failure where `auth_required` was expected.
- 1 `unknown`: W05 primary recording repeat 0 timed out after 10 seconds while
  waiting for the browser service worker.

W05 `short-catalog`, W13 `banner-absent`, and W24 `unannounced` are the rows
already ruled out of Week 1 in the shared plan. W19 `expired` is not ruled out
and is a material final-bench regression. W05 primary recording is also a
single infrastructure-shaped failure that must be compared with bench A.

Negative classification was 28/33 (84.85%) overall. W14 was 3/3, all four W27
negative variants were 3/3 each, and W19 `expired` was 1/3. The other expected
failure rows were: W10 `broken-link` 3/3, W15 `popup-blocked` 3/3, W25
`too-slow` 3/3, W26 `no-context` 3/3, and W29 `save-and-exit` 3/3. W24
`unannounced` was 0/3 but is excluded from Week 1.

Deterministic fallback rows W20-W23 passed 3/3 each. W26 primary recording,
primary Flow, and `no-context` also passed 3/3 each.

## Evidence and integrity diagnostics

- Redaction attestations: 189/189 readable; 9 `passed`, 180
  `not-applicable`, zero findings, zero missing, zero unreadable.
- Sanitized evidence: 620 packet samples; 528-byte minimum, 4,084-byte p50,
  5,934-byte p95, and 5,992-byte maximum, below the 6,000-byte invariant.
  Truncations: 171. Raw snapshot samples: 0.
- Harness activations: 0/189 runs (recording 0/69, Flow 0/120).
- Persistence failures: 0. A count-only scan of all 189 event files found zero
  action-discard entries and maximum discarded actions 0. It found 65
  evidence-only event-discard entries across 65 runs, maximum one discarded
  event, and zero unreadable event files.

## Performance figures

- Run duration: 189 samples, p50 89,505 ms, p95 116,488 ms.
- Action p95 values (samples): navigate 2,305 ms (18), tab 1,037 ms (9),
  check 2,055 ms (9), click 2,377 ms (147), keypress 2,053 ms (18), scroll
  2,080 ms (28), select 2,042 ms (6), type 2,058 ms (75), upload 2,050 ms
  (3), and wait-for-selector 7,040 ms (27).

## Validation and remaining assumptions

I observed the final CLI aggregate, independently checked the terminal
checkpoint/projection/finalized-directory counts, parsed every immutable
evaluation for bounded metrics and expected failure categories, parsed every
redaction attestation, and performed a count-only discard scan without
returning messages, payloads, page data, recording IDs, or secrets.

This report is one side of the required pair. It does not establish A/B
repeatability by itself. The tracked comparison must decide whether the W05
service-worker failure and W19 classification regression reproduce or differ,
and all tolerance-bearing metrics and per-repeat verdicts must agree before
criterion 5 can pass.
