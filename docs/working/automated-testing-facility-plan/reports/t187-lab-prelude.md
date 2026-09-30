# t187 Lab prelude: reuse unchanged builds, fix the repository staleness guard

## Outcome

Done. `run-lab.mjs` no longer spawns `pnpm` for builds. Its build phase runs every step in-process through `runStep` from `scripts/build-cache`, and a run where nothing changed spawns no build: the prelude took 2.5–3.3 s, against about 46 s when everything rebuilt. The repository staleness guard now runs after the build phase, and its extension output root can actually fire. With `domain/src/index.ts` edited, the Lab rebuilt domain, extension and test-runner, reused the other three steps, and did not refuse the run.

One change from the brief's order: `extension:build` now runs after `domain:build`, not before it (see "Order" below). Without that change the brief's own pass-2-all-reuse check fails, and every domain edit costs a second extension build.

## What changed and why

- **`scripts/lab/prelude/build-phase.mjs`** (new). It exports one thing, `runBuildPhase({ interactive, instanced, env, runStep, buildOrder, timer, note, copyHostModule })`.
  - **Order.** The plan is:
    1. `buildOrder("scenario-lab:build")`
    2. `domain:host-build`, only when interactive or instanced
    3. `buildOrder("extension:build")`
    4. `buildOrder("test-runner:build")`
    5. The instanced host copy, as timer step `host-copy`.

    Duplicates are removed, so each step runs once. The resulting order is test-contracts, scenario-lab, [host], domain, extension, test-evidence, test-runner.
  - **Output lines.** Each step prints `{"build-cache":result,step,reason,ms,source}` (`source` only when the cache supplies one). Each step also prints a step-timer line, with `action` set to `reused` or `rebuilt`.
  - **Failure.** A non-zero `exitCode` throws `build step <step> failed with exit code N (<reason>)`, and no later step runs. `run-lab`'s existing catch reports that as `environment.missing`, the same as before.
  - **Instanced run without a copy function.** The phase refuses rather than skipping the copy.
- **`scripts/lab/prelude/index.mjs`**: the barrel now also exports `runBuildPhase`.
- **`scripts/lab/run-lab.mjs`**:
  - The four `pnpm` spawns are replaced by `withBuildLock(..., () => runBuildPhase({... runStep, buildOrder ... env: buildEnvironment}))`. `runStep` and `buildOrder` are imported from `../build-cache/index.mjs`.
  - The staleness guard (`repository-staleness`) moved to after the build lock is released. Its refusal text now says a source changed while the Lab was building.
  - `run()` is now node-only, since the pnpm shell branch is gone.
  - The step timer lines and the total line are kept.
- **`scripts/lab/domain-build-staleness.mjs`** (finding 1): the extension's output root is now `<extensionBuildRoot>/dist/e2e-chromium`, the bundle the browser loads. It used to be `extensionBuildRoot` itself, which is `apps/extension` without an instance. That directory contains `src`, and `scanNewest` skips `dist` directories, so the guard compared `src` with itself and could never fire. The guard agrees with a reused step: `touchOutputs` sets the required files, `dist/index.js` and `dist/e2e-chromium/manifest.json` + `background/index.js`, to the current time.
- **Tests**:
  - `scripts/lab/prelude/tests/build-phase.test.mjs` (new, 10 tests):
    - order for a plain run;
    - interactive and instanced runs, with the host before domain and the copy last and only for an instance;
    - failure propagation, including a thrown cache error and a missing copy function.
    - Three tests against the **real** `runStep`/`buildOrder` on a scratch workspace shaped like this repo, with the store off:
      - A second pass reuses every step, and the run log shows no spawned build.
      - Outputs made older than their source fail the guard before the phase; after a reuse pass the guard passes.
      - A domain edit rebuilds exactly domain, extension and test-runner, the guard passes afterwards, and the next pass is all reuse.
  - `scripts/lab/tests/domain-build-staleness.test.mjs`: the output-root test is updated. A new test puts a stale extension under a non-instanced root; it fails on the old root and passes on the new one.

### Order: why the extension now follows the domain

The cache fingerprints each dependency whole, outputs included. With the brief's order, the extension was fingerprinted against the domain output that the later `domain:build` then replaced (and against `dist/host` when the host step rebuilds). The next run therefore rebuilt the extension for nothing. The scratch test showed this directly: the second pass came back `reuse, reuse, build(extension), reuse…`.

The extension bundles `domain/src`; the t187-build-cache report says so, and `build-web-panel-host.mjs` reads only `src`. The artifacts are therefore the same as before. The host bundle still comes before `domain:build`, as the brief requires.

