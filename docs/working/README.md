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
| [agent-git-workflow-plan.md](./agent-git-workflow-plan.md) | Senior supervisor agent | 562 | How work reaches `dev` in this repository when several agents run at once — when a unit of work gets its own branch, when it also gets its own worktree, how a worktree is paired with FluxIQ Core, how provenance survives the fact that workers never commit, and what tooling makes the correct path the cheap one. It deliberately does not introduce pull requests, review gates on `dev`, or any change to what `pnpm check`, `pnpm test` and `pnpm build` mean. | `none yet — a Core-side document is required only if Core adopts the paired-branch half of this (see Open Questions).` |
| [agent-token-efficiency-plan.md](./agent-token-efficiency-plan.md) | Senior supervisor agent | 516 | Keeping the senior supervisor agent's context small on every project: fix instruction loading, add a global layer under `~/.claude` fed from a shared brain repository, define global / family / project / task memory tiers, and enforce delegation, worker return, and handoff rules mechanically. | `agent-token-efficiency-plan.md` |
| [agent-working-doc-protocol.md](./agent-working-doc-protocol.md) | Senior supervisor agent | 498 | How the supervisor and workers use `docs/working/` as durable memory and as the coordination substrate for multi-agent work. | `agent-working-doc-protocol.md` |
| [automated-testing-facility-plan.md](./automated-testing-facility-plan.md) | Primary agent under the `Execute Plan With Subagents` workflow, with rotated phase subagents (`phase0_contracts`, `phase3_topology`, `phase4_evidence`, `clone_*`, `phase12_*`, `facility_router_subflow`) | 1842 ⚠ | Automated Playwright testing facility for the FluxIQ web extension in `F:\!FluxIQWebExtension`: Scenario Lab fixtures, real-extension fixture, isolated/existing/clone/persistent-isolated FluxIQ topologies, evidence bundles, matrix/CI, bounded improvement agents, persisted-Flow execution, and the persistent self-recording demo scripts. | none |
| [bootstrap-no-proposal-investigation.md](./bootstrap-no-proposal-investigation.md) | Senior supervisor agent | 278 | Diagnose and fix the first closed boundary that turns a successful model-backed Flow bootstrap request into zero durable proposals, then rerun that same live UI path before focused tests. | none |
| [first-class-data-extraction-plan.md](./first-class-data-extraction-plan.md) | Senior supervisor agent | 717 | Make structured data extraction a fundamental FluxIQ capability: Core owns generic datasets (schema, per-run persistence, preview, CSV/JSON export, iteration) and their UI; the web domain and extension own DOM extraction, element picking, repeating-structure and field detection, and pagination; extraction is recordable and compiles to ordinary Flow nodes; the Testing Lab measures FluxIQ's own extraction. | `first-class-data-extraction-plan.md` |
| [llm-production-automation-plan.md](./llm-production-automation-plan.md) | root coordination agent | 1577 ⚠ | Production-capable, provider-neutral LLM automation through the real web panel, production extension, and Testing Lab (instruction-only blank-Flow creation, evidence-guided exploration, runtime failure diagnosis/adaptation, reusable sanitized evidence); generic behavior lives in Core (`F:\!FluxIQ`), browser/DOM/selector/Testing Lab concerns live in this repository. | none |
| [manual-panel-test-findings.md](./manual-panel-test-findings.md) | User for submission; senior supervisor agent for triage and closure | 217 | Capture manual panel, extension, recording, Flow creation, execution, repair, reuse, and performance findings so isolated workers can reproduce and fix them. | none |
| [module-size-governance-plan.md](./module-size-governance-plan.md) | Senior supervisor agent | 312 | Applying the shared file and class size policy to this repository, and decomposing the files here that already exceed it. | `module-size-governance-plan.md` |
| [mvp-week2-automation-loop-plan.md](./mvp-week2-automation-loop-plan.md) | Senior supervisor agent | 703 | Week 2 of the 30-day MVP, Phases 2.1-2.9: the automation loop (standardized adaptation context, diagnosis separated from exploration, bounded harness exploration, recovery success detection, converting exploration into reusable automation, validating, persisting, and resuming adaptations, and proving deterministic reuse), with Testing Lab verification. Phase 2.0, the data extraction foundation, lives in first-class-data-extraction-plan.md. | `mvp-week2-automation-loop-plan.md` |
| [repository-state-audit.md](./repository-state-audit.md) | Senior supervisor agent | 137 | Read-only audit of FluxIQWebExtension and FluxIQ Core at their current dev heads, with confirmed findings and prioritized follow-up. | `repository-state-audit.md` |
| [week2-exit-plan.md](./week2-exit-plan.md) | Senior supervisor agent | 564 | Take the 30-day MVP over the Week 2 exit line — Fail, Diagnose, Explore, Recover, Generate Repair, Validate, Persist, Resume, Re-run Deterministically, proven live through the real panel and extension — by integrating the open task branches, closing the loop's remaining gaps across all three entry points, and building an end-to-end UI test lane that exercises it. | `mvp-week2-automation-loop-plan.md` (Core's side of the Week 2 loop)` |

## Complete

| Document | Owner | Lines | Scope | Paired in Core |
| --- | --- | --- | --- | --- |
| [action-visual-entity-target-plan.md](./action-visual-entity-target-plan.md) | Extension domain | 60 | Letting recorded and executed web actions identify the visual state entity they interacted with, via a domain-level WebAutomationActionVisualTarget. | `action-visual-entity-target-plan.md` |
| [extension-runtime-capabilities-plan.md](./extension-runtime-capabilities-plan.md) | Extension runtime | 1165 ⚠ | Building the extension into a first-class FluxIQ runtime client that executes Automation Studio flows and domain-owned web output nodes. | `runtime-kernel-plan.md` |
| [extension-ui-rebuild-plan.md](./extension-ui-rebuild-plan.md) | Extension UI | 254 | Replacing the card-heavy popup/side-panel UI with one coherent application shell, persistent accessible tabs, and predictable scrolling. | none |
| [lab-port-allocation-plan.md](./lab-port-allocation-plan.md) | Senior supervisor agent | 73 | Make Testing Lab loopback-port selection reject ports that cannot actually be bound, without changing product runtime networking or the user's running panel. | none |
| [mvp-week1-web-automation-reliability-plan.md](./mvp-week1-web-automation-reliability-plan.md) | Senior supervisor agent | 720 | Week 1 of the 30-day MVP (Phases 1.1–1.6): browser action vocabulary, element identity, browser state/evidence, failure taxonomy, and FluxBench, with automated verification through the Testing Lab as the primary proof for every phase. Weeks 2–4 are out of scope except where Week 1 must leave a seam for them. | `mvp-week1-web-automation-reliability-plan.md` — Core owns the failure-taxonomy contracts (C1, C2, pulled ahead of Wave 2 by D11) and the expectation-evaluator seam (C3)` |

⚠ marks documents over the 800-line compaction threshold (3 of 17 here).
Compact them the next time work touches them; do not schedule a bulk rewrite.
