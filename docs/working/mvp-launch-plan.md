# MVP Launch

Status: Active
Status detail: Plan written 2026-11-10 for about one month to go-live; five workstreams, W1 already running, W2-W5 dispatched the same day.
Created: 2026-11-10
Last updated: 2026-11-11
Owner: Senior supervisor agent
Scope: Everything between today and a launchable MVP: data scraping and task execution (W1), a humanness setting from the extension slider down to Core and FluxNodes (W2), FluxNode developer overrides and docs (W3), the extension's brand and UI (W4), the Core web panel as a hosted product (W5), and pluggable person-needed handlers and extension add-ons (W6). It does not change a standing rule in either AGENTS.md.
Paired document: Core `docs/working/fluxnode-plan.md` (W3), Core `docs/working/hosted-production-plan.md` and this repository's `hosted-production-plan.md` (W5).
Related: [task speed](./task-speed-plan.md), [MVP seal](./mvp-seal-plan.md), [Answer First](./answer-first-plan.md)

---

## Current State

**Codex continuation (2026-11-11).** t908 pager humanness is integrated and pushed. t906 fixes delayed press readiness and restores meaningful site-reset assertions: lead independently passed 305 units and all four installed-extension browser cases; merged into dev. t901 hosted identity, own-name UI and fresh key-consent fixes passed focused checks and independent security review; both sides are merged into dev, with all 70 mandatory Core contract tests passing. No fixed delay, extra press or weaker data oracle was added. t902 stays off GitHub; t898 private notes and original user edits remain untouched. t905 has a local intake-report-only commit, with its WIP unaccepted/unpushed. Codex touched t901, t906 and t908 implementation lanes; no paid run or full sweep.

**Continuation resumed (2026-11-11).** The user explicitly asked to keep going beyond the three completed lanes. One Sol Max worker each owns t905 result evidence, t907 managed browser host and t909 action scope; intake precedes source edits and lead-owned dev sync. Remaining queue: t885 stopped runtime/evidence WIP, t893 replay-deviation proof, local-only t902 security/handler work, and the stopped TestEnvironments simulation branch. t904 is already fully in dev on both sides (zero unique commits), so its old WIP wording is not a reason to redo it. After these reconcile, re-evaluate the launch plan's remaining P3b/live/browser/deployment gates rather than treating a few merged lanes as completion. No worker may move git, spend on live providers, or modify another lane. t902 never pushes under the current instruction; the t898 private note and original root edits stay untouched.

**Dependency verification (2026-11-11, late).** Snapshot audit defects are fixed; lead transferred only its 13-file dependency from t905 to t909, independently passed all 10 tests there, and committed it locally as `9167d7141`. Migration 0037 is independent of result-evidence migration 0036. t909's Core typecheck passed, and lead independently passed six execution-owner/secret-pointer tests, including separate Node contenders; a keyed run's resume can still bypass ownership and is being reproduced/fixed before host handoff. t907's prerequisite Core libraries built; lease-handoff persistence and reaper acknowledgment fixes are in focused validation. t885's domain check and runner build passed, followed by 22 script tests after correcting an obsolete single-attempt assertion (local `924f855a5`). Its Saturday script/test and minimal covers export were shared with t905; browser proof remains pending. These are partial results, not acceptance of the remaining lanes.
**State (2026-11-10).** Plan written from five read-only surveys (brand, extension UI, Core panel, FluxNode surface, timing paths). W1 is running as the live lane t885, t897, the held t893 and the coming t898. W2-W5 are dispatched as sub-supervisor workstreams with the interfaces below fixed first.

