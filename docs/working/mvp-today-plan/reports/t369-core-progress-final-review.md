# t369 — final Core progress production review

## Verdict

**NO-GO: one bounded-count defect remains in the stored/public projection.**

The final answerability, loop-progress, completion-parser, service-handoff, and
trace-projection code is otherwise coherent by inspection. The new facts remain
content-free; the generic evidence loop does not import Flow Bootstrap; accepted
and refused completion feedback is unchanged; old rows remain readable because
the four new nested members are optional; provider accounting folding is
unchanged; and the architecture paragraph accurately describes the intended
contract. The one defect below can silently remove legitimate draft/progress
evidence from a supported extend build, so this unit should not close until it
is corrected and covered.

## Required correction

### Legitimate seeded drafts exceed the projection's step-count ceiling

`runtime/flow-bootstrap/evidence-loop-steps.ts:363-403` validates both
`draftChange.keptStepCount` and `draft.steps + draft.unlisted` against
`AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_LIMITS.maxIterations` (64). That is not the
maximum model-visible draft size:

- Flow Bootstrap permits an existing Flow seed with up to 64 total nodes.
- The loop can then append one action for each of 64 decision iterations, plus
  the deterministic iteration-zero observation.
- A supported extend build can therefore measure as many as 129 draft steps,
  and it exceeds 64 as soon as a full-size seed gains one new action.

For such a row, `evidenceStepDraft()` returns `undefined`; trace sanitization and
publication silently omit `draft`. An amendment row can likewise lose
`draftChange` solely because its truthful `keptStepCount` is above 64. This
contradicts the stated preservation contract and makes the exact convergence
instrumentation least reliable on large extend drafts.

Exact correction:

1. Define a Flow-Bootstrap-specific maximum represented draft-step count from
   the supported seed ceiling plus the loop's maximum append opportunities:
   `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_LIMITS.maxTotalNodes +
   AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_LIMITS.maxIterations + 1` (currently
   129). Import the plan limit through `./plan/index.ts`.
2. Use that bound for `draftChange.keptStepCount`, `draft.steps`,
   `draft.unlisted`, and the `steps + unlisted` consistency check. Keep byte
   bounds and amendment-count bounds unchanged.
3. Add parser/sanitizer tests proving a legitimate 64-step seed plus appended
   steps survives at the boundary, while a count above the new maximum is
   dropped by sanitization and rejected by the strict stored-step parser.
4. Update the t355 preservation wording that currently says draft step counts
   are iteration-bounded; they are bounded by the supported seed plus loop
   append capacity.

## Confirmed properties

- Answerability is computed in its Flow-Bootstrap owner and crosses the generic
  completion-check seam only as three booleans and one closed issue code.
- `runtime/service.ts` now returns `verdict.check` on both accepted and refused
  completions; accepted-verdict capture and completion acceptance are otherwise
  unchanged.
- Completion feedback retains the same structure and text. The snapshot is
  attached beside feedback, not inserted into it.
- Draft revision, stable-id, amendment-count, digest-comparison, and
  answerability-state logic changes only trace observations/control handoff;
  it does not alter budgets, provider accounting, completion acceptance, or
  retry limits.
- The initial observation uses the same paired-digest failure semantics as
  ordinary tool rows. Digest strings stay local; only the closed
  changed/unchanged/unobserved value is projected.
- `targetedStepIds` are de-duplicated in request order, parser-checked for
  distinct safe identifiers, and capped at the 16-amendment decision maximum.
- Malformed optional nested evidence is dropped by stored-trace sanitization;
  a record claimed to be Core-authored is rejected by the strict public parser.
- No prompt, instruction quote, page value, selector, tool input, state digest,
  feedback, provider output, script, or content-derived hash is projected.
- Dependency direction and code structure are sound: Flow Bootstrap owns
  answerability and projection, while generic LLM code carries only the closed
  structural contract. The new `evidence-loop/` directory remains within the
  directory-size limit and the coordinator is below the file-length limit.
- The reviewed convergence paragraph in
  `docs/architecture/automation-studio/llm-flow-bootstrap.md` is accurate once
  the count-bound correction above lands. Unrelated paragraphs in that file
  were outside this review.

## Scope and verification

Reviewed the MVP Current State; t350, t353, t354, t355, t357, t358, and t364
reports; Core `AGENTS.md`; and the final relevant production/docs sources for
answerability, loop progress, completion parsing, service handoff, trace
sanitization, public projection, and the architecture paragraph.

Per brief, no source was edited, no tests/builds/provider/live paths or raw
artifacts were run or inspected, and no commit, push, or shared-plan edit was
performed. This report is the only file written.
