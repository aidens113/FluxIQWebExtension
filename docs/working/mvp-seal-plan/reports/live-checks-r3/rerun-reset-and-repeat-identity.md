# Rerun reset and repeat identity (run-mwc60eal-4c9fdf6f, attempt 1)

Worker report for E1. Read-only trace; no source or test file was edited.
Core paths are relative to `C:/Users/osrs_/FluxStuff/fxwork/t885/!FluxIQ/packages/fluxiq/src`.

## Outcome

Done. Both defects are traced to their root causes. Defect 2 was reproduced exactly against the real repeat guard: the scratch script gave the same `sameAsCall` and `then` as steps 58 and 60. The fixes below are proposals only.

**One premise in the brief is wrong, and the diagnosis depends on it.** `rerun.5.place` and `rerun.9.place` were not a whole-Flow test. Each was the put-back that Core sends before the model's own one-step `amend_draft` `rerun`:

- Step 41 (decision) / 42 (`draft_rerun`, `rerunStepId: d15`): rerun step 5, the list read, with handle `extraction.3`.
- Step 54 / 55 (`draft_rerun`, `rerunStepId: d7`): rerun step 9, the return-to-list navigate, with url `...&_ipg=96`.

The callId is `rerun.<position>` and the reset is `rerun.<position>.place` (`runtime/llm/node-tools/step-place.ts:182`). Attempt 1 ran no whole-Flow test: answer-first runs with `dryRun: false`.

## Defect 1: why a rerun asks for a reset, and who refuses it

### Root cause

1. **What sends the reset.** `automationStudioNodeRerunFromItsPlace` (`runtime/llm/node-tools/step-place.ts:179-199`) runs before every rerun. It is called from `runtime/llm/evidence-loop.ts:408`.
   - When the step has a recorded `from`, and the page now is not the step's `stateBefore` (`:188`), it sends `{ replay: "reset", from }` (`putBack`, `:249-260`). It then re-does the proposed steps before the rerun that started on the same page.
   - A rerun that would press a lasting act goes further. It puts the page back to the Flow's first step and re-does every step before it (`lastingActPlace`, `:226-246`).
   - The function always behaves this way. Nothing in its input says the caller forbids putting a page back.
   - In this run, step 5 started on `...LH_Auction=1` (24 per page). At step 43 the page was `...&_ipg=96`, after the model's own select at step 38. Step 9 started on the item page `itm/305528810336`. At step 56 the page was the 24-per-page list, left there by run_flow step 52. So in both cases the page differed from the step's start, and a reset was sent.
2. **What refuses it.** `automationStudioAnswerFirstCallChain` refuses every call with `value.replay === "reset"` before it reaches the domain (`framework/automation-service/service/answer-first/attempt/call-chain.ts:128`). It answers with `NO_RESET_CODE` and `NO_RESET_SAID` (`:52-53`).
   - The header gives the reason: "Nothing is put back on this path (D1) … a model's `amend_draft` rerun of a step on another page would … taking the page away from what the attempt did" (`:15-18`).
   - D1 is in Core's `docs/working/answer-first-plan.md:102`: "There is no trial, reset or dry run inside it, so acts land once."
3. **What the rerun becomes.** `putBack` reads the refusal as a reset that failed and answers `unreachable` (`step-place.ts:258-259`, `:372-388`, code `llm_evidence_loop.rerun_place_unreachable`). `automationStudioNodeRerunAnswer` then answers the rerun with that refusal and runs nothing (`runtime/llm/node-tools/rerun-check.ts:132`).

**Who decides.** Core's answer-first call chain decides, unconditionally, for every answer-first attempt. Nothing about this task or site is involved. The words "Nothing is put back on this task" are the chain's fixed text and read as if the task were special. It is not.

**The real defect: two contracts that contradict each other.**

- The loop already knows it is in answer-first's forward mode. `round.ts:88` passes `dryRun: false`, and `round.ts:92` passes `forwardRun`. The `forwardRun` doc in `runtime/llm/loop-configuration.ts:434-439` says: "from the page as it stands, never from the top … No reset, no re-anchor."
- The rerun placement is never told any of this. So in answer-first, every rerun of a step whose start page is not the current page is unreachable by construction. It costs a paid decision and returns nothing.
- `framework/automation-service/service/answer-first/tests/endings/tests/rerun-reset.test.ts` asserts this behaviour as intended.

**Why it matters beyond the wasted decisions.** The reset is a page move, not a site reset. The web domain's `resetPage` (extension `domain/src/runtime/llm-evidence/node-run/replay.ts:277-300`) only navigates to `from.location` and closes opened tabs ("Moving about has no lasting consequence"). So the user's rule of 2026-10-27, which is about undoing lasting acts, is not what blocked it. D1 and D2 ("forward from where it is", `answer-first-plan.md:104`) are what make a put-back wrong here:

