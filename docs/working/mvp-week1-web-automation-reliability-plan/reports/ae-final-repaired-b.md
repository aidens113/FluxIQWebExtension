# `ae-final-repaired-b` — repaired clean-pinned Week 1 campaign B

## Outcome

Campaign `bench-mu1es0uy-050c724f` completed the full Week 1 corpus at
downstream `8fb1331660de53da660d060ca2a32ef69372a902` and Core
`19468b72c4472fd5cc58940737702d5e4d72c985`. Both repositories were clean,
on `dev`, and equal to `origin/dev` immediately before launch. The campaign
ran from `2026-09-14T15:39:28.476Z` until its report was published at
`2026-09-14T20:30:13.941Z`.

The command was `pnpm lab bench --corpus week1 --repeat 3 --target isolated
--evidence failure`, with `FLUXIQ_TEST_ENV_FILES=none`, both instance/build
labels set to `ae-final-repaired-b`, and the run root
`F:\fxlab-runs\final-repaired\b`. The fixture-only auth secret was resolved
directly from its loopback fixture constant into the declared environment
variable. Its value was not printed, persisted separately, hashed, or included
in this report.

The CLI exited 1 because 11 evaluated runs failed their expectations. This was
not a campaign abort: the terminal aggregate and Markdown report were
published after all planned work completed.

## Durable completion

- Final checkpoint generation: 379, state `finished`.
- Checkpoint files: 380, with no ignored/non-generation checkpoint file.
- Plan: 201 cells = 189 evaluated + 12 declared skips.
- Projection: 189 unique immutable evaluation receipts; 178 passed and 11
  failed.
- Run bundles: 189 direct-child run directories, all 189 carrying
  `bundle.complete.json`.
- Active attempt: none. Active lease: absent. Staging/work entries: zero.
- Aggregate rows: 63. Actions executed: 339. Not-executed actions: 55.
- The process was not interrupted, so this member of the pair did not need to
  exercise `--resume`; its campaign ID was captured immediately and retained.

## Verdicts

Five rows were below 100%:

| Row | Variant / lane | Passes | Classification |
| --- | --- | ---: | --- |
| W05 | `short-catalog` / Flow | 0/3 | stable fail, ruled out |
| W11 | primary / Flow | 2/3 | variable |
| W13 | `banner-absent` / Flow | 0/3 | stable fail, ruled out |
| W24 | `unannounced` / Flow | 0/3 | stable fail, ruled out |
| W27 | primary / Flow | 2/3 | variable infrastructure failure |

The nine stable failures are the already ruled-out variants: W05
`short-catalog` and W13 `banner-absent` each reported unexpected
`target_not_found` in 3/3, while W24 `unannounced` reported no structured
failure where `output_not_observed` was expected in 3/3.

Two additional single observations require comparison with campaign A:

- W11 primary Flow repeat 2 created and ran its Flow, but the final-state
  oracle failed while the runtime reported success.
- W27 primary Flow repeat 0 failed before Flow creation as `gateway.pairing`.
  Its closed durable diagnostic was HTTP `control.request` /
  `ECONNRESET`; it carried no actions or evidence packets. This is the same
  bounded transport vocabulary introduced by the repaired diagnostic, not a
  raw cause, URL, body, or response.

The three earlier repair targets were stable-pass: W05 primary recording and
Flow were 3/3 each, W19 `expired` Flow was 3/3 `auth_required`, and every W25
primary/`too-slow` lane was 3/3. Required negative classification was 15/15:
W14 3/3, W19 3/3, and W27's three required negative variants 9/9. Overall
expected-failure classification was 30/33 (90.91%); the only misses were the
three ruled-out W24 runs. Deterministic fallback rows W20-W23 were each 3/3,
and all nine W26 primary/`no-context` evaluations passed.

## Evidence and integrity

- Redaction attestations: 189/189 readable; 9 `passed`, 180
  `not-applicable`, zero findings.
- Sanitized evidence: 618 packet samples; 528-byte minimum, 4,069-byte p50,
  5,934-byte p95, and 5,992-byte maximum, below the 6,000-byte invariant.
  Truncations: 163. Raw snapshot samples: zero.
- Harness activations: zero across all 189 evaluations.
- Recording-persistence failures: zero. A count-only scan of all 189 event
  files found zero action-discard entries, 60 evidence-only event-discard
  entries, maximum discarded actions zero, maximum discarded events one, and
  zero unreadable event files. No messages, payloads, page data, recording IDs,
  or secret values were returned by the scan.

## Performance

- Run duration: 189 samples, p50 89,441 ms, p95 119,126 ms.
- Action p95 (samples): navigate 2,291 ms (18), tab 1,030 ms (9), check
  2,064 ms (9), click 2,375 ms (146), keypress 2,054 ms (18), scroll 2,078 ms
  (28), select 2,037 ms (6), type 2,057 ms (75), upload 2,043 ms (3), and
  wait-for-selector 7,029 ms (27).

## Validation boundary

I observed the terminal CLI aggregate and independently inspected the terminal
checkpoint, campaign compatibility pins, immutable receipts, completed run
bundles, redaction attestations, bounded evidence metrics, lease/work state,
and count-only discard data. This report establishes campaign B only. It does
not establish A/B repeatability: the official comparison must decide whether
W11 and W27 differ from campaign A and whether all tolerance-bearing metrics
are equivalent.
