# t181-a — Simple Mode: recent automations, run controls, per-run summary

## Outcome

Done. `createAutomationsCard(context)` is exported from
`apps/extension/src/panel/simple/automations/index.ts` with the contract in the
brief: `{ element; render(status); setActive(active) }`. It is not wired into
`simple-view.ts`; that is the supervisor's step.

## What changed and why

Every file is new and sits under `apps/extension/src/panel/simple/automations/`.
Each file exports one thing, with its types beside it.

| File | Role |
| --- | --- |
| `types.ts` | Types only: `RunSummary`, `AutomationRow`, `RunDataset`, `RunReply`, `RunDetail`, `DatasetExport`, `RunFacts`, `RunOutcome`. |
| `read-core.ts` | `readCore`: defensive field readers. Times are read from a number or an ISO string. Anything missing or the wrong shape comes back undefined and is never defaulted. |
| `rows.ts` | Parser 1, `automationRows(payload)`. Joins flows to their newest run by `updatedAt`, sorts newest first by `max(run.updatedAt, flow.updatedAt)`, caps at 5, skips junk and duplicate flows, and names a nameless flow "Untitled automation". |
| `facts.ts` | `runFacts(input)`. Reads outcome (queued/running→running, succeeded→completed, failed→failed, cancelled→stopped, anything else undefined), duration (finishedAt−startedAt, and only when it is not negative), aiUsed and aiActivations from interventionCount, and learned from createdAdaptationIds.length, falling back to adaptationCount. `validated` is true if any of the run's adaptations is validated or applied. It is false only when every one is known and all are rejected, disabled, reverted or superseded. Otherwise it stays undefined. `futureRunsUpdated` is true if durableBehaviorChanged is true or any of the run's adaptations is "applied", and false only when durableBehaviorChanged is false. |
| `summary-copy.ts` | `runSummaryLines(facts)`. Produces the plan 3.9 lines. Durations read as 14.2s under a minute, "2m 5s" under an hour, then "1h 3m". |
| `replies.ts` | `readRunReplies.{run, detail, export}`: defensive readers for the runAutomation, runDetail and exportDataset replies. `export` accepts only an explicit `tooLarge: false` together with fileName, contentType and a string body. |
| `controller.ts` | `createAutomationsController(request, { onChange, download })`. All the card's state and requests live here, with no DOM. |
| `row-element.ts` | `automationRowElement(view, actions)`. Draws one `<li>`: name, summary lines, Run (aria-label "Run <name>"), the "Wait for FluxIQ to finish." hint, one Export CSV/JSON pair per dataset, and the row's own notice, with Open FluxIQ when it applies. |
| `card.ts` | `createAutomationsCard(context)`. Draws the card and imports `./card.css`. |
| `download-file.ts` | `downloadFile(name, type, body)`. Makes a Blob and a temporary `<a download>`, clicks it, removes it, then calls `URL.revokeObjectURL` in a `setTimeout(0)`. It touches the DOM only when called. |
| `card.css` | Rules prefixed `automations-`, using tokens only. |
| `index.ts` | The barrel. |
| `tests/{rows,facts,summary-copy,replies,controller}.test.ts` | 29 node:test cases. |

What the card does, following the brief:

- **Reading the list.** `listAutomations` is read on `setActive(true)` while connected, and when the connection comes back while the card is active. It is read again after every run, and on a 30 s interval while the card is active and `document.visibilityState === "visible"`. There is no timer faster than 15 s. A second read is not started while one is in flight.
- **Unsupported list.** The list is replaced by "Your saved automations are in FluxIQ." and `createOpenFluxIQButton(request, {label:"Open FluxIQ", look:"small"})`. The timer stops, and the card never reads again while it lives, so reopening the panel is the only retry.
- **Other read failures.** A `.notice` shows `result.sentence`, with `detail` as its title. The rows already on screen stay, and the notice stays until the next successful read. A payload that has no `flows` array also counts as a failure: "Couldn't read your automations from FluxIQ."
- **Other card states.** Offline shows "Connect to FluxIQ to see your automations." An empty list shows "No automations yet. Record one or describe it above." Before the first read it shows "Loading your automations...", a line I added.
- **Run.** Pressing Run sends `{type: runAutomation, flowId}`. The row shows "Running..." and every Run is disabled until the reply arrives. The reply's summary then replaces the row's lines, the list is re-read, and `runDetail` is fetched for the new run.
  - While `status.runtime?.state === "running"`, or while a run from this card is in flight, Run is disabled with the hint "Wait for FluxIQ to finish."
  - If the run fails, the row's notice shows `result.sentence`.
  - If the background does not support running, the row says "Run it in FluxIQ." with Open FluxIQ, and Run is never sent again.
