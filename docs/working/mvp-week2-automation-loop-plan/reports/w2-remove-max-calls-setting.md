# Report: w2-remove-max-calls-setting

Two repositories changed:

- **FluxIQ Core** (`F:\!FluxIQ`): only `apps/web/src/features/automation-studio/settings/` and `authoring/blank-flow-authoring-model.ts`, plus their tests.
- **This repository**: only `packages/test-runner/src/demo-llm-create-ui/` and `demo-workspace/diagnosis-ui.ts`, plus their tests.

Nothing was committed or pushed. I ran no demo, `pnpm lab`, `pnpm dev` or `--live-llm` command. Nothing ran in a browser or against a real provider.

## Outcome

**Done, with one contradiction in the brief that I had to resolve (Trap 2).**

- **Flow Settings.** The "Max calls" input is gone, along with its hint ("Use 1 for diagnosis-only, 2 for diagnose-and-adapt, or up to 8…"), the `FLOW_LLM_MAX_CALLS = 8` bound, the draft field `llmMaxCalls`, its default and its validation message ("LLM call limit must be between 1 and 8.").
- **Trap 1.** The single-call "author from instruction" build is now offered whatever call count the Flow has stored, including none. It still asks Core for exactly one call and one grant use. Token, timeout, cost and retry limits must still match exactly.
- **Trap 2.** A save now keeps the Flow's stored call count unchanged. I could not stop writing it, because Core's current `update-flow-settings` rejects a save that has no count (details below). If a Flow has no stored count, the save writes 1, which is what the form always wrote for such a Flow.
- **Trap 3.** No Lab demo types "Max calls" any more, and the tests now fail if one does.
- **Side effect, a fix.** Before this change, a Flow whose stored count was above 8 could not be saved from Settings. The Lab's API path now stores 26 by default, and the panel then showed "LLM call limit must be between 1 and 8." Such a Flow now saves, and a test covers this.

**Required checks, all passing:**

| Check | Result |
| --- | --- |
| Core `pnpm check` | exit 0 |
| Core web automation-studio tests | 1,073/1,073 (was 1,067; I added 6) |
| This repository's `pnpm check` | exit 0 |
| test-runner tests | 993/993, 0 failed (see the note on one unrelated failure in my first run) |
| Structure audit, both repositories | passed |

## What changed and why

### Trap 2: what a save writes for `maxCalls`

**I chose to keep the stored value, because stopping would break every save.**

- **What Core does today.** `packages/fluxiq/.../api/handlers/flows.ts` (the `update-flow-settings` handler) calls `assertFlowLlmExecutionSettings`, which runs `boundedWholeNumber(value.maxCalls, 1, AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_MAX_CALLS)`. The handler then merges metadata shallowly (`metadata: { ...current.metadata, ...patch.metadata }`), so the panel's `llmExecutionSettings` replaces the stored object wholesale.
- **Proof.** I ran Core's validator directly from source with `tsx` (scratch script, no Core file edited):
  - no `maxCalls`: rejected, "LLM execution limit is invalid.";
  - 1, 26 and 64: accepted;
  - 65: rejected.
- **What would go wrong otherwise.** If the panel stopped writing `maxCalls`, every Flow Settings save that includes LLM settings would fail, and the panel always sends them. I could not change Core `packages/**`.
- **What the code does now.** The save builder in `flow-settings-model.ts` reads the Flow's stored `llmExecutionSettings.maxCalls` through a private `storedLlmCallCount`:
  - a stored positive whole number is written back unchanged;
  - otherwise (missing, 0, negative, fractional, a string, NaN or Infinity) it writes `FLOW_LLM_UNSET_CALL_COUNT = 1`.
- **Why 1 is acceptable.** It is not a new choice. It is the value the form showed and wrote for a Flow with no stored settings, and `flowSettingsMetadata`'s "technical metadata" default uses the same constant. But the user never chose it, so see open question 1.
- **Stray values cannot leak in.** A draft value is never used: a test passes `llmMaxCalls: "3"` in the draft and the save still writes the stored 26.

### Core, `apps/web/src/features/automation-studio/settings/`

**`flow-settings-model.ts`**

- **Removed:**
  - the `FLOW_LLM_MAX_CALLS` export;
  - `maxCalls` from `FLOW_LLM_EXECUTION_DEFAULTS`;
  - `llmMaxCalls` from `FlowSettingsDraft`, `FLOW_SETTINGS_DEFAULT_VALUES` and `flowSettingsDraftFromFlow`;
  - `llmMaxCalls` and its call-limit check from `flowLlmSettingsErrors`.
