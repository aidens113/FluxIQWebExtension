# MVP Launch

Status: Active
Status detail: Plan written 2026-11-10 for about one month to go-live; five workstreams, W1 already running, W2-W5 dispatched the same day.
Created: 2026-11-10
Last updated: 2026-11-10
Owner: Senior supervisor agent
Scope: Everything between today and a launchable MVP: data scraping and task execution (W1), a humanness setting from the extension slider down to Core and FluxNodes (W2), FluxNode developer overrides and docs (W3), the extension's brand and UI (W4), the Core web panel as a hosted product (W5), and pluggable person-needed handlers and extension add-ons (W6). It does not change a standing rule in either AGENTS.md.
Paired document: Core `docs/working/fluxnode-plan.md` (W3), Core `docs/working/hosted-production-plan.md` and this repository's `hosted-production-plan.md` (W5).
Related: [task speed](./task-speed-plan.md), [MVP seal](./mvp-seal-plan.md), [Answer First](./answer-first-plan.md)

---

## Current State

**State (2026-11-10).** Plan written from five read-only surveys (brand, extension UI, Core panel, FluxNode surface, timing paths). W1 is running as the live lane t885, t897, the held t893 and the coming t898. W2-W5 are dispatched as sub-supervisor workstreams with the interfaces below fixed first.

**The user's words (2026-11-10):**
- "Realistically have 1 month from today" (no hard date), "We're almost to the finish line of MVP!"
- "Focus heavy on data scraping & task execution, UX/UI, and the core web panel."
- Humanness: "a slider that you can change on the extension, and should 100% be available in core as well". Higher humanness: "node times should be randomized, click positions randomized where possible, random missclicks added". Minimum: "just max efficiency... useful for something like web scraping with no account"; the human side is "meant to look more human-like on higher rate limit type websites".
- FluxNodes: "developer overrides that allow developer to fine tune exactly how certain behavior works... highly customize every part of fluxnodes if they want to, everything down to the prompts used. We'll need good docs for FluxNodes as well."
- Extension: "REALLY refine the UI... rebrand it so it matches the website stuff" (getfluxiq.com, FluxIQWebsite); "see all chats, easily navigate everything, set user settings that are important for extension".
- Panel: "users will be able to use the core fluxiq panel hosted in the cloud & customized for that specific usecase."

**Next.** Each workstream reports at its first checked point; the lead verifies, merges and records it here. W6 (handlers and add-ons, added 2026-11-10) starts with its design document.

---

## Shared Interfaces (fixed before dispatch)

**I1. Humanness.** One integer `humanness` from 0 to 100.
- 0 is today's code path exactly: no added waits, centre-first click points, synchronous typing. 0 is the default everywhere, because speed is the user's top priority and a person raises it per site or per use.
- Core: `@fluxiq/contracts` exports the type, bounds and default. It travels on a run's options, a FluxNode's options and per-run overrides, and the answer-first caller options. The engine reads it for node timing.
- Extension: `FluxIQSettings.humanness` (shared/protocol.ts, normalised in background storage). It is sent to Core with the run, and to the content script on each `BrowserActionCommand` as `humanness`, so click, type and scroll read it.
- The evidence-based page pace (slow down only after a 429 or 503) applies at every level.

