# Replay at zero calls (t894): S6, S9, conditional steps

## Outcome

Partial. Two of the three items are fully working:
- **S6:** a replay now makes 0 interpretation calls.
- **Conditional steps:** an absent prompt step is passed over in 13-21 ms, down from 5.1 s.

**S9 is built in `completion/` and tested, but it is not wired in.** Wiring it needs `attempt/` and `flow-run/`, which are on the must-not-touch list. So every replay still makes its 1 judge call. Attempt 4 is still refused: the script has no 4th judge answer. Answers stayed right.

## What changed and why

All code is in the Core worktree (`fxwork/t894/!FluxIQ/packages/fluxiq/src/`). The extension is unchanged.

**S6** (`runtime/conversations/`):
- `instructions/known-task.ts` handles a message before the interpretation call (`conversations.ts`). If the message passes every condition below, it starts `flow.createHere` with the person's words as typed. The decision source is `known_task`, with 0 attempts.
- Each condition that sends the message to the model instead has its own name: `no_lookup`, `no_words`, `command_not_offered`, `ask_waiting`, `asks_unreadable`, `recording_attached`, `not_known` (a paraphrase or another request), `lookup_failed`, `command_cannot_start`.
- `commands/answer-first/known-task.ts` does the lookup. It asks the same `get-task-known-flow` read route that create-here uses, with the page on screen. Outside answer-first mode it asks nothing.
- The lookup is passed in through the new `knownTask` field on the turn request (`instructions/request.ts`).
- **Outside my owned paths:** one wiring edit in `framework/automation-service/service/conversation-requests/append-turn.ts`. It builds a command context before the turn and passes the lookup in. This file was not on the must-not-touch list.

**Conditional steps** (`engine/automation/state-routing/optional-not-shown.ts`):
- Before an optional (sometimes-present) step is first dispatched, Core asks the host once, with no wait: `{ fact: "visible", op: "visible", target: <step parameters> }`. This is the question the explored-layer handler already asks.
- **Only a positive `false` passes the step over.** It becomes the step's readiness (judged, not met), so the existing not-shown path routes it along the Flow's declared way on and nothing is dispatched.
- `true`, `unknown`, no fact evaluation, a throw, a target bound to a missing value, or a step that is not optional: each dispatches the step exactly as before.
- **Outside my owned paths:** the call site is 4 lines in `engine/automation/step-loop/arrival.ts`. That file was not on the must-not-touch list; `graph-run.ts` was not touched.
- No extension change is needed, because the page-side fact check uses the same resolver a click does.

**S9** (`framework/automation-service/service/answer-first/completion/`):
- `replay-record.ts` defines the record type.
- `replay-stands.ts` holds the rule. Each deviation has a name and is checked in this order: `judge_always`, `flow_not_proven`, `flow_not_confirmed`, `run_not_whole`, `repaired`, `step_failed`, `step_routed`, `act_not_done`, `check_cleared`, `step_retried`, `shape_unknown`, `shape_differs`.
- A replay is accepted only when its saved Flow is `provenWhole` and `confirmed`, so the finished Flow's one judged whole run is unchanged.
- Skips that are not deviations: `already_done`, `already_in_state`, `absent`, `not_arisen`.
- `check.ts` takes a new optional `replay()` input and asks the rule just before the judge. An accepted replay counts as one check, with `checkedWhat` saying so. This is needed because the contract refuses a `confirmed` label with 0 checks.
- On acceptance, the state gets `onRecord`. Otherwise it gets `deviation`.

**S9 wiring still needed, all in must-not-touch files:**
1. `flow-run/outcome.ts` and `steps-ran.ts` `ranOf()`: give each step its structured fields.
   - `skipped`, mapped from `skippedSaid`'s branches: `already_in_state`, `not_arisen`, `absent_not_done`, `absent`, else `routed_elsewhere`. The gate's already-done branch maps to `already_done`.
   - `personCleared: true` when `personCleared(last)`.
   - `retries`: the attempts that carry `retry`.
