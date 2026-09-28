# Audit: are Phases 0-5 of `automated-testing-facility-plan.md` real in the code today?

Worker audit, 2026-09-28. Read-only: no source file was changed.
Subject document: `F:\!FluxIQWebExtension\docs\working\automated-testing-facility-plan.md`
(`Last updated: 2026-09-10`), `Current State` lines 14-140 and Execution Log
rows for Phases 0, 1, 2, 3 and 5 (lines 166-171).

Verdict legend used throughout:

- **TRUE** — the plan claims X and X is true in the code today.
- **FALSE** — the plan claims X and X is false in the code today.
- **UNVERIFIED** — the plan claims X and I could not verify it from the code.

## Headline

**Phases 0-5 are real.** Every structural claim in the Phase 0, 1, 2, 3 and 5
rows is backed by code that exists today, resolves its imports, and is wired to
real implementations. There are **no stubs, no `not implemented` throws, no
TODO/FIXME markers and no skipped tests** in the audited packages (one
conditional runtime `t.skip` for an unavailable OS capability, quoted below).

The one thing that is *wrong* in the plan is **scale**, not truth. The document
froze on 2026-09-10 while the facility kept growing:

| Plan's number (2026-09-10) | Observed 2026-09-28 |
| --- | --- |
| "ten-scenario corpus" | **41** registered scenarios |
| test-runner "116/116" | **228** test files, **1428** test cases |
| contracts "14 contract tests" | 15 files, **145** cases |
| scenario lab "16 direct tests" | 56 files, **550** cases |
| selector "5/5" | 3 files, **17** cases |
| extension E2E "8/8" | 4 spec files, **8** cases (unchanged) |
| scenario-site E2E "10/10" | 19 spec files, **141** cases |

So the accurate summary is: *the plan understates the facility by roughly an
order of magnitude.* It has not rotted; it has outgrown its own description.

---

## 1. Does the ten-scenario corpus exist?

**Verdict: TRUE, and superseded.** The ten original scenarios all still exist,
are all still registered, and are all still exercised. They are now ten of
forty-one.

The single source of truth is the registry:

`apps/scenario-lab/src/registry.ts:45-87` builds a `Map<ScenarioId,
ScenarioDefinition>` with **41** entries, and
`apps/scenario-lab/src/types.ts:1-26` declares the id union:

```ts
// apps/scenario-lab/src/types.ts:1-26
export const scenarioIds = [
  "basic-form", "dynamic-list", "navigation", "long-document", "iframe-checkout",
  "ambiguous-targets", "delayed-ui", "failure-surfaces", "reconnect", "sensitive-input",
  ...
] as const;
```

Lines 2-3 are exactly the Phase 1/Phase 5 "ten deterministic loopback fixtures".

### Every scenario id (41), with coverage

`unit` = `*.test.ts` files under the scenario's own directory; `e2e` = a
dedicated `apps/scenario-lab/e2e/<id>.spec.ts` and/or coverage inside the
cross-scenario specs `scenario-pages.spec.ts` / `negative-variants.spec.ts`.

**The original ten** (`types.ts:2-3`), all covered by
`apps/scenario-lab/e2e/scenario-pages.spec.ts`:

| id | registry line | unit | e2e |
| --- | --- | --- | --- |
| `basic-form` | registry.ts:46 | 0 | yes (scenario-pages.spec.ts:4) |
| `dynamic-list` | registry.ts:47 | 0 | yes (scenario-pages.spec.ts:11) |
| `navigation` | registry.ts:48 | 1 | yes (scenario-pages.spec.ts:17) |
| `long-document` | registry.ts:49 | 0 | yes (scenario-pages.spec.ts:22) |
| `iframe-checkout` | registry.ts:50 | 1 | yes (scenario-pages.spec.ts:26) |
| `ambiguous-targets` | registry.ts:51 | 1 | yes (scenario-pages.spec.ts:32) |
| `delayed-ui` | registry.ts:52 | 1 | yes (scenario-pages.spec.ts:36) |
| `failure-surfaces` | registry.ts:53 | 1 | yes (scenario-pages.spec.ts:40) |
| `reconnect` | registry.ts:54 | 0 | yes (scenario-pages.spec.ts) |
| `sensitive-input` | registry.ts:55 | 1 | yes (scenario-pages.spec.ts) |

