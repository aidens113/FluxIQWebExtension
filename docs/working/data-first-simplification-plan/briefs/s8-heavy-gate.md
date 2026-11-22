# S8: memory-aware machine gate

Owner: lead; implementation in shared MeritPrompts tooling, not browser runtime.
Scope: replace the ad-hoc machine heavy-step gate with a tested reusable tool; keep the existing FluxStuff entry path as a compatibility launcher after a safe switch.

- Diagnose confirmed FIFO race: position < freeSlots lets later tickets overtake the oldest under constrained memory. Serialize admission and admit the oldest live ticket only.
- Admission accounts for the incoming command's declared/learned peak need, outstanding reservations not yet reflected in telemetry, physical reserve and system commit headroom. Keep at most two heavy jobs. No priority bypass.
- Capture system memory and active child-tree usage; record peak observations for future estimates. Unknown/missing telemetry is explicit and must not guess available commit space. Never print command arguments containing secrets.
- Preserve run/acquire/renew/release/status, dead-process cleanup, run child completion and cancellation semantics. Renewal cannot move an active holder to the queue. Account for a surviving child when its launcher dies.
- Use atomic admission with crash-recoverable ownership; no check-then-create oversubscription, duplicate-label deletion, partially written JSON deletion or FIFO skip.
- Tests use temporary state and synthetic telemetry; cover two simultaneous admissions, scarce-memory FIFO, future peak reservation, commit pressure, dead owner/child, renew/release ownership, child failure and telemetry failure.
- Active legacy jobs keep the old code until drained. Prepare/test first; deploy the compatibility launcher only after the old holders AND queue are empty. Do not kill jobs, lower thresholds or set priority to force a switch.
- Source/validation/history belong in MeritPrompts; machine state/history remains ignored outside repositories. Record the final install path and exact checks in the paired data-first ledger.

Status: shared implementation and 24 focused tests pass on feat/memory-aware-heavy-gate; full Merit suite pending. Existing machine gate remains unchanged until a coordinated quiet switch.
