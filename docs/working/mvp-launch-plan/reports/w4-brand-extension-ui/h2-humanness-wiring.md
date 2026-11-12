# W4-H2: each Flow and each task gets its own humanness in the extension (lane t900)

## Outcome

Partial. The extension side is complete. Its narrow tests pass (339/339), the structure audit passes, and the
typecheck is clean once one untracked e2e spec that is not mine is excluded. But the Flow control cannot work against Core yet. Two of the three Core endpoints are not on
the paired-client allowlist (finding 1), and the background drops the person's starting value (finding 2). Neither
fix is in my owned paths. Nothing is committed.

## Contract (verbatim)

### Message names (`apps/extension/src/shared/constants.ts`, `RUNTIME_MESSAGES`)

```ts
// One Flow's or one task's own humanness: read a Flow's, and set or clear either (`background/panel/humanness-relay.ts`).
panelFlowHumannessRead: "fluxiq.panel.flowHumannessRead",
panelFlowHumannessSet: "fluxiq.panel.flowHumannessSet",
panelTaskHumannessSet: "fluxiq.panel.taskHumannessSet",
```

All three are in `PANEL_MESSAGES` (`background/panel/panel-control.ts`). Each is accepted only from the side panel or
the popup. Any other sender gets `{ ok: false, code: "forbidden", error: "Only the FluxIQ panel can do that." }`
before anything is touched.

### Message shapes (`apps/extension/src/shared/panel-humanness.ts`, re-exported by one `protocol.ts` line)

```ts
export type PanelFlowHumannessReadRequest = { projectId?: string | undefined; flowId: string };
export type PanelFlowHumannessSetRequest = { projectId?: string | undefined; flowId: string; humanness: number | null };
export type PanelTaskHumannessSetRequest = { projectId?: string | undefined; taskId: string; humanness: number | null };
export type PanelHumannessReply = { humanness?: number | undefined };   // what all three answer, inside { ok: true, payload }
export type CoreFlowHumannessReadBody = { projectId: string; flowId: string };
export type CoreFlowHumannessSetBody = { projectId: string; flowId: string; flow: { flowId: string; metadata: { humanness: number | null } } };
export type CoreTaskHumannessSetBody = { projectId: string; taskId: string; humanness: number | null };
```

### Message to Core call (`background/panel/humanness-relay.ts`, one call each, bodies through `present<T>()`)

| Message | Core endpoint and exact body | Reply payload |
| --- | --- | --- |
| `flowHumannessRead` | `get-flow-metadata-detail` `{ projectId, flowId }` | `{ humanness }` from `payload.flow.metadata.humanness`, else `{}` |
| `flowHumannessSet` | `update-flow-settings` `{ projectId, flowId, flow: { flowId, metadata: { humanness } } }` (`null` clears) | `{ humanness }` from the returned `flow.metadata.humanness`, else `{}` |
| `taskHumannessSet` | `update-task-settings` `{ projectId, taskId, humanness }` (`null` clears) | `{ humanness }` from Core's `{ taskId, humanness }`; `null` reads as `{}` |

