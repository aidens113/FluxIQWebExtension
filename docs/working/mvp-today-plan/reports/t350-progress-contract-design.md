# t350 — Privacy-safe draft identity and semantic-progress contract

## Decision

Core can publish enough information to distinguish a genuinely changing build from a
cycle without retaining prompts, page values, selectors, tool arguments, plan text, or
provider output. Most of the source information already exists:

- each newly appended draft step already receives a build-local, immutable `dN` id;
- seeded steps retain their existing ids;
- state digests already bracket tool execution when the domain offers the hook;
- the completion gate already computes whether a plan returns or stores records; and
- `AutomationStudioLlmEvidenceLoopDraftShown` already measures the exact draft entry
  shown to each decision.

The missing work is an explicit state-transition projection on the evidence trace and
carrying that projection through both stored-trace rebuilders. Do not add content
hashes. Sequential ids, revisions, closed enums, booleans, and bounded counts are enough.

This is instrumentation first, not a policy change. It must not alter provider prompts,
completion acceptance, loop budgets, retry limits, draft amendment behavior, or the
answerability rule.

## Proposed public trace contract

Add these three nested, optional members to
`AutomationStudioLlmEvidenceLoopTrace`. They are optional for compatibility with stored
records made before the change. Every new loop row should carry `progress`; `draftShown`
is present exactly when that decision was shown a draft; `draftChange` is present only
on an amendment decision.

```ts
type AutomationStudioLlmEvidenceLoopProgress = {
  /** Build-local revision before and after this row. */
  draftRevisionBefore: number;
  draftRevisionAfter: number;
  /** A content-free account of the state transition represented by this row. */
  pageState: "changed" | "unchanged" | "unobserved";
  draftState: "changed" | "unchanged";
  answerabilityState: "first_observed" | "changed" | "unchanged" | "unobserved";
};

type AutomationStudioLlmEvidenceLoopDraftChange = {
  /** Stable ids resolved before applying the requested amendments. */
  targetedStepIds: string[];
  appliedCount: number;
  refusedCount: number;
  /** Proposed steps left after applying edits and withdrawing a rerun target. */
  keptStepCount: number;
  /** Stable id of the withdrawn step when a rerun was accepted. */
  rerunStepId?: string;
};

type AutomationStudioLlmEvidenceLoopAnswerability = {
  recordsRequested: boolean;
  recordProducerPresent: boolean;
  recordStorePresent: boolean;
  /** Present only for the one current capability refusal. */
  issueCode?: "bootstrap.cannot_answer_instruction";
};

type AutomationStudioLlmEvidenceLoopTrace = {
  // existing members unchanged
  draft?: AutomationStudioLlmEvidenceLoopDraftShown;
  progress?: AutomationStudioLlmEvidenceLoopProgress;
  draftChange?: AutomationStudioLlmEvidenceLoopDraftChange;
  answerability?: AutomationStudioLlmEvidenceLoopAnswerability;
};
```

`draft` is the existing `AutomationStudioLlmEvidenceLoopDraftShown`; no new shape is
needed. Its fields (`bytes`, `budget`, `steps`, `instructionBytes`, `unlisted`,
`withoutInput`, `inputTooLarge`, `overBudget`, and `budgetBelowFloor`) should finally be
carried through the stored trace and published step.

### Revision semantics

`draftRevision` starts at `0` after the seed has been installed. Revision zero therefore
means “the initial draft for this build,” whether empty or seeded. It increments exactly
once for each row whose operation changes the model-visible draft structure:

- a tool row that appends a draft-visible action step increments it;
- an amendment row with at least one applied edit increments it once, regardless of how
  many edits it applies;
- an accepted rerun increments the amendment row once when its target is withdrawn, then
  the ensuing tool row increments again if it appends the replacement step;
- refused/unchanged amendments, observations that do not enter the draft, unusable
  completions, and accepted completions do not increment it.

