# L-lab-concurrency

## Outcome

**Done.** The Lab now supports concurrent instances, one per agent. Two
instances were run at the same time and both passed, with 85 seconds of
genuinely overlapping execution and no shared path between them. A single
default `pnpm lab` still uses today's paths and still passes. `pnpm check`, the
test-runner's 413 tests, and both `pnpm lab:interactive` modes are green.

**Maximum safe concurrency: bounded by RAM and CPU, not by the Lab.** Each
instance runs a headed Chromium, a Next.js Core dev server under Turbopack, and
a scenario lab server. On this machine two instances ran comfortably alongside a
third Lab another worker was driving. Nothing in the design caps the count:
build phases serialize on one lock and then runs proceed in parallel, so the
cost of the Nth instance is one extra slot in the build queue plus one full
browser-and-Core stack at run time. The soft limits, in order: **RAM** (a Core
dev server plus Chromium is the heavy pair), then **CPU during the serialized
build window** (N instances starting together each wait for the ones ahead),
then **ephemeral loopback ports** (each run takes three; a cross-process
collision is possible but rare, and it fails loudly at startup rather than
silently). Practical recommendation for this machine: **three to four
concurrent instances**; beyond that the build queue and Turbopack compile times
dominate.

## What changed and why

### The mechanism that was broken

`pnpm lab` chained `pnpm --filter @fluxiq-web-extension/extension test:e2e:build`,
which runs `apps/extension/scripts/build-extension.mjs`, whose `buildExtension()`
began with `await rm(distDir, { recursive: true, force: true })` on the shared
`apps/extension/dist/`. A second Lab therefore deleted the unpacked extension
the first one's Chromium was loading. Three more shared artifacts have the same
shape once that one is fixed:

- `apps/scenario-lab/dist/` — spawned fresh **per scenario run**, so it is read
  throughout a Lab run, not only at startup.
- `domain/dist/host/web-panel-host.mjs` — rebuilt by `startTopology` on **every
  isolated run**, and imported by the Core process each run starts.
- the workspace TypeScript `dist/` directories (`domain`, `test-contracts`,
  `test-evidence`, `test-runner`) — two `tsc` processes writing the same files
  can be read torn by a third.

### The design

One knob, `FLUXIQ_LAB_INSTANCE`, on the convention the repository already uses
twice (`EXTENSION_TEST_BUILD_LABEL`, `DOMAIN_TEST_BUILD_LABEL`): lowercase
kebab-case, at most 64 characters. Unset, every path is exactly what it was.

`pnpm lab` and `pnpm lab:interactive` now both run `scripts/lab/run-lab.mjs`,
which builds and then runs.

| Output | Default | Instance `lab-a` |
| --- | --- | --- |
| Extension bundles and unpacked targets | `apps/extension/build/`, `apps/extension/dist/` | `apps/extension/.lab-instances/lab-a/{build,dist}/` |
| Scenario lab | `apps/scenario-lab/dist/` | `apps/scenario-lab/.lab-instances/lab-a/dist/` |
| Web panel host | `domain/dist/host/web-panel-host.mjs` | `domain/.lab-instances/lab-a/host/web-panel-host.mjs` |
| Run evidence | `test-runs/` | `test-runs/instances/lab-a/` |

**Per-instance build, not one shared build.** The brief asked for the reasoning,
so here it is explicitly: two instances started at different moments can
legitimately need different bytes. An agent edits `apps/extension/src` while
another instance is mid-run; the next instance must pick that edit up while the
running one keeps the extension Chromium already loaded. A single shared `dist/`
cannot do both, and holding a lock across the whole read window would serialize
the runs, which is the thing being fixed. The extension build is esbuild plus
file copies, so the duplicated work is cheap; the expensive `tsc` steps are the
shared ones, and those are built once under a lock rather than duplicated per
instance into different directories.

**Why an instance's output lives inside its own package.** This is the one thing
the first attempt got wrong, and the concurrency proof is what caught it. A
root-level `.lab-instances/<label>/` fails: the compiled scenario lab imports
`@fluxiq-web-extension/test-contracts` and the host bundle imports
`fluxiq/automation-studio`, both bare specifiers, and Node resolves those by
walking up from the importing file. pnpm hoists neither name to the repository
root, so the first two-instance run died with `Cannot find package
'@fluxiq-web-extension/test-contracts' imported from
...\.lab-instances\lab-b\scenario-lab\dist\types.js`. Each instance's output now
sits under the package that produced it, which reaches that package's own
`node_modules`. A test asserts that containment property directly rather than
restating literal paths.

