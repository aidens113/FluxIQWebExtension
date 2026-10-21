# t752 integration: offline disclosure review

## Current State

t752 source is checkpointed and frozen. P5 is on dev; P6 has not begun.
Supervisor is completing t753 integration before merging current dev into t752.

## Bounded brief

- Owner: recover_t752; read-only compatibility investigation, no implementation.
- Read this brief and t752 recovery report; no broad planning-document rediscovery.
- Read main downstream `domain/src/runtime/offline-reads/read-eligibility.ts`,
  `reevaluator.ts`, `control-reproduced.ts`, and t752 extension
  `src/content/extraction/text-disclosure/read-disclosing.ts` plus
  `src/content/actions/extract-list.ts`. Owning tests may clarify these seams.
- Determine how t752 automatic kept-row disclosure behaves with P5's inert
  snapshot reevaluation. An unsupported disclosure must be an explicit evidence
  gap; it must never press a live control or silently claim expanded content.
- Report actual behavior, concrete call chain and required P6 integration guard,
  separating verified source facts from assumptions. Do not start browsers/builds.
- Write only own report in t752 downstream:
  `docs/working/trace-offline-trials-plan/reports/codex-t752-offline-disclosure-review.md`.
- No shared documents, source edits, commits, merges, paid calls or panel management.
- Keep source frozen; final browser/type checks await supervisor integration signal.

## Integration correction (2026-10-21)

Read-only review found an actual P5/t752 compatibility defect: a changed read that
needs inert collapsed text can return an answered failure instead of an explicit gap.
Current dev has now been merged into t752 downstream. Core has only generated
reference conflicts; supervisor regenerates them, without source conflict.

- Implement this bounded compatibility correction in t752 downstream only.
- Own `domain/src/runtime/offline-reads/dynamic-content.ts`, its call site in
  `reevaluator.ts` if required, and `offline-reads/tests/reevaluator.test.ts`.
- Use measured incomplete-text failure plus normalized automatic-disclosure
  semantics (default true), or an existing equally precise execution observation.
  Do not classify all OUTPUT_NOT_OBSERVED failures as dynamic; preserve explicit
  opt-out and already-complete captured-text behavior. No implicit live fallback.
- Add focused regressions for default/explicit auto, opt-out, complete text and
  unrelated ordinary failure. Extend the owning realistic offline browser spec
  if needed to prove the new actual content path; no synthetic browser fixture.
- Update the authored offline-read architecture paragraph if semantics change.
- Append progress/results to own offline-disclosure report. No other source files
  or shared working documents, commits, builds or paid calls. Coordinate before
  any additional file is required. Final build/gates follow incoming t753 dev.