“Draft-visible action step” should use the same inclusion rule as the actual draft entry,
not `effectApplied` or tool success as a proxy. Compute a small content-free signature
from the entry's structural sources before and after the row (stable id, position,
disposition, proposability, and routing ids/kind), or centralize an equivalent predicate
beside `automationStudioFlowDraftEntry`. Do not hash `input`, `ranWith`, settings, result
data, or any page/provider value. If settings can materially change the authored Flow,
an applied settings amendment already increments the revision through `appliedCount`.

`draftRevisionBefore === draftRevisionAfter` means no structural draft progress. The
revision is diagnostic identity, not a persisted Flow revision and not a cross-run id.

### Stable step-id semantics

The loop already mints `d1`, `d2`, … in `draftRecord`, and routing already treats `id` as
immutable across reorder. Reuse those ids; do not add another identity system.

For an amendment row, resolve each requested position against the pre-amendment draft and
publish the distinct matching ids in request order. A `no_such_step` request contributes
no invented id; its bounded position remains available in existing
`amendmentsRefused`. `rerunStepId` is the pre-amendment id of the accepted rerun target.
Seed ids may be `fN` or another Core-owned identifier, so the sanitizer should accept the
general safe identifier shape already used for step/node ids (`[a-z0-9_.:-]`, bounded),
not only `dN`.

There is one implementation detail worth correcting while touching this seam:
`draftAppended` currently begins at zero even for a seeded draft. Seed ids are currently
`fN`, so they do not collide with `dN`, but initializing the new-step counter from the
largest existing Core-minted `dN` makes uniqueness an explicit invariant for any future
seed source.

### Page-state semantics

For a tool row only:

- `changed` when both `stateBefore` and `stateAfter` were captured and differ;
- `unchanged` when both were captured and are equal; and
- `unobserved` when either digest is absent.

All non-tool rows use `unobserved`. Never infer page-state change from `effectApplied`, a
success code, or evidence bytes. Those report different facts and were precisely what
made the repeated live runs ambiguous.

### Answerability semantics

Return a content-free snapshot from the existing answerability check on every completed
plan that reaches that check:

- `recordsRequested` is the instruction classifier's boolean;
- `recordProducerPresent` is `found.returning.length > 0`;
- `recordStorePresent` is `found.storing.length > 0`; and
- `issueCode` is present only when the existing cannot-answer refusal is returned.

The existing “library has no record-producing node, therefore do not issue an
uncorrectable refusal” behavior remains unchanged. The snapshot may still say all three
booleans are false and omit `issueCode` in that case.

Carry the snapshot through `AutomationStudioLlmEvidenceCompletionCheck` for both accepted
and refused checks. The loop stores the latest observed snapshot and labels the current
completion row:

- `first_observed` for the first snapshot;
- `changed` when any of the three booleans or `issueCode` differs from the prior snapshot;
- `unchanged` when the snapshot is identical; and
- `unobserved` on rows that did not reach this check.

This distinguishes “the plan still cannot answer” from a new completion that repaired the
capability while avoiding the instruction quote, column names, step definitions, script,
or feedback.

## Sanitization and compatibility rules

The stored/public projection should apply these bounds:

- revisions and all counts: safe integers from zero through the evidence-loop iteration
  limit, except draft byte counts, which use the existing evidence-byte ceiling;
- `targetedStepIds`: at most 16 entries (the amendment-decision maximum), each matching
  the existing safe identifier grammar and length;
- `rerunStepId`: the same identifier grammar;
- progress fields: exact closed enums, with no extra keys;
- answerability: exact boolean fields and the single closed issue literal;
- `draft`: exact known fields, non-negative integers, `steps + unlisted` bounded by the
  maximum draft steps represented by the loop, `withoutInput` and `inputTooLarge` no
  greater than `steps`, and optional flags accepted only as literal `true`.

As with the existing reader details, malformed optional instrumentation should be left
behind rather than fail an otherwise completed build. The external published-step parser,
however, should continue rejecting unknown or malformed fields because it is parsing a
record claimed to have been written by Core.

