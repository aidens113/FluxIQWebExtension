# P6 smaller-judge intake

Lead read-only discovery, 2026-11-22. No source edits or new acceptance claim.

Current shared result-summary.ts already carries stored record sets, per-read removal/value accounts, flow steps, returned values and typed result evidence. It also includes start/end views and a complete run trail. run-trail/trail.ts explicitly promises every step and its whole finding, replacing only byte-identical views by references. Therefore existing t978 deduplication does not implement L6's smaller evidence contract.

run-trail/of/attempts.ts removes a host raw capture only when a correlated view covers it; run-trail/tests/raw-capture.test.ts explicitly requires retaining raw capture without that view. run-trail/of/observations.ts retains complete observation evidence. These are three distinct paths (attempt calls, completed Flow traces, build-test observations); changing just one leaves oversized judge requests elsewhere.

P6 must define one domain-neutral judge evidence projection: all stored answer rows and deterministic processing/removal accounts, relevant action outcomes/uncertainty, and a concise semantic trail without whole page captures. Preserve declared exclusions, missing-evidence signals, action proofs and original strict oracle; do not solve size by row/step/token caps, guessed data or dropping a failing act. P2's readiness and single run clock must supply the processed result contract. Cache-prefix tests currently assume startView ordering and will need intentional compatibility coverage if that shape changes.

Candidate initial ownership: Core runtime/result-verification/run-trail/**, result-summary.ts and its owning tests, flow-less/build-test adapters only where they compose the same projection, contracts/run-trail.ts if an additive summary contract is needed, and architecture docs. Exact changes require a bounded worker brief after P2's feed contract stabilizes. Existing judge recovery/model routing remain accepted and untouched.
