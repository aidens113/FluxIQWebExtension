# t183: Release Packaging, CI, Onboarding Shell, Release Docs

Lane lead report, 2026-09-29. Branch `task/t183-release-packaging` in both
worktrees:

- `C:\Users\osrs_\FluxStuff\fxwork\t183\!FluxIQWebExtension`
- `C:\Users\osrs_\FluxStuff\fxwork\t183\!FluxIQ`

Nothing was committed. No live Lab runs and no provider calls were made.

This lane addressed MVP plan sections 4.2, 4.5 (the user controls), 4.9 and
4.10, and facility defects 1, 3 and 4. Defect 7 was not touched: it is a
design decision about the boundary audit, not packaging or CI.

## Outcome

- **Packaging:** done.
  - Store-ready ZIPs are produced for Chrome/Edge and Firefox, read back from
    disk, and verified.
  - Every `pnpm build` checks the Firefox build structurally (and so do the
    Chrome and e2e builds).
  - The permissions review is enforced by the build.
  - Production icons, store copy, privacy policy and install docs are written.
- **CI:** the workflow is fixed as far as it can be without the owner's
  settings, and it passes actionlint. Three values only the owner can set
  still block every run.
- **Onboarding:** done in Core by worker t183-core, and verified here.
  - The first-run view is built but not mounted, because mounting it needs a
    file outside the owned trees (see the integration step below).
  - The settings "AI Provider" section is mounted.
- **Docs:** `docs/user/**` (6 files), a README user section,
  `docs/architecture/release-packaging.md`, and updates to
  `repository-layout.md` and `testing-facility.md`. A release-candidate
  checklist script runs today.

## Downstream changes

### New `apps/extension/scripts/release/`

| File | What it does |
| --- | --- |
| `build-info.mjs` | The build stamp. It maps every esbuild metafile input, plus the static files, manifest, `package.json` and build code, to a SHA-256. `compareBuildInfo` returns `current`, `stale` or `unstamped`. |
| `verify-extension-target.mjs` | The install-time structural check. It covers the manifest identity and store limits, version against `package.json`, referenced files, page script/style resolution (no remote code), a parse of every script, PNG sizes against their declarations, the Firefox and Chromium rules, and the permissions against the review. |
| `permission-review.mjs` | The reviewed permission set, with install warning, call sites and reason for each. The build fails on any permission not listed here. |
| `zip-archive.mjs` | A dependency-free ZIP writer and reader. Output is reproducible: entries sorted, DOS-epoch timestamps. |
| `icon-png.mjs` | Renders the icon at 16, 32, 48 and 128 px. It replaces the one 128 px placeholder that was written under all four names. |
| `target-files.mjs` | Reads a target directory into the same map shape `readZip` returns. |
| `package-extension.mjs` | The packaging CLI, `[--release] [--out DIR]`. |
| `release-candidate-checklist.mjs` | The skeleton for plan 4.7 and 4.10. |
| `index.mjs` | Barrel. |
| `tests/*.test.mjs` | 13 tests. |

### Other downstream files

- **`scripts/build-extension.mjs`.** The build now:
  - collects metafile inputs;
  - writes `build-info.json` into each target;
  - renders the icons;
  - verifies all three targets at the end, failing the build on any error.

  `bundleExtensionEntry` gained an optional `inputs` set. Its other callers
  are unchanged.
- **`scripts/test-extension.mjs`** also runs `scripts/**/tests/*.test.mjs`.
- **`manifest.chrome.json`:**
  - `minimum_chrome_version` is now 116, because `sidePanel.setPanelBehavior`
    needs it;
  - the store description is new (109 characters).
- **`manifest.firefox.json`:**
  - `strict_min_version` is raised from 109.0 to 128.0. Firefox honours
    `world: "MAIN"` on manifest content scripts only from 128; on 109-127 the
    page-world dialog override would silently run in the isolated world.
  - `data_collection_permissions` now declares
    `websiteContent`, `websiteActivity` and `browsingActivity` as required;
  - the store description is new.
- **`e2e/fixtures/extension-context.ts`.** `assertCurrentBuild` runs before
  launch. It throws `environment.stale:` naming up to 5 drifted inputs, or
  when the build has no stamp. The result is cached per artifact per worker
  process.
- **`.github/workflows/testing-facility.yml`:**
  - the static gate now packages and verifies the store ZIPs, on both
    operating systems, and uploads them from Ubuntu;
  - `chromium-smoke` runs `test:e2e` on every event, not only when the
    selector asks for browser smoke. The scenario-page step stays selective.
  - new `nightly-plan` job: shards the registry 4 ways;
  - `nightly-full-matrix`: now a matrix over those shards, with
    `--scenarios-json`, a 150-minute step limit and a 210-minute job limit;
  - job timeouts are added.
- **Docs:**
  - `README.md`: new user section;
  - new `docs/user/`: `README.md`, `install.md`, `quickstart.md`,
    `permissions.md`, `privacy-policy.md`, `store-listing.md`;
  - new `docs/architecture/release-packaging.md`;
  - `docs/architecture/repository-layout.md`: the `dist/` row;
  - `docs/architecture/testing-facility.md`: the fixture's stale check and the
    CI list.

