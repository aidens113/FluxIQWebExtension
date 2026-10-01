# t191-r5-wr: Core reports when an ask is resolved, and the Core panel shows one card per check

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t191/!FluxIQ`, branch `task/t191-extension-chat-ui`. Nothing was committed. Paths below are relative to the Core root.

## Outcome

Done, with one pre-existing failure the supervisor needs to know about. `node scripts/structure-audit.mjs` exits 1 on `runtime/llm/evidence-loop/` (26 source files, limit 25). That directory came in with the t196 merge (957a0226). I did not touch it, and it is not baselined.

Everything else the brief asked for passes:
- fluxiq vitest: 128 files, 1858 tests
- fluxiq check
- contracts check and tests
- client-gateway-websocket check
- web tsc and conversation vitest: 26 files, 260 tests
- dist rebuild

## The contract (as pinned)

`packages/contracts/src/client-gateway.ts`:
- Added `CLIENT_GATEWAY_ACTIVITY_RESOLUTIONS`, a frozen array: `["waited_out", "answered", "allowed", "declined", "timed_out"]`.
- Added `ClientGatewayActivityResolution`, a type derived from that array.
- `ClientGatewayActivity.detail` gains `resolution?: ClientGatewayActivityResolution`.
- The type comment now describes the pair of rows for one wait.

Both new names are re-exported from `packages/client-gateway-websocket/src/index.ts`.

**Bounding.** `runtime/activity/bounded.ts` keeps `resolution` only when it is one of the five values and the row's kind is `ask`. Any other `resolution` is dropped. The hub bounds every event through this function.

**Core web's local restatement.** `apps/web/.../conversation/activity/contracts.ts` gains the `ConversationActivityResolution` type and `detail.resolution`. It reads `resolution` only on an ask and only when it is a known value. An unknown value is left out; the row is not refused, and the card stays waiting.

### Example events

The event that opens a wait. Every emitter now says it this way, and `ref` is always the ask id:

```json
{
  "phase": "waiting_permission",
  "label": "FluxIQ needs you: complete the check on this page, then press Continue.",
  "detail": { "kind": "ask", "title": "Asked the person to complete a check", "status": "started", "ref": "person-needed.6f0c..." }
}
```

The event that resolves it: same unit of work, same `ref`, same `title`.

```json
{
  "phase": "building",
  "label": "You pressed Continue.",
  "detail": {
    "kind": "ask",
    "title": "Asked the person to complete a check",
    "text": "You pressed Continue.",
    "status": "succeeded",
    "ref": "person-needed.6f0c...",
    "resolution": "answered"
  }
}
```

How each resolution is worded:

| Resolution | Status | Text |
| --- | --- | --- |
| answered (robot check) | succeeded | "You pressed Continue." |
| answered (any other ask) | succeeded | "You answered." |
| allowed | succeeded | "You allowed it." |
| waited_out | succeeded | "The check cleared by itself." |
| declined (robot check) | failed | "You pressed Stop." |
| declined (any other ask) | failed | "You declined." |
| timed_out | failed | "Nobody answered in time." |

A permission ask has the title "Asked a question (permission)".

## Emission sites

All emitters live in the new `runtime/activity/ask/` directory. `ask.ts` moved into it, because three `ask-*` files would otherwise have shared a prefix. The directory holds:
- `ask.ts`: the waiting emitter. It now requires `askId` and always uses it as `ref`.
- `resolved.ts`: `emitAutomationStudioActivityAskResolved(ask, resolution, phase)`.
- `resolution.ts`: `automationStudioActivityAskResolution(ask, answer | undefined)`. It maps no answer to timed_out, `deny` to declined, a `grant` on a permission ask to allowed, and the person-needed Stop option to declined. Every other answer is answered.
- `port.ts`: `automationStudioActivityAskPort(port, phase)`, described below.
- `title.ts` and `person-needed.ts`: internal helpers, not exported from the barrel.

`runtime/parking/` still imports nothing from activity; a value import from there would close a module cycle. Callers therefore wrap the port they hand in:
- `automationStudioActivityAskPort` emits the waiting event only when the work actually waits (inside `awaitAnswer`, after `open`).
- When the answer arrives, it emits the resolved event.
- When the work was cancelled while waiting, or the thread throws, it emits no resolved event.

| Site | What emits there | Phase on resolution |
| --- | --- | --- |
| `executor/graph-run.ts`: a run's ask, person-needed or raised by a node | Its own inline waiting emission (which used `ref: currentNode.id` and the title "Waiting for a person") is replaced by the shared emitter with `ref` = ask id. After `settleAskInPlace` gives answered or expired, it emits the resolved event. A run cancelled while waiting gets none. | running |
| `executor/resume.ts`: a durably parked run that is resumed | Emits the resolved event after a settlement that was not refused | running |
| `flow-bootstrap/person-needed.ts`: a build's robot check | The port is wrapped. The old `onAsk` waiting emission and the `onCleared` "Check completed by the person" step event are removed, and the resolved event replaces both. | building |
| `flow-bootstrap/action-permissions.ts`: a build's permission ask | The port is wrapped at the `automationStudioAskedAndGranted` call. **New:** a build permission ask used to emit no waiting event at all. | building |
| `recovery/runtime-exploration.ts`: a repair's robot check and permission ask | One wrapped port serves both. The old `onAsk` and `onCleared` emissions are removed. | repairing |
| `parking/person-needed-tool-calls.ts` | Only its comment changed, to say that callers wrap the port | n/a |

Sites that emit nothing, and why:
- **`conversations/commands/answer-ask.ts`.** It runs in the chat command's context, not in the build's or run's activity scope. The waiting side wakes up (through `onAskSettled` or polling) and emits the resolved event from inside its own unit of work, so the answer is reported once, in the right unit.
- **`executor/person-needed.ts`.** It only decides whether to raise an ask. Parking and settling happen in `graph-run.ts`.
- **`action-permissions/`.** The gate raises the request; the wait happens at its callers, listed above.

## Shared UI (`packages/fluxiq/src/ui/activity-action/`)

- **`types.ts`.** `ActivityActionEvent.detail` gains `resolution?: string | undefined`.
- **`action-of.ts`, outcome.** An `ask` row's outcome now comes only from its resolution:
  - answered, allowed or waited_out: done;
  - declined or timed_out: failed;
  - no resolution, or an unknown one: waiting;
  - `status: "failed"` with no resolution: failed.

  `why` for a failed ask is "you pressed Stop" (person_check), "you said no" (permission) or "nobody answered in time".
- **`action-of.ts`, kind order.** The wait-on-a-person rule now comes before the `repairing` phase rule. Otherwise a resolved row emitted in `repairing` would have become a repair card.
- **`key.ts`.** New `activityActionKey(event)`, exported from the barrel:
  - an ask with a `ref` gives `ask:<ref>`, so the waiting and resolved rows share one key;
  - a tool or check gives `<kind>:<ref or title>`, the open-card identity the panel already used;
  - anything else gives null.

## Core panel (`apps/web/.../conversation/activity/steps/messages.ts`)

- **Inference removed.** The block that marked waiting cards done or failed on the first event outside `waiting_permission` is gone.
- **Asks are keyed.** Each ask's card is stored under `activityActionKey`. The resolved row updates that card in place: same card key, same message, no reordering. Its `said` is Core's sentence, for example "Done. You pressed Continue." or "Didn't work: you pressed Stop".
- **One card per check.** A tool whose result code names an intervention (classified `person_check`, waiting) and a robot-check ask in the same unit share one card, whichever arrives first.
  - If the ask came first, the tool event folds into the ask's card.
  - If the tool came first, the ask adopts the tool's card and stores it under its ask id.
- **Asks with no ask id.** An ask row without a `ref` that arrives while another ask's card is waiting is treated as a restatement and skipped. This is the case of `run.ts`'s "Run is waiting for an answer" for a parked run.
- **`cardOf`.** It no longer forces asks to waiting; it uses the classifier's outcome.

## Tests added or changed

- **Bounding** (`activity/tests/bounded.test.ts`). All five values are kept. An unknown value is dropped, and so is a resolution on a non-ask row. Clipping still works.
- **The `activity/ask/` emitters** (`activity/ask/tests/`):
  - `ask.test.ts` (moved): `ref` is the ask id.
  - `resolution.test.ts`: every mapping.
  - `resolved.test.ts`: the same ref, title and unit; each resolution's status and text; nothing emitted outside a scope.
  - `port.test.ts`: waiting and then answered; Stop gives declined; nobody gives timed_out; an abort or a throw emits no resolution; a port without `awaitAnswer` announces no wait.
- **Run sites** (`executor/tests/ask-activity.test.ts`). Continue, Stop and nobody-answered each give one resolved row with the same ref and title. A run cancelled while waiting gets no resolution. A parked run that is resumed gets the resolved row. A refused resume emits nothing.
- **Build sites** (real service, `tests/service-bootstrap/tests/`):
  - `person-needed.test.ts`: answered, declined and timed_out rows appear; no thread means no ask rows; the "Check completed by the person" row is gone.
  - `permission-ask.test.ts`: a build that does not wait emits no ask rows; a grant while waiting gives waiting and then allowed, keyed by the request id.
- **Repair sites** (`recovery/tests/`):
  - `runtime-exploration-person-needed.test.ts`: answered, declined and timed_out in `repairing`; a thread that throws gets no resolution.
  - `runtime-exploration-permission.test.ts`: allowed, declined and timed_out.
- **Shared classifier and key** (`ui/activity-action/tests/`):
  - `action-of.test.ts`: the resolution mapping for both kinds, including `repairing`; resolution wins over status; no inference in any phase; a failed ask with no resolution.
  - `key.test.ts`: new.
- **Panel** (`apps/web`):
  - `messages.test.ts`: a permission ask goes from waiting to done only from its resolved row. Nothing later infers the end of a wait, including a final failed event. The robot check's one card goes from waiting to done, waited_out, failed (declined) and failed (timed_out), with its key and message kept. Separate asks stay separate. A check is one card in both orders. An ask row without a ref restates the wait.
  - `model.test.ts`: the parser keeps or drops `resolution`.
  - The two old tests that encoded inference and two cards were replaced.

## Commands run and observed results

1. `cd packages/fluxiq && npx vitest run src/ui src/programs/automation-studio/runtime/activity src/programs/automation-studio/runtime/executor src/programs/automation-studio/runtime/flow-bootstrap src/programs/automation-studio/runtime/recovery src/programs/automation-studio/runtime/parking src/programs/automation-studio/runtime/tests/service-bootstrap/tests/person-needed.test.ts src/programs/automation-studio/runtime/tests/service-bootstrap/tests/permission-ask.test.ts --minWorkers=1 --maxWorkers=2`
   - Final result: `Test Files 128 passed (128)`, `Tests 1858 passed (1858)`.
   - An earlier run failed because `bounded.ts` imports the resolutions array from contracts `dist`, which was stale. After `contracts:build` it passed.
   - My own test first expected a cancelled run to end `cancelled`. It ends `failed`, because the timed-out route runs before the cancel check. I relaxed that assertion.
2. `bash .../heavy.sh "t191 wr core check" pnpm --filter fluxiq check`: `fluxiq:check` built in 46924 ms, exit 0.
3. `packages/contracts`: `pnpm check` gave `contracts:check` build with no errors. `pnpm test` gave `Tests 55 passed (55)`.
4. `packages/client-gateway-websocket`: `pnpm check` gave `client-gateway-websocket:check` build with no errors.
5. `apps/web`: `npx tsc --noEmit -p . && npx vitest run src/features/automation-studio/conversation` printed no tsc output, then `Test Files 26 passed (26)`, `Tests 260 passed (260)`, exit 0.
6. `bash .../heavy.sh "t191 wr build" node scripts/build-cache/cli.mjs contracts:build fluxiq:build client-gateway-websocket:build`, final run: contracts reused, fluxiq built (4557 files), websocket reused.
   - `dist/ui/activity-action/index.js` exports `activityActionKey`.
   - The websocket dist exports `CLIENT_GATEWAY_ACTIVITY_RESOLUTIONS`.
7. Smoke test with `node` on `dist/ui/index.js`: a waiting ask gives `ask:person-needed.1` and person_check waiting. The declined row gives the same key and `{"kind":"person_check","outcome":"failed","why":"you pressed Stop"}`.
8. `node scripts/docs-reference.mjs` wrote both `framework-reference.md` copies (2825 public declarations). The diff also carries drift from earlier tasks: new `ActivityAction*` rows, and shifted line numbers from t194, t196 and t198 work.
9. `node scripts/structure-audit.mjs`: exit 1, `1 violation(s)`, only `FAIL [directory-files] .../runtime/llm/evidence-loop/: 26 source files`. It is pre-existing and untouched by me (last changed in merge 957a0226).
   - Advisory warnings on my paths:
     - `runtime/activity/`: 16 files (was 17, so lower);
     - `graph-run.ts`: 764 lines (was 762);
     - `runtime-exploration.ts`: 706 lines (was 705).
   - It also printed "1 baseline entries can be lowered". I did not run `pnpm structure:baseline`.

## Not verified

- No browser, no Lab, no live run; the brief said so. I have not seen the cards change on screen.
- The extension is not changed. Its chat still has to read `resolution` and `activityActionKey`.
- Full `pnpm check`, `pnpm test` and `pnpm build` for Core were not run; only the package checks above.
- `waited_out` is emitted by no site. Core has no code that sees a check clear by itself after Core announced a wait for it: every person-needed wait is settled by an answer or by the timeout. The emitter, the contract, the classifier and the panel all support it, but nothing in Core produces it today. If the extension or the domain waits out a check on its own before reporting `personNeeded`, Core never announces that wait, so per the brief it emits nothing.
- I did not run the rest of `runtime/tests/service-bootstrap/`, or the other runtime directories that use `activity/index.ts`, beyond the ones listed.

## Open questions or contradictions found

1. **Pre-existing audit failure.** `runtime/llm/evidence-loop/` has 26 source files, over the limit of 25, since t196. `pnpm check` runs the structure audit first, so it will fail until that directory is split. This is outside this brief.
2. **The "Check completed by the person" step event is removed** from builds and repairs. The resolved ask row now says the same thing. If the extension used that step row, for example to clear its `UnitSituation.check`, it should read the resolved ask instead.
3. **Changes the extension will see.**
   - A run's person-needed ask now has `ref` = ask id (was the node id) and the title "Asked the person to complete a check" (was "Waiting for a person"). The extension's `chat-panel.test.ts` fixture uses the old shape.
   - A build's permission ask now emits a waiting row and a resolved row where it used to emit nothing.
4. **No resolution for some waits.** A wait whose work is cancelled, or whose thread cannot be read (unreachable), gets no resolved row, so its card stays waiting while the unit ends. The pinned set has no value for either case. If a card should say something there, the contract needs another value, such as `cancelled`.
5. **Joining a tool card to an ask card.** When a tool event with an intervention code folds into an ask card, and that tool had an earlier "started" card of its own, the started card is closed where it stands. It keeps "working", and shows no words once it is no longer the live card. In Core's own streams this does not happen: the person-needed wrapper hides intervention results from the observer, so no tool row carries an intervention code while an ask is raised. The join exists for the extension's `web.intervention.required` rows.
6. **`run.ts` still emits "Run is waiting for an answer"** as an `ask` row with no ref when a run parks durably. The panel treats it as a restatement of the waiting ask card. The extension should do the same, or Core could change that row's kind to `note`. I did not change it, because it is a run-status row and the brief did not name it.

## Follow-up: the `cancelled` resolution

This replaces open question 4 above and the "no resolution" statements in the earlier sections. Every wait that Core announced now gets a resolved row.

### What changed

- **Contract.** `CLIENT_GATEWAY_ACTIVITY_RESOLUTIONS` is now `["waited_out", "answered", "allowed", "declined", "timed_out", "cancelled"]`. The type comment defines `cancelled` as: the work stopped before anyone answered, because it was cancelled or failed while it waited, or the question could no longer be read. The comment also says that every announced wait gets a resolved row, and that a durably parked run is still waiting until it is resumed.
- **Bounding.** `bounded.ts` reads the contract's array, so `cancelled` is kept with no code change. The existing bounding test loops over the array, so it now covers `cancelled`.
- **Emitter.** `activity/ask/resolved.ts` says `cancelled` as status `failed`, text "The work stopped before this was answered."
- **Emission sites:**
  - `activity/ask/port.ts`, which covers builds and repairs, for both robot-check and permission asks:
    - The work's signal is aborted and nothing came back: `cancelled`.
    - The thread throws while the work waits: `cancelled`, emitted before the error is rethrown.
    - An answer that arrives together with an abort is still reported as the answer.
  - `executor/graph-run.ts`, for runs waiting in place:
    - The run is cancelled while waiting: `cancelled`. It used to emit nothing here.
    - `settleAskInPlace` throws because the thread is unreadable: `cancelled`, emitted before the error is rethrown.
    - A settlement that is refused and fails the run (for example an answer naming another ask): `cancelled`.
  - **Unchanged:**
    - A durable park still emits nothing, because the run is still waiting.
    - A refused resume emits nothing, because the run stays parked.
    - A person-needed ask that could not be put (the port has no `awaitAnswer`, or `open` threw) announced no wait, so it gets no resolution.
- **`fluxiq/ui`.** `activityActionOf` treats `cancelled` as outcome `failed`, with why "the work stopped first". The `types.ts` comment lists `cancelled`.
- **Core web's local restatement.** `contracts.ts` adds `cancelled` to its resolution type and to its known values.
- **Docs.** I regenerated `framework-reference.md` with `node scripts/docs-reference.mjs`.

### Tests

- **`activity/ask/tests/port.test.ts`.** An aborted wait and a thread that throws both give `failed` / `cancelled` / "The work stopped before this was answered.". New case: an answer that arrives with an abort is still `answered`.
- **`activity/ask/tests/resolved.test.ts`.** New `cancelled` row.
- **`executor/tests/ask-activity.test.ts`.** A run cancelled while waiting gives `["running", "check.attempt.2", "failed", "cancelled", ...]`. New case: an unreadable thread and a mismatched answer each give a `cancelled` row.
- **`recovery/tests/runtime-exploration-person-needed.test.ts`.** A thread that throws gives `["repairing", askId, "failed", "cancelled"]`.
- **`ui/activity-action/tests/action-of.test.ts`.** Robot check and permission with `cancelled` give outcome failed, why "the work stopped first".
- **Web `model.test.ts`.** The parser keeps `cancelled`.
- **Web `messages.test.ts`.** The robot check's one card goes from waiting to failed under `cancelled`, keeping its key and message.

### Commands run and observed results

1. `bash .../heavy.sh "t191 wr contracts build" node scripts/build-cache/cli.mjs contracts:build`: built in 3875 ms. `dist/client-gateway.js` contains `cancelled`.
2. `cd packages/fluxiq && npx tsc --noEmit -p .`: printed nothing.
3. The same fluxiq vitest command as before (src/ui, activity, executor, flow-bootstrap, recovery, parking, and the two service-bootstrap tests, `--minWorkers=1 --maxWorkers=2`): `Test Files 128 passed (128)`, `Tests 1863 passed (1863)`.
4. `bash .../heavy.sh "t191 wr core check" pnpm --filter fluxiq check`: `fluxiq:check` built in 38766 ms, exit 0.
5. `packages/contracts`: `pnpm check` built `contracts:check` with no errors. `pnpm test` gave `Tests 55 passed (55)`.
6. `packages/client-gateway-websocket`: `pnpm check` built `client-gateway-websocket:check` with no errors.
7. `bash .../heavy.sh "t191 wr build" node scripts/build-cache/cli.mjs contracts:build fluxiq:build client-gateway-websocket:build`:
   - contracts reused;
   - fluxiq built (4557 files);
   - websocket built;
   - `dist/ui/activity-action/action-of.js` has `RESOLVED_FAILED = new Set(["declined", "timed_out", "cancelled"])`.
8. `apps/web`: `npx tsc --noEmit -p . && npx vitest run src/features/automation-studio/conversation` gave `Test Files 26 passed (26)`, `Tests 261 passed (261)`, exit 0.
9. `node scripts/docs-reference.mjs`: wrote both copies (2825 public declarations).
10. `node scripts/structure-audit.mjs`: still exit 1, with only the pre-existing `FAIL [directory-files] .../runtime/llm/evidence-loop/: 26 source files`. I did not touch that directory, per the follow-up.

### Still not verified

- No browser or Lab run.
- The extension does not yet read `cancelled`.
- A build or run that fails for a reason other than cancellation, while an in-place wait is pending, is not a separate case. The wait is inside `awaitAnswer`, so the failure arrives as the work's abort signal or as a thrown error from the thread, and both now give `cancelled`. Durably parked runs are not covered by this: they stay waiting until they are resumed. There is no sweep that resolves a parked run's wait if the run is abandoned.
