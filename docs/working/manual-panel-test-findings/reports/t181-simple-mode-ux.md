# t181 — Extension Simple Mode: recording and scraping UX

Covers 30-day plan 3.1, 3.3, 3.5, 3.7, 3.9, and the extension half of 4.2. Workers wrote
`t181-a-automations.md` (recent automations card) and `t181-b-recording.md` (recording steps and review).

## Outcome

**Done for the extension slice.** Everything that reads Core beyond the conversation is blocked on
lane t182, which is building background relays and the Core allow-list; see "Seam contract".
Until t182 lands, those cards show their "Open FluxIQ" fallback. That fallback path is live today.

## Simple Mode's primary screen

The cards run top to bottom in `panel/simple/simple-view.ts`:

1. **Status card.** Unchanged.
2. **Get set up** (`simple/start/setup-card.ts`, `setup-steps.ts`, `model-key.ts`). This is the plan 4.2
   checklist: FluxIQ running, this browser approved, and an AI model key, followed by the onboarding
   sentence. It shows until the checklist is complete.
   - The key state is read through the `modelReadiness` relay. An unsupported reply reads as "unknown",
     which does not keep the checklist open once the browser is connected and paired.
3. **Right now.** Unchanged, except that it gained a "Recording paused" row (`now-copy.ts`), marked
   `SEAM(t180)`. Stop recording stays offered while a recording is paused.
4. **Recorded steps** (`simple/recording/steps/`). Shown while recording. It lists the newest steps from
   `getRecordingLog`, each with a Remove button that sends `removeRecordingStep`.
   - An unsupported reply hides every Remove button and shows a one-time sentence.
   - The Pause control seam is `SEAM(t180)` in `recording-steps.ts`.
5. **Recording review** (`simple/recording/review/`). Shown after a recording ends. It walks through
   offer → analyzing / "Building the automation..." → preview (name and up to 8 steps) → "Test the
   generated automation" → test result → Save.
   - Any unsupported reply switches the card to "Finish this automation in FluxIQ" with Open FluxIQ.
6. **What should FluxIQ do?** (`simple/start/start-card.ts`). This card holds the plan 3.1 / 4.2 ways
   in:
   - **Describe an automation**: focuses the conversation composer.
   - **Show FluxIQ how**: the existing "Start recording", moved here from its own card.
   - **Extract data**: the extraction sheet's "Extract Data From This Page".
     - It is now offered whether or not a recording is running (`extract-control.ts`).
     - Pressed with no recording running, it starts a recording first (the new `prepare` hook on
       `mountExtractionPanel`), so the extraction still compiles into the recording's Flow (plan 3.7,
       "Important Requirement").
     - The sheet gained a "Pages" sentence: "Current page only" when no pagination was detected,
       otherwise current page vs all pages.
     - Rename, remove, exclude/include (the "add a field" path), kind and preview are unchanged.
7. **Conversation.** Unchanged.
8. **Recent automations** (`simple/automations/`). Up to five flows, each with:
   - its last-run summary in plan 3.9 wording: "Completed in 14.2s", "AI activated once",
     "Learned 1 new page variation", "Future runs updated", and "Checking the change..." while
     validation is unknown;
   - a Run button;
   - Export CSV/JSON for each of the run's datasets, downloaded as a Blob. When the export is
     `tooLarge`, the card points to FluxIQ.
   - An unsupported list shows "Your saved automations are in FluxIQ." with Open FluxIQ.

The Chrome side panel and the Firefox popup mount the same `mountSimpleView`, so the two stay aligned.
Nothing is surface-specific.

## Names the Lab and specs use

These names were kept:

- "Start recording", "Stop recording", "Connect", "Settings"
- "Extract Data From This Page", which still appears exactly once in the DOM
- "Confirm" and `#extractionCloseButton`

`packages/test-runner/src/ui-e2e/journeys/extraction.ts` starts recording before it opens the picker,
and that still works. `e2e/install-and-content.spec.ts` changed in three ways:

- The extraction entry is now disabled with the line "Connect to FluxIQ to extract data." instead of
  hidden.
- The spec now asserts the "Get set up" region, "Describe an automation", and the offline automations
  line.
- The spec now asserts that the recording steps and review regions are hidden.

## Seam contract (for lane t182)

`apps/extension/src/panel/simple/relay/messages.ts` (`SIMPLE_RELAY_MESSAGES`) is the contract. It holds
the names, the request fields, and the Core payload that passes through untouched. When the relays land,
the names move to `shared/constants.ts` under the same spelling.

| Message | Request fields | Core endpoint(s) |
| --- | --- | --- |
| `fluxiq.panel.listAutomations` | projectId? | `list-flow-summaries`, `list-flow-runs` (sort updated desc) → `{flows, runs}` |
| `fluxiq.panel.runAutomation` | flowId | `run-runtime-session` (no LLM grant) |
| `fluxiq.panel.runDetail` | runId | `get-flow-run-detail` (compact), `list-flow-adaptations` → `{runDetail, adaptations}` |
| `fluxiq.panel.exportDataset` | runId, datasetId, format | `export-run-dataset` |
| `fluxiq.panel.modelReadiness` | — | `secret-keys/snapshot` (kind/provider/enabled only) |
| `fluxiq.panel.generateFromRecording` | — (the background knows the last recording id) | `generate-recording-proposal` |
| `fluxiq.panel.testGeneratedAutomation` | proposalId?, flowId? | `run-runtime-session` |
| `fluxiq.panel.saveGeneratedAutomation` | proposalId?, flowId? | `review-recording-flow-proposal` (approve) |
| `fluxiq.panel.removeRecordingStep` | entryId (`ActivityEntry.id`) | background queue removal; **no Core endpoint exists** |

What Core is missing, found by a read-only survey of Core at HEAD 259a11b:

- **Allow-list.** `PAIRED_CLIENT_ENDPOINTS` (`apps/web/src/lib/program-route.ts:57-67`) lets a pairing
  token call only the conversation endpoints, `list-runtime-sessions` and `cancel-runtime-session`.
  Every endpoint in the table above must be added to it.
- **Step removal.** No endpoint removes an entry from a recording.
- **Running with AI from a token.** It is impossible today: `issue-llm-execution-grant` requires
  `authSessionId`, which token calls do not carry.
- **"Future runs updated" is not persisted.** `durableBehaviorChanged` exists only in the synchronous
  `run-runtime-session` reply. For past runs the card falls back to an adaptation status of `applied`.
- **Last run per flow.** Flow listings carry no last-run fields. The relay therefore returns recent runs
  and the panel joins them to their flows.
- **Recording proposal shape unverified.** The worker's parser for the `generate-recording-proposal`
  result tries several field spellings, because the real shape has not been checked.

## Validation

Run in `apps/extension` of the t181 tree, with more than 2 GB of RAM free before each heavy command:

- `npx tsc -p tsconfig.json --noEmit` exited 0 with no output.
- `npx tsc -p tsconfig.test.json` exited 0 with no output.
- `EXTENSION_TEST_BUILD_LABEL=t181 node scripts/test-extension.mjs` printed `# tests 1099`, `# pass 1099`,
  `# fail 0`.
- `node scripts/structure-audit.mjs` (repository root) passed, with no findings under `panel/`.
- `pnpm build` printed "Done". The sidepanel bundle is 335.4 kb.
- `npx playwright test -c e2e/playwright.config.ts install-and-content.spec.ts --workers=1` passed 3 of 3,
  and again after the extra assertions (23.1s).

## Not verified

- No live run was allowed, so nothing here ran against a real Core. The recording review, recent
  automations, Run, export and step removal are exercised only through unit-tested reducers and parsers
  and their unsupported fallbacks.
- The e2e spec covers only the unconnected screen.
- The Firefox popup was not loaded; it shares the code with the side panel.
- The 600px popup height now scrolls with the added cards. It was not visually checked.