2. `task-memory/saved-flow.ts`: a `shape?: { columns, empty }`. It must be written wherever the best Flow is saved from its accepted run's rows.
3. `attempt/run-attempt.ts`: pass `replay: () => replayOf(run)` to the completion check. `replayOf` returns `undefined` unless all of these hold: `route.kind === "use"`, there is no `run.prior`, `run.path === "run_flow"`, and `flowRun.outcome.kind === "ran"`. Otherwise it returns `{ saved: { label, provenWhole, shape }, reachedEnd, steps, repaired: false }`.

## Commands run and observed results

- `npx vitest run` on the new S6 tests -> 3 files, 10 tests passed. On the presence-check test -> 6/6 passed. On `completion` -> 7 files, 45/45 passed.
- `npx vitest run src/engine/automation` -> 104 files, 903 tests passed, exit 0.
- `npx vitest run` on `answer-first`, `runtime/conversations` and `conversation-requests` -> 159 files, 1171 tests passed, exit 0.
  - I then unpacked three test lines for the audit; those 3 files re-ran: 15/15 passed.
- `NODE_OPTIONS=--max-old-space-size=6144 tsc --noEmit -p tsconfig.json` (fluxiq) -> exit 0, no output.
- Core `node scripts/structure-audit.mjs` -> first run: 3 statement-packing failures in my tests. After the fix: "passed (528 warning(s), 969 baselined)".
- Core libraries rebuilt with `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket --filter @fluxiq/sdk --filter @fluxiq/ui-components build` -> exit 0. Extension build -> exit 0.

**Dining tables, provider-free** (3.3 GB free at launch): `run-mwaw30ax-02e6fad1`. Exit 1, status `not_judged`, because attempt 4 was refused at `loop_verification` 4, as before.

| Attempt | Before: t892 `run-mwaopobs-6ca50510` (current dev extension) | After |
| --- | --- | --- |
| 1, explore | 31.4 s, 22 calls | 29.5 s, 22 calls (interpretation 1, judge 1, decisions 20), right |
| 2, run_flow | 28.4 s, 2 calls (interpretation 1, judge 1) | 18.9 s, 1 call (interpretation 0, judge 1), right, continuation held |
| 3, run_flow | 28.8 s, 2 calls | 19.0 s, 1 call (interpretation 0, judge 1), right, held |
| 4 | refused at its judge | read with 0 calls, refused at its judge |

- The whole series made one `panel_command` request, from attempt 1. The step log has one `chat` step where it used to have one per attempt.
- **Prompt step s2, measured:** 5,109 ms before (t893 `run-mwas477e-47e0c0b4` step 52: `page.click` waited 4,346 ms, then `target_not_found`). After: 21, 13 and 18 ms in attempts 2-4, going arrival, `send.facts`, state-route, with no dispatch.
- **Crossborder timed-check, `--attempts 2`:** `run-mwawbykr-ff9c2f30`, status `passed`.
  - Attempt 1: right, 23 s, 15 calls.
  - Attempt 2: run_flow, right, 16.1 s, 1 call (interpretation 0, judge 1). The Lab played the person at the traffic-screen check during the replay, and the judge was still asked.

## Not verified

- **What made up the rest of the replay saving.** Only the prompt step (about 5 s) is measured step by step. The remaining roughly 4.5 s also contains the dropped chat round trip, and I did not re-run a "before" in this tree; the before numbers are t892's run.
- S9 end to end, because it is unwired. Nothing live, no Firefox, and only the two named sites.
- A layer that opens just after the presence check returns "not shown". The step is passed over and the next step meets the layer, which I expect interference handling to clear. Not exercised.

## Open questions or contradictions found

- **The brief vs. the must-not-touch list.** The brief asks for S9 "from the flow-run record", but the record is not reachable from `completion/` without edits to `attempt/` and `flow-run/`. Also, no read shape of the accepted run is kept anywhere today.
- **`step_retried` would trigger often.** The plan counts a retry as a deviation; the brief does not list it. In this run, replay step s7 failed once with `web.action.no_effect` and passed on retry, so with S9 wired this replay would have been judged.
- **The answer turn says "checked once against what you asked"** for a record acceptance, because it counts as one check. The words in `conversations/commands/answer-first/outcome.ts` may want their own case once S9 is wired.
