# F23: a saved Flow's replay loses the same click target every attempt (t995)

Lead: Claude Code session, 2026-11-23. Tier: worker-heavy.
Trees: `C:/Users/osrs_/FluxStuff/fxwork/t995/!FluxIQ` (Core task branch) and `t995/!FluxIQWebExtension`.
Read: this brief; F23 in `C:/Users/osrs_/FluxStuff/fxwork/t959/!FluxIQWebExtension/docs/working/mvp-launch-plan/reports/live-campaign-2026-11-19/results.md` (line ~428, read-only); `docs/working/data-first-simplification-plan/reports/t985-replay.md` ("Lead screened F23 artifact inspection") and `t985-replay-discovery.md` in this tree; AGENTS.md rules "Every node retries automatically" and "A stale target is found again from the step that found it".

Finding: run-mwov0vf8-41ab862a, company-website-saturday-certificate, a long calendar scan.
- In attempts 2-4 the saved Flow replayed the navigate, tab and two clicks.
- Then `dom-click` node `main.s5` failed `web.target.not_found` three times and ended `executor.target.gone` (steps 0245-0249, 0363, 0428).
- Each attempt repaired live (44, 24 and 40 decisions), but the same step broke on the next replay.
- Digests show attempts 2 and 4 saved changed Flows, so "nothing persisted" is false. What a repair saved did not fix `main.s5`.

Goal: the exact cause, proven provider-free, then the root fix. Answer two questions:
- (a) Why is a control that is still on the page concluded gone, rather than refound from its source step or by identity?
- (b) Why did no accepted repair make the saved `main.s5` work on the next replay?

Steps:
1. Reconstruct from the screened metadata: the step meta, `attempt.json` and the saved Flow digests under the t959/t960 campaign trees and `C:/Users/osrs_/FluxStuff/lab-runs/`. Copy them into an ignored `test-runs/t995-*` directory first. Never print recorded page data, and report field names and counts only. Establish which reacquire branch ran (source-lineage, source-less or unbound) and its exact gone/unavailable reason.
2. Build a provider-free reproduction on the product path, as new test files in the owning `tests/` folders, covering:
   - a control whose handle changed but whose identity holds in the same proven frame;
   - the source-lineage and source-less variants;
   - the negative cases: a control truly gone, the wrong frame, and incomplete observation.
3. Trace an accepted repair of a click step from incident repair into the candidate draft, through save and reload, to the next replay. Show where the repaired target is lost, or why the repair never targets `main.s5`. Temporary per-arrival overlays must stay temporary; a durable repair goes through the authoring amendment path with its validation and lineage.
4. Fix the cause in owned paths, then rerun.

Owned, product and tests:
- Core `packages/fluxiq/src/engine/automation/target-reacquire/**`, `engine/automation/unbound-reacquire/**` and `engine/automation/step-loop/incident-repair.ts`;
- downstream `domain/src/runtime/target-reacquire/**`;
- your brief and report.

Must not touch:
- Core `framework/automation-service/service/answer-first/**`, owned by lane t994 until it lands. If the fix belongs there (for example `attempt/draft-save.ts` or `task-memory`), write the exact change in your report instead, and the lead will schedule it.
- `packages/contracts/**` (t993), other worktrees, the shared `fxwork/!FluxIQ`, `docs/working/data-first-simplification-plan.md` and `docs/working/README.md`.

Checks, through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- <cmd>`, one at a time:
- Core vitest on named files with `--maxWorkers=1 --minWorkers=1 --fileParallelism=false`;
- `pnpm --filter fluxiq check` if you changed Core;
- `DOMAIN_TEST_BUILD_LABEL=t995 node scripts/test-domain.mjs <fragments>` (from `domain/`) and the domain check if you changed the domain;
- both structure audits.

No full suites, no git mutations, no `node -e`, no provider or paid calls, no browser. Model guidance never mirrors a realistic scenario. Never cap a symptom: no extra retries, no longer waits.

Report: `reports/t995-f23-replay-target.md`, covering the cause for (a) and (b) with evidence, the fix or the exact proposed change in t994's area, and the commands with observed counts. End with the return contract.
