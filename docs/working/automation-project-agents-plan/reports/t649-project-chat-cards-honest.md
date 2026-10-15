# t649 project-chat-cards-honest: worker report

## Outcome

Done, with one caveat. All five defects from section 8 of the
`run-mv9zn5ob-d929084d` debug are fixed inside the paths this brief owns, and
each one has a test. The caveat is defects 1, 3 and 5. Their deepest cause is in
Core files outside my ownership, so the fix is the person-facing reading in the
extension. The Core change each one needs is listed under "Open questions".

## What changed and why

1. **A refused submission was drawn as a green "Done" (00012).**
   - Cause: Core's observer only recognises a candidate build's own tools
     (`runtime/activity/candidate/result.ts`, `SUBMIT_CANDIDATE` and
     `TEST_CANDIDATE`). A project builder's `core.submit_subflow` that came back
     `ok: false` therefore ends with status `succeeded`. Its code
     (`flow_bootstrap.evidence_completion_parameters_unresolved:…`) also has no
     failing word in it, so the observer's `outcomeOf` and Core ui's `FAILING`
     both read it as "done". `subflow.scope_refused` contains "refused", which is
     why the row above it read "Didn't work".
   - Fix: new `apps/extension/src/shared/activity/declined-submission.ts`. A
     `core.submit_*` row is read as declined when it has ended, carries a result
     code and Core gave no `Said:`, `Declined:` or `Changed:` words. Core attaches
     a result code to a submission only when it refuses it
     (`flow-bootstrap/candidate/submission-refusal.ts`). The words are "some
     steps weren't written in a way the Flow can run", or "it was the same as the
     steps already sent, sent again unchanged" for an `…unchanged…` code.
   - `stream/step/action-card.ts` uses it as the card's `refused` when Core gave
     no refusal of its own, so the card reads "Not done: …" with a neutral mark.
     `shared/activity/wording.ts` (`submissionOutcome`) gives the status line the
     same words. Both kinds of refusal now read "Not done".
2. **The rewording garbled the model's words ("via a list reading the list").**
   - In Core `wording/person-words.ts`, a new `MODIFIED_EXTRACTION` rule runs
     before the bare-`EXTRACTION` rule. When "extraction" follows a noun that
     says what is read, it becomes that noun's read: "a list extraction" reads
     "a list read", and "a text extraction step" reads "a text-reading step".
   - `LIST_HANDLE` also accepts a leading "list ", so "the list extraction
     handle" reads "the list".
   - Bare "extraction" and "the extraction" read as they did before.
3. **Codes and ids on the "Return" and "Couldn't build" cards (00008).**
   - New `stream/step/return-reason.ts` (`returnReason`). `project-words.ts`
     uses it for the return message's text. The reason Core sends is written for
     the supervisor, and this turns it into plain words:
     - The dispatcher's "Brief X for subflow K, which this subflow starts after,
       ended …" becomes "It starts after <part name>, which couldn't be built
       (was only partly built), so it was never started". The "Subflow K … is
       not in this dispatch" form gets similar wording.
     - "The builder failed: Flow Bootstrap generation failed (<code>)" becomes
       words chosen by the code. For example,
       `…repeat_without_progress` becomes "The builder kept trying without
       getting any further, so it was stopped".
     - "The builder ended this brief blocked:" becomes "The builder stopped:",
       followed by the builder's own words.
     - Subflow keys with underscores are replaced by their names, and brackets
       holding only codes are removed (`withoutRawCodes`, now exported from
       `panel/chat/format/index.ts`).
     - Any sentence that still names a dotted id, a snake_case token or
       `brief-N` is dropped. If nothing is left, the message has no text.
   - A return with 0 calls, 0 trials and $0 spent now shows "Not started" on its
     card instead of "Spent $0.00 · 0 calls · 0 trials".
4. **A waiting brief showed "Building … / Allowance $0.08" though it never ran
   (00004).**
   - New `stream/step/brief-wait.ts` (`waitingBriefWords`) and a `seen(event)`
     hook in `project-message.ts`, which `messages.ts` calls for every event.
   - A brief dispatched while another brief is still open waits until the first
     event from its own builder (agent `briefId` matches, role is not supervisor).
     While it waits it reads "Cart waits for Search: <purpose>", with a neutral
     card "Build · Cart / Waits for Search". If several briefs are open it reads
     "Waits for its turn".
   - It switches to the normal "Building … / Allowance" card once its builder
     speaks. If its return arrives while it is still waiting, its card reads
     "Not started".
