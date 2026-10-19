# Traces And Offline Trials (Extension Side)

Status: Active
Status detail: Plan approved by the user on 2026-10-19; nothing implemented. The extension's P0 work is the boundary audit's Phases 0 and 1.
Created: 2026-10-19
Last updated: 2026-10-19
Owner: Senior supervisor agent
Scope: The extension and domain side of Core's traces and offline trials: in-band artifacts, page snapshots in tracing mode, the offline queue fix, and the domain's offline read/target resolver (tier 2). Core owns the trace contract, store, offline-trial runner and build-loop integration.
Paired document: `docs/working/trace-offline-trials-plan.md` in FluxIQ Core (plan of record)
Related: [extension-core-boundary-audit.md](./extension-core-boundary-audit.md), [breadth-forty-tasks-plan.md](./breadth-forty-tasks-plan.md)

---

## Current State

**Plan of record:** Core's `docs/working/trace-offline-trials-plan.md` (decisions, tiers, phases, tests, risks), with
the consultant's original beside it. This document holds only what this repository owns.

**This repository's part:**
- **P0 prerequisites:** boundary audit Phase 0 (a structure-audit rule failing on provider calls downstream; drift
  checks for mirrored Core code; deletions; one provider key list) and Phase 1 (the offline event queue,
  `fluxiq.queuedEvents`, scoped to its browser session, project and recording instead of persisting across
  restarts and replaying to any later session). The recording capture switches become Core-owned policy
  (audit item 7).
- **P0 spike:** can a captured page (Chrome/Edge page capture, or a DOM serialization with styles) be reloaded in a
  sandboxed browser with scripts and network off, faithfully enough for the extension's own extraction
  (`content/extraction`) and target resolution (`content/action-runtime`, `content/identity`) to give the same
  answers as live? Measured on traces from the ten realistic sites only.
- **P2 extension lane (after Core's P1 contract):** in-band artifacts for anything Core dereferences later; page
  snapshots at each observation and read in tracing mode; Chrome and Edge first; tracing on for every Lab live run.
- **P5:** the domain's offline resolver, running the same extraction and target code over captured snapshots and
  returning evidence gaps for anything dynamic.

**Rules that carry over:** browser-level tests only on the ten realistic scenarios; traces never feed model guidance;
no recorded page data, tokens or typed secrets in logs, reports or commits; secret screening runs in Core before a
trace is stored.

**Next:** start the audit's Phase 0 and Phase 1 and the snapshot spike when the user gives the go-ahead to begin
implementation.

## Work Ledger

### 2026-10-19 - Paired plan filed
- Agent: supervisor
- Changed: this document (Core plan of record filed in the same unit)
- Why: the user approved the revised traces and offline trials plan.
- Validation: not validated; planning only.
- Outcome: Accepted (planning)
- Follow-up: P0.

## Open Questions

None requiring user input.