**The user's words (2026-11-10):**
- "Realistically have 1 month from today" (no hard date), "We're almost to the finish line of MVP!"
- "Focus heavy on data scraping & task execution, UX/UI, and the core web panel."
- Humanness: "a slider that you can change on the extension, and should 100% be available in core as well". Higher humanness: "node times should be randomized, click positions randomized where possible, random missclicks added". Minimum: "just max efficiency... useful for something like web scraping with no account"; the human side is "meant to look more human-like on higher rate limit type websites".
- FluxNodes: "developer overrides that allow developer to fine tune exactly how certain behavior works... highly customize every part of fluxnodes if they want to, everything down to the prompts used. We'll need good docs for FluxNodes as well."
- Extension: "REALLY refine the UI... rebrand it so it matches the website stuff" (getfluxiq.com, FluxIQWebsite); "see all chats, easily navigate everything, set user settings that are important for extension".
- Panel: "users will be able to use the core fluxiq panel hosted in the cloud & customized for that specific usecase."

**Promoted (2026-11-11).** The day's first full sweep passed on Core b445ad6f4 and extension 42da23a9f, and both mains were fast-forwarded: 337 Core and 247 extension commits since 2026-11-03. The sweep failures before it were fixed by lane t904, all in tests: tests never moved with intended changes, a stub whose check never cleared, and load-dependent tests.