5. **The failure toast gave no reason (00048).**
   - New `background/activity/supervisor-ending.ts` (`SupervisorEnding`), used
     by `pacer.ts`. It keeps each unit's last supervisor thought titled
     "Checking whether the Flow is finished". That text is Core's screened
     reason, which the chat already shows. Any later supervisor decision
     replaces it, and a reason containing an id is not kept.
   - It is attached only to the final `failed` row whose title or label says
     "supervisor ended". The toast then reads "Build failed: the supervisor
     ended it because it could not finish the Flow. <Reason>." That ending is
     capped at 280 characters; other details keep the 160 cap.
   - Endings that already give their own reason (time limit, budget) are left
     unchanged.
6. **Documentation:** `docs/architecture/extension-client.md` now covers the
   waiting brief, the return reason, "Not started", the declined submission and
   the supervisor's reason on the ending.

## Commands run and observed results

- `node scripts/test-extension.mjs background/activity/tests shared/activity/tests panel/chat` (from `apps/extension`) printed `# tests 526`, `# pass 526`, `# fail 0`. The new tests that ran and passed:
  - "a submission of steps Core refused is never drawn as done"
  - "a submission that came back under a refusal's code was not taken, in words"
  - the status-line test in `declined-submission.test.ts`
  - the four `return-reason.test.ts` tests
  - "a brief dispatched while another is out waits for it by name, until its own builder starts"
  - the three `supervisor-ending.test.ts` tests
- `node scripts/check-extension.mjs` (from `apps/extension`) exited 0 with no output.
- `pnpm structure:check` (downstream) printed `structure-audit: passed (196 warning(s), 639 baselined)`. Two of the advisory warnings involve my changes:
  - `shared/activity/` now holds 16 files, past the advisory 15, because of `declined-submission.ts`.
  - `pacer.ts` is 429 lines, past the advisory 400 (it was 410 before).
- Core, `npx tsc -p tsconfig.json --noEmit` (from `packages/fluxiq`) exited 0.
- Core, `npx vitest run src/programs/automation-studio/runtime/activity` printed `42 passed (42)` test files and `368 passed (368)` tests. That includes the new "extraction after a noun" tests in `person-words.test.ts`.
- Core, `node scripts/structure-audit.mjs` printed `structure-audit: passed (378 warning(s), 1156 baselined)`.

## Not verified

- No live run, as the brief says. Nothing was checked in a browser: not the Chrome/Edge side panel, not the Firefox popup, and not the overlay toast.
- I did not confirm that the content overlay shows a 280-character ending in full. It fits lines on its own (`content/activity-overlay/fit-lines.ts`, which I do not own).
- The waiting-brief wording is an inference, because Core's brief card names no predecessor. Two independent briefs dispatched together would show "waits for …" for the few milliseconds before the second builder's first event.
- The status line can still show "Building Add pickup items to cart" for a moment, from the waiting brief's own note row (`label`). Only the chat card says it waits.

## Open questions or contradictions found

These are the Core changes that would fix the cause at the source. None of them
is in `project-agents/**`, and none is in a path I own.

1. **Defect 1.** Core `runtime/activity/candidate/result.ts`,
   `automationStudioActivityCandidateResult`, should also treat
   `core.submit_subflow` like `core.submit_candidate`, and `core.test_subflow`
   like `core.test_candidate`. A subflow builder's refused submission would then
   end `failed` with `Declined: <reasons>`, in the same words the candidate
   build uses (`candidate/submission-words.ts`). Core ui `action-of.ts`
   (`submitted = detail.ref === SUBMIT_CANDIDATE`) should accept the subflow
   tool too. Once that lands, the extension's `declinedSubmission` stays
   inactive, because Core's `Declined:` takes precedence.
2. **Defect 3.** Core `runtime/activity/project/return-card.ts` passes
   `returned.reason` (the supervisor-facing text) to the card's `reason` and the
   row's `text`. It should send a person-facing reason, in words with no
   codes, call ids or brief ids. The Core panel (apps/web) still shows the raw
   text today.
3. **Defect 4.** The brief card (`runtime/activity/project/brief-card.ts`,
   wire type `ClientGatewayActivityProjectCard`) should carry the subflows it
   waits for in this dispatch, for example `after: [subflowName]` from
   `automationStudioProjectDispatchDependencies`. The chat could then say "waits
   for X" without inferring it.
