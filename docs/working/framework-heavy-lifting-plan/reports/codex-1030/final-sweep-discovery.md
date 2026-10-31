# Final sweep discovery (2026-10-30)

## Recommended sweep

After every active source unit is merged and frozen, use detached worktrees at captured `dev` SHAs, under the existing heavy-check lock `C:/Users/osrs_/FluxStuff/lab-slots/heavy-check.lock`. Keep logs under a new, dated `lab-runs/2026-10-30/sweep-2/` directory and record both SHAs before starting. The first sweep today already passed and promoted both `main` branches; the repository limit is two full sweeps per local day, leaving at most one further sweep today.

Run sequentially, as in the prior sweep script:

| Working directory | Command |
| --- | --- |
| `fxwork/<sweep>/!FluxIQ` | `pnpm install --frozen-lockfile` |
| same | `pnpm build` |
| same | `pnpm check` |
| same | `pnpm test` |
| `fxwork/<sweep>/!FluxIQWebExtension` | `pnpm install --frozen-lockfile` |
| same | `pnpm build` |
| same | `pnpm check` |
| same | `pnpm test` |

The prior exact orchestration is in the historical `sweep-1030a.sh`; it waits for the lock, snapshots both `dev` heads, creates detached worktrees, logs each exit code, and executes the commands above in this order. It copied downstream `.env.local` into the worktree. Standard task provisioning likewise makes this temporary copy; remove the newly copied file before any checks/tests/builds. Do not print environment values. The full `pnpm test` scripts do not launch the Lab or live model runs; the Lab's documented `FLUXIQ_TEST_ENV_FILES=none` setting applies when launching a Lab pair, not as a needed full-sweep flag.

## Isolation and safety evidence

- `docs/architecture/repository-layout.md` documents the workspace commands and notes that `pnpm check` runs the Core freshness guard, static checks, structure audit, and package checks. Tests are not cached. The sweep script's detached worktrees keep later `dev` merges from changing the tested sources.
- Core `packages/fluxiq/vitest.config.ts` plus `tests/test-groups.ts` show that `pnpm test` uses the grouped runner: ordinary tests first, then explicitly marked real-SQL tests with at most three workers. Use `pnpm test`, not an improvised plain Vitest invocation.
- Core `scripts/web-build/build-environment.mjs` assigns staged panel builds an attempt-local FluxIQ root/data directory and disables the client gateway. This is the web build's isolation. The build is staged and keyed by `scripts/web-build/prepare-web-build.mjs`.
- Downstream `scripts/provider-secret-environment.mjs` exports the canonical provider-key filter used by selected test/demo launchers. The workspace full-suite scripts do not call that filter globally. No `.env.local` copy is needed; avoid sourcing repository env files. This discovery did not execute suites or audit every individual test's filesystem behavior.
- Existing full-sweep history in `docs/working/trace-offline-trials-plan.md`: 2026-10-30 first sweep is green and both `main` branches were fast-forward promoted at Core `bcbcfa97` and downstream `ee5768d5`; 2026-10-29 used two sweeps, with a first downstream timing failure fixed before the green second sweep. Promotion requires a green full sweep on the exact swept commits; promotion is fast-forward only and both repositories move together.

## Validation limits

Read-only discovery only. No commands, tests, builds, or model/provider calls were run. The sweep executes the four documented package commands per repository and has not been independently reviewed for every test's possible external side effect. If promotion is desired after a green sweep, first confirm the swept `dev` heads and `main` ancestry, then use the repository's fast-forward-only promotion procedure; do not promote a different commit than the one swept.

Outcome: Done
Changed: `docs/working/framework-heavy-lifting-plan/reports/codex-1030/final-sweep-discovery.md`
Validation: Read-only inspection; no checks/builds/tests run by brief.
Not verified: Individual test side effects and current git ancestry/head state.
Report: `docs/working/framework-heavy-lifting-plan/reports/codex-1030/final-sweep-discovery.md`
Notes: Historical sweep script copied `.env.local`; omit that operation for the final sweep.

## Follow-up: task tooling suitability (read-only)

`pnpm.cmd task start completion-sweep --core --worktree` creates both task branches/worktrees and builds them with an environment passed through `withoutProviderSecrets`, which strips recognized provider-key variables from child processes; after that, it explicitly calls `copyEnvLocal` from the primary downstream checkout into the new downstream worktree. `scripts/worktree/env-local.mjs` copies the ignored file byte-for-byte and never prints its contents. The standard workflow permits removing this newly copied file from the disposable worktree before any sweep checks; no source/tool change is needed. (The Core side does not receive a copy.)

