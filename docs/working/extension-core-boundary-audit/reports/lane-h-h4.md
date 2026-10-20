# Lane H, brief H4 (t727): the three boundary-audit suspicions traced

## Outcome

Done. All three suspicions are traced, each with a verdict, evidence and a proposed fix. Suspicion 3 is fixed
in `packages/test-matrix/**`. Its check passes and 23 of 23 tests pass. Two related browser runs on synthetic
scenarios remain in files this brief does not own: the workflow's scenario-page step and the Scenario Lab's
Playwright specs (see 3).

| # | Suspicion | Verdict | Owner of the fix | Size |
| --- | --- | --- | --- | --- |
| 1 | `core-web-build` duplicates Core's `web:build` | Confirmed violation, needed for now because of a Core defect and a missing Core seam | Core first, then downstream | Core S (identity) + M (publication seam); downstream M (delete about 700 lines) |
| 2 | `scripts/lab/core/build/` judges staleness by mtime | Confirmed violation; Core already exports the replacement (`decideStep`) | Downstream S; Core S follow-up | S |
| 3 | `test-matrix` selects synthetic scenarios for browser jobs | Confirmed violation; fixed here | Downstream (done for test-matrix; workflow and specs outstanding) | S |

## What changed and why

### 1. `packages/test-runner/src/core-web-build/`: confirmed violation, needed for now

**What it is.** The module is 21 files and about 1060 lines. It makes its own production build of Core's
web panel: it stages a copy of Core's `apps/web`, writes its own `tsconfig.base.json` and `next.config.mjs`,
runs Core's `next build --turbopack` there, and publishes the result. The barrel header
(`core-web-build/index.ts:1-5`) says what it is for. Isolated Lab runs and the persistent demo serve that build
with `next start`. It is keyed by every input, built once per key under a create-only lock, published
atomically and served read-only by every run that shares that Core, across worktrees.

**History** (`git log -n 5 -- packages/test-runner/src/core-web-build`):

- 059a605e (2026-10-14): reuse a current gateway server build.
- abbcb45c (2026-10-07, t344): "The Lab builds Core's panel from Core's stamped output". This is the key commit.
- cff41523: gate the Lab on the server adapter identity.
- c93fad07 and ab6c3337 (2026-09-29).

**Does it duplicate Core's output?** Mostly yes. Core's step (`!FluxIQ/scripts/build-cache/steps.mjs:87-104`;
`apps/web/package.json:8`) runs `node scripts/build-client-gateway-server.mjs && next build --turbopack` in
`apps/web`. The downstream build runs the same `next build --turbopack` over a copy of the same `apps/web`
(`prepare.ts:170-178`, `workspace.ts:250-270`). It reuses Core's gateway generator
(`server-adapter.ts:119`) and Core's own `next` executable (`workspace.ts:269`). Its generated config repeats
Core's `transpilePackages: ["fluxiq"]` (`next-config.ts:332-340`, against `!FluxIQ/apps/web/next.config.ts`).
Two things differ, and they are why the module exists.

**(a) Core's own panel build cannot attest its runtime identity. This is a Core defect, confirmed.**

- Core's `tsconfig.base.json:17-25` sends `fluxiq` and `@fluxiq/contracts` to `packages/*/src` through `paths`,
  and Turbopack honours those aliases.
- The source keeps the identity as a placeholder: `packages/fluxiq/src/runtime/build-identity/read.ts:5`,
  `const embedded = '{"fluxiqRuntimeIdentityPlaceholder":302}'`. Only Core's `dist` build stamps the real value.
- `staged-tsconfig.ts:294-319` removes those aliases, so the staged panel loads the stamped `dist`.
- `stamped-identity.ts:21-33` refuses any panel build whose server JavaScript still contains the placeholder.
- I checked read-only whether Core's own build has the defect. The main Core checkout's in-place `web:build`
  output (`C:/Users/osrs_/FluxStuff/!FluxIQ/apps/web/.next`, `BUILD_ID` dated Oct 12 21:51) does embed it.
  `grep -rl fluxiqRuntimeIdentityPlaceholder apps/web/.next/server` matched
  `chunks/ssr/_61c17158._.js` and `chunks/[root-of-the-server]__10a48e4f._.js`.
- So a panel served from Core's own `web:build` answers the identity check with 400, as commit abbcb45c
  describes.

