# w2-lab-pair: an isolated checkout pair for live Lab campaigns

## Outcome

Done, with one deviation from the brief: the script lives at
`scripts/lab/pair.mjs` (logic in `scripts/lab/pair/`), not at
`scripts/lab-pair.mjs`. The command is still `pnpm lab:pair --ext <rev> --core <rev>`.
Reason: the structure audit already records `scripts/` at 32 files against a
limit of 25, and that figure can only go down. A 33rd file at `scripts/` root
would fail `pnpm check`. The new location follows the existing
`scripts/lab/live-campaign.mjs` + `live-campaign/` pattern, and its tests are
picked up by the existing `pnpm lab:test` glob, so `pnpm check` enforces them.

The pair is in place and proven with non-live runs:

| Side | Path | Commit | State |
| --- | --- | --- | --- |
| Extension | `F:\fxlab\lab-ext` (new worktree of this repo, detached) | `79839f4` | clean, installed |
| Core | `F:\fxlab\!FluxIQ` (existing worktree, moved from `54ae663`) | `42bd90a` | clean, installed, packages built |

`F:\fxlab\lab-core` was not touched (still `8409ca2`), and neither were the old
`fxlab-*` worktrees.

## The campaign command to use from the pair

```bash
cd 'F:/fxlab/lab-ext'
export FLUXIQ_CORE_ROOT='F:/fxlab/!FluxIQ' FLUXIQ_TEST_ENV_FILES='none' FLUXIQ_LAB_INSTANCE='lab-pair' npm_config_workspace_concurrency='1'
node 'F:/fxlab/lab-ext/scripts/lab/live-campaign.mjs' --all --max-attempts 4 -- --llm-max-calls 26 --llm-max-cost-usd 0.25 --llm-max-input-tokens 42000 --llm-max-output-tokens 8000 --llm-max-total-tokens 50000 --llm-max-run-tokens 600000
```

The Lab options after `--` are the ones the campaign running now from
`F:\!FluxIQWebExtension` uses (read from its process command line). Summary:
`F:\fxlab\lab-ext\test-runs\instances\lab-pair\campaigns\<stamp>\summary.md`.

**Before the first live campaign, the provider key has to reach the pair.**
Today `DEEPSEEK_API_KEY` is not reachable from it: the Lab reads it from the
process environment, or from `.env` / `.env.local` in the checkout the run
starts from, and `F:\fxlab\lab-ext` has neither. There are two ways to fix it:

1. Export `DEEPSEEK_API_KEY` in the shell that starts the campaign.
2. Recommended: copy `F:\!FluxIQWebExtension\.env.local` to
   `F:\fxlab\lab-ext\.env.local`. Git ignores that file, so the pair stays
   clean, and with `FLUXIQ_TEST_ENV_FILES=none` the Lab takes only that one
   name from it.

I did neither, because the brief does not cover moving a secret.
`pnpm lab:pair` reports which applies, by source and never by value.

Start the campaign by absolute path as above, not as `pnpm lab:campaign`.
`pnpm lab:campaign` shows in the process list only as
`node scripts/lab/live-campaign.mjs`, which names no checkout. Between two tasks,
`pnpm lab:pair` would then see nothing running and could move the pair under
the campaign. Both scripts resolve every path from their own location, so the
absolute form works from any directory; run 4 below used it from `C:/`.

## How Lab instances are selected (brief step 3)

- `FLUXIQ_LAB_INSTANCE` (lowercase kebab-case, at most 64 characters) is the
  only instance selector (`scripts/lab/lab-instance.mjs`). It moves the
  extension build, the scenario lab and the host bundle into
  `<package>/.lab-instances/<label>/`, and run evidence into
  `test-runs/instances/<label>/`.
- **All of those paths, and the build lock (`.lab-locks/`), are relative to
  the checkout the Lab runs from.** A run from `F:\fxlab\lab-ext` cannot write
  anything under `F:\!FluxIQWebExtension`, whatever the label. The web panel's
  production build cache and its lock are under the runs directory, so they
  are per checkout as well.
- **There is no port setting.** Loopback ports are allocated ephemerally per run
  (runs 1 to 4 used 50901-50903 and similar), so the pair and the main campaign
  do not collide on ports.
- **A label is still required in the pair.** Without one, the extension build
  rewrites the tracked `apps/extension/build/`, the pair becomes dirty, and
  the next `pnpm lab:pair` refuses. I used `lab-pair`, which is the script's
  default.
- The only machine-wide shared Lab state is
  `%TEMP%\fluxiq-testing-lab-machine-slots`, and only sharded `bench` uses it
  (on purpose, as a memory budget). `lab run` and `lab:campaign` do not use it.

## What changed and why