**The thirty-one added after the plan froze** (registry.ts:56-86):
`llm-target-drift` (1/yes), `instruction-only-form` (1/no),
`product-catalog` (1/yes), `data-table` (1/yes), `infinite-feed` (1/yes),
`modal-flows` (1/yes), `multi-tab` (1/yes), `file-transfer` (1/yes),
`auth-gate` (1/yes), `identity-drift` (1/yes), `intermediate-state` (1/yes),
`keyboard-forms` (1/yes), `storefront-checkout` (1/yes),
`admin-console` (1/yes), `member-directory` (1/yes), `support-desk` (1/yes),
`order-operations` (1/yes), `property-listings` (1/no),
`company-directory` (1/no), `social-scheduler` (1/no), `social-inbox` (1/no),
`everything-store` (3/no), `crossborder-marketplace` (2/no),
`bigbox-retail` (2/no), `job-board` (2/no), `local-classifieds` (2/yes),
`auction-marketplace` (4/no), `photo-social` (2/no),
`social-network-feed` (1/yes), `company-website` (3/no),
`professional-network` (2/no).

### Which are referenced by the selector/CLI, and which are dead

**None are dead.** Both the selector and the CLI read the registry rather than
restating a list, so registration is reachability.

- Selector: `packages/test-matrix/src/scenario-catalog.ts:35-46`
  `loadScenarioCatalog()` imports `apps/scenario-lab/dist/registry.js` and calls
  `listScenarioManifests()`; the comment at lines 29-33 is explicit — *"The
  registry is the one list of scenarios; nothing in this package restates it."*
- CLI: `packages/test-runner/src/cli.ts:111,117` —
  `loadScenarioManifests(...)` then
  `expandMatrix(command, manifests.map(item => item.id))`, so `lab matrix --all`
  covers every registered scenario. `lab run <id>` resolves through
  `loadScenarioManifest()` (`packages/test-runner/src/scenarios.ts:24-28`).
- The only hard-coded scenario id anywhere in the selector is
  `packages/test-matrix/src/selection-rules.ts:36`
  (`scenarios: ["basic-form"]`), which is registered.

Directory/registry consistency was checked mechanically: 41 scenario
directories under `apps/scenario-lab/src/scenarios/`, 41 registry entries, and
every directory name appears in `types.ts`. No orphan directory, no orphan
registration.

## 2. Do `run`, `matrix`, `inspect` and `compare` exist and reach real implementations?

**Verdict: TRUE for all four. None is a stub; none throws "not implemented".**

`packages/test-runner/src/commands.ts:10-24` types the command union;
`parseLabCommand` (`commands.ts:29-131`) parses each; `runCli`
(`packages/test-runner/src/cli.ts:20-125`) dispatches.

| Command | Parse | Dispatch | Implementation |
| --- | --- | --- | --- |
| `run` | commands.ts:39-53 | cli.ts:93-109 | `runScenario` — `packages/test-runner/src/run-scenario.ts` (688 lines) |
| `matrix` | commands.ts:54-72 | cli.ts:110-120 (fall-through default) | `expandMatrix` (commands.ts:133) + `runScenario` per job |
| `inspect` | commands.ts:116 | cli.ts:52 | `inspectRun` — `packages/test-runner/src/inspect.ts:9-27` |
| `compare` | commands.ts:117-129 | cli.ts:53-59 | `compareBenchCommand` — `bench/compare-reports.ts:87`; `compareBenchCloseoutCommand` — `bench/closeout-comparison.ts:13` |

Evidence that these are real rather than shells:

```ts
// packages/test-runner/src/cli.ts:52
if (command.command === "inspect") { process.stdout.write(`${JSON.stringify(await inspectRun(runsDirectory, command.runId))}\n`); return 0; }
```

