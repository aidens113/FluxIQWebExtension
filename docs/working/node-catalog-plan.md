# Node Catalog Plan

Status: Active
Status detail: Audit stage dispatched 2026-10-07 (four read-only leads by node family); implementation stages follow the audits.
Created: 2026-10-07
Last updated: 2026-10-07
Owner: Senior supervisor agent
Scope: A full audit of the web extension's node catalog — every existing node's contract, implementation, tests and live failures — then fixes and extensions so each node is robust, and new nodes for what the realistic sites need. It does not cover the general tools (script, request; `structural-agent-plan.md` stage 1) except where a node would replace a script use the Lab reports.
Paired document: none (web domain and extension; Core control nodes are referenced, not owned)
Related: [structural agent plan](./structural-agent-plan.md), [week report](./mvp-final-month-plan/reports/week-review/report.md), [web capabilities](../architecture/web-capabilities.md), [working index](./README.md)

---

## Current State

User's order (2026-10-07): a full audit of the node catalog; robust nodes with proper logic; every existing node improved or fixed; many more nodes planned. Model-written JS is a last resort and each Lab use of it is a node-building work item (memory `js-last-resort-requests-off-by-default`).

Catalog today (domain `domain/src/output-nodes/`, `domain/src/actions/`; extension `apps/extension/src/content/actions/`): navigate, click, type, select, check, clear, upload, keypress, dialog, scroll, extract, extract_list, next_page, assert, capture_snapshot, wait_for_selector, wait_for_text; observation tools detect_repeating_structure and find_on_page.

In progress: four audit leads (briefs below). Next: merge their findings into one ranked fix/extend/new list, then implementation stages partitioned by file.

## Worker Briefs

### Shared rules for the node audits
Read-only: no source, test or other doc edits; no builds, tests, Lab, browser or provider calls; never write in any fxwork tree. For every node in your family give: its contract (parameters, outputs, routes, consequences), the path from domain definition through the gateway to the extension action (file:line), its test coverage (which behaviours are tested, which are not), its live failures (grep `docs/working/language-driven-flow-loop-plan/debugs/` and the lane reports for the node id and its words), bugs found (file:line, how it fails), robustness gaps (waiting for the page to settle, scrolling into view, covered or disabled or hidden targets, iframes, shadow roots, dynamic re-render, slow pages, retries, what it reports when it fails), and a ranked list of fixes and extensions, each with the tests that would prove it. Then propose new nodes for your family with contracts. Report to `docs/working/node-catalog-plan/reports/<your-label>.md` in the main downstream checkout.

### Brief: node-audit-interaction (lead)
- Family: click, type, select, check, clear, upload, keypress, dialog, scroll, and target resolution (`apps/extension/src/content/action-runtime/resolve-target.ts`, element finding, actionability, covered/disabled logic).

### Brief: node-audit-reading (lead)
- Family: extract, extract_list, next_page, assert, capture_snapshot, wait_for_selector, wait_for_text, and the observation tools detect_repeating_structure and find_on_page (structure detection, field identity, page view).

### Brief: node-audit-navigation (lead)
- Family: navigate and browser-level behaviour: tabs opened by a click, iframes, shadow DOM, downloads, page loads and redirects, history/back, waits for navigation, robot checks and consent layers.

### Brief: node-audit-gaps (lead)
- Task: what the ten realistic scenario sites and their 67 live tasks (`apps/scenario-lab/src/scenarios/*`, `realistic-site-live-tasks.ts`) need that no node does well today — e.g. date pickers, autocomplete and comboboxes, hover menus, drag and drop, infinite scroll, tables, file download, copy text, sliders, rich text editors, multi-step forms, login handover. For each: the task(s) that need it, how a build does it today (or fails), and a proposed node with contract and tests. Rank by tasks unblocked.

## Work Ledger

### 2026-10-07 — Audit dispatched
- Agent: supervisor
- Changed: this document.
- Why: the user's order for a full node-catalog audit.
- Validation: not validated (dispatch only).
- Outcome: Accepted
- Follow-up: merge the four audits into one ranked plan.

## Open Questions

- None yet.
