# Repository Layout And Commands

Reference detail for this repository's structure, generated-data tracking
policy, and validation commands. `AGENTS.md` carries the binding rules; this
document carries the specifics an agent needs only once it is working in a
particular area.

The rest of the authored architecture, by subject:
[extension client](extension-client.md) for the wire protocol and the
recording path, [web capabilities](web-capabilities.md) for what each browser
action does today, [element identity](element-identity.md) for how a target
becomes an element, [page evidence](page-evidence.md) for what a capture says
about the page, [the failure taxonomy](failure-taxonomy.md) for how a failure
is named, [sensitive values](sensitive-values.md) for what never leaves the
page, and [the automated testing facility](testing-facility.md) for the Lab.

## Package Structure

```text
apps/extension/
  src/background/   WebSocket session, tab routing, recording state, storage
  src/content/      DOM snapshots, target lookup, action execution
  src/content/evidence/  Page-level evidence producers, one per item
  src/content/identity/  Element identity signals, candidates, scoring, veto
  src/page-world/   Scripts injected into the page's own world
  src/popup/        Firefox popup fallback
  src/sidepanel/    Chrome/Edge recorder console
  src/runtime/      Browser-side runtime command and action handling
  src/shared/       Browser helpers, constants, and wire protocol types
  scripts/          Extension build and smoke-test scripts
  e2e/              Content-script harness suites (Playwright)
apps/scenario-lab/  Fixture websites the Testing Lab drives
domain/
  src/actions/      Web action contracts and capabilities
  src/client/       Gateway mappings and client capability declarations
  src/io/           Registered FluxIQ inputs, outputs, and gateway bridges
  src/output-nodes/ Web output node definitions and dispatch adapters
  src/page-evidence/  The page-evidence wire contract, declared once
  src/recording/    Events, reducers, observations, and web state conversion
  src/runtime/      Domain runtime service, commands, traces, and flow runner
  src/runtime/expectation/   Core's expectation seam, over web.dom.assert
  src/runtime/failure/       The closed web-automation failure code set
  src/runtime/llm-evidence/  The sanitized evidence packet a model reads
  src/sensitivity/  The one sensitivity rule and its adapters
  src/web-panel/    Web-panel host output-node integration
  src/web-panel-host.ts  Entry point of the web panel host (see below)
  scripts/          Web panel host build, FluxIQ setup, and domain test runner
packages/          Repository-local testing facility and tooling packages
docs/architecture/  Authored current-state architecture
docs/working/       Investigation and implementation working documents
scripts/            Repository-level FluxIQ panel launcher and Lab launcher
```

`domain/src/page-evidence/` and `domain/src/sensitivity/` sit at the top of
the package rather than under `recording/` or `runtime/` because both of those
read them, and putting either under one would make the other depend on it.
The testing packages are described in
[the automated testing facility](testing-facility.md).

## Responsibility Boundaries

The extension is a browser-side client. It captures browser presence and
recording evidence, sends state and domain events through FluxIQ's generic
WebSocket gateway, executes authorized browser actions, and retains only
lightweight local settings and session state. FluxIQ Core owns pairing,
authorization, durable projects and recordings, policy generation, Automation
Studio, and long-running orchestration.

- `apps/extension` owns browser APIs, DOM access, recorder UI, transient
  queues, and browser-side action execution.
- `domain` owns web-automation-specific FluxIQ contracts, manifests, state
  reducers, input/output mappings, action interfaces, and runtime adapters.
- Generic gateway and framework behavior belongs in FluxIQ Core, not here.
- Durable project, policy, and recording ownership belongs in FluxIQ Core, not
  extension-local storage.
- The extension may import domain contracts. Domain code must not depend on
  extension UI or browser implementation modules.

## Generated Data And Tracking Policy

Do not hand-edit generated or runtime state. Regenerate outputs through their
owning scripts.

