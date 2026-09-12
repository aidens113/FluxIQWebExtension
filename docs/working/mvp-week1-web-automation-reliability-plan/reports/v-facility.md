# v-facility — What the testing facility can actually do today

Read-and-analyse only. No source, test, or configuration was changed, and **no
Lab command was run**. Every claim below is sourced to a file and line, to
measured data already on disk under `test-runs/`, or is explicitly marked as an
inference.

---

## 0. Read this first: three things that change the plan

**(a) The real, unpacked MV3 extension is loaded and driven, in two independent
places, and both work today.** This is the single most important answer in the
brief. There is no missing "T3 rig" to build. "T3" is not a facility feature at
all — it is a *tier label* the plan invented
(`mvp-week1-web-automation-reliability-plan.md:269`) for "extension + Core +
gateway", i.e. `pnpm lab run` and `pnpm lab bench`. Detail in §3.

**(b) On this machine, every isolated Lab command MUST be prefixed with
`FLUXIQ_TEST_ENV_FILES=none`, or it will not run at all.** `.env.local` sets
`FLUXIQ_TEST_TARGET=existing`. Consequences, from
`packages/test-runner/src/target-config.ts:66-70`:

- `pnpm lab run basic-form` → resolves target `existing` → throws
  `FLUXIQ_TEST_PROJECT_ID is required for an existing or clone target`.
- `pnpm lab run basic-form --target isolated` → throws
  `--target isolated conflicts with FLUXIQ_TEST_TARGET=existing`.

Both are hard failures before anything starts, so the default is *fail-safe*,
not dangerous — but nothing isolated will run until the prefix is set. This
applies to `run`, `matrix`, `bench` and `interactive` alike.

**(c) `pnpm lab bench --corpus week1 --repeat 3` does NOT emit every metric the
plan's Metrics table lists, and cannot today.** It runs 23 of the corpus's 43
results and skips 20; four of the ten metric rows come back `null` and a fifth
is populated for only 7 of the 23 rows. Numbers, causes and the code that
produces them are in §5. This is the second finding that most affects Phase 1.6.

---

## 1. The `pnpm lab` CLI: every verb and flag

Source of truth: `packages/test-runner/src/commands.ts` (parser) and
`packages/test-runner/src/cli.ts` (dispatch). `pnpm lab` is
`package.json:lab` — it builds `scenario-lab`, then
`extension test:e2e:build` (a full `pnpm build` of the extension), then
`test-runner...` (which pulls in `domain`, `test-contracts`, `test-evidence`),
then runs `node packages/test-runner/dist/cli.js`. **The rebuild is part of
every `pnpm lab` invocation** — see §7 for why that is the main concurrency
hazard.

Exit codes: `0` pass, `1` on a failed run, invalid input, or a `compare` verdict
of `regressed`. All output is one line of JSON on stdout; errors are one line of
JSON on stderr with a `category` from `classifyRunnerFailure`.

### 1.1 `run <scenario-id>` — one scenario, one run

| Flag | Value | Meaning |
| --- | --- | --- |
| `--seed N` | uint32 | Scenario Lab seed. Defaults to the manifest's own `seed`. |
| `--evidence MODE` | `none`\|`failure`\|`checkpoints`\|`events` | Overrides the manifest's `evidencePolicy`. Absent ⇒ manifest drives capture. |
| `--workflow ID` | kebab-case | Selects a `workflows[]` entry. Absent ⇒ the manifest's primary workflow. |
| `--variant ID` | kebab-case | Arms a variant. **Requires the `--flow` lane flag** (`commands.ts:44`). |
| `--flow` (no value) | — | **Flow lane**: build a Flow from this run's own recording via Core's public proposal API, then execute it. |
| `--flow <id>` | Flow id | **Different meaning**: on `existing`/`clone`, names the pre-existing persisted Flow to run. |
| `--target MODE` | `isolated`\|`persistent-isolated`\|`existing`\|`clone` | Topology. Default `isolated` (or `FLUXIQ_TEST_TARGET`). |
| `--workspace NAME` | safe name | Required with, and only with, `--target persistent-isolated`. |
| `--fresh-login` | — | Bypasses the cached auth session. `existing`/`clone` only. |
| `--live-llm` + 11 `--llm-*` flags | — | Parsed, then **hard-rejected** at `cli.ts:53`: *"Live LLM execution is fail-closed until the Phase 1 provider runner is enabled"*. |

**The `--flow` dual meaning is a genuine trap.** `flowLaneOption`
(`commands.ts:159-166`) disambiguates by lookahead: a `--flow` at the end of the
argument list, or followed by another `--option`, is the *lane flag*; a `--flow`
followed by a bare word is the *Flow id*. So
`lab run product-catalog --workflow search --variant no-results --flow` runs the
Flow lane, and `lab run basic-form --target existing --flow abc123` runs Flow
`abc123`. Put the lane flag last and it is unambiguous.

Guards worth knowing: `--flow` (lane) is rejected on `existing`/`clone`
(`commands.ts:41`); `--workspace` requires `persistent-isolated` and
`persistent-isolated` requires `--workspace` (`commands.ts:236-237`);
`persistent-isolated` rejects `--flow <id>` and `--fresh-login`.

### 1.2 `matrix (--all | --scenarios-json JSON)`

`--repeat N` (1–100, default 1), plus `--evidence`, `--target`, `--workspace`,
`--flow <id>`, `--fresh-login`. Runs each scenario `N` times sequentially
(`cli.ts:66`), emitting one JSON object with `status` and every run.

`--all` expands to **the whole registry (22 scenarios)**, not the corpus. That
includes `instruction-only-form`, whose `recordingScript` is empty, plus
`reconnect`, `llm-target-drift`, `long-document`, `dynamic-list` and
`sensitive-input`. **I have no evidence any of those six pass on the Lab lane
today** — they are not in the `week1` corpus and no report I read claims a green
`matrix --all`. Treat `--all` as unproven; prefer `bench` or explicit
`--scenarios-json`.

