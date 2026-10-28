# t770-D1 recorded-evidence lane (test runner)

## Outcome
Done. `lab run ... --demonstration <id>` exists, the recorded path runs end to end in the real extension up to the attached chip, and all three provider-free dry runs passed headed. The live (paid) half is wired and unit/pin-tested but, as briefed, was not run.

## What changed and why
- `packages/test-runner/src/commands.ts` and `cli.ts`: `--demonstration <id>` and `--demonstration-probe` on `lab run`. `scripts/lab` needed no change (it passes argv through). `--demonstration` requires `--instruction-task`, refuses `--direct-api-build`, and needs `--live-llm --llm-task create-flow` or `--dry-run`. A demonstration dry run needs no `--live-llm` (the old `--dry-run` still does, for runs without a demonstration) and never reads a provider key. `cli.ts` selects the demonstration (`selectDemonstration`): unknown id, other scenario, a task other than `--instruction-task`, or `conflictsWithInstruction` without `--demonstration-probe` is a `fixture.invalid` refusal before anything starts.
- New `flow-lane/creation/recorded-evidence/` (barrel, one export per file; `demonstration/` holds options, catalog loader, verdict types): `record-demonstration.ts` (baseline recordings, select project, Start recording, fill "Recording description", "Start described recording", run steps, "Stop recording", exactly one new recording, `awaitFinalizedRecording`, description equality, optional judge hook, reset site, return to start page), `attach-recorded-demonstration.ts` (Chat tab, "Attach a recording", item named by the description, chip "Recording: <description>"), `recording-set-change.ts` (replaces the unchanged-recording-set assertion: set changed by exactly that recording, finalized, described; facts `recording.set`/`recording.finalized`/`recording.described`), `generation-instruction-link.ts` (`get-flow-instruction-set`; the one flow-scope `generation` instruction has `linkedRecordingIds === [it]`; fact `instruction.linked`), `detour-copy-fact.ts` (wraps the landed `copiedDetourActs`; fact `detour.copied`), `judge-demonstration-extract.ts` and `read-results-pages.ts` (exact judge; everything-store rating/accessory judge).
- New `extension-chat-check/panel-controls.ts`: presses panel controls by aria-label or text, fills a labelled textarea, presses an item inside a named group (the existing chat driver only matched button text; "Start recording" is an icon).
- New `run-scenario/recorded-evidence/` (`run-recorded-evidence.ts`, `assert-recorded-evidence-facts.ts`): wires the lane to the running browser and Core. `run-scenario.ts`: a dry-run branch before the live creation branch (records, attaches, judges, pictures the window, writes `snapshots/demonstration-dry-run.json`, returns `demonstrationDryRun`, never reaches the chat, lane, person or a provider); in the live branch the demonstration is recorded before the chat entry and attached by `chat-entry.ts`'s new `beforeSend` hook just before the instruction is typed (instruction unchanged); after the lane, `assertRecordedEvidenceFacts` checks recordings, instruction link and detours.
- `docs/architecture/testing-facility.md`: new section "A build that starts from a recorded demonstration".

## Findings made while running (what the first runs showed)
1. After Stop the panel shows the recording's review on the Automations tab, so the composer's "Attach a recording" was not visible; the lane presses the Chat tab first.
2. The step runner refuses an extract step that pages (a recording cannot carry a paged read). The recording therefore demonstrates the first page only (pagination dropped in `recordable`), as `everything-store/tests/demonstrations.test.ts` does, and the judge sweeps the five pages after Stop with the reference reader. A sweep that read cards after a single 400 ms scroll got 6 records and kept 2 of 5 (run-mvroz6ez-7d0cf943); scrolling until the card count holds for three looks fixed it.
3. Core finalized job-board's 150-entry recording slower than the 90 s default of `awaitFinalizedRecording` (run-mvror0oc-6dc116bf: 142 entries, still growing, endedAt null after 90 s). The lane now waits up to 300 s (`FINALIZE_MS`). This is a Core append-rate observation (about one entry a second), not tuned away: worth a Core look.

