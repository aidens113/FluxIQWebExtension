# t370 report: the chat's last legacy phrasings in candidate builds

## Outcome

Done. Both phrases from the lane A round 6 and 7 UI reviews are fixed in Core (t370 worktree `fxwork/t370/!FluxIQ`, branch `task/t370-chat-ready-words`). Nothing is committed.

## What changed and why

All paths are under `packages/fluxiq/src/programs/automation-studio/runtime/`.

1. **Ready line (candidate mode).** It still used the legacy words ("I tried its steps on ... and put the ones that worked into it") and tacked on "Before that, a test run ... was judged, twice". A candidate build does not try steps and keep the ones that work. It explores, writes the Flow, and the whole Flow is test-run from its start and judged.
   - `conversations/commands/build.ts`: replaced `AUTOMATION_STUDIO_CONVERSATION_CANDIDATE_TESTED` (a full sentence) with `AUTOMATION_STUDIO_CONVERSATION_CANDIDATE_JUDGED`, a clause: "a test run of the whole Flow from its start was judged, twice, to do what you asked". The only users were the three files below, and nothing downstream uses it (checked with grep across the t370 tree).
   - `create-here.ts`: when `built.trial` is set (a candidate proposal), it says `Your automation "<name>" is ready: I explored <site>, wrote its steps, and a test run of the whole Flow from its start was judged, twice, to do what you asked.` The progress "landed" line, which shows up in a later failure such as an apply that fails, now reads "explored <site>, wrote the Flow's steps and test-ran the whole Flow from its start". Legacy wording is unchanged.
   - `explore.ts`: the same pattern, "The Flow's steps are in: I explored <site>, wrote them, and a test run ... to do what you asked."
   - `improve.ts`: "Worked out the change on the website, and a test run ... to do what you asked. It is waiting for you to say whether to apply it."
   - The sentences branch on `built.trial`, which only a candidate proposal carries, and not on the environment mode.
2. **"Reading your instruction gave no answer for ...".** The text comes from `flow-bootstrap/action-permissions.ts` (`automationStudioFlowBootstrapUnansweredSaid`). `service.ts` wires the gate's `say` to the Flow's thread for both modes. The sentence claims "the build's tests check the step rather than do it again", which is the legacy dry-run behaviour (`flow-draft/verify-only.ts`). It is false for a candidate build, whose trial runs the whole Flow from its start.
   - The gate input has a new optional `authoringMode`. In `candidate` mode the line is not said. The read still treats the act as lasting.
   - `service.ts` passes the request's `authoringMode`, a one-token change in the `automationStudioFlowBootstrapActionPermissions({...})` call.
   - In legacy mode the line now says it plainly: `I could not tell from your instruction whether "<act>" changes something that stays changed, so when the build tests its steps it checks the step that does it rather than doing it again.` (The plural form is "change" / "the steps that do them" / "them".)
3. Tests:
   - `conversations/commands/tests/execute.test.ts`: exact candidate ready sentences for createHere and explore, with none of the legacy words. A new test checks the candidate "landed" line when apply fails. The exact improve sentence. Legacy cases assert that no candidate wording leaks into them.
   - `conversations/commands/tests/extension-chat.test.ts`: the real-registry candidate creation asserts the new ready sentence and none of the legacy words.
   - `flow-bootstrap/tests/action-permissions.test.ts`: the legacy sentence is updated, and the old words are gone.
   - `service/tests/instruction-authority.test.ts`: a new `it.each(["legacy","candidate"])` test. Both modes still name the act lasting. Legacy says the line once, and candidate says nothing.

**Ownership deviation:** the brief's Owns lists `runtime/conversations/**` and `runtime/activity/**`. The "gave no answer" phrase is not produced in either of those. It lives in `flow-bootstrap/action-permissions.ts` and is wired in `service.ts`, so I edited both, plus their tests. Neither file is on the must-not-touch list or in t368's paths. The `service.ts` change is one added property.

## Commands run and observed results

- From `fxwork/t370/!FluxIQ/packages/fluxiq`: `npx vitest run` on `conversations/commands/tests/{execute,extension-chat,build}.test.ts`, `flow-bootstrap/tests/action-permissions.test.ts` and `service/tests/instruction-authority.test.ts` -> "Test Files 5 passed (5), Tests 102 passed (102)".
- `npx tsc --noEmit -p tsconfig.json` (the config the package `check` uses) -> no output (no errors).
- From the Core root: `node scripts/structure-audit.mjs` -> "structure-audit: passed (289 warning(s), 710 baselined)". It also printed "1 baseline entries can be lowered". I did not touch the baseline, and I did not check whether that entry is from my change.
- `git diff | grep '^+' | grep -c 'as never'` -> 0. The only new import is a type import of `model/authoring-mode` (a leaf module), so no cycle.

## Not verified

- I did not run the new tests against the old source (no fail-first run). They assert the new exact strings and silence in candidate mode, so by construction they would fail on the old code.
- No live or Lab run, and no extension or overlay check. The panel was not touched. The full Core suite was not run (narrow-checks rule).
- Overlay headline flipping and the coupon/dismissal lines naming no control (also in the round 7 notes) are outside this brief.

## Open questions or contradictions found

- The phrase's real owner (`flow-bootstrap/action-permissions.ts`, `service.ts`) is outside the brief's Owns (see the deviation above).
- "judged, twice" is kept from the existing wording. It is true while the build-test judge confirms a yes with a second call; `authoring-result` parse refuses `calls: 1`. If t368 changes how verdicts are counted, revisit `AUTOMATION_STUDIO_CONVERSATION_CANDIDATE_JUDGED`.