### 1.3 `bench --corpus ID` — FluxBench

Options only, no positionals (`commands.ts:72`). `--corpus ID` required
(lowercase kebab; known ids are `week1` and `smoke`). `--repeat N` 1–100
(default 1). `--evidence MODE`. `--target isolated|persistent-isolated` — the
parser rejects `existing` and `clone` outright with *"bench runs the recording
lane"*. `--workspace NAME` with `persistent-isolated`.

Writes `<runs>/bench/<bench-id>/` containing `runs.json` (rewritten after every
run, so a killed bench still has partial results), one `RunEvaluation` JSON per
run, `report.json` (a `BenchReport`), and `report.md`. Exit 0 only if at least
one run was evaluated **and every evaluated run passed**
(`bench/run-bench.ts:119`).

### 1.4 `compare`

`lab compare <baseline-report> <candidate-report>` or
`lab compare <report> --halves`. A "report" is a bench id, or a path to a
`report.json` or to the bench directory holding one
(`bench/load-report.ts:18`). `--halves` splits one bench's repeats into the
first `ceil(N/2)` and the rest and compares them, which is the repeatability
check — it needs `--repeat ≥ 2`. Exit 1 when the overall outcome is `regressed`.

### 1.5 `inspect <run-id>`, `auth status|clear`, `clone-cache status|refresh|clear`, `interactive <scenario>`

- `inspect` re-hashes every artifact in a finalized bundle against
  `artifact-index.json` and re-parses `run.json`. Cheap, offline, no browser.
  Note it does **not** reject unknown options (no `rejectUnknownOptions` call).
- `auth`/`clone-cache` require `FLUXIQ_TEST_TARGET=existing` or `clone` plus
  `FLUXIQ_TEST_BASE_URL` and `FLUXIQ_TEST_USERNAME` (`target-config.ts:158`);
  `clone-cache` additionally requires `clone` and both ids.
- `interactive` accepts `--seed`, `--target` (clone rejected), `--workspace`,
  `--fresh-login`. No `--flow`, no `--evidence`. It launches the whole topology
  once and then reads newline-delimited JSON commands from stdin until `stop`.
  Unlike the finite verbs it *deliberately ignores* an unrelated existing-target
  profile when `--target isolated|persistent-isolated` is explicit
  (`target-config.ts:117-133`) — so **`pnpm lab:interactive` is the one command
  that does not need the `FLUXIQ_TEST_ENV_FILES=none` prefix**, provided
  `--target` is given explicitly.

### 1.6 Where the documentation disagrees with the code

| Doc | Says | Code says |
| --- | --- | --- |
| `docs/architecture/testing-facility.md:293` | "`compare` validates two **bundles** and emits a contract-checked candidate comparison" | `compare` takes bench **reports**, never bundles (`bench/load-report.ts`). The same document contradicts itself correctly at line 965. |
| `testing-facility.md:184` | "isolated mode does not synthesize or persist a FluxIQ Flow" | **Stale.** `lab run --flow` on `isolated` does exactly that, through `runFlowLane` (`flow-lane/run-flow-lane.ts`). |
| `testing-facility.md` (whole file) | — | `--workflow`, `--variant`, and the bare `--flow` lane flag are **not documented anywhere**. The Flow lane is the only way to run a corpus variant, and a reader of the architecture doc would not know it exists. |
| `testing-facility.md:289` | Lists the CLI as "run, matrix, auth, inspect, compare" | Omits `bench`, `clone-cache`, `interactive`. `bench` appears only once in the whole document, in a code block at line 961. |
| `mvp-week1…plan.md:269` | corpus ×3 ≈ 45 min | Measured data says 60–110 min. See §5.5. |

---

## 2. The four topologies

### 2.1 `isolated` — the default, and the safe one

`coordinator.ts:startTopology` + `allocation.ts:allocateRun`. Per run it:

1. allocates `test-runs/.work/<run-id>/` with `fluxiq-root/.fluxiq/`,
   `core-workspace/apps/web/`, `browser-profile/`, `logs/`;
2. allocates three random loopback ports and a random 32-byte controller token;
3. builds the web-panel host (`domain/scripts/build-web-panel-host.mjs`) —
   **every run**, unless `prepareHost: false`, which `runScenario` never passes;
4. copies Core's `apps/web` into the run directory, junction-links its
   `node_modules` and `packages`, writes a `next.config.mjs`;
5. starts the Scenario Lab (`node apps/scenario-lab/dist/server.js`);
6. starts Core as `next dev --turbopack --hostname 127.0.0.1 --port <random>`;
7. probes the panel, pokes `/api/client-gateway/snapshot` to force lazy gateway
   creation, then TCP-polls the gateway port;
8. bootstraps a **random** admin identity + PIN through Core's public API when
   the scenario requires Core, and creates a disposable project `E2E <run-id>`.

**Requires beforehand:** the sibling Core checkout with installed dependencies
(`F:\!FluxIQ`, present and verified), `apps/scenario-lab/dist/server.js`,
`apps/extension/dist/e2e-chromium/manifest.json`,
`domain/dist/host/web-panel-host.mjs`, and a Playwright Chromium download
(`chromium-1234` is installed).

**State touched:** only `test-runs/`. Nothing outside it. `.fluxiq/` at the
repository root — the user's real install data — is never opened.

**Destructive?** No. `removeAllocatedRunRoot` refuses to delete any directory
whose resolved path is not exactly `<base>/<runId>` (`coordinator.ts:192`). The
finalized evidence bundle at `test-runs/<run-id>/` is kept.

