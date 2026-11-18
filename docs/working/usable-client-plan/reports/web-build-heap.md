# t951 web build heap (worker report)

## Outcome
Partial. Code change is complete; the heavy acceptance runs (install, libraries, web build, check, tests, audit) were NOT run because every heavy-slot request stayed queued (6th in queue behind two long-held slots) for the whole session.

## What changed and why
Cause, confirmed by reading (not reproducing): Next's `dist/lib/worker.js` (line ~76) builds the worker's `NODE_OPTIONS` from the parent's `NODE_OPTIONS`, so only that variable reaches the type-check worker; a flag on the parent node does not.

Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t951/!FluxIQ`:
- New `apps/web/scripts/next-build/`: `build-heap-mb.mjs` (the one value, 3584), `build-node-options.mjs` (appends the heap flag to any existing NODE_OPTIONS, keeps a caller-chosen `--max-old-space-size`), `run-next-build.mjs` (node launcher, spawns `next build --turbopack` with that env, cross-platform), `index.mjs`, `index.d.mts`, `tests/build-node-options.test.mjs`.
- `apps/web/package.json` build script and `scripts/build-cache/steps.mjs` `web:build` command: `next build --turbopack` replaced by `node scripts/next-build/run-next-build.mjs` (strings identical, as the registry test requires).
- `scripts/build-cache/tests/registry.test.mjs` line 202: regex updated to the new command (outside the owned list, but it asserts the old string and would fail).
- `deploy/docker/Dockerfile`: `RUN pnpm build` (the inline `NODE_OPTIONS=` removed); comment names the launcher and `BUILD_HEAP_MB`, so image and local share one value. Note: a caller-set NODE_OPTIONS heap still wins.
- `build-client-gateway-server.mjs` and `check-web-build.mjs` untouched; type checking and linting stay on.

## Commands run and observed results
- `node <scratch>/t951-probe.mjs` (imports the barrel, no heavy work) -> `["--max-old-space-size=3584","--trace-warnings --max-old-space-size=3584","--max-old-space-size=8192"]`.
- `node heavy-slot.mjs run t951-setup -- pnpm install --frozen-lockfile` (then libraries chain) -> still queued, no output when I stopped.

## Not verified
Everything in the acceptance list: web build exit 0 and "Linting and checking validity of types" / "One Core graph" / "Core trace" lines, vitest for the launcher test, `pnpm --filter @fluxiq/web check`, `node scripts/structure-audit.mjs`, the build-cache registry test. Possible structure-audit issue: `run-next-build.mjs` is an entry script not exported by the barrel (by design). Also: `scripts/web-build/build-attempt.mjs` runs `next build --turbopack` itself (staged build path) and does not use the launcher, so it still has the default heap; out of this brief's ownership.

## Open questions
Should the staged build in `scripts/web-build/build-attempt.mjs` take the same heap (import `buildNodeOptions`)? Recommended yes.

## Addendum after lead message
- `scripts/web-build/build-environment.mjs` (`isolatedBuildEnvironment`, used by `build-attempt.mjs`) now sets `NODE_OPTIONS: buildNodeOptions(base.NODE_OPTIONS)`, importing from `apps/web/scripts/next-build`, so the staged build gets the same 3584 MB heap (same cause, same value; env rather than the launcher because that call spawns Next's own executable). Not tested yet (not run).
- Gated chain script ready: `C:/Users/osrs_/AppData/Local/Temp/claude/bc302d3e1bd85154/c3e61aca-8771-4705-be3f-167ef5b2d3e3/scratchpad/t951-chain.sh` (needs `OUT` set to a log dir); run as `node heavy-slot.mjs run t951-chain -- bash <script>` after `t951-setup` (pid 11560, still queued, 7 entries in queue, 2 slots held) finishes.
- My Monitor waits returned without real time passing (clock advanced seconds), so I could not actually wait out the queue within this session. Acceptance outputs are therefore still missing.
