# Codex extension-cleanup names (t219)

Outcome: Done for bounded mechanical rename; supervisor owns final extension validation and the separate deep-link change.

## Current State

Renames are complete in the isolated t219 downstream tree. No Core edit, historical report edit, commit, merge or push. Source handed to supervisor for final checks.

## Changes and rationale

The automation/recording relays no longer describe the deleted Simple/Advanced UI modes. Names now describe their capability:

- `SIMPLE_PANEL_MESSAGES` -> `AUTOMATION_PANEL_MESSAGES`
- `SimplePanelMessageType` -> `AutomationPanelMessageType`
- `SimplePanelRequest` -> `AutomationPanelRequest`
- `SimplePanelDeps` -> `AutomationRelayDeps`
- `handleSimplePanelControl` -> `handleAutomationRelay`
- background `simplePanelDeps` -> `automationRelayDeps`; local `simple` result -> `automationRelay`
- `background/simple-panel/` -> `background/automation-relay/`
- `simple-panel-control.ts` and its test -> `automation-relay.ts` and `tests/automation-relay.test.ts`

All call sites and barrel exports changed together. Protocol comment no longer points to deleted `panel/simple/relay/messages.ts`. Runtime strings and request behavior are preserved. Test case labels changed mechanically; assertions stayed unchanged. Test discovery does not list the old path explicitly, so no script edit was necessary.

## Exact owned files

- `apps/extension/src/shared/constants.ts`
- `apps/extension/src/shared/protocol.ts`
- `apps/extension/src/background/index.ts`
- `apps/extension/src/background/automation-relay/index.ts` (renamed directory)
- `apps/extension/src/background/automation-relay/automation-relay.ts` (renamed)
- `apps/extension/src/background/automation-relay/tests/automation-relay.test.ts` (renamed)
- `apps/extension/src/panel/recording/review/recording-review.ts`
- `apps/extension/src/panel/automations/controller.ts`
- `apps/extension/src/panel/automations/tests/controller.test.ts`
- this report

The supervisor's background/panel files, open-fluxiq files, automation-strip and its new tests, and architecture documentation were not edited by this worker.

## Validation actually observed

- `git diff --check` -> exit 0; only existing working-document CRLF warning.
- `rg -n 'SIMPLE_PANEL_MESSAGES|SimplePanel|simple-panel|handleSimplePanelControl|simplePanel|panel/simple' apps/extension/src apps/extension/scripts scripts` -> no matches.
- `rg -n 'SIMPLE_PANEL_MESSAGES|SimplePanel|simple-panel|handleSimplePanelControl|simplePanel|Advanced Mode|Simple Mode' apps/extension/src apps/extension/scripts scripts` -> one historical explanatory comment in `panel/getting-started/tests/start-steps.test.ts` naming the old Simple Mode checklist. Preserved its historical meaning.
- Compared every quoted `fluxiq.*` wire literal in shared/constants against `git show HEAD:apps/extension/src/shared/constants.ts` with PowerShell regex extraction and `Compare-Object` -> no differences; **38 literals unchanged**.
- Read the rename diff and searched all references; exported names, call sites and new paths agree.

## Not verified

Per brief, worker did not enqueue extension check/test/build/audit; supervisor runs required final validation after source completion. No Lab, browser, Playwright or provider calls. Historical MVP planning docs and report narratives still name Simple Mode as historical context; preserved.

## Additional finding outside this brief

`packages/test-runner/src/run-scenario/ui-review/capture-extension-panel.ts` has a stale historical comment referring to `apps/extension/src/panel/simple/pairing-card.ts`. It is unrelated to the renamed relay and was not modified.