**(b) Many runs must serve fixed, content-keyed builds at once. Core's in-place step cannot provide this.**

- Core's step writes `apps/web/.next` inside the one shared Core.
- Its lock (`acquireStepLock`) is an exclusive per-step lock for building. It has no shared mode for "I am
  serving this output".
- The Lab already holds Core's library build locks for a whole run (`scripts/lab/core/build-lease/lease.mjs:15-60`)
  so that `dist` cannot change under it. Doing the same for `web:build` would let only one run serve the panel.
- The downstream module gives each key its own directory, which is never rewritten once published
  (`publication.ts`, `prepare.ts:158-191`; cache beside the Core, `cache-root.ts:386-390`). Any number of
  `next start` processes serve one key while a new key builds somewhere else.
- Smaller things the module also handles:
  - It scrubs the build environment: `FLUXIQ_*` and `NEXT_PUBLIC_*` are dropped, and the run gets its own
    FluxIQ root with the client gateway disabled (`build-environment.ts:67-82`). Core's step runs in the
    caller's environment and only fingerprints `NODE_ENV` and `NEXT_*`.
  - It checks the Windows path budget and refuses a cache inside `node_modules`. These exist only because the
    build is relocated.

**Could it call Core's step instead?** Not today. Calling `web:build` would serve the unstamped-identity
panel, and the Lab would have to rebuild in place under the panel that running runs are serving. It could
after two changes in Core.

**Proposed fix**

1. **Core, small.** Make `web:build` resolve Core's packages from their stamped `dist`. For example, set
   `typescript.tsconfigPath` in `next.config.ts` to an `apps/web/tsconfig.build.json` without the source
   `paths`, so `next dev` keeps its source aliases. Move the placeholder refusal
   (`stamped-identity.ts`) into Core as a post-build check of `web:build`, which would fail the step. This
   fixes Core's own `pnpm build && pnpm start` as well.
2. **Core, medium.** Add a seam that builds the panel into an immutable, content-keyed directory, for example
   `web:build --out <dir>`, or a Core module that publishes a keyed build. Core's build cache already has the
   fingerprint (`fingerprintStep`), the lock (`acquireStepLock`) and the path-independent store. The
   downstream key, inputs, publication and lock logic (`key.ts`, `inputs.ts`, `publication.ts`, most of
   `prepare.ts`) would move there.
3. **Downstream, medium, after 1 and 2.** Replace `prepareCoreWebBuild` with the Core call. Keep only the
   environment scrubbing (`build-environment.ts`) and the server process spec (`server-process.ts`). Delete
   `staged-tsconfig.ts`, `next-config.ts`, `workspace.ts`, `key.ts`, `inputs.ts`, `content-hash.ts`,
   `publication.ts` and `path-budget.ts`.
4. **Interim, downstream, small.** Until then, add a drift check that the generated Next config's
   `transpilePackages` equals Core's `next.config.ts`. This follows the drift-check pattern of the approved
   tooling policy.

### 2. `scripts/lab/core/build/`: staleness by modification time; confirmed violation

**What it compares**

- `scanCoreSources(coreRoot)` (`staleness.mjs:91-105`) walks only `packages/*/src`. It skips `node_modules`,
  `dist`, `.next`, `.git`, `.turbo` and `tests`, plus `*.test.*` files, and keeps the newest mtime.
- `scanCoreOutput(coreRoot)` (`watch.mjs:82` on) walks only `packages/*/dist` and keeps the newest mtime.
- `coreBuildStaleness(sources, output)` (`stale.mjs:13-27`) calls Core stale when the newest source is newer
  than the newest output.

**Who uses it**

- `scripts/lab/run-lab.mjs:164` refuses the run unless `FLUXIQ_LAB_ALLOW_STALE_CORE=1`.
- `scripts/check/core-build/freshness.mjs:36-55` is the gate that `pnpm check` and extension `test:e2e` run.

**Where it is wrong**

- It sees no input outside `packages/*/src`:
  - each package's `package.json` and `tsconfig*.json`;
  - the lockfile;
  - the build command;
  - the Node version and environment;
  - generator inputs outside `src`;
  - the whole web panel (`apps/web`, which `web:build` covers).
- A dist restored from the store, or built from another tree, counts as fresh whatever it was built from,
  provided its files are newer.
