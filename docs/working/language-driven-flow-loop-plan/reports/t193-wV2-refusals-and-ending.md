# t193-wV2: refused edits in the chat, and the failed build's ending

Worker t193-wV2, 2026-10-02. Brief: "t193-wV2-refusals-and-ending". Trees: Core `fxwork/t193/!FluxIQ`, downstream
`fxwork/t193/!FluxIQWebExtension`. `R/` = Core `packages/fluxiq/src/programs/automation-studio/runtime/`. Evidence
read from the t195 tree (read only): debug `run-murdouox-c5294247.md` (UI review), screenshots 05 and 09, step logs
`S/0033`-`S/0036`. Nothing was committed. No Lab run, no browser, no provider call.

## Outcome

**Done for U1 and for the parts of U2 this brief owns.** The rest of U2 is in files I may not edit. For those, the
exact text and a plain replacement are listed below.

- **U1.** The chat no longer shows an edit to the draft as work done when Core refused it. The card now says
  "Didn't change the Flow" or "Didn't run the step again", gives the reason in plain words, and then says what the edit
  meant to do. I made the change in `R/activity/**` only. `R/llm/**` and `R/flow-draft/**` are unchanged.
- **U2, create-here.** When a build fails, the ending no longer says "Before that I created the Flow ... and saved
  what it should do". It now says what is left: `What is left: the Flow "<name>", empty, with what you asked saved on
  it, so it can be built again.`
- **U2, extension.** The line "FluxIQ attached something you can see in FluxIQ. Open FluxIQ" is removed.

## What changed and why

### U1: how a refused edit reached the chat as work done

- `observer.ts` emitted the decision's `thought` as soon as `decide` returned. Its title came from
  `wording/decision.ts`, so every `amend_draft` read "Updating the draft Flow".
- The loop applies the edit later, inside `R/llm/decision-handlers/amendment.ts`. No tool call is involved, so the
  observer never saw the edit's result.
- The refusal does reach the observer, on seams it already wraps:
  - The next `decide` request carries the refusal as evidence:
    - `core.amendment_check.<iteration>`, with `applied` and `refused[].reason`. It is written by `amendment.ts`
      `tell`.
    - `core.repeat_check.<iteration>`, written by `refused-repeat.ts` when a rerun is refused by the repeat guard.
    - In step `S/0034`'s request I confirmed `core.amendment_check.17` with
      `refused: [{step: 14, reason: already_so}]` and `applied: 0`.
  - The next `executeTool` is a `rerun.<step>` call, which means the edit landed.
  - A round that stalls calls `unusableDecisions.stalled`. Its trace row for that iteration carries
    `amendmentsRefused`, or `resultCode: llm_evidence_loop.repeat_refused` with `resultReason`.

### U1: the fix

- New `R/activity/draft-edit.ts` (`automationStudioActivityDraftEdit`):
  - It holds an `amend_draft` decision's card until the loop answers on one of those three seams, then says it
    once.
  - If the edit landed, the card is unchanged ("Updating the draft Flow" with the model's reason).
  - If the whole edit was refused, the card is the refusal (status `failed`). This covers `applied === 0`, an edit
    that put the draft back as it was, and a repeat-guard refusal.
- New `R/activity/wording/draft-edit-refused.ts` (`automationStudioActivityDraftEditRefused`):
  - It has a plain reason for every `AutomationStudioFlowDraftAmendmentRefusal["reason"]`. The map is typed as a
    `Record`, so a new reason fails to compile until it has words.
  - It also words each repeat outcome: `failed`, `changed_nothing`, `same_result`, `same_answer`.
  - The card never shows a code.
  - Example card: title "Didn't change the Flow", text "The Flow already does that, so this was not done: adding the
    repeat over the qualifying requests so the Flow confirms each of them."
  - A rerun refused `changes_nothing` reads "Didn't run the step again", with "That step already ran exactly this
    way, and running it again would give the same result, so this was not done: rerunning the request listing ...".
- `R/activity/observer.ts` changes:
  - `decide` settles the held edit from `request.evidence` and holds a new `amend_draft`. Every other decision's
    card is unchanged and still immediate.
  - `executeTool` settles the held edit as landed.
  - `unusableDecisions.stalled` is wrapped: it settles from the trace, then returns the original's value.
- Barrels: `wording/index.ts` and `activity/index.ts` export the new wording function.
- Tool-call decisions are left as they were (still said immediately). A tool call the repeat guard refuses still shows
  its card with no tool row after it. This brief did not cover that case.

### U2

- **`R/conversations/commands/create-here.ts`:**
  - The build-failure branch now goes through a local `emptyFlowLeft`. It swaps the "Before that I created the Flow
    ... and saved what it should do." sentence for the plain "What is left: ..." sentence.
  - The cause and the locked-key sentence are kept.
  - The save-failure, permission and apply branches are unchanged. In those cases "Before that I created ..." is true
    and is followed by work that did happen.
- **Extension `apps/extension/src/panel/chat/view/message-view.ts`:**
  - The attachment line is removed.
  - Every attachment kind Core writes is Core's own record of a command (`panel-capability`,
    `panel-capability-result`, `conversation-command`). The turn's words already say what happened, and Core's own
    panel draws none: `apps/web/.../conversation/thread/panel-records.ts` says "Neither is anything to draw".
  - So there is nothing to name, and the brief allows "or not appear".
  - `CoreTurn.attachment` is removed. It is no longer read anywhere, so leaving it would have been dead data.
    Removed from: `conversation/core-thread.ts` (type and parse), `view/thread-view.ts` (signature),
    `stream/stream-items.ts`, the `chat-panel.ts` comment, and the test helpers `stream-items.test.ts`,
    `turn-clock.test.ts` and `thread-view.test.ts`.
  - The `live-run-display.test.ts` fixture answer now uses the new Core ending.

## Commands run and observed results

**Failing-first runs:**

- Core, `heavy.sh npx vitest run .../activity/tests/observer.test.ts` with the new tests and before the observer
  change: `Tests 4 failed | 17 passed (21)`.
  - "says an edit that landed ...": `expected [ [ 'Updating the draft Flow', …(2) ] ] to deeply equal []`.
  - "says the edit the round stalled on ...": expected "Didn't change the Flow", received "Updating the draft Flow".
  - The refused and rerun cases failed the same way.
- Core, `heavy.sh npx vitest run .../commands/tests/execute.test.ts` with the new expectation and before the fix:
  `Tests 1 failed | 10 passed (11)`. The failure was `expected '"Create an automation here" stopped b…' not to contain
  'Before that I'`, received `... Before that I created the Flow "Kettles" and saved what it should do. Your model key
  is locked ...`.
- Extension, my scoped runner over `panel/chat/view`, before the fix: `not ok 16 - an answer carrying Core's record of
  the command it ran shows no attachment line`, `1 !== 0` (one `chat-note`); `# tests 16`, `# pass 15`, `# fail 1`.