4. **Defect 5.** Core `service/project-build/run.ts` ("never its reason, which
   holds the model's") and `conversations/commands/progress.ts`
   (`SUPERVISOR_ENDING_WORDS`) leave the supervisor's recorded reason out of the
   ending. The extension now supplies the screened reason the chat already
   showed. If Core should own this, the ending row would carry the screened
   reason itself.
5. Separately, the debug notes that the supervisor's reason in this run was
   itself misleading: it called the task impossible when the build had dropped
   the store switch. The toast now repeats that reason faithfully. Fixing the
   plan (debug fix 1) is out of this brief's scope.

## Round 2

### Outcome

Partial. Defects 1, 2 and 3 are now fixed at their Core source, and the
waiting-brief wording (defect 4) is now stated by Core. For the failure toast
(defect 5), Core now writes the reason on the row that announces the
supervisor's ending, but the build's last row still has none. The toast takes
the reason from that announcement row, or falls back to the supervisor's
finishing decision. Getting the reason onto the last row needs a change under
`flow-bootstrap/**`, which this brief does not let me touch (see "Open
questions").

### What changed and why

1. **Refused submissions (defect 1).**
   - Core `runtime/activity/candidate/result.ts` now reads every
     `core.submit_*` and `core.test_*` answer, not just the candidate build's
     own tools.
   - A `subflow.trial_*` refusal is read under the matching
     `candidate.trial_*` code, so it gets the candidate gate's words.
   - A refused `core.submit_subflow` therefore ends `failed` with
     `Declined: <Core's reasons>`. For the run's refusal that reads "some
     steps point at things that weren't seen on the page; 2 things to fix".
   - The extension's `declinedSubmission` is now a safety net only. I took
     "rows that carry no status" to mean rows without Core's own account of
     how the call went (`Said`, `Declined` or `Changed`). Every tool row Core
     sends does carry `detail.status`, so a literal reading would never fire.
     A new card test checks that Core's `Declined:` words win.
2. **Return card reason (defect 3).**
   - New Core `runtime/activity/project/return-words.ts`
     (`automationStudioProjectReturnWords`). `return-card.ts` uses it, so the
     card's `reason` and the row's `text` are person words. The supervisor
     still reads the raw reason in the build record and the dispatch answer.
   - It handles each dispatcher form:
     - a brief that never started because its predecessor did not pass:
       "It starts after <plan name>, which couldn't be built, so it was never
       started";
     - a predecessor in no dispatch, a ring of waits, or a build stopped
       before the brief's turn;
     - a builder its loop stopped: "The builder couldn't finish: <words for
       the code>";
     - the builder's own ending: "The builder stopped: <screened words>".
   - Any other sentence is kept only if it names no code, call, key or brief
     id, and is then screened by `reason-text`. If nothing is left, it falls
     back to the outcome in words. The wire requires a non-empty `reason`.
   - The code-to-words table moved, unchanged, from
     `conversations/commands/progress.ts` to Core
     `activity/wording/failure-code-words.ts`
     (`automationStudioActivityFailureCodeWords`). `progress.ts` now imports
     it, so the chat ending and the return card share one table.
3. **Brief predecessors (defect 4).**
   - The wire contract `ClientGatewayActivityProjectCard` brief gains
     `after?: string[]` (contracts `client-gateway.ts`, with its doc). It
     carries the plan's names of the subflows the brief starts after, from
     `brief.entry.predecessors`.
   - `brief-card.ts` always sends it, as an empty list when there are none.
     So "absent" can only mean an older Core.
   - The hub's `project-card-bounds.ts` keeps it, an empty list included, as
     strings of at most 160 characters, at most 20 of them.
   - Downstream:
     - `shared/activity/project/project-card.ts` reads `after`.
     - `project-message.ts` waits only for a part named in `after` that is
       still open, by name ("waits for A and B" for two). A brief beside one
       it does not start after is not shown waiting.
     - Without `after` (older Core), the round-1 inference applies.
     - `brief-wait.ts` now takes a list of names.
   - Core does not say whether a predecessor is still being built; the chat
     can see that from which briefs are still open. A subflow passed in an
     earlier dispatch is not waited on, and the chat does not treat it as
     open.
4. **The build's ending reason (defect 5).**
   - Core `service/project-build/run.ts`, `toldEnding`: the row titled "The
     supervisor ended the build: it could not finish the Flow." now carries
     why, then what is left. Why is the recorded reason with Core's own note
     removed from its end (the record stores that note after the model's
     words), screened by `automationStudioActivityReasonText` to 240
     characters. A time limit keeps its own words. The header comment that
     said the reason is never shown is rewritten.
   - Extension `supervisor-ending.ts` now prefers that row's words for the
     toast: "Build failed: …. <reason>. Nothing this build did is still on
     the target.", capped at 360 characters. It falls back to the finishing
     decision's reason only when Core sent no such row with words.
5. **Documentation:**
   - Core `docs/architecture/automation-studio/client-gateway.md` covers
     `after` and the person-facing return reason.
   - Downstream `docs/architecture/extension-client.md` covers the ending
     row, `after`, Core's own return words and the safety-net role of the
     declined reading.

### Commands run and observed results

- `pnpm build` in Core `packages/contracts` and in `packages/client-gateway-websocket`: both printed build-cache "build" lines. They are needed because Core and the extension read the contract types from `dist`.
- Core `npx tsc -p tsconfig.json --noEmit` (packages/fluxiq) exited 0. Core contracts `npx tsc --noEmit` exited 0.
- Core `npx vitest run src/programs/automation-studio/runtime/activity src/programs/automation-studio/runtime/service/project-build src/programs/automation-studio/runtime/conversations/commands` printed `Test Files 68 passed (68)` and `Tests 572 passed (572)`.
  - The first run had 2 failures: `project-build-facade.test.ts` and `project-build-reset.test.ts`. Both asserted the old rule that the ending row never shows the model's reason. I updated them to the new contract: the reason, then the note, said once.
  - `cards.test.ts` now expects `after: ["List soups"]`. A revision quoted in a return now reads "version", as `person-words` says it.
- Core `node scripts/structure-audit.mjs` printed `structure-audit: passed (378 warning(s), 1156 baselined)`. `activity/wording/` now holds 21 files against the advisory 15; it was already past that before this change.
- Extension `node scripts/test-extension.mjs background/activity/tests shared/activity/tests panel/chat` printed `# tests 529`, `# pass 529`, `# fail 0`. Separately, `node scripts/test-extension.mjs shared/activity/project` printed `# pass 6`, `# fail 0` (the new `after` reader test).
- Extension `node scripts/check-extension.mjs` exited 0.
- `pnpm structure:check` (downstream) printed `structure-audit: passed (196 warning(s), 639 baselined)`.

### Not verified

- No live or browser run.
- Core `packages/fluxiq` `dist` was not rebuilt. The downstream core-build freshness gate (`scripts/check/core-build.mjs`, run by `pnpm --filter …extension check`) will report Core's build stale until it is rebuilt. I ran `check-extension.mjs` directly, as the brief says.
- Core's web panel (apps/web) was not checked. It ignores `note` rows' cards, per client-gateway.md.

### Open questions or contradictions found

1. **The toast cannot get the reason from Core's last row without touching
   `flow-bootstrap/**`.** That row (`activity/build.ts`) and the chat's
   closing message (`conversations/commands/build.ts`) both get their words
   from `progress.ts`, which sees only the failure's diagnostic. The
   diagnostic is parsed with an exact field list
   (`flow-bootstrap/generation-failure/diagnostic-parse.ts`,
   `hasExactFields`), so an extra field would make the whole diagnostic fail
   to parse. The change needed:
   - add `endedBecause?: string` (bounded) to
     `AutomationStudioFlowBootstrapFailureDiagnostic`;
   - add it to that file's exact-field list and its parse;
   - set it in `run.ts` `toldEnding` from the screened reason computed there;
   - have `progress.ts` `supervisorEndingWords` say "the supervisor ended it
     because it could not finish the Flow: <endedBecause>".

   The extension would then read the reason from the last row, and its two
   fallbacks would stay.
2. `activity/build.ts` was not in my ownership. With the change above it
   needs no edit, since it already reads `progress.ts`.
3. `runtime/activity/decision-answer/narration.ts` (not owned) still holds
   back the model's reason only for `core.submit_candidate` and
   `core.test_candidate`. A subflow builder's refused submit still shows the
   model's "Submitting …" sentence above the now-correct "Not done" card.
   Widening its `OWN` set to `core.submit_*` / `core.test_*` would say Core's
   words there too.

## Round 3

### Outcome

Done. Core's last row and the toast now carry the supervisor's screened reason
(defect 5). The narration no longer repeats the model's claim above a refused
subflow submit. Core's `dist` is rebuilt, and the downstream core-build gate
reports it current.

### What changed and why

1. **The supervisor's reason on the failure (defect 5, at the source).**
   - Core `flow-bootstrap/generation-failure/diagnostic.ts` gains
     `endedBecause?: string`, with `MAX_DIAGNOSTIC_ENDED_BECAUSE = 240` and
     `DIAGNOSTIC_SUPERVISOR_ENDING_CODES` (`project.build_blocked`,
     `project.build_partial`).
   - `diagnostic-parse.ts` adds it to the exact-field list. It accepts the
     field only when it is a non-blank string on one line, at most 240
     characters, and `issueCodes` holds a supervisor ending.
   - `service/project-build/run.ts`, `toldEnding`: when the supervisor ended
     the build, the failure is rethrown with `endedBecause` set to the same
     screened reason the ending row shows. A time limit and the endings with
     their own message are unchanged.
   - `conversations/commands/progress.ts`, `supervisorEndingWords`, now says
     "the supervisor ended it because it could not finish the Flow: <why>"
     (the partial ending likewise). It is not added beside a time limit.
   - `activity/build.ts` needed no change, since it already reads
     `progress.ts`. So the build's last row ("Build failed: …: <why>", with
     the whole sentence in its text) and the chat's closing message both
     carry the reason.
2. **The extension's toast.** `supervisor-ending.ts` now returns
   `{ sentence?, reason? }`:
   - A newer Core's last row has its title cut at 160 characters, so the
     toast shows "Build failed: " plus the row's own text where that says
     more.
   - A remembered reason is added only when that sentence does not already
     contain it, so nothing is said twice.
   - For an older Core, the round-2 fallbacks stay: the words of the ending
     row, else the supervisor's finishing decision.
3. **Narration of the model's reason.** Core
   `activity/decision-answer/narration.ts` (the file is under `activity/`,
   not `llm/`):
   - The candidate-only set became `own(toolId)`, matching every
     `core.submit_*` / `core.test_*`.
   - A part's refused submit reads "The AI model sent a version of this
     part's steps, but it was refused, so it is not what the Flow does".
   - A part's unchanged resend reads "These are the same steps it had already
     sent, unchanged, so they were not checked again".
   - A failed test of any test tool reads the existing test words.
   - The candidate's own wording is unchanged.
4. **Documentation:** `docs/architecture/extension-client.md` now covers
   Core's own `endedBecause`, the full-text sentence and the older-Core
   fallbacks.

### Commands run and observed results

- `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` (Core root): contracts reused its stamp; client-gateway-websocket rebuilt; fluxiq rebuilt (57,972 ms). All three printed "Done".
- Downstream `node scripts/check/core-build.mjs` printed `core-build: FluxIQ Core's build at C:\Users\osrs_\FluxStuff\fxwork\t649\!FluxIQ is current with its source.`
- Core `npx tsc -p tsconfig.json --noEmit` (packages/fluxiq) exited 0.
- Core `npx vitest run src/programs/automation-studio/runtime/activity src/programs/automation-studio/runtime/service/project-build src/programs/automation-studio/runtime/conversations/commands src/programs/automation-studio/runtime/flow-bootstrap/generation-failure` printed `Test Files 80 passed (80)` and `Tests 932 passed (932)`. The new tests include:
  - `generation-failure/tests/ended-because.test.ts`: parse accept and refuse cases;
  - the `plain-failure.test.ts` "a supervisor's reason for ending a build" test;
  - the facade test's assertion on `diagnostic.endedBecause`;
  - two `activity/tests/narration.test.ts` tests for a part's submit and test.
- `llm/decision-answer` does not exist. The narration tests live in `activity/tests`, which the run above covers.
- Core `node scripts/structure-audit.mjs` printed `structure-audit: passed (378 warning(s), 1156 baselined)`.
- Extension `node scripts/test-extension.mjs background/activity/tests shared/activity/tests panel/chat` printed `# tests 530`, `# pass 530`, `# fail 0`. That includes the new "a newer Core's last row says why itself" test. `node scripts/test-extension.mjs shared/activity/project` printed `# pass 6`, `# fail 0`.
- Extension `node scripts/check-extension.mjs` exited 0.
- `pnpm structure:check` printed `structure-audit: passed (196 warning(s), 639 baselined)`.

### Not verified

- No live or browser run. The toast's 360-character ending is still fitted by the content overlay, which I do not own.
- I did not check whether the Core API's other readers of the diagnostic (the Lab, the web panel) show `endedBecause`. They read the diagnostic through the same parse, so an older reader built from the old parse would reject a diagnostic carrying it. Both repositories must ship together.

### Open questions or contradictions found

- The parse rejects any field it does not know. A Core built before this change will drop the whole diagnostic of a supervisor-ended build that carries `endedBecause` (for example, stored records read by an older process). That is the existing strictness of the parse, not something new here, but it makes this a paired release.
