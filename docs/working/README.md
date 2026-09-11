# Working Document Index

Every working document in this repository is listed here, grouped by the
`Status` field of its header block. This index is derived from those headers
and regenerated when a document is created, retired, or re-statused; edit the
document's header, not this table. Read it first, pick the relevant document,
then read that document's `Current State` section before anything else.

Format, status vocabulary, ledger rules, worker briefs, and cross-repository
pairing are defined in
[Agent Working Document Protocol](./agent-working-doc-protocol.md).

Core's matching index is at `F:\!FluxIQ\docs\working\README.md`.

## Active

| Document | Owner | Lines | Scope | Paired in Core |
| --- | --- | --- | --- | --- |
| [agent-token-efficiency-plan.md](./agent-token-efficiency-plan.md) | Senior supervisor agent | 516 | Keeping the senior supervisor agent's context small on every project: fix instruction loading, add a global layer under `~/.claude` fed from a shared brain repository, define global / family / project / task memory tiers, and enforce delegation, worker return, and handoff rules mechanically. | `agent-token-efficiency-plan.md` |
| [agent-working-doc-protocol.md](./agent-working-doc-protocol.md) | Senior supervisor agent | 498 | How the supervisor and workers use `docs/working/` as durable memory and as the coordination substrate for multi-agent work. | `agent-working-doc-protocol.md` |
| [automated-testing-facility-plan.md](./automated-testing-facility-plan.md) | Primary agent under the `Execute Plan With Subagents` workflow, with rotated phase subagents (`phase0_contracts`, `phase3_topology`, `phase4_evidence`, `clone_*`, `phase12_*`, `facility_router_subflow`) | 1842 ⚠ | Automated Playwright testing facility for the FluxIQ web extension in `F:\!FluxIQWebExtension`: Scenario Lab fixtures, real-extension fixture, isolated/existing/clone/persistent-isolated FluxIQ topologies, evidence bundles, matrix/CI, bounded improvement agents, persisted-Flow execution, and the persistent self-recording demo scripts. | none |
| [llm-production-automation-plan.md](./llm-production-automation-plan.md) | root coordination agent | 1577 ⚠ | Production-capable, provider-neutral LLM automation through the real web panel, production extension, and Testing Lab (instruction-only blank-Flow creation, evidence-guided exploration, runtime failure diagnosis/adaptation, reusable sanitized evidence); generic behavior lives in Core (`F:\!FluxIQ`), browser/DOM/selector/Testing Lab concerns live in this repository. | none |
| [module-size-governance-plan.md](./module-size-governance-plan.md) | Senior supervisor agent | 312 | Applying the shared file and class size policy to this repository, and decomposing the files here that already exceed it. | `module-size-governance-plan.md` |
| [mvp-week1-web-automation-reliability-plan.md](./mvp-week1-web-automation-reliability-plan.md) | Senior supervisor agent | 789 | Week 1 of the 30-day MVP (Phases 1.1–1.6): browser action vocabulary, element identity, browser state/evidence, failure taxonomy, and FluxBench, with automated verification through the Testing Lab as the primary proof for every phase. Weeks 2–4 are out of scope except where Week 1 must leave a seam for them. | `mvp-week1-web-automation-reliability-plan.md` — Core owns the failure-taxonomy contracts (C1, C2, pulled ahead of Wave 2 by D11) and the expectation-evaluator seam (C3)` |

## Complete

| Document | Owner | Lines | Scope | Paired in Core |
| --- | --- | --- | --- | --- |
| [action-visual-entity-target-plan.md](./action-visual-entity-target-plan.md) | Extension domain | 60 | Letting recorded and executed web actions identify the visual state entity they interacted with, via a domain-level WebAutomationActionVisualTarget. | `action-visual-entity-target-plan.md` |
| [extension-runtime-capabilities-plan.md](./extension-runtime-capabilities-plan.md) | Extension runtime | 1165 ⚠ | Building the extension into a first-class FluxIQ runtime client that executes Automation Studio flows and domain-owned web output nodes. | `runtime-kernel-plan.md` |
| [extension-ui-rebuild-plan.md](./extension-ui-rebuild-plan.md) | Extension UI | 254 | Replacing the card-heavy popup/side-panel UI with one coherent application shell, persistent accessible tabs, and predictable scrolling. | none |

⚠ marks documents over the 800-line compaction threshold (3 of 9 here).
Compact them the next time work touches them; do not schedule a bulk rewrite.
