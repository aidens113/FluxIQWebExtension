# Core-built precondition (worker report)

Closes audit "Open defects" 2, and 4 (the nightly cost). Defect 1 (the three missing CI values) remains the owner's action.

## Outcome

Done. The Lab now refuses an absent or incomplete Core build before anything runs, and reports the refusal as a setup failure. Every Core-using CI job installs and builds Core before its first use. The nightly `--repeat 3` is kept, and the workflow now states the runtime estimate. CI itself is unexercised.

Crash note: the machine crashed once mid-task, before any source edit. Afterwards every owned file was checked: all identical to HEAD, 0 NUL bytes, and line counts matching the pre-crash reads (run-lab.mjs 219, workflow 262). The final files were re-checked the same way: 0 NUL bytes, and `node --check` passes.

## What changed and why

**1. Lab precondition** (`scripts/lab/core/build/`, `scripts/lab/run-lab.mjs`)

- `entries.mjs` (new, `scanCoreBuildEntries`): for each Core `packages/*/package.json` that declares a `build` script, it lists the files promised by `exports`, `main`, `module`, `types` and `bin` (bare paths allowed for the last four), then stats each one.
  - Pattern exports are skipped, and a package naming no entry point is held to `dist`.
  - It also records whether Core's `node_modules` exists.
  - It is manifest-driven, so a new Core package is covered with no change here.
  - A missing `packages/` is reported as `packagesFound: false`. Other filesystem errors, and malformed JSON, throw with the file named. Nothing turns into a quiet pass.
- `unbuilt.mjs` (new, `coreBuildMissing`): a pure verdict, one of `built`, `not-found`, `unbuilt` or `incomplete`.
  - The message names the Core root, the first missing entry, and the command: Core's own `pnpm build`, or `pnpm install --frozen-lockfile && pnpm build` when Core has no `node_modules`.
  - It says "This is a setup failure, not a run result; nothing has been run."
- `run-lab.mjs`: the check runs after the quiescence wait (so a Core mid-rebuild is waited out, not refused) and before the staleness check.
  - On failure it emits `{"lab":"core-build","state":<state>,"failure":"setup",...,"why":<message>}`, writes the message, and exits 1 before any build, lock, browser or run.
  - It writes no `status/category` result line. The live campaign already treats a `why` line plus a non-zero exit as a task that "never started".
  - There is no override, unlike stale or behind: an unbuilt Core can only fail on "Cannot find module".
- `coreBuildStaleness`'s contract is unchanged. Only its comment, and the matching comment in `stale.test.mjs`, were corrected: they claimed unbuilt Cores were "already reported by the callers that care", and now point at `coreBuildMissing`.
- `build/index.mjs`: the barrel exports the two new functions, and its header now describes three questions instead of two.

**2. CI** (`.github/workflows/testing-facility.yml`, 64 insertions, 0 deletions)

- Two steps were added directly after "Install locked dependencies" in `select`, `static`, `chromium-smoke`, `changed-scenarios` and `nightly-full-matrix`:
  - "Install FluxIQ Core dependencies": `pnpm install --frozen-lockfile` in `!FluxIQ`. Core's dependencies were never installed in CI either, so the build could not have run without this.
  - "Build FluxIQ Core": `pnpm build` in `!FluxIQ`, Core's own root build (contracts, fluxiq, client-gateway-websocket, web).
- The `prerequisites` gate is untouched.
- **Deviation from the brief, with reason:** the brief names jobs that run the Lab or the extension. `select` and `static` do neither, and both are included anyway.
  - `select` runs `test-matrix test`, which builds `scenario-lab...`, which builds `test-contracts`. `test-contracts/src/failure-category.ts:22` imports `@fluxiq/contracts/automation-studio`.
  - `static` runs `pnpm check`, `pnpm test` and `pnpm build`, which type-check and bundle domain, extension and test-runner against Core's `link:`ed `dist`.
  - Both would otherwise fail on an unbuilt Core once the secrets are set. Every Lab job depends on `select`.

**3. Nightly estimate: kept at `--repeat 3`, with the numbers in a workflow comment and a step timeout of 300 minutes**

- `--all` means every registry entry: 41, counted in `apps/scenario-lab/src/registry.ts`. The matrix is strictly serial (`packages/test-runner/src/cli.ts:117` awaits each run), so the nightly is 123 runs.
- Data: 345 `run.json` manifests under `test-runs/`, all parsed with 0 errors.
  - The only complete deterministic runs are 21 from 2026-09-13 (basic-form, iframe-checkout, ambiguous-targets, identity-drift; win32, this machine): minimum 44 s, median 62 s, mean 68.8 s, maximum 108 s.
  - A job's first run is slower: 136-157 s cold, against 12-27 s warm (2026-09-18 instances).