### Permissions review

Every permission is kept and justified; none could be narrowed without
breaking a shipped behaviour:

- **`<all_urls>`:** the recorder must be in every frame at `document_start` on
  a site the user chooses, and `captureVisibleTab` uses it.
- **`downloads`:** read-only observation, through `search` and `onChanged`. It
  is the best candidate to become optional once the panel can ask at the right
  moment; the code already fails with a named error when it is absent.
- **`scripting`:** reinjects the content script into tabs that predate the
  install, and reads the HTTP status after a click.
- **`tabs` and `webNavigation`:** tab and frame lifecycle.
- **`activeTab`:** gives "on click" site access in Chrome, and covers Firefox
  MV3, where host access is opt-in.
- **`storage`** and **`sidePanel`**.

Each reason, and the code that uses the permission, is in
`permission-review.mjs` and `docs/user/permissions.md`.

## Core changes (worker t183-core, verified here)

The new and changed files are in `apps/web/src/features/automation-studio/`:

- `onboarding/**`, all new: `OnboardingView`, `OnboardingLiveView`, the pure
  `onboardingSteps` model (runtime → pairing → DeepSeek key, each done, current
  or blocked), the plan's one-line message, and the three start options;
- `settings/ai-provider-model.ts` and `settings/AiProviderSettingsSection.tsx`,
  mounted in `FlowSettingsView` as the "AI Provider" section. The section shows
  the DeepSeek key status and links to the existing Secret Keys program, so
  there is no second secret store. It also has an adaptation on/off switch
  that maps to the existing `applyFlowAdaptationMode`: off is
  `no_llm_intervention`, on is `fully_adaptive`.

The worker's report is `t183-core-onboarding-settings.md` in this folder.

I changed one thing after its report. The worker had put a second model
picker in the new section, bound to the same field as the existing "Model"
picker in LLM Connection. I replaced it with a read-only "Model: X — Change
model" link to `#flow-settings-llm`. The test now asserts that Flow Settings
renders exactly one model `<select>`.

### Integration step for the supervisor

Mounting the onboarding view is outside this lane's trees. The proposed diff
adds a new `app/get-started/` route. It is in the worker's report, not
applied, and not compiled.

## Validation (commands run, output observed)

**Downstream:**

- `pnpm --filter @fluxiq-web-extension/extension build`: tsc was clean, and
  every target verified:

  ```text
  extension build: chrome: verified 22 files
  extension build: firefox: verified 22 files
  extension build: e2e-chromium: verified 22 files
  ```

  There was one warning, the placeholder `gecko.id`. The build took 5m43s
  under load from the shared machine.
- `node apps/extension/scripts/release/package-extension.mjs` exited 0:
  - `chrome`: 391,795 bytes, 14 files, sha256 `56e95023…`;
  - `firefox`: 391,873 bytes, 14 files, sha256 `bd81e430…`;
  - Python `zipfile.testzip()` returned `None` for both, so an independent
    reader agrees;
  - no `.map` files and no `build-info.json` in either package;
  - the manifest permissions are as reviewed.
- The stale check against the real `dist/e2e-chromium`:
  1. at first it reported `{"state":"current"}`;
  2. after appending a space to `manifest.e2e.json`, it reported
     `{"state":"stale","changed":["apps/extension/manifest.e2e.json"],"removed":[]}`;
  3. after reverting the file, it reported `{"state":"current"}` again, and
     `git status` was clean for that file.
- `node --test scripts/release/tests/release.test.mjs scripts/release/tests/release-candidate-checklist.test.mjs`:
  `# tests 13`, `# pass 13`.
- `tsc -p tsconfig.test.json` (which covers the fixture importing `.mjs`): no
  diagnostics.
- The icon at 128 px was viewed as an image and renders correctly.
- actionlint 1.7.7, downloaded to scratch, on `testing-facility.yml`: exit 0,
  no findings, with shellcheck not installed. The previous workflow also
  passed.
- The `yaml` 2.9.0 parser in strict mode, with unique keys, accepted the file.
  A script also checked the job graph: every `needs.X` read is declared. The
  jobs are `prerequisites`, `select`, `static`, `chromium-smoke`,
  `changed-scenarios`, `nightly-plan` and `nightly-full-matrix`.
- The nightly shard script was extracted from the YAML and run against the
  local registry. Output: `41 scenarios in 4 shards`, sized 11/10/10/10.
- `node apps/extension/scripts/release/release-candidate-checklist.mjs` was
  run before the docs existed. It exited 1 with NOT READY: release packaging
  failed on the placeholder `gecko.id`, the docs were missing, and 20 items
  were pending. Both failures are correct. The docs have since been written.
- The structure audit and the full extension `pnpm test`: see the final
  section.

**Core:**

- `pnpm --filter @fluxiq/web exec vitest run src/features/automation-studio/settings src/features/automation-studio/onboarding`:
  `Test Files 10 passed (10)`, `Tests 66 passed (66)`. This was re-run by me
  after my edit.