| Path | Tracked | Notes |
| --- | --- | --- |
| `.fluxiq/` | No | Local configuration, caches, databases, recordings, project artifacts, and other runtime state. |
| `apps/extension/build/` | Yes | Intermediate bundles. Update by running the extension build when sources change. |
| `apps/extension/dist/` | No | Loadable Chrome and Firefox builds. |
| `domain/dist/` | No | Domain build output, including the web panel host module (`domain/package.json` `fluxiqHostModule`, today `dist/host/web-panel-host.mjs`), rebuilt by `host:build`, `pnpm dev`, and every isolated Testing Lab run. The build also runs `scripts/clean-dist.mjs` and `scripts/rewrite-dist-specifiers.mjs`: `tsc` overwrites but never deletes, so a module split can leave a stale sibling behind that a later import resolves to, and `tsc` never rewrites a specifier, so the extensionless relative specifiers `moduleResolution: "Bundler"` allows in `domain/src` have to be given explicit paths in the output. The clean step deliberately preserves `dist/host/web-panel-host.mjs`, which `pnpm lab:interactive` builds before the workspace build reaches this package. A Lab instance runs from its own copy of that bundle, so a sibling instance's build cannot rewrite the file a running Core is about to import. |
| `domain/.test-build/` | Yes | Generated domain-test artifacts. Let the domain test/build workflow update them. |
| `domain/.script-build/` | No | esbuild bundle of the FluxIQ setup CLI, regenerated by `pnpm fluxiq:setup` and `pnpm dev`. Tracked by mistake until 2026-09-10; each ~22 MB rebuild was committed again, bloating history to 294 MB and breaking pushes. Never commit it. |
| `<package>/.lab-instances/<instance>/` | No | One concurrent Lab instance's own build output, under the package that produced it. Written only by `scripts/lab/run-lab.mjs`; removable at any time. |
| `.lab-locks/` | No | The file lock that serializes the Lab build phase across instances. |
| `test-runs/`, `test-runs/instances/<instance>/` | No | Lab run evidence. An instance writes under its own subdirectory. |

## Running Several Labs At Once

The Lab supports concurrent instances -- one per agent or terminal.
`FLUXIQ_LAB_INSTANCE` names an instance, on the same convention as
`EXTENSION_TEST_BUILD_LABEL` and `DOMAIN_TEST_BUILD_LABEL`: lowercase
kebab-case, at most 64 characters. Set it and nothing else:

```bash
FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_INSTANCE=lab-a pnpm lab run basic-form --target isolated
FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_INSTANCE=lab-b pnpm lab run basic-form --target isolated
```

With the variable unset, every path is exactly what it was before instances
existed, so a single `pnpm lab` is unchanged.

**What an instance owns.** `pnpm lab` and `pnpm lab:interactive` both run
through `scripts/lab/run-lab.mjs`, which builds and then runs.
`scripts/lab/lab-instance.mjs` is the one place a label becomes a path:

| Output | Default | Instance `lab-a` |
| --- | --- | --- |
| Extension bundles and unpacked targets | `apps/extension/build/`, `apps/extension/dist/` | `apps/extension/.lab-instances/lab-a/{build,dist}/` |
| Scenario lab | `apps/scenario-lab/dist/` | `apps/scenario-lab/.lab-instances/lab-a/dist/` |
| Web panel host | `domain/dist/host/web-panel-host.mjs` | `domain/.lab-instances/lab-a/host/web-panel-host.mjs` |
| Run evidence | `test-runs/` | `test-runs/instances/lab-a/` |

The launcher exports the absolute results as `FLUXIQ_LAB_EXTENSION_PATH`,
`FLUXIQ_LAB_SCENARIO_ENTRYPOINT`, and `FLUXIQ_LAB_HOST_MODULE`, and the runner
reads those rather than recomputing them, so what runs cannot disagree with
what was built. `FLUXIQ_LAB_INSTANCE` set without them -- a bare
`node packages/test-runner/dist/cli.js` -- is refused rather than silently run
against the shared build. `FLUXIQ_TEST_RUNS_DIR`, when set, still wins over the
instance's run directory. A run manifest's `extension.path` records the build
the run actually loaded, so two instances' manifests name different directories.

