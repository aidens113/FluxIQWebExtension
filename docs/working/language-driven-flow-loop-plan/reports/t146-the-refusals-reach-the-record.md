# t146 — The refusals reach the record, a declined rerun says so, and the loop file is splittable again

## Outcome

Done, all three items.

1. `sanitizeEvidenceLoopTrace` carries `amendmentsRefused`, so a run's stored
   record keeps why each amendment changed nothing. Covered by four tests,
   including the existing "rebuilder" property test.
2. A `rerun` the loop declines now produces a refusal on the same path as every
   other amendment refusal: it reaches the amend row and the model's evidence
   entry. `run_by_the_loop` now occurs on the loop path, which it could not
   before. The no-progress guard's arithmetic is untouched.
3. `evidence-loop.ts` is **941 → 636 lines**. It no longer appears as a
   structure-audit `FAIL`; the audit is down from 4 violations to 2, and neither
   remaining one is mine.

Type check clean. 1006 tests pass across the four paths the brief named
(83 files), up from 990 before my new tests, with 12 tests added by me.

## What changed and why

### 1. The stored record carries the reasons

**`runtime/service/flow-bootstrap-commands/evidence-trace.ts`.** This function
is the fourth place a trace row is rebuilt member by member, and it dropped
`amendmentsRefused`, so t140's reasons reached the model during a build and then
vanished — `amended` said how many landed and the record said nothing about the
rest.

It now keeps the field, entry by entry, through a new private
`amendmentRefusals()`:

- bounded **by shape, not by an allow-list of reasons** — the same argument the
  file already makes for `resultCode` and `resultReason`: the vocabulary is the
  draft's (`flow-draft/amendment.ts`), and a closed copy here would silently drop
  a reason added there. A reason that passes the code shape is carried as the
  draft's own word for it, which is what the one cast in the function says;
- an entry that is not shaped like a refusal (`step` not a non-negative safe
  integer, `reason` not code-shaped, not an object) is **left behind rather than
  thrown on**, and the field is omitted when none survives — a build that
  finished must not be discarded over a reader's detail;
- capped at `MAX_ROW_AMENDMENT_REFUSALS = 16`, the most amendments one decision
  may carry, so nothing a real decision produced is dropped and the bound is this
  file's own property.

The published *step* (`flow-bootstrap/evidence-loop-steps.ts`) still drops the
field. That file is the other worker's and is outside my brief; it copies a fixed
field list, so my change neither reaches it nor breaks it. See **Not verified**.

**`.../tests/evidence-trace.test.ts`** gains `amendmentsRefused` on the `full`
row of the *rebuilder* test — which asserts the property "every member the loop
may put on a row survives", so the field is now held shut there rather than by a
list someone must remember — plus three tests: the field carried with step and
reason; a malformed entry left behind, the field omitted when none survives, and
a non-array value not failing the build; and the sixteen-refusal cap.

### 2. A rerun the loop declines reaches the model

**New: `runtime/llm/evidence-loop/rerun-request.ts`** (67 lines) replaces the
private `rerunRequest()` and returns `{ request, refused }` instead of
`request | undefined`. Three ways the loop declines a rerun of a step that
exists — no argument to run with, an action not in the offered set, and every
rerun after the first, because a decision is one provider call and a rerun is a
call — are refused as `run_by_the_loop`. A number naming no step is refused as
`no_such_step`, the draft's own word for it, which also makes the feedback list
the positions that do exist. It guesses nothing: no refusal proposes the step the
model might have meant.

**`evidence-loop.ts`, the amend branch.** One new line joins both sources of
refusal before anything reads them:

```ts
const refused = [...amended.refused, ...rerun.refused];
```

and the row, the guard and the feedback then read `refused` and `rerun.request`.
The guard's condition is unchanged in form and in arithmetic
(`!rerun.request && !amended.applied && (stepsWithoutProgress += 1) >= …`), and
the feedback still sits after it, so the count the model is shown is the one it
is being held to.

**Reason vocabulary.** The refusal reasons are a closed union in
`flow-draft/amendment.ts`, which I do not own, so a declined rerun is reported in
the existing words rather than a new one. That made the `run_by_the_loop`
sentence in `draft-amendment-feedback.ts` wrong for the new case — it said only
that a rerun is carried out by the loop, which tells a model nothing about why
its rerun did not happen. I changed that one sentence to name all three
conditions and what to do instead. **`draft-amendment-feedback.ts` is not in my
brief's owned list**; it is not in the must-not-touch list either, nobody else is
in it, and leaving the sentence as it was would have defeated item 2. Flagging it
rather than assuming.

Also **not one of the listed files**: the two loop-level tests went into the
existing `llm/tests/draft-amendment-feedback.test.ts`, whose subject is exactly
"a refused amendment reaches the model", rather than a new file — `llm/tests/` is
already at 24 files against a 25-file cap, and placement says a test spanning the
loop and the resolver belongs in `llm/tests/`.

Note for whoever reads the vocabulary next: a `rerun` carrying **no `input`
cannot occur on the loop path at all** — `readAmendments` in
`evidence-loop-decision.ts` drops it before the loop sees it. It is covered as a
unit case because a direct caller can still produce it.