- **Added:** the private `FLOW_LLM_UNSET_CALL_COUNT` and `storedLlmCallCount`, described above.
- **Size.** Exported values went from 22 to 21. The file went from 510 to 515 lines; it was already past the 400-line advisory threshold.

**`FlowSettingsView.tsx`**

- Removed the import and the "Max calls" `<label>` with its hint. The second row of per-request limits now has three inputs instead of four.

**`tests/settings-view.test.tsx`**

- The accessible-names test no longer expects "Max calls" and asserts that no such input exists.
- The `flowLlmSettingsErrors` draft lost `llmMaxCalls`, and the three call-limit assertions are gone.
- The effective-sources test now asserts the rendered HTML has no "Max calls", "diagnosis-only" or "bounded evidence-guided generation". Its payload assertion still expects `maxCalls: 1`, with a comment: that Flow stored nothing, so the fallback applies.

**`tests/flow-settings-call-count.test.tsx` (new, 5 tests; mocks only `Modal`, as the authoring tests do)**

1. No `FLOW_LLM_MAX_CALLS` in the barrel, no call-count default, and no `llmMaxCalls` in the draft. A stored count of 26 gives no validation error.
2. Stored counts 1, 2, 8, 26 and 64 are saved unchanged while the timeout and total tokens are edited. A stray draft `llmMaxCalls: "3"` is ignored.
3. The fallback of 1 applies to a Flow with no execution settings, to execution settings with no count, and to unreadable counts (0, -1, 2.5, `"4"`, null, NaN, Infinity).
4. A count of 26 survives `flowSettingsFlowFromDetail`, the path the view actually saves from.
5. The full form: `FlowSettingsViewContent` loads a detail storing 26 and renders no "Max calls" input and no call-limit text. The test changes the timeout, clicks "Save Settings", enters a PIN and clicks "Authorize and Save". The `saveFlow` request then carries `{ tokenLimits, maxCalls: 26, timeoutMs: 15000, maxEstimatedCostUsd: 0.25, retryCount: 0 }`.

### Core, `authoring/blank-flow-authoring-model.ts` (Trap 1)

- `savedLimitsMatchBlankFlowAuthoring` no longer checks `settings.maxCalls === limits.maxCalls`. It still matches all three token limits, `timeoutMs`, `maxEstimatedCostUsd` and `retryCount` exactly.
- `BLANK_FLOW_AUTHORING_LIMITS.maxCalls: 1` stays, because the request sends `maxCalls: 1` and the panel issues the grant with `maxUses: 1`.
- The doc comments now say that the call count is one by construction and is not read from the Flow.

**`authoring/tests/blank-flow-authoring.test.tsx`**

- Removed the old assertion that a stored `maxCalls: 2` disables the build.
- New test: "offers the single-call build whatever call count the Flow stored, and still matches every other saved limit exactly".
  - Stored settings with no count, and with 2, 8 or 64, each give exactly the one-call payload.
  - Ten mismatches still disable the build: each token limit off by one, missing token limits, timeout 20,001 or missing, cost 0.24 or missing, retries 1 or missing.
  - Missing execution settings also disable it.
  - The mounted panel, for a Flow saved with no count, shows "Build proposal from active instructions". Clicking it preflights with `maxCalls: 1` and issues the grant with `maxCalls: 1` and `maxUses: 1`.

### This repository, `packages/test-runner/src/` (Trap 3)

**`demo-llm-create-ui/limits.ts`**

- `creationSettingsFields` no longer produces a "Max calls" row for any profile.
- `FIRST_LIVE_CREATION_LIMITS.maxCalls: 1` is kept as a statement about the profile (the build is one call, and the evaluator certifies one). `src/tests/demo-llm-creation.test.ts`, which is not mine, pins it. It is no longer typed into the form.
- Comments updated.

**`demo-workspace/diagnosis-ui.ts`**

- The diagnosis path no longer types `["Max calls", "1"]`. It types only its three token limits, then timeout, cost and retries as before.
- The doc comment is rewritten.

**Tests**

- `demo-workspace/tests/diagnosis-ui.test.ts`: the first test is now "the settings driver types no call count for either run". It pins the diagnosis token table exactly and the shared timeout/cost/retries rows, and asserts the file does not match `/max calls/iu`.
- `demo-llm-create-ui/tests/exploration.test.ts`: the test is renamed "no creation profile types a call count into Flow Settings".
  - The build's fields no longer include "Max calls".
  - `FIRST_LIVE_CREATION_LIMITS.maxCalls` is still 1.
  - The whole directory's source does not match `/max calls/iu`.
