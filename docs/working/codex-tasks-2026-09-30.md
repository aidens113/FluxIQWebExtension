# Codex Tasks, 2026-09-30

Status: Complete
Status detail: All five tasks landed on dev 2026-09-30 (d9820ec2, efc92b69, 9fee5fb2, 3dc66aee, 1310723d; matched by subject). The task table below is historical.
Created: 2026-09-30
Last updated: 2026-10-07
Owner: Senior supervisor agent (Claude) writes and integrates; each Codex run owns its own task branch
Scope: Five self-contained tasks that do not overlap the work Claude's agents are doing right now: docs for integration round 3, Lab bookkeeping gaps, extension cleanup and a deep link, robot-check wait gaps, and full traces for every build ending. Codex works on its own task branches; the Claude supervisor verifies and merges them into dev.
Paired document: none
Related: [language-driven flow loop plan](./language-driven-flow-loop-plan.md), [agent working document protocol](./agent-working-doc-protocol.md)

---

## Current State

Five tasks below, none assigned yet. Give each Codex run the **Shared rules** section plus one task section. When a run
finishes, its branch name (`task/tNNN-codex-...`) goes to the Claude supervisor, which re-runs its validation and merges it.

| Task | Slug | Repositories | State |
| --- | --- | --- | --- |
| 1 | `codex-docs-round3` | both (docs only) | not started |
| 2 | `codex-lab-bookkeeping` | downstream | not started |
| 3 | `codex-extension-cleanup` | downstream (Core only if a route is needed) | not started |
| 4 | `codex-cleared-wait-gaps` | both | not started |
| 5 | `codex-trace-every-ending` | both | not started |

---

## Shared Rules (include with every task)

- Repositories: `C:/Users/osrs_/FluxStuff/!FluxIQWebExtension` (downstream) and `C:/Users/osrs_/FluxStuff/!FluxIQ` (FluxIQ
  Core). Read `AGENTS.md` first; its boundary, secret-handling and test-placement rules bind you.
- Work on your own task branch and worktree: from the downstream checkout run `pnpm task start <slug> --worktree` (add
  `--core` if the task edits Core). Commit there. Never merge into dev, never push dev, never touch main. The Claude
  supervisor integrates your branch.
- Do NOT run the Lab, live runs, Playwright or browser runs, or anything that calls a model provider. Labs are stopped.
- Do NOT edit these; other agents own them right now:
  - Core `runtime/llm/**/context-packet*` and `runtime/conversations/**` (task t210);
  - Core `storage/**` and the `runtime/service` tests (task t215);
  - anything under `C:/Users/osrs_/FluxStuff/fxwork/t174`, `t193`, `t194`, `t195`, `t210`, `t215`.
- Tests go in a `tests/` folder beside their subject. Run heavy commands through
  `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "codex <what>" <cmd>`. Never raise a test timeout or skip a test to
  make it pass.
- Core vitest runs from `packages/fluxiq` and filters by a name fragment. Do not pass `--maxWorkers=1`, which conflicts with
  the config and silently reports "no tests". The `!` in `!FluxIQ` breaks full-path filters.
- The extension, domain and test-runner `test` scripts refuse a stale Core build: build Core (`pnpm build` in the Core tree)
  first.
- Finish with a report at `docs/working/language-driven-flow-loop-plan/reports/codex-<slug>.md` in your tree: what changed
  and why, every file, the exact validation commands with their output, and anything not verified.

---

## Task 1: Architecture Docs For Today's Changes (`codex-docs-round3`, docs only)

Update the authored architecture docs (`docs/architecture/**` in both repositories) to describe the system as it now is on
dev. Read the code and these reports under `docs/working/language-driven-flow-loop-plan/reports/`: t196, t200, t208, t211,
t214, t205, t212, and t191 under `docs/working/live-activity-chat-plan/reports/`.

1. The three-phase build:
   - the model authors the draft (a step it ran is evidence until it adds it);
   - the instructed-act checklist, and progress means the Flow advanced;
   - no replay from the start during exploration; test and judge once the model says the Flow is ready; repair;
   - the endings `flow_bootstrap.not_doable`, `evidence_budget_exhausted` and `model_replies_unreadable`, each with its message.
2. The whole page reaches the model:
   - every rendered element of every frame and open shadow root, with no caps and no ranking;
   - the covering-layer flags;
   - the 1,000,000-token window as the only bound, and secret screening.