- At step 43, the put-back would have reloaded the 24-per-page list and read 24 rows. The model wanted the read on the 96-per-page view it was standing on.
- At step 56, the rerun was a navigate by URL. It needed no placement at all.

### What the rerun should do instead

**Proposal.** When the loop runs in forward mode, a rerun runs from the page as it stands, the way a forward run does.

- No reset is sent.
- No earlier steps are re-done.
- A lasting act is not replayed from the Flow's start. D5 already declines a restart from the top.
- The answer carries an honest place note: the step started on page X, and this rerun ran here.
- The step the rerun leaves records where it actually ran. Its `stateBefore`/`stateAfter` already come from digests taken around the call. The host writes `replay.from` (`flow-authoring/draft/dry-run.ts:374`), so it names the page the call ran on.

This keeps every D1 guarantee:

- Nothing is put back.
- Every call still goes through the act gate (`call-chain.ts:129-130`), so a landed act is not repeated (D6).
- A done act is still rerun as a check (`rerun-check.ts`).

**What this run would have done.** Step 43 would have read all 42 auctions on the 96 page, which is what the model asked for. Step 56 would have navigated to the 96 list. That is exactly what the model then spent steps 57-65 doing by hand.

**Alternative rejected.** Letting the put-back through in answer-first. It is only a navigation, but:

- it takes away the page the attempt stands on (D2), which was wrong at step 43;
- its re-do of earlier steps is a partial replay, and for a lasting act a replay from the Flow's start: the dry run D1 excludes.

### Proposed fix (files)

1. `runtime/llm/loop-configuration.ts`: add a loop input that says reruns run as the page stands.
   - Option A: an explicit flag, e.g. `putsBack?: false`, documented as "this caller puts no page back (answer-first D1): a rerun runs from the page as it stands".
   - Option B: derive it from `forwardRun !== undefined && dryRun === false`.
   - Recommendation: option A. One named fact, set by the caller.
2. `framework/automation-service/service/answer-first/attempt/round.ts` (beside `:88`): set that input.
3. `runtime/llm/node-tools/step-place.ts`:
   - Accept the flag. When it is set and the step's page is known and differs, return `{ kind: "in_place", why: "forward_run", from }`. Never call `putBack`, `redo` or `lastingActPlace`.
   - Keep `already_there` and `start_page_unknown` as they are.
   - In `placeNote`, write `{ place: "in_place", reason: "forward_run", stepStartedOn: from, detail }`. The detail, generic wording: "This attempt goes on from the page as it stands and puts no page back, so this rerun ran here, not on the page its step started on (stepStartedOn). If the step belongs on that page, go there first; this answer is about this page."
   - Extend `AutomationStudioNodeRerunPlace` with the new `why`.
4. `runtime/flow-authoring/draft/step.ts:395`: add `{ kind: "forward_run" }` to `rerunPlace`. `automationStudioNodeRerunPlaceOfStep` maps it.
5. `runtime/result-verification/build-test/landing.ts:72-76` (`orderOf`): read `forward_run` like `already_there`. It ran on the page as it stood, without the steps before it re-done. Otherwise a lasting press made in place would fall through to the generic branch and could be counted as landing in order.
6. `runtime/llm/evidence-loop/rerun/request.ts:164`: in forward mode, check the rerun against the current page (`at` undefined), not the step's `stateBefore`. That is where the rerun will now run. Thread the flag from `runtime/llm/decision-handlers/amendment.ts:75`.
7. `runtime/llm/evidence-loop.ts:408`: pass the flag to `automationStudioNodeRerunFromItsPlace`.
8. `call-chain.ts:128`: keep the refusal as the mechanical backstop, because a reset reaching it is now a Core defect. Change `NO_RESET_SAID` so it does not blame the task, e.g. "This attempt puts no page back, so this was not done. …". Update the header lines 15-18 to say reruns no longer send one.

### Tests (each beside its subject)

- `runtime/llm/node-tools/tests/step-place.test.ts`. With the flag on:
  - a step started elsewhere returns `in_place`/`forward_run`, and `executeTool` is never called with `replay: "reset"`;
  - a lasting-act rerun also sends nothing and does not go to the Flow's start;
  - `already_there` and `start_page_unknown` are unchanged;
  - with the flag off, every existing case is unchanged.
- `runtime/llm/evidence-loop/tests/rerun-place.test.ts`: in a loop with the flag, a rerun of an earlier step runs once on the current page, its answer carries `rerunPlace.reason: "forward_run"` with `stepStartedOn`, and the draft step records `rerunPlace.kind: "forward_run"`.
- `runtime/llm/evidence-loop/rerun/tests/` (the test for `request.ts`): in forward mode, the `ranAlready` check gets no `at`.
- `runtime/result-verification/build-test/tests/` (landing test): a `forward_run` press with earlier steps before it is not counted as landing in order.
- `framework/automation-service/service/answer-first/tests/endings/tests/rerun-reset.test.ts`: rewrite.
  - Keep: no reset reaches the target, one card press, result reached.
  - Replace "rerun_place_unreachable / answer_first.no_reset was told" with: the rerun's read ran on the moved shelf and its answer says `forward_run`.