**Builder and runner cannot disagree.** `scripts/lab/lab-instance.mjs` is the
only place a label becomes a path. The launcher builds into those directories
and exports the absolute results as `FLUXIQ_LAB_EXTENSION_PATH`,
`FLUXIQ_LAB_SCENARIO_ENTRYPOINT` and `FLUXIQ_LAB_HOST_MODULE`;
`packages/test-runner/src/lab-instance/resolve-lab-paths.ts` reads those rather
than recomputing them. `FLUXIQ_LAB_INSTANCE` set without them — a bare
`node packages/test-runner/dist/cli.js` — **fails closed** with a message
pointing at `pnpm lab`, because a guessed path is the one failure mode that
would silently test the wrong build.

**The build lock.** `scripts/lab/build-lock.mjs` holds one repository-wide lock
at `.lab-locks/build.lock` for the build phase only, so instances build one
after another and then run in parallel. It waits rather than failing, reclaims a
lock whose recorded process is gone or whose record is unreadable, and announces
the wait on stderr. The shared workspace `tsc` outputs are what make it
necessary; no label can move those, and the test-runner CLI's module graph is
fully loaded at process start, so a rewrite after that point is harmless.

**The host build no longer runs per-run in instance mode.** With
`FLUXIQ_LAB_HOST_MODULE` set, `resolveLabPaths` reports `hostPrebuilt` and
`runScenario` passes `prepareHost: false`, so `domain/dist/host/` is written
once inside the locked build phase instead of on every run, and each instance's
Core imports its own copy. Default mode is unchanged: the host is built per run
exactly as before.

**Run manifests now tell the truth.** `extension.path` was the hardcoded string
`"apps/extension/dist/e2e-chromium"`. It is now the repository-relative POSIX
path of the build the run actually loaded, which is how the two instances'
manifests can be told apart. The run contract's `safeRelativePath` rule still
holds.

**Port allocation.** `allocateDistinctPorts` now holds every probe socket open
until all of a run's ports are chosen, so the kernel guarantees a run's three
ports differ, instead of closing and reopening between each. The cross-process
window between the last close and a child's bind is documented, not eliminated.

### Files

Owned and changed:

- `scripts/lab/lab-instance.mjs`, `scripts/lab/build-lock.mjs`,
  `scripts/lab/run-lab.mjs`, `scripts/lab/tests/lab-instance.test.mjs` (new)
- `apps/extension/scripts/build-extension.mjs` — honours
  `FLUXIQ_LAB_EXTENSION_BUILD_ROOT`, refusing a root outside the repository
  because `distDir` is deleted on every build
- `apps/scenario-lab/scripts/build-scenario-lab.mjs` (new) and that package's
  `build` script — honours `FLUXIQ_LAB_SCENARIO_OUT_DIR`
- `packages/test-runner/src/lab-instance/` — `resolve-lab-paths.ts`,
  `index.ts`, `tests/resolve-lab-paths.test.ts` (new)
- `packages/test-runner/src/` — `cli.ts`, `run-scenario.ts`,
  `interactive-session.ts`, `coordinator.ts`, `scenarios.ts`, `allocation.ts`,
  `index.ts`, `run-manifest/create-run-manifest.ts`
- root `package.json` — `lab`, `lab:interactive`, a new `lab:test`, and
  `lab:test` added to `check` so the launcher's tests actually run
- `docs/architecture/repository-layout.md` — a "Running Several Labs At Once"
  section, the tracking table, and the host-bundle note

Outside the owned list, and why:

- `.gitignore` — `.lab-instances/` and `.lab-locks/` had to be ignored or every
  instance would dirty the working tree. Verified with `git check-ignore -v`.
