# t227: live Lab runs start the Flow build from the real extension chat window (lane report)

User order (2026-10-01): "the tests should be using the actual extension chat window to prompt the model building flow."

Trees: `fxwork/t227/!FluxIQWebExtension` (branch `task/t227-chat-driven-live-runs`) and its paired Core
`fxwork/t227/!FluxIQ` (branch of the same name). A first start without `--core` was allocated `t226` and abandoned
empty (`unmerged 0`) once it was clear Core needs a change; the restart with `--core` was allocated `t227`.

## Fix log

- **r0 product audit (2026-10-01, lead).** How a chat message becomes a Flow build today, below.
- **DeepSeek outage (coordinator, 2026-10-01).** Live run held until the supervisor says the provider answers.
- **r1 Core (lead).**
  - `instructions/prompt.ts`: tells the model that a job described for the open site means `flow.createHere`.
  - `instructions/invocation.ts`: takes a missing required `instruction` from the message, unless the message is only the capability's own words.
  - `conversations.ts`: passes the message into the decision context.
  - Tests: `invocation.test.ts`, `prompt.test.ts`, and one end-to-end case in `commands/tests/extension-chat.test.ts`.
- **r1 Lab (lead).**
  - New chat stage `flow-lane/creation/chat/` (`buildCreatedFlowFromChat`, `CreatedFlowChatRecord`, thread and Flow reads).
  - Lane entry `chat | direct-api` (`lane.ts`). The chat entry builds and reviews nothing itself.
  - `readCreatedFlowBuild` accepts an `applied` proposal.
  - The permission reader includes the chat thread.
  - The person answers asks on the chat's thread in the panel (`answerInChat`, `via`).
  - `LiveLlmRun.chatBuildAuthorizer` and `assertChatBuildable`.
  - `run-scenario/chat-build/` wires the panel the run shows. A chat build starts on the entry page (`flowStartPage`).
  - Chat is the default. `--direct-api-build` is test-only and never a pass. `--no-live-panel` and `--llm-permit` are refused for a chat build.
  - New headed claim `extension-chat-check --build`.
  - Docs: `testing-facility.md`.
- **r1 found:** the chat check's thread reader omitted the project's domain, and Core refused it (400, "project is unavailable in this domain scope"). It had never run end to end (t198). Fixed in `thread-reader.ts`.
- **Live 1, `run-muq2dlhq-96bffb09`, $0 (debug `debugs/run-muq2dlhq-96bffb09.md`).**
  - The typed task was answered "I could not tell what you wanted done ... (I read your message without the model, because the model did not answer in time)", and nothing was built.
  - **Product gap, fixed in Core `instructions/fallback.ts`:** a described job with a page open is built when read without the model.
  - **Lab fix:** the settlement's "reached no provider" no longer hides what the chat said.
- **Live 2, `run-muq310ht-ab80eed0`, $0.2769 (debug `debugs/run-muq310ht-ab80eed0.md`).**
  - The chat path worked end to end. The model chose `flow.createHere`, and the chat built and applied the Flow in 153 s. The lane ran, judged and repaired it.
  - Failed on the product: 0 of 13 records. The refused clicks were stale handles (fixed on dev by t223). The repeated reads were the model's own amend-and-rerun of step `d14`.
- **r2 (coordinator):** a chat run's `core.log` had no build trace. The trace was on only when the launcher exported `FLUXIQ_BUILD_PROGRESS_TRACE`. Now `environment.ts` turns it on for every Lab-started Core. The chat and direct paths share one trace wrapper.
- **r2 audit fixes:** imports go through barrels, and the three `prove-*` files moved to `extension-chat-check/prove/`. Two of the moves are staged renames, because `git mv` was used.

- **t228 (2026-10-01): blocked, nothing changed.** The order to remove every refusal of the model's actions except permission, privacy and the repeat guard was stopped by the permission system. Reading the extension's `actionability.ts` and `click.ts` was denied as "Security Test Removal". The first edit, to `shown-addresses.ts`, was denied as "Security Weaken", and so was a `git status`. The full classification table went to the supervisor and is with the user. No REMOVE item will be pursued until the user decides.
- **Per-build ceiling (coordinator, "the user's money, first"), lead.** The premise was checked first.
  - Run 12 (`run-muq66ff9-cb3767a1`, $0.3239) never passed the ceiling. The ledger records `maxBuildCostUsd 0.1603` and `buildsOverCeiling 0`.
  - The chat build cost $0.098. The Flow's repair then made three reauthor builds ($0.160, $0.043, $0.011) and a $0.012 result check.
  - The ceiling does hold for chat builds. Lane B's chat build `run-muq3ubys-4b4dbf5b` ended "stopped at its spending limit of $0.25".
  - Core computes one ceiling for every `generate-flow-bootstrap-adaptation`, in `service.ts` and `loop-limits/flow-bootstrap-evidence-loop.ts`: `automationStudioLlmRunCostCeilingUsd` lowered by the Flow's `maxEstimatedCostUsdPerRun`. The chat's `create-here` makes that same call.
  - The real gap: a lowered `--llm-max-cost-usd` could not reach the Flow a chat build makes. `LiveLlmRun.assertChatBuildable` now refuses it, and a test pins the chat plan's ceiling to Core's function.
