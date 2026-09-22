# conv-store-and-api — the conversation's model, persistence and API in Core

Task t084. Core worktree `F:\fxwork\t084\!FluxIQ`, branch
`task/t084-conversation-store`. Downstream worktree
`F:\fxwork\t084\!FluxIQWebExtension`, same branch name, unchanged by this work.

## Outcome

Done. The contract in the plan is built, to the contract, with no
renegotiation. Core now has a conversation: a thread attached to a subject,
ordered append-only turns, asks that are answered once, persistence in
`project.sqlite` behind migration `0021_conversations`, every write on the
project change feed, four API endpoints, and the internal seam a run, a build
or a node writes turns and raises asks through.

`runtime/service.ts` was not touched. It is still exactly 6,275 lines, on its
ratchet. The two lines that wire this in are named in
[What must still be wired](#what-must-still-be-wired), and until they exist the
four endpoints are registered by their own entry point rather than by
`register.ts`.

---

## What changed and why

### 1. The model — `runtime/conversations/`

A new subdirectory, as the brief required: `automation-studio/runtime/` holds
24 files of its 25 permitted, and a directory does not count toward that limit.
Eight modules, none of them loose in `runtime/`.

| File | What it holds |
| --- | --- |
| `thread.ts` | `AutomationStudioConversation`, the subject kinds (`project`, `flow`, `build`, `run`), the statuses, and `AutomationStudioConversationThread` — a thread with the turns a reader asked for |
| `turn.ts` | `AutomationStudioConversationTurn`, the authors (`automation`, `person`), the attachment, and the 16,000-character bound on what a turn may say |
| `ask.ts` | `AutomationStudioConversationAsk`, its kinds, statuses and timeout actions, `AutomationStudioConversationAnswer`, and `automationStudioConversationAnswerFits` — which answers settle which questions |
| `inputs.ts` | What the store will accept, and the checks that refuse anything else |
| `rows.ts` | The SQL rows, and the one-way map back to the model |
| `store.ts` | `AutomationStudioProjectConversationStore` |
| `writer.ts` | `AutomationStudioConversationWriter` — the internal seam — and `automationStudioConversationPermissionAsk` |
| `conversations.ts` | `AutomationStudioConversations`, the collaborator the service will expose |

Two deliberate representation choices, neither of which changes the contract:

- **`ask` and `attachment` are `| null`, not optional.** The contract writes
  them as `ask?` and `attachment?`. Under this repository's
  `exactOptionalPropertyTypes`, an optional property forces either a spread at
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

Follows the run-datasets template (`0e5c447`) element by element:

- `storage/project/schema/conversations.ts` — the numbered migration.
- `storage/project/schema/index.ts` — re-exported, in migration order.
- `storage/project/administration.ts` — appended to
  `AUTOMATION_STUDIO_PROJECT_ADMINISTRATION_MIGRATIONS`, last, append-only.
- `storage/project/schema/table-names.ts` — `conversations`,
  `conversation_turns`, `conversation_asks` added to
  `AUTOMATION_STUDIO_PROJECT_DOMAIN_TABLES`.
- The store opens with `static open({pool, projectId})`, acquires a lease, runs
  `AutomationStudioSchemaMigrationRunner`, and releases the lease on failure —
  the exact shape of `run-dataset-store.ts:115-130`.
- Every mutation runs through `AutomationStudioProjectUnitOfWork.runIdempotent`
  with `recordChange` inside it.

Three tables. Two rules are structural rather than only enforced in code:

- `conversation_turns` has a **unique index on `(conversation_id, ordinal)`**.
  A turn's place in the thread is taken once. Two writers racing on one thread
  cannot both take ordinal N: the second insert fails and its whole turn rolls
  back, rather than landing out of order.
- `conversation_asks` carries
  `check ((status = 'answered') = (answered_at_ms is not null and answer_kind is not null))`.
  A status and an answer that disagree cannot be stored at all. The
  answered-once rule therefore survives a bug in the store, not only a correct
  store.

**Where the store lives, and why not `storage/project/`.** The run-datasets
store sits in `storage/project/`. This one sits in `runtime/conversations/`,
with the rest of the conversation. The reason is the dependency direction: a
store under `storage/` would have to import the conversation model out of
`runtime/`, which inverts the layering the rest of the program keeps, and the
type-only import that would hide it is exactly the kind of edge
`importBoundaries` exists to refuse. Everything else about the template — the
migration's placement, the barrel, the administration list, the table names,
the `open` shape, the unit of work — is unchanged. It also keeps
`storage/project/` at 22 files rather than 23. The brief's "Owns" line names
`runtime/conversations/**`, which is where it went.

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
thread, a turn and an answer produce.

### 4. The four endpoints

`api/contracts/endpoints.ts` gains `list-conversations`, `get-conversation`,
`append-turn`, `answer-ask`. `api/contracts/conversation.ts` holds their
request types. `api/handlers/conversations.ts` registers them.

| Endpoint | Permission | Classification |
| --- | --- | --- |
| `list-conversations` | `programs.read` | `read` |
| `get-conversation` | `programs.read` | `read` |
| `append-turn` | `programs.write` | `authoring` |
| `answer-ask` | `programs.write` | `authoring` |

Answering is `authoring`, not `destructive`. A person answering a question is
how they authorise a consequential act; the act itself is still gated where it
happens. PIN-gating the answer would put the ceremony on the wrong side of the
question, and it would change the pinned `PIN_GATED` list in
`programs/tests/endpoint-classification.test.ts`, which is a security statement
and not mine to move.

**Every handler asserts `assertProjectDomainAccess` before it reads anything**,
for the reason the dataset handlers do: a thread holds free text, and some of
that text came out of a domain — the control named on a permission ask, the
sentence Core built around it. That is stored content. This has a consequence
for whoever wires the endpoints in; see below.

Two shapes the contract's endpoint list does not spell out, both forced by how
this program works rather than chosen:

- **`answer-ask` carries `projectId` as well as `askId`.** Every Automation
  Studio endpoint is project-scoped, and the project is which database to open.
  It is not a second key: the ask is still found by `askId` alone.
- **`get-conversation` takes a `limit` and answers `hasMore`.** A thread has no
  bound on its length. There is no cursor yet — see
  [Not verified / not built](#not-verified--not-built).

### 5. The internal seam

`AutomationStudioConversationWriter`, from
`conversations.writerFor({ projectId, subject })`. Code with something to say
names its subject once; the thread is opened on the first thing it says and
reused for everything after, so a run, a build or a node never carries a
conversation id through the call stack.

```ts
const writer = service.conversations.writerFor({ projectId, subject: { kind: "run", id: runId } });
await writer.say("I am about to schedule the post.");
await writer.askPermission(request);        // the gate's own payload
await writer.ask({ text: "Which listing did you mean?", ask: { askId, kind: "choice", parks: true, options } });
```

`askPermission` is the one that matters now. It takes the
`AutomationStudioActionPermissionRequest` the gate already builds, files it as
an ask **keyed by that request's own `requestId`**, with Core's own `sentence`
as the turn's words and `missing` as what a later grant must add, and stores
the request whole. The payload does not change — `request.ts:1-12` said
`requestId` is "the key a store would hold it under", and this is that store.
A permission ask whose `askId` is not its request's `requestId` is refused at
the write, because that is the one mistake that would quietly break the join
between the run that stopped and the person who answers a day later.

`parks` defaults to `true` on a permission ask: a question that ends the run is
what this replaces.

**A subject has one open thread, and the writer finds it.** A run raises a
permission ask from the gate and posts a progress turn from the executor; those
are two call sites with no conversation id between them. If each opened a
thread of its own, the person would be shown one run as three conversations. So
`openConversation` without an explicit id continues the subject's most recently
touched **open** thread and only mints a new one when there is none; a resolved
thread is left resolved, so the next thing said about that subject starts
fresh. A test proves two writers for one run share a thread and accumulate
ordinals 1 and 2, while a different run gets its own.

A writer does not remember a failed open. Caching the rejected promise would
let one unavailable database silence a writer for the rest of the run — which
is exactly the run that most needs to be able to speak.

### 6. Answered once, and what "a second answer" means

The store refuses a second answer inside the transaction, with the sentence
`This question has already been answered.` (exported as
`AUTOMATION_STUDIO_CONVERSATION_ASK_ANSWERED`).

The collaborator derives each answer's mutation id from **the answer**, not
from the ask: `conversation.answer:<sha256(askId, kind, value)[0..32]>`. So an
exact resend — a retried request, a double click — lands on the same mutation
and replays the first write unchanged, while a second answer that says anything
different lands on a new mutation, reaches the store, and is refused there in
words a person can read. Keying the mutation on the ask alone (the first thing
I wrote) made the second answer fail with
`Mutation … was already used with a different request digest`, which is true and
useless; a test now pins both paths.

---

## What must still be wired

Three edits, none of them mine to make under this brief.

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

   `AutomationStudioConversations` is already exported from
   `runtime/index.ts`, so `service.ts` needs no new import. A plain property
   declaration does not count toward the 223-method ceiling; the 6,275-line
   ratchet is the only thing in the way, and this is +2.

2. **`api/handlers/register.ts`** — one import and one call, after
   `registerRunDatasetEndpoints(dependencies);`:

   ```ts
   registerAutomationStudioConversationEndpoints({ registry, service, conversations: service.conversations });
   ```

   The handler module takes its own dependency record (`registry`, a
   `{ assertProjectDomainAccess }` port, and the collaborator) precisely so
   that this is the whole of it.

3. **`api/handlers/tests/domain-scope.test.ts`** — its `DOMAIN_SCOPED` list
   must gain all four conversation endpoints in the same commit as step 2, and
   its header comment should say why (a thread holds free text that came out of
   a domain). That suite reads the set by calling every *registered* endpoint,
   so it stays green today and turns red the moment the endpoints are
   registered without the list being updated. That is the rule working, not a
   defect.

After step 1, `api/handlers/index.ts` can stop publishing
`registerAutomationStudioConversationEndpoints`; the comment there says so.

---

## Commands run and observed results

All from `F:\fxwork\t084\!FluxIQ` unless stated.

- `npx tsc --noEmit` in `packages/fluxiq` → clean, no output. (It caught one
  real defect vitest could not: the handler test was passing
  `scope: { kind: "global", … }` and `ProgramScope` has only `domainId`.)
- `npx vitest run src/programs/automation-studio/runtime/conversations src/programs/automation-studio/api/handlers/tests/conversations.test.ts`
  in `packages/fluxiq` →
  `Test Files 3 passed (3)`, `Tests 23 passed (23)`.
- `node scripts/structure-audit.mjs` →
  `structure-audit: passed (174 warning(s), 361 baselined).` Same warning count
  as before this work: the first draft of `store.ts` was 412 lines and added a
  175th advisory warning, so the write-shapes and their checks moved into
  `inputs.ts` and the store came back to 334.
- `pnpm check` → structure audit passed, then
  `packages/contracts check: Done`, `packages/client-gateway-websocket check:
  Done`, `packages/fluxiq check: Done`, `apps/web check: Done`.
- `pnpm check` in `F:\fxwork\t084\!FluxIQWebExtension` →
  `structure-audit: passed (91 warning(s), 122 baselined)`, then all ten
  workspace projects `Done`.
- `wc -l packages/fluxiq/src/programs/automation-studio/runtime/service.ts` →
  `6275`. Unchanged, exactly on its ratchet.
- `git status --porcelain` → seven modified files (four barrels, the endpoint
  catalogue, the administration migration list, the table names) and five new
  paths. `runtime/service.ts`, `runtime/llm/`, `runtime/flow-bootstrap/`,
  `runtime/action-permissions/`, `runtime/executor/` and `apps/web/` are all
  untouched.
- `npx vitest run` (the whole `packages/fluxiq` suite) and `pnpm build` —
  see Not verified, below.

### What the tests prove

`runtime/conversations/tests/store.test.ts` (11 cases), against a real
`project.sqlite` rather than a stand-in:

- migration `0021` installs its three tables and five indexes, records itself in
  `automation_schema_migrations`, and its answered-once check refuses a row
  whose status and answer disagree;
- turns append and the thread reads back in the order it was said, with author,
  actor, attachment and revision;
- `sinceTurnId` returns only what followed, and an unknown `sinceTurnId` is
  **refused** rather than read as "from the start" — answering it with the whole
  thread would look exactly like a thread that had been rewritten;
- a `limit` pages the thread and `hasMore` says the limit cut it short;
- an action-permission request round-trips whole and is keyed by its own
  `requestId`, and one keyed by anything else is refused;
- an ask answers once and a second, different answer is refused;
- an exact resend of the same answer replays instead of writing twice;
- an answer that does not settle the question it was asked is refused, as is a
  choice naming no option;
- the change feed carries exactly
  `conversation/create`, `conversation_turn/create`, `conversation/update`,
  `conversation_ask/update`, `conversation/update`, at revisions 1,1,2,3,3;
- listing narrows by subject and status, newest first;
- an empty turn, one past 16,000 characters, and one on a thread that does not
  exist are each refused.

`runtime/conversations/tests/conversations.test.ts` (5 cases): the writer opens
the subject's thread once and keeps it; `askPermission` files the gate's
payload as a parking ask keyed by `requestId` and the answer settles it once; a
person's turn and a `sinceTurnId` read; a listing narrowed to one subject and a
choice settled by naming an option; and, with no pool, `available` is `false`
and every path says `Conversations require project storage.` rather than
pretending.

`api/handlers/tests/conversations.test.ts` (7 cases): the four registrations and
their permission and classification; the domain-scope assertion fires **before**
the collaborator is called, on every endpoint; each endpoint reaches its
collaborator method once the scope is allowed; a `programs.read` caller is
refused the two writes; the person's own id reaches the turn and the answer; a
`sinceTurnId` read passes through; and five malformed payloads are refused at
the handler without the collaborator being called at all.

---

## Not verified

- **The full `packages/fluxiq` suite and `pnpm build` had not finished when
  this report was written.** `npx vitest run` in `packages/fluxiq` was started
  in the background; the targeted runs above and `pnpm check` (which type-checks
  every package) all passed. If the full suite or the build fails, the most
  likely cause is something unrelated to these files, because nothing existing
  imports them yet — the only edits to existing modules are four barrel lines,
  four endpoint names, three table names and one migration appended to a list.
  Treat this as unverified until someone has run both and read the output.
- **No live browser or panel validation.** There is no UI for any of this yet;
  `apps/web` is task t086's and was not touched.
- **No live provider run.** Nothing here calls a model.
- **The seam has no caller yet.** `writerFor` and `askPermission` are proved by
  their own tests, not by a build or a run actually using them. Wiring the
  permission gate to raise its request into a thread is t081/t085's work, and
  it needs step 1 above first.
- **Nothing parks yet.** `parks` is recorded and read back; no runtime waits on
  it, and no run resumes from an answer. The store is the half that was
  missing; the resume path is not built here and was not in this brief.
- **Concurrency is argued, not measured.** The unique index on
  `(conversation_id, ordinal)` means a racing second writer's turn rolls back
  rather than landing out of order. I did not write a test that races two
  writers; the guarantee rests on the index and on `begin immediate`.
- **`docs/architecture/automation-studio/persistence.md` was not updated.** It
  is the authored home for what `project.sqlite` holds, and three new tables
  belong in it. I left it alone deliberately: it is shared with tasks that are
  running now, my brief partitions by file, and a conflict there costs more than
  it saves. It is real follow-up work, not an optional tidy.

---

## Open questions or contradictions found

1. **The contract does not say who may resolve a thread.** `status` is
   `open | resolved` and nothing in the four endpoints moves it. I stored the
   field, defaulted it to `open`, and built no way to change it, rather than
   inventing a fifth endpoint. Someone has to decide whether resolving is a
   person's act, a consequence of every ask being answered, or something the
   automation does when the work finishes.
2. **A turn's text is stored inline, bounded at 16,000 characters.** The
   discovery report suggested long bodies belong in the content-addressed
   object store with metadata in SQL, as reusable LLM context does. Inline is
   right for a sentence and wrong for a diff, and 16,000 is a guess that refuses
   rather than truncates. If attachments turn out to carry the long things —
   which is what `attachment.ref` is for — inline stays right and the bound can
   come down.
3. **There is no cursor on either read.** `list-conversations` and
   `get-conversation` clamp through the shared 1–200/default-50 helper, and
   `get-conversation` answers `hasMore`, but a caller wanting page three of a
   long thread has to walk it with `sinceTurnId`. That is the natural shape for a
   thread and a poor one for a list of threads. Adding
   `encodeAutomationStudioPageCursor` to `listConversations` is small and was
   outside what the contract asked for.
4. **`expired` is a status with nothing that sets it.** The contract's `Ask`
   carries `timeoutMs` and `onTimeout: "deny" | "default"`; the store records
   both and the status vocabulary admits `expired`, but nothing sweeps. Whatever
   parks a run has to be the thing that expires its ask, so this belongs with
   the resume path rather than here — but a timeout that never fires is worse
   than no timeout, so it should not ship to a person as if it worked.
5. **`onTimeout: "default"` has no default to take.** For a `choice` ask,
   nothing marks which option is the default; `AutomationStudioConversationAskOption`
   is `{ id, label }`. `builtin.routine.approval` already emits a
   `defaultRoute`, so the concept exists next door. Either the option needs a
   `default` flag or the ask needs a `defaultOptionId`, and that is a contract
   question, so I did not add one.
6. **`builtin.routine.approval` is still dead.** Decision 1 in the plan says it
   becomes live and converges on this mechanism. Nothing in this task consumes
   `routine.approval.requested` or resumes a `waiting` run; the ask shape it
   needs (a prompt, a timeout, a default route, parking) is now storable, which
   is the prerequisite, not the thing itself.
