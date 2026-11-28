# Brief t1095 (sub-supervisor): audit and fix the panel and extension UI so making a Flow is one clear path

**The user's words (2026-11-27):** "The panel and extension UI are confusing regarding projects, open chats, and
syncing. For instance with syncing i had to manually cancel the existing request and make a new one for it to even
pop up. When on the extension its not clear what Im supposed to do as a user trying to create a flow. Do i create a
project first? do i ask fluxiq? do i use the panel chat or the extension chat? etc. IT NEEDS TO BE UNIFIED AND EASY TO
UNDERSTAND. CLICKING THE PROJECT NAME IN EXTENSION SHOULDNT MINIMIZE OR MAXIMIZE CONVERSATIONS OR WHATEVER IS
HAPPENING THERE. DO A FULL AUDIT AND FIX ALL THAT."

**The user's direction, the same day (now a standing rule in AGENTS.md):** "having large majority of config and
adding keys and all that in the panel. This would go for all clients. Managing projects, creating new ones, all that
in the panel NOT the client. The client is just for showing whats going on. You should be able to SEE all projects and
the current flow being worked on from lcient ofc".
- So keys, settings, and creating or managing projects move to the panel for every client.
- The extension shows every project and the Flow being worked on, and its run.
- Lead's reading: the extension keeps its chat, the same conversation the panel shows, as the way a person asks for
  work.
- Remove or move every config or project-management control the extension has now, and point it at the panel.

**Goal.** One obvious way for a person to make and run a Flow from the extension, with the panel consistent with it.
Projects, chats and syncing must be understandable without knowing FluxIQ's internals. Fix every defect the audit
finds; do not just list them.

**Ownership rules** (AGENTS.md, "Repository Boundaries", user 2026-11-02).
- The extension chat renders from Core's `@fluxiq/ui-components`. Rendering, stream models and styles change in Core.
- `apps/extension/src/panel/chat` is a thin adapter: approvals, routing, storage and `chrome.*` stay downstream.
- The panel is Core's `apps/web`.
- Follow Core's own agent instructions in Core.

**Phase 1: audit.** Write `docs/working/ui-unification-plan.md`, a new working doc from the protocol template, and
add it to the index with `pnpm structure:baseline`. It covers:
- every place a person meets projects, conversations, "ask FluxIQ", panel chat versus extension chat, and syncing or
  pairing;
- what each does, what is confusing, and the defects, with steps to reproduce: the project-name click toggling the
  conversations, and a sync request that only appears after a cancel and resend;
- the single intended path. Make the decision and record it; do not stop to ask.
  - A person who opens the extension can say what they want in its chat.
  - FluxIQ picks or creates the project and the Flow for them.
  - The panel shows the same project and conversation, never a separate one.
- the changes, partitioned by file across repositories.

Read the user's standing UI rules: AGENTS.md, the "chat-first" memory, and "review UI in every live test loop". Use
the extension's provider-free UI paths (`ui:e2e` on the ten realistic scenarios only) and screenshots to see the
current state.

**Phase 2: fix.**
- Dispatch workers by file, with briefs of at most 40 lines.
- Keep wire contracts in sync (protocol types, routing, domain mappings, tests, docs).
- Add tests for each defect: the click no longer toggles conversations; a sync request appears without a resend.

**Trees.**
- Downstream: `C:/Users/osrs_/FluxStuff/fxwork/t1095/!FluxIQWebExtension`.
- Core: `C:/Users/osrs_/FluxStuff/fxwork/t1095/!FluxIQ`.
- Both are on branch `task/t1095-ui-audit-unify`.
- Workers edit only there, never the main checkouts. The user's live panel runs from the main checkouts on ports
  3000 and 4777; leave them alone.

**Must not touch.**
- `apps/extension/src/runtime/**`, `content/**` and `page-world/**` (t1094).
- `runtime/models/**`, `runtime/llm/**` and `flows/authoring/model/authoring-mode/**` in Core (t1093).
- `answer-first/result/**` and `answer-first/result-feed/**` (t1091).

**Budget.** Workers on Sonnet (`worker`) by default; `worker-heavy` for design-critical or cross-repo contract
pieces; at most about 8 workers. Ask the lead before going beyond that.

**Checks.**
- Narrow, per the repository rules: the extension and Core typechecks for the packages touched (Core
  `pnpm check`), the tests beside each change, both structure audits, and `node scripts/check/model-text.mjs`.
- Screenshots of the new flow from a provider-free `ui:e2e` run.
- Put heavy commands through the heavy slot.
- No live or paid runs; no git (the lead commits).

**Report.** `reports/t1095.md` beside the new working doc, plus the return contract. Include the screenshots' paths
and the before and after of each defect.