- **Chat display fixes (lead).**
  - **U-B1, the welcome screen mid-build.** The panel that sent showed "Sending your message" (window capture at 24.757 s) and then the thread (26.052 s). In between, `send()` ended the send before re-reading the thread, so for that read the card had no turns, no live line and `loaded`: the empty state. Lane B's UI-review capture landed in that window, at 25.750 s, in every run. Fix: `conversation/controller.ts` keeps the send in flight until the read lands.
  - **U-B2, the stop said twice.** A chat-started build's failed marker repeated the chat's answer. The extension's `stream/step/messages.ts` and Core web's `activity/steps/messages.ts` now skip a failed build marker or `ended` row that carries a `conversationId`.
  - **U-A1, a failed step read "Done".** Core never ends a run step. A step closed by the run's recovery for that node, or by the run failing, is now marked failed; any other closing marks it done. Same two files.
  - **U-A2, a merge read "Action · the page".** A step event carried no definition id.
    - Core `activity/step.ts` adds `Node: <definition>` to `detail.text`, the record tool rows carry, and code-only text is never shown.
    - `ui/activity-action` maps Core's control node ids to new kinds `join`, `branch` and `repeat` ("Join paths", "Choose path", "Repeat"; icons git-merge, git-branch, repeat). It maps by whole id, not by word: "Switch my pickup store" is no branch.
    - The extension's `lucide-nodes.ts` and Core web's `action-icons.ts` carry the icons.

## Validation (observed 2026-10-01)

- Core `npx vitest run src/programs/automation-studio/runtime/conversations --maxWorkers=2 --minWorkers=1`: `Test Files 14 passed (14)`, `Tests 91 passed (91)`.
- Core library build (it type-checks `fluxiq`): `heavy.sh pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` → `packages/fluxiq build: Done`.
- Core `heavy.sh node scripts/structure-audit.mjs`: `passed (209 warning(s), 349 baselined)`, with "1 baseline entries can be lowered", not recorded. `--rule docs-links`: `passed`.
- Lab `npx tsc -p tsconfig.json --noEmit` (test-runner): exit 0, no output.
- Lab tests in the changed directories: `node --test` on `dist/flow-lane/creation/**`, `person-simulation/tests`, `lane-rules/tests`, `tests`, `live-llm/tests`, `extension-chat-check/tests` and `run-evaluation/tests`: `# tests 650`, `# pass 650`, `# fail 0`.
- Lab `heavy.sh node scripts/structure-audit.mjs`: `passed (148 warning(s), 118 baselined)`.
- **Headed provider-free proof**, run twice and the second after every change: `node packages/test-runner/dist/extension-chat-check/cli.js --browser chrome --scenario everything-store --page ./ --no-ask --build` → exit 0, all 14 checks true. Evidence in `C:/Users/osrs_/FluxStuff/evidence/t227/2026-10-01T21-44-15-018Z-chrome/` and `.../2026-10-01T22-16-58-237Z-chrome/`.
  - The stage typed into Chrome's real side panel (`panelInput: view-dom`).
  - With no model, Core read the message as `flow.createHere`, created the Flow, and saved the message as its instruction.
  - The build stopped on `flow_bootstrap.provider_secret_unavailable`, and the thread said "Your model key is locked".
  - The stage recorded `lab.chat_build_failed`, with `chat.ending: failed` and the person's, answer and result turns at 3, 4 and 5.
- **Dry run:** `pnpm lab run everything-store --live-llm ... --llm-task create-flow --instruction-task everything-store-plus-earbuds-under-50 ... --dry-run` → `status ready`, `buildEntry chat`, run ceiling $0.25, `permittedConsequences []`.

- **Ceiling and display round (after the dev fast-forward to `60217d05` / `d5730a5a`):**
  - Core `npx vitest run src/ui/activity-action src/programs/automation-studio/runtime/activity` plus the activity publisher and handler tests: `Test Files 25 passed (25)`, `Tests 246 passed (246)`.
  - Core web `npx vitest run src/features/automation-studio/conversation`: `Test Files 26 passed (26)`, `Tests 267 passed (267)`.
  - Core web `heavy.sh npx tsc --noEmit`: exit 0.
  - Core library build: `fluxiq build: Done`.
  - Core audit: `passed (211 warning(s), 349 baselined)`.
  - Extension: the tests of `panel/chat/{tests,conversation/tests,stream/tests,stream/step/tests,view/tests}` and `panel/icons/tests`, bundled as `scripts/test-extension.mjs` does: `# tests 187`, `# pass 187`, `# fail 0`.
  - With the U-B1 and U-A1 fixes undone, their new tests failed (`not ok`), and they pass with the fixes restored.
  - `heavy.sh pnpm --filter @fluxiq-web-extension/extension check`: passed.
  - test-runner build and `node --test dist/live-llm/tests/*.test.js`: `# tests 102`, `# pass 102`.
  - Lab audit: `passed (154 warning(s), 118 baselined)`; `--rule docs-links` and `--rule working-docs` passed.

