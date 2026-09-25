# A build may not propose a Flow that cannot answer the instruction

Worker report. Repository: `F:\!FluxIQ` (FluxIQ Core), branch `dev`, no commits made.

## Outcome

Done. A build's completion check now has a sixth and last check: whether the Flow
it wrote could answer the instruction at all. Where it plainly could not, the
plan is refused, nothing is created, the exploration is told what the instruction
asks for and what the draft lacks, and it is asked again on the existing budget,
cost and no-progress guards. The check costs no provider call on any path.

## What changed and why

### New module: `runtime/flow-bootstrap/answerability/`

Under `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/answerability/`:

- `contracts.ts` — the three types: what the instruction asks for, what the plan
  can do with a record set, and the verdict (`ok`, or an issue plus the
  `cannotAnswer` account and the sentence the model is told).
- `instruction-ask.ts` — what the instruction asks to be given back, read from
  the person's own words. Deterministic, no provider call.
- `plan-record-sets.ts` — what the plan can do with a set of records, read off
  the plan and the node definitions it names.
- `library-record-sets.ts` — whether the node library this build was given can
  return a set of records at all.
- `check.ts` — the verdict, and the feedback.
- `tests/check.test.ts` — 7 tests.

**The rule.** Refuse only when all of: the instruction plainly asks for a set of
records; the node library offers a node that returns rows of its own; and no step
of the plan produces or saves a record set. Anything else is accepted.

