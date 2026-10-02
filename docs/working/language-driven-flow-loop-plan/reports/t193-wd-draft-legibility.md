# t193-WD: draft legibility, done-act refusal, honest stop words

Worker report, lane B, t193. Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t193/!FluxIQ`.
Evidence: `lab-runs/2026-10-01/run-muqiojz4-04a7a8fc/steps` 0019-0029.

## Outcome

Done, with one deviation from the brief (fix 1, the throwing describer, below).

## What changed and why

All paths are under `packages/fluxiq/src/programs/automation-studio/runtime/` unless they say otherwise.

### Fix 1: the draft line says which control a step named (`does`)

Evidence at 0021: step 10 read
`{"step":10,"actionId":"web.output.dom-click","input":{"node":"web.output.dom-click","parameters":{"target":{"handle":"t1091"}},"consequences":[]},...,"disposition":"taken"}`.
The model then sent `{"step":10,"change":"add","act":"a2"}` on what was a "×" closing a chat overlay.

- `flow-draft/step.ts`: new type `AutomationStudioFlowDraftStepWords = { target?: string; text?: string }` and a new optional step field `words`.
- `flow-draft/step-words.ts` (new): `automationStudioFlowDraftStepWordsOf(describe, call)`. It returns nothing when there is no describer, no answer, or an answer that is not an object. It keeps only string `target` and `text`, folds control characters and whitespace, and caps each at 160 characters, ending in `...`. A control's visible text can be a whole container's text, so the line names the control and does not quote it. It is exported through the `flow-draft/index.ts` barrel.
- `llm/evidence-loop.ts` (+1 line, now 796 of the 800-line limit): the step is recorded through `draftRecord` and now gets `words` from `input.describeCall` for `{ toolId: decision.toolId, value: decision.input }`. That is the same call the chat's observer describes. The host's free initial look is not described, because it is a look.
- `flow-draft/entry.ts`:
  - `stepLine` shows `does: { target, text }` right after `input`, only when the step has words.
  - The header comment now says `does` is the domain's own wording of the call, made from names the model was already shown, and that nothing is read from a page.
  - One sentence was added to `AUTHORED_INSTRUCTION`.
  - Before the added sentence: `... and done then names that step. To do one act ...`
  - After: `... and done then names that step. does, beside a step, names the control it acted on and the words it typed: name an act only on a step whose does is that act. To do one act ...`
- Line before and after, for the 0021 step:
  - Before: `{"step":10,"actionId":"web.output.dom-click","input":{...{"handle":"t1091"}...},"resultCode":"web.action.succeeded",...}`
  - After: `{"step":10,"actionId":"web.output.dom-click","input":{...{"handle":"t1091"}...},"does":{"target":"×"},"resultCode":"web.action.succeeded",...}`
- Persistence: `flow-bootstrap/incomplete-draft/kept.ts` uses structuredClone, so `words` carries through without a change. `loop-configuration.ts` `automationStudioLlmEvidenceLoopSeedSteps` spreads the step, so it carries too. `flow-bootstrap/incomplete-draft/parse.ts` now checks `words`: an object with at least one key, every key `target` or `text`, every value a string. Any other shape makes the whole record refused, the same rule as every other step field.
- Deviation, a throwing `describeCall`. The brief asked for a guard so that a throw gives no words and never a failure. I wrote it as `try { ... } catch { return undefined; }`. Core's `node scripts/structure-audit.mjs` failed it under `[failure-as-empty]`, and that rule has no best-effort exemption. The other worker had the same guard in `activity/observer.ts` (`describeSafely`). While I was working they removed it, so the observer now lets a throw through. The observer calls `describeCall` before the loop does, in both the `decide` and the `executeTool` wrappers, so a throwing describer already fails the call in production before my code is reached. My catch could not deliver "never a failure" and only broke the gate, so I removed it.
  - What `step-words.ts` does now: an absent describer gives no words. So does no answer, or an answer of the wrong shape. A describer that throws propagates its error.
  - This is pinned in `flow-draft/tests/step-words.test.ts` and documented in the file's header.
  - The domain's contract in `domain/src/runtime/llm-evidence/node-run/call-words.ts` says "an answer that cannot be given is no answer". It never throws by design.

### Fix 2: an act named again that the checklist shows done

Evidence at 0025-0029:
- The refusal was `{"step":10,"reason":"act_already_named","repeated":true}`.
- At the same time the checklist showed `a2.quantity` `"done":10` and `a2` `"done":11`, with `a3` and `a3.size` `"todo":"no_step_added"`.
- The round then stalled.

- `flow-draft/amendment.ts`: an `act_already_named` refusal now carries `act`, the act the amendment named. It is documented on `AutomationStudioFlowDraftAmendmentRefusal`.
- `llm/draft-amendment-feedback.ts`:
  - The feedback takes a new optional input, `actsNotDone`. When the refused act is not in that list, the refusal gets a `next`. When the list is empty, `next` says to complete instead.
  - With a non-empty list, `next` reads: "The acts checklist shows a2.quantity done, so nothing is left to do for it: do not name it again. Still not done on the checklist: a3, a3.size. Go on with those."
  - With an empty list, `next` reads: "... Nothing on the checklist is still to do: complete when the Flow does what the person asked."
  - Because `next` is set, the existing `NEXT_INSTRUCTION` sentence is added to the entry's instruction.
  - An act still to do, or no checklist, gives no `next`, as before.
- Reason text for `act_already_named`:
  - Before: "That step already names that act (act beside it in the draft), so naming it again changes nothing. If the acts checklist still shows the act not done, its todo says why and its step says which step: correct exactly that -- ..."
  - After: "That step already names that act (act beside it in the draft), so naming it again changes nothing. If the acts checklist shows the act done, nothing is left to do for it: go on with the acts and choices the checklist still shows not done. If it still shows the act not done, its todo says why and its step says which step: correct exactly that -- ..."
- `llm/decision-handlers/amendment.ts`, in `tell`: passes `actsNotDone: context.input.draft ? context.input.draft.actsMissing?.(context.draftSteps) : undefined`. This is the only place the checklist can reach the feedback. The brief did not name this file, but nothing forbids it.
- `flow-bootstrap/evidence-loop-steps.ts`: unchanged. It holds only the allow-list of reason codes, which are not text, and no new reason code was added.

### Fix 3: the ending no longer claims an attempt to finish

- How the 0029 round stalled: `repeatedOnly` in `decision-handlers/amendment.ts` called `automationStudioLlmEvidenceRepeatStop`, and that recorded the issue as `llm_evidence_loop.repeat_refused`. That code matched no `BLOCKED_WORDS` entry. So the person-facing text fell back to `STOP_WORDS.unusable_decisions`.
- `flow-bootstrap/unfinished-build/not-done.ts`:
  - The `STOP_WORDS.unusable_decisions` text changed.
    - Before: "every attempt to finish was refused"
    - After: "too many of its decisions in a row could not be used"
  - Two `BLOCKED_WORDS` entries were added:
    - `^llm_evidence_loop\.draft_amendments?_(?:refused|undone)$` reads "the model kept asking for changes to the Flow that changed nothing".
    - `^llm_evidence_loop\.repeat_refused$` reads "the model kept trying again what had already failed or changed nothing".
  - `automationStudioFlowBootstrapStopSaid(stopped, issueCodes = [])` now adds `, because <blocked words>` for `unusable_decisions` when the issues have words.
- Composition, fixed where the text is put together:
  - `unfinished-build/phases.ts`: the "Testing the Flow so far" announcement passes `ending.lastIssueCodes`.
  - `unfinished-build/not-doable.ts`: passes `input.judgement.lastIssueCodes`.
  - `budget-exhausted.ts`: already preferred `BlockedSaid(lastIssueCodes)`, so it was not changed.
- `llm/decision-handlers/refused-repeat.ts`: `automationStudioLlmEvidenceRepeatStop` takes an optional `issueCode`, which defaults to the repeat code.
- `decision-handlers/amendment.ts`: a stall made only of amendments refused again is now recorded as `llm_evidence_loop.draft_amendments_refused`. A rerun refused as `changes_nothing` keeps `repeat_refused`. The code is exported from `llm/draft-amendment-feedback.ts` as `AUTOMATION_STUDIO_LLM_EVIDENCE_AMENDMENTS_REFUSED_CODE`. The llm barrel names its exports, so the code is not public.
- Person-facing text for 0029, before and after:
  - Before: "The build stopped before the Flow was finished: every attempt to finish was refused. Running the Flow ..."
  - After: "The build stopped before the Flow was finished: too many of its decisions in a row could not be used, because the model kept asking for changes to the Flow that changed nothing. Running the Flow ..."

### Tests

New:
- `flow-draft/tests/step-words.test.ts`, 4 tests.
- `flow-draft/tests/entry.test.ts`, 1 test: `does` on the line and the sentence in the instruction.
- `flow-bootstrap/incomplete-draft/tests/incomplete-draft.test.ts`, 1 test: `words` survives keep, then JSON, then parse, and a bad shape is refused.
- `llm/tests/draft-amendment-feedback.test.ts`, 1 unit test and 3 loop tests:
  - `next` for a done act.
  - No `next` for an act still to do, or with no checklist.
  - The stall code is `draft_amendments_refused`.
- `llm/evidence-loop/tests/authored-draft.test.ts`, 2 loop tests: words reach the step and the shown draft's `does`, and non-word answers leave no `words`.
- `flow-bootstrap/unfinished-build/tests/not-done.test.ts`, 3 tests: the stop and blocked words.

Updated to new text they pinned:
- `flow-draft/tests/amendment.test.ts`: the refusal now includes `act`.
- `tests/service-bootstrap/tests/unfinished-build.test.ts:175`:
  - Before: `...the Flow could not be finished: every attempt to finish was refused\.`
  - After: `...the Flow could not be finished: too many of its decisions in a row could not be used, because the Flow it wrote was not one that could run\.` In that test the completions were refused for a plan with no Subflow, so the new wording is correct.

A first loop test file, `llm/evidence-loop/tests/draft-legibility.test.ts`, put `evidence-loop/` and `evidence-loop/tests/` over the 25-file directory limit, and `llm/tests/` was also full. I deleted it and moved its tests into the existing files above. The first module location, `llm/evidence-loop/call-words.ts`, moved to `flow-draft/step-words.ts` for the same reason.

Generated: `docs/reference/framework-reference.md` and `packages/fluxiq/docs/reference/framework-reference.md` were regenerated with `node scripts/docs-reference.mjs`, adding `AutomationStudioFlowDraftStepWords` and `automationStudioFlowDraftStepWordsOf` and moving line numbers. The regeneration also picked up the concurrent activity/UI worker's declarations, such as `activityActionReplayFailing`. Regenerate it again after integrating both.

Line endings: every file I touched is CRLF, checked by counting CR and LF bytes. `sed -i` had turned `draft-amendment-feedback.ts` into LF and the Write tool wrote the two new files as LF. I converted all three back, and the diff stat stayed 33+/5-. The generated docs files are written LF by their script.

## Commands run and observed results

All Core commands were run from the Core worktree, through `build-slots/heavy.sh` where they were heavy.

- `npx tsc --noEmit -p .` in `packages/fluxiq`: exit 0, no output besides `[heavy] t193 WD tsc holds b2`. This was the last run after all edits.
- `npx vitest run` over `runtime/flow-draft`, `runtime/llm/evidence-loop`, `runtime/llm/tests`, `runtime/flow-bootstrap/unfinished-build`, `runtime/flow-bootstrap/incomplete-draft`, `runtime/tests/service-bootstrap/tests/unfinished-build.test.ts` and `runtime/activity/tests/observer.test.ts`:
  - First run: 1 failed, `unfinished-build.test.ts:175`, which pinned the old stop words. I updated it.
  - Final run: `Test Files 74 passed (74)`, `Tests 721 passed (721)`, exit 0.
  - After the CRLF fix I re-ran `step-words.test.ts` and `draft-amendment-feedback.test.ts`: `Test Files 2 passed (2)`, `Tests 27 passed (27)`.
- `node scripts/structure-audit.mjs`:
  - First run: 4 failures. Two were `directory-files` from my new files, and two were `failure-as-empty`: my catch, and the other worker's then-current `observer.ts`.
  - Second run: 1 failure, my catch.
  - Final run: `structure-audit: passed (217 warning(s), 349 baselined)`, exit 0. The only warnings on files I touched were already there: `phases.ts` at 459 lines and `evidence-loop.ts` at 796 lines.
- `node scripts/docs-reference.mjs --check`: stale at first. After regeneration it printed `Deterministic framework reference is current.`, exit 0. It went stale once more in between, because the other worker's concurrent edits moved line numbers.

## Not verified

- No live or Lab run, so it is not shown that the model now avoids naming a "×" as an act, or moves on to `a3`.
- The extension or domain side was not run against these Core changes. `describeCall` is wired in `runtime/service.ts`, which I must not touch and did not read beyond grep.
- Full package suites were not run, per the narrow-checks rule.

## Open questions or contradictions found

1. The brief asked for a guard against a throwing describer. Core's `failure-as-empty` gate forbids that catch, and the observer it pointed to no longer has one. I resolved it by letting the throw propagate. If a describer that throws should really never fail a build, that has to be decided once for both callers, the observer and the draft: either an audit exemption in Core's `scripts/structure-audit/rules/failure-as-empty.mjs`, or a single wrap at the binding in `service.ts`.
2. `llm/evidence-loop.ts` is now at 796 of the 800-line hard limit.
3. The generated framework reference includes the concurrent worker's declarations, so regenerate it after both workers' changes are merged.
