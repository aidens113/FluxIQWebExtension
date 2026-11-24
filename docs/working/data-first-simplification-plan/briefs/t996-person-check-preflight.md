# Preflight exercises each site's own person check (t996)

Lead: Claude Code session, 2026-11-23. Tier: worker.
Trees: `C:/Users/osrs_/FluxStuff/fxwork/t996/!FluxIQWebExtension` and its own Core `t996/!FluxIQ` (task branch; Core edits only if the cause is there, and report before making one).
Read: this brief; "S6" in `docs/working/data-first-simplification-plan.md` (Systemic Changes); the preflight table and "What each stage shows" in `docs/working/data-first-simplification-plan/reports/t986-offline-proof.md` (~lines 415-455); `packages/test-runner/src/attempt-lane/preflight/**`; and the four sites' `apps/scenario-lab/src/scenarios/<site>/person-check.ts` plus where each task arms its check.

Gap: the S6 preflight records `siteChallenge: not_run` on everything-store, crossborder-marketplace, bigbox-retail and company-website (`preflight/run.ts:53`). Those sites declare person-check modules: an image of characters to type, a human check, and so on. The preflight never meets them. A generic confirmation is not the site's own challenge. So a paid run could die on a hand-off no provider-free check ever proved.

Goal: for each of the four sites, a provider-free preflight in a visible browser that:
- arms the site's own declared check the way that site's campaign task does (its variant or state; for example, everything-store's robot check answers every page);
- lets the run meet the check through the real product path: the paired extension and the chat starting the task;
- shows that the product hands off to the person, never guessing, typing or asking for a new image itself, with the ask visible in the chat;
- has the Lab's person pass it through that site's `PERSON_CHECKS` steps;
- shows that the run then continues on the restored site (a read succeeds);
- records `siteChallenge: "passed"`, or `"failed"` with the exact stage and code.

Steps:
1. Find how the Lab's live attempts already arm and answer these checks (the person responder, the module's `steps`). Reuse it; do not copy it.
2. Extend the preflight so that a site declaring checks runs this stage, keeping `not_declared` for the other five sites. Add or extend tests in `preflight/tests/`.
3. Run the preflight on the four sites (visible Chrome, provider-free) with the existing command (`offline-preflight` in `packages/test-runner/src/cli.ts`, via `node scripts/lab/run-lab.mjs`) into ignored `test-runs/t996-preflight-<site>/`. Read each result file.
4. If the product fails a stage, find the cause:
   - in this repository's owned paths, fix it and rerun;
   - in Core or the extension's person-needed path, report the file and line with evidence before editing.

Rules:
- Ten realistic scenarios only, visible browsers, no provider or paid calls, no `node -e`, no git mutations.
- Heavy commands go through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- <cmd>`, one at a time. Do not wait for free memory; the gate queues (AGENTS.md).
- Never weaken a site's check, teach to it, or let the product read the challenge's answer. Only the Lab's person may.
- Never print page data, tokens or secrets.

Owned:
- `packages/test-runner/src/attempt-lane/preflight/**` and its tests;
- `apps/scenario-lab/src/scenarios/*/person-check.ts`, only if a declaration is wrong, with the reason recorded;
- your brief and report.

Must not touch: `domain/**`, Core outside the t996 Core tree, other worktrees, `docs/working/data-first-simplification-plan.md`, `docs/working/README.md`.

Checks:
- the preflight tests;
- `pnpm --filter @fluxiq-web-extension/test-runner check`;
- `node scripts/structure-audit.mjs`.

Report: `docs/working/data-first-simplification-plan/reports/t996-person-check-preflight.md`, with the per-site stages, result files and commands with observed results. End with the return contract.
