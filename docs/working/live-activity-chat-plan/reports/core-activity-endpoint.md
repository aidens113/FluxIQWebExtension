# Report: core-activity-endpoint (C3), lane t185

## Outcome

Partial. All the code and tests are written. The Core handler tests and the web model tests passed. The web view tests, `pnpm --filter fluxiq check` and `pnpm --filter @fluxiq/web check` have not been run to a result. Both build slots were held by other lanes the whole time, and the web vitest run had printed nothing when handback was forced.

## What changed and why

Core root: `C:/Users/osrs_/FluxStuff/fxwork/t185/!FluxIQ`.

### Core API (`packages/fluxiq/src/programs/automation-studio/api/`)

- **New `contracts/activity.ts`**: `ActivityReadRequest = FlowProjectRequest`.
- **New `handlers/activity.ts`**: `registerAutomationStudioActivityEndpoints({ registry, activity? })`.
  - Registers `get-activity` as `programs.read`, classification `read`.
  - Answers with `automationStudioActivityHub.snapshot(projectId)` (or an injected hub).
  - Refuses a missing or blank project ID with "Reading live activity needs a project ID."
  - It deliberately does **not** assert domain scope. Under the rule `handlers/tests/domain-scope.test.ts` pins, events carry no stored domain content (D4) and are not persisted. Because of that, `DOMAIN_SCOPED` is unchanged.
- **Registration**:
  - `contracts/endpoints.ts`: `getActivity: "get-activity"`.
  - `contracts/index.ts`: one `export *` line.
  - `handlers/register.ts`: one import line and one call line. That is two lines because the handlers barrel does not register endpoints; `register.ts` does.
- **New `handlers/tests/activity.test.ts`** (6 tests):
  - the endpoint's registration;
  - the snapshot for the named project only;
  - the empty snapshot;
  - that a reader gets a copy, not the hub's own list;
  - refusals;
  - that it is registered through `registerAutomationStudioApi` without touching the service.

### Web (`apps/web/src/`)

- **`lib/program-route.ts`**: `"get-activity"` added to `PAIRED_CLIENT_ENDPOINTS["automation-studio"]`. The pinned list in `lib/tests/program-route.test.ts` is updated to match.
- **New `features/automation-studio/conversation/activity/`**:
  - `contracts.ts`: a strict parser that mirrors `ClientGatewayActivity`. It drops any event with an unknown enum value, a control character, or a string past Core's bounds.
  - `model.ts`:
    - `conversationActivityStepText`: 1-based, "Step N of M", or just "Step N" when N > M or M is not a positive integer;
    - `conversationActivityPollOutcome`: `pending` while `current` is not `final`, otherwise `idle`;
    - `mergeConversationActivity`: keeps each event once by sequence, capped at 120;
    - `interleaveConversationActivity`: puts rows among turns by time. Only events with a `detail` become rows. It leaves out events that name another conversation, and hides rows older than the first shown turn when earlier turns are hidden.
  - `queries.ts`: `getConversationActivity`, a `get-activity` read.
  - `useConversationActivity.ts`: a hook on `createBackoffPoller`, with a visibility resume and no `setInterval`.
  - `index.ts`: the barrel.
  - `tests/model.test.ts` (13 tests).
- **`conversation-host.ts`**: an optional `loadActivity` command, bound to the transport.
- **`conversation/index.ts`**: `export * from "./activity"`.
- **New components**:
  - `components/ConversationActivityHeader.tsx`: `StatusBadge` for the phase chip, Core's label, and the step text plus the step's authored label.
  - `components/ConversationActivityRow.tsx`: drawn as a FluxIQ turn. It expands through `<details>` to the text, the ref and the status.
  - Both are exported from `components/index.ts`.
- **Changed components**:
  - `ConversationThread.tsx` renders the interleaved entries. Its tail-follow and empty state now count entries rather than turns.
  - `ConversationViewContent.tsx` mounts the hook and header. It passes the events and the selected conversation ID to the thread. The opening message is suppressed while activity rows exist.
- **New `conversation/tests/conversation-activity.test.tsx`**:
  - the header's content;
  - "Step 7" when the index runs past the count;
  - row order among turns and what a row expands to;
  - the fast 1 s beat while the latest event is not final, and none once it is final;
  - no header without `loadActivity`;
  - a source check that the new modules contain no `setInterval` and no browser storage.

## Commands run and observed results

- `npx vitest run .../api/handlers/tests/activity.test.ts .../domain-scope.test.ts .../conversations.test.ts --minWorkers=1 --maxWorkers=2` (in `packages/fluxiq`) printed "3 passed (3), Tests 21 passed (21)".
- `npx vitest run src/features/automation-studio/conversation/activity --minWorkers=1 --maxWorkers=2` (in `apps/web`) printed "1 passed, 13 tests passed".
- `node scripts/structure-audit.mjs` (Core root):
  - The first run failed on one `[imports]` finding: `conversation-host.ts` imported `./activity/queries` instead of the barrel. I changed the import to `./activity`.
  - The rerun printed "structure-audit: passed (197 warning(s), 355 baselined)" and "1 baseline entries can be lowered". I did not run `--update`, and I did not identify which entry that is.
- `npx vitest run src/features/automation-studio/conversation src/lib/tests/program-route.test.ts src/app/api/programs --minWorkers=1 --maxWorkers=2` (in `apps/web`) timed out at 400 s and was moved to the background. It had printed no output by handback. So `conversation-activity.test.tsx`, the existing conversation tests after my edits, the `program-route` test and the route test have **not been observed passing**.
- Build slots: `b1` was held by "t185 E3 extension check+build" and `b2` by "t187 bench | D.check p2 | pnpm check" at every check, so neither type check ran.

## Not verified

- `pnpm --filter fluxiq check` (tsc): not run, because no build slot was free.
- `pnpm --filter @fluxiq/web check` (tsc): not run, for the same reason.
- The web view tests and the regression run of the existing conversation tests, listed above.
- No browser runs, by rule.

## Open questions or contradictions found

- **Stylesheet**: `styles/conversation/01-thread.css` is outside my owned paths, and the architecture test pins exactly two conversation stylesheets. The new UI therefore reuses existing classes: `automation-conversation-header`, `-title`, `-turn automation`, `-attachment-ref`, and `StatusBadge`. The new class names `automation-conversation-activity` and `-activity-row` have no styles yet.
- **Domain scope**: `get-activity` does not assert domain scope; the reasoning is above. If the supervisor wants it scoped, add the assertion and add the endpoint to `DOMAIN_SCOPED` in `domain-scope.test.ts`.
- **Thread re-read**: the panel does not trigger a thread re-read when an activity event arrives. D6's re-read trigger is written for the extension. Here the thread poller's own backoff (at most 10 s) catches up.
- **Route test**: `app/api/programs/[programId]/[endpoint]/tests/route.test.ts` keeps its own `ALLOWLISTED` list and was not in my owned paths. I did not edit it. It may need `get-activity` added if it asserts the list is complete; that is unknown because the run never finished.
