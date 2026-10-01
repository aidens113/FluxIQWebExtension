# Work Ledger, 2026-09-30 night

Moved from `language-driven-flow-loop-plan.md` on 2026-10-01 under the 800-line compaction threshold.

### 2026-09-30 night — t210 rounds 1-2 merged; round 3 and t215 resumed; Codex t216-t220 running
- Agent: supervisor; workers for t210 round 3 and t215 dispatched in their own worktrees. Seventeen orphaned
  monitor processes from dead sessions were killed (one, a `ui.sh` holder, kept a UI slot); no Lab was running.
- Changed: t210's staged Core dev merge committed on its branch (`c070c94b`) after the supervisor isolated it from the
  unfinished round 3 (round-3 files copied aside, checks run, files restored). Merged to dev: Core `e5b8f015`, downstream
  `58ed498b`. Core libraries rebuilt (the downstream gate refused the stale dist, as designed).
- Validation: supervisor-run. At `c070c94b` `npx tsc --noEmit -p .` exit 0 (the cached `pnpm check` only restored a
  stamp); `pnpm docs:check` -> "structure-audit: passed" and "Deterministic framework reference is current."; vitest
  conversations + exploration `Tests 85 passed (85)`. On merged dev: Core automation-studio vitest `32 failed | 4621
  passed | 6 skipped`, all 32 "Test timed out in 15000ms" under four concurrent suites; the 24 files re-run with
  `--testTimeout=120000` -> `Tests 129 passed (129)`, so no hang and no assertion failure (t215 owns the speed); web check
  EXIT=0; downstream `pnpm check` EXIT=0; extension `# pass 1673 # fail 0`; domain `# pass 1061 # fail 0`; test-contracts
  156/0; scenario-lab `# pass 614 # fail 6`, the six being `everything-store/tests/naive-paths` which sat idle 25 min (0
  CPU, 12 fixture servers listening) and was killed; alone it passes `# pass 6 # fail 0` in 36 s. scenario-lab depends
  only on test-contracts and Playwright, which t210 does not touch: a pre-existing intermittent wait without a timeout.
- Outcome: pushed as below. Open defect: the naive-paths idle hang. Not done: workers committing to their own task
  branch — the brain's `worker-git-guard` change was refused by the permission classifier as self-modification; left for
  the user. Pass streak 0.

### 2026-09-30 night — Every Lab stopped: the page view is 500 KB of raw JSON; t223 owns the compact view
- Agent: supervisor, on the user's orders. The four live leads (t174, t193, t194, t195) were dispatched on slots 1-4 at
  ~22:00, then held. Lane B's run `run-mup2i28c-6c7fc209` (bigbox cart redesigned) failed, exit 1, after 4.5 min.
- Changed: the user rejected the page evidence (every rendered element as JSON with every attribute, a pixel box and
  context fields, about 500 KB a page), gave the compact-view-plus-search design (Binding rules, first bullet), and ordered:
  "make sure you fix that context issue BEFORE running any labs", "stop every single lab till you figure that out NOW". The
  supervisor killed the two runs in flight (lane A crossborder, lane D social-feed), told every lead to run no Lab of any
  kind, and started a watchdog that kills any `run-lab.mjs` process until the stop is lifted. t223 (`fxwork/t223`, Core-
  paired, `lead-xhigh`) owns the compact page view, the page search and the before/after page sizes.
- Validation: not validated; no code changed. Observed: no `chrome.exe` and no `run-lab.mjs` process after the kill; the
  watchdog log reads "watchdog start 22:22:13". Headless is off: the Lab launches `headless: false`, and
  `FLUXIQ_DEMO_HEADLESS` is unset in every lane's `.env.local` and the environment.
- Outcome: Labs stopped until t223 is merged and its measured page size is sane. Pass streak 0.

### 2026-09-30 night — t210 rounds 3-3b merged; a Windows build-lock race fixed; the compact format approved
- Agent: supervisor; t210 by its `worker-high`.
- Changed:
  - t210 rounds 3 and 3b merged into dev (Core `6af7e6cd`, downstream `5df252a2`). The whole conversation, context packet,
    instruction set and adaptation records now reach the model, read page by page.
  - The build-cache step lock (`scripts/build-cache/lock/acquire-step-lock.mjs`, the same code in both repositories)
    crashed with EPERM when it read a lock another process was deleting. Windows refuses to open a delete-pending file.
    `readHolder` now retries EPERM, EACCES and EBUSY briefly.
  - The user approved the compact format in t223's `reports/t223-format-example.md`.
- Validation:
  - At t210's `4b3fced7`: `npx tsc --noEmit -p .` EXIT=0; structure-audit passed; docs:check current.
  - vitest over conversations, llm, recovery, result-verification, flow-bootstrap, service and storage/project:
    `Tests 5 failed | 2815 passed`, all 5 "Test timed out in 15000ms". The 3 files re-run with `--testTimeout=120000`:
    `Tests 40 passed (40)`.
  - On merged dev: Core lib build EXIT=0; web check EXIT=0; domain `# pass 1061 # fail 0`; extension `# pass 1673 # fail 0`.
  - Downstream `pnpm check` first failed `step-lock.test.mjs` ("a live, recent lock is waited on until it is released",
    EPERM). It passed 5 of 5 alone.
  - After the fix: downstream build-cache tests `# pass 53 # fail 0`; Core `pnpm build-cache:test` `# pass 61 # fail 0`;
    the lock test 40 times, 8 at a time: 0 failures. The failure was never reproduced before the fix, so this shows no
    regression, not the cure.
  - Full downstream `pnpm check` EXIT=0 with `# pass 547 # fail 0`.
- Outcome: pushed as below. Labs remain stopped for t223. Pass streak 0.