- **The brief's Flow shorthand needed adjusting.** The brief wrote "`update-flow-settings` with
  `metadata: { humanness }`", but Core's handler reads the patch only from `payload.flow.metadata` and refuses a body
  without `flow` ("Flow settings are required.").
  - The body therefore nests it as `flow: { flowId, metadata: { humanness } }`.
  - This is the shape W2's own report states (t898 `w2-humanness/flow-level.md`: `{projectId, flowId, flow:{flowId,
    metadata:{humanness:N}}}`).
  - The patch carries humanness and nothing else, so this message cannot rename a Flow or change any other setting.
    A test sends `name`, `metadata.costLimit` and `flow.visibility` and proves they are dropped.
- **Projection.** Only the level crosses to the panel. A Flow's detail and settings carry far more (inputs, errors,
  settings).
- **Core judges the range.** The relay checks only that `humanness` is a finite number or `null`. Anything else is
  refused before Core as `invalid_request`, "Say what humanness to use, from 0 to 100, or clear it." A level out of
  range is sent as given, and Core's refusal comes back unchanged (`code: "failed"`, `coreCode`, Core's sentence).
- **Missing subject.** A missing `flowId` gives "Say which Flow this is for."; a missing `taskId` gives "Say which task
  to change."
- **Project.** A left-out `projectId` is the session's project, as in the automation relay. With none known, the reply
  is `no_project` and nothing is sent.
- **No task read relay.** A task's level is read from its `list-project-tasks` row through the existing `listTasks`
  relay (`AUTOMATION_PANEL_MESSAGES.listTasks`). The extension never called `get-flow-metadata-detail` before, so the
  Flow read is new.

### Panel side

- **Chat (`panel/chat/transport/ports/task-settings/`).** `taskSettingsPort(request, status)` implements Core's
  `ChatTaskSettingsPort`.
  - `read` pages `listTasks` (`{ projectId, limit: 100, cursor }`, newest first) until the task's row is found. It
    answers `{ humanness?, starting }`, with `starting = startingHumanness(status())`, read fresh on each call.
  - When the task is not listed, `read` fails with "That task is no longer here.". It never follows the same cursor
    twice.
  - `setHumanness` sends `{ type: "fluxiq.panel.taskHumannessSet", projectId, taskId, humanness }`.
  - Unsupported: a background that does not know the message answers `unsupported: true` through `panelRequest`, and
    the card then hides the disclosure.
- **Transport wiring.** `createExtensionChatTransport(request, listen?, download?, status?)` adds `taskSettings` only
  when it is given `status`. `chat-panel.ts` passes `() => latest`, the status the panel last rendered.
  - **This is one line outside my owned paths.** It is needed because the transport received only `request`, and the
    starting value lives in the panel status.
- **Refusal words (`reply/named-failure-of.ts`, new).**
  - This is the B3/RC path, pulled out of `thread-change-of.ts` so it can be reused. `threadChangeOf` now calls it, and
    its behaviour is unchanged.
  - A failure the background named with a code keeps Core's sentence (`detail`) and its `coreCode`, so "Something went
    wrong." never replaces it.
  - `reply/humanness-of.ts` maps a humanness reply to `ChatResult<{ humanness? }>`.
- **Flow (`panel/automations/humanness/`, new).**
  - `flowHumannessPort(request)` sends `{ type: flowHumannessRead, flowId }` and `{ type: flowHumannessSet, flowId,
    humanness }`, with no project, so the session's project is used, as the strip's own Flow list does.
  - `createFlowHumannessSection(port)` mirrors Core's answer-card section. It uses a `small-button` disclosure
    "Humanness · N" (`aria-expanded`, `aria-controls`) over Core's `createHumannessControl` (label "Humanness for this
    Flow").
  - It reads when the strip shows a Flow and again on each opening. Another Flow gets a fresh control, and none puts
    the section away.
  - The section stays hidden on `unsupported`. Another failed read shows "I could not read this Flow's humanness.
    <sentence>".
  - It imports `@fluxiq/ui-components/styles/chat.css`. That stylesheet carries the control's sheet, because the
    package exports no stylesheet for the control on its own (see finding 4). The disclosure's own 5 rules are in
    `automations.css`.
- **Strip wiring (`automation-strip.ts`).** The section sits under the links. `show()` passes the Flow, `retireOwner`
  passes none, and `render(status)` passes the status on.
- **Starting value refresh (brief point 5).**
  - Flow strip: `render(status)` recomputes `startingHumanness`. When it changes, the open control gets `show({ own?,
    starting })` and the label is updated. A pending change of the person's is left alone, by the control's own rule.
  - Chat card: the starting value is read from the status on every `read`, and Core's section reads on every opening.
    A card that stays open is not refreshed live, because the control sits inside Core's answer view and the
    extension cannot reach it (finding 3).

## What changed and why

- **Shared contract.**
  - `src/shared/constants.ts`: the three names.
  - `src/shared/panel-humanness.ts` (new): the shapes above.
  - `src/shared/protocol.ts`: one re-export line plus its doc comment, now 726 lines.
- **Background relay.**
  - `src/background/panel/humanness-relay.ts` (new): the relay.
  - `src/background/panel/panel-control.ts`: the three names in `PANEL_MESSAGES`, routing to `relayHumanness`, and the
    header comment updated ("Eleven of them spend the pairing token").
  - `src/background/panel/index.ts`: the export.
- **Chat transport.**
  - `src/panel/chat/transport/ports/task-settings/` (new): `index.ts`, `task-settings-port.ts`,
    `read-task-humanness.ts`, `starting-humanness.ts`.
  - `src/panel/chat/transport/ports/index.ts`: exports `taskSettingsPort`.
  - `src/panel/chat/transport/create-extension-chat-transport.ts`: the optional `status`, which adds `taskSettings`.
  - `src/panel/chat/transport/reply/named-failure-of.ts` and `humanness-of.ts` (new); `thread-change-of.ts` now
    delegates to `namedFailureOf`; `reply/index.ts` exports both.
  - `src/panel/chat/chat-panel.ts`: one line, which passes `() => latest` (outside my owned list, as noted above).
- **Flow strip.**
  - `src/panel/automations/humanness/` (new): `index.ts`, `flow-humanness-port.ts`, `flow-humanness-section.ts`.
  - `src/panel/automations/automation-strip.ts`: mounts the section, and the header comment is updated.
  - `src/panel/automations/automations.css`: 5 rules for the disclosure, tokens only.
- **Import cycle.** `flow-humanness-section.ts` imports `startingHumanness` from `chat/transport/ports/task-settings`,
  not from the ports barrel. The barrel's results port imports `automations`, and the audit failed on that 10-module
  cycle until the import was moved.
- **Tests.**
  - `background/panel/tests/humanness-relay.test.ts` (new, 10 tests). It covers each endpoint and exact body, `null`
    clears, extra fields dropped, an out-of-range level sent and Core's refusal returned unchanged, local refusals
    before Core, the session project's fallback, and `no_project`.
  - `background/panel/tests/panel-control.test.ts`:
    - the three names are added to the control-page rejection loop (the panel-only sender check);
    - a new routing test covers the side panel and the popup.
  - `panel/chat/transport/ports/task-settings/tests/task-settings-port.test.ts` (new, 7 tests):
    - the starting value is clamped and rounded, and absent reads as 0;
    - a read pairs the row's level with the status of the moment, and is re-read after the status changes;
    - the read follows the cursor; a task that is not listed, or a repeated cursor, is a failed read;
    - unsupported and unreadable replies;
    - set and clear send exact messages;
    - Core's out-of-range refusal goes through the real `panelRequest` and reaches the card as Core's sentence plus
      `coreCode: "task.humanness_invalid"`;
    - `taskSettings` is present only when `status` is given.
  - `panel/automations/humanness/tests/flow-humanness-section.test.ts` (new, 6 tests):
    - the port sends exact messages;
    - the section mounts with an inherited level and "Uses your starting value (30)", and a status change to 65
      updates the open control;
    - the slider commits 50 once, and "Use starting value" sends `null`;
    - Core's refusal shows "Not saved. <Core's sentence>" and the slider reverts;
    - an unsupported read hides the section, and a failed read shows a problem line;
    - another Flow gets a fresh control, and `show(undefined)` puts it away.
  - `panel/automations/tests/automation-strip.test.ts`:
    - a new test: the strip mounts the section, reads the shown Flow, and takes its starting value from `render`;
    - the existing request counter now ignores the humanness read.
  - `panel/automations/tests/automation-strip-open.test.ts` filters to the open messages, because the strip now also
    sends a humanness read.

## Commands run and observed results

- `cd apps/extension; node scripts/test-extension.mjs background/panel panel/chat panel/automations panel/tasks`:
  - First run, before the new tests: 314 tests, 312 pass, 2 fail. The 2 failures were the existing strip tests that
    counted every message. Both were narrowed.
  - Next run: 1 fail, in my own relay test. Passing `undefined` to a parameter with a default used the default; the
    test now passes `null`.
  - Final run, after the cycle fix: `# tests 339`, `# pass 339`, `# fail 0`.
