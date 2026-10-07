# t349: a build's instruction is the person's own words

Worker: t349-verbatim. Core worktree `C:\Users\osrs_\FluxStuff\fxwork\t349\!FluxIQ`, branch
`task/t349-instruction-verbatim` (base Core `93c059b0`). Nothing committed.

## Outcome

Done. When a chat message starts create-here, explore or improve, Core now saves the person's
own words, whole and as written, whatever the chat model put in the `instruction`/`change`
argument. The argument is used only by a caller with no person turn, and is then marked as such
(on the outcome and in the thread's words). Fail-first confirmed: 8 of the 9 new tests and the
updated end-to-end explore case fail on the original source and pass now.

## What changed and why

All under `packages/fluxiq/src/programs/automation-studio/runtime/conversations/`.

**Where the person's turn is reached.** The API handler (`api/handlers/conversations.ts`, not
owned, not edited) builds the command context and calls `startAutomationStudioConversationCommand`
with the interpretation's `response`. `response.turnId` is the turn Core wrote in answer to the
person's message. `commands/start.ts` now passes it on as `context.answerTurnId`. The person's
turn is the last person turn before that answer turn, so a turn written after it never counts.

**What counts as the person's text** (`person-words.ts`, new, root of conversations):
- every person turn since the thread last showed something done, up to and including the
  answered turn, each whole and in order, joined by a blank line;
