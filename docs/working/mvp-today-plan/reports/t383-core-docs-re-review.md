# t383 — Core draft-packing documentation re-review

## Verdict

**GO.** The corrected draft-packing, measurement, privacy, compatibility,
limit, and provider-free caveat text is consistent with the current Core
implementation and nearby architecture text.

## Resolved finding

1. The former overbroad statement that every provider decision receives a
   Flow-draft beside entry is corrected. The document now says, “Once drafting
   has begun and at least one actionable step exists, a provider decision also
   receives a bounded Flow-draft beside entry.” This matches
   `runtime/llm/evidence-loop.ts`, which requests the entry only while drafting,
   and `automationStudioFlowDraftEntry`, which returns no entry until its
   filtered draft contains an action step. Early decisions without such a step
   are no longer implied to carry an entry or draft-shape measurement.

## Verified accurate

- Production Flow Bootstrap uses a 24,000-byte model-visible evidence context
  and the shared 1,048,576-byte cumulative evidence ceiling. The production
  context derives a 4,000-byte draft budget from
  `min(4_000, floor(maxEvidenceContextBytes / 4))`.
- A complete object-form draft that fits is returned unchanged. Packing is
  attempted only after that representation exceeds the budget.
- `step_rows_v1` declares the documented ten columns in the documented order.
  Rows always contain the first seven cells and trim only trailing optional
  cells, yielding seven through ten cells.
- Packing first tries all steps and all bounded inputs while shortening only
  the instruction. It then withholds bounded inputs oldest-first and removes
  oldest steps only after no all-step candidate fits.
- A step input over the existing 512-byte per-input bound prevents packed-row
  use and remains distinguishable in object form with `inputTooLarge: true`.
- Draft-shape measurement accepts object rows or the exact packed format and
  field declaration. It rejects unknown formats, reordered/missing fields, and
  malformed rows; packed `null` input cells count as withheld.
- The provider-facing draft contains Core bookkeeping and the bounded action
  input originally supplied by the model. The trace retains only draft-shape
  counts/booleans/byte measurements, not the draft entry or step inputs. The
  wording does not claim a new public wire field, stored draft payload, or
  migration requirement.
- The nearby allocation wording matches the loop: the beside entry's serialized
  size is subtracted before ordinary evidence-window selection. The edit does
  not claim changes to provider-call, token, cost, timeout, decision, or retry
  ceilings.
- The provider-free caveat is appropriately narrow: deterministic fixtures can
  establish packing, measurement, and retention properties, but not provider
  convergence or a live product outcome. It does not contradict the downstream
  Current State, which says the correction has not yet been measured in a newly
  authorized live run.
- No contradiction was found with the adjacent diagnostic-retention,
  persistence, evidence-window, or generated-result text.

## Markdown hygiene

`git diff --check -- docs/architecture/automation-studio/llm-flow-bootstrap.md`
completed without whitespace errors. Git emitted only the repository's LF to
CRLF working-copy warning. Headings, lists, inline code, and paragraph spacing
in the changed region are structurally sound; no Markdown-lint command is
configured in the Core root package.

## Scope and verification

Reviewed the downstream documentation rules and MVP `Current State`, t380's
audit, Core's repository/documentation boundary, the current Core document diff,
and the owning draft-entry, draft-shape observer, loop configuration, loop
assembly, and production evidence-limit sources. I did not edit Core source or
shared authored documentation, run provider/live paths, inspect private
artifacts, commit, or push. This report is the only file changed.
