Role: Discovery worker; model gpt-6-luna; effort high.
Goal: Audit ALL extension repository production areas for proper browser/domain/Core separation.
Owned: docs/working/runtime-ownership-refactor/reports/extension-boundaries.md only.
Must not touch: source, shared docs, git state or Core; do not spawn.
Read: AGENTS.md Repository Boundaries/Engineering/Validation, CODEX.md,
docs/architecture/repository-layout.md, docs/working/runtime-ownership-refactor.md Current State,
docs/working/extension-core-boundary-audit.md Current State.
Inspect apps/extension, domain, packages, scripts ownership; prior audit claims require current verification.
Find domain-to-extension imports, framework orchestration copies, durable state ownership,
provider usage, deep Core source imports, browser implementation leaking into domain contracts.
Distinguish allowed domain adapters and local Lab infrastructure from framework mechanisms.
Return inventory, exact concrete violations, owning paths, compatibility, focused tests and mechanical guards.
No code edits, broad suites, paid runs or panel start.
End with Outcome/Changed/Validation/Not verified/Report/Notes return contract.
