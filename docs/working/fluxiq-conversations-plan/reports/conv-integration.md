# conv-integration — the conversation, connected: a run asks, a person answers, the run goes on

Task t083. Core worktree `F:\fxwork\t083\!FluxIQ`, branch
`task/t083-conversation-integration` (the worktree was sitting detached on the
old service-headroom commit; I branched it off `dev`, which carries all four
merged conversation tasks). Downstream worktree
`F:\fxwork\t083\!FluxIQWebExtension`, same branch name, unchanged by this work.
Source paths below are relative to
`packages/fluxiq/src/programs/automation-studio/`.

## Outcome

Done. **The loop closes.** A run that reaches a question posts it into the run's
own thread, waits, and is moved on by an answer given through the registered
`answer-ask` endpoint — down the branch the answer chose, with everything it had
already done still in hand and the node it stopped at never executed twice. When
nobody answers, the run takes the route the node declared for silence and the
question is closed rather than left pending forever.

That is proved by a test that uses the real pieces and nothing else: a real
`AutomationStudioService` on a temporary data directory, a real project
database, the real approval node, the conversation bound as the run's parking
port by `service.ts`, and the endpoints as `registerAutomationStudioApi`
registers them. No stub port, no fake store, no provider, no network.

There is now **one** `Ask` in Core, and it is the conversation's.

## What changed and why

### 1. One ask, and it is the thread's (`runtime/parking/ask.ts`, `answer.ts`)

`runtime/parking/` no longer declares an ask of its own. It imports the
vocabulary — kinds, statuses, the option, the routes, the timeout action, the
answer — from `runtime/conversations/`, and defines the runtime ask as

```ts
type AutomationStudioAsk = AutomationStudioConversationAskInput & { status; text; raisedBy };
```

that is, **literally what the conversation store accepts**, plus the three
things a live run holds and a stored row does not: how the question stands while
it is being asked, what it says, and where in the run it came from. The parking port therefore hands an ask to the thread
with nothing translated, and a renamed or retyped field on the durable ask is
now a compile error in the runtime rather than a silent divergence between two
records of the same question.

What moved, in consequence:

| Was (parking) | Is (the conversation's) |
| --- | --- |
| option `{ value, label, route? }` | option `{ id, label, route: string \| null }` |
| `routes { answered, denied, expired }`, all required | `routes { granted, denied, timedOut }`, each nullable |
| answer `{ askId, answeredAtMs, kind, value?: JsonValue }` | `{ askId, answeredAt, kind, value: string \| null, actorId }` |
| `missing?: readonly string[]` | `missing?: AutomationStudioActionConsequence[]` |
| `control { name?, kind? }` | `control { name: string \| null, kind: string \| null }` |
| `metadata?: Record<string, JsonValue>` | removed |

Three judgements inside that are worth arguing with:

- **A parked run keeps a *resolved* routes triple**, `AutomationStudioResolvedAskRoutes`,
  derived from the ask's own routes with `-?` rather than written out again. The
  durable ask allows a null route, meaning "none named"; a run cannot leave a
  node by a null, so the gaps are filled from
  `AUTOMATION_STUDIO_DEFAULT_ASK_ROUTES` once, when the run parks, which is also
  where `onTimeout: "deny"` is folded in. This is a derived view of the one ask,
  not a second ask.
- **`metadata` is gone.** Nothing raised it and nothing read it, and the thread
  cannot store it — a field that is dropped the moment the ask reaches a person
  is worse than no field.
- **`missing` and `consequences` are now the five Core classes**, and an
  invented one is refused at the write (see §3b). The old
  `readonly string[]` accepted anything, and it had in fact accepted something:
  `runtime/executor/tests/resume.test.ts` was raising a permission ask with
  `missing: ["external_side_effect"]`, which is not a consequence class. It is
  now `["send_or_publish"]`.

`runtime/parking/ask-effect.ts` reads a raised draft the way the store will have
to accept it: an option gets its label (its id, if it named none) and its route
(null, if it named none); a routes object keeps the routes it names and nulls
the rest instead of being dropped whole — one missing route no longer loses the
other two; a permission ask carries its request verbatim, checked at the one
field the join turns on (`requestId === askId`, which is what the store refuses
on).

`nodes/routine/approval.ts` names `{ granted, denied, timedOut }`. That is the
only change to the node.

### 2. The conversation as a parking port (`runtime/parking/conversation-port.ts`, new)

`automationStudioConversationParkingPort({ host, projectId, subject })` returns
an `AutomationStudioParkingPort`. `open(ask)` posts the question as a turn
through the writer the conversations module already exposes — the ask's text is
the turn's words, and the ask itself goes on the turn as the store's own ask
input, produced by a rest destructure so a field added to the ask reaches the
thread without being wired through here a second time.

It lives in `runtime/parking/` and takes a **host** (`writerFor`, `getAsk`,
`expireAsk`, optional `onAskSettled`) rather than the collaborator, so nothing
in it imports a store, a pool or a database, and the dependency edge runs one
way: `parking` reaches into `conversations` for types only (every one of those
imports is `import type` and is erased), while `conversations` imports the
factory as a value. There is no module cycle in the emitted graph.

**I implemented `awaitAnswer`, and the run waits in place.** The reasoning, since
the brief asked for it deliberately:

- A durable park survives a restart, but a run's inputs are never persisted
  (`startInput.metadata` carries the idempotency key and the adaptive mode and
  nothing else), and the parked record rides on the *saved* trace, which
  withholding has already cleaned. A resume through the service therefore comes
  back with `[withheld]` wherever a binding had resolved a value out of state:
  it resumes a run that has forgotten part of what it was doing.
- Waiting in place keeps every value, variable and loop position exactly as the
  run left them, because the run never returns. It also needs nothing from
  `service.ts` beyond the port itself — and `service.ts` has no room for more
  (see §4).
- What it costs is a process. A restart loses the run, though never the
  question, which is a row in the project's database and is still there to be
  answered. The run's own abort signal is the escape hatch, so
  `cancelRuntimeSession` frees a run that is waiting.
- The other cost is named in **Open questions**: `runRuntimeSession` is awaited
  by its endpoint, so the HTTP request that started the run stays open while the
  person thinks.

Waiting is a listen-then-read loop, not a poll loop. The settlement listener is
registered **before** the thread is read, because an answer written in the gap
between the two would otherwise wake nothing; the poll interval (2s by default)
is the backstop for an answer written by another process. Neither failure is
swallowed: a thread that cannot be read fails the run with the store's own
error, and a thread that no longer holds the ask fails it with a sentence that
names the ask. Waiting forever for an answer nobody can give is the silent dead
end this mechanism exists to remove — and the structure audit's
`failure-as-empty` rule said the same thing about an earlier draft of mine that
treated an unreadable thread as "nothing there yet".

### 3a. Expiry, which nothing set before (`runtime/conversations/store.ts`, `conversations.ts`)

t084 recorded `expired` as "a status with nothing that sets it" and t086 predicted
that whatever parks a run is what expires its ask. That is now true:
`AutomationStudioProjectConversationStore.expireAsk` closes a pending ask on the
change feed exactly as `answerAsk` does, and **never refuses** — an ask already
answered comes back as it stands.

That is what makes the deadline safe. At the deadline the port asks the store to
close the ask; if an answer landed first, the store hands back the answer and
the port returns *that* instead of the timeout it was about to declare. An ask
cannot end up both answered and timed out, and the arbiter is the row, not the
clock.

`AutomationStudioConversations` gained `expireAsk`, `onAskSettled` (who to wake
when an ask is settled in this process, so an answer through the API does not
wait out a poll interval) and `parkingPort`.

### 3b. The consequence vocabulary, and where the check had to go

`runtime/parking/ask-effect.ts` first validated consequence classes against
`AUTOMATION_STUDIO_ACTION_CONSEQUENCES` directly. The downstream `pnpm check`
refused it, and it was right to:

```
apps/extension check:   -> …/nodes/routine/approval.js
                        -> …/runtime/parking/index.js
                        -> …/runtime/parking/ask-effect.js
                        -> …/runtime/action-permissions/index.js
                        -> …/runtime/action-permissions/instructed.js
                        -> node:crypto
apps/extension check: the browser bundle "sidepanel" does not build.
```

`builtin.routine.approval` is in the extension's browser bundle, it imports
`runtime/parking/`, and one value import from `runtime/action-permissions/`
drags `node:crypto` in behind it. The structure audit separately forbids
reaching past a directory's barrel, so importing the leaf module was not a way
out either.

So the vocabulary now arrives in `parking` as a **type**, which is erased, and
the check moved to `runtime/conversations/inputs.ts` — the module that exists to
say what a write has to satisfy. An unrecognised class is **refused** there
rather than quietly dropped, because dropping a class out of `missing` would
understate what a permission ask is asking for, and everything that decides
whether an answer may be given in passing reads exactly that field.
`runtime/conversations/tests/inputs.test.ts` (new) pins it.

**The lasting constraint is worth writing down: `runtime/parking/` is in the
extension's browser bundle.** Anything added there must be browser-safe, and a
value import out of it is a downstream build failure, not a style question.

### 4. The service (`runtime/service.ts`) — four lines, and two compactions to pay for them

The wiring is the `runDatasets` pattern exactly: a readonly field, assigned in
the constructor, used where `onRecordBatch` is set.

```ts
readonly conversations: AutomationStudioConversations;
this.conversations = new AutomationStudioConversations(this.runtimeProjectDatabasePool);
if (input.projectId && this.conversations.available) graphOptions.parking = this.conversations.parkingPort({ projectId: input.projectId, subject: { kind: "run", id: session.runId } });
```

**The brief's line budget was wrong, and it matters.** `service.ts` is not
measured against 6,275 any more: t083's headroom work lowered the
`.structure-baseline.json` entry to its new size, and the audit's rule is
"baselined entries may shrink, never grow". The file was at 4,637 lines against a
4,638 baseline — one line of headroom, not 1,638 — and the first audit run after
the wiring failed with `4644 exceeds … baseline 4638`.

So the four lines were paid for out of the same file, by two compactions that
are tidier than what they replace rather than by cramming:

- four consecutive `export type { … } from "./service/index.ts";` statements
  became one re-export list (−3);
- the two separate imports from `"../nodes/index.ts"` became one (−1).

`service.ts` is now 4,637 lines again, exactly where it started, and the audit
passes. It still has no headroom: the next line anyone adds there has to be paid
for the same way.

### 5. Registration and scope (`api/handlers/`)

`register.ts` registers the conversation endpoints with the rest, and
`index.ts` no longer publishes `registerAutomationStudioConversationEndpoints`
separately — the comment that said it would leave "the moment it can" is
honoured.

Two things the brief did not foresee:

- **The dependency record now names the service, not the collaborator.**
  `registerAutomationStudioApi(registry, service)` must touch **nothing** on the
  service at registration time, and `tests/llm-generation.test.ts` pins that by
  registering against a service that throws on every property it does not
  expect. Reading `service.conversations` in `register.ts` broke it. The record
  now carries `service: { assertProjectDomainAccess, listProjects, conversations }`
  and each handler reads the field when it is called, exactly as the dataset
  handlers read `service.runDatasets`.
- **`DOMAIN_SCOPED` gained five endpoints, not four.** The claim that
  `list-conversations` asserts nothing is true only when it is called with
  `projectId: null`; it asserts whenever a project is named, and that suite names
  one in every call. The list and the comment above it now say so.

### 6. Tests

| File | What it pins |
| --- | --- |
| `tests/conversation-parking.test.ts` (new) | The whole loop, twice: answered, and nobody answering |
| `runtime/parking/tests/conversation-port.test.ts` (new) | The adapter's four decisions, plus a vanished ask failing rather than stranding the run |
| `runtime/conversations/tests/inputs.test.ts` (new) | A consequence class Core does not name is refused at the write |
| `runtime/parking/tests/settlement.test.ts` | Updated to the shared vocabulary; the partial-routes case now asserts the better behaviour |
| `runtime/executor/tests/resume.test.ts` | Updated to the shared vocabulary |
| `api/handlers/tests/domain-scope.test.ts` | The five conversation endpoints |
| `api/handlers/tests/conversations.test.ts` | Registers through the new dependency record |

The port test earned its place immediately: written after the end-to-end test
had already passed, it hung, and the reason was real — the settlement listener
was being registered *after* the thread was read, so an answer written in
between woke nothing and the run sat out the whole poll interval. The
end-to-end test could not see it, because its poll interval is the 2s default.
That is now fixed and pinned with a 600s poll interval, so the test can only
pass by being woken.

## Commands run and observed results

All from `F:\fxwork\t083\!FluxIQ` unless stated. Nothing was run against the
user's panel; no server was started and no port was allocated.

- `npx tsc --noEmit` in `packages/fluxiq` → clean. It is what caught the
  `external_side_effect` that was not a consequence class.
- `npx vitest run …/tests/conversation-parking.test.ts` → **`Test Files 1 passed`,
  `Tests 2 passed`**, 4.4s. Re-run with `FLUXIQ_TEST_ENV_FILES=none` → the same,
  2 passed.
- `npx vitest run …/runtime/parking` → 2 files, **15 tests passed**.
- `npx vitest run …/runtime/parking …/runtime/executor …/runtime/conversations`
  → 15 files, **228 tests passed**.
- `npx vitest run …/api/handlers …/nodes` → 25 files, **151 tests passed**
  (after the dependency-record change; before it,
  `llm-generation.test.ts` failed with `readiness accessed forbidden service
  property conversations`, which is how that problem was found).
- `node scripts/structure-audit.mjs` → **`structure-audit: passed (175
  warning(s), 360 baselined)`**. No warning names a file this task created or
  changed. (The earlier reports recorded 174 warnings; the extra one is
  `apps/web/…/conversation/thread/model.ts`, which arrived with t085 and is not
  mine.)
- `pnpm check` → structure tests, task tests, audit passed, then
  `packages/contracts`, `packages/client-gateway-websocket`, `packages/fluxiq`
  and `apps/web` each `check: Done`.
- `pnpm test` in `packages/fluxiq`, the whole package, run alone with nothing
  else on the machine → **`Test Files 338 passed (338)`, `Tests 2911 passed | 1
  skipped (2912)`**, 164s. Not one environmental failure in this run.
- `pnpm test` in `packages/fluxiq`, again after the port fix, alone, gave **`Test
  Files 338 passed (338)`, `Tests 2912 passed | 1 skipped (2913)`**, 190s. A
  third run, on the final tree, gave **`Test Files 1 failed | 338 passed (339)`,
  `Tests 2 failed | 2913 passed | 1 skipped`**: both failures are in
  `runtime/service/run-detail-read/tests/flow-run-detail-reader.test.ts`, and **I
  caused them by overlapping that run with the `apps/web` suite** -- the machine
  was under exactly the load the brief warns about. That file, run alone
  immediately afterwards: **4 passed**. Nothing in it touches a conversation, an
  ask or a parked run, and the two runs before it, each with nothing else on the
  machine, were completely green.
- `pnpm test` in `packages/contracts` gave 53 passed; in
  `packages/client-gateway-websocket`, 3 passed; in `apps/web`, **245 files,
  1302 tests passed** -- which is where t085's chat window lives, against the
  Core types this task changed.
- `pnpm build` → completed, ending in the Next.js route table for `apps/web`. Run
  twice: once before the downstream check and once after the consequence fix,
  because the downstream check compiles against Core's `dist`.
- `pnpm check` in `F:\fxwork\t083\!FluxIQWebExtension` → **the first run FAILED**, with the bundle-guard
  chain quoted in section 3b -- that is how the `node:crypto` leak into the
  extension's side panel was found. After the fix and a Core rebuild:
  **`structure-audit: passed (91 warning(s), 122 baselined)`** and all ten
  workspace projects `check: Done`.
- `git status --porcelain` in both worktrees: 19 modified and 4 new files in
  Core; the downstream worktree untouched. `runtime/llm/`,
  `runtime/flow-bootstrap/` and `apps/web/` were not edited.

## Not verified

- **No HTTP, no browser, no panel.** The endpoints were driven through
  `GlobalProgramApiRegistry.call`, which is the same seam
  `apps/web/src/app/api/programs/[programId]/[endpoint]/route.ts` calls with the
  request's scope and actor. The transport and the authentication in front of it
  are not exercised here, and neither is the chat window t085 built.
- **The durable resume path is now unexercised through the service.** Because the
  bound port always holds the run open, a `waiting` trace with a `parked` record
  never reaches `service.ts` any more, so `resumeAutomationStudioGraph` is
  covered only by t086's own tests. It still works; nothing calls it in the
  product.
- **A run parked inside a Call Flow child** is still not resumable (t086's
  limitation 2). Unchanged, and untested.
- **Nothing sweeps expired asks across processes.** Expiry is declared by
  whoever is waiting. A run whose process died leaves a pending ask that nobody
  will ever expire, and no job looks for one.
- **The permission gate does not raise asks yet.** t081's gate still refuses with
  "nobody to ask"; wiring it to raise a permission ask through this port is the
  next task, and the ask type it needs is now in place (`askPermission` files it
  under the request's own `requestId`).
- **`get-conversation-attachment` has no resolver wired**, so it throws by
  design. The service constructs `AutomationStudioConversations` with one
  argument.
- **I did not run `pnpm -r --no-bail test` from the repository root**, because
  the brief also says to run Core's tests from inside `packages/fluxiq`. I ran
  each workspace package's suite separately instead, which covers the same four
  projects; a root recursive run might interleave them and reproduce exactly the
  load-induced failures described above.
- I did not re-measure the environmental failure baseline. Two of the three full
  runs here were clean with nothing else on the machine, which says more than
  the baseline would.

## Open questions or contradictions found

1. **A parked run holds its HTTP request open.** `runtime-execution.ts` awaits
   `service.runRuntimeSession`, so the request that started the run stays open
   while the person thinks, and a proxy will time it out. The run itself is not
   lost — it goes on in the server process and the session is written when it
   finishes — but the caller is told nothing. Fixing it properly means either a
   start endpoint that returns before the run ends, or the durable resume path,
   which needs somewhere in `service.ts` to rebuild a parked run's graph options
   and therefore needs service headroom first.
2. **A parked run still holds its admission slot** (t086's open question 3), and
   in-place waiting makes that concrete: an adaptive run waiting on a person
   holds a slot for as long as the person takes. My view is the same as t086's —
   it should not, because what it waits for is a person, not a resource.
3. **`service.ts` has zero line headroom.** It is exactly on its baseline again.
   Anyone adding a line there must pay for it, and the next task that needs two
   or three should plan a collaborator move instead of hunting for compactions.
4. **The dependency direction between `parking` and `conversations` is now
   load-bearing.** `conversations` imports the port factory as a value;
   `parking` imports conversation *types* only. If anything in `parking` ever
   needs a conversation value, that becomes a real cycle, and the fix is to move
   the factory to a third place rather than to import it.
5. **`list-conversations` is not the scope exception the plan says it is.** It
   asserts the project's domain whenever a project is named. Only the
   `projectId: null` listing asserts nothing, and it cannot, because it has no
   project to assert about.
