# Node Catalog Plan

Status: Active
Status detail: Four source audits complete and reconciled into a ranked backlog; t301 implements three shared blockers with provider-free browser regressions.
Created: 2026-10-07
Last updated: 2026-10-06
Owner: Senior supervisor agent
Scope: A full audit of the web extension's node catalog — every existing node's contract, implementation, tests and live failures — then fixes and extensions so each node is robust, and new nodes for what the realistic sites need. It does not cover the general tools (script, request; `structural-agent-plan.md` stage 1) except where a node would replace a script use the Lab reports.
Paired document: none (web domain and extension; Core control nodes are referenced, not owned)
Related: [structural agent plan](./structural-agent-plan.md), [week report](./mvp-final-month-plan/reports/week-review/report.md), [web capabilities](../architecture/web-capabilities.md), [working index](./README.md)

---

## Current State

User's order (2026-10-07): a full audit of the node catalog; robust nodes with proper logic; every existing node improved or fixed; many more nodes planned. Model-written JS is a last resort and each Lab use of it is a node-building work item (memory `js-last-resort-requests-off-by-default`).

Catalog today (domain `domain/src/output-nodes/`, `domain/src/actions/`; extension `apps/extension/src/content/actions/`): navigate, tab, download, click, type, select, check, clear, upload, keypress, dialog, scroll, extract, extract_list, next_page, assert, capture_snapshot, wait_for_selector, wait_for_text; observation tools detect_repeating_structure and find_on_page.

Done: `reports/node-audit-interaction.md` (18 ranked fixes, 8 proposed nodes; top: unarmed native dialogs hang a run, `check` sets `.checked` without a click so React checkboxes stay unchanged, number and date fields lose characters, `scroll` only moves the window, a press nothing answered still succeeds) and `reports/node-audit-reading.md` (18 fixes, 7 nodes; top: Next page misses in-place re-renders, Next page with no detected way should try every way, one shared disabled rule including ancestors and classes, verifying nodes must verify something, waits and asserts judge every match). Not done: the navigation and gaps audits were stopped at the Codex handoff (2026-10-07 05:10 UTC); rerun them from their briefs. Pending user decision from the interaction audit: trusted input for hover menus needs the debugger channel, which the user ruled out except for network capture. Next: rerun the two audits, merge all four into one ranked list, then implementation stages partitioned by file.

The consultant review does not cancel the user-ordered full audit. Finish
navigation/gaps and merge all four reports into one ranked backlog; implement
shared A-D blockers first alongside the [candidate/acceptance work](./mvp-final-month-plan/consultant-revision.md).
The remaining [navigation](./node-catalog-plan/reports/node-audit-navigation.md)
and [gaps](./node-catalog-plan/reports/node-audit-gaps.md) source audits are now
complete (2026-10-06 locally), superseding the stopped-at-handoff statement above.
All four feed the [ranked backlog](./node-catalog-plan/ranked-backlog.md). t301 owns
controlled check, in-place Next and type-submit permission parity; none is complete
on assignment alone. Supervisor independently counted 57 current task definitions
across ten sites. The planned 67 scope has ten unaccounted tasks, not ten passes or
retired rows; preserve this discrepancy until the intended inventory is reconciled.

Wide catalog expansion is not a prerequisite for that first proof. Audit claims
about React/input/navigation behavior remain source hypotheses until browser
regressions reproduce them; JavaScript does not produce trusted input events.

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

### 2026-10-06 - Four audits reconciled; three shared fixes assigned
- Agent: Codex supervisor; navigation/gaps worker.
- Changed: navigation/gaps reports `2b248440`, current inventory and ranked backlog.
- Validation: supervisor reviewed both reports and spot-checked tab effect table, download missing-time acceptance and professional fixture initialPage Next bug; independently counted all ten live-tasks.ts files (57). Reports are source findings, no reproduced browser failures or qualification.
- Outcome: Partial.
- Follow-up: t301 fail-first browser regressions/checks; other ranked owner units follow. Do not repeat historical landed Core/read-list changes or relax the requested 67 scope silently.

### 2026-10-07 — Audit dispatched
- Agent: supervisor
- Changed: this document.
- Why: the user's order for a full node-catalog audit.
- Validation: not validated (dispatch only).
- Outcome: Accepted
- Follow-up: merge the four audits into one ranked plan.

### 2026-10-07 — Two audits done; two stopped at handoff
- Agent: supervisor; audit leads.
- Changed: `reports/node-audit-interaction.md`, `reports/node-audit-reading.md` (committed with the plan).
- Why: the user's ordered node audit.
- Validation: not validated (read-only audits; nothing run).
- Outcome: Partial
- Follow-up: rerun the navigation and gaps audits; one ranked plan.

### 2026-10-06 - Audit retained; implementation priority aligned with candidate gate
- Agent: Codex supervisor, task t295.
- Changed: explicit full-audit obligation and blocker-first implementation dependency.
- Why: consultant suggested deferral, but the newer explicit user request requires all four audit families; broad expansion need not block acceptance proof.
- Validation: documentation/source review only; navigation/gaps audits and browser proofs remain pending.
- Outcome: Accepted
- Follow-up: finish remaining audits, rank fixes, implement shared blockers with owning regressions.

## Open Questions

- Trusted input (hover menus, sites that ignore synthetic events) needs the debugger channel. Owner: user. Recommended default: no debugger; send the full synthetic pointer sequence (pointerover/enter/move/down/up/click at the element's coordinates) and report sites where that fails as JS-or-node work.
