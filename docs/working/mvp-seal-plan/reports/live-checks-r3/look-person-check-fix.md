# A look that meets a robot check behaves like an action that meets one

Worker report, t885. Implements sections 2, 4 and 5 (unit level) of `look-person-check-trace.md`, except the `click-landing.ts` change. That change is written below as an exact proposal. No Lab run and no paid call were made.

## Outcome

**Partial.** The code and tests are done, and every test named in the brief passes. Two acceptance checks did not run:

- `pnpm --filter @fluxiq-web-extension/domain check` and `pnpm --filter @fluxiq-web-extension/extension check` both refused because Core's build is stale. As the brief says, I did not work around it.
- So my changes have **no type-check evidence**. The test builds bundle the code but do not type-check it.

Two paths differ from the brief, because the structure audit forces it (see "Deviations").

## What changed and why

### Domain (`domain/src`)

- **`actions/check-wait.ts`**
  - `webAutomationCommandWaitsOutChecks` is now true for a `web.dom.capture_snapshot` that names no frame (`browserFrameId` and `browserFrameUrlPath` absent). So build looks, detections, `find_on_page` / `describe_element` captures, a Flow's snapshot node and a recorded snapshot node all carry `checkWaitMs`. A look with no `timeoutMs` stays without one, so the worker's budget is the full 15 s.
  - A frame-addressed look gets no allowance. The worker never judges a frame's look for a page check, so the allowance would only stretch its 5 s deadline to 20 s.
  - Host state captures (`host-runtime.ts`, dispatched with payload `{}`) and re-acquire never pass through these helpers, so they are unchanged.
  - The header records why (t885, `run-mwaknxf9-7549d126`).
- **`actions/tests/check-wait.test.ts`**: a new case covers a whole-tab look with no timeout, with a tab id, and as a node (20 s), and three frame-addressed looks that stay untouched.
- **`runtime/llm-evidence/capture.ts`**
  - The old comment said "Checks that clear themselves were already waited out by the client". That was false for looks; it now names the allowance and the worker module.
  - `pageRefusal`'s `catch` now keeps the look's mark: `refusal.personNeeded ?? (error instanceof RecoverableToolRejection ? error.personNeeded : undefined)`. Before, an action refused for its own reason, whose page capture then met a check, lost the person-needed signal.
- **`runtime/llm-evidence/system-instructions/instructions.ts`**
  - The version is now `web-13`, with a header line citing `run-mwaknxf9-7549d126`.
  - The old Limits line ("say that one blocks you") is replaced by the lead-approved text, word for word.
  - The text stays within the 3,600-character test.
- **`.../system-instructions/tests/instructions.test.ts`**
  - The version assertion is now `web-13`.
  - The robot-check test asserts the three phrases from section 4, and that "blocks you" is gone.