- `F:\fxlab\!FluxIQ`: `git checkout --detach 42bd90a` (it was clean;
  `git status --porcelain` printed 0 lines). The install was a no-op because
  the lockfile is identical at `54ae663` and `42bd90a`. Core's `contracts`,
  `fluxiq` and `client-gateway-websocket` packages were built. The Lab reads
  their `dist` (`packages/test-runner/src/core-web-build/inputs.ts`), and the
  `dist` there was built for `54ae663`. The brief did not list this step, but
  without it a run from the pair would load stale Core output.
- `F:\fxlab\lab-ext`: `git worktree add --detach F:/fxlab/lab-ext 79839f4`,
  then `pnpm install --frozen-lockfile --offline`.
- New `scripts/lab/pair.mjs` (entry point) and `scripts/lab/pair/`:
  - `arguments.mjs`: the command line.
  - `roots.mjs`: works out the Core side from the pair's own
    `domain/package.json` link. It refuses when the pair would be the checkout
    running the script, or when the pair's Core would be the working
    `F:\!FluxIQ`.
  - `side-state.mjs`, `git-command.mjs`, `markers.mjs`: read each side's
    HEAD, target, uncommitted and untracked files, the target lockfile, and
    what the pair last installed and built.
  - `move-plan.mjs`: decides checkout, install and build.
  - `process-list.mjs`, `processes-using-roots.mjs`: refuse while any process
    whose command line names a path inside either root is running, not
    counting this process and its parent processes.
  - `pnpm-command.mjs`: runs installs and builds, with child output sent to
    stderr.
  - `campaign-environment.mjs`, `provider-key.mjs`, `instructions.mjs`: what
    the script prints.
  - `command-line.mjs`: puts the steps together, Core first.
  - `path-identity.mjs`: compares paths without regard to case or slash
    direction on Windows.
  - `index.mjs`: the barrel.

  Behaviour:
  - Every refusal is decided before anything changes.
  - Installs use `--frozen-lockfile --config.confirm-modules-purge=false`,
    offline first, then online.
  - A side is installed only when the target lockfile differs from the one it
    last installed. Core is rebuilt when it was last built at another commit,
    when its `dist` is missing, or when `--build-core` is given.
  - Marker files in each worktree's ignored `node_modules`
    (`.lab-pair-installed-lock`, `.lab-pair-built-commit`) are cleared before
    their step and written only after it succeeds, so running an interrupted
    move again finishes it.
  - After moving, the script checks that `domain/node_modules/fluxiq` resolves
    into the pair's Core.
  - Provider secrets are removed from the environment of the install and build
    child processes.
- Tests: `scripts/lab/pair/tests/*.test.mjs`, 37 tests across 8 files. They
  cover arguments, roots, the move plan, the process filter, the environment
  and instructions, the provider-key lookup, markers, path identity, and side
  state against a throwaway git repository in the temp directory, with git's
  global and system config isolated.
- `package.json`: `"lab:pair": "node scripts/lab/pair.mjs"` (one line).
- `docs/architecture/repository-layout.md`: new subsection "A Checkout Pair
  For Campaigns" under "Running Several Labs At Once". It has no links, so the
  docs-links rule has nothing new to resolve.

## Commands run and observed results

- `git -C F:/fxlab/!FluxIQ status --porcelain | wc -l` -> `0`, then the
  checkout -> `HEAD is now at 42bd90a`.
- Core `pnpm install --frozen-lockfile --offline` -> "Already up to date",
  exit 0. The Core package builds (contracts, fluxiq,
  client-gateway-websocket) -> exit 0.
- Extension worktree add -> `HEAD is now at 79839f4`. Its install (offline) ->
  exit 0. `realpathSync` gives `domain/node_modules/fluxiq ->
  F:\fxlab\!FluxIQ\packages\fluxiq` and `@fluxiq/client-gateway-websocket ->
  F:\fxlab\!FluxIQ\packages\client-gateway-websocket`.
- **Run 1** (from `F:\fxlab\lab-ext`, `FLUXIQ_TEST_ENV_FILES=none
  FLUXIQ_CORE_ROOT=F:/fxlab/!FluxIQ npm_config_workspace_concurrency=1
  FLUXIQ_LAB_INSTANCE=lab-pair pnpm lab run basic-form --target isolated`)
  -> `run-mu4xja1g-acac85a7`, verdict `passed`, 58.5 s, `llm.mode`
  `disabled`, 0 calls. `run.json` records the facility as
  `F:\fxlab\lab-ext@79839f4` and Core as `F:\fxlab\!FluxIQ@42bd90a`.
  Afterwards both worktrees had 0 porcelain lines.
- **Run 2** (same command, started so that a pair-script call could overlap
  it) -> failed:
  `{"status":"failed","category":"unknown","message":"Scenario attempt failed outside a finalized bundle"}`.
  The staging events show `locator.waitFor: Target page, context or browser
  has been closed` at the `choose-plan` step, about 5 s into the scenario. The
  overlapping `pnpm lab:pair --dry-run` ran during that run's build phase and
  only reads, and Lab cleanup kills only its own process trees (by process
  id). Each run gets its own browser profile (under its run directory), and
  the main campaign was running on the same machine. **This is one
  observation that did not reproduce, most likely a browser crash under
  memory pressure (the known RAM fault). The cause is not proven.**
