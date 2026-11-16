# Usable Client Plan

Status: Active
Status detail: Discovery running; implementation will build on task t914's committed tip in a new paired task.
Created: 2026-11-16
Last updated: 2026-11-16
Owner: Senior supervisor agent
Scope: Make the extension and the Core web panel usable for a person testing them today: no model-key unlock for connected clients, project and chat navigation entirely inside the extension, the settings a person needs, and a panel that is fast to open and move around.
Paired document: none yet (Core edits are recorded here; a Core-side record is owed if the Core part grows beyond this task)
Related: [Hosted platform launch](./hosted-platform-launch-plan.md), [MVP launch](./mvp-launch-plan.md)

## Current State

**User request (2026-11-16):** "we need to get a working version of the extension/panel that I can test done today. The UI base looks good on the surface, but is functionality unusable. The panel is slow, seems to be missing some needed configuration stuff/ux navigation, and generally just needs to be reworked. Extension needs to actually be able to navigate through different chats and projects entirely through the extension, right now you cant do anything. And ENSURE that dumb unlock key feature is removed. if a client is connected, they are CONNECTED, meaning they have access to the basic feature of the fluxiq framework (llm)".

**Findings so far:**

- The unlock removal the user wants was already built by Codex on task t914 (Core `79f175d2a`, extension `1285dd320`, 2026-11-14) and verified by unit tests only. t914 never merged, so `dev`, which the user runs, still has the unlock.
- t914 holds 17 Core commits (820 files, +34,605/-3,492) and 11 extension commits of hosted-platform foundation, all unmerged. Its worktree also holds 105 uncommitted extension files of an unfinished content-script "admission" privacy refactor, idle since 2026-11-14 23:26. That WIP stays untouched in `fxwork/t914`.
- `pnpm dev` serves the Core panel with `next dev --turbopack`, a development server that compiles each route on first request; this is a likely cause of the slow panel and is being measured.

**Decision (lead, 2026-11-16):** build today's work on t914's committed tip (both repositories) in a new paired task, rather than re-implementing the unlock removal on `dev`, so the two never conflict. t914's committed foundation lands on `dev` with this task once local panel and extension journeys are verified live.

**Next:** discovery reports (below), then file-partitioned implementation briefs, then a live check of every journey in a headed browser, then hand the user a running instance.

## Cloud Plan Review (2026-11-16)

Review of [hosted-platform-launch-plan.md](./hosted-platform-launch-plan.md) as it stands on `dev` and on task t914, for the user. The design itself (Core owns identity, billing and entitlements; website stays on Hostinger; app on app.getfluxiq.com; local, hybrid and consumer modes as separate axes; no silent fallback between local and cloud; durable admission before paid work) is sound and is kept. What needs changing:

1. **Nothing has landed.** Two days of implementation (17 Core and 11 extension commits) sit on t914, and the `dev` copy of the plan still reads "audit only, nothing implemented". User-visible results such as the unlock removal never reached the user. Change: land t914's committed foundation now (this task), and from here merge each verified unit into `dev` as it finishes instead of growing one branch.
2. **No launch date.** The plan says no calendar date is justified, but go-live is about a month out (user, 2026-11-10). Change: a dated schedule cut for parallel lanes, with the critical path named: usable local client (this task), hosted panel with accounts on one server, a dedicated browser per customer, then billing. Marketplace, shared compute, real OS environments and enterprise licensing move after launch.
3. **The product people touch is missing from the phases.** The plan covers infrastructure, accounts and billing but has no package for the panel and extension being usable, although the hosted panel is what customers use at launch (user, 2026-11-10). Change: add a client-usability package (navigation, settings, speed, production panel build) ahead of phase 1; this task is its first unit.
4. **Unlock wording.** The `dev` copy still frames model-key custody around unlocks ("never borrow another person's latest unlock"). The user's rule (2026-11-16) is that a connected client has model access. Change: custody is server-held protection of configured keys; access follows authentication and IAM, and revocation still applies. Recorded in AGENTS.md.
5. **Unfinished privacy refactor.** t914's worktree holds 105 uncommitted extension files changing every content action to check tab "admission", so hosted sign-in tabs are never captured. It is unfinished and has been idle since 2026-11-14. Change: give it its own task and brief, and check whether one gate at the background capture authority gives the same guarantee before resuming a refactor of every action.

## Discovery

| Report | Question |
| --- | --- |
| `reports/extension-navigation-audit.md` (running) | Which extension journeys work, break or are missing, and why |
| `reports/unlock-removal-verification.md` (running) | Whether t914 removed every unlock surface a connected client meets |

## Work Ledger

### 2026-11-16 — Reconcile Codex's cloud work and open this plan
- Agent: Senior supervisor.
- Changed: this document.
- Why: the user asked for a review of Codex's cloud work and a usable extension and panel today.
- Validation: `git log --oneline dev..HEAD` in `fxwork/t914` (both repositories) -> 11 extension and 17 Core commits unmerged; `git status --short | wc -l` -> 122 extension and 10 Core uncommitted paths; newest uncommitted edit 2026-11-14 23:26.
- Outcome: plan opened; discovery dispatched.
- Follow-up: implementation briefs once discovery returns.

## Open Questions

None blocking.