- Equal bytes with a new mtime count as stale.
- Core has already bent itself around this guard. `!FluxIQ/scripts/build-cache/touch-stale-outputs.mjs:1-38`
  says so: "Downstream Lab guards read Core's `dist` by modification time ... an input newer than every output
  ... would look like a stale build, so then the step's required files move to now". Core touches the step's
  required outputs on a reuse only to satisfy this downstream comparison.

**What Core's build cache records.** One stamp per step, at
`<package>/node_modules/.cache/fluxiq-core-build/<step with ":" as "-">.json` (`workspace/resolve-step.mjs:47,116`).
`write-stamp.mjs:11` lists the fields:

- `version`;
- `step`;
- `fingerprint`: a content digest of every git-visible input, the ignored inputs the step names, the
  lockfile, the command, Node, the platform and the fingerprinted environment;
- `outputDigest`;
- per-root digests in `roots`.

There is also a path-independent shared store (`store/`) that restores outputs into new worktrees.

**The Core function that serves.** `decideStep(step, { repoRoot, env })`, exported from
`!FluxIQ/scripts/build-cache/index.mjs:14`, defined at `decide-step.mjs:60-81`. It answers "is step X
current" without building or writing anything except the stat cache. It returns `decision: "reuse" | "build"`
with a reason, for example `inputs changed: <roots>`, `required output missing: <path>`, `no stamp` or
`outputs changed since they were stamped`. Reuse means the stamp version matches, the fingerprint equals the
current inputs, every required output exists and the output digest equals the stamp.

There is a precedent for loading it. The Lab's lease already imports Core's build cache from the exact Core
checkout: `lease.mjs:23`,
`await import(pathToFileURL(path.join(coreRoot, "scripts/build-cache/index.mjs")).href)` for `resolveStep`
and `acquireStepLock`.

**Proposed fix**

1. **Downstream, small.**
   - Replace `coreBuildStaleness(scanCoreSources(...), scan)` in `run-lab.mjs:164` and in
     `freshness.mjs:42-44` with `decideStep("<pkg>:build", { repoRoot: coreRoot, env })` for each
     `CORE_PACKAGES` entry, plus `web:build` where the panel is used. Load it the way the lease does.
     Report "stale" when the decision is `build`, with Core's reason.
   - Pass an `env` without `FLUXIQ_BUILD_FORCE`, which always answers `build`.
   - Keep `entries.mjs`/`unbuilt.mjs` for the "never built" message, or use `decideStep`'s
     `required output missing` reason. Keep `watch.mjs`'s "changed during the run" diagnostic, which is a
     different question.
   - Delete `stale.mjs` and `scanCoreSources`. `scanNewest` is still used by `domain-build-staleness.mjs` for
     this repository's own builds.
2. **Core, small follow-up.** Once no downstream mtime guard is left, remove the stale-input touch in
   `touch-stale-outputs.mjs` and its callers. Optionally export a documented
   `isStepCurrent(names, { repoRoot })` wrapper as the stable public seam, so downstream does not depend on
   `decideStep`'s full return shape.
3. **Cost note.** `decideStep` hashes content, not mtimes, but its stat cache keeps repeat calls cheap. I did
   not measure it on this machine.

### 3. `packages/test-matrix`: synthetic scenarios selected for browser jobs; confirmed violation, fixed here

**Evidence that the selected jobs open a browser** (`.github/workflows/testing-facility.yml`):

- The `select` job writes `scenario_ids` from `node packages/test-matrix/dist/cli.js` (lines 100-103).
- `changed-scenarios` (lines 237-286) installs headed Chromium (line 273), then runs
  `xvfb-run --auto-servernum pnpm lab matrix --scenarios-json "$FLUXIQ_SCENARIO_IDS"` (line 278).
- `nightly-plan` (lines 322-345) shards every id `loadScenarioCatalog()` returns.
- `nightly-full-matrix` runs each shard with the same `pnpm lab matrix` under xvfb (line 404).

**Evidence that synthetic ids were selected.** Before the change, the catalog was every registered scenario
(41, from `listScenarioManifests()`). The rules named `basic-form` (old `selection-rules.ts`, extension-ui
rule). Their tags (`smoke`, `gateway`, `identity`, `navigation`, `redaction`, `targeting`, ...) are carried
only by synthetic manifests. Running
`node packages/test-matrix/dist/cli.js apps/extension/src/sidepanel/x.ts apps/extension/src/background/a.ts`
selected 23 scenarios, 21 of them synthetic (admin-console, auth-gate, basic-form, dynamic-list, navigation,
reconnect, sensitive-input, ...). The nightly would have sharded all 41.