- Estimates for 123 runs:

  | Per-run rate | Minutes |
  | --- | --- |
  | Median (62 s) | 127 |
  | Mean (68.8 s) | 141 |
  | Slowest observed (108 s) | 221 |

  Add about 2.5 minutes for the cold first run, plus setup. For comparison, 82 runs (`--repeat 2`) would take 85, 94 or 147 minutes.
- All of these are under GitHub's 360-minute job limit, so the repeat stays.
- A step-level `timeout-minutes: 300` makes a stall end as a named timeout, leaving about an hour for setup. The evidence upload still runs (`if: always()`).
- Caveats, written into the comment:
  - The other 37 scenarios have no complete deterministic run on record. Every deterministic manifest they have stopped at 0 steps.
  - None of the data is from Linux.
  - The first real nightly supersedes this estimate.

## Commands run and observed results

- `node --test scripts/lab/core/build/tests/unbuilt.test.mjs` printed `# tests 10 # pass 10 # fail 0`. The first attempt had failed 9/10: my assertion created a `stat` promise that rejected before `assert.rejects` could attach, which node reported as an unhandled rejection. After fixing the test it passed 10/10.
- Mutation check of the end-to-end test: I changed `if (!built.built)` to `if (false && ...)` and restored the file afterwards (`cmp` printed `restored`).
  - First try: the test failed, but only because the repository's own stale-domain-build guard refused first ("domain build is 99 minute(s) behind its source").
  - I then set `FLUXIQ_LAB_ALLOW_STALE_BUILD=1` in the test's environment. With the mutation it now fails with "the Lab went on to call pnpm past an unbuilt Core" (`true !== false`), which shows the fake `pnpm` is what gets reached, not the real one.
- Real Cores against the new check:
  - `F:\!FluxIQ`: `built`; `@fluxiq/client-gateway-websocket 2/2`, `@fluxiq/contracts 10/10`, `fluxiq 58/58`.
  - `F:/fxlab/!FluxIQ`: `built 0`.
  - Both scans were read-only. No false positive on either.
- `pnpm lab:test`: exit 0, `# tests 107 # pass 106 # fail 0 # skipped 1`. The skip is pre-existing: `watch.test.mjs` "the probe finds the real FluxIQ Core checkout's build output # SKIP no FluxIQ Core build output under F:\!FluxIQWebExtension\scripts\!FluxIQ".
- `node scripts/structure-audit.mjs`: exit 1, `2 violation(s) across 2 rule(s)`. Neither violation is mine, and none of my files appears among the warnings:
  - `[swallowed-failure] packages/test-runner/src/network-guard.ts:129`. That file has another agent's uncommitted modification (`git status`: ` M`) and is outside my ownership.
  - `[working-docs] docs/working/README.md is out of date`. It persisted with my report file temporarily moved out (`--rule working-docs` still printed `1 violation`), so it is not caused by this report. Only the supervisor may run `pnpm structure:baseline` for it.
- YAML: parsed with `yaml@2.9.0` from Core's pnpm store (`strict: true, uniqueKeys: true`): 0 errors, 0 warnings, and the six jobs are intact. In each of the five Core-using jobs the order is repository install, then Core install, then Core build, then first Core use. `git diff` shows 0 removed lines.

## Not verified

- **CI is unexercised.** Workflows cannot run here, and the three repository values are still unset. Not verified:
  - that `pnpm install --frozen-lockfile` and `pnpm build` in Core succeed on `ubuntu-latest` and `windows-latest`, including Core's Next web build (`next build --turbopack`);
  - how long those steps take in CI;
  - that `timeout-minutes` at step level behaves as intended.
- The runtime estimate rests on 21 Windows runs of 4 old scenarios. The 37 newer scenarios have no complete deterministic measurement.
- No real Lab run was started (by instruction). The end-to-end test stops before any build, using a fake `pnpm`.

## Open questions or contradictions found

- CI builds Core's web panel too, because `pnpm build` is Core's root command. The Lab does not need it: it stages its own copy of `apps/web` (see `scripts/worktree/core-build.mjs`'s comment). Building only the three libraries, `pnpm --filter @fluxiq/contracts build && pnpm --filter fluxiq build && pnpm --filter @fluxiq/client-gateway-websocket build`, would save one Next build per job (seven job runs) and remove the web build as a failure point unrelated to this repository. I followed the brief's "Core's own build command" literally. This is the supervisor's call.
- The audit's small item "`run-lab.mjs` gates read-only `--help` behind the Core staleness check" now also applies to this check. A `pnpm lab --help` on an unbuilt Core is refused with the build message. It would fail at the repository build step anyway, since test-runner compiles against Core. I left it alone.
- If the quiescence wait times out on a Core that is still rebuilding, the Lab prints "proceeding-anyway" and then may refuse as `incomplete`. That is the correct outcome, but the two lines read oddly one after the other.
- The end-to-end test lives in `scripts/lab/core/build/tests/` although it also exercises `run-lab.mjs`. By the placement rule its home would be `scripts/lab/tests/`, which is outside my ownership.