## Live runs

| Run | Cost (ledger) | Chat | Ending |
| --- | --- | --- | --- |
| `run-muq2dlhq-96bffb09` | $0 | answered without the model; no build | `lab.chat_started_no_build` (Core fallback gap, fixed) |
| `run-muq310ht-ab80eed0` | $0.276894432 (build $0.1359 for 38 calls; reauthor $0.1391; result check $0.0019) | `flow.createHere`, created in 153 s | product: 0 of 13 records, `core.result.does_not_answer_request` |

Chat screenshots of run 2:
- `fxwork/t227/!FluxIQWebExtension/test-runs/run-muq310ht-ab80eed0.ui-review.local/`: panel and page at 18 moments. `03-mid-build-panel.png` shows the build steps in the chat, `09-mid-build-panel.png` the completion check, and `14-flow-run-panel.png` the repair.
- The run's 28 window captures are in `test-runs/run-muq310ht-ab80eed0/screenshots/`.

## Not verified

- **The build trace on a chat run.** The environment default is unit-tested (`tests/environment.test.ts`). No chat run has executed with it yet, because the provider-free build stops before the evidence loop.
- **The Core fallback's described-job rule live.** Run 2's model read the message itself, so the fallback rule has been exercised by unit tests and by the provider-free claim only (the claim's message names a phrase).
- **The person answering in the chat live.** No ask was raised in either run. It is covered only by `person-simulation/tests/simulation.test.ts` and the lane test.
- **Firefox:** not run.
- **The chat build's own caps.** The Lab cannot pin per-Flow limits before a chat build, so the build ran on Core's defaults. Run 2's build stayed under its $0.25 ceiling ($0.1359).
- **What a failed chat build spent.** Core publishes it nowhere a reader can count, so such a build's accounting is `null`. That needs a Core build-record endpoint; this is a known gap, not deferred silently.
- This tree predates dev's t223 stable handles and F16-F22. The supervisor merges dev, and the proof is re-run on the updated tree.

## How a chat message becomes a build (found 2026-10-01)

1. The panel's composer sends `panelConversationSend`; the background relay (`apps/extension/src/background/panel/
   conversation-relay.ts`) adds the six capability ids and `onScreen.pageUrl` (the active web tab) and calls Core's
   `append-turn` with the paired token.
2. Core (`runtime/conversations/conversations.ts` `respondToPersonTurn`) stores the turn and asks the chat model
   (DeepSeek, JSON mode, on the approving person's unlocked session) to pick a capability; with no model it matches the
   words itself (`instructions/fallback.ts`).
3. When the pick is `flow.createHere`, Core runs it in the background (`commands/create-here.ts`): `create-flow`,
   `save-flow-generation-instruction`, `generate-flow-bootstrap-adaptation` with `startLocation` = the page, then
   `review-flow-adaptation` approve and apply. Asks the build raises land in the chat thread (ambient conversation
   context). The ending arrives as an automation turn with attachment `panel-capability-result` / `flow.createHere`.

**Product gaps found** (both stop a typed instruction from starting a build):

- Nothing tells the chat model that a job described for the open site is a request to build: the prompt says only that
  something asked to be made "here" or "for this page" starts there. A plain instruction ("Find every pair of wireless
  earbuds ...") is left to the model's guess between `flow.createHere`, a reply, or `flow.explore` (which, with no Flow
  in the project, answers "This project has no Flows yet").
- A `flow.createHere` pick that leaves out the required `instruction` argument (the fallback always does; a model may)
  is answered "To "Create an automation here" I still need what the automation should do", although the person's
  message is that instruction.

**Limits of the chat path the Lab has to live with:**

- The Flow is created and built inside one Core command, so the Lab cannot pin per-Flow LLM settings before the build:
  the build runs on Core's host defaults (the person's DeepSeek key, `deepseek-flash`, the $0.25 run ceiling).
- A background command answers `started` with no ids; the Flow is found by diffing the project's Flows.
- A chat build that fails leaves no readable record of what it spent: Core's diagnostic goes into the thread's sentence
  only. No endpoint returns a failed build's accounting.
- `--llm-permit` cannot reach a build started from the chat; the person answers at the permission point instead.
