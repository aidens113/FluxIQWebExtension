# Working Document Index

Every working document in this repository is listed here. This index is the
entry point for any agent starting a task: read it, pick the relevant
document, then read that document's `Current State` section before anything
else.

Format, status vocabulary, ledger rules, subagent briefs, and cross-repository
pairing are defined in
[Agent Working Document Protocol](./agent-working-doc-protocol.md).

Core's matching index is at `F:\!FluxIQ\docs\working\README.md`.

## Documents

| Document | Status | Owner | Lines | Scope | Paired in Core |
| --- | --- | --- | --- | --- | --- |
| [agent-working-doc-protocol.md](./agent-working-doc-protocol.md) | Active | Root coordination agent | 300 | How agents use `docs/working/` as durable memory and multi-agent coordination substrate. | `agent-working-doc-protocol.md` |
| [module-size-governance-plan.md](./module-size-governance-plan.md) | Active | Senior supervisor agent | 95 | Applying the shared file and class size ratchet here, and this repository's four files over 800 lines. Policy owned by the Core pair. | `module-size-governance-plan.md` |
| [llm-production-automation-plan.md](./llm-production-automation-plan.md) | Active | Root coordination agent | 1510 ⚠ | Provider-neutral LLM creation, live runtime adaptation, and zero-LLM deterministic replay through the real panel and production extension. | `adaptive-flow-training-roadmap.md` (unconfirmed) |
| [automated-testing-facility-plan.md](./automated-testing-facility-plan.md) | Active | Testing facility | 1696 ⚠ | Repository-local browser testing facility: scenarios, Playwright drivers, extension loading, assertions. Core promotion and real-site execution outstanding. | none |
| [extension-runtime-capabilities-plan.md](./extension-runtime-capabilities-plan.md) | Unclassified | unassigned | 1039 ⚠ | Building the extension into a first-class FluxIQ runtime client executing Studio flows and domain-owned web output nodes. | unknown |
| [extension-ui-rebuild-plan.md](./extension-ui-rebuild-plan.md) | Unclassified | unassigned | 243 | Replacing the card-heavy popup/side-panel UI with one coherent application shell. | none |
| [action-visual-entity-target-plan.md](./action-visual-entity-target-plan.md) | Unclassified | unassigned | 49 | Letting recorded and executed web actions identify the visual state entity they interacted with. | `action-visual-entity-target-plan.md` |

⚠ marks documents over the 800-line compaction threshold. Compact them the
next time work touches them; do not schedule a bulk rewrite.

## Triage backlog

`Unclassified` means the document predates the protocol and its header has not
been reviewed, not that it is inactive. Three documents here need a triage
pass to set a real status, owner, and pairing. `action-visual-entity-target-plan.md`
is the priority: a document of the same name exists in Core, and neither
declares which side owns the contract.