**Cost:** measured 45–72 s per run, mean ≈ 57 s (eight `smoke` benches on
2026-09-11/12; the run's own `finishedAt − startedAt` has p50 51.1 s, p95
57.2 s). Dominated by per-run Core startup, not by the scenario.

### 2.2 `persistent-isolated` — retains state between runs

`allocation.ts:allocatePersistentRun`. Splits retained state from disposable
state: `test-runs/persistent-isolated/<workspace>/` keeps `fluxiq-root/.fluxiq/`
(projects, recordings, run history), `browser-profile/` (Chromium + extension
state), and `.identity/credentials.json` (a generated admin whose file is ACL'd
to the current user only); `.sessions/<run-id>/` holds the Core web copy and
logs and is removed after each invocation.

**Requires beforehand:** everything `isolated` requires, plus a `--workspace`
name. Names must match `^[a-z0-9]([a-z0-9._-]{0,62}[a-z0-9])?$`, must not be a
Windows device name, and must not be `persistent-isolated` or `sessions`.

**Concurrency:** one invocation may own a named workspace at a time
(`workspace-lock.ts`, acquired before Core or Chromium start). Different
workspace names are independent as far as the lock is concerned.

**Cost:** the same per-run Core startup as `isolated`, minus identity bootstrap
and project creation. My inference: a few seconds cheaper per run, no more —
the expensive part (per-session Core web copy + `next dev` cold start) is not
avoided, because `.next` is excluded from the copy and the copy lives under
`.sessions/<run-id>`. **Not verified by measurement.**

**⚠ Destructive risk — the one place a human can destroy state.** There is no
reset command. The documented way to clean a workspace is to delete
`test-runs/persistent-isolated/<workspace>` by hand
(`testing-facility.md:284-292`). **Three workspaces already exist on this
machine and must not be deleted:** `interactive-smoke`, `interactive-smoke-2`,
`llm-dev`. `llm-dev` in particular is the demo/LLM-certification workspace and
holds a paired browser profile and a stored identity. If Week 1 validation wants
a persistent workspace, create a **new** name; never reuse or clear those three.

### 2.3 `existing` — attaches to the user's real FluxIQ install

`coordinator.ts:startExistingTopology`. It does **not** start, stop, build,
bootstrap, reset, or delete the external installation. It starts only its own
Scenario Lab and Chromium, pairs the extension to the external gateway, selects
the configured project, **starts a recording**, and **executes a configured
pre-existing persisted Flow** in deterministic/dry-LLM mode with external side
effects disabled.

**⚠ This is the one topology that writes into the user's real data.** On this
machine `FLUXIQ_TEST_BASE_URL=http://127.0.0.1:3000` and the panel launcher
(`scripts/run-fluxiq-web.mjs:20`) sets `FLUXIQ_ROOT` to the repository root — so
"the existing install" is `F:\!FluxIQWebExtension\.fluxiq\`. A successful
`existing` run appends **a durable recording and durable run/attempt history**
to the user's real project. It deletes nothing, but it is not read-only.

**It cannot run today anyway, and that is a safety feature.** `.env.local` has
no `FLUXIQ_TEST_PROJECT_ID` and no `FLUXIQ_TEST_FLOW_ID`, both of which
`target-config.ts:97-99` requires. Attempting `--target existing` fails
immediately. Two further reasons not to use it for Week 1:

- it requires the user's panel to be running at `127.0.0.1:3000`, which
  `AGENTS.md` says not to start without explicit authorization;
- `testing-facility.md:167` states the path "has not yet been reported as
  validated against a live existing installation". It has mocked/unit coverage
  only. Debugging it would be a project in itself.

**Recommendation: do not use `existing` for Week 1 live validation.** Nothing in
the Week 1 objective needs it, and everything it would prove is proven more
cheaply on `isolated`.

### 2.4 `clone` — read the real install, execute a copy in isolation

Logs in to the external installation as a **read-only source**, exports and
validates one Flow document, classifies its dependencies against what an
isolated Core can provide, then starts the ordinary isolated topology and
imports a deterministically remapped copy through Core's public
create/save/read APIs. Only the isolated copy is paired, executed, recorded and
panel-verified. After the run it re-reads the source and records
`sourceHashVerifiedAfterRun` (`run-scenario.ts:338-340`), i.e. it proves it did
not mutate the source.

**Requires:** the same `existing` configuration (`PROJECT_ID`, `FLOW_ID`,
credentials — but *not* `FLUXIQ_TEST_PIN`, since it never executes on the
source) plus the panel running. Caches clone packages under
`test-runs/.clone-cache`.

**Safety:** does not write to the source, but it does authenticate to it and
writes an auth-session cache entry under `test-runs/.auth`. Not destructive.
**Not needed for Week 1** — no Week 1 exit criterion involves a pre-existing
user Flow.

### 2.5 Which are safe against the user's real install

| Topology | Safe against the real FluxIQ install? | Verdict for Week 1 |
| --- | --- | --- |
| `isolated` | Does not touch it at all | **Use this.** |
| `persistent-isolated` | Does not touch it; ⚠ its own retained workspaces are hand-deleted only | Use only with a *new* workspace name, if at all |
| `clone` | Reads it; proves the source hash unchanged | Not needed |
| `existing` | **Writes durable recordings and run history into it** | **Do not use.** Also unproven, also currently unconfigurable |

---

## 3. Yes — a real unpacked extension is loaded and driven

Two independent drivers exist, both real, both working, and they are different
things.

### 3.1 The Lab (`pnpm lab run` / `bench`) — extension + Core + gateway

`run-scenario.ts:86` computes `apps/extension/dist/e2e-chromium`, `:88` fails
closed if `manifest.json` is missing (`environment.missing: Built E2E extension
is missing`), and `:393-395` launches it:

```
chromium.launchPersistentContext(topology.allocation.browserProfileDir, {
  headless: false, …,
  args: [`--disable-extensions-except=${extensionPath}`,
         `--load-extension=${extensionPath}`, "--no-first-run",
         "--disable-default-apps"] })
