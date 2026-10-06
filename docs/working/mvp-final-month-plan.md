# MVP Final Month Plan

Status: Active
Status detail: Integration done except t267 (adaptation unblock) and t273 (B7, D enforcement, P5 wiring), both running; live A-D tests follow, then Phase 1b.
Created: 2026-10-05
Last updated: 2026-10-05
Owner: Senior supervisor agent
Scope: The ordered plan from 2026-10-05 to the polished-MVP deadline of 2026-11-10: what is done, what is held on unmerged branches or dirty trees, what must be integrated and pushed, and the week-by-week work to pass the 30-day plan's Final MVP Acceptance Test. It does not redo intake already recorded in the 2026-10-03 handoff, and it does not itself run live provider calls.
Paired document: none (planning only; Core state is read, not changed)
Related: [30-day MVP plan](../../FluxIQ%20Web%20Extension%20%E2%80%94%2030-Day%20MVP%20Implementation%20Plan.md), [Claude handoff 2026-10-03](./claude-work-handoff-2026-10-03.md), [live loop](./language-driven-flow-loop-plan.md), [working index](./README.md)

---

## Current State

Deadline 2026-11-10. Feature freeze 2026-10-29. Updated 2026-10-05 evening.

**On dev and pushed (both repositories), 2026-10-05.** Codex's t262 (call admission, provider-free replay, A8 accepted); t263 lane-only ports; t264 the whole round-1003 Core chain (instruction authority, refusal cards and wording, judge and ending, authoring, docs); t265 extension UI; t266 test fallout; t268 extraction preview and the Flow/adaptation deep link; t269 C4 saved-row repair; t270 P5 `$step` (built, not yet reachable by the model); t271 D route states (read, not enforced); t272 C1 paginate-true reads every page. Last verification of the combined Core: 712 automation-studio/ui files, 6904 passed, 0 failed; downstream domain, extension and test-runner checks 0; both audits pass. Sweep 1 of the day ran before most of this; sweep 2 is owed on the current dev.

**In flight.** t267 (lead): adaptation unblock; S1 Lab no forced manual approval, S2 judged run as target-override evidence, S3 Run asks for a repairing run and "Learned N" counts kept changes, C1 token route allows it, S5 Lab records are committed on its branch; C2 (routine runs stop billing a result check) and S4 (a re-authored Flow is applied only after its re-run is judged) are running; t267 lands on dev as a whole after S4, because its Run change must not ship before C2. t273 (lead): S1 B7 binding affordances running; then S2 D route enforcement and S3 P5 wiring.

**Preserved, not landed.** `wip/t262-uncommitted` (Codex's B7/C4/P5 drafts, pushed); `wip/t174..t195-uncommitted` (Claude's lane trees, local) — every fix in them is ported or deliberately dropped. Lane evidence (seven debugs, all lane and worker reports) is on dev. `task/t224-codex-ui-ux-review` stays paused. Worktrees: dev, t224, t262 (A/B lane tree holding A8's saved Flow and profiles), t267, t273.

**Product state.** Live-proven: A8 hub-to-cart built from the extension chat, ran (4/4 facts) and replayed twice with zero model calls (t262). Not yet live-proven on the current source: B, C, D creation; the adaptation chain; anything UI-new. Nothing has run live since t262.

**Order from here (user, 2026-10-05).** 1) t267 and t273 land; sweep 2. 2) Live A-D on the integrated source, each until it passes, with a full debug of every run. 3) Only after all four pass: Phase 1b (new realistic-site tests; recording as evidence beside mandatory instructions). 4) Phase 2 adaptation chain live (bigbox redesigned buy box first), Phase 3 breadth, Phase 4 UX (onboarding, Stop and take-over controls, learned message), freeze 10-29, Phase 5 hardening, Phase 6 release candidate.

**Decisions taken by default (the user may override).** One supervisor (Claude); Codex stopped. Item 10 is met by Stop plus a step-boundary take over / hand back built on Core's existing run control. Item 24 is read as the extension chat and Automations row. The Week 2 exit gate is retired into Phase 2's chained proof. Recording is evidence, never a script (user, 2026-10-05).

**Key findings behind the plan.** [t262 audit](./mvp-final-month-plan/reports/t262-audit.md), [lane reconcile](./mvp-final-month-plan/reports/lane-tree-reconcile.md), [gap map](./mvp-final-month-plan/reports/mvp-gap-map.md), [adaptation-loop audit](./mvp-final-month-plan/reports/adaptation-loop-audit.md), [UX design](./mvp-final-month-plan/reports/ux-mvp-design.md).

## Schedule to 2026-11-10

Live rules that bind every phase: headed browser, prompts typed into the real extension chat, only the ten realistic scenarios, up to four lanes on `lab-slots/slot-1..4`, DeepSeek flash with the $0.10 per-Flow ceiling, a debug of every run before the next, and a supervisor watching every paid run. Merges are gated by narrow checks; full suites run at most twice a day on `dev`.

### Phase 0 — Consolidate (Mon 10-05 to Wed 10-07)

