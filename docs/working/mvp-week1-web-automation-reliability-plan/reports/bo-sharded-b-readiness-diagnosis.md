# `bo-sharded-b-readiness-diagnosis` — bounded finalized-bundle diagnosis

## Classification

Sharded-final B's shard 000 cell 10 is an isolated, non-repeating **Testing
Lab/Core readiness timeout**, not observed W05 product behavior. The immutable
typed diagnostic closes the boundary to:

```text
finalized-bundle / scenario.execute / readiness.timeout / core.health / 60000 ms
```

The result finalized as `process.startup` before a recording step, action,
oracle, product verdict, evidence packet, or harness activation. Available
same-result peers are all passing: ten passes across the current A/B campaigns
and the prior repaired A/B pair, versus this one readiness failure.

## Exact cell and evaluation

- Parent campaign: `bench-mu1ya4i1-dd6087fc`, schema/semantics 0.3, three
  `result-round-robin-v1` shards and two jobs.
- Child campaign: `bench-shard0-9b86cb44`.
- Cell: ordinal 10, W05 `product-catalog` / `paginated-extraction`, unarmed
  recording lane, repeat 1, attempt 1.
- Finalized run: `bench-shard0-9b86cb44-c10-a1`.
- Evaluation schema 0.2: verdict `failed`, category `process.startup`, typed
  facility failure exactly as shown above.
- Duration: 74,759 ms. The finalized manifest spans the same 74,759 ms; the
  closed readiness bound is 60,000 ms.
- `flowCreated`, oracle verdict, reported verdict, and automation failure are
  all null. The bundle has zero recorded steps and actions; the evaluation has
  zero actions, sanitized packets, truncations, and harness activations. Its
  sole invariant is the failed `runner-verdict` invariant.

Because this is the recording lane, null `flowCreated` is expected and does not
itself identify a defect. The zero-step readiness shape proves only that W05's
recording/oracle behavior was not reached.

## Integrity and cleanup

- Generation 22 contains the completed cell with no active attempt, and its
  evaluation byte digest matches the checkpoint's immutable reference.
- The receipt matches the child campaign ID, child plan digest, cell key,
  complete cell identity, attempt, and run ID. The finalized bundle evaluation
  identity also matches the campaign evaluation.
- The bundle has its completion marker; the marker's artifact-index digest
  matches the index bytes. Manifest and summary both record failure.
- The failed bundle reports no produced artifacts or child-process exits and
  `redactionState: not_applicable`. No run-owned work directory, staging
  directory, or child `interrupted/` copy remains.
- A bounded strict chain load while the campaign continued found generations
  0--25 contiguous, latest state `running`, and zero ignored checkpoint files.
  This is a point-in-time chain observation, not a claim that the campaign was
  terminal.

## Peer evidence

Current sharded campaigns, same W05 result group:

| Campaign | Repeat | Observation | Duration |
| --- | ---: | --- | ---: |
| A | 0 | Passed; oracle passed; no facility failure/harness | 47,815 ms |
| A | 1 | Passed; oracle passed; no facility failure/harness | 46,661 ms |
| A | 2 | Active and not yet completed at inspection | — |
| B | 0 | Passed; oracle passed; no facility failure/harness | 44,865 ms |
| B | 1 | Core-health readiness timeout described above | 74,759 ms |
| B | 2 | Passed; oracle passed; no facility failure/harness | 46,454 ms |

The prior repaired serial A/B campaigns contribute six more passing W05
recording evaluations, all three repeats on each side. They have passing
oracles, no facility category or harness activation, and durations from 25,860
to 45,249 ms. In particular, the exact repeat-1 identity passed in current A
and in both prior campaigns. No inspected peer reproduces the B timeout.

## Conclusion

The typed boundary removes the ambiguity present in the earlier W25 incident:
this failure belongs specifically to Core readiness during scenario execution.
It is not evidence that `product-catalog`, paginated extraction, recording, or
the oracle failed. The passing peers rule out a deterministic W05 defect in the
available sample; the roughly one-timeout-long duration increase is consistent
with the closed diagnostic but is not used to infer any narrower cause.

No product or fixture change is justified from this observation. Preserve it
as a classified facility failure in the final comparison and use the requested
focused W05 recording reruns to test recurrence after the full campaigns stop.

## Inspection boundary

I read only the named B campaign/child authority, its cell-10 completion and
evaluation, the named finalized bundle's bounded structural fields, and the
same W05 evaluation fields from available current/prior A/B peers. I did not
read or emit event messages, first-failure text, logs, screenshots, page data,
environment values, credentials, or secrets. I ran no Lab command and changed
no code. No commit or push was performed.