**Why per-instance and not one shared build.** Two instances started at
different moments can legitimately need different bytes: an agent edits
`apps/extension/src` while another instance is mid-run, and the next instance
must pick the edit up while the running one keeps the extension Chromium
already loaded. A single shared `dist/` cannot do both -- the destructive
`rm` at the top of `apps/extension/scripts/build-extension.mjs` deletes the
unpacked extension a running browser is reading. In instance mode that script
writes under `FLUXIQ_LAB_EXTENSION_BUILD_ROOT` instead, so the tracked
`apps/extension/build/` is refreshed only by the default build.

An instance's output lives **inside the package that produced it**, not in one
directory at the repository root. The compiled scenario lab imports
`@fluxiq-web-extension/test-contracts` and the host bundle imports
`fluxiq/automation-studio`, both as bare specifiers, and Node resolves those by
walking up from the importing file. Only a directory under the owning package
reaches that package's `node_modules`; a root-level instance directory resolves
nothing, because pnpm hoists neither name to the repository root.

**Why the build phase is still serialized.** The workspace TypeScript builds
(`domain`, `test-contracts`, `test-evidence`, `test-runner`) write shared
package `dist/` directories that no label can move. `scripts/lab/build-lock.mjs`
holds one repository-wide lock at `.lab-locks/build.lock` for the build phase
only: instances build one after another and then run in parallel. A lock whose
process is gone is reclaimed. An instance waiting on the lock says so on stderr.

**What limits concurrency.** Each instance runs a headed Chromium, a Next.js
Core dev server, and a scenario lab, so RAM and CPU bind long before anything
in the Lab does. Loopback ports are allocated ephemerally per run and a run's
own ports cannot collide, but between allocation and the child's bind two
instances could in principle be handed the same port; that surfaces as a
startup failure, not silent overlap. `pnpm lab inspect <runId>` resolves runs
inside the current instance's run directory, so inspect with the same
`FLUXIQ_LAB_INSTANCE` that produced the run.

### Consuming the domain package

`@fluxiq-web-extension/domain` exposes three entry points. `.` and `./client`
resolve to TypeScript source and are for bundler consumers — the extension
content bundle, the panel host, and the Testing Lab. `./node` resolves to the
built `dist` (`types` and `default` both) and is for a plain Node ESM or
`NodeNext` consumer such as `packages/test-runner`, which imports the shared
evidence vocabulary from it rather than restating it; two hand-maintained
copies had silently drifted before it could:

```ts
import { WEB_LLM_EVIDENCE_RESULT_CODES, WEB_LLM_EVIDENCE_TOOL_IDS } from "@fluxiq-web-extension/domain/node";
```

The subpath is what makes that import resolvable: the domain's own sources use
the extensionless relative specifiers `moduleResolution: "Bundler"` allows, and
`scripts/rewrite-dist-specifiers.mjs` gives the emitted `dist` explicit `.js`
paths a Node resolver can follow.

`.` was deliberately **not** made a conditional map. TypeScript's `Bundler`
resolution omits the `node` condition, but esbuild with `platform: "node"` sets
it, so a conditional `.` would silently switch those consumers from source to a
possibly stale `dist`.

A `./node` consumer needs `domain/dist` to exist, and a fresh clone has none:
without it `packages/test-runner` fails with `TS7016`. That package therefore
guards its own `build` and `check` with a `domain:dist` script — if
`domain/dist/index.d.ts` is absent it builds the domain once and says so; if it
is present it does nothing. The root `pnpm check` has no build step of its own;
that guard, reached through `pnpm -r check`, is the only build it can trigger,
and only on a tree that has none.

The guard is written to fire only when there is nothing to disturb. A
verification command must not rewrite a build artifact another process may be
loading: an isolated Testing Lab run builds the domain before it starts, so a
`pnpm check` overlapping that run finds a `dist` and leaves it alone, and
concurrent checks cannot race each other inside `dist` either. Two consequences
follow.