- **Run details.** `runDetail` is fetched once for each row's last run. It is fetched again only while the run learned something whose check is still unknown, which is how "Checking the change..." eventually resolves. If runDetail is unsupported, it is never asked for again, and a plain failure is retried on the next refresh. The detail's datasets drive the Export buttons, and its adaptation statuses feed `validated` and `futureRunsUpdated`.
- **Export.** Each button sends `{type: exportDataset, runId, datasetId, format}`.
  - An inline reply is saved through `downloadFile`.
  - A reply marked tooLarge shows "Too large to export here — open it in FluxIQ." with a link-look Open FluxIQ.
  - A failure shows its sentence.
  - An unsupported reply shows "Export it in FluxIQ." with Open FluxIQ.
  - While an export is in flight, that row's export buttons are disabled.
- **No internal values shown.** Nothing on screen shows an id, selector or trace. Dataset labels fall back to "Data", and a row count shows as "(12 rows)".

## Commands run and observed results

1. Free memory before the first run: `powershell (Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory` printed `3025144` KB, about 3.0 GB.
2. `npx tsc -p tsconfig.json --noEmit` in `apps/extension` exited 0 with no output. `npx tsc -p tsconfig.test.json` also exited 0 with no output.
3. `EXTENSION_TEST_BUILD_LABEL=t181-a node scripts/test-extension.mjs` exited 0 and printed `# tests 1073`, `# pass 1073`, `# fail 0`. All 29 new test names appear as `ok`.
4. `node scripts/structure-audit.mjs` at the repository root. This check was not in the brief; I ran it to test the one-export and naming rules. On the first run it exited 1 with 4 violations, all in my files:
   - `card.ts` imported `../../shell/contracts` directly instead of through the shell barrel.
   - Three groups of files shared a name prefix: `automation-`, `automations-` and `run-`.

   I renamed the files to the names in the table above and switched the import to `../../shell`.
5. A second pass of all three checks after the rename:
   - The audit exited 0: "structure-audit: passed (114 warning(s), 120 baselined)", with no finding under `automations`.
   - Both tsc runs exited 0.
   - The tests exited 0 and printed `# tests 1099`, `# pass 1099`, `# fail 0`. The total rose from 1073 because other workers in the same tree added tests; my 29 are unchanged.

**Memory floor missed on the second run.** I put the memory check in the same command as the second run instead of running it first. It read `1314632` KB, about 1.3 GB, which is below the brief's 2 GB floor. All checks still completed and passed, but that run did not follow the rule.

## Not verified

- **DOM behaviour.** Nothing ran in a browser or under a DOM, because the node runner cannot import DOM modules. This covers:
  - `card.ts` and `row-element.ts` rendering
  - the Blob download (`download-file.ts`)
  - the 30 s timer
  - Open FluxIQ buttons inside row notices
- **The CSS** has not been checked visually, in either theme.
- **The wiring into `simple-view.ts`** is not done, by design.
- **Live Core payloads.** The relays do not exist yet, so the Core payload shapes are tested only against the shapes given in the brief.

## Open questions or contradictions found

- **Copy the brief did not give.** I chose these lines; please confirm or replace them:
  - `validated === false` → "The change didn't hold up, so future runs stay the same"
  - a run with no readable facts at all → "Ran"
  - a flow that has never been run → "Not run yet"
  - an unsupported runAutomation → "Run it in FluxIQ."
  - an unsupported export → "Export it in FluxIQ."
  - an unreadable run reply → "It ran, but FluxIQ didn't say how it went."
- **"Wait for FluxIQ to finish." also covers this card's own runs.** I apply it while one of this card's runs is in flight as well as while `status.runtime` is running.
- **`runAutomation` payload shape.** The brief puts `createdAdaptationIds` and `durableBehaviorChanged` on `value.payload` itself, next to `runSummary`. If the relay nests them differently, `replies.ts` needs adjusting.
- **Detail requests per list read.** Each list read can send up to five `runDetail` requests, one per row whose last run has not been read. If that load is too much for Core, the detail could be read only after a run.