**Lanes (2026-11-11, evening).** Landed on dev today: t904, t885 (twice; the second carries fixes 32-36), t903, t897, t899 (W3), t900 (W4), t905 phase 0, and t898 (W2: humanness end to end, each person's starting value, and the run-request and reviewer security fixes). All are pushed.

New lanes on 2026-11-11:
- t906 fixes the site-reset specs that drifted.
- t907 builds the managed browser host (Core's P5).
- feat/fluxnode-sims in `!FluxIQTestEnvironments` puts FluxNodes on the simulated Android, Linux and Windows environments (P8).
- P2c (one engine for many runtimes) is designed in Core's `fluxnode-plan/reports/p2c-multi-runtime-design.md`.
- A next-page humanness follow-up is opening, because Next page presses do not yet aim.
- P3b keys starts after t901.
- W1, live checks (E1): Saturday causes R1-R7, including the ending (a caught loop is steered onto a new approach, never parked for a person); reruns of follow-official-store and priya; breadth tasks 5-10; the Lab recording each run's exact model, which it does not do today.
- W1, structural (t905, sub-supervisor): the design in `reports/result-evidence-design.md` makes the result exactly what the draft's read steps read. A read outside the draft is a look that never changes the result. The model is always told the result as it stands, and the judge gets every contributing page whole.
  - Lead decisions D1-D4: draft steps only, with `take` to promote a look; fold identical steps; exploring reads return only kept rows; one evidence shape for both judges.
  - Phases 0-1 run now. Phase 2's wiring waits for t885 to land call-chain.ts and the amendment handler. Phase 4 (exploration overhead in the Lab report) is E1's.
  - R3's Core half is dropped and R7 is confirmed by the user's result-or-budget rule. F5 (real hover) waits on the user, because it would need the debugger.
- W2 (t898): humanness end to end, per FluxNode, task and Flow (user, 2026-11-11: "humanness slider should be for each individual fluxnode/task/flow"). Open: the run-session security fix, the person's preferences, and a rerun at level 100, whose first replay needed a repair.
- W4 follow-ups: the Firefox popup manual check (user), and the limits.ts swap after t898.
- W5 (t901): dock project threads, members' model and send, case-insensitive usernames; the mirrored route test after t898.
- W6 (t902, local while security findings are open): checkpoint 10, a check inside a called Flow survives a restart. Core dev is merged (dfdfbf7ec). Checkpoint 11 covers the deferred store patch, the panel-transport test, one step per resumed Call, no withheld secret reaching a step, and checks inside handler bodies surviving a restart. The child seed becomes a declared field after t898.

**Live review (2026-11-09 to 11-11).** 22 launches, $11.79. Zero-call replays are proven on towels, auction, Post and apprentices (humanness 0 and 100). Of 8 failed or costly runs, the model had the answer in nearly all of them. The causes:
- how found rows become the result: 7 of 8;
- the judge seeing part of the evidence: 4 of 8;
- capture gaps, where the model saw a value no read could hold: 3 of 8.

A judge's wrong no starts the 50-120-call retry storms. Even the passing towels exploration took 38 browser steps against its Flow's 8.

**Next.** t898, t901, t906 and t908 are integrated. Resume remaining lanes from their own reports, especially t905 result evidence and t907 browser hosting; t902 remains local pending its security work. Run the next allowed full sweep on the combined dev commits before main promotion.

---

## Shared Interfaces (fixed before dispatch)

**I1. Humanness.** One integer `humanness` from 0 to 100, stored per FluxNode, task and Flow (user, 2026-11-11); the person's extension setting is only the starting value for new ones.
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

### 2026-11-11 - Verified dependency transfers and queued E1 baseline

- Agent: lead; result_evidence, act_scope and browser_host (Sol Max).
- Changed: snapshot-only dependency transferred t905 to t909 and committed locally; Saturday script/test transferred t885 to t905 with only the existing covers constant exported and additive registration. t885's stale one-attempt test corrected without changing its filter/oracle assertions. No t902 work or private note included.
- Validation: lead `pnpm --filter fluxiq exec vitest run src/framework/persistence/automation/project/dataset-snapshots/tests/store.test.ts src/framework/automation-service/service/datasets/tests/snapshots.test.ts --maxWorkers=1 --minWorkers=1` in t909 -> 2 files / 10 passed (37.73 s); lead `vitest run .../act-scope/tests/execution-owner.test.ts .../act-scope/tests/request-identity.test.ts --maxWorkers=1 --minWorkers=1` -> 2 files / 6 passed (3.04 s). Worker `pnpm --filter fluxiq check` -> exit 0 after three test-source type errors were fixed. Lead t885 `domain check`, Core library and test-runner builds -> exit 0; three named Saturday/apprentices script files -> initially 21/22, then 22/22 after the obsolete reply-count assertion was corrected.
- Outcome: no remaining lane accepted. Cross-engine ownership must also cover resumes; t907 pending lease-write/reaper checks; t905 ledger checks/browser proofs remain. Local dependency/baseline commits wait on their unaccepted lane WIP before pushing. Earlier documentation push failed solely on generated index line count; regenerated via `node scripts/structure-audit.mjs --rule working-docs --update` (baseline unchanged) and pushed successfully.

### 2026-11-11 - Snapshot dependency and concurrency review

- Agent: lead; result_evidence, act_scope and browser_host (Sol Max).
- Changed: t905 immutable occurrence snapshots prepared for t909; transfer waits on structural fixes. Lead review requested pointer-position secret comparison and verified execution ownership before admitting a keyed request. t907 prerequisite libraries built; lease-handoff cache regression added to acceptance.
- Validation: lead `pnpm --filter fluxiq exec vitest run src/framework/persistence/automation/project/tests/dataset-snapshot-store.test.ts src/framework/automation-service/service/datasets/tests/snapshots.test.ts --maxWorkers=1 --minWorkers=1` through the coordinator -> 2 files / 10 tests passed (31.41 s). `node scripts/structure-audit.mjs` in t905 -> exit 1, 17 violations across 5 rules; snapshot-specific failures are unsafe test casts, a cross-directory import, and statement packing in store/tests. Worker owns corrections, no baseline increase.
- Outcome: no lane accepted from partial tests. t885 prerequisite library rebuild started; t893's old reports still require fresh professional-network and replay-deviation proof. No paid run or full sweep.

### 2026-11-11 - Verified scoped acts; coordinate pipeline snapshots and host dependencies

- Agent: lead and the same three lane workers; implementation continues, not accepted as complete.
- Findings: t909 reproduced interleaved keyed restart and explore-resume repeats (3 renewals instead of 2), then repaired them with scope-owned write-through task records. Lead independently verified its five-test integration file. A pipeline continuation still reproduced 8 renewals instead of 5; stable child invocation identity and immutable source snapshots are being built. Lead also found that raw keyed-request hashing retains a secret-derived verifier; durable opaque scopes and secret-free request comparison are required, including restart conflicts.
- Interfaces: t905 owns a true immutable dataset snapshot service/store (0037, independent of batch-evidence0036); t909 owns reference-only task state and secret-rebinding adapters. Full data rows do not belong in hot task-memory JSON. t907 waits for the coherent create/run host seam, and never leases a host to a pipeline controller waiting on children.
- Validation: lead `pnpm --filter fluxiq exec vitest run src/framework/automation-service/service/fluxnode/tests/act-scope.test.ts --maxWorkers=1 --minWorkers=1` -> 5 passed (60.80s). Lead t885 script-wiring/replay baseline -> 9 passed; its domain check stopped before TypeScript at the stale Core library guard. t907 worker Core types and focused groups -> 52 passed; lead registry check -> 9 passed. Lead `pnpm install --offline --ignore-scripts` in t907 -> exit0, downloaded0, only the SDK link added to lockfile and verified to its paired Core.
- Next: finish the pipeline/security regressions and shared snapshot slice, validate the ledger storage/judge migration, wire and prove managed hosts, then continue the remaining stopped lanes. No paid/model network run, full sweep, main promotion or panel server.


### 2026-11-11 - Resume the remaining structural lanes

- Agent: lead; result_evidence, browser_host and act_scope (Sol Max), one worker per lane.
- Changed: lead synced t905/t907/t909 in both repositories. t905 conflicts preserve both result-feed batch collection and dev humanness precedence. t885 is prepared next; its script merge preserves variants plus four-attempt replies. All source changes remain on their lane branches, unaccepted until scoped checks pass.
- Findings: t905's old checkpoint omitted later WIP; result publication can point at the last page while the answer combines pages. t907 lacks CLI/pool/proofs and requires authenticated, lease-restricted machine authority plus headless routes, not relaxed person checks. t909's interleaved-key persistence and explore-resume gaps are inferred and under regression, not yet verified.
- Ownership: t909 holds shared attempt/run-attempt.ts until its minimal scoped-persistence seam is stable; t905 continues elsewhere. t909 also holds FluxNode create/run files before t907's host wiring. Machine IAM/cache and upload authorization need adversarial tests. P3b remains the owner of production key custody.
- Validation: t905 mocked ledger baseline -> 11 files, 80 tests passed (worker); t907 build registry -> 9 tests passed (worker). Lead checked merge resolutions and source path overlaps; no implementation acceptance or new full sweep claimed.
- Next: finish these units, then resume t885, held t893, local-only t902, simulation work and remaining P2c/P3b gates; do not stop at an intermediate lane report.


### 2026-11-11 - Final readiness and hosted continuation acceptance

- Agent: lead; click_readiness and hosted_panel (Sol Max); independent hosted_security_review (Sol Max).
- Changed: generic unanswered-press observation retains the original effect watch through finite deferred binding work; independent per-watch marks are released. Site-reset assertions inspect real actions, exact nonempty data and generated arrival navigation. Hosted fixes guard username recasing at mutation and recheck key consent before/after each reveal; members can edit their own name without broader identity reads.
- Validation: lead adjacent-unit command in `reports/codex-t906-readiness.md` -> 305 passed; direct serial Playwright command recorded there -> 4 passed (2.2m); office trial press/binding/retry 338/1261/1295 ms, succeeded. Extension source/test check, Chrome/Firefox/e2e builds and structure passed. Hosted lead vitest commands in `reports/codex-t901.md` -> 25 casing, 12 consent, 13 own-name UI/route and 77 API route tests passed; worker affected web tests -> 404 passed; required package typechecks, structure and generated-reference freshness passed.
- Outcome: both scoped implementations merged through their task tools; t906 worktree removed, t901 Core contract gate passed 70/70. No new full sweep, main promotion, production deployment, live model run or manual Firefox claim. t901's older production-browser evidence remains historical.


### 2026-11-11 - t908 integrated; t906 and t901 causes reproduced

- Agent: lead; pager_humanness (Sol Medium), reset_assertions (Sol High), click_readiness and hosted_panel (Sol Max), hosted_security_review (Sol Max).
- Changed: t908 pager humanness and architecture docs merged through `pnpm task finish t908`; its extension worktree removed. t906 merged the updated dev. No commits unique to t902 occur in any selected lane (Core or extension).
- Validation: lead `node apps/extension/scripts/test-extension.mjs content/action-runtime/humanness/tests content/extraction/page-advance/tests content/actions/tests/next-page.test` -> 133 passed after dev integration; direct Chromium `playwright test -c e2e/playwright.content.config.ts --workers=1 everything-store-next-page.spec.ts` -> 3 passed (1.6m); extension package check -> current matching successful cache stamp; finish structure audit -> passed. Worker also passed 140 initial tests, 91 final page-advance tests, and the browser spec. No installed-extension transport/Firefox/paid replay proof is claimed for t908.
- Outcome: t906's serial browser run reproduced two pre-hydration presses (359/1178 ms; listener 1274 ms); a Sol Max worker is fixing generic readiness. Lead independently ran t901 casing API/service tests -> 25 passed; its other acceptance remains pending the member UI and fresh key-consent fixes. No main promotion.

### 2026-11-11 - Codex continuation intake and preparation

- Agent: lead; discovery workers inventory_product, inventory_runtime, inventory_validation; implementation workers hosted_panel (Sol Max), reset_assertions (Sol High), pager_humanness (Sol Medium).
- Changed: continuation ownership; t906 and t901 extension branches merged with dev; shared detached Core updated through the task tooling's guarded move with only its four library packages, all restored from cache. No private notes or pre-existing user edits staged.
- Validation: `node scripts/structure-audit.mjs` -> passed (249 warnings, 552 baselined); `node scripts/check/core-build.mjs` in t906 -> Core build current with source. The first direct `pnpm` invocation was blocked by PowerShell's script policy; use `pnpm.cmd`. A stale root git index lock was removed only after confirming no git process was running; the ownership-doc commit was pushed to dev.
- Outcome: workers repairing evidenced pager metadata and test-observability defects; hosted-panel worker investigating a casing/write race. Acceptance and integration pending; no full sweep, live model call or main promotion.

### 2026-11-10 - Plan

- Agent: lead; five read-only surveys (Haiku Explore).
- Changed: this document.
- Validation: surveys only; no code changed.
- Outcome: W2-W5 dispatched as sub-supervisors; W1 continues.

### 2026-11-11 - Main promoted on a green sweep

- Agent: lead; lane t904 (sweep triage, Opus).
- Changed: tests and scripts only (t904); both mains fast-forwarded.
- Validation: promotion sweep on Core b445ad6f4 / extension 42da23a9f -> core build 0, core check 0, core test 0, ext build 0, ext check 0, ext test 0.
- Outcome: main promoted in both repositories (Core 1ae3240d3 -> b445ad6f4, extension 186c028b4 -> 42da23a9f). Known and routed: four content-harness specs that also fail on the dev base (photo-social load-more, professional-network Rotterdam) and two chat-UI assertions, to t904.

### 2026-11-11 - Live-test review and the t902 Core merge

- Agent: lead; W6 checkpoint 10 (worker-heavy); result-evidence design (worker-heavy, running).
- Changed: t902 Core branch, local only: the checkpoint 10 commit and the dev merge dfdfbf7ec. Conflicts: contracts `automation.ts`, where both barrels were kept, and `service.ts`, where W6's run-endings structure was kept and dev's judge-model choice was carried into `run-ending/run-endings.ts`. Also this document.
- Validation: `heavy-slot.mjs run lead-t902-merge` -> contracts check 0, fluxiq check 0, the tests beside both changes 47 files / 476 passed plus 2 / 12, structure audit passed (537 warnings, 969 baselined), Core libraries 0.
- Outcome: the review of 22 live launches since 11-09 ($11.79) traced the failures to FluxIQ's result and evidence plumbing, not model reasoning, and a structural design was dispatched. The Lab records no model per run, which breaks the testing-facility rule; that went to E1. A hung t897 finish process was stopped, and the t897 branch was deleted locally and on origin after the ancestor check.
