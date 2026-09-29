# Release Packaging

How the extension becomes store packages, what proves each package is
loadable, and what the CI workflow gates. This describes the current design, as
of 2026-09-29 (t183). The user-facing side is in [docs/user](../user/README.md).

## Targets

`apps/extension/scripts/build-extension.mjs` bundles the entries once into
`build/`. It then assembles three targets under `dist/`:

| Target | Manifest | Purpose | Packaged |
| --- | --- | --- | --- |
| `chrome` | `manifest.chrome.json` | Chrome and Edge, side panel, `minimum_chrome_version` 116 | Yes |
| `firefox` | `manifest.firefox.json` | Firefox, toolbar popup, `strict_min_version` 128 | Yes |
| `e2e-chromium` | `manifest.e2e.json` | Test build limited to loopback hosts, loaded by the Playwright suite | Never |

Each minimum version is set by an API the extension uses. Chrome 116 is needed
for `sidePanel.setPanelBehavior`. Firefox 128 is the first version that honours
`world: "MAIN"` on a manifest content script; the page-world dialog override
depends on it. On an older Firefox, that key would be ignored, and the
override would run in the wrong world without any error.

Icons are rendered at each declared size by
`scripts/release/icon-png.mjs`. This replaced a single 128 px placeholder that
had been written under all four names.

## The build stamp

Every target carries a `build-info.json`, written by
`scripts/release/build-info.mjs`. It maps each file the target was made from to
that file's SHA-256:

- every file esbuild read for any bundle, taken from its metafile, including
  the Core files linked in from the sibling checkout;
- the HTML stubs;
- the manifest;
- `package.json`;
- the build code itself.

`compareBuildInfo` re-hashes those files and reports one of three states:
`current`, `stale` (naming each file that changed or was removed), or
`unstamped`.

Two consumers use it:

- **The e2e fixture** (`apps/extension/e2e/fixtures/extension-context.ts`)
  refuses to launch a stale or unstamped artifact, with an
  `environment.stale:` error. Before this, it caught only a missing artifact, so
  running `playwright test` by hand after an edit certified the old build.
  `pnpm test:e2e` rebuilds first, so it never meets this error.
- **Store packaging** refuses to package a stale target.

The check is exact because the inputs are the files the bundler actually read.
Editing a file no bundle reads does not mark a build stale. A new file can
only enter a bundle through an edit to a file already in it.

## Verifying a target without a browser

`scripts/release/verify-extension-target.mjs` checks a target the way a
browser checks it at install time:

- the manifest is MV3, its name and description fit the store limits, and its
  version matches `apps/extension/package.json`;
- every file the manifest names is present;
- each page's scripts and stylesheets resolve locally, with no remote code;
- every script parses;
- every icon is a PNG of its declared size.

Each browser also has rules of its own:

- **Firefox:** a gecko id, `background.scripts`, no side panel, a popup, and
  a minimum version of 128 when a content script uses `world: "MAIN"`.
- **Chromium:** a service worker, no `browser_specific_settings`, a side panel,
  and a minimum Chrome version of 116.

The requested permissions must also match the reviewed set in
`scripts/release/permission-review.mjs` exactly. That file records each
permission's install warning, its call sites, and the reason it is needed. A
new permission fails the build until it is reviewed there. The user-facing copy
of the review is [Permissions](../user/permissions.md).

The verifier runs at the end of every extension build, on all three targets,
so every `pnpm build` loads the Firefox build. It runs again on each store ZIP,
after that ZIP is read back from disk.

It is not a real Firefox launch. Playwright 1.51.1 cannot install a temporary
add-on, and its pinned Firefox revision is not the one installed here. What a
real launch would add, the extension actually starting, is checked for
Chromium by the e2e suite. For Firefox, it is step 1 of the release-candidate
checklist.

## Store packages

`scripts/release/package-extension.mjs [--release] [--out DIR]` zips the
`chrome` and `firefox` targets with `scripts/release/zip-archive.mjs`, a small
writer and reader with no dependencies.

The output is reproducible:

- entries are sorted;
- every timestamp is the DOS epoch;
- sourcemaps and `build-info.json` are left out, because they name local paths
  and are not needed at runtime.