**Effect in practice.** The Lab refuses non-realistic scenarios at launch:

- `scripts/lab/scenario-guard/lab-scenario-refusal.mjs:32-44` refuses `matrix --scenarios-json`;
- `packages/test-runner/src/cli.ts:34` calls `assertRealisticScenarios(command.scenarioIds, "lab matrix")`.

So these jobs did not open synthetic pages. They failed with a refusal whenever a synthetic id was selected,
and the nightly failed on every shard. CI red-lined instead of running the rule's scenarios.

**The fix (my files only)**

- **New `src/realistic-scenario-ids.ts`.** `loadRealisticScenarioIds(repositoryRoot)` imports the one list,
  `packages/test-runner/src/realistic-scenarios/index.ts`, from source. This is the same way the Lab's guard
  imports it: that file imports nothing and uses erasable TypeScript, which Node 22 strips. It throws if the
  list is missing or malformed. The package does not restate the ten.
- **`src/scenario-catalog.ts`.** `loadScenarioCatalog()` now returns only the realistic scenarios, in
  registry order. `scenarioCatalogFromManifests(manifests, admitted?)` filters by `admitted` and throws if a
  realistic id is not registered. Because the nightly shards through `loadScenarioCatalog`, it now gets only
  the ten without a workflow edit.
- **`src/selection-rules.ts`.**
  - Tags are re-based on tags the realistic manifests carry: targeting = shadow-dom, iframe,
    generated-classes, overlays, modal, consent-overlay, lazy-load, infinite-scroll, honeypot; gateway =
    new-tab, multi-tab, permission, consequential, rate-limit; recording = forms, search, filters,
    pagination, variants, variant-picker, checkout, extraction.
  - The smoke scenario is `everything-store`, which replaces `basic-form`.
  - `changed-scenarios` is no longer listed in rule gates. The selector adds it only when it selects at least
    one scenario.
- **`src/selector.ts`.**
  - A change under `apps/scenario-lab/src/scenarios/<id>/` selects `<id>` only when it is in the catalog.
  - A file directly in `scenarios/` (shared live tasks, the barrel) selects the whole catalog.
  - Any other directory (a synthetic scenario, or the shared `scenarios/tests/` helpers) selects nothing; its
    unit tests run in the static gate.
  - A final filter drops any id outside the catalog, so a rule can never hand one out.
  - I checked that realistic scenarios import nothing from synthetic scenario directories (a grep of their
    `../` imports: only their own subdirectories, shared `scenarios/*.ts` files and `src/*.ts`).
- **`src/index.ts`.** Exports the new module.
- **Tests.**
  - `src/tests/scenario-catalog.test.ts`: the catalog is exactly the ten, in registry order; every realistic
    id is declared and registered; admitted-but-unregistered ids are rejected; a missing list is reported.
  - `src/tests/selector.test.ts`: a synthetic fixture change selects nothing and needs only `static`; a
    shared scenarios file selects all ten; across representative paths nothing outside the ten is ever
    selected; the synthetic-catalog semantics tests use the new tags; an unlisted fixture directory selects
    nothing; a rule naming a scenario outside the catalog hands out nothing.

**Workflow and specs that also need changing (not mine).**

1. **`testing-facility.yml:214-217`, the "Run all scenario pages without extension or Core" step.**
   - It runs `pnpm --filter @fluxiq-web-extension/scenario-lab test:e2e`, which is Playwright in Chromium.
   - Its specs open synthetic pages. `apps/scenario-lab/e2e/scenario-pages.spec.ts` alone opens basic-form,
     dynamic-list, navigation, long-document, iframe-checkout, ambiguous-targets, delayed-ui,
     failure-surfaces and more.
   - Other synthetic specs: admin-console, auth-gate, data-table, file-transfer, identity-drift,
     infinite-feed, intermediate-state, keyboard-forms, member-directory, modal-flows, multi-tab,
     order-operations, product-catalog, storefront-checkout and support-desk.
   - This is a direct breach of the rule: "Playwright specs" are named in it, and no guard stops these specs.
   - Fix it in `apps/scenario-lab/e2e/` and the workflow. Restrict the step to the realistic specs (today
     `local-classifieds.spec.ts` and `social-network-feed.spec.ts`, plus any realistic cases in
     `negative-variants.spec.ts`). Make the Playwright config refuse non-realistic pages through
     `assertRealisticScenarios`. Move the synthetic page checks to non-browser unit tests or delete them.