- `node scripts/structure-audit.mjs` (extension root):
  - First run: `10 violation(s) across 1 rule(s)`, all `[import-cycles]` from the section's barrel import.
  - After the fix: `structure-audit: passed (245 warning(s), 552 baselined).`
  - The only warnings on files I touched were already there: `constants.ts` exports 9 values (the advisory limit is 8),
    and `protocol.ts` is past the 400-line advisory threshold at 726 lines.
- Typecheck through the heavy slot (apps/extension, sources, tests and e2e):
  - **First attempt.** `heavy-slot.mjs run t900 -- node node_modules/typescript/bin/tsc -p tsconfig.test.json --noEmit`
    gave `exit=2`. The cause was syntax errors (TS1002/TS1005, unterminated string literal, line 26) in the untracked
    `e2e/content/tests/screens/tests/all-screens-capture-company-website.spec.ts`. That file is not mine; RC also
    found it broken.
  - **Why that check said nothing about my code.** A syntax error stops tsc before its type checks, so none of my code
    was checked.
  - **Second attempt.** I reran with a scratch tsconfig (outside the repository) that extends `tsconfig.test.json`,
    sets `typeRoots` to the package's `node_modules/@types`, and excludes only that file:
    `heavy-slot.mjs run t900 -- node node_modules/typescript/bin/tsc -p <scratchpad>/h2-tsconfig.json`. It printed
    `heavy-slot: t900 took slot-2`, `exit=0` and no diagnostics.
  - **Still broken.** `check-extension` will still fail on that spec until its owner fixes it.