```

It then waits for the MV3 service worker (`:397`), derives the extension id from
the worker URL, opens `chrome-extension://<id>/sidepanel/index.html` as its
control page, and from then on speaks to the extension through
`chrome.runtime.sendMessage` from that page (`:460`) — `fluxiq.startRecording`,
`fluxiq.getStatus`, `fluxiq.stopRecording` — and through `chrome.tabs.query` /
`chrome.tabs.update` to activate the scenario tab (`:436`).

So a Lab run genuinely exercises: MV3 service worker boot, side-panel UI,
`chrome.tabs` routing, pairing to Core's gateway over a real WebSocket,
`client.start_recording`, content-script injection into the scenario page and
its frames, recording persistence in Core, and — on the 7 rows that have a
qualifying `type` step — a Core-issued `web.browser.navigate` and `web.dom.type`
dispatched through the production client-action API and asserted against page
state (`proveCoreActionRoundTrip`, `run-scenario.ts:405-432`).

Headed only: `headless: false` is hard-coded. It also calls
`page.bringToFront()`, so it needs the foreground of a real desktop.

**Proof it works today:** eight `smoke` benches on disk, the newest
`test-runs/bench/bench-mtxoim0b-8ca4952c` (2026-09-12T01:01Z), all four runs
`evaluated / passed`, no `problems`.

### 3.2 The extension Playwright suite (`test:e2e`) — extension only, no Core

`apps/extension/e2e/fixtures/extension-context.ts:62-76` does the same
`--load-extension` launch against `dist/e2e-chromium` (overridable with
`FLUXIQ_E2E_EXTENSION_PATH`), also `headless: false`, plus
`--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1`
and a deterministic network guard that fails the test on any unexpected
destination. It hashes the artifact directory and attaches
`extension-build.json` to the test.

Six tests, run by `pnpm --filter @fluxiq-web-extension/extension test:e2e`:

- `install-and-content.spec.ts` — loads the MV3 artifact and its extension page;
  injects the content script into a loopback page;
- `action.spec.ts` — executes actions through the real content-script message
  path (i.e. **background worker → content script**, the one hop the content
  harness cannot see);
- `resilience-and-isolation.spec.ts` — **kills the MV3 service worker via CDP
  `Target.closeTarget` and proves it restarts and answers a production
  readiness message** (`restartServiceWorker`); proves the profile is fresh and
  removed;
- `network-policy.spec.ts` — allowlist unit checks plus a real aborted request.

This suite is small but it is the only thing that proves MV3 worker lifecycle.
It needs no Core, no panel, no credentials, and takes well under a minute
(inference; not measured).

### 3.3 A third driver, for completeness

`demo-workspace/browser-session.ts:47-58` loads `apps/extension/dist/chrome`
(not the e2e artifact) into the persistent demo workspace, **headless by
default**. That is the `pnpm demo:*` / LLM-certification path. It is not part of
Week 1 validation and it owns the `llm-dev` workspace — leave it alone.

### 3.4 What is *not* covered by any real-extension driver

**Firefox.** `apps/extension/dist/firefox` is built by every extension build and
loaded by nothing. There is no automated Firefox popup coverage at all.

---

## 4. The content harness — exactly where its proof stops

`apps/extension/e2e/playwright.content.config.ts` + `e2e/content/`. 18 spec
files; the plan's Current State records **186 passed at `--workers=4`** on
2026-09-12. Run with `pnpm --filter @fluxiq-web-extension/extension test:content`.

**What it is.** `global-setup.ts` bundles `src/content/index.ts` and
`src/page-world/index.ts` with the extension's own esbuild settings
(`bundleExtensionEntry`) into a per-run directory
`e2e/content/.harness-build/run-<pid>-<ts>/`. Each spec starts a **real Scenario
Lab in-process** (`startScenarioLab`), opens a real fixture page in headless
Chromium, injects the page-world bundle then the content bundle, and installs a
`chrome.runtime` stub. The spec then sends the content script exactly the
messages the background worker sends — `executeAction`, `captureSnapshot`,
`recording` — and reads back every message the content script tried to send.

**What it therefore proves:** real DOM semantics — layout, `elementFromPoint`,
`isTrusted`, focus, actionability, target resolution, action verbs, snapshot
capture, recording-event emission, redaction of sensitive fields — against real
fixture markup, with the real bundle.

**What it proves nothing about** (the harness's own header comment,
`harness.ts:11-21`, states this):

1. **The background service worker.** It does not exist in this harness. Nothing
   about MV3 lifecycle, wake-up, or state is exercised.
2. **Delivery between extension contexts.** `chrome.runtime.sendMessage` is a
   stub that pushes a JSON copy onto an array and resolves `undefined`
   (`runtime-stub.ts:25-28`). No message ever crosses a process boundary.
3. **Tab and frame routing.** Messages go to and come from the **top frame
   only**. `chrome.tabs.sendMessage` into an out-of-process iframe is untested.
4. **The gateway, pairing, and Core.** No WebSocket, no Core, no project, no
   recording persistence.
5. **World isolation.** The bundle runs in the page's **main** world, not an
   isolated one, so anything depending on world separation is not faithful. (The
   page-world script must be injected *before* the runtime stub for exactly this
   reason.)
6. **The built artifact.** It bundles from source; it never reads
   `dist/e2e-chromium`.

So: a green content harness plus a red Lab run localises the fault to the
background/gateway path, and that is precisely how the two should be sequenced.