**I2. Brand tokens.** The website is the source: ink #0c0d0f ground, panel #111214, one amber accent #f5b83d (hover #ffc95c), text fg #e8e6e3 / muted #b5b2ac / dim #8c8a85, hairlines #1b1d21 / #23252a / #2e3035, ok #7fc99b, Geist and Geist Mono, 2px amber focus ring at 4px offset, no gradients, glows or icon tiles (`FluxIQWebsite/src/app/globals.css`, `docs/architecture/README.md` "Brand").
- Core `packages/ui-components/src/theme/tokens.css` becomes the single token source for the extension and the panel. Dark is the brand default; a light theme derived from the same tokens stays for people who need it.
- The website has no warning or danger token; W4 adds them in the same restraint (red #fa6571 and orange #f5b94a from the site's demo) and records the choice.
- Logo: `FluxIQWebsite/design/brand/fluxiq-mark.svg` replaces the CSS "F" and the generated indigo icons.

**I3. Chat threads.** Core's chat transport port (`packages/ui-components/src/chat/ports/transport.ts`) carries `listAllThreads`, `newThread`, `renameThread` and `deleteThread`. The ui-components chat renders a conversation list with New chat, search and per-thread rename and delete. The extension implements the port through background relays to Core's conversations API, and the panel through its loaders. One component serves both clients.

**I4. Person-needed handlers.** Core defines one handler interface for every moment a run needs someone other than the model: a robot check, a sign-in, a permission question.
- A handler receives the need (kind, site, step, what the page shows, screenshot reference) and returns one of: resolved (the page is past it), handed off (wait for an outside answer, with a deadline), or declined (fall back to the next handler).
- Handlers are chained. The default chain is today's behaviour: pause and ask the person in the chat.
- Developers register handlers per FluxNode, per run (through W3's overrides) or per workspace. The extension registers its own handlers (W6).
- A handler can never skip the permission question for a dangerous act, and the step log records which handler resolved each need.

---

## Decisions

- **Humanness safety (lead).**
  - A misclick lands only on an inert point next to its target. The point is verified non-interactive before dispatch (no control, link, input or handler on it or its ancestors), and never on another control.
  - No misclick on a step whose act is lasting (change, send, money, delete).
  - Randomised click points stay inside the target's visible box and are re-hit-tested; a point that misses falls back to today's deterministic search.
  - Robot checks still pause for the person at every level; humanness never touches them.
  - Randomness comes from a seeded generator recorded in the step log, so a run is reproducible.
- **Humanness is pacing, not a symptom cap.** The standing root-cause rule is about fixing failures; humanness is the person's chosen behaviour, and level 0 keeps the speed work's results.
- **FluxNode overrides are layered.** Defaults < FluxNode declaration < per-run overrides, with every prompt, tool description, judge text, pace, retry, deadline and model reachable through one typed `overrides` object. Overrides that would weaken a safety rule (permission for dangerous acts, robot-check pauses, secret screening) are refused with a named error.
- **A repeated request after an achieved attempt is a new act (lead, from the user's rules).** Holding acts as done applies only to continuing an attempt that did not achieve. The Lab judges each attempt by its change. This is lane t898 (W1).
- **No PIN for the MVP, and merged task branches are deleted (lead, 2026-11-10, at the user's request).** Recorded in AGENTS.md (the edit awaits the user's commit, since agent instruction files are protected).

---

## Workstreams

Each workstream owns its paths and must not touch another's. A path two need is serial, and the owner is named here.

### W1. Data scraping and task execution (running)
- Lanes: t885 (live checks, rows, named columns; then breadth at `--attempts 4`, one task per site, alternating Haiku and Sonnet), t897 (replay endings, S9 deviation persisted, absent-interruption deviation, answer card, dining), t898 (new act after an achieved attempt; the chat's "already done" wording), t893 (faster page actions, re-proof now unblocked).
- Then speed Phase B: S1 effort per decision (towels attempt 1 was 79% model thinking), S5 judge verdict-first, A2 (S2) batched read-only looks.
- Acceptance: every realistic site has at least one task proven live at `--attempts 4` with replays at 0 calls, and every scraping task has nonempty record-by-record data.

### W2. Humanness (sub-supervisor)
- Owns: Core contracts humanness module; Core `engine/automation/pacing/**`; fluxnode and answer-first caller options' humanness field; extension `shared/protocol.ts` (humanness field only), `background/storage.ts` normalisation, `content/actions/{click,type,scroll}.ts`, `content/action-runtime/{click-gesture,actionability}.ts`, `content/action-runtime/keyboard/**`, the runtime's command builder for the humanness field; their tests.
- Must not touch: `content/actions/execute.ts`, `content/action-runtime/page-work/**`, `runtime/navigation-events/**`, `runtime/automation-tab.ts` (t893); `panel/**` (W4); Core `answer-first/**` other than the options reader (W1 lanes).
- Phases: H1 contract and plumbing at level 0 (no behaviour change; every existing test passes unchanged); H2 node timing jitter in Core; H3 click point jitter, typing cadence and scroll dwell in the content script; H4 inert misclicks; H5 Lab measurement at levels 0, 50 and 100 on two realistic sites.

### W3. FluxNode developer overrides and docs (sub-supervisor, Core)
- Owns: Core `packages/contracts/src/fluxnode/**`, `packages/sdk/**`, `framework/automation-service/service/fluxnode/**`, the prompt and tool-description modules it makes overridable (by injection, not by editing their wording), FluxNode docs under Core `docs/`.
- Must not touch: answer-first `rows/**`, `attempt/**`, `completion/**`, `flow-run/**`, `run-acts/**` (W1); `engine/automation/pacing/**` (W2); ui-components and apps/web (W4, W5).
- Phases: F1 fix `retries` (accepted but never passed on); F2 the overrides object and its resolution; F3 prompt, tool, judge and deadline overrides wired; F4 docs (reference for every option and override, guides, examples, errors and limits) checked by Core's docs check.

### W4. Brand and extension UI (sub-supervisor)
- Owns: Core `packages/ui-components/src/theme/**` and `src/chat/**` (the conversation list and I3, plus the chat step card's "already done" wording, D1); extension `apps/extension/src/panel/**` (except `panel/chat/transport/ports/**`, which it also owns for I3), extension icons and release icon script; the extension's background relays for I3.
- Must not touch: Core `apps/web/**` (W5); content scripts (W2, t893, t897).
- Phases: B1 tokens and fonts from the website into ui-components; B2 extension shell, top bar, logo and icons; B3 conversation list (I3) and New chat; B4 settings (humanness slider bound to I1, model and key status, permissions, connection); B5 every screen reviewed against the brand, in Chrome side panel and Firefox popup.

### W5. Core web panel as a hosted product (sub-supervisor, Core)
- Owns: Core `apps/web/**` and Core hosting/deployment files (Dockerfile, deploy config, CI deploy job).
- Must not touch: ui-components (W4: it adopts W4's tokens and I3 conversation list once they land); `packages/fluxiq/**` outside `platform/profile` and the conversations API routes it serves.
- Phases: P1 adopt the brand tokens (one token system, dark default, remove the bridge); P2 conversation list and New chat (I3); P3 Data and Security screens from existing IAM, audit and dataset code; P4 retire the legacy `/programs/*` UI; P5 hosting: container build, deploy config, service-profile sign-up, invite and user screens, and per-use-case panel configuration (branding plus feature presets); P6 end-to-end specs for each screen.

### W6. Handlers and add-ons (sub-supervisor; design first)
- The user's words (2026-11-10): "we will add ability to change how that works as well. Especially in fluxnodes. For instance they might want to add auto solving capability, or pass to a human via custom API... And same on the extension, we should add ability to add extensions. This will form the way for marketplace of extensions later... Possibly even by 3rd party devs".
- Lead's lines:
  - FluxIQ ships the handler system and two first-party handlers: pause for the person, and hand-off through the developer's own HTTP API with a callback.
  - FluxIQ does not build or bundle a robot-check solver. A developer may register their own handler, under the site's terms and their responsibility.
  - Extension add-ons cannot be remotely loaded code: Chrome's extension platform forbids it. Add-ons are either companion extensions that talk to FluxIQ through a published, permissioned messaging API (`externally_connectable`), or Core-side plugins.
- Owns: Core `runtime/parking/**` (permission and person-needed asks) and a new Core `runtime/handlers/**`; extension `background/add-ons/**` (new) and its manifest keys; a new design doc pair.
- Must not touch: W3's fluxnode overrides object (W3 wires `overrides.handlers` to I4 once I4 lands); W4's panel (an Add-ons settings page is W4's, built on W6's API).
- Phases:
  - A0 design document (Mode 1): the handler interface (I4), the add-on API (capabilities, permissions, versioning, signing, review), and the marketplace path. Reviewed by the lead before code.
  - A1 the Core handler chain with the default handler: no behaviour change, and the robot-check pause tests unchanged.
  - A2 the HTTP hand-off handler, with a deadline and callback.
  - A3 the extension add-on messaging API and one first-party sample add-on.
  - A4 docs for handler and add-on authors.

---

## Schedule (cut for parallel lanes)

- **Week 1 (11-10 to 11-16):** W1 lands t897, t898, t893 and the named columns, then starts breadth. W2 H1-H2. W3 F1-F2. W4 B1-B2. W5 P1 (after B1 tokens) and P3. W6 A0 design, then A1. Constraint: W5's P1 waits on W4's B1.
- **Week 2 (11-17 to 11-23):** W1 speed Phase B. W2 H3-H4. W3 F3, plus `overrides.handlers` once W6's A1 lands. W4 B3-B4. W5 P2 (after B3's component) and P4. W6 A2-A3. Constraint: the slider (B4) waits on H1's field.
- **Week 3 (11-24 to 11-30):** W1 breadth across all ten sites. W2 H5. W3 F4 docs. W4 B5 and the Add-ons settings page. W5 P5 hosting. W6 A4 docs. Full sweeps twice a day and promotion to main on each green sweep.
- **Week 4 (12-01 to 12-07):** release candidate: every workstream's acceptance re-run, live breadth on the release build, docs complete, a hosted deployment of the panel.

The machine has 12 GB. Lanes keep code and unit work in parallel, and take turns for whole-tree builds and Lab runs. Each lane checks free memory (at least 2.5 GB) before a heavy run, and never runs two at once itself.

---

## Work Ledger

### 2026-11-10 - Plan

- Agent: lead; five read-only surveys (Haiku Explore).
- Changed: this document.
- Validation: surveys only; no code changed.
- Outcome: W2-W5 dispatched as sub-supervisors; W1 continues.
