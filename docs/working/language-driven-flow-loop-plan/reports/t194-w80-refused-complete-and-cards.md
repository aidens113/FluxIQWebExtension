# t194-w80: refused completions and cards for decisions that did nothing

## Outcome

Done. R3c, U7, U8 and U4 are fixed in Core (tree `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ`). Each fix has a test that I watched fail before the change and pass after it. One extension test now asserts the old wording and will fail. It is outside what I own; see Open questions.

## What changed and why

R/ = `packages/fluxiq/src/programs/automation-studio/runtime/`, S/ = `packages/fluxiq/src/`.

### R3c: a completion the test refused after the check passed is now logged and shown

- `R/llm/node-tools/dry-run-gate.ts`: every refusal now carries `steps`, the step positions it names: the unrunnable steps, or for a failed replay the steps that did not replay. The field is non-enumerable, so it sits beside the codes rather than among them. I chose this because about 13 existing assertions do `toEqual({ issueCodes: [...] })` on the gate's answer. Four of those are in another worker's untracked `carried-as-stored.test.ts`, and a new enumerable field would have broken all of them. The `AutomationStudioFlowDraftDryRunRefusal` type gains an optional `readonly steps`.
- `R/llm/evidence-loop/completion-attempt.ts`: when the check accepted and the test then refused, it calls `testRefused({ issueCodes, steps })` on the check function, if that function has one. A listener that throws is ignored, with a `best-effort` comment, and the attempt is refused either way.
- `R/llm/evidence-progress/progress-trace.ts`: the traced check function now has a `testRefused` that prints `completion refused by=test issues=<codes> steps=<n,n>` right after the check's `completion check ok=true`, then passes the refusal on to the check it wraps.
- `R/activity/observer.ts`: the observed check function now has a `testRefused` that emits the same closing note as a refused check: "The proposed Flow was sent back to be fixed", `Completion check`, `failed`, with words from the completion-refusal wording. It also passes the refusal on. The closing note is built by a new helper, `sentBack`.
- `R/activity/wording/completion-refusal.ts`: reads the test's own codes when the check's feedback names no refusal:
  - `full_run_required` reads "some of its steps haven't run in this build, so the whole Flow can't be tested from its start yet".
  - `dry_run_refused` reads "its test run from the start didn't go through".
  - With `steps` it counts steps ("3 steps need fixing.") instead of issue codes.
- Order: `progress-trace` wraps the observer's input inside the loop, so the call goes completion-attempt, then trace, then observer. With tracing off, the trace returns the input unchanged and the observer's hook is called directly.

### U7: a refused call no longer reads as the page failing

- `S/ui/activity-action/failure-reason.ts`: the reasons `target_not_a_handle`, `malformed_handle` and `handle_in_wrong_parameter` now read "FluxIQ didn't send it, since it named no control from the page". The client still puts "Didn't work:" in front and draws it red, because `outcome` stays `failed`. Changing that needs the extension's card (`card-words.ts`), which I do not own.
- `R/activity/wording/draft-edit-refused.ts`:
  - `changes_nothing` and the repeat-guard outcomes now say "was already tried exactly this way", never "already ran".
  - The card title is now "Didn't run the step" instead of "Didn't run the step again".
  - The reason is that the loop's `changes_nothing` and `repeated:failed` do not say whether the earlier attempt reached the page. "Tried" is true either way.

### U8: an edit the loop could not use is shown as nothing done

- `R/activity/draft-edit.ts`: a held `amend_draft` whose iteration has a `core.decision_check.<n>` entry in the next decision's evidence is now treated as unusable. So is one whose stalled-round trace row is `decision: "unusable"` (other than a repeat refusal). It is said as "Deciding the next step — didn't work", a failed thought with no summary, the same row the observer already emits for a decision that never came. "Updating the draft Flow" and the model's words are no longer shown for it.

### U4: names the model was shown are screened from its words in the chat

- `R/activity/wording/reason-text.ts`: a new `screened()` runs before the existing token hiding:
  - Handles are left out: `tN`, `dN`, `eN`, `word.N` and `word.N:…`, with any quotes or backticks around them.
  - Namespaced node or tool ids are said by their last segment: `web.output.dom-extract` becomes "dom extract".
  - snake_case names become words: `extract_list` becomes "extract list".
  - Parenthesised draft step references are dropped: "(step 7)", "(steps 3 and 4)".
  - Parentheses left empty are removed, and spaces before punctuation are tidied.
  - Words holding "/" or "@" (addresses) are left whole.
  - Every model summary shown in the chat goes through this function: thoughts, draft-edit cards and result-verification's check activity.