- **`pnpm check` does not refresh `domain/dist`.** It proves the declarations
  exist, not that they match `domain/src`. After changing `domain/src`, run
  `pnpm --filter @fluxiq-web-extension/domain build` before trusting the
  `packages/test-runner` typecheck or `pnpm test`, both of which read the built
  output. The domain's own `check` always reads source, so errors in `domain/src`
  still surface on every run.
- **Deleting `domain/dist` outright also deletes the panel host bundle.** The
  domain build does not regenerate `dist/host/web-panel-host.mjs`;
  `pnpm fluxiq:host:build` does. The clean step inside the build preserves it,
  so an ordinary rebuild is safe — a manual `rm -rf` is not.

Both consequences disappear once `domain/src` carries explicit `.js` relative
specifiers, after which `./node` can take types from source the way
`packages/test-contracts` already does and no build is needed to typecheck a
consumer. A consumer-side `paths` mapping cannot substitute: `domain/package.json`
declares `"type": "module"`, so a `NodeNext` consumer reading `domain/src`
rejects every extensionless relative specifier with `TS2834`/`TS2835`.

## Validation Commands

Workspace level:

```bash
pnpm check
pnpm test
pnpm build
```

Package level, for focused work:

```bash
pnpm --filter @fluxiq-web-extension/domain check
pnpm --filter @fluxiq-web-extension/domain test
pnpm --filter @fluxiq-web-extension/domain host:build
pnpm --filter @fluxiq-web-extension/extension check
pnpm --filter @fluxiq-web-extension/extension test
pnpm --filter @fluxiq-web-extension/extension build
```

The extension build writes unpacked targets to `apps/extension/dist/chrome`
and `apps/extension/dist/firefox`, or under `FLUXIQ_LAB_EXTENSION_BUILD_ROOT`
when a Lab instance owns the build. `pnpm lab:test` runs the launcher's own
tests and is part of `pnpm check`.

## Panel Commands

`pnpm dev` builds the web panel host, runs repository-local FluxIQ setup, and
starts the panel with this repository as `FLUXIQ_ROOT` and
`FLUXIQ_HOST_MODULE` pointing at the host. `pnpm fluxiq:setup` prepares local
FluxIQ state without starting the panel. Per `AGENTS.md`, do not start the
panel unless the user has authorized panel management for the session.

## Web Panel Host

`domain/src/web-panel-host.ts` is the module FluxIQ Core's web panel loads to
register the web-automation domain, its IO, its recording domain, and its
native output-node runtime. `domain/scripts/build-web-panel-host.mjs` bundles
it as an ES module with every FluxIQ package external. The host therefore
reaches Core only through public entry points (`fluxiq`, `fluxiq/core`,
`fluxiq/automation-studio`), never through a deep `dist` path. Core's panel
imports the file named by `FLUXIQ_HOST_MODULE` with a native `import()` once at
startup. The host must be an ES module because FluxIQ packages are ESM-only:
their exports declare only the `import` condition, so a CommonJS host cannot
resolve `fluxiq/automation-studio`.

The host's path is declared once, as `fluxiqHostModule` in
`domain/package.json`, relative to the domain package. The host build writes
that file. Every launcher reads the same field: `scripts/run-fluxiq-web.mjs`
(`pnpm dev`), and the Testing Lab's isolated and demo topologies through
`webPanelHostModulePath` in `packages/test-runner/src/environment.ts`. Rename
or move the host by changing that field, never by hard-coding a path.

## FluxIQ Core Linkage

Workspace packages link to FluxIQ Core packages in the sibling `F:\!FluxIQ`
checkout via `link:` dependencies declared in `domain/package.json`. Core
source edits are therefore visible here immediately, but a Core package that
resolves through a build output must be rebuilt before type checks here mean
anything. The web panel host resolves `fluxiq/*` through the same link at
runtime, against Core's built `dist/`.
