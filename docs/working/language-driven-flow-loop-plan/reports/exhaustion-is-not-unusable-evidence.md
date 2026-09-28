# Exhaustion is not unusable evidence

Fixes the misdiagnosis that sent the debug of `run-mulryg6h-ff241a12` down the
wrong path: Core reported an iteration-limit exit as
`flow_bootstrap.evidence_unusable_decision`, stage `provider_output_validation`,
`retryable: false`.

All changes are in `F:\!FluxIQ\packages\fluxiq\`. Nothing in `apps/web` or in
`F:\!FluxIQWebExtension` was touched.

## Outcome

Done, with one precisely-named downstream consequence the supervisor must route
(see **The one downstream fixture that must change**), and one item deliberately
specified rather than implemented (see **Item 5**).

---

## 1. An iteration-limit exit is now its own outcome

`runtime/llm/evidence-loop.ts`, `exhausted()` (was lines 337-342) diverted to
`unusableDecisions.stalled` whenever the loop's last paid decision had been
refused. `runtime/service.ts:1578` wires `stalled` to
`flowBootstrapEvidenceUnusableDecisionFailure`, so an exhausted loop was
published as "the model kept answering with something the exploration could not
use". It now always ends `llm_evidence_loop.iteration_limit`, which Flow
Bootstrap already maps to `flow_bootstrap.evidence_iteration_limit`:

```ts
const exhausted = (bound: AutomationStudioLlmEvidenceLoopExhaustedBound): AutomationStudioLlmEvidenceLoopResult =>
  failure(draftSteps, "llm_evidence_loop.iteration_limit", trace, accounting, {
    bound, maxIterations: limits.maxIterations, iterations: accounting.iterations,
    draftSteps: draftSteps.length,
    proposableSteps: draftSteps.filter((step) => step.disposition === "kept" && automationStudioFlowDraftStepIsProposable(step)).length,
    completionAttempts,
    lastIssueCodes: unusableInARow ? [...lastIssueCodes] : []
  });
