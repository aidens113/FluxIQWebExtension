# t344 — Lab-built Core panel serves its real build identity

Worker: t344-lab-identity (worker-high). Worktree `C:\Users\osrs_\FluxStuff\fxwork\t344-lab-core-identity`
(branch `task/t344-lab-core-identity` at 073a9c77, shared Core `fxwork/!FluxIQ` at e5f25177). The brief named
`fxwork\t344\!FluxIQWebExtension`, which does not exist; `git worktree list` shows the branch checked out at the path
above (flat layout, shared Core as sibling), so all edits are there. 2026-10-07, about 20:15-20:40 UTC.

## Outcome

**Done.** A provider-free Lab run on the realistic `crossborder-marketplace` scenario now passes Core's identity
check and writes all four `running-*-identity.json` snapshots, with expected equal to actual in each. That had never
happened on this machine before (t342). The run itself then failed later, at a Flow step timeout that has nothing to
do with identity (see "Open questions").

All four goals and the dry-run key question are fixed, each with a fail-first test:

1. The staged panel build no longer copies Core's `tsconfig.base.json` verbatim. It drops every `paths` alias that
   points into `packages/<name>/src`, so the panel resolves `fluxiq` through `node_modules/fluxiq` and its exports,
   which point at the stamped `dist`.
2. `BUILD_LAYOUT_VERSION` went from 2 to 3, so the broken source-built panel is never reused.
3. A finished build whose `.next/server/**/*.js` contains `fluxiqRuntimeIdentityPlaceholder`, or that left no server
   output, is refused before `build-complete.json` and is never published. The refusal names the file.
4. The campaign no longer calls a `process.startup` failure "possibly this machine's memory fault" when the run's
   first failure (or the runner's refusal) is Core control answering with an HTTP error.
5. Dry-run key versus run key (t342 B3): **cause confirmed and fixed.** The key hashed the generated gateway server
   artifact `apps/web/.server-runtime/`. A run regenerates that artifact just before it computes the key, and a dry
   run never does. On a Core where the artifact did not exist yet (t342's Core: the directory was created at 19:58
   UTC, during the paid run), the two keys differed. Proof: t342's own compiled code on t342's Core gives
   `3ba011561d28594c1b0f43ca` with `.server-runtime` hashed and `a22a7ea3e56527de2aaf3183` without it. Those are
   exactly the run's key and the dry run's key. The key now covers the generator's sources instead (computed the way
   its receipt computes `sourceInputsDigest`). Staging still copies the artifact, and reuse still compares the
   published copy with a freshly generated one.

## What changed and why

`packages/test-runner/src/core-web-build/`:

- `staged-tsconfig.ts` (new): `stagedTsconfigBase(text)` removes `paths` entries with any target matching
  `^(./)?packages/<name>/src/`. It keeps every other option, drops an empty `paths`, and fails closed as
  `environment.missing` if Core's tsconfig is not plain JSON, rather than copying it with its aliases.
- `workspace.ts`: writes the staged tsconfig instead of `cp`-ing Core's.
- `key.ts`: layout 3, and `serverAdapterSourcesHash` added to the key material.
- `types.ts`: new `serverAdapterSourcesHash` input, documented.
- `gateway-sources.ts` (new): `hashServerAdapterSources(root)` hashes the existing
  `serverAdapterSourceInventory`, so the inventory has one owner.
- `inputs.ts`: the web hash leaves out `.server-runtime`. It adds the gateway sources hash and requires the
  inventory's directories (`apps/web/src/server`, `apps/web/scripts`, `scripts/build-cache`) and root `package.json`
  as topology paths.
- `stamped-identity.ts` (new): `assertStampedRuntimeIdentity(webDirectory)`.
- `prepare.ts`: calls it between `readBuildId` and `markBuildComplete`.
- Tests: new `tests/staged-tsconfig.test.ts` (5 tests). `tests/key.test.ts` gains the gateway-sources variant, "no
  input yields the layout-2 key" and "material pinned at layout 3". `tests/inputs.test.ts` gains: the generated
  artifact does not move the key; gateway sources (including root `package.json` and an added server file) do; a
  missing source directory is `environment.missing`. The old "native server executable/companion change the key"
  rows were replaced, and root `package.json` moved out of the "outside inputs" test, because it is a gateway server
  input; under layout 2 it also moved the key in a real run, through the regenerated artifact. `tests/prepare.test.ts`:
  fake builds now write a server chunk, and there are two new refusal tests.