## Commands run and observed results

- **Unit tests:** `node --test --test-concurrency=2 "scripts/lab/**/tests/*.test.mjs"` → `# tests 118 # pass 117 # fail 0 # skipped 1`. This is the final run, after the build-cache gained its shared store.
- **Structure audit:** `t187-heavy.sh "t187-lab structure-audit" node scripts/structure-audit.mjs` → `structure-audit: passed (117 warning(s), 120 baselined).`, `exit=0`. This ran before the one-line `source` addition to build-phase.mjs.
- **Prelude passes.** Each ran as `t187-heavy.sh … bash t187-lab-pass.sh` → slot-2 claimed with a token (free RAM 4.3–5.4 GB) → `pnpm lab run everything-store --dry-run`. Every pass ended, as expected, with `{"status":"failed","category":"unknown","message":"--instruction-task and --dry-run require --live-llm --llm-task create-flow"}`, exit 1, and no browser started.
  - **pass1 and pass2:** all six steps rebuilt, each with `"inputs changed: scripts/build-cache; not stamped, because inputs changed while it ran (scripts/build-cache)"`. Another worker was writing `scripts/build-cache/{lock,store}/*` between 20:38 and 20:41 local, and those sources are an input of every step. Totals were `{"step":"total","ms":46304,...}` and `{"step":"total","ms":46574,...}`. This is not a prelude defect. My driver then waited until `scripts/build-cache` had been unmodified for 5 minutes.
  - **r3A:**
    ```
    {"lab":"prelude","step":"total","ms":2535,"rebuilt":[],"reused":["test-contracts:build","scenario-lab:build","domain:build","extension:build","test-evidence:build","test-runner:build"]}
    ```
    Every step logged `"reuse"` with `"inputs and outputs match the stamp"`. `build-lock` took 1774 ms and wall time was 7 s.
  - **r3B** (pass 2):
    ```
    {"lab":"prelude","step":"total","ms":3273,"rebuilt":[],"reused":[…all six…]}
    ```
    `build-lock` took 2382 ms and wall time was 9 s. No build was spawned.
  - **r3C**, with `// t187 lab edit` appended to `domain/src/index.ts`:
    ```
    {"lab":"prelude","step":"total","ms":46029,"rebuilt":["domain:build","extension:build","test-runner:build"],"reused":["test-contracts:build","scenario-lab:build","test-evidence:build"]}
    ```
    Each rebuild reason was `inputs changed: domain; stored in the shared store (...)`. `repository-staleness` took 88 ms with no `repository-build` stale line, so there was no refusal.
- **Restore:** `domain/src/index.ts` was restored from a pre-edit copy. `git diff domain/src | wc -l` → `0`.
- **Slots:** after the runs, slot-2 is gone (it carried my token only), and I never touched slot-1.

## Not verified

- **Interactive or instanced prelude on the real repo.** This covers `domain:host-build` and the host copy. Only the unit tests exercise them. The registry step now exists (another worker added it), and `buildOrder` still picks `domain:build` for the domain package.
- **The full chain `pnpm check`, `pnpm build` and `pnpm test`** was not run. It is outside this brief's validation.
- **A reuse served from the shared store (`source: "store"`)** has not been seen in a Lab pass. Every reuse observed came from a stamp.
- **The structure audit was not re-run** after the final one-line `source` edit.

## Open questions or contradictions found

- **Order.** The brief's order (extension before domain) contradicts its own "pass 2 must show every step reuse" requirement whenever pass 1 rebuilds domain. I changed the order as described above. The supervisor should confirm.
- **Two drivers at once.** My first attempt left two validation drivers running at the same time, a `nohup` copy that Git Bash's `ps` did not show plus the background task. I stopped all four processes (two drivers and their two waiting wrappers). At that moment none held the tree lock, slot-2 or a build slot; all were waiting on slot-1. `domain/src` was clean and was backed up before any edit. The interleaved logs are kept in `scratchpad/old-r2/` and were not used as evidence.
- **Store pollution from the first test runs.** Before I set `FLUXIQ_BUILD_CACHE_DIR=off`, the scratch-workspace test wrote a few tiny entries into the machine-wide store (`%LOCALAPPDATA%/fluxiq-build-cache`). Their fingerprints cannot match a real step. `pruneStore` from the build-cache owner can clear them if wanted.
- **Store and stamp at the same time.** `runStep` now also restores from the shared store. A reuse from the store is `result: "reuse"`, so the phase treats it as `reused`, which is correct. The prelude's cache line now carries `source`.
