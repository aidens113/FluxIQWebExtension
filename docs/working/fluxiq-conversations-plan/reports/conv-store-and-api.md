# conv-store-and-api — the conversation's model, persistence and API in Core

Task t084. Core worktree `F:\fxwork\t084\!FluxIQ`, branch
`task/t084-conversation-store`. Downstream worktree
`F:\fxwork\t084\!FluxIQWebExtension`, same branch name, unchanged by this work.

## Outcome

Done. Core now has a conversation: a thread attached to a subject, ordered
append-only turns, asks that are answered once, persistence in `project.sqlite`
behind migration `0021_conversations`, every write on the project change feed,
five API endpoints, and the internal seam a run, a build or a node writes turns
and raises asks through.

The full `packages/fluxiq` suite is green: 334 files, 2,880 tests, 1 skipped.
So are `pnpm check` and `pnpm build` in Core, and `pnpm check` downstream.

Both mid-task contract additions from the coordinator are in, and there is
exactly one `Ask` type:

- **`routes`** on the ask, and **`route`** on an individual option, so a parked
  run knows which branch each answer resumes down (t086's parking).
- **`projectId: null`** on `list-conversations`, meaning every project this
  caller can see, so the globally mounted prompt has something to poll.
- **`get-conversation-attachment`**, so a turn that shows something can be
  asked what it shows.
- **`consequences`** on the ask, plus
  `automationStudioConversationAskIsConsequential`, so a caller offering a fast
  way to answer can tell a question it may take in passing from one that needs
  the whole thread.

`runtime/service.ts` was not touched. It is still exactly 6,275 lines, on its
ratchet. The lines that wire this in are named in
[What must still be wired](#what-must-still-be-wired); until they exist the
endpoints are registered by their own entry point rather than by `register.ts`.

---

## What changed and why

### 1. The model — `runtime/conversations/`

A new subdirectory, as the brief required: `automation-studio/runtime/` holds
24 files of its 25 permitted, and a directory does not count toward that limit.
Nine modules, none of them loose in `runtime/`.

| File | What it holds |
| --- | --- |
| `thread.ts` | `AutomationStudioConversation`, the subject kinds (`project`, `flow`, `build`, `run`), the statuses, and `AutomationStudioConversationThread` |
| `turn.ts` | `AutomationStudioConversationTurn`, the authors, the attachment, and the 16,000-character bound on what a turn may say |
| `ask.ts` | The ask, its kinds, statuses, timeout actions, routes and consequences; the answer; and the three functions that read an ask — which answers settle it, which route it takes, and whether answering it commits something |
| `inputs.ts` | What the store will accept, and the checks that refuse anything else |
| `rows.ts` | The SQL rows, and the one-way map back to the model |
| `store.ts` | `AutomationStudioProjectConversationStore` |
| `writer.ts` | `AutomationStudioConversationWriter` — the internal seam — and `automationStudioConversationPermissionAsk` |
| `conversations.ts` | `AutomationStudioConversations`, the collaborator the service will expose |
| `index.ts` | The barrel |

Two representation choices, neither of which changes the contract:

- **`ask` and `attachment` are `| null`, not optional.** The contract writes
  them as `ask?` and `attachment?`. Under this repository's
  `exactOptionalPropertyTypes` an optional property forces either a spread at
  every construction site or an `undefined` the type refuses; `request.ts` next
  door already sets the precedent of "an absent value is `null`", and the
  contract-spread rule that covers `runtime/action-permissions` exists for
  exactly the failure a spread invites. Every field the contract names is
  present, under its own name, with its own meaning.
- **The thread carries four fields the contract's sketch does not list**:
  `title`, `revision`, `turnCount` and `pendingAskCount`. `revision` is not
  optional — `recordChange` requires a positive revision, and the change feed
  entry is what tells a reader it has not seen something. The other three are
  what a list of threads has to show without reading each thread.

### 2. Persistence — migration `0021_conversations`

Follows the run-datasets template (`0e5c447`) element by element: the numbered
migration in `storage/project/schema/conversations.ts`, re-exported from
`schema/index.ts` in migration order, appended last to
`AUTOMATION_STUDIO_PROJECT_ADMINISTRATION_MIGRATIONS`, its three tables added
to `AUTOMATION_STUDIO_PROJECT_DOMAIN_TABLES`, a store opened with
`static open({pool, projectId})` that acquires a lease, migrates and releases on
failure, and every mutation through `runIdempotent` with `recordChange` inside.

Two rules are structural rather than only enforced in code:

- `conversation_turns` has a **unique index on `(conversation_id, ordinal)`**.
  A turn's place in the thread is taken once. Two writers racing on one thread
  cannot both take ordinal N: the second insert fails and its whole turn rolls
  back, rather than landing out of order.
- `conversation_asks` carries
  `check ((status = 'answered') = (answered_at_ms is not null and answer_kind is not null))`.
  A status and an answer that disagree cannot be stored at all, so answered-once
  survives a bug in the store and not only a correct store.

**The routes and consequences columns went into `0021`, not a `0022`.** `0021`
has never been applied outside this branch's own test databases, and the
migration runner checksums each migration against its ledger entry, so a
database that had the old `0021` would refuse to open rather than drift
silently. Adding a second migration to widen a table the first one creates, in
the same unreleased change, would leave a permanent scar in the ledger for no
gain.

**Where the store lives, and why not `storage/project/`.** The run-datasets
store sits in `storage/project/`. This one sits in `runtime/conversations/`,
with the rest of the conversation. The reason is the dependency direction: a
store under `storage/` would have to import the conversation model out of
`runtime/`, which inverts the layering the rest of the program keeps, and the
type-only import that would hide it is exactly the kind of edge
`importBoundaries` exists to refuse. Everything else about the template is
unchanged, and it keeps `storage/project/` at 22 files rather than 23. The
brief's "Owns" line names `runtime/conversations/**`, which is where it went.

### 2b. One existing test had to change

`storage/project/tests/administration.test.ts` asserted
`expect(ledger.at(-1)?.migration_id).toBe(matching)` — that
`0020_adaptation_matching_columns` is the newest migration. Appending `0021`
made that false. The property the case is actually for is "a database opened
below 0020 is brought all the way to the head, and 0020's columns land", so the
assertion now reads the head off the configured list
(`AUTOMATION_STUDIO_PROJECT_ADMINISTRATION_MIGRATIONS.at(-1)?.id`) and a
separate line pins that `0020` is in the ledger. Written that way it stops
failing for every future migration, which matters because more than one task in
flight will add one.

This is the only existing test I changed, and it is a file outside my brief's
"Owns" list. It is there because my migration is what broke it.

### 3. The change feed

Every write records. On a turn: `conversation_turn` `create` at the turn's
ordinal, then `conversation` `update` at the thread's new revision. On an
answer: `conversation_ask` `update`, then `conversation` `update`. **The thing
that changed goes on the feed before the thread's own revision**, so a reader
following the feed in order never learns the thread moved before it can see
what moved it. `AutomationStudioChangeFeedEntityKind` is `… | string`, so the
three new kinds needed no contract change. A test asserts the exact feed a
thread, a turn and an answer produce, revisions included.

### 4. The endpoints

| Endpoint | Permission | Classification |
| --- | --- | --- |
| `list-conversations` | `programs.read` | `read` |
| `get-conversation` | `programs.read` | `read` |
| `get-conversation-attachment` | `programs.read` | `read` |
| `append-turn` | `programs.write` | `authoring` |
| `answer-ask` | `programs.write` | `authoring` |

Answering is `authoring`, not `destructive`. A person answering a question is
how they authorise a consequential act; the act itself is still gated where it
happens. PIN-gating the answer would put the ceremony on the wrong side of the
question, and it would change the pinned `PIN_GATED` list in
`programs/tests/endpoint-classification.test.ts`, which is a security statement
and not mine to move.

**Every project-scoped handler asserts `assertProjectDomainAccess` before it
reads anything**, for the reason the dataset handlers do: a thread holds free
text, and some of it came out of a domain — the control named on a permission
ask, the sentence Core built around it. That is stored content.

Two shapes the contract's endpoint list does not spell out, both forced by how
this program works:

- **`answer-ask` carries `projectId` as well as `askId`**, because the project
  is which database to open. The ask is still found by `askId` alone.
- **`get-conversation` takes a `limit` and answers `hasMore`.** A thread has no
  bound on its length.

### 4b. `projectId: null` — how the entitlement is scoped

When `projectId` is null the handler calls
`service.listProjects(request.scope.domainId)` and searches those projects in
turn, stopping once the shared page limit is filled.

That is deliberately **the same call the `projects` endpoint itself makes**, so
there is one answer in the product to "what may this caller see" rather than two
that can drift apart. It also means there is no per-project refusal to catch and
skip: a project outside the scope is not in the list at all, so nothing here
swallows a failure in order to decide entitlement — which is what a `for` loop
around `assertProjectDomainAccess` inside a `try` would have been.

The cost is honest and worth stating: this opens one project database per
project until the limit fills, and the prompt that needs it polls. For a handful
of projects that is fine; for hundreds it is not, and the fix is a global index
of threads with a pending ask rather than a fan-out. I did not build one,
because it is a second store and the contract did not ask for it. See the open
questions.

### 4c. `get-conversation-attachment`

The thread stores an attachment's `kind` and `ref` and renders nothing — that is
the design, and it is why a new kind of thing to show needs no change to the
conversation. So Core cannot turn a `ref` into a payload by itself.

The endpoint therefore reads the turn and hands its attachment to an
**attachment resolver** the collaborator is constructed with. With no resolver
configured it **throws** — "This deployment cannot serve a conversation
attachment of kind `graph-diff`" — rather than answering an empty payload,
because a reader must be able to tell "this turn shows nothing" (which answers
null) from "this turn shows something nothing here can fetch". A test pins both.

Wiring a real resolver is the follow-up: it is one argument on the same
constructor line the supervisor has to add anyway, and the obvious first
implementation serves what Core already stores — objects from the
content-addressed store — while a dataset preview or a run's detail stays behind
its own endpoint.

### 5. The internal seam

`AutomationStudioConversationWriter`, from
`conversations.writerFor({ projectId, subject })`. Code with something to say
names its subject once; the thread is opened on the first thing it says and
reused for everything after, so a run, a build or a node never carries a
conversation id through the call stack.

```ts
const writer = service.conversations.writerFor({ projectId, subject: { kind: "run", id: runId } });
await writer.say("I am about to schedule the post.");
await writer.askPermission(request, { routes: { granted: "route.publish", denied: "route.hold", timedOut: "route.hold" } });
await writer.ask({ text: "Which listing did you mean?", ask: { askId, kind: "choice", parks: true, options } });
```

`askPermission` takes the `AutomationStudioActionPermissionRequest` the gate
already builds, files it as an ask **keyed by that request's own `requestId`**,
with Core's own `sentence` as the turn's words, `missing` as what a later grant
must add, `consequences` as what the action would do, and the request stored
whole. The payload does not change — `request.ts:1-12` said `requestId` is "the
key a store would hold it under", and this is that store. A permission ask whose
`askId` is not its request's `requestId` is refused at the write, because that
is the one mistake that would quietly break the join between the run that
stopped and the person who answers a day later.

`parks` defaults to `true` on a permission ask: a question that ends the run is
what this replaces.

**A subject has one open thread, and the writer finds it.** A run raises a
permission ask from the gate and posts a progress turn from the executor; those
are two call sites with no conversation id between them. If each opened its own
thread the person would be shown one run as three conversations. So
`openConversation` without an explicit id continues the subject's most recently
touched **open** thread and mints one only when there is none; a resolved thread
is left resolved, so the next thing said about that subject starts fresh. A test
proves two writers for one run share a thread and take ordinals 1 and 2, while a
different run gets its own.

A writer does not remember a failed open. Caching the rejected promise would let
one unavailable database silence a writer for the rest of the run — which is
exactly the run that most needs to be able to speak.

### 6. Routes — and why they belong on the ask

I agree with the coordinator, and the reasoning is worth recording because it is
the reason there can be one `Ask` and not two.

An ask that parks a run has to say what "approved" and "rejected" *mean* in
graph terms, and it has to say it **when the question is posed, not when it is
answered**. Put `routes` on the parked run instead and the same answer can mean
different things to different resumers, and an ask read on its own — in the
thread, in the prompt, in a listing — cannot say what answering it would do. The
approval node already ships prompt, timeout and default route as one thing; this
is that shape, made durable.

```ts
routes: { granted: string | null; denied: string | null; timedOut: string | null }
options: Array<{ id: string; label: string; route: string | null }>
```

`granted` is taken on `grant`, on `text`, and on a `choice` whose option names
no route of its own; `denied` on `deny` and on a timeout whose `onTimeout` is
`deny`; `timedOut` on a timeout whose `onTimeout` is `default`. A null route
means none was named and the run resumes where it parked. Core does not
interpret a route id — it carries it, which is what keeps this domain-neutral.

`automationStudioConversationAskRoute(ask)` is the one place that mapping lives,
so parking consumes a function rather than re-deriving it. A second copy of that
mapping is the defect the function exists to prevent.

### 7. Whether an ask may be answered in passing

`consequences` on the ask carries every lasting consequence answering yes would
have, in Core's existing five-class vocabulary. A permission ask takes them from
its request automatically; a `confirm` or `choice` that commits something says
so itself.

`automationStudioConversationAskIsConsequential(ask)` is the derivation a caller
uses. It reads a permission ask's `missing` (what granting actually does) and
any other ask's `consequences`, and answers true if any class is in
`AUTOMATION_STUDIO_CONVERSATION_CONSEQUENTIAL_CLASSES`: `move_money`, `delete`,
`modify_existing`, `send_or_publish`.

That set is a judgement and should be reviewed. It is the standing product rule
read back — completing a purchase, deleting and editing existing data need the
person's real say-so — plus `send_or_publish`, which I added because it reaches
other people and cannot be taken back. Only `create_new` is left out, as the one
class that undoes cleanly. If the supervisor wants publishing answerable from
the prompt, that is a one-line change to the frozen list, and the list is a named
export precisely so it is reviewable rather than buried in an `if`.

---

## What must still be wired

1. **`runtime/service.ts`** — two lines, once t083 has made headroom. Beside
   `readonly runDatasets: AutomationStudioRunDatasets;` at **line 655**:

   ```ts
   /** Conversations: the thread FluxIQ and a person talk in, reached as a field so the frozen facade gains no methods (C8). */
   readonly conversations: AutomationStudioConversations;
   ```

   and beside `this.runDatasets = new AutomationStudioRunDatasets(...)` at
   **line 721**:

   ```ts
   this.conversations = new AutomationStudioConversations(this.runtimeProjectDatabasePool);
   ```

   `AutomationStudioConversations` is already exported from `runtime/index.ts`,
   so `service.ts` needs no new import. A plain property declaration does not
   count toward the 223-method ceiling; the 6,275-line ratchet is the only thing
   in the way, and this is +2. A second constructor argument adds the attachment
   resolver when one exists.

2. **`api/handlers/register.ts`** — one import and one call, after
   `registerRunDatasetEndpoints(dependencies);`:

   ```ts
   registerAutomationStudioConversationEndpoints({ registry, service, conversations: service.conversations });
   ```

   The handler module takes its own dependency record — the registry, a
   `{ assertProjectDomainAccess, listProjects }` port, and the collaborator —
   precisely so that this is the whole of it.

3. **`api/handlers/tests/domain-scope.test.ts`** — its `DOMAIN_SCOPED` list must
   gain `get-conversation`, `get-conversation-attachment`, `append-turn` and
   `answer-ask` in the same commit as step 2, with a line in its header saying
   why (a thread holds free text that came out of a domain).
   `list-conversations` is the exception and asserts nothing, because with
   `projectId: null` there is no project to assert about — it searches exactly
   the projects `listProjects` returns for the request's domain. That suite reads
   the set by calling every *registered* endpoint, so it is green today and turns
   red the moment the endpoints are registered without the list being updated.
   That is the rule working, not a defect.

After step 1, `api/handlers/index.ts` can stop publishing
`registerAutomationStudioConversationEndpoints`; the comment there says so.

---

## Commands run and observed results

All from `F:\fxwork\t084\!FluxIQ` unless stated.

- `npx tsc --noEmit` in `packages/fluxiq` → clean. It caught two real defects
  vitest could not: the handler test passed `scope: { kind: "global", … }` when
  `ProgramScope` has only `domainId`, and adding `route` to the ask option made
  every existing option literal a compile error until it was carried through.
- `npx vitest run src/programs/automation-studio/runtime/conversations src/programs/automation-studio/api/handlers/tests/conversations.test.ts`
  → `Test Files 3 passed (3)`, `Tests 31 passed (31)`.
- `node scripts/structure-audit.mjs` →
  `structure-audit: passed (174 warning(s), 361 baselined).` The same warning
  count as before this work. An earlier draft of `store.ts` was 412 lines and
  added a 175th advisory warning, so the write-shapes and their checks moved into
  `inputs.ts`; `store.ts` is now 345.
- `pnpm check` → `pnpm structure:test` and `pnpm task:test` passed, structure
  audit passed, then `packages/contracts`, `packages/client-gateway-websocket`,
  `packages/fluxiq` and `apps/web` each `check: Done`.
- `pnpm build` → completed, ending in the Next.js route table for `apps/web`.
- `pnpm check` in `F:\fxwork\t084\!FluxIQWebExtension` →
  `structure-audit: passed (91 warning(s), 122 baselined)`, then all ten
  workspace projects `Done`.
- `wc -l packages/fluxiq/src/programs/automation-studio/runtime/service.ts` →
  `6275`. Unchanged, exactly on its ratchet.
- `git status --porcelain` → eight modified files and five new paths.
  `runtime/service.ts`, `runtime/llm/`, `runtime/flow-bootstrap/`,
  `runtime/action-permissions/`, `runtime/executor/` and `apps/web/` are all
  untouched.
- `npx vitest run` in `packages/fluxiq`, the whole suite, after every change
  above → **`Test Files 334 passed (334)`, `Tests 2880 passed | 1 skipped
  (2881)`.** Green, with nothing else running on the machine.

### The full suite, and what two earlier red runs actually said

The final run above is clean. Two earlier full runs were not, and the chase is
worth recording because the first conclusion I reached from it was wrong.

Those runs (2,873 tests, 334 files):

- run 1 → `Test Files 15 failed | 319 passed`, `Tests 20 failed | 2852 passed`.
- run 2 → `Test Files 17 failed | 317 passed`, `Tests 22 failed | 2846 passed`.

**The two runs failed almost entirely different tests**, and every single
failure is a `Test timed out in 15000ms.` or a Windows file-lock error
(`EBUSY: resource busy or locked, unlink … project.sqlite`,
`ENOTEMPTY: directory not empty, rmdir …`). Not one is an assertion, and none
names a conversation, a migration, a table or an endpoint.

I chased it rather than assuming:

1. Re-ran the nine failing `service-*` files together → 13 failures, again a
   different set within the same files.
2. Ran `adaptive-loop.test.ts` alone → **passed**, 18.9 s for two tests against
   a 15 s per-test timeout.
3. Ran `adaptive-loop.test.ts` and `durable-patches.test.ts` together → **both
   passed**, 13.5 s and 16.5 s.
4. Disabled migration `0021` and ran those two files → passed. That looked
   damning until step 3 showed they pass *with* it: the variable was the number
   of files running at once, not the migration. **My first probe was not a
   controlled comparison, and I nearly reported it as one.**
5. Measured the migration directly — 20 fresh project databases, with and
   without `0021`, four times:

   | run | without | with | per database |
   | --- | --- | --- | --- |
   | 1 | 45,624 ms | 6,467 ms | −1,958 ms |
   | 2 | 3,602 ms | 4,692 ms | +55 ms |
   | 3 | 4,128 ms | 4,478 ms | +18 ms |
   | 4 | 6,623 ms | 11,187 ms | +228 ms |

   The identical workload ranges from 3.6 s to 45.6 s on this machine right now,
   and one run has the migration making things seven times *faster*. The noise is
   an order of magnitude larger than the signal. The least-loaded runs put `0021`
   at roughly 20–50 ms per fresh project database, paid once per database.

So: these are heavy service tests that legitimately run at 8–17 s against a 15 s
timeout, on a machine with several agents working at once. For comparison,
another worker's full Core run at 13:00 today, on a different branch, was also
red — `scale-pages.test.ts` and `assets.test.ts` — so a green Core suite is not
the current baseline either.

6. Ran the whole suite again with nothing else on the machine → **334 files,
   2,880 tests, all passed**.

That is the answer: the red runs were machine contention, not this change.
Heavy service tests legitimately run at 8-17 s against a 15 s per-test timeout,
several agents were working on this machine at once, and I was myself running
targeted tests alongside two of those runs. The measured cost of `0021` is
20-50 ms per fresh project database, far below the noise floor, and the suite is
green once the machine is quiet.

The lesson for anyone reading a red Core suite here: check whether the failures
are assertions or timeouts before believing them, and re-run the failing files
with nothing beside them.

### What the tests prove

`runtime/conversations/tests/store.test.ts` (15 cases), against a real
`project.sqlite`:

- migration `0021` installs its three tables and five indexes, records itself in
  `automation_schema_migrations`, and its answered-once check refuses a row whose
  status and answer disagree;
- turns append and the thread reads back in the order it was said, with author,
  actor, attachment and revision;
- `sinceTurnId` returns only what followed, and an unknown `sinceTurnId` is
  **refused** rather than read as "from the start" — answering it with the whole
  thread would look exactly like a thread that had been rewritten;
- a `limit` pages the thread and `hasMore` says the limit cut it short;
- an action-permission request round-trips whole and is keyed by its own
  `requestId`; one keyed by anything else is refused;
- routes round-trip, an unanswered ask takes no branch, and a denial takes
  `denied`;
- an option's own `route` overrides the ask's `granted` route;
- a permission ask refused `send_or_publish` is consequential, a `confirm` that
  only creates something is not, and an open question is not;
- one turn reads back on its own, which is how an attachment is resolved;
- an ask answers once and a second, different answer is refused;
- an exact resend of the same answer replays instead of writing twice;
- an answer that does not settle the question it was asked is refused, as is a
  choice naming no option;
- the change feed carries exactly `conversation/create`,
  `conversation_turn/create`, `conversation/update`, `conversation_ask/update`,
  `conversation/update`, at revisions 1,1,2,3,3;
- listing narrows by subject and status, newest first;
- an empty turn, one past 16,000 characters, and one on a thread that does not
  exist are each refused.

`runtime/conversations/tests/conversations.test.ts` (7 cases): the writer opens
the subject's thread once and keeps it; two writers on one run share a thread
while a different run gets its own; `askPermission` files the gate's payload as a
parking ask keyed by `requestId` and the answer settles it once; a person's turn
and a `sinceTurnId` read; a listing narrowed to one subject and a choice settled
by naming an option; an attachment served through a resolver, with the difference
between "shows nothing" and "cannot be served" pinned; and, with no pool,
`available` is `false` and every path says `Conversations require project
storage.` rather than pretending.

`api/handlers/tests/conversations.test.ts` (9 cases): the five registrations and
their permission and classification; the domain-scope assertion fires **before**
the collaborator is called, on every project-scoped endpoint; each endpoint
reaches its collaborator method once the scope is allowed; a `programs.read`
caller is refused the two writes; the person's own id reaches the turn and the
answer; a `sinceTurnId` read passes through; `projectId: null` searches every
project `listProjects` returns for the domain and asserts nothing per project;
the search stops once the limit is filled; and five malformed payloads are
refused at the handler without the collaborator being called at all.

---

## Not verified

- **The other workspace packages' test suites.** I ran `packages/fluxiq` in
  full and green, plus `pnpm check` (which type-checks all four) and
  `pnpm build` (which builds all four). I did not run `packages/contracts`,
  `packages/client-gateway-websocket` or `apps/web` test suites; nothing in this
  change reaches them, and another worker's `pnpm -r test` earlier today had
  them at 9, 1 and 240 files passing.
- **No live browser or panel validation.** There is no UI for any of this;
  `apps/web` is t086's and was not touched.
- **No live provider run.** Nothing here calls a model.
- **The seam has no caller yet.** `writerFor`, `askPermission` and
  `automationStudioConversationAskRoute` are proved by their own tests, not by a
  build, a run or parking actually using them.
- **No attachment resolver exists.** The endpoint and the seam are tested with a
  stub resolver; nothing real resolves a `ref` yet.
- **Nothing expires an ask.** `timeoutMs`, `onTimeout` and the `expired` status
  are recorded and read back, and `automationStudioConversationAskRoute` handles
  the expired case, but no sweep sets it.
- **Concurrency is argued, not measured.** The unique index on
  `(conversation_id, ordinal)` means a racing second writer's turn rolls back. I
  did not write a test that races two writers.
- **Two writers for one subject could still both open a thread** if they raced
  before either had written. The lookup is a read then a write, not an upsert. A
  partial unique index on `(subject_kind, subject_id) where status = 'open'`
  would make it structural, at the cost of turning a benign duplicate into a hard
  error; I left it, and it is worth a decision.
- **`docs/architecture/automation-studio/persistence.md` was not updated.** It is
  the authored home for what `project.sqlite` holds, and three new tables belong
  in it. I left it alone deliberately: it is shared with tasks running now, my
  brief partitions by file, and a conflict there costs more than it saves. Real
  follow-up work, not an optional tidy.

---

## Open questions and things the supervisor should decide

1. **A parked ask can outlive any run that could resume it.** t086 found that run
   inputs are deliberately never persisted, so a durable cross-process resume
   cannot restore withheld values while an in-place wait loses nothing. My store
   makes the *question* durable forever; it cannot make the *run* durable. So an
   ask that parks a run and is answered after the process is gone leaves an
   answer with nothing to resume. That is not fatal — the existing behaviour
   already covers it, because a permission answer widens the grant of a *later*
   run and the request travels whole — but it means a parked ask should probably
   carry an expiry past which it is answered for the record rather than for a
   resume, and nothing decides that today. It also argues against long
   `timeoutMs` values in the first caller.
2. **Nothing sets `expired`.** Whatever parks a run has to be the thing that
   expires its ask, so the sweep belongs with the resume path rather than here.
   But a timeout that never fires is worse than no timeout, so `timeoutMs`
   should not be shown to a person as if it worked until something sweeps.
3. **The consequential-class list is a judgement.** §7 above. `send_or_publish`
   is mine to defend and yours to overrule.
4. **The across-projects listing is a fan-out, and the prompt polls it.** One
   project database opened per project until the limit fills. Fine for a handful
   of projects, wrong for hundreds. The fix is a global index of threads with a
   pending ask — a second store, which the contract did not ask for and which I
   did not build.
5. **Nothing resolves a thread.** `status` is `open | resolved` and no endpoint
   moves it. I stored the field, defaulted it to `open`, and built no way to
   change it rather than inventing a sixth endpoint. Someone has to decide
   whether resolving is a person's act, a consequence of every ask being
   answered, or something the automation does when the work finishes. This now
   matters more than it did: "the subject's open thread" is what the writer
   continues, so nothing ever starts a second thread about a subject until
   something can resolve the first.
6. **A turn's text is stored inline, bounded at 16,000 characters**, refusing
   rather than truncating past it. Discovery suggested long bodies belong in the
   object store with metadata in SQL. Inline is right for a sentence and wrong
   for a diff — and `attachment.ref` plus `get-conversation-attachment` is now
   the answer for the long things, so inline stays right and the bound could come
   down.
7. **There is no cursor on either read.** Both clamp through the shared
   1–200/default-50 helper and `get-conversation` answers `hasMore`, but a caller
   wanting page three of a long thread walks it with `sinceTurnId`. That is the
   natural shape for a thread and a poor one for a list of threads.
8. **`builtin.routine.approval` is still dead.** Decision 1 in the plan says it
   becomes live and converges here. Nothing in this task consumes
   `routine.approval.requested` or resumes a `waiting` run — but the ask shape it
   needs is now storable in full: a prompt, a timeout, a default route, and
   parking. Its `defaultRoute` maps to `routes.timedOut`, its prompt to the
   turn's text, and its approve/reject to `routes.granted` / `routes.denied`.