**Concurrency note in its favour:** the harness builds into a directory it owns
and `build-extension.mjs` refuses to delete `dist/` or rewrite `build/` unless
it is the process entry point (`build-extension.mjs:178-190`). It is therefore
*designed* to survive a concurrent `pnpm build`.

---

## 5. FluxBench: `week1` and `smoke`

### 5.1 What the corpora contain

`bench/corpus/week1.ts` — rows W01…W28 over 16 fixtures.
`bench/corpus/smoke.ts` — exactly two rows taken by reference from `week1`:
**W01 `basic-form`** and **W28 `iframe-checkout`**, both unarmed, both proven
live on `isolated`.

### 5.2 What `bench` actually runs — measured, not inferred

I expanded the corpus against the built registry
(`apps/scenario-lab/dist/registry.js`) using the facility's own `expandCorpus`:

```
total plan entries 43   runnable 23   skipped 20
```

**23 runnable results** (the unarmed workflow of every row except W19–W23):

W01 basic-form · W02 keyboard-forms · W03 keyboard-forms/combobox ·
W04 product-catalog · W05 …/paginated-extraction · W06 …/search ·
W07 …/in-stock-only · W08 data-table · W09 …/sort-by-price · W10 navigation ·
W11 infinite-feed · W12 modal-flows · W13 …/consent-then-click ·
W14 …/interstitial · W15 multi-tab · W16 file-transfer · W17 …/upload ·
W18 auth-gate · W24 intermediate-state · W25 delayed-ui · W26 ambiguous-targets ·
W27 failure-surfaces · W28 iframe-checkout

**20 skipped results**, for two different reasons:

- **14 skipped because variants are Flow-lane-only.** `expand-corpus.ts:19`:
  *"variants are armed only by the Flow lane (Wave 2); the recording lane always
  runs a workflow unarmed"*. `runBench` never passes `flow: true`
  (`run-bench.ts:130-140`) and hard-codes `lane: "recording"`, so **there is no
  CLI path to a Flow-lane bench at all.** Affected: W04 `text-variant`,
  W05 `short-catalog`, W06 `no-results`, W08 `column-reorder`,
  W11 `end-early`, W13 `banner-absent`, W14 `armed`, W15 `popup-blocked`,
  W19 `expired`, W20 `selector-only`, W21 `text-only`, W22 `moved`,
  W23 `wrapped-aria`, W24 `unannounced`.
- **6 skipped because the variant does not exist in the Scenario Lab.**
  W10 `broken-link`, W25 `too-slow`, W26 `no-context`, and all three W27
  surfaces (`disabled`, `detached`, `blocked-url`). These are a **fixture gap**:
  even the Flow lane cannot run them. `bench/tests/week1-corpus.test.ts`
  enumerates them as `UNRESOLVED_TODAY`, so the gap is known and pinned.

**W19–W23 are variant-only rows** (`unarmed: false`) — they contribute *zero*
runnable results.

### 5.3 The 18 FluxBench categories

The canonical list of 18 is the opening audit's matrix
(`reports/audit-testing-facility.md:127`). Mapping it against the plan's corpus
table and the runnable set above:

| # | Category | Corpus row(s) | Runnable in `bench` today? |
| --- | --- | --- | --- |
| 1 | Simple extraction | W04 | ✅ |
| 2 | Paginated extraction | W05 | ✅ |
| 3 | Table extraction | W08 | ✅ |
| 4 | Search | W06 | ✅ |
| 5 | Multi-page navigation | W10 | ✅ (negative variant missing) |
| 6 | Forms | W01, W02, W17 | ✅ |
| 7 | Dynamic interfaces | W03, W09, W25 | ✅ |
| 8 | Modals | W12 | ✅ |
| 9 | Infinite scrolling | W11 | ✅ |
| 10 | Downloads | W16 | ✅ |
| 11 | Multiple tabs | W15 | ✅ |
| 12 | Conditional behaviour | W07 | ✅ |
| 13 | Authentication-compatible | W18 (W19 negative) | ✅ positive only |
| 14 | **Changed selectors** | W20, W23 | ❌ variant-only |
| 15 | **Changed text** | W21 | ❌ variant-only |
| 16 | **Moved elements** | W22 | ❌ variant-only |
| 17 | **Unexpected popup** | W14 | ⚠ row runs, but *unarmed* — the interstitial never appears, so the category's actual behaviour is not exercised |
| 18 | Unexpected intermediate state | W24 | ✅ (negative variant skipped) |

**13 of 18 fully exercised; 3 not exercised at all; 1 nominal only; 1 positive
half only.** Four further rows sit outside the 18: W13 blocking overlay,
W26 targeting, W27 failure taxonomy, W28 frame targeting — all runnable.

The three that are entirely absent from a `bench` run — changed selectors,
changed text, moved elements — are exactly the identity-drift work Wave 3 spent
effort on. They are reachable **only** through
`lab run identity-drift --flow --variant <id>`, one at a time, producing a run
result but **not** a `BenchReport` row.

### 5.4 Does `--corpus week1 --repeat 3` emit every metric? **No.**

23 runnable × 3 = **69 runs**, plus 60 skipped records. Against the plan's
Metrics table (`mvp-week1…plan.md:644-656`):