- `demo-llm-create-ui/tests/readiness-gate.test.ts`: dropped `maxCalls` from the list of `limits.<field>` reads the compiled driver must contain, and added `doesNotMatch(/limits\.maxCalls|max calls/iu)` on the compiled output.

**Label search.** A grep of this repository (excluding `node_modules`) for "Max calls" before the change found only these two drivers typing it, plus historical `docs/working` reports, which I did not edit. A grep of Core (excluding `node_modules`, `.git`, `dist` and `.next`) found only the two settings files.

## Commands run and observed results

### Core

- **Settings and authoring tests.** `npx vitest run src/features/automation-studio/settings src/features/automation-studio/authoring` in `F:\!FluxIQ\apps\web`: `Test Files 5 passed (5)`, `Tests 42 passed (42)`.
- **Negative controls.** Each was applied to a copy backed up in the scratchpad, run, then restored. Each restore was confirmed with `cmp`, which printed `restored-identical`.

  | Control | Result |
  | --- | --- |
  | A. Put `settings.maxCalls === limits.maxCalls` back | Authoring: `1 failed \| 15 passed`, the new test ("{…no maxCalls…}: expected { ok: false } to deeply equal { ok: true, … }") |
  | E1. Drop the timeout match | 1 failed (`{"timeoutMs":20001}: expected true to be false`) |
  | E2. Drop the cost match | 1 failed (`{"maxEstimatedCostUsd":0.24}`) |
  | E3. Drop the output-token match | 1 failed (`maxOutputTokens: 1001`) |
  | B. Save always writes `maxCalls: 1` | Settings: `3 failed \| 23 passed`: stored count unchanged, detail round trip, full form |
  | C. Save drops `maxCalls` | Settings: `5 failed`, including the full-form test and the fallback test |

- **Core validator probe.** `npx --no-install tsx <scratch>/w2rmc-core-probe.mts`, importing `file:///F:/!FluxIQ/packages/fluxiq/.../llm-execution-settings.ts`, printed:
  - `maxCalls absent: rejected (LLM execution limit is invalid.)`
  - `maxCalls 1: accepted`
  - `maxCalls 26: accepted`
  - `maxCalls 64: accepted`
  - `maxCalls 65: rejected (LLM execution limit is invalid.)`
- **Core `pnpm check` (root), run twice.** The second run was on the final file, after I shortened a comment. Both exit 0.
  - `structure-audit: passed (140 warning(s), 254 baselined).`
  - `structure-audit: 1 baseline entries can be lowered.` The only lowerable entry, from `--json`, is `exported-values … flow-settings-model.ts::values` with value 21 against a recorded 22. That drop is mine.
  - `packages/contracts`, `packages/client-gateway-websocket`, `packages/fluxiq` and `apps/web` all reported `check: Done`.
  - Audit lines naming my files are advisory warnings only: `[file-lines] flow-settings-model.ts` (515 on the final run) and the existing `[exported-values] blank-flow-authoring-model.ts: 9`.
- **Core web automation-studio suite.** `npx vitest run src/features/automation-studio`: exit 0, `Test Files 200 passed (200)`, `Tests 1073 passed (1073)`. That is 1,067 plus my 1 authoring test and 5 settings tests.
- **Core audit, standalone.** `node scripts/structure-audit.mjs`: `passed (140 warning(s), 254 baselined)`, with the same "1 baseline entries can be lowered" line.

### This repository

- **`pnpm check`.** Exit 0.
  - `structure-audit: passed (57 warning(s), 17 baselined).`
  - All ten packages reported `check: Done`.
  - The only audit line naming my files is the existing `[exported-values] diagnosis-ui.ts: 12`. I added no exports.
- **test-runner suite, first run.** `pnpm --filter @fluxiq-web-extension/test-runner test`: exit 1, `# tests 993`, `# pass 992`, `# fail 1`.
  - **The failure.** `not ok 2 - FIFO tickets prevent a later scheduler from overtaking an earlier waiter`, in `dist/bench/campaign/machine-slots/tests/acquire-machine-cell-slot.test.js`, with an `unhandledRejection`: "Machine cell slot owner is unreadable; refusing unsafe recovery".
  - **Why it is not mine.** No file under `src/bench` is modified. That file alone (`node --test …acquire-machine-cell-slot.test.js`) gave `# tests 16`, `# pass 16`.
  - **Likely cause.** A race with another process, or this machine's memory fault. It rests on a single observation.
  - **My tests in that run.** All passed: `ok 173` (no creation profile types a call count), `ok 185` (Phase 3 UI driver), `ok 210` (settings driver types no call count), `ok 211` and `ok 212`.
