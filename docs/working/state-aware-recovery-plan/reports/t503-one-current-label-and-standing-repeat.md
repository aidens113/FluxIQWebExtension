# t503 report: one current label and standing repeat

Worker report for brief t503, its continuation and its final step. Core tree `C:/Users/osrs_/FluxStuff/fxwork/t503/!FluxIQ`, branch `task/t503-one-current-label-and-standing-repeat`. Nothing is committed.

## Outcome

**Done.** Every goal is built, has a test that failed before its change, and passes the requested checks. Only `core.current_flow` now calls a script "your current Flow".

| Goal | State |
| --- | --- |
| 1. One current label | Done. Timeless labels and one trailing `core.current_flow` entry. The two remaining "current" references are reworded (final step). |
| 2. Submit repeat key on the standing revision | Done |
| 3. A contradicted unsure in an unsure/yes split is re-asked once | Done. Wired in `verify.ts`. |
| 4. Tool list byte-stable in the endgame | Done |
| Wording for listed-but-refused tools | Done |
| 5. No scenario words | Holds for every model-facing string I added. |

## What changed and why

All paths are under `packages/fluxiq/src/programs/automation-studio/runtime/`.

### Goal 1: one current label

**`flow-bootstrap/candidate/authoring-loop.ts`**

- **An accepted submission** is labelled "Revision N (digest D), as Core accepted it: script is its whole text."
- **A refused submission** carries `latestAcceptedWhenSent: {revision, digest, call}`, in place of `current`. Its `scriptIs` says:
  - it was refused and is no revision;
  - which revision was the latest accepted one when it was sent;
  - to read `previous` only to find the lines the issues name.
- **No label claims to be current, or says "Submit again from".** Each label says only what was true when it was written, so it stays true and is never rewritten.

**`llm/context-window.ts`**

- The t501 `supersedes` mark is removed.
- The window now ends with one Core entry, `core.current_flow`, with `{revision, digest, call, instruction}`:
  - it is built from the newest accepted submission that carries a script or plan;
  - it sits before the history and the budget, which change on every request anyway, so every tool result stays a byte prefix of the next request.
- The constant `AUTOMATION_STUDIO_LLM_EVIDENCE_CURRENT_FLOW_TOOL_ID` is exported.

**Final step: the two other places that said "current"**

- **`flow-bootstrap/candidate/submission-refusal.ts:99`** (`GENERAL_NEXT`): "(current names it)" is now "(core.current_flow names it)".
- **`llm/harness-options/bootstrap-completion.ts:244`**: the standing claim "that revision is your current Flow: edit its script" is now "Once a later submission is accepted, edit the script of the revision core.current_flow names, never this refused one."
- Neither string is in `system-prompt-pins.json`.

**Tests**

- **`flow-bootstrap/candidate/tests/accepted-script-context.test.ts`.** At every decision, through the real authoring loop, it checks that:
  - exactly one entry matches `/is your current Flow|your current Flow,|current Flow until/`, and that entry is `core.current_flow`, placed last before the history and budget and naming the latest accepted call's revision and digest;
  - no submission's `scriptIs` says "current" or "Submit again from";
  - no submission has a `current` or `supersedes` key.
  - It also replays round 17, and checks byte prefixes across 8 decisions.
- **`llm/tests/context-window.test.ts`**: the trailing entry, byte stability, plan wording, and nothing added when nothing was accepted.
- **`submission-refusal.test.ts`**: asserts the "(core.current_flow names it)" wording.
- **`bootstrap-completion.test.ts`**: asserts the new sentence, and that the refusal instruction no longer contains "current Flow" at all.

### Goal 2: `llm/repeat-guard/outcomes.ts`

- A `core.submit_candidate` call is now keyed on the digest of the standing revision, read from the latest accepted answer.
- **Resending an earlier revision while another one stands** (one never refuted) now runs, so Core can restore it.
- **An identical resend while the same revision stands** is still refused without running.
- Test: `repeat-guard/tests/standing-revision.test.ts`.

### Goal 3: a contradicted unsure in an unsure/yes split

- **`result-verification/verdict.ts`**: an unsure the model gave now keeps `unsureReading`, the screened expected, observed and advice. It still carries no repair.
- **`result-verification/contracts.ts`**:
  - Verification gets `unsureReading` and `contradictedUnsure: {call, record, reasked?}`.
  - The summary gets `recheck?: string`.
  - `verdicts` and `calls` now allow 3.
  - The file is at 799 lines. The audit limit is 800 and the file is not baselined, so I tightened neighbouring doc comments.
- **`result-verification/agreement.ts`**:
  - On an unsure beside a yes, in either order, the unsure call is marked when Core's paging record contradicts it (`contradictsPagingRecord`, the same check as t501's double no).
  - `automationStudioResultVerificationReaskContradicted` asks the marked call once, with Core's record named. Its answer takes that call's place under the unchanged agreement rule:
    - a yes beside the other yes gives `answers`;
    - anything else leaves the verdict unsure;
    - an answer that does not come back usable keeps the settled outcome;
    - the outcome is marked `reasked` and is never asked again.