| Metric | Emitted? | Why |
| --- | --- | --- |
| Flow creation success | **`null`** | `applies: lane === "flow"`; the bench is recording-lane only. |
| Initial execution success | ✅ | 23 workflows. |
| Deterministic replay success | ✅ | 46 later runs. |
| Fuzzy recovery rate | **`null`** | `applies: variantId !== null`; every variant is skipped. |
| False failure / false success | ⚠ **partial** | `applies` needs `reportedVerdict !== null`, which needs FluxIQ to have executed an action. Only **7 of 23** rows have a `type` step with a CSS target, so only 7 rows enter this population. |
| Failure classification accuracy | **`null`** | `applies: !positive`, i.e. `expected.failure` set. Every negative result in the corpus is a variant, so all are skipped. |
| Harness activation rate | ✅ | Hard-coded 0 on the recording lane; useful as an invariant, not a measurement. |
| Action latency p50/p95 per action type | ⚠ **two types only** | The recording lane's only FluxIQ actions come from `proveCoreActionRoundTrip`: `web.browser.navigate` and `web.dom.type`. Confirmed in the latest bench's `report.json` — those two types and nothing else. |
| Evidence size p50/p95, truncation | **always empty** | `RECORDING_LANE_SOURCES.evidenceSizes`: *"none: the recording lane's bundle holds no sanitized packets or raw snapshots"*. Confirmed: `samples: 0` in the newest report. |
| Harness recovery / adaptation ×4 | **`null` by design** | Week 2 schema placeholders. |

Which of the 23 rows have the qualifying `type` step (and therefore a FluxIQ
verdict and latency samples): **W01, W02, W03, W06, W12, W18, W24**. The other
16 rows prove the recording lane only.

**Bottom line for Phase 1.6:** `--corpus week1 --repeat 3` is a real and
worthwhile run — it proves 23 workflows record and replay deterministically
across the whole fixture set — but it is *not* the plan's Metrics table. To
produce that table something has to change in code: either `runBench` grows a
Flow-lane mode (a `--lane flow` on `bench`, passing `flow: true` and expanding
variants), or the six missing Scenario Lab variants are added, or both. That is
a Phase 1.6 work item, not an operations detail. I am confident of this
conclusion; it follows directly from `run-bench.ts`, `expand-corpus.ts` and
`aggregate-report.ts`, and it is corroborated by the metric `null`s in the
existing `smoke` report.

### 5.5 Measured wall-clock, and why 45 minutes is optimistic

From the eight `smoke` benches on disk (each 2 rows × 2 repeats = 4 runs), start
to finish:

| Bench | Wall | Per run |
| --- | --- | --- |
| bench-mtxgozcb | 4 m 49 s | 72 s |
| bench-mtxgwjhb | 3 m 57 s | 59 s |
| bench-mtxh27sa | 3 m 48 s | 57 s |
| bench-mtxh7z0e | 4 m 06 s | 61 s |
| bench-mtxigc2s | 3 m 48 s | 57 s |
| bench-mtxjo1kt | 3 m 31 s | 53 s |
| bench-mtxju6eb | 2 m 59 s | 45 s |
| bench-mtxoim0b | 3 m 35 s | 54 s |

Mean ≈ **57 s/run**; the newest report's own `runDurationMs` is p50 51.1 s,
p95 57.2 s. Both smoke rows are short (5 and 3 recording steps). The corpus
average is 4.0 steps, but W11 has 8 and W15 has 9, and `file-transfer`,
`auth-gate` and `infinite-feed` all wait on real timing.

**Estimate for `--corpus week1 --repeat 3`: 69 runs × 60–95 s ≈ 70–110 minutes,
central estimate ~80 minutes.** The plan's "~45 min" is optimistic by roughly
1.5–2×. This is an extrapolation from measured smoke data, not a measurement of
the corpus — mark it as such.

Evidence cost is negligible: a finalized bundle is ~70 KB with 3 screenshots
(measured on `test-runs/run-mtxom73f-f1740ca3`), so 69 runs ≈ 5 MB. Every
manifest declares `screenshots: "events"`, and `trace`/`video` are declared but
never captured (`effective-evidence-policy.ts:16-19` reports them as `off`
rather than claiming capture that did not happen). **Do not pass `--evidence`
at all** — the manifest policy is already what you want, and an override loses
the per-scenario `reviewRequired` intent.

---

## 6. What a run needs from the environment

### 6.1 Environment files

`target-config.ts:174-181`: the runner reads `.env`, then `.env.local`, then the
process environment, later winning. `FLUXIQ_TEST_ENV_FILES=none` skips both
files; **any other value is rejected**. There is no way to unset a single
file-provided variable from the process environment — only `none`.

- `.env` — does not exist here.
- `.env.local` — exists, git-ignored, generated by `pnpm demo:setup-local`.
  **Never edit it.** It configures the user's existing install and the demo
  workspace. Non-secret contents: `FLUXIQ_TEST_TARGET=existing`,
  `FLUXIQ_TEST_BASE_URL=http://127.0.0.1:3000`,
  `FLUXIQ_TEST_GATEWAY_URL=ws://127.0.0.1:4777/client`,
  `FLUXIQ_TEST_RUNS_DIR=F:/!FluxIQWebExtension/test-runs`, and the five
  `FLUXIQ_DEMO_*` settings. It also holds credentials, a PIN, and a provider API
  key, none of which are reproduced here or needed by any isolated run.

With `FLUXIQ_TEST_ENV_FILES=none`, `FLUXIQ_TEST_RUNS_DIR` is unset and the
runner falls back to `<repo>/test-runs` — **the same directory**, so bench
reports and bundles still land where the team expects them.

How to set it:

```powershell
# PowerShell — no inline prefix exists; set it for the session
$env:FLUXIQ_TEST_ENV_FILES = "none"
pnpm lab bench --corpus smoke --repeat 2 --target isolated
```
```bash
# Git Bash
FLUXIQ_TEST_ENV_FILES=none pnpm lab bench --corpus smoke --repeat 2 --target isolated
```

### 6.2 Credentials

None for `isolated`. If `FLUXIQ_TEST_USERNAME`/`PASSWORD` happen to be present
they are used, and **both must be present or neither** — with env files loaded
this is another reason the prefix matters. Without them the runner generates a
random `lab-<hex>` admin, a base64url password and a 6-digit PIN per run
(`coordinator.ts:203-211`).

### 6.3 A running panel

