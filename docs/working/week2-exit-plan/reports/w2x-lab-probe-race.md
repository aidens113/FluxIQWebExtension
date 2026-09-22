# w2x-lab-probe-race: the Core action probe no longer races start-page overlays

Worker report for `### Brief: w2x-lab-probe-race` (plan step P8). Worktree `F:\fxwork\t061-lab-probe-race`,
branch `task/t061-lab-probe-race`, based on `f65edf1`, shared Core `F:\fxwork\!FluxIQ` at `71e2798` (read only).
Changes are uncommitted.

## Outcome

**Done, with one criterion only partly shown.**

- The probe now passes on all six recording lanes on the two sites. Lane C found five of those lanes blocked by the probe (L1).
- Four of the five recorded and persisted, and a Flow was built from each:
  - crossborder primary;
  - crossborder `spain-hubs`;
  - crossborder `place-order`, on its second attempt;
  - auction primary.
- `kestrel-auctions` started recording and ran all 31 steps both times, but Core did not finish persisting the recording within the 90 s wait. The machine was at 96-99% CPU from other lanes; the evidence is below.
- `basic-form` still passes on the Flow lane and on the plain recording lane.
- The two deliberate breakages both fail the probe:
  - a wrong session id fails it as `action.dispatch`;
  - a mark planted on a document other than the one Core reads fails it as `runtime.behavior`.

**The new probe.** The runner plants a random 24-hex mark as `data-fluxiq-core-probe` on the start page's `<html>`. Core then issues `web.dom.extract` (selector `html`, attribute mode) through `execute-client-action`. The probe passes only when the result's `payload.extracted` equals the mark. Afterwards the mark is removed.

- A read has no actionability check, so an overlay cannot refuse it.
- Only a content script reading that very document can return the mark, so a broken gateway, extension, content script, or tab routing still fails.
- It opens no tab and presses nothing. The extract runs in the tab `activateScenarioTab` made active, which is the page the recording starts on.

## What changed and why

- **New `packages/test-runner/src/core-action-probe/`**: `prove-core-action-round-trip.ts`, `index.ts` barrel, and `tests/prove-core-action-round-trip.test.ts`.
  - One exported function, `proveCoreActionRoundTrip`, plus types.
  - It depends on narrow `CoreProbePage` and `CoreProbeControl` shapes, which Playwright's `Page` and the FluxIQ control client satisfy, with `publish` and `record` callbacks.
  - Failure categories:
    - `action.dispatch`: Core refuses or cannot reach the session, returns a non-succeeded result, or returns no result.
    - `runtime.behavior`: the read does not return the mark, or the mark cannot be removed.
  - The mark is removed on every path, and a failed read's error wins over a failed removal.
  - What was read is never quoted: the mismatch publishes only `extractedType`.
- **`run-scenario.ts`** (797 → 766 lines):
  1. The old probe (a navigate into a fresh tab, then a type), its `PROBE_TARGET_VISIBLE_MS` and `probeTiming` are gone.
  2. The call site now calls the module, then `resetScenarioLab` + `openScenarioStart` + the at-load facts again, before recording. The reason: the probe's Core round trip takes about 1.7 s on the start page's own clock. Auction's app promotion appears 2.5 s after every home load, and the auction scripts press "Accept all" before it. With the probe but no reload, auction primary recorded nothing ("Accept all" was covered for 30 s; `run-mubt0554-f019bb04`). With the reload it records. The Flow lanes already reset and reload the start page before every Flow run, so a second load is an established contract.
  3. The recording-lane observation now drops the probe's verdict when the run has a facility failure: `automationFailure: facilityFailure ? undefined : automationFailure`. This fixes a latent defect that my change made reachable. `assertRunEvaluation` refuses a `facilityFailure` beside `reportedVerdict: "passed"`, so a plain recording-lane run whose probe succeeded and which then failed for any reason wrote **no finalized bundle** ("Scenario attempt failed outside a finalized bundle"). I observed this live in the wrong-document negative before the fix. The old probe had the same defect wherever it succeeded; now that the probe runs on every recording lane, it would hit every failing recording-lane run.
- **Deleted `lane-rules/probe-step.ts`, `probe-target.ts` and their two tests**, and removed their barrel exports. The step selection and trial-click occlusion check existed only to find an uncovered field to type into, and nothing uses them now.
- **`run-evaluation/tests/runner-wiring.test.ts`**: its H3 assertions pinned the old probe's source text. They now pin:
  - the module import;
  - that the runner no longer types, opens a tab, or picks a probe step;
  - the order probe → reset → reload → `startRecording`;
  - the facility-failure rule.

## Commands run and observed results

