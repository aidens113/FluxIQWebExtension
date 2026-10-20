# Lane S F3: the `theMessageIsTheInstruction` failure (t728 follow-up 3)

## Outcome

Done. Lane S did not cause this. `dev` fails the same way: 13 of 14 checks pass and the saved instruction is "What can you do?\n\nCreate a flow …". The cause is in Core's conversation path, in how a build's instruction is read from the person's earlier messages. I fixed it in the t728 Core tree, tests first. The headed check in t728 now passes all 14 checks and exits 0.

## Dev result (step 1)

- `git -C M status --short` showed only ` M .clinerules/fluxiq.md`, which is not source and nobody was mid-edit, so I went ahead. MC was clean.
- `node scripts/check/core-build.mjs` in M reported MC as stale (`fluxiq:build: inputs changed`). As authorized, I rebuilt it with `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` in MC. That exited 0, and the gate then printed "is current with its source".
- Lab instance `lane-s-f3-dev` was built in M. The driver is a copy of lane-s-i's, with only the tree and label changed. It ran the Lab's own `runBuildPhase` and printed "build phase done".
- I ran the check with the same command and env as lane-s-i, using label `lane-s-f3-dev` and evidence in `M/test-runs/lane-s-f3-dev/chat-check/2026-10-20T05-40-53-940Z-chrome`. Result: `CHECK EXIT 2`, stage `done`, failure null, 13 of 14 checks held. The one that failed was `theMessageIsTheInstruction`. The saved instruction was `"What can you do?\n\nCreate a flow that lists the name and price of the first three wireless earbuds in the search results"`, and the build failed with `flow_bootstrap.provider_secret_unavailable`, which is expected without a key.

## Cause (step 2)

