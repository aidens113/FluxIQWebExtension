# Extension UI fixes (audit briefs 1 and 2), task t915

Tree: fxwork/t915/!FluxIQWebExtension, `apps/extension/src/panel`. Not committed.

## What changed, at the cause
| Defect | Cause | Fix |
|---|---|---|
| 1 Header wraps actions 461-540 px | tabs only took their own row under 460 px | breakpoint now 600 px: the tabs are always a deliberate second row up to 600, so brand+switcher and the actions share row 1 at every width 320-600 (`shell/shell.css`) |
| 3 Settings border | `.top-settings` lost to `.small-button` at equal specificity | rule now `.top-actions .top-settings` |
| 4 Advanced has no marker | `display:flex` summary dropped the native marker | token-coloured chevron that flips when open (`settings/settings.css`) |
| 5 Bold URL inputs | `.field{font-weight:650}` inherited | inputs set to 400 |
| 7 Slider track near-black (light) | browser track colour | `.humanness-range` track/thumb drawn from `--edge`/`--accent` (panel CSS, Core untouched) |
| 12 Scrollbars | not re-applied | `scrollbar-color/width` on settings and automations scrollers |
| 6 Blank Library | with no project chosen (or offline) Core's screen renders an empty string, nothing to say | the tab now shows "Choose a project at the top..." or "Connect to FluxIQ..." and hides the empty strip (`automations-tab.ts`) |
| 8 Bare "Something went wrong." | the relay's `{ok:false, code}` replies (not_paired, no_project, unreachable, refused, failed) carry text `errorSentence` does not map | new `copy/relay-failure-sentence.ts`; `state/request.ts` uses the code when the text is unmapped; humanness fallback reworded |
| Walk-through leftover | step 1 was unconditionally "Next" before pairing | new `getting-started/reachability/` reads the discovery document at the web address while disconnected (5 s beat, 3 s timeout); `startGuide(..., reachable)` shows step 1 Done and Sign in as Next. `PanelPorts.reachability` lets a spec fake it |

## Commands run
- `pnpm --filter ...extension build` -> refused: Core's build is stale (Core worker is editing ui-components). Ran `npx tsc -p tsconfig.json --noEmit` (clean) then `node apps/extension/scripts/build-extension.mjs` (built dist/chrome).
- `node apps/extension/scripts/test-extension.mjs src/panel` -> 702 tests, 702 pass, 0 fail (new: reachability reader, steps with `reachable`, relay sentences).
- `npx tsc -p tsconfig.test.json --noEmit` (apps/extension) -> no output.
- `node scripts/structure-audit.mjs` -> "passed (250 warning(s), 551 baselined)" (after one statement-packing fix in my new test).

## Screenshots
Before: test-runs/extension-ui-audit/ (`unp-home-480-dark`, `p-settings-360-light`, `p-settings-bottom-360-dark`, `p-settings-advanced-360-dark`).
After: test-runs/extension-ui-fixes/ `home|settings|settings-advanced|automations-library` x 360, 400, 480, 540 x dark, light, plus `metrics.log`. Measured: top bar 81 px (two deliberate rows) and no horizontal overflow at every width, Settings border `rgba(0,0,0,0)`, URL input weight 400.

## Not verified
- Library note and Automations text: unpaired the panel is gated by getting-started, so `automations-library-*` shots show that screen; pairing against the slow test panel was not attempted. Library note has no unit test.
- Reachability against a live FluxIQ: step 1 stayed "Next" in the shots because nothing answered at the extension's default web address; only the unit tests cover the Done path. The discovery fetch from the panel page relies on `<all_urls>` host permission.
- The no-project/not-paired sentences were not seen in the browser (unit-tested only). Items 2, 6 (Core part), 9, 10, 11 are Core or shell items outside this brief (9 and 10 shell items were not in the stated fix list).

```text
Outcome: Partial
Changed: apps/extension/src/panel/{shell/shell.css,shell/mount-panel.ts,shell/contracts.ts,settings/settings.css,automations/automations.css,automations/automations-tab.ts,automations/humanness/flow-humanness-section.ts,copy/index.ts,copy/relay-failure-sentence.ts,copy/tests/copy.test.ts,state/request.ts,getting-started/index.ts,getting-started/start/steps.ts,getting-started/start/tests/steps.test.ts,getting-started/reachability/*}
Validation: `node apps/extension/scripts/test-extension.mjs src/panel` -> 702 pass, 0 fail; tsc app and test projects clean; structure-audit passed
Not verified: paired Library/Automations screens, live reachability Done state, relay sentences in the browser
Report: C:/Users/osrs_/FluxStuff/!FluxIQWebExtension/docs/working/usable-client-plan/reports/extension-ui-fixes.md
Notes: Standard build refused (Core stale); used the build-extension.mjs fallback. Header is a deliberate two-row bar up to 600 px.
```