Every run was in `F:\fxwork\t061-lab-probe-race`, used `FLUXIQ_TEST_ENV_FILES=none` and `--target persistent-isolated`, ran sequentially and never used `FLUXIQ_LAB_ALLOW_BEHIND_CORE`. The command was `node scripts/lab/run-lab.mjs run <site> [--workflow w] --target persistent-isolated --workspace t061-<site> [--flow]`. Verdicts were read from `events.ndjson`, `evaluation.json` and `snapshots/flow-lane.json`.

| # | Run | Code | Result |
|---|---|---|---|
| 0 | crossborder primary `run-mubs9m7a-619cdc1d` | baseline | **Reproduced L1**: `action.dispatch`, "the point 640,31 landed on div.css-1psmvu0, which covers the target" |
| 1 | crossborder primary `run-mubshipi-eba0d686` | first draft | `runtime.behavior`: read `result.extracted`, but the value is at `result.payload.extracted` (`ClientGatewayActionResult`). This shows the probe fails closed on a result without the mark. Fixed. |
| 2 | crossborder primary `run-mubslnrr-e2cc7523` | fixed | Probe passed. Recording persisted (72 entries). Flow built. Flow failed on its first click, `web.target.not_found`: the recorded target was a coupon-popup element absent at replay. Product, not probe. |
| 3 | crossborder `spain-hubs` `run-mubspmmm-c02209aa` | fixed | Probe passed. Recording persisted (96). Flow built. Flow failed on its 2nd click, `web.validation.state_mismatch`. |
| 4 | crossborder `place-order` `run-mubstedl-92e0810b` | fixed | Probe passed. 24 steps ran. `recording.persistence`: Core still writing after 90 s (86 entries, 64 appended while waiting, `endedAt` null). |
| 5 | crossborder `place-order` retry `run-mubsxg5q-ca115a6c` | fixed | Probe passed. Recording persisted (105). Flow built. Flow failed on its first click, `web.target.not_found`. |
| 6 | auction primary `run-mubt0554-f019bb04` | probe without reload | Probe passed in about 1.7 s. The script's "Accept all" then timed out after 30 s under the promotion, confirmed by screenshot. This led to the reset and reload. |
| 7 | auction primary `run-mubt6407-9d257645` | final | Probe passed. Recording persisted (62). Flow built. Flow stopped `user_intervention_required`, which is lane C's gap C (the promotion modal). |
| 8 | auction `kestrel-auctions` `run-mubt7uh2-a6e5c5bd` | final | Probe passed. 31 steps ran. `recording.persistence`: 163 entries, 99 appended in the 90 s wait, `endedAt` null. |
| 9 | auction `kestrel-auctions` `run-mubtc3kj-b762fc93` | final | Same as #8. |
| 10 | basic-form `--flow` `run-mubthzkz-f53882f3` | final | **Passed**: oracle passed, reported passed, 4 Flow actions |
| 11 | basic-form recording lane `run-mubtll3u-91824dfb` | final | **Passed**; `actions: [web.dom.extract 1659 ms]`, `reportedVerdict: passed` |
| 12 | basic-form, **temporary wrong session id** `run-mubto983-8851a1ec` | final + break | **Failed at the probe**: `action.dispatch`, "…execute-client-action (400): Unknown client gateway session: t061-deliberately-wrong-session". The edit was reverted; `diff` shows it identical to the saved copy. |
| 13 | basic-form, **temporary mark on the extension's page** (`.staging-run-mubtq0lz-63c7ed05`) | before fix 3 | Probe failed correctly ("Core action read did not return the mark…", status succeeded, `extractedType` string), but **no finalized bundle**. This exposed the evaluation defect fixed in change 3. |
| 14 | the same, after fix 3, `run-mubtxog6-b9ea7333` | final + break | **Failed at the probe**: `runtime.behavior`, the bundle finalized, `facilityFailure` set, `reportedVerdict: null`. Reverted and verified identical. |
| 15 | auction `watch-endings` `run-mubu12i4-a25eb015` | final | Regression check: this workflow recorded under lane C. Probe passed and 13 steps ran, then `recording.persistence` with only 15 entries after 90 s, and each Core poll took about 2.5 s (36 polls). |
| 16 | auction `watch-endings` `run-mubu7qd3-f9eb265e` | **baseline** `HEAD` `run-scenario.ts`, swapped in and restored | A/B under the same load. Probe skipped. The first step, "Accept all", **timed out under the promotion; nothing was recorded.** |

The probe mark `data-fluxiq-core-probe` appears in none of the three workspaces' Core stores (`t061-auction`, `t061-crossborder`, `t061-basic`: 0 files, against 345, 320 and 31 recording object files) after the runs.

After the live work:

- `pnpm --filter @fluxiq-web-extension/test-runner build`, then `node --test` on only the affected files: `dist/core-action-probe/tests/prove-core-action-round-trip.test.js`, `dist/run-evaluation/tests/runner-wiring.test.js`, `dist/lane-rules/tests/*.test.js` and `dist/flow-lane/tests/lane-observation.test.js` → "# tests 44 # pass 44 # fail 0". The new file alone → 7 of 7 pass.
- A mutation check: with the mark comparison disabled in the built JS, tests 5 and 6 fail ("# pass 5 # fail 2"). Rebuilt afterwards.
- `pnpm check`:
  - First attempt: exit 1. One failure in `pnpm lab:test`: "the build lock excludes a second holder" (`scripts/lab/tests/lab-instance.test.mjs:56`), which uses a 40 ms lock timeout, at 96% CPU. I did not touch `scripts/lab`. `pnpm lab:test` alone then gave "# pass 74 # fail 0".
  - Second attempt: **exit 0**. structure tests 182 of 182, lab 74 of 74, task 113 of 113, "structure-audit: passed (84 warning(s), 122 baselined)", and every package check "Done". The only structure note on my files is the existing advisory "run-scenario.ts: 766 lines is past the 400-line advisory threshold". There was no baseline entry to lower.

## Not verified

- **A persisted `kestrel-auctions` recording, and `watch-endings` on the final code.** Both started recording and ran every step, but Core's finalization did not end within 90 s. I attribute this to machine load, not the probe:
  - CPU was 96-99%, with 5-9 other Lab processes running (t052, t060, t063, t066, and a live `social-scheduler` run).
  - Core's polls slowed to about 2.5 s each in #15.
  - `place-order` failed this way once and then persisted on its retry.
  - The probe finishes before recording starts, and changes neither the number nor the size of entries. Kestrel's recordings carry 10-12 MB of state snapshots at about 470 KB each.
  - The baseline A/B (#16) could not record `watch-endings` at all under the same load.

  To settle it, rerun `kestrel-auctions` and `watch-endings` on a quiet machine.
- The crossborder repair task (`crossborder-marketplace-repair-basket-redesign`), which lane C found unrunnable because of L1. Not run; it is a live-provider campaign task outside this brief's provider-free lanes.
- Any scenario other than `basic-form`, `auction-marketplace` and `crossborder-marketplace` on the final code. The probe now runs on every paired recording lane, including those whose old probe was skipped, and each such lane now gets a reset and a fresh load of the start page before recording.
- Chrome only. No Firefox build.

## Open questions or contradictions found

1. **The recording lane's verdict semantics widened.** `reportedVerdict` on the recording lane comes from the probe's actions (`recordingLaneProbeObservation`). Scenarios whose old probe was skipped (no CSS `type` step usable on the start page) reported `null`. They now report `passed` (or `failed`) from the `web.dom.extract`, and bench rows for those recording-lane runs will change accordingly. This is consistent with the existing design, but it is a visible change in the bench.
2. **The auction scripts race a 2.5 s timer by design.** `SEARCH_STEPS` in `apps/scenario-lab/src/scenarios/auction-marketplace/manifest.ts:50-57` press "Accept all" before the home-page promotion appears, and wait for the promotion only on the results page. The reset and reload keep the pre-recording interval short, but under heavy load the baseline already fails this race (#16). A script that waits for "Bid on the go" on the home page, and answers it first, would be robust. That is a scenario-lab change, outside this brief.
3. **Documentation.** `docs/architecture/testing-facility.md` now describes the old probe. I did not edit it because it is outside my ownership. Proposed changes:
   - At about line 1259, replace the lane-rules bullet "**The Core action probe** (`probe-step.ts`)…" with a section, **Core action probe** (`core-action-probe/`): "Before recording, the runner plants a random mark as the `data-fluxiq-core-probe` attribute of the start page's root element. Core issues `web.dom.extract` for that attribute through `execute-client-action`, in the tab the extension holds as active. The probe passes only when the read returns the mark. A refused or failed command, or a missing result, fails as `action.dispatch`. A read that returns anything else, or a mark that cannot be removed, fails as `runtime.behavior`. The runner then resets the fixture, loads the start page again and checks its at-load facts, so the recording starts as the page was first presented, whatever the round trip cost. The probe records one `web.dom.extract` action timing, which is the recording lane's reported verdict unless the run fails at the facility."
   - At about line 1019, the recording-lane paragraph becomes: "It runs the Core action probe, resets the fixture and loads the start page again, selects the project again, starts recording…". The `#lane-rules` link and the lane-rules bullet list lose the probe.
4. **Product gaps seen after recording**, on the Flow runs. The probe did not cause them; they are recorded for the lanes.
   - Crossborder primary and `place-order` recorded Flows fail on their first click. The recorded target is a coupon-popup element (`refused fb-store-coupon`, "0 controls of the same family") that is not on the page at replay: a timed interstitial recorded as a step.
   - `spain-hubs` fails `state_mismatch` on its 2nd click.
   - Auction primary hits gap C.
