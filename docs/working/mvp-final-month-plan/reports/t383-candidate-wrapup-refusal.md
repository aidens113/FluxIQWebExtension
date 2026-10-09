# t383 report: candidate wrap-up and per-code handle refusal advice

## Outcome

Done for both units. Two gaps are listed under open questions: the domain cannot quote the bad field name or the step's kept columns, and one string outside the owned files is now wrong in candidate mode.

## What changed and why

### (1) Candidate wrap-up keeps submitting and testing (Core)

Lane C, `run-mv0pa79q-ef91811b`: the model was still exploring at 5 decisions left. At 3 left the wrap-up offered no tools, and it spent steps 0039-0046 on four completions, each refused `candidate.latest_submission_required`. It never submitted.

- `runtime/llm/loop-budget.ts`
  - New `AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_CANDIDATE_WRAP_UP_DECISIONS = 5`. That covers a submission, its trial and the completion, plus one more submission and trial after a refusal.
  - New `automationStudioLlmEvidenceLoopWrapUp({ remaining, canComplete, candidate, tools })`. It returns `{ wrappingUp, offered, withholds(toolId) }`.
    - Candidate mode (`discoveryOnly`): the wrap-up starts at 5 decisions left and offers only `core.submit_candidate` and `core.test_candidate`, until the last decision, which offers completion alone.
    - Legacy mode: unchanged. The wrap-up starts at 3 and offers no tools.
    - The tool ids are plain strings, as other Core modules write them.
  - `automationStudioLlmEvidenceBudgetEntry` takes an optional 4th argument, `candidate`. It now gives candidate wording for the normal budget, the wrap-up and the final decision. The legacy strings are unchanged.
  - Added a header paragraph that cites the run.
- `runtime/llm/evidence-loop.ts` (still 799 lines, under the 800-line limit)
  - The loop calls the helper.
  - Every place that treated a call made during the wrap-up as "not offered" now checks `withheld` (`wrapUp.withholds(decision.toolId)`) instead of `wrappingUp`. A submission or trial in a candidate's wrap-up therefore runs normally, through the repeat guard. An exploring call is still answered `llm_evidence_loop.not_offered` and never run.
  - The budget entry is passed `input.discoveryOnly === true`.

### (2) Each handle code gets its own advice (Core and domain)

Lane D, `run-mv0pcfaf-cd251bdc`, step 0034: a condition named `confirm`, a key that another step kept and this step did not. The issue was `web.handle.unknown_field`, and `next` told the model that its correct list handle `extraction.3` "does not name one control in any view".

- `runtime/flow-bootstrap/candidate/submission-refusal.ts`
  - `HANDLE_ISSUE` now captures the reason after `.handle.`.
  - A `HANDLE_ADVICE` table gives true advice for each of these reasons: `unknown`, `renumbered_by_reload`, `stale`, `not_unique`, `ambiguous`, `misplaced`, `malformed`, `frame_mismatch`, `extraction_required`, `not_a_control`, `wrong_control` and `unknown_field`.
  - The meaning of each reason comes from the domain's `tool-rejection.ts` reason table and `target-packets.ts`.
  - The advice is grouped by reason, in the order each reason first appears, and each piece names only the handles of its own issues.
  - A reason not in the table gets the general advice, never another reason's.
  - The `unknown_field` advice says:
    - the list's handle is right;
    - a column the step names, in its fields or in a `where` condition, is neither a column the detection printed nor a key this step's own fields keep;
    - a key another step keeps is not one of this step's columns;
    - so name a detected key or one of this step's own field keys, add the column to this step's fields first, or drop the condition.
- `domain/.../extraction/conditions.ts`: a condition whose column name neither vocabulary knows is now refused at the key that names it.
  - Example: `web.handle.unknown_field:extractList.where.0.field` (or `.column`, `.key` or `.header`), where it was `...where.0`.
  - The helper is `namingKey`, and the header paragraph cites the run.
  - Assumption paths are unchanged.
- `domain/.../extraction/columns.ts`: not changed. Its `:265` refusal is the shared lookup that `conditions.ts` re-paths, and the `fields` entries it refuses already carry their own position (`fields.N`).

### Tests

- `runtime/llm/tests/loop-budget.test.ts`, new describe "a candidate's wrap-up (t383)" with 4 tests:
  - which tools are offered at 6, 5-2 and 1 decisions left, in candidate and legacy modes;
  - the wording in each mode;
  - a loop run where a submission asked for in the wrap-up runs and an exploring call gets `not_offered`.
