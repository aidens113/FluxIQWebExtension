# Extension And Core Boundary Audit

Status: Active
Status detail: Four read-only audit workers (A1-A4) dispatched 2026-10-19; findings and a move plan follow their reports.
Created: 2026-10-19
Last updated: 2026-10-19
Owner: Senior supervisor agent
Scope: Find anything in this repository that belongs in FluxIQ Core (model calls, prompts, judging, generic framework or gateway behaviour, durable ownership of projects, policies and recordings) and plan the moves. Planning only; no code moves in this effort until the user approves the plan.
Paired document: none yet (a Core-side document is owed if moves are approved)
Related: [AGENTS.md](../../AGENTS.md) ("Repository Boundaries", "Automated Testing Facility Boundary"), [repository layout](../architecture/repository-layout.md), [breadth-forty-tasks-plan.md](./breadth-forty-tasks-plan.md)

---

## Current State

**Request (user, 2026-10-19):** audit the extension codebase and make sure nothing in this repository should be in
Core, such as calling models from the extension.

**The boundary (AGENTS.md):** `apps/extension` owns browser APIs, DOM access, recorder UI and browser-side
execution; `domain` owns web-automation contracts, state reducers, input/output mappings and runtime adapters;
generic gateway and framework behaviour belongs in Core; durable project, policy and recording ownership belongs in
Core, not extension-local storage. The extension may import domain contracts; domain must not depend on extension UI
or browser modules. Test infrastructure stays here unless it remains coherent with every browser, DOM, URL,
selector, tab, extension and web-automation concept removed and at least two real domain consumers need it.

**Now:** A1-A4 running (briefs below), read-only on `dev` in the main checkout. Each writes
`extension-core-boundary-audit/reports/a<N>-<area>.md`.

**Next:** consolidate findings into a severity-ranked table and a phased move plan here, then ask the user to
approve the moves.

## Worker Briefs

Shared rules: read-only on source (no edits, builds, browser or paid runs, commits); work on `dev` in
`C:/Users/osrs_/FluxStuff/!FluxIQWebExtension` and read Core at `C:/Users/osrs_/FluxStuff/!FluxIQ` only to compare;
write only your own report. Each finding: file and symbol, what it does, the boundary rule it breaks (or why it
correctly stays), evidence (quote the call or import), the proposed owner in Core or "stays", the move's risk and
the Core seam it would use. Separate confirmed findings from suspicions. Never copy secrets, tokens or page data.

- **A1, model calls and model-facing text:** every place downstream that calls a model or provider (any HTTP to
  provider APIs, SDK imports, API keys, token or cost accounting), builds prompts, tool descriptions, judge or
  verification requests, or holds model-facing guidance text; across `apps/extension`, `domain`, `packages/*`,
  `scripts/`. Lab/test code that only drives Core's own gateway is fine; say which is which.
- **A2, persistence and ownership:** every use of `chrome.storage`, IndexedDB, `localStorage`, files or SQLite
  downstream, and what it holds (projects, Flows, recordings, policies, grants, tokens, run data, settings).
  Classify each as legitimate extension-local state (pairing secrets, UI preferences, transient caches) or durable
  ownership that belongs in Core.
- **A3, generic framework logic:** logic in `domain` and the extension's `background`, `runtime` and `shared` that
  is not web-specific: Flow execution or routing, retry and backoff policy, planning, verification or judging,
  reset or ledger logic, budgets, generic gateway or protocol behaviour, state machines that Core also has. Name
  any duplication of a Core module.
- **A4, packages and scripts:** `packages/*` (agent-orchestrator, boundary-audit, real-site-policy, test-*) and
  `scripts/`: which are web-automation or test infrastructure (stay) and which are generic tooling or framework
  that Core should own or that duplicates Core (for example mirrored scripts), applying the test-facility promotion
  rule.

## Findings

Pending A1-A4.

## Work Ledger

### 2026-10-19 - Audit dispatched
- Agent: supervisor
- Changed: this document
- Why: user request to find downstream code that belongs in Core.
- Validation: not validated; the audit has just been dispatched.
- Outcome: Partial
- Follow-up: consolidate A1-A4.

## Open Questions

None yet.