**Not needed, and must not be started.** `isolated` and `persistent-isolated`
each start their own Core on random loopback ports. Only `existing` and `clone`
need the user's panel at `127.0.0.1:3000`. `AGENTS.md` forbids starting it
without explicit authorization; nothing in the recommended plan below requires
it.

### 6.4 A paired extension

The runner does the pairing itself: it polls the side panel for a pairing
reference code, calls `control.approvePairing(...)` as the authenticated
operator, and polls until `connectionState === "connected"`
(`run-scenario.ts:398-403`). Nothing manual.

### 6.5 Network

**None required, and outbound is blocked.** `installDeterministicNetworkGuard`
routes `**/*` in the browser context and aborts anything not on the scenario,
FluxIQ or gateway origins, recording a violation that fails the run
(`network-guard.ts`). Provider secrets are stripped from every child process
environment by `withoutProviderSecrets` (`environment.ts:26-28`), which covers
the `DEEPSEEK_API_KEY` in `.env.local` even if env files were loaded.
`--live-llm` is rejected outright. Week 1 validation is provider-free by
construction.

### 6.6 Builds that must exist

`apps/scenario-lab/dist/server.js` and `registry.js`;
`apps/extension/dist/e2e-chromium/manifest.json`;
`domain/dist/host/web-panel-host.mjs`; `packages/test-runner/dist/cli.js` and
its dependency dists; Core's `apps/web/node_modules` and `packages/` in
`F:\!FluxIQ`. All verified present. `pnpm lab` rebuilds the first four every
invocation.

### 6.7 Display

Every Lab run and the extension e2e suite are **headed** (`headless: false`,
hard-coded in both). A real interactive Windows desktop is required, and the Lab
calls `page.bringToFront()`, so the desktop must not be locked or in use.

---

## 7. Concurrency: exactly where parallelism is unsafe

Three distinct hazards, only one of which is obvious.

**Hazard 1 — the shared extension build (hard blocker).** Every `pnpm lab`
invocation runs `extension test:e2e:build` → `pnpm build`, which does
`rm -rf dist/` and `rm -rf build/` then rebuilds all three targets
(`build-extension.mjs:172-178`). Two concurrent `pnpm lab` commands, or a
`pnpm lab` beside `pnpm --filter extension test:e2e` or `pnpm build` or
`pnpm check`, will delete `dist/e2e-chromium` out from under a running browser.
**Never overlap any two of these.** Side effect worth knowing:
`apps/extension/build/` is a **tracked** directory, so every `pnpm lab` rewrites
tracked files.

*Mitigation that buys real parallelism:* build once, then bypass the wrapper —
`node packages/test-runner/dist/cli.js <verb> …` from the repository root does
not rebuild anything. (Inferred from `cli.ts:17` reading
`FLUXIQ_WEB_EXTENSION_ROOT ?? process.cwd()`; not executed.)

**Hazard 2 — the headed desktop (hard blocker for Lab runs).** Two Lab runs both
call `page.bringToFront()` on the same desktop; whichever loses focus can lose
trusted input and time out. Note that `apps/extension/e2e/playwright.config.ts`
sets `fullyParallel: true` with default workers, so the extension e2e suite is
*already* internally parallel and headed — that is existing, working behaviour,
but it means that suite alone will occupy the desktop.

**Hazard 3 — the shared `packages/test-contracts/dist` (soft).**
`test:content` and `scenario-lab test:e2e` both begin with
`pnpm --filter @fluxiq-web-extension/test-contracts build` (`tsc -p`), and
`pnpm lab`'s prebuild builds the same package. Two `tsc` processes writing the
same `dist` concurrently can produce a transient inconsistent state. Low
probability, easy to avoid: serialise one warm-up build first, then run the
headless suites in parallel.

**Non-hazards.** Isolated runs allocate unique directories and random loopback
ports, so there is no state or port collision between them
(`allocation.ts:allocateRun`). Persistent-isolated workspaces are protected by a
per-workspace lock. The content harness builds into a per-run directory of its
own and is explicitly designed to survive a concurrent `pnpm build`.

---

## 8. Recommended execution order for live Week 1 validation

Principle: prove the cheap, headless, high-resolution layers first, so that when
the expensive headed layer fails you already know whether the fault is in the
page-side code (the harness would have caught it) or in the background/gateway
path (only the Lab can catch it). Everything below is `isolated`; nothing
touches the user's real install; nothing needs the panel.

**Step 0 — serialise one warm-up build. ~2–4 min. Blocks everything.**
`pnpm build` (or `pnpm check`, which builds too). One process, alone. This
settles `dist/`, `build/`, and every package `dist/` so the later steps do not
race on Hazard 1 or Hazard 3. Also confirms the tree compiles before any browser
starts.

**Steps 1–4 run CONCURRENTLY after step 0. All headless. Total ≈ 5–8 min.**

| # | Command | Proves | Est. |
| --- | --- | --- | --- |
| 1 | `pnpm test` (root, `pnpm -r test`) | Every `node --test` suite: mappings, sanitizers, classifiers, corpus resolution. Includes `bench/tests/week1-corpus.test.ts`, which fails the moment a variant stops resolving — the cheapest possible check of §5.2. | 2–5 min |
| 2 | `pnpm --filter @fluxiq-web-extension/extension test:content` | 186 content-harness tests: real DOM, real bundle, real fixtures. Highest diagnostic value per second in the whole facility. | ~1–3 min |
| 3 | `pnpm --filter @fluxiq-web-extension/scenario-lab test:e2e` | 55 headless specs proving the fixture oracles themselves behave — i.e. that a later Lab failure is the extension's fault, not the fixture's. | ~1–2 min |
| 4 | `pnpm structure:check` | Module-size / placement gate. Instant, and a `pnpm check` gate anyway. | seconds |