```ts
// packages/test-runner/src/inspect.ts:16-22 — real digest verification, not a stub
if (complete.artifactIndexSha256 !== sha256(indexBytes)) throw new Error("artifact-index digest mismatch");
...
for (const artifact of index.artifacts) {
  const bytes = await readFile(path.join(root, ...artifact.path.split("/")));
  if (bytes.byteLength !== artifact.bytes || sha256(bytes) !== artifact.sha256) throw new Error(`artifact mismatch: ${artifact.path}`);
}
```

```ts
// packages/test-runner/src/cli.ts:117 — matrix really runs each expanded job
for (const job of expandMatrix(command, manifests.map(item => item.id))) results.push(await runScenario({ ... }));
```

Six further commands exist that the plan never mentions, all wired the same
way: `interactive` (cli.ts:28), `auth` (cli.ts:34), `clone-cache` (cli.ts:39),
`replay` (cli.ts:46), `bench` (cli.ts:60), plus `--llm` live profiles
(cli.ts:98, 116). The CLI is reachable as `pnpm lab`
(root `package.json` → `node scripts/lab/run-lab.mjs`) and as the
`fluxiq-lab` bin (`packages/test-runner/package.json`).

The only `throw`s on these paths are input validation, e.g.
`commands.ts:58` `"matrix requires exactly one of --all or --scenarios-json"` —
refusals, not unimplemented work.

## 3. Does the real-extension Playwright fixture exist and load the built extension?

**Verdict: TRUE.**

**File: `F:\!FluxIQWebExtension\apps\extension\e2e\fixtures\extension-context.ts`.**

It loads the freshly built E2E artifact from `dist/e2e-chromium`:

```ts
// apps/extension/e2e/fixtures/extension-context.ts:10
export const defaultExtensionPath = path.join(extensionRoot, "dist", "e2e-chromium");
// :54
const artifactPath = path.resolve(process.env.FLUXIQ_E2E_EXTENSION_PATH ?? defaultExtensionPath);
// :62-76
context = await chromium.launchPersistentContext(profilePath, {
  headless: false, locale: "en-US", timezoneId: "UTC",
  viewport: { width: 1280, height: 720 }, colorScheme: "light",
  args: [
    `--disable-extensions-except=${artifactPath}`,
    `--load-extension=${artifactPath}`,
    "--no-first-run", "--disable-default-apps", "--disable-background-networking",
    "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1"
  ]
});
```

The plan's supporting claims also hold:

- Loopback-only networking is enforced by the `--host-resolver-rules` arg above
  plus `installDeterministicNetworkGuard(context)` (line 77), whose
  `assertClean()` is thrown from teardown (lines 44-46).
- Build provenance is attached per test: `readExtensionManifest` +
  `hashDirectory` produce `artifactSha256`, attached as `extension-build.json`
  (lines 36-39).
- MV3 service worker readiness: `waitForServiceWorker(context)` (line 78).
- The artifact is produced by `apps/extension/scripts/build-extension.mjs:302`
  — `await buildTarget("e2e-chromium", "manifest.e2e.json")` — a separate
  manifest from production, as the plan's "test hooks ship" risk row requires.
  `apps/extension/dist/e2e-chromium/` is present on disk today.
- "pass 8/8": `apps/extension/e2e/` has four top-level specs —
  `action.spec.ts` (1), `install-and-content.spec.ts` (2),
  `network-policy.spec.ts` (3), `resilience-and-isolation.spec.ts` (2) —
  **8 test cases**, matching the plan exactly.

Related real-extension launchers exist in the runner for the topology lanes
and use the same `--load-extension` shape:
`packages/test-runner/src/run-scenario/browser-session/launch-browser.ts:17`,
`saved-flow-replay/replay-browser.ts:39-41`,
`interactive-session.ts:212-219`, `demo-workspace/browser-session.ts:51-60`,
`ui-e2e/topology.ts:323-333`.

