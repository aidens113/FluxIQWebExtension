# `ah-final-repaired-comparison` — official repaired A/B comparison

## Outcome

I ran the official comparator from the downstream repository against the two
absolute terminal report paths:

```text
pnpm lab compare F:\fxlab-runs\final-repaired\a\bench\bench-mu1esgvq-ea2bcc93\report.json F:\fxlab-runs\final-repaired\b\bench\bench-mu1es0uy-050c724f\report.json
```

The comparator exited 1 with `outcome: equivalent` and
`comparisonPassed: false`. These facts are intentionally distinct: every
metric carrying a Week 1 tolerance was equivalent, but one result and one
underlying run had different verdicts. The sole difference was W27 primary
Flow repeat 0: A passed, while B failed before Flow creation as
`gateway.pairing`. W27 was therefore `stable-pass:1` in A and
`flaky:0.6666666666666666` in B.

W11 primary Flow repeat 2 failed its final-state oracle in both campaigns, so
it does not appear in the A/B verdict difference. Its identical 2/3 result is
repeatable across this pair, although the row itself is not stable across its
three repeats. The nine other failures in each campaign are the already ruled
out W05 `short-catalog`, W13 `banner-absent`, and W24 `unannounced` variants.

## Metrics and tolerances

All 22 comparable, tolerance-bearing metrics were equivalent:

- Eight applicable rate metrics per lane were compared where populations
  existed. Recording initial execution and replay were both 0.2174 in A and B;
  recording false-failure and harness activation were zero in both. Flow
  creation was 1.000 versus 0.975, initial execution 0.9310 versus 0.8966,
  deterministic replay 0.9138 in both, fuzzy recovery 0.7500 in both,
  false-failure 0.0361 versus 0.0366, false-success 0.2500 in both, failure
  classification 0.9091 in both, and harness activation zero in both. Every
  difference was within its printed tolerance.
- Every action-latency p95 was equivalent. The largest was
  `web.dom.wait_for_selector`, 7,039 ms versus 7,029 ms with a 1,759.75 ms
  tolerance. Run-duration p95 was 124,324 ms versus 119,126 ms with a 31,081
  ms tolerance.
- P50 latency, evidence-size, truncation, and reserved Week 2 fields are
  disclosures with no Week 1 tolerance. Sanitized packet p50/p95 were
  4,069/5,934 bytes in both campaigns; truncation counts were 165 and 163.
  Raw-snapshot samples and all reserved Week 2 values remained null.

## Exit-criterion projection

The official output projects:

1. `actions-reliable`: measured. Recording unarmed results were stable 18/18
   in both campaigns; Flow unarmed results were stable 15/16 in both because
   W11 passed only 2/3. Both reports contain three repeats.
2. `evidence-useful`: partially measured. The reports contain 616 and 618
   packet samples with 165 and 163 truncations, but the comparator correctly
   says the external 16-item and sensitive-input leak assertions are outside
   `BenchReport`.
3. `deterministic-fallback`: measured, 5/5 rows recovered without harness in
   both campaigns across all three repeats.
4. `failures-classified`: measured. Required W14/W19/W27 categories were
   15/15 in both reports; all negative variants were 30/33 because the three
   ruled-out W24 runs did not produce the expected category.
5. `bench-repeatable`: measured, with zero tolerance-bearing metrics outside
   tolerance, but one differing result/run: W27 primary Flow repeat 0.
6. `blockers-ranked`: not measured by `BenchReport`; the official output notes
   that this requires authored ledger evidence.

Thus this pair does not by itself close the Week 1 repeatability decision.
The remaining factual exception is the single B-only, pre-Flow W27 pairing
failure. A senior supervisor must decide whether to repair/recheck that
infrastructure path or retain it as a disclosed blocker; the official
comparator does not permit treating `outcome: equivalent` as a passing
comparison while `comparisonPassed` remains false.

## Durability, evidence, and persistence

Both clean-pinned campaigns completed 189 evaluations plus 12 declared skips
at downstream `8fb1331660de53da660d060ca2a32ef69372a902` and Core
`19468b72c4472fd5cc58940737702d5e4d72c985`. A finished at 179/189 and B at
178/189. Each retained 380 sequential, hash-linked checkpoints (generations
0–379), 189 immutable evaluation receipts, a terminal `finished` checkpoint,
no active attempt or lease, and no ignored checkpoint. Neither uninterrupted
member needed resume, but both retained their originally captured campaign ID.

Both campaigns had zero harness activations and zero recording-persistence
failures. The comparator's failure-scoped persistence projection is zero on
both sides: zero inspected failure runs, action/event discard entries,
post-finalization entries, recording-name entries, or unreadable files. B's
separate count-only all-run projection found 60 evidence-only event-discard
entries but still zero discarded actions, at most one discarded event per
run, and no unreadable event files; no action-bearing discard failure exists.

Evidence stayed bounded: packet p95 was 5,934 bytes in both and each observed
maximum was 5,992 bytes, below the 6,000-byte invariant. Every one of the 378
evaluated bundles had a readable redaction attestation. The 18 applicable
auth-gate attestations passed their bounded declared-literal checks with zero
findings; the other 360 were not applicable. The campaign reports found no
leak, harness, persistence, or action-bearing-discard failure.

## Secret-handling incident

During earlier discovery, a worker accidentally displayed the fixture-only
loopback secret in tool output. Its value is not repeated or hashed here and
was not added to a report or benchmark artifact. This remains a process
violation to disclose even though the value is fixture-scoped rather than a
production credential.

## Validation boundary

I used only the two campaign reports, their bounded terminal report/run
projections, and the official comparator output. I did not inspect raw page
data, event payloads, browser state, process logs, or any secret value. I made
no source changes, and did not commit or push.