2. **`testing-facility.yml:352-362`, the nightly sizing comment.** It cites 41 scenarios times 3 repeats.
   With 10 there are 30 runs, so 4 shards hold 2 or 3 scenarios each. The 210/150-minute limits could
   shrink, or the shard count could fall to 2 or 3. This is a comment and tuning change only.
3. **No change needed in the `changed-scenarios` gating.** The job runs only when
   `run_changed_scenarios == 'true'`, and the selector now sets it only with a nonempty realistic list (or
   the full matrix, which is always the ten).
4. **Docs.** `docs/architecture/testing-facility.md:285` ("Change-to-scenario selection") may deserve a line
   saying the selector hands out only the ten realistic scenarios.

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/test-matrix test` before any change: `# tests 17 # pass 17 # fail 0`.
- Before the change, `node packages/test-matrix/dist/cli.js apps/extension/src/sidepanel/x.ts apps/extension/src/background/a.ts`
  selected 23 ids, among them admin-console, auth-gate, basic-form, dynamic-list, navigation, reconnect,
  sensitive-input and social-inbox, with tags gateway, identity, navigation, redaction, resilience and smoke.
- Listing the realistic manifest tags from `apps/scenario-lab/dist/registry.js` printed ten rows (tags
  quoted above) and a registry count of `41`.
- `pnpm --filter @fluxiq-web-extension/test-matrix check` after the change:
  `{"build-cache":"build","step":"test-matrix:check","reason":"inputs changed: packages/test-matrix; ..."}`
  with exit 0 and no tsc errors.
- `pnpm --filter @fluxiq-web-extension/test-matrix test` after the change:
  - The first run gave `# tests 23 # pass 21 # fail 2`: the tags test iterated synthetic registry entries,
    and a regular expression was unescaped. Both were fixed in the test files.
  - The final run gave `# tests 23 # pass 23 # fail 0`.
- After the change, `node packages/test-matrix/dist/cli.js apps/extension/src/sidepanel/x.ts apps/extension/src/background/a.ts domain/src/recording/a.ts apps/scenario-lab/src/scenarios/basic-form/scenario.ts`
  selected the ten realistic ids, with gates `["browser-smoke","changed-scenarios","static"]`.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (213 warning(s), 635 baselined).` No line names
  `test-matrix` (checked with `grep test-matrix`).
- Read-only checks:
  - `grep -rl fluxiqRuntimeIdentityPlaceholder apps/web/.next/server` in the main Core checkout found 2 chunk
    files (the evidence for 1a).
  - The t727 Core has no `apps/web/.next`.
- Grep and reads of the cited Core and downstream files for 1 and 2. No builds, no Lab, no live or browser
  runs.

## Not verified

- I did not run `pnpm lab matrix` or any CI job, so I did not watch the workflow with the new selector run end
  to end.
- I did not measure `decideStep`'s cost against the mtime walk, and did not prototype the replacement.
- I did not build Core's `web:build` in the t727 tree. The identity defect evidence is the existing main-checkout
  build from Oct 12, which might predate a Core fix. A grep of the t727 Core source still shows the
  `tsconfig.base.json` source `paths` and an unchanged `next.config.ts`, so the cause is still present.
- I did not inspect whether `apps/extension` `test:e2e` (the content harness the rule also names) opens
  synthetic pages.
- Whether four concurrent Lab runs can each hold the exclusive library locks in `lease.mjs` is outside this
  brief. I only used the lease as evidence of the lock model.

## Open questions or contradictions found

- `scripts/lab/core/build/watch.mjs:14-40` keeps a long "historical design" comment arguing against holding a
  lock in Core, which the lease now does. It also says Next builds Core's source through the junction, which
  `staged-tsconfig.ts` has prevented since t344. The comment is stale and should be cut when 2 lands.
- The working tree already had other lanes' uncommitted edits (for example `scripts/build-cache/steps.mjs`,
  `package.json`, `packages/test-contracts/src/llm.ts` and the deleted `packages/agent-orchestrator`). I did
  not touch them. The test-matrix tests ran in that mixed tree.
- Choosing `everything-store` as the smoke scenario was my call. Any realistic scenario works; the supervisor
  may prefer another.