Old records remain valid because all new fields are optional. New readers gain fields;
old readers that enforce an exact key allow-list will reject new steps, so the downstream
safe live-run snapshot/parser must be updated in the same work unit before a new run is
recorded. No wire version is needed if Core and the downstream runner are released and
validated together, as this paired task already requires.

## File-partitioned implementation

### Core partition A — loop-owned contracts and measurement

Files:

- `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/trace.ts`
- new cohesive type files under the same directory if needed (one exported type per file,
  exported by `evidence-loop/index.ts`)
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/completion-check.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop-decision.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop.ts`

Changes:

1. Declare the three bounded nested types and add them to trace rows.
2. Permit the completion-check parser to accept the answerability snapshot on both `ok`
   variants using exact-key validation.
3. Maintain the build-local draft revision and previous answerability snapshot.
4. Resolve amendment target ids before edits, then record the transition after edits.
5. Derive page-state only from paired state digests.
6. Attach `progress` in the centralized `recordRow` path so no row-producing branch can
   silently omit it; pass only the row-specific before/after facts into that helper.

### Core partition B — answerability source

Files:

- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/answerability/contracts.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/answerability/check.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/bootstrap-completion.ts`

Changes:

1. Add the content-free snapshot to both answerability verdict variants.
2. Compute `plan-record-sets` once for every completion that reaches this check.
3. Preserve all current pass/refusal branches and feedback verbatim.
4. Place the snapshot on both the accepted completion verdict and the refusal's
   `AutomationStudioLlmEvidenceCompletionCheck`.

The success verdict currently has no `check` member. Either add an internal
`answerability` member to `AutomationStudioFlowBootstrapCompletionVerdict` and have the
service return `{ ok: true, answerability }` to the evidence loop, or make the successful
completion check itself carry the optional snapshot. The latter keeps the trace concern
in the loop contract and is the smaller seam.

### Core partition C — stored/public projection

Files:

- `packages/fluxiq/src/programs/automation-studio/runtime/service/flow-bootstrap-commands/evidence-trace.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/evidence-loop-steps.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/diagnostic-parse.ts`

Changes:

1. Sanitize and retain `draft`, `progress`, `draftChange`, and `answerability` member by
   member.
2. Add the same fields to `AutomationStudioFlowBootstrapEvidenceStep` and its exact field
   allow-list/parser.
3. Reuse `automationStudioFlowBootstrapEvidenceSteps` for both proposed-build audit detail
   and failed-build diagnostics, as today; do not introduce a second projection.
4. Keep provider-call folding by iteration unchanged. The new fields describe rows, not
   paid calls.

### Downstream paired partition — safe live-run snapshot

The implementing supervisor should locate the existing test-runner parser/projection that
reads `evidenceLoop.steps` (the current source comment names
`packages/test-runner/src/existing-fluxiq-control/adaptation-evidence-loop.ts`) and update
its exact allow-list and snapshot type for the four Core fields. This worker did not inspect
the downstream source because the brief bounded source inspection to Core. The downstream
projection must copy only the sanitized Core members; it must not recover raw trace rows,
call ids, prompts, evidence values, or plan text.

## Tests

### Focused loop tests

In `runtime/llm/tests/evidence-loop*.test.ts` and the owned
`runtime/llm/evidence-loop/tests/` directory, add deterministic cases that prove:

- revisions remain unchanged for pure observation, refused edit, unusable completion, and
  accepted completion;
- an action append, applied edit, accepted rerun withdrawal, and rerun replacement produce
  the exact revision transitions described above;
- reordered/dropped steps retain their stable ids;
- amendment rows publish resolved ids, counts, kept count, and rerun id without input;
- equal/different/missing digest pairs map to unchanged/changed/unobserved;
- first, repeated, and changed answerability snapshots map to the four closed states; and
- no provider-visible evidence changes as a consequence of adding the instrumentation.

Extend the existing real-entry `draft-shown.test.ts` only for invariants not already pinned;
it already proves the measurement is derived from actual draft entries.

### Answerability tests