**After the fixes:**

- Core `heavy.sh npx vitest run src/programs/automation-studio/runtime/activity`: `Test Files 16 passed (16)`,
  `Tests 149 passed (149)`.
  - The first run after the change failed 1 test: the old test "says building for a draft edit ..." expected the
    edit's card straight after `decide`.
  - I updated it so a second `decide` settles the edit. The rerun then passed.
- Core `heavy.sh npx vitest run src/programs/automation-studio/runtime/conversations/commands`: first run 1 failed,
  then `Test Files 4 passed (4)`, `Tests 27 passed (27)`.
  - The failure was `extension-chat.test.ts` "says the key is locked, and how far it got", which matched
    `/created the Flow/`.
  - I updated it to match `What is left: the Flow "...", empty` and not "Before that I created the Flow".
- Core `packages/fluxiq` `heavy.sh npx tsc --noEmit -p .`: exit 0.
- Core root `node scripts/structure-audit.mjs`: `structure-audit: passed (218 warning(s), 349 baselined).`, exit 0.
  None of its warnings are about my files.
- Core root `node scripts/docs-reference.mjs --check`:
  - First run: exit 1, "framework-reference.md is stale". The new export, and wY's earlier edits, were not in it.
  - I regenerated with `node scripts/docs-reference.mjs`.
  - Then `--check`: "Deterministic framework reference is current.", exit 0.
- Extension `apps/extension` `npx tsc -p tsconfig.json --noEmit`: exit 0. `npx tsc -p tsconfig.test.json --noEmit`:
  exit 0.
- Extension tests, using a scoped copy of `scripts/test-extension.mjs`:
  - Copy at `<scratchpad>/t193-wV2-test-extension.mjs`, label `t193-wv2`, scopes `panel/chat,shared/activity`.
  - Result: `# tests 241`, `# pass 241`, `# fail 0`.
- Downstream root `node scripts/structure-audit.mjs`: `structure-audit: passed (157 warning(s), 118 baselined).`,
  exit 0.
- I did not rebuild the Core libs. The extension does not import anything I changed; it reads Core's output at
  runtime.

## Not verified

- I did not see the new cards live: no Lab run, no browser.
- The evidence-based settling is checked against one real request (`S/0034`, `core.amendment_check.17`). It is not
  checked against a live stall.