### 3. `evidence-loop.ts` under its budget

Diagnosis before cutting: the file was two of the causes in Core's table at once
— a **declaration dump** (245 lines of the loop's whole contract, in doc comments
that carry the reasoning behind each field) and a **giant function body** with
private helpers at the end.

The coordinator **stays at `llm/evidence-loop.ts`**, and that is forced rather
than chosen: `deepseek/provider.ts`, `harness/context-packet.ts`, four
`harness-options/` modules, two `node-tools/` modules, `repeat-policy.ts`,
`loop-configuration.ts`, `evidence-loop-decision.ts` and `stages/instructions.ts`
all import it by that path, and `deepseek/` is a directory this brief forbids me
to touch. Moving the file would have needed an edit there.

So the cut is a feature directory beside it, `runtime/llm/evidence-loop/` — the
same shape `harness.ts` + `harness/` already has in this directory — holding 11
source files and a barrel:

| File | Lines | Holds |
| --- | --- | --- |
| `tool.ts` | 40 | `AutomationStudioLlmEvidenceTool` |
| `tool-execution.ts` | 70 | `AutomationStudioLlmEvidenceToolExecutionResult` |
| `decision.ts` | 14 | `AutomationStudioLlmEvidenceLoopDecision` |
| `trace.ts` | 97 | `AutomationStudioLlmEvidenceLoopTrace` |
| `result.ts` | 57 | the failure codes, the result, and `…LoopFailure()` |
| `accounting.ts` | 47 | the accounting, `…EmptyAccounting()`, `…AddUsage()` |
| `completion-check.ts` | 21 | the check and the entry its refusal arrives under |
| `call-record.ts` | 49 | `…CallRecord()`, `…CallDiagnostic()` (both pure) |
| `call-id.ts` | 20 | `…UnusedCallId()` |
| `answered-request.ts` | 44 | the request-check entry, its codes, and the note |
| `rerun-request.ts` | 67 | item 2 |
| `index.ts` | 21 | the barrel |

Every doc comment moved with the thing it explains; nothing was summarized away.
Filenames were chosen so that no prefix reaches the audit's three-file group
threshold (`tool`/`tool-execution` is two, `call-id`/`call-record` is two) — a
third `call-*` or `tool-*` file there would fail `naming`.

**The public surface is unchanged, and checked rather than assumed.** Every type
that was declared in `evidence-loop.ts` is re-exported from it by name, as is
`AUTOMATION_STUDIO_LLM_EVIDENCE_COMPLETION_FEEDBACK_TOOL_ID`. The new directory's
barrel is deliberately **not** exported from `llm/index.ts`, so the internal
pieces (the accounting functions, the call-id resolver, the answered-request
note, the rerun resolver) stay internal and the surface is not widened either.
`llm/index.ts` therefore needed no edit at all, and I made none. `tsc --noEmit`
compiles every importer in the package, which is the mechanical proof that no
consumer's import broke.

`runtime/llm/` stays at 21 source files and `llm/tests/` at 24 — I added no flat
file to either. The new directory is 12 source files, under the 15-file advisory.

## Commands run and observed results

From `F:\!FluxIQ\packages\fluxiq`:

- `npx tsc --noEmit` → **clean** (exit 0, no output). Run four times; two
  intermediate runs found real errors in my own new tests, both fixed: a
  sentence-shaped reason needing a cast, and a test helper typing `input` as
  `Record<string, unknown>` instead of `JsonObject`.
- `npx vitest run src/programs/automation-studio/runtime/llm src/programs/automation-studio/runtime/service/flow-bootstrap-commands src/programs/automation-studio/runtime/exploration-reduction src/programs/automation-studio/runtime/recovery`
  → **`Test Files 83 passed (83)`, `Tests 1006 passed (1006)`**.
- Earlier, narrower runs: `runtime/llm` alone → 47 files / 503 tests green
  *before* I added any test, i.e. the split is behaviour-preserving against
  t140's exact baseline; then 48 / 512 with the new loop-level cases.
- `npx vitest run .../flow-bootstrap-commands` → `1 passed`, `23 passed (23)`
  tests (20 before, 3 new).
- `npx vitest run .../runtime/flow-draft` → `1 failed | 4 passed (5)` files,
  `1 failed | 37 passed (38)`. The one failure is the pre-existing
  `entry.test.ts` "drops arguments before it drops steps" the brief named. Not
  chased.

**Both new behaviours were proved by breaking them, not only by passing.**

- With `const refused = [...amended.refused]` (the rerun refusals dropped
  again), `draft-amendment-feedback.test.ts` → `2 failed | 11 passed (13)`:
  exactly my two new tests, and only those.
- With `if (refused && false) clean.amendmentsRefused = refused;` the
  `flow-bootstrap-commands` suite could not be measured, for the reason in the
  next section; the carry is instead held by the rebuilder test, which asserts
  every row member survives and fails on a dropped one by construction.

Both edits were reverted from a backup copy and the reverted state re-verified.