Extend `runtime/flow-bootstrap/answerability/tests/check.test.ts` to assert snapshots for:

- no record request;
- returning records;
- storing records;
- neither, with `bootstrap.cannot_answer_instruction`; and
- a registry incapable of record output, which still passes without the issue code.

Extend bootstrap-completion tests to prove accepted and refused verdicts carry the snapshot
while existing feedback remains byte-for-byte/structurally unchanged.

### Projection and parser tests

Extend:

- `runtime/service/flow-bootstrap-commands/tests/evidence-trace.test.ts`;
- `runtime/flow-bootstrap/tests/evidence-loop-steps.test.ts`; and
- `runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts`.

The existing “every member survives” rebuilder test should add all four members. Add tests
that malformed nested data is dropped by the sanitizer, rejected by the stored-step parser,
and cannot carry an extra key or prose. Assert the same enriched step is produced for a
proposed audit detail and a failed-build diagnostic.

### Deterministic integration fixture

The instrumentation tests do not replace t348's required 26-decision service-boundary
fixture. That fixture should assert the new row sequence:

- the draft revisions and stable ids at each amend/rerun transition;
- whether the two cannot-answer completions saw identical or changed answerability state;
- exact provider-decision and tool-call accounting; and
- the companion success branch changing to a producer-present snapshot before completion.

This creates the evidence needed to select a policy fix; it must not assert that the new
instrumentation itself makes the failure converge.

## Risks and review gates

- **False progress:** incrementing revision for every tool result would relabel repeated
  observations as draft progress. Hold the revision to the model-visible draft structure.
- **Identity collision:** seed ids and new `dN` ids must remain unique within the build.
- **Rebuilder omission:** there are two public paths (proposed audit and failed diagnostic),
  both fed by the same step projection but preceded by a sanitizer on the proposed path.
  The exhaustive preservation test is mandatory.
- **Answerability coupling:** answerability is Flow-Bootstrap-specific; keep its computation
  in `flow-bootstrap/answerability` and only carry its closed snapshot through the generic
  loop completion-check seam.
- **Compatibility:** exact downstream parsers must land with Core. Existing stored rows must
  continue to parse with all new members absent.
- **Privacy:** do not publish call ids, instruction quotes, columns, definition lists,
  settings, inputs, selectors, state digests, hashes of content, feedback, or scripts.
- **Behavior drift:** the first implementation should be observational. A later progress
  policy change must be selected from the deterministic fixture/new trace and tested as a
  separate change.

## Files inspected

- `F:/!FluxIQ/AGENTS.md`
- `runtime/llm/evidence-loop/draft-shown.ts`
- `runtime/llm/evidence-loop/trace.ts`
- `runtime/llm/evidence-loop/result.ts`
- `runtime/llm/evidence-loop/completion-check.ts`
- `runtime/llm/evidence-loop.ts`
- `runtime/llm/evidence-loop-decision.ts`
- `runtime/llm/loop-configuration.ts`
- `runtime/flow-draft/step.ts`
- `runtime/flow-draft/routing.ts`
- `runtime/flow-draft/amendment.ts`
- `runtime/flow-bootstrap/decision-step-ids.ts`
- `runtime/flow-bootstrap/evidence-loop-steps.ts`
- `runtime/flow-bootstrap/answerability/contracts.ts`
- `runtime/flow-bootstrap/answerability/check.ts`
- `runtime/llm/harness-options/bootstrap-completion.ts`
- `runtime/service/flow-bootstrap-commands/evidence-trace.ts`
- `runtime/flow-bootstrap/generation-failure/diagnostic.ts`
- `runtime/flow-bootstrap/generation-failure/diagnostic-parse.ts`
- `runtime/flow-bootstrap/generation-failure/evidence-failure.ts`
- focused draft-shown and evidence-trace tests named above

No raw run artifact, prompt, page/provider content, browser state, or secret was inspected.
No source, test, shared plan, provider, build, commit, or push was changed or run. This
report is the only file written.