```

The last refusal is not lost. It travels as `exhaustion.lastIssueCodes`, and the
diagnostic publishes it as `issueCodes` — the field every other issue code
already uses — so it is carried as context for the ending rather than mistaken
for the cause of one.

The genuine stall is untouched: `unusable()` still calls `stalled` when the
no-progress guard or the unusable-in-a-row backstop actually fires, and that
ending is still `flow_bootstrap.evidence_unusable_decision` at
`retryable: false`. A test asserts both in the same block so they cannot be
flattened into one.

**The stage was left as `provider_output_validation`, deliberately.** It is
wrong in the same way `retryable` was — nothing was validated — but the stage
vocabulary is a closed six-member tuple published on the wire
(`api/contracts/adaptation.ts:25,54,130`) and the facility repository pins it in
fixtures I may not edit (for example
`packages/test-runner/src/tests/existing-fluxiq-control.test.ts:339`,
`.../flow-lane/creation/tests/build-proposal.test.ts:213`). Splitting the stage
is a cross-repository protocol change and is specified as follow-up below. The
*code* is what this module's own design makes a reader recover the stage from
("A code belongs to exactly one stage" — `generation-failure/codes.ts`), and the
code is now correct and plainly named.

## 2. Running out of turns is retryable

`runtime/flow-bootstrap/generation-failure/failure-state.ts` hard-coded
`retryable: false` for every stage after `provider_request`. That is true of a
plan which cannot answer its instruction and false of a build that ran out of
calls. A named set now carries the exception, read by the producer and the
reader through the one shared `automationStudioFlowBootstrapFailureState`:

```ts
const FLOW_BOOTSTRAP_RETRYABLE_AFTER_REQUEST_CODES: ReadonlySet<string> = new Set([
  "flow_bootstrap.evidence_iteration_limit"
] satisfies readonly AutomationStudioFlowBootstrapPhaseFailureCode[]);
```

Because producer and parser share that function, a stored record claiming the
ending with `retryable: false` now fails to read back — asserted by a test.

## 3. The facts an exhausted build carries

New module `runtime/llm/evidence-loop/exhaustion.ts` declares
`AutomationStudioLlmEvidenceLoopExhaustion`: `bound`, `maxIterations`,
`iterations`, `draftSteps`, `proposableSteps`, `completionAttempts`,
`lastIssueCodes`. It rides on the loop's failed result
(`evidence-loop/result.ts`, `exhaustion?`) and is published on the diagnostic as
`evidenceLoop.exhausted` (`generation-failure/diagnostic.ts`), less
`lastIssueCodes`, which travels as `issueCodes`.

The published shape is `Omit<AutomationStudioLlmEvidenceLoopExhaustion,
"lastIssueCodes">` rather than a copy, so a field added to the loop's record
fails the type check in `diagnostic-parse.ts` until the allow-list is widened —
the lockstep this directory already enforces for evidence steps, and which its
own comments record as having been broken three times by copies.

`bound` distinguishes three allowances that previously all read
`iteration_limit` with nothing saying which: `iterations` (the `for` fall-through
at `evidence-loop.ts:796` — the live run's own path), `budget` (nothing left to
pay a decision with, `:511`; and a final complete-only decision spent on
something else, `:695`), and `tool_calls` (`:721`).

Answering the brief's "how close was it": `proposableSteps` counts exactly what
an amendment's `keptStepCount` counts, `completionAttempts` says whether the
model ever tried to finish, and `issueCodes` says what refused the last attempt.
For `run-mulryg6h-ff241a12` that reads: iterations 26 of 26, bound `iterations`,
three completion attempts, all refused `bootstrap.cannot_answer_instruction` —
which is the debug's own conclusion, now published by Core rather than
reconstructed by hand from `live-llm.json`.

## 4. Audit of the surrounding classifications

**Fixed, as clearly wrong as the reported defect:**

- `exhausted()` borrowing `evidence_unusable_decision` / `invalid_decision` —
  item 1. The comment it carried ("that refusal is why there is no result")
  states the false half: the refusal is why there is no *result*, the spent
  allowance is why there is no *more trying*, and only the second is the ending.
- `evidence-loop.ts:721`, the `maxToolCalls` ceiling, reported `iteration_limit`
  with nothing to say which of two ceilings had been reached. Same code (both
  are an allowance running out) but the record now names which.
- `evidence-loop.ts:695`, the final complete-only decision spent on a tool call,
  likewise.
- `flowBootstrapEvidenceLoopFailure` hard-coding `retryable: false` for all ten
  loop codes — item 2.

**Found, reported, not changed** (each states something true, unlike the above):

- `evidence-loop.ts:388` (`toolFailed`): when `stepsWithoutProgress` reaches the
  guard, the ending is `tool_failed`. That counter is shared — unusable
  decisions, answered repeats and nothing-happened calls all increment it — so
  the *guard* that fired is the no-progress guard while the code names the step
  that happened to reach it. Both statements are true, so this is a loss of
  precision, not a false report. Fixing it means either a second counter or a
  code that says "no progress, last step was a tool failure", and should be
  measured rather than guessed.
- `evidence-loop.ts:502`: no tool is eligible and completion is not allowed, so
  the loop can ask for nothing. Reported `repeat_without_progress`, which is a
  dead end rather than a repeat. Defensible; narrow.
- **The design gap underneath the whole defect.** Every guard is held to
  `maxIterations`: `maxStepsWithoutProgress` is `min(24, maxIterations)`
  (`loop-limits/flow-bootstrap-evidence-loop.ts:158`) and
  `maxUnusableDecisionsInARow` is `max(that, min(24, maxIterations))`
  (`llm/loop-configuration.ts`). On a run whose call budget equals its iteration
  count — every Lab creation run — **no guard can fire before the iterations run
  out**, so every stall arrives as an exhaustion. That is why `exhausted()`
  was written to borrow the stall's code in the first place: it was papering
  over a guard that structurally cannot bite. This is now visible rather than
  hidden (the 12-call Core test that used to read `evidence_unusable_decision`
  now reads `evidence_iteration_limit` / `bound: "budget"`), but the guards
  themselves are unchanged. Changing when builds stop needs live measurement and
  is outside this task.
- `flowBootstrapPermissionRequiredFailure` and `flowBootstrapEvidenceCompletionFailure`
  remain `retryable: false`. Both document why, and both are true as they stand.

## 5. Should exhausting the budget discard everything?

**Judgement: do not write the draft as a Flow; do make the loss measurable; and
specify resumption as its own task.** Implemented accordingly.

Why not write it: the completion check refused all three attempts with
`bootstrap.cannot_answer_instruction`, so there is no plan Core has agreed could
answer the instruction. Core has a code for refusing exactly that
(`flow_bootstrap.evidence_completion_cannot_answer`), and publishing the draft
anyway would publish a Flow Core itself says cannot run, while marking the build
successful — which corrupts the one measurement the MVP is judged on. Core's own
precedent agrees: the permission-required path preserves work only when
"a plan the completion check accepted is still a Flow worth having"
(`service.ts:1622-1625`). An exhausted build has nothing accepted.

Why the loss is nevertheless real: thirteen decisions of proven work — six
actions that moved the page, one structure detection, two inspections — were
discarded. The loop already hands the draft back on its failed result
(`evidence-loop/result.ts`, `steps`); `runtime/service.ts:1627` drops it.

**Specification for the follow-up task, "resume an exhausted build from its
draft":**

1. Persist the draft of a build that ended `flow_bootstrap.evidence_iteration_limit`
   with `exhausted.proposableSteps > 0`, keyed by `flowId`, alongside the
   `flowId` that was minted and never written to.
2. Decide what that record is to the rest of Core. The pinned rule that Flows
   and subflows are versioned and roll back suggests it is a pre-version of the
   Flow rather than a new kind of object; it must not appear as a runnable Flow.
3. Seed the next build from it through the existing mechanism —
   `loop-configuration.ts`'s `draft.seed`, which `node-tools/draft-from-flow.ts`
   and the extend path already use — so no new authoring path is introduced.
4. Say when it is discarded: on a successful build of the same Flow, on an
   explicit re-author, and after some age.
5. Screening. A draft step carries the model's own arguments, which may hold
   page-derived text. The published diagnostic is codes, identifiers and counts
   only; a persisted draft is a different store with a different rule and needs
   its own `text-withholding` review before anything is written.

None of that could be done correctly inside this task without inventing a
storage contract, so it is named rather than improvised.

## 6. Tests

New, in `flow-bootstrap/generation-failure/tests/diagnostics.test.ts`, describe
block "an exploration that ran out of turns":

- named as itself, `retryable: true`, and asserted **not** to be
  `flow_bootstrap.evidence_unusable_decision` — with the unusable-decision
  ending asserted `retryable: false` in the same test, so the two cannot be
  conflated again in either direction;
- carries `maxIterations`, `iterations`, `draftSteps`, `proposableSteps`,
  `completionAttempts`, and `issueCodes` — with `lastIssueCodes` asserted absent
  from the published block;
- round-trips through the reader for all three `bound` values;
- a stored record claiming the ending with `retryable: false` parses as `null`;
- six malformed-exhaustion rows (an unknown bound, iterations past the ceiling,
  more proposable steps than steps, a fractional count, a negative count, an
  undeclared field) each refuse the whole diagnostic.

Rewritten, because they pinned the defect:

- `llm/tests/unusable-decision.test.ts` — "ends as the iteration limit when its
  iterations are spent, never as the last refusal" (asserts `stalled` is *not*
  called), plus a new companion "still ends on the stall when a guard fires
  before the iterations run out".
- `llm/tests/loop-budget.test.ts` — the two "ends as the refused answer" tests
  now assert the spent allowance, the `bound`, and `stalled` not called.
- `runtime/tests/deepseek-bootstrap-exploration.test.ts` — both end-to-end
  builds, including "reproduces the measured 26-decision creation exhaustion",
  which is this live run's shape and now asserts
  `flow_bootstrap.evidence_iteration_limit`, `retryable: true`,
  `exhausted.bound: "iterations"`, and a non-zero draft and completion count.

## The one downstream fixture that must change

`F:\!FluxIQWebExtension\packages\test-runner\src\flow-lane\creation\tests\build-proposal.test.ts:214`
hand-writes a diagnostic with `code: "flow_bootstrap.evidence_iteration_limit"`
and `retryable: false` and feeds it to Core's parser
(`flow-lane/creation/build-proposal.ts:412`). With `retryable` now computed as
`true` for that code, the parser correctly returns `null` and that test will
fail. **The fix is one word: `retryable: false` → `retryable: true` on line
214.** I did not make it — the brief forbids editing that repository.

Nothing else downstream is affected. I checked every other extension-repo
fixture that reaches Core's parser
(`demo-llm-create-ui/tests/refused-plan-issue-codes.test.ts`,
`exploration-failure-evidence.test.ts`, `failure-sanitizer.test.ts`,
`flow-lane/creation/tests/lane.test.ts`): all use codes whose retryability is
unchanged. `tests/existing-fluxiq-control.test.ts:339` carries only `code` and
`stage` through an envelope passthrough and does not go through the state check.

Live runs are unaffected either way: a diagnostic Core actually produces now
carries `retryable: true` and parses.

## Commands run and observed results

- `pnpm --filter fluxiq check` →
  `> fluxiq@0.7.0 check F:\!FluxIQ\packages\fluxiq` / `> tsc --noEmit`, no
  diagnostics, exit 0.
- `pnpm --filter fluxiq test` (full suite) →
  `Test Files  419 passed (419)` / `Tests  4090 passed | 1 skipped (4091)` /
  `Duration  206.54s`.
- `node scripts/structure-audit.mjs` →
  `structure-audit: passed (189 warning(s), 355 baselined)`. No new violation and
  no baseline change; the new file is inside budget.
- `pnpm --filter fluxiq build` → clean, `BUILD-OK`; verified the change reached
  the output — `dist/.../generation-failure/diagnostic.d.ts:86` carries
  `exhausted?: Omit<AutomationStudioLlmEvidenceLoopExhaustion, "lastIssueCodes">`
  and `dist/.../llm/evidence-loop/exhaustion.{js,d.ts}` exist. The Lab can run
  against this build.

An earlier full run showed two failures. One was the 26-decision test expecting
`bound: "budget"` where the real path is `iterations` — my expectation was
wrong, corrected, and the file then passed 11/11 in 72.9s. The other was
`service-flows/tests/scale-pages.test.ts` ("pages and filters 10,000 Subflow
summaries", `expected 1046.0ms to be less than 500`), a wall-clock budget under
suite load; it passed alone at 856ms and again in the clean full run. Unrelated
to this change.

## Files changed

New:
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/exhaustion.ts`

