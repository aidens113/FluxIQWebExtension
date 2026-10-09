# t378 w11: wording and row contract (worker report)

## Brief

### Brief: t378-w11-wording-and-row-contract (worker)
- Repository: FluxIQ Core. Tree T = `C:/Users/osrs_/FluxStuff/fxwork/t378` (on `task/t378-candidate-feedback`). R = `T/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime`.
- Rule: words a person sees are plain English; never codes, node ids, handles, plan indices or command names.
- Context: W4's report `T/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/t378-candidate-feedback/w4-runtime-wording.md` (its "Not verified" and "Open questions"). W1 now gives every candidate refusal issue `step` (the step's description as the model wrote it), `label`, `line` and sometimes `instead` (report `w1-refusal-locator.md` beside it).
- Task:
  1. Row on the wire: `T/!FluxIQ/packages/contracts/src/client-gateway.ts:191` `ClientGatewayActivity.step` declares `row?: string` (the pass's row as a person reads it); remove the wider local type and the cast W4 used (`R/activity/step/started.ts`, `R/activity/bounded.ts`). Keep it optional and backward compatible; update any contract test or doc that lists the step fields (search `packages/contracts` and `T/!FluxIQ/docs/architecture` for the step activity shape).
  2. The build-failed ending names the refused step in the model's own words: where the issues carry `step`, use it (lane D: "the step 'keep requests with 5 or more mutual friends' was given a setting it doesn't take" instead of "a step was given a setting it doesn't take"). Quote at most the step description, bounded; never the code or line number to the person.
  3. Click and Type cards name their control from the Core side: lane D's exploration "Click" cards named no control. Find why `R/activity/wording/action.ts` (`elementName`) produced no name for those calls (the call's target handle and the page view name it), and name it when the evidence printed one.