Abandon is structurally able to remove a paired task's two unmodified worktrees and local branches: `scripts/task/abandon.mjs` counts commits on both sides and, when both have zero unmerged commits, removes the Core worktree/branch then the downstream worktree/branch. It does not require `--force` at zero commits. `scripts/worktree/remove.mjs` refuses removal if ordinary uncommitted/untracked files exist or a process is working under the tree; ignored build output and copied `.env.local` are not covered by `git status --porcelain --untracked-files=normal`, but are removed with the worktree directory. This makes cleanup suitable for disposable worktrees only if no unique ignored user data is placed there and no tests/processes remain. Branch/task IDs remain spent; `abandon --dry-run` previews counts/roots without deleting. No start/abandon command was run.

Evidence: `scripts/task/start.mjs`, `scripts/task/abandon.mjs`, `scripts/worktree/create.mjs`, `scripts/worktree/env-local.mjs`, and `scripts/worktree/remove.mjs`. No credential values were read or printed.

## Follow-up: Core root and web-build isolation

Clearing inherited `FLUXIQ_*` values leaves the Core framework's default root at the process working directory (`packages/fluxiq/src/framework/index.ts`, constructor: `FLUXIQ_ROOT` or `process.cwd()`). Its default data and database locations, plus `.fluxiq` config, logs, temp, artifacts and cache, resolve under that root; storage override variables include `FLUXIQ_DATA_DIR` and `FLUXIQ_DATABASES_DIR`, and clearing them prevents external path overrides. Core package tests therefore default inside their task worktree.

Core `apps/web` has an additional guard: `resolveFluxIQWebHostRoot()` uses the first nonempty of `FLUXIQ_IMPORTER_ROOT`, `FLUXIQ_HOST_ROOT`, `FLUXIQ_ROOT`, but refuses to use the Core source checkout as runtime root. For a Core full suite, set the existing `FLUXIQ_IMPORTER_ROOT` to a fresh directory inside the Core task worktree (for example `<Core task worktree>/.sweep-runtime`) before `pnpm test`; with `FLUXIQ_DATA_DIR` and other storage overrides cleared, data stays beneath it. `FLUXIQ_HOST_MODULE` is a separate optional external module path; clear it so tests cannot load a host module from the user's checkout. `FLUXIQ_MODEL_PROVIDERS_ENABLED` defaults to enabled in the web app, so set it explicitly to `false` in the sweep child environment; Core `FluxIQ` itself defaults model providers enabled unless its caller passes false. Also set `FLUXIQ_CLIENT_GATEWAY_ENABLED=false` to keep a web runtime from binding the default local gateway.

The production web build already isolates itself: `scripts/web-build/build-environment.mjs` sets `FLUXIQ_ROOT`, `FLUXIQ_IMPORTER_ROOT`, and `FLUXIQ_HOST_ROOT` to the attempt's own `fluxiq-root`; it sets `FLUXIQ_DATA_DIR` and `FLUXIQ_DATABASES_DIR` to that root's `.fluxiq`, and disables the gateway. Core Next build staging is distinct from `pnpm test` and uses that generated environment. For the downstream suite, clear inherited `FLUXIQ_*` and provider-secret variables too, and remove the task-start copied `.env.local` before any checks/tests/builds; the downstream extension does not need a runtime `.fluxiq` root for these commands. These are settings for the child sweep process only; no ambient values should be logged.

Evidence: Core `packages/fluxiq/src/framework/index.ts`, `apps/web/src/lib/fluxiq.ts`, `apps/web/src/lib/model-provider-admission/resolve.ts`, `scripts/web-build/build-environment.mjs`, and downstream `scripts/provider-secret-environment.mjs`. No build/test or runtime behavior was exercised.

## Lead execution decision

Use the prescribed task tooling, remove its newly created disposable env-file copy before checks, and preserve the main file. Strip provider keys and inherited FLUXIQ_* values from children, then set only the three root variables to a fresh ignored runtime directory. Let unit fixtures control model/gateway admission flags so default-behavior tests retain their normal inputs; no actual credentials or user state will be supplied. The web production build already applies its own disabled-gateway/provider isolation. No sweep has run yet.
