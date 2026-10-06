# MVP Final Month Plan

Status: Active
Status detail: Integration done and live rounds 1-2 run; no lane passes yet; loop-bookkeeping and judge fixes are next, then round 3 off-peak.
Created: 2026-10-05
Last updated: 2026-10-06
Owner: Senior supervisor agent
Scope: The ordered plan from 2026-10-05 to the polished-MVP deadline of 2026-11-10: what is done, what is held on unmerged branches or dirty trees, what must be integrated and pushed, and the week-by-week work to pass the 30-day plan's Final MVP Acceptance Test. It does not redo intake already recorded in the 2026-10-03 handoff, and it does not itself run live provider calls.
Paired document: none (planning only; Core state is read, not changed)
Related: [30-day MVP plan](../../FluxIQ%20Web%20Extension%20%E2%80%94%2030-Day%20MVP%20Implementation%20Plan.md), [Claude handoff 2026-10-03](./claude-work-handoff-2026-10-03.md), [live loop](./language-driven-flow-loop-plan.md), [working index](./README.md)

---

## Current State

Deadline 2026-11-10. Feature freeze 2026-10-29. Updated 2026-10-06 ~07:30 UTC, end of the 2026-10-05 session.

**On dev and pushed (both repositories).** Everything planned for integration: Codex's t262; Claude's whole round-1003 lane work (t263, t264, t265, t267 S5); t266 test fallout; t267 adaptation unblock (repairing runs from the extension Run and chat "run it", routine runs bill no result check, a re-authored Flow kept only once its re-run is judged, judged whole run as target-override evidence, "Learned N" counts kept changes); t268 extraction preview and deep link; t269 C4 row repair; t270/t273 `$step`; t271/t273 D named routes enforced; t272 C1 paginate true reads all pages; t273 B7 binding affordances; t276 live UI fixes; and the round-1 live fixes (A origin choice `32b4e37c`, B per-step changes for the post-run check `7087e9ec`, C opener walk `5e368d1d` and C-2..C-5 judges `d7cb90ca`, D afterWithheld `eb672178`). Sweep 2 of 2026-10-05 was fully green on the pre-live-fix dev (Core fluxiq 780 files 7464 passed; web 2924; every downstream package fail 0).

**Live result: no lane passes yet. Eight runs, all failed, $0.632 in all.** The last passing complex run is still Codex's A8 `run-mutepu6b-656f8882` (2026-10-03, hub-to-cart, 4/4 facts, two zero-call replays), now known to have passed partly by luck (origin choice unread). Run folders: `fxwork/<lane tree>/!FluxIQWebExtension/test-runs/instances/<instance>/<runId>`.

| Lane | Round 1 | Round 2 |
| --- | --- | --- |
| A hub-to-cart (t262, slot 2) | `run-muw60unq-591e23bd` $0.0453: origin choice unread, Spain press and Add to cart fought over a1. Fixed. | `run-muwaobm2-882cadd9` $0.0840: **the user watched it loop**. The model re-sent a refused step-14 amendment nine rounds; each batch also applied a rerun, so the decision-history rows said "applied" and dropped the refusal, stepsWithoutProgress stayed 0, and each rerun replayed the draft's clicks until the purse ran out. Fix in progress, uncommitted (see below). |
| B pickup cart (t262, slot 3) | `run-muw5zv4m-52d83027` $0.1187: oracle held (5/5, store remembered) but the post-run judges refuted it from status rows and a stale end view; re-author failed. Fixed. | `run-muwaq9w3-baaa4e19` $0.0838: ceiling, no Flow. Stall redirect sent the model to the act before its owed quantity choice, so it added 1 pack; then a refused repeat and no-op `keep` amendments (10 of 25 decisions). Fix on dev (`6f8212a5`). Peak-hour pricing halved its decisions. |
| C earbuds (t274, slot 1) | `run-muw60j7c-bb7c9a62` $0.0814: an observe-only read pulled into the Flow, 30 rows vs 13; judges blind to stored rows. Fixed (C-1..C-5). | `run-muwansvz-a2b4a987` $0.0791: ceiling, no Flow. C-3 worked live (the judge said no citing 82 would-be-stored rows). The repair round opened on results page 5, whose disabled Next was not detected as pagination, so every paging rerun was refused as malformed. Fix on dev (`e37cc473`). Open: say why `malformed` (R2-2, `slot.ts`); open a repair round on the blamed step's start page (R2-4). |
| D confirm requests (t275, slot 4) | `run-muw6144a-e56f945d` $0.0537: right Flow refused because a build test does not press Confirm. Fixed. | `run-muwao5n4-44977b2a` $0.0865: ceiling, no Flow. Two accepted edits stranded the listing on the home feed (D2-1: refuse an edit that leaves a kept step on a page the step before no longer reaches, `flow-draft/amendment/apply.ts`); a list read that never appeared on another page reported `failed` not `unreproducible` (D2-2, `domain/.../node-run/replay.ts`). Not fixed; evidence on dev. |