- **Known gap: an edit at the very end of a round may get no card.**
  - This happens when the round's last decision is an edit and the round then ends some other way than a stall, for
    example its budget runs out or `end(...)` is reached without `unusableDecisions`.
  - No wrapped seam reports the outcome, so that edit is never said. This is deliberate: a card that might claim
    refused work is worse than none.
  - Hook that would close it, in `R/llm/**` (not mine): an optional `observeRow?(row: AutomationStudioLlmEvidenceLoopTrace)`
    on `AutomationStudioLlmEvidenceLoopInput`, declared in `R/llm/loop-configuration.ts`.
  - It would be called from the trace recorder's `record` (`R/llm/evidence-loop.ts:185`,
    `const recordRow = rows.record`).
  - With it the observer could settle every edit from its own row (`amended`, `amendmentsRefused`, `resultCode`).
    The evidence and stalled paths could then go.
- Core `apps/web` was not touched or run. The web panel uses the same Core thought rows, so it gets the new refusal
  cards with no change.
- The `packages/test-runner` fixture still uses the old ending sentence. It is only a fixture: nothing in
  test-runner source parses the phrase, which I checked with grep.
  - `packages/test-runner/src/flow-lane/creation/chat/tests/build-from-chat.test.ts:85` and `:137` (the assertion
    `/Before that I created the Flow/`).
  - Not mine. Update it to the new sentence when convenient.

## Wording in files I may not edit: file:line, current text, plain replacement

1. `R/flow-bootstrap/unfinished-build/not-doable.ts:53`, the ending's opening line.
   - Current: `I could not build this Flow, and I found no way to: ${what}`.
   - When `what` is the stop (no judge, no checklist), it reads "...no way to: the Flow could not be finished: too many
     of its decisions in a row could not be used, because the model kept ...".
   - Replacement: `I could not build this Flow: ${what}`. Write the stop clause (item 3) in the first person, as below.
2. `R/flow-bootstrap/unfinished-build/not-doable.ts:52`, the `tried` sentence.
   - Current: `I tried ${n} times live -- exploring, then one repair after testing what I had -- over ${decisions}
     decisions, and the last repair ${last}.`
   - `:72-73` gives `last` its "no more of the ${asked} things you asked had a step (${done}, as before)".
   - Replacement: drop the decision count and the dashes, e.g. `I tried twice: once building it, and once fixing it
     after a test run. The second try got no further than the first.`
   - `noRouteSaid` (`:66-84`) should say one plain fact, e.g. `it still did only ${done} of the ${asked} things you
     asked` or, for asked 1, `the one thing you asked still has no step that works`. It should not be a
     semicolon list of ("it handed back the same Flow; no more of ... (1, as before); its test still failed at 1
     step").
   - The plural fix is the t195 lane's (debug U2).
3. `R/flow-bootstrap/unfinished-build/not-done.ts`, the stop clauses:
   - `:42` `unusable_decisions: "too many of its decisions in a row could not be used"` → `"I kept trying changes that
     could not be used"`.
   - `:71` `"the model kept asking for changes to the Flow that changed nothing"` → `"I kept trying changes the Flow
     already had"`.
   - `:73` `"the model kept trying again what had already failed or changed nothing"` → `"I kept retrying steps that
     had already failed or changed nothing"`.
   - The other `BLOCKED_WORDS` entries that say "the model" (`:67`, `:69`) need the same treatment.
4. `R/flow-bootstrap/unfinished-build/phases.ts:325`, the mid-build "Testing the Flow so far" text.
   - Current: `The build stopped before the Flow was finished: ${stopSaid}. Running the Flow as far as it got from its
     start, to judge what it does and what is left.`
   - Replacement: `I stopped building because ${stopSaid}. Now I'm running what I have from the start, to see what
     works and what is left.` (with item 3's first-person clauses).
5. Not in the brief's forbidden list, but not in my owned list either, so I left them:
   - `R/conversations/commands/progress.ts:31` builds `"${title}" stopped because ${cause}.`
   - `R/conversations/commands/build.ts` uses `automationStudioConversationCallCause` (`progress.ts:48`), which
     builds `${what} could not finish. ${ending}`.
   - Together they give `"Create an automation here" stopped because the build could not finish. I could not build
     this Flow, ...`, which says the failure three times.
   - Replacement: when the build carries an ending message, use it alone as the answer's opening. For example, in
     `automationStudioConversationCallCause` return the ending, and let `progress.failed` drop its
     `"<title>" stopped because` lead for it.

## Open questions or contradictions found

- The brief says to "never claim the Flow was created". The Flow does exist after a failed create: it is created
  empty before the build. The new sentence says that plainly ("the Flow ..., empty, with what you asked saved on it").
  It does not deny the Flow exists. If the intent was to delete the empty Flow on failure, that is a behaviour change
  this brief did not ask for.
- Core's working tree already had uncommitted changes from earlier workers in files I also edited:
  - `activity/observer.ts`, `activity/index.ts`, `wording/index.ts`, and the two `framework-reference.md` files.
  - On the extension side, `card-words.test.ts` and `action-card-view.test.ts` were already modified and I did not
    touch them.
  - My edits sit on top of those changes. The supervisor's commit will include both.