- **`runtime/llm-evidence/node-run/tests/person-needed.test.ts`**
  - The fake site gains a `<select>` and two fault switches.
  - New case (this run's shape): a `web.output.dom-select` that succeeds, whose after-look fails `USER_INTERVENTION_REQUIRED`, gives `personNeeded`. The select stands as a proposing `mutate` with `ranWith.selector "#sort"` and its replay location.
  - Second new case (covers the `pageRefusal` fix): a press refused `TARGET_NOT_FOUND` whose page capture then meets a check gives `personNeeded`. It keeps its `target_not_found` result code, and its draft names the press.

### Extension (`apps/extension/src/runtime`)

- **New `look-check/judge-look-check.ts`**, with barrel `look-check/index.ts`, exported from `runtime/index.ts`.
  - `judgeLookCheck(action, tabId, startedAt, access)` calls `readLandedPage`, then `settleLandedReading` with `checkWaitBudgetMs(action, startedAt)`.
  - A reading still `robot_check` returns `{ kind: "check_standing", result }`. That is a failed `workerActionResult` whose failure is `navigationChallengeFailure("a page to look at", standingCheckWords("the page looked at", wait))`, with message "The page is a robot check, which only a person can answer."
  - A check that cleared returns `{ kind: "check_cleared", checkWait }`.
  - Anything else (no check, unread) returns `undefined`.
- **`action-runner.ts`**
  - When `actionType === "web.dom.capture_snapshot" && action.checkWaitMs !== undefined && !addressed`, the look is judged **before** `keptLooks.look`.
  - On a standing check: `withTarget(failed, tabId, TOP_FRAME_ID)`. The look is never sent.
  - On a cleared wait: the look runs, and `checkWait` is put on the succeeded result **after** the kept-look store. So a later reuse of that look never repeats a wait it did not make.
- **`tests/action-runner.test.ts`**
  - The chrome stub now answers `fluxiq.pageChallenge` from a per-row `challenges` list and records each question in `challenged`.
  - Five new cases:
    - an allowed look on a person-only page fails `USER_INTERVENTION_REQUIRED` and is never sent;
    - a host look (no `checkWaitMs`) is unchanged and nothing is asked;
    - a frame-addressed look is unchanged and nothing is asked;
    - a self-clearing check that lifts gives the frame's reply plus `checkWait`;
    - a check page kept by a host capture is still judged for an allowed look.
- **New `tests/runner-chrome-stub.ts`**: the existing stub (`installChromeStub`, `runAgainstStub`, `FRAME_REPLY`, `TAB_ID`, `CONNECTION_ERROR`, types), moved out of `action-runner.test.ts` unchanged except for the challenge list. See "Deviations".
- **`look-check/tests/judge-look-check.test.ts`**: five cases.
  - Person-only: the exact record, which also survives Core's parser.
  - Self-clearing that lifts: `waitedMs >= 400` and four asks.
  - Still up at the budget: the `not_cleared` words.
  - Self-clearing that turns person-only: handed over at once.
  - No check, `credential`, and an unreachable frame: `undefined`.

### Core (`!FluxIQ/packages/fluxiq/src`)

**`framework/automation-service/service/answer-first/tests/endings/tests/person.test.ts`** gets two new cases in "a check only a person can clear". No Core source changed.

- **The round's opening look meets a check.** The ask has `timeoutMs: null`, and the attempt shows `waiting_for_person` / `person_only_check`. No decision is asked while waiting. After Continue:
  - the result is reached;
  - there are exactly 2 decisions;
  - `READ_LOANS` ran once;
  - the target's calls start look (check), look (fresh, after Continue), read;
  - decision 1's `core.current_view` top group is `initial.library.look`, holding the cleared page.
- **The model's own look meets a check.** Same pause and ask. After Continue:
  - there are 3 decisions;
  - the `{again:true}` look ran once and `READ_LOANS` ran once;
  - decision 2's top view is `look.checked`, holding the cleared page.

### Deviations from the brief (both forced by the structure audit)

1. **The new module is `runtime/look-check/judge-look-check.ts` (plus barrel), not `runtime/look-check.ts`.**
   - A 26th file in `apps/extension/src/runtime/` failed `directory-files`: `FAIL [directory-files] apps/extension/src/runtime/: 26 source files exceeds the 25-file limit`.
   - Its test is therefore `runtime/look-check/tests/judge-look-check.test.ts`.
   - The brief's filter `runtime/tests/look-check` matches nothing, so I ran `runtime/look-check/tests`.
2. **New test-support file `runtime/tests/runner-chrome-stub.ts`.**
   - With the new cases, `action-runner.test.ts` reached 866 lines: `FAIL [file-lines] ... 866 lines exceeds the 800-line limit`.
   - I moved the shared fake browser out instead of the cases, which belong to the runner. The file is now 695 lines.

One design choice differs from the trace. The trace put the judgment inside `runOnPage` so that a reused kept look "pays nothing". That leaves a hole:

- A host capture (no allowance) of a person-only check page is kept, because the page does not move.
- The next build look would be answered from that kept look and never judged.

So the judgment runs before `keptLooks.look`. It costs one bounded top-frame message per allowed whole-tab look. The test "a check page a host capture kept is still judged..." covers this.

## Commands run and observed results

Each exit code was read; logs are in my scratchpad.

- `cd domain && DOMAIN_TEST_BUILD_LABEL=t885-look node scripts/test-domain.mjs actions/tests/check-wait runtime/llm-evidence/node-run runtime/llm-evidence/system-instructions`
  - Final run: exit 0, `# tests 597 # pass 597 # fail 0`.
  - The first run had 1 failure. My refused-press test assumed `proposes: false`, but the domain's existing `personDraft` stands a press whose command went out as proposing, as "a press that meets a robot check" already shows. I corrected the test, not the code.
- `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=t885-look node scripts/test-extension.mjs runtime/look-check/tests runtime/tests/action-runner`
  - Final run, after the stub move: exit 0, `# tests 49 # pass 49 # fail 0`.
  - The first run failed 2: I had expected 3 frame asks for a check that lifts, and it is 4. I fixed both expectations.
- Core: `cd packages/fluxiq && npx vitest run src/framework/automation-service/service/answer-first/tests/endings` → exit 0, `Test Files 16 passed (16)`, `Tests 85 passed (85)`.
- `node scripts/structure-audit.mjs` (extension root) → exit 0, `structure-audit: passed (244 warning(s), 552 baselined)`.
- Core `pnpm structure:check` → exit 0, `structure-audit: passed (539 warning(s), 1095 baselined)`.
  - The first run failed `statement-packing` at `person.test.ts:199`, a one-line `{ asked = requests; return provider; }`. I split it.
- `pnpm --filter @fluxiq-web-extension/domain check` → exit 1, refused before compiling: "FluxIQ Core's build at C:\Users\osrs_\FluxStuff\fxwork\t885\!FluxIQ is not current with its source. Stale: Core's build cache would rebuild fluxiq:build: inputs changed: packages/fluxiq." **Not worked around.**
- `pnpm --filter @fluxiq-web-extension/extension check` → exit 1, the same refusal. **Not worked around.**

### Revert checks

**Domain.** I reverted the capture_snapshot allowance, the `pageRefusal` mark and the system text to HEAD, then ran check-wait, person-needed and system-instructions. Exit 1, `# tests 37 # pass 33 # fail 4`:

- `a look at the whole tab is given the allowance; ...`
- `a refused press whose page is then a robot check needs a person and keeps its refusal`
- `the version is one Core's seam accepts, ...`
- `a robot check is never touched, ...`

The fixes were restored and the diff confirmed.

- The **select case passed with the domain fixes reverted.** That is expected: it pins the domain's existing mapping of an after-look `USER_INTERVENTION_REQUIRED` for this run's shape (the brief asked for it). The fix it depends on is the extension's: a look now answers `USER_INTERVENTION_REQUIRED` at all. A domain-only revert cannot fail it.

**Extension.** I disabled the runner's judgment (`false && ...`) and short-circuited `judgeLookCheck` to `undefined`. Exit 1, `# tests 49 # pass 41 # fail 8`:

- all 5 look-check cases;
- the runner's person-only, self-clearing and kept-look cases.

The host-look and frame-addressed cases pass either way, by design: they assert nothing changes. Both files were restored.

**Core.** The Core cases need no fix; they lock section 3's "already works". As a sensitivity check, I removed `personNeeded: true` from the fake look's answer. Both new cases failed (no ask came, about 69 s each, exit 1). Restored.

## Proposal: the `click-landing.ts` change (held by another lane, not applied)

Against `apps/extension/src/runtime/click-landing.ts` at `70eaa7d61`, in `sendStateCheckingLanding`:

```diff
   const noun: ActNoun = action.actionType === "web.dom.select" ? "choice" : "check";
   const watch = watchTopFrameNavigation(tabId);
   try {
     const pressed: PressedPage = { url: await readTabUrl(tabId), pace };
+    let reply: BrowserActionResult;
     try {
-      return await send();
+      reply = await send();
     } catch (error) {
       // Undelivered, the act never reached the page; refused otherwise, it is
       // the act's own failure. Neither is the navigation's doing.
       if (!unloadedUnderDeliveredMessage(error)) throw error;
       const verdict = await judgeLanding(action, tabId, watch, access, pressed, noun);
       if (verdict === undefined) throw error;
       if (verdict.kind === "failed") {
         const failed = workerActionResult(action, watch.startedAt, verdict.outcome);
         return verdict.wait ? clickAfterClearedCheck(failed, verdict.wait) : failed;
       }
       const state = await readRequestedState(action, tabId, access);
       const read = workerActionResult(action, watch.startedAt, requestedStateOutcome(noun, state));
       return verdict.kind === "check_cleared" ? clickAfterClearedCheck(read, verdict.wait) : read;
     }
+    if (reply.status !== "succeeded") return reply;
+    // A reply that arrived came from the document the act ran in, and says
+    // nothing of where the page went next (t885, `run-mwaknxf9-7549d126`: a
+    // sort answered "Option selected." from the old page, which then committed
+    // onto a robot check). So a navigation that commits is judged as a press's
+    // is; a choice whose own document saw none begin waits for none.
+    const startWindowMs = pageSawNoNavigation(reply, watch) ? 0 : NAVIGATION_START_GRACE_MS;
+    const verdict = await judgeLanding(action, tabId, watch, access, pressed, noun, startWindowMs);
+    if (verdict === undefined || verdict.kind === "stood") return reply;
+    if (verdict.kind === "failed") {
+      const failed = failedClick(reply, verdict.outcome);
+      return verdict.wait ? clickAfterClearedCheck(failed, verdict.wait) : failed;
+    }
+    return clickAfterClearedCheck(reply, verdict.wait);
   } finally {
     watch.stop();
   }
```

**The file comment, lines 67-71.** Replace "but only for a reply lost to that navigation, and only in the top frame: a check or choice that answered is judged by its own read-back, and pays nothing here." with: "in the top frame only. A reply that arrived is judged by its landing too, since it came from the old document: one whose own document saw no navigation begin waits for none (`pageSawNoNavigation`), so a choice that navigates nowhere pays nothing; a reply lost to the navigation is judged by the landing and then by the requested state, below."

Update the function doc above `sendStateCheckingLanding` the same way: "A reply that arrives is its own verdict" becomes "A reply that arrives stands unless the landing that followed speaks against it".

**Companion in `domain/src/actions/check-wait.ts`.** Add `web.dom.select` and `web.dom.check` to the allowance in `webAutomationCommandWaitsOutChecks`: `if (outputId === "web.dom.select" || outputId === "web.dom.check") return true;`, and extend `check-wait.test.ts`.

- I did **not** apply this. It is only meaningful with the landing change, which the other lane holds.
- I did not audit whether the content-side select/check paths read `action.timeoutMs` directly. The press recovery budget uses `webAutomationBaseTimeoutMs`, which is safe. A select path that reads `timeoutMs` raw would gain 15 s on its own waits.

**Tests for `tests/click-landing-state.test.ts`:**

- a select whose reply arrives `succeeded`, and whose top frame then commits onto a person-only check, fails `USER_INTERVENTION_REQUIRED` with "the choice was made, and ...";
- a self-clearing landing gives the reply plus `checkWait`;
- a reply carrying `navigation: { began: false }` with no `onBeforeNavigate` returns at once, with no 300 ms grace.

**Caveat.** `pageSawNoNavigation` needs the reply's `navigation` report (`content/actions/execute.ts:197`). It is absent where the page has no Navigation API (`navigation-watch/watch.ts:39`). There every succeeded select or check would pay the 300 ms start grace, as a click already does.

## Not verified

- **Types.** Both package `check`s refused on Core's stale build, and the test bundles do not type-check. A type error in any changed file would not have surfaced. Run both checks once Core's libraries are rebuilt.
- **Live or browser behaviour.** All proofs are unit level, with fakes for the tab and frame. I did not prove that a real `fluxiq.pageChallenge` answer on a real check page reaches `judgeLookCheck` before the look.
- **Surfacing a look's `checkWait`.** I did not check whether the domain reports a look's `checkWait` as `clearedWait` on the node-run result for a snapshot node (`node-run/cleared-wait.ts` reads it off the command's payload). Nor did I check whether Core shows it for a look.
- **The `pageRefusal` change, end to end.** Only the domain unit case covers it. When the refused action had acted, the press stands as proposing; that is the domain's existing `personDraft` rule, not new behaviour.
- **Core's command deadline** for an allowed look with no `timeoutMs` (the trace's open point). The 15 s worker wait assumes Core's default command deadline is longer.
- **The Core endings run** used the whole `endings` directory only, not Core's full vitest.

## Open questions or contradictions found

1. **The brief's path broke the structure audit** (26 files in `runtime/`). I moved the module into `runtime/look-check/`. If the lead prefers a flat file, something else in `runtime/` must move first, for example grouping `landed-challenge.ts` and `landed-check-wait.ts`.
2. **Judging before the kept look, not inside `runOnPage` as the trace said.** This closes the hole where a host capture kept a check page, at about one top-frame message per allowed look. The trade is made here; the lead may weigh it differently.
3. **The extension acceptance filter.** The brief's `runtime/tests/look-check` matches nothing after the move. Use `runtime/look-check/tests`.
4. **The checkouts are shared with other lanes.** The extension tree carries the parallel worker's `apps/scenario-lab/**` and `packages/test-runner/**` edits. Core carries uncommitted edits under `answer-first/rows/` and `result-verification/flow-less/`, which are what make Core's build stale. None of these are mine.