- `apps/extension/build/content/index.js` and its `.map` — **tracked** generated
  output, regenerated by the default-mode validation run from the current (other
  workers') `apps/extension/src/content` edits. Not a change I authored; the
  supervisor should decide whether it belongs in this commit or in the commit
  that changed those sources. Instanced builds do **not** touch it, verified by
  unchanged mtime.
- New files were `git add -N`'d so `scripts/structure-audit.mjs`, which reads
  `git ls-files`, actually audits them. Nothing was committed.

## Commands run and observed results

Every exit status captured by redirect to a file, never through a pipe.
`FLUXIQ_TEST_ENV_FILES=none` on every Lab command; `--target isolated`
throughout; `--target existing` never used.

### The concurrency proof

```
( FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_INSTANCE=lab-a pnpm lab run basic-form --target isolated > lab-a.log 2>&1; echo $? > lab-a.status ) &
( FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_INSTANCE=lab-b pnpm lab run basic-form --target isolated > lab-b.log 2>&1; echo $? > lab-b.status ) &
wait
```

`A_STATUS=0`, `B_STATUS=0`. Both verdicts `passed`:

- `{"runId":"run-mtz2mppa-d69e24a7","verdict":"passed","path":"...\test-runs\instances\lab-a\run-mtz2mppa-d69e24a7", ...}`
- `{"runId":"run-mtz2m8bv-472bc76a","verdict":"passed","path":"...\test-runs\instances\lab-b\run-mtz2m8bv-472bc76a", ...}`

The build lock was observed doing its job in the launcher output:
`[lab] waiting for the build lock held by process 20476`.

**They really overlapped**, from the two `run.json` manifests:

| | lab-a | lab-b |
| --- | --- | --- |
| `startedAt` | `2026-09-13T00:23:53.068Z` | `2026-09-13T00:23:30.617Z` |
| `finishedAt` | `2026-09-13T00:25:39.850Z` | `2026-09-13T00:25:18.401Z` |
| `status` | `passed` | `passed` |
| `extension.path` | `apps/extension/.lab-instances/lab-a/dist/e2e-chromium` | `apps/extension/.lab-instances/lab-b/dist/e2e-chromium` |
| `extension.sha256` | `49c726b7072e1c3a…` | `49c726b7072e1c3a…` |
| `ports` | `{scenario: 53777, web: 53778, gateway: 53779}` | `{scenario: 53743, web: 53744, gateway: 53745}` |

85 seconds of simultaneous execution (00:23:53 to 00:25:18). **Paths compared,
not assumed**: different extension builds, different ports, different run
directories. The identical `sha256` is correct and is the point — same sources,
two separate copies, so neither can delete the other's.

The launcher also prints, per instance, the paths it built and handed over:

```
{"lab":"paths","instance":"lab-a","extensionPath":"...\apps\extension\.lab-instances\lab-a\dist\e2e-chromium","scenarioEntrypoint":"...\apps\scenario-lab\.lab-instances\lab-a\dist\server.js","hostModule":"...\domain\.lab-instances\lab-a\host\web-panel-host.mjs"}
{"lab":"paths","instance":"lab-b","extensionPath":"...\apps\extension\.lab-instances\lab-b\dist\e2e-chromium","scenarioEntrypoint":"...\apps\scenario-lab\.lab-instances\lab-b\dist\server.js","hostModule":"...\domain\.lab-instances\lab-b\host\web-panel-host.mjs"}
```

### The default single run is unaffected

`FLUXIQ_TEST_ENV_FILES=none pnpm lab run basic-form --target isolated` gave
`DEFAULT_EXIT=0`, verdict `passed`, run `run-mtz2v8c7-283a719e`. Paths used:
`apps\extension\dist\e2e-chromium`, `apps\scenario-lab\dist\server.js`,
`hostModule: null` (per-run host build, as before), run directory
`test-runs\run-mtz2v8c7-283a719e`. Manifest `extension.path`:
`apps/extension/dist/e2e-chromium` — byte-identical to the string the old
hardcoded constant produced.

### `pnpm lab:interactive` is not broken

- Instanced: `FLUXIQ_LAB_INSTANCE=lab-c pnpm lab:interactive basic-form --target isolated < /dev/null`
  gave `INTERACTIVE_EXIT=0` and reached
  `{"status":"ready","runId":"interactive-mtz2y1xm-9c9bd89b","scenarioId":"basic-form", ...}`
  with the instance's own extension, scenario lab and host copy.
- Default: `pnpm lab:interactive basic-form --target isolated < /dev/null` gave
  `DEFAULT_INTERACTIVE_EXIT=0` and reached
  `{"status":"ready","runId":"interactive-mtz32b6x-52261a0c", ...}` with
  `hostModule: null` and today's shared paths. The host is still built before
  the workspace build, whose domain clean step preserves
  `dist/host/web-panel-host.mjs`.

### Repository checks

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm check` | **0** | `structure-audit: passed (32 warning(s), 19 baselined)`; `lab:test` ran inside it; every package `check: Done` |
| `node scripts/structure-audit.mjs`, re-run at the very end | **1** | `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks.` **Not mine** — see open question 6 |
| `pnpm --filter @fluxiq-web-extension/test-runner test` | **0** | `# tests 413 / # pass 413 / # fail 0` |
| `node --test "scripts/lab/tests/*.test.mjs"` | **0** | `# tests 7 / # pass 7 / # fail 0` |
| `node scripts/structure-audit.mjs` (new files `git add -N`'d first) | **0** | `structure-audit: passed` |
| `git check-ignore -v` on all three `.lab-instances` paths | — | all three matched `.gitignore:32:.lab-instances/` |

### Isolation checks done before touching anything shared

Another worker held a Lab run for most of this task. Before the concurrency
proof, the instanced builds were exercised on their own and the shared outputs
confirmed untouched by comparing mtimes before and after:

- `FLUXIQ_LAB_SCENARIO_OUT_DIR=... node apps/scenario-lab/scripts/build-scenario-lab.mjs`
  exited 0; `apps/scenario-lab/dist/server.js` mtime unchanged at
  `2026-09-12 17:02:13.700374300`.
- `FLUXIQ_LAB_EXTENSION_BUILD_ROOT=... pnpm --filter ...extension test:e2e:build`
  exited 0; `apps/extension/dist/e2e-chromium/manifest.json` mtime unchanged at
  `2026-09-11 17:10:16.707647300` and `apps/extension/build/content/index.js`
  unchanged at `2026-09-12 17:02:17.177010000`, with
  `git status --porcelain apps/extension/build` empty.

### The failure the proof caught

The first two-instance run failed — **both instances, exit 1** — with
`{"status":"failed","category":"unknown","message":"Cannot find package
'@fluxiq-web-extension/test-contracts' imported from
F:\!FluxIQWebExtension\.lab-instances\lab-b\scenario-lab\dist\types.js"}`. That
is the bare-specifier resolution problem described above. It was fixed by moving
each instance's output under its owning package, and the rerun passed. Recording
it because a single passing run would never have surfaced it: the build
succeeded, the typecheck succeeded, and only loading the compiled server failed.

## Not verified

- **Cross-process port collision.** Two instances allocating ephemeral ports in
  the same millisecond could in principle be handed the same one. The OS hands
  them out on a rotating cursor, so it did not happen in any run here, and I did
  not construct a test that forces it. It fails loudly at startup (a
  `waitForHttp` timeout, or `EADDRINUSE` in the child log), never silently.
- **More than two concurrent instances.** Two were run at once (three Labs
  counting the other worker's). Three or four should follow from the design but
  were not measured.
- **A source edit landing between two instances' builds.** The stated reason for
  per-instance builds is that instance B picks up an edit while instance A keeps
  the bytes it loaded. Both instances here built from identical sources
  (identical `extension.sha256`), so the divergent case is reasoned, not
  demonstrated.
- **`--target persistent-isolated` and `--target clone` under concurrency.**
  Only `isolated` was exercised. `persistent-isolated` already has its own
  workspace lock; two instances naming the same workspace will contend on it as
  before, which is correct but untested here.
- **`pnpm build` and `pnpm test` at the workspace root.** Not run; `pnpm check`
  and the test-runner's own tests were.
- **The interactive session's action loop.** Both interactive smokes reached
  `{"status":"ready"}` and exited cleanly at stdin EOF; no interactive action
  was driven.
- **Whether `apps/extension/build/content/index.js` and its `.map` belong in
  this commit.** They are tracked artifacts my default-mode validation
  regenerated from other workers' `src/content` edits.

## Open questions or contradictions found

1. **Other workers are still colliding, right now.** While this task ran,
   another worker was invoking `node packages/test-runner/dist/cli.js run ...`
   directly rather than `pnpm lab`, and so was using the shared
   `apps/extension/dist/`. The fix only applies to work that goes through
   `pnpm lab` with `FLUXIQ_LAB_INSTANCE` set. **Every worker that runs the Lab
   must be told to set a distinct instance label**, or the collision returns the
   first time two of them build.
2. **`pnpm lab inspect <runId>` is instance-scoped.** Runs live under
   `test-runs/instances/<label>/`, so `inspect` must be run with the same
   `FLUXIQ_LAB_INSTANCE` that produced the run. Documented, but worth saying to
   anyone reading a run id out of another agent's report.
3. **`packages/test-matrix/src/scenario-catalog.ts` still reads
   `apps/scenario-lab/dist/registry.js` directly.** It is outside my ownership
   and is not on the Lab path, but in instance mode the shared scenario-lab
   build can lag an instance's. A workspace `pnpm build` refreshes it.
4. **The `demo:*` scripts still use the old build chain** and the shared paths.
   They are unaffected and unchanged, but they are not concurrency-safe with
   each other or with a default `pnpm lab`. Out of scope here; worth a note if
   demos are ever run in parallel.
6. **`pnpm check` now fails on something I did not cause, and cannot fix.** At
   the end of this task `node scripts/structure-audit.mjs` reports
   `FAIL [working-docs] docs/working/README.md is out of date with the
   documents' header blocks`. `pnpm check` was **exit 0** when I ran it; the
   drift appeared afterwards, when another agent edited
   `docs/working/mvp-week1-web-automation-reliability-plan.md` at 17:39 (a
   Level 1 veto rewrite around line 185, visible in `git diff`). The rule counts
   only top-level `docs/working/*.md`, so my report in `<effort>/reports/`
   cannot be the cause, and neither can `docs/architecture/repository-layout.md`.
   **The supervisor should run `pnpm structure:baseline` to regenerate the
   index**; a worker must not edit that shared document.

7. **`scripts/` is at its structure-audit ratchet** (`directory-files` 32,
   `naming scripts::run` 12), which is why the launcher lives in `scripts/lab/`
   rather than as another root-level `run-*.mjs`. That is the better home
   anyway, but the ratchet forced the decision rather than the design doing so.