## Commands run and observed results
- `pnpm --filter @fluxiq-web-extension/test-runner build` (and the Lab's own prelude rebuilds): exit 0.
- `node --test` on `dist/flow-lane/creation/recorded-evidence/tests/*.test.js`, `.../demonstration/tests/*.test.js`, `dist/run-scenario/recorded-evidence/tests/*.test.js`, `dist/tests/commands.test.js`, `dist/tests/cli-llm.test.js`, `dist/run-scenario/chat-build/tests/*.test.js`, `dist/run-evaluation/tests/runner-wiring.test.js`: `# tests 102 / # pass 102 / # fail 0`.
- `pnpm --filter @fluxiq-web-extension/test-runner check`: exit 0 (after the last source change).
- `node scripts/structure-audit.mjs`: `structure-audit: passed (226 warning(s), 616 baselined).`
- Headed provider-free dry runs, `FLUXIQ_TEST_ENV_FILES=none`, bundles under `C:/Users/osrs_/FluxStuff/fxwork/t770/!FluxIQWebExtension/test-runs/`:

| site | run id | verdict | demonstration extract | attached-chip screenshot |
| --- | --- | --- | --- | --- |
| crossborder-marketplace | `run-mvrp8voy-b06e7582` | passed | exact, 10 of 10 expected, no mismatches, 156 recording entries | `run-mvrp8voy-b06e7582/screenshots/00008-d81b05367857.jpg` |
| everything-store | `run-mvrp4xw3-b2054484` | passed | rated-non-accessory, 9 couponed read, 5 kept, 5 expected, no mismatches, 83 entries | `run-mvrp4xw3-b2054484/screenshots/00008-665411439661.jpg` |
| job-board | `run-mvrp1lw3-7f0ecea1` | passed | exact, 7 of 7, no mismatches, 153 entries | `run-mvrp1lw3-7f0ecea1/screenshots/00007-18b5c44a948c.jpg` |

Each run's summary is `snapshots/demonstration-dry-run.json` and the run's printed JSON `demonstrationDryRun` (`providerCallCount: 0`, `chipShown: true`). I looked at the crossborder chip picture: the composer shows the "Recording: I search for the hubs, tick Ships from Spain just to se..." chip on the Chat tab, on the reset start page. The job-board run passed on the code before the final sweep-scroll and logging edits (they touch only the everything-store sweep); crossborder and everything-store passed on the final code.
- Earlier failed runs (kept for the record, causes above): run-mvro4c69-c1efedd0 (Attach button not on the Automations tab), run-mvropkhi-b3846947 (paged extract refused), run-mvror0oc-6dc116bf (finalization bound), run-mvroz6ez-7d0cf943 (sweep read 2 of 5).

## Not verified
- The live half: recording before the chat entry, attaching through `beforeSend`, sending the unchanged instruction, then `assertRecordedEvidenceFacts` (recording set, `linkedRecordingIds`, `detour.copied`) against a real build. Covered only by unit tests of each fact and by source-order pin tests (`run-scenario/recorded-evidence/tests/dry-run-wiring.test.ts`). Open risk: whether Core's list-recordings carries `description` and `endedAt` in the shape `assertRecordingSetChangedByExactly` reads is confirmed only indirectly (the dry run's description check passes through the same `recordingItems` reader).
- `--demonstration-probe` with the conflicting crossborder demonstration was not run; only its refusal/selection logic is tested.
- `readResultsPages` and `panel-controls.ts` have no unit tests; they are exercised by the three headed runs. Firefox popup path not exercised (Chrome side panel only).
- `copiedDetourActs` is from the other worker's `flow-lane/creation/detour/` (present and compiling in this tree); I did not edit it.

## Open questions or contradictions found
- Core finalizes long recordings at about one entry a second (finding 3). If a paid round's recording is slower than 300 s the lane fails `recording.persistence` naming the wait.
- `--demonstration` dry-run runs do not use `LabRunRecord`/spend ledger (no live run), so no `lab-runs/` entry is written; the evidence is the bundle only.
- The panel's post-Stop "Attach to my next message" shortcut exists; the lane uses the menu path the brief names, so that shortcut is not exercised.

## Exact launch commands a paid round would use
Placeholders `<profile>` and `<provider>` are the operator's existing live profile and provider (not guessed here); cost ceiling per the standing $0.25 Lab rule (process env and `--llm-max-cost-usd`). Run headed, one supervised run at a time, after the lane trees are synced to dev.
```
pnpm lab run crossborder-marketplace --live-llm --llm-profile <profile> --llm-provider <provider> --llm-task create-flow --llm-max-cost-usd 0.25 --instruction-task crossborder-marketplace-free-hubs-under-ten --demonstration crossborder-marketplace-free-hubs-under-ten-demo
pnpm lab run everything-store --live-llm --llm-profile <profile> --llm-provider <provider> --llm-task create-flow --llm-max-cost-usd 0.25 --instruction-task everything-store-coupon-earbuds-rated-four --demonstration everything-store-coupon-earbuds-demo
pnpm lab run job-board --live-llm --llm-profile <profile> --llm-provider <provider> --llm-task create-flow --llm-max-cost-usd 0.25 --instruction-task job-board-remote-easy-apply --demonstration job-board-remote-easy-apply-demo
```
The conflicting probe: `... --instruction-task crossborder-marketplace-free-hubs-under-ten --demonstration crossborder-marketplace-free-hubs-higher-limit-demo --demonstration-probe`. The provider-free check of any of them is the same command without the `--live-llm ...` options and with `--dry-run` (`FLUXIQ_TEST_ENV_FILES=none`).
