# MVP Final Month Plan

Status: Active
Status detail: Phase 0 in progress: Codex's t262 landed on dev in both repositories 2026-10-05; Claude's round-1003 lane units are next.
Created: 2026-10-05
Last updated: 2026-10-05
Owner: Senior supervisor agent
Scope: The ordered plan from 2026-10-05 to the polished-MVP deadline of 2026-11-10: what is done, what is held on unmerged branches or dirty trees, what must be integrated and pushed, and the week-by-week work to pass the 30-day plan's Final MVP Acceptance Test. It does not redo intake already recorded in the 2026-10-03 handoff, and it does not itself run live provider calls.
Paired document: none (planning only; Core state is read, not changed)
Related: [30-day MVP plan](../../FluxIQ%20Web%20Extension%20%E2%80%94%2030-Day%20MVP%20Implementation%20Plan.md), [Claude handoff 2026-10-03](./claude-work-handoff-2026-10-03.md), [live loop](./language-driven-flow-loop-plan.md), [working index](./README.md)

---

## Current State

Deadline 2026-11-10 (36 days from 2026-10-05). Feature freeze 2026-10-29.

**Where the code is (verified 2026-10-05).**

- **t262 landed 2026-10-05**: downstream merge `20404503`, Core merge `1fbfa5ef`, both pushed with this update. The supervisor fixed one gate failure first (`e0cd0cd7`: an extension test fixture that did not compile). Codex's unfinished work is preserved, not landed, on `wip/t262-uncommitted` in both repositories (downstream `1d6baa6f`, Core `c5521e86`): the broken B7 bindable fix, the C4 fail-first fixture, the partial P5 report. The `fxwork/t262` trees are kept as the A/B lane trees (they hold the A8 saved Flow project and profiles).
- Before t262: `dev` equaled `origin/dev` in both repositories (downstream `b6768b7f`, Core `f6ef9f48`). `origin/main` is at `d88ed2fb` (2026-09-24), 761 commits behind `dev`; moving it needs the user's approval each time.
- **Codex's t262** (`task/t262-mvp-live-continuation`, worktrees `fxwork/t262/`) holds 16 downstream commits (7 source) and 14 Core commits (9 source), on no remote. The last source commits `476b52d7` / Core `0ecdec16` passed Codex's recorded narrow gate; the two later commits are docs. `git merge-tree` against `dev`: Core clean; downstream conflicts only in `docs/working/README.md` and `claude-work-handoff-2026-10-03.md`. Its uncommitted Core B7 binding fix is broken (`llm/draft-amendment-feedback.ts:191` calls `automationStudioFlowDraftBindablePaths` with no import; `flow-draft/bindable/tests/` does not exist), verified by the supervisor. Its uncommitted C4 row fixture is a fail-first test with no recorded result. Details: [t262 audit](./mvp-final-month-plan/reports/t262-audit.md).
- **Claude's round-1003 lane trees** t174 (A), t193 (B), t194 (C), t195 (D) hold large uncommitted fixes on both sides on the old base `45bd6232` / Core `6beae684`. t262 already ported or reworked much of A and C. Three design forks resolve to t262's side (repeat removal `unrepeat`, scheduled-candidate carried steps, source-grounded split acts). The lane reports are stale: A run 3 and B run 2 failed on the full fix sets. Per-unit integration order: [lane reconcile](./mvp-final-month-plan/reports/lane-tree-reconcile.md).
- `task/t224-codex-ui-ux-review` has one doc commit on `origin` not on `dev`; its UI work is paused by the user.
- 46 task worktrees are clean and fully merged. t197/t215/t251 hold only report files already on `dev` or superseded. t254's Stage 4 report addendum was copied onto `dev` in this unit.
- No node, browser or Lab process was running at intake. A `codex` process started 2026-10-05 11:14 but had not written to t262 since 2026-10-03 23:21.

**Where the product is.** Of the 26 Final MVP Acceptance items, 5 are proven live (3, 6, 7, 8, 11), all from one scenario: t262's A8 hub-to-cart run `run-mutepu6b-656f8882` (built from the extension chat, 4/4 facts, $0.0566) plus two zero-call reuses. Creation fails or is unproven on B, C and D. The adaptation and learning blocks (12-23) have no live proof on an instruction-built Flow since a single-node selector patch on 2026-09-21. Onboarding and run Pause do not exist; Stop, takeover and Firefox are unproven in a browser; nothing has been installed outside the dev environment. Full table: [gap map](./mvp-final-month-plan/reports/mvp-gap-map.md).

**Open defects blocking creation.** B7 binding affordances (draft shows the tool input, bind checks the runnable `ranWith`); C4 saved-row repair loses for-each metadata; C1 `paginate:true` reads one page; D ordered waypoints / named routes (design done, no source); P5 `$step` earlier-output binding refused at Core `binding-forms.ts:124` despite t252's merge title.

**Decisions taken by default (the user may override).**

1. Codex's t262 lands as-is (committed checkpoints only) and Claude supervises from here; Codex should not keep editing t262 in parallel.
2. Demonstrate/record (acceptance item 4) stays a supported, unmeasured path, per the user's 2026-09-22 scope; it gets one smoke proof in Phase 5 and no development.
3. Acceptance item 10 is met by Stop plus a live "take over / hand back" pause at a step boundary, built in Phase 4; no general mid-action pause.
4. Item 24 ("Simple Mode shows it learned") is read as the extension chat and Automations row, since the chat replaced Simple Mode.
5. The Week 2 exit gate is retired into Phase 2's chained adaptation proof.

**Next.** Phase 0, step 2: lane-only units on their own task branch; in parallel, the serial Core integration chain under one lead and the extension UI unit under another. Each unit is committed by the supervisor as soon as it is verified, so no tree accumulates uncommitted work again.

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

## Open Questions

- Is demonstrate/record an MVP acceptance requirement after the 2026-09-22 scope ruling? Owner: user. Default taken: supported, unmeasured, one smoke proof.
- Who runs the Phase 6 release-candidate script as the "person unfamiliar with FluxIQ"? Owner: user.