**Capability, not implementation.** A step counts as producing a record set when
its definition declares where its own result keeps rows (`metadata.recordsPath`,
or Core's own record writer), or when its record-output parameter names a
dataset. So the web domain's list extraction counts with no record output written
at all — "the rows are saved without a recordOutput" is that parameter's own
description — and a Flow that reaches a search by URL instead of typing into a
field is accepted, as are both the four-step and the two-step answers to the
catalogue search. An extraction that may find nothing is also accepted: whether
what it found answers the request is the finished run's verification to judge,
not the build's.

**The library gate exists because a refusal must be correctable.** A bound domain
that registers nothing returning rows cannot answer a request for rows however
the Flow is written; refusing there would send the exploration round its budget
asking for a node that does not exist. This is not hypothetical — it is what
Core's own `service-bootstrap/tests/extend.test.ts` does (its fixture domain has
three action nodes and no extraction, and its instruction says "read the rows it
lists"). Without the gate, that build was refused until its no-progress guard
tripped, and three of its tests failed. With it, they pass.

### Wiring

- `runtime/llm/harness-options/bootstrap-completion.ts` — takes an optional
  `instructionText`, runs the check last (after registry validation, so a build
  is told one thing at a time and the question is asked of the plan that would
  have been built), and refuses under a new code. `refused()` gained an optional
  answerability argument: its `cannotAnswer` object travels beside the issues and
  its own sentence replaces `FEEDBACK_INSTRUCTION`, which is about correcting a
  parameter and says nothing useful here.
- `runtime/service.ts` — one line: passes the `bootstrapInstructionText` it
  already builds (the active instructions' title and body) into the completion
  check.
- `runtime/flow-bootstrap/generation-failure.ts` — new phase failure code
  `flow_bootstrap.evidence_completion_cannot_answer` under
  `provider_output_validation`, in the `flowBootstrapEvidenceCompletionFailure`
  union, and in `fixedProviderFailureState` beside its siblings (same verdict as
  the default, listed for intent).
- `runtime/flow-bootstrap/plan/issue-feedback.ts` —
  `bootstrap.cannot_answer_instruction` added to `AUTHORED_CODES`, so its message
  reaches the model. The message is a fixed sentence of Core's own that quotes
  nothing, which is what that list promises; the person's own words travel in
  `cannotAnswer.quote` instead.
- `runtime/flow-bootstrap/plan/record-output-contract.ts` — the previously
  private `declaredRecordsPath` is published as
  `automationStudioFlowBootstrapDeclaredRecordsPath`, so the library gate reads
  the declared path through the module that owns that field rather than becoming
  a second reader of `metadata.recordsPath`. `SuppliedRecordsPath` now calls it.
- `runtime/flow-bootstrap/index.ts` — publishes `answerability/`.
- `docs/architecture/automation-studio/llm-flow-bootstrap.md` — the completion
  check's ordered list gains check 6, with what it reads, what it refuses, what
  it deliberately leaves alone, and what its feedback carries.

### What the model is told

    cannotAnswer: {
      asks: "a set of records: rows with named fields",
      quote: "Give me the answer as a table with columns name, price, rating and link",
      columns: ["name", "price", "rating", "link"],
      lacks: "no step of this Flow produces or saves a set of records",
      steps: ["web.output.browser-navigate", "web.output.dom-type", ...]
    }
    instruction: "Nothing was created and this build is still open, so correct it
      rather than finishing again unchanged. ... Run the step from your node
      library that returns rows, with the columns the instruction asks for, keep
      it in the draft, and finish again. A Flow that only goes somewhere and acts
      on it cannot answer a request for records, however well each of its steps
      runs."

The issue itself is `{ severity: error, code: bootstrap.cannot_answer_instruction,
path: plan.subflows, message: <Core's sentence> }`. A plan longer than 24 steps
carries `stepsWithheld: true` rather than silently showing a prefix.

## What was reused, and what had to be added

**Reused.** The record-set vocabulary and the record-output contract: a step's
record capability is read with `automationStudioFlowBootstrapSuppliedRecordsPath`
and the `record-output` parameter control, which is exactly how
`plan/validation.ts` already holds a record output to Core's contract, so the
check and the validator agree on what a record set is by construction. The
refusal channel is the existing one — the same `refused()`, the same feedback
envelope, the same `core.completion_check` evidence entry, the same
`unusable(...)` accounting in `llm/evidence-loop.ts` — so the loop's existing
budget, cost, repeat-without-progress and unusable-in-a-row guards bound it with
no new stopping rule. The "records / rows / columns" vocabulary and the
`flowShape`-style list of definition ids are `result-verification`'s own; this is
that judgement moved one step earlier, to a plan with no result yet.

**Added, because nothing existing could answer it.** A deterministic reading of
what the instruction asks to be given back. Neither existing reading can serve:
`action-permissions/instructed.ts` costs a model call and answers a different
question (which lasting acts the person authorised), and gating on a consequence
class is explicitly out of scope; `result-verification/` costs a model call and
needs a finished result. The no-provider-call constraint therefore forces a text
reading, and it is deliberately one-sided — a term earns its place by being
unambiguous, not by catching more:

- In: `records`, `rows`, `columns`, `csv`, `tsv`, `spreadsheet`, `dataset(s)`,
  `as a table`, `in a table`, `table of`, `list of`, `scrape*`, `extract*`,
  `tabulate*`.
- Out, with the reason recorded in the file: bare `table` ("Book a table for two"
  — the booking wizard is one of the ten sites), bare `list` and `list the`
  ("List the bike for sale" — the classifieds task publishes an advert),
  singular `record` and `column` ("Delete the record for order 1042"), and
  `export`, `collect`, `gather` (as often a file, a confirmation or a form as
  data).

A missed instruction leaves today's behaviour; a false refusal costs a whole
build. The columns an instruction names are read for the feedback only and gate
nothing — a column the model spells differently is still the column asked for.

## Commands run and observed results

All in `F:\!FluxIQ`; vitest and tsc invocations from `packages/fluxiq`.

1. `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/answerability/tests/check.test.ts`
   → `Test Files 1 passed (1) / Tests 7 passed (7)`.
2. `npx vitest run src/programs/automation-studio/runtime/llm/harness-options/tests/bootstrap-completion.test.ts`
   → `Test Files 1 passed (1) / Tests 11 passed (11)` (9 before, 2 added).
3. `npx vitest run runtime/flow-bootstrap runtime/llm runtime/tests/service-bootstrap runtime/result-verification`
   → first run **3 failed**, all three in
   `runtime/tests/service-bootstrap/tests/extend.test.ts`
   (`flow_bootstrap.evidence_iteration_limit`,
   `flow_bootstrap.evidence_unusable_decision`, and the apply-in-place case).
   Cause: the fixture domain registers no records-returning node while its
   instruction says "read the rows it lists", so the check refused every
   completion. Fixed by the library gate described above, which is a correctness
   fix rather than a test accommodation. Re-run after the fix:
   `Test Files 86 passed (86) / Tests 916 passed (916)`.
4. `npx vitest run src/programs/automation-studio` →
   `Test Files 1 failed | 329 passed (330) / Tests 1 failed | 2987 passed | 1 skipped (2989)`.
   The one failure is
   `runtime/tests/deepseek-bootstrap-exploration.test.ts > asks again after a
   decision that runs past its deadline` — a 3-second provider-hang deadline
   whose own comment says "a heavily loaded machine can take a second to get
   there". Re-run alone: `Test Files 1 passed (1) / Tests 8 passed (8)`, that
   case in 5,772 ms. Load-sensitive, not caused by this change: its sibling case
   exercises the same completion path and passed in both runs. This was a retry
   of the same run, not of a segfault; no `3221225477` or crash occurred at any
   point.
5. `npx tsc --noEmit` in `packages/fluxiq` → clean, no output. Then
   `npx pnpm -r check` → `packages/contracts`,
   `packages/client-gateway-websocket`, `packages/fluxiq`, `apps/web` all `Done`.
6. `node scripts/structure-audit.mjs` →
   `structure-audit: passed (184 warning(s), 359 baselined)`, plus a note that 2
   baseline entries can be lowered. Both are on `runtime/service.ts`
   (`file-lines` 4520 vs recorded 4584, `failure-as-empty` 16 vs recorded 18) and
   neither is mine — my service.ts edit replaced one line and added no `catch`.
   I did not run `pnpm structure:baseline`: rewriting a shared baseline is the
   supervisor's call.
7. `node scripts/structure-audit.mjs --rule docs-links` →
   `passed (0 warning(s), 0 baselined)` after the architecture doc edit.

`npx biome check` on the changed paths reports "No files were processed … these
paths were provided but ignored" — `packages/fluxiq` is outside biome's
configured scope, so there was nothing to lint.

### Redaction

The feedback's keys (`cannotAnswer`, `asks`, `quote`, `columns`, `lacks`,
`steps`, `stepsWithheld`) were checked against the denied-evidence-key screen in
`llm/harness/context-packet.ts`, which throws and refuses a decision request
outright if evidence carries a denied key. None collides with the web domain's
declared set (`html`, `innerHtml`, `outerHtml`, `pageSource`, `cookies`,
`headers`, `selector`). The only quoted text is the person's own instruction
sentence, which the harness already sends on every decision call, bounded to 200
characters. No page content, no parameter value and no validator message reaches
the feedback.

## Not verified

- **No live run.** Nothing here was exercised against a real provider or a real
  browser. The check's behaviour on the four recorded runs is inferred from their
  Flow shapes, not replayed: `run-mug5jixm-5aab19a3` (navigate, navigate, type,
  type, type) is refused by the rule as written, and `run-mug3tnti-9ab80b85`
  (navigate, navigate, extract) is accepted because the extraction is capability
  even though it returned nothing. Whether a refused build then *corrects itself*
  — adds the extraction and finishes — is the one thing only a live run can show,
  and it is what I would test next.
- **Vocabulary coverage on the real ten instructions.** I read the two quoted in
  the brief and reasoned about the other eight from their descriptions. If any of
  them asks for rows in words none of the listed terms matches, the check is
  silently inactive for it. Reading the ten scenario instructions and checking
  each against `automationStudioFlowBootstrapInstructionAsk` is a cheap next step
  I did not take, because the scenario manifests are in the downstream repository
  and the brief scoped me to Core.
- **The single-call build path is unchanged.** `generateFlowBootstrapAdaptation`
  with `evidenceGuided: false` validates and proposes without going through
  `checkAutomationStudioFlowBootstrapCompletion`, so a one-call build can still
  propose a Flow that cannot answer. I left it deliberately: there is no
  exploration to keep exploring with, so half the brief (tell the model what is
  missing, keep going) has nowhere to land, and refusing there would only convert
  a bad proposal into a failed build. Worth a decision, not a silent gap.
- **`pnpm test` and `pnpm build` in full** were not run; I ran the package's own
  type check, `pnpm -r check`, and the automation-studio test tree instead.
- **A plan whose only record step sits in a recovery subflow** is accepted (the
  walk covers every subflow). That is the lenient reading and I did not test it.

## Open questions or contradictions found

1. **Should the check apply to the single-call build path?** See above. My
   recommendation: leave it until a live run shows a one-call build in use.
2. **The column names are read and then used only for prose.** An instruction
   that names four columns against a Flow whose extraction declares one is a
   wrong answer knowable at build time, but it is also a judgement about *which*
   fields, which is implementation, and the brief says judge capability. If the
   loop's next measurements show missing-column answers, the material to gate on
   is already derived and sitting in `cannotAnswer.columns`.
3. **Two lowerable baseline entries on `runtime/service.ts` are unrecorded.**
   Pre-existing, from earlier work. Someone should run `pnpm structure:baseline`
   in Core and commit it, so the ratchet keeps the improvement.