### Tests (each watched failing first, then passing)

- `R/llm/node-tools/tests/dry-run-gate.test.ts`: the refusal carries steps `[1, 3]` beside its codes.
- `R/llm/evidence-loop/tests/completion-attempt.test.ts`: a listening check is told on a test refusal, and not on a check refusal or a pass.
- `R/llm/evidence-progress/tests/progress-trace.test.ts`: `completion check ok=true issues=-` then `completion refused by=test issues=llm_evidence_loop.full_run_required steps=1,7`, and the refusal is passed on.
- `R/activity/tests/observer.test.ts`:
  - R3c: the chat rows are started, then "plan checks out", then "sent back to be fixed" with the step count, and the refusal is passed on.
  - U8: unusable edits, at the next decision and at a stall, show only "Deciding the next step — didn't work".
  - U7: the rerun-refusal expectations are updated.
- `R/activity/wording/tests/reasons.test.ts`:
  - U4: screening cases, including an address and "1.7L"/"e2e" left alone.
  - R3c: the test-refusal wording.
  - U7: no "ran" for any rerun refusal, and the title "Didn't run the step".
- `S/ui/activity-action/tests/failure-reason.test.ts` and `action-of.test.ts`: the U7 wording.

## Commands run and observed results

All run from `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ/packages/fluxiq` unless noted.

- Before the fixes, the brief's directories plus the new tests: 15 failing tests, all of them the new or updated ones (for example "carries the steps it names beside its codes", "tells a check that listens…", "says a completion the test refused…", "screens handles…", "says an edit the loop could not use…").
- After the fixes: `npx vitest run src/programs/automation-studio/runtime/activity src/ui/activity-action src/programs/automation-studio/runtime/llm/evidence-progress src/programs/automation-studio/runtime/llm/evidence-loop src/programs/automation-studio/runtime/llm/node-tools` printed `Test Files 81 passed (81)` and `Tests 806 passed (806)`.
- `npx tsc --noEmit -p tsconfig.json` exited 0 with no output. The tree included other workers' in-flight edits.
- `node scripts/structure-audit.mjs`, run from the Core root:
  - First run: 4 violations. Three were mine: two test imports that reached into another directory instead of using its barrel, and an empty `catch {}`. I fixed all three.
  - Second run: 1 violation left, `[directory-files] …/llm/evidence-loop/tests/: 26 source files exceeds the 25-file limit`. The 26th file is another worker's untracked `rerun-needs-input.test.ts`. I added no file there.
- `npx vitest run …/result-verification/tests/check-activity.test.ts …/llm/tests/draft-amendment-feedback.test.ts`: 34 passed. These are neighbouring consumers of the reason screen.

## Not verified

- No live run or browser check. The chat rows, `core.log` lines and card wording are checked only by unit tests.
- The extension test `!FluxIQWebExtension/apps/extension/src/panel/chat/view/tests/action-card-view.test.ts:211` asserts `"…Didn't work: it didn't name a control from the page"`. With the new U7 wording it will fail; I did not run it.
- The completion-refusal hook only fires where the loop is given a `checkCompletion`. A build always has one. A recovery exploration without a check gets neither the trace line nor the chat row.
- A `tool_call` or `complete` decision the loop could not use is still shown when it is decided: its thought is emitted immediately, and existing tests pin that. Only `amend_draft`, the U8 case observed in the run, is held and suppressed. A standalone "step 7" outside parentheses is left in the model's words.

## Open questions or contradictions found

1. **Extension test needs the new wording.** The supervisor should update `action-card-view.test.ts:211` to "Didn't work: FluxIQ didn't send it, since it named no control from the page", or change the card so a refusal that was never sent is not "Didn't work" in red. That would need a new `ActivityAction` field read by the extension's `card-words.ts`.
2. **The hook is a stopgap.** The `testRefused` hook is a property on the check function. The cleaner seam is a loop-input callback set in `R/llm/evidence-loop.ts` and `R/llm/decision-handlers/completion.ts`, neither of which I own.
3. **The structure audit fails on another worker's file.** `evidence-loop/tests/` is now at 26 files because of the untracked `rerun-needs-input.test.ts`, so the audit fails until that directory is grouped.