## Not verified

- **Real Core replies.** No real Core answered these endpoints. W2 (t898) is not in this worktree's Core, and every
  test uses fakes, built from the reply shapes W2's reports state.
- **The browser.** I did not see the strip disclosure or the chat card in a browser (Chrome side panel or Firefox
  popup), including the layout at 360px.
- **`check-extension`.** Not run, as the brief says; the supervisor runs it.
- **Docs.** `docs/architecture/extension-client.md` does not yet describe the three messages; it is not in my owned
  paths.

## Open questions or contradictions found

1. **Core allowlist (`packages/fluxiq/src/server/program-route/program-route.ts`, `PAIRED_CLIENT_ENDPOINTS
   ["automation-studio"]`).** Neither `get-flow-metadata-detail` nor `update-flow-settings` is on it, here or on W2's
   lane. W2 added only `update-task-settings`.
   - **Effect today.** A paired token's call is refused with 401/403. `core-api.ts` turns that into `code: "refused"`
     with "FluxIQ refused this browser's pairing.", so the Flow disclosure would show "I could not read this Flow's
     humanness. FluxIQ refused this browser's pairing.", which is wrong about the cause.
   - **`get-flow-metadata-detail`.** It is `read` under `programs.read`, so allowlisting it is enough.
   - **`update-flow-settings`.** It is `authoring` under `flows.write`, and its handler takes `name`, `description`,
     `visibility`, `interface`, `executionDefaults`, `source` and all of `metadata`.
     - The allowlist entry needs a narrowing in `narrowPairedClientRequest`. It should accept exactly `{ projectId,
       flowId, flow: { flowId?, metadata: { humanness } } }` and refuse any other field, as `rename-task` and
       `save-project-part` are narrowed.
     - Without the narrowing, a token could change any Flow setting, including its execution defaults and its LLM
       settings.
     - The relay already sends exactly that shape.
   - **Missing comment.** The comment on `PAIRED_CLIENT_PERMISSIONS` says `flows.write` exists only for the recording
     proposal endpoints. It already does not mention `carry-on-task-attempt`, `run-task-again` and
     `save-project-part`.
2. **The starting value never persists, so it always reads as 0.**
   - **What the panel sends.** The Settings slider sends `humanness` with the settings (`panel/settings`, "interface
     I1").
   - **Where the background drops it:**
     - `background/panel/settings-save.ts` `mergeSettings` copies only the known fields, so `humanness` is dropped on
       save;
     - `background/saved-state.ts` `readSavedSettings` rebuilds from defaults, so it is dropped on read as well;
     - `FluxIQSettings` (`shared/protocol.ts`) has no `humanness` field.
   - **Effect.** `status.settings.humanness` is never present. "Uses your starting value (N)" therefore always shows 0
     until those three are fixed.
   - **Who owns which file.**
     - `settings-save.ts` is under `background/panel/**`, my owned path. I left it alone because a fix there alone
       does nothing while `saved-state.ts` and the type drop the field, and those two are outside my paths.
     - B4's report already notes this ("Persistent humanness needs protocol.ts/storage from the other lane").
     - `startingHumanness` reads the field narrowly, so it will start working once it is stored, with no change here.
3. **An open chat card does not follow a Settings change.** Core's `humanness-section.ts` re-reads only on opening,
   and the control is not reachable from the extension. To refresh it live, Core needs a hook, for example
   `ChatTaskSettingsPort.onStartingChanged`, or a `taskSettings.starting()` the section re-reads when a status push
   arrives.
4. **`@fluxiq/ui-components` exports no stylesheet for the control alone.**
   - The package lists `src/chat/controls/humanness/humanness.css` in `files`, but its `exports` map has no
     `./styles/humanness.css`.
   - So a non-chat consumer must import the whole of `chat.css`, as the strip does now. The panel already loads
     `chat.css`, so nothing is added to the bundle.
   - Adding `"./styles/humanness.css": "./src/chat/controls/humanness/humanness.css"` would let the strip import only
     the control's sheet.
5. **The Flow refusal code is unknown.** Core's Flow refusal is a thrown error naming humanness (W2: "Refused with a
   message naming humanness"), so it probably carries no `errorCode`. The sentence still reaches the person, through
   `code: "failed"` plus the `detail` path.