These four are safe together because none rebuilds the extension and step 0 has
already settled the shared `dist/`s. Each writes to its own output directory.

**Step 5 — the real extension, no Core. ~1–2 min. HEADED: must run alone.**
`pnpm --filter @fluxiq-web-extension/extension test:e2e`
(run `playwright install chromium` once first if needed — `chromium-1234` is
already present). Six tests. This is the *only* thing that proves MV3 service
worker restart and the background→content message hop. Put it before the Lab
because it is ~40× cheaper and isolates the same failure mode: if the worker
cannot restart here, no Lab run will be trustworthy.

Caveat: this command's `test:e2e` script runs `test:e2e:build` first, so it
re-triggers Hazard 1. Nothing else may run alongside it.

**Step 6 — one Lab smoke bench. ~4 min. HEADED: must run alone.**
```
$env:FLUXIQ_TEST_ENV_FILES = "none"
pnpm lab bench --corpus smoke --repeat 2 --target isolated
```
Two rows × two repeats. Proves the entire stack end to end — topology startup,
Core boot, pairing, recording, Core round trip, evidence bundle, report
generation — and gives a per-run wall time for *this* tree to calibrate step 8.
Directly comparable to the eight historical benches on disk. **If this fails,
stop; nothing longer will succeed.**

**Step 7 — Flow-lane and variant spot checks. ~2–4 min each. HEADED: alone,
sequential with each other.** This is the only way to exercise the three
FluxBench categories the bench cannot reach (§5.3), and the only way to exercise
`flowCreationSuccess` and `failureClassificationAccuracy` at all. Highest value
first:
```
node packages/test-runner/dist/cli.js run identity-drift --variant selector-only --flow
node packages/test-runner/dist/cli.js run identity-drift --variant text-only --flow
node packages/test-runner/dist/cli.js run identity-drift --variant moved --flow
node packages/test-runner/dist/cli.js run identity-drift --variant wrapped-aria --flow
node packages/test-runner/dist/cli.js run modal-flows --workflow interstitial --variant armed --flow
node packages/test-runner/dist/cli.js run auth-gate --variant expired --flow
node packages/test-runner/dist/cli.js run intermediate-state --variant unannounced --flow
```
(with `FLUXIQ_TEST_ENV_FILES=none` set, and using the direct CLI so no rebuild
races). Note: I have **not** verified that any of these seven pass today. The
Flow lane is implemented and wired (`flow-lane/run-flow-lane.ts`), and the
corpus test confirms each variant *resolves*, but no report I read records a
green Flow-lane variant run. Treat step 7 as discovery, and expect to spend time
here.

**Step 8 — the full corpus. ~70–110 min. HEADED: alone. Last, because it is the
longest and the most fragile.**
```
node packages/test-runner/dist/cli.js bench --corpus week1 --repeat 3
```
69 runs. Then, offline and free:
```
node packages/test-runner/dist/cli.js compare <bench-id> --halves
```
which splits the three repeats 2/1 and reports `improved` / `regressed` /
`equivalent` per metric — the repeatability check the plan's tolerance line
wants. `--halves` needs `--repeat ≥ 2`, so `--repeat 3` is the minimum that
makes it meaningful.

`runs.json` is rewritten after every single run, so a bench killed at minute 60
still yields partial evidence — do not restart it from scratch on a Ctrl-C.

**Never in this plan:** `--target existing`, `--target clone`,
`pnpm lab matrix --all`, deleting anything under
`test-runs/persistent-isolated/`, starting the user's panel, or editing
`.env.local`.

### Parallelism summary

| Can run together | Must run alone |
| --- | --- |
| Steps 1, 2, 3, 4 (all headless, after step 0) | Step 0 — rebuilds shared dists |
| — | Step 5 — headed **and** rebuilds |
| — | Steps 6, 7, 8 — headed, one desktop |

Realistic total: **≈ 15 minutes to a confident go/no-go** (steps 0–6), and
**≈ 2–2.5 hours** for the complete picture including step 8. The 15-minute
prefix is where nearly all the diagnostic value is.

---

## 9. Confidence and gaps

**Verified by reading code and by measured data on disk:** every CLI verb and
flag; the four topologies' directory layouts, locks and cleanup rules; that both
the Lab and the extension e2e suite load the real unpacked MV3 artifact headed;
the content harness's exact boundary; the corpus expansion (23 runnable / 20
skipped, produced by running the facility's own `expandCorpus` against the built
registry); which metrics are `null` and why; per-run wall times from eight
historical benches; `.env.local`'s target mode.

**Inferred, and flagged as such:** the ~70–110 min estimate for the full corpus
(extrapolated from smoke, not measured); that `persistent-isolated` is only
marginally faster than `isolated`; that `node packages/test-runner/dist/cli.js`
bypasses the rebuild cleanly; timings for steps 1–5; that `matrix --all` would
fail on `instruction-only-form`.

**Not established — the supervisor should treat these as open:**

1. **No Flow-lane run is known to pass.** Step 7 is unproven ground. If the Flow
   lane does not work, three FluxBench categories and two Metrics rows have no
   path at all in Week 1.
2. **The last bench on disk (2026-09-12T01:04Z) predates the current working
   tree**, which has roughly 40 modified files uncommitted. Nothing measured
   here has been re-measured against the tree as it stands.
3. **Six corpus variants do not exist as fixtures** (W10 `broken-link`,
   W25 `too-slow`, W26 `no-context`, W27 ×3). Someone has to write them, or the
   plan's corpus table has to change.
4. **`runBench` has no Flow-lane mode.** Emitting the plan's Metrics table needs
   a code change, not just a longer run.
5. **Firefox has no automated coverage whatsoever.**
6. **`--target existing` is documented as never validated live** and is
   unconfigurable here; if Week 1 genuinely needs it, that is its own project.