**The pattern.** The builds mostly author the right steps; they fail on (1) the loop's own bookkeeping misleading the model (history saying "applied" for refused work; redirects to the wrong owed item; accepted edits that strand steps) and (2) judges that cannot see what a run did. Peak-hour DeepSeek pricing (01-04 and 06-10 UTC weekdays) halves the decisions a $0.10 build gets; round 2 launched at 06:25 UTC.

**Uncommitted at session end.** Lane A's loop fix, in progress when the session stopped, in `fxwork/t262/!FluxIQ` under `R/llm/`: `decision-context/{decision,group,recorder}.ts` and tests, `decision-handlers/{amendment,types}.ts`, `evidence-loop.ts`, `evidence-loop/rerun-input.ts` and test, new `evidence-loop/tests/rerun-no-change.test.ts`, `repeat-guard/{feedback,outcomes}.ts` and test; plus its round-2 debug `fxwork/t262/!FluxIQWebExtension/docs/working/language-driven-flow-loop-plan/debugs/run-muwaobm2-882cadd9.md` (untracked) and `reports/live-a.md`. Its lead was told to stop and write up; verify every claim before landing. Lane trees: t262 (A/B), t274 (C), t275 (D); slots 1-4 still claimed by them.

**Next, in order.** 1) Land lane A's loop fix (decision history records refused parts and real change; an identical amendment that changed nothing is refused before it runs and counts as no progress), the no-op `keep` loop (B), D2-1 and D2-2, C's R2-2 and R2-4. 2) Sync and rebuild the lane trees; launch round 3 **off-peak** (outside 01-04 and 06-10 UTC on weekdays). 3) Two consecutive passes per lane plus zero-call replays, then Phase 1b (new realistic-site tests; recording as evidence beside mandatory instructions). UI still open: the build ending is one long paragraph that cuts quotes; the overlay is absent early in a build; the start-panel flash and read-card counts need Lab and domain changes; "Skipped: it only runs sometimes" for a repeat whose list was never reached (U11).

**Decisions in force.** One supervisor (Claude). Recording is evidence beside mandatory instructions, never a script, and waits for A-D to pass (user, 2026-10-05). The $0.10 ceiling is Lab-scoped; ordinary product runs keep their own default (t261). Live runs only on the ten realistic scenarios, headed, built from the extension chat, supervised, never relaunched in a loop.

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