- **test-runner suite, rerun.** Exit 0, `# tests 993`, `# pass 993`, `# fail 0`.
  - The brief's baseline was 981. My changes add no test cases here (four existing tests changed), so the other 12 come from other workers.
- **Lab negative controls.** Each file was restored and confirmed with `cmp` (`restored-identical`).
  - **L1.** Put `["Max calls", "1"]` back into `diagnosis-ui.ts`. `node --test dist/demo-workspace/tests/diagnosis-ui.test.js` gave `not ok 1 - the settings driver types no call count for either run` (`# fail 1`).
  - **L2.** Put a "Max calls" row back into `creationSettingsFields`, then ran `npx tsc -p tsconfig.json` (exit 0) and `node --test` on the exploration and readiness-gate tests. Result: `not ok 2 - no creation profile types a call count…` and `not ok 5 - Phase 3 UI driver pins…` (`# fail 2`).
  - After restoring, I rebuilt with `tsc` (exit 0) and reran both files: `# tests 7`, `# pass 7`.
- **Audit, standalone.** `node scripts/structure-audit.mjs`: `passed (57 warning(s), 17 baselined).`

## Not verified

- **No browser, Lab demo or real-provider run.**
  - The Settings screen was checked only in `react-test-renderer` and `renderToStaticMarkup`. The full-form test replaces `Modal` with a plain section.
  - I did not look at the three-input row's layout.
  - No Lab demo drove the real Settings form after the change.
- **No real save through Core.** No HTTP `update-flow-settings` call reached a running Core. "Core rejects a save without `maxCalls`" rests on calling Core's validator function from source and reading `api/handlers/flows.ts`, not on a request to a running Core.
- **"No demo looks for the field"** rests on the source grep and the source-level and compiled-output tests above, not on running the demos.
- **Wider test runs.** I did not run `pnpm test` or `pnpm build` in either repository beyond the named suites.
- **Core's source may still change.** Other workers are editing Core `packages/**`. My reading of `assertFlowLlmExecutionSettings` reflects the working tree at the time I ran the probe. Their diff to its test file (`llm-execution-settings.test.ts`) still treats `maxCalls` as required and bounded by `AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_MAX_CALLS`.

## Open questions or contradictions found

1. **The brief's Trap 2 conflicts with Core.**
   - "Stop writing it" is not possible while Core's `assertFlowLlmExecutionSettings` requires `maxCalls` and `update-flow-settings` replaces `llmExecutionSettings` wholesale.
   - "Preserve what the Flow had" works for any Flow that has a count. A Flow with none still needs some number, and the panel writes 1, which the user did not choose.
   - Recommendation: a Core change in `packages/fluxiq/.../api/handlers/llm-execution-settings.ts` that accepts a missing `maxCalls`, validating it only when present. After that, delete `FLOW_LLM_UNSET_CALL_COUNT` and `storedLlmCallCount` and stop writing the field; the tests in `flow-settings-call-count.test.tsx` then need their fallback rows changed.
2. **A stored count above 64 cannot be fixed from the panel.**
   - Such a value can only arrive through `save-flow`, which does not run that validator.
   - The panel would carry it forward, Core would reject the Settings save with "LLM execution limit is invalid.", and there is no longer a field to correct it.
   - Before this change the field showed the value, though the panel's own 1-to-8 check blocked the save anyway. I did not clamp the value, because clamping would write a number the user did not choose, and the web app does not restate Core's 64.
3. **The baseline can be lowered.** `F:\!FluxIQ\.structure-baseline.json` records `flow-settings-model.ts::values: 22`, and the file now has 21. That file is not mine. The supervisor should run `pnpm structure:baseline` in Core at integration, once the other Core workers' changes are in, so the ratchet records it.
4. **The Lab's API path still writes and checks `maxCalls`.** `packages/test-runner/src/live-llm/flow-settings.ts` (not mine) stores it through the API and verifies it is stored (`execution.maxCalls !== plan.maxCalls`). That is consistent with Core requiring the field. A later panel save now keeps that value instead of refusing to save a count above 8.