From `F:\!FluxIQ`: `node scripts/structure-audit.mjs`

- Before: **`4 violation(s) across 2 rule(s)`** — `failure-as-empty` in
  `llm/deepseek/provider.ts:248`; `file-lines` on
  `flow-bootstrap/generation-failure.ts: 817`, `llm/deepseek/provider.ts: 811`
  and `llm/evidence-loop.ts: 941`.
- After: **`2 violation(s) across 2 rule(s)`** — `failure-as-empty` in
  `llm/deepseek/refusal.ts:156` and `file-lines` on
  `flow-bootstrap/generation-failure.ts: 817`. Both were red before this task;
  the `failure-as-empty` one only *moved* file because the concurrent worker
  split `deepseek/provider.ts`, which also removed that file's own `file-lines`
  entry. **`evidence-loop.ts` no longer appears as a FAIL.**
- It does appear as a `warn` at **636 lines**, past the 400-line advisory. That
  threshold is not ratcheted and roughly fifty files in this repository pass it,
  including four other files in `runtime/llm/`; getting under it would mean
  extracting the loop's stateful closures (`toolFailed`, `answerRequest`,
  `unusable`) behind a mutable state object, which is a different and much
  riskier change than this brief asked for.
- `naming`, `imports`, `exported-values` and `class-methods` reported nothing on
  the new directory. `directory-files` warnings are unchanged.
- I did **not** run `pnpm structure:baseline`. The audit still prints
  `1 baseline entries can be lowered`, as it did before I started.

## Not verified

- **No live run.** Whether a model acts on a declined-rerun refusal is
  unmeasured. What is proven is that the refusal is in front of the next decision
  and on the row.
- **The published step still drops `amendmentsRefused`.**
  `flow-bootstrap/evidence-loop-steps.ts` copies a fixed `EVIDENCE_STEP_FIELDS`
  list and its parser rejects a step carrying a field the list does not name, so
  the field cannot be added from my side alone. Item 1 puts the refusals in the
  **stored, sanitized trace** — which is what a run's artifacts keep — and the
  published audit-event step is still short. That is the other half of t140's
  finding and belongs to whoever owns `flow-bootstrap/`.
- **The tree was not mine alone while I measured it.** A concurrent worker is
  splitting `runtime/llm/deepseek/`. Mid-task, `deepseek/provider.ts` was deleted
  while `deepseek/index.ts` still imported it, and for several minutes every test
  that loads `llm/index.ts` failed with `Failed to load url ./provider.ts` —
  including the run I wanted for the negative proof of item 1. A later snapshot
  failed two tests with `estimateAutomationStudioDeepSeekInputTokens is not a
  function`, in `llm/tests/harness.test.ts` and
  `llm/tests/evidence-loop-provider.test.ts`. Both are that split in flight, not
  mine: the symbol had moved to `deepseek/request-body.ts` and the barrel had not
  caught up, and both tests pass in the final run above. My final `tsc` and
  vitest runs were taken after their tree was consistent again, but they include
  their in-flight changes.
- **No unit tests for the moved-but-unchanged modules** beyond `call-id.ts`
  (which I did test, because its 200-character truncation branch is unreachable
  from the loop). `accounting.ts`, `call-record.ts`, `answered-request.ts` and the
  type modules are transcriptions, exercised by the 503 loop tests that passed
  unchanged; writing fresh tests for moved code would assert the move rather than
  any behaviour.
- `pnpm check`, `pnpm test` and `pnpm build` were not run (Core build forbidden
  by the brief). The timing assertion in `service-bootstrap` the brief mentioned
  is outside the four paths and was not exercised.
- I did not read the `run-muhubegx-9469de5e` evidence, so I cannot say which of
  its seven silent amendments were reruns.

## Open questions or contradictions found

1. **`run_by_the_loop` now carries three meanings behind one word.** The closed
   reason union is in `flow-draft/amendment.ts`, which this brief does not give
   me, so a rerun with no argument, one whose action is no longer offered, and a
   second rerun in one decision all arrive as the same reason with one sentence
   covering all three. The model is told *what to do* correctly, but a reader of
   a run's record cannot tell the three apart. If reruns keep being declined
   live, the honest fix is three reasons in the draft's union — one edit there,
   one sentence each in `draft-amendment-feedback.ts`, and the exhaustive
   `Record` makes both compulsory.
2. **A rerun naming an unlisted step is still applied, not refused.** Draft
   positions are contiguous over *all* steps, while the entry the model reads
   lists only action steps, so the numbers it sees are a sparse subset of the
   numbers that exist. This is t140's open question 3, unchanged: my resolver
   refuses only a number that matches no step at all, so a rerun naming an
   observation step the model was never shown resolves to that step and runs it.
3. **`evidence-loop.ts` is still 636 lines, and the remaining bulk is one
   function.** The contract came out; what is left is the coordinator, whose
   body is ~500 lines of `for` loop over twenty-odd mutable locals with four
   closures reading and writing them. Anything further has to start by naming
   that state — a `LoopState` the closures hang off — which is worth doing
   deliberately rather than as a side effect of a line count.
