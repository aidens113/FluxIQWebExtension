# Recorded-run oracle acceptance for the campaign tasks (t990)

Lead: Claude Code session, 2026-11-23. Tier: worker-heavy.
Workspace: `C:/Users/osrs_/FluxStuff/fxwork/t990/!FluxIQWebExtension` and `t990/!FluxIQ` only.
Read: this brief; the Current State and "Phases" of `docs/working/data-first-simplification-plan.md`; `docs/architecture/recorded-offline-proof.md`; the 2026-11-23 sections of `reports/t986-offline-proof.md` (recorded-read, capture and replay commands, and which historical evidence is admissible); the campaign results `C:/Users/osrs_/FluxStuff/fxwork/t959/!FluxIQWebExtension/docs/working/mvp-launch-plan/reports/live-campaign-2026-11-19/results.md`. That file is read-only; it holds run ids and findings F3, F9, F17 and F27.

Goal: P1-P3 acceptance. For each campaign task below, prove without a provider that the task's recorded reads produce the oracle's exact table:
- replayed through today's production reader, keeping every safe field (P1);
- then processed by the task's declared automatic processing through Core's real data stage (P2), not a copy of it.

The tasks: `everything-store-plus-earbuds-under-50`, `crossborder-marketplace-free-hubs-under-ten`, `professional-network-netherlands-data-engineers`, `job-board-remote-easy-apply`, `photo-social-august-over-1300`.

Steps:
1. Discovery. For each task, find its campaign runs, the read steps whose results hold its candidate rows, and whether those recorded reads cover every page and item the oracle's rows come from. Also find where the task's oracle and any authored task-processing criteria live. Reuse the t986 `recorded-read` admission and source checks; do not reread live sites.
2. Build the smallest command that does the following (extend `lab recorded-read` or add a sibling beside it, whichever fits the owning module):
   - replays a task's admitted recorded reads through the production reader;
   - collects the retained rows as the run dataset does;
   - applies the task's processing declaration through Core's automatic data stage, where the declaration states the instruction's conditions in the site's own terms;
   - compares the result with the oracle's expected table record by record, in its column order and order;
   - reports what each condition removed, any missing field, and model calls (0 by construction).
3. Run it for the five tasks. For each, report pass, or the exact cause:
   - a recorded read lacks a field the condition needs (extraction defect);
   - the run never read the pages the answer needs (recording gap, honest and not fixable from this evidence);
   - a wrong criterion;
   - a data-stage defect;
   - an oracle or wording mismatch.
4. Fix product defects at their cause within your owned paths, including Core's data stage in t990's own Core. Then rerun.

Rules:
- Run every heavy command through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- <command>`. Run Vitest with `--maxWorkers=1 --minWorkers=1 --fileParallelism=false` on named files. No full suites. One heavy job at a time.
- Never weaken an oracle, fabricate or guess rows, or substitute one comparison for another. A recording that lacks the data gets reported as such, never padded. A task's declaration states only what its instruction says. Changing a task's wording or oracle requires the lead's approval; propose the exact change instead.
- Model guidance never mirrors a scenario. Per-task declarations are test fixtures, not model guidance.
- Use the ten realistic scenarios only. Browsers, if any, are visible and provider-free. No provider or paid calls, no git mutations, no `node -e`, no timeout changes. Never print recorded page data, tokens or secrets; report counts and field names.
- Owned: everything in the two t990 trees except `docs/working/data-first-simplification-plan.md` and `docs/working/README.md`.
- Must not touch: other worktrees, the shared `fxwork/!FluxIQ`, the t959 campaign tree and other historical evidence (copy it into an ignored `test-runs/t990-*` directory first).

Report: `reports/t990-recorded-oracle.md`, with exact commands, per-task results and causes. End with the return contract.