- **Run 3** (rerun alone, by absolute path) -> `run-mu4xwvs5-792095ed`,
  `passed`.
- `node --test "scripts/lab/pair/tests/*.test.mjs"` -> `tests 37, pass 37,
  fail 0`. `pnpm lab:test` -> 67 tests, 67 pass, and the pair tests are among
  them.
- `node scripts/structure-audit.mjs` (in `F:\!FluxIQWebExtension`) -> exit 1
  with exactly one violation:
  `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks`.
  No finding names any new file. **This failure predates my work:** the same
  audit run inside the clean `F:\fxlab\lab-ext` (HEAD `79839f4`, no changes)
  prints the same single violation. The supervisor should run
  `pnpm structure:baseline`; it regenerates the shared index, which I may not
  edit.
- Pair script against the real pair:
  - `--dry-run` -> `planned`, and correctly plans the first install and Core
    build, because no markers existed yet.
  - The same `--dry-run` while run 2 was in flight -> exit 1, `1 running
    process(es) are working inside the pair, e.g. node.exe (pid 2252)`.
  - `--ext 79839f4 --core 42bd90a` -> exit 0. It installed Core (offline),
    built the 3 Core packages, installed the extension side (offline),
    reported `linked ... -> F:\fxlab\!FluxIQ\packages\fluxiq`, and returned
    `ready`.
  - The same command again -> both sides
    `checkout:false, install:false, build:false`.
  - `--ext 79839f4~1`, then `--ext 79839f4` -> checked out `269e351` and then
    back to `79839f4`. The lockfile was unchanged, so nothing was installed.
  - `--core no-such-rev` -> exit 1,
    `The core revision "no-such-rev" does not name a commit in F:\fxlab\!FluxIQ`.
  - With an untracked probe file in `lab-ext`, `--core 42bd90a --build-core`
    -> exit 1,
    `The ext worktree F:\fxlab\lab-ext has 1 uncommitted or untracked change(s) (?? w2-lab-pair-probe.txt)`.
    The probe was then removed.
  - `--ext-root F:/!FluxIQWebExtension` -> refused as the checkout running the
    script.
  - `pnpm -s lab:pair --help`, `pnpm -s lab:pair --dry-run` and
    `pnpm -s lab:pair -- --ext 79839f4 --dry-run` -> arguments reach the
    script.
- **Run 4** (after the script rebuilt Core; started from `C:/` as
  `node F:/fxlab/lab-ext/scripts/lab/run-lab.mjs run basic-form --target isolated`
  with the printed environment) -> `run-mu4y0ebh-8ed3b5ab`, `passed`, llm
  `disabled`, 0 calls. `run.json` records `F:\fxlab\lab-ext 79839f4` and
  `F:\fxlab\!FluxIQ 42bd90a`. Final pair state: both sides have 0 porcelain
  lines, at `79839f4` / `42bd90a`.

## Not verified

- No live campaign or provider call was run from the pair; the brief forbids
  it. Before the first one, the provider key has to reach the pair (see
  above).
- The online fallback install never ran, because every offline install
  succeeded.
- The non-Windows process listing (`ps -Ao pid=,ppid=,args=`) has not been
  run; only the Windows `Get-CimInstance` path was exercised.
- The process check misses a campaign started as `pnpm lab:campaign` from
  inside the pair while it is between tasks. The printed commands avoid this
  by using absolute paths, but nothing enforces it.
- The cause of run 2's failure is not proven; see above.
- `pnpm check`, `pnpm test` and `pnpm build` were not run in full. The checks
  that cover the new code are `pnpm lab:test` and the structure audit, and
  both were run.

## Open questions or contradictions found

- The brief named `scripts\lab-pair.mjs`, but a new file at `scripts/` root
  would fail the ratcheted `directory-files` budget (32 recorded, limit 25). I
  resolved this by placing the script under `scripts/lab/`, as described
  above.
- The brief's step 4 said "install only when the lockfile changed", but a Lab
  run also needs Core's packages rebuilt whenever Core moves, or it loads stale
  `dist`. The script adds that build step. The extension side needs no build,
  because the Lab rebuilds it on every run.
- `docs/working/README.md` is stale at the committed HEAD `79839f4` (see the
  audit result above). Because of this, `pnpm check` fails today regardless of
  this work.
- While I worked, the main Core checkout `F:\!FluxIQ` moved from `42bd90a` to
  `8329477` on `dev` through another agent's commit. The pair stays at
  `42bd90a`, as briefed. To follow the new commit, run
  `pnpm lab:pair --core dev`.