The script writes these files to `apps/extension/dist/store/`, which is ignored
like the rest of `dist/`:

- `fluxiq-web-extension-<target>-<version>.zip`
- `SHA256SUMS`
- `package-report.json`

`--release` also refuses owner placeholders, which today means the
`@example.local` Firefox id.

On 2026-09-29, both 0.1.0 packages built at about 392 KB with 14 files each.
Both passed verification after being read back, and Python's `zipfile`
reported no CRC errors.

## Release-candidate checklist

`scripts/release/release-candidate-checklist.mjs` is the skeleton for plan
sections 4.7 and 4.10. Some checks run today:

- store packages in `--release` mode;
- the user documentation exists.

The rest read recorded evidence. `--evidence` takes a JSON file (`--template`
prints a blank one) that holds:

- the 13 clean-environment steps of plan 4.10;
- the owner-only actions.

`--bench` takes FluxBench `report.json` files (the test-contracts
`BenchReport`, schema 0.1). The script judges the flow-lane rates against
`PROVISIONAL_BENCH_THRESHOLDS`, which the plan does not set. The owner replaces
them once the first qualification runs are in.

An item with no evidence is `pending`. The script exits with:

- `0` when every item passes;
- `1` when any item fails;
- `2` when nothing fails but some items are pending.

## CI gates

`.github/workflows/testing-facility.yml` runs these jobs:

| Job | When | What it proves |
| --- | --- | --- |
| `prerequisites` | Always | The owner configuration below is present, and real-site execution is off |
| `static` (Ubuntu and Windows) | Always | `pnpm check`, `pnpm test`, and `pnpm build`, which verifies all three targets, including Firefox; then store packaging with read-back verification. The Ubuntu ZIPs are uploaded as an artifact |
| `chromium-smoke` (Ubuntu and Windows) | Always | `test:e2e` loads the real extension in Chromium. The scenario-page suite runs only when the selector asks for it |
| `select`, then `changed-scenarios` | Pull requests and pushes | Lab scenarios chosen from the changed paths |
| `nightly-plan`, then `nightly-full-matrix` | Schedule | The whole registry, three repeats, split into four parallel shards |

**Nightly sizing.** The registry holds 41 scenarios, so three repeats make 123
runs. Within a job, the runs go one after another. The only complete
deterministic timings on record (21 runs, Windows, 2026-09-13) are 44-108 s
per run. Unsharded, 123 runs would take 127-221 minutes in one job. That fits
under the 360-minute job cap, but the margin rests on only four measured
scenarios. With four shards of 10 or 11 scenarios each, a shard takes 22-60
minutes. Each shard has a 150-minute step limit and a 210-minute job limit, so
a stall ends as a named timeout and still uploads its evidence.

`nightly-plan` reads the shard list from the scenario registry, through the
selector's `loadScenarioCatalog`, so a new scenario needs no workflow edit.

### CI configuration the owner must set

Nothing else in the workflow depends on repository settings. These three
values are the reason every run so far failed at `Verify CI prerequisites`.

| Name | Kind | Value |
| --- | --- | --- |
| `FLUXIQ_CORE_REPOSITORY` | Repository **variable** (Settings > Secrets and variables > Actions > Variables) | The Core repository as `owner/name` |
| `FLUXIQ_CORE_REF` | Repository **variable** | A Core commit SHA or tag compatible with this repository's `dev`; pin it, don't use a branch |
| `FLUXIQ_CORE_TOKEN` | Repository **secret** | A fine-grained token with read-only **Contents** access to the Core repository |

No other secret is needed. No job calls an LLM provider, uses a store
credential, or signs a package. Store submission and AMO signing are manual
owner steps (see the [store listing](../user/store-listing.md#owner-only-steps)).

**Checked locally (2026-09-29):**

- actionlint 1.7.7 reported no findings, with shellcheck not installed;
- the `yaml` parser's strict mode accepted the file, and every `needs.*`
  reference names a declared dependency;
- the shard step's script, taken from the YAML, split the local registry into
  4 shards of 11/10/10/10.

**Not yet verified:** a run on GitHub. None can happen until the three values
above are set.
