# `pnpm check` passes in a fresh tree (t1005)

Lead: Claude Code session, 2026-11-24. Tier: worker.
Workspace: `C:/Users/osrs_/FluxStuff/fxwork/t1005-check-build-order` (fresh worktree; the shared Core beside it is read-only).
Read: this brief; `docs/architecture/repository-layout.md` ("Commands"); the root and package `package.json` "check" scripts; `scripts/domain-dist.mjs` and the build-cache steps it uses.
Evidence: `C:/Users/osrs_/AppData/Local/Temp/claude/bc302d3e1bd85154/b9e846ce-920f-4917-ba85-cff713b3e423/scratchpad/sweep2/sweep1123b-down-check.log`. That is the second full sweep, run on a fresh tree with `pnpm check` before `pnpm build`. Every test passed, but the check failed with 35 `error TS`:
- apps/extension (22): `TS2307 Cannot find module '@fluxiq-web-extension/domain/node'` (first at `e2e/content/tests/offline-reads/tests/capture-snapshot.ts:12`), plus implicit-any errors that follow from it;
- packages/test-runner (9): `TS2307 Cannot find module '@fluxiq-web-extension/browser-host/reaper'` (first at `src/fluxnode-host-proof/engine.ts:7`), plus follow-on errors.

Hypothesis, not verified: these checks resolve subpath declarations from workspace packages' built `dist`, and their check preludes do not build those packages first. test-runner's prelude builds the domain dist but not browser-host; the extension's builds neither the domain `node` entry nor browser-host.

Goal: `pnpm check` passes in a fresh worktree with no prior build, and a check never resolves a stale or missing declaration.
1. Reproduce in this fresh tree: run `pnpm --filter @fluxiq-web-extension/test-runner check` and `pnpm --filter @fluxiq-web-extension/extension check` before any build, and confirm the errors match the sweep.
2. Find the cause and fix it at the check preludes, using the existing build-cache steps (the way `domain-dist.mjs` works), so each check builds exactly the workspace declarations it imports, cached. No new mechanism if one exists; never a type-ignore or `skipLibCheck` change.
3. Prove it from fresh: delete only this tree's own build outputs (`packages/browser-host/dist`, `domain/dist` or whatever the preludes build), then run both checks again, then `pnpm check` at the root. Report the exact `error TS` counts.
4. Run `node scripts/structure-audit.mjs` and the tests beside any script you change (`scripts/**/tests/`).

Rules:
- Every heavy command goes through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- <cmd>`, one at a time. A paid round is running on four other lanes; never touch them, `lab-slots/` or any Lab process.
- No git mutations, no `node -e`, no provider or paid calls, no browsers. Low free memory is not a reason to wait.
Owned: package `check` scripts and their prelude scripts under `scripts/`, those scripts' tests, `docs/architecture/repository-layout.md` if a command changes, and your brief and report.
Must not touch: product source, Core, other worktrees, `docs/working/data-first-simplification-plan.md`, `docs/working/README.md`.
Report: `docs/working/data-first-simplification-plan/reports/t1005-check-build-order.md`. End with the return contract.
