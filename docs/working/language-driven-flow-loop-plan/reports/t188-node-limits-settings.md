# t188-B: Flow size setting — store it and let a person change it

## Outcome

Done. Tree: `C:/Users/osrs_/FluxStuff/fxwork/t188/!FluxIQ` (branch task/t188-node-limits). Nothing committed.

## What changed and why

P = `packages/fluxiq/src/programs/automation-studio`. The shape of `model/flow-size/flow-size-settings.ts` did not change; I only read it.

**Core**
- `P/model/flows.ts`: `defaultAutomationStudioFlowSettingsMetadata()` now writes `flowSizeSettings: { maxNodesPerSubflow: 100 }`, built from `AUTOMATION_STUDIO_FLOW_SIZE_SETTING`. New Flows therefore store the setting.
- `P/runtime/service/flow-settings/merged-metadata.ts`: the merge always produces `flowSizeSettings.maxNodesPerSubflow`, using `automationStudioFlowMaxNodesPerSubflow(source)`. A Flow with no setting reads 100, and so does one holding an invalid value. Any other keys stored in the object are kept.
- `P/runtime/service/flow-settings/settings-fingerprint.ts`: the setting is part of the settings revision, but **only when it differs from the default**.
  - Why it belongs there: the fingerprint covers settings that limit what a build or adaptation may produce, such as adaptation policy and LLM execution limits. The size setting limits how many nodes a build may write, and the edges, depth and bytes derived from that number. A binding recorded under one limit should not survive a change to it.
  - Why only when non-default: existing Flows (no key, so they read 100) and new Flows (key stored as 100) keep exactly the revision they had before. Stored `settingsRevision` bindings (compiled plans, adaptations' `base_settings_revision`) stay valid.
  - In SQL mode, `settingsRevision` is the repository counter, which already goes up on every settings save, so nothing changed there.
- Digest check: `getLlmExecutionDependencyDigest` hashes the Flow returned by `getFlow`, which is stored metadata with only the locked-default clearing applied, not merged defaults.
  - The default is not added at read time, so existing Flows' execution digests are unchanged.
  - Only Flows created after this change carry the new key in their document.
  - `locked-default-migration.ts` needed no change, because the default is filled at merge time.
- `P/api/handlers/flows.ts`:
  - `update-flow-settings` calls `assertFlowSizeSettings(metadata)`. If `flowSizeSettings` is absent, the stored value is kept. If it is present but not an object, it is refused with `flowSizeSettings must be an object holding maxNodesPerSubflow.`. Otherwise the value must pass `automationStudioFlowSizeSettingIssue`, whose message names `flowSizeSettings.maxNodesPerSubflow`.
  - Both `update-flow-settings` and `get-flow-metadata-detail` now return the detail with `flowSizeSettings: { maxNodesPerSubflow }` added (a stored valid value, otherwise 100). This was necessary: that detail is the SQL `flow_settings` row, which has no column for the setting, and the settings view reads only the detail. Without it, a saved value would redraw as the old one and be flagged "did not take effect".
  - `get-flow-metadata-detail` now also calls `getFlow` when a detail exists. That call is deliberately unguarded (the structure audit's failure-as-empty rule), so a Flow whose document cannot be read now fails the endpoint rather than reporting 100.
- `P/api/contracts/**`: not touched, because no flow-settings payload is typed there.

**Web** (`apps/web/src/features/automation-studio/settings/`)
- New `max-nodes-setting.ts` exports `FLOW_SIZE_SETTING`, a **copy** of Core's constant (key, field, label "Maximum nodes per Subflow", default 100, range 1..1000), exported from `index.ts`.
  - Why a copy: the web app takes Core runtime values only through client-safe subpath exports (`fluxiq/automation-studio/llm-models`, `nodes`, ...). There is none for the model, every import from the main `fluxiq/automation-studio` barrel is `import type`, and adding a subpath means editing `packages/fluxiq/package.json`, which I don't own.
  - A test reads Core's source and fails if the copy drifts.
  - The file is not named `flow-size-setting.ts` because a third `flow-` file in this directory fails the audit's prefix-group rule.
- `flow-settings-model.ts`:
  - The draft gains `maxNodesPerSubflow`.
  - `flowLimitsInterfaceErrors` refuses blank, non-whole or out-of-range values with "Maximum nodes per Subflow must be a whole number from 1 to 1,000.".
  - `FLOW_SETTINGS_DEFAULT_VALUES` gets "100", and the effective-values list gets a "Limits" row.
  - `flowSettingsFlowFromDetail` copies `detail.flowSizeSettings` into metadata.
  - `flowSettingsDraftFromFlow` reads the stored value, falling back to 100 when it is missing or invalid, the same way Core reads it.
  - `buildFlowSettingsSavePayload` sends `flowSizeSettings` on every save, even when it is the default, because Core's merge keeps any key that is left out.
  - The file's exported-value count is unchanged (baselined at 21), because the helpers are module-local.
- `persistence-check.ts`: adds a label for the new field, so a save that did not keep it is named.
- `FlowSettingsView.tsx`: after "Reroutes per run" there is a new "Flow size" divider and a number input, `aria-label="Maximum nodes per Subflow"`, min 1, max 1000, step 1.
- Tests: `settings-round-trip.test.tsx` gets a round-trip value ("150"), which its every-key guard requires. `large-project-behavior.test.tsx` and `settings-view.test.tsx` had hand-built drafts for `flowLimitsInterfaceErrors` and now include the field.

**New tests**
- `P/api/handlers/tests/flows.test.ts`, new describe block:
  - a new Flow stores 100 and the detail reports 100;
  - saving 150 returns 150 from the save, and both `getFlow` and a detail reload give 150;
  - 0, 1.5, 1001 and "150" are refused, naming `flowSizeSettings.maxNodesPerSubflow` and the reason, and the stored value stays 100;
  - a non-object setting is refused;
  - a Flow saved without the key reads 100.
- `P/runtime/service/flow-settings/tests/flow-size-settings.test.ts`:
  - the default metadata carries 100;
  - the merge fills 100 when the setting is missing or invalid, and keeps 150;
  - the fingerprint is the same for a legacy Flow, a default Flow and an explicit-100 Flow, and changes at 150.
- `apps/web/.../settings/tests/max-nodes-setting.test.tsx`:
  - the copy matches Core's source;
  - the draft default and invalid fallback;
  - the save payload always states the value;
  - the range errors;
  - detail to draft;
  - component test: the control shows the loaded 120, is changed to 150, shows "Unsaved changes", sends `flowSizeSettings: {maxNodesPerSubflow: 150}`, shows 150 with "Settings saved." (no "did not take effect"), then a remount that reloads shows 150;
  - an out-of-range value blocks the save and shows the range message.

## Commands run and observed results

- `cd packages/fluxiq && npx vitest run src/programs/automation-studio/runtime/service/flow-settings src/programs/automation-studio/api/handlers/tests/flows.test.ts src/programs/automation-studio/model/tests --maxWorkers=2 --minWorkers=1`, final run: **13 files, 106 tests passed**. An earlier run that also included `tests/permission-defaults.test.ts` gave 14 files, 120 tests passed.
  - Plain `--maxWorkers=2` fails at startup in both packages with `RangeError: options.minThreads and options.maxThreads must not conflict`, so `--minWorkers=1` is needed.
- `cd apps/web && npx vitest run src/features/automation-studio/settings --maxWorkers=2 --minWorkers=1`: **9 files, 59 tests passed**.
  - The first run failed 2 tests, both hand-built drafts missing the new field. That is fixed.
- `npx tsc --noEmit`, run in apps/web and in packages/fluxiq while holding build slot b1: **web exit 0, core exit 0**. The first Core run had 1 error in my new test (`exactOptionalPropertyTypes` on metadata), which is fixed.
- `node scripts/structure-audit.mjs`: 1 violation left, and it is not mine: `[failure-as-empty] P/runtime/service.ts: 17 ... Baseline 16`. It comes from another worker's uncommitted line in `runtime/service.ts`: `validateAutomationStudioFlowAdaptation(adaptation, automationStudioFlowMaxNodesPerSubflow((await this.getFlow(...).catch(() => undefined))?.metadata))`. My own two audit failures are fixed: the handler's `.catch(() => null)`, and the `flow-` prefix group.

## Not verified

- No live panel or browser check (out of scope: no dev server, no Lab).
- The SQL `flow_settings` row still doesn't store the setting. `P/runtime/service/flows/store.ts` and the repository are not mine, so the value lives in the Flow document and is added to the detail by the handler. Any other reader of the SQL detail won't see it.
- `save-flow` (the generic whole-document save) does not validate `flowSizeSettings`. Readers fall back to the default for invalid values, as the model intends.
- I did not run the full package or web suites, `pnpm check`, or builds.

## Open questions or contradictions found

- **Slot incident**: I accidentally deleted another lane's `C:/Users/osrs_/FluxStuff/build-slots/b2` claim at about 01:41Z.
  - Cause: my chained command's unconditional `rm -rf b2` ran after `mkdir b2` failed because that lane had just claimed it.
  - I didn't run anything under it, and I then waited for b1 instead.
  - The owning lane's tsc may have overlapped with a later claimant of b2. Please tell whoever held b2 around then.
- The audit failure in `runtime/service.ts` (17 vs baseline 16) is another t188 worker's `.catch(() => undefined)`. It will fail `pnpm check` until it is changed.
- The brief suggests `--maxWorkers=2` alone. With this vitest version it needs `--minWorkers=1`.