- **`result-verification/verify.ts` (final step)**: after the second check, the settled outcome goes through the re-ask.
  - `ask` calls `askCheck` again for the marked call, on a summary copy that carries `recheck`.
  - That call's intervention metadata carries `verificationReask: true`.
  - The header and the report type note the third call.
- **`result-verification/build-test/judge.ts`**: an `unknown` verdict carries `doubtContradicted`. It is Core's sentence naming the call, the record, and what the re-ask answered.
- **`service/candidate-trial/feedback.ts`**: an unsure trial carries `doubtContradicted`, with a note saying the doubt is no evidence against the Flow and to test the same revision again.

Goal-3 tests:

- **`result-verification/tests/verify.test.ts` (final step)**, with a scripted provider over a read whose list ended:
  - unknown (paging), yes, yes: outcome `answers`, verdicts `[unsure, answers, answers]`, 3 calls, 3 interventions. The interventions' `[verificationCheck, verificationReask]` are `[[1, undefined], [2, undefined], [1, true]]`. Only the third request's `resultSummary.recheck` names the record.
  - unknown (paging), yes, unknown (paging): stays unsure (`model_disagreed`), 3 calls, and no fourth call.
  - When the record leaves the paging open: 2 calls, unsure.
- **`agreement-both-readings.test.ts`**: the marking and re-ask logic.
- **`verdict.test.ts`**: the judge's prose appears only under `unsureReading`. It never reaches the failure record or what a run records.
- **`build-test/tests/judge.test.ts`** and **`service/candidate-trial/tests/paging-feedback.test.ts`**: the surfaced `doubtContradicted`.

### Goal 4: `llm/loop-budget.ts`

In a candidate build's last few decisions, every tool stays listed, so the request's head is unchanged. Exploring tools are refused when called, and the budget note says so.

### Wording: `llm/evidence-loop/answered-request.ts`

- In a candidate build's last few decisions, the "not offered" answer now reads: "only core.submit_candidate, core.test_candidate and completing run now. This tool is still listed, but this call was not run."
- Tests: `evidence-loop/tests/wrap-up-not-offered.test.ts`, plus one expected prefix in `llm/decision-handlers/tests/decision-context-wiring.test.ts`. That test pins this exact text and sits outside the file's own folder.

## Commands run and observed results

Commands ran from `packages/fluxiq`; `$R` is `src/programs/automation-studio/runtime`.

### Fail-first, final step

| Command | Before the change | After |
| --- | --- | --- |
| `npx vitest run $R/result-verification/tests/verify.test.ts` | 2 failed: "expected [ {…}, {…} ] to have a length of 3 but got 2" | 10 passed |
| `submission-refusal.test.ts` and `bootstrap-completion.test.ts`, run against HEAD's two sources (copied in, then restored) | 2 failed, 63 passed | 65 passed |

### Fail-first, earlier passes

| Test | Before the change | After |
| --- | --- | --- |
| `accepted-script-context.test.ts`, against HEAD's sources | 4 of 7 failed | 7 passed (still 7 after the regex was tightened) |
| `wrap-up-not-offered.test.ts` | 1 failed | passes |
| agreement tests | 6 of 7 failed | 13 passed |
| `judge.test.ts` and `paging-feedback.test.ts` | 2 failed | 38 passed |
| `standing-revision.test.ts` | 1 failed | passes |
| `loop-budget.test.ts` | 3 failed | passes |

### Final validation

| Command | Observed result |
| --- | --- |
| `npx vitest run $R/llm/tests $R/llm/repeat-guard $R/llm/evidence-loop $R/result-verification $R/flow-bootstrap/candidate $R/llm/deepseek $R/service/candidate-trial $R/llm/harness-options $R/llm/decision-handlers` | exit 0, **192 files, 2016 tests passed** |
| Earlier wider runs: `$R/llm $R/flow-bootstrap $R/tests/deepseek-bootstrap $R/recovery`, and `$R/service` | passed after the pinned-prefix fix: 143 files, 1099 passed, 1 skipped for `service` plus `decision-handlers` |
| `npx tsc --noEmit -p .` | `tsc_exit=0` |
| `node scripts/structure-audit.mjs`, from the Core root | `audit_exit=0`: "structure-audit: passed (340 warning(s), 1159 baselined)". It also says "2 baseline entries can be lowered". |

## Not verified

- **No live, Lab or provider run.** The re-ask has been exercised only with a scripted provider.
- **A re-ask may not fit the judgement deadline.** `deadline.ts` (not mine) sizes it for two checks asked twice each (4 × the per-call timeout + 30 s). A re-ask adds a third check, so a slow judgement could hit the deadline and end "not judged".
- **The judge's cost cap outside a build purse** is still half of what is left per call (`build-test/judge.ts:217`). A third call could reach 1.5 times the cap. Builds under a purse, as in the Lab, are unaffected.
- **The two lowerable baseline entries are unidentified.** I did not run `pnpm structure:baseline`.

## Open questions or contradictions found

- **Deadline.** Should `deadline.ts` allow for the re-ask's third check?
- **Other generic phrases.** `GENERAL_NEXT` still says "your current Flow's script" in general terms. It names no revision, and now points at `core.current_flow`. The test's regex does not match it, by design.
