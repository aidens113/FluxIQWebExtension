# Chat capability contracts against Core's real handlers

Worker report. In progress.

## Outcome

In progress. The machine was interrupted once. Afterwards both harness files were checked: no NUL bytes, complete endings, and the one edit had survived. No Core file had been touched yet.

## Design (settled)

- Where the test lives: `apps/web/src/features/automation-studio/conversation/capabilities/tests/`. It imports Core from its **source**, by relative path. It does not use the built `dist`, which predates Core commit 6c6a06d.
- `core-contract-world.ts` sets up a real `AutomationStudioService` on a temporary directory, with Core's real `registerAutomationStudioApi` handlers on a real `GlobalProgramApiRegistry`.
  - The transport behaves the way the web route does: the payload crosses as JSON, and the auth session is added by the route's own `withProgramAuthSession`.
  - Every property the handler (or the registry, or the service) reads from the payload is recorded by path. A field the capability sends that nobody reads counts as **dropped**.
  - Seeded before each test: a project, a Flow, a primary part and a second part, a route, a run, a recording, an adaptation and a published version.
  - The client gateway is faked, for revoke only.
- `core-contract-arguments.ts` builds each capability's arguments from its own declared arguments:
  - Ids come from the seed; words come from a table.
  - Overrides are used only for JSON structures and for words that choose between endpoints, and they give one variant per choice.
  - An argument it cannot fill fails the test with a sentence naming it.
- Each capability runs through `dispatchPanelCapability`, as the chat path runs it. The PIN is supplied as context only when the capability asks first, because Core never takes a PIN from the model.

## Suspected defects found by reading (to be confirmed by the test)

- `permission.revokeClient`: Core classes `revoke-client-trust` as `authoring`. The capability declares `delete` and requires a PIN.
- `route.delete`: Core classes `delete-flow-map-route` as `authoring`. The capability declares `delete` and requires a PIN.
- `version.publish` and `version.deprecate`: Core classes both endpoints as `authoring`, yet each capability requires a PIN. A capability that does not ask first can never be given a PIN from chat, so dispatch refuses it with "still needs authorizationPin".
- `project.create`, `project.rename`, `recording.note` and `recording.rename`: they carry the same required-PIN pattern. Core's classification is still to be checked.
- `permission.allowModelRun` and `permission.check`: they send no `keyId`, and Core's grant service requires one ("An enabled LLM key is required."). The panel's own buttons take it from the Flow's `metadata.llmSecretKeyId`.

## What changed and why

(pending)

## Commands run and observed results

(pending)

## Not verified

(pending)

## Open questions or contradictions found

(pending)
