# MVP Final Month Plan

Status: Active
Status detail: Intake and schedule complete; Phase 0 (land Codex's t262, then Claude's round-1003 lane units, onto dev) is next and not started.
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

- `dev` equals `origin/dev` in both repositories (downstream `b6768b7f`, Core `f6ef9f48`). Nothing on `dev` is unpushed. `origin/main` is at `d88ed2fb` (2026-09-24), 761 commits behind `dev`; moving it needs the user's approval each time.
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

**Next.** Phase 0, step 1: land t262. See the schedule below.

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

## Open Questions

- Should Codex stop editing t262 now that Claude supervises? Owner: user. Default taken: yes, one supervisor.
- Is demonstrate/record an MVP acceptance requirement after the 2026-09-22 scope ruling? Owner: user. Default taken: supported, unmeasured, one smoke proof.
- Who runs the Phase 6 release-candidate script as the "person unfamiliar with FluxIQ"? Owner: user.