- `pnpm --filter @fluxiq/web check`: tsc exited 0.
- `node scripts/structure-audit.mjs` at the Core root, re-run by me after my
  edit: `passed (195 warning(s), 355 baselined)`. It also printed "1 baseline
  entries can be lowered"; I did not update the baseline.

## Owner-only configuration

Nothing here can be done from this lane:

- **CI:**
  - repository **variable** `FLUXIQ_CORE_REPOSITORY` (`owner/name`);
  - repository **variable** `FLUXIQ_CORE_REF` (a pinned SHA or tag);
  - repository **secret** `FLUXIQ_CORE_TOKEN` (read-only Contents access to
    Core).

  No other secret is needed.
- **Stores:**
  - the permanent Firefox add-on id, since `@example.local` is a placeholder
    and `--release` refuses it;
  - the Chrome Web Store and AMO developer accounts;
  - a public URL for the privacy policy;
  - screenshots, which need a live browser;
  - the AMO source submission.

## Not verified

- **No GitHub Actions run.** None is possible until the owner values are set,
  so Linux, Windows CI, Core's `--frozen-lockfile` in CI, and the nightly
  timing are all unproven.
- **No real Firefox load.** The Firefox build was checked structurally only.
  Playwright 1.51.1 cannot load add-ons, and the pinned Firefox revision is
  missing. The first step of the release-candidate checklist covers it.
- **The e2e suite was not run in a browser here.** The fixture's stale check
  was type-checked and exercised through `compareBuildInfo`, not through a
  Playwright launch.
- **Runtime behaviour after the manifest changes is not live-tested.** The
  changes are `minimum_chrome_version`, `strict_min_version` and
  `data_collection_permissions`; the build and verifier accept them.
- **Core's onboarding view is not mounted and not rendered in a browser.** Its
  live snapshot reads are untested against a server.
- **Not run:** full `pnpm check`, `pnpm test` and `pnpm build` at the root, in
  either repository.
- **Unconfirmed:** the provisional FluxBench thresholds need the owner's
  confirmation.

## Final checks

- **First downstream structure audit: 3 failures, now fixed.**
  - Two were `[imports]` failures: `build-extension.mjs` and the fixture
    imported release files directly instead of through the barrel. Both now
    import `scripts/release/index.mjs`.
  - One was `[swallowed-failure]`: the checklist's docs `access().catch`. It
    now records ENOENT only and rethrows anything else.
- **Re-run after the fixes:**
  - `node scripts/structure-audit.mjs`: `passed (114 warning(s), 120
    baselined)`, exit 0. The warning count is unchanged from the baseline
    before this lane.
  - The fresh extension build exited 0, and all three targets verified.
  - Packaging exited 0. Both ZIPs came out byte-identical to the first build:
    chrome `56e95023...` and firefox `bd81e430...`. That confirms the packaging
    is reproducible.
- **`EXTENSION_TEST_BUILD_LABEL=t183 pnpm test`** in `apps/extension`: the
  smoke test passed, then `# tests 1040`, `# pass 1040`, `# fail 0`. That
  count includes the 13 new script tests.
- **Checklist re-run with the docs present:** the docs item passes. It exits
  1 (NOT READY) with 1 pass, 1 fail and 20 pending. The only failure is the
  owner's placeholder Firefox id.

## Follow-up: onboarding mounted (supervisor-approved ownership extension)

The supervisor approved the mount. Ownership was extended to the new
directory `apps/web/src/app/get-started/` in Core. No existing Core file was
touched.

Files added:

- `page.tsx`: a server route. It redirects to `/` unless signed in, using the
  same `currentFluxIQUser` check as `app/programs/*`. It renders
  `GetStartedClient` inside `Suspense`, because `useProgramApi` reads
  `useSearchParams`.
- `GetStartedClient.tsx`: renders `OnboardingLiveView`. Each start option
  pushes `/programs/automation-studio?start=<option>`. Automation Studio does
  not read `start` yet, so it simply opens.
- `tests/GetStartedClient.test.tsx`: 3 tests. They render the route's client
  through the real `useOnboardingSources` → `useProgramApi` → `fetch` path,
  with `fetch` stubbed per endpoint. The tests cover:
  - both snapshot endpoints are requested;
  - the step states for an unpaired and a fully set-up machine;
  - no key material is rendered;
  - the start option navigates.

`docs/user/quickstart.md` now points to `http://127.0.0.1:3000/get-started`.

Validation, in the Core worktree:

- `pnpm --filter @fluxiq/web exec vitest run src/features/automation-studio/settings src/features/automation-studio/onboarding src/app/get-started src/app/tests`:
  `Test Files 15 passed (15)`, `Tests 83 passed (83)`.
- `pnpm --filter @fluxiq/web check`: exit 0.
- `node scripts/structure-audit.mjs`: `passed (195 warning(s), 355
  baselined)`, exit 0.

Not verified: `next build` and a real browser render of `/get-started`. The
route was not run on a dev server.