**UNVERIFIED:** the plan's "Pinned Chromium 134 / Playwright 1.51.1". Playwright
is pinned (`packages/test-runner/package.json` → `"@playwright/test": "1.51.1"`,
exact, no caret). The *Chromium 134* half is a property of an executed run, not
of the source, and I did not run anything.

## 4. Is `packages/test-contracts` still private and repository-local?

**Verdict: TRUE on both halves.**

```jsonc
// packages/test-contracts/package.json:2-4
"name": "@fluxiq-web-extension/test-contracts",
"version": "0.1.0",
"private": true,
```

Consumers, all inside this repository, all by `workspace:*`:

- `packages/test-runner/package.json:18`
- `packages/test-evidence/package.json:19`
- `packages/agent-orchestrator/package.json:22`
- `apps/scenario-lab/package.json:14`
- `apps/extension/package.json:10` (build step only, in the `test:content` script)

**Nothing outside the repository imports it.** A ripgrep of the sibling Core
checkout `F:\!FluxIQ` for the string `test-contracts` returns **no files**. The
dependency arrow points the other way only: `test-contracts` itself depends on
Core's public contracts package
(`"@fluxiq/contracts": "link:../../../!FluxIQ/packages/contracts"`), which is
the direction `AGENTS.md`'s facility-boundary rule requires.

Phase 7's `defer` verdict therefore still describes reality: still one
repository-local consumer group, still zero Core consumers.

## 5. Has the facility rotted since 2026-09-10?

**Verdict: no rot found. The plan document is stale; the code is not.**

I looked for each of the four rot signatures the brief names.

**(a) Imports of modules that no longer exist — none.** I resolved every
relative import across 1,525 TypeScript files in
`packages/test-runner/src`, `packages/test-contracts/src`,
`packages/test-matrix/src`, `apps/scenario-lab/src`, `apps/scenario-lab/e2e`
and `apps/extension/e2e`:

```
files scanned: 1525 unresolved relative imports: 1
UNRESOLVED packages/test-runner/src/tests/prerequisites.test.ts -> ./not-built.js
```

That single hit is **not rot** — it is a deliberate fixture. The specifier lives
inside a template string that writes a synthetic registry, to prove a registry
that cannot load keeps its own failure category:

```ts
// packages/test-runner/src/tests/prerequisites.test.ts:55-58
test("a registry that cannot load keeps its own failure rather than fixture.invalid", async () => {
  const unbuilt = await loadRegistry(`import "./not-built.js";\nexport function listScenarioManifests() { return []; }\n`);
  assert.equal(unbuilt instanceof RunnerFailure, false);
  assert.equal(classifyRunnerFailure(unbuilt), "environment.missing");
```

**(b) Scenarios referencing removed fixtures — none.** All 41 scenario
directories are registered and all 41 registered ids have a directory. Every
`scenarioId: "..."` literal in the runner and matrix sources was checked against
the registry; the only unregistered literals are fabricated ids inside unit-test
records, e.g.:

```ts
// packages/test-runner/src/bench/tests/shard-merge.test.ts:34-35
{ corpusRowId: "W01", scenarioId: "basic-form", ... },
{ corpusRowId: "W02", scenarioId: "modal-flow", ... },   // synthetic, never loaded
```

Others of the same kind: `broken-link` (bench-receipt.test.ts:10),
`other-scenario` (shard-merge.test.ts:149), `exploration-failure`
(demo-llm-create-ui/tests/exploration-failure-evidence.test.ts:26),
`storefront` (flow-lane/tests/declared-secrets.test.ts:108),
`diagnostic-test` (tests/browser-evidence.test.ts:15). None reaches the
registry. The real bench corpora
(`packages/test-runner/src/bench/corpus/{smoke,week1,bench-corpus}.ts`)
reference only registered ids.

The selector's path rules were checked too: every path prefix in
`selection-rules.ts:33-43` — `apps/extension/src/{content,runtime,background,shared,sidepanel,popup}`,
`apps/extension/scripts`, `domain/src/{recording,io,actions,output-nodes,runtime}` —
still exists on disk.