- "something done" means a `panel-capability-result` turn (from the panel or a command), or an
  automation turn with an attachment or an ask (a command's question, a candidate draft);
- the assistant's words are left out, and so are panel-recorded result turns;
- a message that holds more than the instruction is kept whole. No span is guessed.
So "make me a flow for kettles" / (model asks which site) / "this shop, the first ten" saves both
person turns. A request made after an earlier capability's result saves only the new words.

**How commands get it without a module cycle.** The thread readers import the commands, so a
command cannot import them back. A first version did, and `run-flow.test.ts` failed at load with
`Cannot read properties of undefined (reading 'capability')` in `catalog.ts`. So the reading goes
through the command host instead:
- `AutomationStudioConversationCommandHost.personWords?` is a new optional method
  (`commands/command.ts`). It is optional so existing host literals outside this area, such as
  `runtime/tests/.../caller-paid-result-check.test.ts`, still compile.
- `AutomationStudioConversations.personWords` (`conversations.ts`) implements it with the store
  and also returns `saysWhatToDo` for the asking capability.
- `commands/argument.ts` gains `automationStudioConversationCommandInstruction(context,
  capability, args, name)`, which returns `{ text, from: "person" | "argument", saysWhatToDo }`.
  It uses the person's words when `answerTurnId` and the host method are present, otherwise the
  argument, otherwise null.
- `AUTOMATION_STUDIO_CONVERSATION_ARGUMENT_WORDS` is the fallback phrase.

**Commands:**
- `create-here.ts`: saves the person's words, and names the Flow from them when no `name` is
  given. A failure's "keeps your instruction" says "the instruction as the request worded it,
  since no message of yours came with it" on the fallback path.
- `improve.ts`: the required instruction's body and title come from the person's words.
- `explore.ts`: the model still decides whether the goal changed (whether `instruction` is
  present), but the saved goal is the person's words. There is one guard: a message that says
  nothing beyond explore's own name and phrases ("Build it again") leaves the saved goal alone,
  whatever goal the model wrote. The check is the existing word test from `invocation.ts`
  (fewer than 3 words left after the capability's title and phrases), moved into
  `instructions/says-what-to-do.ts` and now used by both. I did not apply this guard to
  create-here or improve: it rejected short real instructions such as "Find the kettles on this
  page", and those commands have no saved goal to protect.
- Each argument's `describe` now says that Core saves the person's own message in its place and
  uses the argument only when no message from the person started the request. This is the
  "say so in the command's own description" requirement.
- Outcome: `instructionFrom?: "person" | "argument"`, carried by `progress.carry` (`progress.ts`,
  `Ids` widened). Each save step's text gains the fallback phrase on the argument path.

**Barrels:** root `index.ts` exports `person-words.ts`; `instructions/index.ts` exports
`says-what-to-do.ts`.

**Tests:**
- New `tests/person-words.test.ts` (9 cases). It drives the real path: the turn is stored and read
  by a scripted chat model that paraphrases, Core's answer is written, and
  `startAutomationStudioConversationCommand` runs with the port faked. Cases:
  - create-here verbatim, plus the Flow name;
  - explore verbatim;
  - explore without the argument saves nothing;
  - explore with "Build it again" plus an invented goal saves nothing;
  - improve verbatim, plus the title;
  - a request spread over a question and its answer is joined;
  - words before a recorded result are excluded;
  - the outcome is marked `person`;
  - with no person turn, create-here, improve and explore fall back to the argument, marked
    `argument` and said in the text.
- `commands/tests/execute.test.ts`: the four failure-sentence cases now start from a person's
  message and Core's answer (`personAsked` helper) and read the last turn, so they still pin the
  real "keeps your instruction" sentences.
- `commands/tests/plain-failure.test.ts`: this case runs with no person turn (`host: {}`), so its
  expected text now carries the fallback mark.
- `commands/tests/extension-chat.test.ts`: in the explore case, the person's message now states
  the goal ("Build it by trying it here: search the catalog for kettles"), and the test asserts
  the saved instruction equals that message verbatim.

## Commands run and observed results

Run from `C:\Users\osrs_\FluxStuff\fxwork\t349\!FluxIQ\packages\fluxiq` unless noted:
- `npx tsc --noEmit -p .` (nonincremental; `include` is `src/**/*.ts`, so tests are covered):
  no output, exit 0. This was the final run, after all edits.
- `npx vitest run src/programs/automation-studio/runtime/conversations/`:
  `Test Files 20 passed (20)`, `Tests 171 passed (171)`. This was the final run.
- Neighbours: `npx vitest run src/programs/automation-studio/runtime/conversations/
  src/programs/automation-studio/api/handlers/tests/conversations.test.ts
  src/programs/automation-studio/runtime/tests/service-adaptation/tests/caller-paid-result-check.test.ts
  src/programs/automation-studio/runtime/llm/deepseek/tests/panel-command.test.ts`:
  `Test Files 23 passed (23)`, `Tests 203 passed (203)`.
- Fail-first: I swapped the 11 changed source files back to their `git show HEAD:` contents,
  kept the new files, ran the new test file and the extension-chat explore case, then restored
  my files.
  - Result: 9 failed and 1 passed. The new test "explore saves nothing when the model leaves the
    goal as it is" passes on old code too, as expected: it guards behaviour that did not change.
  - Restoring was confirmed by the final typecheck, test and audit runs above.
- `node scripts/structure-audit.mjs` (Core root): `structure-audit: passed (287 warning(s), 509
  baselined)`, exit 0.
  - It also printed "1 baseline entries can be lowered". `--json` shows that entry is
    `file-lines runtime/service.ts` going from 4386 to 4381. It predates this work: I did not touch
    `service.ts`.
  - Earlier failures were fixed by restructuring, not by baselining: `directory-files` (commands/
    at 27 files), `naming` depth and `imports` barrel skips.
- `as never`: none added. The `git diff -U0 | grep '^+' | grep -c 'as never'` check returned `0`,
  and the new files contain none.

## Not verified

- No live Lab, provider or browser run. The lane A paraphrase case is reproduced only with a
  scripted chat model.
- Full Core suite not run (narrow-checks policy). Only the conversations directory and the four
  neighbour files above were run.
- `describe.ts` (`flow.describe`) still saves the model's `instruction` argument as the
  generation instruction (see open questions).
- Web app typecheck not run. The only shared type change is an optional host method and an
  optional context field.

## Open questions or contradictions found

1. **`flow.describe` still lets the model word the generation instruction.** It saves a
   generation instruction that a later explore without `instruction` builds from. The brief named
   create-here, explore and improve, so I left it unchanged. The supervisor should decide whether
   it gets the same rule. A risk if it does: "set the instruction to: ..." would be saved whole.
2. **Explore's relative goal changes.** "Try again but only the first five" now replaces the saved
   goal verbatim when the model passes `instruction`. Before, the model composed a full new goal.
   The guard catches only messages that say nothing beyond explore's own phrases.
3. **Boundary is approximate for concurrent builds.** Core's own "I'll make you ..." announcement
   carries no marker. A person turn whose command is still running, with no result turn yet, is
   included in the next command's words. That is rare, but possible if a second build starts
   while the first runs.
4. **Length.** `save-flow-generation-instruction` refuses more than 4,000 characters, while a turn
   may hold 16,000. Joined words over 4,000 make the command fail with that cause rather than be
   cut. That is honest, but a long multi-turn request can no longer be saved. Nothing in
   conversations knows that limit.
5. **A create-here message that only names the capability** ("automate this page") is now saved
   verbatim even when the model invented a goal. Before, the model's invented goal was saved.