3. The chat:
   - every step is its own message with the model's reason;
   - action cards with icons from Core's `fluxiq/ui` activity-action map;
   - resolved ask events (`waited_out`, `answered`, `allowed`, `declined`, `timed_out`, `cancelled`).
4. Permission points on every consequential task, and the Lab answering as the person.

Fix any doc that still describes the old behaviour: capped evidence, a ranked catalog, dry-run replays during the build, or
Simple/Advanced modes.

Validate: `node scripts/structure-audit.mjs` passes in both repositories (it checks doc links).

---

## Task 2: Lab Bookkeeping Gaps (`codex-lab-bookkeeping`, downstream)

In `packages/test-runner` and `scripts/lab`:

1. `run-bench.ts` rebuilds a resumed evaluation without the `stopped_for_permission` label, so a resumed benchmark row loses
   it. Fix it and add a test.
2. After a failed repair re-run the Lab can idle about 300 s before finishing. Check whether lane C's F15 ("a repaired
   re-run's detail is marked settled") fully fixed this; if not, fix the wait so the run ends as soon as its terminal state
   is known.
3. A run bundle has no in-page account of what blocked a build call; twelve debugs could not answer "what was on the page
   when this call was refused". Record a screened account (the refusal, the target, what covered it) in the bundle, never
   page text or secrets.
4. `docs/architecture/testing-facility.md`: correct any section that still describes behaviour these or today's changes
   replaced.

Validate: `pnpm --filter @fluxiq-web-extension/test-runner test`; `node --test` over the touched `scripts/lab` tests;
structure audit.

---

## Task 3: Extension Cleanup And A Deep Link (`codex-extension-cleanup`, downstream; `--core` only if a Core route is needed)

1. Simple/Advanced mode was removed, but names remain: `SIMPLE_PANEL_MESSAGES`, `apps/extension/src/background/simple-panel/**`
   and similar. Rename them to what they now do, at every use, with no behaviour change.
2. "Open FluxIQ" in the extension has no deep link to a single automation. Opening an automation from the Automations tab
   should open the Core panel on that automation. Find the Core panel's route for one automation (`apps/web`) and link to it;
   add one if none exists. Keep the extension's pairing and security rules.

Validate: `pnpm --filter @fluxiq-web-extension/extension check`, `test` and `build`; structure audit; web `tsc` if Core changed.

---

## Task 4: Robot-Check Wait Gaps (`codex-cleared-wait-gaps`, `--core`)

Today's t191 round 6 made a robot check that clears by itself resolve its chat card as `waited_out`. Its report
(`docs/working/live-activity-chat-plan/reports/t191-chat-ui.md`, round 6) names three gaps:

1. A cleared check followed by a failed navigation or a refused click carries no `clearedWait`, so its card never resolves.
   Carry it on those results too.
2. The transport-client runtime path does not read `clearedWait`. Make it.
3. Parked runs past `expiresAtMs` are never expired, so their wait stays open. Settle such a wait as `timed_out`.
   `deleteProject` removes parked runs without settling them; settle them first.

Validate: domain and extension tests; Core vitest from `packages/fluxiq` filtered by name fragment (activity, executor,
runtime-session); Core `tsc`; structure audit in both repositories.

---

## Task 5: Full Traces For Every Build Ending (`codex-trace-every-ending`, `--core`)

t214 made a build that finishes after a repair keep every round's trace, numbered across the build. A build whose ending is
"ended" (cancelled, or a refused configuration) still keeps only its last round's trace.

- Make every ending keep the whole build's trace the same way (Core `runtime/flow-bootstrap/unfinished-build/phases.ts` and
  its callers).
- Check that the downstream Lab reader (`packages/test-runner/src/existing-fluxiq-control/adaptation-evidence-loop.ts`)
  accepts it.
- Read t214's report (`docs/working/language-driven-flow-loop-plan/reports/t214-chat-build-and-endings.md`) first.

Validate: Core vitest from `packages/fluxiq` over unfinished-build, deepseek-bootstrap-exploration and service-bootstrap;
Core `tsc`; test-runner build and its `existing-fluxiq-control` tests; structure audit in both repositories.

---

## Work Ledger

### 2026-09-30 — Five Codex tasks written
- Agent: senior supervisor agent (Claude), at the user's request to give Codex work tonight.
- Changed: this document.
- Validation: `node scripts/structure-audit.mjs` after regenerating the index (recorded in the commit).
- Outcome: Accepted; tasks ready to assign.