**(c) TODO / FIXME / `throw new Error('not implemented')` — none.** A
word-boundary scan of `packages/test-contracts/src`, `apps/scenario-lab/src`,
`apps/scenario-lab/e2e`, `packages/test-matrix/src` and
`packages/test-runner/src` for `TODO|FIXME|HACK|XXX` returns **zero** hits. A
scan for `not implemented|unimplemented|not yet implemented` returns exactly one
line, and it is an honest status string in a lane report, not a stub:

```ts
// packages/test-runner/src/panel-golden-path/lane.ts:134
{ stage: "repair_review_apply", status: "unverified", evidence: "review/apply is driven, but a human-readable structural diff is not implemented" },
```

**(d) Skipped tests — one, conditional on an OS capability.** Across all of
`packages/test-runner/src` and `apps/scenario-lab` there is exactly one skip:

```ts
// packages/test-runner/src/tests/secret-leak-attestation.test.ts:252
t.skip("symlink creation is unavailable");
```

That is a runtime guard for Windows hosts without symlink privilege, not a
disabled test.

**What *has* changed since 2026-09-10** is that development continued. Last
commit dates for the facility's own files:

```
2026-09-25  packages/test-contracts/src/index.ts
2026-09-21  apps/scenario-lab/src/registry.ts
2026-09-18  packages/test-runner/src/cli.ts
2026-09-13  packages/test-runner/src/scenarios.ts
2026-09-11  packages/test-matrix/src/selector.ts
2026-09-04  apps/extension/e2e/fixtures/extension-context.ts
2026-09-10  docs/working/automated-testing-facility-plan.md   <- frozen
```

The document is 18 days behind code that was touched as recently as three days
ago. That is the defect: a stale description, not a decayed facility.

**Phase 5 CI configuration still intact.** `.github/workflows/testing-facility.yml`
still drives the selector and both Xvfb lanes, and the jobs it names still
resolve:

- `:70` `pnpm --dir packages/test-matrix test` (package exists)
- `:86` `node packages/test-matrix/dist/cli.js --paths-file changed-files.txt --github-output` (`src/cli.ts` exists)
- `:204`/`:248` guard — `if(!p.scripts?.lab){ ... 'root package.json must define the Phase 5 lab CLI script' }` — root `package.json` does define `lab`
- `:212` `xvfb-run --auto-servernum pnpm lab matrix --scenarios-json "$FLUXIQ_SCENARIO_IDS" --repeat 1 --evidence failure`
- `:254` `xvfb-run --auto-servernum pnpm lab matrix --all --repeat 3 --evidence failure`

All of those flags are accepted by `parseLabCommand` today
(`commands.ts:55` allows `--all`, `--scenarios-json`, `--repeat`, `--evidence`).

**UNVERIFIED:** whether the Linux Xvfb lane and the scheduled three-repeat
baseline have ever *run*. The plan itself records them as not done, and nothing
in the tree tells me otherwise. I did not run CI.

## 6. Test count in `packages/test-runner` — the plan claims 116/116

**Verdict: FALSE as a current number; it is stale by roughly 12x. Not run —
counted only.**

| Measure | Count | How counted |
| --- | --- | --- |
| Test files | **228** | `find packages/test-runner/src -name "*.test.ts"` — all 228 sit under a `tests/` subfolder, per `AGENTS.md` placement |
| Test cases | **1428** | lines matching `^(void )?(test\|it)\(` in those files |
| `describe(` blocks | 2 | negligible nesting; the per-line count is a fair case count |

The count is a static one. I did not execute `pnpm --filter
@fluxiq-web-extension/test-runner test`, so **how many pass is UNVERIFIED** —
the brief said not to run them.

Largest files, for a sense of where the mass sits:

```
29  src/tests/commands.test.ts
28  src/flow-lane/tests/persisted-flow-run.test.ts
22  src/tests/existing-fluxiq-control.test.ts
22  src/live-llm/tests/live-llm-plan.test.ts
20  src/scenario-steps/tests/extract-intent.test.ts
20  src/run-evaluation/tests/runner-wiring.test.ts
19  src/flow-lane/tests/run-flow-lane.test.ts
19  src/bench/tests/run-bench.test.ts
```

Most of that mass — `flow-lane/`, `live-llm/`, `bench/`, `run-evaluation/`,
`run-expectations/`, `demo-llm-*` — is work from *after* this plan closed, which
is why 116 no longer describes anything.

---

## Claim-by-claim ledger for the audited rows

### Phase 0 — contracts and boundary lock (plan line 166, "validated")

| Claim | Verdict | Evidence |
| --- | --- | --- |
| Workspace wiring integrated | TRUE | `packages/test-contracts/package.json`; five in-repo `workspace:*` consumers |
| Fail-fast scenario/run/evidence/evaluation/comparison validation | TRUE | `src/{scenario,run-validation,evidence-validation,evaluation-validation}.ts`; `assertWebScenario` used at `test-runner/src/scenarios.ts:21` |
| "all 14 contract tests pass" | FALSE as a number | 15 files / **145** cases in `packages/test-contracts/tests/` today; pass/fail UNVERIFIED (not run) |
| Sanitized existing-FluxIQ execution provenance | UNVERIFIED | `src/run.ts` carries the manifest types; I did not trace the `fluxiqExecution` field end to end |

### Phase 1 — deterministic scenario lab (plan line 167, "validated")

| Claim | Verdict | Evidence |
| --- | --- | --- |
| "All ten deterministic loopback fixtures expose validated WebScenario manifests" | TRUE | `registry.ts:46-55`; `registry.ts:97-103` returns `scenario.manifest`; validated again at `scenarios.ts:21` |
| Cross-origin iframe behavior covered | TRUE | `e2e/scenario-pages.spec.ts:26-30` drives `Same-origin checkout` and `Cross-origin checkout` frames and asserts both |
| Synthetic secret non-retention covered | TRUE | `sensitive-input` scenario registered (`registry.ts:55`), covered in `scenario-pages.spec.ts`; selector tags it `redaction`/`security` (`selection-rules.ts:28`) |
| "all 16 direct tests pass" | FALSE as a number | 56 unit test files / **550** cases under `apps/scenario-lab/src`; pass/fail UNVERIFIED |

### Phase 2 — real extension fixture (plan line 168, "validated")

| Claim | Verdict | Evidence |
| --- | --- | --- |
| Fixture loads the freshly built E2E artifact | TRUE | `extension-context.ts:10,54,62-76` |
| Playwright 1.51.1 pinned | TRUE | `packages/test-runner/package.json` `"@playwright/test": "1.51.1"` |
| Chromium 134 | UNVERIFIED | a run-time property; nothing run |
| Enforced loopback-only networking | TRUE | `--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1` (:74) + `networkGuard.assertClean()` (:44) |
| "pass 8/8 on Windows" | TRUE as a count | 4 spec files, 8 `test(` cases; pass/fail UNVERIFIED |

### Phase 3 — isolated FluxIQ topology (plan line 169, "validated")

| Claim | Verdict | Evidence |
| --- | --- | --- |
| Topology/allocation/coordinator implemented | TRUE | `coordinator.ts` (332 lines, real process supervision — `ProcessSupervisor`, `waitForHttp`, `acquireWorkspaceOperationLock`), `allocation.ts` (281), `environment.ts` (73), `target-config.ts` (337, four modes: `isolated \| persistent-isolated \| existing \| clone`) |
| Bundle inspection passes | TRUE (code exists) | `inspect.ts:9-27` verifies `artifactIndexSha256` and rehashes every indexed artifact |
| Live run `run-mtnla9cz-a4da1119` proved Core-issued navigate/type | UNVERIFIED | a historical run record; not re-run here |
| "runner tests pass 13/13" | FALSE as a number | see §6 — 228 files / 1428 cases |