1. Land t262. Move the uncommitted B7/C4/P5 work onto follow-up branches first; never commit it as is. `pnpm task finish` downstream (take t262's side of the handoff doc, regenerate the index), then merge Core `task/t262` in Core under Core's gates. Narrow checks: both structure audits; typechecks of `fluxiq`, `@fluxiq/web`, domain, extension, test-runner; the owning tests t262's gate named (Core 15 owners, web 2, domain 3, Lab 4). Push both `dev` branches together. Queue one background full sweep.
2. Lane-only units, parallel by file, one task branch each, rebased on the new `dev`: A1 cost limit, A7 opened-tab cleanup and remembered waits, A8 consent closer, D1 row-scoped assert, C w86 maxPages lift and w75 missing key, D C3 pass row in step log, B F11 draft signature.
3. Serial chains, one owner each, in this order: instruction authority (A4, B F1, t262 split acts); activity/refusal wording (B F6 move, then A5, then C w80/w81/w84/w76); judge and ending (A3a with B F2, B F3, D C2, one ending-wording owner); Core authoring (B F5/F10, D C1, D w45 on `unrepeat`, D w47, C w79 with D w46, C w78); extension UI (A9, B F7/F9, C w83, D D2); Lab records (A10, C w82). Drop C w72, D w49/w50 and A3b as written; they are redone under t262's designs.
4. Clean up: remove the 46 merged worktrees through `pnpm task finish` / `abandon` (never `git worktree remove --force`), then `pnpm task prune --dry-run`, then prune. Retire the four lane trees once their units have landed.

Exit: one `dev` in each repository holding all of t262 and every kept lane unit, narrow checks green, pushed, one sweep green or its findings fixed forward.

### Phase 1 — Creation works on A-D (Wed 10-07 to Fri 10-16)

1. B7 bindable fix (import through the barrel, `bindable/tests/paths.test.ts` fail-first, then the fix), then one B retry with its own Stage 1.
2. C1 pagination meaning and C4 saved-row repair with graph reconstruction, serial in Core `flow-draft`/`llm`, then C live: 13 ordered records, 52 fields, all pages.
3. D phase 1: shared lazy instruction read, named/open/unavailable route states, permissions independent of route validity; then D live with per-row action and four-record oracles.
4. P5 `$step` earlier-output binding, if a lane's scenario needs it; otherwise after Phase 2.
5. Four lanes run in parallel, A-D on slots 1-4. A re-proves on the integrated tree.

Exit: each of A, B, C, D passes live twice consecutively from the extension chat with exact oracles, then replays with zero provider calls.

### Phase 1b — New realistic-site tests and recording as evidence (user, 2026-10-05; only after Phase 1's exit)

Gate: every planned live test (A, B, C, D) has passed. Nothing in this phase starts before that.

1. New live tests only on the ten realistic scenario sites, mainly language-only instructions, chosen to cover what A-D do not (other sites, other task shapes).
2. Build out recording as evidence: the person records an action on the site and must also write the instruction; the build reads the recording as one piece of evidence beside the instruction and the live page, and may diverge from it. A recording without an instruction is refused or asked about. The Flow must never copy a recorded mistake blindly.
3. Recording-plus-instruction tests on the realistic sites, including recordings with deliberate slips (a wrong click undone, a detour) that the built Flow must not reproduce, judged by the same exact oracles.

### Phase 2 — The adaptation loop, live (Mon 10-12 to Fri 10-23) — the MVP thesis

1. Re-audit current Core for the 2026-09-21 Recover and Resume blockers (`service.ts`, `live-patch.ts`, recovery exploration policy in `harness-options/registry.ts`). Fix what still blocks.
2. Chained proof on the scenario's own "redesigned after creation" tasks: build a Flow (A-D class), run it against the redesigned variant, then detect, diagnose, explore, repair, validate (whole-Flow judged run), persist, continue, and re-run with zero provider calls. Candidates: `bigbox-retail-pickup-cart-redesigned-after-creation`, `crossborder-marketplace-repair-basket-redesign`, `job-board-save-halvard-week-redesigned-after-creation`, `social-network-feed-group-post-regrouped-after-creation`, `company-website-quote-request-redesigned-after-creation`.
3. A "learned something" message in the extension chat and Automations row after a persisted repair (item 24); the repaired node and its adaptation record visible from Open in FluxIQ (items 25-26).

Exit: the full Week 3 chain (create, run, encounter change, watch adaptation, re-run learned) passes live on at least three sites, twice each.

### Phase 3 — Corpus breadth (Mon 10-19 to Wed 10-28)

Cover all ten realistic sites (67 live tasks): at least one creation task and one repair task per site passing, using the same debug-and-fix loop, including remembered state, row loops, iframes, tabs, robot checks and permission stops. Define the release qualification set (FluxBench 4.7) from these tasks and record pass rate and cost per success.

### Phase 4 — Simple UX (Mon 10-19 to Wed 10-28, parallel to Phase 3 on extension UI files)

Onboarding (concept message and the Describe / Extract start after connect; under five minutes to a first success); run progress (live-activity P4 checklist, lane UI defects U-A..F, D6, D9); Stop proven live and the take-over / hand-back control; scraping UX (resume t224's held units: extraction caret, preview table, preview feedback); Open in FluxIQ on the right Flow; Firefox popup parity at about 600 px. UI is reviewed in every live run.

### Freeze — Thu 10-29. After this, only MVP-blocking fixes.

### Phase 5 — Harden and package (Thu 10-29 to Wed 11-04)

Reliability matrix live (browser restart, extension reload, tab closed mid-run, Core restart, network drop, Stop, takeover, LLM timeout shown to the user); sensitive-data review against the 4.4 list and a redacted Report Problem; cost metrics per 100 successful executions; profile the slow reuse (85 s vs 2.3 s); demonstrate-path smoke; Chrome/Edge and Firefox packages installed on a clean profile outside the dev environment; CI settings; store screenshots and listing.

### Phase 6 — Release candidate (Thu 11-05 to Tue 11-10)

Run the 4.10 thirteen-step script and the 26-item acceptance test on a clean profile, ideally by someone unfamiliar with FluxIQ. Fix blockers only. With the user's approval, merge `dev` into `main` in both repositories, tag, and submit the store packages.

### Risks

- Two supervisors (Codex and Claude) editing the same Core owners would recreate the lane-tree problem; one supervisor from Phase 0.
- Phases 1 and 2 overlap on Core `flow-draft`, `llm` and `service.ts`; those edits stay serial even when lanes run in parallel.
- Live runs cost real money: each run is supervised and debugged before the next, with no unattended relaunch loops.
- If Phase 2 is not green by 10-23, Phase 3 shrinks to the qualification set and Phase 4 keeps priority over breadth.

## Worker Briefs

### Brief: lane-tree-reconcile
- Repository: this repository and Core, read-only, in `C:/Users/osrs_/FluxStuff/fxwork/t174`, `t193`, `t194`, `t195` (both `!FluxIQWebExtension` and `!FluxIQ` in each).
- Task: For each of the four dirty lane trees, inventory the uncommitted changes (`git status`, `git diff --stat`, untracked files) on both repositories. Group them into coherent fixes using the lane's newest lead report and debug files under `docs/working/language-driven-flow-loop-plan/reports/` or `reports/` in that tree. For each fix say: what defect it addresses, which files, whether it has tests, and whether `dev` or Codex's `task/t262-mvp-live-continuation` (both repos; worktree `fxwork/t262`) already contains an equivalent or conflicting change (compare file paths and diff content with `git diff dev...task/t262-mvp-live-continuation`). Identify files touched by more than one lane tree and by t262: those are the serial integration conflicts.
- Required reads: `docs/working/mvp-final-month-plan.md` Current State; `docs/working/claude-work-handoff-2026-10-03.md` sections "Evidence and interpretation" and "Ordered implementation plan" step 1-2.
- Owns (may edit): `docs/working/mvp-final-month-plan/reports/lane-tree-reconcile.md`
- Must not touch: every file in every worktree; no `git add`, stash, checkout, reset, clean, build, test, or Lab command. No provider calls.
- Definition of done: report with one table per lane (fix, files, tests, overlap with dev/t262, recommendation: integrate / superseded by t262 / drop / needs rework), a cross-lane conflict list, and an overall recommended integration order. Quote no page data, tokens or secrets.
- Report to: `docs/working/mvp-final-month-plan/reports/lane-tree-reconcile.md`

### Brief: t262-audit
- Repository: this repository and Core, read-only, worktree `C:/Users/osrs_/FluxStuff/fxwork/t262/` (both repos), branch `task/t262-mvp-live-continuation`.
- Task: Audit Codex's t262 for integration. (1) List every commit on both sides not on `dev` with a one-line purpose, separating source/test commits from doc-only. (2) Run `git merge-tree --write-tree dev task/t262-mvp-live-continuation` in each repository and report conflicts. (3) Describe the uncommitted work in both trees: which brief it belongs to (see the continuation doc's Worker Briefs), how complete it looks, and whether it is safe to commit as is. (4) From the continuation doc's ledger, quote the last validation lines and identify which source commits came after the last recorded gate. (5) List the product fixes t262 delivered in plain words, and the open defects it names (B binding affordances, C4 row repair, D waypoints, P5 `$step`).
- Required reads: `fxwork/t262/!FluxIQWebExtension/docs/working/mvp-live-continuation-2026-10-03.md` (Current State, Worker Briefs, Work Ledger); its `reports/` as needed.
- Owns (may edit): `docs/working/mvp-final-month-plan/reports/t262-audit.md` (in the main checkout, not t262)
- Must not touch: every file in `fxwork/t262`; no build, test, install or Lab command there; no git command that writes (merge-tree with --write-tree only writes objects, which is allowed).
- Definition of done: report with the commit table, merge-tree result per repo, WIP assessment, last-gate gap, delivered-fix list and open-defect list, and a recommendation on how to land t262 on `dev`.
- Report to: `docs/working/mvp-final-month-plan/reports/t262-audit.md`

### Brief: mvp-gap-map
- Repository: this repository, read-only (Core docs may be read at `C:/Users/osrs_/FluxStuff/!FluxIQ/docs/working/`).
- Task: Map each of the 26 items of the Final MVP Acceptance Test (30-day plan lines 1390-1440) plus the Week 3 exit criterion (line 1024) and Week 4 phases 4.2-4.10 to current evidence. For each item: status `proven live` / `implemented, not proven live` / `partial` / `missing`, the evidence (doc path and run id or commit), and the work still needed. Use the 2026-10-03 handoff reports (`docs/working/claude-work-handoff-2026-10-03/reports/*.md`), the Current State sections of `week2-exit-plan.md`, `first-class-data-extraction-plan.md`, `live-activity-chat-plan.md`, `fluxiq-conversations-plan.md`, `codex-ui-ux-review-2026-09-30.md`, `manual-panel-test-findings.md`, and t262's continuation doc Current State. Note especially: demonstrate/record path, scraping UX, pause/stop, human takeover, Simple Mode vs Advanced Editor, onboarding, packaging, Firefox parity.
- Required reads: `docs/working/mvp-final-month-plan.md` Current State; the files named above (Current State sections, not ledgers, unless a claim needs checking).
- Owns (may edit): `docs/working/mvp-final-month-plan/reports/mvp-gap-map.md`
- Must not touch: all other files; no builds, tests, Lab or provider calls.
- Definition of done: one table covering all 26 items plus Week 3/4 rows, a short list of the five largest gaps by user-visible impact, and any item where documents contradict each other.
- Report to: `docs/working/mvp-final-month-plan/reports/mvp-gap-map.md`

### Brief: t262-gate
- Repository: both, in `C:/Users/osrs_/FluxStuff/fxwork/t262/` (`!FluxIQ` and `!FluxIQWebExtension`), branch `task/t262-mvp-live-continuation` (downstream at merge `6fe7f942`, which brought only docs from dev).
- Task: Run the narrow integration gate for t262 and record raw output. Core first: `pnpm build` at the Core root (rebuilds contracts, fluxiq, client-gateway-websocket, web outputs); `node scripts/build-cache/cli.mjs structure-audit:check`; `node scripts/build-cache/cli.mjs --parallel fluxiq:check web:check`; then vitest for exactly the test files changed versus Core dev (`git diff --name-only dev...HEAD | grep -E '/tests/.*\.test\.ts$'`), run per package (`packages/fluxiq`, `apps/web`). Downstream next: `pnpm --filter @fluxiq-web-extension/domain build`; `domain check`; `extension check`; test-runner typecheck; `node scripts/structure-audit.mjs`; then the test files changed versus dev in domain, extension and test-runner, using labelled test builds (`DOMAIN_TEST_BUILD_LABEL=t262`, `EXTENSION_TEST_BUILD_LABEL=t262`; see `docs/architecture/repository-layout.md` "Test Build Labels" for running a subset), and `pnpm --filter @fluxiq-web-extension/extension build`. Low concurrency. No Lab, browser or provider call.
- Required reads: this document's Current State; `docs/architecture/repository-layout.md` sections on commands and test build labels.
- Owns (may edit): log files under `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/0308f367-bc34-4266-8bc3-8790a8827c7a/scratchpad/t262-gate/` (one per command, named `NN-<command>.log`), and `docs/working/mvp-final-month-plan/reports/t262-gate.md`.
- Must not touch: every source, test, doc and config file in both t262 trees; no git writes. If a check fails, diagnose the cause from source and record it; do not fix.
- Definition of done: each command's exit code and summary line (pass/fail counts) in the report, with the log path; failures diagnosed (pre-existing on dev vs introduced by t262).
- Report to: `docs/working/mvp-final-month-plan/reports/t262-gate.md`

### Shared rules for the Phase 0 lane-port briefs below

Source of every port: Claude's uncommitted lane trees, read-only: `C:/Users/osrs_/FluxStuff/fxwork/t174` (A), `t193` (B), `t194` (C), `t195` (D), each with `!FluxIQWebExtension` and `!FluxIQ`; their base is downstream `45bd6232` / Core `6beae684`. Get a lane's change to a file with `git -C <lane tree> diff -- <path>` (plus untracked new files). The unit IDs (A1, F11, w86, ...) are defined in `docs/working/mvp-final-month-plan/reports/lane-tree-reconcile.md`; read your units' rows there. Apply each change onto your task tree (current `dev`, which includes Codex's t262), resolving conflicts toward t262's design where the report says so. Never copy a lane file wholesale over a file t262 changed. LF line endings. Never touch the lane trees or `fxwork/t262`. Validate with the owning tests (`R` = `packages/fluxiq/src/programs/automation-studio/runtime` in Core): Core `npx vitest run <files>` in `packages/fluxiq`; domain/extension test files through the bundling runner at `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/0308f367-bc34-4266-8bc3-8790a8827c7a/scratchpad/t262-gate/run-subset.mjs` (usage in its header; use your own label) then `node --test`; plus the touched packages' typecheck (`pnpm.cmd --filter <pkg> check`, Core `node scripts/build-cache/cli.mjs fluxiq:check`; rebuild Core with `pnpm.cmd build` in the Core tree before downstream checks when Core changed). No Lab, browser or provider call. No commits.