- `candidate/tests/submission-refusal.test.ts`, new describe "the advice a refused handle is given":
  - one test per code (12): each `next` contains its own reason's words and none of the other reasons' words;
  - a positioned code;
  - lane D's exact issue shape;
  - a refusal mixing two reasons;
  - an unknown reason, which falls back to the general advice.
- Domain `extraction/tests/conditions.test.ts`:
  - three existing positions updated to `.field`;
  - a new test: a key the step does not keep is refused at `.field`, `.column` or `.key`, and the same condition on a key the step does keep resolves.
- Domain `extraction/tests/column-match.test.ts`: one existing path updated to `["where", 0, "field"]`.

## Commands run and observed results

Core (`fxwork/t383/!FluxIQ/packages/fluxiq`):

- `npx vitest run .../llm/tests/loop-budget.test.ts .../candidate/tests/submission-refusal.test.ts` printed `Test Files 2 passed (2)`, `Tests 40 passed (40)`. This was the final run, after the test type fix.
- `npx vitest run .../flow-bootstrap/candidate/tests .../llm/evidence-loop/tests .../llm/tests/evidence-loop.test.ts .../tests/deepseek-bootstrap/tests/answerability.test.ts .../exploration.test.ts` printed `Test Files 37 passed (37)`, `Tests 419 passed (419)`. These are neighbouring tests, run to check for regressions.
- `npx tsc --noEmit -p tsconfig.json` exited 0 on the final run. The first run failed with 3 errors in my new test, `string | undefined` from a `Record` index; I fixed them with `as const`.
- `node scripts/structure-audit.mjs` (repo root) printed `structure-audit: passed (295 warning(s), 708 baselined)`, the same counts as before the change.

Downstream (`fxwork/t383/!FluxIQWebExtension/domain`):

- No single-file domain runner exists, so I used a scratch script, `scratchpad/t383-domain-tests.mjs`. It bundles the named tests exactly as `scripts/test-domain.mjs` does, into `domain/.test-build-scratch/t383` (since deleted), then imports them.
- Files run: `extraction/tests/{conditions,columns,column-match,slot}.test.ts` and `plan-resolution/tests/resolve-plan-node.test.ts`. Result: `# tests 56`, `# pass 56`, `# fail 0`, exit 0.
- `npx tsc -p tsconfig.json --noEmit` exited 0, and `npx tsc -p tsconfig.test.json --noEmit` exited 0.
- `node scripts/structure-audit.mjs` (repo root) printed `structure-audit: passed (184 warning(s), 257 baselined)`.

## Not verified

- No live run or Lab run, as the brief said. Two behaviours still need a live candidate build:
  - whether the model submits and tests inside the 5-decision wrap-up rather than calling complete;
  - whether lane D's model fixes a condition on an unknown column once it gets the new advice.
- Whether 5 is the right wrap-up size against the cost purse. A submission carries the whole script, so it may cost more than the average decision the count assumes.
- I did not run the full suites.

## Open questions or contradictions found

1. **The brief asked the domain issue to name the bad field and the step's saved columns. That cannot be done within the owned files.**
   - The only channel from the domain to Core is `{ status: "refused", issueCodes: string[] }`, with codes matching `^[a-z0-9_.:-]{1,100}$` (Core `harness-options/plan-parameter-resolution.ts`).
   - `issue-position.ts` deliberately spells model-chosen keys by position and never quotes values.
   - Core `plan/issue-feedback.ts` drops issue messages for codes outside `AUTHORED_CODES`.
   - What I did instead: the domain now points at the exact written name (`where.N.field`), and Core's advice tells the model where to look.
   - Quoting the name and the kept keys verbatim would need a structured detail on the domain refusal, which touches `slot.ts`, `resolve-plan-node.ts`, Core `plan-parameter-resolution.ts` and `plan/issue-feedback.ts`. `plan/**` is must-not-touch.
2. `domain/.../resolve-plan-node.ts:297` (`PLACEMENT_REASONS`) adds `web.handle.expected.extract_list.handle_fields` beside every `unknown_field`. That hint is about the `{handle, fields}` shape, which was not the defect in lane D. Worth reviewing; the file was not in my ownership.
3. `runtime/llm/evidence-loop/answered-request.ts:26`, the `llm_evidence_loop.not_offered` text, says the last decisions "offer no tools … Complete from your draft, or amend it". In a candidate wrap-up the submission and trial are offered and there is no draft to amend, so the sentence is now wrong in candidate mode. That file was not owned (`runtime/llm/evidence-loop/`, not `evidence-loop.ts`).
