# t187-history: when each costly build step was added

Worker report. Read-only: git commands only, against `dev` in both repositories (downstream head `af6ae049`, Core head `528f52db`). Nothing was built, checked out or edited.

## Outcome

Done. Every step named in the brief is traced to the commit that added it. The growth table is below, followed by a conclusion.

## What changed and why

Only this report file was written.

### Downstream (`!FluxIQWebExtension`)

| # | Step | Commit | Date | Subject | What it added | Reason stated? |
|---|---|---|---|---|---|---|
| 1a | test-runner `build` = `pnpm domain:dist && pnpm clean && tsc` | `1b6f5dff` | 2026-09-12 | Make the benchmark honest, and stop the resolver clicking the wrong button | Prefixed `pnpm domain:dist`, which builds the domain if `domain/dist/index.d.ts` is missing | Not for this line |
| 1a | ... `pnpm clean` added | `1c5c7adc` | 2026-09-21 | Clear test-runner's dist before each build and fix two stale tests | `clean` script; dist is wiped before every tsc, so each build is a full rebuild | Yes: deleted and moved tests kept running from a stale dist (t027) |
| 1b | domain `build` = `node scripts/clean-dist.mjs && tsc && rewrite-dist-specifiers` | `11d2ed32` | 2026-09-12 | Level 2 target scoring, and a domain package Node can consume | Clean-then-compile, plus a specifier rewrite pass | Yes, implicitly: a dist that Node can consume |
| 2a | extension `build` = `tsc -p tsconfig.json --noEmit && node scripts/build-extension.mjs` | `08b23462` | 2026-08-01 | Extension UI updates, added websocket typed client package... | A full type check before every esbuild bundle | No body. The step is old; its cost grows with the file count (extension src went from 301 to 508 files between 09-22 and 09-29) |
| 2b | `test:e2e:build` = `pnpm build` | `5e9d97e7` | 2026-09-04 | testing facility that can automatically operate the fluxiq and extension... | So every e2e or Lab build also runs the full tsc check | No body |
| 3 | scenario-lab `build` = `pnpm --filter test-contracts build && node scripts/build-scenario-lab.mjs` | `f205e0db` | 2026-09-22 | Build the contracts before the scenarios that are typed by them | test-contracts is now built inside scenario-lab's build, and built again by run-lab's `test-runner...` filter | Yes: a stale contracts dist broke a worktree build, cost one live run and blocked two campaigns |
| 4 | `node scripts/structure-audit.mjs` in `check` | `6554d453` | 2026-09-10 | Adopt Core's structure audit and wire it into pnpm check | The audit runs first in `pnpm check` | Yes: freeze the size and placement budgets |
| 4 | `pnpm structure:test` in `check` | `70e03aa3` | 2026-09-10 | Relocate every co-located test into a tests/ subfolder | node --test over the audit's rule tests | Yes, as part of the test-placement move |
| 4 | `pnpm lab:test` in `check` | `ab736a1e` | 2026-09-12 | Live validation: what the green gates were actually measuring | node --test over `scripts/lab/**/tests` | Yes, broadly: the gates were measuring the wrong thing |
| 4 | `pnpm task:test` in `check` (task + worktree tests) | `22c39751` | 2026-09-17 | Give a unit of work its own branch, and a worktree when it needs one | node --test over `scripts/task` and `scripts/worktree` tests | Yes: the worktree rationale |
| 4 | `scripts/structure-audit.mjs` mirror | `6554d453`, then `f8885b82` (09-11) and `79839f43` (09-16) | Sep | 3 commits in total | Byte-for-byte mirror of Core's audit | Yes |
| 5a | `task start`: `buildCore(...)` for a new worktree | `22c39751` | 2026-09-17 | (as above) | Builds the Core packages in the worktree's Core | Yes |
| 5a | `task start`: `runPnpm(created.root, ["build"])` (full workspace build) | `ba54eff3` | 2026-09-17 | Build the workspace when provisioning a worktree, not only Core | `pnpm -r build` of every workspace package on each worktree start | Yes, with a measurement: 16.5 s; about 45 s for a first worktree and about 21 s for one sharing Core |
| 5a | `buildCore` made conditional (`coreCreated \|\| !built`) | `014f2de3` | 2026-09-18 | Keep the shared Core current, and stop its build breaking on path length | Skips the Core build when it is already built. `buildCore` runs `pnpm --filter <pkg> build` for each Core package (`scripts/worktree/core-build.mjs`) | Yes |
| 5b | `task finish`: `pnpm check` with `npm_config_workspace_concurrency=1` | `22c39751` | 2026-09-17 | (as above) | A full check on every finish, run serially across workspace packages | Yes, as part of the lifecycle design |
| 6 | run-lab builds: `scenario-lab build`, `extension test:e2e:build`, `domain host:build` (interactive or instanced only), `test-runner... build` | `ab736a1e` | 2026-09-12 | (as above) | Four builds before every Lab run. `test-runner...` rebuilds all of its dependencies, so domain and test-contracts are rebuilt again, and the extension build runs its tsc check | Broadly |
| 6 | Core quiet-wait guard (`DEFAULT_QUIET_MS`) | `ab736a1e`; moved by `ea8f3e9c` (09-17) | 2026-09-12 | | Waits until Core's dist has been quiet for a period | Yes: a rebuild under a run deletes modules the run imports |
| 6 | Core build staleness guard (`coreBuildStaleness`, which scans Core's source tree) | `407e1d9b` | 2026-09-17 | Refuse a Lab run against a Core build older than Core's source | Refuses the run; does not rebuild | Yes: three campaign slices ran on a stale Core |
| 6 | Core commit guard (`coreCommitStaleness`) | `014f2de3` | 2026-09-18 | (as above) | Refuses a Core that is behind dev | Yes: a token-ceiling mismatch |
| 6 | Own-build staleness (`staleRepositoryBuild`: domain/dist and extension build) | `56717802` | 2026-09-25 | A run refuses to start against this repository's own stale build | Refuses the run; does not rebuild | Yes |
| 6 | Never-built Core guard | `d9534dc5` | 2026-09-28 | The Lab refuses a Core that was never built, and CI builds it | Refuses the run; CI builds Core | Yes |
| 7 | `packages/test-runner/src/core-web-build/` (`next build` cached per key) | `878fbd5c` | 2026-09-14 | Serve the Lab's isolated Core from a cached production build | Replaced `next dev` with `next start` over a production build. It builds once for each key | Yes: `next dev` compile stalls hit readiness timeouts |
| 7 | `coreHead` in the key | `878fbd5c` (in the key from the start) | 2026-09-14 | | The key covers Core HEAD, the web source hash, the built Core package dist hashes, the Next config and the Next version (`key.ts`) | The message lists the inputs but gives no reason for HEAD. Any Core commit, even a docs-only one, invalidates the cached `next build` |
| 7 | Later changes | `014f2de3` (09-18), `03537846` (09-18) Build Core's web panel outside node_modules... | | | Build location and path-length fixes | Yes |

### Core (`!FluxIQ`)

| # | Step | Commit | Date | Subject | Notes |
|---|---|---|---|---|---|
| 8 | `tsc -b tsconfig.build.json --clean && tsc -b tsconfig.build.json && rewrite-declaration-imports` in contracts, fluxiq and client-gateway-websocket | `6368574` | 2026-08-06 | Did first 4 points of refactoring plan. Save before continuing | No body, so no reason given. `--clean` removes the `.tsbuildinfo` and outputs, so every package build is a full rebuild. This is old, but its cost scales with `packages/fluxiq/src`, which grew from 386 to 1479 files between 09-08 and 09-29 |
| 8 | `@fluxiq/web build` in the root `build` | `6368574` | 2026-08-06 | (same) | |
| 8 | `next build --turbopack` in apps/web | `a99b984` | 2026-07-26 | first real commit | Present from the start |
| 9 | `pnpm structure:test` in `check` | `05bfee7` | 2026-09-10 | Relocate every co-located test into a tests/ subfolder | |
| 9 | `node scripts/structure-audit.mjs` in `check` | `df2d91c` | 2026-09-10 | Enforce file, directory, and class size budgets | `864d419` (09-15) also routes `docs:check` through the audit's `docs-links` rule |
| 9 | `pnpm task:test` in `check` | `e9c26b1` | 2026-09-17 | Give Core the task lifecycle, and the rules that go with it | |
| 9 | `pnpm -r check` | `a99b984` | 2026-07-26 | first real commit | |
| 9 | Audit rule growth | 13 commits touch `scripts/structure-audit/rules`, all in 2026-09 | | | Rule files: 8 on 09-10, 14 on 09-17, 14 on 09-24, 14 on 09-29. The audit directory: 14 files, then 34, 34, 34. It grew in the week of 09-10 to 09-17 and has been flat since |

### Growth at weekly dev heads (from `git ls-tree -r --name-only`)

Downstream. The test globs are those in the root `package.json`.

| date | commit | domain/src .ts | apps/*/src .ts | packages/*/src .ts | lab:test files | task:test files | structure:test files | all *.test.* files |
|---|---|---|---|---|---|---|---|---|
| 2026-08-18 | e2d96977 | 24 | 11 | 0 | 0 | 0 | 0 | 2 |
| 2026-08-25 | 5042df98 | 40 | 20 | 0 | 0 | 0 | 0 | 2 |
| 2026-09-01 | 5042df98 | 40 | 20 | 0 | 0 | 0 | 0 | 2 |
| 2026-09-08 | 488bb66f | 40 | 43 | 123 | 0 | 0 | 0 | 57 |
| 2026-09-15 | 7f873ffd | 171 | 433 | 400 | 2 | 0 | 7 | 400 |
| 2026-09-22 | 15c26867 | 252 | 1126 | 558 | 22 | 23 | 11 | 520 |
| 2026-09-29 | af6ae049 | 287 | 1340 | 685 | 25 | 24 | 11 | 652 |

Per package on 09-29 (09-22 in brackets): scenario-lab 832 (825), test-runner 623 (501), extension 508 (301), test-contracts 28 (23).

Core:

| date | commit | packages/fluxiq/src .ts | all packages/*/src .ts | apps/web .ts/.tsx | structure:test files | task:test files |
|---|---|---|---|---|---|---|
| 2026-08-18 | 07f40e37 | 254 | 265 | 90 | 0 | 0 |
| 2026-08-25 | 01a9138c | 291 | 302 | 94 | 0 | 0 |
| 2026-09-01 | b24050eb | 358 | 369 | 678 | 0 | 0 |
| 2026-09-08 | 5361951a | 386 | 397 | 772 | 0 | 0 |
| 2026-09-15 | a013a0da | 764 | 801 | 852 | 7 | 0 |
| 2026-09-22 | 8b145c77 | 1150 | 1187 | 887 | 11 | 3 |
| 2026-09-29 | 528f52db | 1479 | 1516 | 961 | 11 | 3 |

### Conclusion

The largest factor is source growth combined with builds that cannot be incremental. Core's `packages/fluxiq/src` nearly quadrupled in three weeks, from 386 to 1479 files. Downstream `apps` plus `packages` went from 166 to 2025 files. Core's `tsc -b --clean && tsc -b` (`6368574`) and the downstream clean-first builds (`11d2ed32` for domain, `1c5c7adc` for test-runner on 09-21) throw away incremental state, so every build pays for that full growth.

Redundant rebuilds were layered on in September:
- `ab736a1e` (09-12) makes run-lab build scenario-lab, the extension, the domain host and `test-runner...` on every run.
- The extension step type-checks everything again (`tsc --noEmit`, from `08b23462` through `5e9d97e7`'s `test:e2e:build = pnpm build`).
- `f205e0db` (09-22) builds test-contracts a second time inside scenario-lab's build.
- `ba54eff3` (09-17) adds a full `pnpm -r build` to every `task start`.
- `22c39751` adds a serial (`concurrency=1`) `pnpm check` to every `task finish`.

`878fbd5c` puts `coreHead` into the Lab's `next build` cache key. Since Core is committed many times a day, that cache almost never hits, and each run can pay for a fresh `next build`. The check-chain additions (structure audit, structure:test, lab:test and task:test, 09-10 to 09-17) are node --test over 11 to 25 files each, and the audit's rule count has been flat since 09-17. They are probably a minor part of the cost.

## Commands run and observed results

- `git show dev:<package.json>` for each build script in both repositories: the current scripts are quoted above.
- `git log dev --reverse -S'<string>' -- <file>` for each step: the commits are in the tables.
- `git log -1 --format=%b <commit>` for the reason given in each message.
- `git grep dev` on `scripts/task/start.mjs`, `finish.mjs`, `scripts/worktree/core-build.mjs`, `scripts/lab/run-lab.mjs` and `core-web-build/key.ts`.
- `git ls-tree -r --name-only $(git rev-list -1 --before=<date> dev)` at seven weekly points, counted with grep (the tables above).
- `git log dev --format=%ad --date=format:%Y-%m -- scripts/structure-audit/rules | uniq -c`: 13 commits in 2026-09 (Core).

## Not verified

- No timings were measured, because the brief said no builds. Where a cost appears above, it is inferred from structure or quoted from a commit message (`ba54eff3`'s 16.5 s).
- Did not confirm how often the core-web-build cache actually misses in practice (no run logs were read).
- The `-S` searches find when the exact string first appeared. An earlier equivalent written differently, such as an extension check before `08b23462`, could be missed.
- The week of 09-01 falls on the same downstream commit as 08-25; there were no commits to dev in that span.
- Core's `apps/web` count includes all `.ts`/`.tsx` files under `apps/web` and may include generated or config files.

## Open questions or contradictions found

- `coreHead` in the core-web-build key is redundant with `webSourceHash` plus `packageDistHashes`, if those cover every input. It may be the main cause of cache misses. The supervisor should decide whether removing it is safe.
- Core's `--clean` has no stated reason (`6368574` has no body).
- test-contracts is built twice per Lab run, by scenario-lab's own build (`f205e0db`) and by the `test-runner...` filter.