- `framework/automation-service/service/answer-first/attempt/tests/call-chain.test.ts`: the backstop still refuses a raw reset, with the new wording.

### Other tasks and sites affected

Every answer-first attempt is affected, on every site, whenever the model reruns a step whose start page is not the current page.

- **Evidence: 19 Lab runs since 2026-11-04 contain `answer_first.no_reset`.** I counted with grep over `lab-runs/2026-11-0*/` and `2026-11-1*/` `steps/index.md`. Among them:
  - run-mw37vz9n, run-mw47woi1, run-mw4b7kav (2), run-mwafor01, run-mwbk0twg (2), run-mwbkuxqt, and this run (2).
  - The sites include company-website, everything-store, local-classifieds, crossborder-marketplace and bigbox-retail.
- **Non-answer-first builds are not changed**, because the flag is off there.

## Defect 2: the repeat guard matched a model call to `rerun.9`

### Root cause

- **What the guard compared.** It keys a call on `toolId` + page digest + "against" + canonical whole input (`runtime/llm/repeat-guard/outcomes.ts:476`). It compared the model's call with the record of `rerun.9` itself, not with `rerun.9.place`.
- **The reset was never in the guard.** `step-place.ts` sends the reset straight to `input.executeTool` (`:252`), not through `runCall`, so the guard never saw it. The brief's "whose input differs" compared against the reset's input.
- **What `rerun.9` was recorded with.** `runCall` records the rerun under its own callId with `input: decision.input` (`evidence-loop.ts:459`).
  - `decision.input` is step 9's input merged with the patch (`evidence-loop/rerun/request.ts`, `automationStudioLlmEvidenceRerunInput`).
  - Step 9 ran as `{ node: "web.output.browser-navigate", parameters: { url: "...LH_Auction=1" }, consequences: [] }` (steps 0024 and 0052). Patched with `{ parameters: { url: "...&_ipg=96" } }`, it is exactly the model's call at 0057 and 0059. `add: true` is not part of the input.
- **Which page it was recorded on.** The page digests were taken after the failed placement (`evidence-loop.ts:409`, `:414`). The page had not moved, so the key's page equals the page the model then called from.
- **The flaw: a rerun that ran nothing was recorded as a failed attempt of its input.** The rerun's answer was the place's refusal (`rerun-check.ts:132`): `ok: false`, `effectApplied: false`. `recorded` therefore stores `outcome: "failed"` under that key (`outcomes.ts:525`, `:552-560`).
  - The input never reached the domain. The refusal says "Nothing was run" (`step-place.ts:383`).
  - The guard already exempts the two other kinds of call that ran nothing of their input: a rerun sent as a check (`checked`, `outcomes.ts:187-197`, early return at `:504`) and a written step (`:199-212`, `:509-512`). An unreachable rerun is the third kind and has no exemption.
- **Reproduction.** I ran the real `automationStudioLlmEvidenceRepeatGuard` with `rerun.9` recorded as the loop records it, then asked about the model's call:
  - `blocks(core.run_node, <0057 input>)` returned `{"callId":"rerun.9","outcome":"failed","resultCode":"llm_evidence_loop.rerun_place_unreachable"}`, the same as steps 58 and 60.
  - `blocks` on the reset's input returned `undefined`.
  - Script: `C:\Users\osrs_\AppData\Local\Temp\claude\bc302d3e1bd85154\1d7e40a9-22b4-41e1-ad74-ba7e457da62b\scratchpad\e1-rerun\guard-repro.ts`.

### Proposed fix (files)

1. `runtime/llm/repeat-guard/outcomes.ts`:
   - Add `unrun?: boolean` to `AutomationStudioLlmEvidenceCallOutcome`: "a rerun whose place could not be reached; its input never reached the domain".
   - Treat it like `checked` at `:504`: it still moves the last page seen and ends a run of looks, but records no outcome under its key.
   - Add a header paragraph citing this run.
2. `runtime/llm/evidence-loop.ts`: keep `place` in scope (it is local to the try at `:408`). At `:459`, pass `unrun: true` when `place?.kind === "unreachable"`.
   - Do not touch the decision-level record. `amendment.ts:282-285` still records `same_amendment`/`rerunFailed` for the identical `amend_draft` on the same draft. That is the right level for "this placement fails the same way again", and it stays.

This fix is needed even after defect 1's fix:

- **Non-answer-first builds still reach `unreachable`.** A reset can fail, a step before can fail to be re-done (`notDoneAgain`), and a lasting act can have no known start. In each case the rerun's input ran nothing.
- **A read rerun is caught the same way.** `rerun.5` would equally have blocked the model's identical read on the 96 page. Its `proposes: true` makes `look` false, so it goes down the same `failed` path.

### Tests

- `runtime/llm/repeat-guard/tests/` (new file, e.g. `unrun-rerun.test.ts`):
  - a call recorded with `unrun: true` and `refused: true` does not block the identical call on the same page;
  - it still updates `state()`;
  - the same call recorded without `unrun` still blocks, so there is no regression to the rule from run-muq310ht.
- `runtime/llm/evidence-loop/tests/rerun-place.test.ts`:
  - a rerun answered `unreachable` (an executor that refuses the reset);
  - followed by the model's plain call with the merged input on the same page;
  - that call runs, and is not refused `repeat_refused` with `sameAsCall` set to the rerun.
- Existing `rerun-check` and `written-call` tests stay green.

### Other tasks and sites affected

Every build that has an unreachable rerun followed by the same call made by hand: all sites, answer-first and not.

- **Evidence: 9 repeat refusals with `sameAsCall: "rerun.N"` in 6 runs since 2026-11-05.** They are in run-mw47woi1 (2), run-mw4coxdn, run-mw4foote, run-mwa19obz, run-mwbk0twg (2) and this run (2). The sites are company-website, everything-store, local-classifieds, crossborder-marketplace, bigbox-retail and auction-marketplace.
- **Why the model makes that call.** Doing the call by hand is the natural next move, and it is what the `answer_first.no_reset` text tells the model to do ("to get to another page, go there"). So in answer-first the two defects compound.
- **Risk to the run.** Three refused repeats in a row end the round. This run reached two.

## Commands run and observed results

- Read `steps/index.md`, and `call.json`, `result.json`, `meta.json` and `decision.json` for steps 0024, 0030-0066, plus the debug note.
- `grep` over Core `src` and the extension `domain/src` for `NO_RESET_CODE`, `rerun_place_unreachable`, `replay === "reset"`, `REPLAY_REACH_KEY`, `rerunPlace` and `forwardRun`.
- `node --experimental-transform-types <scratchpad>/e1-rerun/guard-repro.ts` (Node v22.23.3), run from the Core package directory:
  - `blocks model call: {"callId":"rerun.9","outcome":"failed","resultCode":"llm_evidence_loop.rerun_place_unreachable"}`
  - `blocks reset input: undefined`
  - The two earlier tries failed before running any code: a Windows path as an ESM URL, then strip-only mode not supporting parameter properties.
- `grep -c answer_first.no_reset` over `lab-runs/2026-11-*/*/steps/index.md`: 19 runs.
- `grep -l '"sameAsCall": "rerun\.'`: 9 result files in 6 runs.
- No vitest or tsc was run. Nothing was edited, so there was nothing to type-check.

## Not verified

- **The exact merged `decision.input` for `rerun.9`.** I inferred it from step 9's recorded call (0052) and the patch (0054). The loop's own merge was not executed. The match is consistent with the guard's answer, which needs the inputs to be canonically equal.
- **That the host writes `replay.from` for a call that ran in place.** I took it from the comment at `flow-authoring/draft/dry-run.ts:374`, not from a test.
- **Whether the web host honours Core's `reach` key.** Grep found no reader in `domain/src` or `apps/extension/src`. So it is not proposed as the placement mechanism.
- **The full list of `rerunPlace` consumers.** `landing.ts` is the only one grep found outside `step-place.ts` and `rerun-check.ts:193`, but a type-check after the change would confirm it.
- **The proposed fixes.** Not implemented and not tested.

## Open questions or contradictions found

1. **The brief's framing does not match the evidence.** "The harness's own whole-Flow rerun" is a model `amend_draft` one-step rerun. "Whose input differs" compares with the reset's input, but the guard matched the rerun's own merged input, which is identical to the model's.
2. **Whether "no reset" is the user's words.** D1 is labelled "(user)" in `answer-first-plan.md:102`, but the words "no trial, reset or dry run inside it" may be the lead's gloss. The proposal keeps "no reset" either way. Under the 2026-10-27 rule, a put-back that only navigates is arguably not a "reset" at all. If the user would allow a navigation-only put-back in answer-first, the alternative becomes open again. E1 or the lead should decide; I do not recommend it, for the D2 reasons above.
3. **The existing test asserts the behaviour this report calls the defect.** `answer-first/tests/endings/tests/rerun-reset.test.ts` treats "the rerun runs nothing and says so" as intended. Changing it is a design change to answer-first, not only a bug fix. The lead should confirm before a worker rewrites it.