- The extension does not join the messages. The recorded `append-turn` requests (lane-s-i's `result-chrome.json` `coreCalls`) carry `"What can you do?"` and then the build sentence on its own.
- The harness expectation is right. It compares the saved instruction with exactly what was typed (`packages/test-runner/src/extension-chat-check/prove/chat-build.ts:65`), and `run-chat-check.ts:144` sends the relay question first in the same conversation, which is what a real person might do.
- The joining happens in Core, in `C/packages/fluxiq/src/programs/automation-studio/runtime/conversations/person-words.ts`, function `automationStudioConversationPersonWords` (the loop around line 57) together with `showsSomethingDone` (line 66). Core reads a build's instruction from every person turn since the thread "last showed something done", and only an attachment or an ask counted as done. The words-only answer to "What can you do?" comes from `instructions/fallback.ts:33` (`whatICanDo`) and is written by `instructions/respond.ts:66-69` with `attachment: null, ask: null`. So the loop went back past it and kept "What can you do?". `commands/create-here.ts` then saved that text as the instruction and took the Flow name from its start. This rule has been in place since Core commit 1f16b6e9 (2026-10-07, t349). The t728 Core diff to `conversations/` only touches cost and priced-call accounting.
- It is not limited to words-only reading. A model `reply` to "What can you do?" that asks nothing back would have been folded in the same way.

## Fix (step 3)

The only file changed is `person-words.ts`, plus its tests. An automation turn now closes what came before it when its words ask the person nothing back, meaning the trimmed text does not end in `?` (closing quotes or brackets after it are allowed). This sits alongside the existing attachment and ask rules (`showsSomethingDone` line 69, new `asksForMore` line 76). The thread does not store which kind of decision wrote a turn, so Core's own words decide. Core's words-only replies, including the "(I read your message without the model …)" note, never end in a question. The model's one question back (`{"ask": …}`, which the prompt defines as one short question) does, and so does the existing pinned case of a model reply that asks "Which shop …?". Those multi-turn requests still join. The file header comment records the rule and why it exists.

I added three tests to `conversations/tests/person-words.test.ts`:
- A model `ask` followed by the answer still saves both turns.
- A model `reply` that answers "What can you do?" without asking anything back leaves the question out, and the Flow name starts with the build request.
- A words-only path with no model bound (the check's situation): "What can you do?" gets a reply, and the following build sentence is read as `closest_match` and saved alone.

## Commands run and observed results

- Before the fix: `npx vitest run src/programs/automation-studio/runtime/conversations/tests/person-words.test.ts` in C/packages/fluxiq gave 2 failed and 10 passed. Both new "leaves out" tests received `"What can you do?\n\nCreate a flow …"`, which reproduces the bug.
- After the fix: `npx vitest run src/programs/automation-studio/runtime/conversations/` gave 24 files and 231 tests passed. `npx vitest run src/programs/automation-studio/api/handlers/tests/conversations.test.ts` gave 18 passed. `npx tsc --noEmit -p tsconfig.json` in packages/fluxiq exited 0.
- `pnpm --filter fluxiq build` in C printed `"build-cache":"reuse" … inputs and outputs match the stamp`, which means a concurrent build had already included my edit. `grep asksForMore` found it in `dist/…/conversations/person-words.js`. The `core-build.mjs` gate in D said it was current.
- Headed check in t728, Lab instance `lane-s-f3` (same command, env pattern and flags), evidence in `D/test-runs/lane-s-f3/chat-check/2026-10-20T05-51-04-421Z-chrome`. Result: `CHECK EXIT 0`, stage `done`, failure null, panel `side-panel`, all 14 checks true. The saved instruction is exactly the typed build sentence, and the build again ended on `flow_bootstrap.provider_secret_unavailable`.

Before and after: dev was 13 of 14 (exit 2), t728 before the fix was 13 of 14 (lane-s-i, exit 2), and t728 after the fix is 14 of 14 (exit 0).

## Not verified

- Only Chrome/Chromium was run. Firefox was not.
- The model path was covered only by the scripted-model unit tests, with no live model run. A model clarification worded without a question mark ("Tell me which shop.") would now close the request, and only the person's answer would be saved. The prompt asks for a question, so I judged this acceptable, but it is a behavior change. A build's progress statement that lands between a model question and the person's answer would also close the request now.
- No full suites were run, per the narrow-checks rule. The Core structure audit was not run. The change adds no file or export.
- Building the `lane-s-f3-dev` instance also rebuilt M's shared, unlabelled `packages/test-runner/dist` and `test-evidence` dists, which are ignored build output. The same is true of the t728 instance build in D.

## Open questions or contradictions found

- The thread stores no decision kind (reply, ask or invoke), so "did Core ask something back" has to be read from text. If the supervisor wants it exact, the structural fix is to record the decision kind on the automation turn. That needs a store column and a contract field, and it crosses the extension's wire, which is outside this brief.
- My change is in the t728 Core tree, so Core's `dev` needs the same commit when t728's Core side merges. The dev checkout is unchanged.

---

# Follow-up: an exact rule replaces the question-mark heuristic (lane lead's request)

## Outcome

Done. Core now records which decision it answered a person's message with, on the turn it writes: `reply`, `clarify` or `invoke`. `person-words.ts` decides from that recorded decision and no longer from the wording. The question-mark heuristic described above is gone. Nothing new reaches any client: no API response, panel read, client-gateway or extension contract carries the field, and the extension needed no change. After rebuilding Core in t728, the headed check passes 14 of 14 again.

## What changed and why

All changes are in the C tree under `packages/fluxiq/src/programs/automation-studio/`.

**Storage.**
- New migration `storage/project/schema/conversation-turn-decision.ts`, id `0026_responded_turn_decision`. It runs `alter table conversation_turns add column decision_kind text check (decision_kind is null or decision_kind in ('reply', 'clarify', 'invoke'))`.
- I followed the existing pattern for adding a column to an existing project database (`0026_recording_description`, `0026_relaxed_instruction_node_guard`): a single `alter table` statement, exported from `schema/index.ts`, and appended last to `AUTOMATION_STUDIO_PROJECT_ADMINISTRATION_MIGRATIONS` in `storage/project/administration.ts`.
- The id has to sort after `0026_relaxed_instruction_node_guard` and before `0026_staged_project_snapshots_v1`. The runner (`schema-migrations.ts:293`) requires ascending ids within a set, and it applies any pending id to an existing database whatever its place in the order, exactly as it did for `0026_relaxed_instruction_node_guard`.

**Turn model (`runtime/conversations/`).**
- `turn.ts`: added the `AUTOMATION_STUDIO_CONVERSATION_TURN_DECISIONS` list, the `AutomationStudioConversationTurnDecision` type and its type guard. `AutomationStudioConversationTurn` gained an optional `decision?: ... | null`, documented as Core's own reading and never a client's.
- `rows.ts`: the row and its column list include `decision_kind`. `automationStudioConversationTurnFromRow(row, ask, { decisions })` adds `decision` only when asked.
- `inputs.ts`: a turn input accepts `decision`. The new `automationStudioConversationTurnDecisionOrRefuse` refuses a decision on a person's turn and refuses any value outside the three kinds.
- `store.ts`: `appendTurn` validates and writes the column. The decision goes into the idempotency request only when it is not null, so replaying a turn written before decisions were recorded still matches. `getConversation(input, { decisions })` is the only read that returns the field. `getTurn`, `recentTurns`, the append's own return value and a plain `getConversation` all return exactly what they returned before.
- `writer.ts`: `AutomationStudioConversationAutomationTurnRequest` gained an optional `decision`. `conversations.ts` `appendAutomationTurn` passes it through, and `personWords` reads with `{ decisions: true }`.

**Writing the decision.** `instructions/respond.ts` records `decision.kind` on every answer it writes, whether that is a reply, a question back, a command announcement, a confirmation, or the "too much detail to carry on one confirmation" refusal.

**The rule in `person-words.ts`.** `showsSomethingDone` closes the earlier request on a panel result, on an attachment or ask (as before), and on a recorded `reply` or `invoke`. It keeps the request open on `clarify`, and on a turn with no recorded decision. Why each kind is treated this way:
- **`clarify` keeps the request open.** Core could not tell what was wanted and asked one question (the prompt's `{"ask": ...}`), so the next message finishes the same request.
- **`reply` closes it.** By the prompt's own definition, a reply means the person was "not asking for anything to be done, or asked what you can do". Nothing in that exchange belongs to the next request, even when the reply ends by asking "Want me to build one?".
- **`invoke` closes it.** The words were taken as a command: announced, put up for confirmation, or answered with the reason it could not be set up. Those words were used up by that command. A command Core runs closes them anyway with its result turn. An announcement whose result never reaches the thread (for example, a client-run capability whose result is not recorded) must not leave them to be read into the next build.
- **No recorded decision (null) keeps today's behaviour from before my fix**, not the heuristic. This covers every turn written before the column existed, and Core's progress and run turns, which are not answers to a person. Reading an old thread too broadly keeps a request whole at the cost of an earlier remark. Guessing from the words could instead cut off the answer to Core's question from the request it finished, and the person's stated requirements would be lost. Losing what the person asked for is worse than keeping a remark, which is t349's principle: keep the request whole rather than cut it to a guessed span.

**Not projected.** The API's `get-conversation` handler (`api/handlers/conversations.ts:151-167`) returns `store.getConversation(...)` turns as they are. That read never asks for decisions, so the field is absent, not just null. The extension's `panelConversationRead` (`apps/extension/src/background/panel/conversation-relay.ts:55-62`) relays that payload unchanged, so it gets nothing new. The tests check this directly: no turn has a `decision` key on any client read, including the append's return value and `getTurn`.

## Tests

Three test files were written before the code. Their run before the implementation gave 4 failed and 21 passed, and the migration test also failed at import because the migration did not exist yet.
- `storage/project/schema/tests/conversation-turn-decision.test.ts` (new): a database migrated before the column keeps an existing turn and reads it back with `decision_kind` null; new rows take only the three kinds (a CHECK constraint refuses "guess"); the id sorts within the allowed range.
- `instructions/tests/respond-to-turn.test.ts`: added a case where a reply, a question back, a run and a delete confirmation each record `reply`, `clarify`, `invoke` and `invoke` on Core's answer, person turns stay null, and the client read carries no `decision` key.
- `tests/person-words.test.ts`:
  - The existing case "spread over a question and its answer" now uses the model's `ask`. It had used a `reply` ending in "?", and under the exact rule a reply closes the request.
  - New cases:
    - A question back worded without "?" keeps the request open.
    - A reply that ends in "?" closes it.
    - An announcement whose command never ran closes it.
    - A Core turn with no recorded decision keeps the old behaviour.
  - Kept from the first fix: a reply to "What can you do?", and the words-only case without a model.

One test was written after the implementation, not before: `tests/store.test.ts` gained a case showing the decision is recorded, read only with `decisions`, and refused on a person's turn or as an unknown kind. Its first version used `as never`, which the structure audit failed. I replaced it with an untyped parsed-body stub.

## Commands run and observed results

- `npx vitest run src/programs/automation-studio/runtime/conversations/ src/programs/automation-studio/storage/project/schema/tests/ src/programs/automation-studio/api/handlers/tests/conversations.test.ts` (in C/packages/fluxiq) gave 32 files and 267 tests passed. `npx vitest run .../conversations/tests/store.test.ts` gave 16 passed.
- `npx tsc --noEmit -p tsconfig.json` exited 0.
- `pnpm --filter fluxiq check` printed `"step":"fluxiq:check" ... "source":"command"`, exit 0.
- `node scripts/structure-audit.mjs` (in C) printed `structure-audit: passed (419 warning(s), 1152 baselined).` with exit 0. The first run, before I fixed the test, had failed on 1 `as never`.
- `pnpm --filter fluxiq build` printed `"step":"fluxiq:build","reason":"inputs changed: packages/fluxiq ..."`, exit 0. `decision_kind` is present in the dist `store.js` and `conversation-turn-decision.js`, and `asksForMore` has 0 matches in the dist `person-words.js`. D's `core-build.mjs` printed "is current with its source".
- Headed check in t728, Lab instance `lane-s-f3`, same command and env as before:
  - **First attempt:** the Lab build failed in `extension:build` with `src/background/index.ts(185,66): error TS2304: Cannot find name 'requestsChoice'`. Another worker was editing `apps/extension/src/background/index.ts` and `capture-policy/index.ts`; the import was in place when I checked a moment later. This collided with someone else's edit and was not caused by my change.
  - **Rerun once, as the brief allows:** the build passed (domain host and domain rebuilt against the new Core dist). Then `CHECK EXIT 0`, stage `done`, failure null, panel `side-panel`, all 14 checks true, including `theMessageIsTheInstruction`. The saved instruction is exactly the typed build sentence. Evidence: `D/test-runs/lane-s-f3/chat-check/2026-10-20T06-52-13-966Z-chrome`.

## Not verified

- Firefox was not run. No live model was used: the model path is covered only by scripted-model tests.
- Under the exact rule, a model that wrongly uses `reply` for a clarifying question now closes the request, so only the person's answer would be saved. This follows the prompt's contract and is the behaviour the lane lead asked for.
- No full suites were run. The web app (`apps/web`) was not typechecked, but its types are not involved: the turn type's new field is optional and is never set on a client read.
- I did not check what migrating a real, existing user project database looks like. The migration test covers a database migrated before the column existed.

## Open questions or contradictions found

- The lane lead's brief named `panelConversationRead` as a Core projection. It is the extension's relay message (`conversation-relay.ts`), and it passes Core's `get-conversation` payload through unchanged. The field stays private because Core's read never includes it unless asked, not because some projection strips it.
- The Core change spans 13 modified files and 2 new ones in the t728 Core tree, including a schema migration. Core's `dev` needs them when t728's Core side merges.