### Brief: t263-core
- Repository: Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t263/!FluxIQ` (branch `task/t263-lane-only-ports`).
- Task: Port A1 (Flow cost limit bound, t174), B F11 (draft signature includes acts and `ranWith`, t193), D C3 (pass and row in step log, t195). Keep F11 compatible with a later draft key that hashes the Flow signature.
- Owns (may edit): `R/../api/handlers/llm-execution-settings.ts` + its test; `R/llm/evidence-loop/amendment-memory.ts`; `R/llm/tests/stalled-amendments-replay.test.ts` (or wherever F11's test lives); `R/llm/node-tools/replay-span.ts`; `R/llm/step-log/scope.ts`, `R/llm/step-log/tool-step.ts` and their tests.
- Must not touch: every other Core file; the downstream tree.
- Definition of done: each unit's failing-first test (where the lane had one) passes; changed Core test files pass; `fluxiq:check` exit 0.
- Report to: `docs/working/mvp-final-month-plan/reports/t263-core.md`

### Brief: t263-domain
- Repository: `C:/Users/osrs_/FluxStuff/fxwork/t263/!FluxIQWebExtension`.
- Task: Port A8 consent closer (t174), C w86 `maxPages` beside `paginate` lifted (t194; small rework on `resolve-plan-node.ts`, which t262 changed), C w75 one missing key (t194; `domain/.../tool-rejection.ts` part only, not the Lab recorder), B F8 own layers are not interruptions (t193; merge onto t262's toggle hunk in `node-run/run.ts`).
- Owns (may edit): under `domain/src/runtime/llm-evidence/`: `node-run/covered-target.ts`, `plan-resolution/extraction/slot.ts`, `plan-resolution/resolve-plan-node.ts`, `tool-rejection.ts`, `node-run/own-layers/*` (new), `press-effect/answered-layer.ts`, `node-run/run.ts`, `node-run/context.ts`, `node-run/index.ts`, `tools.ts`, and those files' tests.
- Must not touch: `node-run/replay.ts`, `domain/src/client/*`, every extension file, every Core file.
- Definition of done: changed domain tests pass; `domain check` exit 0; `domain build` exit 0.
- Report to: `docs/working/mvp-final-month-plan/reports/t263-domain.md`

### Brief: t263-tabs-assert
- Repository: `C:/Users/osrs_/FluxStuff/fxwork/t263/!FluxIQWebExtension`.
- Task: Port A7 replay tab cleanup and remembered waits (t174: only tabs FluxIQ opened are closed) and D1 row-scoped check (t195: a per-row assert checks the current row, not the template card).
- Owns (may edit): `domain/src/client/close-opened-tabs-parameter.ts` (new), `domain/src/client/index.ts`, `domain/src/runtime/llm-evidence/node-run/replay.ts` + test; `apps/extension/src/runtime/{fluxiq-opened-tabs (new),action-runner,browser-tab,click-landing,command-options}.ts` + tests (paths as in t174); `apps/extension/src/content/actions/assert.ts` + test; `apps/extension/src/content/action-runtime/tests/resolve-target.test.ts`; `docs/architecture/web-capabilities.md`.
- Must not touch: every file `t263-domain` owns; every Core file.
- Definition of done: changed domain and extension tests pass; `domain check` and `extension check` exit 0; `extension build` exit 0. Record that A7 still needs browser proof in a live run.
- Report to: `docs/working/mvp-final-month-plan/reports/t263-tabs-assert.md`

### Brief: t264-core-chain (lead)
- Repository: `C:/Users/osrs_/FluxStuff/fxwork/t264/` (both trees, branch `task/t264-core-integration-chain`). Owner of Core `R/flow-draft/**`, `R/llm/**` (except files t263-core owns), `R/activity/**`, `R/flow-bootstrap/**`, `R/result-verification/**`, `R/service/instruction-authority.ts`, `R/action-permissions/**`, `R/conversations/**`, `R/service.ts`, Core `src/ui/activity-action/**`, `R/recovery/refuted-result/**`, plus the downstream `packages/test-runner` and `packages/test-contracts` files of A10/C w82, for the duration of this task.
- Task: Integrate the serial Core units of the lane trees in this order, one stage per hand-back (stop and return after each stage so the supervisor commits it): S1 instruction authority (A4, B F1's kind fallback, onto t262's source-grounded split acts). S2 activity and refusal wording (B F6 move first, then A5 re-applied into the moved files, then C w80/w81/w84 and C w76's Core part). S3 judge and ending (A3a with B F2 merged by hand, B F3, D C2 onto t262's reserve judging, then one ending-wording owner for B F4/F10, D w48, D C4, A's finishing verdict, A6 chat wording). S4 Core authoring (B F5/F10, D C1, D w45 on t262's `unrepeat` (drop `always`), D w47 routing words, C w79 with D w46 inside the `evidence-loop.ts` 800-line budget, C w78). S5 Lab records (A10, C w82 rework). A3b optional-only and choice-order: rework onto dev's choice-order inside S3 or S4, wherever its files fall. Drop C w72, D w49/w50 and the A3b claim-doubt edits; superseded by t262.
- Required reads: the shared rules above; the reconcile report's lane tables, cross-lane conflict list and recommended order; `fxwork/t262/!FluxIQWebExtension/docs/working/mvp-live-continuation-2026-10-03/reports/resume-ab.md` and `resume-cd.md`.
- Must not touch: files owned by t263-* and t265-* briefs; the extension `apps/extension/**` tree except C w76/w80 card words if S2 needs them (coordinate in the report instead).
- Definition of done per stage: every ported unit has its owning tests passing in the stage's tree, `fluxiq:check` exit 0, Core structure audit exit 0, downstream typechecks that import changed Core contracts exit 0, Core rebuilt. Per stage, the report lists units ported, dropped, reworked, and exact commands with results.
- Report to: `docs/working/mvp-final-month-plan/reports/t264-core-chain.md`

### Brief: t265-extension-ui (lead)
- Repository: `C:/Users/osrs_/FluxStuff/fxwork/t265/!FluxIQWebExtension` (branch `task/t265-extension-ui-integration`).
- Task: Integrate the extension UI units as one owner: A9 (stale "— done", overlay hold, composer kept text, chat stopped following; includes t174's deletion of `status-dwell.ts`, kept only if B's overlay-lag fix agrees), B F7 (composer and overlay: overlay over media, model prose in overlay, overlay lag), B F9 ("Starting…" from send; display kind), C w83 (composer, overlay flicker), C w76's pacer part (repair status), D D2 ("Build failed" ending headline). Pick one clear-on-send implementation across A9/F7/w83 and say why.
- Owns (may edit): `apps/extension/src/background/activity/**`, `apps/extension/src/background/panel/**`, `apps/extension/src/background/connection.ts`, `apps/extension/src/content/activity-overlay/**`, `apps/extension/src/panel/chat/**` (except `stream/step/card-words.ts` and `stream/step/action-card.ts` if t264 S2 needs them — note it in the report), `apps/extension/src/shared/activity/**`, `docs/architecture/extension-client.md`.
- Must not touch: every Core file; every domain file; files t263-tabs-assert owns.
- Definition of done: changed extension tests pass; `extension check` and `extension build` exit 0; the report lists each UI defect with the source change and what a live run must look at to confirm it.
- Report to: `docs/working/mvp-final-month-plan/reports/t265-extension-ui.md`

### Brief: sweep-2026-10-05
- Repository: both main checkouts (`C:/Users/osrs_/FluxStuff/!FluxIQWebExtension` and `C:/Users/osrs_/FluxStuff/!FluxIQ`), on `dev` with t262 merged.
- Task: The day's first full sweep. Core: `pnpm.cmd check`, then `pnpm.cmd test`. Downstream: `pnpm.cmd check`, `pnpm.cmd test`, `pnpm.cmd build`. Low concurrency (`npm_config_workspace_concurrency=1`). Each command's full output to its own log under the scratchpad `sweep-2026-10-05/` directory.
- Owns (may edit): those logs; `docs/working/mvp-final-month-plan/reports/sweep-2026-10-05.md`.
- Must not touch: every source, test, doc or config file; no git writes; no Lab, browser or provider call.
- Definition of done: exit code and pass/fail counts per command; every failure named with file and test, and classified from source as introduced by t262, pre-existing, or environmental (with the evidence).
- Report to: `docs/working/mvp-final-month-plan/reports/sweep-2026-10-05.md`

### Brief: t266-suite-fallout
- Repository: Core worktree of task t266 (path given at dispatch), branch `task/t266-t262-suite-fallout`.
- Task: The 2026-10-05 sweep found 18 Core tests failing deterministically after t262 landed, in tests t262 did not touch (Codex's gate ran only changed test files). For each, decide from source and t262's commits whether the test asserts superseded behaviour (update the test to t262's intended contract: one purse for every model question, `totalProviderCallCount` on failures, transient-only reauthor retry, calls-bound reserve) or t262 broke real behaviour (fix the source). Also classify `instruction-readiness` (15 s timeout twice) by running it alone. Failing files, under `packages/fluxiq/src/programs/automation-studio/runtime/`: `service/runtime-adaptation/tests/refuted-result-port.test.ts` (6), `tests/service-bootstrap/tests/accounting.test.ts` (6), `tests/service-bootstrap/tests/generation.test.ts` (1), `tests/service-bootstrap/tests/judged-build.test.ts` (2), `llm/evidence-loop/tests/repeat-guard.test.ts` (1), `tests/recovery-default-limits.test.ts` (1), `tests/service-flows/tests/instruction-readiness.test.ts` (timeout). Details: `docs/working/mvp-final-month-plan/reports/sweep-2026-10-05.md`.
- Required reads: this document's Current State; the sweep report; `git log -p` of the t262 Core commits touching each subject.
- Owns (may edit): the seven test files above; a source file only when the cause is a real regression and the file is not owned by `t264-core-chain` (if it is, stop and describe the fix in the report instead).
- Must not touch: every other file; the t264 and t265 trees.
- Definition of done: all seven files pass when run together (`npx vitest run <files>` in `packages/fluxiq`), and twice in a row; `fluxiq:check` exit 0; the report states per test which contract it now asserts and why.
- Report to: `docs/working/mvp-final-month-plan/reports/t266-suite-fallout.md`

### Brief: adaptation-loop-audit
- Repository: both, read-only: Core `C:/Users/osrs_/FluxStuff/!FluxIQ` at dev `3c47ed7d`, this repository at dev (both include t262 and t263).
- Task: Establish, from current source, what happens end to end when a saved instruction-built Flow (for example A8's hub-to-cart, 10 nodes) runs against a page that changed after creation, and what blocks the MVP adaptation chain: detect that execution cannot continue, diagnose, explore (can recovery exploration press, type and navigate under the default policy? see the 2026-09-21 claim about `harness-options/registry.ts`), recognise successful recovery, convert it into a reusable adaptation or repaired node, validate (whole-Flow judged run), persist automatically (or only after approval? where is the approval surfaced?), continue the current run or restart, and replay with zero provider calls. Re-check the 2026-09-21 blockers cited in `docs/working/week2-exit-plan/reports/w2x-created-flow-repair-lane.md` and the gap map (`service.ts` Recover/Resume, `live-patch.ts`). Then map the Lab's "redesigned/regrouped/list-layout after creation" tasks (`apps/scenario-lab/src/scenarios/*/live-tasks.ts`, `realistic-site-live-tasks.ts`, `live-repair-tasks.ts`) to what each actually exercises: how the variant is switched, whether the run is a saved-Flow playback, and what the oracle checks. Name the cheapest two or three tasks that would prove the chain live, and the exact Lab command shape for each (dry-run only; do not launch).
- Required reads: this document's Current State; the gap map rows 12-26; the two Week 2 sources above.
- Owns (may edit): `docs/working/mvp-final-month-plan/reports/adaptation-loop-audit.md`
- Must not touch: every other file; no builds, tests, Lab runs (dry-run listing only), browser or provider calls.
- Definition of done: a step-by-step table (step, what current source does, file:line, works / blocked / unknown), a ranked blocker list with the smallest fix for each and the files it would touch, and the recommended live proof tasks with command shapes.
- Report to: `docs/working/mvp-final-month-plan/reports/adaptation-loop-audit.md`

### Brief: ux-mvp-design
- Repository: both, read-only: this repository at dev and Core `C:/Users/osrs_/FluxStuff/!FluxIQ` at dev; t224's held UI work is on `task/t224-codex-ui-ux-review` (read with `git show`/`git diff dev...task/t224-codex-ui-ux-review`, both repos) and `docs/working/codex-ui-ux-review-2026-09-30.md`.
- Task: Design the Phase 4 Simple UX units concretely enough for implementation briefs, against current source: (1) onboarding after connect: a one-paragraph concept message and the Describe / Extract starts (where the getting-started steps hand over to the chat; what Core command each start sends); (2) Stop: what the extension's Stop does today end to end (extension `background/panel/run-control.ts` to Core `cancel-runtime-session`), what a live proof must observe, and any gap; (3) take over / hand back: the smallest step-boundary pause in which the person acts on the page and FluxIQ resumes, built on Core conversations' parking and resume if possible; say what Core and extension pieces exist and what is missing; (4) a "learned something" message in the chat and the Automations row after a persisted repair, using what Core's adaptation records expose (t256); (5) Open in FluxIQ on the right Flow and its adaptation (t219); (6) t224's held units (extraction caret, preview table, preview feedback, receiver/start currentness, structured-state keyboard recovery): status and whether each is still needed; (7) Firefox popup parity at about 600 px: known differences. For each unit: files to change (partitioned, so units can run in parallel), Core vs extension split, tests to add, and the live check that proves it.
- Required reads: this document's Current State; gap map items 2, 9, 10, 24-26 and the Week 4 rows; `docs/architecture/extension-client.md`.
- Owns (may edit): `docs/working/mvp-final-month-plan/reports/ux-mvp-design.md`
- Must not touch: every other file; no builds, tests, Lab, browser or provider calls; never write to task worktrees.
- Definition of done: one section per unit with the design, file partition, tests and live check; a recommended build order with which units can run in parallel.
- Report to: `docs/working/mvp-final-month-plan/reports/ux-mvp-design.md`

### Brief: t267-adaptation-unblock (lead)
- Repository: both, task t267 trees `C:/Users/osrs_/FluxStuff/fxwork/t267/` (branch `task/t267-adaptation-loop-unblock`).
- Task: Remove what stops the adaptation loop, per the [audit](./mvp-final-month-plan/reports/adaptation-loop-audit.md) ("Ranked blockers"), in stages, returning after each for the supervisor to commit. S1 Lab: blocker 2 (created-Flow playback sends no forced `manual_approval` for `explore_and_adapt`; keep it for `diagnose_and_adapt`) and blocker 3 (repair lane accepts an applied `resultReauthor` with no datasets as a goal-only replay; confirm the failed-step route writes that marker), each with a test; add the catalog row `crossborder-marketplace-hub-to-cart-basket-redesign-after-creation` (variant `basket-redesign`, `variantArmedAfterBuild: true`). S2 blocker 4: read the A8 saved Flow's node definitions in the `fxwork/t262` lane tree's Lab workspace (never quote page data) to settle whether instruction-built nodes declare verifiable evidence; if not, implement the audit's fix so a judged whole run is the evidence a target override worked (`live-patch.ts`, `training-modes.ts`, `service/adaptations/adaptive-retry.ts`), with tests. S3 blocker 1, Automations path: Core `api/handlers/runtime-execution.ts` resolves a paired client's caller as `api/handlers/conversations.ts` does, and extension `background/automation-relay/automation-relay.ts` sends `runIntent: "explore_and_adapt"`; first establish whether that makes routine runs bill a scheduled result check (`service.ts:2534-2540`) and keep item 23 true (a learned run makes no unnecessary model calls) — if the fix needs `service.ts`, describe it and stop. Item 24's Automations row counts only applied adaptations (`panel/automations/facts.ts`). S4 blocker 5: a re-authored Flow is applied only after its re-run is judged `answers` (`service/runtime-adaptation/{reauthor-build,step-failure-port,refuted-result-port}.ts`). S5 (after t264 S2 lands, the supervisor will say): A10 and C w82 Lab records from t264's former S5, including C w74's `try`/trace rework onto t262.
- Required reads: shared rules above; the audit; `docs/architecture/testing-facility.md` sections on the flow lane and repair lane.
- Owns (may edit): `packages/test-runner/src/flow-lane/**`, `packages/test-runner/src/live-llm/**`, `packages/test-runner/src/lab-runs/**`, `packages/test-runner/src/run-scenario.ts`, `packages/test-runner/src/run-scenario/ui-review/**`, `packages/test-contracts/src/evaluation.ts`, `scripts/lab/live-campaign/**`, `apps/scenario-lab/src/scenarios/crossborder-marketplace/live-tasks.ts`, `apps/extension/src/background/automation-relay/**`, `apps/extension/src/panel/automations/facts.ts` (+ tests); Core `api/handlers/runtime-execution.ts`, `runtime/live-patch.ts`, `runtime/training-modes.ts`, `runtime/service/adaptations/**`, `runtime/service/runtime-adaptation/**` (+ tests), and the architecture docs for these.
- Must not touch: every file t264 owns (Core `R/service.ts`, `R/conversations/**`, `R/llm/**`, `R/flow-draft/**`, `R/activity/**`, `R/flow-bootstrap/**`, `R/result-verification/**`, `R/recovery/refuted-result/**`); `apps/extension/src/panel/extraction/**`; Core `apps/web/**`.
- Definition of done per stage: owning tests pass, touched package typechecks exit 0, both structure audits pass, Core rebuilt before downstream checks; report lists each blocker's state and the exact proof command for the Phase 2 live run.
- Report to: `docs/working/mvp-final-month-plan/reports/t267-adaptation-unblock.md`

### Brief: t268-extraction-ui
- Repository: `C:/Users/osrs_/FluxStuff/fxwork/t268/!FluxIQWebExtension` (branch `task/t268-ux-early-units`).
- Task: Implement Unit 6 of the [UX design](./mvp-final-month-plan/reports/ux-mvp-design.md) (t224's held extraction units: caret and preview table, then preview feedback), exactly as that section specifies, with tests.
- Owns (may edit): `apps/extension/src/panel/extraction/**`.
- Must not touch: every other file.
- Definition of done: changed extension tests pass (bundling runner, own label); `extension check` and `extension build` exit 0; structure audit passes; the report lists the live check for each unit.
- Report to: `docs/working/mvp-final-month-plan/reports/t268-extraction-ui.md`

### Brief: t268-deep-link
- Repository: Core `C:/Users/osrs_/FluxStuff/fxwork/t268/!FluxIQ` (branch `task/t268-ux-early-units`).
- Task: Implement the Core deep-link half of Unit 5 of the UX design (Open in FluxIQ lands on the right Flow and can show its adaptation), with tests.
- Owns (may edit): Core `apps/web/src/**` files that Unit 5's design names for the deep link (`useAutomationDeepLinkRuntime.ts` and its session wiring) and their tests.
- Must not touch: every `packages/fluxiq/**` file; every downstream file.
- Definition of done: the changed web tests pass; `node scripts/build-cache/cli.mjs web:check` exit 0; Core structure audit exit 0.
- Report to: `docs/working/mvp-final-month-plan/reports/t268-deep-link.md`

### Brief: t269-creation-blockers (lead; dispatch after t264 lands)
- Repository: both, task t269 trees under `C:/Users/osrs_/FluxStuff/fxwork/t269/`.
- Task: Remove the Phase 1 creation blockers in stages, returning after each for the supervisor to commit. Codex's design reports are under `docs/working/mvp-live-continuation-2026-10-03/reports/`; Codex's unfinished source is on `wip/t262-uncommitted` (downstream `1d6baa6f`, Core `c5521e86`) — reuse it, never merge it whole. S1 B7 binding affordances (`b7-binding-feedback-causality.md`): a screened bindable-path projection beside the shown tool input, derived only from public values that exist at the same path in `ranWith ?? input`, never private selector/element identities; truthful `bind_new_key` feedback that points at those paths. Start with `bindable/tests/paths.test.ts` failing first; fix the WIP's missing import. S2 C1 pagination (`pagination-bound-feedback.md`): establish on current dev whether `paginate: true` still reads one page silently; if so, make the meaning explicit and honest. S3 C4 saved-row repair (`c4-row-repair-preflight.md`, `c4-*`): run the WIP fixture `domain/src/runtime/tests/carried-row-service-repair.test.ts` first and record the actual failure; then reconstruct for-each repeat metadata and `$row` bindings when a saved Flow is seeded for repair, keeping row identity, two correct rows and an untouched decoy. S4 D phase 1 (`d-grounded-waypoint-contract.md`, `d-shared-reader-preflight.md`, `next-d-safe-route-design.md`): one shared lazy instruction read; named/open/unavailable route states; valid permissions kept when a route is invalid; never port the old URL scan, fail-open or blanket withholding. S5 P5 `$step` earlier-output binding (`p5-binding-preflight.md`, WIP `p5-earlier-output-contract.md`): stable deferred step identity across positional `sN` keys, resolving only real outputs of strictly prior steps.
- Required reads: shared rules above; the named reports.
- Owns (may edit): Core `R/flow-draft/**`, `R/llm/**`, `R/flow-bootstrap/**`, `R/action-permissions/**`, `R/service/instruction-authority.ts`, `R/nodes/parameter-bindings.ts`, `R/executor/**` (P5 only), and tests; downstream `domain/src/runtime/**` and tests; architecture docs for these.
- Must not touch: files t267 owns.
- Definition of done per stage: fail-first tests then passing, owning tests green, `fluxiq:check` and touched downstream typechecks exit 0, both audits pass, Core rebuilt; the report names the live run that must prove the stage (B, C or D lane).
- Report to: `docs/working/mvp-final-month-plan/reports/t269-creation-blockers.md`

### Parallel split of t269 (2026-10-05, supervisor): four tasks now, B7 after t264 S4

t264 S4 is editing `R/flow-draft/{amendment,entry,routing,step,act-claim,index}.ts`, `R/flow-draft/amendment/`, `R/llm/{evidence-loop.ts,evidence-loop-decision.ts,draft-amendment-feedback.ts,unusable-decision.ts}`, `R/llm/evidence-loop/**`, `R/llm/decision-handlers/**`, `R/llm/deepseek/**`, `R/llm/harness-options/**`, `R/llm/repeat-guard/**`, `R/llm/node-tools/run-flow-part.ts`, `R/flow-bootstrap/{authoring/draft-routing.ts,authoring/instruction-record-columns.ts,evidence-loop-steps.ts,instructed-acts/**,unfinished-build/**}`, `R/recovery/refuted-result/**`, `R/result-verification/build-test/**`, `src/ui/activity-action/**`. **No t269-t272 worker may edit those files**; if a fix needs one, describe the exact change in the report and stop that part. Each task below has its own worktree pair. Run Core `pnpm.cmd build` in your own Core tree before downstream checks. Reports go to `docs/working/mvp-final-month-plan/reports/<label>.md` in your own task tree.

- **t269-c4-row-repair** (`fxwork/t269`): C4 per the t269 brief S3. Owns `R/llm/node-tools/**` except `run-flow-part.ts`, `replay-span.ts`, `replay-draft.ts`, `run-node.ts`; `R/flow-draft/scheduled-candidate/**`; `R/service/runtime-adaptation/**` only for seeding a saved Flow for repair; downstream `domain/src/runtime/tests/carried-row-service-repair.test.ts` (take it from `wip/t262-uncommitted` `1d6baa6f`) and `domain/src/runtime/**` files the fixture needs. Fail-first: run the fixture first and record the actual failure.
- **t270-p5-step-binding** (`fxwork/t270`): P5 per the t269 brief S5. Owns `R/flow-draft/binding-forms.ts` and other `R/flow-draft/bind*` files, `R/llm/node-tools/{replay-span,replay-draft,run-node}.ts`, `R/flow-bootstrap/authoring/assemble-draft.ts`, `R/nodes/parameter-bindings.ts`, `R/executor/**`, and tests. Start from `wip/t262-uncommitted` `p5-earlier-output-contract.md` and `p5-binding-preflight.md`.
- **t271-d-route-states** (`fxwork/t271`): D phase 1 per the t269 brief S4. Owns `R/action-permissions/**`, `R/service/instruction-authority.ts`, `R/flow-bootstrap/action-permissions.ts`, new files beside them, and tests. Model-facing wording in `R/llm/deepseek/request-body.ts` or the draft display in `R/flow-draft/entry.ts` is t264's: specify it, do not write it.
- **t272-c1-pagination** (`fxwork/t272`): C1 per the t269 brief S2. Owns `domain/src/runtime/llm-evidence/plan-resolution/**`, `apps/extension/src/content/actions/extract-list*` and paging files beside them, and tests. Core extraction contracts only if C1 needs them and they are outside the t264 list.

### Brief: t273-creation-wiring (lead; after t264 landed)
- Repository: both, task t273 trees under `C:/Users/osrs_/FluxStuff/fxwork/t273/`.
- Task: Finish the creation blockers that needed t264's files, in stages, returning after each for the supervisor to commit. S1 B7 binding affordances per the t269 brief S1 (`b7-binding-feedback-causality.md`; reuse Codex's `wip/t262-uncommitted` Core `c5521e86` `flow-draft/bindable/` and its feedback hunk, fixing the missing import; `bindable/tests/paths.test.ts` fails first). S2 D phase 2: wire t271's route states into the draft display (`flow-draft/entry.ts`), the model-facing wording (`llm/deepseek/request-body.ts`) and enforcement of a named route during the build, per t271's report (`docs/working/mvp-final-month-plan/reports/t271-d-route-states.md` on dev) and `d-grounded-waypoint-contract.md`. S3 P5 wiring: the call sites t270's report lists (`reports/t270-p5-step-binding.md`), so a model's `$step` is accepted end to end, plus `draft-from-flow.ts` translating `$node` back to `$step` on re-seed (t269's note).
- Required reads: the shared rules above; the named reports.
- Owns (may edit): Core `R/flow-draft/**`, `R/llm/**`, `R/flow-bootstrap/**`, `R/action-permissions/**`, `R/service/instruction-authority.ts`, `R/nodes/**`, `R/executor/**`, and tests; downstream `domain/src/runtime/**`; architecture docs for these.
- Must not touch: Core `R/service.ts` and `R/service/runtime-adaptation/**` and `R/service/adaptations/**` (t267 owns them now) — specify any change needed there in the report; files t267 owns downstream.
- Definition of done per stage: fail-first tests, owning tests green, `fluxiq:check`, Core build, touched downstream checks and both audits exit 0; framework reference regenerated when exports move; the report names the live run that proves the stage.
- Report to: `docs/working/mvp-final-month-plan/reports/t273-creation-wiring.md` in the t273 downstream tree.

### Brief: live-lane (one lead per lane; Phase 1 live round)
- Lanes: A `crossborder-marketplace-hub-to-cart` (slot 2, instance `t262-slot-2`, tree `fxwork/t262`, workspace `t262-a`); B `bigbox-retail-pickup-cart-store-remembered-after-creation` (slot 3, instance `t262-slot-3`, tree `fxwork/t262`, workspace `t262-b`); C `everything-store-plus-earbuds-under-50` (slot 1, its own synced tree); D `social-network-feed-confirm-requests` (slot 4, its own synced tree). The supervisor syncs every lane tree to dev and rebuilds before dispatch and after every merged fix; leads never merge, switch branches or commit.
- Task: Make the lane's scenario pass live, one run at a time. For each run: (1) write the expectations first, in the run's debug file under `docs/working/language-driven-flow-loop-plan/debugs/`: the actions a correct Flow takes, the exact oracle facts (A: four cart/coupon facts; B: pickup cart facts including remembered store on playback; C: exactly 13 ordered records and 52 fields across all pages; D: exactly the qualifying rows confirmed, excluded rows untouched), and the UI checkpoints. (2) `pnpm.cmd lab:campaign <task> --dry-run` from the lane tree with the lane's `FLUXIQ_LAB_INSTANCE` / slot; inspect the command, the task's consequence permissions and the $0.10 Lab ceiling. (3) Launch the live run: headed browser, the build typed into the real extension chat, DeepSeek flash, no direct-API build, no output caps, no guard overrides. Watch it; never relaunch in a loop. (4) Debug the whole run end to end: instruction, exploration, authored Flow, playback, exact answer, judgement, repair, cost, and the extension UI (chat, overlay, endings) from its screenshots and step logs. (5) On a pass: two provider-free replays with zero model calls, then a second independent live pass. On a failure: name the cause in source, write a failing test and the smallest fix in the lane tree, and return immediately so the supervisor verifies, commits and merges it before the next run.
- Required reads: this document's Current State; `docs/architecture/testing-facility.md` "Live-run waste guards" and the live-campaign section; the lane's previous debugs on dev.
- Owns (may edit): the lane's debug and report files; for a fix, only the files named in the return (the supervisor resolves overlaps between lanes).
- Must not touch: other lanes' slots, instances, workspaces and trees; `lab-slots/` override files; the user's browser profiles.
- Definition of done: the lane passes twice live with exact oracles and replays twice with zero calls; or a precise blocker the lane cannot fix alone.
- Report to: `docs/working/mvp-final-month-plan/reports/live-<lane>.md` in the lane tree.

## Work Ledger

### 2026-10-05 — Intake started
- Agent: supervisor
- Changed: this document.
- Why: User asked for the state of Claude's and Codex's work, what is unpushed, and the MVP plan to 2026-11-10.
- Validation: `git rev-list --left-right --count dev...origin/dev` -> `0 0` in both repositories; `git rev-list --count dev..task/t262-mvp-live-continuation` -> 16 downstream, 14 Core; process listing -> no node/browser processes.
- Outcome: Partial
- Follow-up: three read-only workers dispatched; synthesize the schedule from their reports.

### 2026-10-05 — Intake reconciled and schedule set
- Agent: supervisor with lane-tree-reconcile, t262-audit and mvp-gap-map workers.
- Changed: this document; its three reports; `language-driven-flow-loop-plan/reports/t254-purse-holds-true-cost.md` (Stage 4 addendum copied from the t254 tree, describing the already-landed `fd58af02`).
- Why: Turn three agents' unlanded work and the acceptance gap into one ordered schedule to the deadline.
- Validation: `grep -n automationStudioFlowDraftBindablePaths llm/draft-amendment-feedback.ts` in t262 Core -> used at line 191, no import; `ls flow-draft/bindable/tests` -> no such directory; `git merge-tree --write-tree --name-only dev task/t262-mvp-live-continuation` (downstream) -> conflicts only in `docs/working/README.md` and `claude-work-handoff-2026-10-03.md`; worktree scan -> 46 clean merged, 5 with unlanded work. Worker merge-file and gap claims not independently replayed.
- Outcome: Accepted as a plan; no product change.
- Follow-up: Phase 0 step 1, land t262.

### 2026-10-05 — t262 landed on dev
- Agent: supervisor with t262-gate worker.
- Changed: t262 WIP moved to `wip/t262-uncommitted` (both repos); `dev` merged into t262 (`6fe7f942`, docs conflicts resolved to t262's side, index regenerated); fixture fix `e0cd0cd7`; merges `20404503` downstream and `1fbfa5ef` Core.
- Why: Codex's gated work existed only locally; every later unit builds on it.
- Validation: gate logs (scratchpad `t262-gate/`) -> Core vitest 65 files 939/939, web 29/29, domain changed tests fail 0, extension changed tests fail 0, test-runner changed tests fail 0, Core build/structure audit/fluxiq:check/web:check exit 0; `pnpm.cmd --filter @fluxiq-web-extension/extension check` -> TS2741 in `target-activity.test.ts(16,67)` before the fix, exit 0 after; that file rebundled -> `# tests 11 # pass 11 # fail 0`; Core `structure-audit:check` on merged dev -> exit 0; downstream `node scripts/structure-audit.mjs` on merged dev -> passed after index regeneration.
- Outcome: Accepted
- Follow-up: one background full sweep on dev (none has run on t262's source); Phase 0 step 2.

### 2026-10-05 — Sweep 1 of the day; lane-only ports verified
- Agent: supervisor with sweep-2026-10-05, t263-core, t263-domain and t263-tabs-assert workers.
- Changed: t263 commits `67b95113` (Core: A1, F11, C3), `747668f0` (domain: A8, w86, w75, F8), `f4d7a876` (A7, D1); merged-worktree cleanup (45 merged task worktrees abandoned through `pnpm task abandon`).
- Why: Phase 0 steps 2 and 4.
- Validation: sweep logs -> Core `pnpm check` exit 0; Core `pnpm test` exit 1 with 18 deterministic failures in 7 files (assigned to t266) and 10 load flakes passing on rerun; downstream `check` exit 1 only on the index made stale by the supervisor's uncommitted edit; downstream `test`/`build` stopped on the main Core checkout's stale dist (to rerun after a rebuild). t263: Core `npx vitest run` on the four changed files plus `replay-draft.test.ts` -> 5 files, 45 tests passed; Core `structure-audit:check` exit 0; after `pnpm build` in t263 Core, `domain check` exit 0, `extension check` exit 0, `node scripts/structure-audit.mjs` passed; changed tests rebundled -> domain 103/103, extension 36/36.
- Outcome: Accepted (t263); Partial (sweep).
- Follow-up: land t263; t266 for the Core fallout; rebuild Core dist and finish the downstream half of the sweep.

### 2026-10-05 — t265, t266, t268 landed; t264 S1 committed
- Agent: supervisor with t265-extension-ui (lead), t266-suite-fallout, t268-extraction-ui, t268-deep-link, t264-core-chain (lead).
- Changed: t265 `80bc6447` (A9, B F7, B F9, C w83, C w76 pacer, D D2; `status-dwell.ts` removed), merge `d72c8866`; t266 Core `55045117` (seven tests to t262/t261 contracts), Core merge `de8eb8e5`; t268 extension `56d99be4` (extraction caret, accessible preview table, refresh feedback), Core `c49a1663` (deep link to a Flow's adaptation), merges `5437a163` / Core `cc722f4e`; t264 S1 Core `9975ce6d` (instruction authority) on its task branch. All pushed.
- Why: Phase 0 integration; first Phase 4 units that did not need t264's files.
- Validation: t265 changed extension tests rebundled (21 files, deleted files excluded) -> `# tests 234 # pass 234 # fail 0`; `extension check` 0, `extension build` 0, audit passed. t266 `npx vitest run <7 files>` -> 7 files, 58 tests passed; `fluxiq:check` 0; Core finish `pnpm check` passed. t264 S1 vitest on 4 changed files plus `flow-bootstrap/instructed-acts` and `tests/service-authoring` -> 14 files, 301 passed; `fluxiq:check` 0; Core audit 0. t268 deep-link test -> 6/6 with the fix, 4 failed / 2 passed with the old hook stashed; `web:check` 0. t268 extraction tests (17 files) -> 170/170; `extension check` 0; Core finish `pnpm check` passed. The extraction worker briefly started the extension's content e2e specs by a bare `node --test` and stopped them; no browser process remained.
- Outcome: Accepted
- Follow-up: t264 S2-S4, t267 S1-S5; then Phase 1 live rounds on the integrated source.

### 2026-10-05 — t267 S1-S2 and t264 S2 committed on their task branches
- Agent: supervisor with t267-adaptation-unblock (lead) and t264-core-chain (lead).
- Changed: t267 `4fce48eb` (S1: Lab playback no longer forces manual approval, per run or saved on the Flow; repair lane counts goal-only re-author repairs; A8-class basket-redesign task), Core `81e41266` (S2: a judged whole-Flow run is the evidence a target override worked; A8's ten nodes declare nothing a trial can check). t264 Core `84117643` / downstream `ce1e8903` (S2: refusal cards, build trace, run endings, card words); dev merged into both t264 trees.
- Why: Phase 2 blockers 2-4; Phase 0 Core chain.
- Validation: t267 S1 test-runner rebuilt, five dist test files -> 96/96; test-runner check 0; audit passed. t267 S2 six changed Core test files -> 105/105; adaptation suites (33 files) -> 294/294; `fluxiq:check` 0; Core audit 0. t264 S2 broad run (593 files, 6021 tests) -> only the 17 t266 failures; extension stream/step tests -> 60/60; `extension check` 0. After merging dev into t264 and rebuilding Core: 77 files, 668 passed, 0 failed; domain and extension check 0; audit passed.
- Outcome: Accepted (stages on task branches; not yet on dev)
- Follow-up: t264 S3, t267 S3.

### 2026-10-05 — Creation blockers in parallel: C1, C4, D phase 1, P5 landed; t264 S1-S3 and t267 S3/C1/S5
- Agent: supervisor with t269-c4-row-repair, t270-p5-step-binding, t271-d-route-states, t272-c1-pagination, t264 (lead), t267 (lead).
- Changed: t264 S1-S3 merged to dev (both repos). t272 C1 (`9c0c97e6`: paginate true reads every page to 50; tool description 1764 chars). t271 D phase 1 (Core `7eb25da4`: shared instruction read, route states; nothing enforces yet). t269 C4 (Core `f0556b02`: seeded for-each loops, plan-aware node ids, one line in service.ts by the supervisor). t270 P5 (Core `6b93f185`: `$step` binding built; call sites in t264's files still refuse it). t267 S3 (Run carries its caller; "Learned N" counts kept changes), C1 (paired run may ask explore_and_adapt), S5 (Lab records) on its branch.
- Why: the user asked why work was slow; the creation blockers were split by file and run in parallel instead of waiting for t264.
- Validation: t272 rebundled domain 77/77, extension 38/38, domain check 0; t271 21 files 236/236, fluxiq:check 0; t269 Core 87 files 702/702 with the service.ts line, row fixtures 7/7, domain check 0; t270 after merging dev 210 files 2448/2448, fluxiq:check 0, domain check 0; t264 S3 702 files 6730/6730 (1 skipped); t267 S5 test-runner dist 1946/1946, test-contracts 161/161; t267 C1 web 53/53 (2 failed with the old rule). Every finish: structure audit passed; Core finish `pnpm check` passed.
- Outcome: Accepted
- Follow-up: after t264 S4: one owner for B7, D phase 2 wiring (`request-body.ts`, `entry.ts`) and P5 wiring (t270 report lists the five files); t267 C2 (service.ts result-check caller pays) and S4 (judged re-author apply); then live A-D.

## Open Questions

- Is demonstrate/record an MVP acceptance requirement after the 2026-09-22 scope ruling? Owner: user. Default taken: supported, unmeasured, one smoke proof.
- Who runs the Phase 6 release-candidate script as the "person unfamiliar with FluxIQ"? Owner: user.