`scripts/lab/live-campaign/lab-run/`:

- `core-control-response.mjs` (new): `coreControlResponse(text)` returns `{ endpoint, status }` for
  `FluxIQ control request failed: <endpoint> (<status>)`, the format of `packages/test-runner/src/http-control/index.ts:176`.
- `first-failure.mjs` (new): a synchronous `readFirstFailure(runPath)` (summary.json `firstFailure.summary`). It
  replaces the private async copy in `attempt-failure.mjs`, which now imports it.
- `ram-fault.mjs`: for a `process.startup` result or refusal, it reads the run's first failure (injectable). It
  returns `null`, a real outcome, when that failure or the refusal message is a Core control HTTP response, and
  `STARTUP_FAILURE` otherwise. Bare-crash signatures are unchanged.
- Tests: new `tests/core-control-response.test.mjs` and `tests/first-failure.test.mjs`; one new test in
  `tests/ram-fault.test.mjs` (identity 400 via the run bundle, a 503, a runner refusal; non-HTTP startup failures keep
  the label).

Outside the owned list, test fixtures only: `packages/test-runner/src/tests/cli-llm.test.ts`. Its stub Core is
documented as holding "only what a Core web build's key is computed from", so it needed the gateway source files the
key now reads (5 files and root `package.json`). Separately, its warm dry-run case already failed on the base commit
(the t342 tree's compiled test shows the same `cached: false` against an expected `true`). Since t310, a published
build is reusable only with its gateway artifact beside it, and the stub's published attempt had none. One
`writeServerAdapterFixture` call fixes it.

Docs: `docs/architecture/testing-facility.md`, "Core web panel production build". The key composition was stale (it
still said "SHA-256 over Core's HEAD") and is now current. Two new paragraphs explain the gateway artifact keyed by
sources (with the t342 numbers), the staged tsconfig without source aliases, and the placeholder refusal. The
server-adapter section's "both influence the build key" sentence was corrected and links back to that section.

## Commands run and observed results

- Fail-first, against stubs (tsconfig copied unchanged, empty gateway hash, layout 2, no placeholder check, null
  control reader). `node --test "dist/core-web-build/tests/*.test.js"` printed `# tests 43 # pass 31 # fail 12`. The
  failures, by goal:
  - (1) "every alias into a Core package's source is removed...", "a paths map left empty is dropped...", "...not
    plain JSON fails closed...", "real workspace staging writes the staged tsconfig...".
  - (2) "no input set yields the key a layout-2 build was published under", "the key material is pinned at layout 3".
  - (3) "a build whose server output embeds Core's unstamped runtime identity is refused...", "a build that leaves no
    server output is refused...".
  - B3: "every file a build depends on changes the key", "whether a run has generated the gateway server artifact yet
    does not change the key", "a Core checkout missing a gateway server source directory...", "changing any single
    input changes the key".
  - (4) `node --test "scripts/lab/live-campaign/lab-run/tests/*.test.mjs"` printed `# tests 13 # pass 10 # fail 3`:
    "a startup failure that is Core control answering over HTTP is a real outcome, never the memory fault", "a Core
    control HTTP failure is read as its endpoint and status", "the first failure is read from the run's summary.json".
- `pnpm --filter @fluxiq-web-extension/test-runner build` printed `core-build: ... current with its source`, then
  `test-runner:build ... build` with no tsc errors.
- `node --test "dist/core-web-build/tests/*.test.js" dist/demo-workspace/tests/core-process.test.js
  "dist/run-scenario/browser-session/server-adapter-identity/tests/*.test.js"
  "dist/run-scenario/browser-session/core-identity/tests/*.test.js" dist/tests/cli-llm.test.js
  dist/tests/coordinator-existing.test.js` printed `# tests 106 # pass 103 # fail 0 # skipped 3`.
- `node --test "scripts/lab/live-campaign/**/tests/*.test.mjs"` printed `# tests 74 # pass 74 # fail 0`.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (176 warning(s), 182 baselined)`. The first
  attempt failed `[naming] 3 files share the prefix "server-"`; I renamed my new file to `gateway-sources.ts`.
- B3 proof (read-only scratch script importing t342's compiled `core-web-build`, run on t342's Core). It printed
  `with .server-runtime 3ba011561d28594c1b0f43ca` and `without .server-runtime a22a7ea3e56527de2aaf3183`.
- Provider-free Lab run, 20:30:51-20:34:19 UTC:
  `FLUXIQ_LAB_INSTANCE=t344-identity FLUXIQ_TEST_ENV_FILES=none node scripts/lab/run-lab.mjs run crossborder-marketplace --flow`.
  It exited 1. Run `run-muykc54t-0cefc7eb` (`test-runs/instances/t344-identity/`), `llm.mode disabled`, `calls 0`.
  - `logs/core-web-build.log`: `Compiled successfully in 45s`, `[exit] code=0`. Published key
    `fa9065db33aba9986206d505`.
  - `snapshots/`: `running-core-identity.json`, `running-host-identity.json`, `running-server-adapter-identity.json`
    and `running-build-identity.json`. Each has `verified: true`. For core, host and server-adapter, expected deep
    equals actual. For build, expected equals both `background` and `content`.
  - Core's actual `artifactDigest` is `144d96fa65f8...`, the `dist` stamp.
  - The published panel has 0 `.next/server` JS files containing `fluxiqRuntimeIdentityPlaceholder`. Two server chunks
    contain the stamped digest. The staged `tsconfig.base.json` has no `paths`.
- Dry-run decision after the run: `inspectCoreWebBuild(shared Core)` printed
  `{"key":"fa9065db33aba9986206d505","cached":true}`, the key the run built.

## Not verified

- The dry-run key was not compared live on a Core with no `.server-runtime`. That would mean deleting Core's
  generated artifact, which I did not do in the shared Core. The unit test covers it, as does the t342 reproduction
  of both historical keys.
- That the generated gateway artifact is byte-identical across regenerations from the same sources. The design
  relies on it: if it were not deterministic, reuse would fail closed in `validateAdapterCopy` instead of rebuilding.
  The same artifact digest `3f8ba915...` appears both in t342's Core (generated at 20:07 UTC) and in this run's
  expected and actual server-adapter identity, which suggests it is deterministic, but the two Cores' sources were
  not compared.
- Whole package suites (`pnpm --filter test-runner test`, `pnpm check`) were not run, per the narrow-checks rule.
- No live (paid) run; the guarded live path was not exercised.

## Open questions or contradictions found

- **New, separate failure (not identity): the realistic Flow lane times out.** In `run-muykc54t-0cefc7eb`, the
  recording lane recorded 14 actions, and the Flow lane built a Flow from that recording. Then three
  `web.dom.wait_for_selector` actions (6.2 s, 5.2 s, 5.2 s) were followed by `web.action.timeout`. The final-state
  oracle passed, but the Flow reported failure: `runtime.behavior`, `flow_lane.product_behavior`, event 48, "The Flow
  reported an unexpected timeout failure". This is the first time any run reached this point since t302, so it needs
  its own debug before a paid run. I did not investigate it (out of scope).
- The brief's worktree path does not match the actual worktree (`fxwork/t344-lab-core-identity`, flat layout).
- t342 B2's proposal also asked that the endpoint and status be named in the task row. The row and its log line are
  built in `scripts/lab/live-campaign/runner.mjs` and `row/summarize-task.mjs`, outside `lab-run/`. With this change,
  the campaign stops after one attempt with no memory-fault label. The row still reads `process.startup;
  unclassified`. `coreControlResponse` is exported for whoever owns those files.
- Two edits went outside the strict ownership list, both in test fixtures of `packages/test-runner/src/tests/cli-llm.test.ts`
  (see above). One fixes a failure that was already there on the base commit.
- Left behind (ignored, not deleted): the shared Core's `.tmp/core-web-build/fa9065db33aba9986206d505/` (the new
  layout-3 panel, now reusable by every worktree on this Core), the regenerated `apps/web/.server-runtime/`, and the
  run folder under `test-runs/instances/t344-identity/`. No Lab slot was claimed and no ledger line was written,
  because the run was not `--live-llm`.
