# t361 — convergence behavior fix selection

## Decision

**NO-GO on a convergence behavior change from the current deterministic evidence.**

The fixture proves that Core delivers the `bootstrap.cannot_answer_instruction`
feedback after decision 10, preserves the correct answerability refusal, permits a
corrected record-producing plan at decision 11, and can persist that plan. Its failure
branch is scripted to ignore the same correction and emit unrelated successful tool
calls until it resubmits an equally unanswerable plan at decision 26. Those intervening
rows really do change the model-visible draft. This is provider-decision variability,
not a demonstrated contradiction in Core's repeat, progress, completion-feedback, or
answerability behavior.

Consequently, changing Core now would choose a theory rather than repair a measured
source defect. In particular, the evidence does not justify forcing a record-producing
node, narrowing the offered tools after a refusal, treating every answerability-neutral
draft revision as a duplicate, or terminating on the second unchanged completion. The
first two can prevent necessary exploration; the latter two only fail faster and do not
improve convergence.

## What the reproduction establishes

- Decision 10 reaches the real completion and answerability path and is correctly
  refused because the plan has neither a record producer nor a record store.
- The next request contains the closed refusal code. The companion branch consumes the
  same prefix and succeeds at decision 11 with `web.output.dom-extract_list` retained.
- The failure branch continues through structurally changing draft rows. It is therefore
  not the repeated-semantic-state case that would select a repeat-policy correction.
- Decision 26 reaches the same answerability state. That proves the scripted provider
  did not repair the capability; it does not prove that Core hid the repair direction or
  rejected a capable plan.
- The current answerability gate is doing safety-relevant correctness work. Weakening it
  would accept a Flow that cannot return the requested rows.

The companion success is especially decisive: with the same source path, limits, first
ten decisions, refusal, feedback seam, registry, and grant, Core accepts and persists the
corrected plan on the very next call. The fixture therefore reproduces the observed
failure shape and accounting, but not a source-owned convergence contradiction.

## Required provider-free discriminator

Before selecting a behavior or prompt change, extend the existing service fixture's
privacy-safe endpoint observation for decisions 11 through 26. Record/assert only these
closed facts for every request after the first refusal:

1. `core.completion_check` feedback is still present, with exactly
   `bootstrap.cannot_answer_instruction` (not only on decision 11);
2. the decision schema still permits completion and the configured evidence tool kinds
   expected at that budget position;
3. the draft measurement reports whether the full draft was shown (`steps`, `unlisted`,
   `withoutInput`, `inputTooLarge`, `overBudget`) without retaining draft content; and
4. the static build context still exposes at least one registered record-producing
   definition, represented as a boolean/count computed by the fixture rather than copied
   node definitions or prompt text.

Use one scripted branch that keeps making distinct draft changes and one that corrects at
11. The assertions select ownership as follows:

- feedback disappears before the late completion → fix evidence-window retention or
  priority;
- completion/tool choices disappear prematurely → fix loop-budget/schema eligibility;
- the draft becomes omitted/truncated in a way that hides the retained state → fix draft
  projection/window budgeting;
- the record-producing capability is absent from the provider-visible static context →
  fix the bootstrap context/registry projection;
- all four remain present → no provider-free Core behavior fix is selected. At that
  point the next measured change must be a narrowly bounded prompt/provider-policy A/B,
  because a deterministic fake provider cannot establish that wording changes a real
  provider's choices.

This experiment is stronger than programming the fake endpoint to obey a new sentence:
that would merely encode the desired outcome in the fake. It also avoids prompts,
provider output, page values, selectors, tool arguments, and recorded content.

## Target files and tests

The discriminator should remain test-only unless it exposes a failed assertion:

- `packages/fluxiq/src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts`
  — extend `DecisionObservation` with the bounded booleans/counts above and assert the
  post-refusal sequence in both fixture branches.

Only after a failed assertion should production ownership be selected:

- feedback retention: `runtime/llm/evidence-context-window.ts` and its focused tests;
- premature decision-choice loss: `runtime/llm/loop-budget.ts`, decision-schema tests,
  and the service fixture;
- draft omission: `runtime/llm/evidence-loop.ts`, `runtime/llm/evidence-loop/draft-shown.ts`,
  and their focused tests;
- missing library capability context: the Flow-Bootstrap provider-context builder and
  its completion/registry projection tests.

Do not change `runtime/flow-bootstrap/answerability/check.ts` unless the discriminator
instead proves a producer is present while the check reports absent. The current fixture
proves the opposite: its failing plans genuinely lack that capability.

## Safety and compatibility

The proposed discriminator is provider-free, test-only, and content-free. It changes no
wire contract, stored record, provider prompt, budget, retry behavior, grant boundary,
or answerability semantics. If it selects a production seam, the fix should be confined
to preserving already-authorized context or choices; it must not synthesize executable
steps or widen authority.

This is **not limit-raising**: the experiment retains the exact 26-decision grant and
measures what is visible inside it. It is **not answerability weakening**: the refusal
still requires a record producer/store, and the success branch still passes by retaining
one. No retry, token, cost, timeout, or evidence ceiling changes.

## Scope and validation

Inspected the MVP Current State; reports t348, t350, t353, t357, and t358; Core agent
instructions; and the current deterministic fixture, evidence loop, repeat policy,
completion-feedback, and answerability source needed for this decision. I did not inspect
raw/live artifacts, run a provider or test, edit production/shared documents, or commit or
push. This report is the only file written.