### Brief: t276-live-ui-fixes (lead)
- Repository: both, task t276 trees under `C:/Users/osrs_/FluxStuff/fxwork/t276/`.
- Task: Fix the UI defects live round 1 found (each lane's debug and `live-*-ui-review.md` on dev give screenshots and step folders): (1) the "Edit the Flow · Done" card says what changed (step added/moved/removed, in plain words); (2) the build ending in the chat never shows raw ids ("(t958)", s8, s11), never cuts a quote mid-sentence, never repeats a sentence (Core `flow-bootstrap/unfinished-build/not-finished.ts` ~77 and ~153, and the ending composer); (3) the overlay and headline never say "Couldn't fix your Flow" during a creation build; (4) the start panel does not flash an old thread with raw codes; (5) "Checked, not pressed" cards say whose row ("Confirm · Jonas — checked, not pressed"); (6) a navigate to a loopback address is not called "the start page" unless it is the Flow's start (`activity/wording/action.ts` `pageName`); (7) read cards show their counts; (8) overlay text is never cut mid-word; (9) refused decisions are shown as refusals, never as work done; (10) "Look · Sponsored"-style internal labels read as plain words. Fail-first tests per item.
- Owns (may edit): extension `apps/extension/src/{background/activity,background/panel,content/activity-overlay,panel/chat,panel/shell,shared/activity}/**`; Core `R/activity/**`, `src/ui/activity-action/**`, `R/flow-bootstrap/unfinished-build/**`, `R/conversations/**`; their tests; `docs/architecture/extension-client.md`.
- Must not touch: Core `R/result-verification/**`, `R/llm/**`, `R/flow-draft/**`, `R/recovery/**`, `R/service/runtime-adaptation/**` (lane C's fix is running there); every lane tree.
- Definition of done: changed tests pass; extension check/build, domain check, `fluxiq:check`, both audits exit 0; Core rebuilt; the report lists, per item, what the next live run's UI review must see.
- Report to: `docs/working/mvp-final-month-plan/reports/t276-live-ui-fixes.md` in the t276 downstream tree.

### Shared rules for the round-3 fix briefs (2026-10-06)

Each lane tree (both repos) was fast-forwarded to `dev` (Core `6567edac`, downstream `c5a667e4`) before dispatch. `R` = `packages/fluxiq/src/programs/automation-studio/runtime` in Core. Validate with owning tests only: Core `npx vitest run <exact test paths>` from `packages/fluxiq` (exact paths, so vitest does not pick up copies under `.tmp/`), `node scripts/build-cache/cli.mjs fluxiq:check` and `node scripts/build-cache/cli.mjs structure-audit:check` at the Core root, `pnpm.cmd build` in the Core tree before any downstream check; downstream test files through `node <scratchpad>/tools/run-subset.mjs <packageDir> <label> <files>` (scratchpad `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/b5dc1bbc-81f9-4852-9625-ec836b445188/scratchpad`; usage in its header; your own label) then `node --test` on the printed bundles, `pnpm.cmd --filter <pkg> check`, and `node scripts/structure-audit.mjs`. Respect the audit's directory budgets (a `tests/` folder holds at most 25 files: extend an existing test file rather than adding a 26th). Fail-first: each fix's test fails before the fix. No Lab, browser or provider call; no commits; never touch another lane's tree.

### Brief: r3-a-loop (worker-high)
- Repository: Core `C:/Users/osrs_/FluxStuff/fxwork/t262/!FluxIQ` (branch `task/t262-mvp-live-continuation`), and the report in `fxwork/t262/!FluxIQWebExtension`.
- Task: (1) Verify, finish and validate the uncommitted lane A loop fix already in the tree (15 files under `R/llm/`: `decision-context/{decision,group,recorder}.ts`, `decision-handlers/{amendment,refused-repeat,types}.ts`, `evidence-loop.ts`, `evidence-loop/rerun-input.ts`, `repeat-guard/{feedback,outcomes}.ts`, and their tests). Its intent, from run `run-muwaobm2-882cadd9`: the model re-sent a refused step-14 amendment nine rounds; each batch also applied a rerun, so the decision-history row said "applied" and dropped the refusal, `stepsWithoutProgress` stayed 0, and every rerun replayed the draft's clicks until the purse ran out. Required: a decision-history row records refused parts and whether anything really changed; an amendment identical to one already refused, or one that changes nothing, is refused before it runs and counts as no progress; a batch whose only effect is a rerun of an unchanged draft is not progress; a rerun that changes a step's node drops the old node's parameters (done, see `live-a-r2-fix-rerun-node.md`). Read the diff, judge each hunk against that intent, fix what is wrong or missing, and make sure the tests prove the loop cannot recur (a test that replays the 0052/0060-0092 shape: refused amendment plus rerun, repeated, must reach the no-progress limit).
- (2) Lane B no-op `keep` (debug `run-muwaq9w3-baaa4e19.md` row 3): when every amendment in a decision is a refused or no-op `keep` of a step already in the Flow, the answer says `keep` adds nothing and that an owed act is done by running a step on the page that names it with `act`; that decision counts as no progress.
- Required reads: shared rules above; `fxwork/t262/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/live-a-r2-fix-rerun-node.md`; Current State above; the B debug row 3 and its decisions 0027-0036 (`docs/working/language-driven-flow-loop-plan/debugs/run-muwaq9w3-baaa4e19.md`). The run's step folders are under `fxwork/t262/!FluxIQWebExtension/test-runs/instances/t262-slot-2/run-muwaobm2-882cadd9/` if a claim needs checking; never quote page data.
- Owns (may edit): Core `R/llm/decision-context/**`, `R/llm/decision-handlers/**`, `R/llm/evidence-loop.ts`, `R/llm/evidence-loop/**`, `R/llm/repeat-guard/**`, `R/llm/evidence-progress/**`, and their tests; the report file.
- Must not touch: `R/flow-draft/**` and `R/llm/draft-amendment-feedback.ts` (r3-d owns them; describe any change needed there in the report); `R/flow-bootstrap/**`; every downstream source file; the t274 and t275 trees.
- Definition of done: every changed Core test file passes twice in a row, plus `R/llm/evidence-loop/tests`, `R/llm/repeat-guard/tests`, `R/llm/decision-context/tests`, `R/llm/decision-handlers/tests` (if present) and `R/llm/evidence-progress/tests` whole; `fluxiq:check` 0; Core structure audit 0; Core `pnpm.cmd build` 0. The report lists each hunk kept, changed or removed and why.
- Report to: `fxwork/t262/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/r3-a-loop.md`

### Brief: r3-c-paging (worker)
- Repository: `C:/Users/osrs_/FluxStuff/fxwork/t274/` (both repos, branch `task/t274-live-lane-c`).
- Task: Two lane C round-2 causes from `docs/working/language-driven-flow-loop-plan/debugs/run-muwansvz-a2b4a987.md` (rows R2-2, R2-4). R2-2: the `malformed` refusal of a paging rerun says why: the handle's list was detected with no pagination (it was on its last page, where Next is disabled) and a handle detected on the page the step starts on is needed; name the reason and the way out (downstream `domain/src/runtime/llm-evidence/plan-resolution/extraction/slot.ts`, `keptPagination` and the refusal detail). R2-4: a repair round opens on the page the test left (results page 5), not where the blamed step starts, inviting a look and detect on the wrong page. Smallest honest fix first: the repair round's opening message names the page the blamed step starts on and says to look and detect there; navigate there only if that is a small change in the same files.
- Required reads: shared rules above; the debug rows; `docs/working/mvp-final-month-plan/reports/live-C.md` lines 240-260.
- Owns (may edit): downstream `domain/src/runtime/llm-evidence/plan-resolution/**` and tests; Core `R/flow-bootstrap/unfinished-build/**` and the repair-round opening it uses, and tests; the report file.
- Must not touch: Core `R/llm/**`, `R/flow-draft/**`; downstream `node-run/**`; the t262 and t275 trees. If R2-4 needs a file outside this list, describe the change and stop that part.
- Definition of done: fail-first tests; changed tests pass; `domain check`, `fluxiq:check`, both audits 0; Core and domain built.
- Report to: `fxwork/t274/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/r3-c-paging.md`

### Brief: r3-d-reach (worker)
- Repository: `C:/Users/osrs_/FluxStuff/fxwork/t275/` (both repos, branch `task/t275-live-lane-d`).
- Task: Two lane D round-2 causes from `docs/working/language-driven-flow-loop-plan/debugs/run-muwao5n4-44977b2a.md` (rows D2-1, D2-2, decisions 0030-0031). D2-1: an amend decision that drops the steps reaching a page (here the navigates to the friends and requests pages) and leaves a kept step that runs on that page is refused, or at least answered with which kept step no longer has a way to its page; today it says "applied 7" and nothing about reach (Core `R/flow-draft/amendment/apply.ts`, wording in `R/llm/draft-amendment-feedback.ts`). Prefer refusing the stranding part with a named reason over a silent apply. D2-2: a list read whose list never appeared, on a page other than the one it read, answers `unreproducible` as a missing control does; on its own page it still fails (downstream `domain/src/runtime/llm-evidence/node-run/replay.ts`, test in `node-run/tests/`).
- Required reads: shared rules above; the debug rows and decisions named; `docs/working/mvp-final-month-plan/reports/live-d.md` lines 170-190.
- Owns (may edit): Core `R/flow-draft/amendment/**`, `R/flow-draft/amendment.ts`, `R/llm/draft-amendment-feedback.ts`, and tests; downstream `domain/src/runtime/llm-evidence/node-run/replay.ts` and `node-run/tests/`; the report file.
- Must not touch: Core `R/llm/**` other than `draft-amendment-feedback.ts`; `R/flow-bootstrap/**`; downstream `plan-resolution/**`; the t262 and t274 trees.
- Definition of done: fail-first tests; changed tests pass plus `R/flow-draft/tests` whole; `domain check`, `fluxiq:check`, both audits 0; Core and domain built.
- Report to: `fxwork/t275/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/r3-d-reach.md`

### Brief: t277-r3-ui (lead)
- Repository: both, task t277 trees `C:/Users/osrs_/FluxStuff/fxwork/t277/` (branch `task/t277-r3-ui-fixes`, its own Core worktree).
- Task: Fix the round-2 UI defects in `docs/working/mvp-final-month-plan/reports/live-C-r2-ui-review.md` ("Defects", with screenshots and step folders it cites) plus D's U11, fail-first test per item: R2-U-1 the build-test check card says the count ("82 rows would be stored") and in one plain clause why it did not pass; R2-U-3 a judge's sentence is never cut inside a parenthesis or glued to the next sentence; R2-U-4 no internal words in the chat ("extract list node", "scrapes", "extraction", "pagination", "Step 8" (raw positions that contradict the Flow's step count), "dedup", "next call", "the judge"); R2-U-5 "Sending your message" clears when the build starts; R2-U-6 a refusal (`target_unobserved`, `changes_nothing`) is never worded as "it wasn't on the page" when it was; R2-U-7 repeated refused reruns collapse into one card with a count; R2-U-8 one list has one name across cards and overlay; R2-U-9 the detect card names the list ("the search results") when the page says what it is; R2-U-10 the panel never opens a new build beside an earlier chat's "is ready" ending (establish whether this is the previous run's thread first); R2-U-11 the overlay survives a page load at build start; U11 (`docs/working/language-driven-flow-loop-plan/debugs/run-muwao5n4-44977b2a.md` row U11) a repeat whose list the test never reached is not worded "it only runs sometimes" (Core `R/flow-draft/excused.ts`). R2-U-2 (the ending) is out of scope here: `R/flow-bootstrap/unfinished-build/**` is owned by r3-c-paging; write its proposed fix in the report.
- Required reads: the shared rules for the round-3 fix briefs above; the review; `docs/working/mvp-final-month-plan/reports/t276-live-ui-fixes.md` (what the last UI pass did).
- Owns (may edit): Core `R/activity/**`, `src/ui/activity-action/**`, `R/conversations/**`, `R/flow-draft/excused.ts`; extension `apps/extension/src/{background/activity,background/panel,content/activity-overlay,panel/chat,panel/shell,shared/activity}/**`; their tests; `docs/architecture/extension-client.md`.
- Must not touch: Core `R/llm/**`, `R/flow-draft/**` (except `excused.ts`), `R/flow-bootstrap/**`, `R/result-verification/**`; downstream `domain/**`; the t262, t274, t275 trees. If an item needs a file outside the list, describe the change and skip it.
- Definition of done: fail-first tests then passing; extension check and build, `fluxiq:check`, both audits exit 0; Core rebuilt; the report lists per item what the next live run's UI review must see.
- Report to: `fxwork/t277/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/t277-r3-ui.md`

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

### 2026-10-05 — t267 and t273 landed; integration complete
- Agent: supervisor with t267 and t273 (leads).
- Changed: t267 C2/S4 (Core `fa8640ff`) and the whole task merged; t273 S1 B7 (`f83eeb5a`), S2 D route enforcement (`333ea0bf`, service wiring `d81ce169` by the supervisor), S3 P5 wiring and chat run-it (`77a331cb`) merged. Lane trees t174/t193/t194/t195 snapshotted to local `wip/<lane>-uncommitted` and retired; their evidence committed (`642d0089`).
- Validation: t267 C2/S4 94 files 614/614, fluxiq:check 0, downstream checks 0. t273 after merging t267 and wiring service.ts: 725 files 7048/7048; after S3: 727 files 7079/7079 (1 skipped), fluxiq:check 0, web:check 0, audits pass, reference current, domain/extension/test-runner checks 0. Every finish: structure audit passed; Core finish `pnpm check` passed.
- Outcome: Accepted
- Follow-up: sweep 2; live A-D.

### 2026-10-05 — Sweep 2 green; live A-D launched
- Agent: supervisor; four live-lane leads dispatched.
- Changed: lab-slots owners set for this round (slot 1 t274-slot-1 C, slot 2 t262-slot-2 A, slot 3 t262-slot-3 B, slot 4 t275-slot-4 D; slots 2-3 previously held by Codex's dead Oct 4 processes). Lane trees t262, t274, t275 synced to dev and rebuilt (Core, domain, test-runner, extension builds all exit 0).
- Why: every planned fix is on dev; the user's order is to prove A-D live before anything new.
- Validation: sweep 2 on dev (logs in scratchpad `sweep2-2026-10-05/`): Core `pnpm build` 0, `pnpm check` 0, `pnpm test` 0 (fluxiq 780 files 7464 passed 1 skipped; web 356 files 2924 passed; contracts 55; gateway 10); downstream `pnpm check` 0, `pnpm test` 0 (every package `# fail 0`, e.g. 2475, 1946, 1459, 627 passed), `pnpm build` 0. First fully green full sweep since t262 landed.
- Outcome: Accepted
- Follow-up: live results per lane; fixes merged between runs.

### 2026-10-05/06 — Live round 1 on the integrated source: A, C, D failed with causes found
- Agent: supervisor with live leads A, C, D (B still debugging).
- Changed: A `run-muw60unq-591e23bd` failed ($0.045303, 36 calls, no Flow): "shipped from Spain" had no choice id, so the Spain press and Add to cart fought over act a1; fix Core `32b4e37c` (origin choice). D `run-muw6144a-e56f945d` failed ($0.053701, 44 calls, no Flow): round 1's Flow was right, but a build test does not press lasting Confirm, so the final read showed one accepted row and the judge refused the right Flow; fix Core `eb672178` (afterWithheld, judge told). C `run-muw60j7c-bb7c9a62` failed ($0.0814, 54 calls; 30 records stored vs 13): an observe-only read was pulled into the Flow by the opener walk; fix Core `5e368d1d`. All merged to dev with debugs and reports.
- Why: Phase 1 live round.
- Validation: A fix: instructed-acts, action-permissions, lasting-acts-build, instruction-authority, service-authoring -> 23 files 436/436. D fix: result-verification, deepseek tests, unfinished-build, service-bootstrap, lasting-acts-build -> 89 files 762/762. C fix: flow-draft + llm -> 180 files 1818/1818. Combined on dev: 319 files 3516/3516; fluxiq:check 0; audits pass.
- Outcome: Partial (no lane passes yet)
- Follow-up: C-2..C-5 (judges blind to stored records, re-author advising refused reruns, false judge advice discarding an exact answer, judges passing left-out matching rows) being fixed in t274 without live runs; then all lanes resync and relaunch together. UI findings queued: edit card says nothing of what changed; ending chat shows raw ids and cut quotes; overlay says "Couldn't fix your Flow" on a creation build; old thread flash; identical "Checked, not pressed" cards without whose row; loopback named "the start page"; read cards without counts; overlay text cut mid-word; refusals shown as work.

### 2026-10-06 — Round 1 complete: B's oracle held but its check refuted it; judge fixes for B and C landed
- Agent: supervisor with live leads B and C, and t276 (lead).
- Changed: B `run-muw5zv4m-52d83027` failed (runtime.behavior) with the exact oracle held: playback built the right pickup cart (5/5 facts, store remembered by page state) but both post-run judges said no from status rows and a stale end view; a re-author then failed. Cost $0.118709 (build $0.0445, re-author $0.0725). Fix Core `7087e9ec` (judges see each step's state change; plain cart ending; state-routed step wording). C-2..C-5 fix Core `d7cb90ca` (would-be-stored records, left-out rows matching the request, checked evidence in every no, carried steps run as saved). The verification instruction now carries B's, C's and D's sentences together (merged by the supervisor, pins regenerated). t276 UI fixes verified and landing.
- Why: no lane passed round 1; the recurring cause is judges that cannot see what a run did.
- Validation: B fix 101 files 831/831; after merging dev into t262 and regenerating pins: 249 files 2797/2797. C fixes: lead 393 files 4287; after merging B's fix: 450 files 4881/4881; fluxiq:check 0; reference current; audits pass.
- Outcome: Partial
- Follow-up: land t276; sync and rebuild every lane tree; live round 2 for A-D. Open: a re-author cannot conclude "nothing to change" when the post-run check is wrong (B); the recovery ladder's structured repair input drops `checked` (C).

### 2026-10-06 — Live round 2: all four failed; loop root cause found; session wrapped
- Agent: supervisor with live leads A-D.
- Changed: round 2 runs A `run-muwaobm2-882cadd9` ($0.0840, the loop the user watched), B `run-muwaq9w3-baaa4e19` ($0.0838), C `run-muwansvz-a2b4a987` ($0.0791), D `run-muwao5n4-44977b2a` ($0.0865), all failed with no Flow. Root cause of A's loop traced by the supervisor from the step folders: decision-history rows recorded a refused, repeated step-14 amendment as "applied" because each batch also applied a rerun; stepsWithoutProgress stayed 0. Merged to dev: B's owed-choice redirect (Core `6f8212a5`), C's disabled-Next pagination (`e37cc473`), round-2 debugs and reports for B, C and D. Lane A's loop fix uncommitted in progress. Memory `no-repeated-failing-actions` extended; lesson recorded on parallelising partitionable work.
- Why: the user's order is A-D passing live before anything new; tonight's spend was $0.632 over eight runs.
- Validation: lane B fix `npx vitest run .../llm/evidence-progress .../llm/evidence-loop` on merged Core dev -> 30 files, 282 passed; Core `structure-audit:check` exit 0; lane C fix rebundled detect-pagination and pagination tests -> `# tests 47 # pass 47 # fail 0`; `pnpm.cmd --filter @fluxiq-web-extension/extension check` exit 0; downstream `node scripts/structure-audit.mjs` passed after index regeneration. Lane A's loop fix: not validated (in progress at stop).
- Outcome: Partial
- Follow-up: verify and land lane A's loop fix; fix B's no-op keep loop, D2-1, D2-2, C R2-2/R2-4; round 3 off-peak.

### 2026-10-06 — Round-3 fixes dispatched
- Agent: supervisor; workers r3-a-loop (worker-high, t262), r3-c-paging (t274), r3-d-reach (t275).
- Changed: lane trees t262, t274, t275 fast-forwarded to dev in both repos (Core `6567edac`, downstream `c5a667e4`); t262 Core kept lane A's 15 uncommitted files. Briefs above.
- Why: Current State "Next" step 1; 19:48 UTC is off-peak, so round 3 can launch tonight once these land.
- Validation: `git rev-list --count dev..HEAD` was 0 for every lane branch before the fast-forward (nothing unmerged).
- Outcome: In progress
- Follow-up: verify each report against the diff and owning tests; commit, merge, sync, rebuild; round 3.

## Open Questions

- Is demonstrate/record an MVP acceptance requirement after the 2026-09-22 scope ruling? Owner: user. Default taken: supported, unmeasured, one smoke proof.
- Who runs the Phase 6 release-candidate script as the "person unfamiliar with FluxIQ"? Owner: user.