- Owns: `R/activity/**`, `R/conversations/commands/progress.ts`, `R/service/candidate-failure/**`, `T/!FluxIQ/packages/contracts/src/client-gateway.ts` (the `row` field only) and the tests and docs beside those.
- Must not touch: `T/!FluxIQ/packages/fluxiq/src/ui/**`, `R/executor/**`, `R/flow-bootstrap/**`, `R/llm/**`, other contracts, the extension, any other tree, lab slots or processes. Other workers edit other files now; an error only in a file you do not own is theirs: record it, do not fix it.
- Definition of done: tests beside each change; `npx vitest run` on `R/activity`, `R/conversations/commands/tests`, `R/service/candidate-failure`, `R/service/flow-bootstrap-commands/tests` and the contracts tests you touch, from `T/!FluxIQ`; `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` (and the contracts package's tsconfig) clean for your files. Never commit; no `pnpm build`; no Lab run or provider call.
- Report to: `T/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/t378-candidate-feedback/w11-wording-and-row-contract.md` (paste this brief at its top; protocol report format; return at most 12 lines).

## Outcome

**Partial.**

- Items 1 and 3 are done.
- Item 2 is done for the wording and for the refusal card the person sees during the build.
- The build-failed ending itself cannot receive the step's words. The failure diagnostic is a closed, codes-only contract that lives in `R/flow-bootstrap/generation-failure/`, which I do not own. See "Open questions".

## What changed and why

All paths below are under R unless they say otherwise.

**Item 1: `row` on the wire.**
- `T/!FluxIQ/packages/contracts/src/client-gateway.ts`: `ClientGatewayActivity.step` now declares an optional, documented `row?: string`. A client that does not know the field ignores it.
- `activity/step/started.ts`: the wider local type (`& { row?: string }`) is gone, and the header comment now points at the contract.
- `activity/bounded.ts`: the cast is gone. The step reads `step.row` directly, cut to the title's bound.
- `T/!FluxIQ/docs/architecture/automation-studio/client-gateway.md` gains a paragraph on `step.row`: optional, list-loop passes only, and not on recovering or settled rows.
- `packages/contracts` has no tests, and no other doc lists the step fields.
- Test added in `activity/tests/bounded.test.ts`: `row` is cut to 160 characters, kept when it is short, and absent when not given. `activity/loop/tests/row.test.ts` already checks that `row` is emitted.

**Item 2: name the refused step.**
- `activity/wording/issue-words.ts`:
  - `AutomationStudioActivityIssue` gains `step?`.
  - Each reason now has `named` and `namedMany` forms.
  - A new `named` argument, the third, names steps in their own words when every step place of a reason has words and there are at most two. Example: "the step 'keep requests with 5 or more mutual friends' was given a setting it doesn't take".
  - A step's words are screened through `automationStudioActivityReasonText`, so handles, node ids and codes are dropped. They are held to 80 characters and lose any closing punctuation. Line numbers and codes are never shown.
  - Three or more steps, or a step with no words, are counted as before.
- `activity/wording/issues-of.ts` reads `step` from each feedback issue.
- `activity/wording/refusal-tally.ts` passes `named = true`. The refusal card (`completion-refusal.ts`) and the candidate submission card (`candidate/submission-words.ts`) now name the refused step during the build.
- `conversations/commands/progress.ts` `refusedWords` passes `named = true`. It names steps once the decoded refusal's issues carry `step`, which they cannot yet (see "Open questions").
- Tests added in `activity/wording/tests/issue-words.test.ts` (4 cases):
  - one step named, with no line, code or "nodes" in the words;
  - two steps named;
  - a step with no words, and three steps, counted instead;
  - a long step bounded with "…" and its handle `t857` dropped;
  - the default (`named` false) unchanged;
  - the completion card naming lane D's step.

**Item 3: Click and Type cards name their control.**
- Root cause, in two parts:
  - The exploration calls carry only `parameters.target: { handle: "t12" }`. I read this in lane D's `steps/0004..0018/call.json`. `elementName` reads `parameters.element`, which only a resolved node keeps.
  - The candidate build's loop input at `service.ts:1565` passes no `describeCall`, unlike the legacy round at `service.ts:1595`. So the domain never names the handle, and `words.target` is empty.
- Fix inside `activity/`:
  - `activity/call-context.ts`: `decided(evidence)` now reads each handle the shown evidence printed with a quoted name (`t12 link "Friends"`), at most 4 levels deep, rebuilt on each decision so the latest view wins. A new `target(call)` returns that name for a call's handle, from `parameters.target` (a string or `{handle}`), else `target` or `handle`.
  - `activity/observer.ts`: a new `describedOf(call)` uses the domain's words first and falls back to the printed name. It is used for the decision's words, the held call, and the tool card.
- Tests added in `activity/tests/call-context.test.ts`, using lane D's handles:
  - t12 gives "Clicking “Friends”", with card target "Friends";
  - a later view renaming t857 wins;
  - an unprinted handle (t542) stays "Clicking on the page";
  - a domain `describeCall` target still comes first.

## Commands run and observed results

All commands ran from `T/!FluxIQ`.

- `npx vitest run R/activity R/conversations/commands/tests R/service/candidate-failure R/service/flow-bootstrap-commands/tests packages/contracts`: "Test Files 69 passed (69), Tests 606 passed (606)".
- `npx tsc --noEmit -p packages/fluxiq/tsconfig.json`: no output, exit 0.
- `npx tsc --noEmit -p packages/contracts/tsconfig.json`: no output, exit 0.
- `npx vitest run R/flow-bootstrap/candidate R/llm/harness-options` (extra, to check that the tally change did not break W1's card words): 227 passed, 1 failed.
  - The failing test is `flow-bootstrap/candidate/tests/submission-refusal.test.ts > ends the round at the third refusal ...`.
  - It expected `refusal` to match `call:...parameters_unresolved:[0-9a-f]{8}` and received `"call:flow_bootstrap.evidence_completion_parameters_unresolved"`, with no digest.
  - That is W1's refusal digest, in `flow-bootstrap/candidate/submission-refusal.ts` and `llm/decision-handlers/refusal-run.ts`. Neither file is mine and my change touches neither. It is likely another worker's edit in progress. I recorded it and did not fix it.

## Not verified

- No Lab run, browser or extension rendering was done; the brief forbids them. Whether the extension draws `step.row` or the named step is not checked.
- The printed-line pattern (`^<letter><digits> ... "<name>"`) was checked against lane D's `page.txt` format only. Other views (find results, describe results) are read only where they print the same line shape.
- The ending's naming (item 2) is not reachable end to end. No test shows the ending naming a step, because the failure cannot carry the words yet.

## Open questions or contradictions found

- **Item 2 carrier (blocker for the ending).** The ending reads the last refusal from `diagnostic.issueCodes`.
  - Those must match `DIAGNOSTIC_ISSUE_CODE` `/^[a-z0-9_.:-]{1,100}$/i`, documented as "no whitespace, so no sentence".
  - `parseAutomationStudioFlowBootstrapGenerationError` rejects any unknown field (`hasExactFields`).
  - So the model's step words cannot travel without a new diagnostic field. I did not encode them as a slug in the codes, because that would get around the codes-only rule and put model-written, possibly page-derived text into retained records.
  - The fix needs these changes:
    1. A bounded, screened field such as `refusedSteps?: string[]`, at most 2 entries of 80 characters, in `flow-bootstrap/generation-failure/diagnostic.ts` and `diagnostic-parse.ts`.
    2. `submission-refusals.ts` (mine) keeps `issues[].step`, which `issuesOf` now reads.
    3. `candidate-generation.ts` `stalled` passes it through.
    4. `progress.ts` `refusedWords` puts it onto `refusal.issues`. `named` is already on.
  - Until then the person sees the step named on the refusal card in the chat, and the ending keeps the generic words.
- **Item 3, second half.** `service.ts:1565` (not mine) should pass `describeCall` to the candidate loop as `service.ts:1595` does. Then the domain names a handle even when the page view printed no quoted name, and a press that closes its popup is still named, through `namedAtEnd`. The page-view fallback covers lane D's cards without it.
- The `submission-refusal.test.ts` failure above belongs to the owner of the refusal digest.