### Phase 5 — matrix and CI (plan line 171, "implemented and locally validated")

| Claim | Verdict | Evidence |
| --- | --- | --- |
| Ten-scenario corpus | TRUE, now 41 | §1 |
| "16/16 unit, 10/10 site-only Chromium" | FALSE as a number | 550 unit cases; 19 e2e spec files / 141 cases (`scenario-pages.spec.ts` alone now has 11) |
| Selector "5/5" | FALSE as a number | `packages/test-matrix/src/tests/` — 3 files, 17 cases |
| Finite `run`/`matrix`/`inspect`/`compare` CLI | TRUE | §2 |
| Windows headed lane | TRUE | `headless: false` at `extension-context.ts:63` and `run-scenario/browser-session/launch-browser.ts:17`; `.github/workflows/testing-facility.yml` `windows-latest` matrix leg (:136-137) |
| Linux Xvfb configuration complete | TRUE (configured) | `testing-facility.yml:134,212,254` |
| Linux execution + scheduled three-repeat baseline await CI | UNVERIFIED (consistent with the plan's own "Not done") | nothing in the tree shows a Linux run |

---

## What I did not verify

- **No test was executed and no lab run was started.** Every "N/N pass" in the
  plan is therefore UNVERIFIED here; I report counts, not results.
- **No type check or build was run**, so "the code compiles today" is not
  claimed. Import resolution was checked structurally (§5a), which is weaker.
- Phases 4 and 6-12 were out of brief and were not audited, except where a
  Phase 0-5 claim touched them (e.g. `compare` living under `bench/`).
- Historical run ids (`run-mtnla9cz-a4da1119`, `run-mtnlid1v-def3d560`,
  `run-mtnlixjt-05233872`, `run-mtnljjuj-097e55ff`) were not located or
  re-inspected under `test-runs/`.
- The plan's cross-repository claims about FluxIQ Core changes (workspace schema
  `0.3`, the PIN-authorized migration endpoint, Core test counts 542/542 and
  89/89) were out of scope; I only confirmed that Core does not import
  `test-contracts`.
- Whether `apps/scenario-lab/e2e/test-results/` (a committed
  `.last-run.json` and `report/index.html`) should be tracked at all — it looks
  like Playwright output under a `.gitignore`d app, but I did not check the
  ignore rules or the index, and generated-artifact policy was not in the brief.

## Open questions and contradictions found

1. **The document is 18 days stale and its numbers now mislead.** Every
   "N/N" in the Phase 0-5 rows understates the facility, most severely
   test-runner's 116 against 1428. A reader taking `Current State` at face
   value would badly under-estimate what exists. Recommend refreshing the
   counts and the "ten-scenario corpus" wording, or marking the row numbers as
   of-2026-09-10 snapshots.
2. **"Ten-scenario corpus" is now load-bearing language that is false.** Phase
   5's nightly CI lane runs `lab matrix --all --repeat 3`
   (`testing-facility.yml:254`), which today expands to 41 scenarios, not 10 —
   roughly four times the intended nightly cost. Nobody appears to have
   re-costed that lane as the corpus grew. Worth checking before the lane is
   next enabled.
3. **Thirteen registered scenarios have unit tests but no browser-level spec**
   (`auction-marketplace`, `bigbox-retail`, `company-directory`,
   `company-website`, `crossborder-marketplace`, `everything-store`,
   `instruction-only-form`, `job-board`, `photo-social`,
   `professional-network`, `property-listings`, `social-inbox`,
   `social-scheduler` — `auction-marketplace` has four unit test files and
   still no `e2e/*.spec.ts`). They are not dead, but the
   Phase 1 guarantee "every deterministic fixture behavior is exercised"
   (plan line 675) is no longer true at the browser level for the newer half of
   the corpus.
4. **`panel-golden-path/lane.ts:134` self-reports `status: "unverified"`** for
   `repair_review_apply`. That is outside Phases 0-5, but it is the only
   place in the audited tree where the code itself admits an incomplete stage,
   and no plan row mentions it.