Modified:
- `runtime/llm/evidence-loop.ts`
- `runtime/llm/evidence-loop/index.ts`
- `runtime/llm/evidence-loop/result.ts`
- `runtime/flow-bootstrap/generation-failure/diagnostic.ts`
- `runtime/flow-bootstrap/generation-failure/diagnostic-parse.ts`
- `runtime/flow-bootstrap/generation-failure/evidence-failure.ts`
- `runtime/flow-bootstrap/generation-failure/failure-state.ts`
- `runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts`
- `runtime/llm/tests/loop-budget.test.ts`
- `runtime/llm/tests/unusable-decision.test.ts`
- `runtime/tests/deepseek-bootstrap-exploration.test.ts`

All paths relative to
`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\`. Nothing is
committed; the supervisor owns that.

## Not verified

- **No live run.** The change is proven by Core's own end-to-end
  DeepSeek-shaped exploration tests, not against a real provider or a real page.
  The next live creation run that exhausts is what will show the new diagnostic
  in a bundle.
- **The downstream repository was not built or tested.** I read its fixtures to
  establish the impact and did not run
  `pnpm --filter @fluxiq-web-extension/... test`. The one predicted failure at
  `build-proposal.test.ts:214` is reasoned from the parser's contract, not
  observed.
- **`apps/web` and the rest of the Core monorepo.** I ran `pnpm --filter fluxiq`
  only, not the repository-wide `pnpm check` / `pnpm test`, because concurrent
  workers were active and a repository-wide run reads trees other agents are
  editing. `packages/contracts`, `client-gateway-websocket` and `@fluxiq/web`
  do not reference the changed symbols (the diagnostic is consumed through
  `fluxiq/automation-studio`, whose surface widened by optional fields only).
- **Whether a bigger budget would actually have saved `run-mulryg6h-ff241a12`.**
  The debug's own reading is that it was repeating rather than converging. This
  change makes the budget's role reportable; it does not claim the budget was
  the cause.

## Open questions or contradictions found

1. **The stage split.** `flow_bootstrap.evidence_iteration_limit`,
   `evidence_cancelled`, `evidence_limit`, `evidence_tool_failed`,
   `evidence_repeat_without_progress` and `permission_required` all sit under
   `provider_output_validation`, and not one of them is a statement about
   provider output. A seventh stage — `exploration` — would be correct and would
   make the distinction legible without reading the code list. It is a wire
   contract change across both repositories, so it needs the supervisor's
   decision rather than a worker's.
2. **The guards that cannot fire** (audit item above). Every stall guard is held
   to `maxIterations`, so on a Lab creation run none of them can bite before the
   budget does. This is worth its own measured task; without it, "the loop ran
   out of turns" will keep being the ending for builds that were also stalling,
   and the two remain distinguishable only by `issueCodes` and
   `completionAttempts`.
3. **The debug's cause #3 is unaddressed here and still true**: that run was a
   creation launched on the repair-shaped default of 26 calls rather than 48,
   because the launch named no `--llm-max-calls`. Nothing in this change alters
   that, and `retryable: true` now makes it explicit that the answer is a larger
   budget — which is exactly the case for making 48 the default for a creation
   task rather than relying on the campaign wrapper.
